# Implementer Brief: Window Controls Overlay Titlebar and App Menu

## Context

Repo: `/home/esko/crostini-ghostty-terminal`

This is the Crostini Ghostty Terminal PWA. Keep changes focused to the existing Go agent and `web/` TypeScript app. Do not add a new frontend stack.

Reference screenshots from ChromeOS Downloads. Inspect these before editing:

- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.04.png` - main spaces/projects page.
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.17.png` - spaces page with topbar and project menu actions visible.
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.25.png` - edit project modal with name, icon, color swatches, startup script.
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.36.png` - settings modal with left navigation and grouped rows.

Design direction from the screenshots: very sparse desktop shell, `BETA` pill, left menu/grid/plus controls, mostly white or dark canvas, subtle borders, restrained 6-12px radii, centered content, and settings/edit dialogs with low-contrast panels and simple shadows.

The user specifically asked:

1. Change the manifest to use `window-controls-overlay`.
2. Create the tab bar/titlebar from scratch.
3. The new topbar must actually work.
4. The topbar menu should open the right-click context menu, not the command palette.

Current relevant files:

- `web/public/manifest.webmanifest`
- `web/index.html`
- `web/src/main.ts`
- `web/src/styles.css`

There is already an earlier in-progress topbar in `web/index.html` with `#topbarMenu`, `#topbarSpaces`, `#topbarNewTerminal`, `#diagnosticsToggle`, `#reconnect`, and `#status`. You may replace it.

## Required Behavior

- Add PWA manifest support for window controls overlay:
  - Use `display_override` with `window-controls-overlay` first.
  - Keep a reasonable fallback display mode.
- Build a real custom draggable titlebar/tabbar surface:
  - Use CSS `app-region: drag` / `-webkit-app-region: drag` for the titlebar drag area.
  - Interactive controls must be non-draggable.
  - Account for overlay controls with `env(titlebar-area-*)` where useful, without breaking normal browser rendering.
- The visible titlebar should resemble the latest ChromeOS screenshots:
  - BETA pill at left.
  - Menu button, tab/grid button, plus button.
  - Status/update pill on the right can remain if useful, but do not make it dominate.
- Make controls work:
  - Menu button opens the existing terminal right-click context menu at the menu button position.
  - Spaces/grid button opens/renders the spaces page.
  - Plus button creates a new terminal tab in the selected space.
  - Reconnect button still reconnects active pane.
- Keep keyboard shortcuts and context menu actions working.

## Suggested Implementation Notes

- The context menu helper likely already exists around `showContextMenu(x, y)` in `web/src/main.ts`.
- The topbar menu can call `showContextMenu(rect.left, rect.bottom + 6)` and should not require a terminal pane to be active.
- If context menu actions depend on active pane, disable/hide pane-only actions only if necessary. Do not break terminal context menu from right-click.
- Do not introduce lucide or new icon dependencies. Use simple text/symbols already in this repo.
- Keep changes small and localized.

## Validation

Run:

```bash
/home/esko/.bun/bin/bun run --cwd web test
/home/esko/.bun/bin/bun run --cwd web build
```

Report exactly what changed and any caveats. Do not commit.
