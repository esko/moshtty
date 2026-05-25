import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { _electron as electron } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

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

test('dashboard has no critical a11y violations', async () => {
  const results = await new AxeBuilder({ page }).analyze()
  const violations = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  expect(violations).toEqual([])
})
