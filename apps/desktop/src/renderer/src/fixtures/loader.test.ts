import { describe, expect, it } from 'vitest'
import { FIXTURES, getFixture, getFixtureIds } from './states'

describe('fixture states', () => {
  it('has at least 10 fixtures', () => {
    expect(getFixtureIds().length).toBeGreaterThanOrEqual(10)
  })

  it('every fixture has a valid state', () => {
    for (const [, fixture] of Object.entries(FIXTURES)) {
      expect(fixture.state.version).toBe(1)
      expect(fixture.state.projects.length).toBeGreaterThan(0)
    }
  })

  it('getFixture returns undefined for unknown ids', () => {
    expect(getFixture('nonexistent')).toBeUndefined()
  })

  it('getFixture returns fixture for known ids', () => {
    const fixture = getFixture('dashboard')
    expect(fixture).toBeDefined()
    expect(fixture!.label).toBeTruthy()
  })
})
