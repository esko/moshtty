# M8d — Moshtty UI corrections (post-M8c live-audit fixes)

Status: In progress (coordinator: Opus).
Parent milestone: M8d UI Corrections.

## Why

The M8c slices (8c.1–8c.7) landed on the diff level but the live audit against the OpenCode reference (see `docs/visual-qa/8b/live-audit/m8c/`) revealed real spec drift:

- Tab project chips are 10×10 and illegible; the OpenCode equivalent is a small status indicator, not a project chip.
- The terminal canvas does not fill the pane — the Ghostty canvas reports 1080×608 inside a 1036×752 container, leaving a ~144 px dead band at the bottom and a ~44 px horizontal overflow. 8c.2's CSS-only fix was overridden by Ghostty's inline canvas styles. Master branch (`web/src/main.ts`) shows the working pattern: `FitAddon` + `fit()` + `observeResize()`.
- The overflow icon in the top bar is `⋯`; the user wants a hamburger `≡` (the panel-left icon stays at the far left as the sidebar toggle).
- Pane info pill shows redundant "Shell" title and "Active / Pane lost" text; should be a single colored status roundel.
- Pane chrome pills are opaque cards; should be glassmorphism (translucent + backdrop blur) so the terminal is visually continuous.
- Sidebar edit/trash icons are too small and float to the right of the project chip; should grow and visually enclose the project row's hover pill.
- The sidebar header carries "Bootstrap remote" and "Import remote" icon buttons; both belong inside the project dialog as preferences-style sections, not in the rail.
- The project dialog is a thin name/color form; should feel like a preferences view with sections for project basics, remote server bootstrap (with status indicator + Install/Update button), and import-from-profile.

## Goal summary

Land five small slices that bring M8c up to OpenCode parity for the live shell view, with a live agent-browser audit at the end before declaring M8c+M8d done.

## Stop-conditions

Same as M8c. In particular:

- Anything outside the sub-slice's owned paths is a stop condition.
- New tokens require coordinator action (8d.0). Subagents must not invent tokens.
- `apps/desktop/src/common/*.schema.ts` is the trust boundary; do not touch from these slices.

## Slice map

| Slice                              | Owner              | Parallel-safe with                                                     | Files                                                                             |
| ---------------------------------- | ------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 8d.0 glass tokens                  | Coordinator (Opus) | — (lands first)                                                        | `design/tokens.{ts,css}`, `docs/moshtty-design-system.md`                         |
| 8d.1 top bar                       | Composer 2.5 fast  | 8d.2, 8d.3 (after 8d.0)                                                | `components/TopBar.{tsx,css}`                                                     |
| 8d.2 terminal pane                 | Composer 2.5 fast  | 8d.1, 8d.3 (after 8d.0)                                                | `components/TerminalPane.tsx`, `assets/main.css` (pane block only)                |
| 8d.3 sidebar                       | Composer 2.5 fast  | 8d.1, 8d.2 (after 8d.0)                                                | `components/Sidebar.{tsx,css}`                                                    |
| 8d.4 project dialog as preferences | Composer 2.5 fast  | NOT parallel with 8d.3 (sidebar may invoke openDialog with a new mode) | `components/Dialogs.{tsx,css}`, `dialogs.ts`                                      |
| 8d.5 live visual QA                | Coordinator        | After 8d.1–8d.4 land                                                   | `docs/visual-qa/8b/live-audit/m8d/` (screenshots + notes); fix-myself on any miss |

---

## 8d.0 — Glass tokens (coordinator)

Add to `tokens.css` and `tokens.ts`:

- Light theme:
  - `--color-glass-bg: rgba(255, 255, 255, 0.72)`
  - `--color-glass-border: rgba(0, 0, 0, 0.08)`
- Dark theme (both `[data-theme='dark']` and the `prefers-color-scheme: dark` system block):
  - `--color-glass-bg: rgba(24, 24, 28, 0.62)`
  - `--color-glass-border: rgba(255, 255, 255, 0.08)`

Extend `ColorScale` with `glassBg` and `glassBorder`; update `lightColors` / `darkColors` accordingly. Document the new tokens in `docs/moshtty-design-system.md` (token table + rationale: "Used by floating pane chrome pills (8d.2) so the terminal canvas reads through them; `prefers-reduced-transparency` must fall back to `--color-workspace-bg`.").

Commit: `chore(tokens): add glass-surface tokens for pane chrome pills`.

---

## 8d.1 — Top bar: hamburger + tab status roundel

Files: `apps/desktop/src/renderer/src/components/TopBar.tsx`, `apps/desktop/src/renderer/src/components/TopBar.css`.

### What changes

1. **Overflow icon → hamburger.** Replace `MoreIcon` import and usage with `HamburgerIcon` (both already exported from `design/icons`). Keep `.overflow-menu-btn` class, button label `aria-label="Open menu"`, and the stubbed `onClick` with the existing `TODO(M8c follow-up): wire contextual menu` comment.
2. **Drop the tab project chip.** Remove `<span className="tab-chip">…</span>` from each `.tab-wrapper`. Remove the `.tab-chip` CSS rule.
3. **Add a tab status roundel.** Render `<span className="tab-status-dot" data-status={statusFor(tab)} aria-hidden="true" />` immediately before the `.tab-btn` (where the chip used to be). Helper:

```tsx
function statusFor(tab: MoshttyTab, state: AppState | null): 'connected' | 'connecting' | 'lost' {
  const paneIds = tab.paneIds ?? []
  let worst: 'connected' | 'connecting' | 'lost' = 'connected'
  for (const id of paneIds) {
    const pane = state?.panes?.[id] ?? state?.projects.flatMap(p => p.tabs ?? []).find(...)
    // Use whatever pane lookup exists in this file. Worst-wins:
    //   lost > connecting > connected
  }
  return worst
}
```

If the pane lookup is not directly available from the top-level `state` passed to TopBar, use `useAppStore` to read panes by id. Keep the helper exported only if you also test it; otherwise keep it module-private.

4. **CSS for the dot:**

```css
.tab-status-dot {
  flex-shrink: 0;
  width: var(--space-sm);
  height: var(--space-sm);
  border-radius: var(--radius-pill);
  background: var(--color-success);
}
.tab-status-dot[data-status="connecting"] {
  background: var(--color-warning);
}
.tab-status-dot[data-status="lost"] {
  background: var(--color-danger);
}
```

5. **Keep the hairline divider** (`.tab-wrapper:not(.active, :last-child)::after`) untouched. User confirmed it stays.

6. **`+` button** stays immediately after the last `.tab-wrapper` inside `.tab-strip-wrapper`. No change.

7. **Anti-scope:** do not touch the connection-status pills on the right side of the top bar (they are correct after 8c.1).

### Verification

- `pnpm --filter @moshtty/desktop typecheck`
- `pnpm --filter @moshtty/desktop lint`
- `npx stylelint apps/desktop/src/renderer/src/components/TopBar.css` (workspace `lint:css` will still trip on pre-existing `CommandPalette.css`; not in scope)
- `pnpm --filter @moshtty/desktop test` — add a focused test that asserts `data-status` reflects the worst pane state across a tab's panes (mock store state).

### Commit shape

```
feat(top-bar): swap overflow icon for hamburger and replace tab chip with status roundel

8d.1 (M8d corrections).

Per the 2026-05-27 live audit:
- Overflow icon next to the sidebar toggle becomes a hamburger (panel-left + hamburger ordering).
- Tab project chip removed; replaced by a small status roundel that reflects the worst pane state in that tab (lost > connecting > connected) using the functional colors.
- Hairline divider between inactive tabs stays per user direction.

Brief: docs/agents/2026-05-27-8d-moshtty-ui-corrections.md (sub-slice 8d.1).
```

---

## 8d.2 — Terminal pane: FitAddon + glass pills + status roundel

Files: `apps/desktop/src/renderer/src/components/TerminalPane.tsx`, `apps/desktop/src/renderer/src/assets/main.css` (pane block only — same scope as 8c.2).

### What changes

1. **Wire `FitAddon`** (the canonical fix from `master:web/src/main.ts`):

```ts
import { Terminal, FitAddon, type ITerminalOptions } from "ghostty-web";
// ...
const term = new Terminal(options);
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
// ...
if (containerRef.current) {
  term.open(containerRef.current);
  fitAddon.fit();
  fitAddon.observeResize();
  setReady(true);
}
// On unmount cleanup: term.dispose() already disposes loaded addons; explicit fitAddon.dispose() is fine if you want belt-and-suspenders. Do NOT manage another ResizeObserver yourself.
```

This replaces the CSS-only width/height attempt from 8c.2. The CSS `.terminal-container > * { width: 100%; height: 100% }` rule can stay as defense-in-depth but it is not the primary fix. Ghostty's inline `style="width: NNpx; height: NNpx"` will now follow the container size because `FitAddon.observeResize()` computes new cols/rows from `clientWidth/Height` and calls `term.resize(...)` which rewrites the canvas dimensions.

2. **Info pill: drop title + status text → status roundel.** Currently:

```tsx
<div className={`pane-pill pane-pill-info ${lost ? "lost" : ""}`}>
  <span className="pane-pill-title">{title}</span>
  <span className={`pane-pill-status ${lost ? "lost" : ""}`}>
    {lost ? "Pane lost" : "Active"}
  </span>
</div>
```

becomes:

```tsx
<div className="pane-pill pane-pill-info">
  <span
    className="pane-status-dot"
    data-status={lost ? "lost" : ready ? "connected" : "connecting"}
    aria-label={lost ? "Pane lost" : ready ? "Pane active" : "Pane connecting"}
    role="img"
  />
</div>
```

Keep the wrapper for layout, but a single dot inside. The aria-label provides the textual status for screen readers.

3. **Glassmorphism pills.** Replace the pane-pill background/border with the new glass tokens:

```css
.pane-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-2xs) var(--space-sm);
  background: var(--color-glass-bg);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  border: 1px solid var(--color-glass-border);
  border-radius: var(--radius-pill);
  color: var(--color-text-main);
  font-family: var(--font-family-ui);
  font-size: var(--font-size-caption);
  box-shadow: var(--elevation-popover);
  pointer-events: auto;
}

@media (prefers-reduced-transparency) {
  .pane-pill {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: var(--color-workspace-bg);
  }
}
```

4. **Status dot CSS** (in the pane block of `main.css`):

```css
.pane-status-dot {
  display: inline-block;
  flex-shrink: 0;
  width: var(--space-sm);
  height: var(--space-sm);
  border-radius: var(--radius-pill);
  background: var(--color-success);
}
.pane-status-dot[data-status="connecting"] {
  background: var(--color-warning);
}
.pane-status-dot[data-status="lost"] {
  background: var(--color-danger);
}
```

5. **Info pill width.** Without text, the info pill is just a dot in a pill. Give it a fixed compact width so it doesn't degenerate to nothing: `min-width: var(--space-xl); justify-content: center;` (or similar — keep ~24px wide so it's visually a pill, not a circle).

6. **Keep hover/focus gating** (`.terminal-pane:hover .pane-chrome` etc.). Keep the active pane left border. Do not touch `.terminal-container` rule changes from 8c.2 — the FitAddon does the real work now.

7. **Anti-scope:**
   - Do not touch `.terminal-workspace`, `.split-layout`, `.split-handle`, or non-pane rules in `main.css`.
   - Do not change the Mosh/transport bootstrap logic in `TerminalPane.tsx` beyond the addon wiring.

### Verification

- `pnpm --filter @moshtty/desktop typecheck`
- `pnpm --filter @moshtty/desktop test`
- `npx stylelint apps/desktop/src/renderer/src/assets/main.css`
- Smoke test that the pane region renders without errors when the terminal can't connect (Offline state in current dev env).

### Commit shape

```
feat(pane): fit the terminal to its container and turn pills into glass surfaces

8d.2 (M8d corrections).

Per the 2026-05-27 live audit and master:web/src/main.ts:
- Wire FitAddon via term.loadAddon, then fit() and observeResize() after term.open().
  Fixes Ghostty canvas underfilling the pane (was 1080x608 in a 1036x752 container)
  and the horizontal overflow.
- Replace the info pill title + status text with a single colored status roundel
  (connected/connecting/lost using the functional color tokens).
- Pane chrome pills become glassmorphism: translucent fill via --color-glass-bg,
  backdrop-filter blur, 1px --color-glass-border, with a prefers-reduced-transparency
  fallback to --color-workspace-bg.

Brief: docs/agents/2026-05-27-8d-moshtty-ui-corrections.md (sub-slice 8d.2).
```

---

## 8d.3 — Sidebar: bigger row icons, no bootstrap/import in header

Files: `apps/desktop/src/renderer/src/components/Sidebar.tsx`, `apps/desktop/src/renderer/src/components/Sidebar.css`.

### What changes

1. **Remove sidebar-header buttons.** The two icon buttons in the sidebar header for "Bootstrap remote" and "Import remote" are gone in this slice. Keep `+ New project`. The bootstrap and import flows move to the project dialog in 8d.4.
2. **Bigger project-row action icons.** The edit (pencil) and delete (trash) icon buttons on each project row should grow:
   - Hit area: `var(--density-icon-button-size)` (28 px) — same as the top-bar icon buttons.
   - Glyph size: 16 px.
   - Visible on hover/focus only (keep the current opacity/transition behavior if present).
3. **Enclose the hover pill.** The project row's hover background already wraps the chip + name. The action icons must sit _inside_ the same rounded-pill hover surface (right-aligned), so the visual reading is one pill with `[chip] [name] [edit] [delete]` rather than two surfaces (pill + floating icons).
   - Practically: keep the icons inside `.project-row` (or whatever the row container is named), align them to the right with `margin-left: auto`, and ensure the row's `padding-right` is enough that the icons sit comfortably inside the hover surface rather than touching the right edge of the rail.
4. **Project chip stays its current size** (no change in this slice).
5. **Anti-scope:**
   - Do not touch `.sidebar-title` or `.sidebar-header` text styling (8c.4 owns).
   - Do not modify the rename inline branch (8c.7 already removed it).
   - Do not modify the dashboard / search row.

### Verification

- `pnpm --filter @moshtty/desktop typecheck`
- `pnpm --filter @moshtty/desktop test` — adjust any sidebar tests that assert the presence of the removed header buttons.
- `npx stylelint apps/desktop/src/renderer/src/components/Sidebar.css`

### Commit shape

```
refactor(sidebar): drop header bootstrap/import buttons and grow project-row actions

8d.3 (M8d corrections).

Per the 2026-05-27 live audit and user direction:
- Remove the Bootstrap remote and Import remote icon buttons from the sidebar header.
  Both flows move to the project dialog (8d.4 follow-up). Keep + New project.
- Project-row edit and delete buttons grow to the standard icon-button hit area (28px)
  with a 16px glyph, positioned inside the project row's hover pill so the row reads
  as one rounded surface rather than chip + floating icons.

Brief: docs/agents/2026-05-27-8d-moshtty-ui-corrections.md (sub-slice 8d.3).
```

---

## 8d.4 — Project dialog as preferences view (with bootstrap status + import link)

Files:

- `apps/desktop/src/renderer/src/components/Dialogs.tsx` — only `ProjectDialog`-related JSX and `Dialogs`'s switch branch for `kind: 'project'`. Do not touch other dialog components in this slice.
- `apps/desktop/src/renderer/src/components/Dialogs.css` — new selectors for the preferences sections; do not change the settings dialog rules.
- `apps/desktop/src/renderer/src/dialogs.ts` — extend `AppDialog` if needed (no extra discriminant should be required; 8c.7 already added `mode: 'existing'`).

NOT parallel-safe with 8d.3 because both touch the same UX surface (the sidebar action that opens the project dialog).

### What changes

1. **Layout shift.** `ProjectDialog` becomes a single-column preferences-style card with vertical sections. Each section has a header (`<h3>`) and content rows similar to `SettingsDialog`'s `.settings-row` (label on the left, control on the right). Reuse `.settings-row` if possible; if it conflicts, introduce a `.project-form` namespace.

2. **Sections:**
   - **Project** — existing name + color controls.
   - **Remote server** — bootstrap status indicator + Install/Update button.
   - **Profile import** — link/button "Import from a profile" that opens `ImportDialog`.

3. **Remote server section content (M8d minimum):**

```tsx
<section className="project-section">
  <h3>Remote server</h3>
  <div className="project-row">
    <div>
      <strong>Bootstrap status</strong>
      <span>{remoteStatusLabel}</span>
    </div>
    <span className="project-status-pill" data-status={remoteStatus}>
      <span
        className="pane-status-dot"
        data-status={remoteStatus}
        aria-hidden="true"
      />
      {remoteStatusBadge}
    </span>
  </div>
  <div className="project-row">
    <div>
      <strong>Companion package</strong>
      <span>Installs moshtty-remote on the target via SSH.</span>
    </div>
    <button
      type="button"
      className="button primary"
      onClick={() => openDialog({ kind: "bootstrap" })}
    >
      {hasRemote ? "Update" : "Install"}
    </button>
  </div>
</section>
```

`remoteStatus` for M8d is derived from project state only — `'connected'` if a remote is configured AND the live `liveStatus` says it is reachable, `'connecting'` while attempting, `'lost'` otherwise. A real version probe is a follow-up slice; for now the indicator just says "Not configured / Configured / Connected" based on what the renderer already knows. Label copy is up to the implementer; keep it tight.

4. **Profile import row:**

```tsx
<div className="project-row">
  <div>
    <strong>Profile import</strong>
    <span>Paste a Moshtty profile to seed this project.</span>
  </div>
  <button
    type="button"
    className="button secondary"
    onClick={() => openDialog({ kind: "import", mode: "empty" })}
  >
    Import from profile
  </button>
</div>
```

5. **Dialog chrome.** Project dialog keeps its close `×` (already in top-right per existing layout). Header title is "New project" or "Edit project" based on `mode`.

6. **Backward-compat.** Existing `BootstrapDialog` and `ImportDialog` keep working. The sidebar header buttons that previously triggered them are gone in 8d.3; only the project dialog opens them now.

7. **Anti-scope:**
   - Do not delete `BootstrapDialog` or `ImportDialog`.
   - Do not change the project color picker behavior.
   - Do not change `SettingsDialog`.

### Verification

- `pnpm --filter @moshtty/desktop typecheck`
- `pnpm --filter @moshtty/desktop lint`
- `pnpm --filter @moshtty/desktop test` — adjust or add tests:
  - New mode shows all three sections, project basics has empty inputs.
  - Existing mode shows the project name prefilled.
  - Install/Update button calls `openDialog({ kind: 'bootstrap' })`.
  - Import button calls `openDialog({ kind: 'import', mode: 'empty' })`.
- `npx stylelint apps/desktop/src/renderer/src/components/Dialogs.css`

### Commit shape

```
feat(projects): reshape project dialog into a preferences-style view with bootstrap + import sections

8d.4 (M8d corrections).

Per the 2026-05-27 live audit and user direction:
- ProjectDialog gains vertical sections: Project basics, Remote server (status indicator
  + Install/Update button that opens the existing BootstrapDialog), and Profile import
  (button that opens the existing ImportDialog).
- Sidebar no longer carries bootstrap/import header buttons (handled in 8d.3); the
  project dialog is the only entry point for those flows.
- Status indicator uses the new functional-color status dot pattern.

Brief: docs/agents/2026-05-27-8d-moshtty-ui-corrections.md (sub-slice 8d.4).
```

---

## 8d.5 — Live visual QA (coordinator)

After 8d.1–8d.4 land:

1. Start (or reuse) the Electron dev server with `--remote-debugging-port`.
2. Use `agent-browser` to take screenshots of:
   - Initial shell with active and lost panes (hover and non-hover state of pane chrome).
   - Top bar with multiple tabs and varying pane statuses.
   - Sidebar with a project row hover.
   - Project dialog (new mode and edit mode).
3. Save under `docs/visual-qa/8b/live-audit/m8d/`.
4. Compare against `docs/visual-qa/8b/references/opencode-*` and write a short audit note (`docs/visual-qa/8b/live-audit/m8d/audit.md`).
5. If a subagent diff misses the mark on a specific point, fix-myself in a follow-up commit referencing the audit note.
6. Update `docs/moshtty-prd.md` and `docs/moshtty-milestones.md` to mark M8c and M8d Ready for review (or Done if visually clean).

## Anti-scope (whole milestone)

- No work on the card-style window chrome (margin + rounded card around content). Tracked as a deferred follow-up.
- No new tokens beyond 8d.0's two glass tokens.
- No xterm.js or alternative terminal renderer changes — the canvas fix is purely additive via `FitAddon`.
- No changes to remote-side Go code (`cmd/moshtty-remote`, `internal/`).
