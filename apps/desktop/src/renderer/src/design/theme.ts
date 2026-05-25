import { useEffect, useState } from 'react'
import type { TerminalThemeMode, ThemeMode } from '../../../common/state'

export type ResolvedThemeMode = 'light' | 'dark'

export const THEME_ATTRIBUTE = 'data-theme'

function readSystemPreference(): ResolvedThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveThemeMode(
  setting: ThemeMode,
  systemPreference: ResolvedThemeMode = readSystemPreference()
): ResolvedThemeMode {
  if (setting === 'light' || setting === 'dark') {
    return setting
  }
  return systemPreference
}

export function resolveTerminalThemeMode(
  setting: TerminalThemeMode,
  resolvedApp: ResolvedThemeMode
): ResolvedThemeMode {
  if (setting === 'light' || setting === 'dark') {
    return setting
  }
  return resolvedApp
}

export function applyThemeAttribute(mode: ThemeMode, target?: HTMLElement | null): void {
  const root = target ?? (typeof document === 'undefined' ? null : document.documentElement)
  if (!root) {
    return
  }
  root.setAttribute(THEME_ATTRIBUTE, mode)
}

export function useResolvedThemeMode(setting: ThemeMode): ResolvedThemeMode {
  const [systemPreference, setSystemPreference] = useState<ResolvedThemeMode>(() =>
    readSystemPreference()
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent): void => {
      setSystemPreference(event.matches ? 'dark' : 'light')
    }
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    applyThemeAttribute(setting)
  }, [setting])

  return resolveThemeMode(setting, systemPreference)
}
