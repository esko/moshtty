# Moshtty Testing Plan

## Purpose

Moshtty needs tests at four levels:

- fast logic tests for state, reducers, protocol helpers, and config;
- Go package tests for the remote companion, CLI, transport, and lifecycle code;
- deterministic Electron visual regression tests for the desktop UI;
- exploratory Electron QA with `agent-browser` for design review and interaction checks.

`electron-vite` provides the Electron/Vite build and dev pipeline. It does not provide a visual regression framework by itself, so Moshtty should add explicit screenshot tooling.

## Test Layers

### TypeScript Unit Tests

Use Vitest for renderer, preload-adjacent utilities, state stores, and pure protocol helpers.

Required coverage:

- project/tab/pane store operations;
- layout reducers;
- theme mode resolution;
- terminal palette linking;
- profile import validation;
- state migration helpers;
- mux framing helpers that are implemented in TypeScript;
- renderer-side error mapping.

Commands:

```bash
pnpm --filter @moshtty/desktop test
pnpm --filter @moshtty/desktop typecheck
```

### Electron Main And IPC Tests

Electron main owns filesystem state and secrets. Tests should cover the public IPC contract and direct main-process services.

Required coverage:

- versioned JSON load/save;
- atomic write behavior;
- corrupt state recovery;
- state migration;
- typed preload IPC contract;
- `safeStorage` token encryption path;
- passphrase-encrypted fallback path;
- failure behavior when secrets cannot be stored.

These tests can run under Vitest when services are separable from the live Electron runtime. Use Electron-specific integration tests only where process APIs require it.

### Go Tests

Use `go test` for all Go packages.

Required coverage:

- remote config defaults and platform paths;
- macOS LaunchAgent plist generation;
- token generation;
- ECDSA P-256 WebTransport cert generation;
- SHA-256 cert hash profile output;
- JSON-RPC request/response/error handling;
- Origin and token auth;
- datagram mux encode/decode;
- unknown mux version and unknown pane flow behavior;
- pane PTY lifecycle;
- `moshttyctl` command parsing;
- Unix socket RPC;
- offline cleanup commands.

Commands:

```bash
go test ./...
go test ./internal/...
go test ./cmd/moshtty-remote ./cmd/moshttyctl
```

### Electron Visual Regression Tests

Use Playwright as the deterministic screenshot test layer for Electron. The test runner should launch the Electron app with a controlled state fixture and take screenshots of key states.

`electron-vite` should remain the build/dev pipeline. Playwright supplies the visual regression harness.

Recommended script names:

```bash
pnpm --filter @moshtty/desktop test:visual
pnpm --filter @moshtty/desktop test:visual:update
```

Required screenshot states:

- project dashboard, light mode;
- project dashboard, dark mode;
- active project with one terminal tab;
- split panes with two and three panes;
- collapsed project rail;
- expanded project rail;
- remote import dialog;
- project edit dialog;
- settings dialog;
- lost pane state;
- connection status popover.

Visual assertions:

- no incoherent overlap;
- text fits controls and rows;
- left rail remains compact;
- centered dialogs fit viewport;
- terminal pane area remains dominant;
- light/dark mode both use readable contrast;
- UI follows the 2026-05-24 18.46 screenshot references in spacing, tone, row style, and modal shape.

### agent-browser Exploratory QA

Use `agent-browser` for manual/exploratory Electron inspection, screenshots, and interaction bug hunts. This complements Playwright; it does not replace deterministic visual regression tests.

Launch Electron with a remote debugging port:

```bash
pnpm --filter @moshtty/desktop dev -- --remote-debugging-port=9222
```

Then connect and inspect:

```bash
agent-browser connect 9222
agent-browser snapshot -i
agent-browser screenshot /tmp/moshtty-dashboard.png
agent-browser --color-scheme dark screenshot /tmp/moshtty-dashboard-dark.png
```

Use agent-browser for:

- checking the accessibility tree;
- clicking through project, remote, tab, pane, and settings flows;
- capturing review screenshots;
- validating dark mode visually;
- debugging Electron UI states that are hard to inspect through tests.

## Acceptance Test Matrix

Every implementation slice should run the smallest relevant tests plus its task-brief verification.

Before M7 acceptance, run:

```bash
pnpm --filter @moshtty/desktop test
pnpm --filter @moshtty/desktop typecheck
pnpm --filter @moshtty/desktop build
pnpm --filter @moshtty/desktop test:visual
go test ./...
git diff --check
```

M7 real remote acceptance additionally requires:

- `moshtty-remote` running as a macOS LaunchAgent;
- profile JSON imported into the Electron app;
- one project connected to the macOS remote;
- multiple split panes running independent commands;
- Electron app restart/reload reattaches to remote panes;
- `moshttyctl pane split` changes the active local app project;
- companion restart marks panes lost without deleting local layout.

## When To Add Tests

- Add or update Vitest tests with every non-trivial TypeScript module.
- Add or update Go tests with every non-trivial Go package.
- Add visual screenshots when a change affects layout, theme, dialogs, rail, tab bar, terminal pane framing, or connection/lost-state UI.
- Use agent-browser before marking UI work ready for review.

