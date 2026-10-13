-- Step AY-2: the French casement property panels, as Integrate shows them.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run.
--
-- On the live board (reviewer, 13 Oct 2026) a French pair's panel shows
-- "Mid rail" plus BLANK "Meeting stile overlap" and "Has floating mullion"
-- inputs, although the profile holds 0 and "No" for those two. Integrate's
-- own panels show a shorter list with different labels:
--
--   French Casement (the pair): Internal Frame Width, Internal Frame Height,
--     Sash Type, Overall Meeting Stile (130), Thickness (57)
--
--   A leaf: To Be Replaced, Special Joinery Details, Special Glass Details,
--     [Divider Spacing buttons], Operation, Sash Head, Left Stile,
--     Right Stile, Bottom Rail (int), Bottom Rail (ext), Master Leaf
--
-- The Divider Spacing buttons are the board's own (Step AW), not a field;
-- they already appear on a leaf's panel.
--
-- HOW THIS WORKS. The board shows a part's fields from
-- default_field_definitions and excludes role = 'config' (the
-- profile-setting role) — the `f.role !== 'config'` filter in
-- src/pages/DrawingBoard.jsx, the same mechanism Step AQ-3 used for the
-- casement parts. So:
--
--   Section 1 hides everything on these three part types EXCEPT an
--   ALLOW-LIST, which is the list above. An allow-list rather than a list of
--   fields to hide, because the live rows are not in the repository: I know
--   what the board's own trees STORE and what Integrate SHOWS, and I have
--   not seen every row Integrate's import created. Anything I have not seen
--   is therefore hidden rather than left on the panel, which is the brief's
--   "fields Integrate does not show stay stored but hidden". Nothing is
--   deleted and no value is changed — a hidden field stays stored and stays
--   fully editable on Defaults & Parts, which loads every active definition
--   whatever its role.
--
--   Section 2 relabels the allow-listed fields to Integrate's labels.
--
--   Section 3 adds a definition for an allow-listed field that has none, so
--   the panel can show it at all.
--
-- RUN SECTION 0 FIRST AND SEND THE REVIEWER ITS OUTPUT. It prints every live
-- row for the three part types. If a field in the allow-list is spelled
-- differently live, section 0 is what shows it and the allow-list needs that
-- spelling added — otherwise the field is hidden instead of shown, which is
-- a visible mistake rather than a silent one.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read the live rows first
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. Every field definition on the three French part types, as they stand.
SELECT part_type, property_name, field_key, label, data_type, role,
       is_required, sort_order, is_active
FROM   default_field_definitions
WHERE  part_type IN ('frenchCasementPart', 'leftFrenchCasementSashPart',
                     'rightFrenchCasementSashPart')
ORDER  BY part_type, sort_order, property_name;

-- 0b. Which of them the board shows today (role is not 'config'), which is
--     the list that currently includes "Mid rail", "Meeting stile overlap"
--     and "Has floating mullion".
SELECT part_type, property_name, label, role
FROM   default_field_definitions
WHERE  part_type IN ('frenchCasementPart', 'leftFrenchCasementSashPart',
                     'rightFrenchCasementSashPart')
  AND  is_active
  AND  coalesce(role, '') <> 'config'
ORDER  BY part_type, sort_order, property_name;

-- 0c. The profile values behind them, for the two that show blank.
SELECT p.code AS profile, v.field_key, v.default_value
FROM   default_profile_values v
JOIN   default_profiles p ON p.id = v.profile_id
WHERE  v.field_key LIKE 'frenchCasementPart.%'
    OR v.field_key LIKE 'leftFrenchCasementSashPart.%'
    OR v.field_key LIKE 'rightFrenchCasementSashPart.%'
ORDER  BY p.code, v.field_key;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTIONS 1-3 — the change
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Hide everything but the allow-list ─────────────────────────────────
-- The pair.
UPDATE default_field_definitions
SET    role = 'config'
WHERE  part_type = 'frenchCasementPart'
  AND  coalesce(role, '') <> 'config'
  AND  property_name NOT IN (
    'internalWidth', 'internalHeight',      -- Internal Frame Width / Height
    'internalFrameWidth', 'internalFrameHeight',   -- the other spelling, if that is the live one
    'casementTypeId',                       -- Sash Type
    'midRail',                              -- Overall Meeting Stile
    'thickness'
  );

-- A leaf. Both leaves get the same list.
UPDATE default_field_definitions
SET    role = 'config'
WHERE  part_type IN ('leftFrenchCasementSashPart', 'rightFrenchCasementSashPart')
  AND  coalesce(role, '') <> 'config'
  AND  property_name NOT IN (
    'toBeReplaced',
    'specialJoineryDetails', 'specialGlassDetails',
    'operation',
    'topHeight',                            -- Sash Head
    'leftWidth', 'rightWidth',              -- Left Stile / Right Stile
    'bottomHeight',                         -- Bottom Rail (int)
    'bottomHeightExternal',                 -- Bottom Rail (ext)
    'isMasterLeaf'                          -- Master Leaf
  );

-- ── 2. Integrate's labels on the fields that are shown ────────────────────
-- Only the label moves; the data type, the key and everything else stay as
-- Integrate's import left them. "Mid rail" becoming "Overall Meeting Stile"
-- is the one that matters: 130 is the pair's OVERALL meeting stile, from
-- which each leaf's 63 is derived, and "Mid rail" reads like a rail.
UPDATE default_field_definitions d
SET    label = v.label
FROM  (VALUES
        ('frenchCasementPart',          'midRail',              'Overall Meeting Stile'),
        ('frenchCasementPart',          'thickness',            'Thickness'),
        ('frenchCasementPart',          'casementTypeId',       'Sash Type'),
        ('frenchCasementPart',          'internalWidth',        'Internal Frame Width'),
        ('frenchCasementPart',          'internalHeight',       'Internal Frame Height'),
        ('frenchCasementPart',          'internalFrameWidth',   'Internal Frame Width'),
        ('frenchCasementPart',          'internalFrameHeight',  'Internal Frame Height'),
        ('leftFrenchCasementSashPart',  'topHeight',            'Sash Head'),
        ('leftFrenchCasementSashPart',  'leftWidth',            'Left Stile'),
        ('leftFrenchCasementSashPart',  'rightWidth',           'Right Stile'),
        ('leftFrenchCasementSashPart',  'bottomHeight',         'Bottom Rail (int)'),
        ('leftFrenchCasementSashPart',  'bottomHeightExternal', 'Bottom Rail (ext)'),
        ('leftFrenchCasementSashPart',  'isMasterLeaf',         'Master Leaf'),
        ('leftFrenchCasementSashPart',  'operation',            'Operation'),
        ('leftFrenchCasementSashPart',  'toBeReplaced',         'To Be Replaced'),
        ('rightFrenchCasementSashPart', 'topHeight',            'Sash Head'),
        ('rightFrenchCasementSashPart', 'leftWidth',            'Left Stile'),
        ('rightFrenchCasementSashPart', 'rightWidth',           'Right Stile'),
        ('rightFrenchCasementSashPart', 'bottomHeight',         'Bottom Rail (int)'),
        ('rightFrenchCasementSashPart', 'bottomHeightExternal', 'Bottom Rail (ext)'),
        ('rightFrenchCasementSashPart', 'isMasterLeaf',         'Master Leaf'),
        ('rightFrenchCasementSashPart', 'operation',            'Operation'),
        ('rightFrenchCasementSashPart', 'toBeReplaced',         'To Be Replaced')
      ) AS v(part_type, property_name, label)
WHERE  d.part_type = v.part_type
  AND  d.property_name = v.property_name
  AND  d.label IS DISTINCT FROM v.label;

-- ── 3. Add a definition for anything in the allow-list that has none ──────
-- A field with no definition cannot appear on the panel at all. These are
-- the keys the board's own trees store, so each has a value to show.
-- data_type matches what the tree holds; role 'input' is what the board
-- displays. Nothing is overwritten: ON CONFLICT DO NOTHING.
INSERT INTO default_field_definitions
  (part_type, property_name, field_key, label, data_type, role, is_required, sort_order, is_active)
VALUES
  ('frenchCasementPart', 'midRail',   'frenchCasementPart.midRail',   'Overall Meeting Stile', 'number',    'input', false, 30, true),
  ('frenchCasementPart', 'thickness', 'frenchCasementPart.thickness', 'Thickness',             'number',    'input', false, 40, true),
  ('frenchCasementPart', 'casementTypeId', 'frenchCasementPart.casementTypeId', 'Sash Type',   'reference', 'input', false, 20, true),
  ('leftFrenchCasementSashPart',  'isMasterLeaf', 'leftFrenchCasementSashPart.isMasterLeaf',  'Master Leaf', 'boolean', 'input', false, 90, true),
  ('rightFrenchCasementSashPart', 'isMasterLeaf', 'rightFrenchCasementSashPart.isMasterLeaf', 'Master Leaf', 'boolean', 'input', false, 90, true)
ON CONFLICT (field_key) DO NOTHING;

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. What the pair's panel will show. Expect only Internal Frame Width /
--    Height, Sash Type, Overall Meeting Stile and Thickness — and no
--    "Mid rail", "Meeting stile overlap" or "Has floating mullion".
SELECT property_name, label, data_type, sort_order
FROM   default_field_definitions
WHERE  part_type = 'frenchCasementPart'
  AND  is_active AND coalesce(role, '') <> 'config'
ORDER  BY sort_order, property_name;

-- 2. What a leaf's panel will show. Expect the eleven Integrate shows, less
--    the Divider Spacing buttons, which are the board's own.
SELECT part_type, property_name, label, data_type, sort_order
FROM   default_field_definitions
WHERE  part_type IN ('leftFrenchCasementSashPart', 'rightFrenchCasementSashPart')
  AND  is_active AND coalesce(role, '') <> 'config'
ORDER  BY part_type, sort_order, property_name;

-- 3. What has been hidden — stored and editable on Defaults & Parts, just
--    not on the drawing board.
SELECT part_type, property_name, label
FROM   default_field_definitions
WHERE  part_type IN ('frenchCasementPart', 'leftFrenchCasementSashPart',
                     'rightFrenchCasementSashPart')
  AND  role = 'config'
ORDER  BY part_type, property_name;


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- Section 1 is the only part that needs undoing by hand, and it needs
-- SECTION 0b's output: that is the list of fields whose role was 'input'
-- before, so put those back and leave the rest alone.
--
-- UPDATE default_field_definitions
-- SET    role = 'input'
-- WHERE  part_type IN ('frenchCasementPart', 'leftFrenchCasementSashPart',
--                      'rightFrenchCasementSashPart')
--   AND  property_name IN ( <the property_name list from section 0b> );
--
-- Section 2 (labels) and section 3 (new definitions):
--
-- UPDATE default_field_definitions SET label = 'Mid rail'
-- WHERE  part_type = 'frenchCasementPart' AND property_name = 'midRail';
--
-- DELETE FROM default_field_definitions
-- WHERE  field_key IN (
--   'frenchCasementPart.midRail',
--   'frenchCasementPart.thickness',
--   'frenchCasementPart.casementTypeId',
--   'leftFrenchCasementSashPart.isMasterLeaf',
--   'rightFrenchCasementSashPart.isMasterLeaf'
-- );
--
-- The DELETE is only right for a row section 3 CREATED. If section 0a showed
-- the row already existed, leave it: deleting it would remove one of
-- Integrate's own.
