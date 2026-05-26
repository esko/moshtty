import React from 'react'
import { useAppStore } from '../store'
import { SearchIcon, EditIcon } from '../design/icons'
import { getActiveProject, getActiveTab } from '../../../common/state'
import './Dashboard.css'

interface DashboardProps {
  state: import('../../../common/state').MoshttyState | null
  actionTitle: (actionId: import('../keymap').AppActionId) => string
}

export const Dashboard: React.FC<DashboardProps> = ({ state, actionTitle }) => {
  const addTab = useAppStore((state) => state.addTab)

  const activeTab = state ? getActiveTab(state) : null
  const activeProject = state ? getActiveProject(state) : null

  const handleNewTab = (): void => {
    addTab('Shell').catch(console.error)
  }

  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <div className="search-row">
        <SearchIcon />
        <span>Search tabs</span>
      </div>
      <div className="dashboard-head">
        <h1 id="dashboard-title">Today</h1>
        <button
          className="button subtle"
          type="button"
          data-action-id="new-tab"
          title={actionTitle('new-tab')}
          onClick={handleNewTab}
        >
          <EditIcon />
          New tab
        </button>
      </div>
      <div className="recent-row">
        <strong>{activeTab?.title ?? 'No tab'}</strong>
        <span>{activeProject?.name ?? 'Create a project to begin'}</span>
      </div>
    </section>
  )
}
