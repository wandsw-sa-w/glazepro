-- =============================================================================
-- Step B1: save_drawing_parts RPC function
-- Migration: 20260924_step_b1_save_drawing_parts.sql
-- =============================================================================
-- Creates public.save_drawing_parts(p_drawing_id BIGINT, p_parts JSONB)
-- RETURNS VOID, SECURITY INVOKER, runs in the caller's transaction.
--
-- p_parts: jsonb array of { key, parent_key, part_type, sort_order, values }
--   key/parent_key = client-side temporary string ids (not DB ids).
--   parent_key = null for the single root node.
--
-- Validates then writes atomically:
--   1. Exactly one root (parent_key null), must be drawingItemPart.
--   2. Every parent→child part_type pair must be in part_type_children.
--   3. Child counts must satisfy min_count..max_count for every part type
--      that appears in the submitted tree.
--   4. Deletes all existing drawing_parts for the drawing.
--   5. Inserts new parts in BFS order so parent rows exist before child rows.
--
-- RLS note: the step-b1 inspect query returned no rows from pg_policy for
-- both drawing_parts and drawings — most likely RLS is disabled on both
-- tables, in which case no policy changes are needed. The DO block below is
-- a no-op safety net: it adds a permissive authenticated policy ONLY if RLS
-- is already enabled (which would otherwise block all access).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.save_drawing_parts(
    p_drawing_id BIGINT,
    p_parts      JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    _root_count   INTEGER;
    _root_type    TEXT;
    _forbidden    TEXT;
    _count_issues TEXT;
    _key          TEXT;
    _parent_key   TEXT;
    _part_type    TEXT;
    _sort_order   INTEGER;
    _values       JSONB;
    _new_id       BIGINT;
    _parent_id    BIGINT;
    _key_map      JSONB  := '{}';
    _queue        TEXT[];
    _children     TEXT[];
BEGIN

    -- ── 1. Exactly one root ──────────────────────────────────────────────────
    SELECT count(*)::INTEGER
    INTO   _root_count
    FROM   jsonb_array_elements(p_parts) e
    WHERE  (e->>'parent_key') IS NULL;

    IF _root_count <> 1 THEN
        RAISE EXCEPTION
            'save_drawing_parts: expected exactly 1 root (parent_key null), found %',
            _root_count;
    END IF;

    -- ── 2. Root must be drawingItemPart ──────────────────────────────────────
    SELECT e->>'part_type'
    INTO   _root_type
    FROM   jsonb_array_elements(p_parts) e
    WHERE  (e->>'parent_key') IS NULL;

    IF _root_type <> 'drawingItemPart' THEN
        RAISE EXCEPTION
            'save_drawing_parts: root must be drawingItemPart, got ''%''',
            _root_type;
    END IF;

    -- ── 3. No forbidden parent→child pairs ───────────────────────────────────
    SELECT string_agg(
               format('%s → %s', p->>'part_type', c->>'part_type'),
               ', '
           )
    INTO   _forbidden
    FROM   jsonb_array_elements(p_parts) p
    JOIN   jsonb_array_elements(p_parts) c
           ON c->>'parent_key' = p->>'key'
    WHERE  NOT EXISTS (
               SELECT 1
               FROM   public.part_type_children ptc
               WHERE  ptc.parent_code = p->>'part_type'
                 AND  ptc.child_code  = c->>'part_type'
           );

    IF _forbidden IS NOT NULL THEN
        RAISE EXCEPTION
            'save_drawing_parts: forbidden parent→child pair(s): %',
            _forbidden;
    END IF;

    -- ── 4. Child counts within allowed range ─────────────────────────────────
    -- For every part type present in the submitted tree, check all
    -- part_type_children rules. LEFT JOIN handles "zero actual" for required
    -- child types.
    SELECT string_agg(
               format('%s→%s: allowed %s..%s, got %s',
                      ptc.parent_code,
                      ptc.child_code,
                      ptc.min_count,
                      COALESCE(ptc.max_count::TEXT, '*'),
                      COALESCE(ac.n, 0)),
               '; '
           )
    INTO   _count_issues
    FROM   public.part_type_children ptc
    LEFT   JOIN (
        SELECT p->>'part_type' AS parent_type,
               c->>'part_type' AS child_type,
               count(*)::INTEGER AS n
        FROM   jsonb_array_elements(p_parts) p
        JOIN   jsonb_array_elements(p_parts) c
               ON c->>'parent_key' = p->>'key'
        GROUP  BY p->>'part_type', c->>'part_type'
    ) ac ON ac.parent_type = ptc.parent_code
        AND ac.child_type  = ptc.child_code
    WHERE  ptc.parent_code IN (
               SELECT DISTINCT e->>'part_type'
               FROM   jsonb_array_elements(p_parts) e
           )
      AND (
          (ptc.min_count > 0 AND COALESCE(ac.n, 0) < ptc.min_count)
          OR
          (ptc.max_count IS NOT NULL AND COALESCE(ac.n, 0) > ptc.max_count)
      );

    IF _count_issues IS NOT NULL THEN
        RAISE EXCEPTION
            'save_drawing_parts: child count violation(s): %',
            _count_issues;
    END IF;

    -- ── 5. Delete existing drawing_parts ─────────────────────────────────────
    DELETE FROM public.drawing_parts
    WHERE  drawing_id = p_drawing_id;

    -- ── 6. Insert in BFS order (root first, then each level of children) ─────
    -- Seed queue with the root key.
    SELECT e->>'key'
    INTO   _key
    FROM   jsonb_array_elements(p_parts) e
    WHERE  (e->>'parent_key') IS NULL;

    _queue := ARRAY[_key];

    WHILE array_length(_queue, 1) > 0 LOOP

        -- Dequeue front element
        _key   := _queue[1];
        _queue := _queue[2:];

        -- Fetch this part's fields from the input array
        SELECT e->>'parent_key',
               e->>'part_type',
               COALESCE((e->>'sort_order')::INTEGER, 0),
               COALESCE(e->'values', '{}')
        INTO   _parent_key, _part_type, _sort_order, _values
        FROM   jsonb_array_elements(p_parts) e
        WHERE  e->>'key' = _key;

        -- Resolve parent DB id (null for root)
        _parent_id := CASE
            WHEN _parent_key IS NULL THEN NULL
            ELSE (_key_map ->> _parent_key)::BIGINT
        END;

        -- Insert the row and capture the new auto-increment id
        INSERT INTO public.drawing_parts
            (drawing_id, parent_part_id, part_type, sort_order, "values")
        VALUES
            (p_drawing_id, _parent_id, _part_type, _sort_order, _values)
        RETURNING id INTO _new_id;

        -- Record client key → new DB id for child lookups
        _key_map := _key_map || jsonb_build_object(_key, _new_id);

        -- Enqueue children sorted by sort_order so siblings stay ordered
        SELECT array_agg(e->>'key' ORDER BY (e->>'sort_order')::INTEGER)
        INTO   _children
        FROM   jsonb_array_elements(p_parts) e
        WHERE  e->>'parent_key' = _key;

        IF _children IS NOT NULL THEN
            _queue := _queue || _children;
        END IF;

    END LOOP;

END;
$$;


-- =============================================================================
-- RLS safety net — no-op when RLS is disabled on drawing_parts
-- =============================================================================

DO $$
BEGIN
    IF (SELECT relrowsecurity
        FROM   pg_class
        WHERE  oid = 'public.drawing_parts'::regclass) THEN

        IF NOT EXISTS (
            SELECT 1 FROM pg_policy
            WHERE  polname  = 'drawing_parts_authenticated_all'
              AND  polrelid = 'public.drawing_parts'::regclass
        ) THEN
            EXECUTE $pol$
                CREATE POLICY drawing_parts_authenticated_all
                    ON public.drawing_parts
                    FOR ALL
                    TO authenticated
                    USING (true)
                    WITH CHECK (true)
            $pol$;
            RAISE NOTICE
                'drawing_parts: RLS was enabled with no policies — '
                'created drawing_parts_authenticated_all';
        END IF;

    ELSE
        RAISE NOTICE 'drawing_parts: RLS is disabled, no policy changes needed';
    END IF;
END;
$$;
