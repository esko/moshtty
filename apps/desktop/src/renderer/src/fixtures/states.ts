/**
 * Visual-regression fixture states for Moshtty.
 *
 * Each fixture is a deterministic `MoshttyState` used by:
 *
 *   - Playwright Electron tests under `apps/desktop/tests/visual/`;
 *   - the in-app fixture viewer when the renderer is launched with
 *     `?fixture=<id>` (see `loader.ts` and `FixtureBanner.tsx`);
 *   - the M5 surface-state matrix (see
 *     `docs/agents/2026-05-25-5-moshtty-ui-ghostty.md`).
 *
 * Naming convention:
 *
 *   <surface>[-<state>]
 *
 * Surface IDs from the M5 brief:
 *   dashboard, rail, tab-bar, pane, split, dialog-import,
 *   dialog-project-edit, dialog-terminal-settings, connection-status,
 *   active-tab (composite, "everything is on").
 *
 * Adding a fixture is cheap — keep state shapes minimal and explicit.
 * Do NOT inline literal colors or magic numbers here; pull from existing
 * sample state when possible.
 */

import type { MoshttyState } from '../../../common/state'
import { createSampleState } from '../../../common/state'

export interface FixtureState {
  id: string
  label: string
  state: MoshttyState
}

const base = createSampleState()

const longTabs = Array.from({ length: 10 }, (_, index) => ({
  id: `tab-overflow-${index + 1}`,
  title: `Remote shell ${index + 1}`,
  paneIds: ['pane-welcome'],
  activePaneId: 'pane-welcome'
}))

const secondPane = {
  id: 'pane-build',
  title: 'Build',
  cwd: '~/src/moshtty',
  status: 'active' as const,
  cols: 100,
  rows: 28
}

const thirdPane = {
  id: 'pane-logs',
  title: 'Logs',
  cwd: '~/Library/Logs/Moshtty',
  status: 'active' as const,
  cols: 100,
  rows: 20
}

const lostPane = {
  ...base,
  panes: base.panes.map((pane) => ({ ...pane, status: 'lost' as const }))
}

const offlineRemote = {
  ...base,
  remotes: base.remotes.map((remote) => ({
    ...remote,
    status: 'offline' as const
  }))
}

const connectingRemote = {
  ...base,
  remotes: base.remotes.map((remote) => ({
    ...remote,
    status: 'connecting' as const
  }))
}

const lostRemote = {
  ...base,
  remotes: base.remotes.map((remote) => ({
    ...remote,
    status: 'lost' as const
  }))
}

export const FIXTURES: Record<string, FixtureState> = {
  dashboard: {
    id: 'dashboard',
    label: 'Project dashboard (light)',
    state: base
  },
  'dashboard-empty': {
    id: 'dashboard-empty',
    label: 'Project dashboard (empty)',
    state: {
      ...base,
      activeProjectId: null,
      activeTabId: null,
      activePaneId: null,
      projects: [],
      tabs: [],
      panes: [],
      layouts: []
    }
  },
  'dashboard-dark': {
    id: 'dashboard-dark',
    label: 'Project dashboard (dark)',
    state: { ...base, settings: { ...base.settings, themeMode: 'dark' } }
  },
  'active-tab': {
    id: 'active-tab',
    label: 'Active project with one tab open',
    state: base
  },
  'tab-bar-multi': {
    id: 'tab-bar-multi',
    label: 'Multi-tab top bar',
    state: {
      ...base,
      projects: base.projects.map((project) => ({
        ...project,
        tabIds: ['tab-welcome', 'tab-build', 'tab-logs']
      })),
      tabs: [
        ...base.tabs,
        {
          id: 'tab-build',
          title: 'Build',
          paneIds: ['pane-build'],
          activePaneId: 'pane-build'
        },
        {
          id: 'tab-logs',
          title: 'Logs',
          paneIds: ['pane-logs'],
          activePaneId: 'pane-logs'
        }
      ],
      panes: [...base.panes, secondPane, thirdPane],
      layouts: [
        ...base.layouts,
        { tabId: 'tab-build', root: { kind: 'pane', paneId: 'pane-build' } },
        { tabId: 'tab-logs', root: { kind: 'pane', paneId: 'pane-logs' } }
      ]
    }
  },
  'rail-collapsed': {
    id: 'rail-collapsed',
    label: 'Project rail collapsed',
    state: { ...base, settings: { ...base.settings, projectRailCollapsed: true } }
  },
  'rail-expanded': {
    id: 'rail-expanded',
    label: 'Project rail expanded',
    state: { ...base, settings: { ...base.settings, projectRailCollapsed: false } }
  },
  'rail-empty': {
    id: 'rail-empty',
    label: 'Project rail empty',
    state: {
      ...base,
      activeProjectId: null,
      activeTabId: null,
      activePaneId: null,
      projects: [],
      tabs: [],
      panes: [],
      layouts: []
    }
  },
  'tab-bar-dragging': {
    id: 'tab-bar-dragging',
    label: 'Tab bar dragging stand-in',
    state: {
      ...base,
      projects: base.projects.map((project) => ({
        ...project,
        tabIds: ['tab-welcome', 'tab-build', 'tab-logs']
      })),
      tabs: [
        ...base.tabs,
        {
          id: 'tab-build',
          title: 'Build',
          paneIds: ['pane-build'],
          activePaneId: 'pane-build'
        },
        {
          id: 'tab-logs',
          title: 'Logs',
          paneIds: ['pane-logs'],
          activePaneId: 'pane-logs'
        }
      ],
      panes: [...base.panes, secondPane, thirdPane],
      layouts: [
        ...base.layouts,
        { tabId: 'tab-build', root: { kind: 'pane', paneId: 'pane-build' } },
        { tabId: 'tab-logs', root: { kind: 'pane', paneId: 'pane-logs' } }
      ]
    }
  },
  'tab-bar-overflow': {
    id: 'tab-bar-overflow',
    label: 'Tab bar overflow',
    state: {
      ...base,
      projects: base.projects.map((project) => ({
        ...project,
        tabIds: longTabs.map((tab) => tab.id),
        activeTabId: longTabs[0].id
      })),
      activeTabId: longTabs[0].id,
      tabs: longTabs,
      layouts: longTabs.map((tab) => ({
        tabId: tab.id,
        root: { kind: 'pane', paneId: 'pane-welcome' }
      }))
    }
  },
  'split-2-row': {
    id: 'split-2-row',
    label: 'Two-pane row split',
    state: {
      ...base,
      panes: [...base.panes, secondPane],
      layouts: [
        {
          tabId: 'tab-welcome',
          root: {
            kind: 'split',
            axis: 'row',
            ratio: 0.5,
            first: { kind: 'pane', paneId: 'pane-welcome' },
            second: { kind: 'pane', paneId: 'pane-build' }
          }
        }
      ]
    }
  },
  'split-2-column': {
    id: 'split-2-column',
    label: 'Two-pane column split',
    state: {
      ...base,
      panes: [...base.panes, secondPane],
      layouts: [
        {
          tabId: 'tab-welcome',
          root: {
            kind: 'split',
            axis: 'column',
            ratio: 0.5,
            first: { kind: 'pane', paneId: 'pane-welcome' },
            second: { kind: 'pane', paneId: 'pane-build' }
          }
        }
      ]
    }
  },
  'split-3-nested': {
    id: 'split-3-nested',
    label: 'Three-pane nested split',
    state: {
      ...base,
      panes: [...base.panes, secondPane, thirdPane],
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
              first: { kind: 'pane', paneId: 'pane-build' },
              second: { kind: 'pane', paneId: 'pane-logs' }
            }
          }
        }
      ]
    }
  },
  'pane-lost': {
    id: 'pane-lost',
    label: 'Pane in lost-connection state',
    state: lostPane
  },
  'dialog-import-empty': {
    id: 'dialog-import-empty',
    label: 'Remote import dialog (empty)',
    state: base
  },
  'dialog-import-invalid': {
    id: 'dialog-import-invalid',
    label: 'Remote import dialog (invalid profile)',
    state: base
  },
  'dialog-import-valid': {
    id: 'dialog-import-valid',
    label: 'Remote import dialog (valid profile)',
    state: base
  },
  'dialog-project-edit': {
    id: 'dialog-project-edit',
    label: 'Project edit dialog (existing)',
    state: base
  },
  'dialog-project-edit-new': {
    id: 'dialog-project-edit-new',
    label: 'Project edit dialog (new)',
    state: base
  },
  'dialog-terminal-settings': {
    id: 'dialog-terminal-settings',
    label: 'Terminal settings dialog (follow app)',
    state: base
  },
  'dialog-terminal-settings-light': {
    id: 'dialog-terminal-settings-light',
    label: 'Terminal settings dialog (light override)',
    state: { ...base, settings: { ...base.settings, terminalTheme: 'light' } }
  },
  'dialog-terminal-settings-dark': {
    id: 'dialog-terminal-settings-dark',
    label: 'Terminal settings dialog (dark override)',
    state: { ...base, settings: { ...base.settings, terminalTheme: 'dark' } }
  },
  'connection-offline': {
    id: 'connection-offline',
    label: 'Connection status (offline)',
    state: offlineRemote
  },
  'connection-connecting': {
    id: 'connection-connecting',
    label: 'Connection status (connecting)',
    state: connectingRemote
  },
  'connection-connected': {
    id: 'connection-connected',
    label: 'Connection status (connected)',
    state: {
      ...base,
      remotes: base.remotes.map((remote) => ({
        ...remote,
        status: 'connected' as const
      }))
    }
  },
  'connection-lost': {
    id: 'connection-lost',
    label: 'Connection status (lost)',
    state: lostRemote
  }
}

export function getFixture(id: string): FixtureState | undefined {
  return FIXTURES[id]
}

export function getFixtureIds(): string[] {
  return Object.keys(FIXTURES)
}
