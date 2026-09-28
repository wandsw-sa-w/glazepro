-- =============================================================================
-- Step B2 rollback
-- Run this to reverse 20260924_step_b2_rls.sql.
-- This will block all access to drawing_parts from the anon/authenticated
-- roles until RLS is disabled again.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS "drawing_parts_delete" ON public.drawing_parts;
DROP POLICY IF EXISTS "drawing_parts_update" ON public.drawing_parts;
DROP POLICY IF EXISTS "drawing_parts_insert" ON public.drawing_parts;
DROP POLICY IF EXISTS "drawing_parts_select" ON public.drawing_parts;

ALTER TABLE public.drawing_parts DISABLE ROW LEVEL SECURITY;

COMMIT;
