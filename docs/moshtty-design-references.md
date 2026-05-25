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

| ID             | Primary surface | Secondary surface(s) | Notes |
| -------------- | --------------- | -------------------- | ----- |
| `ref-18.46.04` | TBD             | TBD                  | TBD   |
| `ref-18.46.17` | TBD             | TBD                  | TBD   |
| `ref-18.46.25` | TBD             | TBD                  | TBD   |
| `ref-18.46.36` | TBD             | TBD                  | TBD   |

## Required surface → reference mapping

Surfaces match [docs/moshtty-testing.md](moshtty-testing.md) **Required screenshot states**.
Assign one or more reference IDs per row after viewing refs; use `none` only when
the four references definitively do not depict that surface.

| Surface (fixture / Playwright name) | Reference ID(s) | Notes                            |
| ----------------------------------- | --------------- | -------------------------------- |
| project dashboard, light mode       | TBD             |                                  |
| project dashboard, dark mode        | TBD             |                                  |
| active Project with one Tab         | TBD             | Terminal Pane work area dominant |
| split Panes (2)                     | TBD             |                                  |
| split Panes (3)                     | TBD             |                                  |
| collapsed project rail              | TBD             |                                  |
| expanded project rail               | TBD             |                                  |
| remote import dialog                | TBD             |                                  |
| project edit dialog                 | TBD             |                                  |
| settings dialog                     | TBD             |                                  |
| lost Pane state                     | TBD             |                                  |
| connection status popover           | TBD             |                                  |

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
