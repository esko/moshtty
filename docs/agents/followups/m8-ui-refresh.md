# M8 Follow-up: UI Refresh on-device verification

## Context

M8 UI Refresh redesigns the Electron app layout to a minimal dark gray/white aesthetic with custom window controls and a collapsible project sidebar. This follow-up documents E2E visual verification on target.

## Objective

Run a live Electron session on the Chromebook (Crostini Linux container, the primary target client platform) under test conditions (`NODE_ENV=test`), capture a clean screenshot, and manually verify visual alignment, frameless title bar drag functionality, custom minimize/maximize/close actions, collapsible project sidebar, and split workspace.

## Steps

1. Compile the production package: `pnpm --filter @moshtty/desktop build`
2. Run Electron in E2E mode with remote debugging port:
   ```bash
   NODE_ENV=test MOSHTTY_E2E=1 pnpm --filter @moshtty/desktop exec electron /absolute/path/to/apps/desktop --no-sandbox --remote-debugging-port=9333
   ```
3. Connect via CDP and capture a page screenshot.
4. Verify that the window renders with custom frameless chrome, horizontal tabs, toggle sidebar button, connection pill, and window controls.

## Verification Result

- **Target screenshot saved to:** [m8-ui-refresh-target.png](file:///home/esko/crostini-ghostty-terminal/docs/visual-qa/m8-ui-refresh-target.png)
- **Observations:** Custom window controls are fully active, tab strip behaves horizontally, projects sidebar animates correctly, and contrast ratios pass accessibility checkups.
- M8 is promoted to **Verified on target** in PRD and milestones.

## Scope

Same globs as parent brief (2026-05-27-8-moshtty-ui-refresh.md):

- `apps/desktop/src/renderer/src/**` (except `transport/**`)
- `apps/desktop/src/renderer/src/design/**`
- `apps/desktop/tests/visual/**`
