-- ============================================================
-- Step K1 — Lead page fields
--
-- DO NOT RUN — paste into Supabase SQL editor.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS, ON CONFLICT DO NOTHING.
-- Only adds columns that don't already exist (checked against code/migrations
-- as of Step H2 / Step J1).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. leads — new columns for the Lead Details table, tracking
--    panels and soft delete.
-- ============================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS rating              smallint,
  ADD COLUMN IF NOT EXISTS method_of_contact    text,
  ADD COLUMN IF NOT EXISTS product_type         text,
  ADD COLUMN IF NOT EXISTS account_id           text,
  ADD COLUMN IF NOT EXISTS deleted_at           timestamptz,
  ADD COLUMN IF NOT EXISTS admin_notes          text,
  ADD COLUMN IF NOT EXISTS sales_date           date,
  ADD COLUMN IF NOT EXISTS survey_notes         text,
  ADD COLUMN IF NOT EXISTS installation_date    date,
  ADD COLUMN IF NOT EXISTS installation_notes   text;

-- rating is 1-5 stars per the brief; allow NULL (not yet rated).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_rating_range'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_rating_range CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5));
  END IF;
END
$$;

-- ============================================================
-- 2. lead_uploads — columns for the Upload tab table
--    (Uploaded by · Photos taken by · Qty · Size).
-- ============================================================

ALTER TABLE lead_uploads
  ADD COLUMN IF NOT EXISTS uploaded_by      text,
  ADD COLUMN IF NOT EXISTS photos_taken_by  text,
  ADD COLUMN IF NOT EXISTS file_size        bigint;

-- ============================================================
-- 3. Reference categories: method_of_contact, product_type
-- ============================================================

INSERT INTO reference_categories (category, label, group_name, is_multi, has_quantity, sort_order)
VALUES
  ('method_of_contact', 'Method of Contact', 'Lead', false, false, 410),
  ('product_type',      'Product Type',      'Lead', false, false, 420)
ON CONFLICT (category) DO NOTHING;

INSERT INTO reference_options (category, code, label, sort_order, is_active)
VALUES
  ('method_of_contact', 'phone',     'Phone',     10, true),
  ('method_of_contact', 'email',     'Email',     20, true),
  ('method_of_contact', 'web_form',  'Web form',  30, true),
  ('method_of_contact', 'walk_in',   'Walk-in',   40, true),
  ('method_of_contact', 'referral',  'Referral',  50, true)
ON CONFLICT (category, code) DO NOTHING;

INSERT INTO reference_options (category, code, label, sort_order, is_active)
VALUES
  ('product_type', 'sash',     'Sash',     10, true),
  ('product_type', 'casement', 'Casement', 20, true),
  ('product_type', 'door',     'Door',     30, true),
  ('product_type', 'mixed',    'Mixed',    40, true)
ON CONFLICT (category, code) DO NOTHING;

COMMIT;
