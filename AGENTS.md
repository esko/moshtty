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

- `docs/moshtty-prd.md` — product requirements, scope, status, risks.
- `docs/moshtty-plan.md` — architecture decisions from planning.
- `docs/moshtty-milestones.md` — implementation roadmap and acceptance criteria.
- `docs/moshtty-testing.md` — testing strategy, visual regression, and agent-browser QA.
- `docs/moshtty-design-system.md` — token / theme contract for renderer work (mandatory before any UI edit).
- `docs/moshtty-design-references.md` — reference screenshot mapping to UI surfaces.
- `docs/moshtty-design-checkup.md` — design vital-signs rubric (run at end of M5 and M7).
- `docs/moshtty-model-routing.md` — model choice guidance for external subagents.
- `docs/agents/*.md` — task briefs for parallel agents.
- `docs/agents/OWNERS.md` — path ownership matrix; consult before editing any file.
- `docs/agents/TEMPLATE_HANDOFF.md` — fill this out before closing a task.

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

If your task drifts into any of the following, **stop and surface to the coordinator** before writing more code. Do not "just fix it" — these paths are coordinator-owned.

- a slice would edit any file outside the task brief's owned paths in [`docs/agents/OWNERS.md`](docs/agents/OWNERS.md);
- a slice would touch the **design contract**: `apps/desktop/src/renderer/src/design/tokens.{ts,css}`, `apps/desktop/src/renderer/src/design/theme.ts`, or `docs/moshtty-design-system.md`;
- a slice would change the **renderer/main trust boundary**: schemas under `apps/desktop/src/common/*.schema.ts` or the IPC contract in `apps/desktop/src/common/moshtty-api.ts`;
- a slice would touch the **shared process docs**: `docs/moshtty-prd.md`, `docs/moshtty-milestones.md`, `docs/moshtty-testing.md`, `docs/agents/OWNERS.md`, or `AGENTS.md` outside of the close-out step explicitly assigned to your brief;
- a slice would change **toolchain or top-level deps**: add a new top-level dependency, change the Electron, Node, pnpm, or Go version, or modify `pnpm-workspace.yaml` / `go.mod` toolchain entries / `.github/workflows/**` / `lefthook.yml`;
- a slice would require a destructive git operation (see [Destructive commands](#destructive-commands));
- you discover that the agreed approach in the task brief no longer matches the code — the brief is out of date; fix the brief first, then resume.

Drift is a coordinator problem, not a worker problem. Pause, write the blocker into the PRD, and wait for direction.

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

Install once per checkout; pnpm 9+ and Node 22+ are expected.

```bash
pnpm install
```

Desktop client (Electron + React renderer in `apps/desktop`):

```bash
pnpm --filter @moshtty/desktop dev            # local Electron dev server
pnpm --filter @moshtty/desktop build          # typecheck + electron-vite build
pnpm --filter @moshtty/desktop typecheck      # tsc --noEmit (node + web projects)
pnpm --filter @moshtty/desktop test           # vitest run (unit + integration)
pnpm --filter @moshtty/desktop test:coverage  # vitest with v8 coverage thresholds
pnpm --filter @moshtty/desktop lint           # eslint --cache (includes jsx-a11y)
pnpm --filter @moshtty/desktop lint:css       # stylelint (enforces token contract)
pnpm --filter @moshtty/desktop test:visual    # Playwright Electron + axe-core
pnpm --filter @moshtty/desktop test:visual:update  # refresh snapshots
```

Go remote + CLI (in `cmd/`, `internal/`):

```bash
go test ./...
go vet ./...
golangci-lint run ./...
```

Repo-wide gates (run before opening a PR or marking `Ready for review`):

```bash
pnpm format:check    # prettier --check across the workspace
pnpm verify:full     # lint + lint:css + typecheck + test + build + test:visual + go test + go vet + diff
git diff --check     # whitespace / conflict marker scan
```

Per-commit verification minimum (run before every commit, even mid-slice):

```bash
pnpm --filter @moshtty/desktop test
pnpm --filter @moshtty/desktop typecheck
go test ./...
git diff --check
```

Full verification sequence (run before marking `Ready for review`, superset of per-commit minimum):

```bash
pnpm --filter @moshtty/desktop typecheck
pnpm --filter @moshtty/desktop lint
pnpm --filter @moshtty/desktop lint:css
pnpm --filter @moshtty/desktop test
pnpm --filter @moshtty/desktop build
pnpm --filter @moshtty/desktop test:visual
go test ./...
go vet ./...
git diff --check
```

For UI-touching slices, also run `agent-browser` exploratory QA against the live Electron app on the developer's primary host (see `docs/moshtty-testing.md`).

Pre-commit hooks (`lefthook.yml`) run prettier, scoped eslint, scoped stylelint, `go vet`, and `golangci-lint --new-from-rev` on staged files. `commit-msg` runs commitlint. Do not bypass with `--no-verify`.

If a task creates or changes tooling, update this section, the PRD status, and `.github/workflows/ci.yml` in the same slice.

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

The normative design contract lives in [`docs/moshtty-design-system.md`](docs/moshtty-design-system.md). Read it before opening any renderer file. Surface-state, reference-parity, copy/voice, icon system, keyboard map, accessibility floor, and CSP rules live in the M5 brief (`docs/agents/2026-05-25-5-moshtty-ui-ghostty.md`).

Token contract (enforced by Stylelint):

- All colors, spacing, radii, font sizes, line heights, z-index, durations, easings, and shadows in renderer CSS must reference a CSS custom property from `apps/desktop/src/renderer/src/design/tokens.css`. TypeScript renderer code reads the same values from `apps/desktop/src/renderer/src/design/tokens.ts`.
- Raw `#hex`, `rgb(...)`, `rgba(...)`, `hsl(...)`, `px`, `em`, `rem`, `ms`, and `cubic-bezier(...)` literals outside the token modules are a lint error.
- Adding or changing a token requires editing `tokens.ts`, `tokens.css`, and `docs/moshtty-design-system.md` together. That edit is a stop condition; coordinate first.

Reference screenshots (the visual ground truth) live in `/mnt/chromeos/MyFiles/Downloads`:

- `Screenshot 2026-05-24 18.46.04.png`
- `Screenshot 2026-05-24 18.46.17.png`
- `Screenshot 2026-05-24 18.46.25.png`
- `Screenshot 2026-05-24 18.46.36.png`

The mapping from each screenshot to specific UI surfaces is in [`docs/moshtty-design-references.md`](docs/moshtty-design-references.md). Reference parity is scored against [`docs/moshtty-design-checkup.md`](docs/moshtty-design-checkup.md) at the end of M5 and M7.

Do not create a marketing landing page. The first screen the user sees is the usable app shell or project dashboard.

## Git And Commit Rules

### Slice and commit shape

- Work in small, reviewable slices that respect the [Slice Budget](#slice-budget).
- Always commit completed work before handing it back, unless the user explicitly asks not to commit or the task is intentionally left blocked.
- Prefer atomic commits: each commit should contain one coherent docs, scaffold, feature, fix, or test slice. A formatting-only consequence of a config change is a separate `style:` or `docs:` commit, not part of the config commit.
- If generated files are introduced, keep source and generated-output commits separate when practical.
- Do not commit failing tests unless the PRD explicitly marks the task blocked and the commit is a documented handoff.
- Close out `docs/moshtty-prd.md` before committing a completed or blocked task.

### Conventional commit types

Allowed types (matched by `commitlint.config.js`):

- `feat:` — user-visible feature.
- `fix:` — defect fix.
- `refactor:` — structure change with no behavior delta.
- `perf:` — performance improvement.
- `test:` — test-only change.
- `docs:` — documentation only.
- `style:` — formatting / whitespace / linter auto-fix consequences with no logic change.
- `chore:` — tooling, dependencies, generated metadata.
- `ci:` — CI configuration only.
- `revert:` — reverting a prior commit.

A scope in parentheses is encouraged for cross-cutting work, e.g. `chore(deps):`, `feat(schemas):`, `test(visual):`, `chore(lint):`.

### Destructive commands

Never run any of the following without an explicit coordinator instruction in the current turn:

- `git clean` (any flags) — untracked files may be uncommitted work from another agent.
- `git reset --hard`, `git restore --staged --worktree`, `git checkout -- <path>` against modified files.
- `git push --force` / `--force-with-lease`.
- `git rebase` (interactive or otherwise), branch deletion, tag deletion.
- `rm -rf` against tracked directories, `pnpm dlx` invocations that mutate the workspace.

"Get the tree clean" or "start fresh" are not enough; ask for the exact command or a different starting point. When in doubt, prefer `git stash` over a destructive operation — stashed work can be recovered.

### Amending and fix-ups

Avoid `git commit --amend`. Only amend when **all** of the following hold:

1. The user explicitly requested it **or** the commit succeeded but a pre-commit hook auto-modified files that belong in the same commit.
2. The HEAD commit was created by you in the current session (`git log -1 --format='%an %ae'` shows your identity).
3. The commit has not been pushed.

If a commit failed or was rejected by a hook, fix the issue and make a new commit — never amend. If a commit included files that did not belong (e.g. carried over from a previous failed attempt), `git reset --soft HEAD^` followed by re-staging is the right tool; document the recovery in the next commit message.

### Failed-commit staging hygiene

After any `git commit` that fails (pre-commit hook reject, commitlint failure, etc.), run `git reset HEAD` to clear the staging area before staging the next slice. Git's staging area is sticky across commit attempts, so files staged for a failed slice will silently piggy-back onto the next commit if you do not reset. Failing to do this produced a misleading commit message during the 2026-05-25 guardrails recovery; do not repeat it.

### Pushing and cross-agent etiquette

- Do not push unless the coordinator/user asks.
- Do not rewrite, revert, or clean up another agent's unrelated changes.
- Give immediate corrective feedback when a subagent is on the wrong path. Do not wait for a slice to finish if the scope, model choice, file ownership, or verification plan is wrong; stop, restate the correction, and reassign the work.

## Multi-Agent Workflow

1. Pick one task brief from `docs/agents/`.
2. Run the [Subagent Pre-flight](#subagent-pre-flight) checklist before touching any file. This applies to the coordinator too.
3. Claim the brief's owned paths against [`docs/agents/OWNERS.md`](docs/agents/OWNERS.md) and confirm no overlap with another in-progress task.
4. Keep edits inside the brief's listed paths. Watch the [Slice Budget](#slice-budget). Editing a path outside the brief's owned globs is a [Stop Condition](#stop-conditions).
5. Add or update tests with the implementation.
6. Run the task's verification commands (and `pnpm verify` + `go test ./...` at minimum).
7. Fill in [`docs/agents/TEMPLATE_HANDOFF.md`](docs/agents/TEMPLATE_HANDOFF.md) (or post the equivalent in the PRD) before closing out: what shipped, what was deferred, what needs follow-up, where the visual or on-device verification stands.
8. Close out [`docs/moshtty-prd.md`](docs/moshtty-prd.md) for the task: milestone/task status (from the [Status Tiers](#status-tiers) list), owner, verification notes, blockers, and follow-ups.
9. Commit the slice with one atomic conventional commit.

Avoid parallel edits to the same files. If two tasks need the same shared module, coordinate through the PRD status notes before editing.

## Subagent Pre-flight

Every agent and subagent — including external ones launched through `cmd`, `agy`, the Cursor `Task` tool, or any other harness — must do the following **before writing any file**. Coordinators must include this checklist verbatim in subagent prompts and refuse handoffs that skipped it.

1. Run `git status` and read the output. Report what is modified, what is staged, and what is untracked, in plain text, before doing anything else. If anything is unexpected, stop and ask the coordinator.
2. Run `git log -1 --format='%h %s'` and confirm the HEAD commit matches what the brief expects. If HEAD has moved since the brief was written, stop and ask.
3. Treat **every untracked file as potentially uncommitted work from another agent**. Do not delete, move, rename, or `git clean` them. If they appear unrelated to the current task, leave them alone and surface them in the handoff notes.
4. Do not run any destructive command without an explicit one-shot instruction from the coordinator in the same turn (see [Destructive commands](#destructive-commands)). "Get the tree clean" or "start fresh" is not sufficient — ask for the exact command or a different starting point.
5. Confirm the brief's owned paths against `docs/agents/OWNERS.md` before opening an editor. Edits outside the owned paths are a stop condition.
6. Read the docs the brief lists under "Read First", at minimum `AGENTS.md` (this file), the PRD, and any contract docs (`docs/moshtty-design-system.md` for renderer work, OWNERS for any work). Skim is not enough; the [Token contract](#design-rules) and [Stop Conditions](#stop-conditions) are not negotiable.
7. If a verification command is unavailable on the current host (no display for Playwright, no Mac for `safeStorage`, no working network, etc.), say so explicitly in the handoff and mark the task `Blocked` or `Ready for review` with a verification gap. Never fake a result.

A handoff that does not show the output of step 1 and step 2 is incomplete and will be rejected.

### Approved subagent harnesses

- **`cmd` with `deepseek/deepseek-v4-pro`**: allowed when the task is well scoped and has a clear write boundary documented in the brief.
- **`agy` (Gemini 3.5 Flash via Antigravity)**: allowed for bounded implementation work; do not give it broad refactor scope.
- **Cursor `Task` tool** (`composer-2.5-fast` and the coordinator's own model): allowed for parallel work that fits inside one OWNERS row.

Model selection guidance is in [`docs/moshtty-model-routing.md`](docs/moshtty-model-routing.md). Whichever harness is used, give the subagent the same docs the coordinator has read, the same task brief, and the same verification, PRD close-out, and atomic conventional commit requirements. If a worker starts drifting, stop it immediately, correct the scope, and reassign — do not let a slice finish on a wrong trajectory.
