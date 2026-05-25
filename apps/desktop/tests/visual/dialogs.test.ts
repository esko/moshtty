import { test, expect } from './playwright.setup'

test.describe('Dialogs', () => {
  test('state panel exposes workspace actions', async ({ page }) => {
    await expect(page.locator('.state-panel')).toBeVisible()
    await expect(page.locator('.state-actions button')).toHaveCount(3)
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
