import { describe, expect, it } from 'vitest'
import { resolveThemeMode, resolveTerminalThemeMode } from './theme'

describe('resolveThemeMode', () => {
  it('returns light when setting is light', () => {
    expect(resolveThemeMode('light', 'dark')).toBe('light')
  })

  it('returns dark when setting is dark', () => {
    expect(resolveThemeMode('dark', 'light')).toBe('dark')
  })

  it('falls back to system when setting is system', () => {
    expect(resolveThemeMode('system', 'dark')).toBe('dark')
    expect(resolveThemeMode('system', 'light')).toBe('light')
  })

  it('defaults system to light when no preference', () => {
    expect(resolveThemeMode('system', 'light')).toBe('light')
  })
})

describe('resolveTerminalThemeMode', () => {
  it('follows app mode by default', () => {
    expect(resolveTerminalThemeMode('follow-app', 'dark')).toBe('dark')
    expect(resolveTerminalThemeMode('follow-app', 'light')).toBe('light')
  })

  it('respects explicit light override', () => {
    expect(resolveTerminalThemeMode('light', 'dark')).toBe('light')
  })

  it('respects explicit dark override', () => {
    expect(resolveTerminalThemeMode('dark', 'light')).toBe('dark')
  })
})
