import { layoutLeaves } from "./layout";
import { escapeHTML, escapeAttribute } from "./dom";
import type { Workspace, TerminalSession } from "./types";

export function renderStatusBar(
  workspace: Workspace,
  getPaneSession: (id: string) => TerminalSession | undefined,
  getPaneTitle: (session: TerminalSession) => string,
  showPanes: boolean,
  showClock: boolean,
  activePaneId: string | null,
  onPaneClick: (paneId: string) => void,
): HTMLElement {
  const bar = document.createElement("nav");
  bar.className = "status-bar";
  bar.id = "workspaceStatusBar";

  const left = document.createElement("span");
  left.className = "status-bar-left";
  left.textContent = workspace.session.title || "Terminal";
  bar.appendChild(left);

  if (showPanes) {
    const center = document.createElement("span");
    center.className = "status-bar-panes";
    const leaves = layoutLeaves(workspace.layout);
    for (const paneId of leaves) {
      const paneSession = getPaneSession(paneId);
      const title = paneSession ? getPaneTitle(paneSession) : "Terminal";
      const btn = document.createElement("button");
      btn.className = `status-bar-pane-button${paneId === activePaneId ? " active" : ""}`;
      btn.type = "button";
      btn.textContent = title;
      btn.addEventListener("click", () => onPaneClick(paneId));
      center.appendChild(btn);
    }
    bar.appendChild(center);
  }

  if (showClock) {
    const right = document.createElement("span");
    right.className = "status-bar-right";
    right.id = "statusBarClock";
    right.textContent = getClockTimeString();
    bar.appendChild(right);
  }

  return bar;
}

export function getClockTimeString(): string {
  return new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

let statusBarClockInterval: number | undefined;

export function startStatusBarClock(): void {
  if (statusBarClockInterval !== undefined) window.clearInterval(statusBarClockInterval);
  statusBarClockInterval = window.setInterval(() => {
    const clockEl = document.querySelector("#statusBarClock");
    if (clockEl) clockEl.textContent = getClockTimeString();
  }, 30000) as unknown as number;
}

export function updateStatusBarHighlight(activePaneId: string): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(".status-bar-pane-button");
  for (const btn of buttons) {
    btn.classList.toggle("active", btn.textContent === activePaneId);
  }
}
