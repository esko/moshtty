import { describe, expect, it } from 'vitest'
import { MoshttyStateSchema } from '../../../common/state.schema'
import { FIXTURES, getFixture, getFixtureIds } from './states'

describe('fixture states', () => {
  it('exposes at least the M5 minimum set', () => {
    expect(getFixtureIds().length).toBeGreaterThanOrEqual(12)
  })

  it('every fixture has a valid label and id that match', () => {
    for (const [key, fixture] of Object.entries(FIXTURES)) {
      expect(fixture.id).toBe(key)
      expect(fixture.label.length).toBeGreaterThan(0)
    }
  })

  it('every fixture state passes the strict schema', () => {
    for (const [id, fixture] of Object.entries(FIXTURES)) {
      const result = MoshttyStateSchema.safeParse(fixture.state)
      if (!result.success) {
        throw new Error(`fixture '${id}' failed schema: ${result.error.message}`)
      }
    }
  })

  it('getFixture returns undefined for unknown ids', () => {
    expect(getFixture('nonexistent')).toBeUndefined()
  })

  it('getFixture returns the matching fixture for known ids', () => {
    const fixture = getFixture('dashboard')
    expect(fixture).toBeDefined()
    expect(fixture!.label).toMatch(/dashboard/i)
  })

  it('covers each surface from the M5 surface state matrix', () => {
    const ids = new Set(getFixtureIds())
    const required = [
      'dashboard',
      'rail-collapsed',
      'rail-expanded',
      'active-tab',
      'split-2-row',
      'split-2-column',
      'split-3-nested',
      'pane-lost',
      'dialog-import-empty',
      'dialog-project-edit',
      'dialog-terminal-settings',
      'connection-offline'
    ]
    for (const id of required) {
      expect(ids.has(id), `missing fixture '${id}'`).toBe(true)
    }
  })
})
