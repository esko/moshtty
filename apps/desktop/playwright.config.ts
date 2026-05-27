import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  testIgnore: process.env.CI ? ['**/verify-bootstrap-e2e.test.ts'] : [],
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'on'
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.005
    }
  },
  snapshotDir: './tests/visual/__screenshots__'
})
