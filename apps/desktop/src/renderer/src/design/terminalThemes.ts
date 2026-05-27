/**
 * Built-in terminal color presets.
 * Keys match the picker values stored in localStorage under
 * 'moshtty:terminalColorScheme'. The 'auto' key is resolved
 * by the caller based on the current resolved app theme.
 */
export type TerminalColorSchemeKey =
  | 'auto'
  | 'default-dark'
  | 'default-light'
  | 'dracula'
  | 'catppuccin-mocha'
  | 'solarized-dark'
  | 'solarized-light'

export interface TerminalColorScheme {
  label: string
  dark: boolean
  background: string
  foreground: string
  cursor: string
  selectionBackground: string
  ansi: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string
  ]
}

export const TERMINAL_COLOR_SCHEMES: Record<
  Exclude<TerminalColorSchemeKey, 'auto'>,
  TerminalColorScheme
> = {
  'default-dark': {
    label: 'Default Dark',
    dark: true,
    background: '#121214',
    foreground: '#e2e2e8',
    cursor: '#e2e2e8',
    selectionBackground: '#2a2a30',
    ansi: [
      '#1e1e24',
      '#f87171',
      '#34d399',
      '#fbbf24',
      '#818cf8',
      '#c084fc',
      '#22d3ee',
      '#e4e4e7',
      '#3f3f46',
      '#fca5a5',
      '#6ee7b7',
      '#fde68a',
      '#a5b4fc',
      '#d8b4fe',
      '#67e8f9',
      '#f4f4f5'
    ]
  },
  'default-light': {
    label: 'Default Light',
    dark: false,
    background: '#ffffff',
    foreground: '#1a1a2e',
    cursor: '#1a1a2e',
    selectionBackground: '#e5e5e8',
    ansi: [
      '#1e1e2e',
      '#b91c1c',
      '#065f46',
      '#92400e',
      '#3730a3',
      '#7e22ce',
      '#0e7490',
      '#1f2937',
      '#6b7280',
      '#ef4444',
      '#10b981',
      '#f59e0b',
      '#6366f1',
      '#a855f7',
      '#06b6d4',
      '#374151'
    ]
  },
  dracula: {
    label: 'Dracula',
    dark: true,
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    selectionBackground: '#44475a',
    ansi: [
      '#21222c',
      '#ff5555',
      '#50fa7b',
      '#f1fa8c',
      '#bd93f9',
      '#ff79c6',
      '#8be9fd',
      '#f8f8f2',
      '#6272a4',
      '#ff6e6e',
      '#69ff94',
      '#ffffa5',
      '#d6acff',
      '#ff92df',
      '#a4ffff',
      '#ffffff'
    ]
  },
  'catppuccin-mocha': {
    label: 'Catppuccin Mocha',
    dark: true,
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    cursor: '#f5e0dc',
    selectionBackground: '#363a4f',
    ansi: [
      '#45475a',
      '#f38ba8',
      '#a6e3a1',
      '#f9e2af',
      '#89b4fa',
      '#f5c2e7',
      '#94e2d5',
      '#bac2de',
      '#585b70',
      '#f38ba8',
      '#a6e3a1',
      '#f9e2af',
      '#89b4fa',
      '#f5c2e7',
      '#94e2d5',
      '#a6adc8'
    ]
  },
  'solarized-dark': {
    label: 'Solarized Dark',
    dark: true,
    background: '#002b36',
    foreground: '#839496',
    cursor: '#839496',
    selectionBackground: '#073642',
    ansi: [
      '#073642',
      '#dc322f',
      '#859900',
      '#b58900',
      '#268bd2',
      '#d33682',
      '#2aa198',
      '#eee8d5',
      '#002b36',
      '#cb4b16',
      '#586e75',
      '#657b83',
      '#839496',
      '#6c71c4',
      '#93a1a1',
      '#fdf6e3'
    ]
  },
  'solarized-light': {
    label: 'Solarized Light',
    dark: false,
    background: '#fdf6e3',
    foreground: '#657b83',
    cursor: '#586e75',
    selectionBackground: '#eee8d5',
    ansi: [
      '#073642',
      '#dc322f',
      '#859900',
      '#b58900',
      '#268bd2',
      '#d33682',
      '#2aa198',
      '#eee8d5',
      '#002b36',
      '#cb4b16',
      '#586e75',
      '#657b83',
      '#839496',
      '#6c71c4',
      '#93a1a1',
      '#fdf6e3'
    ]
  }
}

export function resolveTerminalColorScheme(
  key: TerminalColorSchemeKey,
  appThemeDark: boolean
): TerminalColorScheme {
  if (key === 'auto') {
    return appThemeDark
      ? TERMINAL_COLOR_SCHEMES['default-dark']
      : TERMINAL_COLOR_SCHEMES['default-light']
  }
  return TERMINAL_COLOR_SCHEMES[key]
}

const STORAGE_KEY = 'moshtty:terminalColorScheme'

export function loadTerminalColorSchemeKey(): TerminalColorSchemeKey {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (
      raw === 'auto' ||
      raw === 'default-dark' ||
      raw === 'default-light' ||
      raw === 'dracula' ||
      raw === 'catppuccin-mocha' ||
      raw === 'solarized-dark' ||
      raw === 'solarized-light'
    ) {
      return raw
    }
  } catch {
    // localStorage unavailable
  }
  return 'auto'
}

export function saveTerminalColorSchemeKey(key: TerminalColorSchemeKey): void {
  try {
    localStorage.setItem(STORAGE_KEY, key)
  } catch {
    // ignore
  }
}

export function terminalSchemeToGhosttyTheme(scheme: TerminalColorScheme): {
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selectionBackground: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
} {
  return {
    background: scheme.background,
    foreground: scheme.foreground,
    cursor: scheme.cursor,
    cursorAccent: scheme.background,
    selectionBackground: scheme.selectionBackground,
    black: scheme.ansi[0],
    red: scheme.ansi[1],
    green: scheme.ansi[2],
    yellow: scheme.ansi[3],
    blue: scheme.ansi[4],
    magenta: scheme.ansi[5],
    cyan: scheme.ansi[6],
    white: scheme.ansi[7],
    brightBlack: scheme.ansi[8],
    brightRed: scheme.ansi[9],
    brightGreen: scheme.ansi[10],
    brightYellow: scheme.ansi[11],
    brightBlue: scheme.ansi[12],
    brightMagenta: scheme.ansi[13],
    brightCyan: scheme.ansi[14],
    brightWhite: scheme.ansi[15]
  }
}
