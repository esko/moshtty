export type ColorScale = {
  appBg: string
  sidebarBg: string
  sidebarBgActive: string
  workspaceBg: string
  terminalBg: string
  border: string
  borderStrong: string
  textMain: string
  textMuted: string
  textSubtle: string
  textTerminal: string
  accent: string
  accentSoft: string
  accentOn: string
  success: string
  warning: string
  danger: string
  focus: string
  glassBg: string
  glassBorder: string
}

export const lightColors: ColorScale = {
  appBg: '#f9f9fb',
  sidebarBg: '#f5f5f7',
  sidebarBgActive: '#e2e2e8',
  workspaceBg: '#ffffff',
  terminalBg: '#ffffff',
  border: '#e5e5e8',
  borderStrong: '#c8c8d0',
  textMain: '#202024',
  textMuted: '#64646c',
  textSubtle: '#6d6d75',
  textTerminal: '#1a1a1f',
  accent: '#4f46e5',
  accentSoft: '#eef2ff',
  accentOn: '#ffffff',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  focus: '#4f46e5',
  glassBg: 'rgba(255, 255, 255, 0.72)',
  glassBorder: 'rgba(0, 0, 0, 0.08)'
}

export const darkColors: ColorScale = {
  appBg: '#18181b',
  sidebarBg: '#141416',
  sidebarBgActive: '#2a2a30',
  workspaceBg: '#1c1c1f',
  terminalBg: '#18181b',
  border: '#2a2a2e',
  borderStrong: '#333338',
  textMain: '#e4e4e7',
  textMuted: '#71717a',
  textSubtle: '#6c6c78',
  textTerminal: '#e2e2e8',
  accent: '#818cf8',
  accentSoft: '#1e1b4b',
  accentOn: '#0b0b0e',
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#f87171',
  focus: '#a5b4fc',
  glassBg: 'rgba(24, 24, 28, 0.62)',
  glassBorder: 'rgba(255, 255, 255, 0.08)'
}

export const space = {
  '2xs': 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48
} as const

export type SpaceToken = keyof typeof space

export const radius = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 10,
  pill: 9999
} as const

export type RadiusToken = keyof typeof radius

export const fontSize = {
  caption: 11,
  small: 12,
  body: 13,
  bodyLg: 14,
  title: 16,
  heading: 20
} as const

export type FontSizeToken = keyof typeof fontSize

export const lineHeight = {
  tight: 1.2,
  body: 1.5,
  loose: 1.7
} as const

export const fontFamily = {
  ui: `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif`,
  mono: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`
} as const

export const border = {
  hairline: '1px solid var(--color-border)',
  control: '1px solid var(--color-border-strong)'
} as const

export const elevation = {
  none: 'none',
  popover: '0 4px 12px rgba(0, 0, 0, 0.08)',
  dialog: '0 12px 32px rgba(0, 0, 0, 0.18)'
} as const

export const motion = {
  durationFast: 100,
  durationBase: 150,
  durationSlow: 220,
  easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
  easingEntrance: 'cubic-bezier(0, 0, 0, 1)',
  easingExit: 'cubic-bezier(0.4, 0, 1, 1)'
} as const

export const density = {
  rowHeight: 32,
  tabBarHeight: 38,
  brandHeight: 48,
  controlHeight: 28,
  iconButtonSize: 28,
  touchTarget: 44,
  topbarHeight: 40,
  sidebarWidth: 220
} as const

export const zIndex = {
  base: 0,
  rail: 10,
  tabBar: 20,
  popover: 100,
  dialog: 200,
  toast: 300
} as const

export function resolveColors(resolvedMode: 'light' | 'dark'): ColorScale {
  return resolvedMode === 'dark' ? darkColors : lightColors
}

export const tokens = {
  lightColors,
  darkColors,
  space,
  radius,
  fontSize,
  lineHeight,
  fontFamily,
  border,
  elevation,
  motion,
  density,
  zIndex
} as const

export type Tokens = typeof tokens
