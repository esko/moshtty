import { FitAddon, Terminal, init } from "ghostty-web";
import { getAgentToken, getJSON, patchJSON, postJSON, ptyURL } from "./api";
import { concatBytes, escapeAttribute, escapeHTML, formatNumber, pathBaseName, requiredElement, socketState } from "./dom";
import { applySplitRatio, firstLeaf, layoutLeaves, ratioFromKeyboard, ratioFromPointer, splitRatio } from "./layout";
import {
  applyAppAppearance,
  DEFAULT_SETTINGS,
  loadCustomFont,
  loadSettings,
  normalizeSettings,
  saveSettings,
  terminalFontFamily,
  terminalTheme,
} from "./settings";
import { paneShortcutForEvent, shouldPassThroughSystemShortcut, type PaneShortcut } from "./shortcuts";
import type { AgentMessage, EnvVars, OrphanCleanup, Profile, SessionLayoutNode, Space, TerminalSession, TerminalSettings, Workspace } from "./types";
import "./styles.css";

const APP_TITLE = "Crostini Ghostty";
const DEBUG_SHELL_PARAM = "debug-shell";
const DEFAULT_SPACE_ID = "space-default";
const DEFAULT_PROFILE_ID = "profile-default";

const appRoot = requiredElement<HTMLElement>("#app");
const settingsRoot = requiredElement<HTMLElement>("#settings");
const terminalRoot = requiredElement<HTMLElement>("#terminal");
const statusEl = requiredElement<HTMLElement>("#status");
const offlineEl = requiredElement<HTMLElement>("#offline");
const reconnectButton = requiredElement<HTMLButtonElement>("#reconnect");
const diagnosticsToggle = requiredElement<HTMLButtonElement>("#diagnosticsToggle");
const diagnosticsPanel = requiredElement<HTMLElement>("#diagnostics");
const diagnosticsList = requiredElement<HTMLElement>("#diagnosticsList");
const contextMenu = requiredElement<HTMLElement>("#terminalContextMenu");
const renameDialog = requiredElement<HTMLDialogElement>("#renameDialog");
const renameDialogTitle = requiredElement<HTMLElement>("#renameDialogTitle");
const renameInput = requiredElement<HTMLInputElement>("#renameInput");
const renameResetButton = requiredElement<HTMLButtonElement>("#renameReset");

let settings = loadSettings();
applyAppAppearance(settings);
let currentWorkspace: Workspace | null = null;
let parentSessionId = "";
let activePaneId = "";
let diagnosticsTimer: number | undefined;
let pendingFitFrame: number | undefined;
let activeResize: SplitResizeState | null = null;
let terminalRuntimeReady = false;
let debugShell: DebugShellState | null = null;
let listedSessions: TerminalSession[] = [];
let listedSpaces: Space[] = [];
let listedProfiles: Profile[] = [];
const panes = new Map<string, TerminalPane>();

type SplitNode = Extract<SessionLayoutNode, { type: "split" }>;
type SplitResizeState = {
  pointerId: number;
  node: SplitNode;
  split: HTMLElement;
  divider: HTMLElement;
  first: HTMLElement;
  second: HTMLElement;
};
type DebugShellTab = {
  id: string;
  title: string;
  url: string;
};
type DebugShellState = {
  root: HTMLElement;
  tabs: DebugShellTab[];
  activeTabId: string;
  nextTabNumber: number;
};

void boot();

reconnectButton.addEventListener("click", () => {
  activePane()?.connect(false);
});

diagnosticsToggle.addEventListener("click", () => {
  diagnosticsPanel.hidden = !diagnosticsPanel.hidden;
  updateDiagnosticsTimer();
});

terminalRoot.addEventListener("contextmenu", (event) => {
  const paneEl = (event.target as Element).closest<HTMLElement>("[data-pane-id]");
  if (paneEl?.dataset.paneId) setActivePane(paneEl.dataset.paneId);
  event.preventDefault();
  showContextMenu(event.clientX, event.clientY);
});

document.addEventListener("pointerdown", (event) => {
  if (contextMenu.hidden || contextMenu.contains(event.target as Node)) return;
  hideContextMenu();
});

document.addEventListener(
  "keydown",
  (event) => {
    if (handlePaneShortcut(event)) return;
  },
  { capture: true },
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideContextMenu();
});

document.addEventListener("pointermove", (event) => {
  if (!activeResize || event.pointerId !== activeResize.pointerId) return;
  event.preventDefault();
  resizeSplitFromPointer(activeResize, event.clientX, event.clientY);
});

document.addEventListener("pointerup", (event) => {
  if (!activeResize || event.pointerId !== activeResize.pointerId) return;
  event.preventDefault();
  finishSplitResize(true);
});

document.addEventListener("pointercancel", (event) => {
  if (!activeResize || event.pointerId !== activeResize.pointerId) return;
  finishSplitResize(true);
});

contextMenu.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button[data-action]");
  if (!button) return;
  hideContextMenu();
  void handleContextAction(button.dataset.action ?? "");
});

renameDialog.addEventListener("close", () => {
  if (renameDialog.returnValue !== "save") return;
  const spaceId = renameDialog.dataset.spaceId;
  if (spaceId) {
    void renameSpace(spaceId, renameInput.value);
    return;
  }
  const sessionId = renameDialog.dataset.sessionId;
  if (!sessionId) return;
  void renameSession(sessionId, renameInput.value);
});

renameResetButton.addEventListener("click", () => {
  const sessionId = renameDialog.dataset.sessionId;
  if (!sessionId) return;
  renameDialog.close("cancel");
  void renameSession(sessionId, "");
});

window.addEventListener("resize", scheduleFit);

window.addEventListener("beforeunload", () => {
  if (pendingFitFrame !== undefined) cancelAnimationFrame(pendingFitFrame);
  if (diagnosticsTimer !== undefined) window.clearInterval(diagnosticsTimer);
  window.removeEventListener("resize", scheduleFit);
  finishSplitResize(false);
  disposePanes();
});

class TerminalPane {
  readonly id: string;
  readonly root: HTMLElement;
  term: Terminal;
  fitAddon: FitAddon;
  socket: WebSocket | null = null;
  lastCols = 0;
  lastRows = 0;
  title = "Terminal";
  customTitle = false;
  hasAttached = false;
  private pendingWriteFrame: number | undefined;
  private readonly pendingWrites: Array<string | Uint8Array> = [];
  private pendingWheelFrame: number | undefined;
  private pendingWheelLines = 0;

  constructor(id: string, root: HTMLElement, session: TerminalSession | undefined) {
    this.id = id;
    this.root = root;
    if (session) {
      this.title = sessionTitle(session);
      this.customTitle = Boolean(session.customTitle);
    }
    this.term = createTerminal();
    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.installWheelHandler();
    this.term.onData((data) => this.send({ type: "input", data }));
    this.term.onResize(({ cols, rows }) => {
      this.lastCols = cols;
      this.lastRows = rows;
      this.send({ type: "resize", cols, rows });
      renderDiagnostics();
    });
    this.term.open(root);
    this.fitAddon.fit();
    this.fitAddon.observeResize();
    root.addEventListener("pointerdown", () => setActivePane(id));
  }

  async connect(restore: boolean): Promise<void> {
    this.socket?.close();
    setStatus("connecting", "Connecting");
    offlineEl.hidden = true;
    try {
      const token = await getAgentToken();
      const url = ptyURL(token, this.id, restore && !this.hasAttached, this.lastCols || this.term.cols, this.lastRows || this.term.rows);
      const socket = new WebSocket(url);
      this.socket = socket;
      socket.binaryType = "arraybuffer";
      socket.addEventListener("open", () => {
        this.hasAttached = true;
        this.fitAddon.fit();
        if (this.lastCols > 0 && this.lastRows > 0) {
          this.send({ type: "resize", cols: this.lastCols, rows: this.lastRows });
        }
        if (this.id === activePaneId) {
          setStatus("connected", this.title);
          this.focus();
        }
      });
      socket.addEventListener("message", (event) => this.handleSocketMessage(event.data));
      socket.addEventListener("close", () => {
        if (this.id === activePaneId && statusEl.dataset.state === "connected") {
          setStatus("offline", "Closed");
        }
      });
      socket.addEventListener("error", () => {
        if (this.id === activePaneId) {
          setStatus("offline", "Offline");
          offlineEl.hidden = false;
        }
      });
    } catch (error) {
      console.error(error);
      if (this.id === activePaneId) {
        setStatus("offline", "Offline");
        offlineEl.hidden = false;
      }
    }
  }

  focus(): void {
    this.term.focus();
    setStatus(this.socket?.readyState === WebSocket.OPEN ? "connected" : "connecting", this.title);
    document.title = `${this.title} - ${APP_TITLE}`;
    updateActiveDebugTabTitle(this.title);
    renderDiagnostics();
  }

  fit(): void {
    this.fitAddon.fit();
  }

  dispose(): void {
    if (this.pendingWriteFrame !== undefined) cancelAnimationFrame(this.pendingWriteFrame);
    if (this.pendingWheelFrame !== undefined) cancelAnimationFrame(this.pendingWheelFrame);
    this.socket?.close();
    this.term.dispose();
  }

  private send(message: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }

  private handleSocketMessage(data: string | ArrayBuffer | Blob): void {
    if (typeof data === "string") {
      this.handleAgentText(data);
      return;
    }
    if (data instanceof ArrayBuffer) {
      this.enqueueWrite(new Uint8Array(data));
      return;
    }
    void data.arrayBuffer().then((buffer) => this.enqueueWrite(new Uint8Array(buffer)));
  }

  private handleAgentText(data: string): void {
    try {
      const message = JSON.parse(data) as AgentMessage;
      if (message.type === "status" && message.shell) {
        if (!this.customTitle) this.title = pathBaseName(message.shell);
        if (this.id === activePaneId) this.focus();
      } else if (message.type === "exit") {
        this.enqueueWrite(`\r\n[process exited ${message.code ?? 0}]\r\n`);
        if (this.id === activePaneId) setStatus("offline", "Exited");
      } else if (message.type === "error") {
        this.enqueueWrite(`\r\n[agent error] ${message.message ?? data}\r\n`);
      }
    } catch {
      this.enqueueWrite(data);
    }
  }

  private enqueueWrite(data: string | Uint8Array): void {
    this.pendingWrites.push(data);
    if (this.pendingWriteFrame !== undefined) return;
    this.pendingWriteFrame = requestAnimationFrame(() => this.flushWrites());
  }

  private flushWrites(): void {
    this.pendingWriteFrame = undefined;
    if (this.pendingWrites.length === 0) return;
    const writes = this.pendingWrites.splice(0);
    let text = "";
    let bytes: Uint8Array[] = [];
    for (const write of writes) {
      if (typeof write === "string") {
        if (bytes.length > 0) {
          this.term.write(concatBytes(bytes));
          bytes = [];
        }
        text += write;
      } else {
        if (text) {
          this.term.write(text);
          text = "";
        }
        bytes.push(write);
      }
    }
    if (text) this.term.write(text);
    if (bytes.length > 0) this.term.write(concatBytes(bytes));
  }

  private installWheelHandler(): void {
    this.term.attachCustomWheelEventHandler((event) => {
      if (this.term.wasmTerm?.isAlternateScreen()) return false;
      const lineHeight = this.term.renderer?.getMetrics().height ?? 20;
      let deltaLines: number;
      if (event.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
        deltaLines = (event.deltaY / lineHeight) * settings.scrollSensitivity;
      } else if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        deltaLines = event.deltaY;
      } else {
        deltaLines = event.deltaY * this.term.rows;
      }
      this.pendingWheelLines += deltaLines;
      if (this.pendingWheelFrame === undefined) {
        this.pendingWheelFrame = requestAnimationFrame(() => {
          this.pendingWheelFrame = undefined;
          const lines = this.pendingWheelLines;
          this.pendingWheelLines = 0;
          if (lines !== 0) this.term.scrollLines(lines);
        });
      }
      return true;
    });
  }
}

async function boot(): Promise<void> {
  await registerServiceWorker();

  if (isDebugShellEnabled()) {
    installDebugShell();
  }

  await renderCurrentRoute();
  updateDiagnosticsTimer();
}

async function renderCurrentRoute(): Promise<void> {
  if (isSettingsRoute()) {
    disposeTerminalPage();
    renderSettingsPage();
    updateDebugShellFromLocation("App Menu");
    return;
  }

  settingsRoot.hidden = true;
  terminalRoot.hidden = false;
  document.title = `Terminal - ${APP_TITLE}`;
  await ensureTerminalRuntime();
  parentSessionId = await ensureParentSession();
  const workspace = await getJSON<Workspace>(`/api/tabs/${encodeURIComponent(parentSessionId)}`);
  renderWorkspace(workspace, firstLeaf(workspace.layout));
  updateDiagnosticsTimer();
  updateDebugShellFromLocation("Terminal");
}

async function ensureTerminalRuntime(): Promise<void> {
  if (terminalRuntimeReady) return;
  await loadCustomFont(settings);
  await init("/ghostty-vt.wasm");
  terminalRuntimeReady = true;
}

function createTerminal(): Terminal {
  const nextTerm = new Terminal({
    cols: 80,
    rows: 24,
    cursorBlink: settings.cursorBlink,
    cursorStyle: "block",
    fontFamily: terminalFontFamily(settings),
    fontSize: settings.fontSize,
    scrollback: settings.scrollback,
    smoothScrollDuration: 0,
    scrollbarWidth: 0,
    theme: terminalTheme(settings.theme),
  });

  nextTerm.attachCustomKeyEventHandler(
    ((event: KeyboardEvent) => shouldPassThroughSystemShortcut(event) ? false : undefined) as (
      event: KeyboardEvent,
    ) => boolean,
  );

  return nextTerm;
}

function renderWorkspace(workspace: Workspace, focusSessionId: string): void {
  currentWorkspace = workspace;
  parentSessionId = workspace.session.id;
  disposePanes();
  terminalRoot.replaceChildren(renderLayoutNode(workspace.layout));
  const focusId = panes.has(focusSessionId) ? focusSessionId : firstLeaf(workspace.layout);
  setActivePane(focusId);
  for (const pane of panes.values()) {
    void pane.connect(true);
  }
  scheduleFit();
}

function renderLayoutNode(node: SessionLayoutNode): HTMLElement {
  if (node.type === "leaf") {
    const paneRoot = document.createElement("section");
    paneRoot.className = "terminal-pane";
    paneRoot.dataset.paneId = node.sessionId;
    paneRoot.tabIndex = -1;
    panes.set(node.sessionId, new TerminalPane(node.sessionId, paneRoot, sessionForPane(node.sessionId)));
    return paneRoot;
  }

  const splitNode = node;
  const split = document.createElement("section");
  split.className = `split-node ${node.direction}`;
  const first = document.createElement("div");
  first.className = "split-child";
  first.style.flexBasis = `${splitRatio(node.ratio || 0.5) * 100}%`;
  first.append(renderLayoutNode(node.first));
  const divider = document.createElement("div");
  divider.className = "split-divider";
  divider.tabIndex = 0;
  divider.setAttribute("role", "separator");
  divider.setAttribute("aria-orientation", node.direction === "horizontal" ? "vertical" : "horizontal");
  divider.setAttribute("aria-valuemin", "20");
  divider.setAttribute("aria-valuemax", "80");
  divider.setAttribute("aria-label", "Resize terminal panes");
  const second = document.createElement("div");
  second.className = "split-child";
  second.style.flexBasis = `${(1 - splitRatio(node.ratio || 0.5)) * 100}%`;
  second.append(renderLayoutNode(node.second));
  updateDividerValue(divider, node.ratio || 0.5);
  divider.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    divider.setPointerCapture(event.pointerId);
    activeResize = { pointerId: event.pointerId, node: splitNode, split, divider, first, second };
    split.classList.add("resizing");
    resizeSplitFromPointer(activeResize, event.clientX, event.clientY);
  });
  divider.addEventListener("keydown", (event) => {
    const nextRatio = ratioFromKeyboard(node.ratio || 0.5, event.key, event.shiftKey);
    if (nextRatio === undefined) return;
    event.preventDefault();
    applySplitRatio(node, first, second, nextRatio);
    updateDividerValue(divider, node.ratio);
    scheduleFit();
    void persistCurrentLayout();
  });
  split.append(first, divider, second);
  return split;
}

function resizeSplitFromPointer(state: SplitResizeState, clientX: number, clientY: number): void {
  const nextRatio = ratioFromPointer(state.node.direction, state.split.getBoundingClientRect(), clientX, clientY);
  applySplitRatio(state.node, state.first, state.second, nextRatio);
  updateDividerValue(state.divider, state.node.ratio);
  scheduleFit();
}

function finishSplitResize(persist: boolean): void {
  if (!activeResize) return;
  if (activeResize.divider.hasPointerCapture(activeResize.pointerId)) {
    activeResize.divider.releasePointerCapture(activeResize.pointerId);
  }
  activeResize.split.classList.remove("resizing");
  activeResize = null;
  if (persist) void persistCurrentLayout();
}

async function persistCurrentLayout(): Promise<void> {
  if (!parentSessionId || !currentWorkspace) return;
  try {
    const workspace = await patchJSON<Workspace>(`/api/tabs/${encodeURIComponent(parentSessionId)}/layout`, {
      layout: currentWorkspace.layout,
    });
    currentWorkspace.session = workspace.session;
    currentWorkspace.children = workspace.children;
  } catch (error) {
    console.error("persist layout failed", error);
    await reloadCurrentWorkspace();
  }
}

async function reloadCurrentWorkspace(): Promise<void> {
  if (!parentSessionId) return;
  try {
    const focusId = activePaneId;
    const workspace = await getJSON<Workspace>(`/api/tabs/${encodeURIComponent(parentSessionId)}`);
    renderWorkspace(workspace, focusId);
  } catch (error) {
    console.error("reload workspace failed", error);
  }
}

function updateDividerValue(divider: HTMLElement, ratio: number): void {
  divider.setAttribute("aria-valuenow", String(Math.round(splitRatio(ratio) * 100)));
}

function scheduleFit(): void {
  if (pendingFitFrame !== undefined) return;
  pendingFitFrame = requestAnimationFrame(() => {
    pendingFitFrame = undefined;
    for (const pane of panes.values()) pane.fit();
    hideContextMenu();
  });
}

async function handleContextAction(action: string): Promise<void> {
  switch (action) {
    case "copy":
      activePane()?.term.copySelection();
      break;
    case "paste": {
      const text = await navigator.clipboard?.readText();
      if (text) activePane()?.term.paste(text);
      break;
    }
    case "select-all":
      activePane()?.term.selectAll();
      break;
    case "rename":
      openRenameDialog(activePaneId);
      break;
    case "duplicate-pane":
      await splitActivePane("horizontal");
      break;
    case "copy-pane-id":
      await copyToClipboard(activePaneId);
      break;
    case "new-tab":
      openAppURL("/terminal.html", { newTab: true });
      break;
    case "copy-tab-id":
      await copyToClipboard(parentSessionId);
      break;
    case "split-right":
    case "split":
      await splitActivePane("horizontal");
      break;
    case "split-down":
      await splitActivePane("vertical");
      break;
    case "restart-pane":
      await restartActivePane();
      break;
    case "restart-tab":
      await restartCurrentTab();
      break;
    case "detach":
      await detachActivePane();
      break;
    case "close-pane":
      await closeActivePane();
      break;
    case "close-tab":
      await closeCurrentTab();
      break;
    case "clear":
      activePane()?.term.clear();
      break;
    case "settings":
      openAppURL("/");
      break;
  }
}

function handlePaneShortcut(event: KeyboardEvent): boolean {
  if (!shouldHandleAppShortcut(event)) return false;
  const shortcut = paneShortcutForEvent(event);
  if (!shortcut) return false;
  event.preventDefault();
  event.stopPropagation();
  void runPaneShortcut(shortcut);
  return true;
}

function shouldHandleAppShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || isSettingsRoute() || !currentWorkspace) return false;
  if (document.querySelector("dialog[open]")) return false;
  const target = event.target;
  return !(target instanceof Element && isEditableShortcutTarget(target) && !terminalRoot.contains(target));
}

function isEditableShortcutTarget(target: Element): boolean {
  if (target.closest("input, select, textarea")) return true;
  const editable = target.closest<HTMLElement>("[contenteditable]");
  return Boolean(editable?.isContentEditable);
}

async function runPaneShortcut(shortcut: PaneShortcut): Promise<void> {
  switch (shortcut) {
    case "split-right":
      await splitActivePane("horizontal");
      break;
    case "split-down":
      await splitActivePane("vertical");
      break;
    case "focus-previous":
      focusAdjacentPane(-1);
      break;
    case "focus-next":
      focusAdjacentPane(1);
      break;
    case "close-pane":
      await closeActivePane();
      break;
    case "detach-pane":
      await detachActivePane();
      break;
  }
}

function focusAdjacentPane(delta: -1 | 1): void {
  if (!currentWorkspace) return;
  const leaves = layoutLeaves(currentWorkspace.layout);
  if (leaves.length === 0) return;
  const index = leaves.indexOf(activePaneId);
  const currentIndex = index >= 0 ? index : 0;
  const nextIndex = (currentIndex + delta + leaves.length) % leaves.length;
  setActivePane(leaves[nextIndex]);
}

async function splitActivePane(direction: "horizontal" | "vertical"): Promise<void> {
  const target = activePaneId || firstLeaf(currentWorkspace?.layout);
  if (!parentSessionId || !target) return;
  const workspace = await postJSON<Workspace>(`/api/tabs/${encodeURIComponent(parentSessionId)}/splits`, {
    targetSessionId: target,
    direction,
  });
  const previous = new Set(panes.keys());
  const focus = layoutLeaves(workspace.layout).find((id) => !previous.has(id)) ?? target;
  renderWorkspace(workspace, focus);
}

async function restartActivePane(): Promise<void> {
  if (!activePaneId) return;
  const session = await postJSON<TerminalSession>(`/api/panes/${encodeURIComponent(activePaneId)}/restart`);
  applySessionUpdate(session);
  const pane = panes.get(activePaneId);
  if (!pane) return;
  pane.hasAttached = false;
  pane.term.clear();
  await pane.connect(false);
}

async function restartCurrentTab(): Promise<void> {
  if (!parentSessionId) return;
  const workspace = await postJSON<Workspace>(`/api/tabs/${encodeURIComponent(parentSessionId)}/restart`);
  renderWorkspace(workspace, activePaneId || firstLeaf(workspace.layout));
}

async function copyToClipboard(value: string): Promise<void> {
  if (!value) return;
  await navigator.clipboard?.writeText(value);
}

async function detachActivePane(): Promise<void> {
  if (!parentSessionId || !activePaneId || activePaneId === parentSessionId) return;
  const session = await postJSON<TerminalSession>(`/api/terminal-sessions/${encodeURIComponent(parentSessionId)}/detach`, {
    sessionId: activePaneId,
  });
  openAppURL(`/terminal.html?tab=${encodeURIComponent(session.id)}`, { newTab: true });
  const workspace = await getJSON<Workspace>(`/api/tabs/${encodeURIComponent(parentSessionId)}`);
  renderWorkspace(workspace, firstLeaf(workspace.layout));
}

async function closeActivePane(): Promise<void> {
  if (!activePaneId || !currentWorkspace) return;
  if (activePaneId === parentSessionId && layoutLeaves(currentWorkspace.layout).length > 1) return;
  const isTab = activePaneId === parentSessionId;
  const response = await fetch(`/${isTab ? "api/tabs" : "api/panes"}/${encodeURIComponent(activePaneId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) return;
  if (activePaneId === parentSessionId) {
    window.close();
    return;
  }
  const workspace = await getJSON<Workspace>(`/api/tabs/${encodeURIComponent(parentSessionId)}`);
  renderWorkspace(workspace, firstLeaf(workspace.layout));
}

async function closeCurrentTab(): Promise<void> {
  if (!parentSessionId) return;
  if (!window.confirm("Close this tab and all of its panes?")) return;
  const response = await fetch(`/api/tabs/${encodeURIComponent(parentSessionId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) return;
  window.close();
}

function setActivePane(sessionId: string): void {
  if (!sessionId || !panes.has(sessionId)) return;
  activePaneId = sessionId;
  for (const [id, pane] of panes) {
    pane.root.classList.toggle("active", id === sessionId);
  }
  activePane()?.focus();
}

function activePane(): TerminalPane | undefined {
  return panes.get(activePaneId);
}

function sessionForPane(sessionId: string): TerminalSession | undefined {
  if (!currentWorkspace) return undefined;
  if (currentWorkspace.session.id === sessionId) return currentWorkspace.session;
  return currentWorkspace.children.find((session) => session.id === sessionId);
}

function openRenameDialog(sessionId: string): void {
  const session = sessionForPane(sessionId);
  if (!session) return;
  openRenameDialogForSession(session);
}

function openMenuRenameDialog(sessionId: string): void {
  const session = listedSessions.find((candidate) => candidate.id === sessionId);
  if (!session) return;
  openRenameDialogForSession(session);
}

function openRenameDialogForSession(session: TerminalSession): void {
  delete renameDialog.dataset.spaceId;
  renameDialog.dataset.sessionId = session.id;
  renameDialogTitle.textContent = "Rename tab";
  renameResetButton.hidden = false;
  renameInput.value = session.customTitle ? session.title : "";
  renameInput.placeholder = sessionTitle(session);
  if (!renameDialog.open) renameDialog.showModal();
  renameInput.focus();
  renameInput.select();
}

function openRenameDialogForSpace(space: Space): void {
  delete renameDialog.dataset.sessionId;
  renameDialog.dataset.spaceId = space.id;
  renameDialogTitle.textContent = "Rename space";
  renameResetButton.hidden = true;
  renameInput.value = space.title;
  renameInput.placeholder = "Space name";
  if (!renameDialog.open) renameDialog.showModal();
  renameInput.focus();
  renameInput.select();
}

async function renameSession(sessionId: string, title: string): Promise<void> {
  const existing = sessionForPane(sessionId) ?? listedSessions.find((candidate) => candidate.id === sessionId);
  const collection = existing?.parentId ? "panes" : "tabs";
  const session = await patchJSON<TerminalSession>(`/api/${collection}/${encodeURIComponent(sessionId)}`, { title });
  applySessionUpdate(session);
  if (settingsRoot.hidden) {
    const pane = panes.get(session.id);
    if (pane) {
      pane.title = sessionTitle(session);
      pane.customTitle = Boolean(session.customTitle);
      if (pane.id === activePaneId) pane.focus();
    }
  } else {
    await renderSpaceList();
  }
}

function applySessionUpdate(session: TerminalSession): void {
  if (!currentWorkspace) return;
  if (currentWorkspace.session.id === session.id) {
    currentWorkspace.session = { ...currentWorkspace.session, ...session };
  }
  currentWorkspace.children = currentWorkspace.children.map((child) => (child.id === session.id ? { ...child, ...session } : child));
}

function disposePanes(): void {
  for (const pane of panes.values()) pane.dispose();
  panes.clear();
}

function disposeTerminalPage(): void {
  disposePanes();
  terminalRoot.replaceChildren();
  currentWorkspace = null;
  parentSessionId = "";
  activePaneId = "";
}

function showContextMenu(x: number, y: number): void {
  updateContextMenuState();
  contextMenu.hidden = false;
  contextMenu.style.left = "0px";
  contextMenu.style.top = "0px";
  const rect = contextMenu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 8);
  const top = Math.min(y, window.innerHeight - rect.height - 8);
  contextMenu.style.left = `${Math.max(8, left)}px`;
  contextMenu.style.top = `${Math.max(8, top)}px`;
}

function hideContextMenu(): void {
  contextMenu.hidden = true;
}

function updateContextMenuState(): void {
  for (const button of contextMenu.querySelectorAll<HTMLButtonElement>("button[data-action]")) {
    const action = button.dataset.action ?? "";
    button.disabled =
      (["copy-pane-id", "duplicate-pane", "rename", "restart-pane", "split-right", "split-down", "detach", "close-pane"].includes(action) &&
        !activePaneId) ||
      (["copy-tab-id", "restart-tab", "close-tab"].includes(action) && !parentSessionId);
  }
}

async function ensureParentSession(): Promise<string> {
  const current = currentTabId();
  if (current) return current;
  const nextSession = await postJSON<TerminalSession>(`/api/spaces/${DEFAULT_SPACE_ID}/tabs`, {
    profileId: settings.defaultProfileId,
  });
  const url = new URL(window.location.href);
  url.searchParams.set("tab", nextSession.id);
  url.searchParams.delete("session");
  window.history.replaceState(null, "", url);
  updateDebugShellFromLocation("Terminal");
  return nextSession.id;
}

function currentTabId(): string {
  const params = new URL(window.location.href).searchParams;
  const tab = params.get("tab") || params.get("session") || "";
  return /^[a-z0-9][a-z0-9-]{2,63}$/.test(tab) ? tab : "";
}

function setStatus(state: "connecting" | "connected" | "offline", label: string): void {
  statusEl.dataset.state = state;
  statusEl.textContent = label;
}

function renderDiagnostics(): void {
  if (diagnosticsPanel.hidden) return;
  const pane = activePane();
  const canvas = pane?.root.querySelector("canvas");
  const rect = canvas?.getBoundingClientRect() ?? pane?.root.getBoundingClientRect() ?? terminalRoot.getBoundingClientRect();
  diagnosticsList.innerHTML = "";
  for (const [label, value] of [
    ["Renderer", "ghostty-web/canvas"],
    ["Core", "ghostty-vt"],
    ["Tab", parentSessionId || "?"],
    ["Pane", activePaneId || "?"],
    ["Panes", String(panes.size)],
    ["DPR", formatNumber(window.devicePixelRatio || 1)],
    ["Canvas", canvas ? `${canvas.width} x ${canvas.height}` : "?"],
    ["CSS", `${formatNumber(rect.width)} x ${formatNumber(rect.height)}`],
    ["Grid", `${pane?.term.cols || "?"} x ${pane?.term.rows || "?"}`],
    ["Transport", socketState(pane?.socket ?? null)],
  ]) {
    const termEl = document.createElement("dt");
    termEl.textContent = label;
    const description = document.createElement("dd");
    description.textContent = String(value);
    diagnosticsList.append(termEl, description);
  }
}

function renderSettingsPage(): void {
  document.title = `Menu - ${APP_TITLE}`;
  terminalRoot.hidden = true;
  offlineEl.hidden = true;
  settingsRoot.hidden = false;
  setStatus("connected", "Menu");

  settingsRoot.innerHTML = `
    <section class="settings-hero">
      <div>
        <p class="settings-eyebrow">Pinned Home Tab</p>
        <h1>App Menu</h1>
        <p class="settings-intro">Open spaces, terminal tabs, and tune defaults for new Crostini shell sessions.</p>
      </div>
      <div class="menu-actions">
        <button class="primary-button" type="button" id="createDefaultTerminal">New terminal</button>
        <button class="secondary-button" type="button" id="focusSettings">Settings</button>
      </div>
    </section>

    <section class="quick-grid" aria-label="Quick actions">
      <button class="quick-action" type="button" id="createQuickTerminal">
        <strong>New terminal</strong>
        <span>Start a fresh Crostini terminal tab.</span>
      </button>
      <button class="quick-action" type="button" id="copyLaunchCommand">
        <strong>Agent command</strong>
        <span>Copy the local launch command.</span>
      </button>
      <button class="quick-action" type="button" id="resetSettingsQuick">
        <strong>Reset profile</strong>
        <span>Restore terminal defaults.</span>
      </button>
    </section>

    <section class="session-panel" aria-labelledby="profilesTitle">
      <div class="section-heading">
        <div>
          <h2 id="profilesTitle">Profiles</h2>
          <p>Choose shell, working directory, and environment defaults for new terminal tabs.</p>
        </div>
        <div class="section-actions">
          <button class="secondary-button" type="button" id="createProfile">New profile</button>
        </div>
      </div>
      <div id="profileList" class="session-list" aria-live="polite">
        <div class="session-empty">Loading profiles</div>
      </div>
    </section>

    <section class="session-panel" aria-labelledby="sessionsTitle">
      <div class="section-heading">
        <div>
          <h2 id="sessionsTitle">Spaces</h2>
          <p>Open terminal tabs grouped by space or remove tab trees you no longer need.</p>
        </div>
        <div class="section-actions">
          <button class="secondary-button" type="button" id="createSpace">New space</button>
          <button class="secondary-button" type="button" id="refreshSessions">Refresh</button>
        </div>
      </div>
      <div id="sessionList" class="session-list" aria-live="polite">
        <div class="session-empty">Loading spaces</div>
      </div>
      <div id="orphanPanel" class="orphan-panel" aria-live="polite">
        <span>Checking orphan panes</span>
      </div>
    </section>

    <form id="settingsForm" class="settings-form">
      <section class="settings-section">
        <h2>Display</h2>
        <label class="setting-row">
          <span><strong>Font family</strong><small>CSS font stack used by new terminal tabs.</small></span>
          <input id="fontFamily" name="fontFamily" type="text" value="${escapeAttribute(settings.fontFamily)}" />
        </label>
        <label class="setting-row">
          <span><strong>Font-face name</strong><small>Name to use for the custom font URL below.</small></span>
          <input id="customFontName" name="customFontName" type="text" placeholder="Custom Terminal Font" value="${escapeAttribute(settings.customFontName)}" />
        </label>
        <label class="setting-row">
          <span><strong>Font-face URL</strong><small>Optional WOFF2, WOFF, TTF, or OTF URL loaded before terminal startup.</small></span>
          <input id="customFontUrl" name="customFontUrl" type="url" placeholder="/fonts/example.woff2" value="${escapeAttribute(settings.customFontUrl)}" />
        </label>
        <label class="setting-row">
          <span><strong>Font size</strong><small>Controls terminal grid density and readability.</small></span>
          <input id="fontSize" name="fontSize" type="number" min="12" max="22" step="1" value="${settings.fontSize}" />
        </label>
        <label class="setting-row">
          <span><strong>Terminal palette</strong><small>Choose the terminal colors used by new tabs.</small></span>
          <select id="theme" name="theme">
            <option value="dark">Dark</option>
            <option value="highContrast">High contrast</option>
            <option value="soft">Soft</option>
          </select>
        </label>
        <label class="setting-row">
          <span><strong>App accent</strong><small>Changes controls, focus rings, and status highlights.</small></span>
          <select id="accent" name="accent">
            <option value="green">Green</option>
            <option value="blue">Blue</option>
            <option value="amber">Amber</option>
          </select>
        </label>
        <label class="setting-row">
          <span><strong>App density</strong><small>Compact mode tightens app chrome around the terminal.</small></span>
          <select id="density" name="density">
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <label class="setting-row">
          <span><strong>Blinking cursor</strong><small>Disable this if cursor blinking is distracting.</small></span>
          <input id="cursorBlink" name="cursorBlink" type="checkbox" />
        </label>
      </section>

      <section class="settings-section">
        <h2>History and Input</h2>
        <label class="setting-row">
          <span><strong>Scrollback lines</strong><small>Higher values keep more history and use more memory.</small></span>
          <select id="scrollback" name="scrollback">
            <option value="1000">1,000</option>
            <option value="5000">5,000</option>
            <option value="10000">10,000</option>
            <option value="20000">20,000</option>
          </select>
        </label>
        <label class="setting-row">
          <span><strong>Scroll sensitivity</strong><small>Adjust trackpad and mouse-wheel scroll speed.</small></span>
          <input id="scrollSensitivity" name="scrollSensitivity" type="range" min="0.5" max="2" step="0.25" value="${settings.scrollSensitivity}" />
        </label>
      </section>

      <div id="settingsActions" class="settings-actions">
        <button class="secondary-button" type="button" id="resetSettings">Reset defaults</button>
        <button class="primary-button" type="submit">Save settings</button>
      </div>
    </form>
  `;

  const form = requiredElement<HTMLFormElement>("#settingsForm");
  const theme = requiredElement<HTMLSelectElement>("#theme");
  const accent = requiredElement<HTMLSelectElement>("#accent");
  const density = requiredElement<HTMLSelectElement>("#density");
  const scrollback = requiredElement<HTMLSelectElement>("#scrollback");
  const cursorBlink = requiredElement<HTMLInputElement>("#cursorBlink");
  theme.value = settings.theme;
  accent.value = settings.accent;
  density.value = settings.density;
  scrollback.value = String(settings.scrollback);
  cursorBlink.checked = settings.cursorBlink;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    settings = readSettingsForm();
    saveSettings(settings);
    applyAppAppearance(settings);
  });
  const reset = () => {
    settings = { ...DEFAULT_SETTINGS };
    saveSettings(settings);
    applyAppAppearance(settings);
    renderSettingsPage();
  };
  requiredElement<HTMLButtonElement>("#resetSettings").addEventListener("click", reset);
  requiredElement<HTMLButtonElement>("#resetSettingsQuick").addEventListener("click", reset);
  requiredElement<HTMLButtonElement>("#createDefaultTerminal").addEventListener("click", () => {
    void createTabInSpace(DEFAULT_SPACE_ID);
  });
  requiredElement<HTMLButtonElement>("#createQuickTerminal").addEventListener("click", () => {
    void createTabInSpace(DEFAULT_SPACE_ID);
  });
  requiredElement<HTMLButtonElement>("#focusSettings").addEventListener("click", () => {
    requiredElement<HTMLElement>("#settingsActions").scrollIntoView({ behavior: "smooth", block: "end" });
  });
  requiredElement<HTMLButtonElement>("#copyLaunchCommand").addEventListener("click", async () => {
    await navigator.clipboard?.writeText("cd ~/crostini-ghostty-terminal/agent && go run . -web-dir ../web/dist");
  });
  requiredElement<HTMLButtonElement>("#refreshSessions").addEventListener("click", () => {
    void renderSpaceList();
  });
  requiredElement<HTMLButtonElement>("#createSpace").addEventListener("click", () => {
    void createSpace();
  });
  requiredElement<HTMLButtonElement>("#createProfile").addEventListener("click", () => {
    void editProfile();
  });
  void renderProfileList();
  void renderSpaceList();
  void renderOrphanPanel();
}

async function renderSpaceList(): Promise<void> {
  const list = requiredElement<HTMLElement>("#sessionList");
  list.innerHTML = `<div class="session-empty">Loading spaces</div>`;
  try {
    const spaces = await getJSON<Space[]>("/api/spaces");
    listedSpaces = spaces;
    listedSessions = spaces.flatMap((space) => space.tabs);
    if (spaces.length === 0) {
      list.innerHTML = `<div class="session-empty">No spaces available</div>`;
      return;
    }
    list.replaceChildren(...spaces.map((space) => renderSpace(space)));
  } catch (error) {
    console.error(error);
    listedSpaces = [];
    listedSessions = [];
    list.innerHTML = `<div class="session-empty">Unable to load spaces</div>`;
  }
}

async function renderProfileList(): Promise<void> {
  const list = requiredElement<HTMLElement>("#profileList");
  list.innerHTML = `<div class="session-empty">Loading profiles</div>`;
  try {
    const profiles = await getJSON<Profile[]>("/api/profiles");
    listedProfiles = profiles;
    if (!profiles.some((profile) => profile.id === settings.defaultProfileId)) {
      settings = { ...settings, defaultProfileId: DEFAULT_PROFILE_ID };
      saveSettings(settings);
    }
    list.replaceChildren(...profiles.map((profile) => renderProfileRow(profile)));
  } catch (error) {
    console.error(error);
    listedProfiles = [];
    list.innerHTML = `<div class="session-empty">Unable to load profiles</div>`;
  }
}

function renderProfileRow(profile: Profile): HTMLElement {
  const row = document.createElement("article");
  row.className = "session-row";
  const isDefault = profile.id === settings.defaultProfileId;
  const details = profileSummary(profile);
  row.innerHTML = `
    <div class="session-main">
      <strong>${escapeHTML(profile.title)}${isDefault ? " · default" : ""}</strong>
      <span>${escapeHTML(details)}</span>
    </div>
    <div class="session-meta">
      <span>${escapeHTML(profile.id)}</span>
      <time>${escapeHTML(formatSessionDate(profile.updatedAt || profile.createdAt))}</time>
    </div>
    <div class="session-actions">
      <button class="icon-button" type="button" title="Use for new terminals" aria-label="Use ${escapeAttribute(profile.title)} for new terminals" data-select-profile="${escapeAttribute(profile.id)}"${isDefault ? " disabled" : ""}>
        <span aria-hidden="true">✓</span>
      </button>
      <button class="icon-button" type="button" title="Edit profile" aria-label="Edit ${escapeAttribute(profile.title)}" data-edit-profile="${escapeAttribute(profile.id)}"${profile.id === DEFAULT_PROFILE_ID ? " disabled" : ""}>
        <span aria-hidden="true">✎</span>
      </button>
      <button class="icon-button danger" type="button" title="Delete profile" aria-label="Delete ${escapeAttribute(profile.title)}" data-delete-profile="${escapeAttribute(profile.id)}"${profile.id === DEFAULT_PROFILE_ID ? " disabled" : ""}>
        <span aria-hidden="true">${trashIcon()}</span>
      </button>
    </div>
  `;
  return row;
}

function profileSummary(profile: Profile): string {
  const parts = [
    profile.shell || "Automatic shell",
    profile.workingDir || "Home directory",
    `${Object.keys(profile.env ?? {}).length} env`,
  ];
  return parts.join(" · ");
}

function renderSpace(space: Space): HTMLElement {
  const section = document.createElement("section");
  section.className = "space-group";
  const canDelete = space.id !== DEFAULT_SPACE_ID && space.tabs.length === 0;
  const deleteTitle =
    space.id === DEFAULT_SPACE_ID
      ? "Default space cannot be removed"
      : space.tabs.length === 0
        ? "Delete space"
        : "Only empty spaces can be removed";
  section.innerHTML = `
    <div class="space-heading">
      <div>
        <strong>${escapeHTML(space.title)}</strong>
        <span>${space.tabCount} tab${space.tabCount === 1 ? "" : "s"}</span>
      </div>
      <div class="space-actions">
        <button class="icon-button" type="button" title="New tab in ${escapeAttribute(space.title)}" aria-label="New tab in ${escapeAttribute(space.title)}" data-create-tab-space="${escapeAttribute(space.id)}">
          <span aria-hidden="true">+</span>
        </button>
        <button class="icon-button" type="button" title="Rename space" aria-label="Rename ${escapeAttribute(space.title)}" data-rename-space="${escapeAttribute(space.id)}">
          <span aria-hidden="true">✎</span>
        </button>
        <button class="icon-button danger" type="button" title="${escapeAttribute(deleteTitle)}" aria-label="${escapeAttribute(deleteTitle)}" data-delete-space="${escapeAttribute(space.id)}"${canDelete ? "" : " disabled"}>
          <span aria-hidden="true">${trashIcon()}</span>
        </button>
      </div>
    </div>
  `;
  const rows = document.createElement("div");
  rows.className = "space-tabs";
  if (space.tabs.length === 0) {
    rows.innerHTML = `<div class="session-empty compact">No terminal tabs</div>`;
  } else {
    rows.replaceChildren(...space.tabs.map((session) => renderTabRow(session)));
  }
  section.append(rows);
  return section;
}

function renderTabRow(session: TerminalSession): HTMLElement {
  const row = document.createElement("article");
  row.className = "session-row";
  row.innerHTML = `
          <div class="session-main">
            <strong>${escapeHTML(sessionTitle(session))}</strong>
            <span>${escapeHTML(session.id)}${session.paneCount ? ` · ${session.paneCount} pane${session.paneCount === 1 ? "" : "s"}` : ""}</span>
          </div>
          <div class="session-meta">
            <span class="session-status" data-state="${escapeAttribute(session.status)}">${escapeHTML(session.status)}</span>
            <time>${escapeHTML(formatSessionDate(session.updatedAt || session.createdAt))}</time>
          </div>
          <div class="session-actions">
            <a class="icon-button" href="${escapeAttribute(appURL(`/terminal.html?tab=${encodeURIComponent(session.id)}`))}" title="Open tab" aria-label="Open ${escapeAttribute(sessionTitle(session))} in a new tab">
              <span aria-hidden="true">↗</span>
            </a>
            <button class="icon-button" type="button" title="Restart tab" aria-label="Restart ${escapeAttribute(sessionTitle(session))}" data-restart-session="${escapeAttribute(session.id)}">
              <span aria-hidden="true">↻</span>
            </button>
            <button class="icon-button" type="button" title="Rename tab" aria-label="Rename ${escapeAttribute(sessionTitle(session))}" data-rename-session="${escapeAttribute(session.id)}">
              <span aria-hidden="true">✎</span>
            </button>
            <button class="icon-button danger" type="button" title="Remove tab" aria-label="Remove ${escapeAttribute(sessionTitle(session))}" data-delete-session="${escapeAttribute(session.id)}">
              <span aria-hidden="true">${trashIcon()}</span>
            </button>
          </div>
        `;
  return row;
}

document.addEventListener("click", (event) => {
  const createProfileButton = (event.target as Element).closest<HTMLButtonElement>("button[data-create-profile]");
  if (createProfileButton) {
    void editProfile();
    return;
  }
  const selectProfileButton = (event.target as Element).closest<HTMLButtonElement>("button[data-select-profile]");
  if (selectProfileButton?.dataset.selectProfile) {
    selectDefaultProfile(selectProfileButton.dataset.selectProfile);
    return;
  }
  const editProfileButton = (event.target as Element).closest<HTMLButtonElement>("button[data-edit-profile]");
  if (editProfileButton?.dataset.editProfile) {
    void editProfile(editProfileButton.dataset.editProfile);
    return;
  }
  const deleteProfileButton = (event.target as Element).closest<HTMLButtonElement>("button[data-delete-profile]");
  if (deleteProfileButton?.dataset.deleteProfile) {
    void deleteProfile(deleteProfileButton.dataset.deleteProfile);
    return;
  }
  const cleanupOrphansButton = (event.target as Element).closest<HTMLButtonElement>("button[data-cleanup-orphans]");
  if (cleanupOrphansButton) {
    void cleanupOrphanPanes();
    return;
  }
  const createTabButton = (event.target as Element).closest<HTMLButtonElement>("button[data-create-tab-space]");
  if (createTabButton?.dataset.createTabSpace) {
    void createTabInSpace(createTabButton.dataset.createTabSpace);
    return;
  }
  const renameSpaceButton = (event.target as Element).closest<HTMLButtonElement>("button[data-rename-space]");
  if (renameSpaceButton?.dataset.renameSpace) {
    openMenuSpaceRenameDialog(renameSpaceButton.dataset.renameSpace);
    return;
  }
  const deleteSpaceButton = (event.target as Element).closest<HTMLButtonElement>("button[data-delete-space]");
  if (deleteSpaceButton?.dataset.deleteSpace) {
    void deleteSpace(deleteSpaceButton.dataset.deleteSpace);
    return;
  }
  const renameButton = (event.target as Element).closest<HTMLButtonElement>("button[data-rename-session]");
  if (renameButton?.dataset.renameSession) {
    openMenuRenameDialog(renameButton.dataset.renameSession);
    return;
  }
  const restartButton = (event.target as Element).closest<HTMLButtonElement>("button[data-restart-session]");
  if (restartButton?.dataset.restartSession) {
    void restartListedTab(restartButton.dataset.restartSession);
    return;
  }
  const button = (event.target as Element).closest<HTMLButtonElement>("button[data-delete-session]");
  if (!button) return;
  const sessionId = button.dataset.deleteSession;
  if (!sessionId) return;
  void deleteTerminalSession(sessionId);
});

async function deleteTerminalSession(sessionId: string): Promise<void> {
  const session = listedSessions.find((candidate) => candidate.id === sessionId);
  const title = session ? sessionTitle(session) : sessionId;
  const paneCount = session?.paneCount ?? 1;
  if (!window.confirm(`Delete tab "${title}" and ${paneCount} pane${paneCount === 1 ? "" : "s"}?`)) return;
  const response = await fetch(`/api/tabs/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) {
    console.error(`delete session ${sessionId} failed with ${response.status}`);
    return;
  }
  await renderSpaceList();
}

async function restartListedTab(sessionId: string): Promise<void> {
  const response = await fetch(`/api/tabs/${encodeURIComponent(sessionId)}/restart`, {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    console.error(`restart tab ${sessionId} failed with ${response.status}`);
    return;
  }
  await renderSpaceList();
}

async function renderOrphanPanel(): Promise<void> {
  const panel = document.querySelector<HTMLElement>("#orphanPanel");
  if (!panel) return;
  try {
    const orphans = await getJSON<TerminalSession[]>("/api/terminal-sessions/orphans");
    if (orphans.length === 0) {
      panel.innerHTML = `<span>No orphan panes</span>`;
      return;
    }
    panel.innerHTML = `
      <span>${orphans.length} orphan pane${orphans.length === 1 ? "" : "s"} found</span>
      <button class="secondary-button compact-button" type="button" data-cleanup-orphans>Clean up</button>
    `;
  } catch (error) {
    console.error(error);
    panel.innerHTML = `<span>Unable to check orphan panes</span>`;
  }
}

async function cleanupOrphanPanes(): Promise<void> {
  const panel = document.querySelector<HTMLElement>("#orphanPanel");
  if (!window.confirm("Remove all orphan pane sessions?")) return;
  const response = await fetch("/api/terminal-sessions/orphans", {
    method: "DELETE",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    console.error(`cleanup orphan panes failed with ${response.status}`);
    return;
  }
  const result = (await response.json()) as OrphanCleanup;
  if (panel) panel.innerHTML = `<span>Removed ${result.deleted} orphan pane${result.deleted === 1 ? "" : "s"}</span>`;
}

function selectDefaultProfile(profileId: string): void {
  settings = normalizeSettings({ ...settings, defaultProfileId: profileId });
  saveSettings(settings);
  void renderProfileList();
}

async function editProfile(profileId?: string): Promise<void> {
  const existing = profileId ? listedProfiles.find((candidate) => candidate.id === profileId) : undefined;
  if (profileId && !existing) return;
  const title = window.prompt("Profile name", existing?.title ?? "");
  if (title === null) return;
  const shell = window.prompt("Shell path", existing?.shell ?? "");
  if (shell === null) return;
  const workingDir = window.prompt("Working directory", existing?.workingDir ?? "");
  if (workingDir === null) return;
  const envText = window.prompt("Environment variables, one KEY=value per line", envToText(existing?.env));
  if (envText === null) return;
  const env = envFromText(envText);
  if (!env) return;
  const payload = { title, shell, workingDir, env };
  const url = existing ? `/api/profiles/${encodeURIComponent(existing.id)}` : "/api/profiles";
  const response = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    window.alert(await response.text());
    return;
  }
  await renderProfileList();
}

async function deleteProfile(profileId: string): Promise<void> {
  const profile = listedProfiles.find((candidate) => candidate.id === profileId);
  if (!profile || profile.id === DEFAULT_PROFILE_ID) return;
  if (!window.confirm(`Delete profile "${profile.title}"?`)) return;
  const response = await fetch(`/api/profiles/${encodeURIComponent(profile.id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) {
    console.error(`delete profile ${profile.id} failed with ${response.status}`);
    return;
  }
  if (settings.defaultProfileId === profile.id) {
    settings = { ...settings, defaultProfileId: DEFAULT_PROFILE_ID };
    saveSettings(settings);
  }
  await renderProfileList();
}

function envToText(env: EnvVars | undefined): string {
  return Object.entries(env ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function envFromText(value: string): EnvVars | null {
  const env: EnvVars = {};
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const index = line.indexOf("=");
    const key = index >= 0 ? line.slice(0, index).trim() : line;
    const envValue = index >= 0 ? line.slice(index + 1) : "";
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      window.alert(`Invalid environment variable name: ${key}`);
      return null;
    }
    env[key] = envValue;
  }
  return env;
}

function openMenuSpaceRenameDialog(spaceId: string): void {
  const space = listedSpaces.find((candidate) => candidate.id === spaceId);
  if (!space) return;
  openRenameDialogForSpace(space);
}

async function createSpace(): Promise<void> {
  const title = window.prompt("Space name", "");
  if (title === null) return;
  await postJSON<Space>("/api/spaces", { title: title.trim() || undefined });
  await renderSpaceList();
}

async function renameSpace(spaceId: string, title: string): Promise<void> {
  await patchJSON<Space>(`/api/spaces/${encodeURIComponent(spaceId)}`, { title });
  await renderSpaceList();
}

async function deleteSpace(spaceId: string): Promise<void> {
  const space = listedSpaces.find((candidate) => candidate.id === spaceId);
  if (!space || space.id === DEFAULT_SPACE_ID || space.tabs.length > 0) return;
  if (!window.confirm(`Delete space "${space.title}"?`)) return;
  const response = await fetch(`/api/spaces/${encodeURIComponent(spaceId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) {
    console.error(`delete space ${spaceId} failed with ${response.status}`);
    return;
  }
  await renderSpaceList();
}

async function createTabInSpace(spaceId: string): Promise<void> {
  const session = await postJSON<TerminalSession>(`/api/spaces/${encodeURIComponent(spaceId)}/tabs`, {
    profileId: settings.defaultProfileId,
  });
  openAppURL(`/terminal.html?tab=${encodeURIComponent(session.id)}`, { newTab: true });
  if (!settingsRoot.hidden) await renderSpaceList();
}

function readSettingsForm(): TerminalSettings {
  return normalizeSettings({
    fontFamily: requiredElement<HTMLInputElement>("#fontFamily").value,
    customFontName: requiredElement<HTMLInputElement>("#customFontName").value,
    customFontUrl: requiredElement<HTMLInputElement>("#customFontUrl").value,
    fontSize: Number(requiredElement<HTMLInputElement>("#fontSize").value),
    scrollback: Number(requiredElement<HTMLSelectElement>("#scrollback").value),
    cursorBlink: requiredElement<HTMLInputElement>("#cursorBlink").checked,
    accent: requiredElement<HTMLSelectElement>("#accent").value,
    density: requiredElement<HTMLSelectElement>("#density").value,
    theme: requiredElement<HTMLSelectElement>("#theme").value,
    scrollSensitivity: Number(requiredElement<HTMLInputElement>("#scrollSensitivity").value),
    defaultProfileId: settings.defaultProfileId,
  });
}

function sessionTitle(session: TerminalSession): string {
  return session.title || "Terminal";
}

function formatSessionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function trashIcon(): string {
  return `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"/></svg>`;
}

function isSettingsRoute(): boolean {
  return window.location.pathname === "/" || window.location.pathname === "/index.html";
}

function isDebugShellEnabled(): boolean {
  const value = new URL(window.location.href).searchParams.get(DEBUG_SHELL_PARAM);
  return value === "1" || value === "true";
}

function appURL(path: string): string {
  const url = new URL(path, window.location.href);
  if (isDebugShellEnabled()) url.searchParams.set(DEBUG_SHELL_PARAM, "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

function openAppURL(path: string, options: { newTab?: boolean } = {}): void {
  const url = appURL(path);
  if (!debugShell) {
    window.open(url, options.newTab ? "_blank" : "_self");
    return;
  }
  void navigateDebugShell(url, options);
}

function installDebugShell(): void {
  if (debugShell) return;
  appRoot.classList.add("debug-shell");
  const root = document.createElement("nav");
  root.className = "debug-pwa-tabs";
  root.setAttribute("aria-label", "Debug PWA tab strip");
  appRoot.prepend(root);

  const current = currentAppPath();
  const menu: DebugShellTab = { id: "debug-menu", title: "App Menu", url: appURL("/") };
  const tabs = [menu];
  let activeTabId = menu.id;
  if (!isSettingsPath(window.location.pathname)) {
    const terminal: DebugShellTab = { id: "debug-tab-1", title: "Terminal", url: current };
    tabs.push(terminal);
    activeTabId = terminal.id;
  }

  debugShell = { root, tabs, activeTabId, nextTabNumber: 2 };
  root.addEventListener("click", (event) => {
    const target = event.target as Element;
    const closeButton = target.closest<HTMLElement>("[data-debug-close-tab]");
    if (closeButton?.dataset.debugCloseTab) {
      event.stopPropagation();
      void closeDebugTab(closeButton.dataset.debugCloseTab);
      return;
    }

    const tabButton = target.closest<HTMLButtonElement>("button[data-debug-tab]");
    if (tabButton?.dataset.debugTab) {
      void activateDebugTab(tabButton.dataset.debugTab);
      return;
    }

    if (target.closest("button[data-debug-new-tab]")) {
      void navigateDebugShell(appURL("/terminal.html"), { newTab: true });
    }
  });
  document.addEventListener("click", handleDebugShellLinkClick);
  window.addEventListener("popstate", () => {
    syncDebugShellToLocation();
    void renderCurrentRoute();
  });
  renderDebugShell();
}

function handleDebugShellLinkClick(event: MouseEvent): void {
  if (!debugShell || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
  if (!anchor || anchor.target || anchor.download) return;
  const url = new URL(anchor.href);
  if (url.origin !== window.location.origin || !isAppPath(url.pathname)) return;
  event.preventDefault();
  void navigateDebugShell(`${url.pathname}${url.search}${url.hash}`, { newTab: !isSettingsPath(url.pathname) });
}

async function navigateDebugShell(path: string, options: { newTab?: boolean } = {}): Promise<void> {
  if (!debugShell) return;
  const url = appURL(path);
  const pathname = new URL(url, window.location.href).pathname;
  let tab = options.newTab ? undefined : debugShell.tabs.find((candidate) => candidate.url === url);
  if (!tab && isSettingsPath(pathname)) {
    tab = debugShell.tabs.find((candidate) => candidate.id === "debug-menu");
  }
  if (!tab) {
    tab = {
      id: `debug-tab-${debugShell.nextTabNumber++}`,
      title: isSettingsPath(pathname) ? "App Menu" : "Terminal",
      url,
    };
    debugShell.tabs.push(tab);
  }
  tab.url = url;
  debugShell.activeTabId = tab.id;
  history.pushState(null, "", url);
  renderDebugShell();
  await renderCurrentRoute();
}

async function activateDebugTab(tabId: string): Promise<void> {
  if (!debugShell) return;
  const tab = debugShell.tabs.find((candidate) => candidate.id === tabId);
  if (!tab) return;
  debugShell.activeTabId = tab.id;
  history.pushState(null, "", tab.url);
  renderDebugShell();
  await renderCurrentRoute();
}

async function closeDebugTab(tabId: string): Promise<void> {
  if (!debugShell || tabId === "debug-menu") return;
  const index = debugShell.tabs.findIndex((tab) => tab.id === tabId);
  if (index < 0) return;
  const closingActive = debugShell.activeTabId === tabId;
  debugShell.tabs.splice(index, 1);
  if (closingActive) {
    const fallback = debugShell.tabs[Math.max(0, index - 1)] ?? debugShell.tabs[0];
    debugShell.activeTabId = fallback.id;
    history.pushState(null, "", fallback.url);
    await renderCurrentRoute();
  }
  renderDebugShell();
}

function syncDebugShellToLocation(): void {
  if (!debugShell) return;
  const current = currentAppPath();
  let tab = debugShell.tabs.find((candidate) => candidate.url === current);
  if (!tab && isSettingsPath(window.location.pathname)) {
    tab = debugShell.tabs.find((candidate) => candidate.id === "debug-menu");
  }
  if (!tab) {
    tab = { id: `debug-tab-${debugShell.nextTabNumber++}`, title: "Terminal", url: current };
    debugShell.tabs.push(tab);
  }
  debugShell.activeTabId = tab.id;
  tab.url = current;
  renderDebugShell();
}

function updateDebugShellFromLocation(title: string): void {
  if (!debugShell) return;
  const active = debugShell.tabs.find((tab) => tab.id === debugShell?.activeTabId);
  if (!active) return;
  active.url = currentAppPath();
  active.title = title;
  renderDebugShell();
}

function updateActiveDebugTabTitle(title: string): void {
  if (!debugShell) return;
  const active = debugShell.tabs.find((tab) => tab.id === debugShell?.activeTabId);
  if (!active || active.id === "debug-menu") return;
  active.title = title;
  renderDebugShell();
}

function renderDebugShell(): void {
  if (!debugShell) return;
  debugShell.root.innerHTML = `
    <div class="debug-pwa-tabs-list" role="tablist" aria-label="Debug PWA tabs">
      ${debugShell.tabs
        .map((tab) => {
          const selected = tab.id === debugShell?.activeTabId;
          return `
            <div class="debug-pwa-tab-item" data-selected="${selected ? "true" : "false"}">
              <button class="debug-pwa-tab" type="button" role="tab" aria-selected="${selected ? "true" : "false"}" data-debug-tab="${escapeAttribute(tab.id)}">
                <span>${escapeHTML(tab.title)}</span>
              </button>
              ${tab.id === "debug-menu" ? "" : `<button class="debug-pwa-tab-close" type="button" title="Close ${escapeAttribute(tab.title)}" aria-label="Close ${escapeAttribute(tab.title)}" data-debug-close-tab="${escapeAttribute(tab.id)}">x</button>`}
            </div>
          `;
        })
        .join("")}
    </div>
    <button class="debug-pwa-new-tab" type="button" title="New terminal tab" aria-label="New terminal tab" data-debug-new-tab>+</button>
  `;
}

function currentAppPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function isAppPath(pathname: string): boolean {
  return isSettingsPath(pathname) || pathname === "/terminal.html" || pathname === "/terminal";
}

function isSettingsPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/index.html";
}

function updateDiagnosticsTimer(): void {
  if (diagnosticsPanel.hidden) {
    if (diagnosticsTimer !== undefined) {
      window.clearInterval(diagnosticsTimer);
      diagnosticsTimer = undefined;
    }
    return;
  }
  renderDiagnostics();
  diagnosticsTimer ??= window.setInterval(renderDiagnostics, 1000);
}

async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    console.warn("service worker registration failed", error);
  }
}
