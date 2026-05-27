import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createSampleState, type MoshttyPane, type MoshttyState } from '../../../common/state'
import { TopBar } from './TopBar'
import { useAppStore } from '../store'

function stateWithTabPanes(panes: MoshttyPane[]): MoshttyState {
  const base = createSampleState()
  const tabId = 'tab-status-test'
  return {
    ...base,
    activeTabId: tabId,
    tabs: [
      {
        id: tabId,
        title: 'Status test',
        paneIds: panes.map((pane) => pane.id),
        activePaneId: panes[0]?.id ?? null
      }
    ],
    panes,
    projects: base.projects.map((project) =>
      project.id === base.activeProjectId
        ? { ...project, tabIds: [tabId], activeTabId: tabId }
        : project
    )
  }
}

const windowApiMock = {
  window: {
    minimize: vi.fn(),
    maximize: vi.fn(),
    close: vi.fn(),
    isMaximized: vi.fn().mockResolvedValue(false),
    onStateChange: vi.fn(() => vi.fn())
  }
}

describe('TopBar tab status roundel', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    window.moshtty = windowApiMock as unknown as typeof window.moshtty
    useAppStore.setState({
      addTab: vi.fn().mockResolvedValue(undefined),
      setActiveTab: vi.fn().mockResolvedValue(undefined),
      closeTab: vi.fn().mockResolvedValue(undefined),
      toggleProjectRail: vi.fn().mockResolvedValue(undefined),
      renameTab: vi.fn().mockResolvedValue(undefined)
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  function renderTopBar(state: MoshttyState): void {
    act(() => {
      root.render(
        <TopBar
          state={state}
          liveStatus={null}
          remoteStatus="Offline"
          remote={state.remotes[0] ?? null}
        />
      )
    })
  }

  function tabStatusDot(): HTMLElement | null {
    return container.querySelector('.tab-status-dot')
  }

  it('shows connected when all panes are active', () => {
    renderTopBar(
      stateWithTabPanes([
        { id: 'pane-a', title: 'A', cwd: '~', status: 'active', cols: 80, rows: 24 },
        { id: 'pane-b', title: 'B', cwd: '~', status: 'active', cols: 80, rows: 24 }
      ])
    )

    expect(tabStatusDot()?.getAttribute('data-status')).toBe('connected')
  })

  it('shows connecting when at least one pane is connecting and none are lost', () => {
    renderTopBar(
      stateWithTabPanes([
        { id: 'pane-a', title: 'A', cwd: '~', status: 'active', cols: 80, rows: 24 },
        {
          id: 'pane-b',
          title: 'B',
          cwd: '~',
          status: 'connecting' as MoshttyPane['status'],
          cols: 80,
          rows: 24
        }
      ])
    )

    expect(tabStatusDot()?.getAttribute('data-status')).toBe('connecting')
  })

  it('shows lost when any pane is lost, regardless of other pane statuses', () => {
    renderTopBar(
      stateWithTabPanes([
        { id: 'pane-a', title: 'A', cwd: '~', status: 'lost', cols: 80, rows: 24 },
        {
          id: 'pane-b',
          title: 'B',
          cwd: '~',
          status: 'connecting' as MoshttyPane['status'],
          cols: 80,
          rows: 24
        },
        { id: 'pane-c', title: 'C', cwd: '~', status: 'active', cols: 80, rows: 24 }
      ])
    )

    expect(tabStatusDot()?.getAttribute('data-status')).toBe('lost')
  })
})
