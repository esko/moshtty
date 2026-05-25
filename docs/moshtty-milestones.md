# Moshtty Milestones

Status tiers used in this doc match `AGENTS.md` -> Status Tiers:
`Planned` -> `In progress` -> (`Blocked`) -> `Ready for review` -> `Verified on target` -> `Done`.

Milestones with native dependencies (`safeStorage`, WebTransport, real Mosh) cannot move from `Ready for review` to `Done` on a Linux-only CI run. They require a `Verified on target` step on actual target hardware, documented under `docs/agents/followups/`.

## M0 Planning Docs

Status: Done

Objective:

- Make the refined Moshtty plan executable by multiple agents.

Deliverables:

- Moshtty-specific `AGENTS.md`.
- `docs/moshtty-prd.md`.
- `docs/moshtty-plan.md`.
- `docs/moshtty-milestones.md`.
- `docs/moshtty-testing.md`.
- Agent briefs under `docs/agents/`.

Acceptance:

- Docs preserve all locked decisions from planning.
- Agent briefs have clear scope, paths, deliverables, and verification.
- PRD status table is present and current.
- Test plan covers unit, Go, visual regression, exploratory QA, and real remote acceptance.

## M1 Branch And Scaffold

Status: Planned

Objective:

- Establish the Moshtty repo structure and remove old runtime assumptions.
- Start from the current dirty worktree after M0 docs are reviewed.

Deliverables:

- New branch based on the current worktree.
- Root pnpm workspace.
- `apps/desktop` with `electron-vite`, React, TypeScript, Zustand, and CSS setup.
- Root Go module using Go 1.26.
- `cmd/moshtty-remote` and `cmd/moshttyctl` placeholders.
- `internal/` package layout for shared Go code.
- Old PWA/local agent runtime either removed or quarantined so it does not guide new work.
- Root scripts for client and Go verification.

Acceptance:

- `pnpm install` works.
- Desktop placeholder app opens in Electron.
- `pnpm --filter @moshtty/desktop typecheck` passes.
- `pnpm --filter @moshtty/desktop test` passes.
- `go test ./...` passes.
- PRD status updated.

Agent brief:

- `docs/agents/2026-05-25-1-moshtty-scaffold.md`

## M2 Desktop State Shell

Status: Planned

Objective:

- Build the Electron state, IPC, and secret foundation.

Deliverables:

- Secure `app://moshtty` protocol.
- Typed preload IPC surface.
- Versioned JSON state file with atomic writes.
- State schema for remotes, projects, tabs, panes, layout, settings, last active project.
- Electron `safeStorage` token encryption.
- Passphrase-encrypted fallback for weak/unavailable safeStorage.
- Basic state migration mechanism.

Acceptance:

- State reads/writes atomically.
- Invalid/corrupt state fails safely with recoverable error.
- Tokens are not stored plaintext when safeStorage or fallback is active.
- IPC tests cover success and failure paths.
- PRD status updated.

Verified on target requires:

- A real Electron launch on the developer's primary OS (Chromebook Linux container or macOS) where `safeStorage.isEncryptionAvailable()` returns the expected mode, a token is round-tripped, and the state file is observed on disk. See `docs/agents/followups/m2-safestorage-on-device.md`.

Agent brief:

- `docs/agents/2026-05-25-2-desktop-state-shell.md`

## M3 macOS Remote Companion

Status: Planned

Objective:

- Build the first remote service target for macOS.

Deliverables:

- `moshtty-remote` command.
- Per-user macOS paths under `~/Library/Application Support/Moshtty`.
- LaunchAgent plist generation/install script.
- Config file with bind address, port, origins, token metadata, cert metadata.
- Default bind `0.0.0.0:4433`.
- Short-lived ECDSA P-256 certificate generation.
- SHA-256 cert hash extraction for WebTransport profile JSON.
- Persistent auth token generation.
- Profile JSON output command.

Acceptance:

- Unit tests cover config paths, cert generation, hash encoding, token generation, and plist generation.
- Companion can start locally and report health.
- Install script can produce expected LaunchAgent files without requiring root.
- PRD status updated.

Verified on target requires:

- `moshtty-remote` built and running on the actual Mac mini under LaunchAgent, with `moshtty-remote profile` producing a valid pasteable JSON blob that the desktop client successfully imports.

Agent brief:

- `docs/agents/2026-05-25-3-macos-remote-companion.md`

## M4 WebTransport And Mosh Mux

Status: Ready for review

Objective:

- Connect Electron renderer panes to remote pane PTYs over WebTransport using `mosh-go`.

Deliverables:

- WebTransport server in `moshtty-remote`.
- JSON-RPC 2.0 control stream with auth and origin checks.
- Muxed WebTransport datagram format.
- Browser/WASM `mosh-go` client wrapper adapted for pane flow IDs.
- Companion pane PTY lifecycle and Mosh server adapter/vendor layer.
- Pane attach, resize, send input, receive output, close, reconnect.

Acceptance:

- Mux framing and demux tests pass.
- JSON-RPC auth/origin tests pass.
- Pane flow lifecycle tests pass.
- Local integration can run at least one remote PTY through WebTransport.
- PRD status updated.

Follow-ups before M4 is **Done** (see `docs/m4-mosh-adapter.md` and `docs/agents/followups/m4-mosh-adapter.md`):

- Manual cert-pin WebTransport connect from Electron using an imported profile.
- One-pane end-to-end muxed mosh traffic against `moshtty-remote` on the Mac (`ssh macmini` / `scp` deploy path).
- Optional hardening: automated WT integration test, direct `mosh-go` server adapter, cert-hash rotation over control.

Verified on target requires:

- All follow-up items above completed on the developer's actual macOS + Chromebook setup, with screenshots / logs attached in the PRD close-out. Linux unit tests are not sufficient.

Agent brief:

- `docs/agents/2026-05-25-4-webtransport-mosh-mux.md`

## M5 UI And Ghostty Integration

Status: Planned

Objective:

- Build the Moshtty desktop UI around projects, tabs, panes, and Ghostty rendering.

Deliverables:

- React app shell.
- Collapsible project rail.
- Project dashboard.
- In-app top tab/action bar.
- Terminal pane layout with splits.
- Ghostty terminal pane component.
- Remote import/edit/delete UI.
- Project create/edit/delete UI.
- Terminal settings for theme mode, terminal palette behavior, font, cursor, scrollback, and keybindings.
- Light/Dark/System mode.
- Design follows the 2026-05-24 18.46 screenshot references.

Acceptance:

- Reducer/store tests cover projects, tabs, panes, layout, active selection, and lost panes.
- Theme tests cover system/light/dark and linked terminal palette behavior.
- Playwright Electron screenshots cover dashboard, terminal tabs, split panes, collapsed rail, dialogs, settings, and lost pane state.
- agent-browser exploratory QA captures review screenshots for light and dark modes.
- Manual inspection confirms no major text overlap and compact desktop layout.
- PRD status updated.

Agent brief:

- `docs/agents/2026-05-25-5-moshtty-ui-ghostty.md`

## M6 `moshttyctl` CLI

Status: Planned

Objective:

- Provide tmux-like remote control through the companion.

Deliverables:

- `moshttyctl` command.
- Unix socket client to `moshtty-remote`.
- Commands:
  - list projects/tabs/panes;
  - new/close/focus/rename tab;
  - split/close/focus/resize/rename pane;
  - offline list/kill orphan PTYs.
- Clear error when app/layout commands run without active app connection.
- CLI-created panes inherit the CLI process cwd.

Acceptance:

- Command parsing tests pass.
- Socket RPC tests pass.
- Offline cleanup tests pass.
- Connected app command integration test passes with fake app control channel.
- PRD status updated.

Agent brief:

- `docs/agents/2026-05-25-6-moshttyctl-cli.md`

## M7 Real Remote Acceptance

Status: Planned

Objective:

- Prove the real first-use path against a macOS remote.

Deliverables:

- Build remote binaries for macOS.
- Copy binaries/scripts to macOS host manually.
- Install LaunchAgent.
- Import profile JSON into Electron app.
- Connect, create tabs/panes, run commands, reload app, reconnect, use CLI.

Acceptance:

- The ten acceptance criteria in `docs/moshtty-prd.md` pass.
- Failures and gaps are recorded in PRD status notes.
- Any remaining risks have explicit follow-up tasks.
