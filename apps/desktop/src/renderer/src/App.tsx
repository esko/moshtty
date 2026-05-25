import { useEffect, useMemo } from 'react'
import { getActiveProject, getActiveTab, projectDisplayInitial } from '../../common/state'
import { EMPTY_PROJECTS, useAppStore } from './store'

function App(): React.JSX.Element {
  const hydrated = useAppStore((state) => state.hydrated)
  const loading = useAppStore((state) => state.loading)
  const saving = useAppStore((state) => state.saving)
  const error = useAppStore((state) => state.error)
  const snapshot = useAppStore((state) => state.snapshot)
  const hydrate = useAppStore((state) => state.hydrate)
  const saveWorkspace = useAppStore((state) => state.saveWorkspace)
  const resetWorkspace = useAppStore((state) => state.resetWorkspace)
  const addProject = useAppStore((state) => state.addProject)
  const setActiveProject = useAppStore((state) => state.setActiveProject)

  const projects = useAppStore((state) => state.snapshot?.state.projects ?? EMPTY_PROJECTS)
  const activeProject = useMemo(
    () => (snapshot ? getActiveProject(snapshot.state) : null),
    [snapshot]
  )
  const activeTabTitle = useMemo(() => {
    if (!snapshot) {
      return 'Loading...'
    }
    return getActiveTab(snapshot.state)?.title ?? 'No tab'
  }, [snapshot])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <div className="moshtty-app">
      <aside className="project-rail">
        <div className="brand">
          <span className="brand-dot"></span>
          <span className="brand-name">Moshtty</span>
        </div>
        <div className="project-list">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={`project-item ${activeProject?.id === project.id ? 'active' : ''}`}
              onClick={() => void setActiveProject(project.id)}
            >
              <div className="project-chip">{projectDisplayInitial(project)}</div>
              <span className="project-label">{project.name}</span>
            </button>
          ))}
        </div>
        <div className="rail-actions">
          <button type="button" className="ghost-button" onClick={() => void addProject('New project')}>
            New project
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="tab-bar">
          <div className="tabs">
            <div className="tab active">
              <span className="tab-title">{activeTabTitle}</span>
            </div>
          </div>
          <div className="tab-actions">
            <span className="status-indicator offline">State shell ready</span>
          </div>
        </header>

        <section className="terminal-canvas">
          <div className="placeholder-terminal">
            <pre>
              {`Welcome to Moshtty.
Desktop state shell is active over app://moshtty.

Active project: ${activeProject?.name ?? 'None'}
State source: ${snapshot?.source ?? (loading ? 'loading' : 'unknown')}
Protocol: ${snapshot?.appInfo?.protocolUrl ?? 'app://moshtty/index.html'}
Secret storage: ${snapshot?.secretInfo?.mode ?? 'unknown'}

[placeholder] Terminal rendering arrives in M5.`}
            </pre>
          </div>

          <div className="dev-panel">
            <div className="dev-panel-row">
              <strong>State file</strong>
              <span>{snapshot?.appInfo?.stateFilePath ?? 'Unavailable until hydrated'}</span>
            </div>
            {snapshot?.warning ? (
              <div className="dev-panel-row warning">
                <strong>Warning</strong>
                <span>{snapshot.warning}</span>
              </div>
            ) : null}
            {error ? (
              <div className="dev-panel-row warning">
                <strong>Error</strong>
                <span>{error}</span>
              </div>
            ) : null}
            <div className="dev-panel-actions">
              <button type="button" disabled={!hydrated || saving} onClick={() => void saveWorkspace()}>
                {saving ? 'Saving…' : 'Save state'}
              </button>
              <button type="button" disabled={!hydrated || saving} onClick={() => void resetWorkspace()}>
                Reset state
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
