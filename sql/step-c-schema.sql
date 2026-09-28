-- ============================================================
-- Step (c) — Sash geometry: reference data, field definitions,
--            and profile defaults.
--
-- DO NOT RUN — paste into Supabase SQL editor.
--
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Reference category: sash_split
--    Describes how the two sashes share the available glass height.
-- ============================================================

INSERT INTO reference_categories (code, label, sort_order)
VALUES ('sash_split', 'Sash Split', 200)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. Sash split options
-- ============================================================

INSERT INTO reference_options (category_code, code, label, sort_order)
VALUES
  ('sash_split', 'half_half',          'Half / Half',             10),
  ('sash_split', 'third_two_thirds',   'Third / Two Thirds',      20),
  ('sash_split', 'set_top',            'Set Top Sash Height',     30),
  ('sash_split', 'set_bottom',         'Set Bottom Sash Height',  40)
ON CONFLICT (category_code, code) DO NOTHING;

-- ============================================================
-- 3. Field definitions for sashPairPart
--    Input fields (midrailHeight, sashSplit, fixedSashHeight)
--    and derived fields (sashWidth, topSashHeight, bottomSashHeight).
-- ============================================================

INSERT INTO field_definitions
  (field_key, part_type, property_name, label, data_type, reference_category, unit, role, sort_order, is_active)
VALUES
  -- Input: Meeting rail height
  ('sashPairPart.midrailHeight',  'sashPairPart', 'midrailHeight',  'Meeting rail (M)',    'number',    NULL,         'mm', 'input',   150, true),
  -- Input: Sash split mode
  ('sashPairPart.sashSplit',      'sashPairPart', 'sashSplit',      'Sash split',          'reference', 'sash_split', NULL, 'input',   155, true),
  -- Input: Fixed sash height (used by set_top / set_bottom)
  ('sashPairPart.fixedSashHeight','sashPairPart', 'fixedSashHeight','Fixed sash height',   'number',    NULL,         'mm', 'input',   160, true),
  -- Derived: Sash width
  ('sashPairPart.sashWidth',      'sashPairPart', 'sashWidth',      'Sash width',          'number',    NULL,         'mm', 'derived', 200, true),
  -- Derived: Top sash height
  ('sashPairPart.topSashHeight',  'sashPairPart', 'topSashHeight',  'Top sash height',     'number',    NULL,         'mm', 'derived', 201, true),
  -- Derived: Bottom sash height
  ('sashPairPart.bottomSashHeight','sashPairPart','bottomSashHeight','Bottom sash height',  'number',    NULL,         'mm', 'derived', 202, true)
ON CONFLICT (field_key) DO NOTHING;

-- ============================================================
-- 4. Derived fields on topSashPart and bottomSashPart
-- ============================================================

INSERT INTO field_definitions
  (field_key, part_type, property_name, label, data_type, reference_category, unit, role, sort_order, is_active)
VALUES
  ('topSashPart.sashHeight',    'topSashPart',    'sashHeight', 'Sash height (computed)', 'number', NULL, 'mm', 'derived', 200, true),
  ('bottomSashPart.sashHeight', 'bottomSashPart', 'sashHeight', 'Sash height (computed)', 'number', NULL, 'mm', 'derived', 200, true)
ON CONFLICT (field_key) DO NOTHING;

-- ============================================================
-- 5. Profile defaults for profile with code = 'sash'
--
-- Note: bottomSashPart.bottomHeight = '88' is already set by
-- applyOperationDefaults via defaultCordCillHeight, but
-- midrailHeight must be set separately as a profile default
-- because it is not touched by operation defaults.
-- ============================================================

INSERT INTO default_profile_values (profile_id, field_key, default_value)
SELECT p.id, v.field_key, v.default_value
FROM (
  VALUES
    ('sashPairPart.midrailHeight', '40'),
    ('sashPairPart.sashSplit',     'half_half')
) AS v(field_key, default_value)
CROSS JOIN (SELECT id FROM default_profiles WHERE code = 'sash') AS p
ON CONFLICT (profile_id, field_key) DO NOTHING;

-- Ensure bottomSashPart.bottomHeight default exists (set by operation defaults
-- but adding as a profile default as a safety net so the tree is fully populated
-- even before an operation is selected).
INSERT INTO default_profile_values (profile_id, field_key, default_value)
SELECT p.id, 'bottomSashPart.bottomHeight', '88'
FROM (SELECT id FROM default_profiles WHERE code = 'sash') AS p
ON CONFLICT (profile_id, field_key) DO NOTHING;

COMMIT;
