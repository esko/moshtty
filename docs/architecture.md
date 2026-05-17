# Architecture

## Components

- `agent/`: Go HTTP/WebSocket server that runs inside Crostini. It serves the PWA, validates same-origin requests, manages durable terminal sessions, and bridges terminal I/O.
- `agent` session workers: hidden same-binary worker processes that own one shell PTY each. The HTTP server attaches browser WebSockets to workers over Unix sockets.
- `web/`: Vite/Bun PWA using `ghostty-web`. It loads `ghostty-vt.wasm`, renders terminal panes to canvas, handles keyboard/mouse input, and connects to the agent through `/pty`.
- `web/scripts/patch-ghostty-web.ts`: local patch layer for the pinned `ghostty-web` dependency. It keeps our rendering and hidden-input fixes reproducible after `bun install`.

## Startup Flow

1. The agent starts on `127.0.0.1:8765` and creates a random session token.
2. Chrome loads the PWA from the agent.
3. The PWA calls `/api/health` and `/api/session`.
4. The settings page lists parent workspaces through `/api/terminal-sessions`, or a terminal tab creates/opens a parent workspace.
5. Each terminal pane opens `/pty?token=<token>&session=<session-id>&restore=<0|1>&cols=<cols>&rows=<rows>` as a WebSocket.
6. The agent starts the worker for that durable session if needed, then forwards binary PTY output frames to the browser.

## Sessions

Durable session state lives under the agent session directory, which defaults to `$XDG_STATE_HOME/crostini-ghostty/sessions` or `~/.local/state/crostini-ghostty/sessions`.

A top-level session is a parent workspace. Its `layout.json` stores a split tree. Each leaf points at a session id, and child pane metadata stores `parentId` so child panes stay hidden from the top-level session list. Detaching a child pane clears `parentId` and writes a new single-pane layout, which promotes it to a parent workspace.

The current layout supports horizontal and vertical splits with persisted ratios. The UI creates 50/50 splits by default, then stores divider resize changes through the layout API.

See `docs/sessions.md` for API details.

## Rendering

The frontend uses the `ghostty-web` canvas renderer. Local patches do three things:

- round canvas backing dimensions and scale by the actual backing-store ratio for fractional DPR displays;
- snap filled cell rectangles to physical pixels to avoid subpixel gaps between block glyphs;
- move the hidden keyboard textarea off-canvas and make its native caret fully transparent.

The visual test at `web/visual/glyph-gap.html` exercises dense block and powerline glyph rows at fractional DPR.

## Input

The app keeps shell-critical controls in the terminal, including `Ctrl+C`, `Ctrl+D`, `Ctrl+Z`, and `Ctrl+L`. Browser and ChromeOS shortcuts pass through via `web/src/shortcuts.ts`.

PTY output is batched once per animation frame before calling `Terminal.write`, which reduces render churn during large output bursts.

## Tabs

The PWA opts into ChromeOS tabbed application mode with `display_override: ["tabbed"]` and a manifest `tab_strip.new_tab_button.url` of `/terminal`. In native tabbed mode the in-app fallback toolbar is hidden so only the ChromeOS-integrated tab strip is visible.

There is no in-app tab fallback. Each native ChromeOS app tab is a separate app context. A terminal tab can render one workspace with multiple panes; each pane has its own `Terminal`, `FitAddon`, WebSocket attachment, write queue, and wheel-scroll queue. `Ctrl+T` and `Ctrl+W` pass through to the native tab strip so ChromeOS controls app-tab creation and focus.
