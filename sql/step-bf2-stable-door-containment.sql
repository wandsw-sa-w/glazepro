-- Step BF-2: containment for a STABLE DOOR.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run. RUN THIS FIRST,
-- before sql/step-bf4: save_drawing_parts refuses a tree whose parent/child
-- pairs it does not know, so a stable-door template could not be saved.
--
-- Integrate stores a StableDoorPart in the frame holding a Top and a Bottom
-- StableDoorLeafPart (docs/integrate-L31115-stable-doors.txt). GlazePro
-- stores the container with two ORDINARY doorLeafParts in it, each marked
-- `stableHalf` — so door_leaf_qty is 2, the door_leaf loop visits both and
-- every rule that knows a door leaf needs no change. "Door Leaf" 1035 fires
-- per half, which is what Integrate's own editor shows it does.
--
-- Three pairs:
--     assemblyFramePart -> stableDoorPart    the container is an opening
--     stableDoorPart    -> doorLeafPart      its two halves
--     panelPart         -> glassPart         a VISION PANEL, which is a small
--                                            glass unit inside a panel (its
--                                            ST2 / "Template 44")
--
-- Each half's own grid — its mid rail, its panel, its glass — is already
-- allowed: sql/step-bd2 added them for a door leaf.
--
-- RUN SECTION 0 FIRST.

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ════════════════════════════════════════════════════════════════════════════

-- 0a. Is there a stableDoorPart part type at all? If this returns nothing,
--     SECTION 1 creates it; read its shape against doorLeafPart's below.
SELECT code, label, is_container, is_singleton, is_active, sort_order
FROM   part_types
WHERE  code IN ('stableDoorPart', 'doorLeafPart', 'frenchDoorPart', 'panelPart')
ORDER  BY code;

-- 0b. What a frame may hold today. Expect doorLeafPart, casementSashPart,
--     glassPart, frenchDoorPart — and NO stableDoorPart.
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  parent_code = 'assemblyFramePart'
ORDER  BY sort_order, child_code;

-- 0c. What a panel may hold. Expect nothing: a vision panel is new.
SELECT parent_code, child_code, min_count, max_count
FROM   part_type_children
WHERE  parent_code = 'panelPart'
ORDER  BY child_code;

-- 0d. A door leaf's own pairs, which a stable HALF uses unchanged
--     (sql/step-bd2 added the muntin and lifted the caps).
SELECT parent_code, child_code, min_count, max_count
FROM   part_type_children
WHERE  parent_code = 'doorLeafPart'
ORDER  BY child_code;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the part type and the three pairs
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- The container. A frame can hold several (a pair of stable doors in one
-- frame is a real thing), so it is NOT a singleton.
INSERT INTO part_types (code, label, is_container, is_singleton, is_active, sort_order)
VALUES ('stableDoorPart', 'Stable Door', TRUE, FALSE, TRUE, 95)
ON CONFLICT (code) DO NOTHING;

INSERT INTO part_type_children (parent_code, child_code, min_count, max_count, sort_order)
VALUES
  ('assemblyFramePart', 'stableDoorPart', 0, NULL, 65),
  -- exactly two halves, and the board builds both at once
  ('stableDoorPart',    'doorLeafPart',   0, 2,    10),
  -- a VISION PANEL: one small light in a panel
  ('panelPart',         'glassPart',      0, 1,    10)
ON CONFLICT (parent_code, child_code) DO NOTHING;

COMMIT;

-- ── Checks ──────────────────────────────────────────────────────────────

-- 1. The part type. Expect one row, a container, not a singleton.
SELECT code, label, is_container, is_singleton, is_active
FROM   part_types WHERE code = 'stableDoorPart';

-- 2. The three pairs.
SELECT parent_code, child_code, min_count, max_count
FROM   part_type_children
WHERE  (parent_code = 'assemblyFramePart' AND child_code = 'stableDoorPart')
   OR  parent_code = 'stableDoorPart'
   OR  (parent_code = 'panelPart' AND child_code = 'glassPart')
ORDER  BY parent_code, child_code;

-- 3. And a frame's whole opening list, to compare with 0b.
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  parent_code = 'assemblyFramePart'
ORDER  BY sort_order, child_code;


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- Any SAVED stable door becomes unsaveable, so the templates (sql/step-bf4)
-- and every drawing made from one have to go first.
--
-- BEGIN;
-- DELETE FROM part_type_children
-- WHERE (parent_code = 'assemblyFramePart' AND child_code = 'stableDoorPart')
--    OR parent_code = 'stableDoorPart'
--    OR (parent_code = 'panelPart' AND child_code = 'glassPart');
-- DELETE FROM part_types WHERE code = 'stableDoorPart';
-- COMMIT;
