# M2 Follow-up: safeStorage on-device verification

## Context

M2 desktop state shell is **Ready for review** but not **Verified on target**. The `safeStorage` token store was unit-tested but never exercised in a live Electron session on this Crostini host.

## Objective

Run a live Electron session on the Crostini host and verify `safeStorage` availability, token round-trip, and passphrase fallback behavior. Capture screenshots and console transcripts as evidence.

## Steps

1. Build and launch the Electron app: `pnpm --filter @moshtty/desktop build && electron .`
2. Open DevTools console (Ctrl+Shift+I).
3. Run `window.moshtty.getSecretStorageInfo()` to check `safeStorage` availability.
4. If `safeStorage` encryption is available, test token store/load/delete cycle.
5. If unavailable, test passphrase fallback: `setPassphrase(...)`, store/load token, verify encryption.
6. Capture screenshots of both states (safeStorage available or passphrase flow).

## Verification

- Screenshot of DevTools console showing `window.moshtty.getSecretStorageInfo()` output
- Screenshot of successful token round-trip
- If passphrase mode: screenshot of passphrase set + token store/load
- Promote M2 to **Verified on target** in PRD after successful run

## Scope

Same globs as parent brief (2026-05-25-2-desktop-state-shell.md):

- `apps/desktop/src/main/**`
- `apps/desktop/src/preload/**`
- `apps/desktop/src/common/state*`
