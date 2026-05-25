import { useAppStore } from './store'
import { useEffect } from 'react'

function App(): React.JSX.Element {
  const { projects, addProject } = useAppStore()

  useEffect(() => {
    if (projects.length === 0) {
      addProject('Local Terminal')
    }
  }, [projects, addProject])

  return (
    <div className="moshtty-app">
      {/* Sidebar / Left Project Rail */}
      <aside className="project-rail">
        <div className="brand">
          <span className="brand-dot"></span>
          <span className="brand-name">Moshtty</span>
        </div>
        <div className="project-list">
          {projects.map((proj) => (
            <div key={proj.id} className="project-item active">
              <div className="project-chip">{proj.name[0]}</div>
              <span className="project-label">{proj.name}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Terminal Workspace */}
      <main className="workspace">
        <header className="tab-bar">
          <div className="tabs">
            <div className="tab active">
              <span className="tab-title">default shell</span>
            </div>
          </div>
          <div className="tab-actions">
            <span className="status-indicator connected">Remote Connected</span>
          </div>
        </header>

        <section className="terminal-canvas">
          <div className="placeholder-terminal">
            <pre>
{`Welcome to Moshtty.
Durable remote session companion is ready.

Current active project: ${projects[0]?.name || 'Loading...'}

[placeholder] Terminal UI rendering is ready.`}
            </pre>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
