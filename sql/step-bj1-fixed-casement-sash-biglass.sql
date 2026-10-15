-- Step BJ-1: the fixed-casement-sash fitting hour on a BI-GLASS casement.
-- Run by the reviewer in the Supabase SQL editor. Safe to re-run.
--
-- ONE rule, ONE condition. Install rule 15 "Fixed Casement Sash with Frame"
-- charges 60 minutes per fixed casement sash. Integrate fires it on a
-- BI-GLASS casement, where the frame is KEPT — benchmark BG3 (L31115 item 10
-- drawing 35, a copy of Configuration 4) is charged for its one fixed sash,
-- which is 60 of its 780 fitting minutes and £40.21 of its cost
-- (docs/integrate-L31115-casement-biglass.txt, read 15 Oct 2026).
--
-- WHY IT DOES NOT FIRE TODAY. Integrate stores the condition UNBRACKETED:
--
--   [is_casement_window] || [is_casement_window_bay] && [is_installation_included] && [frame_to_be_replaced]
--
-- and evaluates it as  is_casement_window OR (the other three)  — so on any
-- casement at all the first term alone carries it, whatever the frame is
-- doing. GlazePro's import bracketed it the way a reader would expect,
--
--   (is_casement_window or is_casement_window_bay) and is_installation_included and frame_to_be_replaced
--
-- which is why every casement benchmark to date matched and BG3 came out 60
-- minutes short.
--
-- WHAT THIS CHANGES IT TO. Nathan (15 Oct): copy Integrate for bi-glass, but
-- do NOT copy the loose precedence — Integrate's version would also reach a
-- draught-seal-only casement and a supply-only casement, neither of which
-- anybody has asked about and neither of which has been read. So the clause
-- is widened by exactly one case:
--
--   (is_casement_window or is_casement_window_bay) and is_installation_included
--     and (frame_to_be_replaced or is_bi_glass)
--
-- WHAT MOVES. Only a bi-glass casement with at least one FIXED sash. Of the
-- benchmarks that is BG3 alone: BG1, BG2 and BG4 have no fixed sash, and every
-- complete-new casement already satisfied frame_to_be_replaced, so none of
-- them can move. Checked against all 65 benchmarks offline
-- (src/pricing/benchmarks/benchmarks.test.js, "Step BJ"), where the condition
-- below is applied to the captured snapshot through
-- src/pricing/benchmarks/liveRuleFixes.js until the snapshot is refreshed.
--
-- The UPDATE matches on the name AND the current condition, so it is a no-op
-- if it has already run, and it RAISES rather than guessing if the live
-- condition is something this file has not seen.
--
-- RUN SECTION 0 FIRST.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. The rule as it stands, IN EVERY PRICE FILE. `price_rules` is scoped by
--     price_file_id, so expect one row per price file that has been imported
--     (PF30 and any later one) — each install_labour, sort_order 15, group
--     "Casements", quantity fixed_casement_sash_qty, value 60, condition
--       (is_casement_window or is_casement_window_bay) and is_installation_included and frame_to_be_replaced
--
--     SECTION 1 updates every row that still reads exactly that, whichever
--     price file it is in, and raises if any row reads something else.
SELECT r.id, f.name AS price_file, f.status, r.rule_family, r.is_active,
       r.sort_order, r.group_name, r.loop_target,
       r.name, r.condition, r.quantity, r.value, r.markup
FROM   public.price_rules r
LEFT   JOIN public.price_files f ON f.id = r.price_file_id
WHERE  r.name = 'Fixed Casement Sash with Frame'
ORDER  BY f.name, r.sort_order;

-- 0b. Nothing else in the file reads is_bi_glass this way — for context, the
--     rules that already mention it. Expect the two BiGlass rules (base price
--     and GBs to take off), the three that EXCLUDE it (Single Glazed error
--     price, DSO Extra Profits, DSO Sashes), the overweight sliding rule and
--     the cord-hung one. Rule 15 should NOT be among them yet.
SELECT sort_order, rule_family, name, condition
FROM   public.price_rules
WHERE  condition ILIKE '%is_bi_glass%'
ORDER  BY rule_family, sort_order;

-- 0c. Which live drawings this could touch: a BI-GLASS item, and how many
--     casement sashes it has. Read-only, and the answer may well be none —
--     this step is about what the next bi-glass casement prices, not about
--     re-pricing the past. (A published quote is never re-priced; an open one
--     re-prices on the engine version, which this file does not change.)
SELECT p.drawing_id,
       count(*) FILTER (WHERE p.part_type = 'casementSashPart') AS casement_sashes
FROM   public.drawing_parts p
WHERE  p.drawing_id IN (
         SELECT i.drawing_id FROM public.drawing_parts i
         WHERE  i.part_type = 'drawingItemPart'
           AND  (i.values ->> 'typeOfWork' = 'bi_glass'
                 OR i.values ->> 'isBiGlass' = 'true')
       )
GROUP  BY p.drawing_id
ORDER  BY p.drawing_id;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — widen the clause
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _before text := '(is_casement_window or is_casement_window_bay) and is_installation_included and frame_to_be_replaced';
  _after  text := '(is_casement_window or is_casement_window_bay) and is_installation_included and (frame_to_be_replaced or is_bi_glass)';
  _name   text := 'Fixed Casement Sash with Frame';
  _total  int;
  _done   int;
  _odd    int;
  _moved  int;
BEGIN
  SELECT count(*) INTO _total FROM public.price_rules WHERE name = _name;
  IF _total = 0 THEN
    RAISE EXCEPTION 'No rule named % at all — stop and look', _name;
  END IF;

  -- Rows already carrying the new clause (a re-run), and rows carrying
  -- something this file has never read.
  SELECT count(*) INTO _done FROM public.price_rules
  WHERE  name = _name AND condition = _after;
  SELECT count(*) INTO _odd FROM public.price_rules
  WHERE  name = _name AND condition NOT IN (_before, _after);

  IF _odd > 0 THEN
    -- Never guess at a condition this file has not read.
    RAISE EXCEPTION 'Step BJ-1: % row(s) named % have an unexpected condition, NOTHING changed — run section 0a and look',
      _odd, _name;
  END IF;

  UPDATE public.price_rules
  SET    condition = _after
  WHERE  name = _name AND condition = _before;
  GET DIAGNOSTICS _moved = ROW_COUNT;

  RAISE NOTICE 'Step BJ-1: % row(s) named % — % widened, % already applied',
    _total, _name, _moved, _done;
END $$;

COMMIT;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 2 — checks
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. The rule now, in every price file. Expect EVERY row's condition to end
--    "and (frame_to_be_replaced or is_bi_glass)", still active, still 60
--    minutes on fixed_casement_sash_qty.
SELECT r.id, f.name AS price_file, r.is_active, r.sort_order, r.group_name,
       r.name, r.condition, r.quantity, r.value
FROM   public.price_rules r
LEFT   JOIN public.price_files f ON f.id = r.price_file_id
WHERE  r.name = 'Fixed Casement Sash with Frame'
ORDER  BY f.name;

-- 2. And that NOTHING ELSE changed in the Casements group — the other fitting
--    rules should read exactly as they did (13 Base Casement Frame,
--    14 Opening Casement Sash, 110 / 111 the oversize frames). Rule 15
--    should be the ONLY one mentioning is_bi_glass.
SELECT f.name AS price_file, r.sort_order, r.name, r.condition, r.quantity, r.value
FROM   public.price_rules r
LEFT   JOIN public.price_files f ON f.id = r.price_file_id
WHERE  r.group_name = 'Casements' AND r.rule_family = 'install_labour'
ORDER  BY f.name, r.sort_order;

-- 3. The figures to expect on a bi-glass casement, from
--    docs/reports/step-bj.md:
--      BG1  single casement, 1599 x 1599        358.24 / 716.48    fitting 4.75 h
--      BG2  the same with 3 glazing bars        478.87 / 957.74    fitting 7.75 h
--      BG3  opener | fixed | opener             698.90 / 1,397.78  fitting 13.00 h
--      BG4  fanlight over a casement            448.01 / 896.01    fitting 8.00 h
--    BG3 is the one this file moves: without it, 658.69 / 1,317.36 and
--    12.00 h. The other three have no fixed sash and are the same either way.


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- This puts the bracketed condition back, which makes a bi-glass casement
-- 60 minutes per fixed sash cheaper than Integrate again.
--
-- BEGIN;
-- UPDATE public.price_rules
-- SET    condition = '(is_casement_window or is_casement_window_bay) and is_installation_included and frame_to_be_replaced'
-- WHERE  name = 'Fixed Casement Sash with Frame'
--   AND  condition = '(is_casement_window or is_casement_window_bay) and is_installation_included and (frame_to_be_replaced or is_bi_glass)';
-- COMMIT;
