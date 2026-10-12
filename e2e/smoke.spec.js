// smoke.spec.js — Step AT item 4: live, READ-ONLY smoke tests.
//
// Everything here only OPENS pages and reads them. Nothing is created,
// changed or saved: no Save button is pressed, no "Price quote" is run, no
// drawing is edited. The one side effect is Supabase's own session from
// logging in.
//
// Credentials come from .env.e2e (git-ignored, filled by Nathan). They are
// never printed — a missing file fails with the variable NAMES only.

import { test, expect } from '@playwright/test'

const EMAIL    = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

// The parked residuals (docs/integrate-differences.md). These are the ONLY
// benchmarks allowed to read FAIL, and they must still read exactly their
// parked amounts — a residual that moves is a real change, and a residual
// that silently becomes PASS means someone tuned something.
const PARKED = {
  A50: { cost: '0.28', price: '0.42' },
  D:   { cost: '0.54', price: '0.80' },
}

// NOTE on the Kenrick gearbox gap (J–P £14.70, Q/R/S £8.40): that is a gap in
// the repository's CAPTURED pf30-snapshot.json, not in the live data. Nathan
// has run sql/step-ap0-gearbox-part-costs.sql, and this page prices from the
// LIVE catalogue, so those rows read 0.00 here — verified 12 Oct. No
// allowance is made for them, so losing those part costs again would fail
// this test, which is the point.

test.beforeAll(() => {
  // The names only — never the values.
  const missing = [
    !EMAIL && 'E2E_EMAIL',
    !PASSWORD && 'E2E_PASSWORD',
  ].filter(Boolean)
  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(' and ')}. Create a local .env.e2e (git-ignored) ` +
      'with the test user Nathan made — see the README. Never commit it.')
  }
})

/** Log in through the real form and wait for the app to be up. */
async function login(page) {
  await page.goto('/')
  // Already signed in from a previous test in this file? The form will not
  // be there.
  const emailBox = page.locator('input[type="email"]')
  if (await emailBox.count() > 0) {
    await emailBox.fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
  }
  // The login form is gone once the session is live
  await expect(page.locator('input[type="password"]')).toHaveCount(0, { timeout: 30_000 })
}

test.describe('GlazePro live smoke (read only)', () => {
  test('logs in', async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL(/glazepro|localhost/)
  })

  test('every benchmark passes except the parked residuals', async ({ page }) => {
    await login(page)
    await page.goto('/dev/pricing-benchmark')

    const rows = page.locator('[data-testid="benchmark-row"]')
    await expect.poll(() => rows.count(), { timeout: 90_000 }).toBeGreaterThan(20)

    const n = await rows.count()
    const unexpected = []
    const seen = []
    for (let i = 0; i < n; i++) {
      const row = rows.nth(i)
      const key = await row.getAttribute('data-benchmark')
      const status = await row.getAttribute('data-status')
      const costDiff = await row.getAttribute('data-cost-diff')
      const priceDiff = await row.getAttribute('data-price-diff')
      seen.push(key)

      if (status === 'PASS') {
        // A parked residual that has quietly become PASS is just as much a
        // change as one that has grown.
        if (PARKED[key]) {
          unexpected.push(`${key} now PASSES but is parked at £${PARKED[key].cost} — has something been tuned?`)
        }
        continue
      }

      if (PARKED[key]) {
        // Must still be EXACTLY the parked amount
        if (costDiff !== PARKED[key].cost || priceDiff !== PARKED[key].price) {
          unexpected.push(
            `${key} parked at cost £${PARKED[key].cost} / price £${PARKED[key].price}, ` +
            `now cost £${costDiff} / price £${priceDiff}`)
        }
        continue
      }

      unexpected.push(`${key} FAILED: cost diff £${costDiff}, price diff £${priceDiff}`)
    }

    expect(seen).toContain('A50')
    expect(seen).toContain('D')
    expect(seen).toContain('Q')
    expect(unexpected, unexpected.join('\n')).toEqual([])
  })

  test('the fanlight drawing shows Fanlight A1 and Casement Sash A2', async ({ page }) => {
    await login(page)
    await page.goto('/drawing-board/24')

    const tree = page.locator('[data-testid="parts-tree"]')
    await expect(tree).toBeVisible({ timeout: 60_000 })

    const labels = tree.locator('[data-testid="part-label"]')
    await expect.poll(() => labels.count(), { timeout: 60_000 }).toBeGreaterThan(3)
    const texts = await labels.allInnerTexts()

    // Integrate's own names, with the matrix position (Step AR item 2)
    expect(texts, texts.join(' | ')).toContain('Fanlight A1')
    expect(texts, texts.join(' | ')).toContain('Casement Sash A2')
    // A1 must come BEFORE A2 — the list and the drawing have to read the
    // same way round (the 12 Oct finding)
    expect(texts.indexOf('Fanlight A1')).toBeLessThan(texts.indexOf('Casement Sash A2'))
  })

  test('the validation panel loads without an error', async ({ page }) => {
    await login(page)
    await page.goto('/drawing-board/24')

    const panel = page.locator('[data-testid="validation-panel"]')
    await expect(panel).toBeVisible({ timeout: 60_000 })
    await expect.poll(() => panel.getAttribute('data-loading'), { timeout: 60_000 }).toBe('false')

    const text = await panel.innerText()

    // A failed glass-catalogue load IS an error: it silently disables the
    // casement weight rule (Step AS item 2).
    expect(text, text).not.toContain('Could not load the glass catalogue')

    // An UNEVALUABLE check is not an error — it is a disclosed gap, and
    // Step AS made them visible on purpose. The live drawing shows one for
    // `is_replacement_sashes_range`, an item-level rule whose variable
    // GlazePro does not compute yet; that predates this work. What must
    // never happen is a CASEMENT variable going missing, because supplying
    // them is what Step AS is for.
    const CASEMENT_VARS = [
      'is_fanlight', 'gross_bottom_rail_height_in_mm', 'weight_in_kg',
      'is_opening', 'is_side_hung', 'is_top_hung', 'is_bottom_hung',
      'is_casement_mpls', 'is_storm_proof', 'gross_sash_width_in_mm',
      'gross_sash_height_in_mm',
    ]
    for (const name of CASEMENT_VARS) {
      expect(text, `${name} must never be an unevaluable variable`)
        .not.toContain(`missing: ${name}`)
    }

    // Drawing 24's fanlight still has the 83 mm rail it was drawn with
    // (sql/step-as0 changed the TEMPLATE and the profile default, not
    // existing drawings), so Integrate's own warning shows against the LIVE
    // rules — and must name the right opening.
    if (/Fanlight bottom rail/.test(text)) {
      expect(text).toContain('Fanlight A1')
    }
  })

  test('every drawing card on the L507712 quote matrix shows a price', async ({ page }) => {
    await login(page)
    await page.goto('/leads/9/quotes')

    const cards = page.locator('[data-testid="drawing-card"]')
    await expect.poll(() => cards.count(), { timeout: 90_000 }).toBeGreaterThan(0)

    const n = await cards.count()
    const priceless = []
    for (let i = 0; i < n; i++) {
      const card = cards.nth(i)
      const id = await card.getAttribute('data-drawing-id')
      const label = card.locator('[data-testid="drawing-card-price"]')
      const text = (await label.count()) > 0 ? (await label.innerText()).trim() : ''
      // A priced card shows a money figure; an unpriced one shows a dash or
      // "needs pricing".
      if (!/£\s?[\d,]+\.\d{2}/.test(text)) priceless.push(`drawing ${id}: "${text}"`)
    }
    expect(priceless, priceless.join('\n')).toEqual([])
  })
})
