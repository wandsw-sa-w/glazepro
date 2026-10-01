-- ============================================================
-- Step L2 — pricing_runs.total_cost / total_sales
--
-- DO NOT RUN — paste into Supabase SQL editor.
--
-- Cost was being computed by summing drawing_rule_results.cost across every
-- row for a run, including manufacture_labour/install_labour rows — those
-- store `cost: minutes` (see pricingEngine.js steps 8-9), not pounds, so a
-- drawing with 1,337 manufacture + 450 install minutes added ~1,787 "cost"
-- on top of its real price-rule cost.
--
-- pricingEngine.js's own engine result (engineResults.price.total_cost /
-- .total) was already scoped to price-rule lines only — labour lines never
-- touched it. This just persists that already-correct number on the run
-- instead of re-deriving it (wrongly) from all of drawing_rule_results.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS, deterministic backfill.
-- ============================================================

BEGIN;

ALTER TABLE pricing_runs
  ADD COLUMN IF NOT EXISTS total_cost  numeric,
  ADD COLUMN IF NOT EXISTS total_sales numeric;

-- Backfill existing runs from their price-rule rows only (sales IS NOT NULL
-- — labour rows have sales = NULL, so they're excluded by this filter alone).
UPDATE pricing_runs pr
SET
  total_cost  = sub.total_cost,
  total_sales = sub.total_sales
FROM (
  SELECT
    pricing_run_id,
    COALESCE(SUM(cost), 0)  AS total_cost,
    COALESCE(SUM(sales), 0) AS total_sales
  FROM drawing_rule_results
  WHERE sales IS NOT NULL
  GROUP BY pricing_run_id
) sub
WHERE pr.id = sub.pricing_run_id
  AND pr.status = 'complete';

COMMIT;
