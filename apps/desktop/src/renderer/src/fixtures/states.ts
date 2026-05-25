import type { MoshttyState } from '../../../common/state'
import { createSampleState } from '../../../common/state'

export interface FixtureState {
  id: string
  label: string
  state: MoshttyState
}

const base = createSampleState()

export const FIXTURES: Record<string, FixtureState> = {
  dashboard: {
    id: 'dashboard',
    label: 'Project dashboard',
    state: base
  },
  'dashboard-dark': {
    id: 'dashboard-dark',
    label: 'Project dashboard (dark)',
    state: { ...base, settings: { ...base.settings, themeMode: 'dark' } }
  },
  'active-tab': {
    id: 'active-tab',
    label: 'Active project with one tab',
    state: base
  },
  'split-2': {
    id: 'split-2',
    label: 'Split panes (2)',
    state: {
      ...base,
      layouts: [
        {
          tabId: 'tab-welcome',
          root: {
            kind: 'split',
            axis: 'row',
            ratio: 0.5,
            first: { kind: 'pane', paneId: 'pane-welcome' },
            second: { kind: 'pane', paneId: 'pane-welcome' }
          }
        }
      ]
    }
  },
  'split-3': {
    id: 'split-3',
    label: 'Split panes (3)',
    state: {
      ...base,
      panes: [
        ...base.panes,
        { id: 'pane-extra', title: 'Extra', cwd: '~', status: 'active', cols: 120, rows: 32 }
      ],
      layouts: [
        {
          tabId: 'tab-welcome',
          root: {
            kind: 'split',
            axis: 'row',
            ratio: 0.5,
            first: { kind: 'pane', paneId: 'pane-welcome' },
            second: {
              kind: 'split',
              axis: 'column',
              ratio: 0.5,
              first: { kind: 'pane', paneId: 'pane-welcome' },
              second: { kind: 'pane', paneId: 'pane-extra' }
            }
          }
        }
      ]
    }
  },
  'rail-collapsed': {
    id: 'rail-collapsed',
    label: 'Collapsed project rail',
    state: { ...base, settings: { ...base.settings, projectRailCollapsed: true } }
  },
  'rail-expanded': {
    id: 'rail-expanded',
    label: 'Expanded project rail',
    state: base
  },
  'import-dialog': {
    id: 'import-dialog',
    label: 'Remote import dialog',
    state: base
  },
  'edit-dialog': {
    id: 'edit-dialog',
    label: 'Project edit dialog',
    state: base
  },
  'settings-dialog': {
    id: 'settings-dialog',
    label: 'Settings dialog',
    state: base
  },
  'pane-lost': {
    id: 'pane-lost',
    label: 'Lost pane state',
    state: {
      ...base,
      panes: base.panes.map((p) => ({ ...p, status: 'lost' as const }))
    }
  },
  'offline': {
    id: 'offline',
    label: 'Connection status (offline)',
    state: {
      ...base,
      remotes: base.remotes.map((r) => ({ ...r, status: 'offline' as const }))
    }
  }
}

export function getFixture(id: string): FixtureState | undefined {
  return FIXTURES[id]
}

export function getFixtureIds(): string[] {
  return Object.keys(FIXTURES)
}
