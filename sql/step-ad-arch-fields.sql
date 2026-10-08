-- =============================================================================
-- step-ad-arch-fields.sql  (Step AD, decision 1)
-- Move the drawing board's arch input to the TOP SASH, as Integrate stores
-- it: archHead (bool), archHeight (rise of the GLASS sightline arc, mm),
-- isFrameLevelArch (frame head follows the arch), archedOuterJamb.
-- The frame-level archHead/archHeight input rows are deactivated — existing
-- drawings that stored them still price (the engine reads them as a legacy
-- top-sash arch and warns); they are just no longer offered for input.
--
-- Run AFTER the earlier pending files (step-t1, step-t2, step-u1).
-- =============================================================================

BEGIN;

-- topSashPart.archHead already exists (step_a2 migration, sort 2020s).
-- Add the three missing top-sash arch fields.
INSERT INTO default_field_definitions
    (part_type, field_key, property_name, label, data_type, visibility,
     sort_order, is_active, group_name, unit, role, reference_category,
     part_category, is_required)
VALUES
    ('topSashPart', 'topSashPart.archHeight',
     'archHeight', 'Arch Height (glass rise)', 'number', 'visible',
     2030, TRUE, 'topSashPart', 'mm', 'input', NULL, NULL, FALSE),

    ('topSashPart', 'topSashPart.isFrameLevelArch',
     'isFrameLevelArch', 'Frame-Level Arch', 'boolean', 'visible',
     2031, TRUE, 'topSashPart', NULL, 'input', NULL, NULL, FALSE),

    ('topSashPart', 'topSashPart.archedOuterJamb',
     'archedOuterJamb', 'Arched Outer Jamb', 'boolean', 'visible',
     2032, TRUE, 'topSashPart', NULL, 'input', NULL, NULL, FALSE)

ON CONFLICT (field_key) DO NOTHING;

-- Deactivate the frame-level arch INPUT fields (legacy storage still read).
UPDATE default_field_definitions
   SET is_active = FALSE
 WHERE field_key IN ('assemblyFramePart.archHead',
                     'assemblyFramePart.archHeight',
                     'assemblyFramePart.archedOuterJamb');

COMMIT;

-- =============================================================================
-- ROLLBACK — DO NOT RUN (only if the step must be reverted)
-- =============================================================================
-- BEGIN;
-- DELETE FROM default_field_definitions
--  WHERE field_key IN ('topSashPart.archHeight',
--                      'topSashPart.isFrameLevelArch',
--                      'topSashPart.archedOuterJamb');
-- UPDATE default_field_definitions
--    SET is_active = TRUE
--  WHERE field_key IN ('assemblyFramePart.archHead',
--                      'assemblyFramePart.archHeight',
--                      'assemblyFramePart.archedOuterJamb');
-- COMMIT;
