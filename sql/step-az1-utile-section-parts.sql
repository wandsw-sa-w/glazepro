-- Step AZ-1: the five Utile stock section parts.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run. RUN THIS FIRST.
--
-- A DOOR's timber is not a volume. Integrate allocates LENGTHS of stock
-- section to the drawing and prices them per metre through the live price
-- rule "Utile Section Part" (loop allocated_section_part, qty length_in_m,
-- value purchase_cost, group manufacture_materials, already active in
-- GlazePro). These five parts are what it prices, and none of them is in
-- GlazePro's catalogue yet (docs/integrate-L31115-french-doors.txt).
--
-- The costs are Integrate's own per-metre purchase costs, and the names are
-- Integrate's own. The NAME matters as much as the cost: the rule's condition
-- is `contains(part_name, utile)`, so a part whose name does not contain
-- "Utile" prices nothing at all.
--
--   Utile 63mm x 63mm     8.60 /m   fanlight top rail and stiles
--   Utile 63mm x 96mm    12.20 /m   fanlight bottom rail (86 mm)
--   Utile 63mm x 120mm   17.30 /m   door leaf stiles and top rail
--   Utile 63mm x 200mm   29.00 /m   cill and door bottom rails
--   Utile 67mm x 96mm    13.60 /m   frame head and jambs
--
-- They are measure-only stock: a length is allocated, so `unit` is 'm' and
-- there is no thickness_mm (that column is for glass). Integrate holds them
-- against material 44 (Solid Utile Hardwood); GlazePro has no material column
-- on parts_catalogue, so the material lives in the part NAME, which is also
-- what the rule reads.
--
-- NOT VERIFIED: I cannot read the live tables — claude_readonly_query admits
-- only Nathan's login. The column list below is taken from
-- sql/step-g1-parts-catalogue.sql, which HAS been run, so it is evidence
-- rather than a guess; but if parts_catalogue has changed since, section 0
-- is what shows it. RUN SECTION 0 FIRST.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. The columns parts_catalogue actually has.
SELECT column_name, data_type, is_nullable, column_default
FROM   information_schema.columns
WHERE  table_schema = 'public' AND table_name = 'parts_catalogue'
ORDER  BY ordinal_position;

-- 0b. Anything utile-ish already there — expect no rows for these five codes.
SELECT part_code, part_name, category, unit, unit_cost, is_active
FROM   parts_catalogue
WHERE  part_code ILIKE 'Utile%' OR part_name ILIKE '%utile%'
ORDER  BY part_code;

-- 0c. A per-metre part already in the catalogue, for comparison — this is
--     the shape the five new rows should match (TP68 is the Ogee architrave
--     every casement drawing uses).
SELECT part_code, part_name, category, unit, thickness_mm, unit_cost,
       is_active, special, stocked
FROM   parts_catalogue
WHERE  part_code IN ('TP68', 'TP61')
ORDER  BY part_code;

-- 0d. The price rule that will price them, for the record. Expect one active
--     row whose condition names contains(part_name, utile).
SELECT id, name, loop_target, condition, quantity, value, group_name, is_active
FROM   price_rules
WHERE  name ILIKE '%utile%section%';


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the parts
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

INSERT INTO parts_catalogue
  (part_code, part_name, category, unit, unit_cost, is_active, special, stocked, properties, updated_at)
VALUES
  ('Utile63x63',  'Utile 63mm x 63mm',   'Timber Section', 'm',  8.60, true, false, true, '{}', now()),
  ('Utile63x96',  'Utile 63mm x 96mm',   'Timber Section', 'm', 12.20, true, false, true, '{}', now()),
  ('Utile63x120', 'Utile 63mm x 120mm',  'Timber Section', 'm', 17.30, true, false, true, '{}', now()),
  ('Utile63x200', 'Utile 63mm x 200mm',  'Timber Section', 'm', 29.00, true, false, true, '{}', now()),
  ('Utile67x96',  'Utile 67mm x 96mm',   'Timber Section', 'm', 13.60, true, false, true, '{}', now())
ON CONFLICT (part_code) DO UPDATE
SET part_name = EXCLUDED.part_name,
    category  = EXCLUDED.category,
    unit      = EXCLUDED.unit,
    unit_cost = EXCLUDED.unit_cost,
    is_active = EXCLUDED.is_active,
    updated_at = now();

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. The five rows, at Integrate's costs. Expect exactly these five.
SELECT part_code, part_name, category, unit, unit_cost, is_active
FROM   parts_catalogue
WHERE  part_code IN ('Utile63x63','Utile63x96','Utile63x120','Utile63x200','Utile67x96')
ORDER  BY part_code;

-- 2. Every name contains "Utile", which is what the rule's condition tests.
--    Expect 5.
SELECT count(*) AS priceable
FROM   parts_catalogue
WHERE  part_code IN ('Utile63x63','Utile63x96','Utile63x120','Utile63x200','Utile67x96')
  AND  part_name ILIKE '%utile%'
  AND  is_active;


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- These five codes are new in this step, so deleting them removes only rows
-- it created. Check section 0b's output first: if any of the five was already
-- there, DO NOT delete that one — the ON CONFLICT above will have changed its
-- cost, and section 0b is the only record of what it was.
--
-- DELETE FROM parts_catalogue
-- WHERE part_code IN ('Utile63x63','Utile63x96','Utile63x120','Utile63x200','Utile67x96');
