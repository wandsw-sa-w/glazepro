-- Step BF-3: what a NEW stable door gets.  *** RE-ISSUED 14 Oct 2026 ***
-- Run by Nathan in the Supabase SQL editor. Safe to re-run — every statement
-- names what it replaces, so a second run does nothing.
-- Independent of the other step-bf files.
--
-- THE FIRST ISSUE OF THIS FILE RAN, AND MADE A NEW STABLE DOOR £34.65 TOO
-- DEAR. The reviewer measured it on drawings 50-52 of L507712 (2,709.72 /
-- 2,612.38 / 2,736.42 against 2,675.07 / 2,577.73 / 2,701.77), and both
-- causes were things the LIVE data already does:
--
--   +£29.40  THE HINGES. Rule c11aeeb4 "4 Hinges per Door" is a door_leaf
--            rule at qty 2, and a stable door has TWO halves — so the live
--            set already gives it two pairs' worth (the resolver merges the
--            two lines into one of qty 4: 7.04 x 4 = 28.16 -> 28 -> 29.40).
--            That IS Nathan's "each half on its own pair", so this file's own
--            hinge rule was a second helping. IT IS REMOVED, and deleted if
--            the first issue inserted it.
--
--   + £3.15  THE XR16 WHITE VENT and
--   + £2.10  THE "trickle" WHITE VENT. Both live "Trickle Vent" rules carry
--            `not is_front_door`, so they fire on a stable door — on top of
--            Nathan's XR16 BLACK. They are now gated on
--            `new_stable_door_pair_qty < 1`: still active, still firing on
--            everything else, silent on a stable door.
--
-- WHAT A NEW STABLE DOOR GETS AFTER THIS (Nathan's decision j):
--
--     102mm_hinges         PB  x4 (two pairs, from rule c11aeeb4)   29.40
--     era_5_lever_sashlock PB  x1                                   29.40
--     era_deadlock         PB  x1                                   15.75
--     trickle_vent_xr16    Blk x1                                    3.15
--     victorian            PB  x1  (Victorian Scroll Lever Handle)  25.20
--                                                            = £102.90
--
-- The three IMPORTED stable-door rules stay inactive (an espag set, a
-- Winkhaus interlocking stable-door multipoint lock and two euro cylinders —
-- Integrate's own stable doors carry no multipoint lock at all).
--
-- The rules are rows of `part_allocation_rules` with rule_family
-- 'default_ironmongery', and the table has no updated_at column.
--
-- RUN SECTION 0 FIRST.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. Every default rule that fires on a stable door. Expect, before this
--     runs: the four from the first issue (sashlock, deadlock, vent, handle)
--     PLUS its hinge rule bf030001…, and the three imported ones inactive.
SELECT id, sort_order, group_name, loop_target, label, condition, qty_expr,
       product_short_name, finish_code, is_active
FROM   public.part_allocation_rules
WHERE  rule_family = 'default_ironmongery'
  AND  (condition ILIKE '%stable%' OR coalesce(label, '') ILIKE '%stable%')
ORDER  BY is_active DESC, sort_order, id;

-- 0b. THE HINGE RULE a stable door already fires, and what it gives.
--     Expect c11aeeb4 "4 Hinges per Door", loop door_leaf, qty 2 — which a
--     two-half door fires twice, merging to qty 4 = 29.40.
SELECT id, label, loop_target, condition, qty_expr, product_short_name,
       finish_code, is_active
FROM   public.part_allocation_rules
WHERE  rule_family = 'default_ironmongery'
  AND  product_short_name = '102mm_hinges'
ORDER  BY sort_order;

-- 0c. THE TWO VENT RULES this file gates. Expect both active, conditions
--     without any mention of a stable door.
SELECT id, label, condition, qty_expr, product_short_name, finish_code, is_active
FROM   public.part_allocation_rules
WHERE  rule_family = 'default_ironmongery'
  AND  product_short_name IN ('trickle_vent_xr16', 'trickle')
ORDER  BY sort_order;

-- 0d. The four products Nathan's list still needs (the hinges come from
--     c11aeeb4), and their finishes.
SELECT p.short_name, v.finish_code, v.cost
FROM   public.ironmongery_products p
JOIN   public.ironmongery_variants v ON v.product_id = p.id
WHERE  p.short_name IN ('era_5_lever_sashlock', 'era_deadlock',
                        'trickle_vent_xr16', 'victorian')
ORDER  BY p.short_name, v.finish_code;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the hinge rule goes, the vents stand down, Nathan's four stay
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _missing text;
  _rows    int;
BEGIN
  -- Every product must exist in the finish the list names.
  SELECT string_agg(x.short_name || ':' || x.finish, ', ') INTO _missing
  FROM  (VALUES ('era_5_lever_sashlock', 'PB'), ('era_deadlock', 'PB'),
                ('trickle_vent_xr16', 'Blk'), ('victorian', 'PB')) AS x(short_name, finish)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.ironmongery_products p
    JOIN public.ironmongery_variants v ON v.product_id = p.id
    WHERE p.short_name = x.short_name AND v.finish_code = x.finish
  );
  IF _missing IS NOT NULL THEN
    RAISE EXCEPTION 'These products are missing: % — do not run this file', _missing;
  END IF;

  -- The hinges must still come from somewhere: if the per-leaf rule has gone,
  -- removing this file's own would leave a stable door with none.
  IF NOT EXISTS (
    SELECT 1 FROM public.part_allocation_rules
    WHERE rule_family = 'default_ironmongery' AND is_active
      AND product_short_name = '102mm_hinges' AND loop_target = 'door_leaf'
  ) THEN
    RAISE EXCEPTION 'No active per-leaf 102mm_hinges rule — do not remove the stable-door one';
  END IF;

  -- 1. the first issue's hinge rule
  -- (reviewer, 14 Oct: deactivate, not DELETE — deletes need Nathan's yes each time; same effect, row kept)
  UPDATE public.part_allocation_rules
  SET    is_active = FALSE
  WHERE  id = 'bf030001-0000-4000-8000-000000000001' AND is_active;
  GET DIAGNOSTICS _rows = ROW_COUNT;
  RAISE NOTICE 'Step BF-3: % duplicate hinge rule(s) removed', _rows;

  -- 2. the two vent rules stand down for a stable door, and keep everything
  --    else they do. Appending to the condition rather than rewriting it, so
  --    whatever else those rules band on is untouched.
  UPDATE public.part_allocation_rules
  SET    condition = condition || ' and new_stable_door_pair_qty < 1'
  WHERE  rule_family = 'default_ironmongery'
    AND  product_short_name IN ('trickle_vent_xr16', 'trickle')
    AND  finish_code = 'Wht'
    AND  condition NOT ILIKE '%stable%';
  GET DIAGNOSTICS _rows = ROW_COUNT;
  RAISE NOTICE 'Step BF-3: % vent rule(s) now stand down for a stable door', _rows;

  -- 3. the three imported stable-door rules stay inactive (the first issue
  --    deactivated them; this is here so one run of this file is enough).
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

-- Nathan's four lines. Fixed ids, so a re-run updates rather than duplicates.
INSERT INTO public.part_allocation_rules
  (id, rule_family, sort_order, group_name, loop_target, label, condition,
   qty_expr, product_short_name, finish_code, is_active)
VALUES
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

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. Nathan's FOUR, active, and no stable-door hinge rule. Expect four rows
--    and no bf030001….
SELECT id, sort_order, label, condition, qty_expr, product_short_name,
       finish_code, is_active
FROM   public.part_allocation_rules
WHERE  rule_family = 'default_ironmongery'
  AND  (condition ILIKE '%stable%' OR coalesce(label, '') ILIKE '%stable%')
ORDER  BY is_active DESC, sort_order;

-- 2. The two vent rules: ACTIVE, with the stable-door gate and everything
--    else they had.
SELECT id, label, condition, product_short_name, finish_code, is_active
FROM   public.part_allocation_rules
WHERE  rule_family = 'default_ironmongery'
  AND  product_short_name IN ('trickle_vent_xr16', 'trickle')
ORDER  BY sort_order;

-- 3. What a new stable door now costs in ironmongery. The hinges are the
--    per-leaf rule's two lines merged to qty 4; expect 29.40 + 29.40 + 15.75
--    + 3.15 + 25.20 = 102.90.
SELECT 'hinges (c11aeeb4, qty 4)' AS line,
       round(coalesce(c.unit_cost, 0) * 4, 0) * 1.05 AS cost
FROM   public.ironmongery_products p
JOIN   public.ironmongery_variants v ON v.product_id = p.id AND v.finish_code = 'PB'
JOIN   public.ironmongery_variant_parts vp ON vp.variant_id = v.id
LEFT   JOIN public.parts_catalogue c ON c.part_code = vp.part_code
WHERE  p.short_name = '102mm_hinges'
UNION ALL
SELECT r.label,
       sum(round(coalesce(c.unit_cost, 0) * r.qty_expr::numeric, 0) * 1.05)
FROM   public.part_allocation_rules r
JOIN   public.ironmongery_products p ON p.short_name = r.product_short_name
JOIN   public.ironmongery_variants v ON v.product_id = p.id AND v.finish_code = r.finish_code
JOIN   public.ironmongery_variant_parts vp ON vp.variant_id = v.id
LEFT   JOIN public.parts_catalogue c ON c.part_code = vp.part_code
WHERE  r.rule_family = 'default_ironmongery' AND r.is_active
  AND  r.condition ILIKE '%stable_door_pair_qty >= 1%'
GROUP  BY r.label
ORDER  BY 1;

-- 4. And on L507712: re-price drawings 50 / 51 / 52 (or make three new ones
--    from templates 33 / 34 / 35). Expect 2,675.07 / 2,577.73 / 2,701.77 —
--    each £34.65 less than they read before this file.
--
-- 5. On /dev/pricing-benchmark NOTHING moves: ST1 and ST3 carry Integrate's
--    own STORED list and ST2 none, which is what a benchmark does.


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- This puts back a stable door's espag set and multipoint lock, its duplicate
-- hinges and its two extra white vents.
--
-- BEGIN;
-- UPDATE public.part_allocation_rules
-- SET    condition = replace(condition, ' and new_stable_door_pair_qty < 1', '')
-- WHERE  rule_family = 'default_ironmongery'
--   AND  product_short_name IN ('trickle_vent_xr16', 'trickle')
--   AND  finish_code = 'Wht';
--
-- DELETE FROM public.part_allocation_rules
-- WHERE id IN ('bf030002-0000-4000-8000-000000000002',
--              'bf030003-0000-4000-8000-000000000003',
--              'bf030004-0000-4000-8000-000000000004',
--              'bf030005-0000-4000-8000-000000000005');
--
-- UPDATE public.part_allocation_rules SET is_active = TRUE
-- WHERE id IN ('0a4a3749-9cba-49e8-b0f9-0fe52f4cb077',
--              '8d303c72-0623-4232-9843-8ef987afbf59',
--              '12d2787c-7d3f-467c-bf92-89a28bcc93f6');
-- COMMIT;
