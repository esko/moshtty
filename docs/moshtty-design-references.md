# Moshtty Design References

Canonical mapping between the four `2026-05-24 18.46.*` reference screenshots,
Playwright fixture states, and required UI surfaces. M5 agents claim parity
against this doc; do not infer mapping from memory.

Related docs:

- [docs/moshtty-design-system.md](moshtty-design-system.md) — tokens, theme, component rules
- [docs/moshtty-testing.md](moshtty-testing.md) — required screenshot states, visual test commands

## Reference screenshots

On-disk paths (ChromeOS Downloads; stable for this milestone):

| ID             | Path                                                                 |
| -------------- | -------------------------------------------------------------------- |
| `ref-18.46.04` | `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.04.png` |
| `ref-18.46.17` | `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.17.png` |
| `ref-18.46.25` | `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.25.png` |
| `ref-18.46.36` | `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.36.png` |

### Reference → surfaces (fill after viewing)

| ID             | Primary surface          | Secondary surface(s)  | Notes                                                                                                     |
| -------------- | ------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------- |
| `ref-18.46.04` | project dashboard, light | expanded project rail | OpenCode dashboard baseline: compact top chrome, left project rail, centered search, sparse session list. |
| `ref-18.46.17` | expanded project rail    | project action menu   | Same dashboard with the project action menu open; Moshtty maps this to expanded rail chrome for M5.       |
| `ref-18.46.25` | project edit dialog      | modal overlay         | Centered project-edit modal, subdued backdrop, project color/icon treatment.                              |
| `ref-18.46.36` | settings dialog          | settings side nav     | Large settings modal with side navigation and flat setting rows.                                          |

## Required surface → reference mapping

Surfaces match [docs/moshtty-testing.md](moshtty-testing.md) **Required screenshot states**.
Assign one or more reference IDs per row after viewing refs; use `none` only when
the four references definitively do not depict that surface.

| Surface (fixture / Playwright name) | Reference ID(s)                | Notes                                                                                   |
| ----------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------- |
| project dashboard, light mode       | `ref-18.46.04`                 | Side-by-side: `docs/visual-qa/m5/project-dashboard-light/side-by-side.png`.             |
| project dashboard, dark mode        | none                           | The four references are light-mode only; dark is checked against token contrast.        |
| active Project with one Tab         | none                           | Terminal Pane work area dominant; no terminal reference is included in the four images. |
| split Panes (2)                     | none                           | No split-pane reference is included in the four images.                                 |
| split Panes (3)                     | none                           | No split-pane reference is included in the four images.                                 |
| collapsed project rail              | `ref-18.46.04`                 | Shares top chrome and project rail proportions with the dashboard baseline.             |
| expanded project rail               | `ref-18.46.04`, `ref-18.46.17` | Side-by-side: `docs/visual-qa/m5/expanded-project-rail/side-by-side.png`.               |
| remote import dialog                | none                           | No import dialog reference is included in the four images.                              |
| project edit dialog                 | `ref-18.46.25`                 | Side-by-side: `docs/visual-qa/m5/project-edit-dialog/side-by-side.png`.                 |
| settings dialog                     | `ref-18.46.36`                 | Side-by-side: `docs/visual-qa/m5/settings-dialog/side-by-side.png`.                     |
| lost Pane state                     | none                           | No lost-pane reference is included in the four images.                                  |
| connection status popover           | none                           | No connection-status reference is included in the four images.                          |

## Claim parity workflow

M5 (or coordinator) completes reference → surface rows above, then each
implementer follows this sequence for every surface they ship:

1. Open the assigned reference image by ID (table above).
2. Implement against the matching fixture state in
   `apps/desktop/src/renderer/src/fixtures/` (when present) per
   [docs/moshtty-design-system.md](moshtty-design-system.md) **Required surface states**.
3. Run the Playwright visual test for that fixture; capture the screenshot artifact.
4. Place reference PNG and fixture screenshot side-by-side under:
   `docs/visual-qa/<milestone>/<surface>/`
   - `<milestone>` — e.g. `m5`
   - `<surface>` — kebab-case slug matching the surface row (e.g. `project-dashboard-light`)
5. Record in [docs/moshtty-prd.md](moshtty-prd.md): pixel-diff threshold used, pass/fail,
   and any explicit waivers (layout delta, font substitution, terminal content).

A UI slice is not ready for review until its surface row has reference ID(s) assigned,
fixture state exists, Playwright screenshot passes (or waiver is recorded), and
side-by-side artifacts exist under `docs/visual-qa/`.

## Pixel diff and baselines

- **Default threshold:** `0.5%` max differing pixels per Playwright `toHaveScreenshot`
  (library default `maxDiffPixelRatio: 0.005`). Suitable for chrome, rail, dialogs.
- **Overrides:** per-test `maxDiffPixelRatio` or `threshold` when terminal Pane
  content or timing makes strict parity impractical; document override and rationale
  in the PRD for that surface.
- **Update baseline:** after intentional visual change,
  `pnpm --filter @moshtty/desktop test:visual:update`

## Adding surfaces later

Any new UI surface introduced in a future milestone must be added to **Required surface → reference mapping** before merge. If no reference screenshot applies, set Reference ID(s) to `none` and add a new reference row or external ref in the PRD.
