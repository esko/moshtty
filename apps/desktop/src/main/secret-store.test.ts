import { mkdtemp, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, test } from 'vitest'
import { createSecretStore, listStoredSecretLabels, type SafeStorageAdapter } from './secret-store'

function createMockSafeStorage(): SafeStorageAdapter {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (plainText) => Buffer.from(`enc:${plainText}`, 'utf8'),
    decryptString: (encrypted) => encrypted.toString('utf8').replace(/^enc:/, '')
  }
}

describe('createSecretStore', () => {
  test('stores and loads tokens with safeStorage without writing plaintext', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'moshtty-secrets-'))
    const store = createSecretStore({
      userDataPath,
      safeStorage: createMockSafeStorage()
    })

    const result = await store.storeToken('remote-a', 'secret-token-value')
    expect(result.mode).toBe('safeStorage')

    const loaded = await store.loadToken('remote-a')
    expect(loaded).toBe('secret-token-value')

    const info = await store.getStorageInfo()
    const stored = await readFile(join(info.secretsDirectory, 'remote-a.safe'))
    expect(stored.toString('utf8')).not.toBe('secret-token-value')
    expect(stored.toString('utf8')).toMatch(/^enc:/)
  })

  test('uses passphrase fallback when safeStorage is unavailable', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'moshtty-secrets-'))
    const store = createSecretStore({
      userDataPath,
      safeStorage: {
        isEncryptionAvailable: () => false,
        encryptString: () => Buffer.from('unused'),
        decryptString: () => 'unused'
      }
    })

    await store.setPassphrase('local-dev-passphrase')
    const result = await store.storeToken('remote-b', 'fallback-token')
    expect(result.mode).toBe('passphrase')

    const loaded = await store.loadToken('remote-b')
    expect(loaded).toBe('fallback-token')

    const info = await store.getStorageInfo()
    const stored = await readFile(join(info.secretsDirectory, 'remote-b.enc'), 'utf8')
    expect(stored).not.toContain('fallback-token')
    expect(await listStoredSecretLabels(info.secretsDirectory)).toContain('remote-b')
  })

  test('rejects storing tokens without a configured passphrase fallback', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'moshtty-secrets-'))
    const store = createSecretStore({
      userDataPath,
      safeStorage: {
        isEncryptionAvailable: () => false,
        encryptString: () => Buffer.from('unused'),
        decryptString: () => 'unused'
      }
    })

    await expect(store.storeToken('remote-c', 'missing-passphrase')).rejects.toThrow(
      /Passphrase is required/
    )
  })
})
