-- Step BD-2: containment for a FRONT DOOR's leaf grid.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run.
-- Run BEFORE sql/step-bd3 — save_drawing_parts rejects a tree whose
-- parent/child pairs it does not know, so a front-door template would fail
-- to save even though the board built it correctly.
--
-- A front door leaf is divided like a little frame. Integrate stores, INSIDE
-- the leaf (docs/integrate-L31115-front-doors.txt):
--
--   MullionPart   a 120 muntin, full height between the rails
--   TransomPart   a mid rail (isMidrail), 170 — or 120 on the arched door
--   PanelPart / GlassPart   one per cell the two make
--
-- The leaf's mid rail, its panel and its glass are already allowed
-- (sql/step-ba1 and sql/step-bb1). The MUNTIN is not — the board's own
-- assertSaveable named it on the four-panel template:
--
--   doorLeafPart -> mullionPart          (the missing one)
--
-- and the same pair is added for both FRENCH door leaves, so a panelled
-- French door can take a muntin too without another SQL file.
--
-- THE MAX COUNTS CHANGE TOO. A leaf's mid rail and panel are capped at ONE
-- each (sql/step-bb1, where a leaf meant "glass above, one panel below"). A
-- four-panel door has FOUR panels and may have more than one mid rail, so
-- both caps are lifted to NULL. That is the only change this file makes to a
-- row that already exists, and SECTION 0 reads those rows first.
--
-- RUN SECTION 0 FIRST.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. Every pair a door leaf has today. Expect glassPart (0, NULL),
--     transomPart (0, 1) and panelPart (0, 1) — and NO mullionPart.
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  parent_code IN ('doorLeafPart', 'leftFrenchDoorLeafPart', 'rightFrenchDoorLeafPart')
ORDER  BY parent_code, sort_order, child_code;

-- 0b. How a MULLION is allowed in a frame, which is the row this copies.
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  child_code = 'mullionPart'
ORDER  BY parent_code;

-- 0c. The part types involved, so a cap can be judged rather than assumed.
SELECT code, label, is_container, is_singleton, is_active
FROM   part_types
WHERE  code IN ('doorLeafPart', 'mullionPart', 'transomPart', 'panelPart')
ORDER  BY code;

-- 0d. Anything SAVED that would be affected by lifting the caps — i.e. a
--     drawing whose leaf already holds more than one panel. Expect 0 rows:
--     nothing could have saved one while the cap was 1.
SELECT d.id AS drawing_id, count(*) AS panels_in_one_leaf
FROM   public.drawing_parts p
JOIN   public.drawing_parts l ON l.id = p.parent_id
JOIN   public.drawings d      ON d.id = p.drawing_id
WHERE  p.part_type = 'panelPart'
  AND  l.part_type IN ('doorLeafPart', 'leftFrenchDoorLeafPart', 'rightFrenchDoorLeafPart')
GROUP  BY d.id, l.id
HAVING count(*) > 1
ORDER  BY d.id;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the muntin, and the caps a grid needs
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- The muntin, on all three leaf types. (0, NULL): a leaf has none, one, or
-- as many as the layout asks for.
INSERT INTO part_type_children (parent_code, child_code, min_count, max_count, sort_order)
VALUES
  ('doorLeafPart',            'mullionPart', 0, NULL, 15),
  ('leftFrenchDoorLeafPart',  'mullionPart', 0, NULL, 15),
  ('rightFrenchDoorLeafPart', 'mullionPart', 0, NULL, 15)
ON CONFLICT (parent_code, child_code) DO NOTHING;

-- A leaf's own grid can hold several mid rails and several panels. Only the
-- LEAF rows are touched: a FRAME's transom cap, whatever it is, is somebody
-- else's decision and is left exactly as it is.
UPDATE part_type_children
SET    max_count = NULL
WHERE  parent_code IN ('doorLeafPart', 'leftFrenchDoorLeafPart', 'rightFrenchDoorLeafPart')
  AND  child_code IN ('transomPart', 'panelPart')
  AND  max_count = 1;

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. Each leaf type now holds a muntin, a mid rail, a panel and glass, with
--    no cap on any of the four. Expect 12 rows, max_count NULL throughout.
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  parent_code IN ('doorLeafPart', 'leftFrenchDoorLeafPart', 'rightFrenchDoorLeafPart')
ORDER  BY parent_code, sort_order, child_code;

-- 2. Nothing else moved: the frame's own dividers keep their caps.
SELECT parent_code, child_code, min_count, max_count
FROM   part_type_children
WHERE  parent_code = 'assemblyFramePart'
  AND  child_code IN ('mullionPart', 'transomPart')
ORDER  BY child_code;


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- Taking the muntin pair away makes every saved FRONT DOOR unsaveable, so
-- the templates (sql/step-bd3) and any drawing made from them have to go
-- first. Putting the caps back to 1 would make a four-panel door unsaveable
-- for the same reason, so the second statement is only safe if no panelled
-- door with more than one panel has ever been saved — SECTION 0d is the
-- query that says.
--
-- BEGIN;
-- DELETE FROM part_type_children
-- WHERE  child_code = 'mullionPart'
--   AND  parent_code IN ('doorLeafPart', 'leftFrenchDoorLeafPart', 'rightFrenchDoorLeafPart');
--
-- UPDATE part_type_children
-- SET    max_count = 1
-- WHERE  parent_code IN ('doorLeafPart', 'leftFrenchDoorLeafPart', 'rightFrenchDoorLeafPart')
--   AND  child_code IN ('transomPart', 'panelPart');
-- COMMIT;
