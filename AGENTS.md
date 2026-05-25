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
- `docs/agents/*.md` - task briefs for parallel agents.

Agents must update `docs/moshtty-prd.md` status before ending completed or blocked work.

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
- If generated files are introduced, keep source and generated-output commits separate when practical.
- Update `docs/moshtty-prd.md` status before committing a completed or blocked task.

## Multi-Agent Workflow

1. Pick one task brief from `docs/agents/`.
2. Confirm the current git status before editing.
3. Keep edits inside the task's listed paths unless the brief explains otherwise.
4. Add or update tests with the implementation.
5. Run the task's verification commands.
6. Update `docs/moshtty-prd.md` milestone/task status.
7. Commit the slice with an atomic conventional commit message.

Avoid parallel edits to the same files. If two tasks need the same shared module, coordinate through the PRD status notes before editing.
