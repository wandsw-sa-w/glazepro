-- ============================================================
-- Step F0 — Schema inspection (read-only)
--
-- DO NOT RUN DIRECTLY — paste into Supabase SQL editor.
--
-- Returns ONE result set: column-level info for the six tables
-- that F1/F2/F3 need to create or consume.  The SQL editor only
-- shows the last result set, so all tables are combined with
-- a UNION ALL ordered by table_name, ordinal_position.
-- ============================================================

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'parts_catalogue',
    'price_file_parts',
    'drawing_allocated_parts',
    'ironmongery_products',
    'ironmongery_variants',
    'drawing_ironmongery'
  )
ORDER BY table_name, ordinal_position;
