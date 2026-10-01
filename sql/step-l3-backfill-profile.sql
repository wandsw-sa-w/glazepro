-- ============================================================
-- Step L3 — backfill drawings.default_profile_id
--
-- DO NOT RUN — paste into Supabase SQL editor.
--
-- addDrawingQuick('sash') (the quick "Sash" button on the Quote Matrix)
-- inserted drawings without default_profile_id. The items grid's
-- profile-default fallback (Step K/J fixes round 2, item 3) skips any
-- drawing whose default_profile_id is null, so Sash/Frame/Cill Material,
-- the glass fields, Spacer Colour and the finishes showed "—" even though
-- the drawing board itself falls back to the Box Sash profile (code
-- 'sash' — see src/drawingBoard/defaultProfile.js) and shows real values.
--
-- This sets default_profile_id on every existing drawing that doesn't
-- have one, to that same Box Sash profile.
--
-- Safe to re-run: only touches rows that are still null.
-- ============================================================

BEGIN;

UPDATE drawings
SET default_profile_id = (
  SELECT id FROM default_profiles WHERE code = 'sash' AND is_active = true LIMIT 1
)
WHERE default_profile_id IS NULL
  AND EXISTS (SELECT 1 FROM default_profiles WHERE code = 'sash' AND is_active = true);

COMMIT;
