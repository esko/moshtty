import { useEffect, useMemo } from 'react'
import {
  getActiveProject,
  getActiveTab,
  projectDisplayInitial,
  type MoshttyPane,
  type MoshttyPaneLayoutNode,
  type MoshttyRemote,
  type MoshttyState
} from '../../common/state'
import {
  EditIcon,
  FolderPlusIcon,
  GearIcon,
  GridIcon,
  HamburgerIcon,
  HelpIcon,
  KeyboardIcon,
  PlusIcon,
  SearchIcon,
  XIcon
} from './design/icons'
import { resolveTerminalThemeMode, useResolvedThemeMode } from './design/theme'
import { FixtureBanner } from './fixtures/FixtureBanner'
import { getFixture } from './fixtures/states'
import { loadFixtureFromQuery } from './fixtures/loader'
import {
  APP_ACTIONS,
  formatShortcut,
  getAction,
  getShortcutActions,
  useRegisteredShortcuts,
  type AppActionId,
  type AppActionHandlerMap
} from './keymap'
import { EMPTY_PROJECTS, useAppStore } from './store'

const EMPTY_REMOTES: MoshttyRemote[] = []

function getFixtureId(): string | null {
  return loadFixtureFromQuery()
}

function getRemoteStatusLabel(status: MoshttyRemote['status'] | undefined): string {
  switch (status) {
    case 'connected':
      return 'Connected'
    case 'connecting':
      return 'Connecting'
    case 'lost':
      return 'Lost'
    default:
      return 'Offline'
  }
}

function getPaneById(state: MoshttyState, paneId: string): MoshttyPane | null {
  return state.panes.find((pane) => pane.id === paneId) ?? null
}

function actionTitle(actionId: AppActionId): string {
  const action = getAction(actionId)
  return `${action.label} (${formatShortcut(action.shortcut)})`
}

function TerminalPane({
  pane,
  active,
  terminalMode
}: {
  pane: MoshttyPane | null
  active: boolean
  terminalMode: 'light' | 'dark'
}): React.JSX.Element {
  const lost = pane?.status === 'lost'
  const title = pane?.title ?? 'Waiting for pane'
  const cwd = pane?.cwd ?? '~'

  return (
    <section
      className={`terminal-pane ${active ? 'active' : ''} ${lost ? 'lost' : ''}`}
      data-terminal-theme={terminalMode}
      aria-label={`${title} pane`}
    >
      <header className="pane-header">
        <span className="pane-title">{title}</span>
        <span className={`pane-status ${lost ? 'lost' : 'active'}`}>
          {lost ? 'Pane lost' : 'Active'}
        </span>
      </header>
      <div className="ghostty-placeholder" role="img" aria-label="Ghostty terminal renderer">
        <pre>{`$ cd ${cwd}
$ moshtty pane attach
${lost ? 'Pane lost - reconnect to restore.' : 'Ghostty renderer placeholder ready.'}

Project -> Tab -> Pane
Remote PTY output will render here.`}</pre>
      </div>
    </section>
  )
}

function SplitNode({
  state,
  node,
  activePaneId,
  terminalMode
}: {
  state: MoshttyState
  node: MoshttyPaneLayoutNode | null
  activePaneId: string | null
  terminalMode: 'light' | 'dark'
}): React.JSX.Element {
  if (!node) {
    return (
      <div className="empty-pane">
        <span>No pane selected</span>
      </div>
    )
  }

  if (node.kind === 'pane') {
    const pane = getPaneById(state, node.paneId)
    return (
      <TerminalPane pane={pane} active={pane?.id === activePaneId} terminalMode={terminalMode} />
    )
  }

  return (
    <div className={`split-layout ${node.axis}`} data-split-axis={node.axis}>
      <SplitNode
        state={state}
        node={node.first}
        activePaneId={activePaneId}
        terminalMode={terminalMode}
      />
      <div
        className="split-handle"
        role="separator"
        aria-orientation={node.axis === 'row' ? 'vertical' : 'horizontal'}
      />
      <SplitNode
        state={state}
        node={node.second}
        activePaneId={activePaneId}
        terminalMode={terminalMode}
      />
    </div>
  )
}

function ProjectDialog({
  mode,
  projectName
}: {
  mode: 'new' | 'existing'
  projectName: string
}): React.JSX.Element {
  return (
    <div className="dialog-backdrop">
      <section
        className="dialog project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
      >
        <header className="dialog-header">
          <h2 id="project-dialog-title">{mode === 'new' ? 'New project' : 'Edit project'}</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Close project dialog"
            data-action-id="close-dialog"
            title={actionTitle('close-dialog')}
          >
            <XIcon />
          </button>
        </header>
        <label className="field">
          <span>Name</span>
          <input defaultValue={mode === 'new' ? '' : projectName} placeholder="Remote dev" />
        </label>
        <div className="project-chip-editor">
          <div className="large-chip">{projectName.charAt(0).toUpperCase() || 'M'}</div>
          <div>
            <span className="field-label">Project color</span>
            <div className="swatch-row" aria-label="Project color choices">
              <button
                className="swatch active"
                type="button"
                aria-label="Use accent color"
                data-action-id="choose-project-color"
              />
              <button
                className="swatch muted"
                type="button"
                aria-label="Use muted color"
                data-action-id="choose-project-color"
              />
              <button
                className="swatch warm"
                type="button"
                aria-label="Use warning color"
                data-action-id="choose-project-color"
              />
            </div>
          </div>
        </div>
        <footer className="dialog-actions">
          <button
            className="button secondary"
            type="button"
            data-action-id="cancel-dialog"
            title={actionTitle('cancel-dialog')}
          >
            Cancel
          </button>
          <button
            className="button primary"
            type="button"
            data-action-id="confirm-dialog"
            title={actionTitle('confirm-dialog')}
          >
            Save
          </button>
        </footer>
      </section>
    </div>
  )
}

function ImportDialog({ mode }: { mode: 'empty' | 'valid' | 'invalid' }): React.JSX.Element {
  const invalid = mode === 'invalid'
  const validProfile = `{
  "label": "Mac mini",
  "host": "macmini.local",
  "platform": "macos"
}`

  return (
    <div className="dialog-backdrop">
      <section
        className="dialog import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
      >
        <header className="dialog-header">
          <h2 id="import-dialog-title">Import remote</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Close import dialog"
            data-action-id="close-dialog"
            title={actionTitle('close-dialog')}
          >
            <XIcon />
          </button>
        </header>
        <label className="field">
          <span>Profile JSON</span>
          <textarea
            defaultValue={invalid ? '{ "host": ' : mode === 'valid' ? validProfile : ''}
            placeholder="Paste profile JSON"
            aria-invalid={invalid}
          />
        </label>
        {invalid ? (
          <p className="error-text">
            Could not import profile. Check that the JSON is valid and try again.
          </p>
        ) : null}
        <footer className="dialog-actions">
          <button
            className="button secondary"
            type="button"
            data-action-id="cancel-dialog"
            title={actionTitle('cancel-dialog')}
          >
            Cancel
          </button>
          <button
            className="button primary"
            type="button"
            data-action-id="confirm-dialog"
            title={actionTitle('confirm-dialog')}
          >
            Import
          </button>
        </footer>
      </section>
    </div>
  )
}

function SettingsDialog({ terminalMode }: { terminalMode: string }): React.JSX.Element {
  const shortcutActions = getShortcutActions()
  const mouseOnlyActions = APP_ACTIONS.filter((action) => action.mouseOnly)

  return (
    <div className="dialog-backdrop">
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <aside className="settings-nav" aria-label="Settings sections">
          <span className="settings-section">Desktop</span>
          <button
            className="settings-tab active"
            type="button"
            data-action-id="show-general-settings"
          >
            <GearIcon />
            General
          </button>
          <button className="settings-tab" type="button" data-action-id="show-shortcuts-settings">
            <KeyboardIcon />
            Shortcuts
          </button>
        </aside>
        <div className="settings-panel">
          <header className="dialog-header">
            <h2 id="settings-title">Terminal settings</h2>
            <button
              className="icon-button"
              type="button"
              aria-label="Close settings"
              data-action-id="close-dialog"
              title={actionTitle('close-dialog')}
            >
              <XIcon />
            </button>
          </header>
          <div className="settings-list">
            <div className="settings-row">
              <div>
                <strong>App theme</strong>
                <span>Light, dark, or system</span>
              </div>
              <span>System</span>
            </div>
            <div className="settings-row">
              <div>
                <strong>Terminal palette</strong>
                <span>Current mode: {terminalMode}</span>
              </div>
              <span>Follow app</span>
            </div>
            <div className="settings-row">
              <div>
                <strong>Font size</strong>
                <span>Compact terminal density</span>
              </div>
              <span>14</span>
            </div>
            <div className="settings-row">
              <div>
                <strong>Cursor</strong>
                <span>Block cursor</span>
              </div>
              <span>Block</span>
            </div>
            <div className="settings-row shortcuts-row">
              <div>
                <strong>Keyboard shortcuts</strong>
                <span>Registered app actions</span>
              </div>
              <div className="shortcut-list">
                {shortcutActions.map((action) => (
                  <span key={action.id}>
                    {action.label}
                    <kbd>{formatShortcut(action.shortcut)}</kbd>
                  </span>
                ))}
              </div>
            </div>
            <div className="settings-row shortcuts-row">
              <div>
                <strong>Pointer-only actions</strong>
                <span>Documented exceptions</span>
              </div>
              <div className="shortcut-list">
                {mouseOnlyActions.map((action) => (
                  <span key={action.id}>{action.label}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function App(): React.JSX.Element {
  const fixtureId = getFixtureId()
  const fixture = fixtureId ? getFixture(fixtureId) : undefined
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

  const state = fixture?.state ?? snapshot?.state ?? null
  const projects = state?.projects ?? EMPTY_PROJECTS
  const remotes = state?.remotes ?? EMPTY_REMOTES
  const activeProject = state ? getActiveProject(state) : null
  const activeTab = state ? getActiveTab(state) : null
  const activeLayout = state?.layouts.find((layout) => layout.tabId === activeTab?.id) ?? null
  const railCollapsed = Boolean(state?.settings.projectRailCollapsed)
  const resolvedTheme = useResolvedThemeMode(state?.settings.themeMode ?? 'system')
  const terminalMode = resolveTerminalThemeMode(
    state?.settings.terminalTheme ?? 'follow-app',
    resolvedTheme
  )
  const remote = remotes.find((entry) => entry.id === activeProject?.remoteId) ?? remotes[0]
  const remoteStatus = getRemoteStatusLabel(remote?.status)
  const dashboardMode = !activeTab || fixtureId?.startsWith('dashboard')

  useEffect(() => {
    if (!fixture) {
      void hydrate()
    }
  }, [fixture, hydrate])

  const shortcutHandlers = useMemo<AppActionHandlerMap>(
    () => ({
      'toggle-project-rail': () => undefined,
      'show-projects': () => undefined,
      'new-project': () => void addProject('New project'),
      'import-remote': () => undefined,
      'open-settings': () => undefined,
      'open-help': () => undefined,
      'new-tab': () => undefined,
      'save-state': () => void saveWorkspace(),
      'reset-state': () => void resetWorkspace(),
      'add-project': () => void addProject('New project'),
      'close-dialog': () => undefined,
      'cancel-dialog': () => undefined,
      'confirm-dialog': () => undefined
    }),
    [addProject, resetWorkspace, saveWorkspace]
  )
  useRegisteredShortcuts(shortcutHandlers)

  const tabs = activeProject
    ? (state?.tabs.filter((tab) => activeProject.tabIds.includes(tab.id)) ?? [])
    : []

  return (
    <div
      className={`moshtty-app ${railCollapsed ? 'rail-collapsed' : ''} ${
        fixtureId === 'tab-bar-dragging' ? 'tab-dragging' : ''
      }`}
    >
      {fixture ? <FixtureBanner fixtureId={fixture.id} fixtureLabel={fixture.label} /> : null}
      <aside className="project-rail" aria-label="Projects">
        <div className="brand">
          <span className="brand-badge">BETA</span>
          <button
            className="icon-button"
            type="button"
            aria-label="Toggle project rail"
            data-action-id="toggle-project-rail"
            title={actionTitle('toggle-project-rail')}
          >
            <HamburgerIcon />
          </button>
          <button
            className="icon-button selected"
            type="button"
            aria-label="Show projects"
            data-action-id="show-projects"
            title={actionTitle('show-projects')}
          >
            <GridIcon />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="New project"
            data-action-id="new-project"
            title={actionTitle('new-project')}
          >
            <PlusIcon />
          </button>
        </div>

        <div className="rail-content">
          <div className="rail-heading">
            <span>Projects</span>
            <button
              className="icon-button"
              type="button"
              aria-label="Import remote"
              data-action-id="import-remote"
              title={actionTitle('import-remote')}
            >
              <FolderPlusIcon />
            </button>
          </div>

          <div className="project-list">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={`project-item ${activeProject?.id === project.id ? 'active' : ''}`}
                data-action-id="select-project"
                onClick={() => void setActiveProject(project.id)}
              >
                <span className="project-chip">{projectDisplayInitial(project)}</span>
                <span className="project-label">{project.name}</span>
              </button>
            ))}
            {projects.length === 0 ? <p className="empty-copy">No projects</p> : null}
          </div>

          <nav className="rail-links" aria-label="Application">
            <button
              className="rail-link"
              type="button"
              data-action-id="open-settings"
              title={actionTitle('open-settings')}
            >
              <GearIcon />
              Settings
            </button>
            <button
              className="rail-link"
              type="button"
              data-action-id="open-help"
              title={actionTitle('open-help')}
            >
              <HelpIcon />
              Help
            </button>
          </nav>
        </div>
      </aside>

      <main className="workspace">
        <header className="top-bar">
          <div className="tabs" role="tablist" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`tab ${tab.id === activeTab?.id ? 'active' : ''}`}
                role="tab"
                aria-selected={tab.id === activeTab?.id}
              >
                <span className="tab-title">{tab.title}</span>
              </button>
            ))}
          </div>
          <div className="top-actions">
            <button
              className="button subtle"
              type="button"
              data-action-id="new-tab"
              title={actionTitle('new-tab')}
            >
              <EditIcon />
              New tab
            </button>
            <span className={`connection-status ${remote?.status ?? 'offline'}`}>
              {remoteStatus}
            </span>
          </div>
        </header>

        {dashboardMode ? (
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
        ) : state ? (
          <section className="terminal-workspace" aria-label="Terminal panes">
            <SplitNode
              state={state}
              node={activeLayout?.root ?? null}
              activePaneId={state?.activePaneId ?? null}
              terminalMode={terminalMode}
            />
          </section>
        ) : (
          <section className="terminal-workspace" aria-label="Terminal panes">
            <div className="empty-pane">
              <span>Loading workspace</span>
            </div>
          </section>
        )}

        {!fixture && !loading ? (
          <section className="state-panel" aria-label="State controls">
            <div>
              <strong>State</strong>
              <span>{snapshot?.source ?? 'not loaded'}</span>
            </div>
            {error ? <p>{error}</p> : null}
            <div className="state-actions">
              <button
                className="button secondary"
                type="button"
                disabled={!hydrated || saving}
                data-action-id="save-state"
                title={actionTitle('save-state')}
                onClick={() => void saveWorkspace()}
              >
                {saving ? 'Saving' : 'Save'}
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={!hydrated || saving}
                data-action-id="reset-state"
                title={actionTitle('reset-state')}
                onClick={() => void resetWorkspace()}
              >
                Reset
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={!hydrated || saving}
                data-action-id="add-project"
                title={actionTitle('add-project')}
                onClick={() => void addProject('New project')}
              >
                Add project
              </button>
            </div>
          </section>
        ) : null}

        {fixtureId === 'dialog-import-empty' ? <ImportDialog mode="empty" /> : null}
        {fixtureId === 'dialog-import-valid' ? <ImportDialog mode="valid" /> : null}
        {fixtureId === 'dialog-import-invalid' ? <ImportDialog mode="invalid" /> : null}
        {fixtureId === 'dialog-project-edit-new' ? (
          <ProjectDialog mode="new" projectName="Moshtty" />
        ) : null}
        {fixtureId === 'dialog-project-edit' ? (
          <ProjectDialog mode="existing" projectName={activeProject?.name ?? 'Moshtty'} />
        ) : null}
        {fixtureId?.startsWith('dialog-terminal-settings') ? (
          <SettingsDialog terminalMode={terminalMode} />
        ) : null}
      </main>
    </div>
  )
}

export default App
