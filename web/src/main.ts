import { FitAddon, Terminal, init } from "ghostty-web";
import { getAgentToken, getJSON, patchJSON, postJSON, ptyURL } from "./api";
import { concatBytes, escapeAttribute, escapeHTML, formatNumber, pathBaseName, requiredElement, socketState } from "./dom";
import { applySplitRatio, firstLeaf, layoutLeaves, ratioFromKeyboard, ratioFromPointer, splitRatio } from "./layout";
import {
  DEFAULT_SETTINGS,
  loadCustomFont,
  loadSettings,
  normalizeSettings,
  saveSettings,
  terminalFontFamily,
  terminalTheme,
} from "./settings";
import { shouldPassThroughSystemShortcut } from "./shortcuts";
import type { AgentMessage, SessionLayoutNode, TerminalSession, TerminalSettings, Workspace } from "./types";
import "./styles.css";

const APP_TITLE = "Crostini Ghostty";

const settingsRoot = requiredElement<HTMLElement>("#settings");
const terminalRoot = requiredElement<HTMLElement>("#terminal");
const statusEl = requiredElement<HTMLElement>("#status");
const offlineEl = requiredElement<HTMLElement>("#offline");
const reconnectButton = requiredElement<HTMLButtonElement>("#reconnect");
const diagnosticsToggle = requiredElement<HTMLButtonElement>("#diagnosticsToggle");
const diagnosticsPanel = requiredElement<HTMLElement>("#diagnostics");
const diagnosticsList = requiredElement<HTMLElement>("#diagnosticsList");
const contextMenu = requiredElement<HTMLElement>("#terminalContextMenu");

let settings = loadSettings();
let currentWorkspace: Workspace | null = null;
let parentSessionId = "";
let activePaneId = "";
let diagnosticsTimer: number | undefined;
let pendingFitFrame: number | undefined;
let activeResize: SplitResizeState | null = null;
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
  hasAttached = false;
  private pendingWriteFrame: number | undefined;
  private readonly pendingWrites: Array<string | Uint8Array> = [];
  private pendingWheelFrame: number | undefined;
  private pendingWheelLines = 0;

  constructor(id: string, root: HTMLElement) {
    this.id = id;
    this.root = root;
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
        this.title = pathBaseName(message.shell);
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

  if (isSettingsRoute()) {
    renderSettingsPage();
    return;
  }

  settingsRoot.hidden = true;
  terminalRoot.hidden = false;
  document.title = `Terminal - ${APP_TITLE}`;
  await loadCustomFont(settings);
  await init("/ghostty-vt.wasm");
  parentSessionId = await ensureParentSession();
  const workspace = await getJSON<Workspace>(`/api/terminal-sessions/${encodeURIComponent(parentSessionId)}`);
  renderWorkspace(workspace, firstLeaf(workspace.layout));
  updateDiagnosticsTimer();
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
    panes.set(node.sessionId, new TerminalPane(node.sessionId, paneRoot));
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
    const workspace = await patchJSON<Workspace>(`/api/terminal-sessions/${encodeURIComponent(parentSessionId)}/layout`, {
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
    const workspace = await getJSON<Workspace>(`/api/terminal-sessions/${encodeURIComponent(parentSessionId)}`);
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
    case "new-tab":
      window.open("/terminal.html", "_blank");
      break;
    case "split-right":
    case "split":
      await splitActivePane("horizontal");
      break;
    case "split-down":
      await splitActivePane("vertical");
      break;
    case "detach":
      await detachActivePane();
      break;
    case "close-pane":
      await closeActivePane();
      break;
    case "clear":
      activePane()?.term.clear();
      break;
    case "settings":
      window.open("/", "_blank");
      break;
  }
}

async function splitActivePane(direction: "horizontal" | "vertical"): Promise<void> {
  const target = activePaneId || firstLeaf(currentWorkspace?.layout);
  if (!parentSessionId || !target) return;
  const workspace = await postJSON<Workspace>(`/api/terminal-sessions/${encodeURIComponent(parentSessionId)}/splits`, {
    targetSessionId: target,
    direction,
  });
  const previous = new Set(panes.keys());
  const focus = layoutLeaves(workspace.layout).find((id) => !previous.has(id)) ?? target;
  renderWorkspace(workspace, focus);
}

async function detachActivePane(): Promise<void> {
  if (!parentSessionId || !activePaneId || activePaneId === parentSessionId) return;
  const session = await postJSON<TerminalSession>(`/api/terminal-sessions/${encodeURIComponent(parentSessionId)}/detach`, {
    sessionId: activePaneId,
  });
  window.open(`/terminal.html?session=${encodeURIComponent(session.id)}`, "_blank");
  const workspace = await getJSON<Workspace>(`/api/terminal-sessions/${encodeURIComponent(parentSessionId)}`);
  renderWorkspace(workspace, firstLeaf(workspace.layout));
}

async function closeActivePane(): Promise<void> {
  if (!activePaneId || !currentWorkspace) return;
  if (activePaneId === parentSessionId && layoutLeaves(currentWorkspace.layout).length > 1) return;
  const response = await fetch(`/api/terminal-sessions/${encodeURIComponent(activePaneId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) return;
  if (activePaneId === parentSessionId) {
    window.close();
    return;
  }
  const workspace = await getJSON<Workspace>(`/api/terminal-sessions/${encodeURIComponent(parentSessionId)}`);
  renderWorkspace(workspace, firstLeaf(workspace.layout));
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

function disposePanes(): void {
  for (const pane of panes.values()) pane.dispose();
  panes.clear();
}

function showContextMenu(x: number, y: number): void {
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

async function ensureParentSession(): Promise<string> {
  const current = currentSessionId();
  if (current) return current;
  const nextSession = await postJSON<TerminalSession>("/api/terminal-sessions");
  const url = new URL(window.location.href);
  url.searchParams.set("session", nextSession.id);
  window.history.replaceState(null, "", url);
  return nextSession.id;
}

function currentSessionId(): string {
  const session = new URL(window.location.href).searchParams.get("session") ?? "";
  return /^[a-z0-9][a-z0-9-]{2,63}$/.test(session) ? session : "";
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
    ["Parent", parentSessionId || "?"],
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
        <p class="settings-intro">Open terminal workspaces and tune defaults for new Crostini shell sessions.</p>
      </div>
      <div class="menu-actions">
        <a class="primary-link" href="/terminal.html">New terminal</a>
        <button class="secondary-button" type="button" id="focusSettings">Settings</button>
      </div>
    </section>

    <section class="quick-grid" aria-label="Quick actions">
      <a class="quick-action" href="/terminal.html">
        <strong>New terminal</strong>
        <span>Start a fresh Crostini workspace.</span>
      </a>
      <button class="quick-action" type="button" id="copyLaunchCommand">
        <strong>Agent command</strong>
        <span>Copy the local launch command.</span>
      </button>
      <button class="quick-action" type="button" id="resetSettingsQuick">
        <strong>Reset profile</strong>
        <span>Restore terminal defaults.</span>
      </button>
    </section>

    <section class="session-panel" aria-labelledby="sessionsTitle">
      <div class="section-heading">
        <div>
          <h2 id="sessionsTitle">Sessions</h2>
          <p>Open parent workspaces or remove session trees you no longer need.</p>
        </div>
        <button class="secondary-button" type="button" id="refreshSessions">Refresh</button>
      </div>
      <div id="sessionList" class="session-list" aria-live="polite">
        <div class="session-empty">Loading sessions</div>
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
          <span><strong>Theme</strong><small>Choose the terminal color palette used by new tabs.</small></span>
          <select id="theme" name="theme">
            <option value="dark">Dark</option>
            <option value="highContrast">High contrast</option>
            <option value="soft">Soft</option>
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
  const scrollback = requiredElement<HTMLSelectElement>("#scrollback");
  const cursorBlink = requiredElement<HTMLInputElement>("#cursorBlink");
  theme.value = settings.theme;
  scrollback.value = String(settings.scrollback);
  cursorBlink.checked = settings.cursorBlink;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    settings = readSettingsForm();
    saveSettings(settings);
  });
  const reset = () => {
    settings = { ...DEFAULT_SETTINGS };
    saveSettings(settings);
    renderSettingsPage();
  };
  requiredElement<HTMLButtonElement>("#resetSettings").addEventListener("click", reset);
  requiredElement<HTMLButtonElement>("#resetSettingsQuick").addEventListener("click", reset);
  requiredElement<HTMLButtonElement>("#focusSettings").addEventListener("click", () => {
    requiredElement<HTMLElement>("#settingsActions").scrollIntoView({ behavior: "smooth", block: "end" });
  });
  requiredElement<HTMLButtonElement>("#copyLaunchCommand").addEventListener("click", async () => {
    await navigator.clipboard?.writeText("cd ~/crostini-ghostty-terminal/agent && go run . -web-dir ../web/dist");
  });
  requiredElement<HTMLButtonElement>("#refreshSessions").addEventListener("click", () => {
    void renderSessionList();
  });
  void renderSessionList();
}

async function renderSessionList(): Promise<void> {
  const list = requiredElement<HTMLElement>("#sessionList");
  list.innerHTML = `<div class="session-empty">Loading sessions</div>`;
  try {
    const sessions = await getJSON<TerminalSession[]>("/api/terminal-sessions");
    if (sessions.length === 0) {
      list.innerHTML = `<div class="session-empty">No saved terminal sessions</div>`;
      return;
    }
    list.replaceChildren(
      ...sessions.map((session) => {
        const row = document.createElement("article");
        row.className = "session-row";
        row.innerHTML = `
          <div class="session-main">
            <strong>${escapeHTML(sessionTitle(session))}</strong>
            <span>${escapeHTML(session.id)}${session.paneCount ? ` · ${session.paneCount} pane${session.paneCount === 1 ? "" : "s"}` : ""}</span>
          </div>
          <div class="session-meta">
            <span class="session-status" data-state="${escapeAttribute(session.status)}">${escapeHTML(session.status)}</span>
            <time>${escapeHTML(formatSessionDate(session.createdAt))}</time>
          </div>
          <div class="session-actions">
            <a class="icon-button" href="/terminal.html?session=${encodeURIComponent(session.id)}" title="Open session" aria-label="Open ${escapeAttribute(sessionTitle(session))} in a new tab">
              <span aria-hidden="true">↗</span>
            </a>
            <button class="icon-button danger" type="button" title="Remove session" aria-label="Remove ${escapeAttribute(sessionTitle(session))}" data-delete-session="${escapeAttribute(session.id)}">
              <span aria-hidden="true">${trashIcon()}</span>
            </button>
          </div>
        `;
        return row;
      }),
    );
  } catch (error) {
    console.error(error);
    list.innerHTML = `<div class="session-empty">Unable to load sessions</div>`;
  }
}

document.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button[data-delete-session]");
  if (!button) return;
  const sessionId = button.dataset.deleteSession;
  if (!sessionId) return;
  void deleteTerminalSession(sessionId);
});

async function deleteTerminalSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/terminal-sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) {
    console.error(`delete session ${sessionId} failed with ${response.status}`);
    return;
  }
  await renderSessionList();
}

function readSettingsForm(): TerminalSettings {
  return normalizeSettings({
    fontFamily: requiredElement<HTMLInputElement>("#fontFamily").value,
    customFontName: requiredElement<HTMLInputElement>("#customFontName").value,
    customFontUrl: requiredElement<HTMLInputElement>("#customFontUrl").value,
    fontSize: Number(requiredElement<HTMLInputElement>("#fontSize").value),
    scrollback: Number(requiredElement<HTMLSelectElement>("#scrollback").value),
    cursorBlink: requiredElement<HTMLInputElement>("#cursorBlink").checked,
    theme: requiredElement<HTMLSelectElement>("#theme").value,
    scrollSensitivity: Number(requiredElement<HTMLInputElement>("#scrollSensitivity").value),
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
