-- DO NOT RUN unless undoing step b1 after it has been applied.
-- =============================================================================
-- Step B1 Rollback: drop save_drawing_parts function and any policy it added.
-- =============================================================================

BEGIN;

-- Drop the RPC function
DROP FUNCTION IF EXISTS public.save_drawing_parts(BIGINT, JSONB);

-- Drop the policy only if step b1 created it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policy
        WHERE  polname  = 'drawing_parts_authenticated_all'
          AND  polrelid = 'public.drawing_parts'::regclass
    ) THEN
        DROP POLICY drawing_parts_authenticated_all ON public.drawing_parts;
        RAISE NOTICE 'Dropped drawing_parts_authenticated_all policy';
    END IF;
END;
$$;

COMMIT;
