# Moshtty Architecture Plan

## Product Direction

Moshtty is an Electron desktop remote terminal with local project/tab/pane control and a manually installed remote companion. It is a reset of the previous Crostini-local terminal architecture, not an incremental feature inside the old local PTY agent.

The product goal is a tmux-like experience where layout and navigation are controlled locally by Moshtty, while remote shells stay durable on the remote host. The first working version targets personal use, ChromeOS/Crostini as the Electron client environment, and macOS as the first remote host.

## Research Anchors

- `mosh-go v0.5.2` supports the full Mosh protocol, WASM, `DialConnRaw`, and caller-provided datagram transports: <https://pkg.go.dev/github.com/unixshells/mosh-go>
- WebTransport provides datagrams and streams over HTTP/3: <https://developer.mozilla.org/en-US/docs/Web/API/WebTransport>
- Pinned self-signed WebTransport certificates must use short-lived ECDSA P-256 certificates and SHA-256 hashes: <https://developer.mozilla.org/en-US/docs/Web/API/WebTransport/WebTransport>
- Remote WebTransport server support should use Go/quic-go WebTransport: <https://quic-go.net/docs/webtransport/server/>

## Naming

- Product: `Moshtty`
- Desktop app command/package/path prefix: `moshtty`
- Remote companion: `moshtty-remote`
- Remote CLI: `moshttyctl`
- User-facing vocabulary: `Project`, `Tab`, `Pane`

Avoid user-facing "session" terminology. Internally, if needed, prefer precise names like `pane process`, `pane PTY`, or `pane flow`.

## Core Model

Moshtty uses this hierarchy:

```text
Project
  Tab
    Pane
```

Rules:

- One project connects to one remote companion.
- One tab contains one or more panes arranged by a local split layout.
- One pane maps to one independent remote PTY/shell process.
- The Electron app is authoritative for projects, tabs, pane layout, focus, names, and UI state.
- The remote companion owns pane PTYs, screen/transport state, and remote cleanup commands.
- Moving existing panes between tabs is out of scope for the first milestone so injected shell context remains truthful.

## Client Architecture

Moshtty v1 is Electron-only. The previous PWA, service worker, browser install flow, and local Go HTTP/PTTY bridge are deprecated.

Client stack:

- `electron-vite`
- React + TypeScript
- Zustand for renderer state
- CSS modules or plain CSS
- pnpm
- `ghostty-web` renderer retained
- secure Electron app protocol, `app://moshtty`

Electron boundaries:

- Main process owns app state files, secrets, app windows, and privileged filesystem access.
- Preload exposes narrow typed IPC APIs.
- Renderer owns React UI, Ghostty terminal panes, WebTransport, and `mosh-go` WASM clients.
- Renderer must not get arbitrary Node filesystem access.

State:

- Versioned JSON state file.
- Atomic writes.
- State includes remotes, projects, tabs, pane metadata, layouts, settings, theme mode, and last active project.
- Tokens are protected with Electron `safeStorage`.
- If `safeStorage` is unavailable or weak, use a passphrase-encrypted fallback token file.

## Remote Architecture

The first remote target is macOS.

Remote companion:

- Go 1.26.
- `cmd/moshtty-remote`.
- Runs as a per-user LaunchAgent.
- Stores config/state under `~/Library/Application Support/Moshtty`.
- Installs user-local binaries, such as `~/.local/bin` or `~/bin`.
- Binds WebTransport on UDP port `4433` by default.
- Binds all interfaces by default.
- Authenticates with a persistent token.
- Enforces exact Origin checks for `app://moshtty` plus explicitly configured dev origins.
- Generates a pasteable profile JSON containing remote ID, URL, token reference, current cert hash, next cert hash if available, host label, platform, service version, and defaults.

Remote CLI:

- `cmd/moshttyctl`.
- Separate binary from `moshtty-remote`.
- Talks to the companion over a per-user Unix socket.
- App/layout commands require an active Moshtty app connection.
- Offline cleanup commands may list/kill orphaned remote PTYs even when no app is connected.

Linux is not part of the first acceptance target. Keep config and path naming portable, but implement and test macOS first.

## Transport

Transport uses WebTransport:

- Streams carry JSON-RPC 2.0 control messages.
- Datagrams carry muxed Mosh pane traffic.

Mux datagram shape:

```text
version | pane flow id | raw mosh datagram
```

The exact binary layout is part of the transport task, but it must be versioned and tested.

`mosh-go v0.5.2` is the protocol base:

- Browser/WASM path uses `DialConnRaw`.
- Browser-side wrapper should adapt `mosh-go/cmd/mosh-wasm` ideas.
- Server-side implementation may need a narrow vendored/adapter loop because the published server is UDP-oriented.
- Keep vendored/adapted code isolated and covered by tests.

Mosh semantics:

- Accept Mosh screen-state semantics for v1.
- Full raw PTY transcript replay is out of scope.
- Predictive local echo is not a hard v1 promise.

## UI Direction

Use these screenshots as primary visual references:

- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.04.png`
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.17.png`
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.25.png`
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.36.png`

Design constraints:

- quiet light desktop shell;
- dark mode selectable and system-syncable;
- compact left project rail;
- large terminal work area;
- top in-app tab/action bar;
- flat rows, hairline dividers, subtle hover states;
- centered modal dialogs;
- project identity is color + initial, not image upload in v1;
- remote identity is friendly label + hostname/platform/status;
- minimal top controls: tabs, new tab, split actions, command palette, connection status;
- status is subtle and persistent, with details in a popover.

Home screen:

- Project dashboard when no terminal tab is selected.
- Dashboard labels recent/open entries as `Tabs`, not `Sessions`.
- App auto-restores the last active project when available.

## Included In First Milestone Set

- New branch in this repo based on the current worktree.
- Electron-only client shell.
- macOS remote companion.
- Manual build + `scp` remote distribution.
- LaunchAgent install script.
- Profile JSON import.
- Multiplexed panes over one active project WebTransport connection.
- `moshttyctl` core layout commands.
- Light/Dark/System mode.
- Real macOS remote acceptance test.

## Out Of Scope

- PWA/browser packaging.
- IWA and Direct Sockets.
- Automatic SSH bootstrap.
- Official `mosh-server` compatibility mode.
- Raw UDP fallback.
- Linux implementation beyond portable docs/config shape.
- Full transcript scrollback.
- Multi-device sync.
- Multiple simultaneous project connections.
- Background hidden tab attachment as a v1 requirement.
- Moving panes between tabs.
- Image project icons.
- AppImage/deb packaging.
