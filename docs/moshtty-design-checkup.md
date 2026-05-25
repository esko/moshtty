# Moshtty Design Checkup

## Purpose

Recurring design-health artifact for Moshtty renderer surfaces. Scores six vital signs (0–10 each) against the contract in [`docs/moshtty-design-system.md`](moshtty-design-system.md), reference parity in [`docs/moshtty-design-references.md`](moshtty-design-references.md), and the historical PWA baseline in [`.commandcode/design/checkup-report.md`](../.commandcode/design/checkup-report.md).

## When to run

| Trigger                                                      | Action                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------- |
| End of **M5** (UI and Ghostty integration)                   | Complete checkup; file dated report; link from PRD Current Notes |
| End of **M7** (real remote acceptance)                       | Rerun full checkup; file new dated report; link from PRD         |
| Any UI slice that adds a surface or changes the token system | Rerun affected vital signs; update or append dated report        |

## Scoring rubric

Score each vital sign 0–10. Sum is informational only; gating uses per-sign thresholds (see [Gate](#gate)).

### Intentionality (0–10)

What the UI communicates about Projects, Tabs, Panes, and connection health without reading docs.

| Band     | Score | Indicators                                                                                                                                                                                                                                                    |
| -------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Healthy  | 8–10  | Every chrome color, spacing, and type value traces to `tokens.ts` / `tokens.css`; no undefined CSS variables; active Project/Tab/Pane state is visually unambiguous; connection status is calm and concrete; copy uses locked vocabulary (Project, Tab, Pane) |
| Watch    | 4–7   | Occasional token bypass (hex, magic px); mixed metaphors in labels; status strings vague or jargon-heavy; theme/terminal palette drift from resolved app mode                                                                                                 |
| Critical | 0–3   | Hardcoded palette or layout literals dominate; broken token references; user cannot tell which Project/Tab/Pane is active; connection/lost states missing or misleading                                                                                       |

### Readability (0–10)

Legibility of chrome and terminal framing at desktop viewing distance.

| Band     | Score | Indicators                                                                                                                                                                                              |
| -------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Healthy  | 8–10  | Body text at or above 13px type scale; hierarchy via `--color-text-main` / muted / subtle; mono on terminal surfaces only; line length constrained in dialogs; light and dark palettes both comfortable |
| Watch    | 4–7   | Dense rows readable but tight; weak hierarchy between labels and values; terminal chrome competes with shell output; dark-mode type feels thin without compensation                                     |
| Critical | 0–3   | Text below `caption` (11px) floor; contrast failures on primary surfaces; truncated labels without ellipsis/tooltip; unreadable tab or rail labels at default density                                   |

### Usability (0–10)

Task completion for project management, tab/pane layout, remote import, and settings.

| Band     | Score | Indicators                                                                                                                                                                                                                 |
| -------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Healthy  | 8–10  | Required surface states (empty, loading, error, success, lost where applicable) implemented; destructive actions clear; errors state impact and next step; split/focus flows discoverable; modals centered and dismissible |
| Watch    | 4–7   | Some flows lack loading or error affordances; destructive actions lack confirmation or recovery; pane lost state present but easy to miss                                                                                  |
| Critical | 0–3   | Core flows blocked (cannot add Project, open Tab, focus Pane); missing lost-pane handling; settings/theme changes do not apply; dialogs trap or fail to restore focus                                                      |

### Responsiveness (0–10)

Layout stability across viewport sizes and input modalities.

| Band     | Score | Indicators                                                                                                                                                                                          |
| -------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Healthy  | 8–10  | Project rail collapse/expand behaves; terminal work area stays dominant; dialogs fit viewport; split layout reflows without overlap; `pointer: coarse` enlarges targets to `--density-touch-target` |
| Watch    | 4–7   | Narrow widths clip chrome; rail or tab bar overflow without scroll; touch targets undersized on coarse pointers; no safe-area handling where needed                                                 |
| Critical | 0–3   | Overlapping panes or modals; rail consumes work area; horizontal scroll on primary shell; split dividers unusable at minimum size                                                                   |

### Speed (0–10)

Perceived and measured UI performance.

| Band     | Score | Indicators                                                                                                                                                                                                |
| -------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Healthy  | 8–10  | CSS uses tokens and light selectors; motion uses `--duration-*` tokens only; no layout-thrashing animations on scroll; terminal canvas defers heavy work; first paint of shell acceptable on dev hardware |
| Watch    | 4–7   | Heavy shadows or filters; transitions on layout properties; large unscoped global CSS growth                                                                                                              |
| Critical | 0–3   | Jank during tab switch or pane split; animations ignore reduced-motion; main-thread stalls on theme toggle or rail expand                                                                                 |

### Accessibility (0–10)

Keyboard, screen reader, contrast, and motion safety.

| Band     | Score | Indicators                                                                                                                                                                                                                                         |
| -------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Healthy  | 8–10  | Visible `:focus-visible` on every interactive control; `prefers-reduced-motion` honored; axe clean on every fixture state; WCAG AA contrast in light and dark; coarse-pointer 44px targets; landmarks and heading order correct; full keyboard map |
| Watch    | 4–7   | Focus ring inconsistent on secondary controls; one fixture state fails axe; heading order gaps in dialogs                                                                                                                                          |
| Critical | 0–3   | `outline: none` without replacement; no keyboard path for primary affordances; dialogs without focus trap; contrast failures on body text                                                                                                          |

## Gate

> A vital sign below 7/10 blocks "Done" status unless the PRD records an explicit waiver.

Waivers must appear in [`docs/moshtty-prd.md`](moshtty-prd.md) with rationale and a follow-up task ID.

## Where to file the checkup

Save the completed report at:

`docs/moshtty-design-checkup-<milestone>-<yyyy-mm-dd>.md`

Examples: `docs/moshtty-design-checkup-m5-2026-05-25.md`, `docs/moshtty-design-checkup-m7-2026-06-15.md`.

## Blank report template

Copy this into the dated file, fill it in, and link it from `docs/moshtty-prd.md` Current Notes.

```markdown
# Moshtty Design Checkup — M[X] — YYYY-MM-DD

**Owner:** [name / agent + model]
**Milestone:** M[X] [name]
**Build under review:** [commit SHA or PR link]
**References used:** docs/moshtty-design-system.md, docs/moshtty-design-references.md

## Scoring summary

| Vital sign     | Score | Band | Gate met? |
| -------------- | ----- | ---- | --------- |
| Intentionality | \_/10 |      | Y/N       |
| Readability    | \_/10 |      | Y/N       |
| Usability      | \_/10 |      | Y/N       |
| Responsiveness | \_/10 |      | Y/N       |
| Speed          | \_/10 |      | Y/N       |
| Accessibility  | \_/10 |      | Y/N       |

## Intentionality — N/10

- Findings: [token bypasses, copy drift, status clarity]
- Evidence: [screenshots, fixture IDs, file:line refs]
- Required fixes before "Done":
- Deferred (linked follow-up brief):

## Readability — N/10

[same shape]

## Usability — N/10

[same shape]

## Responsiveness — N/10

[same shape]

## Speed — N/10

[same shape]

## Accessibility — N/10

- Axe pass: [yes / no — list violations]
- Contrast pass: [yes / no — list pairs that fail]
- Keyboard map coverage: [yes / no — list missing actions]
- Reduced-motion: [respected / not respected]

## Surface state matrix coverage

| Surface             | States required                      | Fixtures covering | Reference parity |
| ------------------- | ------------------------------------ | ----------------- | ---------------- |
| Project rail        | collapsed, expanded, empty           |                   |                  |
| Top tab bar         | single, multi, dragging, overflow    |                   |                  |
| Terminal pane       | active, lost                         |                   |                  |
| Split layout        | 2-row, 2-col, 3-pane, drag-hover     |                   |                  |
| Project dashboard   | empty, populated                     |                   |                  |
| Remote import       | empty, valid, invalid                |                   |                  |
| Project edit dialog | new, existing                        |                   |                  |
| Terminal settings   | follow-app, light, dark              |                   |                  |
| Connection status   | offline, connecting, connected, lost |                   |                  |

## Waivers requested

[List, each linked to a PRD entry with rationale + follow-up task. If none, "None."]

## Sign-off

- Reviewed by: [coordinator]
- PRD updated: [yes/no]
- Linked from PRD Current Notes: [yes/no]
```
