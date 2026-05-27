import { describe, expect, test } from 'vitest'
import {
  createEmptyState,
  createSampleState,
  getActivePane,
  getActiveProject,
  getActiveTab,
  hasWorkspaceContent,
  migrateState,
  normalizeState,
  projectDisplayInitial
} from './state'

describe('Moshtty state helpers', () => {
  test('createEmptyState returns a normalized blank workspace', () => {
    const state = createEmptyState('2026-05-25T00:00:00.000Z')

    expect(state.version).toBe(1)
    expect(state.updatedAt).toBe('2026-05-25T00:00:00.000Z')
    expect(state.projects).toEqual([])
    expect(state.settings.themeMode).toBe('system')
  })

  test('createSampleState seeds a workspace for the renderer', () => {
    const state = createSampleState('2026-05-25T00:00:00.000Z')

    expect(hasWorkspaceContent(state)).toBe(true)
    expect(getActiveProject(state)?.name).toBe('Welcome')
    expect(getActiveTab(state)?.title).toBe('Getting started')
    expect(getActivePane(state)?.title).toBe('No remote connected')
  })

  test('normalizeState recovers malformed input safely', () => {
    const state = normalizeState(
      { version: 1, projects: [{ id: 'p1', name: 'Project One' }] },
      '2026-05-25T00:00:00.000Z'
    )

    expect(state.projects).toHaveLength(1)
    expect(state.projects[0].name).toBe('Project One')
    expect(state.remotes).toHaveLength(0)
  })

  test('normalizeState falls back for non-current payloads', () => {
    expect(normalizeState(null, '2026-05-25T00:00:00.000Z').updatedAt).toBe(
      '2026-05-25T00:00:00.000Z'
    )
    expect(normalizeState({ version: 99 }, '2026-05-25T00:00:00.000Z').projects).toEqual([])
  })

  test('normalizeState clamps and defaults nested workspace data', () => {
    const state = normalizeState(
      {
        version: 1,
        updatedAt: '',
        activeProjectId: '',
        activeTabId: 'tab-1',
        activePaneId: '',
        remotes: [
          null,
          {
            id: 'remote-1',
            label: 'Remote',
            host: '',
            platform: 'linux',
            status: 'connected',
            url: '',
            tokenLabel: '',
            currentCertHash: '',
            nextCertHash: 'next'
          }
        ],
        projects: [
          {},
          {
            id: 'project-1',
            name: 'Project',
            color: '',
            remoteId: '',
            tabIds: ['tab-1', '', 12],
            activeTabId: ''
          }
        ],
        tabs: [
          {},
          {
            id: 'tab-1',
            title: 'Shell',
            paneIds: ['pane-1', '', 12],
            activePaneId: ''
          }
        ],
        panes: [
          {},
          {
            id: 'pane-1',
            title: 'Pane',
            cwd: '',
            status: 'lost',
            cols: -1,
            rows: 0,
            remoteFlowId: -1
          }
        ],
        layouts: [
          {},
          {
            tabId: 'tab-1',
            root: {
              kind: 'split',
              axis: 'column',
              ratio: 20,
              first: { kind: 'pane', paneId: 'pane-1' },
              second: { kind: 'pane', paneId: '' }
            }
          },
          {
            tabId: 'tab-2',
            root: {
              kind: 'split',
              axis: 'diagonal',
              ratio: 0.01,
              first: { kind: 'pane', paneId: 'pane-1' },
              second: { kind: 'pane', paneId: 'pane-2' }
            }
          }
        ],
        settings: {
          themeMode: 'dark',
          terminalTheme: 'light',
          fontSize: Number.NaN,
          projectRailCollapsed: 1
        }
      },
      '2026-05-25T00:00:00.000Z'
    )

    expect(state.updatedAt).toBe('2026-05-25T00:00:00.000Z')
    expect(state.activeProjectId).toBeNull()
    expect(state.remotes[0]).toMatchObject({
      host: 'localhost',
      platform: 'linux',
      status: 'connected',
      url: 'https://localhost:4433',
      tokenLabel: 'default',
      currentCertHash: null,
      nextCertHash: 'next'
    })
    expect(state.projects[0]).toMatchObject({
      color: '#64646c',
      tabIds: ['tab-1'],
      activeTabId: null
    })
    expect(state.tabs[0]).toMatchObject({ paneIds: ['pane-1'], activePaneId: null })
    expect(state.panes[0]).toMatchObject({
      cwd: '~',
      status: 'lost',
      cols: 120,
      rows: 32,
      remoteFlowId: undefined
    })
    expect(state.layouts).toEqual([
      {
        tabId: 'tab-1',
        root: null
      },
      {
        tabId: 'tab-2',
        root: {
          kind: 'split',
          axis: 'row',
          ratio: 0.05,
          first: { kind: 'pane', paneId: 'pane-1' },
          second: { kind: 'pane', paneId: 'pane-2' }
        }
      }
    ])
    expect(state.settings).toMatchObject({
      themeMode: 'dark',
      terminalTheme: 'light',
      fontSize: 14,
      projectRailCollapsed: true
    })
  })

  test('projectDisplayInitial derives a visible label', () => {
    expect(
      projectDisplayInitial({
        id: 'p1',
        name: '  moshtty',
        color: '#000',
        remoteId: null,
        tabIds: [],
        activeTabId: null
      })
    ).toBe('M')
  })

  test('projectDisplayInitial and active getters handle empty data', () => {
    const state = createEmptyState()
    expect(
      projectDisplayInitial({
        id: 'p1',
        name: '  ',
        color: '#000',
        remoteId: null,
        tabIds: [],
        activeTabId: null
      })
    ).toBe('M')
    expect(getActiveProject(state)).toBeNull()
    expect(getActiveTab(state)).toBeNull()
    expect(getActivePane(state)).toBeNull()
    expect(hasWorkspaceContent(state)).toBe(false)
  })

  test('migrateState upgrades legacy payloads and infers layouts', () => {
    const migration = migrateState(
      {
        projects: [{ id: 'p1', name: 'Legacy', color: '#000', tabIds: ['t1'], activeTabId: 't1' }],
        tabs: [{ id: 't1', title: 'Shell', paneIds: ['pane-1'], activePaneId: 'pane-1' }],
        panes: [{ id: 'pane-1', title: 'Pane', cwd: '~', status: 'active', cols: 80, rows: 24 }]
      },
      '2026-05-25T00:00:00.000Z'
    )

    expect(migration.migratedFrom).toBe(0)
    expect(migration.state.version).toBe(1)
    expect(migration.state.layouts[0]?.root).toEqual({ kind: 'pane', paneId: 'pane-1' })
  })

  test('migrateState reports malformed and unsupported payloads', () => {
    expect(migrateState(null, '2026-05-25T00:00:00.000Z').warning).toBe(
      'State payload was not an object'
    )
    const migrated = migrateState(
      {
        projects: 'not-an-array',
        tabs: [null, { id: '', paneIds: ['pane-1'] }, { id: 'tab-1', paneIds: [] }]
      },
      '2026-05-25T00:00:00.000Z'
    )
    expect(migrated.state.projects).toEqual([])
    expect(migrated.state.layouts).toEqual([])

    const unsupported = migrateState({ version: 2 }, '2026-05-25T00:00:00.000Z')
    expect(unsupported.warning).toBe('Unsupported state version 2')
    expect(unsupported.state.updatedAt).toBe('2026-05-25T00:00:00.000Z')
  })

  test('normalizeState preserves valid remote pane flow IDs', () => {
    const state = normalizeState(
      {
        version: 1,
        projects: [{ id: 'p1', name: 'Project One', tabIds: ['t1'], activeTabId: 't1' }],
        tabs: [{ id: 't1', title: 'Shell', paneIds: ['pane-1'], activePaneId: 'pane-1' }],
        panes: [
          {
            id: 'pane-1',
            title: 'Pane',
            cwd: '~',
            status: 'active',
            cols: 80,
            rows: 24,
            remoteFlowId: 12
          }
        ]
      },
      '2026-05-25T00:00:00.000Z'
    )

    expect(state.panes[0]?.remoteFlowId).toBe(12)
  })

  test('createSampleState includes a tab layout root', () => {
    const state = createSampleState()
    expect(state.layouts[0]?.tabId).toBe('tab-welcome')
  })
})
