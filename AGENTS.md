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

## Module Map

| Module | Purpose |
|--------|---------|
| `web/src/main.ts` | App bootstrap, workspace rendering, layout, panes, context menu, settings page |
| `web/src/actions.ts` | Action registry, key chord parser/matcher, keyboard shortcut mapping |
| `web/src/palette.ts` | Command palette overlay (`Ctrl+Shift+P`), fuzzy search, keyboard navigation |
| `web/src/themes.ts` | Theme preset gallery (8 themes), `getThemePalette()` for color table lookup |
| `web/src/debug-shell.ts` | In-app PWA tab strip for MCP automation (`?debug-shell=1`) |
| `web/src/statusbar.ts` | Status bar DOM helpers (render, clock, highlight) — extraction in progress |
| `web/src/settings.ts` | `loadSettings()`/`saveSettings()`/`normalizeSettings()`, font loading, app appearance |
| `web/src/types.ts` | All TypeScript types: settings, sessions, spaces, profiles, layout nodes, API shapes |
| `web/src/shortcuts.ts` | System shortcut passthrough, pane shortcut detection |
| `web/src/layout.ts` | Split layout math: leaves, ratios, pointer/keyboard resize, spatial navigation |
| `web/src/api.ts` | HTTP helpers (`getJSON`, `postJSON`, `patchJSON`), token fetch, WebSocket URL builder |
| `web/src/dom.ts` | DOM utilities: clamp, escape, byte concat, socket state, typed query |
| `web/src/styles.css` | Full app stylesheet with CSS variables for theming |
| `agent/main.go` | HTTP server, routing, WebSocket PTY handler, security middleware |
| `agent/sessions.go` | Session manager: CRUD for spaces, tabs, panes, profiles, layouts |
| `agent/worker.go` | Worker process: PTY owner, output capture, client broadcast |

## Agent Workflow

When using the `agy` CLI with Gemini for multi-agent parallel work:

1. **Write agent docs** in `docs/agents/` with precise instructions, file paths, and validation steps.
2. **Launch agents** with `agy --add-dir <workdir> --print-timeout 12m --print "$(cat docs/agents/N-*.md)"`.
3. **Avoid parallel worktrees for extraction** — agents overwrite each other's changes. Use worktrees only for fully independent features.
4. **Always run** `cd web && bun run test && bun run build` after agent work to verify.
5. **Commit conventions:** `feat:` for features, `chore:` for dist/assets, `refactor:` for extractions.
6. **Separate source and dist commits** — source changes first, then `web/dist/` assets.

## Pre-commit Checklist

```bash
bun run test          # 19 tests across 3 files
bun run build         # TypeScript + Vite bundle
git diff --check      # No trailing whitespace
gofmt -w agent/*.go   # Format Go code if agent changed
```
