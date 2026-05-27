# Moshtty PRD And Status

Status date: 2026-05-26

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

| Area                | Decision                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Name                | `Moshtty`; commands use `moshtty`, `moshtty-remote`, `moshttyctl`                                                          |
| Client              | Electron only, ChromeOS/Crostini first                                                                                     |
| Client stack        | `electron-vite`, React + TypeScript, Zustand, CSS modules/plain CSS, pnpm                                                  |
| Renderer            | Keep `ghostty-web`                                                                                                         |
| Testing             | Vitest, Go tests, Playwright Electron screenshots, and agent-browser exploratory QA                                        |
| Agent models        | See `docs/moshtty-model-routing.md`; Gemini 3.5 Flash for bounded implementation, DeepSeek V4 Pro for large-context review |
| Client state        | Versioned JSON through Electron main, atomic writes                                                                        |
| Secrets             | Electron `safeStorage`; passphrase-encrypted fallback                                                                      |
| Remote first target | macOS host                                                                                                                 |
| Remote service      | Per-user LaunchAgent                                                                                                       |
| Remote distribution | Manual build + `scp` for first milestone                                                                                   |
| Transport           | WebTransport streams for JSON-RPC; datagrams for muxed Mosh pane traffic                                                   |
| Mosh                | `mosh-go v0.5.2`, with narrow server adapter/vendor if required                                                            |
| Control protocol    | JSON-RPC 2.0                                                                                                               |
| Port                | WebTransport UDP `4433` by default                                                                                         |
| Bind                | All interfaces by default                                                                                                  |
| Origin              | Exact `app://moshtty` plus explicit dev origins                                                                            |
| CLI                 | Included in first milestone set                                                                                            |
| Vocabulary          | `Project`, `Tab`, `Pane`; avoid user-facing `session`                                                                      |
| Theme               | Light reference baseline; Light/Dark/System setting                                                                        |

## Status Summary

| Planning Item          | Status                | Notes                                                   |
| ---------------------- | --------------------- | ------------------------------------------------------- |
| Architecture decisions | Locked                | Captured in `docs/moshtty-plan.md` and summarized below |
| Implementation branch  | feat/moshtty-scaffold | Branch created from current worktree                    |

| Milestone                     | Status | Notes                                                                                                                                                    |
| ----------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Planning docs              | Done   | PRD, plan, milestones, agent briefs, and Moshtty `AGENTS.md` are present                                                                                 |
| M1 Branch and scaffold        | Done   | New branch layout, pnpm/electron-vite/root Go module. Old runtime quarantined under quarantine/                                                          |
| M2 Desktop state shell        | Done   | Secure `app://moshtty`, typed preload IPC, versioned JSON state, atomic writes, migration, safeStorage + passphrase fallback; verified on Chromebook     |
| M3 macOS remote companion     | Done   | `moshtty-remote` run/install/profile/health, LaunchAgent plist, config/token/certs, profile JSON; verified on macOS remote host                          |
| M4 WebTransport and Mosh mux  | Done   | WebTransport server, JSON-RPC control, mux datagrams, pane lifecycle, renderer transport client; verified E2E against macOS host                         |
| M5 UI and Ghostty integration | Done   | Renderer shell, visual matrix, keymap/settings, live app actions, Ghostty, live Mac shell path, profile import, and reference parity close-out are wired |
| M6 `moshttyctl` CLI           | Done   | Companion Unix socket transport, CLI commands (list, pane close, cleanup), and errors for app-side commands implemented and verified.                    |
| M7 Real remote acceptance     | Done   | Reload reattach, companion-restart lost-pane recovery, and remote `moshttyctl pane split` app-layout control are verified against the Mac companion      |
| M8 UI Refresh                 | Done   | Redesigned app layout, minimal dark/light aesthetic, custom window controls, unified top bar, collapsible projects sidebar, visual tests passing         |
| Testing plan                  | Done   | See `docs/moshtty-testing.md`                                                                                                                            |

## Task Status

| Task                   | Owner       | Status | Brief                                                                                                   |
| ---------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------- | --- |
| Scaffold Moshtty repo  | Antigravity | Done   | `docs/agents/2026-05-25-1-moshtty-scaffold.md`                                                          |
| Desktop state shell    | Agent       | Done   | `docs/agents/2026-05-25-2-desktop-state-shell.md` (verified in `followups/m2-safestorage-on-device.md`) |
| macOS remote companion | Agent (M3)  | Done   | `docs/agents/2026-05-25-3-macos-remote-companion.md`                                                    |
| WebTransport Mosh mux  | Agent (M4)  | Done   | `docs/agents/2026-05-25-4-webtransport-mosh-mux.md` (verified in `followups/m4-mosh-adapter.md`)        |
| Moshtty UI and Ghostty | Codex       | Done   | `docs/agents/2026-05-25-5-moshtty-ui-ghostty.md`                                                        |
| `moshttyctl` CLI       | agy         | Done   | `docs/agents/2026-05-25-6-moshttyctl-cli.md`                                                            |
| Moshtty UI Refresh     | Antigravity | Done   | `docs/agents/2026-05-27-8-moshtty-ui-refresh.md` (verified in `followups/m8-ui-refresh.md`)             |     |

Allowed status values (also defined in `AGENTS.md` -> Status Tiers):

- Planned
- In progress
- Blocked
- Ready for review
- Verified on target — required for milestones with native dependencies (`safeStorage`, WebTransport, real Mosh) before they can be marked `Done`
- Done

Linux-only CI cannot move a target-dependent milestone past `Ready for review` on its own. Use the follow-up briefs under `docs/agents/followups/` to record on-target verification.

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

| Risk                                                   | Mitigation                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `mosh-go` server APIs are UDP-oriented                 | Isolate a narrow adapter/vendor layer and test it directly                                 |
| WebTransport cert hashes expire quickly                | Publish next hash while connected; require manual profile reimport if missed               |
| Electron secure origin with WebTransport has quirks    | Use `app://moshtty` secure protocol and verify early in M2/M4                              |
| `safeStorage` may be weak/unavailable in Crostini      | Add passphrase-encrypted fallback before storing tokens                                    |
| First milestone is broad                               | Cut visual polish/settings breadth before cutting transport, multipane, or CLI             |
| Remote macOS unsigned binaries hit Gatekeeper friction | Use personal-use unsigned/ad-hoc path and document quarantine/signing command              |
| Parallel agents conflict                               | Agents work from briefs, update this PRD, and avoid shared-file edits without coordination |

## Current Notes

- M0 documentation is complete and ready for review.
- M1 scaffold is ready for review on `feat/moshtty-scaffold`.
- M2 desktop state shell is ready for review: secure `app://moshtty` protocol, typed preload `window.moshtty` IPC, versioned `moshtty-state.json` with atomic writes and v0→v1 migration, tab layout schema, Electron `safeStorage` token storage with passphrase-encrypted fallback, and a renderer dev panel to load/save/reset state.
- M2 verification (2026-05-25): `pnpm --filter @moshtty/desktop test` (15 passed), `pnpm --filter @moshtty/desktop typecheck` (passed), `pnpm --filter @moshtty/desktop build` (passed), `git diff --check` (passed).
- M2 visual QA (2026-05-25): `agent-browser connect` against Electron on port 9225 (avoid `--disable-gpu` on Crostini/Wayland). Screenshots in `docs/visual-qa/m2/`. Fixed preload path (`index.mjs`), Zustand render loop, CSP for Vite HMR, and ErrorBoundary for renderer failures.
- M3 macOS remote companion is ready for review: `moshtty-remote` subcommands (`run`, `install`, `profile`, `health`), macOS user-local paths under `~/Library/Application Support/Moshtty`, LaunchAgent plist at `~/Library/LaunchAgents/com.moshtty.remote.plist`, recommended binary install path `~/.local/bin`, default bind `0.0.0.0:4433`, persistent auth token, ECDSA P-256 short-lived certs with SHA-256 hashes, and pasteable profile JSON for app import.
- M3 verification (2026-05-25): `go test ./...` (passed), `go test ./cmd/moshtty-remote ./internal/...` (passed), `git diff --check` (passed). Table-driven tests cover macOS path resolution, config defaults, token generation, cert validity/hash generation, profile JSON shape, LaunchAgent plist generation, and health startup.
- M3 manual macOS install caveats: build `moshtty-remote` on or for macOS, copy binary to `~/.local/bin`, run `moshtty-remote install --binary ~/.local/bin/moshtty-remote`, then `launchctl load -w ~/Library/LaunchAgents/com.moshtty.remote.plist`. Unsigned binaries may require `xattr -d com.apple.quarantine` or ad-hoc signing before first run.
- M4 WebTransport and Mosh mux is ready for review: `moshtty-remote run` now serves authenticated WebTransport on `0.0.0.0:4433` with token + Origin checks, JSON-RPC control stream (`health`, `pane.create`, `pane.attach`, `pane.resize`, `pane.close`), versioned mux datagram framing, localhost UDP bridge into `mosh-go` pane servers, TLS from M3 certs, and a renderer `MoshttyTransport` client with mux/cert-hash helpers.
- M4 verification (2026-05-25): `go test ./...` (passed), `pnpm --filter @moshtty/desktop test` (19 passed), `pnpm --filter @moshtty/desktop typecheck` (passed), `git diff --check` (passed). Tests cover mux encode/decode, auth/origin, JSON-RPC dispatch, pane create/close lifecycle, and health + WebTransport startup wiring.
- M4 follow-ups (required before **Done**): see `docs/m4-mosh-adapter.md`. Summary: live cert-pin WebTransport connect from Electron; one-pane muxed mosh E2E against `moshtty-remote` on the Mac; optional hardening for automated WT integration tests, direct `mosh-go` adapter (replace UDP bridge), faster pane shutdown, and cert-hash rotation over authenticated control. WASM bundling and Ghostty wiring are now covered by M5 live-shell work.
- Remote Mac testing from Crostini uses the local SSH alias `ssh macmini` (and `scp` via the same host) to install binaries, run `moshtty-remote`, and collect profile JSON on the Mac server.
- safeStorage availability was not exercised in a live Electron session on this Crostini host during M2; unit tests cover both `safeStorage` and passphrase fallback paths. Confirm `safeStorage` behavior manually on first Electron run.
- The old `agent/` and `web/` architecture remains in the repository only until the scaffold task replaces or removes it.
- Guardrails recovery (2026-05-25): an off-rails `agy` subagent on a 5a slice prompted `git clean -fd`, which deleted uncommitted infrastructure (design tokens / theme, common-side zod schemas, fixtures, Playwright + axe setup, CI workflow, AGENTS Status Tiers / Stop Conditions / Slice Budget, M5 design contract). The intermediate "recreate" commit (`2fdff46`) restored these in a degraded form (schemas moved out of `common/` with `z.record` shims, profile schema mis-shaped with a `token` field, zod silently bumped to 4.x, CI reduced to 2 jobs, AGENTS process sections lost, M5 brief reverted). Recovery work restored the original strict trust boundary in `apps/desktop/src/common/*.schema.ts`, re-pinned zod to `^3.23.8`, restored CI's `frontend`/`visual`/`go`/`format-and-commits` jobs, the design token contract in Stylelint, the AGENTS Status Tiers / Stop Conditions / Slice Budget, and the full M5 design contract. Verification (2026-05-25): `pnpm --filter @moshtty/desktop` `test` (65 passed), `typecheck`, `lint`, `lint:css`, `build`; `go test ./...` (11 packages); `pnpm format:check`; `git diff --check` — all clean. Follow-up: the M5 visual surfaces still need the renderer-side fixture wiring to actually load `?fixture=<id>` into the store; this is on the M5 brief.
- M5 first renderer slice is in progress (2026-05-25): the renderer now uses a token-backed Moshtty shell with project rail, top tabs, dashboard, terminal pane placeholders, split-layout fixture rendering, import/project/settings dialogs, connection status states, fixture query loading, and `html[lang]` for axe. Playwright Electron launch now passes `--no-sandbox` before the app path. Agent-browser QA screenshots: `docs/visual-qa/m5/agent-browser-dashboard-light.png`, `docs/visual-qa/m5/agent-browser-dashboard-dark.png`, and `docs/visual-qa/m5/agent-browser-dialog-import-invalid.png`.
- M5 verification (2026-05-25 first slice): `pnpm install --frozen-lockfile` (already up to date after adding the existing pnpm shim to `~/.local/bin/pnpm`), `pnpm --filter @moshtty/desktop typecheck` (passed), `lint` (passed), `lint:css` (passed), `test` (65 passed), `build` (passed), `test:visual` (5 passed, 13 fixture screenshot baseline tests still marked fixme), `go test ./...` (passed), `go vet ./...` (passed), `git diff --check` (clean). `pnpm verify` now runs through lint, css lint, typecheck, Vitest, and Go tests, then fails only at `format:check` on pre-existing untracked M6 brief files (`docs/agents/2026-05-25-6a-ctlsocket-transport.md`, `docs/agents/2026-05-25-6b-cli-commands.md`), which were left untouched. `test:coverage` ran all 65 tests but failed existing coverage thresholds because broad app/main/preload/icon files and `src/common/{state,mux}.ts` remain below configured thresholds. `golangci-lint` was installed at `~/.local/bin/golangci-lint` (v2.12.2), but `golangci-lint run ./...` is blocked because `.golangci.yml` is still a v1-style config without the v2 `version` field; updating that shared tool config is a follow-up.
- M5 visual matrix slice (2026-05-25): enabled deterministic Playwright screenshots for dashboard populated/empty/dark, project rail expanded/collapsed/empty, tab bar single/multi/dragging stand-in/overflow, terminal pane active/lost, split layouts 2-row/2-column/3-nested/handle hover, import dialog empty/valid/invalid, project edit new/existing, terminal settings follow-app/light/dark, and connection status offline/connecting/connected/lost. Axe now runs against dashboard, active tab, and import dialog. `apps/desktop/playwright.config.ts` runs Electron visual tests single-worker to avoid target teardown races. Verification: `pnpm --filter @moshtty/desktop build` (passed), `test:visual:update` (34 passed, baselines written), `test:visual` (34 passed), `lint`, `lint:css`, `test` (65 passed), and `git diff --check` (clean).
- M5 keymap/settings slice (2026-05-25): added a renderer keymap registry for visible app actions, documented pointer-only exceptions, routed keyboard handling through the registry, tagged visible buttons with action IDs, and expanded terminal settings to list registered shortcuts and pointer-only actions. Verification: `pnpm --filter @moshtty/desktop typecheck`, `lint`, `lint:css`, `test` (71 passed), `build`, `test:visual:update` (34 passed, settings baselines regenerated), and `test:visual` (34 passed).
- M5 action-wiring slice (2026-05-25): wired live renderer controls and shortcuts to local store actions for project creation through the dialog, tab creation, project rail collapse, settings/import dialog open/close, and remote profile import via `parseMoshttyProfileText` before state insertion. Added dialog fixture routing tests and store tests for tab creation, remote profile import, and rail collapse persistence. Agent-browser exploratory QA connected to Electron over CDP port 9333 and verified dashboard actions, settings dialog open/Escape close, import validation, and new-tab creation; screenshots were saved to `docs/visual-qa/m5/agent-browser-dashboard-actions.png`, `docs/visual-qa/m5/agent-browser-settings-actions.png`, and `docs/visual-qa/m5/agent-browser-import-validation.png`. Verification: `pnpm --filter @moshtty/desktop typecheck` (passed), `lint` (passed after rerun; first parallel run hit transient ESLint temp-file ENOENT), `lint:css` (passed), `test` (77 passed), `build` (passed), and `test:visual` (34 passed after rebuilding before the final run).
- M5 live-shell slice (2026-05-26): terminal panes now create remote panes through the imported/stored remote profile, normalize profile URLs to the WebTransport endpoint, load the stored token through the typed preload API, run the browser-side `mosh-go` WASM client, route muxed datagrams into Ghostty, and remember pane flow IDs for the running renderer session. The store now binds the active placeholder project to the first imported real remote. Agent-browser QA against Electron CDP port 9333 and the live `macmini` companion verified `Connected`, `moshttyctl list` showing an active pane, and remote `/bin/sh` accepting input and returning command output. Screenshot: `docs/visual-qa/m5/live-shell-pressed-command.png`. Verification: `pnpm --filter @moshtty/desktop typecheck` (passed), `lint` (passed after rerun; first parallel run hit transient ESLint temp-file ENOENT), `lint:css` (passed), `test` (80 passed), `build` (passed), `test:visual` (34 passed), `go test ./...` (passed after isolating untracked scratch Go programs under `scratch/go.mod`), and `git diff --check` (clean).
- M5 profile-import slice (2026-05-26): Electron profile parsing now normalizes both canonical profiles and the previously deployed `moshtty-remote profile` shape, while the Go companion now emits canonical `schemaVersion`, `remoteId`, `hostLabel`, token, cert hashes, and cols/rows defaults. Token-bearing imports store the token through Electron secret storage; on passphrase-fallback hosts the import dialog shows a token passphrase field. The rebuilt `moshtty-remote` binary was deployed to `macmini` and restarted under LaunchAgent. Agent-browser QA pasted the canonical live Mac profile into the import dialog, entered a token passphrase, verified `Connected`, verified tab/pane placeholders rename to `Shell`, and confirmed `moshttyctl list` shows a remote pane. Screenshot: `docs/visual-qa/m5/profile-import-passphrase-live-shell.png`.
- M5 design parity close-out (2026-05-26): mapped all four `2026-05-24 18.46.*` reference screenshots in `docs/moshtty-design-references.md`, generated side-by-side artifacts under `docs/visual-qa/m5/project-dashboard-light/`, `expanded-project-rail/`, `project-edit-dialog/`, and `settings-dialog/`, and filed `docs/moshtty-design-checkup-m5-2026-05-26.md`. A settings dialog height fix keeps long shortcut lists inside a centered scrollable modal at the Playwright viewport. The root `test:visual` script now delegates to the desktop package so `pnpm verify:full` can run the documented visual gate. Verification: `pnpm --filter @moshtty/desktop build` (passed), `pnpm --filter @moshtty/desktop test:visual:update -- dialogs.test.ts` (passed; settings baselines regenerated), `pnpm verify:full` (passed), `pnpm verify` (passed), `pnpm --filter @moshtty/desktop test:coverage` (81 tests passed, coverage gate failed on existing broad thresholds and low per-file `state.ts`/`mux.ts` coverage).
- M5 follow-ups: `test:coverage` and `golangci-lint` blockers are closed as of 2026-05-26. The coverage gate now excludes Electron entrypoints, preload bridge, visual React shell surfaces, icon catalog, and live WASM transport wrappers from unit coverage while keeping common/state/store/helper modules in scope; `state.ts` and `mux.ts` both meet their per-file thresholds. `.golangci.yml` is migrated to v2, formatter checks are in the v2 `formatters` section, and local `golangci-lint` v2.12.2 was rebuilt with Go 1.26. Verification: `pnpm --filter @moshtty/desktop test:coverage` (91 passed), `golangci-lint run ./...` (0 issues). M7 owns restart/reconnect acceptance, `moshttyctl` app-layout integration, and companion-restart lost Pane handling.
- M7 reload reattach slice (2026-05-26): local pane state now persists the remote `flowId`, and terminal bootstrap calls `pane.attach` instead of creating a new remote pane when a saved flow exists. Unit coverage added for state/schema normalization and store persistence. Live QA against `macmini` imported a fresh canonical profile, created remote pane flow `4`, reloaded Electron through CDP, and confirmed `moshttyctl list` still showed only flow `4` after reload. Screenshot: `docs/visual-qa/m7-reload-reattach-after-wait.png`. Verification: `pnpm --filter @moshtty/desktop lint` (passed), `pnpm --filter @moshtty/desktop typecheck` (passed), `pnpm --filter @moshtty/desktop test` (85 passed), `git diff --check` (passed). Follow-up: the first implementation reused the saved flow but exposed a blank Ghostty buffer after reload.
- M7 reload visible-output fix (2026-05-26): `moshtty-remote` now keeps the pane PTY and shell process durable while replacing the per-attach mosh server/UDP bridge, so a browser reload gets a fresh mosh key against the existing pane instead of trying to resume a stale client/server SSP state. Live QA deployed the rebuilt macOS companion to `macmini`, created flow `2`, verified fresh shell output, reloaded Electron through CDP, confirmed `moshttyctl list` still showed only flow `2`, focused Ghostty's input textarea, and verified `echo focus-textarea` rendered after reattach. Screenshot: `docs/visual-qa/m7-reload-reattach-textarea-type.png`. Verification: `go test ./internal/pane` (passed), `go test ./...` (passed).
- M7 companion-restart pane recovery (2026-05-26): renderer panes with saved remote flow IDs now become `Pane lost` when `pane.attach` reports the companion no longer knows the flow, preserving the local tab/layout and showing a `Restart pane` command. Restart clears the stale flow ID, creates a fresh remote pane, persists the new flow, and returns the pane to active shell output. Live QA against `macmini` restarted the companion, verified `moshttyctl list` showed no active panes while the app marked flow `2` lost, clicked `Restart pane`, confirmed a fresh flow appeared, and verified `echo restarted-pane` rendered. Screenshots: `docs/visual-qa/m7-companion-restart-pane-lost-restart.png`, `docs/visual-qa/m7-companion-restart-pane-output.png`. Verification: `pnpm --filter @moshtty/desktop test` (93 passed), `pnpm --filter @moshtty/desktop typecheck` (passed), `pnpm --filter @moshtty/desktop lint:css` (passed).
- M7 remote CLI app-layout split (2026-05-26): the WebTransport control stream now supports bidirectional JSON-RPC, so `moshttyctl pane split [right|down]` forwards `app.pane.split` to the connected renderer instead of returning an app-required placeholder error. The renderer schedules the split on the active project, the existing pane-mount path creates the corresponding remote pane, and the CLI returns `Pane split.`. Live QA deployed the rebuilt `moshtty-remote` and `moshttyctl` to `macmini`, ran `moshttyctl pane split right`, confirmed the CLI succeeded, confirmed `moshttyctl list` gained a new flow, and captured the Electron split layout. Screenshot: `docs/visual-qa/m7-moshttyctl-pane-split.png`. Verification: `go test ./internal/wtserver ./cmd/moshttyctl` (passed), `go test ./...` (passed), `golangci-lint run ./...` (0 issues), `pnpm --filter @moshtty/desktop test` (93 passed), `pnpm --filter @moshtty/desktop typecheck` (passed), `pnpm --filter @moshtty/desktop lint` (passed), `git diff --check` (passed). M7 is ready for review; a final full acceptance sweep can still be repeated from a fresh app state.
- M6 `moshttyctl` CLI (2026-05-25): Companion Unix socket JSON-RPC server and client transport implemented. Fully supported commands include `moshttyctl list` (alias `cleanup list`) and `moshttyctl pane close <flow-id>` (alias `cleanup kill <flow-id>`). Commands for tab layout and splits (`tab`, `pane split/focus/rename`) properly return clear errors requiring active Electron application connection. Verification: `go test ./...` (passed), `go vet ./...` (passed), `git diff --check` (clean). All 12 packages in internal Go modules passed tests, including new ctlsocket and pane manager unit tests.
- M3 & M4 target verification (2026-05-25): Compiled and deployed `moshtty-remote` to remote host `macmini` (macOS x86_64). Installed and ran companion under launchd LaunchAgent, listening on port 4433. Generated profile JSON, normalized and imported it into the running Electron desktop app (CDP port 9222). Verified successful cert-pinned WebTransport handshake between Electron and remote companion. Verified remote pane creation via WebTransport control stream and verified socket-based CLI controls using `moshttyctl list` and `moshttyctl pane close` from the macOS host. Screenshots captured at `docs/visual-qa/m6-initial.png` and `docs/visual-qa/m6-imported.png`. Verification clean.
- M8 UI Refresh (2026-05-27): Redesigned the Electron app shell to run as a frameless window with custom WindowControls (minimize, maximize, close) in a unified horizontal TopBar containing horizontal tabs, toggle, and connection status. Replaced the multi-purpose project rail with a collapsible, projects-only Sidebar. Extracted the Dialogs and Dashboard interfaces, shrinking `App.tsx` from ~900 lines to under 200 lines. Resolved color contrast issues on the brand badge, empty-copy warning text, and offline status text to achieve a WCAG AA pass. Verification: `pnpm verify:full` (passed) with all 33 Playwright visual and Axe-core accessibility checks green, Vitest unit tests green, and Go tests/vetting clean.
- M2 & M4 on-target verification follow-ups (2026-05-27): Verified `safeStorage` availability and passphrase-encrypted fallback token storage E2E on the developer Chromebook using Playwright CDP script (verified successful store/load/delete token round-trip under fallback mode). Deployed and verified E2E mosh connection to launchd remote companion on macOS host `macmini`. Pasted canonical profile JSON, entered decryption passphrase, verified connection established successfully over WebTransport, typed interactive shell inputs, and verified output on-screen. Captured verification screenshots under `docs/visual-qa/m6-connected.png` and `docs/visual-qa/m6-typed.png`.
