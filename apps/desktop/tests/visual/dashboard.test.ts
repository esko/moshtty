import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { _electron as electron } from '@playwright/test'

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  electronApp = await electron.launch({
    args: ['.', '--no-sandbox']
  })
  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await electronApp?.close()
})

test('dashboard renders project rail', async () => {
  await expect(page.locator('.project-rail')).toBeVisible()
  await expect(page.locator('.brand-name')).toContainText('Moshtty')
  await expect(page).toHaveScreenshot('dashboard.png')
})
