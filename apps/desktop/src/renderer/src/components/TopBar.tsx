import React from 'react'
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
  const addTab = useAppStore((state) => state.addTab)
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const closeTab = useAppStore((state) => state.closeTab)
  const toggleProjectRail = useAppStore((state) => state.toggleProjectRail)

  const activeProjectId = state?.activeProjectId
  const activeProject = state?.projects.find((p) => p.id === activeProjectId)
  const activeTabId = state?.activeTabId
  const tabs = activeProject
    ? (state?.tabs.filter((tab) => activeProject.tabIds.includes(tab.id)) ?? [])
    : []

  const handleNewTab = (): void => {
    addTab('Shell').catch(console.error)
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
            return (
              <div
                key={tab.id}
                className={`tab-wrapper ${isActive ? 'active' : ''}`}
                role="presentation"
              >
                <button
                  type="button"
                  className="tab-btn"
                  role="tab"
                  aria-selected={isActive}
                  onClick={(): void => {
                    setActiveTab(tab.id).catch(console.error)
                  }}
                >
                  <span className="tab-title">{tab.title}</span>
                </button>
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
