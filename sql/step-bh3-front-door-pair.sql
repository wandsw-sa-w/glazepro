-- Step BH-3: a PAIR of front doors — the lock goes on the MASTER leaf, and
-- the second leaf is fitted.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run: each statement
-- changes only what still has the old text, and the new rule has a fixed id.
-- Independent of sql/step-bh4 (template 40's mid rail).
--
-- TWO THINGS, both found by pricing the live drawings the reviewer made from
-- the Step BH templates (54-58 on L507712).
--
-- ── 4. THE FRONT-DOOR SET IS ON THE WRONG LEAF ─────────────────────────────
--
-- The five front-door default_ironmongery rules each carry
-- `not is_master_leaf_in_french_pair`:
--
--     b5c2d45a  Front Door Open In Left Hand Hung   av3_heritage_locking_system_lh
--     501f9ca5  Front Door Open In Right Hand Hung  av3_heritage_locking_system_rh
--     e938fc5a  Front Door Open Out Left Hand Hung  av3_heritage_locking_system_rh
--     d23e8262  Front Door Open Out Right Hand Hung av3_heritage_locking_system_lh
--     cb8eb0b9  Front Door Euro Cylinder Pull       euro_cylinder_pull
--
-- On a SINGLE front door that clause does nothing — a single leaf is neither
-- master nor slave. On a PAIR it excludes the one leaf that should have the
-- set: the MASTER is the leaf that carries the lock (Nathan's decision a, and
-- Nathan 2 of docs/step-bh-brief.md), and the SLAVE gets its hinges and the
-- pair's bolts. Today the lock, the cylinder, the keeps and the pull all land
-- on the slave — the LEFT leaf, so the LEFT-hand set.
--
-- So the clause becomes `not is_slave_leaf_in_french_pair`. The pair's set
-- then comes RIGHT hand (the master is the right leaf by default), which
-- costs the same to the penny: av3_heritage_locking_system_rh and _lh are
-- £167.53 each. NO PRICE MOVE — this is about which leaf is drilled.
--
-- A single front door is untouched, which is why FT1-FT4 do not move.
--
-- ── 5. NATHAN (15 Oct): A PAIR IS FITTED IN 14 h + 2 h ─────────────────────
--
-- Integrate gives a pair of front doors only "Front Door and Frame (Base)"
-- 840 minutes, because "French Doors Additional Door" 120 carries
-- `not is_front_door`. Nathan fits the second leaf in 2 hours, so this file
-- adds one install_labour rule in the same shape as the three "Front Door and
-- Frame" rules — quantity `new_french_door_pair_qty`, value 120:
--
--     Front Door Pair Additional Door   120 x new_french_door_pair_qty
--     is_front_door and is_complete_new and is_installation_included
--       and new_french_door_pair_qty >= 1
--
-- A single front door has no pair (quantity 0 AND the condition fails), a
-- French pair is not a front door, and a stable door is not a front door, so
-- nothing else moves. Recorded as deliberate difference 22 in
-- docs/integrate-differences.md: Integrate charges 14 h for a pair of front
-- doors and GlazePro charges 16.
--
-- WHAT IT IS WORTH, offline on the live rules (drawing 54, template 36):
--     before   cost 3,321.45   price 6,642.89   fitting 840 min
--     after    cost 3,401.87   price 6,803.73   fitting 960 min
-- = +80.42 cost / +160.84 price, which is 2 h at £40.21.
--
-- RUN SECTION 0 FIRST.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. The five rules item 4 changes. Expect five rows, active, each with
--     `not is_master_leaf_in_french_pair` in its condition.
SELECT id, label, condition, product_short_name, finish_code, qty_expr, is_active
FROM   public.part_allocation_rules
WHERE  rule_family = 'default_ironmongery'
  AND  (id::text LIKE 'b5c2d45a%' OR id::text LIKE '501f9ca5%'
     OR id::text LIKE 'e938fc5a%' OR id::text LIKE 'd23e8262%'
     OR id::text LIKE 'cb8eb0b9%')
ORDER  BY sort_order, label;

-- 0b. Anything ELSE that bands on the master or the slave leaf, so the change
--     can be seen in context. The mpls_doors rules must NOT change.
SELECT id, group_name, label, condition
FROM   public.part_allocation_rules
WHERE  condition ILIKE '%master_leaf_in_french_pair%'
    OR condition ILIKE '%slave_leaf_in_french_pair%'
ORDER  BY group_name, label;

-- 0c. The two hands of the heritage set cost the same, which is why item 4
--     moves no money. Expect two rows with equal cost.
SELECT p.short_name, v.finish_code, v.cost
FROM   public.ironmongery_products p
JOIN   public.ironmongery_variants v ON v.product_id = p.id
WHERE  p.short_name IN ('av3_heritage_locking_system_lh', 'av3_heritage_locking_system_rh')
  AND  v.finish_code = 'PC';

-- 0d. The LIVE price file, which the new rule has to belong to.
--     (price_files.id is a uuid — reviewer, 14 Oct.)
SELECT id, name, is_current FROM public.price_files WHERE is_current = TRUE;

-- 0e. The fitting rules a door fires today, and that sort_order 3 is free in
--     the Doors group. Expect "Front Door and Frame" Base / Mullion /
--     Transom at 0 / 1 / 2 and nothing at 3.
SELECT r.id, r.name, r.condition, r.quantity, r.value, r.sort_order, r.is_active
FROM   public.price_rules r
JOIN   public.price_files f ON f.id = r.price_file_id AND f.is_current
WHERE  r.rule_family = 'install_labour' AND r.group_name = 'Doors'
ORDER  BY r.sort_order;

-- 0f. And that this file's own rule is not already there.
SELECT id, name, condition, quantity, value, is_active, price_file_id
FROM   public.price_rules
WHERE  name = 'Front Door Pair Additional Door';


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the leaf, and the second door
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _rows int;
BEGIN
  -- Item 4. Only where the OLD text is present, so a second run does nothing
  -- and a rule somebody has since rewritten is left for a human.
  UPDATE public.part_allocation_rules
  SET    condition = replace(condition,
           'not is_master_leaf_in_french_pair',
           'not is_slave_leaf_in_french_pair')
  WHERE  rule_family = 'default_ironmongery'
    AND  (id::text LIKE 'b5c2d45a%' OR id::text LIKE '501f9ca5%'
       OR id::text LIKE 'e938fc5a%' OR id::text LIKE 'd23e8262%'
       OR id::text LIKE 'cb8eb0b9%')
    AND  condition LIKE '%not is_master_leaf_in_french_pair%';
  GET DIAGNOSTICS _rows = ROW_COUNT;
  RAISE NOTICE 'Step BH-3: % front-door rule(s) moved to the master leaf', _rows;

  IF EXISTS (
    SELECT 1 FROM public.part_allocation_rules
    WHERE rule_family = 'default_ironmongery'
      AND condition LIKE '%not is_master_leaf_in_french_pair%'
      AND (id::text LIKE 'b5c2d45a%' OR id::text LIKE '501f9ca5%'
        OR id::text LIKE 'e938fc5a%' OR id::text LIKE 'd23e8262%'
        OR id::text LIKE 'cb8eb0b9%')
  ) THEN
    RAISE EXCEPTION 'A front-door rule still names the master leaf — stop and look at it';
  END IF;
END $$;

-- Item 5. A fixed id, so a re-run updates rather than duplicates — and it
-- reads 'bb03…' rather than 'bh03…' because price_rules.id is a uuid and 'h'
-- is not a hex digit — and it
-- belongs to the LIVE price file, as every other rule does (a rule with no
-- price_file_id is a rule no quote will ever read).
DO $$
DECLARE
  _price_file uuid;
BEGIN
  SELECT id INTO _price_file FROM public.price_files
  WHERE  is_current = TRUE
  LIMIT  1;
  IF _price_file IS NULL THEN
    RAISE EXCEPTION 'No price_files row with is_current = true';
  END IF;

  INSERT INTO public.price_rules
    (id, name, rule_family, level, group_name, condition, quantity, value,
     output_unit, sort_order, is_active, price_file_id)
    -- (reviewer, 15 Oct: output_unit is NOT NULL with no default — 'minutes', as the other Doors fitting rules)
  VALUES
    ('bb030001-0000-4000-8000-000000000001',
     'Front Door Pair Additional Door', 'install_labour', 'item', 'Doors',
     'is_front_door and is_complete_new and is_installation_included and new_french_door_pair_qty >= 1',
     'new_french_door_pair_qty', '120', 'minutes', 3, TRUE, _price_file)
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        rule_family = EXCLUDED.rule_family,
        level = EXCLUDED.level,
        group_name = EXCLUDED.group_name,
        condition = EXCLUDED.condition,
        quantity = EXCLUDED.quantity,
        value = EXCLUDED.value,
        output_unit = EXCLUDED.output_unit,
        sort_order = EXCLUDED.sort_order,
        is_active = TRUE,
        price_file_id = EXCLUDED.price_file_id;
  RAISE NOTICE 'Step BH-3: the second leaf of a pair is fitted (price file %)', _price_file;
END $$;

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. The five rules, now naming the SLAVE.
SELECT id, label, condition, product_short_name, finish_code, is_active
FROM   public.part_allocation_rules
WHERE  rule_family = 'default_ironmongery'
  AND  (id::text LIKE 'b5c2d45a%' OR id::text LIKE '501f9ca5%'
     OR id::text LIKE 'e938fc5a%' OR id::text LIKE 'd23e8262%'
     OR id::text LIKE 'cb8eb0b9%')
ORDER  BY sort_order, label;

-- 2. The mpls_doors rules are untouched: the slave's bolts and keeps still
--    fire, and the master's Thunderbolt still stands down on a front door
--    (sql/step-bh1).
SELECT id, label, condition
FROM   public.part_allocation_rules
WHERE  group_name = 'mpls_doors'
  AND  condition ILIKE '%french_pair%'
ORDER  BY label;

-- 3. The new fitting rule, in the Doors group at sort_order 3, on the live
--    price file.
SELECT r.id, r.name, r.condition, r.quantity, r.value, r.sort_order, r.is_active
FROM   public.price_rules r
JOIN   public.price_files f ON f.id = r.price_file_id AND f.is_current
WHERE  r.rule_family = 'install_labour' AND r.group_name = 'Doors'
ORDER  BY r.sort_order;

-- 4. On the drawings (L507712 item 9), re-price:
--      54  Pair Of Front Doors  6,642.89 -> 6,803.73, and its ironmongery
--          list should name av3_heritage_locking_system_RH where it named _lh
--      55  Front Door With Side Lights And Fanlight   9,173.93, unchanged
--      56  ... Fanlight Over Door                     8,936.47, unchanged
--          (after the Step BH follow-up code deploy — it read 7,095.53 before)
--      57  Stable Door With Fanlight                  5,911.17, unchanged
--      58  Stable Door With Side Light                6,787.00 after
--          sql/step-bh4, 6,785.57 before it
--      and FT1-FT4 on /dev/pricing-benchmark must not move at all.


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- BEGIN;
-- UPDATE public.part_allocation_rules
-- SET    condition = replace(condition,
--          'not is_slave_leaf_in_french_pair',
--          'not is_master_leaf_in_french_pair')
-- WHERE  rule_family = 'default_ironmongery'
--   AND  (id::text LIKE 'b5c2d45a%' OR id::text LIKE '501f9ca5%'
--      OR id::text LIKE 'e938fc5a%' OR id::text LIKE 'd23e8262%'
--      OR id::text LIKE 'cb8eb0b9%');
--
-- DELETE FROM public.price_rules
-- WHERE id = 'bb030001-0000-4000-8000-000000000001';
-- COMMIT;
