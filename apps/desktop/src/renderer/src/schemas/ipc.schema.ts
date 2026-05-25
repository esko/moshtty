import { z } from 'zod'
import type { MoshttyAppInfo, MoshttySecretStorageInfo } from '../../../common/moshtty-api'

export const appInfoSchema = z.object({
  name: z.string().min(1),
  protocolUrl: z.string().min(1),
  stateFilePath: z.string().min(1)
}) satisfies z.ZodType<MoshttyAppInfo>

export const secretModeSchema = z.enum(['safeStorage', 'passphrase', 'unavailable'])

export const secretStorageInfoSchema = z.object({
  mode: secretModeSchema,
  encryptionAvailable: z.boolean(),
  secretsDirectory: z.string().min(1)
}) satisfies z.ZodType<MoshttySecretStorageInfo>

export class IpcValidationError extends Error {
  public readonly fieldErrors: Record<string, string>

  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'IpcValidationError'
    this.fieldErrors = fieldErrors
  }
}

export function validateAppInfo(data: unknown): MoshttyAppInfo {
  const result = appInfoSchema.safeParse(data)
  if (!result.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join('.')
      if (!fieldErrors[path]) {
        fieldErrors[path] = issue.message
      }
    }
    throw new IpcValidationError('Invalid app info from main process', fieldErrors)
  }
  return result.data
}

export function validateSecretStorageInfo(data: unknown): MoshttySecretStorageInfo {
  const result = secretStorageInfoSchema.safeParse(data)
  if (!result.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join('.')
      if (!fieldErrors[path]) {
        fieldErrors[path] = issue.message
      }
    }
    throw new IpcValidationError('Invalid secret storage info from main process', fieldErrors)
  }
  return result.data
}
