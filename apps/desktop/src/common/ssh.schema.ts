import { z } from 'zod'
import type { ParsedMoshttyProfile } from './profile.schema'

const NonEmptyString = z.string().min(1)
const PortNumber = z.number().int().min(1).max(65535)

export const SshBootstrapConfigSchema = z.object({
  host: NonEmptyString,
  port: PortNumber.default(22),
  username: NonEmptyString,
  authType: z.enum(['password', 'key']),
  password: z.string().optional(),
  keyPath: z.string().optional(),
  passphrase: z.string().optional(),
  destination: z.string().default('~/.local/bin/moshtty-remote')
})

export type SshBootstrapConfig = z.infer<typeof SshBootstrapConfigSchema>

export interface SshBootstrapResult {
  success: boolean
  error?: string
  profile?: ParsedMoshttyProfile
}
