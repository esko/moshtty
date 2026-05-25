import { z } from 'zod'

export const profileSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  host: z.string().min(1),
  platform: z.enum(['macos', 'linux', 'unknown']),
  url: z.string().url(),
  token: z.string().min(1),
  tokenLabel: z.string(),
  currentCertHash: z.string().min(1),
  nextCertHash: z.string().optional(),
  serviceVersion: z.string().min(1),
  defaults: z.object({
    shell: z.string(),
    workingDir: z.string()
  }),
  allowedOrigins: z.array(z.string()).optional(),
  generatedAt: z.string().datetime()
})

export type MoshttyImportProfile = z.infer<typeof profileSchema>

export interface ProfileParseResult {
  profile: MoshttyImportProfile
  errors: { field: string; message: string }[]
}

export function parseMoshttyProfileText(text: string): ProfileParseResult {
  const errors: { field: string; message: string }[] = []

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { profile: null as unknown as MoshttyImportProfile, errors: [{ field: 'json', message: 'Invalid JSON' }] }
  }

  const result = profileSchema.safeParse(parsed)
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push({ field: issue.path.join('.'), message: issue.message })
    }
    return { profile: null as unknown as MoshttyImportProfile, errors }
  }

  return { profile: result.data, errors: [] }
}
