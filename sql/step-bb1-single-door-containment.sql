-- Step BB-1: containment for a SINGLE garden door.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run. RUN THIS FIRST.
-- Run BEFORE sql/step-bb2 — save_drawing_parts rejects a tree whose
-- parent/child pairs it does not know, so a single-door template would fail
-- to save even though the board built it correctly.
--
-- Integrate stores a single door as a plain `DoorLeafPart` DIRECTLY in a
-- frame opening — no pair part at all, which is the whole difference from a
-- French door (docs/integrate-L31115-single-doors.txt, SD1).
--
-- The live table already has `doorLeafPart -> glassPart` and
-- `doorLeafPart -> panelPart`, but NOTHING lets a frame hold a
-- `doorLeafPart`. assertSaveable on the board's own SD1 tree named it:
--
--   assemblyFramePart -> doorLeafPart          (the missing one)
--   doorLeafPart      -> glassPart             (expected to exist already)
--   doorLeafPart      -> transomPart           (a panelled single door's mid
--                                               rail, as the French leaves)
--
-- The frame pair is `0, NULL` — a frame opening, exactly as
-- `assemblyFramePart -> casementSashPart` is — because a doorset frame holds
-- a door AND its side lights, so it is not a singleton. SECTION 0 reads the
-- casement row to copy before anything changes. RUN SECTION 0 FIRST.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. How a frame opening is set up today. `assemblyFramePart ->
--     casementSashPart` is the row this step copies; expect min 0, max NULL.
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  parent_code = 'assemblyFramePart'
ORDER  BY sort_order, child_code;

-- 0b. Every pair a door leaf already has. Expect glassPart and panelPart, and
--     NO frame pair and NO transomPart.
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  parent_code = 'doorLeafPart' OR child_code = 'doorLeafPart'
ORDER  BY parent_code, sort_order;

-- 0c. The part type itself. Expect it to exist, be a container, and NOT be a
--     singleton — a doorset frame holds a door and its side lights.
SELECT code, label, is_container, is_singleton, is_active, sort_order
FROM   part_types
WHERE  code = 'doorLeafPart';


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the pairs
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- A frame holds any number of door leaves (0, NULL), as it holds casement
-- sashes; a leaf holds its own glass, at most one mid rail and at most one
-- panel. ON CONFLICT DO NOTHING, so the rows that already exist are left
-- exactly as they are — including their min / max, which this file does not
-- presume to change.
INSERT INTO part_type_children (parent_code, child_code, min_count, max_count, sort_order)
VALUES
  ('assemblyFramePart', 'doorLeafPart', 0, NULL, 60),
  ('doorLeafPart',      'glassPart',    0, NULL, 10),
  ('doorLeafPart',      'transomPart',  0, 1,    20),
  ('doorLeafPart',      'panelPart',    0, 1,    30)
ON CONFLICT (parent_code, child_code) DO NOTHING;

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. All four pairs are there. Expect 4 rows.
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  (parent_code = 'assemblyFramePart' AND child_code = 'doorLeafPart')
   OR  (parent_code = 'doorLeafPart' AND child_code IN ('glassPart', 'transomPart', 'panelPart'))
ORDER  BY parent_code, sort_order;

-- 2. A frame's whole opening list, for comparison with 0a — the door leaf
--    should now sit beside casementSashPart, glassPart and frenchDoorPart.
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  parent_code = 'assemblyFramePart'
ORDER  BY sort_order, child_code;


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- Removing the frame pair makes every SAVED single door unsaveable, so the
-- templates (sql/step-bb2) and any drawing made from them have to go first.
-- Only the rows this file could have ADDED are listed: doorLeafPart ->
-- glassPart / panelPart pre-date this step (SECTION 0b proves which), so
-- deleting them would undo somebody else's work.
--
-- DELETE FROM part_type_children
-- WHERE (parent_code = 'assemblyFramePart' AND child_code = 'doorLeafPart')
--    OR (parent_code = 'doorLeafPart' AND child_code = 'transomPart');
