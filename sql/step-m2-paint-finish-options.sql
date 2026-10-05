-- step-m2-paint-finish-options.sql
-- Creates the paint_finish reference category and its options, and seeds
-- profile default values for Internal/External/Cill Finish so the Quote
-- Overview grid resolves them instead of showing "—".
--
-- Run after: all existing migrations + step-m1
-- Rollback: step-m2-paint-finish-options-rollback.sql

BEGIN;

-- 1. Reference category
INSERT INTO reference_categories (category, label, group_name, is_multi, has_quantity, sort_order)
VALUES ('paint_finish', 'Paint Finish', 'Finish', false, false, 260)
ON CONFLICT (category) DO NOTHING;

-- 2. Reference options (matching QuoteDrawer.jsx FINISH_OPTIONS)
INSERT INTO reference_options (category, code, label, sort_order, is_active)
VALUES
  ('paint_finish', 'clean_white',         'Clean White',         10, true),
  ('paint_finish', 'white_gloss',         'White Gloss',         20, true),
  ('paint_finish', 'white_satin',         'White Satin',         30, true),
  ('paint_finish', 'colour_match_satin',  'Colour Match Satin',  40, true),
  ('paint_finish', 'colour_match_gloss',  'Colour Match Gloss',  50, true)
ON CONFLICT DO NOTHING;

-- 3. Profile default values for the "sash" default profile.
--    Only insert if the profile exists and doesn't already have these values.
INSERT INTO default_profile_values (profile_id, field_key, default_value, source_ref)
SELECT p.id, v.field_key, v.default_value, v.source_ref
FROM default_profiles p
CROSS JOIN (VALUES
  ('paintAndIronmongeryPart.internalFinish', 'Clean White', 'clean_white'),
  ('paintAndIronmongeryPart.externalFinish', 'Clean White', 'clean_white'),
  ('paintAndIronmongeryPart.cillFinish',     'Clean White', 'clean_white')
) AS v(field_key, default_value, source_ref)
WHERE p.code = 'sash'
  AND NOT EXISTS (
    SELECT 1 FROM default_profile_values dpv
    WHERE dpv.profile_id = p.id AND dpv.field_key = v.field_key
  );

COMMIT;
