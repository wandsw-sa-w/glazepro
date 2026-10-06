-- ============================================================================
-- step-q4-field-notes-rollback.sql — DO NOT RUN
-- Reverses step-q4-field-notes.sql
-- ============================================================================

ALTER TABLE public.default_field_definitions
  DROP COLUMN IF EXISTS info_note;
