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
  'split-2-row': {
    id: 'split-2-row',
    label: 'Two-pane row split',
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
  'split-2-column': {
    id: 'split-2-column',
    label: 'Two-pane column split',
    state: {
      ...base,
      layouts: [
        {
          tabId: 'tab-welcome',
          root: {
            kind: 'split',
            axis: 'column',
            ratio: 0.5,
            first: { kind: 'pane', paneId: 'pane-welcome' },
            second: { kind: 'pane', paneId: 'pane-welcome' }
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
      panes: [
        ...base.panes,
        {
          id: 'pane-extra',
          title: 'Extra',
          cwd: '~',
          status: 'active',
          cols: 120,
          rows: 32
        }
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
  'dialog-project-edit': {
    id: 'dialog-project-edit',
    label: 'Project edit dialog',
    state: base
  },
  'dialog-terminal-settings': {
    id: 'dialog-terminal-settings',
    label: 'Terminal settings dialog',
    state: base
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
