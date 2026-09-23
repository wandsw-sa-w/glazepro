-- =============================================================================
-- Step B1b rollback
-- Run this to reverse 20260924_step_b1b_fixes.sql.
-- Review before running — some steps are irreversible (option codes in
-- production profile values cannot be safely reverted without knowing the
-- exact before state).
-- =============================================================================

BEGIN;

-- e) Restore previous version of save_drawing_parts (aggregate containment check)
-- If you need the exact previous version, paste it here.
-- Minimal action: the function is idempotent via CREATE OR REPLACE —
-- re-running the step-b1 migration will restore the old function body.

-- d) Revert glassPart.glazingId profile values (codes → old text labels)
UPDATE default_profile_values
SET    default_value = CASE default_value
                           WHEN 'double_glazing' THEN 'Double'
                           WHEN 'single_glazing' THEN 'Single'
                       END
WHERE  field_key    = 'glassPart.glazingId'
  AND  default_value IN ('double_glazing', 'single_glazing');

-- c) Restore heritageSpacerDimId and heritageSpacerColourId to old categories
UPDATE default_field_definitions
SET    reference_category = 'glazing_spacer_dimension'
WHERE  field_key IN (
    'glassPart.heritageSpacerDimId',
    'visionPanelGlassPart.heritageSpacerDimId'
);

UPDATE default_field_definitions
SET    reference_category = 'glazing_spacer_colour'
WHERE  field_key IN (
    'glassPart.heritageSpacerColourId',
    'visionPanelGlassPart.heritageSpacerColourId'
);

-- b) Remove heritage spacer options and categories
DELETE FROM reference_options  WHERE category IN ('heritage_spacer_dimension', 'heritage_spacer_colour');
DELETE FROM reference_categories WHERE category IN ('heritage_spacer_dimension', 'heritage_spacer_colour');

-- a) Remove single_glazing option
DELETE FROM reference_options WHERE category = 'glazing_type' AND code = 'single_glazing';

COMMIT;
