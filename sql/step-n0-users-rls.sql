-- step-n0-users-rls.sql
-- Allows authenticated users to read the users table so the salesperson
-- dropdown can list active users.
--
-- Run after: existing users table (created by auth or earlier migration)
-- Rollback: step-n0-users-rls-rollback.sql

BEGIN;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read users" ON public.users;
CREATE POLICY "Authenticated users can read users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

COMMIT;
