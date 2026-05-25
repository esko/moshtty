import { create } from 'zustand'
import type { MoshttyAppInfo, MoshttySecretStorageInfo } from '../../common/moshtty-api'
import type { ParsedMoshttyProfile } from '../../common/profile.schema'
import type { MoshttyProject, MoshttyState, StateLoadResult } from '../../common/state'
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
  hydrate: () => Promise<void>
  saveWorkspace: () => Promise<void>
  resetWorkspace: () => Promise<void>
  addProject: (name: string) => Promise<void>
  addTab: (title: string) => Promise<void>
  importRemoteProfile: (profile: ParsedMoshttyProfile) => Promise<void>
  setActiveProject: (projectId: string) => Promise<void>
  toggleProjectRail: () => Promise<void>
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
  }
}))

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
