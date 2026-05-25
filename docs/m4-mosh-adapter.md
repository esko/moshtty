# M4 mosh-go adapter notes

M4 bridges `mosh-go` through Moshtty's muxed WebTransport datagrams instead of raw UDP.

## Server boundary

- `internal/pane` starts a native `mosh-go` server on localhost UDP and bridges datagrams through `internal/mux`.
- This avoids forking the upstream UDP-oriented server loop while keeping pane PTYs durable in `moshtty-remote`.
- Future work can replace the UDP bridge with a direct `Transport` loop if `mosh-go` exposes a narrower server hook.

## Client boundary

- Renderer code should use `DialConnRaw`-style polling from `mosh-go` WASM, but send/receive datagrams through `MoshttyTransport.sendPaneDatagram()` / `readPaneDatagram()` rather than browser-native WebTransport datagrams directly.
- Cert pins from profile JSON use standard base64 SHA-256 over X.509 DER and decode to 32-byte `serverCertificateHashes` values in `apps/desktop/src/common/mux.ts`.

## Deferred

- Building and bundling the `mosh-go` WASM artifact inside Electron is tracked for M5 UI/Ghostty integration.
- End-to-end Chromium cert-pin handshake validation requires a running `moshtty-remote` instance and is part of M4 manual verification.
