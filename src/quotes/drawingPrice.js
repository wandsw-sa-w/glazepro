// drawingPrice.js — shared helper for drawing price labels.
//
// Used by QuoteMatrixPage (card footer, picker) so both surfaces
// always show the same price in the same format.

/**
 * Format n as £X,XXX.XX
 */
function fmtNet(n) {
  return `£${Number(n).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Return the effective net price for a drawing.
 * price_override takes precedence; otherwise uses calculated_price
 * (which pricingEngine writes after each run, including quote-level
 * apportionment).
 *
 * @param {object|null} drawing
 * @returns {number|null}
 */
export function drawingNetPrice(drawing) {
  if (!drawing || drawing.poa) return null
  const raw = drawing.price_override ?? drawing.calculated_price
  const n = parseFloat(raw)
  return isFinite(n) ? n : null
}

/**
 * Return the price-file name for a drawing's latest completed run.
 *
 * @param {object|null}  drawing
 * @param {Array}        priceFiles  — [{ id, name }]
 * @param {object}       latestRuns  — { [drawingId]: { price_file_id } }
 * @returns {string}
 */
export function drawingPfName(drawing, priceFiles, latestRuns) {
  if (!drawing) return '—'
  const run = latestRuns?.[drawing.id]
  const pf  = priceFiles?.find(p => p.id === run?.price_file_id)
  return pf?.name || '—'
}

/**
 * Format the card-footer label for a drawing.
 * Output: "PF 30 £1,622.44 Qty 1" · "PF 30 POA Qty 1" · "PF 30 — Qty 1"
 *
 * @param {object|null} drawing
 * @param {Array}       priceFiles
 * @param {object}      latestRuns
 * @param {number}      [qty=1]
 * @returns {string}
 */
export function drawingCardLabel(drawing, priceFiles, latestRuns, qty = 1) {
  const pfName = drawingPfName(drawing, priceFiles, latestRuns)
  if (drawing?.poa) return `${pfName} POA Qty ${qty}`
  const net = drawingNetPrice(drawing)
  return `${pfName} ${net != null ? fmtNet(net) : '—'} Qty ${qty}`
}

/**
 * Format the picker-option label for a drawing.
 * Output: "Drawing 1 · PF 30 £1,622.44 Qty 1"
 *
 * @param {object|null} drawing
 * @param {number}      drawingNum
 * @param {Array}       priceFiles
 * @param {object}      latestRuns
 * @param {number}      [qty=1]
 * @returns {string}
 */
export function drawingPickerLabel(drawing, drawingNum, priceFiles, latestRuns, qty = 1) {
  return `Drawing ${drawingNum} · ${drawingCardLabel(drawing, priceFiles, latestRuns, qty)}`
}
