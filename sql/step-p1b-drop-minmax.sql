-- ============================================================================
-- step-p1b-drop-minmax.sql — Drop min_value / max_value from default_field_definitions
-- Apply through Supabase SQL Editor after review
-- ============================================================================
--
-- Verification: nothing in the application reads min_value or max_value from
-- default_field_definitions.  The drawingBoard/api.js uses select('*') but
-- discards these columns.  DefaultsAndParts.jsx never references them.
-- The columns exist on default_profile_values too (which is a different table
-- and is NOT touched here).
--
-- These columns were originally intended for client-side range validation but
-- that is now replaced by the validation_rules system (step-p1).

ALTER TABLE public.default_field_definitions
  DROP COLUMN IF EXISTS min_value,
  DROP COLUMN IF EXISTS max_value;

-- ══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ══════════════════════════════════════════════════════════════════════════════
-- ALTER TABLE public.default_field_definitions
--   ADD COLUMN IF NOT EXISTS min_value numeric,
--   ADD COLUMN IF NOT EXISTS max_value numeric;
