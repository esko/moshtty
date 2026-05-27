import { test, expect } from './playwright.setup'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('E2E target SSH bootstrap verification against macmini', async ({ page }) => {
  // 1. Wait for Sidebar page to load
  await page.waitForLoadState('domcontentloaded')
  console.log('App loaded. URL:', page.url())

  // 2. Open Bootstrap Remote dialog via the project edit modal
  //    (8d.3 removed the sidebar header bootstrap button; the project dialog
  //    Install/Update button is now the only entry point to BootstrapDialog.)
  console.log('Opening project edit dialog to reach Bootstrap...')
  const renameBtn = page.locator('button[aria-label^="Rename "]').first()
  await renameBtn.waitFor({ state: 'visible' })
  await renameBtn.click()

  console.log('Clicking Install/Update to open BootstrapDialog...')
  const bootstrapBtn = page.locator('button[data-action-id="open-bootstrap-dialog"]')
  await bootstrapBtn.waitFor({ state: 'visible' })
  await bootstrapBtn.click()

  // 3. Wait for the dialog to be visible
  const dialog = page.locator('.bootstrap-dialog')
  await dialog.waitFor({ state: 'visible' })

  // Save form screenshot
  await page.screenshot({ path: path.join(__dirname, 'bootstrap-1-form.png') })
  console.log('Saved screenshot of SSH configuration form.')

  // 4. Fill in the form fields
  console.log('Filling in remote host SSH credentials...')
  await page.fill('input[placeholder="10.0.0.5 or server.local"]', 'macmini')
  await page.fill('input[placeholder="22"]', '22')
  await page.fill('input[placeholder="username"]', 'esko')
  await page.fill('input[placeholder="~/.ssh/id_rsa"]', '/home/esko/.ssh/id_rsa')

  const passphraseInput = page.locator(
    'input[placeholder="Passphrase to encrypt companion access token"]'
  )
  if (await passphraseInput.isVisible()) {
    await passphraseInput.fill('mysecurepassphrase')
  }

  await page.fill('input[placeholder="~/.local/bin/moshtty-remote"]', '~/.local/bin/moshtty-remote')

  // Save filled form screenshot
  await page.screenshot({ path: path.join(__dirname, 'bootstrap-2-filled.png') })

  // 5. Click the submit button "Bootstrap"
  console.log(
    'Submitting bootstrap request (this will copy, compile, upload and install Moshtty companion on macmini)...'
  )
  const submitBtn = page.locator('button[type="submit"]')
  await submitBtn.click()

  // 6. Wait for the progress panel to appear
  const progressPanel = page.locator('.bootstrap-progress-panel')
  await progressPanel.waitFor({ state: 'visible', timeout: 5000 })
  console.log('Progress panel visible. Waiting for steps to complete...')

  // Save progress screenshot
  await page.screenshot({ path: path.join(__dirname, 'bootstrap-3-running.png') })

  // 7. Wait for success state (which shows "Bootstrap Successful!") or error banner
  const successBanner = page.locator('.success-banner')
  const errorBanner = page.locator('.error-banner')

  await Promise.race([
    successBanner.waitFor({ state: 'visible', timeout: 45000 }),
    errorBanner.waitFor({ state: 'visible', timeout: 45000 })
  ])

  if (await successBanner.isVisible()) {
    console.log('E2E Bootstrap completed successfully!')
    await page.screenshot({ path: path.join(__dirname, 'bootstrap-4-success.png') })
    expect(true).toBe(true)
  } else {
    const errorMsg = await errorBanner.textContent()
    console.error('E2E Bootstrap failed with error:', errorMsg)
    await page.screenshot({ path: path.join(__dirname, 'bootstrap-4-error.png') })
    throw new Error(`Bootstrap failed: ${errorMsg}`)
  }
})
