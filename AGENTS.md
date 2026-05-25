# AGENTS.md

## Project

This repository is being reset into **Moshtty**, an Electron desktop remote terminal.

Moshtty is not the old Crostini-local PWA terminal. New work should target:

- Electron desktop client in `apps/desktop`;
- Go remote companion in `cmd/moshtty-remote`;
- Go remote CLI in `cmd/moshttyctl`;
- shared Go packages under `internal/`;
- `ghostty-web` as the terminal renderer.

The old local Go PTY agent and PWA/service-worker architecture are deprecated for Moshtty. Use old code only as reference for terminal rendering, split layout ideas, shortcuts, and theme behavior.

## Canonical Docs

Read these before starting implementation work:

- `docs/moshtty-prd.md` - product requirements, scope, status, risks.
- `docs/moshtty-plan.md` - architecture decisions from planning.
- `docs/moshtty-milestones.md` - implementation roadmap and acceptance criteria.
- `docs/moshtty-testing.md` - testing strategy, visual regression, and agent-browser QA.
- `docs/moshtty-model-routing.md` - model choice guidance for external subagents.
- `docs/agents/*.md` - task briefs for parallel agents.

Agents must close out `docs/moshtty-prd.md` before ending completed or blocked work: update task and milestone status, record verification commands, note blockers or follow-ups, and make sure the PRD does not show stale ownership/status for their slice.

## Status Tiers

Use exactly these status values in `docs/moshtty-prd.md`, `docs/moshtty-milestones.md`, and task briefs:

- `Planned` — accepted into the roadmap; no implementation work has started.
- `In progress` — actively being worked on by a named owner.
- `Blocked` — cannot progress without an external dependency, decision, or platform; the blocker must be documented in the PRD.
- `Ready for review` — implementation and tests are complete on the host where development happens; awaiting coordinator review.
- `Verified on target` — exercised on real target hardware (macOS for the remote, the user's primary Linux/Chromebook for the desktop client). Required for milestones that include native-only behavior (`safeStorage`, WebTransport, etc.).
- `Done` — final state. Used only after `Verified on target` for milestones that have a target-verification requirement; for purely documentation milestones, `Ready for review` -> `Done` is fine.

Coordinators should never mark a milestone with native dependencies as `Done` from a Linux-only CI run. Use `Verified on target` to make the gap explicit.

## Stop Conditions

If your task drifts into any of the following, **stop and surface to the coordinator** before writing more code:

- a slice would touch `apps/desktop/src/renderer/src/design/tokens.{ts,css}`, `theme.ts`, or `docs/moshtty-design-system.md` (token / theme contract);
- a slice would change schemas under `apps/desktop/src/common/*.schema.ts` or the IPC contract in `apps/desktop/src/common/moshtty-api.ts` (renderer/main trust boundary);
- a slice would change `docs/moshtty-prd.md`, `docs/moshtty-milestones.md`, `docs/moshtty-testing.md`, `docs/agents/OWNERS.md`, or `AGENTS.md` outside of the close-out step;
- a slice would edit files outside the task brief's owned paths in `docs/agents/OWNERS.md`;
- a slice would add a new top-level dependency, change the Electron, Node, or Go version, or modify `pnpm-workspace.yaml` / `go.mod` toolchain entries;
- you discover that the agreed approach in the task brief no longer matches the code (the brief is out of date — fix the brief first).

Drift is a coordinator problem, not a worker problem. Pause, write the blocker into the PRD, and wait for direction. Coordinators should give immediate corrective feedback when a worker is on the wrong path; do not let a slice finish on a wrong trajectory.

## Slice Budget

Each task brief should be sized to a single reviewable slice. Soft and hard caps:

- soft cap: **8 changed files** per slice, excluding lockfiles and generated output;
- hard cap: **20 changed files**;
- a slice should land in one atomic conventional commit.

If you hit the soft cap, stop and check whether the slice can be split. If you hit the hard cap, stop and surface to the coordinator — either the brief needs to be rescoped, or the work needs to be split across multiple briefs. Do not pad an oversized slice into a single commit.

## Architecture Rules

- Product name is `Moshtty` for UI/docs and `moshtty` for commands, package IDs, and paths.
- User-facing model is `Project -> Tab -> Pane`. Avoid user-facing "session" terminology.
- One project connects to one remote companion.
- One pane maps to one remote PTY/shell.
- The Electron app owns projects, tabs, layouts, focus, and visible UI state.
- The remote companion owns durable pane PTYs and transport state.
- Use WebTransport streams for JSON-RPC control.
- Use WebTransport datagrams for muxed Mosh pane traffic.
- Use `mosh-go` for the Mosh protocol. Vendor or adapt only narrow server-side hooks when needed, with tests.
- Automatic SSH bootstrap, IWA, Direct Sockets, official `mosh-server` compatibility, and raw UDP fallback are out of scope for the first cut.

## Tooling

Frontend/client:

```bash
pnpm install
pnpm --filter @moshtty/desktop dev
pnpm --filter @moshtty/desktop test
pnpm --filter @moshtty/desktop typecheck
pnpm --filter @moshtty/desktop build
```

Go:

```bash
go test ./...
go test ./internal/...
go test ./cmd/moshtty-remote ./cmd/moshttyctl
```

These commands may not exist until the scaffold milestone lands. If a task creates or changes tooling, update this file and the PRD status.

## Code Style

- Keep TypeScript strict and explicit at module boundaries.
- Use React + TypeScript for the renderer.
- Use Zustand for renderer app state.
- Use CSS modules or plain CSS. Do not introduce Tailwind or a component library unless the PRD is updated.
- Keep Electron main/preload APIs narrow and typed. Renderer code must not access arbitrary filesystem APIs directly.
- Store app state through Electron main as versioned JSON with atomic writes.
- Store remote tokens through Electron `safeStorage`; if unavailable or weak, use a passphrase-encrypted fallback.
- Keep Go packages small and protocol-oriented. Prefer table-driven tests for protocol, mux, config, cert, and lifecycle behavior.
- Use `gofmt` for Go and the configured formatter for TypeScript once present.
- Every new non-trivial TypeScript module needs a nearby test.
- Every new Go package needs focused tests unless it is pure command wiring.

## Testing Rules

Run the smallest relevant tests while working. Before committing a task, run the full verification for that task brief.

Minimum expectations:

- TypeScript changes: run relevant Vitest tests and typecheck.
- Electron IPC/state changes: test state migration, IPC contract, and error paths.
- Go protocol/config changes: run `go test ./...`.
- Transport changes: test mux framing, JSON-RPC auth/origin checks, and pane lifecycle.
- UI changes: test reducers/theme/layout behavior and inspect the app manually.
- Visual/UI changes: add or update Playwright Electron screenshots and use `agent-browser` for exploratory Electron QA when reviewing real app states.

If a required command is unavailable because the scaffold has not landed, document that in `docs/moshtty-prd.md` under status notes.

## Design Rules

Use the four screenshots from `/mnt/chromeos/MyFiles/Downloads` as primary visual references:

- `Screenshot 2026-05-24 18.46.04.png`
- `Screenshot 2026-05-24 18.46.17.png`
- `Screenshot 2026-05-24 18.46.25.png`
- `Screenshot 2026-05-24 18.46.36.png`

Visual direction:

- quiet light desktop UI by default;
- compact left project rail;
- large terminal work area;
- flat rows and subtle dividers;
- minimal top tab/action bar;
- centered modals for edits/import/settings;
- compact density by default;
- Light/Dark/System mode setting;
- terminal palette linked to app mode by default.

Do not create a marketing landing page. The first screen should be the usable app shell or project dashboard.

## Git And Commit Rules

- Work in small, reviewable slices.
- Always commit completed work before handing it back, unless the user explicitly asks not to commit or the task is intentionally left blocked.
- Prefer atomic commits: each commit should contain one coherent docs, scaffold, feature, fix, or test slice.
- Use conventional commits:
  - `feat:` for features;
  - `fix:` for defects;
  - `refactor:` for structure changes;
  - `test:` for test-only changes;
  - `docs:` for documentation;
  - `chore:` for tooling and generated metadata.
- Do not commit failing tests unless the PRD explicitly marks the task blocked and the commit is a documented handoff.
- Do not push unless the coordinator/user asks.
- Do not rewrite, revert, or clean up another agent's unrelated changes.
- Do not run destructive git commands unless explicitly requested.
- Never run `git clean -fd` without first running `git status` to review untracked files. Prefer `git checkout -- .` for reverting only tracked file changes. Untracked files may represent uncommitted work from prior agents — deleting them without review can destroy in-progress infrastructure.
- If generated files are introduced, keep source and generated-output commits separate when practical.
- Close out `docs/moshtty-prd.md` before committing a completed or blocked task.
- Give immediate corrective feedback when a subagent is on the wrong path. Do not wait for a slice to finish if the scope, model choice, file ownership, or verification plan is wrong; stop, restate the correction, and reassign the work.

## Multi-Agent Workflow

1. Pick one task brief from `docs/agents/`.
2. Claim the brief's owned paths against `docs/agents/OWNERS.md` and confirm no overlap with another in-progress task.
3. Confirm the current git status before editing. Inspect untracked files; never `git clean -fd` them without explicit coordinator approval.
4. Keep edits inside the task's listed paths unless the brief explains otherwise. Watch the slice budget.
5. Add or update tests with the implementation.
6. Run the task's verification commands.
7. Fill in `docs/agents/TEMPLATE_HANDOFF.md` (or post the equivalent in the PRD) before closing out: what shipped, what was deferred, what needs follow-up, where the visual or on-device verification stands.
8. Close out `docs/moshtty-prd.md` for the task: milestone/task status (from the Status Tiers list), owner, verification notes, blockers, and follow-ups.
9. Commit the slice with an atomic conventional commit message.

Avoid parallel edits to the same files. If two tasks need the same shared module, coordinate through the PRD status notes before editing.

The `cmd` harness with model `deepseek/deepseek-v4-pro` is allowed for subagents when a task is well scoped and has a clear write boundary. Gemini 3.5 Flash via Antigravity/`agy` is also allowed for bounded implementation work. Follow `docs/moshtty-model-routing.md` for model selection. Give all external agents the same docs and task-brief instructions, and require the same verification, PRD close-out, and atomic conventional commit behavior. If a worker starts drifting, stop it immediately and correct the scope before more files change.
