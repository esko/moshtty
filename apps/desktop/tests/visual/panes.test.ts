import { test, expect } from './playwright.setup'

test.describe('Panes', () => {
  test('terminal workspace is present for active tab fixture', async ({ loadFixture, page }) => {
    await loadFixture('active-tab')
    await expect(page.locator('.terminal-workspace')).toBeVisible()
    await expect(page.locator('.terminal-pane')).toBeVisible()
  })

  test('tab bar shows the active tab', async ({ page }) => {
    await expect(page.locator('.tab.active')).toBeVisible()
  })

  test.fixme('renders a 2-pane row split fixture', async ({ loadFixture, page }) => {
    await loadFixture('split-2-row')
    await expect(page).toHaveScreenshot('split-2-row.png')
  })

  test.fixme('renders a 2-pane column split fixture', async ({ loadFixture, page }) => {
    await loadFixture('split-2-column')
    await expect(page).toHaveScreenshot('split-2-column.png')
  })

  test.fixme('renders a 3-pane nested split fixture', async ({ loadFixture, page }) => {
    await loadFixture('split-3-nested')
    await expect(page).toHaveScreenshot('split-3-nested.png')
  })

  test.fixme('renders a pane-lost state', async ({ loadFixture, page }) => {
    await loadFixture('pane-lost')
    await expect(page).toHaveScreenshot('pane-lost.png')
  })
})
