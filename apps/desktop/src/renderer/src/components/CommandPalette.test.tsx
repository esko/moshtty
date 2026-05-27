import { describe, expect, it } from 'vitest'
import {
  APP_ACTIONS,
  canInvokePaletteAction,
  filterPaletteActions,
  getAction,
  PALETTE_EXCLUDED_ACTION_IDS
} from '../keymap'

describe('CommandPalette helpers', () => {
  it('excludes dialog and palette-open actions from the list', () => {
    for (const id of PALETTE_EXCLUDED_ACTION_IDS) {
      expect(filterPaletteActions(APP_ACTIONS, '').some((action) => action.id === id)).toBe(false)
    }
  })

  it('shows all non-excluded actions when query is empty', () => {
    const visible = filterPaletteActions(APP_ACTIONS, '')
    const excludedCount = APP_ACTIONS.filter((action) =>
      PALETTE_EXCLUDED_ACTION_IDS.has(action.id)
    ).length

    expect(visible).toHaveLength(APP_ACTIONS.length - excludedCount)
  })

  it('filters actions by case-insensitive label substring', () => {
    const visible = filterPaletteActions(APP_ACTIONS, 'split')

    expect(visible.map((action) => action.id)).toEqual(['split-pane-right', 'split-pane-down'])
  })

  it('returns no matches for unknown queries', () => {
    expect(filterPaletteActions(APP_ACTIONS, 'zzzz-not-a-command')).toEqual([])
  })

  it('blocks mouse-only actions from invocation', () => {
    expect(canInvokePaletteAction(getAction('new-tab'))).toBe(true)
    expect(canInvokePaletteAction(getAction('select-project'))).toBe(false)
    expect(canInvokePaletteAction(undefined)).toBe(false)
  })
})
