import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { MOSHTTY_IPC_CHANNELS, type MoshttyApi } from '../common/moshtty-api'

const moshtty: MoshttyApi = {
  loadState: () => ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.stateLoad),
  saveState: (state) => ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.stateSave, state),
  resetState: () => ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.stateReset),
  getAppInfo: () => ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.appInfo),
  getSecretStorageInfo: () => ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.secretInfo),
  setPassphrase: (passphrase) =>
    ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.secretSetPassphrase, passphrase),
  storeToken: (label, token) =>
    ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.secretStoreToken, label, token),
  loadToken: (label) => ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.secretLoadToken, label),
  deleteToken: (label) => ipcRenderer.invoke(MOSHTTY_IPC_CHANNELS.secretDeleteToken, label)
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
