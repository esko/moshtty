import React from 'react'
import { useAppStore } from '../store'
import { PlusIcon, GearIcon, HelpIcon, TrashIcon, PencilIcon } from '../design/icons'
import { projectDisplayInitial } from '../../../common/state'
import './Sidebar.css'

interface SidebarProps {
  state: import('../../../common/state').MoshttyState | null
  openDialog: (dialog: import('../dialogs').AppDialog) => void
  actionTitle: (actionId: import('../keymap').AppActionId) => string
}

export const Sidebar: React.FC<SidebarProps> = ({ state, openDialog, actionTitle }) => {
  const setActiveProject = useAppStore((s) => s.setActiveProject)
  const deleteProject = useAppStore((s) => s.deleteProject)

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
            <div key={project.id} className={`project-item-row ${isActive ? 'active' : ''}`}>
              <button
                type="button"
                className="project-item"
                onClick={(): void => {
                  setActiveProject(project.id).catch(console.error)
                }}
                onDoubleClick={(): void =>
                  openDialog({ kind: 'project', mode: 'existing', projectId: project.id })
                }
              >
                <span className="project-chip" style={{ backgroundColor: project.color }}>
                  {projectDisplayInitial(project)}
                </span>
                <span className="project-label">{project.name}</span>
              </button>
              <button
                type="button"
                className="project-action-btn project-edit"
                aria-label={`Rename ${project.name}`}
                title="Rename project"
                onClick={(): void =>
                  openDialog({ kind: 'project', mode: 'existing', projectId: project.id })
                }
              >
                <PencilIcon size={16} />
              </button>
              <button
                type="button"
                className="project-action-btn project-delete danger"
                aria-label={`Delete ${project.name}`}
                title="Delete project"
                onClick={(): void => {
                  if (confirm(`Delete project "${project.name}"?`)) {
                    deleteProject(project.id).catch(console.error)
                  }
                }}
              >
                <TrashIcon size={16} />
              </button>
            </div>
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
