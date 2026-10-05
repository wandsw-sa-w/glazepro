-- DO NOT RUN — rollback for step-m4-copied-from-quote-id.sql
-- Puts the column back as uuid, which is the broken state. Only for completeness.

BEGIN;
ALTER TABLE public.quotes DROP COLUMN IF EXISTS copied_from_quote_id;
ALTER TABLE public.quotes ADD COLUMN copied_from_quote_id uuid;
COMMIT;
