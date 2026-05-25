import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './playwright.setup'

const FAILING_IMPACTS = new Set(['critical', 'serious'])

test.describe('Accessibility (axe-core)', () => {
  test('dashboard has no critical or serious violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze()
    const violations = results.violations.filter((v) => v.impact && FAILING_IMPACTS.has(v.impact))
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
  })

  test.fixme('active tab has no critical or serious violations', async ({ loadFixture, page }) => {
    await loadFixture('active-tab')
    const results = await new AxeBuilder({ page }).analyze()
    const violations = results.violations.filter((v) => v.impact && FAILING_IMPACTS.has(v.impact))
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
  })

  test.fixme('import dialog has no critical or serious violations', async ({
    loadFixture,
    page
  }) => {
    await loadFixture('dialog-import-empty')
    const results = await new AxeBuilder({ page }).analyze()
    const violations = results.violations.filter((v) => v.impact && FAILING_IMPACTS.has(v.impact))
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
  })
})
