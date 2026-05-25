import { describe, expect, test } from 'vitest'
import {
  IpcValidationError,
  MoshttyAppInfoSchema,
  MoshttySecretStorageInfoSchema,
  SaveStateRequestSchema,
  SetPassphraseRequestSchema,
  StateLoadResultSchema,
  StoreTokenRequestSchema,
  TokenRequestSchema,
  assertIpcPayload
} from './ipc.schema'
import { createSampleState } from './state'

describe('MoshttyAppInfoSchema', () => {
  test('requires non-empty strings on every field', () => {
    expect(
      MoshttyAppInfoSchema.safeParse({
        name: 'Moshtty',
        protocolUrl: 'app://moshtty',
        stateFilePath: '/tmp/state.json'
      }).success
    ).toBe(true)

    expect(
      MoshttyAppInfoSchema.safeParse({
        name: '',
        protocolUrl: 'app://moshtty',
        stateFilePath: '/tmp/state.json'
      }).success
    ).toBe(false)
  })
})

describe('MoshttySecretStorageInfoSchema', () => {
  test('locks the secret storage mode to the allowed enum', () => {
    expect(
      MoshttySecretStorageInfoSchema.safeParse({
        mode: 'safeStorage',
        encryptionAvailable: true,
        secretsDirectory: '/tmp/secrets'
      }).success
    ).toBe(true)

    expect(
      MoshttySecretStorageInfoSchema.safeParse({
        mode: 'magic',
        encryptionAvailable: true,
        secretsDirectory: '/tmp/secrets'
      }).success
    ).toBe(false)
  })
})

describe('StateLoadResultSchema', () => {
  test('accepts a real state load result', () => {
    const result = StateLoadResultSchema.safeParse({
      state: createSampleState('2026-05-25T00:00:00.000Z'),
      source: 'disk'
    })
    expect(result.success).toBe(true)
  })

  test('rejects unknown source values', () => {
    const result = StateLoadResultSchema.safeParse({
      state: createSampleState('2026-05-25T00:00:00.000Z'),
      source: 'cloud'
    })
    expect(result.success).toBe(false)
  })
})

describe('request payload schemas', () => {
  test('SaveStateRequestSchema mirrors the state schema', () => {
    const state = createSampleState('2026-05-25T00:00:00.000Z')
    expect(SaveStateRequestSchema.safeParse(state).success).toBe(true)
  })

  test('SetPassphraseRequestSchema rejects empty and extra fields', () => {
    expect(SetPassphraseRequestSchema.safeParse({ passphrase: '' }).success).toBe(false)
    expect(SetPassphraseRequestSchema.safeParse({ passphrase: 'ok', extra: 1 }).success).toBe(false)
    expect(SetPassphraseRequestSchema.safeParse({ passphrase: 'ok' }).success).toBe(true)
  })

  test('TokenRequestSchema and StoreTokenRequestSchema bound label length', () => {
    expect(TokenRequestSchema.safeParse({ label: 'default' }).success).toBe(true)
    expect(TokenRequestSchema.safeParse({ label: 'x'.repeat(65) }).success).toBe(false)
    expect(StoreTokenRequestSchema.safeParse({ label: 'default', token: 'abc' }).success).toBe(true)
  })
})

describe('assertIpcPayload', () => {
  test('returns parsed data when the schema matches', () => {
    const data = assertIpcPayload('moshtty:test', SetPassphraseRequestSchema, {
      passphrase: 'hunter2'
    })
    expect(data.passphrase).toBe('hunter2')
  })

  test('throws IpcValidationError with channel and field path', () => {
    expect.assertions(3)
    try {
      assertIpcPayload('moshtty:secret:set-passphrase', SetPassphraseRequestSchema, {})
    } catch (error) {
      expect(error).toBeInstanceOf(IpcValidationError)
      const ipcError = error as IpcValidationError
      expect(ipcError.channel).toBe('moshtty:secret:set-passphrase')
      expect(ipcError.message).toMatch(/passphrase/)
    }
  })
})
