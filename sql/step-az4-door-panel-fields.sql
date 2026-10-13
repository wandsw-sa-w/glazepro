-- Step AZ-4: the French door property panels, as Integrate shows them.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run. Run LAST.
--
-- Integrate's own panels, read in survey mode on FD1
-- (docs/integrate-L31115-french-doors.txt, last section):
--
--   French Door (the pair): Internal Frame Width 1805 ; Internal Frame
--     Height 2115 ; Door Type "Open Out / Flush with Stops Internally" ;
--     Overall Meeting Stile 198 ; Thickness 54 ; Sash Split "1/2 - 1/2
--     split" ; Set left leaf width ; Set right leaf width ; Left / Right /
--     Top / Bottom Clearance 1 / 1 / 3 / 3
--
--   A leaf: Arch Head ; To Be Replaced ; Special Joinery Details ; Special
--     Glass Details ; [Divider Spacing x2] ; Operation (Fix / Right Hand
--     Hung) ; Bottom Rail (int) 163 ; Master Leaf
--
-- The Divider Spacing buttons are the board's own (Step AW) and already show
-- on a leaf's panel.
--
-- HOW THIS WORKS, and why it is shaped the way it is. The board shows a
-- part's fields from default_field_definitions and hides role = 'config' —
-- the same mechanism Step AQ-3 and Step AY-2 used.
--
-- Step AY-2 was first written as an ALLOW-LIST ("hide everything except
-- these"), and the reviewer's rewrite showed why that was wrong: the French
-- casement LEAF part types had almost no definitions at all, so hiding
-- everything not on the list left the panel nearly empty. The real risk was
-- not a field spelled differently — it was fields that DO NOT EXIST, which
-- an allow-list hides silently.
--
-- So this file is the other way round:
--   Section 1 RELABELS what Integrate labels differently.
--   Section 2 INSERTS the fields Integrate shows that may have no definition
--             — nothing is overwritten (ON CONFLICT DO NOTHING).
--   Section 3 hides a SHORT, NAMED list of profile settings that are not
--             drawing fields. Anything not named is left exactly as it is.
--
-- VERIFIED by the reviewer against the live rows on 13 Oct 2026 (see the
-- REVIEWER'S REWRITE note in section 1). Section 0 is kept as a record; it
-- does not need sending back.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. Every field definition on the three French door part types.
SELECT part_type, property_name, field_key, label, data_type, role,
       is_required, sort_order, is_active
FROM   default_field_definitions
WHERE  part_type IN ('frenchDoorPart', 'leftFrenchDoorLeafPart',
                     'rightFrenchDoorLeafPart')
ORDER  BY part_type, sort_order, property_name;

-- 0b. Which of them the board shows today (role is not 'config').
SELECT part_type, property_name, label, role
FROM   default_field_definitions
WHERE  part_type IN ('frenchDoorPart', 'leftFrenchDoorLeafPart',
                     'rightFrenchDoorLeafPart')
  AND  is_active AND coalesce(role, '') <> 'config'
ORDER  BY part_type, sort_order, property_name;

-- 0c. The equivalent casement sash definitions, whose SHAPES section 2
--     copies (data_type, reference category, is_required).
SELECT property_name, field_key, label, data_type, role, is_required, sort_order
FROM   default_field_definitions
WHERE  part_type = 'casementSashPart'
  AND  property_name IN ('operation','toBeReplaced','bottomHeight','archHead',
                         'specialJoineryDetails','specialGlassDetails','casementTypeId')
ORDER  BY property_name;

-- 0d. The reference categories Operation and Door Type draw from.
SELECT category, code, label, sort_order, is_active
FROM   reference_options
WHERE  category IN ('sash_operation', 'sash_type', 'product')
ORDER  BY category, sort_order;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTIONS 1-3 — the change
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- REVIEWER'S REWRITE (13 Oct), checked against the live rows:
--  * every inserted field now has group_name = part_type (as every existing
--    door / French casement definition does) and the two reference fields
--    name their option list (casementTypeId -> sash_type, operation ->
--    sash_operation, as sql/step-ay2 did for the French casement);
--  * archHead / specialJoineryDetails / specialGlassDetails are DROPPED: no
--    part type in GlazePro has those properties (not even casementSashPart),
--    so nothing would read them — they belong to a later, all-products step;
--  * sort orders put the fields in Integrate's order (pair: Door Type, Overall
--    Meeting Stile, Thickness, then the four clearances; leaf: To Be Replaced,
--    Operation, head and stiles, Bottom Rail, Master Leaf);
--  * Integrate's pair panel does NOT show typeId, the gap, the overlap or the
--    mullion settings, and no leaf shows defaultMuntinThickness — all become
--    role 'config' (hidden, still read as defaults), as Step AY did.

-- 1. Relabel the existing definitions (Integrate's wording).
UPDATE default_field_definitions d
SET    label = v.label, sort_order = v.sort_order
FROM  (VALUES
        ('frenchDoorPart',          'midRail',                   'Overall Meeting Stile', 1382),
        ('frenchDoorPart',          'thickness',                 'Thickness',             1383),
        ('frenchDoorPart',          'mechanicalClearanceLeft',   'Left Clearance',        1390),
        ('frenchDoorPart',          'mechanicalClearanceRight',  'Right Clearance',       1400),
        ('frenchDoorPart',          'mechanicalClearanceTop',    'Top Clearance',         1410),
        ('frenchDoorPart',          'mechanicalClearanceBottom', 'Bottom Clearance',      1420),
        ('leftFrenchDoorLeafPart',  'topHeight',                 'Door Head',             2270),
        ('leftFrenchDoorLeafPart',  'leftWidth',                 'Left Stile',            2280),
        ('rightFrenchDoorLeafPart', 'topHeight',                 'Door Head',             2420),
        ('rightFrenchDoorLeafPart', 'rightWidth',                'Right Stile',           2430)
      ) AS v(part_type, property_name, label, sort_order)
WHERE  d.part_type = v.part_type
  AND  d.property_name = v.property_name;

-- 2. The fields Integrate shows that GlazePro has no definition for yet.
INSERT INTO default_field_definitions
  (part_type, property_name, field_key, label, data_type, role, visibility,
   reference_category, group_name, is_required, sort_order, is_active)
VALUES
  ('frenchDoorPart', 'casementTypeId', 'frenchDoorPart.casementTypeId', 'Door Type', 'reference', 'input', 'visible', 'sash_type', 'frenchDoorPart', false, 1381, true),
  ('leftFrenchDoorLeafPart',  'toBeReplaced',         'leftFrenchDoorLeafPart.toBeReplaced',          'To Be Replaced',    'boolean',   'input', 'visible', NULL,             'leftFrenchDoorLeafPart',  false, 2261, true),
  ('leftFrenchDoorLeafPart',  'operation',            'leftFrenchDoorLeafPart.operation',             'Operation',         'reference', 'input', 'visible', 'sash_operation', 'leftFrenchDoorLeafPart',  false, 2262, true),
  ('leftFrenchDoorLeafPart',  'bottomHeight',         'leftFrenchDoorLeafPart.bottomHeight',          'Bottom Rail (int)', 'number',    'input', 'visible', NULL,             'leftFrenchDoorLeafPart',  false, 2284, true),
  ('leftFrenchDoorLeafPart',  'bottomHeightExternal', 'leftFrenchDoorLeafPart.bottomHeightExternal',  'Bottom Rail (ext)', 'number',    'input', 'visible', NULL,             'leftFrenchDoorLeafPart',  false, 2285, true),
  ('leftFrenchDoorLeafPart',  'isMasterLeaf',         'leftFrenchDoorLeafPart.isMasterLeaf',          'Master Leaf',       'boolean',   'input', 'visible', NULL,             'leftFrenchDoorLeafPart',  false, 2286, true),
  ('rightFrenchDoorLeafPart', 'toBeReplaced',         'rightFrenchDoorLeafPart.toBeReplaced',         'To Be Replaced',    'boolean',   'input', 'visible', NULL,             'rightFrenchDoorLeafPart', false, 2411, true),
  ('rightFrenchDoorLeafPart', 'operation',            'rightFrenchDoorLeafPart.operation',            'Operation',         'reference', 'input', 'visible', 'sash_operation', 'rightFrenchDoorLeafPart', false, 2412, true),
  ('rightFrenchDoorLeafPart', 'bottomHeight',         'rightFrenchDoorLeafPart.bottomHeight',         'Bottom Rail (int)', 'number',    'input', 'visible', NULL,             'rightFrenchDoorLeafPart', false, 2434, true),
  ('rightFrenchDoorLeafPart', 'bottomHeightExternal', 'rightFrenchDoorLeafPart.bottomHeightExternal', 'Bottom Rail (ext)', 'number',    'input', 'visible', NULL,             'rightFrenchDoorLeafPart', false, 2435, true),
  ('rightFrenchDoorLeafPart', 'isMasterLeaf',         'rightFrenchDoorLeafPart.isMasterLeaf',         'Master Leaf',       'boolean',   'input', 'visible', NULL,             'rightFrenchDoorLeafPart', false, 2436, true)
ON CONFLICT (field_key) DO NOTHING;

-- 3. Hide what Integrate does not show (still read as profile defaults).
UPDATE default_field_definitions
SET    role = 'config'
WHERE  (part_type = 'frenchDoorPart' AND property_name IN (
          'typeId', 'gapBetweenMeetingStiles', 'meetingStileOverlap',
          'mullionThickness', 'mullionStopSizeMaster', 'mullionStopSizeSlave'))
   OR  (part_type IN ('leftFrenchDoorLeafPart', 'rightFrenchDoorLeafPart') AND property_name IN (
          'defaultMuntinThickness', 'btmRailShapeId',
          'defaultOpenInSteppedBottomRailOverlap', 'defaultOpenOutSteppedBottomRailOverlap',
          'chamferedBottomRailAngle'));

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. What the PAIR's panel will show. Expect, in order: Door Type, Overall
--    Meeting Stile, Thickness, Left / Right / Top / Bottom Clearance.
SELECT property_name, label, data_type, sort_order
FROM   default_field_definitions
WHERE  part_type = 'frenchDoorPart'
  AND  is_active AND coalesce(role, '') <> 'config'
ORDER  BY sort_order, property_name;

-- 2. What a LEAF's panel will show. Expect, per leaf and in order: To Be
--    Replaced, Operation, Door Head, the outer stile (Left Stile on the left
--    leaf, Right Stile on the right), Bottom Rail (int), Bottom Rail (ext),
--    Master Leaf.
SELECT part_type, property_name, label, data_type, sort_order
FROM   default_field_definitions
WHERE  part_type IN ('leftFrenchDoorLeafPart', 'rightFrenchDoorLeafPart')
  AND  is_active AND coalesce(role, '') <> 'config'
ORDER  BY part_type, sort_order, property_name;

-- 3. What has been hidden — stored and still editable on Defaults & Parts.
SELECT part_type, property_name, label
FROM   default_field_definitions
WHERE  part_type IN ('frenchDoorPart', 'leftFrenchDoorLeafPart',
                     'rightFrenchDoorLeafPart')
  AND  role = 'config'
ORDER  BY part_type, property_name;


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- The state before this file, read live on 13 Oct 2026: every existing
-- frenchDoorPart / *FrenchDoorLeafPart definition had role 'input', and the
-- labels / sort orders below. None of the eleven inserted field_keys existed.
--
-- UPDATE default_field_definitions d SET label = v.label, sort_order = v.sort_order
-- FROM (VALUES
--   ('frenchDoorPart','midRail','Mid rail',1440), ('frenchDoorPart','thickness','Thickness',1430),
--   ('frenchDoorPart','mechanicalClearanceLeft','Mechanical clearance left',1390),
--   ('frenchDoorPart','mechanicalClearanceRight','Mechanical clearance right',1400),
--   ('frenchDoorPart','mechanicalClearanceTop','Mechanical clearance top',1410),
--   ('frenchDoorPart','mechanicalClearanceBottom','Mechanical clearance bottom',1420),
--   ('leftFrenchDoorLeafPart','topHeight','Top height',2270), ('leftFrenchDoorLeafPart','leftWidth','Left width',2280),
--   ('rightFrenchDoorLeafPart','topHeight','Top height',2420), ('rightFrenchDoorLeafPart','rightWidth','Right width',2430)
-- ) AS v(part_type, property_name, label, sort_order)
-- WHERE d.part_type = v.part_type AND d.property_name = v.property_name;
--
-- UPDATE default_field_definitions SET role = 'input'
-- WHERE part_type IN ('frenchDoorPart','leftFrenchDoorLeafPart','rightFrenchDoorLeafPart') AND role = 'config';
--
-- DELETE FROM default_field_definitions WHERE field_key IN (
--   'frenchDoorPart.casementTypeId',
--   'leftFrenchDoorLeafPart.toBeReplaced','leftFrenchDoorLeafPart.operation','leftFrenchDoorLeafPart.bottomHeight',
--   'leftFrenchDoorLeafPart.bottomHeightExternal','leftFrenchDoorLeafPart.isMasterLeaf',
--   'rightFrenchDoorLeafPart.toBeReplaced','rightFrenchDoorLeafPart.operation','rightFrenchDoorLeafPart.bottomHeight',
--   'rightFrenchDoorLeafPart.bottomHeightExternal','rightFrenchDoorLeafPart.isMasterLeaf');
