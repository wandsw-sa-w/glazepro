-- ============================================================
-- Step F0 — Row counts (read-only)
--
-- DO NOT RUN DIRECTLY — paste into Supabase SQL editor.
--
-- Returns one row per table with its row count.
-- Tables that don't exist yet will produce an error for that
-- SELECT; comment out the relevant lines if needed.
-- ============================================================

SELECT 'parts_catalogue'         AS table_name, count(*) AS row_count FROM parts_catalogue
UNION ALL
SELECT 'price_file_parts',        count(*) FROM price_file_parts
UNION ALL
SELECT 'drawing_allocated_parts', count(*) FROM drawing_allocated_parts
UNION ALL
SELECT 'ironmongery_products',    count(*) FROM ironmongery_products
UNION ALL
SELECT 'ironmongery_variants',    count(*) FROM ironmongery_variants
UNION ALL
SELECT 'drawing_ironmongery',     count(*) FROM drawing_ironmongery
ORDER BY table_name;
