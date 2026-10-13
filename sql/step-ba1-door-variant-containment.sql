-- Step BA-1: containment for a PANELLED door leaf.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run. RUN THIS FIRST.
-- Run BEFORE sql/step-ba2 — save_drawing_parts rejects a tree whose
-- parent/child pairs it does not know, so a panelled template would fail to
-- save even though the board built it correctly.
--
-- Integrate splits a panelled door leaf with a TransomPart INSIDE the leaf
-- (isMidrail true, 170 thick) and puts a PanelPart below the rail
-- (docs/integrate-L31115-french-doors.txt, FD4 / template 79). GlazePro
-- models it the same way, so a door LEAF now holds three kinds of child: its
-- mid rail, its glass and its panel.
--
-- FOUR PAIRS, and nothing else. assertSaveable on the board's own FD4 tree
-- named exactly these four as forbidden, which is what this file adds:
--
--   leftFrenchDoorLeafPart  -> transomPart
--   rightFrenchDoorLeafPart -> transomPart
--   leftFrenchDoorLeafPart  -> panelPart
--   rightFrenchDoorLeafPart -> panelPart
--
-- `panelPart` and `transomPart` already exist as part types (the frame uses
-- both), so nothing is created here — only the pairs. SECTION 0 proves that
-- before anything changes. RUN SECTION 0 FIRST.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. The two part types this file joins up. Expect both to exist and be
--     active; if panelPart is missing, STOP — nothing below will help.
SELECT code, label, is_container, is_singleton, is_active, sort_order
FROM   part_types
WHERE  code IN ('panelPart', 'transomPart')
ORDER  BY code;

-- 0b. Every containment pair a door leaf or a panel already has. Expect the
--     two glassPart pairs from sql/step-az2 and NO panel or transom pair.
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  parent_code IN ('leftFrenchDoorLeafPart', 'rightFrenchDoorLeafPart')
   OR  child_code  IN ('panelPart')
ORDER  BY parent_code, sort_order;

-- 0c. Where a panel is allowed today, for comparison — the frame's own
--     panels (a panel in a frame is priced by "Panel to Frame", a panel in a
--     leaf is not).
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  child_code = 'panelPart'
ORDER  BY parent_code;

-- 0d. Are there panel OPTION rows? GlazePro stores a panel type and bead as
--     CODES; this step's trees use 'raised_and_fielded' and 'ovolo', which
--     are Integrate's own defaults 110 and 120. If these categories do not
--     exist, the panels still price (the engine maps both the codes and
--     Integrate's ids) but the board's panel panel will have nothing to pick
--     from — tell the reviewer either way.
SELECT category, code, label, sort_order, is_active
FROM   reference_options
WHERE  category IN ('panel_type', 'panel_bead')
ORDER  BY category, sort_order;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the four pairs
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- A leaf holds at most ONE mid rail (one panel under one rail is what
-- Integrate draws and what the board builds), and at most one panel. Both
-- are optional: a fully glazed leaf has neither.
INSERT INTO part_type_children (parent_code, child_code, min_count, max_count, sort_order)
VALUES
  ('leftFrenchDoorLeafPart',  'transomPart', 0, 1, 20),
  ('rightFrenchDoorLeafPart', 'transomPart', 0, 1, 20),
  ('leftFrenchDoorLeafPart',  'panelPart',   0, 1, 30),
  ('rightFrenchDoorLeafPart', 'panelPart',   0, 1, 30)
ON CONFLICT (parent_code, child_code) DO NOTHING;

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. The four pairs are there. Expect 4 rows.
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  (parent_code IN ('leftFrenchDoorLeafPart', 'rightFrenchDoorLeafPart')
        AND child_code IN ('transomPart', 'panelPart'))
ORDER  BY parent_code, sort_order;

-- 2. A door leaf's whole containment, in one place.
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  parent_code IN ('leftFrenchDoorLeafPart', 'rightFrenchDoorLeafPart')
ORDER  BY parent_code, sort_order;


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- Removing these pairs makes every SAVED panelled door unsaveable, so the
-- templates (sql/step-ba2) and any drawing made from them have to go first.
--
-- DELETE FROM part_type_children
-- WHERE parent_code IN ('leftFrenchDoorLeafPart', 'rightFrenchDoorLeafPart')
--   AND child_code  IN ('transomPart', 'panelPart');
