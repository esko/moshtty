import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  TERMINAL_COLOR_SCHEMES,
  loadTerminalColorSchemeKey,
  resolveTerminalColorScheme,
  saveTerminalColorSchemeKey,
  type TerminalColorSchemeKey
} from './terminalThemes'

const STORAGE_KEY = 'moshtty:terminalColorScheme'

describe('resolveTerminalColorScheme', () => {
  it('resolves auto to default-dark when app theme is dark', () => {
    const scheme = resolveTerminalColorScheme('auto', true)
    expect(scheme).toBe(TERMINAL_COLOR_SCHEMES['default-dark'])
    expect(scheme.background).toBe('#121214')
  })

  it('resolves auto to default-light when app theme is light', () => {
    const scheme = resolveTerminalColorScheme('auto', false)
    expect(scheme).toBe(TERMINAL_COLOR_SCHEMES['default-light'])
    expect(scheme.background).toBe('#ffffff')
  })

  it('returns explicit presets unchanged by app theme', () => {
    const draculaDark = resolveTerminalColorScheme('dracula', true)
    const draculaLight = resolveTerminalColorScheme('dracula', false)
    expect(draculaDark).toBe(draculaLight)
    expect(draculaDark.background).toBe('#282a36')
  })

  it('exposes all six named presets', () => {
    const keys: Exclude<TerminalColorSchemeKey, 'auto'>[] = [
      'default-dark',
      'default-light',
      'dracula',
      'catppuccin-mocha',
      'solarized-dark',
      'solarized-light'
    ]
    for (const key of keys) {
      const scheme = resolveTerminalColorScheme(key, false)
      expect(scheme.label).toBe(TERMINAL_COLOR_SCHEMES[key].label)
      expect(scheme.ansi).toHaveLength(16)
    }
  })
})

describe('loadTerminalColorSchemeKey', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
  })

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY)
  })

  it('returns auto when localStorage is empty', () => {
    expect(loadTerminalColorSchemeKey()).toBe('auto')
  })

  it('returns stored valid keys', () => {
    localStorage.setItem(STORAGE_KEY, 'dracula')
    expect(loadTerminalColorSchemeKey()).toBe('dracula')
  })

  it('returns auto when stored value is invalid', () => {
    localStorage.setItem(STORAGE_KEY, 'not-a-theme')
    expect(loadTerminalColorSchemeKey()).toBe('auto')
  })

  it('accepts auto as a stored value', () => {
    localStorage.setItem(STORAGE_KEY, 'auto')
    expect(loadTerminalColorSchemeKey()).toBe('auto')
  })
})

describe('saveTerminalColorSchemeKey', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
  })

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY)
  })

  it('persists the selected key to localStorage', () => {
    saveTerminalColorSchemeKey('catppuccin-mocha')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('catppuccin-mocha')
    expect(loadTerminalColorSchemeKey()).toBe('catppuccin-mocha')
  })

  it('persists auto', () => {
    saveTerminalColorSchemeKey('auto')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('auto')
    expect(loadTerminalColorSchemeKey()).toBe('auto')
  })
})
