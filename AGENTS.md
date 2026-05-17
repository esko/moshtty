# AGENTS.md

## Project

This repository is **Crostini Ghostty Terminal**, an installable ChromeOS PWA terminal for Crostini Linux.

The selected implementation is:

- Go PTY/browser bridge in `agent/`
- `ghostty-web` PWA in `web/`

There are no alternate frontend implementations in this repo. Keep new work focused on the `web/` app and the Go agent.

## Commands

Use Bun for frontend work:

```bash
cd web
bun install
bun run build
bun run test
bun run test:visual:glyphs
```

Use Go for the agent:

```bash
cd agent
go test ./...
go run . -web-dir ../web/dist
```

Root shortcuts:

```bash
bun run build
bun run test
bun run test:visual
bun run agent
```

## Dependency Patch

`web/scripts/patch-ghostty-web.ts` patches the pinned `ghostty-web` dependency after `bun install`.

Do not edit `web/node_modules/ghostty-web` without updating the patch script. The patch currently covers:

- fractional-DPR canvas backing scale;
- pixel-snapped filled rectangles for block glyphs/backgrounds;
- removal of a canvas resize overwrite in `Terminal.resize`;
- hidden textarea caret suppression.

After changing the patch script, run:

```bash
cd web
bun run postinstall
bun run test
bun run build
bun run test:visual:glyphs
```

## Verification

For most changes, run:

```bash
bun run test
```

For rendering, font, DPR, canvas, or `ghostty-web` patch changes, also run:

```bash
bun run test:visual
```

For agent protocol/security changes, add or update `agent/main_test.go` and run:

```bash
cd agent
go test ./...
```

## Runtime

The agent binds to `127.0.0.1:8765` by default. It should remain loopback-only unless a user explicitly asks for a different deployment model.

The browser protocol starts with:

- `GET /api/health`
- `GET /api/session`
- `GET /api/terminal-sessions`
- `POST /api/terminal-sessions`
- `GET /api/terminal-sessions/{id}`
- `POST /api/terminal-sessions/{id}/splits`
- `POST /api/terminal-sessions/{id}/detach`
- `PATCH /api/terminal-sessions/{id}/layout`
- `DELETE /api/terminal-sessions/{id}`
- `GET /pty?token=<session-token>&session=<session-id>&restore=<0|1>&cols=<cols>&rows=<rows>` WebSocket

Session model:

- A parent terminal session is a workspace listed on the settings/home page.
- Child sessions are panes nested under a parent layout and are not listed as top-level workspaces.
- Detaching a child pane clears its `parentId` and creates a single-pane layout so it becomes a parent workspace.
- Layout PATCH requests may update split ratios only; they must not change pane membership or split structure.
- Deleting a parent stops and removes the whole pane tree. Deleting a child removes it from its parent layout and deletes that child session directory.

Browser-to-agent WebSocket messages are JSON text frames:

```json
{"type":"input","data":"..."}
{"type":"resize","cols":120,"rows":32}
```

Agent-to-browser PTY output is binary WebSocket frames.

See `docs/sessions.md` for the API shapes.

## Style

- Keep frontend code TypeScript.
- Prefer small focused modules under `web/src`.
- Keep terminal control keys working in the shell while passing ChromeOS/PWA shortcuts through `web/src/shortcuts.ts`.
- Do not add new frontend stacks or renderer experiments without an explicit user request.
