import { beforeEach, expect, test, vi } from 'vitest'
import type { ParsedMoshttyProfile } from '../../common/profile.schema'
import { createSampleState } from '../../common/state'
import { useAppStore } from './store'

const mockApi = {
  loadState: vi.fn(),
  saveState: vi.fn(),
  resetState: vi.fn(),
  getAppInfo: vi.fn(),
  getSecretStorageInfo: vi.fn(),
  setPassphrase: vi.fn(),
  storeToken: vi.fn(),
  loadToken: vi.fn(),
  deleteToken: vi.fn()
}

beforeEach(() => {
  vi.restoreAllMocks()
  window.moshtty = mockApi
  useAppStore.setState({
    hydrated: false,
    loading: false,
    saving: false,
    error: null,
    snapshot: null
  })
})

test('hydrate loads persisted workspace through the preload API', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  mockApi.loadState.mockResolvedValue({ state: sample, source: 'disk' })
  mockApi.getAppInfo.mockResolvedValue({
    name: 'Moshtty',
    protocolUrl: 'app://moshtty/index.html',
    stateFilePath: '/tmp/moshtty-state.json'
  })
  mockApi.getSecretStorageInfo.mockResolvedValue({
    mode: 'passphrase',
    encryptionAvailable: false,
    secretsDirectory: '/tmp/secrets'
  })

  await useAppStore.getState().hydrate()

  const state = useAppStore.getState()
  expect(state.hydrated).toBe(true)
  expect(state.snapshot?.state.projects[0]?.name).toBe('Welcome')
  expect(state.snapshot?.appInfo?.protocolUrl).toBe('app://moshtty/index.html')
})

test('addProject persists through saveState', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  mockApi.loadState.mockResolvedValue({ state: sample, source: 'disk' })
  mockApi.getAppInfo.mockResolvedValue({
    name: 'Moshtty',
    protocolUrl: 'app://moshtty/index.html',
    stateFilePath: '/tmp/moshtty-state.json'
  })
  mockApi.getSecretStorageInfo.mockResolvedValue({
    mode: 'safeStorage',
    encryptionAvailable: true,
    secretsDirectory: '/tmp/secrets'
  })
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  await useAppStore.getState().hydrate()
  await useAppStore.getState().addProject('Remote dev')

  expect(mockApi.saveState).toHaveBeenCalled()
  expect(
    useAppStore.getState().snapshot?.state.projects.some((project) => project.name === 'Remote dev')
  ).toBe(true)
})

test('addTab appends a pane tab to the active project', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  useAppStore.setState({
    hydrated: true,
    snapshot: { state: sample, source: 'disk' }
  })
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  await useAppStore.getState().addTab('Deploy')

  const state = useAppStore.getState().snapshot!.state
  expect(state.tabs.some((tab) => tab.title === 'Deploy')).toBe(true)
  expect(state.activeTabId).toBe(state.projects[0]?.activeTabId)
  expect(mockApi.saveState).toHaveBeenCalled()
})

test('importRemoteProfile validates profile-shaped data before storing remotes', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  const profile: ParsedMoshttyProfile = {
    schemaVersion: 1,
    remoteId: 'remote-mac-mini',
    hostLabel: 'Mac mini',
    platform: 'macos',
    serviceVersion: '0.1.0',
    url: 'https://macmini.local:4433',
    tokenLabel: 'default',
    currentCertHash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    nextCertHash: null,
    defaults: {
      cols: 120,
      rows: 32
    }
  }
  useAppStore.setState({
    hydrated: true,
    snapshot: { state: sample, source: 'disk' }
  })
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  await useAppStore.getState().importRemoteProfile(profile)

  const remote = useAppStore
    .getState()
    .snapshot!.state.remotes.find((entry) => entry.id === 'remote-mac-mini')
  expect(remote).toMatchObject({
    label: 'Mac mini',
    host: 'macmini.local',
    platform: 'macos',
    status: 'offline'
  })
  expect(useAppStore.getState().snapshot!.state.projects[0]?.remoteId).toBe('remote-mac-mini')
  expect(mockApi.saveState).toHaveBeenCalled()
})

test('toggleProjectRail persists the collapsed setting', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  useAppStore.setState({
    hydrated: true,
    snapshot: { state: sample, source: 'disk' }
  })
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  await useAppStore.getState().toggleProjectRail()

  expect(useAppStore.getState().snapshot!.state.settings.projectRailCollapsed).toBe(true)
  expect(mockApi.saveState).toHaveBeenCalled()
})
