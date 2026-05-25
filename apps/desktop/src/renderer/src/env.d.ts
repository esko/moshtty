/// <reference types="vite/client" />

import type { MoshttyApi } from '../../common/moshtty-api'

declare global {
  interface Window {
    moshtty: MoshttyApi
  }
}

export {}
