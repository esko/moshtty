# Implementer Brief: Terminal Full Height and Live Theme Updates

## Context

Repo: `/home/esko/crostini-ghostty-terminal`

The user reported:

1. Terminal window is not full height; it appears fixed height.
2. Theme changes do not update already-open terminal tabs.

Relevant files:

- `web/src/main.ts`
- `web/src/styles.css`
- `web/src/settings.ts`
- `web/node_modules/ghostty-web/lib/terminal.ts` only for API inspection; do not edit node_modules.

Current code:

- `renderWorkspace()` creates `.workspace-body` and appends the layout node.
- `.terminal-root`, `.workspace-body`, `.split-node`, `.split-child`, `.terminal-pane` are in `web/src/styles.css`.
- `applyAppAppearanceAndTheme()` mutates `pane.term.options.theme`, cursor, font size, and font family.

Required behavior:

- Terminal route must fill all available viewport height under the custom topbar.
- Terminal panes and split layouts must stretch to full height and fit on resize.
- Changing theme in settings must update existing open terminal panes without reloading.
- Theme changes must update app chrome and terminal canvas. If `ghostty-web` needs a refresh/redraw/focus/fit call after setting `options.theme`, add the minimal correct call.
- Do not restore the old workspace header or status bar.

Validation:

```bash
/home/esko/.bun/bin/bun run --cwd web test
/home/esko/.bun/bin/bun run --cwd web build
```

Report changed files and any caveats. Do not commit.
