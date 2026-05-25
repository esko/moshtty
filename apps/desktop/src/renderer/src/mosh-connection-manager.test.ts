import { describe, expect, it, vi } from 'vitest'
import { MoshConnectionManager } from './mosh-connection-manager'
import type { MoshttyTransport } from './transport/moshtty-transport'

function createTransport(
  datagrams: Array<{ flowId: number; payload: Uint8Array } | null>
): MoshttyTransport {
  return {
    readPaneDatagram: vi.fn(async () => datagrams.shift() ?? null)
  } as unknown as MoshttyTransport
}

describe('MoshConnectionManager', () => {
  it('routes datagrams to the listener registered for a pane flow', async () => {
    const transport = createTransport([
      { flowId: 7, payload: new Uint8Array([1, 2, 3]) },
      { flowId: 9, payload: new Uint8Array([4, 5, 6]) },
      null
    ])
    const manager = new MoshConnectionManager(transport)
    const listener = vi.fn()

    manager.register(7, listener)
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(new Uint8Array([1, 2, 3])))

    expect(listener).toHaveBeenCalledTimes(1)
  })
})
