#!/usr/bin/env node
/**
 * scripts/build-step-g-sql.mjs
 *
 * Parses docs/integrate-glass-parts.txt, docs/integrate-part-allocator.txt
 * and docs/integrate-ironmongery.txt, then writes the data sections of:
 *   sql/step-g1-parts-catalogue.sql   (glass + weights/timber + ironmongery parts)
 *   sql/step-g2-ironmongery-import.sql (products × finish kits × kit lines)
 *   sql/step-g3-default-ironmongery.sql (91 default ironmongery rules)
 *
 * Run with:  node scripts/build-step-g-sql.mjs
 * Test with: npx vitest run scripts/build-step-g-sql.test.js
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = join(SCRIPT_DIR, '..')

// ─── SQL helpers ─────────────────────────────────────────────────────────────

/** Single-quote a value for SQL, escaping embedded single quotes. */
function sq(s) {
  if (s === null || s === undefined) return 'NULL'
  return `'${String(s).replace(/'/g, "''")}'`
}

function num(n) {
  return (n === null || n === undefined || n === '') ? 'null' : String(n)
}

// ─── 1. Glass parts ───────────────────────────────────────────────────────────

/**
 * Parse docs/integrate-glass-parts.txt.
 * Returns active rows only, mapped to parts_catalogue columns.
 */
export function parseGlass(root = DEFAULT_ROOT) {
  const src = readFileSync(join(root, 'docs/integrate-glass-parts.txt'), 'utf8')
  const parts = []

  for (const line of src.split('\n')) {
    if (line.startsWith('#') || line.startsWith('part_no\t')) continue
    const c = line.split('\t')
    // Columns: 0=part_no, 1=name, 2=thickness_mm, 3=properties, 4=unit, 5=cost,
    //          6=multiplier, 7=price, 8=waste, 9=stocked, 10=van_stock, 11=special, 12=status
    if (c.length < 13) continue
    if (c[12].trim() !== 'active') continue

    parts.push({
      part_code:    c[0].trim(),
      part_name:    c[1].trim(),
      category:     'Glass',
      unit:         (c[4].trim() || 'm2').toLowerCase(),
      thickness_mm: c[2].trim() ? Number(c[2].trim()) : null,
      unit_cost:    c[5].trim() ? Number(c[5].trim()) : null,
      is_active:    true,
      special:      c[11].trim() === 'Yes',
      stocked:      c[9].trim() === 'Yes',
      properties:   '{}',
    })
  }

  return parts
}

// ─── 2. Sash weights + timber ─────────────────────────────────────────────────

/**
 * Parse the full "## Referenced parts" section of docs/integrate-part-allocator.txt.
 *
 * Sash Weight category (LW*, RLZ*, SW*) — unit 'each'
 *   LW100005/10  lead weights
 *   RLZ2092–1941 21 steel weights
 *   SW100005–30  6 traditional cast weights
 *
 * Timber category (AA*, TP*, TT*) — unit 'each' for AA, 'm' for TP/TT
 *   AA01–03  nominal lining / board allowances
 *   TP01–74  per-metre timber lengths
 *   TT69     per-metre MDF architrave
 *
 * Expected: 29 Sash Weight + 12 Timber = 41 rows
 */
export function parseWeightsAndTimber(root = DEFAULT_ROOT) {
  const src = readFileSync(join(root, 'docs/integrate-part-allocator.txt'), 'utf8')
  const parts = []

  // Generic item regex: CODE  description  £price  (optional trailing comment ignored)
  const ITEM_RE = /^([A-Z]{2,}\d+)\s+(.+?)\s+£([\d.]+)/

  let mode = null  // 'weight' | 'timber'

  for (const line of src.split('\n')) {
    if (line.includes('Sash Weight (WT):'))  { mode = 'weight'; continue }
    if (line.includes('Timber (TB)'))        { mode = 'timber'; continue }
    // Stop at next ## section or the "All timber parts" note
    if ((line.startsWith('##') || line.startsWith('All timber')) && mode) { mode = null; continue }
    if (!mode) continue

    for (const item of line.split('|').map(s => s.trim()).filter(Boolean)) {
      const m = item.match(ITEM_RE)
      if (!m) continue

      const code = m[1]
      const rawDesc = m[2].trim()
      const cost = Number(m[3])

      if (mode === 'weight') {
        // Append "Sash Weight" unless the description already contains "Weight"
        const name = /weight/i.test(rawDesc) ? rawDesc : `${rawDesc} Sash Weight`
        parts.push({
          part_code:    code,
          part_name:    name,
          category:     'Sash Weight',
          unit:         'each',
          thickness_mm: null,
          unit_cost:    cost,
          is_active:    true,
          special:      false,
          stocked:      false,
          properties:   '{}',
        })
      } else {
        // Timber: TP/TT are priced per metre; AA are nominal each items
        const unit = /^(TP|TT)/.test(code) ? 'm' : 'each'
        // Strip trailing "each (nominal)" annotation from AA descriptions
        const name = rawDesc.replace(/\s+each\s*\(.*?\)\s*$/i, '').trim()
        parts.push({
          part_code:    code,
          part_name:    name,
          category:     'Timber',
          unit,
          thickness_mm: null,
          unit_cost:    cost,
          is_active:    true,
          special:      false,
          stocked:      false,
          properties:   '{}',
        })
      }
    }
  }

  return parts
}

// ─── 3. Ironmongery parts (PARTS section) ────────────────────────────────────

/**
 * Parse the "## PARTS" section of docs/integrate-ironmongery.txt.
 * Returns 1 row per part code.
 *
 * unit_cost: derived from kit data where the part is the sole component (qty=1)
 * in a single-part kit — the kit cost becomes the part unit_cost.
 * Parts that appear only in multi-component kits get unit_cost=0 and
 * properties.cost_unknown=true.  (parts_catalogue.unit_cost is NOT NULL.)
 */
export function parseIronmongeryParts(root = DEFAULT_ROOT) {
  const src = readFileSync(join(root, 'docs/integrate-ironmongery.txt'), 'utf8')
  const rawParts = []
  let inParts = false

  for (const line of src.split('\n')) {
    if (line.startsWith('## PARTS'))  { inParts = true;  continue }
    if (!inParts) continue
    const trimmed = line.trim()
    if (!trimmed) continue

    const cols = line.split(' | ').map(s => s.trim())
    if (cols.length < 2) continue

    rawParts.push({
      part_code:  cols[0],
      part_name:  cols[1],
      image_file: (cols[2] || '').replace(/\s+/g, ''),
    })
  }

  // Build cost lookup: for each part that is the sole component (qty=1) in a
  // kit, record the kit costs.  Parts with consistent sole-kit costs get that
  // cost; others get unit_cost=0 with cost_unknown flag.
  const { variants, variantParts } = parseProducts(root)

  // Map (short_name|finish_code) → kit cost
  const variantCostMap = new Map(
    variants.map(v => [`${v.short_name}|${v.finish_code}`, v.cost])
  )

  // Group variant_parts by (short_name|finish_code) → [{ part_code, quantity }]
  const kitPartsMap = new Map()
  for (const vp of variantParts) {
    const key = `${vp.short_name}|${vp.finish_code}`
    if (!kitPartsMap.has(key)) kitPartsMap.set(key, [])
    kitPartsMap.get(key).push(vp)
  }

  // For each kit that has exactly one part line with qty=1, map part_code → cost
  const derivedCosts = new Map()   // part_code → Set of costs
  for (const [key, kitParts] of kitPartsMap) {
    if (kitParts.length === 1 && kitParts[0].quantity === 1) {
      const code = kitParts[0].part_code
      const cost = variantCostMap.get(key)
      if (cost != null) {
        if (!derivedCosts.has(code)) derivedCosts.set(code, new Set())
        derivedCosts.get(code).add(Math.round(cost * 100))  // pence, for dedup
      }
    }
  }

  let costUnknownCount = 0
  const parts = rawParts.map(({ part_code, part_name, image_file }) => {
    const costSet = derivedCosts.get(part_code)
    // Use derived cost only when all sole-kit appearances agree on the price
    let unit_cost = 0
    let cost_unknown = true
    if (costSet && costSet.size === 1) {
      unit_cost    = [...costSet][0] / 100
      cost_unknown = false
    } else {
      costUnknownCount++
    }

    const baseProps = image_file ? { image_file } : {}
    const properties = cost_unknown
      ? JSON.stringify({ ...baseProps, cost_unknown: true })
      : (image_file ? JSON.stringify(baseProps) : '{}')

    return {
      part_code,
      part_name,
      category:     'Ironmongery',
      unit:         'each',
      thickness_mm: null,
      unit_cost,
      is_active:    true,
      special:      false,
      stocked:      false,
      properties,
    }
  })

  if (process.env.VERBOSE) {
    console.log(`  Ironmongery parts: ${parts.length} total, ${parts.length - costUnknownCount} with derived cost, ${costUnknownCount} cost_unknown`)
  }

  return parts
}

// ─── 4. Ironmongery products / variants / variant_parts ───────────────────────

const FINISH_NAMES = {
  PB: 'Polished Brass', PC: 'Polished Chrome', SC: 'Satin Chrome',
  ABl: 'Antique Black', Blk: 'Black', Wht: 'White',
  ABs: 'Antique Brass', ABz: 'Antique Bronze', PN: 'Polished Nickel',
  PSS: 'Polished Stainless Steel', Pwt: 'Pewter', SB: 'Satin Brass',
  TB: 'Tudor/Tarnished Brass', Br: 'Bronze',
}

/**
 * Parse the "## PRODUCTS" section.
 * Returns { products, variants, variantParts }.
 */
export function parseProducts(root = DEFAULT_ROOT) {
  const src = readFileSync(join(root, 'docs/integrate-ironmongery.txt'), 'utf8')
  const products    = []   // { short_name, name }
  const variants    = []   // { short_name, finish_code, finish_name, cost, part_no }
  const variantParts = []  // { short_name, finish_code, part_code, quantity, sort_order }

  let inProducts    = false
  let currentShort  = null

  for (const line of src.split('\n')) {
    if (line.startsWith('## PRODUCTS')) { inProducts = true; continue }
    if (line.startsWith('## PARTS'))    { inProducts = false; continue }
    if (!inProducts) continue

    if (line.startsWith('  ')) {
      // Kit line: "  PB: 1xHHD681 = £7.04"
      //       or  "  PB: 1xA + 2xB + 1xC = £50.00"
      if (!currentShort) continue
      const m = line.match(/^\s+(\S+):\s+(.+?)\s*=\s*£([\d.]+)\s*$/)
      if (!m) continue

      const finish_code  = m[1]
      const partsStr     = m[2]
      const cost         = Number(m[3])
      const finish_name  = FINISH_NAMES[finish_code] || finish_code

      const kitParts = []
      for (const token of partsStr.split('+').map(s => s.trim())) {
        const pm = token.match(/^(\d+)x(\S+)$/)
        if (pm) kitParts.push({ qty: Number(pm[1]), part_code: pm[2] })
      }

      const part_no = (kitParts.length === 1 && kitParts[0].qty === 1)
        ? kitParts[0].part_code : null

      variants.push({ short_name: currentShort, finish_code, finish_name, cost, part_no })

      kitParts.forEach(({ qty, part_code }, i) => {
        variantParts.push({
          short_name: currentShort, finish_code, part_code,
          quantity: qty, sort_order: i,
        })
      })

    } else if (line.includes(' | ')) {
      // Product line: "short_name | Full Name"
      const pipe = line.indexOf(' | ')
      const short_name = line.slice(0, pipe).trim()
      const name       = line.slice(pipe + 3).trim()
      if (short_name && name) {
        products.push({ short_name, name })
        currentShort = short_name
      }
    }
  }

  return { products, variants, variantParts }
}

// ─── 5. Default ironmongery rules ─────────────────────────────────────────────

/**
 * Convert Integrate condition/expression syntax to engine syntax.
 * [var] → var,  ![var] → not var,  && → and,  || → or
 */
function convertExpr(s) {
  return s
    .replace(/!\[(\w+)\]/g, 'not $1')
    .replace(/\[(\w+)\]/g, '$1')
    .replace(/&&/g, 'and')
    .replace(/\|\|/g, 'or')
    .trim()
}

/**
 * Parse the "## DEFAULT IRONMONGERY RULES" section.
 * Returns array of rule objects.
 * Yorkshire (group=sash_windows, product=yorkshire_sash_kit) → is_active=false.
 * All bifolding_doors → is_active=false (already 0 in source).
 */
export function parseRules(root = DEFAULT_ROOT) {
  const src = readFileSync(join(root, 'docs/integrate-ironmongery.txt'), 'utf8')
  const rules = []
  let inRules = false

  for (const line of src.split('\n')) {
    if (line.startsWith('## DEFAULT IRONMONGERY RULES')) { inRules = true; continue }
    if (line.startsWith('##'))                            { inRules = false; continue }
    if (!inRules) continue
    if (!line.trim() || line.startsWith('#')) continue

    // Columns: sort_order | group_name | loop_target | label | condition | qty | value | markup | level | is_active | comment
    const cols = line.split(' | ')
    if (cols.length < 10) continue

    const sort_order  = parseInt(cols[0].trim(), 10)
    const group_name  = cols[1].trim()
    const loop_target = cols[2].trim() || null
    const label       = cols[3].trim() || null
    const condition   = convertExpr(cols[4].trim())
    const qty_expr    = convertExpr(cols[5].trim())

    // Value: [START_<short>_SEPERATOR_<finish>]
    const valueStr = cols[6].trim()
    const vm = valueStr.match(/\[START_(.+)_SEPERATOR_(\w+)\]/)
    if (!vm) continue
    const product_short_name = vm[1]
    const finish_code        = vm[2]

    const srcActive = parseInt(cols[9].trim(), 10) === 1

    // Force inactive: Yorkshire sash kit (is_active=1 in source but spec says inactive)
    const is_active = srcActive
      && !(group_name === 'sash_windows' && product_short_name === 'yorkshire_sash_kit')
      && group_name !== 'bifolding_doors'

    rules.push({
      sort_order,
      group_name,
      loop_target,
      label,
      condition,
      qty_expr,
      product_short_name,
      finish_code,
      is_active,
    })
  }

  return rules
}

// ─── 6. SQL generation helpers ────────────────────────────────────────────────

function partsCatalogueRow(p) {
  const props = typeof p.properties === 'object'
    ? JSON.stringify(p.properties)
    : p.properties
  return `  (${sq(p.part_code)},${sq(p.part_name)},${sq(p.category)},${sq(p.unit)},${num(p.thickness_mm)},${num(p.unit_cost)},${p.is_active},${p.special},${p.stocked},${sq(props)},now())`
}

function chunkArray(arr, size) {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

function upsertPartsCatalogue(parts, comment) {
  const cols = `  (part_code, part_name, category, unit, thickness_mm, unit_cost, is_active, special, stocked, properties, updated_at)`
  const onConflict = `ON CONFLICT (part_code) DO UPDATE SET
  part_name    = EXCLUDED.part_name,
  category     = EXCLUDED.category,
  unit         = EXCLUDED.unit,
  thickness_mm = EXCLUDED.thickness_mm,
  unit_cost    = EXCLUDED.unit_cost,
  is_active    = EXCLUDED.is_active,
  special      = EXCLUDED.special,
  stocked      = EXCLUDED.stocked,
  properties   = EXCLUDED.properties,
  updated_at   = EXCLUDED.updated_at;`

  // Split into chunks of 500 to avoid overly long statements
  const chunks = chunkArray(parts, 500)
  return chunks.map((chunk, idx) => {
    const header = idx === 0 ? `-- ${comment}\n` : ''
    return `${header}INSERT INTO parts_catalogue\n${cols}\nVALUES\n${chunk.map(partsCatalogueRow).join(',\n')}\n${onConflict}`
  }).join('\n\n')
}

// ─── 7. Write step-g1-parts-catalogue.sql ─────────────────────────────────────

function buildG1(root = DEFAULT_ROOT) {
  const glass    = parseGlass(root)
  const wt       = parseWeightsAndTimber(root)
  const iron     = parseIronmongeryParts(root)

  const allCodes = [...glass, ...wt, ...iron].map(p => sq(p.part_code)).join(',\n    ')

  const sql = `-- =============================================================================
-- step-g1-parts-catalogue.sql
-- Parts catalogue: schema changes + glass, sash weight, timber, ironmongery upserts
-- Replaces step-e1-glass-catalogue.sql (which used wrong column names and never ran)
-- Re-runnable / transactional / safe
-- Generated by scripts/build-step-g-sql.mjs — do not edit manually
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ALTER TABLE parts_catalogue — add columns IF NOT EXISTS
-- ---------------------------------------------------------------------------

ALTER TABLE parts_catalogue
  ADD COLUMN IF NOT EXISTS category     text,
  ADD COLUMN IF NOT EXISTS unit         text,
  ADD COLUMN IF NOT EXISTS thickness_mm numeric,
  ADD COLUMN IF NOT EXISTS properties   jsonb       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS multiplier   numeric,
  ADD COLUMN IF NOT EXISTS waste        boolean,
  ADD COLUMN IF NOT EXISTS stocked      boolean,
  ADD COLUMN IF NOT EXISTS special      boolean,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Duplicate-detection guard before unique index
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_dupes text;
BEGIN
  SELECT string_agg(part_code || ' (' || cnt::text || ' rows)', ', ')
  INTO   v_dupes
  FROM (
    SELECT part_code, COUNT(*) AS cnt
    FROM   parts_catalogue
    GROUP  BY part_code
    HAVING COUNT(*) > 1
  ) sub;

  IF v_dupes IS NOT NULL THEN
    RAISE EXCEPTION
      'Duplicate part_codes found — resolve before re-running: %', v_dupes;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS parts_catalogue_part_code_uq
  ON parts_catalogue (part_code);

-- ---------------------------------------------------------------------------
-- 3. Glass parts upsert (${glass.length} rows)
--    Source: docs/integrate-glass-parts.txt (active rows only)
-- ---------------------------------------------------------------------------

${upsertPartsCatalogue(glass, `Glass parts — ${glass.length} active rows`)}

-- ---------------------------------------------------------------------------
-- 4. Sash Weight parts upsert (${wt.filter(p => p.category === 'Sash Weight').length} rows)
--    Timber parts upsert (${wt.filter(p => p.category === 'Timber').length} rows)
--    Source: docs/integrate-part-allocator.txt "Referenced parts"
-- ---------------------------------------------------------------------------

${upsertPartsCatalogue(wt, `Sash Weight + Timber parts — ${wt.length} rows`)}

-- ---------------------------------------------------------------------------
-- 5. Ironmongery parts upsert (${iron.length} rows)
--    Source: docs/integrate-ironmongery.txt PARTS section
--    unit_cost intentionally null — kit costs are authoritative (see G2)
-- ---------------------------------------------------------------------------

${upsertPartsCatalogue(iron, `Ironmongery parts — ${iron.length} rows`)}

-- ---------------------------------------------------------------------------
-- 6. Review: existing rows not touched by this import
--    (Should be empty on a clean database; review before re-running)
-- ---------------------------------------------------------------------------

SELECT part_code, part_name, category
FROM   parts_catalogue
WHERE  updated_at IS NULL
ORDER  BY part_code;

COMMIT;
`
  return sql
}

// ─── 8. Write step-g2-ironmongery-import.sql ──────────────────────────────────

function buildG2(root = DEFAULT_ROOT) {
  const { products, variants, variantParts } = parseProducts(root)

  // ── Products VALUES ──────────────────────────────────────────────────────
  const productsVals = products
    .map(p => `  (${sq(p.name)},${sq(p.short_name)},true)`)
    .join(',\n')

  // ── Variants VALUES ──────────────────────────────────────────────────────
  const variantsVals = variants
    .map(v => `  (${sq(v.short_name)},${sq(v.finish_code)},${sq(v.finish_name)},${num(v.cost)},${v.part_no ? sq(v.part_no) : 'NULL'})`)
    .join(',\n')

  // ── Variant-parts VALUES ─────────────────────────────────────────────────
  const varPartsVals = variantParts
    .map(vp => `  (${sq(vp.short_name)},${sq(vp.finish_code)},${sq(vp.part_code)},${num(vp.quantity)},${num(vp.sort_order)})`)
    .join(',\n')

  // Short names list for the DELETE and final SELECT
  const shortNamesList = products.map(p => sq(p.short_name)).join(',\n    ')

  const sql = `-- =============================================================================
-- step-g2-ironmongery-import.sql
-- Transactional, re-runnable ironmongery import
-- Generated by scripts/build-step-g-sql.mjs — do not edit manually
-- Products: ${products.length}  Variants: ${variants.length}  Kit lines: ${variantParts.length}
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- STEP 1: ALTER ironmongery_products
-- ---------------------------------------------------------------------------

ALTER TABLE ironmongery_products
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS is_active bool NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS ironmongery_products_short_name_uq
  ON ironmongery_products(short_name) WHERE short_name IS NOT NULL;

-- ---------------------------------------------------------------------------
-- STEP 2: ALTER ironmongery_variants — add unique constraint
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ironmongery_variants_product_finish_uq'
  ) THEN
    ALTER TABLE ironmongery_variants
      ADD CONSTRAINT ironmongery_variants_product_finish_uq UNIQUE (product_id, finish_code);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- STEP 3: Create ironmongery_variant_parts table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ironmongery_variant_parts (
  id         bigserial PRIMARY KEY,
  variant_id bigint  NOT NULL REFERENCES ironmongery_variants(id) ON DELETE CASCADE,
  part_code  text    NOT NULL,
  quantity   numeric NOT NULL DEFAULT 1,
  sort_order int     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ironmongery_variant_parts_variant_id_idx
  ON ironmongery_variant_parts(variant_id);

-- ---------------------------------------------------------------------------
-- STEP 4: Seed reference_options for ironmongery_finish
-- ---------------------------------------------------------------------------

INSERT INTO reference_options (category_code, code, label, sort_order, is_active)
VALUES
  ('ironmongery_finish', 'PB',  'Polished Brass',          10,  true),
  ('ironmongery_finish', 'PC',  'Polished Chrome',          20,  true),
  ('ironmongery_finish', 'SC',  'Satin Chrome',             30,  true),
  ('ironmongery_finish', 'ABl', 'Antique Black',            40,  true),
  ('ironmongery_finish', 'Blk', 'Black',                    50,  true),
  ('ironmongery_finish', 'Wht', 'White',                    60,  true),
  ('ironmongery_finish', 'ABs', 'Antique Brass',            70,  true),
  ('ironmongery_finish', 'ABz', 'Antique Bronze',           80,  true),
  ('ironmongery_finish', 'PN',  'Polished Nickel',          90,  true),
  ('ironmongery_finish', 'PSS', 'Polished Stainless Steel', 100, true),
  ('ironmongery_finish', 'Pwt', 'Pewter',                   110, true),
  ('ironmongery_finish', 'SB',  'Satin Brass',              120, true),
  ('ironmongery_finish', 'TB',  'Tudor/Tarnished Brass',    130, true),
  ('ironmongery_finish', 'Br',  'Bronze',                   140, true)
ON CONFLICT (category_code, code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- STEP 5: Match existing ironmongery_products rows to Integrate short_names
-- ---------------------------------------------------------------------------

UPDATE ironmongery_products ip
SET short_name = v.short_name
FROM (VALUES
${products.map(p => `  (${sq(p.name)},${sq(p.short_name)})`).join(',\n')}
) AS v(name, short_name)
WHERE lower(trim(ip.name)) = lower(trim(v.name))
  AND ip.short_name IS NULL;

-- ---------------------------------------------------------------------------
-- STEP 6: Upsert 437 products
-- ---------------------------------------------------------------------------

INSERT INTO ironmongery_products (name, short_name, is_active)
VALUES
${productsVals}
ON CONFLICT (short_name) WHERE short_name IS NOT NULL DO UPDATE SET
  name      = EXCLUDED.name,
  is_active = EXCLUDED.is_active;

-- ---------------------------------------------------------------------------
-- STEP 7: Upsert ${variants.length} variants (product × finish kits)
-- ---------------------------------------------------------------------------

INSERT INTO ironmongery_variants (product_id, finish_code, finish_name, cost, part_no)
SELECT ip.id, v.finish_code, v.finish_name, v.cost, v.part_no
FROM (VALUES
${variantsVals}
) AS v(short_name, finish_code, finish_name, cost, part_no)
JOIN ironmongery_products ip ON ip.short_name = v.short_name
ON CONFLICT (product_id, finish_code) DO UPDATE SET
  finish_name = EXCLUDED.finish_name,
  cost        = EXCLUDED.cost,
  part_no     = EXCLUDED.part_no;

-- ---------------------------------------------------------------------------
-- STEP 8: Re-seed ${variantParts.length} variant parts (clear + insert)
-- ---------------------------------------------------------------------------

DELETE FROM ironmongery_variant_parts
WHERE variant_id IN (
  SELECT iv.id
  FROM   ironmongery_variants iv
  JOIN   ironmongery_products  ip ON ip.id = iv.product_id
  WHERE  ip.short_name IN (
    ${shortNamesList}
  )
);

INSERT INTO ironmongery_variant_parts (variant_id, part_code, quantity, sort_order)
SELECT iv.id, vp.part_code, vp.quantity, vp.sort_order
FROM (VALUES
${varPartsVals}
) AS vp(short_name, finish_code, part_code, quantity, sort_order)
JOIN ironmongery_products ip ON ip.short_name = vp.short_name
JOIN ironmongery_variants iv
  ON iv.product_id = ip.id AND iv.finish_code = vp.finish_code;

-- ---------------------------------------------------------------------------
-- STEP 9: Review — existing products not matched to any Integrate short_name
-- ---------------------------------------------------------------------------

SELECT id, name, short_name, is_active
FROM   ironmongery_products
WHERE  short_name IS NULL
ORDER  BY name;

COMMIT;
`
  return sql
}

// ─── 9. Write step-g3-default-ironmongery.sql ─────────────────────────────────

function ruleInsert(r) {
  const loopTarget = r.loop_target ? sq(r.loop_target) : 'NULL'
  const label      = r.label       ? sq(r.label)       : 'NULL'
  return `INSERT INTO part_allocation_rules
  (sort_order, group_name, loop_target, label, condition, qty_expr,
   part_code, measure_expr, is_active,
   rule_family, product_short_name, finish_code)
SELECT ${r.sort_order}, ${sq(r.group_name)}, ${loopTarget}, ${label},
  ${sq(r.condition)},
  ${sq(r.qty_expr)}, NULL, NULL, ${r.is_active},
  'default_ironmongery', ${sq(r.product_short_name)}, ${sq(r.finish_code)}
WHERE NOT EXISTS (
  SELECT 1 FROM part_allocation_rules
   WHERE rule_family = 'default_ironmongery'
     AND group_name = ${sq(r.group_name)} AND sort_order = ${r.sort_order}
     AND product_short_name = ${sq(r.product_short_name)}
);`
}

function buildG3(root = DEFAULT_ROOT) {
  const rules = parseRules(root)

  // Group rules by group_name for readability
  const groups = {}
  for (const r of rules) {
    if (!groups[r.group_name]) groups[r.group_name] = []
    groups[r.group_name].push(r)
  }

  const rulesSql = Object.entries(groups)
    .map(([groupName, grpRules]) => {
      const header = `\n-- ---------------------------------------------------------------------------\n-- GROUP: ${groupName}\n-- ---------------------------------------------------------------------------\n`
      return header + grpRules.map(ruleInsert).join('\n\n')
    })
    .join('\n')

  const sql = `-- DO NOT RUN DIRECTLY — paste into Supabase SQL editor.
-- =============================================================================
-- step-g3-default-ironmongery.sql
--
-- Step G3: Default Ironmongery
--   1. Extend part_allocation_rules with rule_family, product_short_name,
--      finish_code columns and a CHECK constraint.
--   2. Add ironmongeryFinish field definition to default_field_definitions.
--   3. Seed ${rules.length} default_ironmongery rules into part_allocation_rules.
--
-- Safe to re-run: all DDL uses IF NOT EXISTS / DO $$ guards; all DML uses
-- WHERE NOT EXISTS guards so duplicate rows are never inserted.
-- Generated by scripts/build-step-g-sql.mjs — do not edit manually
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: ALTER part_allocation_rules
-- =============================================================================

ALTER TABLE part_allocation_rules
  ADD COLUMN IF NOT EXISTS rule_family         text NOT NULL DEFAULT 'part_allocator',
  ADD COLUMN IF NOT EXISTS product_short_name  text,
  ADD COLUMN IF NOT EXISTS finish_code         text;

-- CHECK constraint: only two families allowed
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'part_allocation_rules_rule_family_check'
  ) THEN
    ALTER TABLE part_allocation_rules
      ADD CONSTRAINT part_allocation_rules_rule_family_check
      CHECK (rule_family IN ('part_allocator', 'default_ironmongery'));
  END IF;
END $$;

-- Ensure all pre-existing rows are explicitly stamped as 'part_allocator'
UPDATE part_allocation_rules
   SET rule_family = 'part_allocator'
 WHERE rule_family IS NULL OR rule_family = 'part_allocator';


-- =============================================================================
-- STEP 2: ironmongeryFinish field definition
-- =============================================================================

INSERT INTO default_field_definitions (
  part_type,
  field_key,
  property_name,
  label,
  data_type,
  is_required,
  reference_category,
  sort_order,
  is_active
) VALUES (
  'paintAndIronmongeryPart',
  'paintAndIronmongeryPart.ironmongeryFinish',
  'ironmongeryFinish',
  'Ironmongery Finish',
  'reference',
  false,
  'ironmongery_finish',
  1000,
  true
) ON CONFLICT (field_key) DO UPDATE SET
  reference_category = EXCLUDED.reference_category,
  label              = EXCLUDED.label,
  data_type          = EXCLUDED.data_type;


-- =============================================================================
-- STEP 3: Seed ${rules.length} default ironmongery rules
-- =============================================================================
${rulesSql}

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT
  rule_family,
  group_name,
  is_active,
  count(*) AS rule_count
FROM part_allocation_rules
WHERE rule_family = 'default_ironmongery'
GROUP BY rule_family, group_name, is_active
ORDER BY group_name, is_active DESC;

COMMIT;
`
  return sql
}

// ─── 10. Main ─────────────────────────────────────────────────────────────────

export function buildAll(root = DEFAULT_ROOT) {
  const glass    = parseGlass(root)
  const wt       = parseWeightsAndTimber(root)
  const iron     = parseIronmongeryParts(root)
  const { products, variants, variantParts } = parseProducts(root)
  const rules    = parseRules(root)

  const counts = {
    glass:        glass.length,
    weights:      wt.filter(p => p.category === 'Sash Weight').length,
    timber:       wt.filter(p => p.category === 'Timber').length,
    ironmongery:  iron.length,
    products:     products.length,
    variants:     variants.length,
    variantParts: variantParts.length,
    rules:        rules.length,
  }

  return counts
}

// When run directly (not imported as a module)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log('Building step-g SQL files…')

  const g1 = buildG1()
  writeFileSync(join(DEFAULT_ROOT, 'sql/step-g1-parts-catalogue.sql'), g1)
  console.log(`  ✓ sql/step-g1-parts-catalogue.sql  (${g1.length.toLocaleString()} bytes)`)

  const g2 = buildG2()
  writeFileSync(join(DEFAULT_ROOT, 'sql/step-g2-ironmongery-import.sql'), g2)
  console.log(`  ✓ sql/step-g2-ironmongery-import.sql  (${g2.length.toLocaleString()} bytes)`)

  const g3 = buildG3()
  writeFileSync(join(DEFAULT_ROOT, 'sql/step-g3-default-ironmongery.sql'), g3)
  console.log(`  ✓ sql/step-g3-default-ironmongery.sql  (${g3.length.toLocaleString()} bytes)`)

  const counts = buildAll()
  console.log('\nCounts:')
  console.log(`  Glass parts       : ${counts.glass}   (expected 75)`)
  console.log(`  Sash weights      : ${counts.weights}  (expected 29)`)
  console.log(`  Timber parts      : ${counts.timber}  (expected 12)`)
  console.log(`  Ironmongery parts : ${counts.ironmongery}  (expected 1058)`)
  console.log(`  Products          : ${counts.products} (expected 437)`)
  console.log(`  Finish kits       : ${counts.variants} (expected ~1083)`)
  console.log(`  Kit lines         : ${counts.variantParts} (expected 1116)`)
  console.log(`  Default IR rules  : ${counts.rules}   (expected 91)`)

  const mismatches = [
    counts.glass !== 75          && `glass: got ${counts.glass}, want 75`,
    counts.weights !== 29        && `sash weights: got ${counts.weights}, want 29`,
    counts.timber !== 12         && `timber: got ${counts.timber}, want 12`,
    counts.ironmongery !== 1058  && `ironmongery parts: got ${counts.ironmongery}, want 1058`,
    counts.products !== 437      && `products: got ${counts.products}, want 437`,
    counts.variantParts !== 1116 && `kit lines: got ${counts.variantParts}, want 1116`,
    counts.rules !== 91          && `rules: got ${counts.rules}, want 91`,
  ].filter(Boolean)

  if (mismatches.length) {
    console.error('\nCount mismatches:')
    mismatches.forEach(m => console.error(`  ✗ ${m}`))
    process.exit(1)
  } else {
    console.log('\nAll counts match ✓')
  }
}
