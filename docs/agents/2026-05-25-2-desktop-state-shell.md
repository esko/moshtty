# Agent Task 2: Desktop State Shell

## Read First

- `AGENTS.md`
- `docs/moshtty-prd.md`
- `docs/moshtty-plan.md`
- `docs/moshtty-milestones.md`

## Objective

Build the Electron main/preload foundation for Moshtty app state, secrets, and secure app origin.

## Scope

Work primarily in `apps/desktop`.

Implement:

- secure `app://moshtty` protocol;
- typed preload IPC API;
- versioned JSON state file;
- atomic state writes;
- state migration hook;
- Electron `safeStorage` token encryption;
- passphrase-encrypted fallback when `safeStorage` is unavailable or weak;
- initial state schema for remotes, projects, tabs, panes, layout, settings, and last active project.

Renderer code should call a typed API. Do not expose arbitrary filesystem or Node access to the renderer.

## Deliverables

- State service in Electron main.
- Preload API definitions and renderer-facing TypeScript types.
- Tests for state load/save/migration/error handling.
- Tests for token storage paths.
- Minimal UI or dev hook to exercise state read/write is acceptable.

## Verification

Run:

```bash
pnpm --filter @moshtty/desktop test
pnpm --filter @moshtty/desktop typecheck
pnpm --filter @moshtty/desktop build
git diff --check
```

## PRD Update

Set:

- `M2 Desktop state shell` to `Ready for review` when verification passes;
- this task to `Ready for review`;
- add verification commands and results;
- add notes about any safeStorage behavior observed in Crostini;
- do not commit until `docs/moshtty-prd.md` is closed out for this task.
