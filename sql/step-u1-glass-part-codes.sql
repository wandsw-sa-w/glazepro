-- ============================================================
-- Step U1 — glass references: store the PART CODE, not the name
--
-- Written for Nathan to paste into the Supabase SQL editor.
--
-- Decision (from the code): glassPart.internalGlassPartNo /
-- externalGlassPartNo / singleGlassPartNo are data_type 'part' fields
-- (part_category 'Glass' — 20260923_step_a2_field_definitions.sql).
-- Part fields reference parts_catalogue, whose key is part_code;
-- part_name is an editable label. The pricing glass catalogue
-- (loadPricingContext.js) is keyed by part_code, and validation's
-- *_pane_part_no variables compare against part-number lists. So the
-- drawing board stores the PART CODE and shows the user the name.
-- The engine accepts only the code — names stay unconverted and warn.
--
-- This file converts existing stored glass NAMES to part codes:
--   1. drawing_parts (glassPart values)
--   2. default_profile_values for the three glass field keys (same
--      name-shaped defaults; without this every NEW drawing would be
--      seeded with a name again — added beyond the brief, flagged in
--      the session report)
-- Only names that match exactly ONE active Glass part are converted;
-- anything ambiguous or unknown is left alone and listed by the check
-- queries at the end.
--
-- Safe to re-run: a value that is already a part code is never touched.
-- ============================================================

BEGIN;

-- ── 1. drawing_parts: convert unambiguous glass names to part codes ──

WITH glass_names AS (
  SELECT part_name, MIN(part_code) AS part_code
  FROM   parts_catalogue
  WHERE  category = 'Glass'
  GROUP  BY part_name
  HAVING COUNT(*) = 1
)
UPDATE drawing_parts dp
SET    "values" = dp."values" || jsonb_build_object(k.key, gn.part_code)
FROM  (VALUES ('internalGlassPartNo'), ('externalGlassPartNo'), ('singleGlassPartNo')) AS k(key),
      glass_names gn
WHERE  dp.part_type = 'glassPart'
  AND  dp."values" ->> k.key = gn.part_name
  AND  NOT EXISTS (SELECT 1 FROM parts_catalogue pc
                   WHERE pc.part_code = dp."values" ->> k.key);

-- ── 2. default_profile_values: same conversion for the three field keys ──

WITH glass_names AS (
  SELECT part_name, MIN(part_code) AS part_code
  FROM   parts_catalogue
  WHERE  category = 'Glass'
  GROUP  BY part_name
  HAVING COUNT(*) = 1
)
UPDATE default_profile_values dpv
SET    default_value = gn.part_code
FROM   glass_names gn
WHERE  dpv.field_key IN ('glassPart.internalGlassPartNo',
                         'glassPart.externalGlassPartNo',
                         'glassPart.singleGlassPartNo')
  AND  dpv.default_value = gn.part_name
  AND  NOT EXISTS (SELECT 1 FROM parts_catalogue pc
                   WHERE pc.part_code = dpv.default_value);

COMMIT;

-- ── CHECK 1: drawing_parts glass values that could NOT be converted ──
-- (not null, not empty, and still not a parts_catalogue code — includes
--  names matching no Glass part and names matching more than one)

SELECT dp.id        AS drawing_part_id,
       dp.drawing_id,
       k.key        AS field,
       dp."values" ->> k.key AS unconverted_value,
       (SELECT COUNT(*) FROM parts_catalogue pc
         WHERE pc.category = 'Glass'
           AND pc.part_name = dp."values" ->> k.key) AS matching_glass_parts
FROM   drawing_parts dp,
       (VALUES ('internalGlassPartNo'), ('externalGlassPartNo'), ('singleGlassPartNo')) AS k(key)
WHERE  dp.part_type = 'glassPart'
  AND  COALESCE(dp."values" ->> k.key, '') <> ''
  AND  NOT EXISTS (SELECT 1 FROM parts_catalogue pc
                   WHERE pc.part_code = dp."values" ->> k.key)
ORDER  BY dp.drawing_id, dp.id, k.key;

-- ── CHECK 2: profile defaults that could NOT be converted ──

SELECT dpv.profile_id, dpv.field_key, dpv.default_value AS unconverted_value
FROM   default_profile_values dpv
WHERE  dpv.field_key IN ('glassPart.internalGlassPartNo',
                         'glassPart.externalGlassPartNo',
                         'glassPart.singleGlassPartNo')
  AND  COALESCE(dpv.default_value, '') <> ''
  AND  NOT EXISTS (SELECT 1 FROM parts_catalogue pc
                   WHERE pc.part_code = dpv.default_value);

-- ============================================================
-- ROLLBACK — DO NOT RUN
-- (approximate inverse: turns stored Glass part codes back into the
--  part's CURRENT name; left commented out so pasting the whole file
--  never executes it)
-- ============================================================
-- BEGIN;
-- UPDATE drawing_parts dp
-- SET    "values" = dp."values" || jsonb_build_object(k.key, pc.part_name)
-- FROM  (VALUES ('internalGlassPartNo'), ('externalGlassPartNo'), ('singleGlassPartNo')) AS k(key),
--       parts_catalogue pc
-- WHERE  dp.part_type = 'glassPart'
--   AND  pc.category = 'Glass'
--   AND  dp."values" ->> k.key = pc.part_code;
-- UPDATE default_profile_values dpv
-- SET    default_value = pc.part_name
-- FROM   parts_catalogue pc
-- WHERE  dpv.field_key IN ('glassPart.internalGlassPartNo',
--                          'glassPart.externalGlassPartNo',
--                          'glassPart.singleGlassPartNo')
--   AND  pc.category = 'Glass'
--   AND  dpv.default_value = pc.part_code;
-- COMMIT;
