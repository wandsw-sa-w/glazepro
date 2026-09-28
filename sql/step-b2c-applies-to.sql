-- =============================================================================
-- Step B2c: Filter sash_operation options by part type
-- DO NOT RUN directly — paste into Supabase SQL editor.
--
-- Adds an applies_to text[] column to reference_options.
-- When populated, the Drawing Board editor only shows options whose
-- applies_to includes the current part type (topSashPart/bottomSashPart etc.).
-- Options with an empty applies_to array remain visible everywhere (safe
-- default for categories that don't need filtering).
-- =============================================================================

BEGIN;

ALTER TABLE public.reference_options
  ADD COLUMN IF NOT EXISTS applies_to text[] NOT NULL DEFAULT '{}';

-- Mark the three sliding-sash operations.
-- Adjust the label patterns if your codes differ.
UPDATE public.reference_options
SET    applies_to = '{topSashPart,bottomSashPart}'
WHERE  category = 'sash_operation'
  AND  (
    label ILIKE 'cord hung'
    OR  label ILIKE '%spiral%'
    OR  label ILIKE 'fix%'
  );

-- Verify: should print 3 rows
SELECT code, label, applies_to
FROM   public.reference_options
WHERE  category = 'sash_operation'
ORDER  BY sort_order;

COMMIT;
