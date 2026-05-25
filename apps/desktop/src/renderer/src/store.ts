import { create } from 'zustand'

export interface Pane {
  id: string
  title: string
}

export interface Tab {
  id: string
  title: string
  panes: Pane[]
}

export interface Project {
  id: string
  name: string
  tabs: Tab[]
}

interface AppState {
  projects: Project[]
  activeProjectId: string | null
  activeTabId: string | null
  activePaneId: string | null
  addProject: (name: string) => void
  setActiveProject: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  projects: [],
  activeProjectId: null,
  activeTabId: null,
  activePaneId: null,
  addProject: (name) =>
    set((state) => {
      const newProject: Project = {
        id: Math.random().toString(36).substring(7),
        name,
        tabs: []
      }
      return {
        projects: [...state.projects, newProject],
        activeProjectId: state.activeProjectId || newProject.id
      }
    }),
  setActiveProject: (id) => set({ activeProjectId: id })
}))
