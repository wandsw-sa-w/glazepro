-- ============================================================================
-- step-q3b-drawing-history-user-name.sql — RUN THIS ONE
-- Adds the name of the person who made the change to each drawing history row.
-- The name is stored at the time of the change, so history still reads correctly
-- if a user is later renamed or removed. Existing rows keep an empty name.
-- Safe to re-run.
-- ============================================================================

ALTER TABLE public.drawing_history
  ADD COLUMN IF NOT EXISTS user_name text;

-- ROLLBACK — DO NOT RUN
-- ALTER TABLE public.drawing_history DROP COLUMN IF EXISTS user_name;
