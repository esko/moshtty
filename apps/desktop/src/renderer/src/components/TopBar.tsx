import React, { useRef, useState } from 'react'
import { useAppStore } from '../store'
import { HamburgerIcon, PlusIcon, XIcon } from '../design/icons'
import { WindowControls } from './WindowControls'
import './TopBar.css'

interface TopBarProps {
  state: import('../../../common/state').MoshttyState | null
  liveStatus: string | null
  remoteStatus: string
  remote: import('../../../common/state').MoshttyRemote | null
}

export const TopBar: React.FC<TopBarProps> = ({ state, liveStatus, remoteStatus, remote }) => {
  const addTab = useAppStore((s) => s.addTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const closeTab = useAppStore((s) => s.closeTab)
  const toggleProjectRail = useAppStore((s) => s.toggleProjectRail)
  const renameTab = useAppStore((s) => s.renameTab)

  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const tabInputRef = useRef<HTMLInputElement>(null)

  const activeProjectId = state?.activeProjectId
  const activeProject = state?.projects.find((p) => p.id === activeProjectId)
  const activeTabId = state?.activeTabId
  const tabs = activeProject
    ? (state?.tabs.filter((tab) => activeProject.tabIds.includes(tab.id)) ?? [])
    : []

  const handleNewTab = (): void => {
    addTab('Shell').catch(console.error)
  }

  const startTabRename = (tabId: string, currentTitle: string): void => {
    setEditingTabId(tabId)
    setEditingTitle(currentTitle)
    setTimeout(() => tabInputRef.current?.focus(), 0)
  }

  const commitTabRename = (tabId: string): void => {
    if (editingTitle.trim()) {
      renameTab(tabId, editingTitle).catch(console.error)
    }
    setEditingTabId(null)
  }

  const handleTabRenameKeyDown = (e: React.KeyboardEvent, tabId: string): void => {
    if (e.key === 'Enter') {
      commitTabRename(tabId)
    } else if (e.key === 'Escape') {
      setEditingTabId(null)
    }
  }

  return (
    <header className="top-bar" data-testid="top-bar">
      <div className="top-bar-left">
        <button
          className="sidebar-toggle"
          type="button"
          aria-label="Toggle project rail"
          onClick={(): void => {
            toggleProjectRail().catch(console.error)
          }}
        >
          <HamburgerIcon size={16} />
        </button>
        <span className="brand-badge">BETA</span>
      </div>

      <div className="tab-strip-wrapper">
        <div className="tab-strip" role="tablist" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            const isEditing = editingTabId === tab.id
            return (
              <div
                key={tab.id}
                className={`tab-wrapper ${isActive ? 'active' : ''}`}
                role="presentation"
              >
                {isEditing ? (
                  <input
                    ref={tabInputRef}
                    className="tab-rename-input"
                    value={editingTitle}
                    onChange={(e): void => setEditingTitle(e.target.value)}
                    onBlur={(): void => commitTabRename(tab.id)}
                    onKeyDown={(e): void => handleTabRenameKeyDown(e, tab.id)}
                    aria-label="Tab title"
                  />
                ) : (
                  <button
                    type="button"
                    className="tab-btn"
                    role="tab"
                    aria-selected={isActive}
                    onClick={(): void => {
                      setActiveTab(tab.id).catch(console.error)
                    }}
                    onDoubleClick={(): void => startTabRename(tab.id, tab.title)}
                  >
                    <span className="tab-title">{tab.title}</span>
                  </button>
                )}
                {tabs.length > 1 && (
                  <button
                    type="button"
                    className="tab-close"
                    aria-label={`Close ${tab.title} tab`}
                    onClick={(e): void => {
                      e.stopPropagation()
                      closeTab(tab.id).catch(console.error)
                    }}
                  >
                    <XIcon size={12} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <button className="new-tab-btn" type="button" aria-label="New tab" onClick={handleNewTab}>
          <PlusIcon size={16} />
        </button>
      </div>

      <div className="top-bar-right">
        <span className={`connection-status ${liveStatus ?? remote?.status ?? 'offline'}`}>
          {remoteStatus}
        </span>
        <WindowControls />
      </div>
    </header>
  )
}
