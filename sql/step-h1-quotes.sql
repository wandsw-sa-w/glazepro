-- ============================================================
-- Step H1 — Quote builder: prices & totals
--
-- DO NOT RUN — paste into Supabase SQL editor.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS, ON CONFLICT DO NOTHING.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. price_files.is_current
--    Marks the price file the system should use by default.
--    At most one row may have is_current = true (partial unique index).
--    DO NOT flip the existing draft PF30 import to is_current here —
--    Nathan sets this manually once he has verified the price file.
-- ============================================================

ALTER TABLE price_files
  ADD COLUMN IF NOT EXISTS is_current boolean;

CREATE UNIQUE INDEX IF NOT EXISTS price_files_one_current
  ON price_files (is_current)
  WHERE (is_current = true);

-- ============================================================
-- 2. pricing_runs.tree_hash
--    Stable hash of the drawing tree at the time of the run.
--    A cell is stale when the latest completed run has a different
--    tree_hash than the current tree, or a different price_file_id.
-- ============================================================

ALTER TABLE pricing_runs
  ADD COLUMN IF NOT EXISTS tree_hash text;

-- ============================================================
-- 3. quotes — new columns
-- ============================================================

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS price_file_id    uuid          REFERENCES price_files(id),
  ADD COLUMN IF NOT EXISTS discount_pct     numeric       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_pct      numeric       NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS interim_pct      numeric       NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS valid_days       integer       NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS item_layout      text,
  ADD COLUMN IF NOT EXISTS published_at     timestamptz,
  ADD COLUMN IF NOT EXISTS published_by     uuid,
  ADD COLUMN IF NOT EXISTS snapshot         jsonb,
  ADD COLUMN IF NOT EXISTS pdf_path         text,
  ADD COLUMN IF NOT EXISTS copied_from_quote_id uuid,
  ADD COLUMN IF NOT EXISTS accepted_at      timestamptz;

-- ============================================================
-- 4. drawings — per-item pricing controls
--    Stored on drawings so the matrix can read them in one query.
--    Edited in the drawing's Price section (pricePart in the tree).
-- ============================================================

ALTER TABLE drawings
  ADD COLUMN IF NOT EXISTS poa              boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_override   numeric,
  ADD COLUMN IF NOT EXISTS item_discount_pct numeric,
  ADD COLUMN IF NOT EXISTS vat_rate         integer       NOT NULL DEFAULT 20;

-- ============================================================
-- 5. Reference category: vat_rate
-- ============================================================

INSERT INTO reference_categories (code, label, sort_order)
VALUES ('vat_rate', 'VAT Rate', 900)
ON CONFLICT (code) DO NOTHING;

INSERT INTO reference_options (category, code, label, sort_order, is_active)
VALUES
  ('vat_rate', '20', 'Standard Rate (20%)', 10, true),
  ('vat_rate', '5',  'Reduced Rate (5%)',   20, true),
  ('vat_rate', '0',  'Zero Rate (0%)',       30, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. pricePart field definitions
--    These appear in the Price panel of the DrawingBoard tree editor.
-- ============================================================

INSERT INTO field_definitions
  (field_key, part_type, property_name, label, data_type, reference_category, unit, role, sort_order, is_active)
VALUES
  ('pricePart.poa',             'pricePart', 'poa',             'POA (Price on Application)',    'boolean',   NULL,       NULL, 'input', 10, true),
  ('pricePart.priceOverride',   'pricePart', 'priceOverride',   'Price Override (net £)',         'number',    NULL,       '£',  'input', 20, true),
  ('pricePart.itemDiscountPct', 'pricePart', 'itemDiscountPct', 'Item Discount %',               'number',    NULL,       '%',  'input', 30, true),
  ('pricePart.vatRate',         'pricePart', 'vatRate',         'VAT Rate',                      'reference', 'vat_rate', NULL, 'input', 40, true)
ON CONFLICT (field_key) DO NOTHING;

COMMIT;
