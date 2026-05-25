/**
 * zod schemas for the Electron IPC contract between renderer, preload, and
 * main. Mirrors the shapes in `./moshtty-api.ts` and is the trust boundary
 * for renderer -> main payloads.
 *
 * Main process MUST validate every IPC request body with the matching
 * schema before acting on it. Renderer SHOULD validate responses where the
 * payload originates from disk or external input (state load, profile
 * import, secret info).
 *
 * Editing this file changes the IPC trust contract — coordinate before
 * editing.
 */

import { z } from 'zod'
import { MoshttyProfileSchema } from './profile.schema'
import { MoshttyStateSchema } from './state.schema'

export const SecretStorageModeSchema = z.enum(['safeStorage', 'passphrase', 'unavailable'])

export const MoshttyAppInfoSchema = z.object({
  name: z.string().min(1),
  protocolUrl: z.string().min(1),
  stateFilePath: z.string().min(1)
})

export const MoshttySecretStorageInfoSchema = z.object({
  mode: SecretStorageModeSchema,
  encryptionAvailable: z.boolean(),
  secretsDirectory: z.string().min(1)
})

export const StateLoadResultSchema = z.object({
  state: MoshttyStateSchema,
  source: z.enum(['disk', 'default', 'recovered', 'migrated']),
  warning: z.string().optional(),
  migratedFrom: z.number().int().nonnegative().optional()
})

/* Request payload schemas (renderer -> main). */

export const SaveStateRequestSchema = MoshttyStateSchema

export const SetPassphraseRequestSchema = z
  .object({
    passphrase: z.string().min(1)
  })
  .strict()

export const TokenRequestSchema = z
  .object({
    label: z.string().min(1).max(64)
  })
  .strict()

export const StoreTokenRequestSchema = z
  .object({
    label: z.string().min(1).max(64),
    token: z.string().min(1)
  })
  .strict()

export const StoreTokenResponseSchema = z
  .object({
    mode: SecretStorageModeSchema
  })
  .strict()

export const LoadTokenResponseSchema = z.string().nullable()

/**
 * Profile import is renderer-side; the IPC layer never sees the raw paste
 * unless the user asks to persist the profile to disk through main. When
 * that path lands, this schema is the request body.
 */
export const ImportProfileRequestSchema = z
  .object({
    profile: MoshttyProfileSchema
  })
  .strict()

export type IpcAppInfo = z.infer<typeof MoshttyAppInfoSchema>
export type IpcSecretStorageInfo = z.infer<typeof MoshttySecretStorageInfoSchema>
export type IpcStateLoadResult = z.infer<typeof StateLoadResultSchema>
export type IpcStoreTokenResponse = z.infer<typeof StoreTokenResponseSchema>

/**
 * Helper for main-process IPC handlers. Wraps `safeParse` with a uniform
 * error so the IPC layer can throw a single `IpcValidationError` and the
 * renderer can map it to a typed error.
 */
export class IpcValidationError extends Error {
  constructor(
    public readonly channel: string,
    public readonly zodError: z.ZodError
  ) {
    super(
      `IPC validation failed on ${channel}: ${zodError.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ')}`
    )
    this.name = 'IpcValidationError'
  }
}

export function assertIpcPayload<TSchema extends z.ZodTypeAny>(
  channel: string,
  schema: TSchema,
  input: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(input)
  if (result.success) {
    return result.data
  }
  throw new IpcValidationError(channel, result.error)
}
