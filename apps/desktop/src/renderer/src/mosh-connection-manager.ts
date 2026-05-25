import type { MoshttyTransport } from './transport/moshtty-transport'

export class MoshConnectionManager {
  private datagramListeners = new Map<number, (payload: Uint8Array) => void>()
  private isReading = false

  constructor(private readonly transport: MoshttyTransport) {}

  register(flowId: number, cb: (payload: Uint8Array) => void): void {
    this.datagramListeners.set(flowId, cb)
    this.startLoop()
  }

  unregister(flowId: number): void {
    this.datagramListeners.delete(flowId)
    if (this.datagramListeners.size === 0) {
      this.stop()
    }
  }

  private startLoop(): void {
    if (this.isReading) return
    this.isReading = true
    ;(async () => {
      try {
        while (this.isReading) {
          const dg = await this.transport.readPaneDatagram()
          if (!dg) {
            break
          }
          const cb = this.datagramListeners.get(dg.flowId)
          if (cb) {
            cb(dg.payload)
          }
        }
      } catch (err) {
        console.error('MoshConnectionManager read loop error:', err)
      } finally {
        this.isReading = false
      }
    })()
  }

  stop(): void {
    this.isReading = false
  }
}
