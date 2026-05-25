import { describe, expect, it } from 'vitest'
import { decodeMuxFrame, encodeMuxFrame } from '../../../common/mux'

describe('moshtty transport mux helpers', () => {
  it('encodes pane datagrams with flow id', () => {
    const frame = encodeMuxFrame({
      version: 1,
      flowId: 7,
      payload: new Uint8Array([1, 2, 3])
    })
    const decoded = decodeMuxFrame(frame)
    expect(decoded.flowId).toBe(7)
    expect(Array.from(decoded.payload)).toEqual([1, 2, 3])
  })
})
