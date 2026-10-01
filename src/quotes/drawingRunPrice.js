// drawingRunPrice.js — single source of truth for "what does this drawing
// cost/sell for, right now".
//
// drawings.calculated_price is a cache only (written by priceDrawing after
// each run). It can go stale — priceQuote never writes it, so after a
// quote-level pass a drawing's cache can still hold whatever the last
// drawing-level run (or, before the Step J/K round-2 fix, a buggy
// quote-level overwrite) left behind. The actual source of truth is a
// drawing's LATEST COMPLETED pricing_run, summed from drawing_rule_results.
//
// This logic was originally inline in pricingEngine.js#priceQuote; it's
// pulled out here so every surface that shows or totals a drawing's price
// (matrix card, picker, picker Total, Quote Overview, Financial Schedule,
// the lead's Quote tab, the publish snapshot) reads the same number the
// same way.

/**
 * Load each drawing's drawing-level sales/cost from its latest completed
 * pricing run.
 *
 * Reads pricing_runs.total_cost/total_sales directly (sql/step-l2-pricing-run-totals.sql) —
 * the same price-rule-only totals runPricingOnTree computes as
 * engineResults.price.total_cost/.total, which never include
 * manufacture_labour/install_labour rows (those store `cost: minutes`, not
 * pounds, in drawing_rule_results — summing that table directly, without
 * excluding them, was the earlier bug here).
 *
 * @param {Array<string|number>} drawingIds
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<Object<string, {sales: number|null, cost: number|null, pricingRunId: string|null, priceFileId: string|null}>>}
 *          keyed by String(drawingId)
 */
export async function loadDrawingRunPrices(drawingIds, supabase) {
  const ids = [...new Set((drawingIds || []).filter(id => id != null))]

  const result = {}
  for (const id of ids) {
    result[String(id)] = { sales: null, cost: null, pricingRunId: null, priceFileId: null }
  }
  if (ids.length === 0) return result

  const { data: runs } = await supabase
    .from('pricing_runs')
    .select('id, drawing_id, price_file_id, total_cost, total_sales, created_at')
    .in('drawing_id', ids)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })

  const latestRun = {}
  for (const run of (runs || [])) {
    const key = String(run.drawing_id)
    if (!latestRun[key]) latestRun[key] = run
  }

  for (const [key, run] of Object.entries(latestRun)) {
    result[key] = {
      sales:        run.total_sales != null ? Number(run.total_sales) : null,
      cost:         run.total_cost  != null ? Number(run.total_cost)  : null,
      pricingRunId: run.id,
      priceFileId:  run.price_file_id,
    }
  }

  return result
}

/**
 * Pure lookup: a drawing's net price for display, given a runPrices map
 * from loadDrawingRunPrices. price_override still wins over the run price.
 *
 * @param {object|null} drawing
 * @param {Object<string, {sales: number|null}>} runPrices
 * @returns {number|null}
 */
export function drawingRunSales(drawing, runPrices) {
  if (!drawing) return null
  if (drawing.price_override != null && drawing.price_override !== '') {
    const override = parseFloat(drawing.price_override)
    if (isFinite(override)) return override
  }
  const sales = runPrices?.[String(drawing.id)]?.sales
  return sales != null ? Number(sales) : null
}
