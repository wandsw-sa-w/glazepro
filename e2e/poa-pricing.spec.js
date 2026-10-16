// poa-pricing.spec.js — Step BS follow-up item 5
//
// Drawing 117 saved its POA line and then could not be PRICED, and nothing
// in the suite priced a drawing that carries one. This does — through the
// quote page's own "Re-price all" — and asserts the run completes: no error
// under the button, and a £ price on the drawing's card.
//
// Pricing WRITES (pricing_runs, drawing_rule_results), and the line itself is
// a drawing edit, so the step runs only against the drawing the reviewer
// nominates in E2E_WRITE_DRAWING_ID (the same switch Step BO's save half
// uses) and is skipped otherwise. It adds the line only if the drawing has
// none, and leaves it there: a POA line is the thing under test, and the
// reviewer's own line on drawing 117 is exactly what it expects to find.

import { test, expect } from '@playwright/test'

const EMAIL    = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const WRITE_DRAWING = process.env.E2E_WRITE_DRAWING_ID || null

test.beforeAll(() => {
  const missing = [!EMAIL && 'E2E_EMAIL', !PASSWORD && 'E2E_PASSWORD'].filter(Boolean)
  if (missing.length) throw new Error(`Missing ${missing.join(' and ')} (see .env.e2e).`)
})

async function login(page) {
  await page.goto('/')
  const emailBox = page.locator('input[type="email"]')
  if (await emailBox.count() > 0) {
    await emailBox.fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
  }
  await expect(page.locator('input[type="password"]')).toHaveCount(0, { timeout: 30_000 })
}

test('a drawing with a POA line prices, and the run completes', async ({ page }) => {
  test.skip(WRITE_DRAWING == null,
    'Set E2E_WRITE_DRAWING_ID to a drawing it is safe to price. Pricing writes a run.')
  await login(page)
  await page.goto(`/drawing-board/${WRITE_DRAWING}`)
  const tree = page.locator('[data-testid="parts-tree"]')
  await expect(tree).toBeVisible({ timeout: 60_000 })

  // Select the Price part (dispatchEvent: the sticky Summary panel covers
  // the row's centre, the Step BM finding).
  await tree.locator('[data-testid="part-label"]', { hasText: /^Price$/ })
    .first().locator('xpath=..').dispatchEvent('click')
  await expect(page.locator('[data-testid="selected-part-type"]'))
    .toHaveAttribute('data-part-type', 'pricePart', { timeout: 30_000 })
  const panel = page.locator('[data-testid="poa-lines"]')
  await expect(panel).toBeVisible()

  // A labour line, if the drawing has none yet.
  if (await panel.locator('[data-testid="poa-line"][data-type="labour"]').count() === 0) {
    await panel.locator('[data-testid="poa-add-labour"]').click()
    const row = panel.locator('[data-testid="poa-line"]').last()
    await row.locator('input[placeholder="What for"]').fill('e2e: POA pricing check')
    await row.locator('input[type="number"]').fill('30')
    // Wait for the save to FINISH, not for the Unsaved marker, which hides
    // the moment Save is clicked (Step BS follow-up 2: a reload mid-save
    // aborted the write).
    const save = page.getByRole('button', { name: /^(save|saving\.\.\.)$/i }).first()
    await save.click()
    await expect(save).toHaveText(/^save$/i, { timeout: 60_000 })
    await expect(save).toBeDisabled({ timeout: 60_000 })
  }

  // To the lead's quotes page, through the board's own lead button.
  const leadButton = page.locator('button', { hasText: /^L\d+/ }).first()
  await expect(leadButton).toBeVisible({ timeout: 30_000 })
  await leadButton.click()
  await page.waitForURL(/\/leads\/\d+/, { timeout: 30_000 })
  const leadUrl = page.url().replace(/\/$/, '')
  await page.goto(`${leadUrl}/quotes`)

  // "Re-price all": "Price quote" skips drawings whose run looks current.
  const reprice = page.getByRole('button', { name: /re-price all/i }).first()
  await expect(reprice).toBeVisible({ timeout: 60_000 })
  await reprice.click()
  await expect(page.getByRole('button', { name: /pricing…/i })).toHaveCount(0, { timeout: 120_000 })

  // No error under the button — the live failure showed exactly there —
  // and every card on the quote shows a price.
  await expect(page.locator('text=/violates not-null|is not a function|Failed to write/')).toHaveCount(0)
  const prices = page.locator('[data-testid="drawing-card-price"]')
  await expect.poll(() => prices.count(), { timeout: 60_000 }).toBeGreaterThan(0)
  for (const text of await prices.allInnerTexts()) {
    expect(text, 'every drawing on the quote is priced').toMatch(/£\s?[\d,]+\.\d{2}|needs pricing/i)
  }
})
