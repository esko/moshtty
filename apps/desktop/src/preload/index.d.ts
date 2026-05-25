import { ElectronAPI } from '@electron-toolkit/preload'
import type { MoshttyApi } from '../common/moshtty-api'

declare global {
  interface Window {
    electron: ElectronAPI
    moshtty: MoshttyApi
  }
}

export {}
