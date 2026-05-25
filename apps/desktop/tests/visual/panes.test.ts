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

test('pane area is visible', async () => {
  await expect(page.locator('.terminal-canvas')).toBeVisible()
})

test('tab bar shows active tab', async () => {
  await expect(page.locator('.tab.active')).toBeVisible()
})

test('split layout placeholder accepts 2-pane state', async () => {
  await page.goto('app://moshtty/index.html?fixture=split-2')
  await expect(page.locator('.terminal-canvas')).toBeVisible()
})
