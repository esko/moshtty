import type { MoshttyState, StateLoadResult } from './state'

export interface MoshttyAppInfo {
  name: string
  protocolUrl: string
  stateFilePath: string
}

export type SecretStorageMode = 'safeStorage' | 'passphrase' | 'unavailable'

export interface MoshttySecretStorageInfo {
  mode: SecretStorageMode
  encryptionAvailable: boolean
  secretsDirectory: string
}

export interface MoshttyApi {
  loadState(): Promise<StateLoadResult>
  saveState(state: MoshttyState): Promise<StateLoadResult>
  resetState(): Promise<StateLoadResult>
  getAppInfo(): Promise<MoshttyAppInfo>
  getSecretStorageInfo(): Promise<MoshttySecretStorageInfo>
  setPassphrase(passphrase: string): Promise<void>
  storeToken(label: string, token: string): Promise<{ mode: SecretStorageMode }>
  loadToken(label: string): Promise<string | null>
  deleteToken(label: string): Promise<void>
}

export const MOSHTTY_IPC_CHANNELS = {
  stateLoad: 'moshtty:state:load',
  stateSave: 'moshtty:state:save',
  stateReset: 'moshtty:state:reset',
  appInfo: 'moshtty:app-info',
  secretInfo: 'moshtty:secret:info',
  secretSetPassphrase: 'moshtty:secret:set-passphrase',
  secretStoreToken: 'moshtty:secret:store-token',
  secretLoadToken: 'moshtty:secret:load-token',
  secretDeleteToken: 'moshtty:secret:delete-token'
} as const
