-- Migration: 20260928_pricing_item_fields
-- Adds 4 new fields to drawingItemPart for Pricing Step 2:
--   floorLevel, bayFullyCoupledFrames, frameInKitForm, bayPoleRequired
--
-- Also adds the floor_level reference category and its options.
-- All inserts use ON CONFLICT DO NOTHING so the migration is idempotent.

-- ── 1. floor_level reference category ────────────────────────────────────────

INSERT INTO reference_categories
  (category, label, group_name, is_multi, has_quantity, sort_order)
VALUES
  ('floor_level', 'Floor Level', 'Product', false, false, 410)
ON CONFLICT (category) DO NOTHING;

-- ── 2. floor_level reference options ─────────────────────────────────────────

INSERT INTO reference_options
  (category, code, label, sort_order, is_active)
VALUES
  ('floor_level', 'ground_floor',  'Ground Floor',  10, true),
  ('floor_level', 'first_floor',   'First Floor',   20, true),
  ('floor_level', 'second_floor',  'Second Floor',  30, true),
  ('floor_level', 'third_floor',   'Third Floor',   40, true),
  ('floor_level', 'fourth_floor',  'Fourth Floor',  50, true),
  ('floor_level', 'fifth_floor',   'Fifth Floor',   60, true),
  ('floor_level', 'half_landing',  'Half Landing',  70, true)
ON CONFLICT (category, code) DO NOTHING;

-- ── 3. New input fields on drawingItemPart ────────────────────────────────────

INSERT INTO default_field_definitions
  ( part_type,
    field_key,
    property_name,
    label,
    data_type,
    visibility,
    sort_order,
    is_active,
    group_name,
    unit,
    role,
    reference_category,
    part_category,
    is_required )
VALUES
  -- floorLevel: reference drop-down
  ( 'drawingItemPart',
    'drawingItemPart.floorLevel',
    'floorLevel',
    'Floor Level',
    'reference',
    'visible',
    652,
    TRUE,
    'drawingItemPart',
    NULL,
    'input',
    'floor_level',
    NULL,
    FALSE ),

  -- bayFullyCoupledFrames: boolean checkbox
  ( 'drawingItemPart',
    'drawingItemPart.bayFullyCoupledFrames',
    'bayFullyCoupledFrames',
    'Bay Fully Coupled Frames',
    'boolean',
    'visible',
    653,
    TRUE,
    'drawingItemPart',
    NULL,
    'input',
    NULL,
    NULL,
    FALSE ),

  -- frameInKitForm: boolean checkbox
  ( 'drawingItemPart',
    'drawingItemPart.frameInKitForm',
    'frameInKitForm',
    'Frame in Kit Form',
    'boolean',
    'visible',
    654,
    TRUE,
    'drawingItemPart',
    NULL,
    'input',
    NULL,
    NULL,
    FALSE ),

  -- bayPoleRequired: boolean checkbox
  ( 'drawingItemPart',
    'drawingItemPart.bayPoleRequired',
    'bayPoleRequired',
    'Bay Pole Required',
    'boolean',
    'visible',
    655,
    TRUE,
    'drawingItemPart',
    NULL,
    'input',
    NULL,
    NULL,
    FALSE )

ON CONFLICT (field_key) DO NOTHING;
