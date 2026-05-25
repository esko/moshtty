import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes } from 'crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import type { MoshttySecretStorageInfo, SecretStorageMode } from '../common/moshtty-api'

const PASSPHRASE_META_FILE = 'meta.json'
const SAFE_STORAGE_SUFFIX = '.safe'
const PASSPHRASE_SUFFIX = '.enc'

export interface SafeStorageAdapter {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

export interface SecretStore {
  getStorageInfo(): Promise<MoshttySecretStorageInfo>
  setPassphrase(passphrase: string): Promise<void>
  storeToken(label: string, token: string): Promise<{ mode: SecretStorageMode }>
  loadToken(label: string): Promise<string | null>
  deleteToken(label: string): Promise<void>
}

interface PassphraseMeta {
  salt: string
  verifier: string
}

function sanitizeLabel(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) {
    throw new Error('Token label is required')
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    throw new Error('Token label contains invalid characters')
  }
  return trimmed
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return pbkdf2Sync(passphrase, salt, 120_000, 32, 'sha256')
}

function hashPassphrase(passphrase: string, salt: Buffer): string {
  return createHash('sha256').update(salt).update(':').update(passphrase).digest('base64')
}

function encryptWithPassphrase(plainText: string, passphrase: string, salt: Buffer): string {
  const key = deriveKey(passphrase, salt)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return JSON.stringify({
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64')
  })
}

function decryptWithPassphrase(payload: string, passphrase: string, salt: Buffer): string {
  const parsed = JSON.parse(payload) as { iv?: string; tag?: string; data?: string }
  if (!parsed.iv || !parsed.tag || !parsed.data) {
    throw new Error('Encrypted token payload is invalid')
  }

  const key = deriveKey(passphrase, salt)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, 'base64')),
    decipher.final()
  ])
  return decrypted.toString('utf8')
}

export function createSecretStore(options: {
  userDataPath: string | (() => string)
  safeStorage?: SafeStorageAdapter
}): SecretStore {
  const resolveUserDataPath = (): string =>
    typeof options.userDataPath === 'function' ? options.userDataPath() : options.userDataPath

  const secretsDirectory = (): string => join(resolveUserDataPath(), 'secrets')
  const safeStorage = options.safeStorage
  let passphrase: string | null = null
  let passphraseMeta: PassphraseMeta | null = null

  async function ensureSecretsDirectory(): Promise<string> {
    const directory = secretsDirectory()
    await mkdir(directory, { recursive: true })
    return directory
  }

  async function readPassphraseMeta(): Promise<PassphraseMeta | null> {
    if (passphraseMeta) {
      return passphraseMeta
    }

    try {
      const raw = await readFile(join(secretsDirectory(), PASSPHRASE_META_FILE), 'utf8')
      passphraseMeta = JSON.parse(raw) as PassphraseMeta
      return passphraseMeta
    } catch {
      return null
    }
  }

  async function writePassphraseMeta(meta: PassphraseMeta): Promise<void> {
    const directory = await ensureSecretsDirectory()
    await writeFile(
      join(directory, PASSPHRASE_META_FILE),
      `${JSON.stringify(meta, null, 2)}\n`,
      'utf8'
    )
    passphraseMeta = meta
  }

  function resolveMode(): SecretStorageMode {
    if (safeStorage?.isEncryptionAvailable()) {
      return 'safeStorage'
    }
    if (passphrase) {
      return 'passphrase'
    }
    return 'unavailable'
  }

  function safeStoragePath(label: string): string {
    return join(secretsDirectory(), `${label}${SAFE_STORAGE_SUFFIX}`)
  }

  function passphrasePath(label: string): string {
    return join(secretsDirectory(), `${label}${PASSPHRASE_SUFFIX}`)
  }

  async function requirePassphrase(): Promise<{ passphrase: string; meta: PassphraseMeta }> {
    const meta = await readPassphraseMeta()
    if (!passphrase || !meta) {
      throw new Error('Passphrase is required before storing remote tokens')
    }
    if (hashPassphrase(passphrase, Buffer.from(meta.salt, 'base64')) !== meta.verifier) {
      throw new Error('Passphrase verification failed')
    }
    return { passphrase, meta }
  }

  return {
    async getStorageInfo(): Promise<MoshttySecretStorageInfo> {
      const directory = await ensureSecretsDirectory()
      return {
        mode: resolveMode(),
        encryptionAvailable: safeStorage?.isEncryptionAvailable() ?? false,
        secretsDirectory: directory
      }
    },

    async setPassphrase(nextPassphrase: string): Promise<void> {
      if (nextPassphrase.trim().length < 8) {
        throw new Error('Passphrase must be at least 8 characters')
      }
      if (safeStorage?.isEncryptionAvailable()) {
        passphrase = null
        return
      }

      const salt = randomBytes(16)
      const meta: PassphraseMeta = {
        salt: salt.toString('base64'),
        verifier: hashPassphrase(nextPassphrase, salt)
      }
      await writePassphraseMeta(meta)
      passphrase = nextPassphrase
    },

    async storeToken(label: string, token: string): Promise<{ mode: SecretStorageMode }> {
      const safeLabel = sanitizeLabel(label)
      if (!token.trim()) {
        throw new Error('Token value is required')
      }

      await ensureSecretsDirectory()

      if (safeStorage?.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(token)
        await writeFile(safeStoragePath(safeLabel), encrypted)
        await rm(passphrasePath(safeLabel), { force: true })
        return { mode: 'safeStorage' }
      }

      const { passphrase: activePassphrase, meta } = await requirePassphrase()
      const encrypted = encryptWithPassphrase(
        token,
        activePassphrase,
        Buffer.from(meta.salt, 'base64')
      )
      await writeFile(passphrasePath(safeLabel), encrypted, 'utf8')
      await rm(safeStoragePath(safeLabel), { force: true })
      return { mode: 'passphrase' }
    },

    async loadToken(label: string): Promise<string | null> {
      const safeLabel = sanitizeLabel(label)

      try {
        const encrypted = await readFile(safeStoragePath(safeLabel))
        if (safeStorage?.isEncryptionAvailable()) {
          return safeStorage.decryptString(encrypted)
        }
      } catch {
        // Fall through to passphrase storage.
      }

      try {
        const encrypted = await readFile(passphrasePath(safeLabel), 'utf8')
        const { passphrase: activePassphrase, meta } = await requirePassphrase()
        return decryptWithPassphrase(encrypted, activePassphrase, Buffer.from(meta.salt, 'base64'))
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          (error as NodeJS.ErrnoException).code === 'ENOENT'
        ) {
          return null
        }
        throw error
      }
    },

    async deleteToken(label: string): Promise<void> {
      const safeLabel = sanitizeLabel(label)
      await rm(safeStoragePath(safeLabel), { force: true })
      await rm(passphrasePath(safeLabel), { force: true })
    }
  }
}

export async function listStoredSecretLabels(secretsDirectory: string): Promise<string[]> {
  try {
    const entries = await readdir(secretsDirectory)
    return entries
      .map((entry) => {
        if (entry.endsWith(SAFE_STORAGE_SUFFIX)) {
          return entry.slice(0, -SAFE_STORAGE_SUFFIX.length)
        }
        if (entry.endsWith(PASSPHRASE_SUFFIX)) {
          return entry.slice(0, -PASSPHRASE_SUFFIX.length)
        }
        return null
      })
      .filter((entry): entry is string => Boolean(entry))
  } catch {
    return []
  }
}
