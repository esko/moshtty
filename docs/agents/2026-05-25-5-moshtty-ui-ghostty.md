# Agent Task 5: Moshtty UI And Ghostty

## Read First

- `AGENTS.md`
- `docs/moshtty-prd.md`
- `docs/moshtty-plan.md`
- `docs/moshtty-milestones.md`
- `docs/moshtty-testing.md`

## Objective

Build the React Moshtty UI around projects, tabs, panes, settings, and Ghostty terminal rendering.

## Scope

Work primarily in `apps/desktop` renderer code.

Use the design references:

- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.04.png`
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.17.png`
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.25.png`
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.36.png`

Implement:

- compact app shell;
- collapsible project rail;
- project dashboard;
- top in-app tab/action bar;
- split pane layout;
- Ghostty terminal pane component;
- remote import/edit/delete dialogs;
- project create/edit/delete dialogs;
- terminal settings dialog;
- Light/Dark/System app theme;
- terminal palette linked to app mode by default;
- subtle connection status.

Avoid:

- marketing pages;
- nested card-heavy dashboard design;
- visible instructional text where normal controls are enough;
- image project icons in v1.

## Deliverables

- React components and Zustand store.
- Flat-row, sparse desktop visual style.
- Terminal panes render through `ghostty-web`.
- Keyboard/app actions wired to store.
- Tests for reducers, theme resolution, layout behavior, and import validation.
- Playwright Electron visual screenshots for the key UI states listed in `docs/moshtty-testing.md`.
- agent-browser review screenshots for light and dark mode before marking the task ready.

## Verification

Run:

```bash
pnpm --filter @moshtty/desktop test
pnpm --filter @moshtty/desktop typecheck
pnpm --filter @moshtty/desktop build
pnpm --filter @moshtty/desktop test:visual
git diff --check
```

Manual inspection:

- light and dark modes;
- collapsed and expanded project rail;
- project dashboard;
- split panes;
- centered dialogs;
- no obvious text overlap at desktop and narrow widths.
- agent-browser snapshot and screenshot pass against the running Electron app.

## PRD Update

Set:

- `M5 UI and Ghostty integration` to `Ready for review` when verification passes;
- this task to `Ready for review`;
- add verification commands and results, including visual checks;
- record any visual or renderer limitations;
- do not commit until `docs/moshtty-prd.md` is closed out for this task.
