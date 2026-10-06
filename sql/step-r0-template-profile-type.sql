-- ============================================================================
-- step-r0-template-profile-type.sql — RUN THIS ONE, before step-r1
-- drawing_templates.default_profile_id was created as uuid, but range (profile)
-- ids are whole numbers (bigint). This corrects the column type and links it
-- to default_profiles. Existing templates keep everything else; their range is
-- set to the sash range, which is the only range they can have come from.
-- Safe to re-run.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'drawing_templates'
        AND column_name = 'default_profile_id') = 'uuid' THEN
    ALTER TABLE public.drawing_templates DROP COLUMN default_profile_id;
    ALTER TABLE public.drawing_templates
      ADD COLUMN default_profile_id bigint REFERENCES public.default_profiles(id);
  END IF;
END$$;

UPDATE public.drawing_templates
SET    default_profile_id = (SELECT id FROM public.default_profiles WHERE code = 'sash')
WHERE  default_profile_id IS NULL AND family = 'sash';

COMMIT;

-- Check: every template should show a range
SELECT t.name, t.group_name, p.code AS range_code
FROM   public.drawing_templates t
LEFT JOIN public.default_profiles p ON p.id = t.default_profile_id
ORDER BY t.group_name, t.name;

-- ROLLBACK — DO NOT RUN: not needed; the uuid column could never hold a range id.
