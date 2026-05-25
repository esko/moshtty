import './transport/wasm_exec'

declare global {
  interface Window {
    moshttyMoshDial?: (
      keyB64: string,
      writeFn: (packet: Uint8Array) => void,
      onOutput: (data: Uint8Array) => void
    ) => string
    moshttyMoshReceive?: (connId: string, packet: Uint8Array) => string | null
    moshttyMoshSend?: (connId: string, keys: Uint8Array) => string | null
    moshttyMoshResize?: (connId: string, cols: number, rows: number) => string | null
    moshttyMoshClose?: (connId: string) => string | null
  }
}

// Go class is defined globally by wasm_exec.js
declare class Go {
  importObject: WebAssembly.Imports
  run(instance: WebAssembly.Instance): Promise<void>
}

let wasmInitPromise: Promise<void> | null = null

export async function initMoshWasm(): Promise<void> {
  if (wasmInitPromise) return wasmInitPromise

  wasmInitPromise = (async () => {
    const go = new Go()
    const response = await fetch('/mosh.wasm')
    const buffer = await response.arrayBuffer()
    const result = await WebAssembly.instantiate(buffer, go.importObject)
    void go.run(result.instance)

    // Wait for the Go main to start and export functions
    while (
      !window.moshttyMoshDial ||
      !window.moshttyMoshReceive ||
      !window.moshttyMoshSend ||
      !window.moshttyMoshResize ||
      !window.moshttyMoshClose
    ) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  })()

  return wasmInitPromise
}

export class MoshClient {
  private connId: string | null = null

  async dial(
    keyB64: string,
    writeFn: (packet: Uint8Array) => void,
    onOutput: (data: Uint8Array) => void
  ): Promise<void> {
    await initMoshWasm()
    if (!window.moshttyMoshDial) {
      throw new Error('Mosh Go WASM is not loaded')
    }
    const res = window.moshttyMoshDial(keyB64, writeFn, onOutput)
    if (res.startsWith('error:')) {
      throw new Error(res)
    }
    this.connId = res
  }

  receive(packet: Uint8Array): void {
    if (!this.connId || !window.moshttyMoshReceive) return
    window.moshttyMoshReceive(this.connId, packet)
  }

  send(keys: Uint8Array): void {
    if (!this.connId || !window.moshttyMoshSend) return
    window.moshttyMoshSend(this.connId, keys)
  }

  resize(cols: number, rows: number): void {
    if (!this.connId || !window.moshttyMoshResize) return
    window.moshttyMoshResize(this.connId, cols, rows)
  }

  close(): void {
    if (!this.connId || !window.moshttyMoshClose) return
    window.moshttyMoshClose(this.connId)
    this.connId = null
  }
}
