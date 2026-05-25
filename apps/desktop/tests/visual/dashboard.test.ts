import { test, expect } from './playwright.setup'

test.describe('Dashboard', () => {
  test('renders the brand and project rail', async ({ page }) => {
    await expect(page.locator('.project-rail')).toBeVisible()
    await expect(page.locator('.brand-badge')).toContainText('BETA')
    await expect(page.locator('.rail-heading')).toContainText('Projects')
  })

  test.fixme('matches the rail-expanded reference screenshot', async ({ page }) => {
    await expect(page).toHaveScreenshot('dashboard-rail-expanded.png')
  })

  test.fixme('matches the rail-collapsed reference screenshot', async ({ loadFixture, page }) => {
    await loadFixture('rail-collapsed')
    await expect(page).toHaveScreenshot('dashboard-rail-collapsed.png')
  })

  test.fixme('matches the active-tab reference screenshot', async ({ loadFixture, page }) => {
    await loadFixture('active-tab')
    await expect(page).toHaveScreenshot('dashboard-active-tab.png')
  })
})
