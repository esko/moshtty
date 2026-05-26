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
    expect(() => decodeMuxFrame(new Uint8Array([2, 0, 0, 0, 1, 0x01]))).toThrow(MuxError)
    expect(() =>
      encodeMuxFrame({ version: 2, flowId: 1, payload: new Uint8Array([0x01]) })
    ).toThrow(MuxError)
  })

  it('rejects empty and oversized payloads', () => {
    expect(() => encodeMuxFrame({ version: 1, flowId: 1, payload: new Uint8Array() })).toThrow(
      MuxError
    )
    expect(() =>
      encodeMuxFrame({ version: 1, flowId: 1, payload: new Uint8Array(16 * 1024 + 1) })
    ).toThrow(MuxError)

    expect(() => decodeMuxFrame(new Uint8Array([1, 0, 0, 0, 1]))).toThrow(MuxError)
    expect(() =>
      decodeMuxFrame(new Uint8Array([1, 0, 0, 0, 1, ...new Uint8Array(16 * 1024 + 1)]))
    ).toThrow(MuxError)
  })

  it('rejects malformed frames and cert hashes', () => {
    expect(() => decodeMuxFrame(new Uint8Array([1, 0, 0, 0]))).toThrow(MuxError)
    expect(() => decodeCertHash(btoa('too-short'))).toThrow(MuxError)
  })

  it('decodes cert hash to 32 bytes', () => {
    const raw = new Uint8Array(32).fill(7)
    const base64 = btoa(String.fromCharCode(...raw))
    expect(decodeCertHash(base64)).toEqual(raw)
  })
})
