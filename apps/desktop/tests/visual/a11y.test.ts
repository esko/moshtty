import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { test, expect } from './playwright.setup'

const require = createRequire(import.meta.url)
const axePlaywrightPath = require.resolve('@axe-core/playwright')
const axeSourcePath = path.resolve(
  path.dirname(axePlaywrightPath),
  '..',
  '..',
  '..',
  'axe-core',
  'axe.min.js'
)
const axeSource = fs.readFileSync(axeSourcePath, 'utf8')
const FAILING_IMPACTS = new Set(['critical', 'serious'])

type AxeViolation = {
  impact?: string
}

async function expectNoCriticalOrSeriousViolations(
  page: import('@playwright/test').Page
): Promise<void> {
  await page.addScriptTag({ content: axeSource })
  const violations = await page.evaluate(async () => {
    const axe = (
      window as typeof window & {
        axe: {
          run: () => Promise<{ violations: AxeViolation[] }>
        }
      }
    ).axe
    const results = await axe.run()
    return results.violations
  })
  const failing = violations.filter((v) => v.impact && FAILING_IMPACTS.has(v.impact))
  expect(failing, JSON.stringify(failing, null, 2)).toEqual([])
}

test.describe('Accessibility (axe-core)', () => {
  test('dashboard has no critical or serious violations', async ({ page }) => {
    await expectNoCriticalOrSeriousViolations(page)
  })

  test('active tab has no critical or serious violations', async ({ loadFixture, page }) => {
    await loadFixture('active-tab')
    await expectNoCriticalOrSeriousViolations(page)
  })

  test('import dialog has no critical or serious violations', async ({ loadFixture, page }) => {
    await loadFixture('dialog-import-empty')
    await expectNoCriticalOrSeriousViolations(page)
  })
})
