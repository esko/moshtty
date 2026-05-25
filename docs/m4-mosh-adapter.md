# M4 mosh-go adapter notes

M4 bridges `mosh-go` through Moshtty's muxed WebTransport datagrams instead of raw UDP.

## Server boundary

- `internal/pane` starts a native `mosh-go` server on localhost UDP and bridges datagrams through `internal/mux`.
- This avoids forking the upstream UDP-oriented server loop while keeping pane PTYs durable in `moshtty-remote`.
- Future work can replace the UDP bridge with a direct `Transport` loop if `mosh-go` exposes a narrower server hook.

## Client boundary

- Renderer code should use `DialConnRaw`-style polling from `mosh-go` WASM, but send/receive datagrams through `MoshttyTransport.sendPaneDatagram()` / `readPaneDatagram()` rather than browser-native WebTransport datagrams directly.
- Cert pins from profile JSON use standard base64 SHA-256 over X.509 DER and decode to 32-byte `serverCertificateHashes` values in `apps/desktop/src/common/mux.ts`.

## Deferred to later milestones

- Building and bundling the `mosh-go` WASM artifact inside Electron is tracked for M5 UI/Ghostty integration.
- Ghostty terminal rendering wired to muxed mosh pane output is tracked for M5.

## M4 follow-ups

These items remain open before M4 can move from **Ready for review** to **Done**:

### Manual verification on the Mac server

Use the local SSH alias from Crostini/Linux dev environments:

```bash
ssh macmini
scp ./moshtty-remote macmini:~/.local/bin/moshtty-remote
```

On the Mac:

1. Build or copy a macOS `moshtty-remote` binary to `~/.local/bin`.
2. Run `moshtty-remote install --binary ~/.local/bin/moshtty-remote` and load the LaunchAgent if needed.
3. Start or confirm `moshtty-remote run` is listening on UDP `:4433` and health on `127.0.0.1:4434`.
4. Run `moshtty-remote profile --host <reachable-hostname>` and copy the JSON back to the Electron client host.

From the Electron client (Crostini):

5. Import the profile JSON.
6. Connect with `MoshttyTransport` using `currentCertHash` / optional `nextCertHash` in `serverCertificateHashes`.
7. Confirm WebTransport handshake succeeds (cert pin format matches Chromium expectations).
8. Call `pane.create`, then exchange muxed mosh datagrams on the returned `flowId` with the pane key.
9. Verify at least one pane shows live shell output and accepts input.

### Protocol and transport gaps

| Follow-up                                              | Why it matters                                                                                                               | Target                                      |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Cert-pin handshake against real Electron/Chromium      | Unit tests validate hash encoding; only a live connect proves pins work with QUIC/WebTransport                               | Before marking M4 Done                      |
| End-to-end one-pane WebTransport integration test      | Go/TS unit tests cover framing and dispatch; no automated test runs a full WT session with mosh traffic yet                  | M4 or early M5                              |
| Replace localhost UDP bridge in `internal/pane`        | Current adapter wraps `mosh-go`'s UDP server; a direct `Transport` loop would reduce latency and simplify shutdown           | Post-M4 refactor                            |
| Faster pane shutdown                                   | `mosh-go` may wait on association timeout; manager currently caps close wait at 2s                                           | Post-M4 hardening                           |
| Server-side `pane.resize` semantics                    | RPC validates the flow exists; terminal resize is still client-driven through mosh today                                     | M5 or when UI needs server-initiated resize |
| Pass auth token on WebTransport connect from renderer  | Server checks `X-Moshtty-Token` / Bearer on upgrade; client transport should set the header consistently in manual/E2E tests | M4 manual QA                                |
| Publish rotated cert hashes over authenticated control | PRD requires current/next hash rotation while connected; only static profile export exists today                             | M4 hardening or M7                          |

### Explicitly deferred

| Item                                                              | Owner milestone |
| ----------------------------------------------------------------- | --------------- |
| Bundle `mosh-go` WASM and wire `DialConnRaw` polling into pane UI | M5 UI/Ghostty   |
| Profile import UI and project connection shell                    | M5              |
| `moshttyctl` Unix socket control plane                            | M6              |
| Full macOS LaunchAgent acceptance and reconnect workflow          | M7              |

See also `docs/moshtty-testing.md` for the macOS remote access commands and acceptance checklist.
