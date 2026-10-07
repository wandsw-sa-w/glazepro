/**
 * runBreakdown.js
 * Pure mapping from stored pricing-run rows (drawing_rule_results + the
 * price_rules they referenced) to the line shape the shared PriceTable
 * renders. The Price breakdown view shows EXACTLY what was stored for a
 * run — it never re-runs the pricing engine.
 */

/**
 * True when a set of stored result rows carries the per-line detail
 * (quantity / value / part label) added by sql/step-t1-price-breakdown.sql.
 * Runs recorded before that step have only cost / sales / markup.
 */
export function hasRecordedDetail(rows) {
  return (rows ?? []).some(r => r.quantity != null || r.value != null || r.part_label != null || r.part_code != null)
}

/**
 * Map stored price-rule result rows to PriceTable lines.
 *
 * @param {Array}  rows      - drawing_rule_results rows for ONE pricing run,
 *                             price-rule rows only (sales IS NOT NULL — labour
 *                             rows store minutes in `cost` and must stay out).
 * @param {Object} rulesById - price_rules rows keyed by id (name, group_name)
 * @returns {Array} lines in the engine/PriceTable shape
 */
export function buildBreakdownLines(rows, rulesById) {
  return (rows ?? [])
    .filter(r => r.sales != null)
    .map(r => {
      const rule = rulesById?.[r.price_rule_id] ?? null
      return {
        rule_id:         r.price_rule_id,
        name:            rule?.name ?? '(rule no longer in price file)',
        group_name:      rule?.group_name ?? null,
        alloc_label:     r.part_label ?? null,
        alloc_part_code: r.part_code ?? null,
        part_type:       null,
        quantity:        r.quantity,
        value:           r.value,
        markup:          r.markup_applied,
        line_cost:       r.cost,
        line_total:      r.sales,
        fires:           true,
        error:           null,
      }
    })
}
