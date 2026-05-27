# Agent Task 8b: Moshtty UI Polish (M8 Follow-up)

**Status:** Planned  
**Owner:** (unassigned — Flash 3.5 implementation agent)  
**Parent milestone:** M8 UI Refresh  
**Scope label:** `8b-ui-polish`

---

## Read First

Before touching any file, run the [Subagent Pre-flight](../../AGENTS.md#subagent-pre-flight)
checklist verbatim (git status, git log -1, confirm owned paths). Then read:

- `AGENTS.md` (this file, especially Stop Conditions, Slice Budget, Design Rules)
- `docs/moshtty-prd.md`
- `docs/moshtty-design-system.md` — token contract; every CSS value must use a token
- `docs/moshtty-design-references.md` — visual reference mapping
- `docs/agents/OWNERS.md` — confirm your paths; do NOT edit paths owned by other briefs

---

## Background

M8 implemented the initial UI refresh (frameless window, collapsible sidebar, unified
top bar, custom window controls). The result is functional but still has Bootstrap-era
visual debt. This brief drives the remaining polish items the user identified:

1. **BETA badge** — remove entirely from `TopBar.tsx`.
2. **Blue primary buttons** — the current `.button.primary` rule uses `--color-accent`
   (indigo-ish). On neutral dark/light surfaces this reads as a Bootstrap default. Replace
   the primary action style with a near-black/near-white ghost approach (see §Changes below).
3. **Terminal pane borders** — panes currently have a 1 px `--color-border-strong` border
   and `--radius-md` corners that make them look like Bootstrap cards. Remove borders and
   radius. Panes must span edge-to-edge within `terminal-workspace`, separated only by the
   split handle, which should become a 1 px hairline (`--color-border`) with no border-radius.
4. **Terminal color scheme follows app theme** — the current `terminalMode` prop resolves
   to `light | dark` via `resolveTerminalThemeMode` in `App.tsx`, but the hardcoded hex
   theme in `TerminalPane.tsx` does not follow light mode correctly (both light and dark
   maps use dark backgrounds). Fix so that light mode uses a genuine white/near-white
   background and dark mode uses the correct dark background pulled from the token palette.
5. **Named terminal theme picker in Settings** — add a `terminalColorScheme` setting
   (renderer-only, stored in `MoshttySettings` via a **new field on the schema** — see §Stop
   condition note below) that is a string key matching one of the built-in themes. Provide
   six presets: `default-dark`, `default-light`, `dracula`, `catppuccin-mocha`,
   `solarized-dark`, `solarized-light`. The picker replaces the current inert "Follow app /
   Current mode" display in the Settings dialog.
6. **Tab bar visual quality** — tabs currently look cramped and visually detached. Apply
   the OpenCode tab style: flat, no card border, slightly taller active tab indicator (2 px
   bottom border in `--color-text-main`, not a filled pill), muted inactive tab text
   (`--color-text-subtle`), active tab text `--color-text-main`. Remove the
   `tab-wrapper` border. The `new-tab-btn` should use an icon-button style identical to
   other toolbar icons (no separate rounded container).
7. **Overall tone** — study ALL three reference sources below before writing any CSS.

---

## Visual References

All reference images are in `docs/visual-qa/8b/references/`. **Open and study all of them before writing CSS.**

### A. OpenCode tab bar (user-provided screenshot)

**File:** `docs/visual-qa/8b/references/opencode-tab-bar.png`  
**Also:** `docs/visual-qa/8b/references/ref-opencode-tabs.png` (same image, higher-res copy)

This is the **primary reference** for Moshtty tab strip design. Precise observations at full
resolution:

- **Top bar**: `background: ~#f2f2f2` (very light gray), completely flat, `~40 px` tall,
  **no bottom border**. Zero card feel.
- **BETA badge**: solid blue filled pill (`background: #2563eb`, white text, `border-radius: 6px`,
  `font-size: 11px`, `font-weight: 700`) at far left. **Remove this entirely from Moshtty.**
- **Inactive tabs** ("Blah", "New session…"): **no background fill** — they sit bare on the
  top bar surface. Each has a small colored square letter chip (~`10×10 px`, `border-radius: 3px`)
  - title text (`color: ~#374151`, `font-size: 12px`, `font-weight: 500`). Tabs are separated
    by a `1px` vertical hairline divider.
- **Active tab** ("Greetin ×"): filled pill `background: ~#e8e8e8`, `border-radius: ~6px`,
  title `font-weight: 600`, `color: #111827`. Close `×` button visible at right inside the pill.
  This is the **only** tab with a filled background.
- **New tab `+`**: plain icon button immediately right of last tab. No border, no background,
  same icon color as toolbar icons.
- **Right side**: "Update" button — `border: 1px solid #d1d5db`, no fill, `border-radius: 6px`,
  `font-size: 13px`, `color: #374151`. This is the target style for `.button.secondary`.
  Window controls (−, □, ×) are native-styled, at far right.

> **Correction to §7 of the brief**: tabs are a **hybrid** — inactive tabs have NO background
> (bare bar), active tab has ONE filled pill. The CSS in §7 below should implement this:
> `.tab-wrapper` has no background; `.tab-wrapper.active` gets the pill fill. Follow this exactly.

### B. OpenCode reference screenshots (on-disk)

Four canonical screenshots:

| File                               | Surface                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| `opencode-dashboard-light.png`     | Project dashboard, light mode — compact top chrome, left project rail, centered search |
| `opencode-project-rail.png`        | Expanded project rail + action menu                                                    |
| `opencode-project-edit-dialog.png` | Centered project-edit modal, subdued backdrop                                          |
| `opencode-settings-dialog.png`     | Large settings modal with side nav, flat setting rows                                  |

**Design tokens to extract from these images:**

- Top bar height: ~40 px, single hairline bottom border
- Sidebar width: ~220 px, no filled background — almost same lightness as canvas
- Row height: ~32 px, no border, subtle hover fill
- Dialog: centered, white card, `box-shadow` only (no backdrop blur), 8–10 px radius
- Typography: 13 px body, 12 px labels/secondary, 11 px captions; `font-weight: 500` for nav items

### C. Antigravity app (live reference — on-disk screenshots)

Three screenshots captured from the running Antigravity Electron app:

| File                       | Surface                               | Key design observations                                                                                                                                                            |
| -------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `antigravity-main.png`     | Main chat view — current conversation | Very flat chrome, hairline sidebar divider, breadcrumb top bar, white content, no card borders                                                                                     |
| `antigravity-settings.png` | Settings modal open                   | Left nav sidebar (plain text items, active item `background: #f3f4f6` fill), right content panel, white modal with `border-radius: ~10px` and subtle drop shadow, no backdrop blur |
| `antigravity-sidebar.png`  | Sidebar collapsed to icon rail        | Ultra-minimal: 16 px icons, no labels, no borders, hover fill only                                                                                                                 |

**Specific observations for Moshtty implementation:**

**Sidebar:**

- `~245 px` wide, `background: ~#f8f8f8` (barely off-white), single `1px` right border `#e5e7eb`.
- Flat row items, `height: 32 px`, `border-radius: 4–6 px` on hover/active, `padding: 0 8px`.
- Active item: `background: #ebebeb`. No colored left border accent.
- Section headers (`Projects`, `Conversations`): `font-size: 11px`, `font-weight: 600`,
  `text-transform: uppercase`, `letter-spacing: 0.05em`, `color: #9ca3af`.
- Icons: `16 px` SVG outlines, `color: #6b7280`.

**Top bar:**

- Height ~36–40 px. Breadcrumb in center: `font-size: 13 px`, `color: #374151`.
- No tab pills visible in Antigravity, but the overall bar is completely flat,
  `background: white`, single `1px` bottom border `#e5e7eb`.
- Moshtty's tab strip sits inside this same flat bar — match this tone.

**Settings modal (`antigravity-settings.png`):**

- Left nav: `width: ~180 px`, flat text buttons, `font-size: 13 px`. Section label
  ("General", "Projects") in `font-size: 11 px`, `color: #9ca3af`, `uppercase`.
  Active item: gray fill pill, `background: #f3f4f6`, `border-radius: 4px`.
- Right panel: white, `padding: 24 px`. Section headings `font-size: 15 px`, `font-weight: 600`.
  Form rows are horizontal flex: label+description on left, control on right.
  Control (select/dropdown): `border: 1px solid #d1d5db`, `border-radius: 6px`,
  `background: white`, `height: 32px`, `font-size: 13 px`.
- Modal container: `border-radius: ~10px`, `box-shadow: 0 8px 32px rgba(0,0,0,0.12)`.
- Backdrop: `background: rgba(0,0,0,0.25)` — subtle darkening, no blur.

**Button discipline:**

- No solid indigo/blue filled buttons anywhere in the Antigravity UI.
- Primary actions use near-black text on white border, or a very muted fill.
- Status and semantic indicators ("now", file diff counts) use small pills with
  semantic colors (green for active, no blue).
- Apply this discipline to Moshtty's `.button.primary` and `.connection-status`.

**Color palette (light mode, Antigravity):**

- Canvas: `#f9fafb` / `#ffffff`
- Sidebar bg: `#f8f8f8`
- Active row: `#ebebeb` / `#f3f4f6`
- Border: `#e5e7eb`
- Text main: `#111827`
- Text muted: `#6b7280`
- Text subtle: `#9ca3af`

### D. Twitter reference image

URL: `https://pbs.twimg.com/media/HGfkgXYWgAALGAW?format=jpg&name=4096x4096`

Fetch via `agent-browser open <url>` + screenshot to see full res. Reinforces the
same principles: flat chrome, zero decorative color, terminals edge-to-edge.

---

---

## Stop Condition Note — `state.ts` ownership

Adding `terminalColorScheme` to `MoshttySettings` touches
`apps/desktop/src/common/state*` and `apps/desktop/src/common/*.schema.ts`, which
are **owned by brief 2 (`2026-05-25-2-desktop-state-shell.md`)** and are a Stop
Condition under `AGENTS.md`.

**Approved workaround:** store `terminalColorScheme` in `localStorage` from the
renderer only. Do NOT modify `MoshttySettings`, `state.ts`, or `state.schema.ts`.
Use a thin React hook `useTerminalColorScheme()` in a new
`apps/desktop/src/renderer/src/design/terminalThemes.ts` module. This sidesteps the
ownership boundary while delivering the picker. The setting will not persist across
profiles — that is an acceptable limitation for this slice. Document this in the
handoff.

If the coordinator later decides the setting should be persisted via state, that will
be a separate brief targeting brief-2-owned paths.

---

## Owned Paths

This brief works inside the M8 ownership row (see `OWNERS.md`):

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

## Detailed Changes

### 1. Remove BETA badge

**File:** `apps/desktop/src/renderer/src/components/TopBar.tsx`

Delete the line:

```tsx
<span className="brand-badge">BETA</span>
```

**File:** `apps/desktop/src/renderer/src/components/TopBar.css`

Delete the `.brand-badge` rule block entirely.

---

### 2. Restyle primary buttons

**File:** `apps/desktop/src/renderer/src/assets/main.css`

Replace `.button.primary` with a near-neutral high-contrast style that avoids the
blue/Bootstrap look:

```css
/* BEFORE */
.button.primary {
  color: var(--color-accent-on);
  background: var(--color-accent);
  border-color: var(--color-accent);
}

/* AFTER — neutral solid, not accent-colored */
.button.primary {
  color: var(
    --color-workspace-bg
  ); /* white in dark mode, near-black in light */
  background: var(
    --color-text-main
  ); /* near-black in dark, near-white in light */
  border-color: var(--color-text-main);
}

.button.primary:hover {
  opacity: 0.88;
  background: var(--color-text-main);
  border-color: var(--color-text-main);
}
```

Keep `.button.secondary` and `.button.subtle` as-is. Danger-action buttons (if any)
may keep `--color-danger`.

---

### 3. Remove pane borders and edge-to-edge layout

**File:** `apps/desktop/src/renderer/src/assets/main.css`

**a. terminal-workspace — remove padding:**

```css
/* BEFORE */
.terminal-workspace {
  display: flex;
  min-height: 0;
  flex: 1;
  padding: var(--space-md);
  background: var(--color-terminal-bg);
}

/* AFTER */
.terminal-workspace {
  display: flex;
  min-height: 0;
  flex: 1;
  padding: 0;
  background: var(--color-terminal-bg);
}
```

**b. terminal-pane — remove border and radius, keep flex:**

```css
/* BEFORE */
.terminal-pane,
.empty-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-terminal-bg);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
}

.terminal-pane.active {
  border-color: var(--color-focus);
}

.terminal-pane.lost {
  border-color: var(--color-danger);
}

/* AFTER */
.terminal-pane,
.empty-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-terminal-bg);
}

/* No .terminal-pane.active border-color override — active state is shown
   only via the pane-header background tint below */

.terminal-pane.lost .pane-header {
  border-bottom-color: var(--color-danger);
  color: var(--color-danger);
}
```

**c. split-handle — hairline, no radius:**

```css
/* BEFORE */
.split-handle {
  flex: 0 0 var(--space-xs);
  background: var(--color-border-strong);
  border-radius: var(--radius-pill);
}

/* AFTER */
.split-handle {
  flex: 0 0 1px;
  background: var(--color-border);
}

.split-handle:hover {
  background: var(--color-border-strong);
  cursor: col-resize;
}
```

**d. pane-header — subtle active tint instead of border:**
In `main.css`, add:

```css
.terminal-pane.active .pane-header {
  background: var(--color-sidebar-bg-active);
}
```

---

### 4. Terminal color themes

**File (new):** `apps/desktop/src/renderer/src/design/terminalThemes.ts`

```typescript
/**
 * Built-in terminal color presets.
 * Keys match the picker values stored in localStorage under
 * 'moshtty:terminalColorScheme'. The 'auto' key is resolved
 * by the caller based on the current resolved app theme.
 */
export type TerminalColorSchemeKey =
  | "auto"
  | "default-dark"
  | "default-light"
  | "dracula"
  | "catppuccin-mocha"
  | "solarized-dark"
  | "solarized-light";

export interface TerminalColorScheme {
  label: string;
  dark: boolean;
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  /** ANSI colors: [black, red, green, yellow, blue, magenta, cyan, white,
   *               bright-black, bright-red, bright-green, bright-yellow,
   *               bright-blue, bright-magenta, bright-cyan, bright-white] */
  ansi: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
}

export const TERMINAL_COLOR_SCHEMES: Record<
  Exclude<TerminalColorSchemeKey, "auto">,
  TerminalColorScheme
> = {
  "default-dark": {
    label: "Default Dark",
    dark: true,
    background: "#121214",
    foreground: "#e2e2e8",
    cursor: "#a5b4fc",
    selectionBackground: "#2a2a30",
    ansi: [
      "#1e1e24",
      "#f87171",
      "#34d399",
      "#fbbf24",
      "#818cf8",
      "#c084fc",
      "#22d3ee",
      "#e4e4e7",
      "#3f3f46",
      "#fca5a5",
      "#6ee7b7",
      "#fde68a",
      "#a5b4fc",
      "#d8b4fe",
      "#67e8f9",
      "#f4f4f5",
    ],
  },
  "default-light": {
    label: "Default Light",
    dark: false,
    background: "#ffffff",
    foreground: "#1a1a2e",
    cursor: "#4f46e5",
    selectionBackground: "#e0e7ff",
    ansi: [
      "#1e1e2e",
      "#b91c1c",
      "#065f46",
      "#92400e",
      "#3730a3",
      "#7e22ce",
      "#0e7490",
      "#1f2937",
      "#6b7280",
      "#ef4444",
      "#10b981",
      "#f59e0b",
      "#6366f1",
      "#a855f7",
      "#06b6d4",
      "#374151",
    ],
  },
  dracula: {
    label: "Dracula",
    dark: true,
    background: "#282a36",
    foreground: "#f8f8f2",
    cursor: "#f8f8f2",
    selectionBackground: "#44475a",
    ansi: [
      "#21222c",
      "#ff5555",
      "#50fa7b",
      "#f1fa8c",
      "#bd93f9",
      "#ff79c6",
      "#8be9fd",
      "#f8f8f2",
      "#6272a4",
      "#ff6e6e",
      "#69ff94",
      "#ffffa5",
      "#d6acff",
      "#ff92df",
      "#a4ffff",
      "#ffffff",
    ],
  },
  "catppuccin-mocha": {
    label: "Catppuccin Mocha",
    dark: true,
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    cursor: "#f5e0dc",
    selectionBackground: "#363a4f",
    ansi: [
      "#45475a",
      "#f38ba8",
      "#a6e3a1",
      "#f9e2af",
      "#89b4fa",
      "#f5c2e7",
      "#94e2d5",
      "#bac2de",
      "#585b70",
      "#f38ba8",
      "#a6e3a1",
      "#f9e2af",
      "#89b4fa",
      "#f5c2e7",
      "#94e2d5",
      "#a6adc8",
    ],
  },
  "solarized-dark": {
    label: "Solarized Dark",
    dark: true,
    background: "#002b36",
    foreground: "#839496",
    cursor: "#839496",
    selectionBackground: "#073642",
    ansi: [
      "#073642",
      "#dc322f",
      "#859900",
      "#b58900",
      "#268bd2",
      "#d33682",
      "#2aa198",
      "#eee8d5",
      "#002b36",
      "#cb4b16",
      "#586e75",
      "#657b83",
      "#839496",
      "#6c71c4",
      "#93a1a1",
      "#fdf6e3",
    ],
  },
  "solarized-light": {
    label: "Solarized Light",
    dark: false,
    background: "#fdf6e3",
    foreground: "#657b83",
    cursor: "#586e75",
    selectionBackground: "#eee8d5",
    ansi: [
      "#073642",
      "#dc322f",
      "#859900",
      "#b58900",
      "#268bd2",
      "#d33682",
      "#2aa198",
      "#eee8d5",
      "#002b36",
      "#cb4b16",
      "#586e75",
      "#657b83",
      "#839496",
      "#6c71c4",
      "#93a1a1",
      "#fdf6e3",
    ],
  },
};

export function resolveTerminalColorScheme(
  key: TerminalColorSchemeKey,
  appThemeDark: boolean,
): TerminalColorScheme {
  if (key === "auto") {
    return appThemeDark
      ? TERMINAL_COLOR_SCHEMES["default-dark"]
      : TERMINAL_COLOR_SCHEMES["default-light"];
  }
  return TERMINAL_COLOR_SCHEMES[key];
}

const STORAGE_KEY = "moshtty:terminalColorScheme";

export function loadTerminalColorSchemeKey(): TerminalColorSchemeKey {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (
      raw === "default-dark" ||
      raw === "default-light" ||
      raw === "dracula" ||
      raw === "catppuccin-mocha" ||
      raw === "solarized-dark" ||
      raw === "solarized-light"
    ) {
      return raw;
    }
  } catch {
    // localStorage unavailable
  }
  return "auto";
}

export function saveTerminalColorSchemeKey(key: TerminalColorSchemeKey): void {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // ignore
  }
}
```

---

### 5. Wire terminal themes into TerminalPane

**File:** `apps/desktop/src/renderer/src/components/TerminalPane.tsx`

Replace the hardcoded `theme` block with a resolved scheme from the new module.

New imports at top:

```typescript
import {
  resolveTerminalColorScheme,
  loadTerminalColorSchemeKey,
} from "../design/terminalThemes";
```

Replace the existing `const theme = terminalMode === 'dark' ? { … } : { … }` block inside
`bootstrap()` with:

```typescript
const schemeKey = loadTerminalColorSchemeKey();
const scheme = resolveTerminalColorScheme(schemeKey, terminalMode === "dark");
const theme = {
  background: scheme.background,
  foreground: scheme.foreground,
  cursor: scheme.cursor,
  selectionBackground: scheme.selectionBackground,
  // ghostty-web ITerminalOptions.theme uses black/red/… keys:
  black: scheme.ansi[0],
  red: scheme.ansi[1],
  green: scheme.ansi[2],
  yellow: scheme.ansi[3],
  blue: scheme.ansi[4],
  magenta: scheme.ansi[5],
  cyan: scheme.ansi[6],
  white: scheme.ansi[7],
  brightBlack: scheme.ansi[8],
  brightRed: scheme.ansi[9],
  brightGreen: scheme.ansi[10],
  brightYellow: scheme.ansi[11],
  brightBlue: scheme.ansi[12],
  brightMagenta: scheme.ansi[13],
  brightCyan: scheme.ansi[14],
  brightWhite: scheme.ansi[15],
};
```

**Important:** check the actual `ITerminalOptions` type from `ghostty-web` before
implementing — the theme key names may differ. Use `grep -r "ITerminalOptions"
apps/desktop/` to find the type definition, then align the theme object keys accordingly.
If the theme object only supports `background/foreground/cursor/selectionBackground` (no
ANSI array), drop the ANSI keys and note this in the handoff.

---

### 6. Terminal theme picker in Settings

**File:** `apps/desktop/src/renderer/src/components/Dialogs.tsx`

Add imports:

```typescript
import {
  TERMINAL_COLOR_SCHEMES,
  loadTerminalColorSchemeKey,
  saveTerminalColorSchemeKey,
  type TerminalColorSchemeKey,
} from "../design/terminalThemes";
```

Inside `SettingsDialog`, add state:

```typescript
const [colorScheme, setColorScheme] = useState<TerminalColorSchemeKey>(
  loadTerminalColorSchemeKey,
);
```

Replace the inert "Terminal palette" `settings-row` with an active picker row:

```tsx
<div className="settings-row">
  <div>
    <strong>Terminal theme</strong>
    <span>Color scheme for terminal panes</span>
  </div>
  <select
    className="settings-select"
    value={colorScheme}
    aria-label="Terminal color scheme"
    onChange={(e): void => {
      const key = e.target.value as TerminalColorSchemeKey;
      setColorScheme(key);
      saveTerminalColorSchemeKey(key);
    }}
  >
    <option value="auto">Auto (follows app theme)</option>
    {Object.entries(TERMINAL_COLOR_SCHEMES).map(([key, scheme]) => (
      <option key={key} value={key}>
        {scheme.label}
      </option>
    ))}
  </select>
</div>
```

Add `.settings-select` to `Dialogs.css` (styled to match token contract — no raw px):

```css
.settings-select {
  font-family: var(--font-family-ui);
  font-size: var(--font-size-body);
  color: var(--color-text-main);
  background: var(--color-workspace-bg);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  padding: 0 var(--space-sm);
  height: var(--density-control-height);
  cursor: pointer;
  appearance: auto; /* keep native arrow; avoids custom SVG for now */
}
```

**Note:** changing the picker updates `localStorage` immediately but does NOT hot-reload
running terminals (ghostty-web terminal instances are not recreated on picker change; the
new theme applies on next pane open). This is acceptable for now. Document in handoff.

---

### 7. Tab bar restyle

**File:** `apps/desktop/src/renderer/src/components/TopBar.css`

The goal is flat, underline-indicator tabs as seen in OpenCode / VS Code / linear apps.

```css
/* Remove existing .tab-strip-wrapper, .tab-wrapper, .tab-btn, .tab-title,
   .tab-close, .new-tab-btn rules and replace with: */

.tab-strip-wrapper {
  display: flex;
  align-items: stretch;
  flex: 1;
  max-width: 600px;
  margin: 0 var(--space-lg);
  -webkit-app-region: no-drag;
  height: 100%; /* fill top-bar height */
}

.tab-strip {
  display: flex;
  align-items: stretch;
  gap: 0;
  height: 100%;
  flex: 1;
}

.tab-wrapper {
  display: flex;
  align-items: stretch;
  position: relative;
  padding: 0;
  min-width: 80px;
  max-width: 160px;
  border-radius: 0;
  background: transparent;
}

/* Active tab underline indicator */
.tab-wrapper.active::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: var(--space-sm);
  right: var(--space-sm);
  height: 2px;
  background: var(--color-text-main);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  background: transparent;
  border: none;
  padding: 0 var(--space-sm);
  text-align: left;
  cursor: pointer;
  min-width: 0;
  outline: none;
}

.tab-title {
  font-family: var(--font-family-ui);
  font-size: var(--font-size-small);
  font-weight: 500;
  color: var(--color-text-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color var(--duration-fast) var(--easing-standard);
}

.tab-wrapper.active .tab-title {
  color: var(--color-text-main);
  font-weight: 600;
}

.tab-wrapper:hover .tab-title {
  color: var(--color-text-muted);
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  color: var(--color-text-subtle);
  cursor: pointer;
  opacity: 0;
  flex-shrink: 0;
  margin-right: var(--space-xs);
  transition:
    opacity var(--duration-fast) var(--easing-standard),
    background-color var(--duration-fast) var(--easing-standard),
    color var(--duration-fast) var(--easing-standard);
}

.tab-wrapper:hover .tab-close,
.tab-wrapper.active .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background-color: var(--color-sidebar-bg-active);
  color: var(--color-text-main);
}

.new-tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--density-icon-button-size);
  height: var(--density-icon-button-size);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  align-self: center;
  transition:
    background-color var(--duration-fast) var(--easing-standard),
    color var(--duration-fast) var(--easing-standard);
}

.new-tab-btn:hover {
  background-color: var(--color-sidebar-bg-active);
  color: var(--color-text-main);
}
```

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
go test ./...
go vet ./...
git diff --check
```

After `test:visual:update`, run `test:visual` once more to confirm baselines pass:

```bash
pnpm --filter @moshtty/desktop test:visual
```

### Visual QA with agent-browser (required)

After all code changes, start the app (`pnpm --filter @moshtty/desktop dev`) and run
an `agent-browser` exploratory QA session against the live Electron window.
Read `.agents/skills/agent-browser/SKILL.md` and `.agents/skills/electron/SKILL.md`
before starting the session.

Required screenshots to capture and attach to the handoff:

| State                                          | File path                                     |
| ---------------------------------------------- | --------------------------------------------- |
| Top bar — no project open                      | `docs/visual-qa/8b/topbar-no-project.png`     |
| Top bar — with 2 tabs (one active)             | `docs/visual-qa/8b/topbar-two-tabs.png`       |
| Terminal workspace — single pane, dark mode    | `docs/visual-qa/8b/pane-single-dark.png`      |
| Terminal workspace — split pane (2), dark mode | `docs/visual-qa/8b/pane-split-dark.png`       |
| Terminal workspace — single pane, light mode   | `docs/visual-qa/8b/pane-single-light.png`     |
| Settings dialog — terminal theme picker        | `docs/visual-qa/8b/settings-theme-picker.png` |
| Settings dialog — Dracula selected             | `docs/visual-qa/8b/settings-dracula.png`      |

For each screenshot, compare against the reference image
(`https://pbs.twimg.com/media/HGfkgXYWgAALGAW?format=jpg&name=4096x4096`)
and note in the handoff whether the visual target is met or what gap remains.

Also run axe-core accessibility checks via `agent-browser` on the settings dialog
and the top bar. Log any violations in the handoff.

### Manual spot-checks checklist

- Confirm: no BETA badge in top bar
- Confirm: primary buttons (Save, Import) are near-black/white, not blue/indigo
- Confirm: terminal pane has no visible rounded border; fills workspace to edges
- Confirm: pane split handle is a thin 1 px line
- Confirm: tab bar shows underline indicator for active tab, no card border
- Confirm: Settings > Terminal theme shows a `<select>` with 6 + Auto options
- Change theme to Dracula → close settings → open new pane → verify background color change
- Switch app to light mode → with `auto` theme, verify terminal uses white background

---

## PRD Close-out (required before commit)

Update `docs/moshtty-prd.md`:

- Add a new entry in Task Status: `Moshtty UI Polish (8b)` | this agent | `Ready for review`
- Add a verification note covering what was tested and the results
- Do not change M8's existing `Done` status — this is a follow-up task, not a reopen

---

## Slice Budget Sanity Check

Expected changed files (soft cap 8):

1. `apps/desktop/src/renderer/src/components/TopBar.tsx` — remove BETA
2. `apps/desktop/src/renderer/src/components/TopBar.css` — remove brand-badge, restyle tabs
3. `apps/desktop/src/renderer/src/assets/main.css` — button primary, pane borders, terminal-workspace
4. `apps/desktop/src/renderer/src/design/terminalThemes.ts` — [NEW] theme presets + localStorage
5. `apps/desktop/src/renderer/src/components/TerminalPane.tsx` — wire new theme module
6. `apps/desktop/src/renderer/src/components/Dialogs.tsx` — add theme picker
7. `apps/desktop/src/renderer/src/components/Dialogs.css` — add .settings-select rule
8. `docs/moshtty-prd.md` — close-out entry
9. `apps/desktop/tests/visual/**` — baseline snapshot updates (generated)

That is 8 source files + generated snapshots. You are at the soft cap. If any item expands
significantly (e.g. ghostty-web theme API requires additional wiring), stop and surface
before adding scope.

---

## Commit Shape

One atomic commit with type `feat(ui):`:

```
feat(ui): remove BETA badge, restyle tabs/panes/buttons, add terminal theme picker
```

Body should list the 8 source changes. Do not commit until `pnpm verify:full` and
`test:visual` both pass.
