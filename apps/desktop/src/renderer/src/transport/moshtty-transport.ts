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
  }

  async close(): Promise<void> {
    await this.controlWriter?.close()
    await this.datagramWriter?.close()
    this.transport?.close()
    this.transport = null
  }

  async call<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    }
    await this.writeControl(request)
    const response = await this.readControl<JsonRpcResponse<T>>()
    if (response.error) {
      throw new Error(response.error.message)
    }
    return response.result as T
  }

  async createPane(params?: { shell?: string; cols?: number; rows?: number }): Promise<PaneInfo> {
    return this.call<PaneInfo>('pane.create', params ?? {})
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

  private async readControl<T>(): Promise<T> {
    if (!this.controlReader) {
      throw new Error('control stream is not connected')
    }
    const chunks: Uint8Array[] = []
    while (true) {
      const { value, done } = await this.controlReader.read()
      if (done) {
        break
      }
      if (value) {
        chunks.push(value)
        const text = new TextDecoder().decode(concatBytes(chunks))
        const lineEnd = text.indexOf('\n')
        if (lineEnd >= 0) {
          return JSON.parse(text.slice(0, lineEnd)) as T
        }
      }
    }
    throw new Error('control stream closed before response')
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
