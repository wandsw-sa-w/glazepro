-- Step BD-1: the three AV4 Heritage parts that have NO cost in the catalogue.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run.
-- Independent of the other step-bd files, and the only one that changes a
-- PRICE — run it first.
--
-- WHAT IS WRONG. Every front door GlazePro prices is £149.10 light. The
-- ironmongery variant `av3_heritage_locking_system_lh:PC` (and its _rh twin)
-- holds four parts, and three of them sit in parts_catalogue at unit_cost 0:
--
--   RHZ2482  Winkhaus AV4 Heritage Lock RH             Integrate prices 112.35
--   RHZ2427  Winkhaus AV4 Pocket Keep                  Integrate prices   5.25
--   RHZ3092  Winkhaus AV4 RH Centre Keep w Dayswitch   Integrate prices  31.50
--
-- (The fourth, LJZ5074040CP Thumbturn Euro Cylinder 40/40 PC, is there at
-- 25.84 and prices correctly at 27.30. GlazePro reproduces Integrate's other
-- five front-door lines to the penny already — the hinges, the euro cylinder
-- pull, the letter tidy and the letterplate.)
--
-- The live "Ironmongery Cost" rule is round(cost x qty, 0.1) x 1.05 — round()
-- takes DECIMAL PLACES, floored, so 0.1 means whole pounds. Integrate's three
-- printed lines therefore come from whole-pound costs:
--
--   112.35 / 1.05 = 107  ->  cost in [107.00, 107.99]
--     5.25 / 1.05 =   5  ->  cost in [  5.00,   5.99]
--    31.50 / 1.05 =  30  ->  cost in [ 30.00,  30.99]
--
-- THE COSTS BELOW ARE DERIVED BACKWARDS from Integrate's priced lines, which
-- is exactly how Step AZ got three lock codes wrong: the four amounts were
-- right and the codes they were attached to were not. So this file writes the
-- LOW end of each band (107.00, 5.00, 30.00) — which reproduces Integrate's
-- lines exactly — and SECTION 0 asks for Integrate's own part list so the
-- reviewer can put the real purchase costs in before running SECTION 1.
--
-- The LEFT-hand twins (RHZ2481, RHZ3091) get the same costs: a left-hand
-- lock is not a different price, and without them a RIGHT-hand front door
-- would be the one that prices short.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. The five rows as they stand. Expect unit_cost 0 (or NULL) on each.
SELECT part_code, part_name, unit_cost, category, properties
FROM   public.parts_catalogue
WHERE  part_code IN ('RHZ2482', 'RHZ2481', 'RHZ2427', 'RHZ3092', 'RHZ3091')
ORDER  BY part_code;

-- 0b. The whole set, both hands, as the ironmongery catalogue serves it.
--     Expect four parts each: the thumbturn cylinder, the lock, the pocket
--     keep and the centre keep.
--
--     NOTE the hand: the _lh variant holds the RH lock, keep and dayswitch,
--     and the _rh variant the LH ones. That is INTEGRATE'S OWN quirk — it
--     prices right-hand AV4 parts on a left-hand door, on all three of the
--     reviewer's drawings — and it came in with the imported data. This file
--     does NOT change it; it is written up in docs/reports/step-bd.md for
--     Nathan to settle, because swapping it would move a price.
SELECT p.short_name, v.finish_code, vp.part_code, c.part_name,
       c.unit_cost, vp.quantity
FROM   public.ironmongery_products p
JOIN   public.ironmongery_variants v   ON v.product_id = p.id
JOIN   public.ironmongery_variant_parts vp ON vp.variant_id = v.id
LEFT   JOIN public.parts_catalogue c   ON c.part_code = vp.part_code
WHERE  p.short_name IN ('av3_heritage_locking_system_lh',
                        'av3_heritage_locking_system_rh')
ORDER  BY p.short_name, vp.part_code;

-- 0c. Any OTHER ironmongery part at zero cost, so this is not fixed one door
--     at a time. Rows here are for the reviewer to judge; this file changes
--     only the five named above.
SELECT c.part_code, c.part_name, c.unit_cost,
       string_agg(DISTINCT p.short_name, ', ') AS used_by
FROM   public.parts_catalogue c
JOIN   public.ironmongery_variant_parts vp ON vp.part_code = c.part_code
JOIN   public.ironmongery_variants v ON v.id = vp.variant_id
JOIN   public.ironmongery_products p ON p.id = v.product_id
WHERE  coalesce(c.unit_cost, 0) = 0
GROUP  BY c.part_code, c.part_name, c.unit_cost
ORDER  BY c.part_code;

-- 0d. And the default ironmongery rules a FRONT door fires, so the reviewer
--     can see what a new one is given before any of it is priced. Expect
--     Letterplate, Front Door Euro Cylinder Pull, Front Door Open In / Open
--     Out by hand, and the hinge rule — and NOT the two Trickle Vent rules,
--     which carry `not is_front_door`.
SELECT label, group_name, loop_target, condition, qty_expr,
       product_short_name, finish_code, is_active, sort_order
FROM   public.part_allocation_rules
WHERE  rule_family = 'default_ironmongery'
  AND  condition ILIKE '%is_front_door%'
ORDER  BY sort_order;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the three costs (five rows, both hands)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Only a ZERO cost is written. If the reviewer has already put a real
-- purchase cost in, this leaves it alone rather than replacing a known
-- figure with a derived one.
UPDATE public.parts_catalogue AS p
SET    unit_cost  = v.cost,
       properties = COALESCE(p.properties, '{}'::jsonb) - 'cost_unknown',
       updated_at = now()
FROM  (VALUES ('RHZ2482', 107.00),
              ('RHZ2481', 107.00),
              ('RHZ2427',   5.00),
              ('RHZ3092',  30.00),
              ('RHZ3091',  30.00)) AS v(code, cost)
WHERE  p.part_code = v.code
  AND  coalesce(p.unit_cost, 0) = 0;

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. The five rows. Expect 107.00, 107.00, 5.00, 30.00, 30.00.
SELECT part_code, part_name, unit_cost
FROM   public.parts_catalogue
WHERE  part_code IN ('RHZ2482', 'RHZ2481', 'RHZ2427', 'RHZ3092', 'RHZ3091')
ORDER  BY part_code;

-- 2. What a front door's locking system now costs, as the rule reads it:
--    round(cost x qty, 0 dp) x 1.05 per part. Expect 27.30 + 112.35 + 5.25 +
--    31.50 = 176.40 for each hand — and with the hinges (14.70), the euro
--    cylinder pull (29.40), the letter tidy (27.30) and the letterplate
--    (15.75), Integrate's own 263.55 on FT1, FT2 and FT3.
SELECT p.short_name, v.finish_code,
       sum(round(coalesce(c.unit_cost, 0) * vp.quantity, 0) * 1.05) AS set_cost
FROM   public.ironmongery_products p
JOIN   public.ironmongery_variants v   ON v.product_id = p.id
JOIN   public.ironmongery_variant_parts vp ON vp.variant_id = v.id
LEFT   JOIN public.parts_catalogue c   ON c.part_code = vp.part_code
WHERE  p.short_name IN ('av3_heritage_locking_system_lh',
                        'av3_heritage_locking_system_rh')
GROUP  BY p.short_name, v.finish_code
ORDER  BY p.short_name;

-- 3. And on /dev/pricing-benchmark: FT1, FT2 and FT3 each move £149.10
--    closer to Integrate. FT1 then reads +30.94 (its 120 muntin) and its
--    unexplained 2 h of production; FT2 +13.67; FT3 +13.45 and the parked
--    shaped glass. Nothing else on the page moves — no other benchmark uses
--    these parts.


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- This puts the five costs back to 0, which is where they were, and makes
-- every front door £149.10 light again.
--
-- BEGIN;
-- UPDATE public.parts_catalogue
-- SET    unit_cost  = 0,
--        properties = COALESCE(properties, '{}'::jsonb) || '{"cost_unknown": true}'::jsonb,
--        updated_at = now()
-- WHERE  part_code IN ('RHZ2482', 'RHZ2481', 'RHZ2427', 'RHZ3092', 'RHZ3091');
-- COMMIT;
