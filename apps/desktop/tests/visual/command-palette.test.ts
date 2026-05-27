import { test, expect } from './playwright.setup'

const paletteDialog = '[role="dialog"][aria-label="Command palette"]'

test.describe('Command palette', () => {
  test('opens with Ctrl+K on dashboard fixture', async ({ loadFixture, page }) => {
    await loadFixture('dashboard')
    await expect(page.locator(paletteDialog)).toHaveCount(0)
    await page.keyboard.press('Control+K')
    await expect(page.locator(paletteDialog)).toBeVisible()
    await expect(page.locator('.palette-input')).toBeFocused()
    await expect(page).toHaveScreenshot('command-palette-open-empty.png')
  })

  test('filters actions by search query', async ({ loadFixture, page }) => {
    await loadFixture('dashboard')
    await page.keyboard.press('Control+K')
    await page.locator('.palette-input').fill('split')
    await expect(page.locator('.palette-item')).toHaveCount(2)
    await expect(page).toHaveScreenshot('command-palette-open-filtered.png')
  })

  test('closes on Escape', async ({ loadFixture, page }) => {
    await loadFixture('dashboard')
    await page.keyboard.press('Control+K')
    await expect(page.locator(paletteDialog)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator(paletteDialog)).toHaveCount(0)
  })

  test('closes when clicking the backdrop', async ({ loadFixture, page }) => {
    await loadFixture('dashboard')
    await page.keyboard.press('Control+K')
    await expect(page.locator(paletteDialog)).toBeVisible()
    await page.locator('.palette-backdrop').click({ position: { x: 8, y: 8 } })
    await expect(page.locator(paletteDialog)).toHaveCount(0)
  })
})
