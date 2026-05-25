import { escapeAttribute, escapeHTML } from "./dom";

export type DebugShellTab = {
  id: string;
  title: string;
  url: string;
};

export type DebugShellState = {
  root: HTMLElement;
  tabs: DebugShellTab[];
  activeTabId: string;
  nextTabNumber: number;
};

const DEBUG_SHELL_PARAM = "debug-shell";

let state: DebugShellState | null = null;
let onRouteChange: (() => Promise<void>) | null = null;

function isDebugShellEnabled(): boolean {
  const value = new URL(window.location.href).searchParams.get(DEBUG_SHELL_PARAM);
  return value === "1" || value === "true";
}

export function isAppPath(pathname: string): boolean {
  return isSettingsPath(pathname) || pathname === "/terminal.html" || pathname === "/terminal";
}

export function isSettingsPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/index.html";
}

export function currentAppPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function appURL(path: string): string {
  const url = new URL(path, window.location.href);
  if (isDebugShellEnabled()) url.searchParams.set(DEBUG_SHELL_PARAM, "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function openAppURL(path: string, options: { newTab?: boolean } = {}): void {
  const url = appURL(path);
  if (!state) {
    window.open(url, options.newTab ? "_blank" : "_self");
    return;
  }
  void navigateDebugShell(url, options);
}

export function initDebugShell(appRoot: HTMLElement, renderCurrentRoute: () => Promise<void>): void {
  if (!isDebugShellEnabled() || state) return;
  onRouteChange = renderCurrentRoute;
  installDebugShell(appRoot);
}

function installDebugShell(appRoot: HTMLElement): void {
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

  state = { root, tabs, activeTabId, nextTabNumber: 2 };
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
    void onRouteChange?.();
  });
  renderDebugShell();
}

function handleDebugShellLinkClick(event: MouseEvent): void {
  if (!state || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
  if (!anchor || anchor.target || anchor.download) return;
  const url = new URL(anchor.href);
  if (url.origin !== window.location.origin || !isAppPath(url.pathname)) return;
  event.preventDefault();
  void navigateDebugShell(`${url.pathname}${url.search}${url.hash}`, { newTab: !isSettingsPath(url.pathname) });
}

async function navigateDebugShell(path: string, options: { newTab?: boolean } = {}): Promise<void> {
  if (!state) return;
  const url = appURL(path);
  const pathname = new URL(url, window.location.href).pathname;
  let tab = options.newTab ? undefined : state.tabs.find((candidate) => candidate.url === url);
  if (!tab && isSettingsPath(pathname)) {
    tab = state.tabs.find((candidate) => candidate.id === "debug-menu");
  }
  if (!tab) {
    tab = {
      id: `debug-tab-${state.nextTabNumber++}`,
      title: isSettingsPath(pathname) ? "App Menu" : "Terminal",
      url,
    };
    state.tabs.push(tab);
  }
  tab.url = url;
  state.activeTabId = tab.id;
  history.pushState(null, "", url);
  renderDebugShell();
  await onRouteChange?.();
}

async function activateDebugTab(tabId: string): Promise<void> {
  if (!state) return;
  const tab = state.tabs.find((candidate) => candidate.id === tabId);
  if (!tab) return;
  state.activeTabId = tab.id;
  history.pushState(null, "", tab.url);
  renderDebugShell();
  await onRouteChange?.();
}

async function closeDebugTab(tabId: string): Promise<void> {
  if (!state || tabId === "debug-menu") return;
  const index = state.tabs.findIndex((tab) => tab.id === tabId);
  if (index < 0) return;
  const closingActive = state.activeTabId === tabId;
  state.tabs.splice(index, 1);
  if (closingActive) {
    const fallback = state.tabs[Math.max(0, index - 1)] ?? state.tabs[0];
    state.activeTabId = fallback.id;
    history.pushState(null, "", fallback.url);
    await onRouteChange?.();
  }
  renderDebugShell();
}

function syncDebugShellToLocation(): void {
  if (!state) return;
  const current = currentAppPath();
  let tab = state.tabs.find((candidate) => candidate.url === current);
  if (!tab && isSettingsPath(window.location.pathname)) {
    tab = state.tabs.find((candidate) => candidate.id === "debug-menu");
  }
  if (!tab) {
    tab = { id: `debug-tab-${state.nextTabNumber++}`, title: "Terminal", url: current };
    state.tabs.push(tab);
  }
  state.activeTabId = tab.id;
  tab.url = current;
  renderDebugShell();
}

export function updateDebugShellFromLocation(title: string): void {
  if (!state) return;
  const active = state.tabs.find((tab) => tab.id === state?.activeTabId);
  if (!active) return;
  active.url = currentAppPath();
  active.title = title;
  renderDebugShell();
}

export function updateActiveDebugTabTitle(title: string): void {
  if (!state) return;
  const active = state.tabs.find((tab) => tab.id === state?.activeTabId);
  if (!active || active.id === "debug-menu") return;
  active.title = title;
  renderDebugShell();
}

function renderDebugShell(): void {
  if (!state) return;
  state.root.innerHTML = `
    <div class="debug-pwa-tabs-list" role="tablist" aria-label="Debug PWA tabs">
      ${state.tabs
        .map((tab) => {
          const selected = tab.id === state?.activeTabId;
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
