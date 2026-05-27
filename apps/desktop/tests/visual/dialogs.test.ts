import { test, expect } from './playwright.setup'

test.describe('Dialogs', () => {
  test('Escape on stacked bootstrap returns to project dialog', async ({ loadFixture, page }) => {
    await loadFixture('dialog-project-edit')
    await expect(page.locator('.project-dialog')).toBeVisible()
    await page.locator('button[data-action-id="open-bootstrap-dialog"]').click()
    await expect(page.locator('.bootstrap-dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.bootstrap-dialog')).toHaveCount(0)
    await expect(page.locator('.project-dialog')).toBeVisible()
  })

  for (const fixtureId of [
    'dialog-import-empty',
    'dialog-import-valid',
    'dialog-import-invalid',
    'dialog-project-edit-new',
    'dialog-project-edit',
    'dialog-terminal-settings',
    'dialog-terminal-settings-light',
    'dialog-terminal-settings-dark',
    'dialog-bootstrap'
  ]) {
    test(`matches ${fixtureId} screenshot`, async ({ loadFixture, page }) => {
      await loadFixture(fixtureId)
      await expect(page).toHaveScreenshot(`${fixtureId}.png`)
    })
  }
})
