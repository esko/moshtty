# Moshtty Design Checkup - M5 - 2026-05-26

**Owner:** Codex
**Milestone:** M5 UI and Ghostty integration
**Build under review:** 9c4a414 plus local M5 parity close-out
**References used:** docs/moshtty-design-system.md, docs/moshtty-design-references.md

## Scoring summary

| Vital sign     | Score | Band    | Gate met? |
| -------------- | ----- | ------- | --------- |
| Intentionality | 8/10  | Healthy | Y         |
| Readability    | 8/10  | Healthy | Y         |
| Usability      | 7/10  | Healthy | Y         |
| Responsiveness | 7/10  | Healthy | Y         |
| Speed          | 8/10  | Healthy | Y         |
| Accessibility  | 8/10  | Healthy | Y         |

## Intentionality - 8/10

- Findings: The visible vocabulary is Project, Tab, and Pane. Connection state is concrete and calm. CSS uses the token contract enforced by Stylelint.
- Evidence: `pnpm --filter @moshtty/desktop lint:css`; `docs/visual-qa/m5/project-dashboard-light/side-by-side.png`; `docs/visual-qa/m5/settings-dialog/side-by-side.png`.
- Required fixes before "Done": None for M5 design gate.
- Deferred (linked follow-up brief): Project action menu parity from `ref-18.46.17` is not implemented as a separate M5 surface.

## Readability - 8/10

- Findings: Chrome and dialog type remain readable at the default Playwright viewport. The terminal work area keeps shell output visually dominant. The settings dialog now constrains height and scrolls internally instead of cropping outside the viewport.
- Evidence: `dialog-terminal-settings-linux.png`; `active-tab-linux.png`; `pane-lost-linux.png`.
- Required fixes before "Done": None for M5 design gate.
- Deferred (linked follow-up brief): Narrow-width responsive passes should be added before broader packaging work.

## Usability - 7/10

- Findings: The required M5 fixture matrix is covered for dashboard, rails, tab bar, terminal pane, splits, import dialog, project edit dialog, settings, and connection states. Live QA verified canonical profile import and a working Mac shell pane.
- Evidence: `pnpm --filter @moshtty/desktop test:visual`; `docs/visual-qa/m5/profile-import-passphrase-live-shell.png`; `docs/visual-qa/m5/live-shell-pressed-command.png`.
- Required fixes before "Done": None for M5 design gate.
- Deferred (linked follow-up brief): M7 still owns durable pane reattach after Electron restart, companion restart lost-state handling, and app-side `moshttyctl` layout commands.

## Responsiveness - 7/10

- Findings: Rail collapse, split panes, centered dialogs, and the terminal workspace fit the desktop regression viewport. Settings content now scrolls within the dialog when its shortcut list is long.
- Evidence: `rail-collapsed-linux.png`; `split-3-nested-linux.png`; `dialog-terminal-settings-linux.png`.
- Required fixes before "Done": None for M5 design gate.
- Deferred (linked follow-up brief): Add smaller viewport and coarse-pointer visual coverage after M5.

## Speed - 8/10

- Findings: Renderer styling is token-based with simple selectors. No layout-thrashing animations were introduced in M5. Ghostty and mosh WASM are loaded only for terminal panes.
- Evidence: `pnpm --filter @moshtty/desktop build`; `pnpm --filter @moshtty/desktop test:visual`.
- Required fixes before "Done": None for M5 design gate.
- Deferred (linked follow-up brief): Measure first terminal-paint timing during M7 acceptance.

## Accessibility - 8/10

- Axe pass: yes - dashboard, active tab, and import dialog have no critical or serious violations in the Playwright a11y suite.
- Contrast pass: yes for the tokenized light/dark fixture states covered by visual tests.
- Keyboard map coverage: yes for registered visible actions; pointer-only actions are listed in settings.
- Reduced-motion: respected through the token stylesheet media query.
- Required fixes before "Done": None for M5 design gate.
- Deferred (linked follow-up brief): Add keyboard-only exploratory script for split/focus workflows in M7.

## Surface state matrix coverage

| Surface             | States required                      | Fixtures covering                                                                             | Reference parity               |
| ------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------ |
| Project rail        | collapsed, expanded, empty           | `rail-collapsed`, `rail-expanded`, `rail-empty`                                               | `ref-18.46.04`, `ref-18.46.17` |
| Top tab bar         | single, multi, dragging, overflow    | `active-tab`, `tab-bar-multi`, `tab-bar-dragging`, `tab-bar-overflow`                         | none - no tab reference        |
| Terminal pane       | active, lost                         | `active-tab`, `pane-lost`                                                                     | none - no terminal reference   |
| Split layout        | 2-row, 2-col, 3-pane, drag-hover     | `split-2-row`, `split-2-column`, `split-3-nested`, `split-handle-hover`                       | none - no split-pane reference |
| Project dashboard   | empty, populated                     | `dashboard-empty`, `dashboard`                                                                | `ref-18.46.04`                 |
| Remote import       | empty, valid, invalid                | `dialog-import-empty`, `dialog-import-valid`, `dialog-import-invalid`                         | none - no import reference     |
| Project edit dialog | new, existing                        | `dialog-project-edit-new`, `dialog-project-edit`                                              | `ref-18.46.25`                 |
| Terminal settings   | follow-app, light, dark              | `dialog-terminal-settings`, `dialog-terminal-settings-light`, `dialog-terminal-settings-dark` | `ref-18.46.36`                 |
| Connection status   | offline, connecting, connected, lost | `connection-offline`, `connection-connecting`, `connection-connected`, `connection-lost`      | none - no status reference     |

## Waivers requested

- Reference waivers: active terminal, split panes, import dialog, lost Pane state, connection status, dashboard dark mode, and tab bar states have no direct source among the four 2026-05-24 references. They are covered by Playwright baselines, token contrast, and live QA instead.

## Sign-off

- Reviewed by: coordinator pending
- PRD updated: yes
- Linked from PRD Current Notes: yes
