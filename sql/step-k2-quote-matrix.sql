-- ============================================================
-- Step K2 — Quote Matrix page
--
-- DO NOT RUN — paste into Supabase SQL editor.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.
-- Adds soft-delete + ordering columns needed for the toolbar's
-- Deleted Items / Show Deleted / Sort Items / Sort Drawings features.
-- Confirmed against Nathan's live column export in
-- docs/step-b1-inspect-results.md — job_items and drawings have
-- neither deleted_at nor sort_order today.
-- ============================================================

BEGIN;

ALTER TABLE job_items
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sort_order integer;

ALTER TABLE drawings
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sort_order integer;

-- Backfill sort_order from the existing numbering so ordering is stable
-- the first time the matrix page loads.
UPDATE job_items SET sort_order = item_number WHERE sort_order IS NULL;
UPDATE drawings   SET sort_order = drawing_number WHERE sort_order IS NULL;

COMMIT;
