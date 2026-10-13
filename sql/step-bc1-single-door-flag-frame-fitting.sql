-- Step BC-1: Nathan's decision (c) — fitting a single door's FLAG frames.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run. RUN THIS FIRST.
--
-- Nathan (13 Oct 2026): a flag frame takes FOUR HOURS of fitting, the same as
-- a winglight frame on a French door. Integrate charges nothing for it: its
-- own rule 140 "Winglight Frame" is live and active, and it did NOT fire on
-- CD1-CD4 (Fitting Units test view, read 13 Oct) — because it is worth
-- 1 x 1 MINUTE, which is not a charge, it is a placeholder.
--
-- This file rewrites THAT rule rather than adding one, so GlazePro keeps one
-- rule per idea and the id survives (every stored run that referenced it
-- still resolves). It becomes the single-door twin of rule 14 "French Doors
-- (Winglight Frame)", which already charges 240 minutes per extra frame.
--
-- THE RULE'S VALUES BEFORE THIS FILE, for the record and for the rollback:
--
--   id         df59375e-6e73-41aa-bb5d-bd2366d12f84
--   sort_order 140
--   name       'Winglight Frame'
--   condition  'is_door_mpls and door_leaf_qty == 1 and frame_qty > 1'
--   quantity   '1'
--   value      '1'           (one minute — a placeholder, not a price)
--   family     install_labour, level item, group 'Doors', is_active true
--
-- AND AFTER:
--
--   name       'Single Door (Flag Frame)'
--   condition  'not is_front_door and is_complete_new and is_door and
--               door_leaf_qty == 1 and is_installation_included and
--               new_frame_qty > 1'
--   quantity   'new_frame_qty - 1'      (one charge per EXTRA frame)
--   value      '240'                    (4 hours)
--
-- The condition is rule 14's with `door_leaf_qty == 1` in place of `>= 2`, so
-- a single door and a French pair are treated the same way and neither rule
-- can fire on the other's drawing.
--
-- WHAT IT IS WORTH: CD1 and CD4 have two flag frames (480 min = 8 h = 321.68
-- at 40.21/h), CD2 and CD3 one (240 min = 4 h = 160.84). Recorded as
-- deliberate difference 12 in docs/integrate-differences.md.
--
-- AFTER RUNNING THIS, PLEASE TAKE A FRESH PF30 SNAPSHOT from the benchmark
-- page ("Download snapshot") and send it over: the four CD benchmarks carry
-- this amount as a PENDING decision until the captured snapshot has the new
-- rule, and the page and the live smoke test accept either figure meanwhile.
--
-- RUN SECTION 0 FIRST.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. The rule as it stands. Expect exactly the BEFORE values above; if it
--     differs, STOP and tell the reviewer — somebody has edited it since.
SELECT id, sort_order, name, rule_family, level, group_name,
       condition, quantity, value, is_active, price_file_id
FROM   public.price_rules
WHERE  id = 'df59375e-6e73-41aa-bb5d-bd2366d12f84';

-- 0b. Rule 14, the French-door twin this one is modelled on, for comparison.
SELECT id, sort_order, name, condition, quantity, value, is_active
FROM   public.price_rules
WHERE  name = 'French Doors (Winglight Frame)'
ORDER  BY sort_order;

-- 0c. Every install_labour rule in the Doors group, so the two read together.
SELECT sort_order, name, condition, quantity, value, is_active
FROM   public.price_rules
WHERE  rule_family = 'install_labour' AND group_name = 'Doors'
ORDER  BY sort_order;

-- 0d. Does any OTHER rule mention frame_qty or new_frame_qty? A multi-frame
--     drawing is new, so this is the list of everything that now has more
--     than one frame to count.
SELECT sort_order, name, rule_family, condition, quantity
FROM   public.price_rules
WHERE  condition ILIKE '%frame_qty%' OR quantity ILIKE '%frame_qty%'
ORDER  BY rule_family, sort_order;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the rewrite
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _id   uuid := 'df59375e-6e73-41aa-bb5d-bd2366d12f84';
  _rows int;
BEGIN
  -- Refuse to touch anything but the rule this file was written for.
  IF NOT EXISTS (
    SELECT 1 FROM public.price_rules
    WHERE id = _id AND rule_family = 'install_labour' AND sort_order = 140
  ) THEN
    RAISE EXCEPTION 'Rule 140 (id %) is not the install_labour rule this file expects — run SECTION 0 and tell the reviewer', _id;
  END IF;

  UPDATE public.price_rules
  SET name      = 'Single Door (Flag Frame)',
      condition = 'not is_front_door and is_complete_new and is_door and door_leaf_qty == 1 and is_installation_included and new_frame_qty > 1',
      quantity  = 'new_frame_qty - 1',
      value     = '240',
      is_active = TRUE
  WHERE id = _id;

  GET DIAGNOSTICS _rows = ROW_COUNT;
  IF _rows <> 1 THEN
    RAISE EXCEPTION 'Expected to update exactly 1 rule, updated %', _rows;
  END IF;
  RAISE NOTICE 'Step BC-1: rule 140 is now Single Door (Flag Frame), 240 min per extra frame';
END $$;

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. The rule, rewritten. Expect the AFTER values above.
SELECT id, sort_order, name, rule_family, level, group_name,
       condition, quantity, value, is_active
FROM   public.price_rules
WHERE  id = 'df59375e-6e73-41aa-bb5d-bd2366d12f84';

-- 2. The two winglight rules side by side: 14 for a pair (door_leaf_qty >= 2)
--    and 140 for a single door (== 1). Neither can fire on the other's
--    drawing, and both charge 240 per extra frame.
SELECT sort_order, name, condition, quantity, value, is_active
FROM   public.price_rules
WHERE  name IN ('French Doors (Winglight Frame)', 'Single Door (Flag Frame)')
ORDER  BY sort_order;


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- This restores the rule EXACTLY as SECTION 0a found it — a 1-minute
-- placeholder — which is what Integrate effectively charges for a flag frame.
--
-- UPDATE public.price_rules
-- SET name      = 'Winglight Frame',
--     condition = 'is_door_mpls and door_leaf_qty == 1 and frame_qty > 1',
--     quantity  = '1',
--     value     = '1',
--     is_active = TRUE
-- WHERE id = 'df59375e-6e73-41aa-bb5d-bd2366d12f84';
