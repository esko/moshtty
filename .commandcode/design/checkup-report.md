# Design Checkup — Crostini Ghostty Terminal

**Date:** 2026-05-23
**Surface:** Full PWA (settings page, terminal workspace, command palette, status bar)
**Register:** Product (app UI)

## Score: 30/60

| Vital Sign | Status | Score |
|---|---|---|
| Intentionality | Watch | 5/10 |
| Readability | Watch | 5/10 |
| Usability | Watch | 5/10 |
| Responsiveness | Watch | 5/10 |
| Speed | Healthy | 10/10 |
| Accessibility | **Critical** | 0/10 |

---

## Intentionality — Watch (5/10)

**Token system is well-structured but has undefined variables.**

Three foreground color tokens are referenced in the palette and status bar CSS but never defined:
- `--color-foreground-1` (used for keybindings kbd, palette items, status bar)
- `--color-foreground-2` (used for status bar text, palette items)  
- `--color-foreground-3` (used for palette empty state, category badges)

These resolve to `initial` — the browser default text color. On a forced-dark-scheme page, this is accidentally close to white, but it's not intentional.

**The palette, status bar, and keybinding editor text colors are all technically broken.**

The existing token system (`--color-text`, `--color-text-strong`, `--color-text-muted`, `--color-text-subtle`, `--color-text-faint`) already provides a 5-level hierarchy. The undefined `foreground` tokens should be mapped into this hierarchy or added as aliases.

---

## Readability — Watch (5/10)

**Font sizes are at the low end for monitor use.** The UI runs 12-14px throughout. At 24-32" monitor distances (the recommended 28-36px range), this falls below comfortable reading size. The settings page body text at 13px with 1.35 line-height is functional but tight.

**No letter-spacing compensation for light-on-dark type.** Dark-theme light text reads optically thinner. A trace of letter-spacing (0.01-0.02em) on body text and headings would improve readability.

**Good:** Settings intro max-width 48ch, session-row text truncation with ellipsis, monospace font for terminal data.

---

## Usability — Watch (5/10)

**Context menu learned disabled states correctly** — items are context-dependent and grayed out when inapplicable. Split dividers have proper hover and focus-visible states with clear cursors.

**Missing loading states.** Only indicator is a text label "Connecting" in the status bar. No spinner, skeleton, or progress indicator for terminal attach, tab creation, or pane split operations.

**Missing undo for destructive actions.** "Close pane" and "Close tab" are instant and irreversible. No undo toast, no trash buffer, no 30-second recovery window.

**Missing keyboard-driven scrollback.** Scrollback navigation is mouse-only via wheel. No PgUp/PgDn, no copy-mode keyboard binding.

**Good:** Status bar provides clickable pane navigation, context menu covers all common operations, diagnostics panel gives real-time metrics.

---

## Responsiveness — Watch (5/10)

**Single breakpoint at 720px.** Settings page, hero, form grid, session rows collapse to single-column. This is adequate for a terminal app that's primarily used at larger widths.

**Missing:**
- No `pointer: coarse` or touch-specific sizing (44px minimum targets)
- No `env(safe-area-inset-*)` for notched devices
- No container queries for split-pane content
- No `@media (hover: hover)` for hover-only affordances

---

## Speed — Healthy (10/10)

**CSS is efficient at 1460 lines.** No expensive filters (backdrop-filter on palette is static), no layout-triggering transforms on scroll, no heavy pseudo-element rendering. Canvas-based terminal rendering with WASM is performant.

**One animation keyframe** (`keybinding-pulse`) — lightweight opacity-only. No jank sources visible in the stylesheet.

---

## Accessibility — Critical (0/10)

### 🚫 outline: none without replacement (BLOCKER)

Four interactive elements disable the browser focus ring with `outline: none` and provide no visible replacement:

1. **`#commandPaletteInput`** — the palette search input. Keyboard users have no focus indicator.
2. **`.space-select`** — the tab-space dropdown selector. Invisible when focused.
3. **`.icon-button`** — all icon buttons (new tab, rename, duplicate, delete, etc.). Invisible focus.
4. **`.context-menu button`** — every context menu item. Navigating by keyboard in the context menu shows no active item.

These are the most critical accessibility violations. Keyboard users cannot navigate the command palette, settings page buttons, or context menu.

### 🚫 No prefers-reduced-motion support

The `keybinding-pulse` animation and any future motion additions must respect `@media (prefers-reduced-motion: reduce)`.

### ✅ Working

- ARIA labels on landmarks (main, nav, aside)
- Proper heading hierarchy (h1, h2)
- Form labels associated with inputs
- Debug shell tab strip uses role="tablist"/role="tab" with aria-selected
- Split dividers have role="separator" with aria-valuenow/min/max

---

## Prescriptions

### Critical — Fix immediately

1. **Define `--color-foreground-1`, `--color-foreground-2`, `--color-foreground-3`** by mapping them into the existing text token hierarchy (aliases to `--color-text-strong`, `--color-text`, `--color-text-muted` respectively).

2. **Remove `outline: none` and add visible focus indicators** on:
   - `#commandPaletteInput` — `outline: 2px solid var(--color-focus); outline-offset: -2px;`
   - `.space-select` — use the same focus-visible border pattern already on hover
   - `.icon-button` — `outline: 2px solid var(--color-focus); outline-offset: 2px;`
   - `.context-menu button` — `outline-offset: -2px;` + left border or background highlight

3. **Add `@media (prefers-reduced-motion: reduce)`** that disables `keybinding-pulse` animation.

### Important — Fix in next pass

4. Add loading states for terminal connect, tab create, and pane split operations
5. Increase minimum touch targets to 44×44px on touch devices via `@media (pointer: coarse)`
6. Add `letter-spacing: 0.01em` to body text for light-on-dark readability
