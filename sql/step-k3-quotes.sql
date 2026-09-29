-- ============================================================
-- Step K3 — Quote Overview
--
-- DO NOT RUN — paste into Supabase SQL editor.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.
-- ============================================================

BEGIN;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS label text;

COMMIT;
