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

Status: Done

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

Status: Done

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

Status: Done

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

Status: Done

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

Status: Done

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

Status: Done

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

Status: Done

Objective:

- Prove the real first-use path against a macOS remote.
- 2026-05-26 update: reload reattach now preserves the same remote pane and renders new shell output after reconnect; companion restart now marks stale panes lost and can restart them without deleting layout; `moshttyctl pane split` now drives the active Electron layout through bidirectional app control.

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

## M8 UI Refresh

Status: Done

Objective:

- Redesign the Moshtty app shell to achieve a minimal, dark gray/white aesthetic with gray borders, a unified top bar (containing tabs, window controls, and sidebar toggle), and a collapsible project-only sidebar.
- Shrink the monolithic `App.tsx` down to under 200 lines by extracting components.

Deliverables:

- Dark/light custom color property updates in `tokens.css` and `tokens.ts`.
- Electron configuration for frameless window.
- Custom WindowControls component containing minimize, maximize, close buttons.
- Unified TopBar component containing tabs, toggle, status indicator, and WindowControls.
- Projects-only Sidebar component with toggle animation support.
- Centralized Dialogs component.
- Extracted Dashboard component.
- Modularized App.tsx under 200 lines.

Acceptance:

- Visual regression screenshots regenerated and verified.
- Axe-core accessibility checks updated and fully passing.
- Root `pnpm verify:full` completes successfully.

Agent brief:

- `docs/agents/2026-05-27-8-moshtty-ui-refresh.md`

## M8b UI Polish

Status: In progress

Note: 2026-05-27 audit (`docs/visual-qa/8b/M8b-design-gap-assessment.md`) found reference-parity gaps. Remaining work is scoped to **M8c UI Followup** below.

Objective:

- Finish the visual quality gap left after M8: remove Bootstrap-era artefacts, make
  terminal panes edge-to-edge, add a terminal color theme picker, and align the tab strip
  with the OpenCode pill-tab reference.

Deliverables:

- BETA badge removed from `TopBar.tsx` and `TopBar.css`.
- `.button.primary` restyled to near-black/white (no blue fill).
- Terminal workspace padding removed; pane border and radius removed; split handle becomes
  a 1 px hairline.
- `terminalThemes.ts` module with six named color presets (Default Dark/Light, Dracula,
  Catppuccin Mocha, Solarized Dark/Light) + `auto` mode via localStorage.
- `TerminalPane.tsx` wired to new theme module.
- Terminal theme picker `<select>` in the Settings dialog.
- Tab strip redesigned: inactive tabs bare (no fill), active tab single pill
  (`background: ~#e8e8e8`, `border-radius: 6px`), 1 px vertical dividers between tabs.

Acceptance:

- No BETA badge.
- Primary buttons are neutral (near-black/white), not indigo/blue.
- Terminal panes span edge-to-edge; no rounded card borders.
- Settings dialog shows theme picker with 7 options (Auto + 6 presets).
- Tab strip matches `docs/visual-qa/8b/references/opencode-tab-bar.png`.
- `pnpm verify:full` passes.
- agent-browser QA screenshots captured for all 7 required states in `docs/visual-qa/8b/`.
- axe-core passes on top bar and settings dialog.

Agent brief:

- `docs/agents/2026-05-27-8b-moshtty-ui-polish.md`

## M8c UI Followup

Status: Planned

Objective:

- Close the reference-parity gap left by M8b: top-bar restructure (panel-left icon leftmost, overflow icon to its right, left-aligned tabs with vertical padding and always-visible close), pane chrome → floating hover pills with full-area terminal fill, settings dialog discipline + working theme/font/cursor controls, dashboard + sidebar tone (flat search row, sentence-case "Projects"), light terminal token fix, project edit modal replacing inline rename, and visual QA baseline refresh.

Deliverables:

- 8c.1 Top bar restructure + OpenCode tab strip (`TopBar.tsx`, `TopBar.css`, new icons).
- 8c.2 Pane chrome → hover pills + full-area terminal (`TerminalPane.tsx`, pane rules in `main.css`).
- 8c.3 Settings dialog discipline + working controls (`Dialogs.tsx`, `Dialogs.css`).
- 8c.4 Dashboard + sidebar tone, text only (`Dashboard.*`, `Sidebar.*`).
- 8c.5 Tokens stop-condition triplet for light `--color-terminal-bg` (coordinator-only).
- 8c.7 Project edit modal replacing inline rename (`dialogs.ts`, `Dialogs.tsx`, `Sidebar.tsx`).
- 8c.6 Visual QA + baselines refresh and live-audit screenshots.

Acceptance:

- All seven sub-slices land as separate atomic conventional commits.
- `pnpm verify:full` passes after 8c.6.
- Live agent-browser captures for `topbar-icons-order`, `tab-close-always-visible`, `pane-hover-pills`, `pane-light-no-gutter`, `project-edit-modal` all exist under `docs/visual-qa/8b/live-audit/`.
- M8b row moves from `In progress` to `Done` once 8c.6 ships and the design-checkup rubric in `docs/moshtty-design-checkup.md` is re-scored.

Agent brief:

- `docs/agents/2026-05-27-8c-moshtty-ui-followup.md`

## M8d UI Corrections

Status: Ready for review

Note: M8c slices (8c.1–8c.7) landed on the diff level but the 2026-05-27 live audit (`docs/visual-qa/8b/live-audit/m8c/`) revealed real spec drift: tab project chips are illegible, Ghostty canvas underfills the pane (CSS-only fix in 8c.2 was overridden by inline canvas styles), overflow icon should be a hamburger, info pill carries redundant title + status text, pane pills should be glass, sidebar bootstrap/import buttons belong in the project dialog, project dialog should feel like preferences.

Objective:

- Land five small slices that close the parity gap to OpenCode for the live shell view (top bar, pane chrome, sidebar, project dialog), then validate with live agent-browser audit before marking M8c + M8d Ready for review.

Deliverables:

- 8d.0 Glass-surface tokens (`tokens.{ts,css}`, design-system doc) — coordinator only.
- 8d.1 Top bar: hamburger + tab status roundel (`TopBar.{tsx,css}`).
- 8d.2 Terminal pane: `FitAddon` wiring + glass pills + status roundel (`TerminalPane.tsx`, pane block of `main.css`).
- 8d.3 Sidebar: drop header bootstrap/import buttons, grow project-row action icons (`Sidebar.{tsx,css}`).
- 8d.4 Project dialog as preferences view with bootstrap + import sections (`Dialogs.{tsx,css}`, `dialogs.ts`).
- 8d.5 Live visual QA + audit notes under `docs/visual-qa/8b/live-audit/m8d/`.

Acceptance:

- All five slices land as separate atomic conventional commits.
- Terminal canvas fills the pane (no dead band at the bottom, no horizontal overflow) — confirmed by inspecting `<canvas>.getBoundingClientRect()` vs `.terminal-container.getBoundingClientRect()` live.
- Pane chrome pills read as glass over the terminal canvas; status indicator is a single colored roundel using the functional color tokens.
- Tab strip shows a status roundel per tab (worst-pane-status: lost > connecting > connected) and no project chip.
- Sidebar has no Bootstrap / Import header buttons; project rows have larger edit/delete actions inside the hover pill.
- Project dialog has Project / Remote server / Profile import sections and a working Install/Update button that opens the existing bootstrap dialog.
- Live agent-browser screenshots saved under `docs/visual-qa/8b/live-audit/m8d/` with a short audit note vs OpenCode refs.

Agent brief:

- `docs/agents/2026-05-27-8d-moshtty-ui-corrections.md`

## M9b Command Palette

Status: Ready for review

Objective:

- Add a `Ctrl+K` command palette overlay so users can search and invoke any registered
  app action by keyboard without mousing through menus.

Deliverables:

- `open-command-palette` action in `keymap.ts` (shortcut `Ctrl+K`).
- `appHandlers.ts` hook extracting the handler map from `App.tsx`.
- `CommandPalette.tsx` overlay component: search input, filtered action list, keyboard
  navigation (↑/↓/Enter/Escape), mouse hover, disabled mouseOnly rows with tooltip.
- `CommandPalette.css` styled to token contract.
- `App.tsx` wired to render palette on `Ctrl+K`.
- Focus trap and focus-return on open/close.
- `role="dialog"` / `role="listbox"` / `role="option"` accessibility.

Acceptance:

- `Ctrl+K` opens the palette from any app state.
- Typing filters actions in real time (case-insensitive substring).
- ↑/↓ navigates; Enter invokes + closes; Escape closes without invoking.
- mouseOnly actions show grayed/disabled; cannot be invoked.
- Closing returns focus to the previously focused element.
- Light and dark mode both render correctly.
- `pnpm verify:full` passes.
- agent-browser QA screenshots for 5 required palette states in `docs/visual-qa/9b/`.
- axe-core passes on the open palette.

Agent brief:

- `docs/agents/2026-05-27-9-command-palette.md`
