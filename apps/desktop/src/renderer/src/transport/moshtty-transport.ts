import { decodeCertHash, decodeMuxFrame, encodeMuxFrame } from '../../../common/mux'

export type JsonRpcRequest = {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: unknown
}

export type JsonRpcResponse<T = unknown> = {
  jsonrpc: '2.0'
  id: number | string
  result?: T
  error?: {
    code: number
    message: string
  }
}

export type JsonRpcRequestHandler = (request: JsonRpcRequest) => Promise<unknown>

export type PaneInfo = {
  flowId: number
  key: string
  cols: number
  rows: number
}

export type TransportConnectOptions = {
  url: string
  token: string
  certHashes: string[]
}

type ControlWriter = WritableStreamDefaultWriter<Uint8Array>
type ControlReader = ReadableStreamDefaultReader<Uint8Array>

export class MoshttyTransport {
  private transport: WebTransport | null = null
  private controlWriter: ControlWriter | null = null
  private controlReader: ControlReader | null = null
  private datagramWriter: WritableStreamDefaultWriter<Uint8Array> | null = null
  private datagramReader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private nextId = 1
  private pending = new Map<
    number | string,
    {
      resolve: (value: unknown) => void
      reject: (reason: Error) => void
    }
  >()
  private requestHandler: JsonRpcRequestHandler | null = null
  private readLoopActive = false

  async connect(options: TransportConnectOptions): Promise<void> {
    const hashes = options.certHashes.map((hash) => {
      const bytes = decodeCertHash(hash)
      return {
        algorithm: 'sha-256' as const,
        value: new Uint8Array(bytes)
      }
    })

    this.transport = new WebTransport(options.url, {
      serverCertificateHashes: hashes as WebTransportHash[]
    })
    await this.transport.ready

    const controlStream = await this.transport.createBidirectionalStream()
    this.controlWriter = controlStream.writable.getWriter()
    this.controlReader = controlStream.readable.getReader()

    this.datagramWriter = this.transport.datagrams.writable.getWriter()
    this.datagramReader = this.transport.datagrams.readable.getReader()
    this.startControlReadLoop()
  }

  async close(): Promise<void> {
    await this.controlWriter?.close()
    await this.datagramWriter?.close()
    this.transport?.close()
    this.transport = null
    this.rejectPending(new Error('control stream closed'))
  }

  setRequestHandler(handler: JsonRpcRequestHandler | null): void {
    this.requestHandler = handler
  }

  async call<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    }
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject
      })
      void this.writeControl(request).catch((error: unknown) => {
        this.pending.delete(id)
        reject(error instanceof Error ? error : new Error('failed to send request'))
      })
    })
  }

  async createPane(params?: { shell?: string; cols?: number; rows?: number }): Promise<PaneInfo> {
    return this.call<PaneInfo>('pane.create', params ?? {})
  }

  async attachPane(flowId: number): Promise<PaneInfo> {
    return this.call<PaneInfo>('pane.attach', { flowId })
  }

  async sendPaneDatagram(flowId: number, payload: Uint8Array): Promise<void> {
    const frame = encodeMuxFrame({ version: 1, flowId, payload })
    await this.datagramWriter?.write(frame)
  }

  async readPaneDatagram(): Promise<{ flowId: number; payload: Uint8Array } | null> {
    const result = await this.datagramReader?.read()
    if (!result || result.done || !result.value) {
      return null
    }
    const frame = decodeMuxFrame(result.value)
    return { flowId: frame.flowId, payload: frame.payload }
  }

  private async writeControl(payload: unknown): Promise<void> {
    const bytes = new TextEncoder().encode(`${JSON.stringify(payload)}\n`)
    await this.controlWriter?.write(bytes)
  }

  private startControlReadLoop(): void {
    if (this.readLoopActive) {
      return
    }
    this.readLoopActive = true
    void this.readControlLoop()
  }

  private async readControlLoop(): Promise<void> {
    if (!this.controlReader) {
      this.rejectPending(new Error('control stream is not connected'))
      return
    }
    const chunks: Uint8Array[] = []
    try {
      while (true) {
        const { value, done } = await this.controlReader.read()
        if (done) {
          break
        }
        if (!value) {
          continue
        }
        chunks.push(value)
        let text = new TextDecoder().decode(concatBytes(chunks))
        let lineEnd = text.indexOf('\n')
        while (lineEnd >= 0) {
          const line = text.slice(0, lineEnd)
          if (line.trim()) {
            await this.handleControlMessage(JSON.parse(line) as JsonRpcRequest | JsonRpcResponse)
          }
          text = text.slice(lineEnd + 1)
          lineEnd = text.indexOf('\n')
        }
        chunks.length = 0
        if (text.length > 0) {
          chunks.push(new TextEncoder().encode(text))
        }
      }
    } catch (error) {
      this.rejectPending(error instanceof Error ? error : new Error('control stream failed'))
    } finally {
      this.readLoopActive = false
      this.rejectPending(new Error('control stream closed before response'))
    }
  }

  private async handleControlMessage(message: JsonRpcRequest | JsonRpcResponse): Promise<void> {
    if ('method' in message && message.method) {
      await this.handlePeerRequest(message)
      return
    }

    const response = message as JsonRpcResponse
    const pending = this.pending.get(response.id)
    if (!pending) {
      return
    }
    this.pending.delete(response.id)
    if (response.error) {
      pending.reject(new Error(response.error.message))
      return
    }
    pending.resolve(response.result)
  }

  private async handlePeerRequest(request: JsonRpcRequest): Promise<void> {
    if (!this.requestHandler) {
      await this.writeControl({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32601, message: 'method not found' }
      })
      return
    }

    try {
      const result = await this.requestHandler(request)
      await this.writeControl({ jsonrpc: '2.0', id: request.id, result })
    } catch (error) {
      await this.writeControl({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'internal error'
        }
      })
    }
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error)
    }
    this.pending.clear()
  }
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}
