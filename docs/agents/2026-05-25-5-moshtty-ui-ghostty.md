# Agent Task 5: Moshtty UI And Ghostty

## Read First

- `AGENTS.md` (Status Tiers, Stop Conditions, Slice Budget)
- `docs/moshtty-prd.md`
- `docs/moshtty-plan.md`
- `docs/moshtty-milestones.md`
- `docs/moshtty-testing.md`
- `docs/moshtty-design-system.md` — **mandatory**: the token / theme / surface-state contract is normative for this milestone
- `docs/moshtty-design-references.md` — the four reference screenshots mapped to UI surfaces
- `docs/moshtty-design-checkup.md` — the rubric every visual slice is reviewed against
- `docs/agents/OWNERS.md` — your owned paths
- `docs/agents/TEMPLATE_HANDOFF.md` — fill this out before close-out

## Objective

Build the React Moshtty UI around projects, tabs, panes, settings, and Ghostty terminal rendering, **within the design contract**. The goal is not just a working UI — it is a UI that is visually consistent with the four reference screenshots and that survives token-level review.

## Scope

Work primarily in `apps/desktop` renderer code. Owned paths per `OWNERS.md`:

- `apps/desktop/src/renderer/src/**` (except `transport/**`, which is M4's)
- `apps/desktop/src/renderer/src/design/**` — consumes tokens; **does not edit `tokens.ts` / `tokens.css`** (stop condition)
- `apps/desktop/src/renderer/src/fixtures/**` — visual-regression fixture states
- `apps/desktop/tests/visual/**` — Playwright Electron + axe screenshots
- nearby Vitest tests for everything you ship

Use the design references (also linked from `docs/moshtty-design-references.md`):

- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.04.png`
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.17.png`
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.25.png`
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.36.png`

## Hard Rules (will fail review)

These are non-negotiable. Any slice that breaks one of them is sent back regardless of feature progress.

### Tokens only

- All colors, spacing, font sizes, line heights, radii, durations, easings, elevations, and z-index values **must** come from `src/renderer/src/design/tokens.ts` (TS) or `src/renderer/src/design/tokens.css` (CSS custom properties).
- No literal `#hex`, `rgb(...)`, `rgba(...)`, `px`, `em`, `ms`, `cubic-bezier(...)`, or `0` numeric magic-number outside of `tokens.ts` / `tokens.css`.
- The Stylelint `scale-unlimited/declaration-strict-value` rule enforces this; running `pnpm --filter @moshtty/desktop lint:css` must pass.
- Adding a new token requires updating `tokens.ts`, `tokens.css`, and `docs/moshtty-design-system.md` in the same slice. That edit is a coordinator-touch — surface it instead of doing it silently.

### Theme contract

- The Light/Dark/System setting is a user choice and **always wins** over OS preference when set to `light` or `dark`.
- `system` means "follow OS"; resolve it via `resolveThemeMode` in `src/renderer/src/design/theme.ts` and apply via `data-theme` on `<html>` / `<body>`.
- Terminal palette follows the resolved app theme by default (`follow-app`); per-pane override is allowed (`light` / `dark`) and must be persisted in state.
- No component is allowed to read `window.matchMedia` directly except inside `theme.ts`.

### Surface state matrix

Every surface listed below must have at least one visual fixture and one Playwright screenshot per applicable state. Fixtures live in `src/renderer/src/fixtures/states.ts`.

| Surface              | States to cover                                                  |
| -------------------- | ---------------------------------------------------------------- |
| Project rail         | collapsed, expanded with active project, empty                   |
| Top tab bar          | single tab, multi-tab, dragging (snapshot stand-in OK), overflow |
| Terminal pane        | active, lost-connection                                          |
| Split layout         | 2-pane row, 2-pane column, 3-pane (nested), drag handle hover    |
| Project dashboard    | empty, populated                                                 |
| Remote import dialog | empty, valid profile pasted, invalid profile pasted              |
| Project edit dialog  | new, existing                                                    |
| Terminal settings    | follow-app, light override, dark override                        |
| Connection status    | offline, connecting, connected, lost                             |

The target is **9 surfaces, up to ~45 fixtures**. Land them incrementally — see Slice Budget — but a milestone close-out cannot claim "Ready for review" until the full matrix has at least one fixture each.

### Reference parity

For each surface, before claiming `Ready for review`:

1. Map it to one of the four screenshots in `docs/moshtty-design-references.md`.
2. Side-by-side the screenshot and the corresponding fixture rendering.
3. Score against the rubric in `docs/moshtty-design-checkup.md`. If any line lands in `Critical`, fix or document deferred work in the PRD.

### Accessibility floor

- All interactive elements must be keyboard-reachable and have a visible `:focus-visible` ring (token: `--color-focus`, 2px outline).
- All icon-only controls must carry an `aria-label`.
- Color contrast: body text >= 4.5:1, large text / icons >= 3:1, in both light and dark.
- `tests/visual/a11y.test.ts` runs `@axe-core/playwright` against the dashboard, active tab, and dialog surfaces; any `critical` or `serious` violation fails the slice.
- Respect `prefers-reduced-motion` — `tokens.css` already neutralizes animations under that media query; do not re-enable them inside component CSS.

### Copy and voice

- Sentence case for buttons, menu items, and headings (`Add remote`, not `Add Remote`).
- No ALL CAPS labels.
- No exclamation marks in product copy.
- Error messages name the action that failed and the next step (`Could not import profile. Check that the JSON is valid and try again.`).

### IDs out of render

- Project / tab / pane IDs are never visible in the rendered UI. They live in state for `data-*` attributes and routing only.
- `data-testid` / `data-fixture` are allowed.

### Icon system

- Use inline SVG icon components from `src/renderer/src/design/icons/`. Each icon is a function component that accepts `size` (defaults to a density token) and inherits `currentColor`.
- No raster icons, no icon fonts, no external icon libraries in v1.
- Adding an icon: drop a new SVG component into the `icons/` directory; size must be 16 or 20 by default (matches `--density-icon-button-size`).

### Keyboard-map first

- Every visible action that has a button must also have a registered keyboard shortcut in the keymap module (or be intentionally mouse-only and documented as such).
- New shortcuts go through the keymap registry, not ad-hoc `addEventListener` calls.
- The settings / command palette surface must list all registered shortcuts.

### CSP and IPC trust boundary

- Renderer-side `fetch` is restricted by the BrowserWindow CSP; do not relax CSP to ship a feature. If you need a new network capability, surface to the coordinator.
- The renderer talks to main exclusively through the typed preload bridge. No `ipcRenderer.invoke` calls outside the preload module.
- Every IPC payload entering main is validated against the matching schema in `src/common/ipc.schema.ts` via `assertIpcPayload`. Adding a channel means adding a schema in the same slice.
- Profile JSON imports and state JSON loads must go through `parseMoshttyProfile` / `parseMoshttyState` before any of their fields are read by the renderer.

## Deliverables

- React components, Zustand store wiring, CSS modules / plain CSS using only tokens.
- Flat-row, sparse desktop visual style consistent with the reference screenshots.
- Terminal panes render through `ghostty-web` (or a token-styled placeholder while ghostty-web integration is in progress).
- Keyboard / app actions wired to the store via the keymap registry.
- Vitest tests for reducers, theme resolution, layout behavior, fixture loader, and import validation.
- Playwright Electron visual screenshots for the surface state matrix.
- Axe-core a11y assertions on the dashboard, active-tab, and dialog surfaces.
- `agent-browser` review screenshots for light and dark mode before marking the task ready.

Avoid:

- marketing pages;
- nested card-heavy dashboard design;
- visible instructional text where normal controls are enough;
- image project icons in v1;
- inline literal colors / spacings / durations anywhere outside the token modules.

## Verification

Run from the repo root:

```bash
pnpm install
pnpm --filter @moshtty/desktop typecheck
pnpm --filter @moshtty/desktop lint
pnpm --filter @moshtty/desktop lint:css
pnpm --filter @moshtty/desktop test
pnpm --filter @moshtty/desktop test:coverage
pnpm --filter @moshtty/desktop build
pnpm --filter @moshtty/desktop test:visual
pnpm format:check
git diff --check
```

Manual inspection:

- light and dark modes;
- collapsed and expanded project rail;
- project dashboard, empty and populated;
- 2- and 3-way split panes;
- centered dialogs (import, project edit, settings);
- no obvious text overlap at desktop and narrow widths;
- `agent-browser` snapshot and screenshot pass against the running Electron app for light + dark + a dialog open.

## PRD Update

Before committing, set:

- `M5 UI and Ghostty integration` status from `Planned` -> `In progress` -> `Ready for review`;
- this task to `Ready for review`;
- add verification commands and observed results, including visual + a11y checks;
- record any deferred surfaces or visual mismatches as follow-up items;
- fill in `docs/agents/TEMPLATE_HANDOFF.md` for the slice;
- do not commit until `docs/moshtty-prd.md` is closed out for this task.

`Verified on target` is reserved for an explicit on-device pass with `agent-browser` and the user's primary OS — Linux CI alone is not sufficient for this milestone's close.
