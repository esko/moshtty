# Moshtty

Electron desktop remote terminal. The client owns **projects, tabs, and split panes** locally; a **remote companion** (`moshtty-remote`) keeps shell PTYs durable on the host. Terminal rendering uses [`ghostty-web`](https://github.com/ghostty-org/ghostty-web); pane traffic uses **WebTransport** (JSON-RPC control + Mosh mux over datagrams via [`mosh-go`](https://github.com/unixshells/mosh-go)).

First targets: **ChromeOS / Crostini** for the desktop app, **macOS** for the remote companion.

## Repository layout

| Path                  | Role                                                            |
| --------------------- | --------------------------------------------------------------- |
| `apps/desktop/`       | Electron + React renderer (`@moshtty/desktop`)                  |
| `cmd/moshtty-remote/` | Remote companion (WebTransport server, pane lifecycle)          |
| `cmd/moshttyctl/`     | Remote CLI (control from inside shells)                         |
| `internal/`           | Shared Go packages (protocol, mux, config, certs, …)            |
| `docs/moshtty-*.md`   | PRD, plan, milestones, design system, testing                   |
| `version/companion`   | Companion release version (binaries + `moshtty-remote version`) |

The previous **Crostini PWA + local Go agent** stack lives on the [`legacy-pwa`](https://github.com/esko/moshtty/tree/legacy-pwa) branch for reference only.

## Requirements

- **Node.js** 22+ and **pnpm** 9+
- **Go** 1.22+ (module version in `go.mod`)
- For full UI verification: a display (Playwright Electron, `agent-browser` — see `docs/moshtty-testing.md`)

## Desktop client

```bash
pnpm install
pnpm dev          # Electron dev (alias: pnpm --filter @moshtty/desktop dev)
```

Other useful commands from the repo root:

```bash
pnpm build        # typecheck + electron-vite production build
pnpm test         # Vitest + go test ./...
pnpm typecheck
pnpm lint
pnpm lint:css
pnpm verify       # lint + typecheck + test + format:check
pnpm verify:full  # superset including build, visual tests, go vet
```

Agent and contributor workflow: [`AGENTS.md`](AGENTS.md).

## Remote companion

### Install from GitHub Releases

Companion binaries are published per version tag (e.g. [`v0.270526`](https://github.com/esko/moshtty/releases/tag/v0.270526)):

```text
https://github.com/esko/moshtty/releases/download/v<version>/moshtty-remote-<goos>-<goarch>
https://github.com/esko/moshtty/releases/download/v<version>/moshttyctl-<goos>-<goarch>
```

Supported platforms: `darwin` / `linux` × `amd64` / `arm64`.

Current companion version: **`0.270526`** (see `version/companion`).

After download, install the LaunchAgent / user service and print a profile for the desktop app:

```bash
chmod +x moshtty-remote moshttyctl
./moshtty-remote install --binary ./moshtty-remote
./moshtty-remote profile
```

The desktop app can also **SSH-bootstrap** a host: it detects `uname`, downloads the matching release asset, installs the companion, and imports the profile JSON (see M9 in `docs/moshtty-milestones.md`).

### Build locally

```bash
go build -o moshtty-remote ./cmd/moshtty-remote
go build -o moshttyctl ./cmd/moshttyctl

./moshtty-remote run
./moshtty-remote version
```

Cross-compile all release assets:

```bash
./scripts/build-release-binaries.sh
# → dist/release/<version>/
```

Publishing a new companion version: bump `version/companion`, `internal/version/version.go`, and `apps/desktop/src/main/companion-version.ts`, run the build script, tag `v<version>`, push (see `.github/workflows/release.yml`).

## Architecture (short)

```text
Electron app (projects / tabs / panes / UI state)
        │  WebTransport
        ▼
moshtty-remote (durable pane PTYs, Mosh mux, JSON-RPC)
        ▲
moshttyctl (Unix socket — remote shell control)
```

- **Control:** JSON-RPC 2.0 on WebTransport streams
- **Pane I/O:** Mosh protocol on WebTransport datagrams
- **Default transport port:** UDP `4433` (companion config)

Details: [`docs/moshtty-plan.md`](docs/moshtty-plan.md), [`docs/moshtty-prd.md`](docs/moshtty-prd.md).

## Documentation

| Doc                                                              | Contents                                |
| ---------------------------------------------------------------- | --------------------------------------- |
| [`docs/moshtty-prd.md`](docs/moshtty-prd.md)                     | Product scope, status, risks            |
| [`docs/moshtty-milestones.md`](docs/moshtty-milestones.md)       | Roadmap and acceptance criteria         |
| [`docs/moshtty-design-system.md`](docs/moshtty-design-system.md) | UI tokens and theme contract            |
| [`docs/moshtty-testing.md`](docs/moshtty-testing.md)             | Vitest, Playwright, agent-browser QA    |
| [`AGENTS.md`](AGENTS.md)                                         | Tooling, conventions, multi-agent rules |
