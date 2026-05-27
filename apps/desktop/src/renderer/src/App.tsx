import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getActiveProject,
  getActiveTab,
  type MoshttyPane,
  type MoshttyPaneLayoutNode,
  type MoshttyRemote,
  type MoshttyState,
  type SplitAxis
} from '../../common/state'
import { TerminalPane } from './components/TerminalPane'
import { getFixtureDialog, type AppDialog } from './dialogs'
import { resolveTerminalThemeMode, useResolvedThemeMode } from './design/theme'
import { FixtureBanner } from './fixtures/FixtureBanner'
import { getFixture } from './fixtures/states'
import { loadFixtureFromQuery } from './fixtures/loader'
import {
  formatShortcut,
  getAction,
  useRegisteredShortcuts,
  type AppActionId,
  type AppActionHandlerMap
} from './keymap'
import { useAppStore } from './store'
import { MoshttyTransport } from './transport/moshtty-transport'
import { MoshConnectionManager } from './mosh-connection-manager'
import { buildRemoteWebTransportUrl } from './remote-url'

// New modular components
import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { Dialogs } from './components/Dialogs'

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

function SplitNode({
  state,
  node,
  activePaneId,
  terminalMode,
  onSplit,
  onClosePane,
  transport,
  connectionManager
}: {
  state: MoshttyState
  node: MoshttyPaneLayoutNode | null
  activePaneId: string | null
  terminalMode: 'light' | 'dark'
  onSplit: (axis: SplitAxis) => void
  onClosePane: () => void
  transport?: MoshttyTransport | null
  connectionManager?: MoshConnectionManager | null
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
    if (!pane) {
      return (
        <div className="empty-pane">
          <span>Pane not found</span>
        </div>
      )
    }
    const isActive = pane.id === state.activePaneId
    return (
      <TerminalPane
        pane={pane}
        active={isActive}
        terminalMode={terminalMode}
        onSplit={isActive ? onSplit : undefined}
        onClose={isActive ? onClosePane : undefined}
        transport={transport}
        connectionManager={connectionManager}
      />
    )
  }

  return (
    <div className={`split-layout ${node.axis}`} data-split-axis={node.axis}>
      <SplitNode
        state={state}
        node={node.first}
        activePaneId={activePaneId}
        terminalMode={terminalMode}
        onSplit={onSplit}
        onClosePane={onClosePane}
        transport={transport}
        connectionManager={connectionManager}
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
        onSplit={onSplit}
        onClosePane={onClosePane}
        transport={transport}
        connectionManager={connectionManager}
      />
    </div>
  )
}

function App(): React.JSX.Element {
  const fixtureId = getFixtureId()
  const fixture = fixtureId ? getFixture(fixtureId) : undefined
  const [activeDialog, setActiveDialog] = useState<AppDialog | null>(null)
  const snapshot = useAppStore((state) => state.snapshot)
  const hydrate = useAppStore((state) => state.hydrate)
  const saveWorkspace = useAppStore((state) => state.saveWorkspace)
  const resetWorkspace = useAppStore((state) => state.resetWorkspace)
  const addTab = useAppStore((state) => state.addTab)
  const toggleProjectRail = useAppStore((state) => state.toggleProjectRail)
  const splitPane = useAppStore((state) => state.splitPane)
  const closeActivePane = useAppStore((state) => state.closeActivePane)
  const closeActiveTab = useAppStore((state) => state.closeActiveTab)
  const updateRemoteCertHashes = useAppStore((state) => state.updateRemoteCertHashes)

  const [transport, setTransport] = useState<MoshttyTransport | null>(null)
  const [connectionManager, setConnectionManager] = useState<MoshConnectionManager | null>(null)
  const [liveStatus, setLiveStatus] = useState<MoshttyRemote['status'] | null>(null)

  const state = fixture?.state ?? snapshot?.state ?? null
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
  const remoteStatus = liveStatus
    ? getRemoteStatusLabel(liveStatus)
    : getRemoteStatusLabel(remote?.status)
  const dashboardMode = !activeTab || fixtureId?.startsWith('dashboard')
  const fixtureDialog = getFixtureDialog(fixtureId)
  const visibleDialog = fixtureDialog ?? activeDialog
  const closeDialog = useCallback((): void => setActiveDialog(null), [setActiveDialog])
  const openDialog = useCallback(
    (dialog: AppDialog): void => setActiveDialog(dialog),
    [setActiveDialog]
  )

  useEffect(() => {
    if (!fixture) {
      void hydrate()
    }
  }, [fixture, hydrate])

  useEffect(() => {
    if (fixture) return

    let active = true
    let currentTransport: MoshttyTransport | null = null
    let currentManager: MoshConnectionManager | null = null

    async function connectRemote(): Promise<void> {
      if (!remote || !remote.url) {
        setLiveStatus(null)
        setTransport(null)
        setConnectionManager(null)
        return
      }

      setLiveStatus('connecting')

      try {
        const token = (await window.moshtty.loadToken(remote.tokenLabel)) || ''
        if (!active) return

        const tx = new MoshttyTransport()
        currentTransport = tx

        const certHashes: string[] = []
        if (remote.currentCertHash) {
          certHashes.push(remote.currentCertHash)
        }
        if (remote.nextCertHash) {
          certHashes.push(remote.nextCertHash)
        }

        await tx.connect({
          url: buildRemoteWebTransportUrl(remote.url, token),
          token,
          certHashes
        })

        if (!active) {
          void tx.close()
          return
        }

        const health = await tx.call<{
          currentCertHash?: string | null
          nextCertHash?: string | null
        }>('health')

        if (!active) {
          void tx.close()
          return
        }

        const healthCurrent = health.currentCertHash ?? ''
        const healthNext = health.nextCertHash ?? ''
        const remoteCurrent = remote.currentCertHash ?? ''
        const remoteNext = remote.nextCertHash ?? ''

        if (healthCurrent !== remoteCurrent || healthNext !== remoteNext) {
          await updateRemoteCertHashes(remote.id, healthCurrent, healthNext)
        }

        const manager = new MoshConnectionManager(tx)
        currentManager = manager
        tx.setRequestHandler(async (request) => {
          if (request.method === 'app.pane.split') {
            const params = request.params as { axis?: SplitAxis } | undefined
            window.setTimeout(() => {
              void splitPane(params?.axis === 'column' ? 'column' : 'row')
            }, 0)
            return { ok: true }
          }
          throw new Error(`unsupported app request: ${request.method}`)
        })

        setTransport(tx)
        setConnectionManager(manager)
        setLiveStatus('connected')
      } catch (err) {
        console.error('Failed to connect to remote companion:', err)
        if (active) {
          setLiveStatus('offline')
          setTransport(null)
          setConnectionManager(null)
        }
      }
    }

    void connectRemote()

    return () => {
      active = false
      if (currentManager) {
        currentManager.stop()
      }
      if (currentTransport) {
        void currentTransport.close()
      }
    }
  }, [remote, fixture, splitPane, updateRemoteCertHashes])

  const shortcutHandlers = useMemo<AppActionHandlerMap>(
    () => ({
      'toggle-project-rail': () => void toggleProjectRail(),
      'show-projects': () => undefined,
      'new-project': () => openDialog({ kind: 'project', mode: 'new' }),
      'import-remote': () => openDialog({ kind: 'import', mode: 'empty' }),
      'open-settings': () => openDialog({ kind: 'settings' }),
      'open-help': () => undefined,
      'new-tab': () => void addTab('Shell'),
      'save-state': () => void saveWorkspace(),
      'reset-state': () => void resetWorkspace(),
      'add-project': () => openDialog({ kind: 'project', mode: 'new' }),
      'close-dialog': closeDialog,
      'cancel-dialog': closeDialog,
      'confirm-dialog': () => undefined,
      'split-pane-right': () => void splitPane('row'),
      'split-pane-down': () => void splitPane('column'),
      'close-pane': () => void closeActivePane(),
      'close-tab': () => void closeActiveTab()
    }),
    [
      addTab,
      closeDialog,
      closeActivePane,
      closeActiveTab,
      openDialog,
      resetWorkspace,
      saveWorkspace,
      splitPane,
      toggleProjectRail
    ]
  )
  useRegisteredShortcuts(shortcutHandlers)

  return (
    <div
      className={`moshtty-app ${railCollapsed ? 'rail-collapsed' : ''} ${
        fixtureId === 'tab-bar-dragging' ? 'tab-dragging' : ''
      }`}
    >
      {fixture && <FixtureBanner fixtureId={fixture.id} fixtureLabel={fixture.label} />}

      <TopBar state={state} liveStatus={liveStatus} remoteStatus={remoteStatus} remote={remote} />

      <div className="moshtty-body">
        <Sidebar state={state} openDialog={openDialog} actionTitle={actionTitle} />

        <main className="workspace">
          {dashboardMode ? (
            <Dashboard state={state} actionTitle={actionTitle} />
          ) : state ? (
            <section className="terminal-workspace" aria-label="Terminal panes">
              <SplitNode
                state={state}
                node={activeLayout?.root ?? null}
                activePaneId={state?.activePaneId ?? null}
                terminalMode={terminalMode}
                onSplit={(axis): void => {
                  splitPane(axis).catch(console.error)
                }}
                onClosePane={(): void => {
                  closeActivePane().catch(console.error)
                }}
                transport={transport}
                connectionManager={connectionManager}
              />
            </section>
          ) : (
            <section className="terminal-workspace" aria-label="Terminal panes">
              <div className="empty-pane">
                <span>Loading workspace</span>
              </div>
            </section>
          )}
        </main>
      </div>

      <Dialogs
        state={state}
        secretMode={snapshot?.secretInfo?.mode ?? null}
        visibleDialog={visibleDialog}
        closeDialog={closeDialog}
        actionTitle={actionTitle}
        terminalMode={terminalMode}
      />
    </div>
  )
}

export default App
