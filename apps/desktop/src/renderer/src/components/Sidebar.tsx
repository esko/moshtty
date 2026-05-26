import React from 'react'
import { useAppStore } from '../store'
import { PlusIcon, FolderPlusIcon, GearIcon, HelpIcon } from '../design/icons'
import { projectDisplayInitial } from '../../../common/state'
import './Sidebar.css'

interface SidebarProps {
  state: import('../../../common/state').MoshttyState | null
  openDialog: (dialog: import('../dialogs').AppDialog) => void
  actionTitle: (actionId: import('../keymap').AppActionId) => string
}

export const Sidebar: React.FC<SidebarProps> = ({ state, openDialog, actionTitle }) => {
  const setActiveProject = useAppStore((state) => state.setActiveProject)

  const projects = state?.projects ?? []
  const activeProjectId = state?.activeProjectId
  const railCollapsed = state?.settings?.projectRailCollapsed ?? false

  if (railCollapsed) {
    return null
  }

  return (
    <aside className="sidebar" aria-label="Projects">
      <div className="sidebar-header">
        <span className="sidebar-title">Projects</span>
        <div className="sidebar-header-actions">
          <button
            className="sidebar-action-btn"
            type="button"
            aria-label="Import remote"
            title={actionTitle('import-remote')}
            onClick={(): void => openDialog({ kind: 'import', mode: 'empty' })}
          >
            <FolderPlusIcon size={14} />
          </button>
          <button
            className="sidebar-action-btn"
            type="button"
            aria-label="New project"
            title={actionTitle('new-project')}
            onClick={(): void => openDialog({ kind: 'project', mode: 'new' })}
          >
            <PlusIcon size={14} />
          </button>
        </div>
      </div>

      <div className="project-list" role="navigation" aria-label="Projects list">
        {projects.map((project) => {
          const isActive = project.id === activeProjectId
          return (
            <button
              key={project.id}
              type="button"
              className={`project-item ${isActive ? 'active' : ''}`}
              onClick={(): void => {
                setActiveProject(project.id).catch(console.error)
              }}
            >
              <span className="project-chip" style={{ backgroundColor: project.color }}>
                {projectDisplayInitial(project)}
              </span>
              <span className="project-label">{project.name}</span>
            </button>
          )
        })}
        {projects.length === 0 && <p className="empty-copy">No projects</p>}
      </div>

      <div className="sidebar-footer">
        <button
          className="footer-link"
          type="button"
          title={actionTitle('open-settings')}
          onClick={(): void => openDialog({ kind: 'settings' })}
        >
          <GearIcon size={16} />
          <span>Settings</span>
        </button>
        <button
          className="footer-link"
          type="button"
          title={actionTitle('open-help')}
          onClick={(): void => openDialog({ kind: 'settings' })} // Help currently opens settings shortcuts
        >
          <HelpIcon size={16} />
          <span>Help</span>
        </button>
      </div>
    </aside>
  )
}
