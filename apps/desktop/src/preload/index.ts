import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { MOSHTTY_IPC_CHANNELS, type MoshttyApi } from '../common/moshtty-api'

const moshtty: MoshttyApi = {
  loadState: (): Promise<import('../common/state').StateLoadResult> =>
    ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.stateLoad),
  saveState: (state): Promise<import('../common/state').StateLoadResult> =>
    ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.stateSave, state),
  resetState: (): Promise<import('../common/state').StateLoadResult> =>
    ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.stateReset),
  getAppInfo: (): Promise<import('../common/moshtty-api').MoshttyAppInfo> =>
    ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.appInfo),
  getSecretStorageInfo: (): Promise<import('../common/moshtty-api').MoshttySecretStorageInfo> =>
    ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.secretInfo),
  setPassphrase: (passphrase): Promise<void> =>
    ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.secretSetPassphrase, passphrase),
  storeToken: (
    label,
    token
  ): Promise<{ mode: import('../common/moshtty-api').SecretStorageMode }> =>
    ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.secretStoreToken, label, token),
  loadToken: (label): Promise<string | null> =>
    ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.secretLoadToken, label),
  deleteToken: (label): Promise<void> =>
    ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.secretDeleteToken, label),
  sshBootstrap: (config): Promise<import('../common/ssh.schema').SshBootstrapResult> =>
    ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.sshBootstrap, config),
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.windowMinimize),
    maximize: (): Promise<void> => ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.windowMaximize),
    close: (): Promise<void> => ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.windowClose),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.windowIsMaximized),
    onStateChange: (callback: (isMaximized: boolean) => void): (() => void) => {
      const handler = (_event: unknown, isMaximized: boolean): void => callback(isMaximized)
      ipcRenderer.on('moshtty:window:state-change', handler)
      return (): void => {
        ipcRenderer.off('moshtty:window:state-change', handler)
      }
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('moshtty', moshtty)
  } catch (error) {
    console.error(error)
  }
} else {
  const globalWindow = globalThis as typeof globalThis & {
    electron: typeof electronAPI
    moshtty: MoshttyApi
  }
  globalWindow.electron = electronAPI
  globalWindow.moshtty = moshtty
}
