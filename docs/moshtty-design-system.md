# Moshtty Design System

This document is the design contract for Moshtty. Every renderer surface
must comply with it. The two enforcement points are
[`apps/desktop/src/renderer/src/design/tokens.ts`](../apps/desktop/src/renderer/src/design/tokens.ts)
and [`apps/desktop/src/renderer/src/design/tokens.css`](../apps/desktop/src/renderer/src/design/tokens.css);
this doc explains the rationale and lists the rules agents must follow.

Edits to tokens or to this document are a stop condition for agents
(see [`AGENTS.md`](../AGENTS.md)). Coordinate before changing them.

## Visual direction (locked)

From `docs/moshtty-plan.md` and `docs/moshtty-prd.md`:

- Quiet light desktop UI by default; Light/Dark/System mode setting.
- Compact left project rail, large terminal work area.
- Flat rows, hairline dividers, very few cards.
- Centered modals for project/remote/settings edits.
- Subtle persistent connection status.
- Project identity is a color chip plus initial.
- Compact desktop density.
- Primary reference: the four `2026-05-24 18.46.*` screenshots
  (mapped to UI surfaces in
  [`docs/moshtty-design-references.md`](moshtty-design-references.md)).

## Tokens

The token module is the single source of truth. Components must not
hardcode hex colors, raw px for spacing/radius/density, or magic font
sizes. Stylelint enforces this.

### Color

| Token (CSS / TS)            | Use                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--color-app-bg`            | App chrome background.                                                                                                                            |
| `--color-sidebar-bg`        | Project rail surface.                                                                                                                             |
| `--color-sidebar-bg-active` | Active/hover rail row.                                                                                                                            |
| `--color-workspace-bg`      | Workspace canvas.                                                                                                                                 |
| `--color-terminal-bg`       | Terminal pane background. Light mode uses a white canvas (`#ffffff`) to match the OpenCode and Antigravity references; dark mode stays `#18181b`. |
| `--color-border`            | Hairline divider.                                                                                                                                 |
| `--color-border-strong`     | Control borders, inputs.                                                                                                                          |
| `--color-text-main`         | Primary body text.                                                                                                                                |
| `--color-text-muted`        | Secondary text, labels.                                                                                                                           |
| `--color-text-subtle`       | Hints, timestamps, disabled.                                                                                                                      |
| `--color-text-terminal`     | Text rendered on the terminal background. Light mode is near-black (`#1a1a1f`) on the white canvas; dark mode is `#e2e2e8`.                       |
| `--color-accent`            | Primary action color.                                                                                                                             |
| `--color-accent-soft`       | Accent tint, hover/selected.                                                                                                                      |
| `--color-accent-on`         | Foreground on accent surfaces.                                                                                                                    |
| `--color-success`           | Connected, healthy.                                                                                                                               |
| `--color-warning`           | Degraded, intermediate.                                                                                                                           |
| `--color-danger`            | Error, lost pane.                                                                                                                                 |
| `--color-focus`             | Focus ring color, contrasts both surfaces.                                                                                                        |

### Spacing scale (4-pt)

`2xs (2), xs (4), sm (8), md (12), lg (16), xl (24), 2xl (32), 3xl (48)`.

Components may not introduce px values outside this scale. If a value
truly does not fit, raise it to the coordinator before adding.

### Radii

`sm (4)`, `md (6)`, `lg (10)`, `pill (9999)`.

### Type scale (px)

`caption (11)`, `small (12)`, `body (13)`, `bodyLg (14)`,
`title (16)`, `heading (20)`.

Body floor is 13px to preserve compact desktop density while staying
readable. Anything smaller than `caption` is forbidden.

Use `--font-family-ui` for chrome and `--font-family-mono` for
terminal/code surfaces.

### Density

| Token                        | Purpose                                 | Default |
| ---------------------------- | --------------------------------------- | ------- |
| `--density-brand-height`     | Top brand/tab-bar height.               | 48px    |
| `--density-tab-bar-height`   | Individual tab height.                  | 38px    |
| `--density-row-height`       | Rail rows, list items.                  | 32px    |
| `--density-control-height`   | Buttons, inputs.                        | 28px    |
| `--density-icon-button-size` | Icon button square.                     | 28px    |
| `--density-touch-target`     | Minimum tap target on `pointer:coarse`. | 44px    |
| `--density-topbar-height`    | Unified top bar height.                 | 40px    |
| `--density-sidebar-width`    | Slim project sidebar width.             | 220px   |

### Motion

| Token               | Use                            |
| ------------------- | ------------------------------ |
| `--duration-fast`   | Hover/focus reactions (100ms). |
| `--duration-base`   | Default transitions (150ms).   |
| `--duration-slow`   | Dialog enter/exit (220ms).     |
| `--easing-standard` | Default.                       |
| `--easing-entrance` | Element appearing.             |
| `--easing-exit`     | Element leaving.               |

Any element with `transition`/`animation` must respect
`@media (prefers-reduced-motion: reduce)`. `tokens.css` ships a global
override; component-local animations must not opt out of it.

### Elevation

Two levels only: `--elevation-popover` and `--elevation-dialog`.
No heavier shadows.

## Theme contract

User setting (`MoshttySettings.themeMode`) wins over OS preference.

1. Renderer reads `settings.themeMode` (`light` | `dark` | `system`).
2. Renderer writes `<html data-theme="...">` from the setting.
3. `tokens.css` palettes are scoped:
   - `:root[data-theme='light']` -> light palette.
   - `:root[data-theme='dark']` -> dark palette.
   - `:root[data-theme='system']` + `@media (prefers-color-scheme: dark)`
     -> dark palette; otherwise the default light palette wins.

This means a user-selected mode is unambiguous regardless of OS state.
Use [`apps/desktop/src/renderer/src/design/theme.ts`](../apps/desktop/src/renderer/src/design/theme.ts)
helpers (`applyThemeAttribute`, `useResolvedThemeMode`); never read
`prefers-color-scheme` directly from a component.

Terminal palette follows the resolved app mode by default
(`terminalTheme: 'follow-app'`). User may force `light` or `dark`. Use
`resolveTerminalThemeMode` to compute the effective palette.

## Accessibility rules

These are non-negotiable. The previous PWA scored 0/10 on accessibility
([`.commandcode/design/checkup-report.md`](../.commandcode/design/checkup-report.md));
Moshtty must not regress.

- **Focus ring**: every interactive element must show a visible ring on
  keyboard focus. `outline: none` without a `:focus-visible`
  replacement is a stylelint error.
- **Reduced motion**: any animation must collapse under
  `prefers-reduced-motion: reduce`. Stylelint flags `animation`
  declarations without a guard.
- **Color contrast**: body text must meet WCAG AA (4.5:1) on both
  light and dark surfaces. Axe runs against every fixture state.
- **Pointer-coarse targets**: interactive controls on touch devices
  must reach `--density-touch-target` (44px) via
  `@media (pointer: coarse)`.
- **ARIA**: landmarks (`main`, `nav`, `aside`), heading order, and
  label associations are required. Dialogs use focus traps.
- **Keyboard map**: every clickable affordance has a keyboard path.

## Component rules

- Components must consume tokens, not hex/px literals.
- IDs (`crypto.randomUUID()`) belong in state/actions, not in render.
- No inline `style={{ color: '...' }}` or `style={{ padding: ... }}`.
- No new top-level CSS file without a coordinator decision; prefer
  CSS modules colocated with the component.
- No new icon library; pick one (inline SVG sprite or
  `lucide-react`) before any icon ships.
- No new component library or Tailwind.
- Copy/voice rules:
  - Buttons use sentence case ("Add project", not "Add Project").
  - Status strings are calm and concrete ("Offline", "Connected",
    "Pane lost - reconnect to restore").
  - Errors describe the impact and the next step, not stack traces.
  - Avoid jargon ("session"); use the locked vocabulary (Project,
    Tab, Pane).

## Icons

Icon system: **inline SVG components** in `apps/desktop/src/renderer/src/design/icons/`.
Each icon is a small `.tsx` file exporting a React component. No sprite file,
no icon fonts. Add `lucide-react` only with coordinator approval.

Usage pattern:

```tsx
import { PlusIcon } from "../design/icons/PlusIcon";
// ...
<PlusIcon size={16} />;
```

No new icon without coordinator approval. Document new icons here.

## Required surface states

Every surface ships these states (where applicable) before it is
"Ready for review". The Playwright fixture set must cover them.

| Surface              | empty | loading | error | success | lost |
| -------------------- | :---: | :-----: | :---: | :-----: | :--: |
| Project dashboard    |  yes  |   yes   |  yes  |   yes   |  -   |
| Project rail         |  yes  |   yes   |  yes  |   yes   |  -   |
| Tab bar              |  yes  |   yes   |  yes  |   yes   |  -   |
| Terminal pane        |  yes  |   yes   |  yes  |   yes   | yes  |
| Split layout         |   -   |   yes   |  yes  |   yes   | yes  |
| Remote import dialog |  yes  |   yes   |  yes  |   yes   |  -   |
| Project edit dialog  |  yes  |   yes   |  yes  |   yes   |  -   |
| Settings dialog      |   -   |   yes   |  yes  |   yes   |  -   |
| Connection status    |   -   |   yes   |  yes  |   yes   | yes  |

## Reference parity

Each `2026-05-24 18.46.*` reference screenshot maps to one or more
surface states. See
[`docs/moshtty-design-references.md`](moshtty-design-references.md)
for the 1:1 mapping. A UI slice is not "Ready for review" until the
corresponding fixture state ships and the Playwright screenshot
matches the reference within the documented pixel-diff threshold.

## Design verification

The end of every UI milestone (M5, M7) requires an updated
[`docs/moshtty-design-checkup.md`](moshtty-design-checkup.md)
covering Intentionality, Readability, Usability, Responsiveness,
Speed, and Accessibility. A vital sign below 7/10 blocks "Done"
status unless the PRD records an explicit waiver.

## Process

Renderer changes that touch the design system go through the design
checkup and Playwright visual regression before the slice is marked
ready for review. Token edits halt the agent (stop condition).
