import { describe, expect, it } from 'vitest'
import { parseMoshttyProfileText } from './profile.schema'

const validProfile = JSON.stringify({
  id: 'remote-001',
  label: 'Mac Mini',
  host: '192.168.1.100',
  platform: 'macos',
  url: 'https://192.168.1.100:4433',
  token: 'abc123def456',
  tokenLabel: 'default',
  currentCertHash: 'abcdefghijklmnopqrstuvwxyz123456',
  serviceVersion: '0.1.0',
  defaults: { shell: '/bin/zsh', workingDir: '/Users/esko' },
  allowedOrigins: ['app://moshtty'],
  generatedAt: '2026-05-25T12:00:00.000Z'
})

describe('parseMoshttyProfileText', () => {
  it('parses a valid profile', () => {
    const result = parseMoshttyProfileText(validProfile)
    expect(result.errors).toHaveLength(0)
    expect(result.profile.label).toBe('Mac Mini')
    expect(result.profile.platform).toBe('macos')
  })

  it('rejects invalid JSON', () => {
    const result = parseMoshttyProfileText('not json')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].field).toBe('json')
  })

  it('rejects profile with empty label', () => {
    const invalid = JSON.stringify({ ...JSON.parse(validProfile), label: '' })
    const result = parseMoshttyProfileText(invalid)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejects profile with missing URL', () => {
    const { url, ...rest } = JSON.parse(validProfile)
    const result = parseMoshttyProfileText(JSON.stringify(rest))
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejects profile with non-macos platform', () => {
    const invalid = JSON.stringify({ ...JSON.parse(validProfile), platform: 'windows' })
    const result = parseMoshttyProfileText(invalid)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
