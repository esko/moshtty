import { describe, expect, it } from 'vitest'
import {
  APP_ACTIONS,
  formatShortcut,
  filterPaletteActions,
  getAction,
  getActionForKeyboardEvent,
  getShortcutActions,
  matchesShortcut,
  PALETTE_EXCLUDED_ACTION_IDS
} from './keymap'

function keyEvent(
  key: string,
  modifiers: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>> = {}
): Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'> {
  return {
    key,
    ctrlKey: modifiers.ctrlKey ?? false,
    shiftKey: modifiers.shiftKey ?? false,
    altKey: modifiers.altKey ?? false,
    metaKey: modifiers.metaKey ?? false
  }
}

describe('keymap registry', () => {
  it('has unique action ids', () => {
    const ids = APP_ACTIONS.map((action) => action.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('documents every action as shortcut-backed or mouse-only', () => {
    for (const action of APP_ACTIONS) {
      expect(Boolean(action.shortcut) || action.mouseOnly).toBe(true)
      if (action.mouseOnly) {
        expect(action.mouseOnlyReason).toBeTruthy()
      }
    }
  })

  it('formats shortcuts for settings display', () => {
    expect(formatShortcut(getAction('new-project').shortcut)).toBe('Ctrl+Shift+N')
    expect(formatShortcut(getAction('choose-project-color').shortcut)).toBe('Mouse only')
  })

  it('matches modifier exact shortcuts', () => {
    expect(
      matchesShortcut(keyEvent('n', { ctrlKey: true, shiftKey: true }), {
        key: 'n',
        ctrl: true,
        shift: true
      })
    ).toBe(true)
    expect(
      matchesShortcut(keyEvent('n', { ctrlKey: true }), { key: 'n', ctrl: true, shift: true })
    ).toBe(false)
  })

  it('resolves keyboard events to registered actions', () => {
    expect(getActionForKeyboardEvent(keyEvent('s', { ctrlKey: true }))?.id).toBe('save-state')
    expect(getActionForKeyboardEvent(keyEvent('k', { ctrlKey: true }))?.id).toBe(
      'open-command-palette'
    )
    expect(getActionForKeyboardEvent(keyEvent('Escape'))?.id).toBe('close-dialog')
    expect(getActionForKeyboardEvent(keyEvent('x', { ctrlKey: true }))).toBeNull()
  })

  it('does not include mouse-only actions in shortcut list', () => {
    const shortcutIds = getShortcutActions().map((action) => action.id)
    expect(shortcutIds).toContain('new-tab')
    expect(shortcutIds).not.toContain('choose-project-color')
  })

  it('excludes dialog and palette-open actions from palette list', () => {
    for (const id of PALETTE_EXCLUDED_ACTION_IDS) {
      expect(filterPaletteActions(APP_ACTIONS, '').some((action) => action.id === id)).toBe(false)
    }
  })

  it('filters palette actions by label substring', () => {
    expect(filterPaletteActions(APP_ACTIONS, 'split').map((action) => action.id)).toEqual([
      'split-pane-right',
      'split-pane-down'
    ])
  })
})
