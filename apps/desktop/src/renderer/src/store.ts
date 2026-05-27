import { create } from 'zustand'
import type { MoshttyAppInfo, MoshttySecretStorageInfo } from '../../common/moshtty-api'
import type { ParsedMoshttyProfile } from '../../common/profile.schema'
import type {
  MoshttyPaneLayoutNode,
  MoshttyPaneLayoutSplit,
  MoshttyProject,
  MoshttyState,
  SplitAxis,
  StateLoadResult
} from '../../common/state'
import {
  createSampleState,
  getActiveProject,
  getActiveTab,
  nextStateTimestamp,
  projectDisplayInitial
} from '../../common/state'

export interface WorkspaceSnapshot {
  state: MoshttyState
  source: StateLoadResult['source']
  warning?: string
  appInfo?: MoshttyAppInfo
  secretInfo?: MoshttySecretStorageInfo
}

interface AppState {
  hydrated: boolean
  loading: boolean
  saving: boolean
  error: string | null
  snapshot: WorkspaceSnapshot | null
  paneFlows: Record<string, { flowId: number; key: string }>
  setPaneFlow: (paneId: string, flowId: number, key: string) => void
  bindPaneFlow: (paneId: string, flowId: number, key: string) => Promise<void>
  markPaneLost: (paneId: string) => Promise<void>
  restartLostPane: (paneId: string) => Promise<void>
  hydrate: () => Promise<void>
  saveWorkspace: () => Promise<void>
  resetWorkspace: () => Promise<void>
  addProject: (name: string) => Promise<void>
  addTab: (title: string) => Promise<void>
  importRemoteProfile: (profile: ParsedMoshttyProfile) => Promise<void>
  setActiveProject: (projectId: string) => Promise<void>
  deleteProject: (projectId: string) => Promise<void>
  renameProject: (projectId: string, name: string) => Promise<void>
  deleteRemote: (remoteId: string) => Promise<void>
  renameTab: (tabId: string, title: string) => Promise<void>
  toggleProjectRail: () => Promise<void>
  splitPane: (axis: SplitAxis) => Promise<void>
  closeActivePane: () => Promise<void>
  closeActiveTab: () => Promise<void>
  setActiveTab: (tabId: string) => Promise<void>
  closeTab: (tabId: string) => Promise<void>
}

function getMoshttyApi(): Window['moshtty'] {
  if (typeof window === 'undefined' || !window.moshtty) {
    throw new Error('Moshtty preload API is unavailable')
  }
  return window.moshtty
}

const EMPTY_PROJECTS: MoshttyProject[] = []
export { EMPTY_PROJECTS }

function withUpdatedTimestamp(state: MoshttyState): MoshttyState {
  return {
    ...state,
    updatedAt: nextStateTimestamp()
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  loading: false,
  saving: false,
  error: null,
  snapshot: null,
  paneFlows: {},
  setPaneFlow: (paneId, flowId, key) => {
    set((state) => ({
      paneFlows: {
        ...state.paneFlows,
        [paneId]: { flowId, key }
      }
    }))
  },
  bindPaneFlow: async (paneId, flowId, key) => {
    get().setPaneFlow(paneId, flowId, key)

    const snapshot = get().snapshot
    if (!snapshot) {
      return
    }

    const pane = snapshot.state.panes.find((entry) => entry.id === paneId)
    if (!pane || pane.remoteFlowId === flowId) {
      return
    }

    set({
      snapshot: {
        ...snapshot,
        state: withUpdatedTimestamp({
          ...snapshot.state,
          panes: snapshot.state.panes.map((entry) =>
            entry.id === paneId ? { ...entry, remoteFlowId: flowId } : entry
          )
        })
      }
    })
    await get().saveWorkspace()
  },
  markPaneLost: async (paneId) => {
    const snapshot = get().snapshot
    if (!snapshot) {
      return
    }

    const pane = snapshot.state.panes.find((entry) => entry.id === paneId)
    if (!pane || pane.status === 'lost') {
      return
    }

    set((state) => {
      const remainingFlows = { ...state.paneFlows }
      const hadFlow = paneId in remainingFlows
      delete remainingFlows[paneId]
      return {
        paneFlows: hadFlow ? remainingFlows : state.paneFlows,
        snapshot: {
          ...snapshot,
          state: withUpdatedTimestamp({
            ...snapshot.state,
            panes: snapshot.state.panes.map((entry) =>
              entry.id === paneId ? { ...entry, status: 'lost' } : entry
            )
          })
        }
      }
    })
    await get().saveWorkspace()
  },
  restartLostPane: async (paneId) => {
    const snapshot = get().snapshot
    if (!snapshot) {
      return
    }

    const pane = snapshot.state.panes.find((entry) => entry.id === paneId)
    if (!pane || pane.status !== 'lost') {
      return
    }

    set((state) => {
      const remainingFlows = { ...state.paneFlows }
      delete remainingFlows[paneId]
      return {
        paneFlows: remainingFlows,
        snapshot: {
          ...snapshot,
          state: withUpdatedTimestamp({
            ...snapshot.state,
            panes: snapshot.state.panes.map((entry) =>
              entry.id === paneId ? { ...entry, status: 'active', remoteFlowId: undefined } : entry
            )
          })
        }
      }
    })
    await get().saveWorkspace()
  },

  hydrate: async () => {
    set({ loading: true, error: null })
    try {
      const api = getMoshttyApi()
      const [loadResult, appInfo, secretInfo] = await Promise.all([
        api.loadState(),
        api.getAppInfo(),
        api.getSecretStorageInfo()
      ])

      const state = loadResult.state.projects.length === 0 ? createSampleState() : loadResult.state

      set({
        hydrated: true,
        loading: false,
        snapshot: {
          state,
          source: loadResult.source,
          warning: loadResult.warning,
          appInfo,
          secretInfo
        }
      })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load Moshtty state'
      })
    }
  },

  saveWorkspace: async () => {
    const snapshot = get().snapshot
    if (!snapshot) {
      return
    }

    set({ saving: true, error: null })
    try {
      const api = getMoshttyApi()
      const nextState = withUpdatedTimestamp(snapshot.state)
      const result = await api.saveState(nextState)
      set({
        saving: false,
        snapshot: {
          ...snapshot,
          state: result.state,
          source: result.source,
          warning: result.warning
        }
      })
    } catch (error) {
      set({
        saving: false,
        error: error instanceof Error ? error.message : 'Failed to save Moshtty state'
      })
    }
  },

  resetWorkspace: async () => {
    set({ saving: true, error: null })
    try {
      const api = getMoshttyApi()
      const result = await api.resetState()
      set({
        saving: false,
        snapshot: get().snapshot
          ? {
              ...get().snapshot!,
              state: result.state,
              source: result.source,
              warning: result.warning
            }
          : {
              state: result.state,
              source: result.source,
              warning: result.warning
            }
      })
    } catch (error) {
      set({
        saving: false,
        error: error instanceof Error ? error.message : 'Failed to reset Moshtty state'
      })
    }
  },

  addProject: async (name: string) => {
    const snapshot = get().snapshot
    if (!snapshot) {
      return
    }

    const projectId = `project-${crypto.randomUUID()}`
    const tabId = `tab-${crypto.randomUUID()}`
    const paneId = `pane-${crypto.randomUUID()}`
    const trimmedName = name.trim() || 'Untitled'

    const nextState: MoshttyState = withUpdatedTimestamp({
      ...snapshot.state,
      activeProjectId: projectId,
      activeTabId: tabId,
      activePaneId: paneId,
      projects: [
        ...snapshot.state.projects,
        {
          id: projectId,
          name: trimmedName,
          color: '#4f46e5',
          remoteId: null,
          tabIds: [tabId],
          activeTabId: tabId
        }
      ],
      tabs: [
        ...snapshot.state.tabs,
        {
          id: tabId,
          title: 'Shell',
          paneIds: [paneId],
          activePaneId: paneId
        }
      ],
      panes: [
        ...snapshot.state.panes,
        {
          id: paneId,
          title: trimmedName,
          cwd: '~',
          status: 'active',
          cols: 120,
          rows: 32
        }
      ],
      layouts: [
        ...snapshot.state.layouts,
        {
          tabId,
          root: {
            kind: 'pane',
            paneId
          }
        }
      ]
    })

    set({
      snapshot: {
        ...snapshot,
        state: nextState
      }
    })
    await get().saveWorkspace()
  },

  addTab: async (title: string) => {
    const snapshot = get().snapshot
    if (!snapshot || !snapshot.state.activeProjectId) {
      return
    }

    const activeProject = snapshot.state.projects.find(
      (project) => project.id === snapshot.state.activeProjectId
    )
    if (!activeProject) {
      return
    }

    const tabId = `tab-${crypto.randomUUID()}`
    const paneId = `pane-${crypto.randomUUID()}`
    const trimmedTitle = title.trim() || 'Shell'

    const nextState: MoshttyState = withUpdatedTimestamp({
      ...snapshot.state,
      activeTabId: tabId,
      activePaneId: paneId,
      projects: snapshot.state.projects.map((project) =>
        project.id === activeProject.id
          ? {
              ...project,
              tabIds: [...project.tabIds, tabId],
              activeTabId: tabId
            }
          : project
      ),
      tabs: [
        ...snapshot.state.tabs,
        {
          id: tabId,
          title: trimmedTitle,
          paneIds: [paneId],
          activePaneId: paneId
        }
      ],
      panes: [
        ...snapshot.state.panes,
        {
          id: paneId,
          title: trimmedTitle,
          cwd: '~',
          status: 'active',
          cols: 120,
          rows: 32
        }
      ],
      layouts: [
        ...snapshot.state.layouts,
        {
          tabId,
          root: {
            kind: 'pane',
            paneId
          }
        }
      ]
    })

    set({
      snapshot: {
        ...snapshot,
        state: nextState
      }
    })
    await get().saveWorkspace()
  },

  importRemoteProfile: async (profile: ParsedMoshttyProfile) => {
    const snapshot = get().snapshot
    if (!snapshot) {
      return
    }

    const activeProjectId = snapshot.state.activeProjectId
    const activeTabId = snapshot.state.activeTabId
    const activePaneId = snapshot.state.activePaneId
    const nextState: MoshttyState = withUpdatedTimestamp({
      ...snapshot.state,
      remotes: [
        ...snapshot.state.remotes.filter((remote) => remote.id !== profile.remoteId),
        {
          id: profile.remoteId,
          label: profile.hostLabel,
          host: new URL(profile.url).hostname,
          platform: profile.platform,
          status: 'offline',
          url: profile.url,
          tokenLabel: profile.tokenLabel,
          currentCertHash: profile.currentCertHash,
          nextCertHash: profile.nextCertHash
        }
      ],
      projects: snapshot.state.projects.map((project) =>
        project.id === activeProjectId &&
        (!project.remoteId || project.remoteId === 'remote-placeholder')
          ? { ...project, remoteId: profile.remoteId }
          : project
      ),
      tabs: snapshot.state.tabs.map((tab) =>
        tab.id === activeTabId && tab.title === 'Getting started' ? { ...tab, title: 'Shell' } : tab
      ),
      panes: snapshot.state.panes.map((pane) =>
        pane.id === activePaneId && pane.title === 'No remote connected'
          ? { ...pane, title: 'Shell' }
          : pane
      )
    })

    set({
      snapshot: {
        ...snapshot,
        state: nextState
      }
    })
    await get().saveWorkspace()
  },

  setActiveProject: async (projectId: string) => {
    const snapshot = get().snapshot
    if (!snapshot) {
      return
    }

    const project = snapshot.state.projects.find((entry) => entry.id === projectId)
    if (!project) {
      return
    }

    const nextState = withUpdatedTimestamp({
      ...snapshot.state,
      activeProjectId: project.id,
      activeTabId: project.activeTabId,
      activePaneId:
        snapshot.state.tabs.find((tab) => tab.id === project.activeTabId)?.activePaneId ?? null
    })

    set({
      snapshot: {
        ...snapshot,
        state: nextState
      }
    })
    await get().saveWorkspace()
  },

  deleteProject: async (projectId: string) => {
    const snapshot = get().snapshot
    if (!snapshot) {
      return
    }

    const project = snapshot.state.projects.find((p) => p.id === projectId)
    if (!project) {
      return
    }

    // Collect all tab/pane IDs belonging to this project
    const tabIds = project.tabIds
    const paneIds = snapshot.state.panes
      .filter((pane) =>
        snapshot.state.tabs
          .filter((tab) => tabIds.includes(tab.id))
          .some((tab) => tab.paneIds.includes(pane.id))
      )
      .map((pane) => pane.id)

    const remainingProjects = snapshot.state.projects.filter((p) => p.id !== projectId)
    const nextActiveProjectId = remainingProjects[0]?.id ?? null
    const nextProject = remainingProjects[0]
    const nextActiveTabId = nextProject?.activeTabId ?? null
    const nextTab = snapshot.state.tabs.find((t) => t.id === nextActiveTabId)
    const nextActivePaneId = nextTab?.activePaneId ?? null

    const nextState = withUpdatedTimestamp({
      ...snapshot.state,
      activeProjectId: nextActiveProjectId,
      activeTabId: nextActiveTabId,
      activePaneId: nextActivePaneId,
      projects: remainingProjects,
      tabs: snapshot.state.tabs.filter((t) => !tabIds.includes(t.id)),
      panes: snapshot.state.panes.filter((p) => !paneIds.includes(p.id)),
      layouts: snapshot.state.layouts.filter((l) => !tabIds.includes(l.tabId))
    })

    set({ snapshot: { ...snapshot, state: nextState } })
    await get().saveWorkspace()
  },

  renameProject: async (projectId: string, name: string) => {
    const snapshot = get().snapshot
    if (!snapshot) {
      return
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    const nextState = withUpdatedTimestamp({
      ...snapshot.state,
      projects: snapshot.state.projects.map((p) =>
        p.id === projectId ? { ...p, name: trimmedName } : p
      )
    })

    set({ snapshot: { ...snapshot, state: nextState } })
    await get().saveWorkspace()
  },

  deleteRemote: async (remoteId: string) => {
    const snapshot = get().snapshot
    if (!snapshot) {
      return
    }

    const nextState = withUpdatedTimestamp({
      ...snapshot.state,
      remotes: snapshot.state.remotes.filter((r) => r.id !== remoteId),
      // Detach any projects bound to this remote
      projects: snapshot.state.projects.map((p) =>
        p.remoteId === remoteId ? { ...p, remoteId: null } : p
      )
    })

    set({ snapshot: { ...snapshot, state: nextState } })
    await get().saveWorkspace()
  },

  renameTab: async (tabId: string, title: string) => {
    const snapshot = get().snapshot
    if (!snapshot) {
      return
    }

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      return
    }

    const nextState = withUpdatedTimestamp({
      ...snapshot.state,
      tabs: snapshot.state.tabs.map((t) => (t.id === tabId ? { ...t, title: trimmedTitle } : t))
    })

    set({ snapshot: { ...snapshot, state: nextState } })
    await get().saveWorkspace()
  },

  toggleProjectRail: async () => {
    const snapshot = get().snapshot
    if (!snapshot) {
      return
    }

    set({
      snapshot: {
        ...snapshot,
        state: withUpdatedTimestamp({
          ...snapshot.state,
          settings: {
            ...snapshot.state.settings,
            projectRailCollapsed: !snapshot.state.settings.projectRailCollapsed
          }
        })
      }
    })
    await get().saveWorkspace()
  },

  splitPane: async (axis: SplitAxis) => {
    const snapshot = get().snapshot
    if (!snapshot || !snapshot.state.activePaneId || !snapshot.state.activeTabId) {
      return
    }

    const activeTab = snapshot.state.tabs.find((tab) => tab.id === snapshot.state.activeTabId)
    if (!activeTab) {
      return
    }

    const newPaneId = `pane-${crypto.randomUUID()}`
    const activePane = snapshot.state.panes.find((pane) => pane.id === snapshot.state.activePaneId)
    const newPane: typeof activePane = {
      id: newPaneId,
      title: 'Shell',
      cwd: activePane?.cwd ?? '~',
      status: 'active',
      cols: activePane?.cols ?? 120,
      rows: activePane?.rows ?? 32
    }

    const nextState = withUpdatedTimestamp({
      ...snapshot.state,
      activePaneId: newPaneId,
      tabs: snapshot.state.tabs.map((tab) =>
        tab.id === activeTab.id
          ? {
              ...tab,
              paneIds: [...tab.paneIds, newPaneId],
              activePaneId: newPaneId
            }
          : tab
      ),
      panes: [...snapshot.state.panes, newPane],
      layouts: snapshot.state.layouts.map((layout) => {
        if (layout.tabId !== activeTab.id) {
          return layout
        }
        const existingPane: MoshttyPaneLayoutNode = {
          kind: 'pane',
          paneId: snapshot.state.activePaneId!
        }
        const newSplit: MoshttyPaneLayoutSplit = {
          kind: 'split',
          axis,
          ratio: 0.5,
          first: existingPane,
          second: { kind: 'pane', paneId: newPaneId }
        }
        return { ...layout, root: newSplit }
      })
    })

    set({ snapshot: { ...snapshot, state: nextState } })
    await get().saveWorkspace()
  },

  closeActivePane: async () => {
    const snapshot = get().snapshot
    if (!snapshot || !snapshot.state.activePaneId || !snapshot.state.activeTabId) {
      return
    }

    const activeTab = snapshot.state.tabs.find((tab) => tab.id === snapshot.state.activeTabId)
    if (!activeTab || activeTab.paneIds.length <= 1) {
      return
    }

    const closingId = snapshot.state.activePaneId
    const nextPaneId = activeTab.paneIds.find((id) => id !== closingId) ?? null

    const nextState = withUpdatedTimestamp({
      ...snapshot.state,
      activePaneId: nextPaneId,
      tabs: snapshot.state.tabs.map((tab) =>
        tab.id === activeTab.id
          ? {
              ...tab,
              paneIds: tab.paneIds.filter((id) => id !== closingId),
              activePaneId: nextPaneId
            }
          : tab
      ),
      panes: snapshot.state.panes.filter((pane) => pane.id !== closingId),
      layouts: snapshot.state.layouts.map((layout) => {
        if (layout.tabId !== activeTab.id) {
          return layout
        }
        return { ...layout, root: removePaneFromLayout(layout.root, closingId) }
      })
    })

    set({ snapshot: { ...snapshot, state: nextState } })
    await get().saveWorkspace()
  },

  closeActiveTab: async () => {
    const snapshot = get().snapshot
    if (!snapshot || !snapshot.state.activeTabId || !snapshot.state.activeProjectId) {
      return
    }

    const activeProject = snapshot.state.projects.find(
      (project) => project.id === snapshot.state.activeProjectId
    )
    if (!activeProject || activeProject.tabIds.length <= 1) {
      return
    }

    const closingId = snapshot.state.activeTabId
    const tab = snapshot.state.tabs.find((t) => t.id === closingId)
    const paneIds = tab?.paneIds ?? []
    const nextTabId = activeProject.tabIds.find((id) => id !== closingId) ?? null
    const nextTab = snapshot.state.tabs.find((t) => t.id === nextTabId)

    const nextState = withUpdatedTimestamp({
      ...snapshot.state,
      activeTabId: nextTabId,
      activePaneId: nextTab?.activePaneId ?? null,
      projects: snapshot.state.projects.map((project) =>
        project.id === activeProject.id
          ? {
              ...project,
              tabIds: project.tabIds.filter((id) => id !== closingId),
              activeTabId: nextTabId
            }
          : project
      ),
      tabs: snapshot.state.tabs.filter((t) => t.id !== closingId),
      panes: snapshot.state.panes.filter((pane) => !paneIds.includes(pane.id)),
      layouts: snapshot.state.layouts.filter((layout) => layout.tabId !== closingId)
    })

    set({ snapshot: { ...snapshot, state: nextState } })
    await get().saveWorkspace()
  },

  setActiveTab: async (tabId: string) => {
    const snapshot = get().snapshot
    if (!snapshot || !snapshot.state.activeProjectId) {
      return
    }

    const tab = snapshot.state.tabs.find((entry) => entry.id === tabId)
    if (!tab) {
      return
    }

    const nextState = withUpdatedTimestamp({
      ...snapshot.state,
      activeTabId: tab.id,
      activePaneId: tab.activePaneId,
      projects: snapshot.state.projects.map((project) =>
        project.id === snapshot.state.activeProjectId
          ? { ...project, activeTabId: tab.id }
          : project
      )
    })

    set({ snapshot: { ...snapshot, state: nextState } })
    await get().saveWorkspace()
  },

  closeTab: async (tabId: string) => {
    const snapshot = get().snapshot
    if (!snapshot || !snapshot.state.activeProjectId) {
      return
    }

    const activeProject = snapshot.state.projects.find(
      (project) => project.id === snapshot.state.activeProjectId
    )
    if (!activeProject || activeProject.tabIds.length <= 1) {
      return
    }

    const tab = snapshot.state.tabs.find((t) => t.id === tabId)
    if (!tab) {
      return
    }
    const paneIds = tab.paneIds ?? []

    let nextTabId = snapshot.state.activeTabId
    if (tabId === snapshot.state.activeTabId) {
      nextTabId = activeProject.tabIds.find((id) => id !== tabId) ?? null
    }
    const nextTab = snapshot.state.tabs.find((t) => t.id === nextTabId)

    const nextState = withUpdatedTimestamp({
      ...snapshot.state,
      activeTabId: nextTabId,
      activePaneId: nextTab?.activePaneId ?? null,
      projects: snapshot.state.projects.map((project) =>
        project.id === activeProject.id
          ? {
              ...project,
              tabIds: project.tabIds.filter((id) => id !== tabId),
              activeTabId: project.activeTabId === tabId ? nextTabId : project.activeTabId
            }
          : project
      ),
      tabs: snapshot.state.tabs.filter((t) => t.id !== tabId),
      panes: snapshot.state.panes.filter((pane) => !paneIds.includes(pane.id)),
      layouts: snapshot.state.layouts.filter((layout) => layout.tabId !== tabId)
    })

    set({ snapshot: { ...snapshot, state: nextState } })
    await get().saveWorkspace()
  }
}))

function removePaneFromLayout(
  node: MoshttyPaneLayoutNode | null,
  paneId: string
): MoshttyPaneLayoutNode | null {
  if (!node) {
    return null
  }
  if (node.kind === 'pane') {
    return node.paneId === paneId ? null : node
  }
  const first = removePaneFromLayout(node.first, paneId)
  const second = removePaneFromLayout(node.second, paneId)
  if (!first && !second) {
    return null
  }
  if (!first) {
    return second
  }
  if (!second) {
    return first
  }
  return { ...node, first, second }
}

export function selectProjects(state: AppState): MoshttyProject[] {
  return state.snapshot?.state.projects ?? EMPTY_PROJECTS
}

export function selectActiveProject(state: AppState): MoshttyProject | null {
  if (!state.snapshot) {
    return null
  }
  return getActiveProject(state.snapshot.state)
}

export function selectActiveTabTitle(state: AppState): string {
  if (!state.snapshot) {
    return 'Loading...'
  }
  return getActiveTab(state.snapshot.state)?.title ?? 'No tab'
}

export function selectProjectInitial(project: MoshttyProject): string {
  return projectDisplayInitial(project)
}
