export const MUX_VERSION = 1
export const MUX_HEADER_SIZE = 5
export const MUX_MAX_PAYLOAD = 16 * 1024

export type MuxFrame = {
  version: number
  flowId: number
  payload: Uint8Array
}

export class MuxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MuxError'
  }
}

export function encodeMuxFrame(frame: MuxFrame): Uint8Array {
  if (frame.version !== MUX_VERSION) {
    throw new MuxError(`unknown mux version: ${frame.version}`)
  }
  if (frame.payload.byteLength === 0) {
    throw new MuxError('mux payload must not be empty')
  }
  if (frame.payload.byteLength > MUX_MAX_PAYLOAD) {
    throw new MuxError('mux payload exceeds maximum size')
  }

  const out = new Uint8Array(MUX_HEADER_SIZE + frame.payload.byteLength)
  out[0] = frame.version
  out[1] = (frame.flowId >>> 24) & 0xff
  out[2] = (frame.flowId >>> 16) & 0xff
  out[3] = (frame.flowId >>> 8) & 0xff
  out[4] = frame.flowId & 0xff
  out.set(frame.payload, MUX_HEADER_SIZE)
  return out
}

export function decodeMuxFrame(data: Uint8Array): MuxFrame {
  if (data.byteLength < MUX_HEADER_SIZE) {
    throw new MuxError('mux frame too short')
  }
  const version = data[0]
  if (version !== MUX_VERSION) {
    throw new MuxError(`unknown mux version: ${version}`)
  }
  const flowId = (data[1] << 24) | (data[2] << 16) | (data[3] << 8) | data[4]
  const payload = data.slice(MUX_HEADER_SIZE)
  if (payload.byteLength === 0) {
    throw new MuxError('mux payload must not be empty')
  }
  if (payload.byteLength > MUX_MAX_PAYLOAD) {
    throw new MuxError('mux payload exceeds maximum size')
  }
  return { version, flowId, payload }
}

export function decodeCertHash(base64Hash: string): Uint8Array {
  const binary = atob(base64Hash)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  if (bytes.byteLength !== 32) {
    throw new MuxError(`cert hash must decode to 32 bytes, got ${bytes.byteLength}`)
  }
  return bytes
}
