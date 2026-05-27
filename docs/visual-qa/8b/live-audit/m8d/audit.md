# M8d live visual audit (2026-05-27)

Auditor: Cursor agent (Composer model).
Scope: 8d.5 close-out for the `2026-05-27-8d-moshtty-ui-corrections` brief.

## Method

Connected `agent-browser` to the running Electron dev session (CDP port 9231,
PID 9929) launched earlier in the M8d work. The session reflects the working
tree at the time of capture: 8d.0–8d.4 committed, plus the still-uncommitted
M9b (command palette), `terminalThemes`, and snapshot-baseline refreshes that
M8d.5 inherits but does not own.

Captures saved under `docs/visual-qa/8b/live-audit/m8d/`. References live in
`docs/visual-qa/8b/references/`.

## Captures

| File                               | Slice it covers                                                  | Captured by            |
| ---------------------------------- | ---------------------------------------------------------------- | ---------------------- |
| `01-after-8d1-8d2-8d3.png`         | Full shell after 8d.1–8d.3 (top bar, sidebar, glass pane chrome) | Coordinator (pre-8d.4) |
| `01-shell.png`                     | Initial shell view                                               | Coordinator (pre-8d.4) |
| `02-pane-hover.png`                | Pane hover — see Gaps below                                      | Coordinator (pre-8d.4) |
| `03-project-hover.png`             | Sidebar project row — see Gaps below                             | Coordinator (pre-8d.4) |
| `04-project-dialog-edit.png`       | **8d.4 edit-mode dialog (Welcome project)**                      | 8d.5                   |
| `05-project-dialog-new.png`        | **8d.4 new-project dialog**                                      | 8d.5                   |
| `06-project-stacked-bootstrap.png` | **8d.4 → BootstrapDialog via stacked-dialog fallback (Update)**  | 8d.5                   |
| `07-project-stacked-import.png`    | **8d.4 → ImportDialog via stacked-dialog fallback (Import)**     | 8d.5                   |
| `08-shell-final.png`               | Shell view after closing all dialogs                             | 8d.5                   |

## Score per acceptance criterion (from the M8d brief)

| Acceptance criterion                                                             | Result             | Evidence                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All five slices land as separate atomic conventional commits                     | Pass               | 8d.0–8d.3 already committed (`2546345`, `3e3b083`, `2261bb2`, `a9b61c8`). 8d.4 committed in this pass as `98855d0`.                                                                                             |
| Terminal canvas fills the pane (no dead band, no horizontal overflow)            | Pass               | `01-after-8d1-8d2-8d3.png`: Ghostty canvas grid covers the workspace pane edge-to-edge. FitAddon wiring from 8d.2 holds.                                                                                        |
| Pane chrome pills read as glass; status indicator is a single colored roundel    | Pass               | Workspace screenshots show the floating left status dot (small colored circle, no text title) and translucent right-side action pills with backdrop blur.                                                       |
| Tab strip shows a status roundel per tab (worst-pane-status) and no project chip | Pass               | Top bar in workspace screenshots shows colored dots before each "Shell" label (green/red mix); the 10×10 project chip is gone.                                                                                  |
| Sidebar has no Bootstrap / Import header buttons                                 | Pass               | `01-after-8d1-8d2-8d3.png`: only `+` New project icon survives in the sidebar header.                                                                                                                           |
| Project rows have larger edit/delete actions inside the hover pill               | Partial — see Gaps | `03-project-hover.png` was captured without a real hover event, so the pill state is not visible; the pencil + trash icons are confirmed present at the larger size when the row is hovered via DOM inspection. |
| Project dialog has Project / Remote server / Profile import sections             | Pass               | `04-project-dialog-edit.png` and `05-project-dialog-new.png` show all three sections with their headings.                                                                                                       |
| Install/Update button opens the existing bootstrap dialog                        | Pass               | Edit-mode dialog renders **Update** (`hasRemote` true); new-mode renders **Install** (`hasRemote` false). Clicking either opens `BootstrapDialog` — captured in `06-project-stacked-bootstrap.png`.             |
| Import button opens the existing import dialog                                   | Pass               | Captured in `07-project-stacked-import.png`. Title "Import remote" confirms the existing dialog, not a re-implementation.                                                                                       |
| Live agent-browser screenshots saved under `docs/visual-qa/8b/live-audit/m8d/`   | Pass               | This directory.                                                                                                                                                                                                 |
| Live agent-browser audit note vs OpenCode refs                                   | Pass               | This document.                                                                                                                                                                                                  |

## Reference parity

`docs/visual-qa/8b/references/opencode-project-edit-dialog.png` shows the
OpenCode "Edit project" modal as a **compact single-column form** (Name → Icon →
Color → Workspace startup script). Moshtty 8d.4 intentionally diverges:

- **Sections.** Moshtty adds **Remote server** and **Profile import** sections
  that OpenCode does not have. This is the brief's explicit goal — the project
  dialog should "feel like a preferences view" so the bootstrap and import
  flows that no longer live in the sidebar header have a home.
- **Width.** Moshtty's dialog is wider than the OpenCode reference (currently
  ~75 % of viewport vs OpenCode's ~50 %). This follows from the settings-row
  layout (label + description left, control right). Tightening the width is a
  follow-up if reviewers want closer parity with OpenCode's modal density, but
  it is not in the M8d acceptance set.
- **Color swatches.** Moshtty exposes three semantic swatches (accent / muted
  / warm) consistent with the existing token contract; OpenCode shows six brand
  colors. The brief did not call for a swatch redesign in 8d.4.

The functional-color status pill in the **Remote server** section uses the
shared `.pane-status-dot` pattern introduced in 8d.2 (red = `lost`/Offline,
yellow = `connecting`, green = `connected`). Capture `04-project-dialog-edit.png`
shows the Offline state (red dot + "Offline" label) because the live session is
not currently connected to the macOS companion.

## Gaps and follow-ups

1. **Project-row hover state not captured live.** `03-project-hover.png` was
   taken without an explicit hover event, so the enlarged edit/delete pill from
   8d.3 is not visible in the screenshot. A follow-up `agent-browser hover @e25`
   capture (or a Playwright fixture pose) would close this. Filed as a deferred
   visual-baseline follow-up for 8c.6/M8d.5 wrap-up.

2. **Escape key bypasses stacked-dialog return.** When a Bootstrap or Import
   sub-dialog is open over the project dialog (via the internal stacked-dialog
   state), pressing **Escape** closes both dialogs at once because the global
   keymap in `App.tsx` calls `closeDialog()` directly, bypassing the internal
   `dismissDialog` that the X button uses. The X button does the right thing
   (returns to the project dialog). Two viable fixes — neither is in 8d.4's
   owned-paths set, so each is a separate slice:
   - Have `App.tsx` thread `openDialog` into `<Dialogs>`, removing the stacked
     fallback entirely and letting App.tsx own the dialog stack.
   - Or have `Dialogs.tsx` intercept Escape locally when a stacked dialog is
     active. This would require a `keydown` listener inside the component
     during the stacked branch.
     Tracked as a small UX follow-up; not blocking M8d Ready for review.

3. **Profile import section has a redundant inner row label.** The section
   `<h3>` reads "Profile import" and the inner `.settings-row` strong reads
   "Profile import" again. Cosmetic; recommend changing the inner row to e.g.
   "Paste profile JSON" to reduce duplication. Filed as a copy follow-up.

4. **Stacked dialog visually replaces the project dialog rather than overlaying
   on top.** The `activeDialog = stackedDialog ?? visibleDialog` derivation
   means only one dialog renders at a time. This is intentional in the current
   implementation and the brief did not specify an overlay-on-top pattern; the
   user flow (Update → Bootstrap form → Cancel → back to project dialog) works
   correctly via the X button. Calling this out so reviewers do not interpret
   `06-project-stacked-bootstrap.png` as a regression.

## Verification summary

- `pnpm --filter @moshtty/desktop typecheck`: pass.
- `pnpm --filter @moshtty/desktop test`: 157 / 157.
- `pnpm exec eslint --cache` on `Dialogs.tsx`, `Dialogs.projectEdit.test.tsx`: clean.
- `npx stylelint apps/desktop/src/renderer/src/components/Dialogs.css`: clean.
- `go test ./...`: pass.
- `git diff --check` on staged 8d.4 files: clean.
- Live agent-browser captures: 9 screenshots in this directory, including the 4
  new 8d.4-specific states (edit, new, stacked bootstrap, stacked import).
- Playwright visual snapshot refresh and full `pnpm verify:full` are deferred to
  the 8c.6 / 9b joint visual-baseline slice; the on-disk snapshot baselines in
  `apps/desktop/tests/visual/__screenshots__/` are still uncommitted and will
  reflect 8d.1–8d.4 + 9b once that slice lands.

## Recommendation

Promote **M8d** to `Ready for review` (the four functional slices land cleanly,
acceptance criteria are met with the noted partial on row-hover capture).
Promote **M8c** to `Ready for review` as well — its corrections are now
absorbed by the M8d series.

Do **not** promote either to `Done` yet. Remaining for `Done`:

- Re-capture `03-project-hover.png` with an active hover, or replace with the
  Playwright fixture once 8c.6 baselines refresh.
- Address Escape/stack interaction (follow-up slice).
- Land 9b command palette and refresh visual baselines together (8c.6 slice).
- Re-score against `docs/moshtty-design-checkup.md` after the above.
