# Handoff: M8b UI Polish + M9b Command Palette

**Date:** 2026-05-27  
**Branch:** `feat/moshtty-scaffold`  
**HEAD:** `64233ad docs: add M8b UI polish and M9b command palette to PRD, milestones, and briefs`  
**Status:** Ready for review (uncommitted working tree) — **superseded for M8b visual parity** by live audit below.

> **Opus / implementers:** Read [`docs/visual-qa/8b/M8b-design-gap-assessment.md`](../../visual-qa/8b/M8b-design-gap-assessment.md) (agent-browser live audit, 2026-05-27). Do not treat M8b as design-complete until that checklist is addressed or waived.

## What shipped (working tree, not committed)

### M8b UI Polish

- BETA badge removed from top bar; visual test updated.
- Neutral primary buttons (no accent blue fill).
- Edge-to-edge terminal layout: zero workspace padding/gap, no pane card borders/radius, 1 px split handles.
- `terminalThemes.ts` + `terminalThemes.test.ts`: Auto + six presets, localStorage, Ghostty theme mapping.
- Settings dialog terminal theme `<select>`.
- OpenCode-style hybrid tab strip CSS (bare inactive, active pill).

### M9b Command Palette

- `open-command-palette` (`Ctrl+K`) in `keymap.ts`.
- `appHandlers.ts` hook; handler map shared with shortcuts and palette.
- `CommandPalette.tsx` + `CommandPalette.css`: search, keyboard nav, mouseOnly disabled rows, focus return, a11y roles.
- Wired in `App.tsx`.

## Verification run by close-out agent

- `git status`
- `git log -1 --format='%h %s'`
- `git diff -- apps/desktop/src/renderer/`
- `git diff -- apps/desktop/tests/visual/dashboard.test.ts`

Full verify **not** run by close-out agent.

## Coordinator follow-ups

1. Run full verification (see PRD status notes).
2. Refresh Playwright visual snapshots (`pnpm --filter @moshtty/desktop test:visual:update` if baselines drift).
3. agent-browser QA: M8b seven states under `docs/visual-qa/8b/`; M9b five palette states under `docs/visual-qa/9b/`; axe-core on top bar, settings, open palette.
4. Confirm tab-strip 1 px dividers between inactive tabs if still required for reference parity.
5. Commit as one or two atomic conventional commits (M8b + M9b may share renderer files — coordinate slice budget).

## Blockers

None.

---

## Opus verification (2026-05-27)

**Author:** Opus 4.7 (orchestrator pass)

The "Ready for review" status above is **superseded for M8b**. The audit at [`docs/visual-qa/8b/M8b-design-gap-assessment.md`](../../visual-qa/8b/M8b-design-gap-assessment.md) — see its bottom "Opus verification" section — found reference-parity gaps against [`docs/visual-qa/8b/references/`](../../visual-qa/8b/references/) and user-flagged interaction issues (top-bar icon order, tab alignment/padding/close, pane chrome → hover pills, terminal fills full area, project edit modal, superfluous spacer lines). M8b moves to `In progress` in [`docs/moshtty-prd.md`](../../moshtty-prd.md) and the Status Summary of [`docs/moshtty-milestones.md`](../../moshtty-milestones.md).

Remaining ref-parity work is scoped to a new bounded brief: [`docs/agents/2026-05-27-8c-moshtty-ui-followup.md`](../2026-05-27-8c-moshtty-ui-followup.md). It contains seven sub-slices (8c.1–8c.7) with explicit owned paths, a parallel-safety table, and per-slice verification commands so subagents can run concurrently without overlap.

M9b stays `Ready for review` — the live `Ctrl+K` capture in `live-audit/06-command-palette.png` is an agent-browser keypress-encoding artefact; Playwright tests for the palette are green and the component is wired.

Coordinator dispatch plan: land 8c.5 (tokens triplet, coordinator-only) first, then fan out 8c.1 / 8c.2 / 8c.3 / 8c.4 in parallel, then 8c.7 (after 8c.3 + 8c.4), finally 8c.6 (visual QA + baselines).
