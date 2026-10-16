// ironmongery-picker.spec.js — Step BO item 4
//
// The live step the brief asks for: "adds a line through the picker, saves,
// reloads and finds it".
//
// It is in TWO halves, because this suite runs on every deploy against the
// real site and the reviewer is about to compare installation materials on
// leads 11-15 line by line:
//
//   * READ ONLY, always: open a drawing, open the picker, add a line, prove
//     the line is in the set, marked as chosen, and that the drawing says
//     Unsaved — then reload WITHOUT saving and prove nothing was written.
//     That is the whole of the picker, short of the save.
//
//   * THE SAVE, only when E2E_WRITE_DRAWING_ID names a drawing to write to:
//     add a line, SAVE, reload, find it, then remove it and save again so
//     the drawing is left as it was found. Without the variable the step is
//     SKIPPED rather than quietly saving over whatever drawing it was
//     pointed at — a half-finished cleanup would change exactly the data
//     the reviewer is comparing against Integrate.
//
// The offline cover for the save half is the round trip in
// src/drawingBoard/ironmongerySet.test.js, which saves and loads the set
// through the same flatten / rebuild `drawing_parts` does.

import { test, expect } from '@playwright/test'

const EMAIL    = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
// Drawing 69 on L507712 item 8 — the casement the other board steps use.
const READ_ONLY_DRAWING = process.env.E2E_DRAWING_ID || '69'
// A drawing it is SAFE to write to. The reviewer sets this; nothing is
// saved without it.
const WRITE_DRAWING = process.env.E2E_WRITE_DRAWING_ID || null
// A product with ONE finish, so the picker needs no finish answered.
const PRODUCT = 'kenrick_extension_490mm'

test.beforeAll(() => {
  const missing = [!EMAIL && 'E2E_EMAIL', !PASSWORD && 'E2E_PASSWORD'].filter(Boolean)
  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(' and ')}. Create a local .env.e2e (git-ignored) ` +
      'with the test user Nathan made — see the README. Never commit it.')
  }
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

/**
 * Open a drawing and select Finish & Ironmongery.
 *
 * dispatchEvent, not click(): the tree row's handler is on the containing
 * div and the sticky Summary panel covers the row's centre point at this
 * viewport, so click() waits for actionability it never gets (the Step BM
 * finding).
 */
async function openIronmongery(page, drawingId) {
  await page.goto(`/drawing-board/${drawingId}`)
  const tree = page.locator('[data-testid="parts-tree"]')
  await expect(tree).toBeVisible({ timeout: 60_000 })
  await tree.locator('[data-testid="part-label"]', { hasText: 'Finish & Ironmongery' })
    .first().locator('xpath=..').dispatchEvent('click')
  const selected = page.locator('[data-testid="selected-part-type"]')
  await expect(selected, 'the F&I panel must be open')
    .toHaveAttribute('data-part-type', 'paintAndIronmongeryPart', { timeout: 30_000 })
  // The catalogue loads lazily when the panel opens; the button says so
  // until it is there.
  const add = page.locator('[data-testid="ironmongery-add-line"]')
  await expect(add).toBeEnabled({ timeout: 60_000 })
  return { tree, add }
}

/**
 * Save, and wait for the save to FINISH. The Unsaved marker hides the moment
 * Save is clicked (it is `dirty && saveStatus !== 'saving'`), so waiting for
 * it to go is waiting for nothing — the first run of this step reloaded
 * mid-save, the write was aborted, and the drawing came back without the
 * line (Step BS follow-up 2). The button reads "Saving..." while the write
 * is in flight and is disabled once the drawing is clean, so that is the
 * signal; a failed save leaves it enabled and this times out, loudly.
 */
async function saveAndWait(page) {
  const save = page.getByRole('button', { name: /^(save|saving\.\.\.)$/i }).first()
  await save.click()
  await expect(save).toHaveText(/^save$/i, { timeout: 60_000 })
  await expect(save).toBeDisabled({ timeout: 60_000 })
}

/** Add PRODUCT through the picker. Returns its qty before the add, if any. */
async function addThroughPicker(page, add) {
  const line = page.locator(`[data-testid="ironmongery-line"][data-product="${PRODUCT}"]`)
  const before = await line.count() > 0
    ? await line.locator('input[type="number"]').inputValue()
    : null

  await add.click()
  const picker = page.locator('[data-testid="ironmongery-picker"]')
  await expect(picker).toBeVisible({ timeout: 30_000 })

  // The catalogue is 630 products: search for the one we want, by CODE.
  await picker.locator('[data-testid="ironmongery-picker-search"]').fill(PRODUCT)
  const row = picker.locator(`[data-testid="ironmongery-picker-row"][data-product="${PRODUCT}"]`)
  await expect(row, `${PRODUCT} must be in the picker`).toBeVisible({ timeout: 30_000 })
  // Its unit cost is shown
  await expect(row).toContainText(/£\d+\.\d{2}/)
  await row.getByRole('button', { name: 'Add' }).click()
  await picker.getByRole('button', { name: 'Done' }).click()
  await expect(picker).toHaveCount(0)
  return before
}

test.describe('Step BO — the ironmongery product picker', () => {
  test('adds a line through the picker, and saves nothing', async ({ page }) => {
    await login(page)
    const { add } = await openIronmongery(page, READ_ONLY_DRAWING)

    const marker = page.locator('[data-testid="unsaved-marker"]')
    await expect(marker, 'nothing unsaved before the edit').toHaveCount(0)

    const before = await addThroughPicker(page, add)

    // The line is in the set, and the set now says it is the stored one.
    const line = page.locator(`[data-testid="ironmongery-line"][data-product="${PRODUCT}"]`)
    await expect(line).toHaveCount(1)
    if (before == null) {
      await expect(line, 'a picked line reads as chosen').toContainText('chosen')
      expect(await line.locator('input[type="number"]').inputValue()).toBe('1')
    } else {
      // The product was already in the set: picking it again bumps the qty.
      expect(Number(await line.locator('input[type="number"]').inputValue()))
        .toBe(Number(before) + 1)
    }
    await expect(page.locator('[data-testid="ironmongery-set-origin"]'))
      .toHaveAttribute('data-edited', 'true')
    await expect(marker, 'the edit is unsaved and says so').toBeVisible()

    // Reload WITHOUT saving: the edit is discarded, so nothing was written.
    await page.goto(`/drawing-board/${READ_ONLY_DRAWING}`)
    await expect(page.locator('[data-testid="parts-tree"]')).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('[data-testid="unsaved-marker"]')).toHaveCount(0)
  })

  test('saves the picked line, reloads and finds it', async ({ page }) => {
    test.skip(WRITE_DRAWING == null,
      'Set E2E_WRITE_DRAWING_ID to a drawing it is safe to save to. Without it ' +
      'this step would write to a live drawing on every deploy.')
    await login(page)
    const { add } = await openIronmongery(page, WRITE_DRAWING)
    // Was the set the RULE DEFAULTS before we touched it? Then the cleanup
    // can put the defaults back, flag and all; a surveyor's own set must
    // only ever lose the one line we added.
    const wasEdited = await page.locator('[data-testid="ironmongery-set-origin"]')
      .getAttribute('data-edited') === 'true'
    const before = await addThroughPicker(page, add)

    await saveAndWait(page)

    // Reload and find it.
    const { add: add2 } = await openIronmongery(page, WRITE_DRAWING)
    const line = page.locator(`[data-testid="ironmongery-line"][data-product="${PRODUCT}"]`)
    await expect(line, 'the saved line comes back').toHaveCount(1)
    await expect(page.locator('[data-testid="ironmongery-set-origin"]'))
      .toHaveAttribute('data-edited', 'true')
    expect(add2).toBeTruthy()

    // Leave the drawing as it was found. A set that was the rule defaults
    // goes back to being the rule defaults — "Apply Defaults", through its
    // confirm — so the edited flag is cleared too; removing the line alone
    // would leave the drawing marked as a chosen set.
    if (!wasEdited) {
      await page.locator('[data-testid="ironmongery-apply-defaults"]').click()
      await page.getByRole('button', { name: /^apply defaults$/i }).click()
      await expect(line).toHaveCount(0)
      await expect(page.locator('[data-testid="ironmongery-set-origin"]'))
        .toHaveAttribute('data-edited', 'false')
    } else if (before == null) {
      await line.getByTitle('Remove').click()
      await expect(line).toHaveCount(0)
    } else {
      await line.locator('input[type="number"]').fill(before)
    }
    await saveAndWait(page)
  })
})
