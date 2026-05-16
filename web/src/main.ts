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

type TerminalSettings = {
  fontSize: number;
  scrollback: number;
  cursorBlink: boolean;
  theme: "dark" | "highContrast" | "soft";
  scrollSensitivity: number;
};

const APP_TITLE = "Crostini Ghostty";
const SETTINGS_KEY = "crostini-ghostty-terminal-settings";
const DEFAULT_SETTINGS: TerminalSettings = {
  fontSize: 15,
  scrollback: 5000,
  cursorBlink: true,
  theme: "dark",
  scrollSensitivity: 1,
};

const settingsRoot = requiredElement<HTMLElement>("#settings");
const terminalRoot = requiredElement<HTMLElement>("#terminal");
const statusEl = requiredElement<HTMLElement>("#status");
const offlineEl = requiredElement<HTMLElement>("#offline");
const reconnectButton = requiredElement<HTMLButtonElement>("#reconnect");
const diagnosticsToggle = requiredElement<HTMLButtonElement>("#diagnosticsToggle");
const diagnosticsPanel = requiredElement<HTMLElement>("#diagnostics");
const diagnosticsList = requiredElement<HTMLElement>("#diagnosticsList");

let socket: WebSocket | null = null;
let term: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let lastCols = 0;
let lastRows = 0;
let diagnosticsTimer: number | undefined;
let pendingWriteFrame: number | undefined;
const pendingWrites: Array<string | Uint8Array> = [];
let pendingWheelFrame: number | undefined;
let pendingWheelLines = 0;
let pendingFitFrame: number | undefined;
let startupResizeTimer: number | undefined;
let startupResizeRestoreTimer: number | undefined;
let startupResizePending = false;
let startupResizeState = "idle";
let titleLabel = "Terminal";
let settings = loadSettings();

void boot();

reconnectButton.addEventListener("click", () => {
  void connect();
});

diagnosticsToggle.addEventListener("click", () => {
  diagnosticsPanel.hidden = !diagnosticsPanel.hidden;
  updateDiagnosticsTimer();
});

window.addEventListener("resize", scheduleFit);

window.addEventListener("beforeunload", () => {
  if (pendingWriteFrame !== undefined) cancelAnimationFrame(pendingWriteFrame);
  if (pendingWheelFrame !== undefined) cancelAnimationFrame(pendingWheelFrame);
  if (pendingFitFrame !== undefined) cancelAnimationFrame(pendingFitFrame);
  cancelStartupResizePulse();
  if (diagnosticsTimer !== undefined) window.clearInterval(diagnosticsTimer);
  window.removeEventListener("resize", scheduleFit);
  socket?.close();
  term?.dispose();
});

async function boot(): Promise<void> {
  await registerServiceWorker();

  if (isSettingsRoute()) {
    renderSettingsPage();
    return;
  }

  settingsRoot.hidden = true;
  terminalRoot.hidden = false;
  document.title = `Terminal - ${APP_TITLE}`;
  await init("/ghostty-vt.wasm");

  term = createTerminal();
  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  installWheelHandler(term);
  term.onData((data) => {
    cancelStartupResizePulse();
    sendAgentMessage({ type: "input", data });
  });
  term.onResize(({ cols, rows }) => {
    lastCols = cols;
    lastRows = rows;
    sendAgentMessage({ type: "resize", cols, rows });
    renderDiagnostics();
  });
  term.open(terminalRoot);
  fitAddon.fit();
  fitAddon.observeResize();
  term.focus();

  await connect();
  updateDiagnosticsTimer();
}

function createTerminal(): Terminal {
  const nextTerm = new Terminal({
    cols: 80,
    rows: 24,
    cursorBlink: settings.cursorBlink,
    cursorStyle: "block",
    fontFamily: "JetBrains Mono, Noto Sans Mono, monospace",
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

function scheduleFit(): void {
  if (pendingFitFrame !== undefined) return;
  pendingFitFrame = requestAnimationFrame(() => {
    pendingFitFrame = undefined;
    fitAddon?.fit();
  });
}

async function connect(): Promise<void> {
  setStatus("connecting", "Connecting");
  setTitle("Terminal");
  offlineEl.hidden = true;
  armStartupResizePulse();
  socket?.close();

  try {
    const health = await getJSON<Health>("/api/health");
    if (health.status !== "ok") {
      throw new Error(`Unexpected agent status: ${health.status}`);
    }
    const session = await getJSON<Session>("/api/session");
    if (!session.token) {
      throw new Error("Agent did not provide a session token");
    }

    socket = new WebSocket(ptyURL(session.token));
    socket.binaryType = "arraybuffer";
    socket.addEventListener("open", () => {
      setStatus("connected", health.version);
      fitAddon?.fit();
      if (lastCols > 0 && lastRows > 0) {
        sendAgentMessage({ type: "resize", cols: lastCols, rows: lastRows });
      }
      term?.focus();
    });
    socket.addEventListener("message", (event) => {
      handleSocketMessage(event.data);
    });
    socket.addEventListener("close", () => {
      if (statusEl.dataset.state === "connected") {
        setStatus("offline", "Closed");
      }
    });
    socket.addEventListener("error", () => {
      setStatus("offline", "Offline");
      offlineEl.hidden = false;
    });
  } catch (error) {
    console.error(error);
    offlineEl.hidden = false;
    setStatus("offline", "Offline");
  }
}

function handleSocketMessage(data: string | ArrayBuffer | Blob): void {
  if (typeof data === "string") {
    handleAgentText(data);
    return;
  }
  if (data instanceof ArrayBuffer) {
    enqueueTerminalWrite(new Uint8Array(data));
    scheduleStartupResizePulse();
    return;
  }
  void data.arrayBuffer().then((buffer) => {
    enqueueTerminalWrite(new Uint8Array(buffer));
    scheduleStartupResizePulse();
  });
}

function handleAgentText(data: string): void {
  try {
    const message = JSON.parse(data) as AgentMessage;
    if (message.type === "status" && message.shell) {
      const shell = pathBaseName(message.shell);
      setTitle(shell);
      setStatus("connected", shell);
      clearTerminal();
    } else if (message.type === "exit") {
      enqueueTerminalWrite(`\r\n[process exited ${message.code ?? 0}]\r\n`);
      setStatus("offline", "Exited");
    } else if (message.type === "error") {
      enqueueTerminalWrite(`\r\n[agent error] ${message.message ?? data}\r\n`);
    }
  } catch {
    enqueueTerminalWrite(data);
  }
}

function clearTerminal(): void {
  term?.clear();
}

function armStartupResizePulse(): void {
  cancelStartupResizePulse();
  startupResizePending = true;
  startupResizeState = "armed";
}

function scheduleStartupResizePulse(): void {
  if (!startupResizePending) return;
  if (startupResizeTimer !== undefined) {
    window.clearTimeout(startupResizeTimer);
  }
  startupResizeTimer = window.setTimeout(runStartupResizePulse, 80);
  startupResizeState = "waiting for idle output";
}

function runStartupResizePulse(): void {
  startupResizeTimer = undefined;
  if (!startupResizePending || !term) return;

  fitAddon?.fit();
  const cols = term.cols || lastCols;
  const rows = term.rows || lastRows;
  if (cols < 2 || rows < 3) {
    startupResizePending = false;
    startupResizeState = `skipped (${cols}x${rows})`;
    renderDiagnostics();
    return;
  }

  startupResizeState = `${cols}x${rows - 1} -> ${cols}x${rows}`;
  sendAgentMessage({ type: "resize", cols, rows: rows - 1 });
  startupResizeRestoreTimer = window.setTimeout(() => {
    startupResizeRestoreTimer = undefined;
    sendAgentMessage({ type: "resize", cols, rows });
    startupResizePending = false;
    renderDiagnostics();
  }, 30);
  renderDiagnostics();
}

function cancelStartupResizePulse(): void {
  startupResizePending = false;
  if (startupResizeTimer !== undefined) {
    window.clearTimeout(startupResizeTimer);
    startupResizeTimer = undefined;
  }
  if (startupResizeRestoreTimer !== undefined) {
    window.clearTimeout(startupResizeRestoreTimer);
    startupResizeRestoreTimer = undefined;
  }
  startupResizeState = "cancelled";
}

function enqueueTerminalWrite(data: string | Uint8Array): void {
  pendingWrites.push(data);
  if (pendingWriteFrame !== undefined) return;
  pendingWriteFrame = requestAnimationFrame(flushTerminalWrites);
}

function flushTerminalWrites(): void {
  pendingWriteFrame = undefined;
  if (!term || pendingWrites.length === 0) {
    pendingWrites.length = 0;
    return;
  }

  const writes = pendingWrites.splice(0);
  let text = "";
  let bytes: Uint8Array[] = [];
  for (const write of writes) {
    if (typeof write === "string") {
      if (bytes.length > 0) {
        term.write(concatBytes(bytes));
        bytes = [];
      }
      text += write;
    } else {
      if (text) {
        term.write(text);
        text = "";
      }
      bytes.push(write);
    }
  }

  if (text) term.write(text);
  if (bytes.length > 0) term.write(concatBytes(bytes));
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0];
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function installWheelHandler(target: Terminal): void {
  target.attachCustomWheelEventHandler((event) => {
    if (target.wasmTerm?.isAlternateScreen()) {
      return false;
    }

    const lineHeight = target.renderer?.getMetrics().height ?? 20;
    let deltaLines: number;
    if (event.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
      deltaLines = (event.deltaY / lineHeight) * settings.scrollSensitivity;
    } else if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      deltaLines = event.deltaY;
    } else {
      deltaLines = event.deltaY * target.rows;
    }

    pendingWheelLines += deltaLines;
    if (pendingWheelFrame === undefined) {
      pendingWheelFrame = requestAnimationFrame(() => {
        pendingWheelFrame = undefined;
        const lines = pendingWheelLines;
        pendingWheelLines = 0;
        if (lines !== 0) {
          target.scrollLines(lines);
        }
      });
    }
    return true;
  });
}

function sendAgentMessage(message: Record<string, unknown>): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(message));
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

function setStatus(state: "connecting" | "connected" | "offline", label: string): void {
  statusEl.dataset.state = state;
  statusEl.textContent = label;
}

function setTitle(label: string): void {
  titleLabel = label;
  document.title = `${label} - ${APP_TITLE}`;
}

function renderDiagnostics(): void {
  if (diagnosticsPanel.hidden) return;

  const canvas = terminalRoot.querySelector("canvas");
  const rect = canvas?.getBoundingClientRect() ?? terminalRoot.getBoundingClientRect();
  diagnosticsList.innerHTML = "";
  for (const [label, value] of [
    ["Renderer", "ghostty-web/canvas"],
    ["Core", "ghostty-vt"],
    ["Title", titleLabel],
    ["DPR", formatNumber(window.devicePixelRatio || 1)],
    ["Canvas", canvas ? `${canvas.width} x ${canvas.height}` : "?"],
    ["CSS", `${formatNumber(rect.width)} x ${formatNumber(rect.height)}`],
    ["Grid", `${(term?.cols ?? lastCols) || "?"} x ${(term?.rows ?? lastRows) || "?"}`],
    ["Transport", socketState(socket)],
    ["Startup resize", startupResizeState],
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
        <p class="settings-intro">Open terminal tabs and tune defaults for new Crostini shell sessions.</p>
      </div>
      <div class="menu-actions">
        <a class="primary-link" href="/terminal.html">New terminal</a>
        <button class="secondary-button" type="button" id="focusSettings">Settings</button>
      </div>
    </section>

    <section class="quick-grid" aria-label="Quick actions">
      <a class="quick-action" href="/terminal.html">
        <strong>New terminal</strong>
        <span>Start a fresh Crostini shell tab.</span>
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

    <form id="settingsForm" class="settings-form">
      <section class="settings-section">
        <h2>Display</h2>
        <label class="setting-row">
          <span>
            <strong>Font size</strong>
            <small>Controls terminal grid density and readability.</small>
          </span>
          <input id="fontSize" name="fontSize" type="number" min="12" max="22" step="1" value="${settings.fontSize}" />
        </label>
        <label class="setting-row">
          <span>
            <strong>Theme</strong>
            <small>Choose the terminal color palette used by new tabs.</small>
          </span>
          <select id="theme" name="theme">
            <option value="dark">Dark</option>
            <option value="highContrast">High contrast</option>
            <option value="soft">Soft</option>
          </select>
        </label>
        <label class="setting-row">
          <span>
            <strong>Blinking cursor</strong>
            <small>Disable this if cursor blinking is distracting.</small>
          </span>
          <input id="cursorBlink" name="cursorBlink" type="checkbox" />
        </label>
      </section>

      <section class="settings-section">
        <h2>History and Input</h2>
        <label class="setting-row">
          <span>
            <strong>Scrollback lines</strong>
            <small>Higher values keep more history and use more memory.</small>
          </span>
          <select id="scrollback" name="scrollback">
            <option value="1000">1,000</option>
            <option value="5000">5,000</option>
            <option value="10000">10,000</option>
            <option value="20000">20,000</option>
          </select>
        </label>
        <label class="setting-row">
          <span>
            <strong>Scroll sensitivity</strong>
            <small>Adjust trackpad and mouse-wheel scroll speed.</small>
          </span>
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
    await navigator.clipboard?.writeText(
      "cd ~/crostini-ghostty-terminal/agent && go run . -web-dir ../web/dist",
    );
  });
}

function readSettingsForm(): TerminalSettings {
  return normalizeSettings({
    fontSize: Number(requiredElement<HTMLInputElement>("#fontSize").value),
    scrollback: Number(requiredElement<HTMLSelectElement>("#scrollback").value),
    cursorBlink: requiredElement<HTMLInputElement>("#cursorBlink").checked,
    theme: requiredElement<HTMLSelectElement>("#theme").value,
    scrollSensitivity: Number(requiredElement<HTMLInputElement>("#scrollSensitivity").value),
  });
}

function loadSettings(): TerminalSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(nextSettings: TerminalSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
}

function normalizeSettings(value: Partial<TerminalSettings> | Record<string, unknown>): TerminalSettings {
  const fontSize = Number(value.fontSize);
  const scrollback = Number(value.scrollback);
  const scrollSensitivity = Number(value.scrollSensitivity);
  const theme = value.theme === "highContrast" || value.theme === "soft" ? value.theme : "dark";

  return {
    fontSize: Number.isFinite(fontSize) ? clamp(Math.round(fontSize), 12, 22) : DEFAULT_SETTINGS.fontSize,
    scrollback: [1000, 5000, 10000, 20000].includes(scrollback)
      ? scrollback
      : DEFAULT_SETTINGS.scrollback,
    cursorBlink:
      typeof value.cursorBlink === "boolean" ? value.cursorBlink : DEFAULT_SETTINGS.cursorBlink,
    theme,
    scrollSensitivity: Number.isFinite(scrollSensitivity)
      ? clamp(scrollSensitivity, 0.5, 2)
      : DEFAULT_SETTINGS.scrollSensitivity,
  };
}

function terminalTheme(theme: TerminalSettings["theme"]) {
  if (theme === "highContrast") {
    return {
      background: "#000000",
      foreground: "#ffffff",
      cursor: "#ffffff",
      selectionBackground: "#345f9f",
      black: "#000000",
      red: "#ff5c57",
      green: "#5af78e",
      yellow: "#f3f99d",
      blue: "#57c7ff",
      magenta: "#ff6ac1",
      cyan: "#9aedfe",
      white: "#f1f1f0",
      brightBlack: "#686868",
      brightRed: "#ff5c57",
      brightGreen: "#5af78e",
      brightYellow: "#f3f99d",
      brightBlue: "#57c7ff",
      brightMagenta: "#ff6ac1",
      brightCyan: "#9aedfe",
      brightWhite: "#ffffff",
    };
  }
  if (theme === "soft") {
    return {
      background: "#080d12",
      foreground: "#d8dee9",
      cursor: "#e5edf5",
      selectionBackground: "#334b5f",
      black: "#1b2632",
      red: "#e06c75",
      green: "#98c379",
      yellow: "#d19a66",
      blue: "#61afef",
      magenta: "#c678dd",
      cyan: "#56b6c2",
      white: "#d8dee9",
      brightBlack: "#607080",
      brightRed: "#ef7b84",
      brightGreen: "#a7d388",
      brightYellow: "#e0aa75",
      brightBlue: "#70befd",
      brightMagenta: "#d587ec",
      brightCyan: "#65c5d1",
      brightWhite: "#eef4fb",
    };
  }
  return {
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
  };
}

function isSettingsRoute(): boolean {
  return window.location.pathname === "/" || window.location.pathname === "/index.html";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(2).replace(/\.00$/, "");
}

function pathBaseName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element ${selector}`);
  }
  return element;
}

async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    console.warn("service worker registration failed", error);
  }
}
