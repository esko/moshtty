import { describe, expect, test } from 'vitest'
import { SshBootstrapConfigSchema } from './ssh.schema'

describe('SshBootstrapConfigSchema', () => {
  test('accepts valid config with standard key auth', () => {
    const config = SshBootstrapConfigSchema.parse({
      host: '10.0.0.5',
      username: 'esko',
      authType: 'key',
      keyPath: '~/.ssh/id_ed25519'
    })
    expect(config.host).toBe('10.0.0.5')
    expect(config.port).toBe(22)
    expect(config.destination).toBe('~/.local/bin/moshtty-remote')
  })

  test('accepts valid config with password auth', () => {
    const config = SshBootstrapConfigSchema.parse({
      host: 'localhost',
      port: 2222,
      username: 'developer',
      authType: 'password',
      password: 'supersecretpassword',
      destination: '/tmp/moshtty-remote'
    })
    expect(config.host).toBe('localhost')
    expect(config.port).toBe(2222)
    expect(config.authType).toBe('password')
    expect(config.password).toBe('supersecretpassword')
    expect(config.destination).toBe('/tmp/moshtty-remote')
  })

  test('rejects missing host or username', () => {
    const result = SshBootstrapConfigSchema.safeParse({
      username: 'esko',
      authType: 'key'
    })
    expect(result.success).toBe(false)
  })

  test('rejects invalid ports', () => {
    const result = SshBootstrapConfigSchema.safeParse({
      host: 'localhost',
      username: 'esko',
      authType: 'key',
      port: 99999
    })
    expect(result.success).toBe(false)
  })
})
