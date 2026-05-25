import { test, expect } from './playwright.setup'

test.describe('Dialogs', () => {
  test('state panel exposes workspace actions', async ({ page }) => {
    await expect(page.locator('.state-panel')).toBeVisible()
    await expect(page.locator('.state-actions button')).toHaveCount(3)
  })

  for (const fixtureId of [
    'dialog-import-empty',
    'dialog-import-valid',
    'dialog-import-invalid',
    'dialog-project-edit-new',
    'dialog-project-edit',
    'dialog-terminal-settings',
    'dialog-terminal-settings-light',
    'dialog-terminal-settings-dark'
  ]) {
    test(`matches ${fixtureId} screenshot`, async ({ loadFixture, page }) => {
      await loadFixture(fixtureId)
      await expect(page).toHaveScreenshot(`${fixtureId}.png`)
    })
  }
})
