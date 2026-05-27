import { useEffect } from 'react'

export type AppActionId =
  | 'toggle-project-rail'
  | 'show-projects'
  | 'new-project'
  | 'import-remote'
  | 'open-settings'
  | 'open-help'
  | 'new-tab'
  | 'save-state'
  | 'reset-state'
  | 'add-project'
  | 'close-dialog'
  | 'cancel-dialog'
  | 'confirm-dialog'
  | 'choose-project-color'
  | 'select-project'
  | 'show-general-settings'
  | 'show-shortcuts-settings'
  | 'split-pane-right'
  | 'split-pane-down'
  | 'close-pane'
  | 'close-tab'
  | 'bootstrap-remote'

export interface KeyChord {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
}

export interface AppAction {
  id: AppActionId
  label: string
  shortcut?: KeyChord
  mouseOnly?: true
  mouseOnlyReason?: string
}

export const APP_ACTIONS: readonly AppAction[] = [
  {
    id: 'toggle-project-rail',
    label: 'Toggle project rail',
    shortcut: { key: 'b', ctrl: true }
  },
  {
    id: 'show-projects',
    label: 'Show projects',
    shortcut: { key: '1', ctrl: true }
  },
  {
    id: 'new-project',
    label: 'New project',
    shortcut: { key: 'n', ctrl: true, shift: true }
  },
  {
    id: 'import-remote',
    label: 'Import remote',
    shortcut: { key: 'i', ctrl: true, shift: true }
  },
  {
    id: 'bootstrap-remote',
    label: 'Bootstrap remote',
    mouseOnly: true,
    mouseOnlyReason: 'Bootstrap dialog requires credentials.'
  },
  {
    id: 'open-settings',
    label: 'Settings',
    shortcut: { key: ',', ctrl: true }
  },
  {
    id: 'open-help',
    label: 'Help',
    shortcut: { key: '/', ctrl: true }
  },
  {
    id: 'new-tab',
    label: 'New tab',
    shortcut: { key: 't', ctrl: true }
  },
  {
    id: 'save-state',
    label: 'Save state',
    shortcut: { key: 's', ctrl: true }
  },
  {
    id: 'reset-state',
    label: 'Reset state',
    shortcut: { key: 'r', ctrl: true, shift: true }
  },
  {
    id: 'add-project',
    label: 'Add project',
    shortcut: { key: 'n', ctrl: true, alt: true }
  },
  {
    id: 'close-dialog',
    label: 'Close dialog',
    shortcut: { key: 'Escape' }
  },
  {
    id: 'cancel-dialog',
    label: 'Cancel dialog',
    shortcut: { key: 'Escape' }
  },
  {
    id: 'confirm-dialog',
    label: 'Confirm dialog',
    shortcut: { key: 'Enter', ctrl: true }
  },
  {
    id: 'choose-project-color',
    label: 'Choose project color',
    mouseOnly: true,
    mouseOnlyReason: 'Color swatches are pointer-only until project editing persists colors.'
  },
  {
    id: 'select-project',
    label: 'Select project',
    mouseOnly: true,
    mouseOnlyReason: 'Project rows are pointer-selected until command palette navigation lands.'
  },
  {
    id: 'show-general-settings',
    label: 'Show general settings',
    mouseOnly: true,
    mouseOnlyReason: 'Settings sections are local dialog tabs.'
  },
  {
    id: 'show-shortcuts-settings',
    label: 'Show shortcuts',
    mouseOnly: true,
    mouseOnlyReason: 'Settings sections are local dialog tabs.'
  },
  {
    id: 'split-pane-right',
    label: 'Split pane right',
    shortcut: { key: 'ArrowRight', ctrl: true, shift: true }
  },
  {
    id: 'split-pane-down',
    label: 'Split pane down',
    shortcut: { key: 'ArrowDown', ctrl: true, shift: true }
  },
  {
    id: 'close-pane',
    label: 'Close pane',
    shortcut: { key: 'x', ctrl: true, shift: true }
  },
  {
    id: 'close-tab',
    label: 'Close tab',
    shortcut: { key: 'w', ctrl: true, shift: true }
  }
] as const

export type AppActionHandlerMap = Partial<Record<AppActionId, () => void>>

export function getAction(id: AppActionId): AppAction {
  const action = APP_ACTIONS.find((entry) => entry.id === id)
  if (!action) {
    throw new Error(`Unknown app action: ${id}`)
  }
  return action
}

export function getShortcutActions(): AppAction[] {
  return APP_ACTIONS.filter((action) => action.shortcut)
}

export function formatShortcut(chord: KeyChord | undefined): string {
  if (!chord) {
    return 'Mouse only'
  }

  const parts: string[] = []
  if (chord.ctrl) {
    parts.push('Ctrl')
  }
  if (chord.shift) {
    parts.push('Shift')
  }
  if (chord.alt) {
    parts.push('Alt')
  }
  if (chord.meta) {
    parts.push('Meta')
  }
  parts.push(chord.key.length === 1 ? chord.key.toUpperCase() : chord.key)
  return parts.join('+')
}

export function matchesShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>,
  chord: KeyChord
): boolean {
  return (
    event.key.toLowerCase() === chord.key.toLowerCase() &&
    event.ctrlKey === Boolean(chord.ctrl) &&
    event.shiftKey === Boolean(chord.shift) &&
    event.altKey === Boolean(chord.alt) &&
    event.metaKey === Boolean(chord.meta)
  )
}

export function getActionForKeyboardEvent(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>
): AppAction | null {
  return getShortcutActions().find((action) => matchesShortcut(event, action.shortcut!)) ?? null
}

export function useRegisteredShortcuts(handlers: AppActionHandlerMap): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const action = getActionForKeyboardEvent(event)
      if (!action) {
        return
      }

      const handler = handlers[action.id]
      if (!handler) {
        return
      }

      event.preventDefault()
      handler()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlers])
}
