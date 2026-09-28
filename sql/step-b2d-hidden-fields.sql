-- =============================================================================
-- Step B2d: Per-profile hidden fields
-- DO NOT RUN directly — paste into Supabase SQL editor.
--
-- Adds hidden_fields text[] to default_profiles.
-- The Drawing Board editor hides any field whose field_key appears in this
-- array for the drawing's profile.  Also excluded from required-empty warnings.
-- =============================================================================

BEGIN;

ALTER TABLE public.default_profiles
  ADD COLUMN IF NOT EXISTS hidden_fields text[] NOT NULL DEFAULT '{}';

-- Hide casement-only fields on the Sash (box sash) profile.
UPDATE public.default_profiles
SET    hidden_fields = ARRAY[
  'assemblyFramePart.bottomHeight',
  'assemblyFramePart.cillAngle',
  'assemblyFramePart.frameStop',
  'assemblyFramePart.cillStop',
  'assemblyFramePart.frameHeadStopSize',
  'assemblyFramePart.frameStileStopSize',
  'assemblyFramePart.cillStopSize'
]
WHERE  code = 'sash';

-- Verify
SELECT code, label, hidden_fields
FROM   public.default_profiles
WHERE  code = 'sash';

COMMIT;
