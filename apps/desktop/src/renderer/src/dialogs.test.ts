import { describe, expect, test } from 'vitest'
import { dialogStackKey, getFixtureDialog } from './dialogs'

describe('getFixtureDialog', () => {
  test('maps import fixtures to import dialog modes', () => {
    expect(getFixtureDialog('dialog-import-empty')).toEqual({ kind: 'import', mode: 'empty' })
    expect(getFixtureDialog('dialog-import-valid')).toEqual({ kind: 'import', mode: 'valid' })
    expect(getFixtureDialog('dialog-import-invalid')).toEqual({ kind: 'import', mode: 'invalid' })
  })

  test('maps project and settings fixtures to their dialogs', () => {
    expect(getFixtureDialog('dialog-project-edit-new')).toEqual({ kind: 'project', mode: 'new' })
    expect(getFixtureDialog('dialog-project-edit')).toEqual({
      kind: 'project',
      mode: 'existing',
      projectId: 'project-welcome'
    })
    expect(getFixtureDialog('dialog-terminal-settings')).toEqual({ kind: 'settings' })
    expect(getFixtureDialog('dialog-terminal-settings-dark')).toEqual({ kind: 'settings' })
  })

  test('ignores non-dialog fixtures', () => {
    expect(getFixtureDialog('dashboard-populated')).toBeNull()
    expect(getFixtureDialog(null)).toBeNull()
  })
})

describe('dialogStackKey', () => {
  test('distinguishes new project from existing project id', () => {
    expect(dialogStackKey({ kind: 'project', mode: 'new' })).toBe('new')
    expect(dialogStackKey({ kind: 'project', mode: 'existing', projectId: 'p-1' })).toBe('p-1')
    expect(dialogStackKey({ kind: 'settings' })).toBe('')
    expect(dialogStackKey(null)).toBe('')
  })
})
