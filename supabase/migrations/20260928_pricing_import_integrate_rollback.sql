-- DO NOT RUN DIRECTLY — paste into Supabase SQL editor.
--
-- Rollback: 20260928_pricing_import_integrate_rollback.sql
-- Undoes:   20260928_pricing_import_integrate.sql
--
-- This removes ONLY the draft price file created by the import and all its
-- rules/variables (via cascade).  It does NOT drop the schema columns added
-- by the migration (category, imported_from, needs_review, raw_condition,
-- raw_qty on price_rules; name on price_files) because other rows may already
-- use them.  Run the DROP COLUMN statements at the bottom only if you are
-- certain no other data depends on those columns.

BEGIN;

-- ── 1. Delete the imported draft price file (cascades to price_rules and
--       price_file_variables via FK ON DELETE CASCADE) ──────────────────────
DELETE FROM price_files
WHERE name = 'Integrate PF30 (Draft Import)'
  AND status = 'draft'
  AND imported_from IS NULL;   -- price_files has no imported_from; rules do.

-- If the above WHERE clause is too broad (e.g. you have multiple draft files
-- with that name), narrow it by ID:
--   DELETE FROM price_files WHERE id = <id>;

-- ── 2. Belt-and-braces: remove any orphaned rules that reference this import
--       in case the price file row was already deleted manually ─────────────
DELETE FROM price_rules WHERE imported_from = 'integrate_pf30';

-- ── 3. OPTIONAL — drop schema additions if unused elsewhere ─────────────────
-- Only run these lines if you are certain no other data uses these columns.
--
-- ALTER TABLE price_rules
--   DROP COLUMN IF EXISTS category,
--   DROP COLUMN IF EXISTS imported_from,
--   DROP COLUMN IF EXISTS needs_review,
--   DROP COLUMN IF EXISTS raw_condition,
--   DROP COLUMN IF EXISTS raw_qty;
--
-- ALTER TABLE price_files DROP COLUMN IF EXISTS name;
--
-- DROP TABLE IF EXISTS price_file_variables;

COMMIT;
