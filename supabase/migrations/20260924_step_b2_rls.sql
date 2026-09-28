-- =============================================================================
-- Step B2: Enable RLS on drawing_parts
-- DO NOT RUN directly — apply via Supabase dashboard or CLI.
--
-- drawings table has RLS disabled with no policies (checked during b1 review).
-- Because drawings has no row-level filtering, drawing_parts policies use
-- "authenticated users only" (blanket access) rather than a join-filtered check.
--
-- save_drawing_parts is SECURITY INVOKER — it runs as the calling user.
-- With these policies in place, an authenticated user can SELECT/INSERT/DELETE
-- on drawing_parts, so the function continues to work correctly.
-- =============================================================================

BEGIN;

-- Enable RLS on drawing_parts
ALTER TABLE public.drawing_parts ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user may read drawing_parts
CREATE POLICY "drawing_parts_select"
    ON public.drawing_parts
    FOR SELECT
    TO authenticated
    USING (true);

-- INSERT: any authenticated user may insert drawing_parts
CREATE POLICY "drawing_parts_insert"
    ON public.drawing_parts
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE: any authenticated user may update drawing_parts
CREATE POLICY "drawing_parts_update"
    ON public.drawing_parts
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- DELETE: any authenticated user may delete drawing_parts
-- Required by save_drawing_parts which deletes all parts for a drawing
-- before re-inserting the new set.
CREATE POLICY "drawing_parts_delete"
    ON public.drawing_parts
    FOR DELETE
    TO authenticated
    USING (true);

COMMIT;
