-- Step BE-1: a shaped unit is priced at the SQUARE glass rate.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run.
-- Independent of sql/step-be2; either order.
--
-- NATHAN, 14 Oct 2026 (decision e, docs/integrate-L31115-front-doors.txt):
-- shaped glass — ALL of it, a door or an arched sash alike — is priced on the
-- LARGEST RECTANGLE of its cut glass PLUS 25%, at the SQUARE glass rate.
--
-- The 25% is the supplier's charge for cutting a shape out of a sheet, and it
-- belongs on the AREA. Integrate instead puts it on the RATE:
--
--   Square Glass Cost  rounded_area x ((inner_pane_cost + outer_pane_cost) + 1)
--                      = 58.50 / m2 on PF30
--   Shaped Glass Cost  rounded_area x ((inner_pane_cost + outer_pane_cost) * 1.25)
--                      = 71.88 / m2
--
-- GlazePro now supplies the billable AREA (the engine, Step BE), so the rate
-- has to stop carrying the quarter as well or every shaped unit is charged it
-- twice. This file makes the shaped rule read the SQUARE rule's own
-- expression — the same words, so a change in pane costs still reaches both.
--
-- WHAT MOVES. Two benchmarks have shaped glass (the only two in the whole
-- set): FT3, the arched front door, and C, the arched-head box sash. On the
-- /dev/pricing-benchmark page both are declared BY DESIGN, and this file is
-- the "pending" half of each:
--
--   FT3  1.13 m2:  81.22 -> 66.11   (-15.11)
--   C    0.43 m2:  30.91 -> 25.16   (-5.75)
--
-- The glazing-bar surcharge on a shaped unit (rule 7adaa4b6, a flat 44) is
-- NOT touched: it is its own figure, not a 1.25 multiple of anything, and
-- Nathan's decision is about the glass. The energy surcharge is not touched
-- either; it reads the same rounded_area and follows it.
--
-- RUN SECTION 0 FIRST.

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ════════════════════════════════════════════════════════════════════════════

-- 0a. The glass price rules, in the ACTIVE price file. Expect the shaped one
--     to carry "* 1.25" and the square one "+ 1".
SELECT r.id, r.name, r.rule_family, r.loop_target, r.condition, r.quantity,
       r.value, r.is_active, f.id AS price_file_id
FROM   public.price_rules r
JOIN   public.price_files f ON f.id = r.price_file_id AND f.is_current
WHERE  r.name ILIKE '%glass%'
ORDER  BY r.sort_order, r.name;

-- 0b. The one row this file changes, by id. Expect ONE row,
--     value '(inner_pane_cost + outer_pane_cost) * 1.25'.
SELECT id, name, value, quantity, is_active
FROM   public.price_rules
WHERE  id = 'd2592418-2a70-45e8-a420-1dd3d4d5b867';

-- 0c. The square rule's expression, which is what the shaped one will read.
SELECT id, name, value
FROM   public.price_rules
WHERE  id = '6e82cff5-b30a-4103-9263-fb1b25ede1b9';

-- 0d. If the ids above return nothing, this is the same list by NAME — the
--     reviewer should use whatever id these rows show.
SELECT id, name, value
FROM   public.price_rules
WHERE  name IN ('Shaped Glass Cost', 'Square Glass Cost')
ORDER  BY name;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the rate
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _price_file uuid;     -- (reviewer, 14 Oct: price_files.id is uuid, not bigint)
  _square     text;
  _rows       int;
BEGIN
  -- The LIVE price file, so no other file's rules are touched. PF30 is the
  -- benchmark page and every quote find it), so no other file is touched.
  SELECT id INTO _price_file FROM public.price_files
  WHERE  is_current = TRUE
  LIMIT  1;
  IF _price_file IS NULL THEN
    RAISE EXCEPTION 'No price_files row with is_current = true';
  END IF;

  -- Take the expression from the SQUARE rule itself rather than typing it
  -- again: if its pane-cost arithmetic ever changes, the shaped rule follows.
  SELECT value INTO _square
  FROM   public.price_rules
  WHERE  name = 'Square Glass Cost' AND is_active
    AND  price_file_id = _price_file
  ORDER  BY sort_order LIMIT 1;

  IF _square IS NULL THEN
    RAISE EXCEPTION 'No active "Square Glass Cost" rule to copy the rate from';
  END IF;
  IF _square LIKE '%1.25%' THEN
    RAISE EXCEPTION 'The SQUARE rule itself carries a 1.25 (%) — do not run this file', _square;
  END IF;

  UPDATE public.price_rules
  SET    value = _square
  WHERE  name = 'Shaped Glass Cost'
    AND  price_file_id = _price_file
    AND  value <> _square;

  GET DIAGNOSTICS _rows = ROW_COUNT;
  IF _rows = 0 THEN
    RAISE NOTICE 'Step BE-1: the shaped rule already reads the square rate — nothing to do';
  ELSE
    RAISE NOTICE 'Step BE-1: Shaped Glass Cost now reads %', _square;
  END IF;
END $$;

COMMIT;

-- ── Checks ──────────────────────────────────────────────────────────────

-- 1. The two rules now read the same rate, and only the CONDITION tells them
--    apart. Expect two rows with identical value.
SELECT name, condition, value
FROM   public.price_rules
WHERE  name IN ('Shaped Glass Cost', 'Square Glass Cost')
ORDER  BY name;

-- 2. The glazing-bar and energy rules are untouched. Expect the shaped bar
--    rule still at 44 and the energy rule at 0.17.
SELECT name, quantity, value
FROM   public.price_rules
WHERE  name IN ('Shaped Glass Multiple Glazing Bar', 'All Glass Energy Surcharge')
ORDER  BY name;

-- 3. And on /dev/pricing-benchmark, two rows move closer to Integrate:
--    FT3 by 15.11 and C by 5.75 — the "STILL TO COME" half of each row's
--    BY DESIGN note. Nothing else on the page has shaped glass.


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- This puts Integrate's shaped rate back, which with GlazePro's billable area
-- charges the supplier's quarter TWICE.
--
-- BEGIN;
-- UPDATE public.price_rules
-- SET    value = '(inner_pane_cost + outer_pane_cost) * 1.25'
-- WHERE  name = 'Shaped Glass Cost';
-- COMMIT;
