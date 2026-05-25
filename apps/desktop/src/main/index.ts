import { app, shell, BrowserWindow, ipcMain, protocol, safeStorage } from 'electron'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { extname, join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { MOSHTTY_IPC_CHANNELS } from '../common/moshtty-api'
import type { MoshttyState } from '../common/state'
import { createSecretStore } from './secret-store'
import { createMoshttyStateStore } from './state-store'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

const stateStore = createMoshttyStateStore(() => app.getPath('userData'))
const secretStore = createSecretStore({
  userDataPath: () => app.getPath('userData'),
  safeStorage: {
    isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
    encryptString: (plainText) => safeStorage.encryptString(plainText),
    decryptString: (encrypted) => safeStorage.decryptString(encrypted)
  }
})

function contentTypeFor(filePath: string): string {
  switch (extname(filePath)) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.ico':
      return 'image/x-icon'
    case '.wasm':
      return 'application/wasm'
    case '.map':
      return 'application/json; charset=utf-8'
    default:
      return 'application/octet-stream'
  }
}

function getRendererRoot(): string {
  return resolve(__dirname, '../renderer')
}

function resolveRendererPath(requestPath: string): string | null {
  const rendererRoot = getRendererRoot()
  const normalizedPath = decodeURIComponent(requestPath || '/')
  const relativePath = normalizedPath === '/' ? 'index.html' : normalizedPath.replace(/^\/+/, '')
  const absolutePath = resolve(rendererRoot, relativePath)

  if (!absolutePath.startsWith(rendererRoot)) {
    return null
  }

  return absolutePath
}

async function registerAppProtocol(): Promise<void> {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    const filePath = resolveRendererPath(url.pathname)
    if (!filePath) {
      return new Response('Forbidden', { status: 403 })
    }

    try {
      const body = await readFile(filePath)
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': contentTypeFor(filePath)
        }
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

async function loadRenderer(mainWindow: BrowserWindow): Promise<void> {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    return
  }

  await mainWindow.loadURL('app://moshtty/index.html')
}

function resolvePreloadPath(): string {
  const candidates = ['index.mjs', 'index.js'].map((file) => join(__dirname, '../preload', file))
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    show: true,
    autoHideMenuBar: true,
    title: 'Moshtty',
    backgroundColor: '#f9f9fb',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: resolvePreloadPath(),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  void loadRenderer(mainWindow).catch((error) => {
    console.error('Failed to load Moshtty renderer:', error)
  })
  return mainWindow
}

function registerIpcHandlers(): void {
  ipcMain.handle(MOSHTTY_IPC_CHANNELS.stateLoad, async () => stateStore.loadState())
  ipcMain.handle(MOSHTTY_IPC_CHANNELS.stateSave, async (_event, state: MoshttyState) =>
    stateStore.saveState(state)
  )
  ipcMain.handle(MOSHTTY_IPC_CHANNELS.stateReset, async () => stateStore.resetState())
  ipcMain.handle(MOSHTTY_IPC_CHANNELS.appInfo, async () => ({
    name: app.getName(),
    protocolUrl: 'app://moshtty/index.html',
    stateFilePath: stateStore.stateFilePath()
  }))
  ipcMain.handle(MOSHTTY_IPC_CHANNELS.secretInfo, async () => secretStore.getStorageInfo())
  ipcMain.handle(MOSHTTY_IPC_CHANNELS.secretSetPassphrase, async (_event, passphrase: string) =>
    secretStore.setPassphrase(passphrase)
  )
  ipcMain.handle(
    MOSHTTY_IPC_CHANNELS.secretStoreToken,
    async (_event, label: string, token: string) => secretStore.storeToken(label, token)
  )
  ipcMain.handle(MOSHTTY_IPC_CHANNELS.secretLoadToken, async (_event, label: string) =>
    secretStore.loadToken(label)
  )
  ipcMain.handle(MOSHTTY_IPC_CHANNELS.secretDeleteToken, async (_event, label: string) =>
    secretStore.deleteToken(label)
  )
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.moshtty.desktop')
  await registerAppProtocol()
  registerIpcHandlers()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
