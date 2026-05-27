# Agent Task 6a: moshttyctl Unix Socket Transport

## Read First

- [AGENTS.md](../../AGENTS.md) — stop conditions, slice budget, status tiers, subagent pre-flight
- [docs/moshtty-prd.md](../moshtty-prd.md)
- [docs/moshtty-plan.md](../moshtty-plan.md)
- [docs/moshtty-milestones.md](../moshtty-milestones.md)
- [docs/agents/OWNERS.md](OWNERS.md) — write-scope globs
- [docs/agents/TEMPLATE_HANDOFF.md](TEMPLATE_HANDOFF.md) — handoff template

## Subagent Pre-flight (mandatory — run BEFORE any file change)

1. Run `git status` and report what is modified, staged, and untracked.
2. Run `git log -1 --format='%h %s'` and confirm HEAD matches expectations.
3. Treat every untracked file as potentially uncommitted work from another agent. Do not delete, move, or `git clean` them.
4. Do not run any destructive command (`git clean`, `git reset --hard`, `rm -rf`) without explicit coordinator instruction.
5. Confirm write scope against `docs/agents/OWNERS.md`.
6. Read AGENTS.md (especially Stop Conditions, Slice Budget, Destructive commands).
7. If a verification command is unavailable on this host, say so explicitly.

A handoff without step 1 and step 2 output will be rejected.

## Context

`cmd/moshttyctl/main.go` is an 8-line placeholder. M6 needs a tmux-like CLI that talks to the running `moshtty-remote` companion over a Unix socket. This slice builds the transport foundation: the Unix socket server in the companion and the JSON-RPC client in moshttyctl. The actual CLI commands (list, tab new, pane split, etc.) come in a follow-up slice once the socket plumbing is verified.

The existing `internal/wtserver/server.go` already dispatches JSON-RPC 2.0 for pane operations (`pane.create`, `pane.attach`, `pane.resize`, `pane.close`) and health checks. The Unix socket server will share the same JSON-RPC dispatch pattern but expose it over a Unix domain socket instead of WebTransport.

## Scope

Write scope from OWNERS.md:

- `cmd/moshttyctl/**` — CLI binary
- `cmd/moshtty-remote/**` (overlaps briefs 3 and 4 — only add socket startup, don't refactor WT server)

Addition for this brief (coordinator-approved):

- `internal/ctlsocket/**` — new shared package for socket transport

**Stop conditions** (do not edit):

- `internal/wtserver/**` (owned by M4 — only import, don't modify)
- `internal/pane/**` (owned by M4 — only call existing API)
- `internal/config/**` (owned by M3)
- `internal/remote/**` (owned by M3)
- `apps/desktop/**` (any path)
- `docs/moshtty-prd.md`, `docs/moshtty-milestones.md`, `AGENTS.md` (shared docs — only close-out in this brief's scope)
- `go.mod`, `go.sum` (top-level deps — no new dependencies needed)

**Slice budget:** soft cap 8 files, hard cap 20. This slice targets 6-7 files.

## Required Behavior

### 1. Unix socket server (`internal/ctlsocket/server.go`)

The companion needs a Unix socket server that accepts local connections and dispatches JSON-RPC 2.0 requests. The socket path should be derived from the config system — use `paths.ApplicationSupportDir() + "/moshtty.sock"`.

```go
package ctlsocket

import (
    "context"
    "encoding/json"
    "io"
    "net"
    "os"
    "sync"

    "github.com/moshtty/moshtty/internal/jsonrpc"
    "github.com/moshtty/moshtty/internal/pane"
)

type Handler func(req jsonrpc.Request) (any, error)

type Server struct {
    path     string
    listener net.Listener
    handler  Handler
    mu       sync.Mutex
    closed   bool
}
```

Key requirements:

- `NewServer(path string, handler Handler) *Server` — creates the server
- `Listen(ctx context.Context) error` — removes stale socket file, creates listener, accepts connections in a loop
- `Close() error` — stops accepting, removes socket file, closes listener
- Each connection gets its own goroutine running `serveConn(conn net.Conn)`
- `serveConn` reads JSON-RPC request lines (newline-delimited JSON like the WT control stream), dispatches via the Handler, writes the response, then reads the next request
- When the client closes, the goroutine returns

### 2. Socket client (`internal/ctlsocket/client.go`)

moshttyctl needs to dial the socket and send JSON-RPC calls:

```go
package ctlsocket

import (
    "context"
    "encoding/json"
    "fmt"
    "net"

    "github.com/moshtty/moshtty/internal/jsonrpc"
)

type Client struct {
    conn      net.Conn
    encoder   *json.Encoder
    decoder   *json.Decoder
    requestID int64
    mu        sync.Mutex
}
```

Key requirements:

- `Dial(ctx context.Context, path string) (*Client, error)` — dials the Unix socket
- `Call(ctx context.Context, method string, params any) (json.RawMessage, error)` — sends a numbered JSON-RPC request, reads the response, returns the result or error
- `Close() error` — closes the connection
- Auto-incrementing request IDs (int64 atomic counter)
- When the socket is not found (dial fails), return a clear error: "moshtty-remote not running — start it with moshtty-remote run"

### 3. Wire into companion (`cmd/moshtty-remote/main.go`)

Add a `--socket` flag to the `run` subcommand with the default socket path. When the companion starts, launch the Unix socket server in the runtime's `Run` method (alongside the health server and WT server). Use the same `pane.Manager` the WT server uses, wrapped as a JSON-RPC handler.

Minimal change to `run`:

- In `internal/remote/runtime.go`, add a `socketServer *ctlsocket.Server` field
- In `Run()`, start a fourth goroutine for the socket server
- On shutdown, close the socket server
- Pass the `pane.Manager` to the socket server's handler

Actually — simpler approach: the `wtserver.Server` already has the `pane.Manager` and the `dispatch` method. Let the `runtime.Run` method create the `ctlsocket.Server` directly and wire a handler that wraps the WT server's dispatch. Keep the change surface small.

Simplest approach: in `main.go`, after creating the `wtserver.Server`, create a `ctlsocket.Server` with a handler that calls the same dispatch logic. Since `dispatch` is a method on `wtserver.Server` and it's not exported, we add a `Dispatch(req jsonrpc.Request) (any, error)` exported method to `wtserver.Server`.

### 4. Wire into moshttyctl (`cmd/moshttyctl/main.go`)

Replace the placeholder with a CLI that:

- Has a `-socket` flag (default: `~/Library/Application Support/Moshtty/moshtty.sock` on macOS, `~/.local/share/moshtty/moshtty.sock` on Linux)
- Dials the socket
- Sends a `health` JSON-RPC call
- Prints the result
- Exits with code 0 on success, 1 on failure

This is a smoke test proving the transport works. The full CLI commands come in the next slice.

## Deliverables

- `internal/ctlsocket/server.go` — Unix socket JSON-RPC server
- `internal/ctlsocket/server_test.go` — table-driven tests for accept, serve, close, stale socket cleanup
- `internal/ctlsocket/client.go` — Unix socket JSON-RPC client
- `internal/ctlsocket/client_test.go` — table-driven tests for dial, call, response error, connection refused
- `cmd/moshttyctl/main.go` — replaces placeholder; dials socket, sends health check
- `cmd/moshtty-remote/main.go` — add `--socket` flag; start socket server in `run`
- `internal/remote/runtime.go` — add socket server lifecycle to Run()
- `internal/wtserver/server.go` — add exported `Dispatch(req jsonrpc.Request) (any, error)` method

That's 8 files. If hitting the soft cap, merge the test files into one `ctlsocket_test.go` with subtests.

## Verification

```bash
go test ./...
go test ./internal/ctlsocket/... -v
go test ./cmd/moshttyctl/... -v
go vet ./...
git diff --check
```

## Handoff And Commit

- Fill `docs/agents/TEMPLATE_HANDOFF.md` in the commit body
- Atomic conventional commit: `feat(moshttyctl): add Unix socket JSON-RPC transport`
- Do NOT update `docs/moshtty-prd.md` (M6 is not done until commands land)
