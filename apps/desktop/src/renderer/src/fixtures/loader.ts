import { getFixture } from './states'
import { applyThemeAttribute } from '../design/theme'

export function loadFixtureFromQuery(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  const params = new URLSearchParams(window.location.search)
  const fixtureId = params.get('fixture')
  return fixtureId || null
}

export function applyFixtureTheme(fixtureId: string): void {
  const fixture = getFixture(fixtureId)
  if (!fixture) {
    return
  }
  applyThemeAttribute(fixture.state.settings.themeMode)
}
