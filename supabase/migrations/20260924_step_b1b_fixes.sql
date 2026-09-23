-- =============================================================================
-- DO NOT RUN — review before executing in the Supabase SQL editor.
-- =============================================================================
-- Step B1b: glazing defaults, heritage spacer categories, per-instance
--           containment, and profile value corrections.
-- Migration: 20260924_step_b1b_fixes.sql
-- =============================================================================
-- Changes in this transaction:
--   a) reference_options: add single_glazing to glazing_type (before double_glazing)
--   b) reference_categories: add heritage_spacer_dimension and heritage_spacer_colour
--      with their options
--   c) default_field_definitions: relink heritageSpacerDimId → heritage_spacer_dimension
--      and heritageSpacerColourId → heritage_spacer_colour for glassPart and
--      visionPanelGlassPart
--   d) default_profile_values: correct glassPart.glazingId 'Double'/'Single' text
--      values to proper option codes
--   e) CREATE OR REPLACE save_drawing_parts with per-parent-instance containment check
-- =============================================================================

BEGIN;


-- =============================================================================
-- a) Add single_glazing option to glazing_type, sorted before double_glazing
-- =============================================================================

INSERT INTO reference_options (category, code, label, sort_order, is_active)
SELECT
    'glazing_type',
    'single_glazing',
    'Single Glazing',
    COALESCE(
        (SELECT sort_order FROM reference_options
         WHERE category = 'glazing_type' AND code = 'double_glazing'),
        20
    ) - 1,
    true
ON CONFLICT (category, code) DO NOTHING;


-- =============================================================================
-- b) New reference_categories and options
-- =============================================================================

-- Sort orders: step-a3 used up to 400; use 410 and 420 for the two new categories.

INSERT INTO reference_categories
    (category, label, group_name, is_multi, has_quantity, sort_order)
VALUES
    ('heritage_spacer_dimension', 'Glazing - Heritage Spacer Dimension', 'Glazing', false, false, 410),
    ('heritage_spacer_colour',    'Glazing - Heritage Spacer Colour',    'Glazing', false, false, 420)
ON CONFLICT (category) DO NOTHING;

-- ---- heritage_spacer_dimension -----------------------------------------------
INSERT INTO reference_options (category, code, label, sort_order, is_active)
VALUES
    ('heritage_spacer_dimension', 'spacer_4', '4mm', 10, true),
    ('heritage_spacer_dimension', 'spacer_6', '6mm', 20, true)
ON CONFLICT (category, code) DO NOTHING;

-- ---- heritage_spacer_colour --------------------------------------------------
INSERT INTO reference_options (category, code, label, sort_order, is_active)
VALUES
    ('heritage_spacer_colour', 'black',             'Black',             10, true),
    ('heritage_spacer_colour', 'white',             'White',             20, true),
    ('heritage_spacer_colour', 'silver',            'Silver',            30, true),
    ('heritage_spacer_colour', 'black_warm_edge',   'Black Warm Edge',   40, true),
    ('heritage_spacer_colour', 'grey_warm_edge',    'Grey Warm Edge',    50, true),
    ('heritage_spacer_colour', 'white_warm_edge',   'White Warm Edge',   60, true),
    ('heritage_spacer_colour', 'white_superspacer', 'White Superspacer', 70, true),
    ('heritage_spacer_colour', 'grey_superspacer',  'Grey Superspacer',  80, true),
    ('heritage_spacer_colour', 'black_superspacer', 'Black Superspacer', 90, true)
ON CONFLICT (category, code) DO NOTHING;


-- =============================================================================
-- c) Relink heritageSpacerDimId / heritageSpacerColourId fields
-- =============================================================================

-- glassPart.heritageSpacerDimId: glazing_spacer_dimension → heritage_spacer_dimension
DO $u$
DECLARE _rc INT;
BEGIN
    UPDATE default_field_definitions
    SET    reference_category = 'heritage_spacer_dimension'
    WHERE  field_key = 'glassPart.heritageSpacerDimId';
    GET DIAGNOSTICS _rc = ROW_COUNT;
    IF _rc != 1 THEN
        RAISE EXCEPTION 'Step B1b: expected 1 row for glassPart.heritageSpacerDimId, got %', _rc;
    END IF;
END $u$;

-- glassPart.heritageSpacerColourId: glazing_spacer_colour → heritage_spacer_colour
DO $u$
DECLARE _rc INT;
BEGIN
    UPDATE default_field_definitions
    SET    reference_category = 'heritage_spacer_colour'
    WHERE  field_key = 'glassPart.heritageSpacerColourId';
    GET DIAGNOSTICS _rc = ROW_COUNT;
    IF _rc != 1 THEN
        RAISE EXCEPTION 'Step B1b: expected 1 row for glassPart.heritageSpacerColourId, got %', _rc;
    END IF;
END $u$;

-- visionPanelGlassPart.heritageSpacerDimId → heritage_spacer_dimension
DO $u$
DECLARE _rc INT;
BEGIN
    UPDATE default_field_definitions
    SET    reference_category = 'heritage_spacer_dimension'
    WHERE  field_key = 'visionPanelGlassPart.heritageSpacerDimId';
    GET DIAGNOSTICS _rc = ROW_COUNT;
    IF _rc != 1 THEN
        RAISE EXCEPTION 'Step B1b: expected 1 row for visionPanelGlassPart.heritageSpacerDimId, got %', _rc;
    END IF;
END $u$;

-- visionPanelGlassPart.heritageSpacerColourId → heritage_spacer_colour
DO $u$
DECLARE _rc INT;
BEGIN
    UPDATE default_field_definitions
    SET    reference_category = 'heritage_spacer_colour'
    WHERE  field_key = 'visionPanelGlassPart.heritageSpacerColourId';
    GET DIAGNOSTICS _rc = ROW_COUNT;
    IF _rc != 1 THEN
        RAISE EXCEPTION 'Step B1b: expected 1 row for visionPanelGlassPart.heritageSpacerColourId, got %', _rc;
    END IF;
END $u$;


-- =============================================================================
-- d) Correct glassPart.glazingId default values to option codes
-- =============================================================================

DO $u$
DECLARE _rc INT;
BEGIN
    UPDATE default_profile_values
    SET    default_value = CASE default_value
                               WHEN 'Double' THEN 'double_glazing'
                               WHEN 'Single' THEN 'single_glazing'
                           END
    WHERE  field_key    = 'glassPart.glazingId'
      AND  default_value IN ('Double', 'Single');
    GET DIAGNOSTICS _rc = ROW_COUNT;
    RAISE NOTICE 'Step B1b: updated % glassPart.glazingId profile value(s) to option codes', _rc;
    -- Note: 0 is OK if values were already correct codes.
END $u$;


-- =============================================================================
-- e) CREATE OR REPLACE save_drawing_parts — per-parent-instance containment
-- =============================================================================
-- Changes from step-b1:
--   - Check #3 (forbidden pairs) error message now names the parent key.
--   - Check #4 is replaced with a PL/pgSQL loop: for every parent instance,
--     for every part_type_children row, count that instance's own children
--     of the required type. This correctly catches the case where two parent
--     instances of the same type have different child counts.
-- Everything else (validation steps 1–2, delete, BFS insert) is unchanged.
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
    -- Per-instance containment loop
    _par          RECORD;
    _ptc          RECORD;
    _child_n      INTEGER;
    _issues       TEXT[] := '{}';
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
    -- Every actual edge in the submitted tree must appear in part_type_children.
    -- Error names the parent type and key for traceability.
    SELECT string_agg(
               format('%s(%s) → %s', p->>'part_type', p->>'key', c->>'part_type'),
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

    -- ── 4. Per-parent-instance child count within allowed range ──────────────
    -- For every part in the submitted tree, iterate over all part_type_children
    -- rows where parent_code = that part's type and count its own children of
    -- each required child type. COALESCE is not needed because the SELECT
    -- always returns a row (count returns 0 for no matches). Reports the
    -- parent instance's key so failures are traceable.
    FOR _par IN
        SELECT e->>'key'       AS par_key,
               e->>'part_type' AS par_type
        FROM   jsonb_array_elements(p_parts) e
    LOOP
        FOR _ptc IN
            SELECT *
            FROM   public.part_type_children
            WHERE  parent_code = _par.par_type
        LOOP
            SELECT count(*)::INTEGER
            INTO   _child_n
            FROM   jsonb_array_elements(p_parts) c
            WHERE  c->>'parent_key' = _par.par_key
              AND  c->>'part_type'  = _ptc.child_code;

            IF (_ptc.min_count > 0 AND _child_n < _ptc.min_count)
            OR (_ptc.max_count IS NOT NULL AND _child_n > _ptc.max_count)
            THEN
                _issues := array_append(_issues, format(
                    '%s(%s)→%s: allowed %s..%s, got %s',
                    _par.par_type,
                    _par.par_key,
                    _ptc.child_code,
                    _ptc.min_count,
                    COALESCE(_ptc.max_count::TEXT, '*'),
                    _child_n
                ));
            END IF;
        END LOOP;
    END LOOP;

    IF array_length(_issues, 1) > 0 THEN
        RAISE EXCEPTION 'save_drawing_parts: child count violation(s): %',
            array_to_string(_issues, '; ');
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


COMMIT;
