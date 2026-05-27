import React, { useRef, useState } from 'react'
import { useAppStore } from '../store'
import {
  PlusIcon,
  FolderPlusIcon,
  GearIcon,
  HelpIcon,
  TrashIcon,
  PencilIcon
} from '../design/icons'
import { projectDisplayInitial } from '../../../common/state'
import './Sidebar.css'

const SshIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
    <polyline points="7 8 10 10 7 12" />
    <line x1="12" y1="12" x2="16" y2="12" />
  </svg>
)

interface SidebarProps {
  state: import('../../../common/state').MoshttyState | null
  openDialog: (dialog: import('../dialogs').AppDialog) => void
  actionTitle: (actionId: import('../keymap').AppActionId) => string
}

export const Sidebar: React.FC<SidebarProps> = ({ state, openDialog, actionTitle }) => {
  const setActiveProject = useAppStore((s) => s.setActiveProject)
  const deleteProject = useAppStore((s) => s.deleteProject)
  const renameProject = useAppStore((s) => s.renameProject)

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const projects = state?.projects ?? []
  const activeProjectId = state?.activeProjectId
  const railCollapsed = state?.settings?.projectRailCollapsed ?? false

  if (railCollapsed) {
    return null
  }

  const startRename = (projectId: string, currentName: string): void => {
    setEditingProjectId(projectId)
    setEditingName(currentName)
    // Focus the input on next render
    setTimeout(() => renameInputRef.current?.focus(), 0)
  }

  const commitRename = (projectId: string): void => {
    if (editingName.trim()) {
      renameProject(projectId, editingName).catch(console.error)
    }
    setEditingProjectId(null)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent, projectId: string): void => {
    if (e.key === 'Enter') {
      commitRename(projectId)
    } else if (e.key === 'Escape') {
      setEditingProjectId(null)
    }
  }

  return (
    <aside className="sidebar" aria-label="Projects">
      <div className="sidebar-header">
        <span className="sidebar-title">Projects</span>
        <div className="sidebar-header-actions">
          <button
            className="sidebar-action-btn"
            type="button"
            aria-label="Bootstrap remote"
            title={actionTitle('bootstrap-remote')}
            onClick={(): void => openDialog({ kind: 'bootstrap' })}
          >
            <SshIcon size={14} />
          </button>
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
          const isEditing = editingProjectId === project.id
          return (
            <div key={project.id} className={`project-item-row ${isActive ? 'active' : ''}`}>
              {isEditing ? (
                <div className="project-rename-row">
                  <span className="project-chip" style={{ backgroundColor: project.color }}>
                    {projectDisplayInitial(project)}
                  </span>
                  <input
                    ref={renameInputRef}
                    className="project-rename-input"
                    value={editingName}
                    onChange={(e): void => setEditingName(e.target.value)}
                    onBlur={(): void => commitRename(project.id)}
                    onKeyDown={(e): void => handleRenameKeyDown(e, project.id)}
                    aria-label="Project name"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="project-item"
                  onClick={(): void => {
                    setActiveProject(project.id).catch(console.error)
                  }}
                  onDoubleClick={(): void => startRename(project.id, project.name)}
                >
                  <span className="project-chip" style={{ backgroundColor: project.color }}>
                    {projectDisplayInitial(project)}
                  </span>
                  <span className="project-label">{project.name}</span>
                </button>
              )}
              <div className="project-item-actions">
                <button
                  type="button"
                  className="project-action-btn"
                  aria-label={`Rename ${project.name}`}
                  title="Rename project"
                  onClick={(): void => startRename(project.id, project.name)}
                >
                  <PencilIcon size={12} />
                </button>
                <button
                  type="button"
                  className="project-action-btn danger"
                  aria-label={`Delete ${project.name}`}
                  title="Delete project"
                  onClick={(): void => {
                    if (confirm(`Delete project "${project.name}"?`)) {
                      deleteProject(project.id).catch(console.error)
                    }
                  }}
                >
                  <TrashIcon size={12} />
                </button>
              </div>
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
