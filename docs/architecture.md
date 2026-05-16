# Architecture

## Components

- `agent/`: Go HTTP/WebSocket server that runs inside Crostini. It serves the PWA, starts the user's shell in a PTY, validates same-origin requests, and forwards terminal I/O.
- `web/`: Vite/Bun PWA using `ghostty-web`. It loads `ghostty-vt.wasm`, renders the terminal to canvas, handles keyboard/mouse input, and connects to the agent through `/pty`.
- `web/scripts/patch-ghostty-web.ts`: local patch layer for the pinned `ghostty-web` dependency. It keeps our rendering and hidden-input fixes reproducible after `bun install`.

## Startup Flow

1. The agent starts on `127.0.0.1:8765` and creates a random session token.
2. Chrome loads the PWA from the agent.
3. The PWA calls `/api/health` and `/api/session`.
4. The PWA opens `/pty?token=<token>` as a WebSocket.
5. The agent starts the user's shell in a PTY and forwards binary PTY output frames to the browser.

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

There is no in-app tab fallback. Each native ChromeOS app tab is a separate app context with its own `Terminal`, `FitAddon`, WebSocket, PTY session, write queue, and wheel-scroll queue. `Ctrl+T` and `Ctrl+W` pass through to the native tab strip so ChromeOS controls new-tab focus and previous-tab focus on close.
