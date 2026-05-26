# Path ownership

Every task brief under `docs/agents/` owns one or more path globs. Agents must claim a brief (and read its write scope) before editing any path outside their globs. When two briefs overlap, coordinate through the coordinator and PRD status notes; do not edit contested paths in parallel.

Follow-up briefs under [docs/agents/followups/](followups/README.md) own the same runtime paths as their parent milestone unless the brief narrows scope.

## Ownership matrix

| Glob                                                       | Owning brief                                                                     | Notes                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `apps/desktop/src/main/**`                                 | [2026-05-25-2-desktop-state-shell.md](2026-05-25-2-desktop-state-shell.md)       | Electron main, state, secrets                                 |
| `apps/desktop/src/preload/**`                              | [2026-05-25-2-desktop-state-shell.md](2026-05-25-2-desktop-state-shell.md)       | Typed preload IPC                                             |
| `apps/desktop/src/common/state*`                           | [2026-05-25-2-desktop-state-shell.md](2026-05-25-2-desktop-state-shell.md)       | Shared state types/schema                                     |
| `cmd/moshtty-remote/**`                                    | [2026-05-25-3-macos-remote-companion.md](2026-05-25-3-macos-remote-companion.md) | Companion binary; M4 adds transport in same tree — coordinate |
| `internal/config/**`                                       | [2026-05-25-3-macos-remote-companion.md](2026-05-25-3-macos-remote-companion.md) | Remote config                                                 |
| `internal/profile/**`                                      | [2026-05-25-3-macos-remote-companion.md](2026-05-25-3-macos-remote-companion.md) | Profile JSON                                                  |
| `internal/remote/**`                                       | [2026-05-25-3-macos-remote-companion.md](2026-05-25-3-macos-remote-companion.md) | Service paths, LaunchAgent                                    |
| `internal/auth/**`                                         | [2026-05-25-3-macos-remote-companion.md](2026-05-25-3-macos-remote-companion.md) | Token auth                                                    |
| `internal/certs/**`                                        | [2026-05-25-3-macos-remote-companion.md](2026-05-25-3-macos-remote-companion.md) | WT cert hashes                                                |
| `cmd/moshtty-remote/**` (transport)                        | [2026-05-25-4-webtransport-mosh-mux.md](2026-05-25-4-webtransport-mosh-mux.md)   | `run` WebTransport path; overlaps brief 3                     |
| `internal/jsonrpc/**`                                      | [2026-05-25-4-webtransport-mosh-mux.md](2026-05-25-4-webtransport-mosh-mux.md)   | Control RPC                                                   |
| `internal/mux/**`                                          | [2026-05-25-4-webtransport-mosh-mux.md](2026-05-25-4-webtransport-mosh-mux.md)   | Datagram mux                                                  |
| `internal/pane/**`                                         | [2026-05-25-4-webtransport-mosh-mux.md](2026-05-25-4-webtransport-mosh-mux.md)   | Pane PTY + mosh bridge                                        |
| `internal/wtserver/**`                                     | [2026-05-25-4-webtransport-mosh-mux.md](2026-05-25-4-webtransport-mosh-mux.md)   | WebTransport server                                           |
| `apps/desktop/src/renderer/src/transport/**`               | [2026-05-25-4-webtransport-mosh-mux.md](2026-05-25-4-webtransport-mosh-mux.md)   | Renderer transport client                                     |
| `apps/desktop/src/common/mux*`                             | [2026-05-25-4-webtransport-mosh-mux.md](2026-05-25-4-webtransport-mosh-mux.md)   | Cert-hash / mux helpers                                       |
| `apps/desktop/src/renderer/src/**` (except `transport/**`) | [2026-05-27-8-moshtty-ui-refresh.md](2026-05-27-8-moshtty-ui-refresh.md)         | UI shell, stores, components; M8 refresh overlaps brief 5     |
| `apps/desktop/src/renderer/src/design/**`                  | [2026-05-27-8-moshtty-ui-refresh.md](2026-05-27-8-moshtty-ui-refresh.md)         | Design tokens; M8 refresh updates tokens.ts / tokens.css      |
| `apps/desktop/tests/visual/**`                             | [2026-05-27-8-moshtty-ui-refresh.md](2026-05-27-8-moshtty-ui-refresh.md)         | Playwright screenshots and visual tests                       |
| `apps/desktop/src/renderer/src/fixtures/**`                | [2026-05-25-5-moshtty-ui-ghostty.md](2026-05-25-5-moshtty-ui-ghostty.md)         | UI fixtures                                                   |
| `cmd/moshttyctl/**`                                        | [2026-05-25-6-moshttyctl-cli.md](2026-05-25-6-moshttyctl-cli.md)                 | Remote CLI                                                    |
| M4 follow-up scope (see brief)                             | [followups/m4-mosh-adapter.md](followups/m4-mosh-adapter.md)                     | Live WT + mosh E2E; same globs as brief 4                     |
| M2 follow-up scope (see brief)                             | [followups/m2-safestorage-on-device.md](followups/m2-safestorage-on-device.md)   | Live Electron safeStorage; same globs as brief 2              |

Brief [2026-05-25-1-moshtty-scaffold.md](2026-05-25-1-moshtty-scaffold.md) (M1) is exempt from slice budget; most of its touch targets are **Shared paths** below — coordinate before scaffold edits.

## Shared paths

No single brief owns these paths. Any edit is a **stop condition** (see [AGENTS.md](../../AGENTS.md#stop-conditions)); coordinate with the coordinator before changing:

- `AGENTS.md`
- `docs/moshtty-prd.md`
- `docs/moshtty-milestones.md`
- `docs/moshtty-testing.md`
- `docs/moshtty-design-system.md`
- `docs/moshtty-design-references.md`
- `docs/moshtty-design-checkup.md`
- `docs/agents/OWNERS.md`
- `docs/agents/TEMPLATE_HANDOFF.md`
- `package.json` (repo root)
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `go.mod`
- `go.sum`
- `.github/workflows/**`
- `.editorconfig`
- `.gitattributes`
- `commitlint.config.js`
- `lefthook.yml`
- `.golangci.yml`

Other docs (`docs/moshtty-plan.md`, `docs/m4-mosh-adapter.md`, `docs/moshtty-model-routing.md`, etc.) are coordinator-owned unless a brief explicitly lists them in write scope.
