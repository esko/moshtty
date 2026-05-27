import { test, expect } from './playwright.setup'

test.describe('Dashboard', () => {
  test('renders the sidebar', async ({ page }) => {
    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.locator('.brand-badge')).toHaveCount(0)
    await expect(page.locator('.sidebar-title')).toContainText('Projects')
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
