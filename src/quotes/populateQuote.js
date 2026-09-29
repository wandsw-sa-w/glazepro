/**
 * populateQuote.js — pure helper for the Quote Matrix's floating quote picker
 * "Populate" dropdown. No I/O; returns a patch of draft selections to merge
 * into the panel's local draft state (`${quoteId}_${jobItemId}` -> drawingId).
 *
 * Modes:
 *   'first'       - pick the first non-deleted drawing of each item
 *   'clear'       - clear every item's selection for this quote
 *   'copy:<qId>'  - copy another quote's draft/saved selections for this quote
 */

/**
 * @param {string} mode
 * @param {string|number} quoteId          - the quote being populated
 * @param {Array<{id: string|number}>} jobItems
 * @param {Array<{id: string|number, job_item_id: string|number, deleted_at?: string|null}>} drawings
 * @param {Object} draft                   - current draft map, `${quoteId}_${jobItemId}` -> drawingId
 * @returns {Object} patch to merge into draft — same key shape, values are drawingId or ''
 */
export function computePopulatePatch(mode, quoteId, jobItems, drawings, draft) {
  const patch = {}

  if (mode === 'clear') {
    for (const item of jobItems) patch[`${quoteId}_${item.id}`] = ''
    return patch
  }

  if (mode === 'first') {
    for (const item of jobItems) {
      const first = drawings.find(d => d.job_item_id === item.id && !d.deleted_at)
      patch[`${quoteId}_${item.id}`] = first ? first.id : ''
    }
    return patch
  }

  if (typeof mode === 'string' && mode.startsWith('copy:')) {
    const fromId = mode.slice(5)
    for (const item of jobItems) {
      patch[`${quoteId}_${item.id}`] = draft[`${fromId}_${item.id}`] || ''
    }
    return patch
  }

  return patch
}
