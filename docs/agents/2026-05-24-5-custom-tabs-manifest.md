# Implementer Brief: Remove Native PWA Tab Strip and Make Custom Topbar Tabs Work

## Context

Repo: `/home/esko/crostini-ghostty-terminal`

The user reported:

1. The PWA/native tab bar is still there.
2. Custom tabs are not working at all.

Relevant files:

- `web/public/manifest.webmanifest`
- `web/index.html`
- `web/src/main.ts`
- `web/src/styles.css`
- `web/src/debug-shell.ts`

Current manifest has `window-controls-overlay`, but may still include `tab_strip`. The user explicitly wants a custom tab bar from scratch, not native PWA tabs.

Required behavior:

- Remove native PWA tab-strip manifest configuration that causes ChromeOS PWA tabs.
- Keep `window-controls-overlay` support.
- Custom topbar controls must work:
  - menu opens app context menu;
  - spaces button opens the spaces/menu page;
  - plus creates a new terminal tab in the current/selected space;
  - a simple custom tab strip should represent open tabs when useful, or at minimum the topbar must navigate/open terminals without relying on native tab strip.
- Do not break debug-shell mode.

Validation:

```bash
/home/esko/.bun/bin/bun run --cwd web test
/home/esko/.bun/bin/bun run --cwd web build
```

Report changed files and any caveats. Do not commit.
