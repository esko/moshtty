import { test, expect } from './playwright.setup'

test.describe('Dialogs', () => {
  test('dev panel exposes its actions', async ({ page }) => {
    await expect(page.locator('.dev-panel')).toBeVisible()
    await expect(page.locator('.dev-panel-actions button')).toHaveCount(2)
  })

  test.fixme('renders the import-remote dialog (empty)', async ({ loadFixture, page }) => {
    await loadFixture('dialog-import-empty')
    await expect(page).toHaveScreenshot('dialog-import-empty.png')
  })

  test.fixme('renders the import-remote dialog (invalid profile)', async ({
    loadFixture,
    page
  }) => {
    await loadFixture('dialog-import-invalid')
    await expect(page).toHaveScreenshot('dialog-import-invalid.png')
  })

  test.fixme('renders the project-edit dialog', async ({ loadFixture, page }) => {
    await loadFixture('dialog-project-edit')
    await expect(page).toHaveScreenshot('dialog-project-edit.png')
  })

  test.fixme('renders the terminal-settings dialog', async ({ loadFixture, page }) => {
    await loadFixture('dialog-terminal-settings')
    await expect(page).toHaveScreenshot('dialog-terminal-settings.png')
  })
})
