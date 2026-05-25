import { beforeEach, expect, test, vi } from 'vitest'
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
