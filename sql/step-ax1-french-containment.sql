-- Step AX-1: containment for the French casement parts.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run. RUN THIS FIRST,
-- before sql/step-ax2 — save_drawing_parts rejects a tree whose parent/child
-- pairs it does not know, so a French template would fail to save.
--
-- Integrate stores a French casement as ONE opening holding a PAIR and no
-- mullion (docs/integrate-L31115-french-casements.txt):
--
--   assemblyFramePart
--     └ frenchCasementPart            the pair: thickness 57, midRail 130,
--         ├ leftFrenchCasementSashPart    gap 4, clearances 4
--         │   └ glassPart
--         └ rightFrenchCasementSashPart
--             └ glassPart
--
-- The three part types came from Integrate's own import and should already
-- be in part_types, so section 1 only fills a gap if one of them is missing
-- — it never changes a label or a flag on a row that is already there.
-- Section 2 adds the five parent -> child pairs, which match
-- ALLOWED_PAIRS in src/drawingBoard/containment.js exactly.

BEGIN;

-- ── 1. The part types (no-ops if Integrate's import already has them) ──────
-- part_type_children.parent_code / child_code are FK -> part_types.code, so
-- these have to exist before section 2.
INSERT INTO part_types (code, label, is_container, is_singleton, is_active, sort_order)
VALUES
  ('frenchCasementPart',           'French Casement',            true,  false, true, 140),
  ('leftFrenchCasementSashPart',   'French Casement Sash Left',  true,  true,  true, 150),
  ('rightFrenchCasementSashPart',  'French Casement Sash Right', true,  true,  true, 160)
ON CONFLICT (code) DO NOTHING;

-- ── 2. Containment ────────────────────────────────────────────────────────
-- The pair holds exactly one of each leaf — min 1, max 1 — because a French
-- casement with one leaf is not a French casement, and the board never
-- builds a second. Each leaf holds its own glass, like a casement sash.
INSERT INTO part_type_children (parent_code, child_code, min_count, max_count, sort_order)
VALUES
  ('assemblyFramePart',           'frenchCasementPart',          0, NULL, 40),
  ('frenchCasementPart',          'leftFrenchCasementSashPart',  1, 1,    10),
  ('frenchCasementPart',          'rightFrenchCasementSashPart', 1, 1,    20),
  ('leftFrenchCasementSashPart',  'glassPart',                   0, NULL, 10),
  ('rightFrenchCasementSashPart', 'glassPart',                   0, NULL, 10)
ON CONFLICT (parent_code, child_code) DO NOTHING;

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. The three part types, with whatever label Integrate's import gave them.
SELECT code, label, is_container, is_singleton, is_active, sort_order
FROM   part_types
WHERE  code IN ('frenchCasementPart', 'leftFrenchCasementSashPart',
                'rightFrenchCasementSashPart')
ORDER  BY sort_order;

-- 2. The five pairs. Expect exactly these five rows.
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  parent_code IN ('frenchCasementPart', 'leftFrenchCasementSashPart',
                       'rightFrenchCasementSashPart')
   OR  child_code = 'frenchCasementPart'
ORDER  BY parent_code, sort_order;

-- 3. The profile values a French pair needs. The facts say profile 2 holds
--    all of these; this is the query that proves it before a template is
--    saved, because the board refuses to build a pair without them rather
--    than guessing a thickness or a meeting stile.
--    Expect thickness 57, midRail 130, gapBetweenMeetingStiles 4,
--    and the four clearances 4.
SELECT p.code AS profile, v.field_key, v.default_value
FROM   default_profile_values v
JOIN   default_profiles p ON p.id = v.profile_id
WHERE  v.field_key LIKE 'frenchCasementPart.%'
ORDER  BY p.code, v.field_key;


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- DELETE FROM part_type_children
-- WHERE (parent_code, child_code) IN (
--   ('assemblyFramePart',           'frenchCasementPart'),
--   ('frenchCasementPart',          'leftFrenchCasementSashPart'),
--   ('frenchCasementPart',          'rightFrenchCasementSashPart'),
--   ('leftFrenchCasementSashPart',  'glassPart'),
--   ('rightFrenchCasementSashPart', 'glassPart')
-- );
-- -- The part_types rows are left alone: they came from Integrate's import,
-- -- and section 1 only inserts one that is missing. Deleting them could
-- -- remove a row this step did not create.
