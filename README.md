# Crostini Ghostty Terminal

An installable ChromeOS PWA terminal for Crostini Linux. The frontend uses `ghostty-web` with Ghostty's VT parser compiled to WASM. A local Go agent runs inside Crostini, owns the PTY, serves the built PWA, and bridges terminal I/O over a same-origin WebSocket.

The agent is loopback-only by default and listens on `127.0.0.1:8765`.

## Requirements

- ChromeOS with the Linux development environment enabled.
- Go 1.22 or newer.
- Bun 1.3 or newer.

## Run

```bash
cd web
bun install
bun run build

cd ../agent
go mod download
go run . -web-dir ../web/dist
```

Open `http://127.0.0.1:8765` from ChromeOS Chrome, then install it from the browser install action.

For frontend development:

```bash
cd agent
go run . -allow-host 127.0.0.1:5175
```

In another shell:

```bash
cd web
bun run dev
```

The Vite dev server proxies `/api` and `/pty` to the Go agent at `127.0.0.1:8765`.

## Scripts

From the repository root:

```bash
bun run build
bun run test
bun run test:visual
bun run agent
```

From `web/`:

```bash
bun run dev
bun run build
bun run test
bun run test:visual:glyphs
```

## Protocol

The browser creates and manages durable terminal workspaces through the session API:

- `GET /api/terminal-sessions` lists parent workspaces.
- `POST /api/terminal-sessions` creates a parent workspace.
- `GET /api/terminal-sessions/{id}` returns the workspace layout and pane sessions.
- `POST /api/terminal-sessions/{id}/splits` creates a child pane inside a parent workspace.
- `POST /api/terminal-sessions/{id}/detach` promotes a child pane into its own parent workspace.
- `PATCH /api/terminal-sessions/{id}/layout` persists split-pane ratios.
- `DELETE /api/terminal-sessions/{id}` removes a parent workspace tree or a child pane.

Terminal panes attach to a durable session with:

```text
GET /pty?token=<session-token>&session=<session-id>&restore=1&cols=120&rows=32
```

Browser to agent:

```json
{"type":"input","data":"echo hello\n"}
{"type":"resize","cols":120,"rows":32}
```

Agent to browser:

- Binary WebSocket frames: raw PTY output bytes.
- Text JSON frames:

```json
{"type":"status","shell":"/bin/bash"}
{"type":"error","message":"failed to start shell","errors":["..."]}
{"type":"exit","code":0}
```

## Security Model

- The agent listens on loopback only by default.
- `/api/session` and `/pty` require the expected `Host` and same-origin `Origin`.
- `/pty` requires a startup token.
- The PWA does not use ChromeOS private terminal APIs and cannot start Crostini by itself.

## Notes

- `web/scripts/patch-ghostty-web.ts` applies local renderer/input patches to the pinned `ghostty-web` dependency after install.
- `web/visual/glyph-gap.html` and `bun run test:visual:glyphs` cover the fractional-DPR glyph gap regression.
- The PWA opts into ChromeOS tabbed application mode. Use ChromeOS's native tab strip or `Ctrl+T` and `Ctrl+W` for app tabs. Terminal panes and split layouts are managed inside each workspace.
- See `docs/architecture.md`, `docs/sessions.md`, `docs/roadmap.md`, `docs/fonts.md`, and `docs/systemd-user.md` for implementation details.
