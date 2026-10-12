-- Step AQ-1: the three casement templates store the sash thickness under
-- `thickness`, not `sashThickness`.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run.
--
-- Why: `thickness` is the key the field definition
-- (casementSashPart.thickness), the property panel, the validation rules and
-- Integrate itself use. sql/step-ap1 stored `sashThickness`, so on a new
-- casement drawing the Thickness field showed blank and validation rule 59
-- read nothing at all (the reviewer's live test, 12 Oct).
--
-- Scope: `family = 'casement'` only. The BOX SASH key sashPairPart
-- .sashThickness is a different field on a different part type and is NOT
-- touched — a text replace across all templates would have corrupted it.
--
-- Drawings ALREADY SAVED with the old key (L507712 item 8) are deliberately
-- left alone: a saved drawing is the surveyor's data, not something to
-- rewrite underneath them. casementSashThicknessMm() in
-- src/pricing/casementGeometry.js reads `thickness` and falls back to
-- `sashThickness`, so those drawings keep pricing correctly.

BEGIN;

UPDATE public.drawing_templates
SET    tree = replace(tree::text, '"sashThickness":', '"thickness":')::jsonb,
       updated_at = now()
WHERE  family = 'casement'
  AND  tree::text LIKE '%"sashThickness":%';

COMMIT;

-- Check 1: no casement template mentions the old key, and each sash now has
-- a thickness. Expect 3 rows, old_key_count 0, and thickness 54 on each.
SELECT t.name,
       (SELECT count(*) FROM jsonb_path_query(t.tree, '$.**.values.sashThickness')) AS old_key_count,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(t.tree, '$.**.values.thickness') v) AS thickness_values
FROM   public.drawing_templates t
WHERE  t.family = 'casement'
ORDER  BY t.sort_order;

-- Check 2: the box sash templates are untouched — expect their
-- sashPairPart.sashThickness still present (45 on the Step AH templates).
SELECT t.name,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(t.tree, '$.**.values.sashThickness') v) AS box_sash_thickness
FROM   public.drawing_templates t
WHERE  t.family <> 'casement' OR t.family IS NULL
ORDER  BY t.sort_order;


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- UPDATE public.drawing_templates
-- SET    tree = replace(tree::text, '"thickness":', '"sashThickness":')::jsonb,
--        updated_at = now()
-- WHERE  family = 'casement'
--   AND  tree::text LIKE '%"thickness":%';
--
-- NOTE: this rollback would also rename any OTHER `thickness` key inside a
-- casement template's tree. At the time of writing there is none — the
-- mullion stores `thicknessInFrame`, which does not match the pattern
-- '"thickness":' — but check before running it.
