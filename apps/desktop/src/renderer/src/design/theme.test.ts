import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import {
  resolveThemeMode,
  resolveTerminalThemeMode,
  applyThemeAttribute,
  useResolvedThemeMode
} from './theme'
import type { ThemeMode } from '../../../common/state'

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

describe('applyThemeAttribute', () => {
  it('sets data-theme attribute on the provided element', () => {
    const el = document.createElement('div')
    applyThemeAttribute('dark', el)
    expect(el.getAttribute('data-theme')).toBe('dark')
  })

  it('sets data-theme on document.documentElement if no target provided', () => {
    applyThemeAttribute('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})

describe('useResolvedThemeMode', () => {
  let container: HTMLDivElement | null = null
  const matchMediaListeners = new Set<(e: MediaQueryListEvent) => void>()

  const mockMatchMedia = (matches: boolean): unknown => {
    return vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn().mockImplementation((event, cb) => {
        if (event === 'change') matchMediaListeners.add(cb)
      }),
      removeEventListener: vi.fn().mockImplementation((event, cb) => {
        if (event === 'change') matchMediaListeners.delete(cb)
      }),
      dispatchEvent: vi.fn()
    }))
  }

  const TestComponent = ({ setting }: { setting: ThemeMode }): React.ReactElement => {
    const mode = useResolvedThemeMode(setting)
    return React.createElement('div', { 'data-testid': 'theme-val' }, mode)
  }

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    matchMediaListeners.clear()
  })

  afterEach(() => {
    if (container) {
      document.body.removeChild(container)
      container = null
    }
  })

  it('resolves explicit light theme', async () => {
    const root = createRoot(container!)
    act(() => {
      root.render(React.createElement(TestComponent, { setting: 'light' }))
    })
    await new Promise((r) => setTimeout(r, 0))
    const el = container!.querySelector('[data-testid="theme-val"]')
    expect(el?.textContent).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('resolves system dark theme preference', async () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(true))
    const root = createRoot(container!)
    act(() => {
      root.render(React.createElement(TestComponent, { setting: 'system' }))
    })
    await new Promise((r) => setTimeout(r, 0))
    const el = container!.querySelector('[data-testid="theme-val"]')
    expect(el?.textContent).toBe('dark')
    vi.unstubAllGlobals()
  })

  it('reacts to system preference change', async () => {
    let matches = false
    const matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn().mockImplementation((event, cb) => {
        if (event === 'change') matchMediaListeners.add(cb)
      }),
      removeEventListener: vi.fn().mockImplementation((event, cb) => {
        if (event === 'change') matchMediaListeners.delete(cb)
      }),
      dispatchEvent: vi.fn()
    }))
    vi.stubGlobal('matchMedia', matchMediaMock)

    const root = createRoot(container!)
    act(() => {
      root.render(React.createElement(TestComponent, { setting: 'system' }))
    })
    await new Promise((r) => setTimeout(r, 0))
    let el = container!.querySelector('[data-testid="theme-val"]')
    expect(el?.textContent).toBe('light')

    matches = true
    act(() => {
      matchMediaListeners.forEach((cb) => cb({ matches: true } as MediaQueryListEvent))
    })
    await new Promise((r) => setTimeout(r, 0))
    el = container!.querySelector('[data-testid="theme-val"]')
    expect(el?.textContent).toBe('dark')

    vi.unstubAllGlobals()
  })
})
