-- ============================================================================
-- step-q4-field-notes.sql — Add info_note column to default_field_definitions
-- DO NOT RUN — apply through Supabase SQL Editor after review
-- Run order: after step-q3-drawing-history.sql
-- ============================================================================

-- ── 1. Add info_note column ──────────────────────────────────────────────────

ALTER TABLE public.default_field_definitions
  ADD COLUMN IF NOT EXISTS info_note text;

COMMENT ON COLUMN public.default_field_definitions.info_note
  IS 'Optional help note shown as a tooltip beside the field label on the drawing board';
