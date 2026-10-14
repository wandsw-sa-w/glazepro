-- Step BD-4: Nathan's two front-door ironmongery decisions of 14 Oct 2026.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run — both halves are
-- idempotent, and re-running after a correction does nothing.
-- Independent of sql/step-bd2 and sql/step-bd3; run it any time after
-- sql/step-bd1 (already run).
--
-- Both decisions are in docs/integrate-L31115-front-doors.txt, "Nathan's
-- decisions, 14 Oct", and in src/pricing/benchmarks/frontDoorIronmongery.js —
-- which is where the figures below come from, so the SQL, the tests and the
-- report read one definition.
--
-- ─── a. WHAT A NEW FRONT DOOR GETS ────────────────────────────────────────
--
-- The live default-ironmongery rules give a front door:
--
--   102mm_hinges PB x 2                                      14.70
--   hardwick_classic_sleeved_letterbox PB (HK4350PB)         94.50
--   hardwick_classic_euro_pull_set_back_to_back PB (HK4000PB) 25.20   <- OUT
--   av3_heritage_locking_system_lh PC (the AV4 set)          176.40
--
-- Nathan wants Integrate's CROFT pull instead of the Hardwick back-to-back
-- one: `euro_cylinder_pull` PB (CRO1774PB, 29.40) — the pull Integrate's own
-- front-door template stores. Everything else stays, and there is still no
-- letter tidy, which is what he asked for.
--
-- ONE ROW CHANGES: rule cb8eb0b9-056f-40a0-80b9-3b9f0b14f214 ("Front Door
-- Euro Cylinder Pull", default_ironmongery), product_short_name
-- hardwick_classic_euro_pull_set_back_to_back -> euro_cylinder_pull. A new
-- front door becomes GBP 4.20 dearer in ironmongery; no existing drawing
-- moves, because a drawing holds its own stored list.
--
-- BENCHMARKS FT1-FT3 ARE UNAFFECTED: they carry Integrate's own stored
-- template list (hinges, the AV4 system, the Croft pull, a premium letter
-- tidy and a small letterplate = 263.55), which is what Integrate prices and
-- what a benchmark's job is.
--
-- ─── b. THE AV4 HAND, CORRECTED ───────────────────────────────────────────
--
-- Integrate prices RIGHT-hand AV4 parts on a LEFT-hand door, and the import
-- copied it: `av3_heritage_locking_system_lh` holds the RH Heritage lock
-- (RHZ2482) and the RH centre keep w dayswitch (RHZ3092), and the _rh variant
-- holds the LH ones. Nathan's standing rule is that GlazePro corrects
-- Integrate's errors, so the hands are swapped back:
--
--   av3_heritage_locking_system_lh : RHZ2482 -> RHZ2481  (Heritage Lock LH)
--                                    RHZ3092 -> RHZ3091  (LH Centre Keep w Dayswitch)
--   av3_heritage_locking_system_rh : RHZ2481 -> RHZ2482
--                                    RHZ3091 -> RHZ3092
--
-- The pocket keep (RHZ2427) is handed neither way and stays in both.
--
-- NO PRICE MOVES. sql/step-bd1 gave both hands the same cost (the lock 107,
-- the centre keep 30), so a front door's ironmongery is 263.55 before and
-- after. src/pricing/frontDoorIronmongery.test.js proves that rather than
-- assuming it: it prices FT1 with the swap applied and with it not.
--
-- WHAT THIS DOES NOT DO: it does not touch Integrate. Integrate's own
-- drawings keep its hand, so a GlazePro quote and an Integrate quote for the
-- same door now differ in WHICH lock is listed, at the same money. That is
-- deliberate difference 15 in docs/integrate-differences.md.
--
-- RUN SECTION 0 FIRST.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. The rule half (a) changes, and the other front-door rules for context.
--     Expect cb8eb0b9 to carry hardwick_classic_euro_pull_set_back_to_back,
--     and the Nightlatch and Deadlock rules to be INACTIVE.
SELECT id, sort_order, label, condition, qty_expr,
       product_short_name, finish_code, is_active
FROM   public.part_allocation_rules
WHERE  rule_family = 'default_ironmongery'
  AND  condition ILIKE '%is_front_door%'
ORDER  BY sort_order;

-- 0b. That the Croft pull exists as a product, in PB. Expect one row.
SELECT p.id, p.short_name, v.finish_code, v.cost
FROM   public.ironmongery_products p
JOIN   public.ironmongery_variants v ON v.product_id = p.id
WHERE  p.short_name = 'euro_cylinder_pull'
ORDER  BY v.finish_code;

-- 0c. The two AV4 variants, part by part, as they stand. Expect the _lh one
--     to hold RHZ2482 and RHZ3092 (the RIGHT-hand parts) — the thing half
--     (b) corrects.
SELECT p.short_name, v.id AS variant_id, v.finish_code,
       vp.id AS kit_row_id, vp.part_code, c.part_name, c.unit_cost, vp.quantity
FROM   public.ironmongery_products p
JOIN   public.ironmongery_variants v ON v.product_id = p.id
JOIN   public.ironmongery_variant_parts vp ON vp.variant_id = v.id
LEFT   JOIN public.parts_catalogue c ON c.part_code = vp.part_code
WHERE  p.short_name IN ('av3_heritage_locking_system_lh',
                        'av3_heritage_locking_system_rh')
ORDER  BY p.short_name, vp.part_code;

-- 0d. That the four handed parts all exist and all have the costs
--     sql/step-bd1 wrote. Expect 107 / 107 / 30 / 30 and the pocket keep at 5
--     — if any is still 0, STOP: the swap would move money, which Nathan's
--     decision says it must not.
SELECT part_code, part_name, unit_cost
FROM   public.parts_catalogue
WHERE  part_code IN ('RHZ2481', 'RHZ2482', 'RHZ3091', 'RHZ3092', 'RHZ2427')
ORDER  BY part_code;

-- 0e. What a front door's ironmongery costs today, so it can be compared
--     after. Expect 176.40 for each hand.
SELECT p.short_name, v.finish_code,
       sum(round(coalesce(c.unit_cost, 0) * vp.quantity, 0) * 1.05) AS set_cost
FROM   public.ironmongery_products p
JOIN   public.ironmongery_variants v ON v.product_id = p.id
JOIN   public.ironmongery_variant_parts vp ON vp.variant_id = v.id
LEFT   JOIN public.parts_catalogue c ON c.part_code = vp.part_code
WHERE  p.short_name IN ('av3_heritage_locking_system_lh',
                        'av3_heritage_locking_system_rh')
GROUP  BY p.short_name, v.finish_code
ORDER  BY p.short_name;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1a — the Croft pull on a new front door
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _rows int;
BEGIN
  -- The pull must exist in PB, or a new front door would be allocated a
  -- product with no variant and lose the line altogether.
  IF NOT EXISTS (
    SELECT 1 FROM public.ironmongery_products p
    JOIN public.ironmongery_variants v ON v.product_id = p.id
    WHERE p.short_name = 'euro_cylinder_pull' AND v.finish_code = 'PB'
  ) THEN
    RAISE EXCEPTION 'No euro_cylinder_pull:PB variant — do not run this half';
  END IF;

  UPDATE public.part_allocation_rules
  -- (reviewer, 14 Oct: part_allocation_rules has no updated_at column — removed)
  SET    product_short_name = 'euro_cylinder_pull'
  WHERE  id = 'cb8eb0b9-056f-40a0-80b9-3b9f0b14f214'
    AND  rule_family = 'default_ironmongery'
    AND  product_short_name = 'hardwick_classic_euro_pull_set_back_to_back';

  GET DIAGNOSTICS _rows = ROW_COUNT;
  IF _rows = 0 THEN
    RAISE NOTICE 'Step BD-4a: the rule already gives the Croft pull — nothing to do';
  ELSE
    RAISE NOTICE 'Step BD-4a: the Front Door Euro Cylinder Pull rule now gives euro_cylinder_pull';
  END IF;
END $$;

COMMIT;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1b — the AV4 hand
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _lh_variant bigint;
  _rh_variant bigint;
  _rows       int;
BEGIN
  SELECT v.id INTO _lh_variant
  FROM   public.ironmongery_products p
  JOIN   public.ironmongery_variants v ON v.product_id = p.id
  WHERE  p.short_name = 'av3_heritage_locking_system_lh' AND v.finish_code = 'PC';

  SELECT v.id INTO _rh_variant
  FROM   public.ironmongery_products p
  JOIN   public.ironmongery_variants v ON v.product_id = p.id
  WHERE  p.short_name = 'av3_heritage_locking_system_rh' AND v.finish_code = 'PC';

  IF _lh_variant IS NULL OR _rh_variant IS NULL THEN
    RAISE EXCEPTION 'One of the two AV4 PC variants is missing — do not run this half';
  END IF;

  -- The swap must be price-neutral, which is Nathan's own condition. If the
  -- two hands ever cost different money, this stops rather than moving a
  -- price nobody agreed to move.
  IF EXISTS (
    SELECT 1
    FROM   public.parts_catalogue a
    JOIN   public.parts_catalogue b ON b.part_code = CASE a.part_code
             WHEN 'RHZ2482' THEN 'RHZ2481'
             WHEN 'RHZ3092' THEN 'RHZ3091' END
    WHERE  a.part_code IN ('RHZ2482', 'RHZ3092')
      AND  round(coalesce(a.unit_cost, 0), 0) <> round(coalesce(b.unit_cost, 0), 0)
  ) THEN
    RAISE EXCEPTION 'The LH and RH AV4 parts cost different money — the swap would move a price; read SECTION 0d';
  END IF;

  -- LEFT hand takes the LEFT parts. Each UPDATE names the variant AND the
  -- part it is replacing, so re-running is a no-op.
  UPDATE public.ironmongery_variant_parts
  SET    part_code = 'RHZ2481'
  WHERE  variant_id = _lh_variant AND part_code = 'RHZ2482';
  GET DIAGNOSTICS _rows = ROW_COUNT;
  RAISE NOTICE 'Step BD-4b: LH lock rows swapped: %', _rows;

  UPDATE public.ironmongery_variant_parts
  SET    part_code = 'RHZ3091'
  WHERE  variant_id = _lh_variant AND part_code = 'RHZ3092';
  GET DIAGNOSTICS _rows = ROW_COUNT;
  RAISE NOTICE 'Step BD-4b: LH centre keep rows swapped: %', _rows;

  -- RIGHT hand takes the RIGHT parts.
  UPDATE public.ironmongery_variant_parts
  SET    part_code = 'RHZ2482'
  WHERE  variant_id = _rh_variant AND part_code = 'RHZ2481';
  GET DIAGNOSTICS _rows = ROW_COUNT;
  RAISE NOTICE 'Step BD-4b: RH lock rows swapped: %', _rows;

  UPDATE public.ironmongery_variant_parts
  SET    part_code = 'RHZ3092'
  WHERE  variant_id = _rh_variant AND part_code = 'RHZ3091';
  GET DIAGNOSTICS _rows = ROW_COUNT;
  RAISE NOTICE 'Step BD-4b: RH centre keep rows swapped: %', _rows;
END $$;

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. The rule, after (a). Expect euro_cylinder_pull PB.
SELECT id, label, product_short_name, finish_code, is_active
FROM   public.part_allocation_rules
WHERE  id = 'cb8eb0b9-056f-40a0-80b9-3b9f0b14f214';

-- 2. The two variants, after (b). Expect the _lh one to hold RHZ2481 and
--    RHZ3091 (both named LH), the _rh one RHZ2482 and RHZ3092, and the
--    pocket keep RHZ2427 in both.
SELECT p.short_name, vp.part_code, c.part_name, c.unit_cost, vp.quantity
FROM   public.ironmongery_products p
JOIN   public.ironmongery_variants v ON v.product_id = p.id
JOIN   public.ironmongery_variant_parts vp ON vp.variant_id = v.id
LEFT   JOIN public.parts_catalogue c ON c.part_code = vp.part_code
WHERE  p.short_name IN ('av3_heritage_locking_system_lh',
                        'av3_heritage_locking_system_rh')
ORDER  BY p.short_name, vp.part_code;

-- 3. No hand holds the other hand's part. Expect 0 rows.
SELECT p.short_name, vp.part_code
FROM   public.ironmongery_products p
JOIN   public.ironmongery_variants v ON v.product_id = p.id
JOIN   public.ironmongery_variant_parts vp ON vp.variant_id = v.id
WHERE  (p.short_name = 'av3_heritage_locking_system_lh'
        AND vp.part_code IN ('RHZ2482', 'RHZ3092'))
   OR  (p.short_name = 'av3_heritage_locking_system_rh'
        AND vp.part_code IN ('RHZ2481', 'RHZ3091'))
ORDER  BY p.short_name, vp.part_code;

-- 4. And the money has not moved: expect 176.40 for each hand, the same as
--    SECTION 0e, and 263.55 for a whole front door with Integrate's list.
SELECT p.short_name, v.finish_code,
       sum(round(coalesce(c.unit_cost, 0) * vp.quantity, 0) * 1.05) AS set_cost
FROM   public.ironmongery_products p
JOIN   public.ironmongery_variants v ON v.product_id = p.id
JOIN   public.ironmongery_variant_parts vp ON vp.variant_id = v.id
LEFT   JOIN public.parts_catalogue c ON c.part_code = vp.part_code
WHERE  p.short_name IN ('av3_heritage_locking_system_lh',
                        'av3_heritage_locking_system_rh')
GROUP  BY p.short_name, v.finish_code
ORDER  BY p.short_name;

-- 5. On /dev/pricing-benchmark: NOTHING moves. FT1-FT3 carry Integrate's
--    stored list, both hands cost the same, and no other benchmark uses
--    these parts or that rule.


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- (a) puts the Hardwick back-to-back pull back on a new front door, which is
-- what the import gave and what Nathan replaced.
--
-- BEGIN;
-- UPDATE public.part_allocation_rules
-- SET    product_short_name = 'hardwick_classic_euro_pull_set_back_to_back'
-- WHERE  id = 'cb8eb0b9-056f-40a0-80b9-3b9f0b14f214';
-- COMMIT;
--
-- (b) puts Integrate's hand error back: the LH system holding RH parts.
-- Harmless to the money, wrong on the paperwork.
--
-- BEGIN;
-- DO $$
-- DECLARE _lh bigint; _rh bigint;
-- BEGIN
--   SELECT v.id INTO _lh FROM public.ironmongery_products p
--     JOIN public.ironmongery_variants v ON v.product_id = p.id
--    WHERE p.short_name = 'av3_heritage_locking_system_lh' AND v.finish_code = 'PC';
--   SELECT v.id INTO _rh FROM public.ironmongery_products p
--     JOIN public.ironmongery_variants v ON v.product_id = p.id
--    WHERE p.short_name = 'av3_heritage_locking_system_rh' AND v.finish_code = 'PC';
--   UPDATE public.ironmongery_variant_parts SET part_code = 'RHZ2482'
--    WHERE variant_id = _lh AND part_code = 'RHZ2481';
--   UPDATE public.ironmongery_variant_parts SET part_code = 'RHZ3092'
--    WHERE variant_id = _lh AND part_code = 'RHZ3091';
--   UPDATE public.ironmongery_variant_parts SET part_code = 'RHZ2481'
--    WHERE variant_id = _rh AND part_code = 'RHZ2482';
--   UPDATE public.ironmongery_variant_parts SET part_code = 'RHZ3091'
--    WHERE variant_id = _rh AND part_code = 'RHZ3092';
-- END $$;
-- COMMIT;
