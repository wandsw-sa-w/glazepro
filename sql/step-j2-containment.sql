-- ============================================================
-- Step J2 — containment rows for J1's new part types
--
-- DO NOT RUN — paste into Supabase SQL editor.
--
-- Fixes: save_drawing_parts: forbidden parent→child pair(s):
-- glassPart(...) → verticalGlazingBarPart ...
--
-- sql/step-j1-parts.sql added field definitions for mullionPart,
-- transomPart, verticalGlazingBarPart and horizontalGlazingBarPart but no
-- part_type_children rows, so save_drawing_parts (see check #3 in
-- supabase/migrations/20260924_step_b1b_fixes.sql) rejects every edge the
-- Transom/Mullion... and Glazing bar... UI actions try to create.
--
-- Safe to re-run: every statement uses ON CONFLICT DO NOTHING.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. part_type_children.parent_code / child_code are FK -> part_types.code.
--    Add the four J1 part types first in case they aren't there yet.
-- ============================================================

INSERT INTO part_types (code, label, is_container, is_singleton, is_active, sort_order)
VALUES
  ('mullionPart',              'Mullion',        false, false, true, 100),
  ('transomPart',              'Transom',        false, false, true, 110),
  ('verticalGlazingBarPart',   'Vertical GB',    false, false, true, 120),
  ('horizontalGlazingBarPart', 'Horizontal GB',  false, false, true, 130)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. Containment — every parent -> child pair the drawing board UI can
--    create today.
--
--    - Transom/Mullion... (DrawingBoard.jsx applyDividers) always targets
--      the frame node: assemblyFramePart -> mullionPart / transomPart.
--    - Glazing bar... (DrawingBoard.jsx applyBars) is only enabled when a
--      glassPart node is selected: glassPart -> verticalGlazingBarPart /
--      horizontalGlazingBarPart.
--    - assemblyFramePart -> sashPairPart (multiple, for double/triple box
--      sash openings — Step K's fix #4) is included here too and left
--      unconstrained (max_count NULL); Step A already left it that way,
--      this just makes sure it stays true.
-- ============================================================

INSERT INTO part_type_children (parent_code, child_code, min_count, max_count, sort_order)
VALUES
  ('assemblyFramePart', 'mullionPart',              0, NULL, 20),
  ('assemblyFramePart', 'transomPart',               0, NULL, 30),
  ('assemblyFramePart', 'sashPairPart',              0, NULL, 70),
  ('glassPart',         'verticalGlazingBarPart',   0, NULL, 10),
  ('glassPart',         'horizontalGlazingBarPart', 0, NULL, 20)
ON CONFLICT (parent_code, child_code) DO NOTHING;

COMMIT;
