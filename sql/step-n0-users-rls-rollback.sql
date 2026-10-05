-- DO NOT RUN — rollback for step-n0-users-rls.sql

BEGIN;
DROP POLICY IF EXISTS "Authenticated users can read users" ON public.users;
COMMIT;
