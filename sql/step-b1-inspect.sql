-- =============================================================================
-- Step B1 Inspect — run in the Supabase SQL editor (service-role context)
-- Date: 2026-09-24
-- Purpose: gather column types, constraints, and RLS policies needed to write
--          the save_drawing_parts function and the JS data layer safely.
--          All queries are read-only SELECTs.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. drawings.id type
--    Needed for the save_drawing_parts(p_drawing_id ...) function signature.
-- ---------------------------------------------------------------------------

SELECT column_name,
       data_type,
       udt_name,
       is_nullable,
       column_default
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'drawings'
ORDER  BY ordinal_position;


-- ---------------------------------------------------------------------------
-- 1. drawing_parts — full column inventory
--    Needed to write the DELETE/INSERT in save_drawing_parts and the
--    loadDrawingParts() SELECT in api.js.
-- ---------------------------------------------------------------------------

SELECT column_name,
       data_type,
       udt_name,
       is_nullable,
       column_default
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'drawing_parts'
ORDER  BY ordinal_position;


-- ---------------------------------------------------------------------------
-- 2. drawing_parts — RLS policies
--    Needed to confirm authenticated users can DELETE and INSERT, and whether
--    we need USING / WITH CHECK clauses matching drawings policies.
-- ---------------------------------------------------------------------------

SELECT polname        AS policy_name,
       polcmd         AS command,
       polpermissive  AS permissive,
       pg_get_expr(polqual,    polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check_expr,
       ARRAY(
           SELECT rolname FROM pg_roles
           WHERE  oid = ANY(polroles)
       ) AS roles
FROM   pg_policy
WHERE  polrelid = 'public.drawing_parts'::regclass
ORDER  BY polname;


-- ---------------------------------------------------------------------------
-- 3. drawings — RLS policies (for comparison when writing drawing_parts policy)
-- ---------------------------------------------------------------------------

SELECT polname        AS policy_name,
       polcmd         AS command,
       pg_get_expr(polqual,    polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check_expr
FROM   pg_policy
WHERE  polrelid = 'public.drawings'::regclass
ORDER  BY polname;


-- ---------------------------------------------------------------------------
-- 4. default_profiles — column inventory
--    Needed for loadProfile(code).
-- ---------------------------------------------------------------------------

SELECT column_name,
       data_type,
       udt_name,
       is_nullable,
       column_default
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'default_profiles'
ORDER  BY ordinal_position;


-- ---------------------------------------------------------------------------
-- 5. default_profile_values — column inventory
--    Needed for loadProfileValues(profileId) and the source_ref match logic
--    in buildNewBoxSash.
-- ---------------------------------------------------------------------------

SELECT column_name,
       data_type,
       udt_name,
       is_nullable,
       column_default
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'default_profile_values'
ORDER  BY ordinal_position;


-- ---------------------------------------------------------------------------
-- 6. reference_options — column inventory
--    Needed to confirm source_ref exists (used for label→code matching in
--    buildNewBoxSash) and to write loadReferenceOptions() correctly.
-- ---------------------------------------------------------------------------

SELECT column_name,
       data_type,
       udt_name,
       is_nullable,
       column_default
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'reference_options'
ORDER  BY ordinal_position;


-- ---------------------------------------------------------------------------
-- 7. part_type_children — column inventory
--    Needed to confirm exact column names (min_count / max_count) for the
--    containment check in save_drawing_parts.
-- ---------------------------------------------------------------------------

SELECT column_name,
       data_type,
       udt_name,
       is_nullable,
       column_default
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'part_type_children'
ORDER  BY ordinal_position;


-- ---------------------------------------------------------------------------
-- 8. Sample default_profile_values rows for the 'Sash' profile
--    Needed to understand the shape of profile value rows and verify source_ref
--    is populated for reference fields.
--    (Run after confirming table is readable — if 0 rows, RLS may be blocking.)
-- ---------------------------------------------------------------------------

SELECT dpv.*
FROM   default_profile_values dpv
JOIN   default_profiles dp ON dp.id = dpv.profile_id
WHERE  dp.code = 'sash'
   OR  dp.name ILIKE '%sash%'
LIMIT  20;
