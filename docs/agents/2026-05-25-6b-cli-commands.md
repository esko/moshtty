# Agent Task 6b: moshttyctl CLI Commands

## Subagent Pre-flight (mandatory — run BEFORE any file change)

1. Run `git status` and report what is modified, staged, and untracked.
2. Run `git log -1 --format='%h %s'` and confirm HEAD.
3. Treat every untracked file as uncommitted work from another agent. Do NOT delete, move, or `git clean` them.
4. Do not run any destructive command.
5. Confirm write scope against `docs/agents/OWNERS.md`.
6. Read AGENTS.md — Stop Conditions, Slice Budget, Destructive commands.
7. If a verification command is unavailable, say so.

## Context

Slice 6a landed the Unix socket transport (`internal/ctlsocket/`). `moshttyctl` can now dial the companion and send JSON-RPC calls. The companion dispatches `health`, `pane.create`, `pane.attach`, `pane.resize`, `pane.close`. Missing: `pane.list` — there's no way to enumerate active panes.

The M6 brief lists `tab new/close/focus/rename` and `pane split/focus/resize/rename` as commands. These require communication with the **Electron app** (not the companion), which isn't wired yet. For this slice: implement the **companion-side** commands and show clear errors for app-side ones.

## Scope

- `internal/pane/manager.go` — add `List()` method
- `internal/wtserver/server.go` — add `pane.list` dispatch case
- `cmd/moshttyctl/main.go` — full CLI command parser
- `internal/pane/manager_test.go` — test List()
- `internal/wtserver/server_test.go` — test pane.list dispatch

Stop conditions: do NOT touch `docs/`, `AGENTS.md`, `apps/desktop/`, `go.mod`, `go.sum`.

Slice budget: 5 files (soft cap 8).

## Commands to implement

```
moshttyctl list                        → call "pane.list" on companion, pretty-print
moshttyctl pane close <flow-id>        → call "pane.close", print result
moshttyctl cleanup list                → same as "list" but only shows orphan info
moshttyctl cleanup kill <flow-id>      → same as "pane.close"
moshttyctl tab new/close/focus/rename  → "not connected to Moshtty app — open the Electron app first"
moshttyctl pane split/focus/rename     → same error
```

## pane.Manager.List()

```go
func (m *Manager) List() []Info {
    m.mu.Lock()
    defer m.mu.Unlock()
    list := make([]Info, 0, len(m.entries))
    for flowID, ent := range m.entries {
        info := ent.info
        info.FlowID = flowID
        list = append(list, info)
    }
    return list
}
```

## wtserver dispatch: add case "pane.list"

```go
case "pane.list":
    return map[string]any{"panes": s.panes.List()}, nil
```

## moshttyctl CLI

Replace main.go with a proper subcommand parser. Structure:

```
moshttyctl [--socket PATH] <command> [args...]
```

Commands table:

- `list` → `cli.Call(ctx, "pane.list", nil)` → print table (FlowID, Cols, Rows)
- `pane close <id>` → `cli.Call(ctx, "pane.close", struct{FlowID uint32}{id})`
- `cleanup list` → same as `list`
- `cleanup kill <id>` → same as `pane close`
- `tab *` → error "not connected to Moshtty app"
- `pane split/focus/rename` → error "not connected to Moshtty app"

Use `flag.NewFlagSet` for each subcommand for clean parsing.

## Verification

```bash
go test ./internal/pane/... -v -count=1
go test ./internal/wtserver/... -v -count=1
go test ./...
go vet ./...
git diff --check
```

## Commit

```
feat(moshttyctl): add companion-side CLI commands (list, pane close, cleanup)
```
