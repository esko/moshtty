/**
 * zod schema for the Moshtty remote profile JSON.
 *
 * `moshtty-remote profile` (Go side, see `cmd/moshtty-remote` and
 * `internal/profile/`) emits a pasteable JSON blob that the Electron app
 * imports to learn about a remote: URL, auth token reference, WebTransport
 * cert hashes, host metadata, and default settings.
 *
 * This schema is the trust boundary for that import. Any profile that
 * arrives via paste, file, or clipboard MUST go through
 * `parseMoshttyProfile` before being stored in app state.
 *
 * Critical: the actual token VALUE never travels through the profile JSON.
 * Only the `tokenLabel` does — the user pastes the token separately, or
 * it lives in a companion-side secret store keyed by that label. If you
 * are tempted to add a `token` field here, stop and surface to the
 * coordinator (this is a stop condition).
 *
 * Schema version: 1. Increment `MOSHTTY_PROFILE_VERSION` and add a
 * migration entry whenever the field shape changes. Go-side emitters must
 * track this version too — keep it in sync via the M3 brief.
 */

import { z } from 'zod'
import { RemotePlatformSchema } from './state.schema'

export const MOSHTTY_PROFILE_VERSION = 1 as const

/** Standard base64 of the SHA-256 of an X.509 DER. 32 raw bytes -> 44 chars. */
const CertHashSchema = z.string().regex(/^[A-Za-z0-9+/]{43}=$/, {
  message: 'cert hash must be standard base64 of a 32-byte SHA-256 (44 chars)'
})

const HttpsUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), {
    message: 'profile URL must be https'
  })

const TokenLabelSchema = z.string().min(1).max(64)

export const MoshttyProfileDefaultsSchema = z.object({
  /** Default pane cols/rows the renderer should request on attach. */
  cols: z.number().int().positive().default(120),
  rows: z.number().int().positive().default(32),
  /** Default shell hint; renderer may override per pane. */
  shellHint: z.string().optional()
})

export const MoshttyProfileSchema = z.object({
  /** Profile JSON schema version; matched against `MOSHTTY_PROFILE_VERSION`. */
  schemaVersion: z.literal(MOSHTTY_PROFILE_VERSION),
  /** Stable remote ID assigned by the companion. */
  remoteId: z.string().min(1),
  /** Friendly host label shown in the UI. */
  hostLabel: z.string().min(1),
  /** OS family of the host. */
  platform: RemotePlatformSchema,
  /** Service version (`moshtty-remote --version`). */
  serviceVersion: z.string().min(1),
  /** WebTransport URL the renderer dials. */
  url: HttpsUrlSchema,
  /**
   * Token label only — the actual token value never travels through the
   * profile JSON. The user pastes the token separately or it lives in a
   * companion-side secret store referenced by this label.
   */
  tokenLabel: TokenLabelSchema,
  /** Current short-lived WT cert hash. */
  currentCertHash: CertHashSchema,
  /**
   * Optional next cert hash, published while connected so the renderer can
   * pin both during rotation. Null if the companion has not generated one.
   */
  nextCertHash: CertHashSchema.nullable(),
  /** Issued/expires timestamps (RFC 3339) for the current cert. */
  currentCertIssuedAt: z.string().datetime().optional(),
  currentCertExpiresAt: z.string().datetime().optional(),
  defaults: MoshttyProfileDefaultsSchema.default({ cols: 120, rows: 32 })
})

export type ParsedMoshttyProfile = z.infer<typeof MoshttyProfileSchema>

export type ProfileParseResult =
  | { ok: true; profile: ParsedMoshttyProfile }
  | { ok: false; error: z.ZodError }

export function parseMoshttyProfile(input: unknown): ParsedMoshttyProfile {
  return MoshttyProfileSchema.parse(input)
}

export function safeParseMoshttyProfile(input: unknown): ProfileParseResult {
  const result = MoshttyProfileSchema.safeParse(input)
  if (result.success) {
    return { ok: true, profile: result.data }
  }
  return { ok: false, error: result.error }
}

/**
 * Renderer-facing helper for clipboard/file import flows. Accepts either an
 * already-parsed object or a JSON string. Returns a structured result so the
 * UI can show specific field errors instead of a stack trace.
 */
export function parseMoshttyProfileText(text: string): ProfileParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return {
      ok: false,
      error: new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: [],
          message: error instanceof Error ? `invalid JSON: ${error.message}` : 'invalid JSON'
        }
      ])
    }
  }
  return safeParseMoshttyProfile(parsed)
}
