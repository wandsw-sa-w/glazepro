-- ============================================================================
-- Step J1 — Parts & data model
--   mullionPart, transomPart, verticalGlazingBarPart, horizontalGlazingBarPart
--   field definitions; arch properties on existing sash/glass parts; sash split
--   and horn type options; tree migration: bar counts → real bar parts.
--
-- DO NOT RUN — paste into Supabase SQL editor.
--
-- Safe to re-run: ON CONFLICT DO NOTHING on all INSERTs.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1 — Reference categories (new)
-- ============================================================================

INSERT INTO reference_categories (category, label, group_name, is_multi, has_quantity, sort_order)
VALUES
  ('tail_link_type',  'Glazing - Bar Tail Link Type', 'Glazing', false, false, 410),
  ('transom_shape',   'Joinery - Transom Shape',      'Joinery', false, false, 420)
ON CONFLICT (category) DO NOTHING;

-- ============================================================================
-- SECTION 2 — Reference options
-- ============================================================================

-- ---- horn_type (category created by step-a migrations; ensure all options exist)

INSERT INTO reference_options (category, code, label, sort_order, is_active)
VALUES
  ('horn_type', 'no_horn',  'No Horn',   10, true),
  ('horn_type', 'victorian','Victorian',  20, true),
  ('horn_type', 'custom',   'Custom',     30, true)
ON CONFLICT (category, code) DO NOTHING;

-- ---- tail_link_type

INSERT INTO reference_options (category, code, label, sort_order, is_active)
VALUES
  ('tail_link_type', '1', 'Standard',     10, true),
  ('tail_link_type', '2', 'Mitre',        20, true),
  ('tail_link_type', '3', 'Square End',   30, true)
ON CONFLICT (category, code) DO NOTHING;

-- ---- transom_shape

INSERT INTO reference_options (category, code, label, sort_order, is_active)
VALUES
  ('transom_shape', '',          'None',       10, true),
  ('transom_shape', 'chamfered', 'Chamfered',  20, true),
  ('transom_shape', 'stepped',   'Stepped',    30, true),
  ('transom_shape', 'ogee',      'Ogee',       40, false)
ON CONFLICT (category, code) DO NOTHING;

-- ============================================================================
-- SECTION 3 — Field definitions: mullionPart (10 fields, sort 2200–2209)
-- ============================================================================

INSERT INTO default_field_definitions
  (part_type, field_key, property_name, label, data_type, visibility,
   sort_order, is_active, group_name, unit, role, reference_category,
   part_category, is_required)
VALUES
  ('mullionPart', 'mullionPart.offset',
   'offset', 'Offset', 'number', 'visible',
   2200, TRUE, 'mullionPart', 'mm', 'input', NULL, NULL, FALSE),

  ('mullionPart', 'mullionPart.offset2',
   'offset2', 'Offset 2', 'number', 'visible',
   2201, TRUE, 'mullionPart', 'mm', 'input', NULL, NULL, FALSE),

  ('mullionPart', 'mullionPart.mullionStopSize',
   'mullionStopSize', 'Mullion Stop Size', 'number', 'visible',
   2202, TRUE, 'mullionPart', 'mm', 'input', NULL, NULL, FALSE),

  ('mullionPart', 'mullionPart.thicknessInFrameSolid',
   'thicknessInFrameSolid', 'Thickness in Frame (Solid)', 'number', 'visible',
   2203, TRUE, 'mullionPart', 'mm', 'input', NULL, NULL, FALSE),

  ('mullionPart', 'mullionPart.thicknessInFrameHollow',
   'thicknessInFrameHollow', 'Thickness in Frame (Hollow)', 'number', 'visible',
   2204, TRUE, 'mullionPart', 'mm', 'input', NULL, NULL, FALSE),

  ('mullionPart', 'mullionPart.thicknessInFrameSolidFinished',
   'thicknessInFrameSolidFinished', 'Finished Thickness (Solid)', 'number', 'visible',
   2205, TRUE, 'mullionPart', 'mm', 'input', NULL, NULL, FALSE),

  ('mullionPart', 'mullionPart.thicknessInFrameHollowFinished',
   'thicknessInFrameHollowFinished', 'Finished Thickness (Hollow)', 'number', 'visible',
   2206, TRUE, 'mullionPart', 'mm', 'input', NULL, NULL, FALSE),

  ('mullionPart', 'mullionPart.thicknessInSash',
   'thicknessInSash', 'Thickness in Sash', 'number', 'visible',
   2207, TRUE, 'mullionPart', 'mm', 'input', NULL, NULL, FALSE),

  ('mullionPart', 'mullionPart.isHollowMullion',
   'isHollowMullion', 'Hollow Mullion', 'boolean', 'visible',
   2208, TRUE, 'mullionPart', NULL, 'input', NULL, NULL, FALSE),

  ('mullionPart', 'mullionPart.repair',
   'repair', 'Repair', 'text', 'visible',
   2209, TRUE, 'mullionPart', NULL, 'input', NULL, NULL, FALSE)

ON CONFLICT (field_key) DO NOTHING;

-- ============================================================================
-- SECTION 4 — Field definitions: transomPart (12 fields, sort 2210–2221)
-- ============================================================================

INSERT INTO default_field_definitions
  (part_type, field_key, property_name, label, data_type, visibility,
   sort_order, is_active, group_name, unit, role, reference_category,
   part_category, is_required)
VALUES
  ('transomPart', 'transomPart.offset',
   'offset', 'Offset', 'number', 'visible',
   2210, TRUE, 'transomPart', 'mm', 'input', NULL, NULL, FALSE),

  ('transomPart', 'transomPart.offset2',
   'offset2', 'Offset 2', 'number', 'visible',
   2211, TRUE, 'transomPart', 'mm', 'input', NULL, NULL, FALSE),

  ('transomPart', 'transomPart.transomStopSizeTop',
   'transomStopSizeTop', 'Top Stop Size', 'number', 'visible',
   2212, TRUE, 'transomPart', 'mm', 'input', NULL, NULL, FALSE),

  ('transomPart', 'transomPart.transomStopSizeBottom',
   'transomStopSizeBottom', 'Bottom Stop Size', 'number', 'visible',
   2213, TRUE, 'transomPart', 'mm', 'input', NULL, NULL, FALSE),

  ('transomPart', 'transomPart.topTransomShape',
   'topTransomShape', 'Top Transom Shape', 'reference', 'visible',
   2214, TRUE, 'transomPart', NULL, 'input', 'transom_shape', NULL, FALSE),

  ('transomPart', 'transomPart.bottomTransomShape',
   'bottomTransomShape', 'Bottom Transom Shape', 'reference', 'visible',
   2215, TRUE, 'transomPart', NULL, 'input', 'transom_shape', NULL, FALSE),

  ('transomPart', 'transomPart.thicknessInFrame',
   'thicknessInFrame', 'Thickness in Frame', 'number', 'visible',
   2216, TRUE, 'transomPart', 'mm', 'input', NULL, NULL, FALSE),

  ('transomPart', 'transomPart.thicknessInSash',
   'thicknessInSash', 'Thickness in Sash', 'number', 'visible',
   2217, TRUE, 'transomPart', 'mm', 'input', NULL, NULL, FALSE),

  ('transomPart', 'transomPart.thicknessInFrameFinished',
   'thicknessInFrameFinished', 'Finished Thickness', 'number', 'visible',
   2218, TRUE, 'transomPart', 'mm', 'input', NULL, NULL, FALSE),

  ('transomPart', 'transomPart.isMidrail',
   'isMidrail', 'Is Midrail', 'boolean', 'visible',
   2219, TRUE, 'transomPart', NULL, 'input', NULL, NULL, FALSE),

  ('transomPart', 'transomPart.hasDripRail',
   'hasDripRail', 'Drip Rail', 'boolean', 'visible',
   2220, TRUE, 'transomPart', NULL, 'input', NULL, NULL, FALSE),

  ('transomPart', 'transomPart.repair',
   'repair', 'Repair', 'text', 'visible',
   2221, TRUE, 'transomPart', NULL, 'input', NULL, NULL, FALSE)

ON CONFLICT (field_key) DO NOTHING;

-- ============================================================================
-- SECTION 5 — Field definitions: verticalGlazingBarPart (6, sort 2230–2235)
-- ============================================================================

INSERT INTO default_field_definitions
  (part_type, field_key, property_name, label, data_type, visibility,
   sort_order, is_active, group_name, unit, role, reference_category,
   part_category, is_required)
VALUES
  ('verticalGlazingBarPart', 'verticalGlazingBarPart.offset',
   'offset', 'Offset', 'number', 'visible',
   2230, TRUE, 'verticalGlazingBarPart', 'mm', 'input', NULL, NULL, FALSE),

  ('verticalGlazingBarPart', 'verticalGlazingBarPart.offset2',
   'offset2', 'Offset 2 (partial bar end)', 'number', 'visible',
   2231, TRUE, 'verticalGlazingBarPart', 'mm', 'input', NULL, NULL, FALSE),

  ('verticalGlazingBarPart', 'verticalGlazingBarPart.thickness',
   'thickness', 'Bar Thickness', 'number', 'visible',
   2232, TRUE, 'verticalGlazingBarPart', 'mm', 'input', NULL, NULL, FALSE),

  ('verticalGlazingBarPart', 'verticalGlazingBarPart.nib',
   'nib', 'Nib', 'number', 'visible',
   2233, TRUE, 'verticalGlazingBarPart', 'mm', 'input', NULL, NULL, FALSE),

  ('verticalGlazingBarPart', 'verticalGlazingBarPart.tail',
   'tail', 'Tail', 'number', 'visible',
   2234, TRUE, 'verticalGlazingBarPart', 'mm', 'input', NULL, NULL, FALSE),

  ('verticalGlazingBarPart', 'verticalGlazingBarPart.tailLinkType',
   'tailLinkType', 'Tail Link Type', 'reference', 'visible',
   2235, TRUE, 'verticalGlazingBarPart', NULL, 'input', 'tail_link_type', NULL, FALSE)

ON CONFLICT (field_key) DO NOTHING;

-- ============================================================================
-- SECTION 6 — Field definitions: horizontalGlazingBarPart (6, sort 2240–2245)
-- ============================================================================

INSERT INTO default_field_definitions
  (part_type, field_key, property_name, label, data_type, visibility,
   sort_order, is_active, group_name, unit, role, reference_category,
   part_category, is_required)
VALUES
  ('horizontalGlazingBarPart', 'horizontalGlazingBarPart.offset',
   'offset', 'Offset', 'number', 'visible',
   2240, TRUE, 'horizontalGlazingBarPart', 'mm', 'input', NULL, NULL, FALSE),

  ('horizontalGlazingBarPart', 'horizontalGlazingBarPart.offset2',
   'offset2', 'Offset 2 (partial bar end)', 'number', 'visible',
   2241, TRUE, 'horizontalGlazingBarPart', 'mm', 'input', NULL, NULL, FALSE),

  ('horizontalGlazingBarPart', 'horizontalGlazingBarPart.thickness',
   'thickness', 'Bar Thickness', 'number', 'visible',
   2242, TRUE, 'horizontalGlazingBarPart', 'mm', 'input', NULL, NULL, FALSE),

  ('horizontalGlazingBarPart', 'horizontalGlazingBarPart.nib',
   'nib', 'Nib', 'number', 'visible',
   2243, TRUE, 'horizontalGlazingBarPart', 'mm', 'input', NULL, NULL, FALSE),

  ('horizontalGlazingBarPart', 'horizontalGlazingBarPart.tail',
   'tail', 'Tail', 'number', 'visible',
   2244, TRUE, 'horizontalGlazingBarPart', 'mm', 'input', NULL, NULL, FALSE),

  ('horizontalGlazingBarPart', 'horizontalGlazingBarPart.tailLinkType',
   'tailLinkType', 'Tail Link Type', 'reference', 'visible',
   2245, TRUE, 'horizontalGlazingBarPart', NULL, 'input', 'tail_link_type', NULL, FALSE)

ON CONFLICT (field_key) DO NOTHING;

-- ============================================================================
-- SECTION 7 — Arch fields on topSashPart (sort 2250–2260)
--   archHead already exists (step-a2); add the linked geometry fields.
-- ============================================================================

INSERT INTO default_field_definitions
  (part_type, field_key, property_name, label, data_type, visibility,
   sort_order, is_active, group_name, unit, role, reference_category,
   part_category, is_required)
VALUES
  ('topSashPart', 'topSashPart.archHeight',
   'archHeight', 'Arch Height', 'number', 'visible',
   2250, TRUE, 'topSashPart', 'mm', 'input', NULL, NULL, FALSE),

  ('topSashPart', 'topSashPart.archRadius',
   'archRadius', 'Arch Radius', 'number', 'visible',
   2251, TRUE, 'topSashPart', 'mm', 'derived', NULL, NULL, FALSE),

  ('topSashPart', 'topSashPart.shoulderHeight',
   'shoulderHeight', 'Shoulder Height', 'number', 'visible',
   2252, TRUE, 'topSashPart', 'mm', 'derived', NULL, NULL, FALSE),

  ('topSashPart', 'topSashPart.halfCircle',
   'halfCircle', 'Half Circle', 'boolean', 'visible',
   2253, TRUE, 'topSashPart', NULL, 'input', NULL, NULL, FALSE),

  ('topSashPart', 'topSashPart.isFrameLevelArch',
   'isFrameLevelArch', 'Frame Level Arch', 'boolean', 'visible',
   2254, TRUE, 'topSashPart', NULL, 'input', NULL, NULL, FALSE),

  ('topSashPart', 'topSashPart.archedOuterJamb',
   'archedOuterJamb', 'Arched Outer Jamb', 'boolean', 'visible',
   2255, TRUE, 'topSashPart', NULL, 'input', NULL, NULL, FALSE),

  ('topSashPart', 'topSashPart.curvedSashHead',
   'curvedSashHead', 'Curved Sash Head', 'boolean', 'visible',
   2256, TRUE, 'topSashPart', NULL, 'input', NULL, NULL, FALSE),

  ('topSashPart', 'topSashPart.curvedFrameHead',
   'curvedFrameHead', 'Curved Frame Head', 'boolean', 'visible',
   2257, TRUE, 'topSashPart', NULL, 'input', NULL, NULL, FALSE),

  ('topSashPart', 'topSashPart.angledTopRailId',
   'angledTopRailId', 'Angled Top Rail', 'number', 'visible',
   2258, TRUE, 'topSashPart', NULL, 'input', NULL, NULL, FALSE),

  ('topSashPart', 'topSashPart.angledTopRailHeightReduction',
   'angledTopRailHeightReduction', 'Angled Top Rail Height Reduction', 'number', 'visible',
   2259, TRUE, 'topSashPart', 'mm', 'input', NULL, NULL, FALSE),

  ('topSashPart', 'topSashPart.sashHeight',
   'sashHeight', 'Sash Height', 'number', 'visible',
   2260, TRUE, 'topSashPart', 'mm', 'derived', NULL, NULL, FALSE)

ON CONFLICT (field_key) DO NOTHING;

-- ============================================================================
-- SECTION 8 — Arch fields on bottomSashPart (sort 2270–2278)
-- ============================================================================

INSERT INTO default_field_definitions
  (part_type, field_key, property_name, label, data_type, visibility,
   sort_order, is_active, group_name, unit, role, reference_category,
   part_category, is_required)
VALUES
  ('bottomSashPart', 'bottomSashPart.archHeight',
   'archHeight', 'Arch Height', 'number', 'visible',
   2270, TRUE, 'bottomSashPart', 'mm', 'input', NULL, NULL, FALSE),

  ('bottomSashPart', 'bottomSashPart.archRadius',
   'archRadius', 'Arch Radius', 'number', 'visible',
   2271, TRUE, 'bottomSashPart', 'mm', 'derived', NULL, NULL, FALSE),

  ('bottomSashPart', 'bottomSashPart.shoulderHeight',
   'shoulderHeight', 'Shoulder Height', 'number', 'visible',
   2272, TRUE, 'bottomSashPart', 'mm', 'derived', NULL, NULL, FALSE),

  ('bottomSashPart', 'bottomSashPart.halfCircle',
   'halfCircle', 'Half Circle', 'boolean', 'visible',
   2273, TRUE, 'bottomSashPart', NULL, 'input', NULL, NULL, FALSE),

  ('bottomSashPart', 'bottomSashPart.isFrameLevelArch',
   'isFrameLevelArch', 'Frame Level Arch', 'boolean', 'visible',
   2274, TRUE, 'bottomSashPart', NULL, 'input', NULL, NULL, FALSE),

  ('bottomSashPart', 'bottomSashPart.archedOuterJamb',
   'archedOuterJamb', 'Arched Outer Jamb', 'boolean', 'visible',
   2275, TRUE, 'bottomSashPart', NULL, 'input', NULL, NULL, FALSE),

  ('bottomSashPart', 'bottomSashPart.curvedSashHead',
   'curvedSashHead', 'Curved Sash Head', 'boolean', 'visible',
   2276, TRUE, 'bottomSashPart', NULL, 'input', NULL, NULL, FALSE),

  ('bottomSashPart', 'bottomSashPart.curvedFrameHead',
   'curvedFrameHead', 'Curved Frame Head', 'boolean', 'visible',
   2277, TRUE, 'bottomSashPart', NULL, 'input', NULL, NULL, FALSE),

  ('bottomSashPart', 'bottomSashPart.sashHeight',
   'sashHeight', 'Sash Height', 'number', 'visible',
   2278, TRUE, 'bottomSashPart', 'mm', 'derived', NULL, NULL, FALSE)

ON CONFLICT (field_key) DO NOTHING;

-- ============================================================================
-- SECTION 9 — Arch fields on glassPart (sort 2290–2297)
-- ============================================================================

INSERT INTO default_field_definitions
  (part_type, field_key, property_name, label, data_type, visibility,
   sort_order, is_active, group_name, unit, role, reference_category,
   part_category, is_required)
VALUES
  ('glassPart', 'glassPart.archHead',
   'archHead', 'Arch Head', 'boolean', 'visible',
   2290, TRUE, 'glassPart', NULL, 'input', NULL, NULL, FALSE),

  ('glassPart', 'glassPart.archHeight',
   'archHeight', 'Arch Height', 'number', 'visible',
   2291, TRUE, 'glassPart', 'mm', 'input', NULL, NULL, FALSE),

  ('glassPart', 'glassPart.archRadius',
   'archRadius', 'Arch Radius', 'number', 'visible',
   2292, TRUE, 'glassPart', 'mm', 'derived', NULL, NULL, FALSE),

  ('glassPart', 'glassPart.shoulderHeight',
   'shoulderHeight', 'Shoulder Height', 'number', 'visible',
   2293, TRUE, 'glassPart', 'mm', 'derived', NULL, NULL, FALSE),

  ('glassPart', 'glassPart.halfCircle',
   'halfCircle', 'Half Circle', 'boolean', 'visible',
   2294, TRUE, 'glassPart', NULL, 'input', NULL, NULL, FALSE),

  ('glassPart', 'glassPart.isFrameLevelArch',
   'isFrameLevelArch', 'Frame Level Arch', 'boolean', 'visible',
   2295, TRUE, 'glassPart', NULL, 'input', NULL, NULL, FALSE),

  ('glassPart', 'glassPart.curvedFrameHead',
   'curvedFrameHead', 'Curved Frame Head', 'boolean', 'visible',
   2296, TRUE, 'glassPart', NULL, 'input', NULL, NULL, FALSE),

  ('glassPart', 'glassPart.isSquareTopWithArchedSightline',
   'isSquareTopWithArchedSightline', 'Swept Head (square top, arched sightline)', 'boolean', 'visible',
   2297, TRUE, 'glassPart', NULL, 'input', NULL, NULL, FALSE)

ON CONFLICT (field_key) DO NOTHING;

-- ============================================================================
-- SECTION 10 — arch + structural fields on assemblyFramePart (sort 2300–2306)
-- ============================================================================

INSERT INTO default_field_definitions
  (part_type, field_key, property_name, label, data_type, visibility,
   sort_order, is_active, group_name, unit, role, reference_category,
   part_category, is_required)
VALUES
  ('assemblyFramePart', 'assemblyFramePart.archHeight',
   'archHeight', 'Arch Height', 'number', 'visible',
   2300, TRUE, 'assemblyFramePart', 'mm', 'input', NULL, NULL, FALSE),

  ('assemblyFramePart', 'assemblyFramePart.archRadius',
   'archRadius', 'Arch Radius', 'number', 'visible',
   2301, TRUE, 'assemblyFramePart', 'mm', 'derived', NULL, NULL, FALSE),

  ('assemblyFramePart', 'assemblyFramePart.shoulderHeight',
   'shoulderHeight', 'Shoulder Height', 'number', 'visible',
   2302, TRUE, 'assemblyFramePart', 'mm', 'derived', NULL, NULL, FALSE),

  ('assemblyFramePart', 'assemblyFramePart.halfCircle',
   'halfCircle', 'Half Circle', 'boolean', 'visible',
   2303, TRUE, 'assemblyFramePart', NULL, 'input', NULL, NULL, FALSE),

  ('assemblyFramePart', 'assemblyFramePart.frameLevelArchHead',
   'frameLevelArchHead', 'Frame Level Arch Head', 'boolean', 'visible',
   2304, TRUE, 'assemblyFramePart', NULL, 'input', NULL, NULL, FALSE),

  ('assemblyFramePart', 'assemblyFramePart.archedOuterJamb',
   'archedOuterJamb', 'Arched Outer Jamb', 'boolean', 'visible',
   2305, TRUE, 'assemblyFramePart', NULL, 'input', NULL, NULL, FALSE),

  ('assemblyFramePart', 'assemblyFramePart.outerWidth',
   'outerWidth', 'Outer Width', 'number', 'visible',
   2306, TRUE, 'assemblyFramePart', 'mm', 'derived', NULL, NULL, FALSE),

  ('assemblyFramePart', 'assemblyFramePart.outerHeight',
   'outerHeight', 'Outer Height', 'number', 'visible',
   2307, TRUE, 'assemblyFramePart', 'mm', 'derived', NULL, NULL, FALSE)

ON CONFLICT (field_key) DO NOTHING;

-- ============================================================================
-- SECTION 11 — sashPairPart: sashSplitId, horn lengths, fixedSashHeight
--              (sort 2310–2315)
-- ============================================================================

INSERT INTO default_field_definitions
  (part_type, field_key, property_name, label, data_type, visibility,
   sort_order, is_active, group_name, unit, role, reference_category,
   part_category, is_required)
VALUES
  -- sashSplitId mirrors Integrate's property name; linked to same sash_split category
  ('sashPairPart', 'sashPairPart.sashSplitId',
   'sashSplitId', 'Sash Split', 'reference', 'visible',
   2310, TRUE, 'sashPairPart', NULL, 'input', 'sash_split', NULL, FALSE),

  ('sashPairPart', 'sashPairPart.topHornLength',
   'topHornLength', 'Top Horn Length', 'number', 'visible',
   2311, TRUE, 'sashPairPart', 'mm', 'input', NULL, NULL, FALSE),

  ('sashPairPart', 'sashPairPart.bottomHornLength',
   'bottomHornLength', 'Bottom Horn Length', 'number', 'visible',
   2312, TRUE, 'sashPairPart', 'mm', 'input', NULL, NULL, FALSE),

  ('sashPairPart', 'sashPairPart.fixedSashHeight',
   'fixedSashHeight', 'Fixed Sash Height', 'number', 'visible',
   2313, TRUE, 'sashPairPart', 'mm', 'input', NULL, NULL, FALSE),

  -- sashWidth / sashHeight derived by computeDerived
  ('sashPairPart', 'sashPairPart.sashWidth',
   'sashWidth', 'Sash Width', 'number', 'visible',
   2314, TRUE, 'sashPairPart', 'mm', 'derived', NULL, NULL, FALSE),

  ('sashPairPart', 'sashPairPart.topSashHeight',
   'topSashHeight', 'Top Sash Height', 'number', 'visible',
   2315, TRUE, 'sashPairPart', 'mm', 'derived', NULL, NULL, FALSE),

  ('sashPairPart', 'sashPairPart.bottomSashHeight',
   'bottomSashHeight', 'Bottom Sash Height', 'number', 'visible',
   2316, TRUE, 'sashPairPart', 'mm', 'derived', NULL, NULL, FALSE)

ON CONFLICT (field_key) DO NOTHING;

-- ============================================================================
-- SECTION 12 — Tree migration: glassPart barsWide/barsHigh → real bar parts
--
--   For each glassPart that has barsWide > 0 or barsHigh > 0:
--     - Insert barsWide verticalGlazingBarPart rows (offset=0 = auto-evenly-spaced)
--     - Insert barsHigh horizontalGlazingBarPart rows
--     - Remove barsWide/barsHigh keys from the glassPart values jsonb
--
--   offset=0 is treated by the geometry engine as "evenly distribute across
--   the sightline". The property editor never shows a 0-offset bar as
--   "positioned at the left edge"; instead J2 geometry will space them.
-- ============================================================================

DO $$
DECLARE
  _glass   RECORD;
  _i       INTEGER;
BEGIN
  FOR _glass IN
    SELECT
      dp.id,
      dp.drawing_id,
      COALESCE((dp.values->>'barsWide')::int, 0) AS bars_wide,
      COALESCE((dp.values->>'barsHigh')::int, 0) AS bars_high
    FROM drawing_parts dp
    WHERE dp.part_type = 'glassPart'
      AND (
        COALESCE((dp.values->>'barsWide')::int, 0) > 0
        OR COALESCE((dp.values->>'barsHigh')::int, 0) > 0
      )
  LOOP
    -- Insert vertical glazing bar children
    FOR _i IN 1 .. _glass.bars_wide LOOP
      INSERT INTO drawing_parts (drawing_id, part_type, parent_part_id, sort_order, values)
      VALUES (
        _glass.drawing_id,
        'verticalGlazingBarPart',
        _glass.id,
        _i,
        jsonb_build_object(
          'offset',      0,
          'offset2',     0,
          'thickness',   20,
          'nib',         4,
          'tail',        4,
          'tailLinkType',1
        )
      );
    END LOOP;

    -- Insert horizontal glazing bar children
    FOR _i IN 1 .. _glass.bars_high LOOP
      INSERT INTO drawing_parts (drawing_id, part_type, parent_part_id, sort_order, values)
      VALUES (
        _glass.drawing_id,
        'horizontalGlazingBarPart',
        _glass.id,
        100 + _i,
        jsonb_build_object(
          'offset',      0,
          'offset2',     0,
          'thickness',   20,
          'nib',         4,
          'tail',        4,
          'tailLinkType',1
        )
      );
    END LOOP;

    -- Remove legacy bar-count keys from glassPart values
    UPDATE drawing_parts
       SET values = values - 'barsWide' - 'barsHigh'
     WHERE id = _glass.id;
  END LOOP;
END
$$;

COMMIT;
