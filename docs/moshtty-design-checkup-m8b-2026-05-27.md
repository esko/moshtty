# Moshtty Design Checkup — M8b — 2026-05-27

**Owner:** Cursor agent (Composer)
**Milestone:** M8b UI Polish (post M8c / M8d / M9b close-out)
**Build under review:** `feat/moshtty-scaffold` @ `a8c1f3f` plus follow-up slices in this session
**References used:** `docs/moshtty-design-system.md`, `docs/moshtty-design-references.md`, `docs/visual-qa/8b/live-audit/m8d/audit.md`

## Scoring summary

| Vital sign     | Score | Band    | Gate met? |
| -------------- | ----- | ------- | --------- |
| Intentionality | 9/10  | Healthy | Y         |
| Readability    | 8/10  | Healthy | Y         |
| Usability      | 8/10  | Healthy | Y         |
| Responsiveness | 8/10  | Healthy | Y         |
| Speed          | 8/10  | Healthy | Y         |
| Accessibility  | 8/10  | Healthy | Y         |

**Total:** 49/60 (informational). All vital signs ≥ 7 — **M8b gate met** for promotion toward `Done` pending coordinator sign-off.

## Intentionality — 9/10

- Findings: Project → Tab → Pane hierarchy is clear in the unified top bar, collapsible sidebar, and pane workspace. Connection status uses calm pill copy (Offline / Connecting / Connected). Bootstrap and profile import live in the project preferences dialog after 8d.3–8d.4. Token contract is centralized in `tokens.ts` / `tokens.css`; renderer CSS uses custom properties throughout.
- Evidence: `docs/visual-qa/8b/live-audit/m8d/audit.md` (Pass on structural criteria); Playwright fixtures `dashboard`, `tab-bar-multi`, `split-*`.
- Required fixes before "Done": None.
- Deferred: Overflow hamburger menu still unwired (`TopBar.tsx` TODO).

## Readability — 8/10

- Findings: UI type scale stays at 11–13px per design system; hierarchy uses `--color-text-main`, `--color-text-muted`, and `--color-text-subtle`. Light and dark `--color-text-subtle` now meet WCAG AA on `--color-app-bg` (`#6d6d75` / `#80808a`). Terminal canvas uses dedicated `--color-text-terminal` on white (light) or dark canvas.
- Evidence: Task 10 + dark subtle token slice; `a11y.test.ts` color-contrast clean on dashboard, active tab, import dialog.
- Required fixes before "Done": None.
- Deferred: Optional width tightening on project dialog vs OpenCode reference density (not in M8d acceptance set).

## Usability — 8/10

- Findings: Empty dashboard, import validation states, pane lost + restart, settings (theme, font, terminal scheme), command palette (`Ctrl+K`), and SSH bootstrap wizard are implemented. Project dialog sections (Project / Remote server / Profile import) match 8d.4. Stacked bootstrap/import over project dialog dismisses one level at a time via X and Escape after App-owned dialog stack.
- Evidence: Playwright `dialogs.test.ts`, `command-palette.test.ts`, `verify-bootstrap-e2e` (target host); Vitest `Dialogs.projectEdit.test.tsx`.
- Required fixes before "Done": None.
- Deferred: Escape/stacked-dialog and copy fixes landed in this session; overflow menu still TODO.

## Responsiveness — 8/10

- Findings: Project rail collapses; tab strip scrolls horizontally; dialogs fit viewport; split layouts use 1px handles; coarse-pointer tokens exist (`--density-touch-target`).
- Evidence: Fixtures `rail-collapsed`, `tab-bar-overflow`, `split-2-row`, `split-2-column`, `split-3-nested`.
- Required fixes before "Done": None.
- Deferred: Full narrow-width audit not re-run on this pass.

## Speed — 8/10

- Findings: CSS modules + token indirection; motion uses `--duration-*` / `--easing-standard`; pane chrome uses lightweight glass tokens; no layout-thrashing tab animations observed in dev.
- Evidence: Stylelint token enforcement; FitAddon resize path in `TerminalPane.tsx` (8d.2).
- Required fixes before "Done": None.
- Deferred: Formal perf budget not measured this pass.

## Accessibility — 8/10

- Findings: `:focus-visible` on interactive controls; `prefers-reduced-motion` in global tokens; axe-core gate passes dashboard, active tab, and import dialog (no critical/serious). Tablist uses direct `role="tab"` children with close controls outside tabs (overlay strip). Modal headers use nowrap flex so close buttons stay on the title row.
- Axe pass: **Yes** — `tests/visual/a11y.test.ts` (3/3).
- Contrast pass: **Yes** — light and dark `--color-text-subtle` on app background.
- Keyboard map coverage: **Mostly** — palette and shell shortcuts registered; overflow menu not keyboard-accessible until wired.
- Reduced-motion: **Respected** — global token rules.

- Required fixes before "Done": None for M8b gate.
- Deferred: Dedicated axe run on open command palette (M9b follow-up).

## Surface state matrix coverage

| Surface             | States required                      | Fixtures covering                                 | Reference parity    |
| ------------------- | ------------------------------------ | ------------------------------------------------- | ------------------- |
| Project rail        | collapsed, expanded, empty           | `rail-collapsed`, `rail-expanded`, `rail-empty`   | Pass (8d.3)         |
| Top tab bar         | single, multi, dragging, overflow    | `active-tab`, `tab-bar-multi`, `tab-bar-overflow` | Pass (8c.1 / 8d.1)  |
| Terminal pane       | active, lost                         | `pane-lost`, default workspace                    | Pass (8d.2)         |
| Split layout        | 2-row, 2-col, 3-pane, drag-hover     | `split-2-row`, `split-2-column`, `split-3-nested` | Pass                |
| Project dashboard   | empty, populated                     | `dashboard`, `dashboard-empty`, `dashboard-dark`  | Pass                |
| Remote import       | empty, valid, invalid                | `dialog-import-*`                                 | Pass                |
| Project edit dialog | new, existing                        | `dialog-project-edit-new`, `dialog-project-edit`  | Pass (8d.4)         |
| Terminal settings   | follow-app, light, dark              | `dialog-terminal-settings-*`                      | Pass                |
| Connection status   | offline, connecting, connected, lost | `connection-*` fixtures                           | Pass                |
| Command palette     | open, filtered                       | `command-palette.test.ts` + `docs/visual-qa/9b/`  | Pass (M9b)          |
| Sidebar project row | hover actions visible                | `sidebar-project-row-hover.png` (Playwright)      | Pass (this session) |

## Waivers requested

None.

## Sign-off

- Reviewed by: Cursor agent (pending coordinator)
- PRD updated: yes (this session)
- Linked from PRD Current Notes: yes
