# Agent Task 9b: Command Palette

**Status:** Planned  
**Owner:** (unassigned — Flash 3.5 implementation agent)  
**Parent milestone:** M9b Command Palette  
**Scope label:** `9b-command-palette`

---

## Read First

Before touching any file, run the [Subagent Pre-flight](../../AGENTS.md#subagent-pre-flight)
checklist verbatim (git status, git log -1, confirm owned paths). Then read:

- `AGENTS.md` — Stop Conditions, Slice Budget, Design Rules, Git rules
- `docs/moshtty-prd.md`
- `docs/moshtty-design-system.md` — token contract; every CSS value must reference a token
- `docs/agents/OWNERS.md` — confirm owned paths before opening any file
- `apps/desktop/src/renderer/src/keymap.ts` — existing action registry; this is the data
  source for the palette
- `docs/visual-qa/8b/references/ref-antigravity-main.png` — Antigravity command palette
  (visual reference for the overlay style)
- `docs/visual-qa/8b/references/ref-antigravity-command-palette.png` — Antigravity command
  palette open state

---

## Background

The Moshtty renderer has a complete keyboard action registry (`keymap.ts`) with
`APP_ACTIONS`, `useRegisteredShortcuts`, and `getActionForKeyboardEvent`. The settings
dialog already lists all registered shortcuts in a table. However, there is no
command palette — no overlay the user can open to search and invoke any registered
action by name.

Two places in the existing code already anticipate the palette:

- `keymap.ts` line 125: `mouseOnlyReason: 'Project rows are pointer-selected until command
palette navigation lands.'`
- `docs/moshtty-prd.md` line 111: lists "command palette" as a top-bar affordance.

The reference screenshots show the Antigravity command palette: a centered floating
overlay with a search input at top, a filtered action list below, and keyboard navigation
(↑/↓ to move, Enter to invoke, Escape to close). This is the target UX.

---

## Visual References

All reference images are in `docs/visual-qa/8b/references/`. Study before writing CSS.

| File                                  | What it shows                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `ref-antigravity-command-palette.png` | Palette overlay — centered modal, search input, filtered list with keyboard-highlight |
| `ref-antigravity-main.png`            | Full Antigravity UI — shows how flat the surrounding chrome is                        |
| `opencode-tab-bar.png`                | Top bar style reference (no BETA, neutral chrome)                                     |

**Key design observations from `ref-antigravity-command-palette.png`:**

- Overlay: centered, `width: ~480px`, `border-radius: ~8px`, white `background`,
  `box-shadow: 0 8px 32px rgba(0,0,0,0.18)`, dim backdrop `rgba(0,0,0,0.25)` (no blur).
- Search input: full-width inside the overlay, `border-bottom: 1px solid var(--color-border)`,
  `font-size: 14px`, `padding: 12px 16px`, placeholder text `color: var(--color-text-subtle)`.
  No outer border on input itself — the panel border provides the container.
- Section label ("Commands"): `font-size: 11px`, `font-weight: 600`, uppercase, muted, `padding: 8px 16px 4px`.
- Action rows: `height: 32px`, `padding: 0 16px`, `font-size: 13px`.
  Active/highlighted row: `background: var(--color-sidebar-bg-active)`.
  Shortcut badge: right-aligned, `font-family: var(--font-family-mono)`, `font-size: 11px`,
  `color: var(--color-text-subtle)`, monospaced key chips.
- Max visible rows: ~8; panel scrolls if more.

---

## Owned Paths

This brief works inside the M8/renderer ownership row (see `OWNERS.md`):

```
apps/desktop/src/renderer/src/**   (except transport/**)
apps/desktop/src/renderer/src/design/**
apps/desktop/tests/visual/**
```

Do **not** touch:

- `apps/desktop/src/common/state*` or `*.schema.ts` (brief 2 — stop condition)
- `apps/desktop/src/main/**` or `apps/desktop/src/preload/**` (brief 2)
- `docs/moshtty-design-system.md` (shared — stop condition)
- `docs/agents/OWNERS.md`, `AGENTS.md`, `docs/moshtty-milestones.md` (shared)
- Any Go files

---

## Scope

This is a **renderer-only** feature. No IPC, no main-process changes, no Go changes.

### What to build

1. **`CommandPalette` component** (`CommandPalette.tsx` + `CommandPalette.css`) — a
   controlled overlay rendered at the top of the React tree in `App.tsx`. It is shown
   when `paletteOpen` state is true and hidden otherwise.

2. **Open/close wiring** — add `'open-command-palette'` to `AppActionId` in `keymap.ts`
   with shortcut `{ key: 'k', ctrl: true }`. Wire the action handler in `App.tsx` to
   toggle `paletteOpen`.

3. **Search and filter** — filter `APP_ACTIONS` by case-insensitive substring match on
   `action.label`. Show all actions when query is empty. Exclude internal dialog actions
   (`close-dialog`, `cancel-dialog`, `confirm-dialog`) from the palette list — they are
   not useful as discrete commands.

4. **Keyboard navigation** inside the palette:
   - `↑` / `↓` moves the highlight.
   - `Enter` invokes the highlighted action's handler and closes the palette.
   - `Escape` closes without invoking.
   - Mouse hover also sets the highlight.

5. **Action dispatch** — the palette needs access to the same handler map that `App.tsx`
   passes to `useRegisteredShortcuts`. Extract that map into a stable `useAppHandlers()`
   hook (new file `apps/desktop/src/renderer/src/appHandlers.ts`) so both `App.tsx` and
   `CommandPalette` can use it without prop-drilling the full map into the overlay.

6. **`mouseOnly` actions** — show them in the palette list but disable them (grayed text,
   not invokable). Display the `mouseOnlyReason` as a tooltip on hover.

7. **Focus management** — when the palette opens, focus the search input immediately.
   When it closes (Escape or Enter), return focus to the previously focused element
   (store `document.activeElement` on open).

8. **Accessibility** — the overlay is `role="dialog"` with `aria-label="Command palette"`.
   The list is `role="listbox"`, each row is `role="option"` with `aria-selected` on the
   highlighted item. Trap focus inside the palette while open.

---

## Detailed Changes

### 1. `keymap.ts` — add `open-command-palette` action

```typescript
// Add to AppActionId union:
| 'open-command-palette'

// Add to APP_ACTIONS array:
{
  id: 'open-command-palette',
  label: 'Open command palette',
  shortcut: { key: 'k', ctrl: true },
},
```

Also remove `mouseOnly: true` from `select-project` (its reason cited the palette;
once the palette lands, project navigation can be a palette action):

```typescript
// BEFORE
{
  id: 'select-project',
  label: 'Select project',
  mouseOnly: true,
  mouseOnlyReason: 'Project rows are pointer-selected until command palette navigation lands.',
},

// AFTER — keep in list but remove mouseOnly; palette makes it reachable
// (actual project selection still requires a click for now; update the label)
{
  id: 'select-project',
  label: 'Select project',
  mouseOnly: true,
  mouseOnlyReason: 'Use the project rail to select a project.',
},
```

_(Updating the `mouseOnlyReason` is cosmetic; leaving `mouseOnly` true is correct since
the palette action only opens the palette, not directly selects a project.)_

### 2. `appHandlers.ts` (new file)

Extract the handler map from `App.tsx` into a custom hook so `CommandPalette` can share it:

```typescript
// apps/desktop/src/renderer/src/appHandlers.ts

import { useCallback } from "react";
import { type AppActionHandlerMap } from "./keymap";
import { useStore } from "./store";

export function useAppHandlers(
  openSettings: () => void,
  openImport: () => void,
  openNewProject: () => void,
): AppActionHandlerMap {
  const store = useStore();
  return {
    "toggle-project-rail": useCallback(() => store.toggleRail(), [store]),
    "new-tab": useCallback(
      () => store.addTab(store.activeProjectId ?? ""),
      [store],
    ),
    "open-settings": useCallback(openSettings, [openSettings]),
    "import-remote": useCallback(openImport, [openImport]),
    "new-project": useCallback(openNewProject, [openNewProject]),
    "split-pane-right": useCallback(() => store.splitPane("right"), [store]),
    "split-pane-down": useCallback(() => store.splitPane("down"), [store]),
    "close-pane": useCallback(() => store.closeActivePane(), [store]),
    "close-tab": useCallback(() => store.closeActiveTab(), [store]),
    // ... all other handlers from App.tsx
  };
}
```

**Important:** read `App.tsx` carefully before implementing — extract the exact handler
implementations without changing behaviour. The `useAppHandlers` hook is a pure refactor
of what is already in `App.tsx`; the net behaviour must not change.

### 3. `CommandPalette.tsx` (new file)

```tsx
// apps/desktop/src/renderer/src/components/CommandPalette.tsx

import { useEffect, useRef, useState } from "react";
import { APP_ACTIONS, type AppActionHandlerMap } from "../keymap";
import "./CommandPalette.css";

const EXCLUDED_IDS = new Set([
  "close-dialog",
  "cancel-dialog",
  "confirm-dialog",
  "open-command-palette",
]);

interface CommandPaletteProps {
  open: boolean;
  handlers: AppActionHandlerMap;
  onClose: () => void;
}

export function CommandPalette({
  open,
  handlers,
  onClose,
}: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<Element | null>(null);

  const visibleActions = APP_ACTIONS.filter(
    (a) =>
      !EXCLUDED_IDS.has(a.id) &&
      a.label.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement;
      inputRef.current?.focus();
      setQuery("");
      setActiveIndex(0);
    } else {
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  function invoke(index: number): void {
    const action = visibleActions[index];
    if (!action || action.mouseOnly) return;
    handlers[action.id]?.();
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, visibleActions.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter") {
      invoke(activeIndex);
    }
  }

  return (
    <div className="palette-backdrop" onClick={onClose} aria-hidden="true">
      <div
        className="palette-panel"
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <input
          ref={inputRef}
          className="palette-input"
          type="text"
          placeholder="Type a command..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search commands"
          aria-autocomplete="list"
          aria-controls="palette-listbox"
          aria-activedescendant={`palette-option-${activeIndex}`}
        />
        <div className="palette-section-label">Commands</div>
        <ul
          id="palette-listbox"
          role="listbox"
          className="palette-list"
          aria-label="Commands"
        >
          {visibleActions.map((action, i) => (
            <li
              key={action.id}
              id={`palette-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={[
                "palette-item",
                i === activeIndex ? "palette-item--active" : "",
                action.mouseOnly ? "palette-item--disabled" : "",
              ].join(" ")}
              title={action.mouseOnly ? action.mouseOnlyReason : undefined}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => invoke(i)}
            >
              <span className="palette-item-label">{action.label}</span>
              {action.shortcut && (
                <kbd className="palette-item-shortcut">
                  {/* render shortcut chips */}
                  {[
                    action.shortcut.ctrl && "Ctrl",
                    action.shortcut.shift && "Shift",
                    action.shortcut.alt && "Alt",
                    action.shortcut.key.length === 1
                      ? action.shortcut.key.toUpperCase()
                      : action.shortcut.key,
                  ]
                    .filter(Boolean)
                    .join("+")}
                </kbd>
              )}
            </li>
          ))}
          {visibleActions.length === 0 && (
            <li className="palette-empty">No commands match "{query}"</li>
          )}
        </ul>
      </div>
    </div>
  );
}
```

### 4. `CommandPalette.css` (new file)

All values must use tokens. No raw px/hex/rgba outside this file's backdrop and shadow
(shadow uses a one-off token if `--shadow-overlay` exists, or document it as a gap).

```css
.palette-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(
    0,
    0,
    0,
    0.25
  ); /* intentional: no token for overlay scrim yet */
  z-index: var(--z-overlay);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: calc(var(--space-xl) * 3);
}

.palette-panel {
  width: 480px; /* intentional: fixed design width, not a spacing token */
  max-height: 400px;
  background: var(--color-workspace-bg);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18); /* intentional: overlay drop shadow */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.palette-input {
  font-family: var(--font-family-ui);
  font-size: var(--font-size-body);
  color: var(--color-text-main);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-sm) var(--space-md);
  outline: none;
  width: 100%;
}

.palette-input::placeholder {
  color: var(--color-text-subtle);
}

.palette-section-label {
  font-family: var(--font-family-ui);
  font-size: var(--font-size-caption);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-subtle);
  padding: var(--space-xs) var(--space-md) var(--space-xs);
}

.palette-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.palette-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-md);
  height: var(--density-control-height);
  cursor: pointer;
  font-family: var(--font-family-ui);
  font-size: var(--font-size-small);
  color: var(--color-text-main);
  transition: background-color var(--duration-fast) var(--easing-standard);
}

.palette-item--active {
  background: var(--color-sidebar-bg-active);
}

.palette-item--disabled {
  color: var(--color-text-subtle);
  cursor: default;
}

.palette-item-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.palette-item-shortcut {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-caption);
  color: var(--color-text-subtle);
  margin-left: var(--space-sm);
  flex-shrink: 0;
}

.palette-empty {
  padding: var(--space-md);
  font-family: var(--font-family-ui);
  font-size: var(--font-size-small);
  color: var(--color-text-subtle);
  font-style: italic;
}
```

**Token gaps to resolve before implementing:**

Check `tokens.css` for the existence of:

- `--z-overlay` — z-index for modal overlays. If missing, add to `tokens.css` and
  `tokens.ts` **and** update `docs/moshtty-design-system.md`. Adding a token is a stop
  condition; coordinate first if `--z-overlay` is not already defined.
- `--font-size-caption` — if missing, same stop condition.

If either token is missing, use a numerical z-index inline with a `/* TODO: token */`
comment and file a follow-up in the PRD.

### 5. Wire `CommandPalette` into `App.tsx`

```tsx
// In App.tsx:
import { CommandPalette } from './components/CommandPalette'

// State:
const [paletteOpen, setPaletteOpen] = useState(false)

// In handler map passed to useRegisteredShortcuts, add:
'open-command-palette': () => setPaletteOpen(true),

// In JSX, render at the top level alongside Dialogs:
<CommandPalette
  open={paletteOpen}
  handlers={appHandlers}
  onClose={() => setPaletteOpen(false)}
/>
```

---

## Token Gap Check

Before writing CSS, grep the token files:

```bash
grep "z-overlay\|z-dialog\|z-modal" apps/desktop/src/renderer/src/design/tokens.css
grep "font-size-caption\|font-size-small\|font-size-body" apps/desktop/src/renderer/src/design/tokens.css
```

If `--z-overlay` is absent: **stop condition** — surface to coordinator. Do not invent
a raw z-index without a token. If `--font-size-caption` is absent, check if
`--font-size-small` covers it; if so use `--font-size-small` and document the gap.

---

## Verification

### Per-commit minimum

```bash
pnpm --filter @moshtty/desktop typecheck
pnpm --filter @moshtty/desktop test
go test ./...
git diff --check
```

### Full before marking Ready for review

```bash
pnpm --filter @moshtty/desktop typecheck
pnpm --filter @moshtty/desktop lint
pnpm --filter @moshtty/desktop lint:css
pnpm --filter @moshtty/desktop test
pnpm --filter @moshtty/desktop build
pnpm --filter @moshtty/desktop test:visual:update
pnpm --filter @moshtty/desktop test:visual
go test ./...
go vet ./...
git diff --check
```

### Visual QA with agent-browser (required)

Start the app (`pnpm --filter @moshtty/desktop dev`) and run an `agent-browser` QA
session. Read `.agents/skills/agent-browser/SKILL.md` and `.agents/skills/electron/SKILL.md`
first.

Required screenshots:

| State                                              | Save to                                       |
| -------------------------------------------------- | --------------------------------------------- |
| Palette closed — normal top bar                    | `docs/visual-qa/9b/palette-closed.png`        |
| Palette open — empty query                         | `docs/visual-qa/9b/palette-open-empty.png`    |
| Palette open — query "split"                       | `docs/visual-qa/9b/palette-open-filtered.png` |
| Palette open — mouseOnly row highlighted (tooltip) | `docs/visual-qa/9b/palette-disabled-row.png`  |
| Palette open — dark mode                           | `docs/visual-qa/9b/palette-open-dark.png`     |

For each, compare to `docs/visual-qa/8b/references/ref-antigravity-command-palette.png`
and note gaps in the handoff.

Also run axe-core on the open palette. Log any violations.

### Functional checks

- `Ctrl+K` opens palette.
- `Escape` closes it and returns focus to the previously focused element.
- Typing filters the list in real time.
- `↑`/`↓` moves highlight; `Enter` invokes and closes.
- Mouse hover changes highlight.
- Clicking outside the panel closes it.
- Disabled (mouseOnly) rows do not invoke on click or Enter.
- Light and dark mode both render correctly.

---

## PRD Close-out (required before commit)

Update `docs/moshtty-prd.md`:

- Add task entry `Moshtty Command Palette (9b)` | this agent | `Ready for review`
- Note verification results, open gaps, and follow-ups.

---

## Slice Budget Sanity Check

Expected changed files (soft cap 8):

1. `apps/desktop/src/renderer/src/keymap.ts` — add `open-command-palette`
2. `apps/desktop/src/renderer/src/appHandlers.ts` — [NEW] extracted handler hook
3. `apps/desktop/src/renderer/src/components/CommandPalette.tsx` — [NEW] overlay component
4. `apps/desktop/src/renderer/src/components/CommandPalette.css` — [NEW] styles
5. `apps/desktop/src/renderer/src/App.tsx` — wire palette open/close
6. `apps/desktop/tests/visual/**` — baseline snapshot updates (generated)
7. `docs/moshtty-prd.md` — close-out entry
8. `apps/desktop/src/renderer/src/keymap.test.ts` — add palette action test

That is 7 source files + generated snapshots. At soft cap.

---

## Commit Shape

One atomic commit:

```
feat(ui): add command palette (Ctrl+K) for keyboard-driven action search
```

Body lists the 7 source changes. Do not commit until `pnpm verify:full` and `test:visual`
both pass.
