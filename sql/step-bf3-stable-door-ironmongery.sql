-- Step BF-3: what a NEW stable door gets.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run — every statement
-- names what it replaces, so a second run does nothing.
-- Independent of the other step-bf files.
--
-- NATHAN, 14 Oct 2026 (decision j): Integrate's own stored list, PLUS a
-- SECOND pair of hinges — each half of a stable door hangs on its own pair.
--
--     102mm_hinges        PB  x 4   (TWO pairs: the set is a pair)   14.70 x 2
--     era_5_lever_sashlock PB x 1                                       29.40
--     era_deadlock         PB x 1                                       15.75
--     trickle_vent_xr16    Blk x 1                                       3.15
--     victorian            PB  x 1  (Victorian Scroll Lever Handle)     25.20
--                                                               = 102.90
--
-- which is Integrate's 88.20 plus one more pair of hinges (14.70).
--
-- WHAT IS THERE NOW. Three live default_ironmongery rules fire on
-- `new_stable_door_pair_qty == 1`, and they are not Nathan's list:
--
--     0a4a3749  hardwick_lyndon_door_espag_set              PB
--     8d303c72  winkhaus_interlocking_stable_door_multipoint_lock PC
--     12d2787c  double_euro_cylinder                        PB  x 2
--
-- They came in with the import and nobody has read them against a drawing.
-- Integrate's own stable doors carry NO multipoint lock at all (isDoorMpls
-- false on all three of the reviewer's), so this file DEACTIVATES the three
-- and adds Nathan's five.
--
-- The rules are rows of `part_allocation_rules` with rule_family
-- 'default_ironmongery'. They have no updated_at column (the reviewer's
-- correction to sql/step-bd4).
--
-- RUN SECTION 0 FIRST.

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ════════════════════════════════════════════════════════════════════════════

-- 0a. Every default rule that mentions a stable door. Expect the three above,
--     all active.
SELECT id, sort_order, group_name, loop_target, label, condition, qty_expr,
       product_short_name, finish_code, is_active
FROM   public.part_allocation_rules
WHERE  rule_family = 'default_ironmongery'
  AND  (condition ILIKE '%stable%' OR coalesce(label, '') ILIKE '%stable%')
ORDER  BY sort_order, id;

-- 0b. The five products Nathan's list needs, and their PB / Blk variants.
--     Every one must exist, or a new stable door loses that line.
SELECT p.short_name, v.finish_code, v.cost
FROM   public.ironmongery_products p
JOIN   public.ironmongery_variants v ON v.product_id = p.id
WHERE  p.short_name IN ('102mm_hinges', 'era_5_lever_sashlock', 'era_deadlock',
                        'trickle_vent_xr16', 'victorian')
ORDER  BY p.short_name, v.finish_code;

-- 0c. What the five come to, as the Ironmongery Cost rule reads them:
--     round(cost x qty, 0) x 1.05. Expect 14.70 / 29.40 / 15.75 / 3.15 /
--     25.20, and 102.90 with the second pair of hinges.
SELECT p.short_name, v.finish_code,
       round(coalesce(c.unit_cost, 0), 2) AS unit_cost,
       round(coalesce(c.unit_cost, 0), 0) * 1.05 AS one_line
FROM   public.ironmongery_products p
JOIN   public.ironmongery_variants v ON v.product_id = p.id
JOIN   public.ironmongery_variant_parts vp ON vp.variant_id = v.id
LEFT   JOIN public.parts_catalogue c ON c.part_code = vp.part_code
WHERE  (p.short_name, v.finish_code) IN (
         ('102mm_hinges', 'PB'), ('era_5_lever_sashlock', 'PB'),
         ('era_deadlock', 'PB'), ('trickle_vent_xr16', 'Blk'),
         ('victorian', 'PB'))
ORDER  BY p.short_name;

-- 0d. And the TRICKLE VENT rules, which carry `not is_front_door` and so DO
--     fire on a stable door: expect two, and a stable door would get a vent
--     twice over if Nathan's own vent line is added as well. His list has one
--     vent, so the rules below are written to be the ONLY source of it.
SELECT id, label, condition, product_short_name, finish_code, is_active
FROM   public.part_allocation_rules
WHERE  rule_family = 'default_ironmongery'
  AND  product_short_name LIKE 'trickle%'
ORDER  BY sort_order;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — Nathan's list
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _missing text;
  _rows    int;
BEGIN
  -- Every product must exist in the finish the list names.
  SELECT string_agg(x.short_name || ':' || x.finish, ', ') INTO _missing
  FROM  (VALUES ('102mm_hinges', 'PB'), ('era_5_lever_sashlock', 'PB'),
                ('era_deadlock', 'PB'), ('trickle_vent_xr16', 'Blk'),
                ('victorian', 'PB')) AS x(short_name, finish)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.ironmongery_products p
    JOIN public.ironmongery_variants v ON v.product_id = p.id
    WHERE p.short_name = x.short_name AND v.finish_code = x.finish
  );
  IF _missing IS NOT NULL THEN
    RAISE EXCEPTION 'These products are missing: % — do not run this file', _missing;
  END IF;

  -- The three imported rules go quiet. They are DEACTIVATED and not deleted,
  -- so the reviewer can see what was there and put it back in one statement.
  UPDATE public.part_allocation_rules
  SET    is_active = FALSE
  WHERE  rule_family = 'default_ironmongery'
    AND  id IN ('0a4a3749-9cba-49e8-b0f9-0fe52f4cb077',
                '8d303c72-0623-4232-9843-8ef987afbf59',
                '12d2787c-7d3f-467c-bf92-89a28bcc93f6')
    AND  is_active;
  GET DIAGNOSTICS _rows = ROW_COUNT;
  RAISE NOTICE 'Step BF-3: % imported stable-door rule(s) deactivated', _rows;
END $$;

-- Nathan's five lines. The ids are fixed so a re-run updates rather than
-- duplicates, and the condition is Integrate's own variable.
INSERT INTO public.part_allocation_rules
  (id, rule_family, sort_order, group_name, loop_target, label, condition,
   qty_expr, product_short_name, finish_code, is_active)
VALUES
  ('bf030001-0000-4000-8000-000000000001', 'default_ironmongery', 60, 'stable_doors', NULL,
   'Stable Door Hinges', 'new_stable_door_pair_qty >= 1', '4', '102mm_hinges', 'PB', TRUE),
  ('bf030002-0000-4000-8000-000000000002', 'default_ironmongery', 61, 'stable_doors', NULL,
   'Stable Door Sashlock', 'new_stable_door_pair_qty >= 1', '1', 'era_5_lever_sashlock', 'PB', TRUE),
  ('bf030003-0000-4000-8000-000000000003', 'default_ironmongery', 62, 'stable_doors', NULL,
   'Stable Door Deadlock', 'new_stable_door_pair_qty >= 1', '1', 'era_deadlock', 'PB', TRUE),
  ('bf030004-0000-4000-8000-000000000004', 'default_ironmongery', 63, 'stable_doors', NULL,
   'Stable Door Trickle Vent', 'new_stable_door_pair_qty >= 1', '1', 'trickle_vent_xr16', 'Blk', TRUE),
  ('bf030005-0000-4000-8000-000000000005', 'default_ironmongery', 64, 'stable_doors', NULL,
   'Stable Door Handle', 'new_stable_door_pair_qty >= 1', '1', 'victorian', 'PB', TRUE)
ON CONFLICT (id) DO UPDATE
  SET sort_order = EXCLUDED.sort_order,
      group_name = EXCLUDED.group_name,
      label = EXCLUDED.label,
      condition = EXCLUDED.condition,
      qty_expr = EXCLUDED.qty_expr,
      product_short_name = EXCLUDED.product_short_name,
      finish_code = EXCLUDED.finish_code,
      is_active = TRUE;

COMMIT;

-- ── Checks ──────────────────────────────────────────────────────────────

-- 1. Nathan's five, active; the three imported ones, inactive.
SELECT id, sort_order, label, condition, qty_expr, product_short_name,
       finish_code, is_active
FROM   public.part_allocation_rules
WHERE  rule_family = 'default_ironmongery'
  AND  (condition ILIKE '%stable%' OR coalesce(label, '') ILIKE '%stable%')
ORDER  BY is_active DESC, sort_order;

-- 2. What a new stable door now costs in ironmongery: expect 102.90
--    (14.70 x 2 hinge pairs + 29.40 + 15.75 + 3.15 + 25.20).
SELECT sum(round(coalesce(c.unit_cost, 0) * r.qty_expr::numeric, 0) * 1.05) AS set_cost
FROM   public.part_allocation_rules r
JOIN   public.ironmongery_products p ON p.short_name = r.product_short_name
JOIN   public.ironmongery_variants v ON v.product_id = p.id AND v.finish_code = r.finish_code
JOIN   public.ironmongery_variant_parts vp ON vp.variant_id = v.id
LEFT   JOIN public.parts_catalogue c ON c.part_code = vp.part_code
WHERE  r.rule_family = 'default_ironmongery'
  AND  r.is_active
  AND  r.condition ILIKE '%stable%';

-- 3. On /dev/pricing-benchmark NOTHING moves: ST1 and ST3 carry Integrate's
--    own STORED list and ST2 none, which is what a benchmark does. This file
--    is about a NEW drawing.


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- BEGIN;
-- DELETE FROM public.part_allocation_rules
-- WHERE id IN ('bf030001-0000-4000-8000-000000000001',
--              'bf030002-0000-4000-8000-000000000002',
--              'bf030003-0000-4000-8000-000000000003',
--              'bf030004-0000-4000-8000-000000000004',
--              'bf030005-0000-4000-8000-000000000005');
-- UPDATE public.part_allocation_rules SET is_active = TRUE
-- WHERE id IN ('0a4a3749-9cba-49e8-b0f9-0fe52f4cb077',
--              '8d303c72-0623-4232-9843-8ef987afbf59',
--              '12d2787c-7d3f-467c-bf92-89a28bcc93f6');
-- COMMIT;
