-- ============================================================
-- Step I1 — PF30 go-live
--
-- DO NOT RUN — paste into Supabase SQL editor.
--
-- 1. Rename 'Integrate PF30 (Draft Import)' → 'PF30'
-- 2. Set is_current = true on PF30 (false on any other price file)
-- 3. Activate all imported PF30 rules (is_active = true where
--    the rule was active in Integrate; the deleted bi-fold /
--    Yorkshire rules are already absent from the table)
-- 4. Verify: rule counts per family / active status
-- ============================================================

BEGIN;

-- ── 1. Rename the price file ──────────────────────────────────────────────────

UPDATE price_files
   SET name = 'PF30'
 WHERE name = 'Integrate PF30 (Draft Import)';

-- ── 2. Set is_current ─────────────────────────────────────────────────────────
-- Clear any existing current flag first (there can be at most one).

UPDATE price_files
   SET is_current = NULL
 WHERE is_current = true;

UPDATE price_files
   SET is_current = true
 WHERE name = 'PF30';

-- ── 3. Activate imported PF30 rules ──────────────────────────────────────────
-- The import file set every rule to is_active = false as a safety default.
-- Rules that were active in Integrate should be active here.
-- Bi-fold and Yorkshire sash rules were deleted during import review and are
-- not present in the table, so no exclusion filter is needed.

UPDATE price_rules
   SET is_active = true
 WHERE price_file_id = (SELECT id FROM price_files WHERE name = 'PF30')
   AND imported_from = 'integrate_pf30';

-- ── 4. Verification ───────────────────────────────────────────────────────────

SELECT
  rule_family,
  COUNT(*) FILTER (WHERE is_active = true)  AS active,
  COUNT(*) FILTER (WHERE is_active = false) AS inactive,
  COUNT(*)                                   AS total
FROM price_rules
WHERE price_file_id = (SELECT id FROM price_files WHERE name = 'PF30')
GROUP BY rule_family
ORDER BY rule_family;

COMMIT;
