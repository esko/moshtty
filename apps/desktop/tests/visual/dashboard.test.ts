import { test, expect } from './playwright.setup'

test.describe('Dashboard', () => {
  test('renders the brand and project rail', async ({ page }) => {
    await expect(page.locator('.project-rail')).toBeVisible()
    await expect(page.locator('.brand-badge')).toContainText('BETA')
    await expect(page.locator('.rail-heading')).toContainText('Projects')
  })

  for (const fixtureId of [
    'dashboard',
    'dashboard-empty',
    'dashboard-dark',
    'rail-expanded',
    'rail-collapsed',
    'rail-empty',
    'active-tab',
    'tab-bar-multi',
    'tab-bar-dragging',
    'tab-bar-overflow',
    'connection-offline',
    'connection-connecting',
    'connection-connected',
    'connection-lost'
  ]) {
    test(`matches ${fixtureId} screenshot`, async ({ loadFixture, page }) => {
      await loadFixture(fixtureId)
      await expect(page).toHaveScreenshot(`${fixtureId}.png`)
    })
  }
})
