# Implementer Brief: Light/Dark Theme, Settings Organization, Status Bar Removal

## Context

Repo: `/home/esko/crostini-ghostty-terminal`

The user specifically asked:

1. Remove status bar and pane names; they are not needed.
2. Light mode does not work. Theme changes should affect:
   - terminal tabs/workspace chrome,
   - menu page/spaces page,
   - settings popup/page.
3. Settings page is not organized well. Use the left pane to group settings into logical sections.

Relevant files:

- `web/src/main.ts`
- `web/src/settings.ts`
- `web/src/styles.css`
- `web/src/types.ts`
- `web/src/settings.test.ts`
- `web/src/statusbar.ts`
- `web/src/statusbar.test.ts`

Reference screenshots from ChromeOS Downloads. Inspect these before editing:

- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.04.png` - main spaces/projects page.
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.17.png` - spaces page with topbar and project menu actions visible.
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.25.png` - edit project modal with name, icon, color swatches, startup script.
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.36.png` - settings modal with left navigation and grouped rows.

Design direction from the screenshots: settings should feel like a compact desktop modal with a left navigation rail and a single active section, not a long dashboard. Rows should be grouped and separated by quiet dividers, with controls aligned on the right.

Current behavior:

- `renderWorkspace()` appends a workspace header with the workspace title and may append a status bar.
- `renderStatusBar()` in `main.ts` duplicates behavior from `statusbar.ts`.
- Settings still include Status Bar options.
- `applyAppAppearance()` now sets `document.documentElement.style.colorScheme` based on palette kind; verify and improve if needed.

## Required Behavior

- Terminal workspace should not show:
  - workspace header/title,
  - bottom status bar,
  - pane-name buttons.
- Remove or hide settings controls for status bar since the feature is removed.
- Keep chord progress/recording usable if it depended on the status bar:
  - Move chord indicator to a small fixed overlay/toast if needed, or make it appear somewhere unobtrusive.
  - Do not break action sequence tests if avoidable.
- Theme changes should affect all app chrome:
  - light preset makes terminal, spaces page, settings page/popup, dialogs, and context menu light.
  - dark preset makes all of those dark.
  - system follows media query.
- Settings organization:
  - Use the left settings pane as real group navigation.
  - Group logically as Display, Theme, Terminal, Profiles, Keybindings.
  - Remove Status Bar group.
  - Avoid one huge unstructured list.

## Suggested Implementation Notes

- Since settings type currently includes status bar fields, you may leave normalization backward-compatible but remove controls and force hidden behavior.
- `renderWorkspace()` can simply append the layout node directly to `.workspace-body` without a header or statusbar.
- If removing `statusbar.ts` is broad, leave file/tests alone but stop using it. Better: keep exported chord helpers working.
- CSS has explicit `light-dark(...)`; ensure `color-scheme` is set on `:root` for selected theme.

## Validation

Run:

```bash
/home/esko/.bun/bin/bun run --cwd web test
/home/esko/.bun/bin/bun run --cwd web build
```

Report exactly what changed and any caveats. Do not commit.
