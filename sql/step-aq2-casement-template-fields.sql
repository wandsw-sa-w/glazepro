-- Step AQ-2: Product and Quantity on the casement templates, and hide the
-- sash-only item fields on the casement profile.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run.
--
-- Found by the reviewer's live test (12 Oct): a drawing started from a
-- casement template opened with two "Required fields empty" errors, because
-- drawingItemPart.product and drawingItemPart.quantity are required
-- (is_required TRUE in default_field_definitions) and sql/step-ap1 set
-- neither. And the item panel offered Moulding Profile, Staff Bead Type and
-- Parting Bead Type, which are box-sash fields a casement does not have.
--
-- NOTE on the mechanism: the brief says to hide the fields via the casement
-- profile's `hidden_fields`, but that column was DEPRECATED by
-- sql/step-r1-field-visibility.sql ("DEPRECATED: replaced by field_visibility
-- table in step R1. Do not use.") and the board reads field_visibility, not
-- hidden_fields. Writing to hidden_fields would have changed nothing on
-- screen, so section 2 writes field_visibility rows with 'hidden_always',
-- which is the value step R1 used when it copied the old hidden_fields
-- across. Section 2a ALSO fills hidden_fields, harmlessly, so the two agree
-- if anything still reads the old column.
--
-- The product CODES are not in the repository — the `product` reference list
-- was imported from Integrate — so they are looked up BY LABEL and the
-- script fails loudly rather than writing a code that does not exist (an
-- invalid code would look set on screen and still fail the required check).

BEGIN;

-- ── 1. Product and Quantity on the three casement templates ────────────────
DO $$
DECLARE
  _casement_code text;
  _dgu_code      text;
  _rc            int;
BEGIN
  SELECT code INTO _casement_code FROM public.reference_options
  WHERE category = 'product' AND lower(label) = 'casement' AND is_active
  ORDER BY sort_order LIMIT 1;

  SELECT code INTO _dgu_code FROM public.reference_options
  WHERE category = 'product' AND lower(label) IN ('direct glazed unit', 'direct glazed')
    AND is_active
  ORDER BY sort_order LIMIT 1;

  IF _casement_code IS NULL THEN
    RAISE EXCEPTION 'No active reference_options row with category ''product'' and label ''Casement'' — list the category and tell the reviewer which label to use: SELECT code, label FROM reference_options WHERE category = ''product'' ORDER BY sort_order;';
  END IF;
  IF _dgu_code IS NULL THEN
    RAISE EXCEPTION 'No active reference_options row with category ''product'' and label ''Direct Glazed Unit'' — list the category and tell the reviewer which label to use: SELECT code, label FROM reference_options WHERE category = ''product'' ORDER BY sort_order;';
  END IF;

  RAISE NOTICE 'Step AQ-2: product codes — casement=%, direct glazed=%', _casement_code, _dgu_code;

  -- The two casement templates: Product = Casement
  UPDATE public.drawing_templates
  SET    tree = jsonb_set(
                  jsonb_set(tree, '{values,product}',  to_jsonb(_casement_code), true),
                  '{values,quantity}', to_jsonb(1), true),
         updated_at = now()
  WHERE  family = 'casement'
    AND  name IN ('Single Flush Casement', 'Double Flush Casement')
    AND  tree -> 'part_type' = '"drawingItemPart"'::jsonb;
  GET DIAGNOSTICS _rc = ROW_COUNT;
  RAISE NOTICE 'Step AQ-2: % casement sash template(s) updated', _rc;

  -- The direct glazed template: Product = Direct Glazed Unit
  UPDATE public.drawing_templates
  SET    tree = jsonb_set(
                  jsonb_set(tree, '{values,product}',  to_jsonb(_dgu_code), true),
                  '{values,quantity}', to_jsonb(1), true),
         updated_at = now()
  WHERE  family = 'casement'
    AND  name = 'Direct Glazed Frame'
    AND  tree -> 'part_type' = '"drawingItemPart"'::jsonb;
  GET DIAGNOSTICS _rc = ROW_COUNT;
  RAISE NOTICE 'Step AQ-2: % direct glazed template(s) updated', _rc;
END $$;

-- ── 2. Hide the box-sash item fields on the casement profile ───────────────
-- A casement has no moulding profile, staff bead or parting bead.
INSERT INTO public.field_visibility (profile_id, field_key, visibility)
SELECT p.id, f.field_key, 'hidden_always'
FROM   public.default_profiles p
CROSS  JOIN (VALUES
  ('drawingItemPart.mouldingTypeId'),
  ('drawingItemPart.staffBeadTypeId'),
  ('drawingItemPart.partingBeadTypeId')
) AS f(field_key)
WHERE  p.code = 'casement'
ON CONFLICT (profile_id, field_key) DO UPDATE SET visibility = 'hidden_always', updated_at = now();

-- ── 2a. Keep the deprecated column in step with it ─────────────────────────
UPDATE public.default_profiles
SET    hidden_fields = (
         SELECT array_agg(DISTINCT x)
         FROM   unnest(COALESCE(hidden_fields, '{}') || ARRAY[
                  'drawingItemPart.mouldingTypeId',
                  'drawingItemPart.staffBeadTypeId',
                  'drawingItemPart.partingBeadTypeId'
                ]) AS x
       )
WHERE  code = 'casement';

COMMIT;

-- ── 3. Checks ──────────────────────────────────────────────────────────────

-- 3a. EVERY template's Product and Quantity, so the SASH templates are
--     reported too (brief §6: "check the sash templates the same way and
--     report"). A null in either column is a "Required fields empty" error
--     waiting to happen on a new drawing from that template.
SELECT t.name, t.family, t.sort_order,
       t.tree #>> '{values,product}'  AS product_code,
       t.tree #>> '{values,quantity}' AS quantity
FROM   public.drawing_templates t
WHERE  t.is_active
ORDER  BY t.family NULLS FIRST, t.sort_order;

-- 3b. The product list, in case a label above did not match
SELECT code, label, sort_order, is_active
FROM   public.reference_options
WHERE  category = 'product'
ORDER  BY sort_order;

-- 3c. The casement profile's hidden fields
SELECT p.code AS profile, v.field_key, v.visibility
FROM   public.field_visibility v
JOIN   public.default_profiles p ON p.id = v.profile_id
WHERE  p.code = 'casement'
ORDER  BY v.field_key;


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- UPDATE public.drawing_templates
-- SET    tree = (tree #- '{values,product}') #- '{values,quantity}',
--        updated_at = now()
-- WHERE  family = 'casement';
--
-- DELETE FROM public.field_visibility
-- WHERE  profile_id = (SELECT id FROM public.default_profiles WHERE code = 'casement')
--   AND  field_key IN ('drawingItemPart.mouldingTypeId',
--                      'drawingItemPart.staffBeadTypeId',
--                      'drawingItemPart.partingBeadTypeId');
--
-- UPDATE public.default_profiles
-- SET    hidden_fields = array_remove(array_remove(array_remove(
--          hidden_fields, 'drawingItemPart.mouldingTypeId'),
--          'drawingItemPart.staffBeadTypeId'),
--          'drawingItemPart.partingBeadTypeId')
-- WHERE  code = 'casement';
