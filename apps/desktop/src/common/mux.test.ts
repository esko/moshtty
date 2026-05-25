import { describe, expect, it } from 'vitest'
import { decodeCertHash, decodeMuxFrame, encodeMuxFrame, MuxError } from './mux'

describe('mux framing', () => {
  it('round trips a frame', () => {
    const encoded = encodeMuxFrame({
      version: 1,
      flowId: 42,
      payload: new TextEncoder().encode('mosh-datagram')
    })
    const decoded = decodeMuxFrame(encoded)
    expect(decoded.flowId).toBe(42)
    expect(new TextDecoder().decode(decoded.payload)).toBe('mosh-datagram')
  })

  it('rejects unknown version', () => {
    expect(() =>
      decodeMuxFrame(new Uint8Array([2, 0, 0, 0, 1, 0x01]))
    ).toThrow(MuxError)
  })

  it('decodes cert hash to 32 bytes', () => {
    const raw = new Uint8Array(32).fill(7)
    const base64 = btoa(String.fromCharCode(...raw))
    expect(decodeCertHash(base64)).toEqual(raw)
  })
})
