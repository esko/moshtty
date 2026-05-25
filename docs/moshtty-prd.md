# Moshtty PRD And Status

Status date: 2026-05-25

## Product Summary

Moshtty is an Electron desktop remote terminal for personal use. It provides a local `Project -> Tab -> Pane` interface while a manually installed remote companion keeps remote shells durable. The first target client environment is ChromeOS/Crostini running Electron. The first target remote host is macOS.

Moshtty replaces the previous Crostini-local PWA/Go-agent architecture. The old local PTY bridge is not part of the new product direction.

## Goals

- Provide a fast remote terminal experience using `ghostty-web` rendering and `mosh-go` transport.
- Let the local app control projects, tabs, panes, split layouts, names, focus, and settings.
- Keep remote pane PTYs alive across app reloads and network disconnects while `moshtty-remote` keeps running.
- Support a server-side CLI, `moshttyctl`, for tmux-like control from inside remote shells.
- Use a quiet, compact desktop UI inspired by the selected OpenCode screenshots.
- Make the first real acceptance path work against a macOS remote host.

## Non-Goals

- No PWA/browser distribution in the first cut.
- No IWA, Direct Sockets, or browser SSH bootstrap.
- No automatic remote installation.
- No official `mosh-server` compatibility mode.
- No raw UDP fallback.
- No full raw PTY transcript scrollback.
- No multi-device state sync.
- No multi-remote project in the first cut.
- No moving panes between tabs in the first cut.
- No Linux remote implementation in the first acceptance target.

## Locked Decisions

| Area | Decision |
| --- | --- |
| Name | `Moshtty`; commands use `moshtty`, `moshtty-remote`, `moshttyctl` |
| Client | Electron only, ChromeOS/Crostini first |
| Client stack | `electron-vite`, React + TypeScript, Zustand, CSS modules/plain CSS, pnpm |
| Renderer | Keep `ghostty-web` |
| Testing | Vitest, Go tests, Playwright Electron screenshots, and agent-browser exploratory QA |
| Agent models | See `docs/moshtty-model-routing.md`; Gemini 3.5 Flash for bounded implementation, DeepSeek V4 Pro for large-context review |
| Client state | Versioned JSON through Electron main, atomic writes |
| Secrets | Electron `safeStorage`; passphrase-encrypted fallback |
| Remote first target | macOS host |
| Remote service | Per-user LaunchAgent |
| Remote distribution | Manual build + `scp` for first milestone |
| Transport | WebTransport streams for JSON-RPC; datagrams for muxed Mosh pane traffic |
| Mosh | `mosh-go v0.5.2`, with narrow server adapter/vendor if required |
| Control protocol | JSON-RPC 2.0 |
| Port | WebTransport UDP `4433` by default |
| Bind | All interfaces by default |
| Origin | Exact `app://moshtty` plus explicit dev origins |
| CLI | Included in first milestone set |
| Vocabulary | `Project`, `Tab`, `Pane`; avoid user-facing `session` |
| Theme | Light reference baseline; Light/Dark/System setting |

## Status Summary

| Planning Item | Status | Notes |
| --- | --- | --- |
| Architecture decisions | Locked | Captured in `docs/moshtty-plan.md` and summarized below |
| Implementation branch | feat/moshtty-scaffold | Branch created from current worktree |

| Milestone | Status | Notes |
| --- | --- | --- |
| M0 Planning docs | Done | PRD, plan, milestones, agent briefs, and Moshtty `AGENTS.md` are present |
| M1 Branch and scaffold | Ready for review | New branch layout, pnpm/electron-vite/root Go module. Old runtime quarantined under quarantine/ |
| M2 Desktop state shell | Ready for review | Secure `app://moshtty`, typed preload IPC, versioned JSON state, atomic writes, migration, safeStorage + passphrase fallback |
| M3 macOS remote companion | Ready for review | `moshtty-remote` run/install/profile/health, LaunchAgent plist, config/token/certs, profile JSON |
| M4 WebTransport and Mosh mux | Planned | JSON-RPC streams, datagram mux, mosh-go WASM/server adapter |
| M5 UI and Ghostty integration | Planned | React UI, project rail, tabs, panes, settings, Ghostty renderer |
| M6 `moshttyctl` CLI | Planned | Connected app commands and offline cleanup |
| M7 Real remote acceptance | Planned | macOS host smoke and reconnect workflow |
| Testing plan | Done | See `docs/moshtty-testing.md` |

## Task Status

| Task | Owner | Status | Brief |
| --- | --- | --- | --- |
| Scaffold Moshtty repo | Antigravity | Ready for review | `docs/agents/2026-05-25-1-moshtty-scaffold.md` |
| Desktop state shell | Agent | Ready for review | `docs/agents/2026-05-25-2-desktop-state-shell.md` |
| macOS remote companion | Agent (M3) | Ready for review | `docs/agents/2026-05-25-3-macos-remote-companion.md` |
| WebTransport Mosh mux | Unassigned | Planned | `docs/agents/2026-05-25-4-webtransport-mosh-mux.md` |
| Moshtty UI and Ghostty | Unassigned | Planned | `docs/agents/2026-05-25-5-moshtty-ui-ghostty.md` |
| `moshttyctl` CLI | Unassigned | Planned | `docs/agents/2026-05-25-6-moshttyctl-cli.md` |

Allowed status values:

- Planned
- In progress
- Blocked
- Ready for review
- Done

## User Experience Requirements

Main shell:

- Left project rail, collapsible.
- Top in-app tab/action bar.
- Large terminal pane canvas.
- Minimal controls: tabs, new tab, split actions, command palette, connection status.
- Subtle persistent connection status.
- Project dashboard when no terminal tab is selected.

Visual style:

- Primary reference is the four screenshots from `2026-05-24 18.46.xx` in ChromeOS Downloads.
- Quiet light UI by default.
- Compact desktop density.
- Flat rows, subtle dividers, very few cards.
- Centered modals for project, remote, and settings edits.
- Project identity is a color chip plus initial.
- Remote identity shows friendly label, host, platform, and status.

Settings:

- Light/Dark/System app mode.
- Terminal theme linked to app mode by default.
- Terminal essentials: font family, font size, cursor style, scrollback, and app action keybindings.

## Functional Requirements

Desktop app:

- Import remote profile JSON.
- Create/edit/delete remotes.
- Create projects bound to one remote.
- Create tabs inside projects.
- Split panes inside tabs.
- Reconnect last active project on app start.
- Mark panes lost after companion restart without deleting local layout.

Remote companion:

- Start as macOS LaunchAgent.
- Keep pane PTYs alive while companion runs.
- Emit profile JSON with URL, token, cert hashes, platform, version, and defaults.
- Rotate short-lived WebTransport cert hashes and publish current/next hash over authenticated control.
- Expose a per-user Unix socket for `moshttyctl`.

CLI:

- `moshttyctl` app/layout commands require active app connection.
- Offline cleanup commands can list and kill remote orphan PTYs.
- Core commands include list, tab new/close/focus/rename, pane split/close/focus/resize/rename.
- CLI-created panes use the CLI process cwd.
- App-created panes use the project default cwd.

## Acceptance Criteria

The first full acceptance pass requires:

1. Electron app runs from the repo on ChromeOS/Crostini.
2. `moshtty-remote` runs on a real macOS host as a LaunchAgent.
3. The remote profile JSON imports into the app.
4. The app opens one project connected to the macOS remote.
5. The app creates a tab with multiple split panes.
6. Each pane runs an independent remote shell command.
7. Reloading/restarting the Electron app reconnects to existing remote panes.
8. `moshttyctl pane split` from the remote host creates a pane in the active app project.
9. Restarting the companion marks panes lost and offers restart without deleting local layout.
10. Relevant unit/integration tests pass for the touched components.
11. Electron visual regression screenshots pass for the required UI states before UI milestones are marked done.
12. agent-browser exploratory QA is used for UI review before M5/M7 acceptance.

## Risks

| Risk | Mitigation |
| --- | --- |
| `mosh-go` server APIs are UDP-oriented | Isolate a narrow adapter/vendor layer and test it directly |
| WebTransport cert hashes expire quickly | Publish next hash while connected; require manual profile reimport if missed |
| Electron secure origin with WebTransport has quirks | Use `app://moshtty` secure protocol and verify early in M2/M4 |
| `safeStorage` may be weak/unavailable in Crostini | Add passphrase-encrypted fallback before storing tokens |
| First milestone is broad | Cut visual polish/settings breadth before cutting transport, multipane, or CLI |
| Remote macOS unsigned binaries hit Gatekeeper friction | Use personal-use unsigned/ad-hoc path and document quarantine/signing command |
| Parallel agents conflict | Agents work from briefs, update this PRD, and avoid shared-file edits without coordination |

## Current Notes

- M0 documentation is complete and ready for review.
- M1 scaffold is ready for review on `feat/moshtty-scaffold`.
- M2 desktop state shell is ready for review: secure `app://moshtty` protocol, typed preload `window.moshtty` IPC, versioned `moshtty-state.json` with atomic writes and v0→v1 migration, tab layout schema, Electron `safeStorage` token storage with passphrase-encrypted fallback, and a renderer dev panel to load/save/reset state.
- M2 verification (2026-05-25): `pnpm --filter @moshtty/desktop test` (15 passed), `pnpm --filter @moshtty/desktop typecheck` (passed), `pnpm --filter @moshtty/desktop build` (passed), `git diff --check` (passed).
- M2 visual QA (2026-05-25): `agent-browser connect` against Electron on port 9225 (avoid `--disable-gpu` on Crostini/Wayland). Screenshots in `docs/visual-qa/m2/`. Fixed preload path (`index.mjs`), Zustand render loop, CSP for Vite HMR, and ErrorBoundary for renderer failures.
- M3 macOS remote companion is ready for review: `moshtty-remote` subcommands (`run`, `install`, `profile`, `health`), macOS user-local paths under `~/Library/Application Support/Moshtty`, LaunchAgent plist at `~/Library/LaunchAgents/com.moshtty.remote.plist`, recommended binary install path `~/.local/bin`, default bind `0.0.0.0:4433`, persistent auth token, ECDSA P-256 short-lived certs with SHA-256 hashes, and pasteable profile JSON for app import.
- M3 verification (2026-05-25): `go test ./...` (passed), `go test ./cmd/moshtty-remote ./internal/...` (passed), `git diff --check` (passed). Table-driven tests cover macOS path resolution, config defaults, token generation, cert validity/hash generation, profile JSON shape, LaunchAgent plist generation, and health startup.
- M3 manual macOS install caveats: build `moshtty-remote` on or for macOS, copy binary to `~/.local/bin`, run `moshtty-remote install --binary ~/.local/bin/moshtty-remote`, then `launchctl load -w ~/Library/LaunchAgents/com.moshtty.remote.plist`. Unsigned binaries may require `xattr -d com.apple.quarantine` or ad-hoc signing before first run. WebTransport listener is not started until M4; `run` currently exposes only the localhost health HTTP endpoint on `127.0.0.1:4434`.
- safeStorage availability was not exercised in a live Electron session on this Crostini host during M2; unit tests cover both `safeStorage` and passphrase fallback paths. Confirm `safeStorage` behavior manually on first Electron run.
- The old `agent/` and `web/` architecture remains in the repository only until the scaffold task replaces or removes it.
