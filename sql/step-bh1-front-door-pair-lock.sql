-- Step BH-1: the FRENCH master's multipoint lock does not belong on a PAIR
-- OF FRONT DOORS.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run — the clause is
-- only appended where it is not already there.
-- Independent of sql/step-bh2 (the templates); either can run first.
--
-- WHAT IT IS. A pair of front doors (two open-in leaves, master right) fires
-- allocator rule
--
--     cebdd8b5-…  "MPLS master or tall – shootbolt"   RJZ2382   qty 1
--     is_door_mpls and gross_sash_height_in_mm > 1853
--       and is_master_leaf_in_french_pair
--
-- which gives the MASTER leaf a Winkhaus Thunderbolt Master Multipoint Lock
-- (RJZ2382, £53.55) ON TOP OF the AV3 Heritage locking system the default
-- ironmongery set already gives it. The master's lock IS the heritage set
-- (Nathan's decision a, Step BD); the Thunderbolt is a FRENCH door's lock.
--
-- Every other rule in that family already carries `not is_front_door`:
--
--     1b55d5a5  MPLS non-front non-french – shootbolt   RJZ2382
--     36d8eb57  MPLS non-front RH lock                  WIN5002560
--     c2ed4405  MPLS non-front LH lock                  WIN5002439
--
-- This one never did, because Integrate has no pair of front doors to catch
-- it — and a SINGLE front door is not a master leaf in a pair, so nothing
-- has ever hit it before. The file appends the same clause.
--
-- WHAT IT DOES NOT TOUCH: the SLAVE leaf's bolts and keeps (RHZ1649 /
-- RHZ1653 / RHZ1667), which Nathan asks for by name, and a FRENCH pair's own
-- Thunderbolt, which still fires on FD1-FD7 and on OI1 / OI3.
--
-- Offline, with this applied, a pair of front doors prices £53.55 less, and
-- src/drawingBoard/doorsetTemplates.test.js asserts BOTH figures — the one
-- the live data gives today and the one it gives after this runs — so the
-- test cannot pass while the site is wrong.
--
-- RUN SECTION 0 FIRST.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. The rule this file changes. Expect ONE row, active, its condition
--     WITHOUT `not is_front_door`.
SELECT id, group_name, label, loop_target, condition, qty_expr,
       part_code_expr, is_active
FROM   public.part_allocation_rules
WHERE  id::text LIKE 'cebdd8b5%';

-- 0b. The whole family, so the pattern is visible: the three that already
--     carry `not is_front_door`, and the slave rules that must NOT change.
SELECT id, label, condition, part_code_expr, is_active
FROM   public.part_allocation_rules
WHERE  group_name = 'mpls_doors'
ORDER  BY label;

-- 0c. Nothing else fires RJZ2382 on a master leaf. Expect only cebdd8b5 to
--     mention `is_master_leaf_in_french_pair` with that part.
SELECT id, label, condition
FROM   public.part_allocation_rules
WHERE  group_name = 'mpls_doors'
  AND  condition ILIKE '%is_master_leaf_in_french_pair%'
ORDER  BY label;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the clause
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _rows int;
BEGIN
  -- It must still be there, and still be the rule this file describes: a
  -- condition that has been rewritten since 14 Oct is one a human should
  -- look at rather than have a file append to.
  IF NOT EXISTS (
    SELECT 1 FROM public.part_allocation_rules
    WHERE id::text LIKE 'cebdd8b5%'
      AND condition ILIKE '%is_master_leaf_in_french_pair%'
  ) THEN
    RAISE EXCEPTION 'Rule cebdd8b5 is missing or no longer bands on the master leaf — do not run this file';
  END IF;

  UPDATE public.part_allocation_rules
  SET    condition = condition || ' and not is_front_door'
  WHERE  id::text LIKE 'cebdd8b5%'
    AND  condition NOT ILIKE '%not is_front_door%';
  GET DIAGNOSTICS _rows = ROW_COUNT;
  RAISE NOTICE 'Step BH-1: % rule(s) now stand down for a front door', _rows;
END $$;

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. The rule, active, with the clause.
SELECT id, label, condition, is_active
FROM   public.part_allocation_rules
WHERE  id::text LIKE 'cebdd8b5%';

-- 2. The slave rules are untouched — none of them mentions a front door.
SELECT id, label, condition
FROM   public.part_allocation_rules
WHERE  group_name = 'mpls_doors'
  AND  condition ILIKE '%is_slave_leaf_in_french_pair%'
ORDER  BY label;

-- 3. On a drawing: a PAIR OF FRONT DOORS (template 240, or any drawing with
--    isFrontDoor true and two leaves) should lose RJZ2382 and £53.55, and a
--    FRENCH pair (drawing 1-3 of L31115 item 10, or OI1) should keep it.


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- BEGIN;
-- UPDATE public.part_allocation_rules
-- SET    condition = replace(condition, ' and not is_front_door', '')
-- WHERE  id::text LIKE 'cebdd8b5%';
-- COMMIT;
