-- Step AZ-1: the five Utile stock section parts, AND the door multipoint-lock parts.
--
-- REVIEWER'S REWRITE (13 Oct): the lock parts the mpls_doors allocator rules
-- allocate (RJZ2382, RHZ16xx, RHZ22xx, WIN500xxxx, RGE2105) were NOT in the live
-- parts_catalogue, so a French door priced live would have lost its 190.05 of
-- lock ironmongery (the offline fixture injected the costs). Names and costs are
-- Integrate's own part list (PartAllocator page, read 13 Oct 2026). They price
-- through "Ironmongery Cost" (whole pounds x 1.05): 50.83 -> 53.55,
-- 89.47 -> 93.45, 34.92 -> 36.75, 5.61 -> 6.30 — FD1's four lines exactly.
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

-- 1b. The door multipoint-lock parts (category Ironmongery, each) — every
--     part_code an ACTIVE mpls_doors allocator rule names. Integrate's names
--     and costs. NOTE which code is which (the allocator rules' own labels are
--     misleading): RHZ1648 is the Flushbolt LH, RHZ1653 the FAB Shootbolt 399,
--     RHZ1667 the Adj Single Shootbolt Keep.
INSERT INTO parts_catalogue
  (part_code, part_name, category, unit, unit_cost, is_active, special, stocked, properties, updated_at)
VALUES
  ('RJZ2382',    'Winkhaus Thunderbolt Master Multipoint Lock', 'Ironmongery', 'each',  50.83, true, false, false, '{}', now()),
  ('RHZ1648',    'Winkhaus Flushbolt LH',                       'Ironmongery', 'each',  89.47, true, false, false, '{}', now()),
  ('RHZ1649',    'Winkhaus Flushbolt RH',                       'Ironmongery', 'each',  89.47, true, false, false, '{}', now()),
  ('RHZ1650',    'Winkhaus FAB Tall Shootbolt LH',              'Ironmongery', 'each', 112.32, true, false, false, '{}', now()),
  ('RHZ1651',    'Winkhaus FAB Tall Shootbolt RH',              'Ironmongery', 'each', 112.32, true, false, false, '{}', now()),
  ('RHZ1652',    'Winkhaus Shootbolt',                          'Ironmongery', 'each',  18.73, true, false, false, '{}', now()),
  ('RHZ1653',    'Winkhaus FAB Shootbolt 399',                  'Ironmongery', 'each',  34.92, true, false, false, '{}', now()),
  ('RHZ1654',    'Winkhaus FAB Shootbolt 541',                  'Ironmongery', 'each',  36.45, true, false, false, '{}', now()),
  ('RHZ2213',    'Winkhaus FAB Shootbolt 683',                  'Ironmongery', 'each',  45.21, true, false, false, '{}', now()),
  ('RHZ2214',    'Winkhaus FAB Shootbolt 825',                  'Ironmongery', 'each',  47.86, true, false, false, '{}', now()),
  ('RHZ1667',    'Adj Single Shootbolt Keep',                   'Ironmongery', 'each',   5.61, true, false, false, '{}', now()),
  ('WIN5002439', 'Winkhaus Short TruLock Right Hand',           'Ironmongery', 'each',  91.08, true, false, false, '{}', now()),
  ('WIN5002560', 'Winkhaus Short TruLock Left Hand',            'Ironmongery', 'each',  91.08, true, false, false, '{}', now()),
  ('RGE2105',    'Macclex Inward Opening Ali Threshold',        'Ironmongery', 'each',  49.99, true, false, false, '{}', now())
ON CONFLICT (part_code) DO NOTHING;

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


-- 3. Every part an active mpls_doors allocator rule names is now in the
--    catalogue. Expect NO rows.
SELECT DISTINCT r.part_code
FROM   part_allocation_rules r
LEFT   JOIN parts_catalogue pc ON pc.part_code = r.part_code
WHERE  r.group_name = 'mpls_doors' AND r.is_active AND r.part_code IS NOT NULL
  AND  pc.part_code IS NULL;

-- 4. FD1's four lock parts at Integrate's costs: 50.83 / 89.47 / 34.92 / 5.61.
SELECT part_code, part_name, unit_cost
FROM   parts_catalogue
WHERE  part_code IN ('RJZ2382','RHZ1648','RHZ1653','RHZ1667')
ORDER  BY part_code;


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- These five codes are new in this step, so deleting them removes only rows
-- it created. Check section 0b's output first: if any of the five was already
-- there, DO NOT delete that one — the ON CONFLICT above will have changed its
-- cost, and section 0b is the only record of what it was.
--
-- DELETE FROM parts_catalogue
-- WHERE part_code IN ('Utile63x63','Utile63x96','Utile63x120','Utile63x200','Utile67x96',
--                     'RJZ2382','RHZ1648','RHZ1649','RHZ1650','RHZ1651','RHZ1652','RHZ1653',
--                     'RHZ1654','RHZ2213','RHZ2214','RHZ1667','WIN5002439','WIN5002560','RGE2105');
-- (The lock parts were confirmed absent on 13 Oct, so deleting them removes only rows this file made.)
