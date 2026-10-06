-- ============================================================
-- step-r0b-backfill-template-drawings.sql
--
-- Drawings created from templates before the fix had no
-- default_profile_id (it was stored as uuid null). This sets it
-- to the sash profile on every drawing where it is still null.
-- Same pattern as sql/step-l3-backfill-profile.sql.
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

-- ROLLBACK — DO NOT RUN
-- There is no safe rollback: we cannot distinguish drawings that were
-- deliberately null from those that were null due to the uuid bug.
