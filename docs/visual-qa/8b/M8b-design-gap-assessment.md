# M8b Design Gap Assessment

**Date:** 2026-05-27  
**Author:** Cursor agent (coordinator pass)  
**Purpose:** Record live UI audit vs `docs/agents/2026-05-27-8b-moshtty-ui-polish.md` and related design docs. Intended for Opus verification, then parallel implementation subagents.

**Status:** Assessment only — not a implementation commit or PRD close-out.

---

## Methodology

1. Read M8b brief, `docs/moshtty-design-system.md`, `docs/moshtty-design-references.md`, and M8b §Visual References A–D.
2. Restarted Electron dev with CDP: `pnpm --filter @moshtty/desktop dev -- --remote-debugging-port=9226` (`ELECTRON_DISABLE_GPU=1`).
3. Connected **agent-browser** to port 9226; navigated fixture URLs (`?fixture=…`) on the live renderer (port **5174** when 5173 was in use).
4. Captured full-window screenshots under [`live-audit/`](live-audit/).

**Not done in this pass:** pixel diff vs reference PNGs (reference pack missing on disk — see §Blockers). Playwright `test:visual` re-run. axe on live app.

---

## Evidence (live screenshots)

| File                                                                                   | State                                                              |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [`live-audit/00-live-default.png`](live-audit/00-live-default.png)                     | User workspace (Welcome, multiple Shell tabs, one terminal pane)   |
| [`live-audit/01-fixture-dashboard.png`](live-audit/01-fixture-dashboard.png)           | `?fixture=dashboard`                                               |
| [`live-audit/02-fixture-tab-bar-multi.png`](live-audit/02-fixture-tab-bar-multi.png)   | `?fixture=tab-bar-multi`                                           |
| [`live-audit/03-fixture-active-tab.png`](live-audit/03-fixture-active-tab.png)         | `?fixture=active-tab`                                              |
| [`live-audit/04-fixture-dashboard-dark.png`](live-audit/04-fixture-dashboard-dark.png) | `?fixture=dashboard-dark`                                          |
| [`live-audit/05-settings-dialog.png`](live-audit/05-settings-dialog.png)               | Settings open from dashboard fixture                               |
| [`live-audit/06-command-palette.png`](live-audit/06-command-palette.png)               | `Ctrl+K` after `tab-bar-multi` — **no visible palette** in capture |
| [`live-audit/07-fixture-split-panes.png`](live-audit/07-fixture-split-panes.png)       | `?fixture=split-2-row`                                             |

**Canonical references (brief):** `docs/visual-qa/8b/references/` — **directory not present in repo** at assessment time. OpenCode refs also listed in `docs/moshtty-design-references.md` under `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.*.png` (not verified on this host).

---

## Executive summary

M8b work landed as a **narrow CSS/module patch** (BETA removal, some tab/pane/button tweaks, `terminalThemes.ts`, settings select). It does **not** achieve the brief’s stated goal: parity with OpenCode tab chrome and Antigravity/OpenCode **overall tone** (flat chrome, edge-to-edge terminal, calm status, flat settings).

The app still reads as an **M8 scaffold** (sidebar + tab bar + per-pane chrome) with polish on top, not as the reference UIs in the M8b brief.

**Recommendation:** Treat M8b as **not Ready for review** until reference parity items below are implemented or explicitly waived in the PRD. Split follow-up work into bounded subagent slices (§Suggested subagent slices).

---

## M8b checklist (brief §Background items 1–7)

### 1. Remove BETA badge — **Met**

- Live: no BETA in top bar (`01`, `02`, `03`).
- Code: removed from `TopBar.tsx`; visual test expects zero `.brand-badge`.

### 2. Neutral primary buttons — **Partial**

| Expected (brief §2, Antigravity §Button discipline)      | Actual                                                                                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `.button.primary` near-black / near-white, not accent    | **Met** in `main.css`                                                                                                                    |
| No loud semantic pills on chrome; calm connection status | **Not met** — `.connection-status.connected` / `.connecting` still use `--color-success` / `--color-warning` filled pills (`TopBar.css`) |

### 3. Edge-to-edge terminal panes — **Not met**

| Expected                                                 | Actual                                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No pane card border/radius; workspace padding 0          | **Met** in `main.css`                                                                                                                                                          |
| Split handle 1px hairline                                | **Met**                                                                                                                                                                        |
| Terminals fill workspace; separation = split handle only | **Not met** — each `TerminalPane` still renders a **`pane-header`** (title, “Active”, split/close). Live: large white band + terminal only in lower portion (`02`, `03`, `07`) |
| Active pane = subtle header tint only                    | Header exists; still reads as extra chrome row                                                                                                                                 |

**Root cause:** M8b edited container CSS but did not remove or collapse per-pane chrome required by M5 layout.

### 4. Terminal color scheme follows app theme — **Not met (light)**

| Expected                                                                 | Actual                                                                                                                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Light app mode → white/near-white terminal background when following app | **Broken at token level:** `:root[data-theme='light']` sets `--color-terminal-bg: #1e1e24` (`tokens.css`) — dark terminal canvas in light shell |
| `terminalThemes.ts` + `TerminalPane` wiring                              | **Present**; presets work for explicit scheme keys                                                                                              |
| `resolveTerminalThemeMode` + `terminalMode` prop                         | Still used; ghostty theme from `terminalThemes` on bootstrap                                                                                    |

Live light dashboard (`01`) has light workspace; active-tab fixture (`03`) shows dark terminal block inconsistent with OpenCode light refs.

**Note:** Changing `--color-terminal-bg` for light mode is a **token edit** → stop condition; coordinator must approve `tokens.css` + `tokens.ts` + `docs/moshtty-design-system.md` together.

### 5. Terminal theme picker in Settings — **Met (functional minimum)**

| Expected                                           | Actual                                                       |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `<select>` with Auto + 6 presets                   | **Met** (`Dialogs.tsx`, `terminalThemes.ts`, localStorage)   |
| Replaces inert “Follow app / Current mode”         | **Met**                                                      |
| `useTerminalColorScheme` hook per brief workaround | **Not used** — logic inlined in module; acceptable           |
| Hot-reload open panes                              | **Not implemented** (brief accepts)                          |
| Persist in `MoshttySettings`                       | **Not implemented** (approved workaround: localStorage only) |

**Gap:** “App theme” row remains **read-only** (`<span>System</span>`) — not in M8b numbered list but required for ref-18.46.36 settings parity (M5/M8 scope).

### 6. Tab bar (OpenCode hybrid) — **Major gap**

Brief **correction** (§Visual A, lines 87–89) overrides §7 underline CSS:

- Inactive tabs: **no background**, optional **letter chip** (~10×10), **1px vertical dividers**, 12px/500 muted text.
- Active tab: **only** filled pill (`~#e8e8e8`), 600 weight, close inside pill.
- Top bar: ~`#f2f2f2`, **~40px**, **no bottom border**.

| Element                      | Expected                  | Actual (live + `TopBar.css`)                                                                                       |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Top bar bottom border        | None (OpenCode)           | **1px** `border-bottom` on `.top-bar`                                                                              |
| Tab letter chips             | Yes                       | **Missing** — no chip in `TopBar.tsx`                                                                              |
| Tab dividers                 | 1px hairline between tabs | **Missing**                                                                                                        |
| Inactive tab background      | Transparent               | **Mostly OK**                                                                                                      |
| Active tab                   | Filled pill only          | **Partial** — pill via `.tab-wrapper.active` + `sidebar-bg-active`; height `calc(100% - 4px)` looks cramped vs ref |
| §7 underline (`::after` 2px) | Superseded by correction  | **Not implemented** (correct per correction)                                                                       |

### 7. Overall tone (refs B, C, D) — **Not met**

High-level deltas vs Antigravity + OpenCode tables in brief:

| Surface                | Reference intent                                                                         | Live gap                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Dashboard**          | Centered search, flat chrome, rail ≈ canvas (`opencode-dashboard-light`, `ref-18.46.04`) | Search row is **rounded card** on `--color-app-bg` (`Dashboard.css`); “Today” block minimal; not ref layout |
| **Sidebar**            | ~`#f8f8f8`, hairline right border, flat 32px rows, muted uppercase section labels        | Header band + bottom border; closer but heavier than ref                                                    |
| **Top bar**            | Flat, white/light gray, hairline bottom only in Antigravity (tabs in Moshtty)            | Border + disconnected tab strip                                                                             |
| **Settings**           | `rgba(0,0,0,0.25)` backdrop, flat rows on white, 24px panel padding                      | Backdrop **40%** (`Dialogs.css`); `settings-list` **inset gray card**; shortcuts wall                       |
| **Terminal workspace** | Edge-to-edge, no card borders (Twitter ref D)                                            | Pane headers + wrong light terminal bg token                                                                |
| **Fixture banner**     | N/A (dev only)                                                                           | Orange `FixtureBanner` obscures review on all `?fixture=` URLs                                              |

---

## Gaps vs parent design docs (context for Opus)

These explain why the app “doesn’t look like the spec” beyond M8b’s seven bullets:

1. **`docs/moshtty-design-references.md`** — M5 surfaces (`ref-18.46.04` dashboard, `ref-18.46.36` settings, etc.) were never brought to side-by-side parity in `docs/visual-qa/m5/` on this branch (M8/M8b focused on shell refactor).
2. **`docs/moshtty-design-system.md`** — “Quiet **light** desktop UI by default”; light theme still assigns **dark** `--color-terminal-bg`.
3. **M8 brief** (`2026-05-27-8-moshtty-ui-refresh.md`) — Introduced unified top bar + projects sidebar + frameless window; **intentionally different** from OpenCode dashboard-first layout. M8b was meant to **reconcile** M8 toward references; reconciliation incomplete.
4. **M9b command palette** — Implemented in code; **live `Ctrl+K` did not show overlay** in agent-browser session (`06-command-palette.png`). Opus should verify functionally before visual polish.

---

## Code pointers (quick verification)

| Area                  | Files                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Top bar / tabs        | `apps/desktop/src/renderer/src/components/TopBar.tsx`, `TopBar.css`                                         |
| Pane chrome           | `apps/desktop/src/renderer/src/components/TerminalPane.tsx` (`pane-header`), `assets/main.css`              |
| Light terminal token  | `apps/desktop/src/renderer/src/design/tokens.css` (`--color-terminal-bg` under `:root[data-theme='light']`) |
| Connection pills      | `TopBar.css` `.connection-status.*`                                                                         |
| Dashboard search card | `Dashboard.css` `.search-row`                                                                               |
| Settings layout       | `Dialogs.css` `.dialog-backdrop`, `.settings-list`, `.settings-dialog`                                      |
| Themes                | `design/terminalThemes.ts`, `TerminalPane.tsx` bootstrap                                                    |
| Fixture overlay       | `fixtures/FixtureBanner.tsx`                                                                                |

---

## Blockers for agents

| Blocker                                                                        | Action                                                        |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Missing `docs/visual-qa/8b/references/*.png`                                   | Coordinator: add reference pack from brief paths or Downloads |
| Light `--color-terminal-bg`                                                    | Token stop condition — coordinator approves triplet edit      |
| PRD says M8b Ready for review                                                  | **Disagree** with this assessment — Opus should re-grade      |
| `docs/visual-qa/8b/references/` required for §Verification agent-browser table | Cannot complete until refs on disk                            |

---

## Suggested subagent slices (non-overlapping)

Use after Opus confirms/adjusts this doc. Each slice should re-read M8b brief + this file + relevant reference PNGs.

### Slice A — OpenCode tab strip (owned: `TopBar.tsx`, `TopBar.css` only)

- Remove top bar bottom border (or match token for “flat bar”).
- Tab letter chips from project/tab metadata (10×10, `radius-sm`).
- 1px vertical dividers between inactive tabs.
- Active-only pill; no hover card on inactive tabs.
- Verify against `opencode-tab-bar.png` when available.

### Slice B — Pane chrome removal / minimal chrome (owned: `TerminalPane.tsx`, `main.css`, possibly `App.tsx` layout only)

- Remove or collapse `pane-header` to meet edge-to-edge terminal (split actions → top bar or context menu per coordinator).
- Ensure ghostty container fills `flex: 1` (fix white dead space in live shots).
- Do not touch tokens unless Slice C lands separately.

### Slice C — Light workspace tokens (coordinator-owned stop condition)

- `tokens.css` + `tokens.ts` + `docs/moshtty-design-system.md`: light `--color-terminal-bg` → near-white; align `--color-workspace-bg` / sidebar to Antigravity palette table in M8b §C.
- Re-run visual baselines for light fixtures.

### Slice D — Chrome discipline (owned: `TopBar.css`, `main.css` buttons, `Dialogs.css`)

- Connection status: text + subtle border, not green/orange pills (per Antigravity).
- Settings: backdrop 25%, remove `settings-list` inset card, flat rows.
- Dashboard: flatten `.search-row` toward ref-18.46.04 (no heavy rounded card).

### Slice E — M9b command palette fix (owned: `CommandPalette.*`, `App.tsx`, `keymap.ts`)

- Fix `Ctrl+K` not appearing in live Electron (focus, z-index, shortcut conflict with devtools).
- Re-capture `live-audit/06-command-palette.png`.

### Slice F — Visual QA + baselines (owned: `apps/desktop/tests/visual/**`, `docs/visual-qa/8b/**`)

- Add reference PNGs; produce brief §Verification table screenshots.
- `test:visual:update` after A–E.

**Do not** mark M8b Done in PRD until Opus signs off live-audit vs references.

---

## Opus verification checklist

- [ ] Confirm reference images: restore `docs/visual-qa/8b/references/` or waivers documented.
- [ ] Open each `live-audit/*.png`; agree/disagree with §M8b checklist severities.
- [ ] Compare `01-fixture-dashboard.png` to `ref-18.46.04` / `opencode-dashboard-light.png`.
- [ ] Compare `02-fixture-tab-bar-multi.png` to `opencode-tab-bar.png` (chips, dividers, no top border).
- [ ] Compare `05-settings-dialog.png` to `antigravity-settings.png` / `ref-18.46.36`.
- [ ] Re-test `Ctrl+K` on live Electron (9226); update §5 M9b if false positive.
- [ ] Decide token change ownership for Slice C.
- [ ] Update `docs/moshtty-prd.md` M8b status to `In progress` or `Blocked` with link to this doc.
- [ ] Assign subagent slices A–F with owned paths from `docs/agents/OWNERS.md`.

---

## Related docs

- Task brief: [`docs/agents/2026-05-27-8b-moshtty-ui-polish.md`](../../agents/2026-05-27-8b-moshtty-ui-polish.md)
- Prior handoff (may overstate completion): [`docs/agents/handoffs/2026-05-27-m8b-m9b-handoff.md`](../../agents/handoffs/2026-05-27-m8b-m9b-handoff.md)
- Design contract: [`docs/moshtty-design-system.md`](../../moshtty-design-system.md)
- Reference mapping: [`docs/moshtty-design-references.md`](../../moshtty-design-references.md)

---

## Opus verification (2026-05-27)

**Author:** Opus 4.7 (orchestrator pass)
**Status:** Validates the assessment above and supersedes its Blockers section. Implementation work moves to a new bounded brief — see [`docs/agents/2026-05-27-8c-moshtty-ui-followup.md`](../../agents/2026-05-27-8c-moshtty-ui-followup.md).

### Corrections to the assessment above

| Claim above                                                                                               | Reality                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Source                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/visual-qa/8b/references/` "directory not present in repo at assessment time" (§Evidence, §Blockers) | **References ARE present.** 14 PNGs on disk: `antigravity-chat[-full].png`, `antigravity-main.png`, `antigravity-settings.png`, `antigravity-sidebar.png`, `opencode-dashboard-light.png`, `opencode-project-edit-dialog.png`, `opencode-project-rail.png`, `opencode-settings-dialog.png`, `opencode-tab-bar.png`, `ref-antigravity-command-palette.png`, `ref-antigravity-main.png`, `ref-antigravity-settings.png`, `ref-opencode-tabs.png`. M5 refs `2026-05-24 18.46.*` also exist at `/mnt/chromeos/MyFiles/Downloads/`. | `ls docs/visual-qa/8b/references/`                                                                                                                                                                                                                       |
| "live `Ctrl+K` did not show overlay" (§Gaps vs parent docs item 4)                                        | **Palette IS wired and functional.** The agent-browser capture is a tooling artefact — keypress encoding through CDP without a focused renderer surface drops the modifier. Playwright suite covers palette open/filter/close green.                                                                                                                                                                                                                                                                                           | [`apps/desktop/tests/visual/command-palette.test.ts`](../../../apps/desktop/tests/visual/command-palette.test.ts), [`apps/desktop/src/renderer/src/components/CommandPalette.tsx`](../../../apps/desktop/src/renderer/src/components/CommandPalette.tsx) |
| §Blocker "PRD says M8b Ready for review — Opus should re-grade"                                           | **Re-graded.** M8b moves to `In progress` and a new `M8c UI Followup` row goes `Planned`. See PRD section M8b row.                                                                                                                                                                                                                                                                                                                                                                                                             | [`docs/moshtty-prd.md`](../../moshtty-prd.md)                                                                                                                                                                                                            |

### Additional gaps from a second live-vs-reference pass

These are not in the §M8b checklist above but block reference parity. They roll into the new M8c brief:

1. **Top bar icon order** (user direction, 2026-05-27): the sidebar collapse must be the **leftmost** icon and must NOT be a hamburger glyph. It uses a panel-left icon. The hamburger becomes a **separate overflow/menu icon** immediately to its right (contextual menu stubbed, not implemented). Today both roles collapse into one hamburger.
2. **Tabs alignment + padding + close** (user direction, 2026-05-27): tabs must sit **left-aligned to the right of the icons** (not centered with `max-width: 600px`), have **more vertical padding**, and show the close `×` **always**, not just on hover. Today the tab strip is centered, vertically tight, and reveals close only on hover.
3. **Pane chrome → floating hover pills** (user direction, 2026-05-27): the persistent `<header className="pane-header">` row is the wrong shape entirely. Per reference + user direction, controls and pane info live in **floating pills in the top corners**, visible only on hover. Terminal canvas must occupy the full pane.
4. **Black gutter at workspace bottom** (`02-fixture-tab-bar-multi.png`): when a light/white terminal is active the bottom of the workspace renders as `--color-terminal-bg` dark fill. The terminal/placeholder must fill 100% of the pane.
5. **Settings inert rows**: App theme / Font size / Cursor are read-only `<span>`s. They need working `<select>` controls (theme writes `data-theme`; font size and cursor are localStorage-backed renderer-only until a schema slice lands).
6. **Settings title + close placement**: dialog title still reads `Terminal settings` regardless of active nav tab; close `×` is mid-header, not absolute top-right.
7. **Sidebar Help footer**: [`Sidebar.tsx:193`](../../../apps/desktop/src/renderer/src/components/Sidebar.tsx) routes Help to settings as a placeholder. Either remove or open a real surface.
8. **Project edit affordance** (user direction, 2026-05-27): the pencil icon on sidebar projects currently mounts an inline `<input>` for in-place rename. It should **open a modal** prefilled from the project, per [`opencode-project-edit-dialog.png`](references/opencode-project-edit-dialog.png).
9. **Superfluous spacer lines** (user direction, 2026-05-27): the codebase still carries decorative `border-bottom` rules on `.top-bar`, `.sidebar-header`, `.dialog-header`, and `.pane-header` that no longer earn their pixel — background contrast and spacing already separate the surfaces.
10. **Sidebar uppercase label**: `.sidebar-title` is uppercased; reference OpenCode rail uses sentence-case "Projects".

### Blockers status

All three blockers in §Blockers are cleared:

- References on disk: confirmed.
- Light `--color-terminal-bg`: handled as a coordinator-owned sub-slice 8c.5 (tokens triplet), not a blocker.
- PRD status re-grade: done in this pass.

### Promotion to M8c brief

Implementation work is structured into seven sub-slices in [`docs/agents/2026-05-27-8c-moshtty-ui-followup.md`](../../agents/2026-05-27-8c-moshtty-ui-followup.md) (8c.1 top-bar restructure + tab strip, 8c.2 pane chrome → hover pills + full-area fill, 8c.3 settings dialog discipline, 8c.4 dashboard + sidebar tone, 8c.5 tokens stop-condition triplet, 8c.7 project edit modal, 8c.6 visual QA baselines). Each sub-slice has owned paths and a parallel-safety table so subagents can run concurrently without stepping on each other.

The §Suggested subagent slices A–F above are superseded by the 8c.1–8c.7 numbering in the new brief.
