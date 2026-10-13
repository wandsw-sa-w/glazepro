-- =============================================================================
-- Step AY-2: the French casement panels, as Integrate shows them.
-- REVIEWER REWRITE (13 Oct) of Claude Code's version, from the LIVE rows (read with /dev/sql):
--   frenchCasementPart has 9 definitions (4 clearances, thickness, midRail "Mid rail",
--     gapBetweenMeetingStiles, meetingStileOverlap, hasFloatingMullion), all role 'input'.
--   left/rightFrenchCasementSashPart have only 8 each, all profile settings: topHeight, the OUTER
--     stile (left: leftWidth, right: rightWidth), btmRailShapeId, stormProofOverlap,
--     stormProofLipThickness, the two stepped-bottom-rail overlaps, chamferedBottomRailAngle.
--     There is NO operation, To Be Replaced, meeting stile, bottom rail or master leaf definition,
--     so the original allow-list would have left a leaf panel almost empty.
-- Integrate shows on the PAIR: Sash Type, Overall Meeting Stile, Thickness (+ the internal frame
-- size, not offered here: GlazePro does not derive it for a pair yet). On a LEAF: To Be Replaced,
-- Operation, Sash Head, Left Stile, Right Stile, Bottom Rail, Master Leaf.
-- Shapes copied from the live casementSashPart definitions (operation = reference sash_operation,
-- casementTypeId = reference sash_type, toBeReplaced boolean, bottomHeight number mm).
-- Nothing is deleted and no value changes: hidden = role 'config' (the board filters it out; the
-- value stays stored and editable on Defaults & Parts), as sql/step-aq3 did for casement parts.
-- Safe to re-run.
-- =============================================================================

BEGIN;

-- 1. Hide the profile settings Integrate does not show.
UPDATE default_field_definitions SET role = 'config'
WHERE  part_type = 'frenchCasementPart'
  AND  property_name IN ('mechanicalClearanceLeft','mechanicalClearanceRight','mechanicalClearanceTop',
                         'mechanicalClearanceBottom','gapBetweenMeetingStiles','meetingStileOverlap',
                         'hasFloatingMullion')
  AND  coalesce(role,'') <> 'config';

UPDATE default_field_definitions SET role = 'config'
WHERE  part_type IN ('leftFrenchCasementSashPart','rightFrenchCasementSashPart')
  AND  property_name IN ('btmRailShapeId','stormProofOverlap','stormProofLipThickness',
                         'defaultOpenInSteppedBottomRailOverlap','defaultOpenOutSteppedBottomRailOverlap',
                         'chamferedBottomRailAngle')
  AND  coalesce(role,'') <> 'config';

-- 2. Integrate's labels on the fields that stay.
UPDATE default_field_definitions d SET label = v.label
FROM (VALUES
  ('frenchCasementPart',          'midRail',    'Overall Meeting Stile'),
  ('frenchCasementPart',          'thickness',  'Thickness'),
  ('leftFrenchCasementSashPart',  'topHeight',  'Sash Head'),
  ('leftFrenchCasementSashPart',  'leftWidth',  'Left Stile'),
  ('rightFrenchCasementSashPart', 'topHeight',  'Sash Head'),
  ('rightFrenchCasementSashPart', 'rightWidth', 'Right Stile')
) AS v(part_type, property_name, label)
WHERE d.part_type = v.part_type AND d.property_name = v.property_name
  AND d.label IS DISTINCT FROM v.label;

-- 3. The fields Integrate shows that have no definition yet.
INSERT INTO default_field_definitions
  (part_type, field_key, property_name, label, data_type, visibility, sort_order, is_active,
   group_name, unit, role, reference_category, part_category, is_required)
VALUES
  ('frenchCasementPart', 'frenchCasementPart.casementTypeId', 'casementTypeId', 'Sash Type',
   'reference', 'visible', 1335, TRUE, 'frenchCasementPart', NULL, 'input', 'sash_type', NULL, FALSE),
  ('leftFrenchCasementSashPart', 'leftFrenchCasementSashPart.toBeReplaced', 'toBeReplaced', 'To Be Replaced',
   'boolean', 'visible', 2181, TRUE, 'leftFrenchCasementSashPart', NULL, 'input', NULL, NULL, FALSE),
  ('leftFrenchCasementSashPart', 'leftFrenchCasementSashPart.operation', 'operation', 'Operation',
   'reference', 'visible', 2182, TRUE, 'leftFrenchCasementSashPart', NULL, 'input', 'sash_operation', NULL, FALSE),
  ('leftFrenchCasementSashPart', 'leftFrenchCasementSashPart.rightWidth', 'rightWidth', 'Right Stile',
   'number', 'visible', 2205, TRUE, 'leftFrenchCasementSashPart', 'mm', 'input', NULL, NULL, FALSE),
  ('leftFrenchCasementSashPart', 'leftFrenchCasementSashPart.bottomHeight', 'bottomHeight', 'Bottom Rail',
   'number', 'visible', 2206, TRUE, 'leftFrenchCasementSashPart', 'mm', 'input', NULL, NULL, FALSE),
  ('leftFrenchCasementSashPart', 'leftFrenchCasementSashPart.isMasterLeaf', 'isMasterLeaf', 'Master Leaf',
   'boolean', 'visible', 2207, TRUE, 'leftFrenchCasementSashPart', NULL, 'input', NULL, NULL, FALSE),
  ('rightFrenchCasementSashPart', 'rightFrenchCasementSashPart.toBeReplaced', 'toBeReplaced', 'To Be Replaced',
   'boolean', 'visible', 2101, TRUE, 'rightFrenchCasementSashPart', NULL, 'input', NULL, NULL, FALSE),
  ('rightFrenchCasementSashPart', 'rightFrenchCasementSashPart.operation', 'operation', 'Operation',
   'reference', 'visible', 2102, TRUE, 'rightFrenchCasementSashPart', NULL, 'input', 'sash_operation', NULL, FALSE),
  ('rightFrenchCasementSashPart', 'rightFrenchCasementSashPart.leftWidth', 'leftWidth', 'Left Stile',
   'number', 'visible', 2115, TRUE, 'rightFrenchCasementSashPart', 'mm', 'input', NULL, NULL, FALSE),
  ('rightFrenchCasementSashPart', 'rightFrenchCasementSashPart.bottomHeight', 'bottomHeight', 'Bottom Rail',
   'number', 'visible', 2125, TRUE, 'rightFrenchCasementSashPart', 'mm', 'input', NULL, NULL, FALSE),
  ('rightFrenchCasementSashPart', 'rightFrenchCasementSashPart.isMasterLeaf', 'isMasterLeaf', 'Master Leaf',
   'boolean', 'visible', 2126, TRUE, 'rightFrenchCasementSashPart', NULL, 'input', NULL, NULL, FALSE)
ON CONFLICT (field_key) DO NOTHING;

COMMIT;

-- Check: what each panel shows now (role not 'config'), in order.
SELECT part_type, sort_order, property_name, label, data_type, reference_category
FROM   default_field_definitions
WHERE  part_type IN ('frenchCasementPart','leftFrenchCasementSashPart','rightFrenchCasementSashPart')
  AND  is_active AND coalesce(role,'') <> 'config'
ORDER  BY part_type, sort_order;

-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback
-- ---------------------------------------------------------------------------
-- DELETE FROM default_field_definitions WHERE field_key IN (
--   'frenchCasementPart.casementTypeId',
--   'leftFrenchCasementSashPart.toBeReplaced','leftFrenchCasementSashPart.operation',
--   'leftFrenchCasementSashPart.rightWidth','leftFrenchCasementSashPart.bottomHeight',
--   'leftFrenchCasementSashPart.isMasterLeaf',
--   'rightFrenchCasementSashPart.toBeReplaced','rightFrenchCasementSashPart.operation',
--   'rightFrenchCasementSashPart.leftWidth','rightFrenchCasementSashPart.bottomHeight',
--   'rightFrenchCasementSashPart.isMasterLeaf');
-- UPDATE default_field_definitions SET role = 'input'
-- WHERE part_type IN ('frenchCasementPart','leftFrenchCasementSashPart','rightFrenchCasementSashPart')
--   AND role = 'config';
-- UPDATE default_field_definitions SET label = 'Mid rail'  WHERE field_key = 'frenchCasementPart.midRail';
-- UPDATE default_field_definitions SET label = 'Top height' WHERE property_name = 'topHeight'
--   AND part_type IN ('leftFrenchCasementSashPart','rightFrenchCasementSashPart');
-- UPDATE default_field_definitions SET label = 'Left width'  WHERE field_key = 'leftFrenchCasementSashPart.leftWidth';
-- UPDATE default_field_definitions SET label = 'Right width' WHERE field_key = 'rightFrenchCasementSashPart.rightWidth';
