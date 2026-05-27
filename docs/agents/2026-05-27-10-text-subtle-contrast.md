# Agent Task 10: Light-mode `--color-text-subtle` contrast fix

**Status:** Planned
**Owner:** Coordinator (stop-condition slice — must not be delegated to a subagent without explicit approval)
**Parent milestone:** M8b UI Polish (close-out blocker)
**Scope label:** `10-text-subtle-contrast`

---

## Read First

Run the [Subagent Pre-flight](../../AGENTS.md#subagent-pre-flight) checklist
**verbatim** before touching any file. That means: `git status`,
`git log -1 --format='%h %s'`, confirm owned paths against
[`OWNERS.md`](OWNERS.md). Then read:

- [`AGENTS.md`](../../AGENTS.md) — especially the
  [Stop Conditions](../../AGENTS.md#stop-conditions) and
  [Design Rules](../../AGENTS.md#design-rules) sections; this slice edits
  the design contract and is one of the stop-condition slices.
- [`docs/moshtty-design-system.md`](../moshtty-design-system.md) — token
  contract; the table row for `--color-text-subtle` is the cell being
  changed.
- [`docs/moshtty-prd.md`](../moshtty-prd.md) — 8c.6 Current Notes block
  filed this as a follow-up to the M8c/M8d slice.
- The 2026-05-27 8c.6 commit (`1499553`) PR/commit body, which contains
  the failing axe-core JSON.

---

## Background

`pnpm --filter @moshtty/desktop test:visual` runs the `a11y.test.ts`
axe-core gate against the dashboard and the active-tab fixture. Both
currently fail on the same WCAG 2.1 AA color-contrast rule:

```
"id": "color-contrast",
"impact": "serious",
"fgColor": "#9a9aa4",
"bgColor": "#f9f9fb",
"contrastRatio": 2.65,
"expectedContrastRatio": "4.5:1",
"html": "<span class=\"connection-status offline\">Offline</span>"
```

`#9a9aa4` is `--color-text-subtle` in light mode and `#f9f9fb` is
`--color-app-bg` (which is the effective background behind the
`.connection-status.offline` pill in the top bar). 2.65 < 4.5 so the
text fails AA.

The M8 UI Refresh close-out (`docs/moshtty-prd.md` Current Notes for
2026-05-27 — "Resolved color contrast issues on the brand badge,
empty-copy warning text, and offline status text to achieve a WCAG AA
pass") declared the offline status pill fixed. The 8b polish slice
("neutral .button.primary, no accent blue") and 8c.4 / 8c.5 token
adjustments quietly re-introduced the regression by shifting the
canonical light-mode `--color-text-subtle` value. The 8c.6 baseline
refresh stashed the working tree on top of `d50ce87` and re-ran
`a11y.test.ts`, confirming the failure pre-exists this slice and is
therefore the M8b close-out blocker (see 8c.6 Current Notes).

The same `--color-text-subtle` token is used in:

- `apps/desktop/src/renderer/src/components/CommandPalette.css` ×5
  (placeholder, section label, disabled item label, shortcut chip,
  empty state)
- `apps/desktop/src/renderer/src/components/TopBar.css` ×3 (this row
  plus two others), including `.connection-status.offline`

So the same readability gap exists in the command palette text. Fixing
the token at the source is the right tier.

---

## Goal

Raise light-mode `--color-text-subtle` to a value that:

1. Passes WCAG 2.1 AA (≥ 4.5:1 contrast against
   `--color-app-bg` (`#f9f9fb`) **and** `--color-workspace-bg` (`#ffffff`),
   which together cover every place the token is used as text on a
   light surface).
2. Stays visually subordinate to `--color-text-muted` (`#64646c`,
   ratio ~5.4 on `#f9f9fb`).
3. Reads cleanly as a "subtle/secondary" tone — not the same darkness
   as `--color-text-muted`, just enough to clear AA.

The dark-mode value (`#6c6c78`) is **not** changed by this slice — its
contrast against `--color-app-bg: #18181b` is approximately 4.05, which
is below AA for small text but is **not** the test-failure trigger.
File a follow-up if reviewers want both modes tightened in the same
pass; do not expand scope here.

The brand-badge and empty-copy text mentioned in the M8 close-out are
not in current failure output; leave them as-is until they regress.

---

## Stop conditions

This slice **is** a stop condition by definition — it edits the design
contract. Specifically:

- Adding or changing a token requires editing `tokens.ts`, `tokens.css`,
  **and** `docs/moshtty-design-system.md` together (see
  [Design Rules](../../AGENTS.md#design-rules)).
- This work is coordinator-only per AGENTS.md. If the coordinator
  delegates to a subagent, the subagent must surface back before any
  file write, and the coordinator must confirm the proposed hex value
  (with the measured contrast ratio) in the same turn.

Further stop conditions for this slice:

- Do **not** modify any other token. The change is one cell in the
  light-mode block, mirrored in `tokens.ts`, and one row in the
  design-system doc.
- Do **not** modify any component CSS. The fix is at the token tier;
  no consumers need to change.
- Do **not** modify the dark-mode `--color-text-subtle` value in this
  slice (see Goal point 3).
- Do **not** refresh Playwright visual baselines in this slice. 8c.6
  just landed clean against the (failing) current value; the snapshots
  will need refreshing in a follow-up because every place that paints
  subtle text gets very slightly darker. That follow-up is **not** part
  of this slice — call it out in the handoff and let the coordinator
  decide whether to bundle it with the M8b close-out or land it as a
  separate `test(visual)` slice.

---

## Owned paths

- `apps/desktop/src/renderer/src/design/tokens.css`
- `apps/desktop/src/renderer/src/design/tokens.ts`
- `docs/moshtty-design-system.md`

Per [`OWNERS.md`](OWNERS.md), the design directory and design-system doc
are coordinator-owned for token edits. No other paths are in scope.

---

## Proposed change

### `tokens.css`

In the `:root, :root[data-theme='light']` block (around line 75 of
`apps/desktop/src/renderer/src/design/tokens.css`):

```css
- --color-text-subtle: #9a9aa4;
+ --color-text-subtle: #6d6d75;
```

Rationale for `#6d6d75`:

- Relative luminance ≈ 0.169.
- Contrast on `--color-app-bg` (`#f9f9fb`, lum ≈ 0.962):
  `(0.962 + 0.05) / (0.169 + 0.05)` = **4.62 : 1** → passes AA (≥ 4.5).
- Contrast on `--color-workspace-bg` (`#ffffff`, lum 1.0):
  `(1.0 + 0.05) / (0.169 + 0.05)` = **4.79 : 1** → passes AA.
- Still lighter than `--color-text-muted` (`#64646c`, lum ≈ 0.143)
  by ~0.026 lum / ~17 RGB steps; visual hierarchy preserved.

Do **not** touch the `:root[data-theme='dark']` block at line 92 or the
`@media (prefers-color-scheme: dark) :root[data-theme='system']` block
at line 121.

### `tokens.ts`

Mirror the same change in the `lightColors` constant (around line 34):

```ts
- textSubtle: '#9a9aa4',
+ textSubtle: '#6d6d75',
```

Leave `darkColors.textSubtle` untouched.

### `docs/moshtty-design-system.md`

Update the row for `--color-text-subtle` in the token table (line 46)
from:

```md
| `--color-text-subtle` | Hints, timestamps, disabled. |
```

to:

```md
| `--color-text-subtle` | Hints, timestamps, disabled. Light mode uses `#6d6d75` to clear WCAG AA (≥ 4.5:1) against `--color-app-bg` (`#f9f9fb`) and `--color-workspace-bg` (`#ffffff`); dark mode unchanged at `#6c6c78`. |
```

Match the table column widths Prettier produces; run `npx prettier
--write docs/moshtty-design-system.md` after the edit and confirm the
diff is exactly the single row change.

---

## Verification

### Per-commit minimum

```bash
pnpm --filter @moshtty/desktop typecheck
pnpm --filter @moshtty/desktop lint:css
pnpm --filter @moshtty/desktop test
git diff --check
```

`lint:css` enforces the token contract and will catch any stray raw
color value the slice introduces by mistake.

### Targeted axe regression check

```bash
pnpm --filter @moshtty/desktop test:visual -- a11y.test.ts
```

Both `dashboard` and `active tab` cases must turn green. If either still
fails, the new fg/bg pair is not the root cause and the brief needs to
be widened (likely to also fix `--color-app-bg` or to introduce a
status-pill-specific token).

### Expected Playwright drift

`pnpm --filter @moshtty/desktop test:visual` will **fail** on every
snapshot that paints subtle-text pixels (top bar, command palette,
dashboard placeholders, settings rows). That is expected. Do **not**
run `test:visual:update` in this slice. Record the failing snapshot
names in the handoff; a separate `test(visual): re-baseline after
text-subtle contrast fix` slice will refresh them.

### Manual smoke

If a live Electron session is available, snapshot via `agent-browser`:

- Top bar `.connection-status.offline` in the light theme — should
  still read as a quiet pill, just legibly darker.
- Command palette open in light — placeholder, "COMMANDS" label,
  shortcut chips, disabled rows should all be more readable.

Save smoke captures under `docs/visual-qa/8b/live-audit/text-subtle/`
if the coordinator wants visual evidence.

---

## PRD close-out

Before committing:

1. Update [`docs/moshtty-prd.md`](../moshtty-prd.md):
   - Add a Current Notes entry summarizing the token change, the axe
     run that now passes, and the deferred Playwright re-baseline
     follow-up.
   - If this fully unblocks M8b's close-out, flip M8b's Status Summary
     and Task Status rows from `Ready for review` to `Done` once the
     design-checkup rubric in `docs/moshtty-design-checkup.md` is also
     re-scored. If the design-checkup re-score is still pending, leave
     M8b at `Ready for review` and note that this slice closes the
     last technical blocker.
2. Fill [`docs/agents/TEMPLATE_HANDOFF.md`](TEMPLATE_HANDOFF.md) or post
   the equivalent into the PRD: what shipped (the one-cell token
   change), what was deferred (Playwright re-baseline), verification
   log (axe pass, lint:css clean, typecheck clean, snapshot drift
   list).

---

## Slice budget

Expected changed files (well under the 8-file soft cap):

1. `apps/desktop/src/renderer/src/design/tokens.css`
2. `apps/desktop/src/renderer/src/design/tokens.ts`
3. `docs/moshtty-design-system.md`
4. `docs/moshtty-prd.md` (close-out)

That is 4 files; one atomic conventional commit.

---

## Commit shape

```
fix(tokens): raise light-mode --color-text-subtle to clear WCAG AA contrast

Brief: docs/agents/2026-05-27-10-text-subtle-contrast.md.
```

Body should:

- name the failing axe rule and the affected fg/bg pair (`#9a9aa4` on
  `#f9f9fb`, ratio 2.65, expected 4.5)
- name the new value (`#6d6d75`) and the measured ratios on both
  `--color-app-bg` and `--color-workspace-bg`
- list the three contract files touched together (per Design Rules)
- explicitly call out that dark-mode `--color-text-subtle` is unchanged
  in this slice and that Playwright baselines will be refreshed in a
  separate `test(visual)` slice
- link the brief

---

## Anti-scope

- No other token edits.
- No component CSS edits.
- No new tokens (e.g. `--color-text-status`); if reviewers later want a
  dedicated status-pill token, that is a separate brief.
- No Playwright baseline refresh in this slice.
- No dark-mode tightening.
- No changes to the design-checkup rubric.
- No changes to the audit doc structure under `docs/visual-qa/8b/`.

---

## Follow-ups this slice files (not part of this slice)

1. **`test(visual): re-baseline after text-subtle contrast fix`** —
   refresh every snapshot that paints subtle-text pixels. Soft cap will
   be exceeded on the screenshot file count, but per 8c.6 precedent
   that is acceptable for a visual-only slice. Owner: coordinator.
2. **Dark-mode `--color-text-subtle` audit** — `#6c6c78` on `#18181b`
   sits at ~4.05 contrast (below AA). Decide whether to tighten the
   dark token in a sibling slice, or accept the value because the dark
   theme does not currently surface this token on `--color-app-bg`
   (most uses are on `--color-workspace-bg` or inside dialogs).
3. **Design-checkup re-score** — once this slice and the re-baseline
   land, re-run the `docs/moshtty-design-checkup.md` rubric for M5 / M7
   reference parity and move M8b to `Done` if it scores clean.
