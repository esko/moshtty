# M4 Follow-up: Live WebTransport + Mosh E2E

## Context

M4 WebTransport and Mosh mux is **Ready for review** but not **Verified on target**. No live cert-pin WebTransport connect has been exercised from Electron, and no muxed mosh traffic has been run against a real macOS remote.

## Objective

Run a live end-to-end test: Electron app connects to `moshtty-remote` on the Mac (`ssh macmini`), imports the profile, opens a muxed pane, and verifies shell I/O.

## Prerequisites

- `moshtty-remote` built for macOS and deployed to `~/.local/bin/` on `macmini` (or other Mac host)
- LaunchAgent loaded: `launchctl load -w ~/Library/LaunchAgents/com.moshtty.remote.plist`
- Profile JSON exported: `moshtty-remote profile` → import into Electron app

## Steps

1. Deploy binary to Mac via `scp` and install with `ssh macmini '~/moshtty-remote install --binary ~/.local/bin/moshtty-remote'`
2. Start companion: `ssh macmini '~/moshtty-remote run'`
3. Capture profile JSON: `ssh macmini '~/moshtty-remote profile'` → save to local file
4. Launch Electron app with `?fixture=offline` to observe offline state
5. Import profile JSON through remote import flow
6. Verify cert-pin WebTransport handshake succeeds
7. Open a pane, verify shell output over muxed datagrams
8. Close pane, verify cleanup

## Optional hardening (from `docs/m4-mosh-adapter.md`)

- Replace localhost UDP bridge with direct `mosh-go` server adapter (in-process PTY)
- Add cert-hash rotation over authenticated control
- Improve pane shutdown speed (shorter mosh-server timeout)
- Auth header consistency (always `X-Moshtty-Token`)

## Scope

Same globs as parent brief (2026-05-25-4-webtransport-mosh-mux.md):

- `cmd/moshtty-remote/**` (transport)
- `internal/jsonrpc/**`, `internal/mux/**`, `internal/pane/**`, `internal/wtserver/**`
- `apps/desktop/src/renderer/src/transport/**`
- `apps/desktop/src/common/mux*`
