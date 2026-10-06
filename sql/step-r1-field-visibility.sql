-- =============================================================================
-- step-r1-field-visibility.sql — Field visibility per profile + user board mode
-- DO NOT RUN directly — paste into Supabase SQL Editor after review.
--
-- Run order: 1 of 2 (run this before step-r4-field-visibility-import.sql)
-- =============================================================================

BEGIN;

-- ── 1. field_visibility table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.field_visibility (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id  uuid        NOT NULL REFERENCES public.default_profiles(id) ON DELETE CASCADE,
  field_key   text        NOT NULL,
  visibility  text        NOT NULL DEFAULT 'shown'
                          CHECK (visibility IN ('shown','hidden_sales','hidden_survey','hidden_always')),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text,
  UNIQUE (profile_id, field_key)
);

-- ── 2. RLS (same style as drawing_templates) ────────────────────────────────

ALTER TABLE public.field_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_field_visibility"
  ON public.field_visibility FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_write_field_visibility"
  ON public.field_visibility FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 3. Copy existing hidden_fields into field_visibility ────────────────────
-- Every entry in default_profiles.hidden_fields becomes hidden_always.

INSERT INTO public.field_visibility (profile_id, field_key, visibility)
SELECT p.id, unnest(p.hidden_fields), 'hidden_always'
FROM   public.default_profiles p
WHERE  p.hidden_fields IS NOT NULL
  AND  array_length(p.hidden_fields, 1) > 0
ON CONFLICT (profile_id, field_key) DO NOTHING;

-- Leave hidden_fields column in place, unused — to be removed in a later step
-- once field_visibility is proven in production.
COMMENT ON COLUMN public.default_profiles.hidden_fields IS
  'DEPRECATED: replaced by field_visibility table in step R1. Do not use.';

-- ── 4. User drawing board mode ──────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS drawing_board_mode text NOT NULL DEFAULT 'switch';

-- Add CHECK constraint only if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_drawing_board_mode_check'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_drawing_board_mode_check
      CHECK (drawing_board_mode IN ('sales', 'survey', 'switch'));
  END IF;
END$$;

COMMIT;

-- =============================================================================
-- ROLLBACK — DO NOT RUN unless reverting step R1
-- =============================================================================
-- BEGIN;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS drawing_board_mode;
-- DROP POLICY IF EXISTS "auth_write_field_visibility" ON public.field_visibility;
-- DROP POLICY IF EXISTS "auth_read_field_visibility"  ON public.field_visibility;
-- DROP TABLE IF EXISTS public.field_visibility;
-- COMMENT ON COLUMN public.default_profiles.hidden_fields IS NULL;
-- COMMIT;
