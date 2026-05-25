# Agent Task 6: moshttyctl CLI

## Read First

- `AGENTS.md`
- `docs/moshtty-prd.md`
- `docs/moshtty-plan.md`
- `docs/moshtty-milestones.md`

## Objective

Implement `moshttyctl`, the remote-side CLI for controlling the active Moshtty app and cleaning up remote panes.

## Scope

Work primarily in:

- `cmd/moshttyctl`;
- companion Unix socket server code;
- shared internal CLI/RPC packages.

Rules:

- App/layout commands require an active app connection.
- Offline cleanup commands may run without an active app.
- CLI uses `Project`, `Tab`, `Pane` terminology.
- CLI-created panes inherit the CLI process cwd.
- App-created panes use project default cwd.

## Commands

Core connected commands:

- `moshttyctl list`
- `moshttyctl tab new`
- `moshttyctl tab close`
- `moshttyctl tab focus`
- `moshttyctl tab rename`
- `moshttyctl pane split`
- `moshttyctl pane close`
- `moshttyctl pane focus`
- `moshttyctl pane resize`
- `moshttyctl pane rename`

Offline cleanup commands:

- `moshttyctl cleanup list`
- `moshttyctl cleanup kill <pane-id>`

Exact flags and output format should be documented in command help and tests.

## Deliverables

- CLI parser.
- Unix socket client.
- Companion socket server handlers.
- Clear disconnected-app errors.
- Offline cleanup path.
- Tests for parsing, socket calls, connected command routing, and cleanup.

## Verification

Run:

```bash
go test ./...
go test ./cmd/moshttyctl ./cmd/moshtty-remote ./internal/...
git diff --check
```

## PRD Update

Set:

- `M6 moshttyctl CLI` to `Ready for review` when verification passes;
- this task to `Ready for review`;
- document final command syntax in the PRD or a linked CLI docs file.

