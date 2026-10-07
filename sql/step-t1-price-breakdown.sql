-- ============================================================
-- Step T1 — Price breakdown on a real drawing
--
-- Written for Nathan to paste into the Supabase SQL editor.
--
-- The Price breakdown view (drawing board Price part / Quote Matrix
-- drawing card) shows exactly what was STORED for a drawing's latest
-- pricing run. drawing_rule_results only held cost / sales / markup,
-- so this step adds the per-line detail the benchmark table shows,
-- plus who ran a pricing run and the warnings it produced.
--
-- Runs recorded before this step keep NULL in the new columns and the
-- view labels them "detail not recorded" — no backfill is possible
-- (the detail was never computed for those runs) and none is attempted.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS only.
-- ============================================================

BEGIN;

-- 1. Per-line detail written by priceDrawing() step 11
--    (quantity, value as evaluated; part_label = component allocation
--    label e.g. 'Parting bead for height'; part_code = allocated part
--    code, ironmongery kit part code, or tree part type)
ALTER TABLE drawing_rule_results
  ADD COLUMN IF NOT EXISTS quantity   numeric,
  ADD COLUMN IF NOT EXISTS value      numeric,
  ADD COLUMN IF NOT EXISTS part_label text,
  ADD COLUMN IF NOT EXISTS part_code  text;

-- 2. Run metadata: who ran it, and the engine warnings stored with the
--    run (jsonb array of strings) so the breakdown shows the warnings
--    of THAT run, not a recomputation
ALTER TABLE pricing_runs
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS warnings   jsonb;

COMMIT;

-- ============================================================
-- ROLLBACK — DO NOT RUN
-- (only if this step must be reversed; statements left commented
--  out so pasting the whole file never executes them)
-- ============================================================
-- BEGIN;
-- ALTER TABLE drawing_rule_results
--   DROP COLUMN IF EXISTS quantity,
--   DROP COLUMN IF EXISTS value,
--   DROP COLUMN IF EXISTS part_label,
--   DROP COLUMN IF EXISTS part_code;
-- ALTER TABLE pricing_runs
--   DROP COLUMN IF EXISTS created_by,
--   DROP COLUMN IF EXISTS warnings;
-- COMMIT;
