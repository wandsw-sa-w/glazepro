-- ============================================================
-- Step T2 — pricing_runs.engine_version
--
-- Written for Nathan to paste into the Supabase SQL editor.
--
-- PRICING_ENGINE_VERSION (src/pricing/engineVersion.js, an integer
-- bumped by hand whenever pricing logic changes; currently 2) is stored
-- on every new pricing run. A drawing is re-priced when its tree hash,
-- its price file, or the engine version differs from its latest
-- successful run.
--
-- Deliberately NO backfill: existing runs keep engine_version NULL and
-- count as "priced with an older version". That is the point — they
-- include runs from the old incomplete path (no glass catalogue, part
-- costs or ironmongery on real quotes), e.g. L507712 drawing 1's
-- 1,622.44, and must be re-priced even though their tree and price
-- file have not changed. Published quotes are never re-priced; they
-- keep their snapshot.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS only.
-- ============================================================

BEGIN;

ALTER TABLE pricing_runs
  ADD COLUMN IF NOT EXISTS engine_version integer;

COMMIT;

-- ============================================================
-- ROLLBACK — DO NOT RUN
-- (only if this step must be reversed; statement left commented
--  out so pasting the whole file never executes it)
-- ============================================================
-- BEGIN;
-- ALTER TABLE pricing_runs
--   DROP COLUMN IF EXISTS engine_version;
-- COMMIT;
