# Agent Task 4: WebTransport And Mosh Mux

## Read First

- `AGENTS.md`
- `docs/moshtty-prd.md`
- `docs/moshtty-plan.md`
- `docs/moshtty-milestones.md`

## Objective

Implement the transport layer: WebTransport control streams, muxed datagrams, and `mosh-go` pane transport.

## Scope

Work in both Go remote code and Electron renderer transport code.

Implement:

- WebTransport server in `moshtty-remote`;
- exact Origin validation for `app://moshtty` plus configured dev origins;
- token authentication;
- JSON-RPC 2.0 control stream;
- versioned datagram mux format;
- pane flow ID allocation and lifecycle;
- renderer-side mux client;
- `mosh-go` WASM wrapper adapted for pane flow IDs;
- companion-side pane PTY lifecycle;
- narrow vendored/adapter server loop around `mosh-go` if required.

Do not build broad UI features in this task. A small test harness is acceptable.

## Deliverables

- Authenticated WebTransport connection.
- JSON-RPC methods for health, attach pane, create pane, resize pane, close pane.
- Datagram mux package with tests.
- One-pane local integration path.
- Notes on any `mosh-go` vendored/adapted code boundaries.

## Verification

Run:

```bash
go test ./...
pnpm --filter @moshtty/desktop test
pnpm --filter @moshtty/desktop typecheck
git diff --check
```

Tests must cover:

- mux encode/decode;
- unknown protocol version;
- unknown pane flow;
- auth failure;
- Origin failure;
- JSON-RPC error mapping;
- pane create/close lifecycle.

## PRD Update

Set:

- `M4 WebTransport and Mosh mux` to `Ready for review` when verification passes;
- this task to `Ready for review`;
- add verification commands and results;
- document any remaining protocol risks or upstream `mosh-go` gaps;
- do not commit until `docs/moshtty-prd.md` is closed out for this task.
