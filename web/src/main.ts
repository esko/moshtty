import { FitAddon, Terminal, init } from "ghostty-web";
import { shouldPassThroughSystemShortcut } from "./shortcuts";
import "./styles.css";

type Health = {
  status: string;
  version: string;
};

type Session = {
  token: string;
};

type AgentMessage = {
  type?: string;
  shell?: string;
  message?: string;
  code?: number;
};

type TerminalTab = {
  id: number;
  title: string;
  panel: HTMLElement;
  tabButton: HTMLElement;
  closeButton: HTMLButtonElement;
  socket: WebSocket | null;
  term: Terminal;
  fitAddon: FitAddon;
  lastCols: number;
  lastRows: number;
  pendingWrites: Array<string | Uint8Array>;
  pendingWriteFrame: number | undefined;
  pendingWheelFrame: number | undefined;
  pendingWheelLines: number;
  pendingFitFrame: number | undefined;
  status: "connecting" | "connected" | "offline";
  statusLabel: string;
};

const terminalRoot = requiredElement<HTMLElement>("#terminal");
const tabList = requiredElement<HTMLElement>("#tabList");
const statusEl = requiredElement<HTMLElement>("#status");
const offlineEl = requiredElement<HTMLElement>("#offline");
const reconnectButton = requiredElement<HTMLButtonElement>("#reconnect");
const newTabButton = requiredElement<HTMLButtonElement>("#newTab");
const diagnosticsToggle = requiredElement<HTMLButtonElement>("#diagnosticsToggle");
const diagnosticsPanel = requiredElement<HTMLElement>("#diagnostics");
const diagnosticsList = requiredElement<HTMLElement>("#diagnosticsList");

const tabs = new Map<number, TerminalTab>();
let activeTabId = 0;
let nextTabId = 1;
let diagnosticsTimer: number | undefined;

void boot();

newTabButton.addEventListener("click", () => {
  void createTab();
});

reconnectButton.addEventListener("click", () => {
  const tab = activeTab();
  if (tab) {
    void connect(tab);
  }
});

diagnosticsToggle.addEventListener("click", () => {
  diagnosticsPanel.hidden = !diagnosticsPanel.hidden;
  updateDiagnosticsTimer();
});

window.addEventListener("resize", scheduleActiveFit);

window.addEventListener("beforeunload", () => {
  if (diagnosticsTimer !== undefined) {
    window.clearInterval(diagnosticsTimer);
  }
  window.removeEventListener("resize", scheduleActiveFit);
  for (const tab of tabs.values()) {
    disposeTab(tab);
  }
});

async function boot(): Promise<void> {
  await init("/ghostty-vt.wasm");
  await registerServiceWorker();
  await createTab();
  updateDiagnosticsTimer();
}

async function createTab(): Promise<void> {
  const id = nextTabId++;
  const panel = document.createElement("section");
  panel.className = "terminal-pane";
  panel.setAttribute("role", "tabpanel");
  panel.id = `terminal-${id}`;
  panel.hidden = true;
  terminalRoot.append(panel);

  const tabButton = document.createElement("div");
  tabButton.className = "tab";
  tabButton.setAttribute("role", "tab");
  tabButton.setAttribute("aria-controls", panel.id);
  tabButton.tabIndex = -1;

  const title = document.createElement("span");
  title.className = "tab-title";
  title.textContent = `Terminal ${id}`;

  const closeButton = document.createElement("button");
  closeButton.className = "tab-close";
  closeButton.type = "button";
  closeButton.title = "Close tab";
  closeButton.setAttribute("aria-label", `Close Terminal ${id}`);
  closeButton.innerHTML = closeIcon();

  tabButton.append(title, closeButton);
  tabButton.addEventListener("click", () => {
    activateTab(id);
  });
  closeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    closeTab(id);
  });
  tabList.append(tabButton);

  const term = createTerminal();
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  const tab: TerminalTab = {
    id,
    title: `Terminal ${id}`,
    panel,
    tabButton,
    closeButton,
    socket: null,
    term,
    fitAddon,
    lastCols: 0,
    lastRows: 0,
    pendingWrites: [],
    pendingWriteFrame: undefined,
    pendingWheelFrame: undefined,
    pendingWheelLines: 0,
    pendingFitFrame: undefined,
    status: "connecting",
    statusLabel: "Connecting",
  };
  tabs.set(id, tab);

  installWheelHandler(tab);
  term.onData((data) => {
    sendAgentMessage(tab, { type: "input", data });
  });
  term.onResize(({ cols, rows }) => {
    tab.lastCols = cols;
    tab.lastRows = rows;
    sendAgentMessage(tab, { type: "resize", cols, rows });
    renderDiagnostics();
  });

  term.open(panel);
  fitAddon.fit();
  fitAddon.observeResize();

  activateTab(id);
  await connect(tab);
}

function createTerminal(): Terminal {
  const term = new Terminal({
    cols: 80,
    rows: 24,
    cursorBlink: true,
    cursorStyle: "block",
    fontFamily: "JetBrains Mono, Noto Sans Mono, monospace",
    fontSize: 15,
    scrollback: 5000,
    smoothScrollDuration: 0,
    scrollbarWidth: 0,
    theme: {
      background: "#000000",
      foreground: "#d7e0ea",
      cursor: "#d7e0ea",
      selectionBackground: "#2f5f91",
      black: "#101820",
      red: "#ff6b7a",
      green: "#7bd88f",
      yellow: "#f7c76b",
      blue: "#6ccff6",
      magenta: "#c792ea",
      cyan: "#5de4c7",
      white: "#d7e0ea",
      brightBlack: "#52677a",
      brightRed: "#ff8fa0",
      brightGreen: "#a5f3b1",
      brightYellow: "#ffe08a",
      brightBlue: "#9adfff",
      brightMagenta: "#d6a9ff",
      brightCyan: "#8df2dc",
      brightWhite: "#f0f4f8",
    },
  });

  term.attachCustomKeyEventHandler(
    ((event: KeyboardEvent) => {
      if (event.ctrlKey && !event.altKey && !event.metaKey && event.code === "KeyT") {
        void createTab();
        return true;
      }
      if (event.ctrlKey && !event.altKey && !event.metaKey && event.code === "KeyW") {
        closeActiveTab();
        return true;
      }
      return shouldPassThroughSystemShortcut(event) ? false : undefined;
    }) as (event: KeyboardEvent) => boolean,
  );

  return term;
}

async function connect(tab: TerminalTab): Promise<void> {
  setTabStatus(tab, "connecting", "Connecting");
  if (tab.id === activeTabId) {
    offlineEl.hidden = true;
  }
  tab.socket?.close();

  try {
    const health = await getJSON<Health>("/api/health");
    if (health.status !== "ok") {
      throw new Error(`Unexpected agent status: ${health.status}`);
    }
    const session = await getJSON<Session>("/api/session");
    if (!session.token) {
      throw new Error("Agent did not provide a session token");
    }

    const socket = new WebSocket(ptyURL(session.token));
    tab.socket = socket;
    socket.binaryType = "arraybuffer";
    socket.addEventListener("open", () => {
      if (tab.socket !== socket) return;
      setTabStatus(tab, "connected", health.version);
      tab.fitAddon.fit();
      if (tab.lastCols > 0 && tab.lastRows > 0) {
        sendAgentMessage(tab, { type: "resize", cols: tab.lastCols, rows: tab.lastRows });
      }
      if (tab.id === activeTabId) {
        tab.term.focus();
      }
    });
    socket.addEventListener("message", (event) => {
      if (tab.socket === socket) {
        handleSocketMessage(tab, event.data);
      }
    });
    socket.addEventListener("close", () => {
      if (tab.socket === socket && tab.status === "connected") {
        setTabStatus(tab, "offline", "Closed");
      }
    });
    socket.addEventListener("error", () => {
      if (tab.socket === socket) {
        setTabStatus(tab, "offline", "Offline");
      }
    });
  } catch (error) {
    console.error(error);
    setTabStatus(tab, "offline", "Offline");
  }
}

function activateTab(id: number): void {
  const selected = tabs.get(id);
  if (!selected) return;

  activeTabId = id;
  for (const tab of tabs.values()) {
    const active = tab.id === id;
    tab.panel.hidden = !active;
    tab.tabButton.dataset.active = String(active);
    tab.tabButton.setAttribute("aria-selected", String(active));
    tab.tabButton.tabIndex = active ? 0 : -1;
  }

  updateActiveStatus();
  selected.fitAddon.fit();
  selected.term.focus();
  renderDiagnostics();
}

function closeActiveTab(): void {
  if (activeTabId > 0) {
    closeTab(activeTabId);
  }
}

function closeTab(id: number): void {
  const tab = tabs.get(id);
  if (!tab) return;

  const wasActive = id === activeTabId;
  disposeTab(tab);
  tabs.delete(id);
  tab.panel.remove();
  tab.tabButton.remove();

  if (tabs.size === 0) {
    void createTab();
    return;
  }

  if (wasActive) {
    activateTab(tabs.keys().next().value as number);
  }
}

function disposeTab(tab: TerminalTab): void {
  if (tab.pendingWriteFrame !== undefined) {
    cancelAnimationFrame(tab.pendingWriteFrame);
  }
  if (tab.pendingWheelFrame !== undefined) {
    cancelAnimationFrame(tab.pendingWheelFrame);
  }
  if (tab.pendingFitFrame !== undefined) {
    cancelAnimationFrame(tab.pendingFitFrame);
  }
  tab.socket?.close();
  tab.term.dispose();
}

function scheduleActiveFit(): void {
  const tab = activeTab();
  if (!tab || tab.pendingFitFrame !== undefined) {
    return;
  }
  tab.pendingFitFrame = requestAnimationFrame(() => {
    tab.pendingFitFrame = undefined;
    if (tab.id === activeTabId) {
      tab.fitAddon.fit();
    }
  });
}

function handleSocketMessage(tab: TerminalTab, data: string | ArrayBuffer | Blob): void {
  if (typeof data === "string") {
    handleAgentText(tab, data);
    return;
  }
  if (data instanceof ArrayBuffer) {
    enqueueTerminalWrite(tab, new Uint8Array(data));
    return;
  }
  void data.arrayBuffer().then((buffer) => {
    enqueueTerminalWrite(tab, new Uint8Array(buffer));
  });
}

function handleAgentText(tab: TerminalTab, data: string): void {
  try {
    const message = JSON.parse(data) as AgentMessage;
    if (message.type === "status" && message.shell) {
      const title = pathBaseName(message.shell);
      setTabTitle(tab, title);
      setTabStatus(tab, "connected", title);
    } else if (message.type === "exit") {
      enqueueTerminalWrite(tab, `\r\n[process exited ${message.code ?? 0}]\r\n`);
      setTabStatus(tab, "offline", "Exited");
    } else if (message.type === "error") {
      enqueueTerminalWrite(tab, `\r\n[agent error] ${message.message ?? data}\r\n`);
    }
  } catch {
    enqueueTerminalWrite(tab, data);
  }
}

function enqueueTerminalWrite(tab: TerminalTab, data: string | Uint8Array): void {
  tab.pendingWrites.push(data);
  if (tab.pendingWriteFrame !== undefined) {
    return;
  }
  tab.pendingWriteFrame = requestAnimationFrame(() => flushTerminalWrites(tab));
}

function flushTerminalWrites(tab: TerminalTab): void {
  tab.pendingWriteFrame = undefined;
  if (tab.pendingWrites.length === 0) {
    return;
  }

  const writes = tab.pendingWrites.splice(0);
  let text = "";
  let bytes: Uint8Array[] = [];
  for (const write of writes) {
    if (typeof write === "string") {
      if (bytes.length > 0) {
        tab.term.write(concatBytes(bytes));
        bytes = [];
      }
      text += write;
    } else {
      if (text) {
        tab.term.write(text);
        text = "";
      }
      bytes.push(write);
    }
  }

  if (text) {
    tab.term.write(text);
  }
  if (bytes.length > 0) {
    tab.term.write(concatBytes(bytes));
  }
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) {
    return chunks[0];
  }
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function installWheelHandler(tab: TerminalTab): void {
  tab.term.attachCustomWheelEventHandler((event) => {
    if (tab.term.wasmTerm?.isAlternateScreen()) {
      return false;
    }

    const lineHeight = tab.term.renderer?.getMetrics().height ?? 20;
    let deltaLines: number;
    if (event.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
      deltaLines = event.deltaY / lineHeight;
    } else if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      deltaLines = event.deltaY;
    } else {
      deltaLines = event.deltaY * tab.term.rows;
    }

    tab.pendingWheelLines += deltaLines;
    if (tab.pendingWheelFrame === undefined) {
      tab.pendingWheelFrame = requestAnimationFrame(() => {
        tab.pendingWheelFrame = undefined;
        const lines = tab.pendingWheelLines;
        tab.pendingWheelLines = 0;
        if (lines !== 0) {
          tab.term.scrollLines(lines);
        }
      });
    }
    return true;
  });
}

function sendAgentMessage(tab: TerminalTab, message: Record<string, unknown>): void {
  if (!tab.socket || tab.socket.readyState !== WebSocket.OPEN) {
    return;
  }
  tab.socket.send(JSON.stringify(message));
}

async function getJSON<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

function ptyURL(token: string): string {
  const url = new URL("/pty", window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  return url.toString();
}

function setTabTitle(tab: TerminalTab, title: string): void {
  tab.title = title;
  const label = tab.tabButton.querySelector<HTMLElement>(".tab-title");
  if (label) {
    label.textContent = title;
  }
  tab.closeButton.setAttribute("aria-label", `Close ${title}`);
}

function setTabStatus(
  tab: TerminalTab,
  state: "connecting" | "connected" | "offline",
  label: string,
): void {
  tab.status = state;
  tab.statusLabel = label;
  tab.tabButton.dataset.state = state;
  if (tab.id === activeTabId) {
    updateActiveStatus();
  }
}

function updateActiveStatus(): void {
  const tab = activeTab();
  if (!tab) return;
  statusEl.dataset.state = tab.status;
  statusEl.textContent = tab.statusLabel;
  offlineEl.hidden = tab.status !== "offline";
}

function renderDiagnostics(): void {
  if (diagnosticsPanel.hidden) {
    return;
  }

  const tab = activeTab();
  const canvas = tab?.panel.querySelector("canvas");
  const rect = canvas?.getBoundingClientRect() ?? tab?.panel.getBoundingClientRect();
  diagnosticsList.innerHTML = "";
  for (const [label, value] of [
    ["Renderer", "ghostty-web/canvas"],
    ["Core", "ghostty-vt"],
    ["Tab", tab ? `${tab.id} (${tab.title})` : "?"],
    ["DPR", formatNumber(window.devicePixelRatio || 1)],
    ["Canvas", canvas ? `${canvas.width} x ${canvas.height}` : "?"],
    ["CSS", rect ? `${formatNumber(rect.width)} x ${formatNumber(rect.height)}` : "?"],
    ["Grid", tab ? `${tab.term.cols || tab.lastCols} x ${tab.term.rows || tab.lastRows}` : "?"],
    ["Transport", socketState(tab?.socket ?? null)],
  ]) {
    const termEl = document.createElement("dt");
    termEl.textContent = label;
    const description = document.createElement("dd");
    description.textContent = String(value);
    diagnosticsList.append(termEl, description);
  }
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

function activeTab(): TerminalTab | undefined {
  return tabs.get(activeTabId);
}

function socketState(ws: WebSocket | null): string {
  switch (ws?.readyState) {
    case WebSocket.CONNECTING:
      return "connecting";
    case WebSocket.OPEN:
      return "open";
    case WebSocket.CLOSING:
      return "closing";
    case WebSocket.CLOSED:
      return "closed";
    default:
      return "none";
  }
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return value.toFixed(2).replace(/\.00$/, "");
}

function pathBaseName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function newTabIcon(): string {
  return `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 3.25a.75.75 0 0 1 .75.75v3.25H12a.75.75 0 0 1 0 1.5H8.75V12a.75.75 0 0 1-1.5 0V8.75H4a.75.75 0 0 1 0-1.5h3.25V4A.75.75 0 0 1 8 3.25Z"/></svg>`;
}

function closeIcon(): string {
  return `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4.22 4.22a.75.75 0 0 1 1.06 0L8 6.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L9.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L8 9.06l-2.72 2.72a.75.75 0 0 1-1.06-1.06L6.94 8 4.22 5.28a.75.75 0 0 1 0-1.06Z"/></svg>`;
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element ${selector}`);
  }
  return element;
}

async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    console.warn("service worker registration failed", error);
  }
}

newTabButton.innerHTML = newTabIcon();
