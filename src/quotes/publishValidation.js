/**
 * publishValidation.js — pure helpers for publish/lock/copy/accept guards.
 * No I/O. All inputs are plain objects from the QuoteMatrix state.
 */

/**
 * Check whether a drawing is stale for a given quote.
 * Stale = no completed pricing run OR the run used a different price file.
 *
 * @param {object} quote         - {id, price_file_id, status}
 * @param {string} drawingId     - drawing UUID
 * @param {object} latestRuns    - { drawingId: {price_file_id, status} }
 */
export function isDrawingStale(quote, drawingId, latestRuns) {
  const run = latestRuns[drawingId]
  if (!run) return true
  if (quote.price_file_id && run.price_file_id !== quote.price_file_id) return true
  return false
}

/**
 * Validate whether a quote can be published.
 * Returns { ok, staleDwgIds, poaItemIndices, reason }.
 *
 * ok = false:  publishing is blocked (stale drawings)
 * ok = true, poaItemIndices.length > 0: publishing needs confirmation (POA items present)
 * ok = true, poaItemIndices.length === 0: ready to publish immediately
 *
 * @param {object}   quote           - quote row
 * @param {Array}    jobItems        - job_items rows
 * @param {Array}    drawings        - drawings rows (need id, calculated_price, poa)
 * @param {object}   selections      - { `${quoteId}_${jobItemId}`: drawingId }
 * @param {object}   latestRuns      - { drawingId: {price_file_id, status} }
 * @param {number}   [validationErrorCount=0] - count of fired validation errors
 */
export function validatePublish(quote, jobItems, drawings, selections, latestRuns, validationErrorCount = 0) {
  const staleDwgIds = []
  const poaItemIndices = []
  let selectedCount = 0

  for (let idx = 0; idx < jobItems.length; idx++) {
    const item = jobItems[idx]
    const drawingId = selections[`${quote.id}_${item.id}`]
    if (!drawingId) continue
    selectedCount++

    if (isDrawingStale(quote, drawingId, latestRuns)) {
      staleDwgIds.push(drawingId)
    }

    const dwg = drawings.find(d => d.id === drawingId)
    if (dwg?.poa) poaItemIndices.push(idx)
  }

  if (selectedCount === 0) {
    return {
      ok: false,
      staleDwgIds: [],
      poaItemIndices: [],
      reason: 'Add at least one item before publishing.',
    }
  }

  if (staleDwgIds.length > 0) {
    return {
      ok: false,
      staleDwgIds,
      poaItemIndices,
      reason: `${staleDwgIds.length} drawing(s) need pricing before this quote can be published.`,
    }
  }

  if (validationErrorCount > 0) {
    return {
      ok: false,
      staleDwgIds: [],
      poaItemIndices,
      reason: `${validationErrorCount} validation error(s) must be resolved before publishing.`,
    }
  }

  return { ok: true, staleDwgIds: [], poaItemIndices, reason: null }
}

/**
 * Return the next quote number string for a lead (Q1, Q2, …).
 *
 * @param {Array} existingQuotes - quotes rows for the lead, already ordered
 */
export function nextQuoteNumber(existingQuotes) {
  return `Q${existingQuotes.length + 1}`
}

/**
 * Return true if the quote is in a locked state (Published or Accepted).
 */
export function isLocked(quote) {
  return quote.status === 'Published' || quote.status === 'Accepted'
}
