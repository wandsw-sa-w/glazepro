-- ============================================================
-- Step H2 — Publish / lock / copy / accept
--
-- DO NOT RUN — paste into Supabase SQL editor.
--
-- All columns were added in step-h1-quotes.sql.
-- This file adds only the quote_drawings unique constraint
-- (needed so upsert works correctly) and the lead_history
-- event-type check (if the table exists).
-- ============================================================

BEGIN;

-- ── quote_drawings: ensure UNIQUE (quote_id, job_item_id) ──────────────────
-- The matrix upsert requires this. ADD IF NOT EXISTS requires PG 9.3+; Supabase
-- uses PG 15 so this is safe.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quote_drawings_quote_id_job_item_id_key'
  ) THEN
    ALTER TABLE quote_drawings
      ADD CONSTRAINT quote_drawings_quote_id_job_item_id_key
      UNIQUE (quote_id, job_item_id);
  END IF;
END
$$;

-- ── lead_history event recording ──────────────────────────────────────────
-- lead_history exists (step-d migration). No schema changes needed here;
-- the application writes rows when publishing, copying, or accepting.

COMMIT;
