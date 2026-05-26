# Agent Task 8: Moshtty UI Refresh

## Read First

- `AGENTS.md`
- `docs/moshtty-prd.md`
- `docs/moshtty-plan.md`
- `docs/moshtty-milestones.md`
- `docs/moshtty-design-system.md`
- `docs/moshtty-design-references.md`

## Objective

Redesign the Moshtty app shell to achieve a minimal, dark gray/white aesthetic with gray borders, a unified top bar, and a projects-only sidebar. Shrink the monolithic `App.tsx` down to under 200 lines by extracting modular components.

## Scope

Work primarily in:

- `apps/desktop/src/main/index.ts` (frameless configuration)
- `apps/desktop/src/preload/index.ts` and `apps/desktop/src/common/moshtty-api.ts` (window control IPC types)
- `apps/desktop/src/renderer/src/design/tokens.css` and `tokens.ts` (minimalist palette design variables)
- `apps/desktop/src/renderer/src/components/` (TopBar, Sidebar, Dashboard, Dialogs, WindowControls)
- `apps/desktop/src/renderer/src/App.tsx` (composite component reassembly)
- `apps/desktop/src/renderer/src/assets/main.css` (css rules cleanup)
- `apps/desktop/tests/visual/` (Playwright visual regression and accessibility selectors)

Rules:

- The design system custom properties must be strictly used; raw color/sizing literals in components are prohibited.
- Custom window controls must be implemented to replace native OS window frames.
- A collapsible left sidebar displays projects only; all tab controls live horizontally in the top bar.

## Deliverables

- Minimalist Token Update: Dark/light neutral custom properties in `tokens.css` and `tokens.ts`.
- Frameless Window Setup: `frame: false` window initialization and main-preload-renderer IPC integration for window management (minimize, maximize, close).
- Unified TopBar Component: horizontal tab pills, hamburger toggle, BETA badge, connection status, and custom window controls.
- Compact Sidebar Component: collapsible nav panel containing projects list, settings and help footer.
- Dashboard Component: landing page extracted from App.tsx.
- Dialogs Component: centralized settings, import, and project edit dialog wrapper.
- Modular App.tsx: simplified assembly file composed of these components.

## Verification

Run:

- `pnpm verify:full` (which runs ESLint, Stylelint, typescript typechecks, Vitest unit tests, Playwright visual snapshot checks, Go tests/vetting, and git check)
- `pnpm --filter @moshtty/desktop test:visual:update` (regenerates screenshots to align with the new minimal layout)

## PRD Update

Set:

- `M8 UI Refresh` to `Ready for review` in milestones and PRD status when verification passes;
- this task to `Ready for review`;
- record verification details;
- do not commit until `docs/moshtty-prd.md` is closed out for this task.
