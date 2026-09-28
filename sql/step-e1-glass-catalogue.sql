-- ============================================================
-- Step E1 — Glass parts catalogue
--
-- DO NOT RUN DIRECTLY — paste into Supabase SQL editor.
--
-- Creates parts_catalogue (if missing), adds any missing columns,
-- then upserts 75 active Glass parts from Integrate's Part List.
--
-- Source: docs/integrate-glass-parts.txt (28 Sep 2026 extract).
-- Only rows with status = 'active' are imported.
-- Soft-deleted rows are deliberately excluded.
--
-- Re-runnable: uses ON CONFLICT (code) DO UPDATE so safe to re-run.
-- ============================================================

BEGIN;

-- ── 1. Create table if it does not exist ─────────────────────
-- id: uuid (matches price_files.id convention).
-- code: Integrate part_no (e.g. GL100010) — unique business key.
-- cost_per_m2: the "cost" column from the Integrate part list (£/m²).
--              For unit = 'Each' parts this stores the each-price instead.

CREATE TABLE IF NOT EXISTS parts_catalogue (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category     text        NOT NULL,
  code         text        NOT NULL,
  name         text        NOT NULL,
  unit         text        NOT NULL DEFAULT 'm2',
  cost_per_m2  numeric,
  thickness_mm numeric,
  UNIQUE (code)
);

-- ── 2. Add columns that may be missing ───────────────────────
ALTER TABLE parts_catalogue ADD COLUMN IF NOT EXISTS multiplier  numeric;
ALTER TABLE parts_catalogue ADD COLUMN IF NOT EXISTS waste       boolean NOT NULL DEFAULT false;
ALTER TABLE parts_catalogue ADD COLUMN IF NOT EXISTS stocked     boolean NOT NULL DEFAULT false;
ALTER TABLE parts_catalogue ADD COLUMN IF NOT EXISTS special     boolean NOT NULL DEFAULT false;

-- ── 3. Check for any existing Glass parts that have no Integrate match ──
-- (Returns zero rows on first run; review before deleting anything.)
DO $$
DECLARE
  r record;
  found_any boolean := false;
BEGIN
  FOR r IN
    SELECT code, name FROM parts_catalogue
    WHERE category = 'Glass'
      AND code NOT IN (
        'GL100005','GL100010','GL100015','GL100020','GL100025','GL100035','GL100039',
        'GL100045','GL100070','GL100075','GL100080','GL100085','GL100091','GL100092',
        'GL100093','GL100094','GL100120','GL100125','GL100135','GL100145','GL100147',
        'GL100165','GL100170','GL100175','GL100195','GL100200','GL100205','GL100210',
        'GL100215','GL100220','GL100225','GL100230','GL100235','GL100240','GL100245',
        'GL100250','GL100255','GL100260','GL100265','GL100270','GL100275',
        'GL100280','GL100285','GL100290','GL100295','GL100300','GL100305','GL100310',
        'GL100315','GL100320','GL100325','GL100330','GL100335','GL100340','GL100345',
        'GL100350','GL100355','GL100360',
        'GL100365','GL100390','GL100395',
        'GL100405','GL100410','GL100415','GL100420','GL100425','GL100430','GL100435',
        'GL100440','GL100445','GL100480','GL100500','GL100501','GL100505','GL100510'
      )
  LOOP
    RAISE NOTICE 'No Integrate match for existing Glass part: % — %', r.code, r.name;
    found_any := true;
  END LOOP;
  IF NOT found_any THEN
    RAISE NOTICE 'No unmatched existing Glass parts found.';
  END IF;
END $$;

-- ── 4. Upsert 75 active Glass parts ─────────────────────────
-- Columns: (code, name, thickness_mm, unit, cost_per_m2, multiplier, waste, stocked, special)

INSERT INTO parts_catalogue (category, code, name, thickness_mm, unit, cost_per_m2, multiplier, waste, stocked, special)
VALUES
  -- 4mm Clear / Float / Toughened
  ('Glass','GL100005','4mm Clear Pilkington K Glass',          4,   'm2',   20.50, null, false, false, false),
  ('Glass','GL100010','4mm Clear Pilkington K Toughened',      4,   'm2',   32.00, null, false, false, false),
  ('Glass','GL100015','4mm Sandblasted Float Glass',           4,   'm2',   54.50, null, false, true,  false),
  ('Glass','GL100020','4mm Sandblasted Toughened Glass',       4,   'm2',   89.69, null, false, false, false),
  ('Glass','GL100075','4mm Clear Float Glass',                 4,   'm2',   19.50, null, false, true,  false),
  ('Glass','GL100080','4mm Clear Toughened',                   4,   'm2',   25.50, null, false, false, false),

  -- 6.x mm Laminated / Acoustic
  ('Glass','GL100025','6.8mm Laminated Low E Glass',           6.8, 'm2',   50.50, null, false, true,  false),
  ('Glass','GL100035','6.8mm Acoustic Laminated Glass',        6.8, 'm2',   77.50, null, false, false, false),
  ('Glass','GL100039','6.8mm Acoustic Sandblasted Laminated Glass', 6.8, 'm2', 152.50, null, false, false, false),
  ('Glass','GL100070','6.4mm Star Glass Laminated',            6.4, 'm2',  210.00, null, false, false, true),

  -- Fineo / Fire / Specialist
  ('Glass','GL100045','7.7mm Fineo 8',                         7.7, 'm2',  315.00, null, false, false, true),
  ('Glass','GL100085','7mm Pyrobelite FD30 Rated Fire Glass',  7,   'm2',  300.00, null, false, false, true),
  ('Glass','GL100135','6mm Toughened SunGuard Super Neutral 7035', 6, 'm2', 250.00, null, false, false, true),
  ('Glass','GL100145','6mm Float Clear Glass',                 6,   'm2',   16.90, null, false, false, false),
  ('Glass','GL100147','6mm Toughened Clear Glass',             6,   'm2',   44.50, null, false, false, false),

  -- Lead / oval lead
  ('Glass','GL100091','4mm Float Glass with 9mm Oval Lead',                       4, 'm2',  57.00, null, false, false, false),
  ('Glass','GL100092','4mm Clear Toughened Glass with 9mm Oval Lead',             4, 'm2',  63.00, null, false, false, false),
  ('Glass','GL100093','4mm Float Sandblasted Glass with 9mm Oval Lead',           4, 'm2',  44.10, null, false, false, false),
  ('Glass','GL100094','4mm Toughened Sandblasted Glass with 9mm Oval Lead',       4, 'm2', 103.00, null, false, false, false),

  -- Cathedral / Muffle (special order)
  ('Glass','GL100120','4mm Antique Cathedral Glass Float (Colour to be specified)', 4, 'm2', 53.62, null, false, false, true),
  ('Glass','GL100125','4mm English Muffle Glass Float (Colour to be specified)',    4, 'm2', 111.63, null, false, false, true),

  -- 4mm Patterned Float (£54.50/m²)
  ('Glass','GL100165','4mm Warwick Float Glass',        4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100170','4mm Chantilly Float Glass',      4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100175','4mm Reeded Float Glass',         4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100195','4mm Digital Float Glass',        4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100200','4mm Tafetta Float Glass',        4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100205','4mm Oak Float Glass',            4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100210','4mm Contora Float Glass',        4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100215','4mm Charcoal Sticks Float Glass',4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100220','4mm Florielle Float Glass',      4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100225','4mm Mayflower Float Glass',      4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100230','4mm Pelerine Float Glass',       4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100235','4mm Everglaze Float Glass',      4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100240','4mm Flemish Float Glass',        4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100245','4mm Minster Float Glass',        4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100250','4mm Sycamore Float Glass',       4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100255','4mm Autumn Float Glass',         4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100260','4mm Arctic Float Glass',         4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100265','4mm Stippolyte Float Glass',     4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100270','4mm Cotswold Float Glass',       4, 'm2', 54.50, null, false, false, false),
  ('Glass','GL100275','4mm Arctic Toughened',           4, 'm2', 54.50, null, false, false, false),

  -- 4mm Patterned Toughened (£63.00/m²)
  ('Glass','GL100280','4mm AUTUMN LEAF TOUGHENED',  4, 'm2', 63.00, null, false, false, false),
  ('Glass','GL100285','4mm CHANTILLY TOUGHENED',    4, 'm2', 63.00, null, false, false, false),
  ('Glass','GL100290','4mm CHARCOAL TOUGHENED',     4, 'm2', 63.00, null, false, false, false),
  ('Glass','GL100295','4mm COTSWOLD TOUGHENED',     4, 'm2', 63.00, null, false, false, false),
  ('Glass','GL100300','4mm DIGITAL TOUGHENED',      4, 'm2', 63.00, null, false, false, false),
  ('Glass','GL100305','4mm EVERGLADE TOUGHENED',    4, 'm2', 63.00, null, false, false, false),
  ('Glass','GL100310','4mm FLEMISH TOUGHENED',      4, 'm2', 63.00, null, false, false, false),
  ('Glass','GL100315','4mm FLORIELLE TOUGHENED',    4, 'm2', 63.00, null, false, false, false),
  ('Glass','GL100320','4mm REEDED TOUGHENED',       4, 'm2', 63.00, null, false, false, false),
  ('Glass','GL100325','4mm MAYFLOWER TOUGHENED',    4, 'm2', 63.00, null, false, false, false),
  ('Glass','GL100330','4mm MINSTER TOUGHENED',      4, 'm2', 63.00, null, false, false, false),
  ('Glass','GL100335','4mm OAK TOUGHENED',          4, 'm2', 63.00, null, false, false, false),
  ('Glass','GL100340','4mm PELERINE TOUGHENED',     4, 'm2', 63.00, null, false, false, false),
  ('Glass','GL100345','4mm STIPPOLYTE TOUGHENED',   4, 'm2', 63.00, null, false, false, false),
  ('Glass','GL100350','4mm SYCAMORE TOUGHENED',     4, 'm2', 63.00, null, false, false, false),
  ('Glass','GL100355','4mm TAFFETA TOUGHENED',      4, 'm2', 63.00, null, false, false, false),
  ('Glass','GL100360','4mm WARWICK TOUGHENED',      4, 'm2', 63.00, null, false, false, false),

  -- Unglazed / Each / Starburst
  ('Glass','GL100365','4mm NO GLASS (UNGLAZED)',                  4, 'm2',   0.01, null, false, false, true),
  ('Glass','GL100390','4mm Red Starburst Glass 150mm Square',     4, 'Each', 37.00, null, false, false, true),
  ('Glass','GL100395','4mm Blue Starburst Glass 150mm Square',    4, 'Each', 37.00, null, false, false, true),

  -- 5mm Laminated Decorative (special order, £255–£350/m²)
  ('Glass','GL100405','5mm Laminated Fleur Design',               5, 'm2', 255.00, null, false, false, true),
  ('Glass','GL100410','5mm Laminated Fleur de Lys Design',        5, 'm2', 255.00, null, false, false, true),
  ('Glass','GL100415','5mm Laminated Star Design',                5, 'm2', 255.00, null, false, false, true),
  ('Glass','GL100420','5mm Laminated Bright Star Design',         5, 'm2', 255.00, null, false, false, true),
  ('Glass','GL100425','5mm Laminated Double Fleur Design',        5, 'm2', 270.00, null, false, false, true),
  ('Glass','GL100430','5mm Laminated Empress Design',             5, 'm2', 270.00, null, false, false, true),
  ('Glass','GL100435','5mm Laminated Gothic Design',              5, 'm2', 255.00, null, false, false, true),
  ('Glass','GL100440','5mm Laminated Amber Gothic Design',        5, 'm2', 350.00, null, false, false, true),
  ('Glass','GL100445','5mm Laminated Blue Gothic Design',         5, 'm2', 350.00, null, false, false, true),

  -- Spectrum / LandVac / Georgian Wire / Vinyl
  ('Glass','GL100480','4mm Spectrum Flat Glass Float (Colour to be specified)', 4,   'm2', 155.00, null, false, false, true),
  ('Glass','GL100500','8.3mm LandVac Enhance Toughened',           8.3, 'm2', 288.00, null, false, false, true),
  ('Glass','GL100501','8.3mm LandVac Enhance Toughened Obscure Film', 8.3, 'm2', 298.00, null, false, false, true),
  ('Glass','GL100505','7mm Georgian Wire Cast',                    7,   'm2',  54.10, null, false, false, true),
  ('Glass','GL100510','4mm Clear Toughened with applied vinyl film', 4,  'm2',  43.19, null, false, false, true)

ON CONFLICT (code) DO UPDATE SET
  name         = EXCLUDED.name,
  thickness_mm = EXCLUDED.thickness_mm,
  unit         = EXCLUDED.unit,
  cost_per_m2  = EXCLUDED.cost_per_m2,
  multiplier   = EXCLUDED.multiplier,
  waste        = EXCLUDED.waste,
  stocked      = EXCLUDED.stocked,
  special      = EXCLUDED.special;

-- ── 5. Verify count ───────────────────────────────────────────
DO $$
DECLARE cnt integer;
BEGIN
  SELECT count(*) INTO cnt FROM parts_catalogue WHERE category = 'Glass';
  RAISE NOTICE 'Glass parts in catalogue after upsert: %', cnt;
  IF cnt < 75 THEN
    RAISE EXCEPTION 'Expected at least 75 active Glass parts, got %', cnt;
  END IF;
END $$;

COMMIT;
