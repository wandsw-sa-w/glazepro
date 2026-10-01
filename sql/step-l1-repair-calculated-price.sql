-- ============================================================
-- Step L1 — repair drawings.calculated_price
--
-- DO NOT RUN — paste into Supabase SQL editor.
--
-- Before this round's fix, priceQuote wrote its quote-level InstallSure
-- share INTO drawings.calculated_price instead of just the drawing-level
-- price (Step J/K fixes round 2, item 1). The app no longer reads
-- calculated_price for money shown to the user (see
-- src/quotes/drawingRunPrice.js) — it's a cache only now, refreshed every
-- time priceDrawing runs. But any drawing priced before that fix still has
-- the corrupted value sitting in the cache (e.g. drawing 8 = 68.80 instead
-- of 1622.44) until it's next re-priced.
--
-- This sets every drawing's calculated_price to the sum of `sales` on its
-- latest completed pricing run's price-rule rows only (drawing_rule_results
-- rows with sales IS NOT NULL — manufacture/install labour rows have
-- sales = NULL and are correctly excluded; see sql/step-l2-pricing-run-totals.sql
-- for the same fix applied to cost).
--
-- Safe to re-run: deterministic, idempotent.
-- ============================================================

BEGIN;

WITH latest_run AS (
  SELECT DISTINCT ON (drawing_id)
    id AS pricing_run_id,
    drawing_id
  FROM pricing_runs
  WHERE status = 'complete'
  ORDER BY drawing_id, created_at DESC
),
run_sales AS (
  SELECT
    lr.drawing_id,
    COALESCE(SUM(rr.sales), 0) AS total_sales
  FROM latest_run lr
  JOIN drawing_rule_results rr
    ON rr.pricing_run_id = lr.pricing_run_id
   AND rr.sales IS NOT NULL
  GROUP BY lr.drawing_id
)
UPDATE drawings d
SET calculated_price = rs.total_sales
FROM run_sales rs
WHERE d.id = rs.drawing_id
  AND d.calculated_price IS DISTINCT FROM rs.total_sales;

COMMIT;
