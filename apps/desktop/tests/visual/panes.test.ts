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

  for (const fixtureId of ['split-2-row', 'split-2-column', 'split-3-nested', 'pane-lost']) {
    test(`matches ${fixtureId} screenshot`, async ({ loadFixture, page }) => {
      await loadFixture(fixtureId)
      await expect(page).toHaveScreenshot(`${fixtureId}.png`)
    })
  }

  test('matches split handle hover screenshot', async ({ loadFixture, page }) => {
    await loadFixture('split-2-row')
    await page.locator('.split-handle').first().hover()
    await expect(page).toHaveScreenshot('split-handle-hover.png')
  })
})
