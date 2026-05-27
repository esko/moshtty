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
  deleteToken: vi.fn(),
  sshBootstrap: vi.fn(),
  window: {
    minimize: vi.fn(),
    maximize: vi.fn(),
    close: vi.fn(),
    isMaximized: vi.fn(),
    onStateChange: vi.fn(() => vi.fn())
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  window.moshtty = mockApi
  useAppStore.setState({
    hydrated: false,
    loading: false,
    saving: false,
    error: null,
    snapshot: null,
    paneFlows: {}
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
  expect(useAppStore.getState().snapshot!.state.tabs[0]?.title).toBe('Shell')
  expect(useAppStore.getState().snapshot!.state.panes[0]?.title).toBe('Shell')
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

test('bindPaneFlow persists the remote flow ID for reload reattach', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  useAppStore.setState({
    hydrated: true,
    snapshot: { state: sample, source: 'disk' },
    paneFlows: {}
  })
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  await useAppStore.getState().bindPaneFlow('pane-welcome', 42, 'mosh-key')

  expect(useAppStore.getState().paneFlows['pane-welcome']).toEqual({
    flowId: 42,
    key: 'mosh-key'
  })
  expect(useAppStore.getState().snapshot!.state.panes[0]?.remoteFlowId).toBe(42)
  expect(mockApi.saveState).toHaveBeenCalled()
})

test('markPaneLost clears the in-memory flow and persists lost pane status', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  useAppStore.setState({
    hydrated: true,
    snapshot: {
      state: {
        ...sample,
        panes: sample.panes.map((pane) => ({ ...pane, remoteFlowId: 42 }))
      },
      source: 'disk'
    },
    paneFlows: {
      'pane-welcome': { flowId: 42, key: 'mosh-key' }
    }
  })
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  await useAppStore.getState().markPaneLost('pane-welcome')

  expect(useAppStore.getState().paneFlows['pane-welcome']).toBeUndefined()
  expect(useAppStore.getState().snapshot!.state.panes[0]).toMatchObject({
    status: 'lost',
    remoteFlowId: 42
  })
  expect(mockApi.saveState).toHaveBeenCalled()
})

test('restartLostPane clears the stale remote flow before recreating the pane', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  useAppStore.setState({
    hydrated: true,
    snapshot: {
      state: {
        ...sample,
        panes: sample.panes.map((pane) => ({
          ...pane,
          status: 'lost',
          remoteFlowId: 42
        }))
      },
      source: 'disk'
    },
    paneFlows: {
      'pane-welcome': { flowId: 42, key: 'stale-key' }
    }
  })
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  await useAppStore.getState().restartLostPane('pane-welcome')

  expect(useAppStore.getState().paneFlows['pane-welcome']).toBeUndefined()
  expect(useAppStore.getState().snapshot!.state.panes[0]).toMatchObject({
    status: 'active',
    remoteFlowId: undefined
  })
  expect(mockApi.saveState).toHaveBeenCalled()
})

test('setActiveProject sets activeProjectId and derives activeTabId from the project', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  useAppStore.setState({
    hydrated: true,
    snapshot: { state: sample, source: 'disk' }
  })
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  await useAppStore.getState().setActiveProject('project-welcome')

  const state = useAppStore.getState().snapshot!.state
  expect(state.activeProjectId).toBe('project-welcome')
  expect(state.activeTabId).toBe('tab-welcome')
  expect(state.activePaneId).toBe('pane-welcome')
  expect(mockApi.saveState).toHaveBeenCalled()
})

test('splitPane creates a second pane and replaces layout root with a split node', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  useAppStore.setState({
    hydrated: true,
    snapshot: { state: sample, source: 'disk' }
  })
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  await useAppStore.getState().splitPane('row')

  const state = useAppStore.getState().snapshot!.state
  expect(state.panes).toHaveLength(2)
  const tab = state.tabs.find((t) => t.id === 'tab-welcome')
  expect(tab?.paneIds).toHaveLength(2)
  const layout = state.layouts.find((l) => l.tabId === 'tab-welcome')
  expect(layout?.root?.kind).toBe('split')
  if (layout?.root?.kind === 'split') {
    expect(layout.root.axis).toBe('row')
    expect(layout.root.first).toEqual({ kind: 'pane', paneId: 'pane-welcome' })
  }
  // activePaneId moves to the new pane
  expect(state.activePaneId).not.toBe('pane-welcome')
  expect(mockApi.saveState).toHaveBeenCalled()
})

test('closeActivePane removes pane from tab and layout when tab has 2+ panes', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  useAppStore.setState({
    hydrated: true,
    snapshot: { state: sample, source: 'disk' }
  })
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  // First split to get a second pane, then close the active one
  await useAppStore.getState().splitPane('row')

  // After split, activePaneId is the new pane; reset mock for closeActivePane call
  mockApi.saveState.mockClear()

  await useAppStore.getState().closeActivePane()

  const state = useAppStore.getState().snapshot!.state
  expect(state.panes).toHaveLength(1)
  const tab = state.tabs.find((t) => t.id === 'tab-welcome')
  expect(tab?.paneIds).toHaveLength(1)
  // Layout root should collapse back to a single pane node
  const layout = state.layouts.find((l) => l.tabId === 'tab-welcome')
  expect(layout?.root?.kind).toBe('pane')
  expect(mockApi.saveState).toHaveBeenCalled()
})

test('closeActiveTab removes the active tab and its panes when project has 2+ tabs', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  useAppStore.setState({
    hydrated: true,
    snapshot: { state: sample, source: 'disk' }
  })
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  // Add a second tab so we can close the active one
  await useAppStore.getState().addTab('Second')
  // addTab sets activeTabId to the new tab; record its id
  const secondTabId = useAppStore.getState().snapshot!.state.activeTabId!
  mockApi.saveState.mockClear()

  await useAppStore.getState().closeActiveTab()

  const state = useAppStore.getState().snapshot!.state
  expect(state.tabs.find((t) => t.id === secondTabId)).toBeUndefined()
  expect(state.tabs).toHaveLength(1)
  // panes belonging to the closed tab are removed
  const remainingPaneIds = state.panes.map((p) => p.id)
  expect(remainingPaneIds).not.toContain(secondTabId)
  expect(mockApi.saveState).toHaveBeenCalled()
})

test('closeTab closes a specific non-active tab without changing activeTabId', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  useAppStore.setState({
    hydrated: true,
    snapshot: { state: sample, source: 'disk' }
  })
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  // Add a second tab; after addTab the new tab becomes active
  await useAppStore.getState().addTab('Background')
  const newTabId = useAppStore.getState().snapshot!.state.activeTabId!
  // Switch active back to tab-welcome so closing newTabId is a non-active close
  await useAppStore.getState().setActiveTab('tab-welcome')
  mockApi.saveState.mockClear()

  await useAppStore.getState().closeTab(newTabId)

  const state = useAppStore.getState().snapshot!.state
  expect(state.tabs.find((t) => t.id === newTabId)).toBeUndefined()
  // activeTabId must remain tab-welcome since we closed a different tab
  expect(state.activeTabId).toBe('tab-welcome')
  expect(mockApi.saveState).toHaveBeenCalled()
})

test('deleteProject removes the project, its tabs and panes, and switches active project', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  // Add a second project first so there's something to switch to
  useAppStore.setState({ hydrated: true, snapshot: { state: sample, source: 'disk' } })
  await useAppStore.getState().addProject('Secondary')
  const secondProjectId = useAppStore.getState().snapshot!.state.activeProjectId!
  // Switch back to welcome project
  await useAppStore.getState().setActiveProject('project-welcome')
  mockApi.saveState.mockClear()

  await useAppStore.getState().deleteProject('project-welcome')

  const state = useAppStore.getState().snapshot!.state
  expect(state.projects.find((p) => p.id === 'project-welcome')).toBeUndefined()
  expect(state.tabs.find((t) => t.id === 'tab-welcome')).toBeUndefined()
  expect(state.panes.find((p) => p.id === 'pane-welcome')).toBeUndefined()
  expect(state.layouts.find((l) => l.tabId === 'tab-welcome')).toBeUndefined()
  // active project should have switched to the secondary project
  expect(state.activeProjectId).toBe(secondProjectId)
  expect(mockApi.saveState).toHaveBeenCalled()
})

test('renameProject changes the project name and persists', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  useAppStore.setState({ hydrated: true, snapshot: { state: sample, source: 'disk' } })
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  await useAppStore.getState().renameProject('project-welcome', 'My Dev Server')

  const project = useAppStore
    .getState()
    .snapshot!.state.projects.find((p) => p.id === 'project-welcome')
  expect(project?.name).toBe('My Dev Server')
  expect(mockApi.saveState).toHaveBeenCalled()
})

test('deleteRemote removes the remote and detaches it from any project', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  useAppStore.setState({ hydrated: true, snapshot: { state: sample, source: 'disk' } })
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  // The sample state has remote-placeholder attached to project-welcome
  await useAppStore.getState().deleteRemote('remote-placeholder')

  const state = useAppStore.getState().snapshot!.state
  expect(state.remotes.find((r) => r.id === 'remote-placeholder')).toBeUndefined()
  // Project should be detached
  const project = state.projects.find((p) => p.id === 'project-welcome')
  expect(project?.remoteId).toBeNull()
  expect(mockApi.saveState).toHaveBeenCalled()
})

test('renameTab changes the tab title and persists', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  useAppStore.setState({ hydrated: true, snapshot: { state: sample, source: 'disk' } })
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  await useAppStore.getState().renameTab('tab-welcome', 'Deploy logs')

  const tab = useAppStore.getState().snapshot!.state.tabs.find((t) => t.id === 'tab-welcome')
  expect(tab?.title).toBe('Deploy logs')
  expect(mockApi.saveState).toHaveBeenCalled()
})

test('updateRemoteCertHashes updates the matching remote currentCertHash and nextCertHash and persists', async () => {
  const sample = createSampleState('2026-05-25T00:00:00.000Z')
  useAppStore.setState({ hydrated: true, snapshot: { state: sample, source: 'disk' } })
  mockApi.saveState.mockImplementation(async (state) => ({ state, source: 'disk' }))

  const remoteId = 'remote-placeholder'
  const currentCertHash = 'NEW_CURRENT_HASH='
  const nextCertHash = 'NEW_NEXT_HASH='

  await useAppStore.getState().updateRemoteCertHashes(remoteId, currentCertHash, nextCertHash)

  const state = useAppStore.getState().snapshot!.state
  const remote = state.remotes.find((r) => r.id === remoteId)
  expect(remote?.currentCertHash).toBe(currentCertHash)
  expect(remote?.nextCertHash).toBe(nextCertHash)
  expect(mockApi.saveState).toHaveBeenCalled()
})
