-- step-m3-profile-display-name.sql
-- Adds display_name to default_profiles for the range name shown in
-- the quote PDF heading: "(Standard Sash range)".
--
-- Run after: step-m2
-- Rollback: step-m3-profile-display-name-rollback.sql

BEGIN;

ALTER TABLE public.default_profiles
  ADD COLUMN IF NOT EXISTS display_name text;

UPDATE public.default_profiles
  SET display_name = 'Standard Sash'
  WHERE code = 'sash' AND display_name IS NULL;

COMMIT;
