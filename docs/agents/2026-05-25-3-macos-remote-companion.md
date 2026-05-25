# Agent Task 3: macOS Remote Companion

## Read First

- `AGENTS.md`
- `docs/moshtty-prd.md`
- `docs/moshtty-plan.md`
- `docs/moshtty-milestones.md`

## Objective

Implement the first `moshtty-remote` macOS companion foundation: config, LaunchAgent support, cert/token/profile generation, and health startup.

## Scope

Work primarily in:

- `cmd/moshtty-remote`;
- `internal/remote`;
- `internal/config`;
- `internal/certs`;
- `internal/profile`.

Target macOS first. Keep code names portable, but do not implement Linux service management in this task.

## Deliverables

- `moshtty-remote` command.
- User-local macOS paths:
  - config/state under `~/Library/Application Support/Moshtty`;
  - LaunchAgent under `~/Library/LaunchAgents`;
  - binaries under a documented user-local bin path.
- LaunchAgent plist generation.
- Install script or install subcommand for macOS.
- Config with bind address, port, allowed origins, token metadata, cert metadata.
- Default bind all interfaces on UDP/WebTransport port `4433`.
- Persistent auth token generation.
- ECDSA P-256 short-lived certificate generation.
- SHA-256 certificate hash output.
- `profile` command that prints pasteable JSON for app import.

## Verification

Run:

```bash
go test ./...
go test ./cmd/moshtty-remote ./internal/...
git diff --check
```

Tests must cover:

- macOS path resolution;
- config defaults;
- token generation;
- cert validity/hash generation;
- profile JSON shape;
- LaunchAgent plist generation.

## PRD Update

Set:

- `M3 macOS remote companion` to `Ready for review` when verification passes;
- this task to `Ready for review`;
- add any manual macOS install caveats to PRD notes.

