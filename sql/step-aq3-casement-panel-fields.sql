-- Step AQ-3: the casement sash / direct glazed / mullion property panels.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run.
--
-- The reviewer's live test (12 Oct): selecting a casement sash showed the
-- PROFILE's default-setting fields ("Default flush frame depth", "Default
-- storm proof ...", "Update frame details on part change") as editable
-- inputs, and not the fields a surveyor needs. The mullion's thickness
-- inputs showed blank although the part stores thicknessInFrame 27.
--
-- Both have the same cause. The board shows a part's fields from
-- default_field_definitions and already excludes role = 'config' (the
-- profile-setting role) — see the `f.role !== 'config'` filter in
-- src/pages/DrawingBoard.jsx. Integrate's import left the casement parts'
-- default* fields as role 'input', so they appeared on the drawing; and the
-- keys the panel offered for the mullion were the PROFILE's
-- thicknessInFrameHollow / thicknessInFrameSolid, not the thicknessInFrame
-- the part actually stores, so they had no value to show.
--
-- Section 1 reclassifies; section 2 adds the fields the parts really store.
-- Nothing is deleted and no existing row's label or type is changed —
-- default_field_definitions was imported from Integrate and is not mine to
-- rewrite. Section 3's inspection query is the one to send the reviewer if
-- the panel is still not right, because the live field keys for these part
-- types are NOT in the repository.

BEGIN;

-- ── 1. default* fields are profile settings, not drawing fields ────────────
-- They stay fully editable on Defaults & Parts, which loads every active
-- definition for the part type regardless of role; they just stop appearing
-- on the drawing board.
UPDATE default_field_definitions
SET    role = 'config'
WHERE  part_type IN ('casementSashPart', 'mullionPart', 'transomPart',
                     'assemblyFramePart', 'glassPart', 'cillPart')
  AND  role = 'input'
  AND  (field_key LIKE '%.default%' OR label ILIKE 'Update frame details%');

-- ── 2. The fields these parts actually store ───────────────────────────────
-- Every field_key below is a property the tree really holds (written by
-- src/drawingBoard/casementOpenings.js), so a definition under exactly this
-- key will show the stored value. ON CONFLICT DO NOTHING leaves any row
-- Integrate's import already created exactly as it is.
--
-- Sort orders 900+ are used because the imported casement rows' own sort
-- orders are unknown; adjust on Defaults & Parts if the order reads oddly.
INSERT INTO default_field_definitions
    (part_type, field_key, property_name, label, data_type, visibility,
     sort_order, is_active, group_name, unit, role, reference_category,
     part_category, is_required)
VALUES
    -- Integrate's read-only Internal Frame Width / Height: the OPENING the
    -- sash sits in. computeDerived supplies both (Step AQ item 4).
    ('casementSashPart', 'casementSashPart.internalWidth',
     'internalWidth', 'Internal Frame Width', 'number', 'visible',
     900, TRUE, 'casementSashPart', 'mm', 'derived', NULL, NULL, FALSE),
    ('casementSashPart', 'casementSashPart.internalHeight',
     'internalHeight', 'Internal Frame Height', 'number', 'visible',
     901, TRUE, 'casementSashPart', 'mm', 'derived', NULL, NULL, FALSE),

    ('casementSashPart', 'casementSashPart.operation',
     'operation', 'Operation', 'reference', 'visible',
     902, TRUE, 'casementSashPart', NULL, 'input', 'sash_operation', NULL, FALSE),
    ('casementSashPart', 'casementSashPart.casementTypeId',
     'casementTypeId', 'Sash Type', 'reference', 'visible',
     903, TRUE, 'casementSashPart', NULL, 'input', 'sash_type', NULL, FALSE),
    ('casementSashPart', 'casementSashPart.toBeReplaced',
     'toBeReplaced', 'To Be Replaced', 'boolean', 'visible',
     904, TRUE, 'casementSashPart', NULL, 'input', NULL, NULL, FALSE),
    ('casementSashPart', 'casementSashPart.thickness',
     'thickness', 'Thickness', 'number', 'visible',
     905, TRUE, 'casementSashPart', 'mm', 'input', NULL, NULL, FALSE),
    ('casementSashPart', 'casementSashPart.topHeight',
     'topHeight', 'Sash Head', 'number', 'visible',
     906, TRUE, 'casementSashPart', 'mm', 'input', NULL, NULL, FALSE),
    ('casementSashPart', 'casementSashPart.leftWidth',
     'leftWidth', 'Left Stile', 'number', 'visible',
     907, TRUE, 'casementSashPart', 'mm', 'input', NULL, NULL, FALSE),
    ('casementSashPart', 'casementSashPart.rightWidth',
     'rightWidth', 'Right Stile', 'number', 'visible',
     908, TRUE, 'casementSashPart', 'mm', 'input', NULL, NULL, FALSE),
    ('casementSashPart', 'casementSashPart.bottomHeight',
     'bottomHeight', 'Bottom Rail', 'number', 'visible',
     909, TRUE, 'casementSashPart', 'mm', 'input', NULL, NULL, FALSE),
    ('casementSashPart', 'casementSashPart.btmRailShapeId',
     'btmRailShapeId', 'Bottom Rail Shape', 'reference', 'visible',
     910, TRUE, 'casementSashPart', NULL, 'input', 'btm_rail_shape', NULL, FALSE),
    ('casementSashPart', 'casementSashPart.mechanicalClearanceLeft',
     'mechanicalClearanceLeft', 'Mechanical Clearance Left', 'number', 'visible',
     911, TRUE, 'casementSashPart', 'mm', 'input', NULL, NULL, FALSE),
    ('casementSashPart', 'casementSashPart.mechanicalClearanceRight',
     'mechanicalClearanceRight', 'Mechanical Clearance Right', 'number', 'visible',
     912, TRUE, 'casementSashPart', 'mm', 'input', NULL, NULL, FALSE),
    ('casementSashPart', 'casementSashPart.mechanicalClearanceTop',
     'mechanicalClearanceTop', 'Mechanical Clearance Top', 'number', 'visible',
     913, TRUE, 'casementSashPart', 'mm', 'input', NULL, NULL, FALSE),
    ('casementSashPart', 'casementSashPart.mechanicalClearanceBottom',
     'mechanicalClearanceBottom', 'Mechanical Clearance Bottom', 'number', 'visible',
     914, TRUE, 'casementSashPart', 'mm', 'input', NULL, NULL, FALSE),

    -- The mullion stores thicknessInFrame; the offset is its LEFT face.
    ('mullionPart', 'mullionPart.thicknessInFrame',
     'thicknessInFrame', 'Thickness in Frame', 'number', 'visible',
     920, TRUE, 'mullionPart', 'mm', 'input', NULL, NULL, FALSE),
    ('mullionPart', 'mullionPart.offset',
     'offset', 'Offset (left face)', 'number', 'visible',
     921, TRUE, 'mullionPart', 'mm', 'input', NULL, NULL, FALSE),
    ('mullionPart', 'mullionPart.mullionStopSize',
     'mullionStopSize', 'Mullion Stop Size', 'number', 'visible',
     922, TRUE, 'mullionPart', 'mm', 'input', NULL, NULL, FALSE),

    -- A direct glazed unit is a glassPart, so it already has Glazing, the
    -- glass part numbers, spacer and gas. These are the opening-level fields
    -- Integrate shows on it that a sash's glass does not have.
    ('glassPart', 'glassPart.hiddenInRebateLeft',
     'hiddenInRebateLeft', 'Glass Hidden in Rebate Left', 'number', 'visible',
     930, TRUE, 'glassPart', 'mm', 'input', NULL, NULL, FALSE),
    ('glassPart', 'glassPart.hiddenInRebateRight',
     'hiddenInRebateRight', 'Glass Hidden in Rebate Right', 'number', 'visible',
     931, TRUE, 'glassPart', 'mm', 'input', NULL, NULL, FALSE),
    ('glassPart', 'glassPart.hiddenInRebateTop',
     'hiddenInRebateTop', 'Glass Hidden in Rebate Top', 'number', 'visible',
     932, TRUE, 'glassPart', 'mm', 'input', NULL, NULL, FALSE),
    ('glassPart', 'glassPart.hiddenInRebateBottom',
     'hiddenInRebateBottom', 'Glass Hidden in Rebate Bottom', 'number', 'visible',
     933, TRUE, 'glassPart', 'mm', 'input', NULL, NULL, FALSE)
ON CONFLICT (field_key) DO NOTHING;

COMMIT;

-- ── 3. Checks ──────────────────────────────────────────────────────────────

-- 3a. What the casement sash panel will now show, in order. Expect the
--     surveyor's fields and NO "Default ..." or "Update frame details" rows.
SELECT field_key, label, data_type, role, reference_category, sort_order, is_active
FROM   default_field_definitions
WHERE  part_type = 'casementSashPart'
ORDER  BY role, sort_order;

-- 3b. The same for the mullion and the glass.
SELECT part_type, field_key, label, data_type, role, sort_order
FROM   default_field_definitions
WHERE  part_type IN ('mullionPart', 'glassPart')
ORDER  BY part_type, role, sort_order;

-- 3c. Anything still role 'input' whose key looks like a profile setting —
--     send this to the reviewer if a panel still shows the wrong fields.
SELECT part_type, field_key, label, role
FROM   default_field_definitions
WHERE  role = 'input'
  AND  (field_key LIKE '%.default%' OR label ILIKE 'Default %' OR label ILIKE 'Update %')
ORDER  BY part_type, field_key;

-- 3d. The reference lists the panel needs. btm_rail_shape is the one most
--     likely to be missing or named differently — if it returns no rows,
--     Bottom Rail Shape will render as an empty select and the reviewer
--     should say which category holds the shapes.
SELECT category, count(*) AS options
FROM   public.reference_options
WHERE  category IN ('sash_operation', 'sash_type', 'btm_rail_shape')
  AND  is_active
GROUP  BY category
ORDER  BY category;


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- Section 2 (remove only the rows this file adds):
-- DELETE FROM default_field_definitions
-- WHERE field_key IN (
--   'casementSashPart.internalWidth','casementSashPart.internalHeight',
--   'casementSashPart.operation','casementSashPart.casementTypeId',
--   'casementSashPart.toBeReplaced','casementSashPart.thickness',
--   'casementSashPart.topHeight','casementSashPart.leftWidth',
--   'casementSashPart.rightWidth','casementSashPart.bottomHeight',
--   'casementSashPart.btmRailShapeId',
--   'casementSashPart.mechanicalClearanceLeft','casementSashPart.mechanicalClearanceRight',
--   'casementSashPart.mechanicalClearanceTop','casementSashPart.mechanicalClearanceBottom',
--   'mullionPart.thicknessInFrame','mullionPart.offset','mullionPart.mullionStopSize',
--   'glassPart.hiddenInRebateLeft','glassPart.hiddenInRebateRight',
--   'glassPart.hiddenInRebateTop','glassPart.hiddenInRebateBottom'
-- );
--
-- Section 1 CANNOT be rolled back from here: it does not record which rows it
-- changed, and some default* fields may legitimately have been 'config'
-- already. To undo it, set role back to 'input' for the specific field_keys
-- listed by query 3a/3b before the change — take that list BEFORE running
-- this file if a rollback might be needed.
