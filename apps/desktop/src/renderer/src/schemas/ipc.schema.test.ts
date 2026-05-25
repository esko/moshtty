import { describe, expect, it } from 'vitest'
import { validateAppInfo, validateSecretStorageInfo, IpcValidationError } from './ipc.schema'

const validAppInfo = {
  name: 'Moshtty',
  protocolUrl: 'app://moshtty/index.html',
  stateFilePath: '/home/user/.config/Moshtty/moshtty-state.json'
}

const validSecretInfo = {
  mode: 'safeStorage' as const,
  encryptionAvailable: true,
  secretsDirectory: '/home/user/.config/Moshtty/secrets'
}

describe('validateAppInfo', () => {
  it('accepts valid app info', () => {
    expect(validateAppInfo(validAppInfo)).toEqual(validAppInfo)
  })

  it('throws on empty name', () => {
    expect(() => validateAppInfo({ ...validAppInfo, name: '' })).toThrow(IpcValidationError)
  })

  it('throws on missing fields', () => {
    expect(() => validateAppInfo({ name: 'test' })).toThrow(IpcValidationError)
  })
})

describe('validateSecretStorageInfo', () => {
  it('accepts valid secret info', () => {
    expect(validateSecretStorageInfo(validSecretInfo)).toEqual(validSecretInfo)
  })

  it('throws on invalid mode', () => {
    expect(() =>
      validateSecretStorageInfo({ ...validSecretInfo, mode: 'unknown' })
    ).toThrow(IpcValidationError)
  })
})
