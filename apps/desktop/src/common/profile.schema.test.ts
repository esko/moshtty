import { describe, expect, test } from 'vitest'
import {
  MOSHTTY_PROFILE_VERSION,
  MoshttyProfileSchema,
  parseMoshttyProfile,
  parseMoshttyProfileText,
  safeParseMoshttyProfile
} from './profile.schema'

const VALID_CERT_HASH = 'A'.repeat(43) + '='

function validProfile(overrides: Record<string, unknown> = {}): unknown {
  return {
    schemaVersion: MOSHTTY_PROFILE_VERSION,
    remoteId: 'remote-mac-001',
    hostLabel: 'mac mini',
    platform: 'macos',
    serviceVersion: '0.1.0',
    url: 'https://macmini.local:4433/moshtty',
    token: 'secret-token',
    tokenLabel: 'default',
    currentCertHash: VALID_CERT_HASH,
    nextCertHash: null,
    defaults: { cols: 120, rows: 32 },
    ...overrides
  }
}

describe('MoshttyProfileSchema', () => {
  test('accepts a well-formed profile', () => {
    const profile = parseMoshttyProfile(validProfile())
    expect(profile.remoteId).toBe('remote-mac-001')
    expect(profile.token).toBe('secret-token')
    expect(profile.defaults.cols).toBe(120)
  })

  test('normalizes current moshtty-remote profile output', () => {
    const profile = parseMoshttyProfile({
      id: 'remote-mac-current',
      label: 'My Mac',
      host: 'macmini.local',
      platform: 'macos',
      url: 'https://macmini.local:4433',
      token: 'secret-token',
      tokenLabel: 'default',
      currentCertHash: VALID_CERT_HASH,
      serviceVersion: '0.1.0',
      defaults: {
        shell: '/bin/zsh',
        workingDir: '/Users/esko'
      }
    })

    expect(profile).toMatchObject({
      schemaVersion: MOSHTTY_PROFILE_VERSION,
      remoteId: 'remote-mac-current',
      hostLabel: 'My Mac',
      token: 'secret-token',
      nextCertHash: null,
      defaults: {
        cols: 120,
        rows: 32,
        shellHint: '/bin/zsh'
      }
    })
  })

  test('rejects non-https URLs', () => {
    const result = safeParseMoshttyProfile(validProfile({ url: 'http://macmini.local:4433' }))
    expect(result.ok).toBe(false)
  })

  test('rejects malformed cert hashes', () => {
    const result = safeParseMoshttyProfile(validProfile({ currentCertHash: 'not-base64' }))
    expect(result.ok).toBe(false)
  })

  test('rejects mismatched schema versions', () => {
    const result = safeParseMoshttyProfile(validProfile({ schemaVersion: 999 }))
    expect(result.ok).toBe(false)
  })

  test('fills in defaults when omitted', () => {
    const base = validProfile() as Record<string, unknown>
    delete base.defaults
    const parsed = parseMoshttyProfile(base)
    expect(parsed.defaults).toEqual({ cols: 120, rows: 32 })
  })

  test('parseMoshttyProfileText handles invalid JSON gracefully', () => {
    const result = parseMoshttyProfileText('not json')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.issues[0].message).toMatch(/invalid JSON/i)
    }
  })

  test('parseMoshttyProfileText accepts a serialized valid profile', () => {
    const text = JSON.stringify(validProfile())
    const result = parseMoshttyProfileText(text)
    expect(result.ok).toBe(true)
  })

  test('exported schema is the source of truth for the parsed type', () => {
    const profile = MoshttyProfileSchema.parse(validProfile())
    expect(profile.platform).toBe('macos')
  })
})
