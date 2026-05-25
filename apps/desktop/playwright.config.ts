import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
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
