# Agent Task 1: Moshtty Scaffold

## Read First

- `AGENTS.md`
- `docs/moshtty-prd.md`
- `docs/moshtty-plan.md`
- `docs/moshtty-milestones.md`

## Objective

Create the initial Moshtty repo scaffold for the Electron client and Go remote binaries. This task establishes structure and tooling only; do not implement transport or UI features beyond placeholders.

## Scope

Create or update:

- root pnpm workspace files;
- `apps/desktop`;
- root `go.mod`;
- `cmd/moshtty-remote`;
- `cmd/moshttyctl`;
- `internal/`;
- root scripts/docs as needed.

Remove or quarantine old local runtime assumptions:

- old PWA/service-worker build assumptions;
- old local Go PTY agent as active runtime;
- old root scripts that imply `agent/` + `web/` are the target architecture.

Do not remove useful renderer/reference code unless it is copied or tracked for later use.

## Deliverables

- Electron app opens with a placeholder Moshtty window.
- React + TypeScript + Zustand installed and wired.
- CSS modules/plain CSS ready.
- pnpm workspace configured.
- Go 1.26 root module configured.
- `moshtty-remote` and `moshttyctl` compile as placeholders.
- Root verification scripts documented.

## Verification

Run:

```bash
pnpm install
pnpm --filter @moshtty/desktop typecheck
pnpm --filter @moshtty/desktop test
pnpm --filter @moshtty/desktop build
go test ./...
git diff --check
```

If a command cannot exist yet, add the missing script or document why in `docs/moshtty-prd.md`.

## PRD Update

Set:

- `M1 Branch and scaffold` to `Ready for review` when verification passes;
- this task to `Ready for review`;
- add verification commands and results;
- add status notes for any old files intentionally left in place;
- do not commit until `docs/moshtty-prd.md` is closed out for this task.
