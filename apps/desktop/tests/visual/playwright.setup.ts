/**
 * Shared Playwright Electron fixture.
 *
 * Visual regression and a11y tests should import `test` from this module
 * instead of `@playwright/test`. It launches a single Electron process per
 * test file, hands you a typed `Page`, and tears down on teardown.
 *
 * Loading a fixture state (see `src/renderer/src/fixtures/states.ts`) is a
 * thin wrapper around the renderer's `?fixture=<id>` query param.
 */

import { _electron as electron, expect, test as base } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, '..', '..')

export type MoshttyFixtures = {
  electronApp: ElectronApplication
  page: Page
  loadFixture: (id: string) => Promise<void>
}

const electronLaunchArgs = [
  '--no-sandbox',
  ...(process.env.CI ? ['--disable-dev-shm-usage'] : []),
  APP_ROOT
]

export const test = base.extend<MoshttyFixtures>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: electronLaunchArgs,
      cwd: APP_ROOT,
      env: { ...process.env, NODE_ENV: 'test', MOSHTTY_E2E: '1' }
    })
    await use(app)
    await app.close()
  },

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await use(page)
  },

  loadFixture: async ({ page }, use) => {
    const navigate = async (id: string): Promise<void> => {
      const url = new URL(page.url())
      url.searchParams.set('fixture', id)
      await page.goto(url.toString())
      await page.waitForLoadState('domcontentloaded')
      await page.waitForURL((current) => current.searchParams.get('fixture') === id)
      await expect(page.locator(`[data-fixture-id="${id}"]`)).toBeVisible()
    }
    await use(navigate)
  }
})

export { expect } from '@playwright/test'
