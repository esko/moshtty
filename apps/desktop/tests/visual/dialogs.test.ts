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

test('project rail buttons are clickable', async () => {
  const newProjectBtn = page.locator('.ghost-button')
  await expect(newProjectBtn).toBeVisible()
})

test('settings dialog area is reachable', async () => {
  await expect(page.locator('.dev-panel')).toBeVisible()
  await expect(page.locator('.dev-panel-actions button')).toHaveCount(2)
})
