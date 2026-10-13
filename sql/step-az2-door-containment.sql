-- Step AZ-2: containment for the French door parts.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run.
-- Run AFTER sql/step-az1 and BEFORE sql/step-az3 — save_drawing_parts rejects
-- a tree whose parent/child pairs it does not know, so a door template would
-- fail to save.
--
-- Integrate stores a French door the way it stores a French casement: ONE
-- opening holding a PAIR, and no mullion
-- (docs/integrate-L31115-french-doors.txt):
--
--   assemblyFramePart
--     ├ transomPart                    only on a doorset with a fanlight
--     ├ casementSashPart               the fanlight itself
--     ├ frenchDoorPart                 the pair
--     │   ├ leftFrenchDoorLeafPart
--     │   │   └ glassPart
--     │   └ rightFrenchDoorLeafPart
--     │       └ glassPart
--     └ cillPart
--
-- The transom and the casement sash beside the pair are ALREADY allowed (the
-- casement steps added them), so section 2 adds only the five door pairs.
-- They match ALLOWED_PAIRS in src/drawingBoard/containment.js exactly.
--
-- NOT VERIFIED: the three part types came from Integrate's own import and
-- should already be in part_types — section 1 only fills a gap and never
-- changes a row that is there. I cannot read the live rows, so section 0 is
-- what proves it. RUN SECTION 0 FIRST.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. The door part types, as they stand.
SELECT code, label, is_container, is_singleton, is_active, sort_order
FROM   part_types
WHERE  code ILIKE '%door%'
ORDER  BY sort_order, code;

-- 0b. Every containment pair that mentions a door, and the casement pairs
--     the fanlight needs (expect assemblyFramePart -> transomPart and
--     -> casementSashPart to be there already).
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  parent_code ILIKE '%door%' OR child_code ILIKE '%door%'
   OR  (parent_code = 'assemblyFramePart' AND child_code IN ('transomPart','casementSashPart'))
ORDER  BY parent_code, sort_order;

-- 0c. The open_out_doors profile and the values a door needs. The board
--     REFUSES to build a door without every one of these rather than
--     guessing a thickness or a meeting stile, so this is the query to send
--     the reviewer if a template will not build.
SELECT p.code AS profile, v.field_key, v.default_value
FROM   default_profile_values v
JOIN   default_profiles p ON p.id = v.profile_id
WHERE  p.code = 'open_out_doors'
  AND (v.field_key LIKE 'frenchDoor%' OR v.field_key LIKE '%DoorLeaf%'
       OR v.field_key LIKE 'assemblyFramePart.%' OR v.field_key LIKE 'cillPart.%'
       OR v.field_key LIKE 'transomPart.%' OR v.field_key LIKE 'casementSashPart.%'
       OR v.field_key LIKE 'glassPart.%')
ORDER  BY v.field_key;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTIONS 1-2 — the change
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. The part types (no-ops if Integrate's import already has them) ──────
-- part_type_children.parent_code / child_code are FK -> part_types.code.
INSERT INTO part_types (code, label, is_container, is_singleton, is_active, sort_order)
VALUES
  ('frenchDoorPart',           'French Door',             true, false, true, 170),
  ('leftFrenchDoorLeafPart',   'French Door Leaf Left',   true, true,  true, 180),
  ('rightFrenchDoorLeafPart',  'French Door Leaf Right',  true, true,  true, 190)
ON CONFLICT (code) DO NOTHING;

-- ── 2. Containment ────────────────────────────────────────────────────────
-- The pair holds exactly one of each leaf — min 1, max 1 — because a French
-- door with one leaf is not a French door, and the board never builds a
-- second. Each leaf holds its own glass.
INSERT INTO part_type_children (parent_code, child_code, min_count, max_count, sort_order)
VALUES
  ('assemblyFramePart',          'frenchDoorPart',           0, NULL, 50),
  ('frenchDoorPart',             'leftFrenchDoorLeafPart',   1, 1,    10),
  ('frenchDoorPart',             'rightFrenchDoorLeafPart',  1, 1,    20),
  ('leftFrenchDoorLeafPart',     'glassPart',                0, NULL, 10),
  ('rightFrenchDoorLeafPart',    'glassPart',                0, NULL, 10)
ON CONFLICT (parent_code, child_code) DO NOTHING;

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. The three part types.
SELECT code, label, is_container, is_singleton, is_active, sort_order
FROM   part_types
WHERE  code IN ('frenchDoorPart','leftFrenchDoorLeafPart','rightFrenchDoorLeafPart')
ORDER  BY sort_order;

-- 2. The five pairs. Expect exactly these five rows.
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  parent_code IN ('frenchDoorPart','leftFrenchDoorLeafPart','rightFrenchDoorLeafPart')
   OR  child_code = 'frenchDoorPart'
ORDER  BY parent_code, sort_order;

-- 3. A doorset's fanlight needs these two as well — expect both present. If
--    either is missing, a "French Doors With Fanlight" drawing will not save
--    and sql/step-az3 should not be run until it is added.
SELECT parent_code, child_code
FROM   part_type_children
WHERE  parent_code = 'assemblyFramePart'
  AND  child_code IN ('transomPart', 'casementSashPart')
ORDER  BY child_code;


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- DELETE FROM part_type_children
-- WHERE (parent_code, child_code) IN (
--   ('assemblyFramePart',          'frenchDoorPart'),
--   ('frenchDoorPart',             'leftFrenchDoorLeafPart'),
--   ('frenchDoorPart',             'rightFrenchDoorLeafPart'),
--   ('leftFrenchDoorLeafPart',     'glassPart'),
--   ('rightFrenchDoorLeafPart',    'glassPart')
-- );
-- -- The part_types rows are left alone: they came from Integrate's import,
-- -- and section 1 only inserts one that is missing. Check section 0a's
-- -- output before deleting any of them.
