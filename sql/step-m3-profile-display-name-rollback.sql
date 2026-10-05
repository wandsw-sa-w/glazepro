-- DO NOT RUN — rollback for step-m3-profile-display-name.sql

BEGIN;

ALTER TABLE public.default_profiles DROP COLUMN IF EXISTS display_name;

COMMIT;
