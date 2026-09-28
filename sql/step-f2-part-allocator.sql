-- DO NOT RUN DIRECTLY — paste into Supabase SQL editor.
-- =============================================================================
-- step-f2-part-allocator.sql
-- Creates part_allocation_rules table and seeds all 125 rules from Integrate's
-- Part Allocator.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BUG FIXES FROM INTEGRATE SOURCE (documented here for traceability):
--
-- 1. Rule integrate_sort=75 (mpls_doors): the original condition had the range
--    inverted as "<= 2424 and >= 2565", which is always false.  Fixed to:
--    "gross_sash_height_in_mm >= 2424 and gross_sash_height_in_mm <= 2565".
--
-- 2. Steel-weight fallback rules (sash_weights, odd integrate_sorts 101, 106,
--    111, 116, 121, 126, 131, 136, 141, 146, 151, 156, 161, 166, 171, 176,
--    181, 186, 191, 201, 211): the original used strict "<" for the height
--    threshold, leaving sashes at the exact threshold value unmatched.
--    Changed to "<=" so every sash height is covered by exactly one rule per
--    lb band.
--
-- 3. Rules integrate_sort=40 and 41 (sash_weights, inactive kg-band rules):
--    the lower bound of the 20 lb band was written as "18.4" in Integrate but
--    should be "18.14" (the 19 lb band ends at 18.14 kg).  Fixed to
--    "weight_in_kg >= 18.14".  Rules remain inactive (is_active = false).
-- -----------------------------------------------------------------------------


-- =============================================================================
-- TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS part_allocation_rules (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order     integer NOT NULL,
  group_name     text    NOT NULL,
  loop_target    text,          -- null = item scope; values: 'sliding_sash', 'frame', 'door_leaf'
  label          text,
  condition      text    NOT NULL DEFAULT 'true',
  qty_expr       text    NOT NULL DEFAULT '1',
  part_code      text,
  measure_expr   text,
  level          text    NOT NULL DEFAULT 'item',
  is_active      boolean NOT NULL DEFAULT true,
  comment        text,
  integrate_sort integer
);

-- Unique constraint to make ON CONFLICT DO NOTHING idempotent on re-runs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'part_allocation_rules_sort_order_key'
  ) THEN
    ALTER TABLE part_allocation_rules ADD CONSTRAINT part_allocation_rules_sort_order_key UNIQUE (sort_order);
  END IF;
END $$;


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE part_allocation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read part_allocation_rules"  ON part_allocation_rules;
DROP POLICY IF EXISTS "Authenticated users can write part_allocation_rules" ON part_allocation_rules;

CREATE POLICY "Authenticated users can read part_allocation_rules"
  ON part_allocation_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can write part_allocation_rules"
  ON part_allocation_rules FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- SEED DATA
-- =============================================================================

-- -----------------------------------------------------------------------------
-- GROUP: sash_weights  (sort_order = integrate_sort, range 10–301)
-- -----------------------------------------------------------------------------

-- Active replacement rules (sorts 10–11)
INSERT INTO part_allocation_rules
  (sort_order, group_name, loop_target, label, condition, qty_expr, part_code, measure_expr, level, is_active, integrate_sort)
VALUES
  (10, 'sash_weights', 'sliding_sash', 'Sash Replacement',
   'to_be_replaced and sash_thickness >= 40 and is_cord_hung and not frame_to_be_replaced',
   '2', 'LW100005', '(weight_in_kg) / 2', 'item', true, 10),

  (11, 'sash_weights', 'sliding_sash', 'Sash Replacement',
   'to_be_replaced and sash_thickness < 40 and is_cord_hung and not frame_to_be_replaced',
   '2', 'LW100010', '(weight_in_kg) / 2', 'item', true, 11)

ON CONFLICT (sort_order) DO NOTHING;


-- Inactive kg-band frame-replacement rules (sorts 20–51)
-- Bug fix #3: sorts 40 and 41 use 18.14 instead of Integrate's 18.4
INSERT INTO part_allocation_rules
  (sort_order, group_name, loop_target, label, condition, qty_expr, part_code, measure_expr, level, is_active, integrate_sort)
VALUES
  (20, 'sash_weights', 'sliding_sash', NULL,
   'to_be_replaced and frame_to_be_replaced and is_cord_hung and weight_in_lb < 14',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', false, 20),

  (25, 'sash_weights', 'sliding_sash', NULL,
   'frame_to_be_replaced and is_cord_hung and weight_in_kg >= 6.34 and weight_in_kg < 9.06',
   '2', 'SW100010', '3.17', 'item', false, 25),

  (26, 'sash_weights', 'sliding_sash', NULL,
   'frame_to_be_replaced and is_cord_hung and weight_in_kg >= 6.34 and weight_in_kg < 9.06',
   '2', 'LW100005', '(weight_in_kg - 6.34) / 2', 'item', false, 26),

  (30, 'sash_weights', 'sliding_sash', NULL,
   'frame_to_be_replaced and is_cord_hung and weight_in_kg >= 9.06 and weight_in_kg < 13.6',
   '2', 'SW100005', '4.53', 'item', false, 30),

  (31, 'sash_weights', 'sliding_sash', NULL,
   'frame_to_be_replaced and is_cord_hung and weight_in_kg >= 9.06 and weight_in_kg < 13.6',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', false, 31),

  (35, 'sash_weights', 'sliding_sash', NULL,
   'frame_to_be_replaced and is_cord_hung and weight_in_kg >= 13.6 and weight_in_kg < 18.14',
   '2', 'SW100015', '6.8', 'item', false, 35),

  (36, 'sash_weights', 'sliding_sash', NULL,
   'frame_to_be_replaced and is_cord_hung and weight_in_kg >= 13.6 and weight_in_kg < 18.14',
   '2', 'LW100005', '(weight_in_kg - 13.6) / 2', 'item', false, 36),

  -- Bug fix #3: was 18.4, corrected to 18.14
  (40, 'sash_weights', 'sliding_sash', NULL,
   'frame_to_be_replaced and is_cord_hung and weight_in_kg >= 18.14 and weight_in_kg < 22.68',
   '2', 'SW100020', '9.07', 'item', false, 40),

  (41, 'sash_weights', 'sliding_sash', NULL,
   'frame_to_be_replaced and is_cord_hung and weight_in_kg >= 18.14 and weight_in_kg < 22.68',
   '2', 'LW100005', '(weight_in_kg - 18.14) / 2', 'item', false, 41),

  (45, 'sash_weights', 'sliding_sash', NULL,
   'frame_to_be_replaced and is_cord_hung and weight_in_kg >= 22.68 and weight_in_kg < 27.22',
   '2', 'SW100025', '11.34', 'item', false, 45),

  (46, 'sash_weights', 'sliding_sash', NULL,
   'frame_to_be_replaced and is_cord_hung and weight_in_kg >= 22.68 and weight_in_kg < 27.22',
   '2', 'LW100005', '(weight_in_kg - 11.34) / 2', 'item', false, 46),

  (50, 'sash_weights', 'sliding_sash', NULL,
   'frame_to_be_replaced and is_cord_hung and weight_in_kg >= 27.22',
   '2', 'SW100030', '13.61', 'item', false, 50),

  (51, 'sash_weights', 'sliding_sash', NULL,
   'frame_to_be_replaced and is_cord_hung and weight_in_kg >= 27.22',
   '2', 'LW100005', '(weight_in_kg - 13.61) / 2', 'item', false, 51)

ON CONFLICT (sort_order) DO NOTHING;


-- Active per-lb steel-weight rules (sorts 100–211)
-- Each lb band: even sort = main rule (steel bar, height > threshold);
--               odd sort  = fallback (lead, height <= threshold)  [Bug fix #2: <= not <]
INSERT INTO part_allocation_rules
  (sort_order, group_name, loop_target, label, condition, qty_expr, part_code, measure_expr, level, is_active, integrate_sort)
VALUES
  -- 7 lb  (6.35 ≤ kg < 7.26)
  (100, 'sash_weights', 'sliding_sash', '7lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 6.35 and weight_in_kg < 7.26 and sash_height_in_mm > 210',
   '2', 'RLZ2092', '3.2', 'item', true, 100),
  (101, 'sash_weights', 'sliding_sash', '7lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 6.35 and weight_in_kg < 7.26 and sash_height_in_mm <= 210',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 101),

  -- 8 lb  (7.26 ≤ kg < 8.16)
  (105, 'sash_weights', 'sliding_sash', '8lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 7.26 and weight_in_kg < 8.16 and sash_height_in_mm > 240',
   '2', 'RLZ2093', '3.6', 'item', true, 105),
  (106, 'sash_weights', 'sliding_sash', '8lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 7.26 and weight_in_kg < 8.16 and sash_height_in_mm <= 240',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 106),

  -- 9 lb  (8.16 ≤ kg < 9.07)
  (110, 'sash_weights', 'sliding_sash', '9lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 8.16 and weight_in_kg < 9.07 and sash_height_in_mm > 270',
   '2', 'RLZ1915', '4.1', 'item', true, 110),
  (111, 'sash_weights', 'sliding_sash', '9lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 8.16 and weight_in_kg < 9.07 and sash_height_in_mm <= 270',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 111),

  -- 10 lb  (9.07 ≤ kg < 9.98)
  (115, 'sash_weights', 'sliding_sash', '10lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 9.07 and weight_in_kg < 9.98 and sash_height_in_mm > 300',
   '2', 'RLZ1916', '4.5', 'item', true, 115),
  (116, 'sash_weights', 'sliding_sash', '10lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 9.07 and weight_in_kg < 9.98 and sash_height_in_mm <= 300',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 116),

  -- 11 lb  (9.98 ≤ kg < 10.89)
  (120, 'sash_weights', 'sliding_sash', '11lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 9.98 and weight_in_kg < 10.89 and sash_height_in_mm > 330',
   '2', 'RLZ1917', '5', 'item', true, 120),
  (121, 'sash_weights', 'sliding_sash', '11lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 9.98 and weight_in_kg < 10.89 and sash_height_in_mm <= 330',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 121),

  -- 12 lb  (10.89 ≤ kg < 11.79)
  (125, 'sash_weights', 'sliding_sash', '12lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 10.89 and weight_in_kg < 11.79 and sash_height_in_mm > 360',
   '2', 'RLZ1918', '5.4', 'item', true, 125),
  (126, 'sash_weights', 'sliding_sash', '12lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 10.89 and weight_in_kg < 11.79 and sash_height_in_mm <= 360',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 126),

  -- 13 lb  (11.79 ≤ kg < 12.70)
  (130, 'sash_weights', 'sliding_sash', '13lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 11.79 and weight_in_kg < 12.70 and sash_height_in_mm > 390',
   '2', 'RLZ1919', '5.9', 'item', true, 130),
  (131, 'sash_weights', 'sliding_sash', '13lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 11.79 and weight_in_kg < 12.70 and sash_height_in_mm <= 390',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 131),

  -- 14 lb  (12.7 ≤ kg < 13.61)
  (135, 'sash_weights', 'sliding_sash', '14lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 12.7 and weight_in_kg < 13.61 and sash_height_in_mm > 420',
   '2', 'RLZ1920', '6.4', 'item', true, 135),
  (136, 'sash_weights', 'sliding_sash', '14lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 12.7 and weight_in_kg < 13.61 and sash_height_in_mm <= 420',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 136),

  -- 15 lb  (13.61 ≤ kg < 14.51)
  (140, 'sash_weights', 'sliding_sash', '15lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 13.61 and weight_in_kg < 14.51 and sash_height_in_mm > 450',
   '2', 'RLZ1921', '6.8', 'item', true, 140),
  (141, 'sash_weights', 'sliding_sash', '15lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 13.61 and weight_in_kg < 14.51 and sash_height_in_mm <= 450',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 141),

  -- 16 lb  (14.51 ≤ kg < 15.42)
  (145, 'sash_weights', 'sliding_sash', '16lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 14.51 and weight_in_kg < 15.42 and sash_height_in_mm > 480',
   '2', 'RLZ1922', '7.3', 'item', true, 145),
  (146, 'sash_weights', 'sliding_sash', '16lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 14.51 and weight_in_kg < 15.42 and sash_height_in_mm <= 480',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 146),

  -- 17 lb  (15.42 ≤ kg < 16.33)
  (150, 'sash_weights', 'sliding_sash', '17lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 15.42 and weight_in_kg < 16.33 and sash_height_in_mm > 510',
   '2', 'RLZ1923', '7.7', 'item', true, 150),
  (151, 'sash_weights', 'sliding_sash', '17lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 15.42 and weight_in_kg < 16.33 and sash_height_in_mm <= 510',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 151),

  -- 18 lb  (16.33 ≤ kg < 17.24)
  (155, 'sash_weights', 'sliding_sash', '18lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 16.33 and weight_in_kg < 17.24 and sash_height_in_mm > 540',
   '2', 'RLZ1924', '8.2', 'item', true, 155),
  (156, 'sash_weights', 'sliding_sash', '18lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 16.33 and weight_in_kg < 17.24 and sash_height_in_mm <= 540',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 156),

  -- 19 lb  (17.24 ≤ kg < 18.14)
  (160, 'sash_weights', 'sliding_sash', '19lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 17.24 and weight_in_kg < 18.14 and sash_height_in_mm > 570',
   '2', 'RLZ1925', '8.6', 'item', true, 160),
  (161, 'sash_weights', 'sliding_sash', '19lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 17.24 and weight_in_kg < 18.14 and sash_height_in_mm <= 570',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 161),

  -- 20 lb  (18.14 ≤ kg < 19.05)
  (165, 'sash_weights', 'sliding_sash', '20lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 18.14 and weight_in_kg < 19.05 and sash_height_in_mm > 600',
   '2', 'RLZ1926', '9.1', 'item', true, 165),
  (166, 'sash_weights', 'sliding_sash', '20lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 18.14 and weight_in_kg < 19.05 and sash_height_in_mm <= 600',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 166),

  -- 21 lb  (19.05 ≤ kg < 19.96)
  (170, 'sash_weights', 'sliding_sash', '21lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 19.05 and weight_in_kg < 19.96 and sash_height_in_mm > 630',
   '2', 'RLZ1927', '9.5', 'item', true, 170),
  (171, 'sash_weights', 'sliding_sash', '21lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 19.05 and weight_in_kg < 19.96 and sash_height_in_mm <= 630',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 171),

  -- 22 lb  (19.96 ≤ kg < 20.87)
  (175, 'sash_weights', 'sliding_sash', '22lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 19.96 and weight_in_kg < 20.87 and sash_height_in_mm > 660',
   '2', 'RLZ1928', '10', 'item', true, 175),
  (176, 'sash_weights', 'sliding_sash', '22lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 19.96 and weight_in_kg < 20.87 and sash_height_in_mm <= 660',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 176),

  -- 23 lb  (20.87 ≤ kg < 21.77)
  (180, 'sash_weights', 'sliding_sash', '23lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 20.87 and weight_in_kg < 21.77 and sash_height_in_mm > 690',
   '2', 'RLZ1929', '10.4', 'item', true, 180),
  (181, 'sash_weights', 'sliding_sash', '23lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 20.87 and weight_in_kg < 21.77 and sash_height_in_mm <= 690',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 181),

  -- 24 lb  (21.77 ≤ kg < 22.68)
  (185, 'sash_weights', 'sliding_sash', '24lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 21.77 and weight_in_kg < 22.68 and sash_height_in_mm > 720',
   '2', 'RLZ1930', '10.9', 'item', true, 185),
  (186, 'sash_weights', 'sliding_sash', '24lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 21.77 and weight_in_kg < 22.68 and sash_height_in_mm <= 720',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 186),

  -- 25 lb  (22.68 ≤ kg < 23.59)
  (190, 'sash_weights', 'sliding_sash', '25lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 22.68 and weight_in_kg < 23.59 and sash_height_in_mm > 750',
   '2', 'RLZ2810', '11.3', 'item', true, 190),
  (191, 'sash_weights', 'sliding_sash', '25lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 22.68 and weight_in_kg < 23.59 and sash_height_in_mm <= 750',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 191),

  -- 26 lb  (23.59 ≤ kg < 27.22)
  (200, 'sash_weights', 'sliding_sash', '26lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 23.59 and weight_in_kg < 27.22 and sash_height_in_mm > 780',
   '2', 'RLZ2094', '11.8', 'item', true, 200),
  (201, 'sash_weights', 'sliding_sash', '26lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 23.59 and weight_in_kg < 27.22 and sash_height_in_mm <= 780',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 201),

  -- 30 lb  (kg >= 27.22)
  (210, 'sash_weights', 'sliding_sash', '30lb steel',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 27.22 and sash_height_in_mm > 900',
   '2', 'RLZ1941', '13.6', 'item', true, 210),
  (211, 'sash_weights', 'sliding_sash', '30lb fallback',
   'to_be_replaced and is_cord_hung and weight_in_kg >= 27.22 and sash_height_in_mm <= 900',
   '2', 'LW100005', 'weight_in_kg / 2', 'item', true, 211)

ON CONFLICT (sort_order) DO NOTHING;


-- Chain-hung rules (sorts 300–301)
INSERT INTO part_allocation_rules
  (sort_order, group_name, loop_target, label, condition, qty_expr, part_code, measure_expr, level, is_active, integrate_sort)
VALUES
  (300, 'sash_weights', 'sliding_sash', 'Chain hung weight',
   'is_chain_hung and to_be_replaced',
   '2', 'MIGHTON-WC', NULL, 'item', true, 300),

  (301, 'sash_weights', 'sliding_sash', 'Chain hung connector',
   'is_chain_hung and to_be_replaced',
   '2', 'SCON', NULL, 'item', true, 301)

ON CONFLICT (sort_order) DO NOTHING;


-- -----------------------------------------------------------------------------
-- GROUP: sash_windows  (sort_order = 1000 + integrate_sort)
-- -----------------------------------------------------------------------------

INSERT INTO part_allocation_rules
  (sort_order, group_name, loop_target, label, condition, qty_expr, part_code, measure_expr, level, is_active, integrate_sort)
VALUES
  (1000, 'sash_windows', 'sliding_sash', 'Small staff bead – width',
   'is_small_staff_bead and not frame_to_be_replaced',
   'interior_qty', 'TP01', 'round_up_to_nearest(profiled_frame_interior_width_in_mm, 100) + 100',
   'item', true, 0),

  (1001, 'sash_windows', 'sliding_sash', 'Small staff bead – height',
   'is_small_staff_bead and not frame_to_be_replaced',
   '1', 'TP01', 'round_up_to_nearest(profiled_frame_interior_height_in_mm, 100) + 100',
   'item', true, 1),

  (1002, 'sash_windows', 'sliding_sash', 'Large staff bead – width',
   'is_large_staff_bead and not frame_to_be_replaced',
   'interior_qty', 'TP02', 'round_up_to_nearest(profiled_frame_interior_width_in_mm, 100) + 100',
   'item', true, 2),

  (1003, 'sash_windows', 'sliding_sash', 'Large staff bead – height',
   'is_large_staff_bead and not frame_to_be_replaced',
   '2', 'TP02', 'round_up_to_nearest(profiled_frame_interior_height_in_mm, 100) + 100',
   'item', true, 3),

  (1004, 'sash_windows', 'sliding_sash', 'Parting bead – height',
   'not frame_to_be_replaced',
   'interior_qty', 'TP03', 'round_up_to_nearest(profiled_frame_interior_height_in_mm, 100) + 100',
   'item', true, 4),

  (1005, 'sash_windows', 'sliding_sash', 'Parting bead – width',
   'not frame_to_be_replaced',
   '0.5', 'TP03', 'round_up_to_nearest(profiled_frame_interior_width_in_mm, 100) + 100',
   'item', true, 4),

  (1007, 'sash_windows', NULL, 'New cill',
   'new_cill_qty >= 1',
   '1', 'AA02', '(new_cill_length * 1000) + 250',
   'item', false, 7)

ON CONFLICT (sort_order) DO NOTHING;


-- -----------------------------------------------------------------------------
-- GROUP: mpls_doors  (sort_order = 2000 + integrate_sort, loop=door_leaf unless noted)
-- -----------------------------------------------------------------------------

-- Bug fix #1: rule integrate_sort=75 condition corrected (was <= 2424 and >= 2565)
INSERT INTO part_allocation_rules
  (sort_order, group_name, loop_target, label, condition, qty_expr, part_code, measure_expr, level, is_active, integrate_sort)
VALUES
  (2000, 'mpls_doors', 'door_leaf', 'Slave LH ≥ 2565 top bolt',
   'is_slave_leaf_in_french_pair and is_left_hand_hung_viewed_internally and gross_sash_height_in_mm >= 2565 and gross_sash_height_in_mm <= 2923',
   '1', 'RHZ1651', NULL, 'item', true, 0),

  (2010, 'mpls_doors', 'door_leaf', 'MPLS master or tall – shootbolt',
   'is_door_mpls and gross_sash_height_in_mm > 1853 and is_master_leaf_in_french_pair',
   '1', 'RJZ2382', NULL, 'item', true, 10),

  (2020, 'mpls_doors', 'door_leaf', 'MPLS non-front non-french – shootbolt',
   'is_door_mpls and not is_front_door and not is_french_door_leaf',
   '1', 'RJZ2382', NULL, 'item', true, 20),

  (2030, 'mpls_doors', 'door_leaf', 'Slave LH 1853–2565 opening out',
   'is_slave_leaf_in_french_pair and is_left_hand_hung_viewed_internally and gross_sash_height_in_mm >= 1853 and gross_sash_height_in_mm <= 2565 and is_opening_out',
   '1', 'RHZ1648', NULL, 'item', true, 30),

  (2035, 'mpls_doors', 'door_leaf', 'Slave RH 1853–2565 opening in',
   'is_slave_leaf_in_french_pair and is_right_hand_hung_viewed_internally and gross_sash_height_in_mm >= 1853 and gross_sash_height_in_mm <= 2565 and is_opening_in',
   '1', 'RHZ1648', NULL, 'item', true, 35),

  (2040, 'mpls_doors', 'door_leaf', 'Slave RH 1853–2565 opening out',
   'is_slave_leaf_in_french_pair and is_right_hand_hung_viewed_internally and gross_sash_height_in_mm >= 1853 and gross_sash_height_in_mm <= 2565 and is_opening_out',
   '1', 'RHZ1649', NULL, 'item', true, 40),

  (2045, 'mpls_doors', 'door_leaf', 'Slave LH 1853–2565 opening in',
   'is_slave_leaf_in_french_pair and is_left_hand_hung_viewed_internally and gross_sash_height_in_mm >= 1853 and gross_sash_height_in_mm <= 2565 and is_opening_in',
   '1', 'RHZ1649', NULL, 'item', true, 45),

  (2050, 'mpls_doors', 'door_leaf', 'Slave RH ≥ 2565 top bolt',
   'is_slave_leaf_in_french_pair and is_right_hand_hung_viewed_internally and gross_sash_height_in_mm >= 2565 and gross_sash_height_in_mm <= 2923',
   '1', 'RHZ1650', NULL, 'item', true, 50),

  (2055, 'mpls_doors', 'door_leaf', 'Slave hinge keep 1853–1996',
   'is_slave_leaf_in_french_pair and gross_sash_height_in_mm >= 1853 and gross_sash_height_in_mm <= 1996',
   '1', 'RHZ1652', NULL, 'item', true, 55),

  (2060, 'mpls_doors', 'door_leaf', 'Slave hinge keep 1997–2139',
   'is_slave_leaf_in_french_pair and gross_sash_height_in_mm >= 1997 and gross_sash_height_in_mm <= 2139',
   '1', 'RHZ1653', NULL, 'item', true, 60),

  (2065, 'mpls_doors', 'door_leaf', 'Slave hinge keep 2140–2281',
   'is_slave_leaf_in_french_pair and gross_sash_height_in_mm >= 2140 and gross_sash_height_in_mm <= 2281',
   '1', 'RHZ1654', NULL, 'item', true, 65),

  (2070, 'mpls_doors', 'door_leaf', 'Slave hinge keep 2282–2423',
   'is_slave_leaf_in_french_pair and gross_sash_height_in_mm >= 2282 and gross_sash_height_in_mm <= 2423',
   '1', 'RHZ2213', NULL, 'item', true, 70),

  -- Bug fix #1: original had inverted range (<= 2424 and >= 2565); corrected to >= 2424 and <= 2565
  (2075, 'mpls_doors', 'door_leaf', 'Slave hinge keep 2424–2565',
   'is_slave_leaf_in_french_pair and gross_sash_height_in_mm >= 2424 and gross_sash_height_in_mm <= 2565',
   '1', 'RHZ2214', NULL, 'item', true, 75),

  (2080, 'mpls_doors', 'door_leaf', 'Slave hinge keep 2566–2639',
   'is_slave_leaf_in_french_pair and gross_sash_height_in_mm >= 2566 and gross_sash_height_in_mm <= 2639',
   '1', 'RHZ1653', NULL, 'item', true, 80),

  (2085, 'mpls_doors', 'door_leaf', 'Slave hinge keep 2640–2781',
   'is_slave_leaf_in_french_pair and gross_sash_height_in_mm >= 2640 and gross_sash_height_in_mm <= 2781',
   '1', 'RHZ1654', NULL, 'item', true, 85),

  (2090, 'mpls_doors', 'door_leaf', 'Slave flush bolt',
   'is_slave_leaf_in_french_pair',
   '1', 'RHZ1667', NULL, 'item', true, 90),

  (2095, 'mpls_doors', 'door_leaf', 'Master LH short MPLS',
   'is_master_leaf_in_french_pair and is_left_hand_hung_viewed_internally and height > 1.52 and height < 1.853 and is_door_mpls',
   '1', 'WIN5002560', NULL, 'item', true, 95),

  (2100, 'mpls_doors', 'door_leaf', 'Master RH short MPLS',
   'is_master_leaf_in_french_pair and is_right_hand_hung_viewed_internally and height > 1.52 and height < 1.853 and is_door_mpls',
   '1', 'WIN5002439', NULL, 'item', true, 100),

  (2105, 'mpls_doors', NULL, 'Aluminium cill',
   'is_aluminium_cill and opening_in_door_leaf_qty >= 1',
   '1', 'RGE2105', NULL, 'item', true, 105),

  (2115, 'mpls_doors', 'door_leaf', 'MPLS non-front RH lock',
   'to_be_replaced and is_door_mpls and not is_front_door and is_right_hand_hung_viewed_internally and gross_sash_height_in_mm < 1853 and not is_folding_leaf and not is_stable_door_leaf and not is_french_door_leaf',
   '1', 'WIN5002560', NULL, 'item', true, 115),

  (2120, 'mpls_doors', 'door_leaf', 'MPLS non-front LH lock',
   'to_be_replaced and is_door_mpls and not is_front_door and is_left_hand_hung_viewed_internally and gross_sash_height_in_mm < 1853 and not is_folding_leaf and not is_stable_door_leaf and not is_french_door_leaf',
   '1', 'WIN5002439', NULL, 'item', true, 120)

ON CONFLICT (sort_order) DO NOTHING;


-- -----------------------------------------------------------------------------
-- GROUP: sliding_doors  (sort_order = 3000 + integrate_sort, all loop=null/item)
-- Note: two source rules have integrate_sort=81; first maps to 3081, second to 3082.
-- -----------------------------------------------------------------------------

INSERT INTO part_allocation_rules
  (sort_order, group_name, loop_target, label, condition, qty_expr, part_code, measure_expr, level, is_active, integrate_sort)
VALUES
  (3000, 'sliding_doors', NULL, 'Sliding door – track cover',
   'is_sliding_door_set',
   '1', 'MJZ2500', NULL, 'item', false, 0),

  (3010, 'sliding_doors', NULL, 'Sliding door – top track',
   'is_sliding_door_set',
   '1', 'MJZ2515', NULL, 'item', false, 10),

  (3020, 'sliding_doors', NULL, 'Sliding door – bottom track',
   'is_sliding_door_set',
   '1', 'MJZ2516', NULL, 'item', false, 20),

  (3030, 'sliding_doors', NULL, 'Sliding door – handle set',
   'is_sliding_door_set',
   '1', 'MJZ2523', NULL, 'item', false, 30),

  (3035, 'sliding_doors', NULL, 'Sliding door – keep',
   'is_sliding_door_set',
   '1', 'MJZ2524', NULL, 'item', false, 35),

  -- Width band ≤ 2.386 m
  (3040, 'sliding_doors', NULL, 'Sliding door ≤2.386 – frame A',
   'is_sliding_door_set and overall_sash_width <= 2.386',
   '1', 'MJZ2503', NULL, 'item', false, 40),

  (3041, 'sliding_doors', NULL, 'Sliding door ≤2.386 – roller A',
   'is_sliding_door_set and overall_sash_width <= 2.386',
   '1', 'MJZ2508', NULL, 'item', false, 41),

  (3042, 'sliding_doors', NULL, 'Sliding door ≤2.386 – roller B',
   'is_sliding_door_set and overall_sash_width <= 2.386',
   '1', 'MJZ2509', NULL, 'item', false, 42),

  (3043, 'sliding_doors', NULL, 'Sliding door ≤2.386 – sill',
   'is_sliding_door_set and overall_sash_width <= 2.386',
   '1', 'MJZ2517', NULL, 'item', false, 43),

  -- Width band 2.387–3.394 m
  (3050, 'sliding_doors', NULL, 'Sliding door 2.387–3.394 – frame B',
   'is_sliding_door_set and overall_sash_width >= 2.387 and overall_sash_width <= 3.394',
   '1', 'MJZ2504', NULL, 'item', false, 50),

  (3051, 'sliding_doors', NULL, 'Sliding door 2.387–3.394 – roller A ×2',
   'is_sliding_door_set and overall_sash_width >= 2.387 and overall_sash_width <= 3.394',
   '2', 'MJZ2508', NULL, 'item', false, 51),

  (3052, 'sliding_doors', NULL, 'Sliding door 2.387–3.394 – roller C',
   'is_sliding_door_set and overall_sash_width >= 2.387 and overall_sash_width <= 3.394',
   '1', 'MJZ2510', NULL, 'item', false, 52),

  (3053, 'sliding_doors', NULL, 'Sliding door 2.387–3.394 – sill',
   'is_sliding_door_set and overall_sash_width >= 2.387 and overall_sash_width <= 3.394',
   '1', 'MJZ2517', NULL, 'item', false, 53),

  -- Width band 3.395–4.402 m
  (3060, 'sliding_doors', NULL, 'Sliding door 3.395–4.402 – frame C',
   'is_sliding_door_set and overall_sash_width >= 3.395 and overall_sash_width <= 4.402',
   '1', 'MJZ2505', NULL, 'item', false, 60),

  (3061, 'sliding_doors', NULL, 'Sliding door 3.395–4.402 – roller A ×3',
   'is_sliding_door_set and overall_sash_width >= 3.395 and overall_sash_width <= 4.402',
   '3', 'MJZ2508', NULL, 'item', false, 61),

  (3062, 'sliding_doors', NULL, 'Sliding door 3.395–4.402 – roller D',
   'is_sliding_door_set and overall_sash_width >= 3.395 and overall_sash_width <= 4.402',
   '1', 'MJZ2511', NULL, 'item', false, 62),

  (3063, 'sliding_doors', NULL, 'Sliding door 3.395–4.402 – sill',
   'is_sliding_door_set and overall_sash_width >= 3.395 and overall_sash_width <= 4.402',
   '1', 'MJZ2518', NULL, 'item', false, 63),

  -- Active rules
  (3070, 'sliding_doors', NULL, 'Sliding door – lock body',
   'is_sliding_door_set',
   '1', 'MJZ2585', NULL, 'item', true, 70),

  (3071, 'sliding_doors', NULL, 'Sliding door – lock pins',
   'is_sliding_door_set',
   '7', 'MJZ2586', NULL, 'item', true, 71),

  -- Height bands (integrate_sort 80/81/81 → sort_order 3080/3081/3082)
  (3080, 'sliding_doors', NULL, 'Sliding door height < 2.1 – bracket ×2',
   'is_sliding_door_set and overall_sash_height < 2.100',
   '2', 'MJZ2532', NULL, 'item', false, 80),

  (3081, 'sliding_doors', NULL, 'Sliding door height > 2.1 – bracket ×3',
   'is_sliding_door_set and overall_sash_height > 2.100',
   '3', 'MJZ2532', NULL, 'item', false, 81),

  -- Second rule with integrate_sort=81; mapped to sort_order 3082
  (3082, 'sliding_doors', NULL, 'Sliding door – bracket cap',
   'is_sliding_door_set',
   '1', 'MJZ2533', NULL, 'item', false, 81),

  -- Height-banded glass guide rules
  (3090, 'sliding_doors', NULL, 'Sliding door height 0.745–1.3 – guide',
   'is_sliding_door_set and overall_sash_height > 0.745 and overall_sash_height < 1.3',
   '1', 'MJZ2525', NULL, 'item', false, 90),

  (3091, 'sliding_doors', NULL, 'Sliding door height 1.3–1.7 – guide',
   'is_sliding_door_set and overall_sash_height > 1.3 and overall_sash_height < 1.7',
   '1', 'MJZ2526', NULL, 'item', false, 91),

  (3092, 'sliding_doors', NULL, 'Sliding door height 1.7–2.1 – guide',
   'is_sliding_door_set and overall_sash_height > 1.7 and overall_sash_height < 2.1',
   '1', 'MJZ2527', NULL, 'item', false, 92),

  (3093, 'sliding_doors', NULL, 'Sliding door height 2.1–2.5 – guide',
   'is_sliding_door_set and overall_sash_height > 2.1 and overall_sash_height < 2.5',
   '1', 'MJZ2528', NULL, 'item', false, 93),

  (3094, 'sliding_doors', NULL, 'Sliding door height 2.5–2.8 – guide',
   'is_sliding_door_set and overall_sash_height > 2.5 and overall_sash_height < 2.8',
   '1', 'MJZ2529', NULL, 'item', false, 94),

  (3095, 'sliding_doors', NULL, 'Sliding door height 2.8–3.3 – guide',
   'is_sliding_door_set and overall_sash_height > 2.8 and overall_sash_height < 3.3',
   '1', 'MJZ2530', NULL, 'item', false, 95)

ON CONFLICT (sort_order) DO NOTHING;


-- -----------------------------------------------------------------------------
-- GROUP: surrounds  (sort_order = 4000 + integrate_sort)
-- -----------------------------------------------------------------------------

INSERT INTO part_allocation_rules
  (sort_order, group_name, loop_target, label, condition, qty_expr, part_code, measure_expr, level, is_active, integrate_sort)
VALUES
  (4000, 'surrounds', 'frame', 'Surround timber – height',
   'to_be_replaced and not is_installation_level_test_1',
   '2', 'TP68', '(1000 * height) + 100', 'item', true, 0),

  (4001, 'surrounds', 'frame', 'Surround timber – width',
   'to_be_replaced and not is_installation_level_test_1',
   '1', 'TP68', '(1000 * width) + 100', 'item', true, 1),

  (4010, 'surrounds', 'frame', 'Surround head board',
   'to_be_replaced and door_leaf_qty == 0 and not is_installation_level_test_1',
   '1', 'TP61', '(1000 * width) + 150', 'item', false, 10),

  (4020, 'surrounds', NULL, 'Architrave bullnose & packer',
   'is_architrave_bullnose_and_packer_component_default and frame_to_be_replaced and not is_installation_level_test_1',
   '1', 'AA01', '1', 'item', true, 20),

  (4030, 'surrounds', NULL, 'Architrave & window board',
   'is_architrave_and_w_board_component_default and frame_to_be_replaced and not is_installation_level_test_1',
   '1', 'AA02', '1', 'item', true, 30),

  (4040, 'surrounds', NULL, 'Architrave lining & w-board (AA01)',
   'is_architrave_lining_and_w_board_component_default and frame_to_be_replaced and not is_installation_level_test_1',
   '1', 'AA01', '1', 'item', true, 40),

  (4050, 'surrounds', NULL, 'Architrave lining & w-board (AA02)',
   'is_architrave_lining_and_w_board_component_default and frame_to_be_replaced and not is_installation_level_test_1',
   '1', 'AA02', '1', 'item', true, 50),

  (4060, 'surrounds', NULL, 'External linings (AA01)',
   'is_external_linings_component_default and frame_to_be_replaced and not is_installation_level_test_1',
   '1', 'AA01', '1', 'item', true, 60),

  (4070, 'surrounds', NULL, 'External linings (AA02)',
   'is_external_linings_component_default and frame_to_be_replaced and not is_installation_level_test_1',
   '1', 'AA02', '1', 'item', true, 70),

  (4080, 'surrounds', NULL, 'External linings (AA03)',
   'is_external_linings_component_default and frame_to_be_replaced and not is_installation_level_test_1',
   '1', 'AA03', '1', 'item', true, 80)

ON CONFLICT (sort_order) DO NOTHING;


-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT
  group_name,
  is_active,
  count(*) AS rule_count
FROM part_allocation_rules
GROUP BY group_name, is_active
ORDER BY group_name, is_active DESC;
