import { test, expect } from './playwright.setup'

test.describe('Dialogs', () => {
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
