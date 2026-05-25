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
