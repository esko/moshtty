/**
 * Hand-rolled normalizers/migrators for `MoshttyState`.
 *
 * The strict trust boundary lives in `./state.schema.ts` (zod). The
 * normalizers here are intentionally permissive so we can heal legacy
 * disk payloads; the zod schema is what runs at IPC boundaries and
 * before persistence.
 *
 * Editing either this file or `state.schema.ts` requires the other to be
 * updated in the same slice. The TypeScript contract assertion in
 * `state.schema.ts` will fail the build if they drift.
 */
export const MOSHTTY_STATE_VERSION = 1 as const

export type ThemeMode = 'system' | 'light' | 'dark'
export type TerminalThemeMode = 'follow-app' | 'light' | 'dark'
export type RemoteStatus = 'offline' | 'connecting' | 'connected' | 'lost'
export type PaneStatus = 'active' | 'lost'
export type RemotePlatform = 'macos' | 'linux' | 'unknown'

export interface MoshttySettings {
  themeMode: ThemeMode
  terminalTheme: TerminalThemeMode
  fontSize: number
  projectRailCollapsed: boolean
}

export interface MoshttyRemote {
  id: string
  label: string
  host: string
  platform: RemotePlatform
  status: RemoteStatus
  url: string
  tokenLabel: string
  currentCertHash: string | null
  nextCertHash: string | null
}

export interface MoshttyProject {
  id: string
  name: string
  color: string
  remoteId: string | null
  tabIds: string[]
  activeTabId: string | null
}

export interface MoshttyTab {
  id: string
  title: string
  paneIds: string[]
  activePaneId: string | null
}

export interface MoshttyPane {
  id: string
  title: string
  cwd: string
  status: PaneStatus
  cols: number
  rows: number
  remoteFlowId?: number
}

export type SplitAxis = 'row' | 'column'

export interface MoshttyPaneLayoutLeaf {
  kind: 'pane'
  paneId: string
}

export interface MoshttyPaneLayoutSplit {
  kind: 'split'
  axis: SplitAxis
  ratio: number
  first: MoshttyPaneLayoutNode
  second: MoshttyPaneLayoutNode
}

export type MoshttyPaneLayoutNode = MoshttyPaneLayoutLeaf | MoshttyPaneLayoutSplit

export interface MoshttyTabLayout {
  tabId: string
  root: MoshttyPaneLayoutNode | null
}

export interface MoshttyState {
  version: typeof MOSHTTY_STATE_VERSION
  updatedAt: string
  activeProjectId: string | null
  activeTabId: string | null
  activePaneId: string | null
  remotes: MoshttyRemote[]
  projects: MoshttyProject[]
  tabs: MoshttyTab[]
  panes: MoshttyPane[]
  layouts: MoshttyTabLayout[]
  settings: MoshttySettings
}

export interface StateLoadResult {
  state: MoshttyState
  source: 'disk' | 'default' | 'recovered' | 'migrated'
  warning?: string
  migratedFrom?: number
}

export interface StateMigrationResult {
  state: MoshttyState
  migratedFrom?: number
  warning?: string
}

function isoNow(now: string | Date = new Date()): string {
  return typeof now === 'string' ? now : now.toISOString()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function asPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function normalizeThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'system'
}

function normalizeTerminalThemeMode(value: unknown): TerminalThemeMode {
  return value === 'light' || value === 'dark' ? value : 'follow-app'
}

function normalizeRemoteStatus(value: unknown): RemoteStatus {
  return value === 'connecting' || value === 'connected' || value === 'lost' ? value : 'offline'
}

function normalizePaneStatus(value: unknown): PaneStatus {
  return value === 'lost' ? value : 'active'
}

function normalizeRemotePlatform(value: unknown): RemotePlatform {
  return value === 'macos' || value === 'linux' ? value : 'unknown'
}

function normalizeRemote(value: unknown): MoshttyRemote | null {
  if (!isRecord(value)) {
    return null
  }

  const id = asString(value.id, '')
  const label = asString(value.label, '')
  if (!id || !label) {
    return null
  }

  return {
    id,
    label,
    host: asString(value.host, 'localhost'),
    platform: normalizeRemotePlatform(value.platform),
    status: normalizeRemoteStatus(value.status),
    url: asString(value.url, 'https://localhost:4433'),
    tokenLabel: asString(value.tokenLabel, 'default'),
    currentCertHash: asNullableString(value.currentCertHash),
    nextCertHash: asNullableString(value.nextCertHash)
  }
}

function normalizeProject(value: unknown): MoshttyProject | null {
  if (!isRecord(value)) {
    return null
  }

  const id = asString(value.id, '')
  const name = asString(value.name, '')
  const color = asString(value.color, '#64646c')
  if (!id || !name) {
    return null
  }

  return {
    id,
    name,
    color,
    remoteId: asNullableString(value.remoteId),
    tabIds: Array.isArray(value.tabIds)
      ? value.tabIds.filter(
          (tabId): tabId is string => typeof tabId === 'string' && tabId.length > 0
        )
      : [],
    activeTabId: asNullableString(value.activeTabId)
  }
}

function normalizeTab(value: unknown): MoshttyTab | null {
  if (!isRecord(value)) {
    return null
  }

  const id = asString(value.id, '')
  const title = asString(value.title, '')
  if (!id || !title) {
    return null
  }

  return {
    id,
    title,
    paneIds: Array.isArray(value.paneIds)
      ? value.paneIds.filter(
          (paneId): paneId is string => typeof paneId === 'string' && paneId.length > 0
        )
      : [],
    activePaneId: asNullableString(value.activePaneId)
  }
}

function normalizeSplitAxis(value: unknown): SplitAxis {
  return value === 'column' ? value : 'row'
}

function normalizeLayoutNode(value: unknown): MoshttyPaneLayoutNode | null {
  if (!isRecord(value)) {
    return null
  }

  if (value.kind === 'pane') {
    const paneId = asString(value.paneId, '')
    return paneId ? { kind: 'pane', paneId } : null
  }

  if (value.kind === 'split') {
    const first = normalizeLayoutNode(value.first)
    const second = normalizeLayoutNode(value.second)
    if (!first || !second) {
      return null
    }

    const ratio =
      typeof value.ratio === 'number' && Number.isFinite(value.ratio)
        ? Math.min(1, Math.max(0.05, value.ratio))
        : 0.5

    return {
      kind: 'split',
      axis: normalizeSplitAxis(value.axis),
      ratio,
      first,
      second
    }
  }

  return null
}

function normalizeLayout(value: unknown): MoshttyTabLayout | null {
  if (!isRecord(value)) {
    return null
  }

  const tabId = asString(value.tabId, '')
  if (!tabId) {
    return null
  }

  const root = value.root === null ? null : normalizeLayoutNode(value.root)

  return {
    tabId,
    root: root ?? null
  }
}

function normalizePane(value: unknown): MoshttyPane | null {
  if (!isRecord(value)) {
    return null
  }

  const id = asString(value.id, '')
  const title = asString(value.title, '')
  if (!id || !title) {
    return null
  }

  return {
    id,
    title,
    cwd: asString(value.cwd, '~'),
    status: normalizePaneStatus(value.status),
    cols: asPositiveNumber(value.cols, 120),
    rows: asPositiveNumber(value.rows, 32),
    remoteFlowId: asPositiveNumber(value.remoteFlowId, 0) || undefined
  }
}

function normalizeSettings(value: unknown): MoshttySettings {
  if (!isRecord(value)) {
    return {
      themeMode: 'system',
      terminalTheme: 'follow-app',
      fontSize: 14,
      projectRailCollapsed: false
    }
  }

  return {
    themeMode: normalizeThemeMode(value.themeMode),
    terminalTheme: normalizeTerminalThemeMode(value.terminalTheme),
    fontSize: asPositiveNumber(value.fontSize, 14),
    projectRailCollapsed: Boolean(value.projectRailCollapsed)
  }
}

export function createEmptyState(now: string | Date = new Date()): MoshttyState {
  const updatedAt = isoNow(now)
  return {
    version: MOSHTTY_STATE_VERSION,
    updatedAt,
    activeProjectId: null,
    activeTabId: null,
    activePaneId: null,
    remotes: [],
    projects: [],
    tabs: [],
    panes: [],
    layouts: [],
    settings: {
      themeMode: 'system',
      terminalTheme: 'follow-app',
      fontSize: 14,
      projectRailCollapsed: false
    }
  }
}

export function createSampleState(now: string | Date = new Date()): MoshttyState {
  const updatedAt = isoNow(now)
  return {
    version: MOSHTTY_STATE_VERSION,
    updatedAt,
    activeProjectId: 'project-welcome',
    activeTabId: 'tab-welcome',
    activePaneId: 'pane-welcome',
    remotes: [
      {
        id: 'remote-placeholder',
        label: 'Remote companion not connected',
        host: 'localhost',
        platform: 'unknown',
        status: 'offline',
        url: 'https://localhost:4433',
        tokenLabel: 'placeholder',
        currentCertHash: null,
        nextCertHash: null
      }
    ],
    projects: [
      {
        id: 'project-welcome',
        name: 'Welcome',
        color: '#64646c',
        remoteId: 'remote-placeholder',
        tabIds: ['tab-welcome'],
        activeTabId: 'tab-welcome'
      }
    ],
    tabs: [
      {
        id: 'tab-welcome',
        title: 'Getting started',
        paneIds: ['pane-welcome'],
        activePaneId: 'pane-welcome'
      }
    ],
    panes: [
      {
        id: 'pane-welcome',
        title: 'No remote connected',
        cwd: '~',
        status: 'active',
        cols: 120,
        rows: 32
      }
    ],
    layouts: [
      {
        tabId: 'tab-welcome',
        root: {
          kind: 'pane',
          paneId: 'pane-welcome'
        }
      }
    ],
    settings: {
      themeMode: 'system',
      terminalTheme: 'follow-app',
      fontSize: 14,
      projectRailCollapsed: false
    }
  }
}

function inferLayoutsFromTabs(tabs: MoshttyTab[]): MoshttyTabLayout[] {
  return tabs.map((tab) => {
    const firstPaneId = tab.paneIds[0]
    return {
      tabId: tab.id,
      root: firstPaneId
        ? {
            kind: 'pane',
            paneId: firstPaneId
          }
        : null
    }
  })
}

export function migrateState(
  input: unknown,
  now: string | Date = new Date()
): StateMigrationResult {
  if (!isRecord(input)) {
    return { state: createEmptyState(now), warning: 'State payload was not an object' }
  }

  const version = input.version
  if (version === MOSHTTY_STATE_VERSION) {
    return { state: normalizeState(input, now) }
  }

  if (version === undefined) {
    const migratedInput = {
      ...input,
      version: MOSHTTY_STATE_VERSION,
      layouts: Array.isArray(input.layouts) ? input.layouts : undefined
    }
    const tabs = Array.isArray(input.tabs) ? input.tabs : []
    if (!Array.isArray(migratedInput.layouts) && tabs.length > 0) {
      migratedInput.layouts = tabs
        .map((tab) => {
          if (!isRecord(tab)) {
            return null
          }
          const tabId = asString(tab.id, '')
          const paneIds = Array.isArray(tab.paneIds)
            ? tab.paneIds.filter(
                (paneId): paneId is string => typeof paneId === 'string' && paneId.length > 0
              )
            : []
          if (!tabId || paneIds.length === 0) {
            return null
          }
          return {
            tabId,
            root: {
              kind: 'pane',
              paneId: paneIds[0]
            }
          }
        })
        .filter((layout) => layout !== null) as MoshttyTabLayout[]
    }

    return {
      state: normalizeState(migratedInput, now),
      migratedFrom: 0
    }
  }

  return {
    state: createEmptyState(now),
    warning: `Unsupported state version ${String(version)}`
  }
}

export function normalizeState(input: unknown, now: string | Date = new Date()): MoshttyState {
  if (!isRecord(input) || input.version !== MOSHTTY_STATE_VERSION) {
    return createEmptyState(now)
  }

  const remotes = Array.isArray(input.remotes)
    ? input.remotes
        .map(normalizeRemote)
        .filter((remote): remote is MoshttyRemote => remote !== null)
    : []
  const projects = Array.isArray(input.projects)
    ? input.projects
        .map(normalizeProject)
        .filter((project): project is MoshttyProject => project !== null)
    : []
  const tabs = Array.isArray(input.tabs)
    ? input.tabs.map(normalizeTab).filter((tab): tab is MoshttyTab => tab !== null)
    : []
  const panes = Array.isArray(input.panes)
    ? input.panes.map(normalizePane).filter((pane): pane is MoshttyPane => pane !== null)
    : []
  const layouts = Array.isArray(input.layouts)
    ? input.layouts
        .map(normalizeLayout)
        .filter(
          (layout): layout is NonNullable<ReturnType<typeof normalizeLayout>> => layout !== null
        )
    : inferLayoutsFromTabs(tabs)

  return {
    version: MOSHTTY_STATE_VERSION,
    updatedAt: asString(input.updatedAt, isoNow(now)),
    activeProjectId: asNullableString(input.activeProjectId),
    activeTabId: asNullableString(input.activeTabId),
    activePaneId: asNullableString(input.activePaneId),
    remotes,
    projects,
    tabs,
    panes,
    layouts,
    settings: normalizeSettings(input.settings)
  }
}

export function projectDisplayInitial(project: MoshttyProject): string {
  return project.name.trim().charAt(0).toUpperCase() || 'M'
}

export function getActiveProject(state: MoshttyState): MoshttyProject | null {
  return state.projects.find((project) => project.id === state.activeProjectId) ?? null
}

export function getActiveTab(state: MoshttyState): MoshttyTab | null {
  return state.tabs.find((tab) => tab.id === state.activeTabId) ?? null
}

export function getActivePane(state: MoshttyState): MoshttyPane | null {
  return state.panes.find((pane) => pane.id === state.activePaneId) ?? null
}

export function hasWorkspaceContent(state: MoshttyState): boolean {
  return state.projects.length > 0 || state.tabs.length > 0 || state.panes.length > 0
}

export function nextStateTimestamp(now: string | Date = new Date()): string {
  return isoNow(now)
}
