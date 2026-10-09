/**
 * loadPricingContext.test.js
 * 1. Source-level tests: verifies that both priceDrawing and the benchmark page
 *    use loadPricingContext and resolveIronmongeryLines from the shared module,
 *    ensuring a single pricing path.
 * 2. Behavioural tests against a mock Supabase client that enforces PostgREST's
 *    1,000-row response cap — the cause of the trickle vent 0.00 regression.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { loadPricingContext, resolveIronmongeryLines } from './loadPricingContext.js'
import { runPricingOnTree } from './pricingEngine.js'
import { BENCHMARK_L34046 } from './benchmarks/index.js'
import { PF30_RULES } from './benchmarks/pf30Rules.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('Single pricing path — source-level verification', () => {
  const engineSource = readFileSync(resolve(__dirname, 'pricingEngine.js'), 'utf8')
  const benchmarkSource = readFileSync(resolve(__dirname, '..', 'pages', 'dev', 'PricingBenchmark.jsx'), 'utf8')

  it('pricingEngine.js imports loadPricingContext', () => {
    expect(engineSource).toContain("import { loadPricingContext, resolveIronmongeryLines } from './loadPricingContext.js'")
  })

  it('pricingEngine.js calls loadPricingContext in priceDrawing', () => {
    expect(engineSource).toContain('await loadPricingContext(supabase,')
  })

  it('pricingEngine.js calls resolveIronmongeryLines in priceDrawing', () => {
    expect(engineSource).toContain('resolveIronmongeryLines(tree, ctx, profileValues)')
  })

  it('PricingBenchmark.jsx imports loadPricingContext', () => {
    expect(benchmarkSource).toContain("import { loadPricingContext, resolveIronmongeryLines } from '../../pricing/loadPricingContext.js'")
  })

  it('PricingBenchmark.jsx calls loadPricingContext', () => {
    expect(benchmarkSource).toContain('await loadPricingContext(supabase,')
  })

  it('PricingBenchmark.jsx calls resolveIronmongeryLines', () => {
    expect(benchmarkSource).toContain('resolveIronmongeryLines(benchmark.tree, ctx,')
  })

  it('PricingBenchmark.jsx does NOT import defaultIronmonger directly', () => {
    expect(benchmarkSource).not.toContain("from '../../pricing/defaultIronmongery.js'")
  })

  it('PricingBenchmark.jsx does NOT import computeVariables directly', () => {
    // computeVariables is only used dynamically by VariablesPanel, not for pricing logic
    expect(benchmarkSource).not.toContain("import { computeVariables }")
    expect(benchmarkSource).not.toContain("import { computeVariables,")
  })

  it('PricingBenchmark.jsx shows the engine run warnings, not only unresolved-product ones', () => {
    expect(benchmarkSource).toContain('results.warnings')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Behavioural tests — mock Supabase with PostgREST's 1,000-row response cap.
//
// Supabase returns at most 1,000 rows per request with NO error when a table
// is larger. parts_catalogue (~1,263 rows after steps G1+J1), ironmongery_
// variants (~1,083) and ironmongery_variant_parts (~1,116) all exceed the cap,
// so the loader's previous single-shot selects silently dropped the tail of
// each table — which is how the L34046 trickle vent kit part (RHZ665, near the
// end of the parts import) lost its cost and priced at 0.00.
// ══════════════════════════════════════════════════════════════════════════════

const MAX_ROWS = 1000

function createMockSupabase(tables) {
  return {
    from(table) {
      let rows = tables[table] ?? []
      let rangeFrom = null
      let rangeTo = null
      const builder = {
        select() { return builder },
        eq(col, val) {
          // Embedded-resource filters (e.g. 'ironmongery_products.is_active')
          // are not modelled; rows without the column pass through.
          rows = rows.filter(r => !(col in r) || r[col] === val)
          return builder
        },
        order() { return builder },
        range(from, to) { rangeFrom = from; rangeTo = to; return builder },
        then(onFulfilled, onRejected) {
          const from = rangeFrom ?? 0
          const to = Math.min(rangeTo ?? (from + MAX_ROWS - 1), from + MAX_ROWS - 1)
          const data = rows.slice(from, to + 1)
          return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
        },
      }
      return builder
    },
  }
}

// Parts table larger than the cap, with the trickle vent part near the end —
// mirrors its position in sql/step-g1-parts-catalogue.sql (row ~1,150 of 1,174).
// Costs here are mock data for the loader mechanics, not Integrate figures;
// 3.00 × the PF30 Ironmongery Cost rule (round to whole £, × 1.05, markup 2)
// is what yields the 3.15 / 6.30 line Integrate shows for this product.
function buildMockTables() {
  const parts = []
  parts.push({ part_code: 'GL100010', part_name: '4mm Clear Pilkington K Toughened', unit_cost: 32.0, thickness_mm: 4, category: 'Glass' })
  parts.push({ part_code: 'GL100080', part_name: '4mm Clear Toughened', unit_cost: 25.5, thickness_mm: 4, category: 'Glass' })
  for (let i = 0; i < 1148; i++) {
    parts.push({ part_code: `FILLER${String(i).padStart(4, '0')}`, part_name: `Filler part ${i}`, unit_cost: 1, thickness_mm: null, category: 'Timber' })
  }
  parts.push({ part_code: 'RHZ665', part_name: 'Trickle Vent XR16 Recessed Slot Vent White', unit_cost: 3.0, thickness_mm: null, category: 'Ironmongery' })

  return {
    price_rules: [],
    price_file_variables: [],
    parts_catalogue: parts,
    part_allocation_rules: [
      // The sash-window trickle vent default rule from sql/step-g3-default-ironmongery.sql
      {
        id: 'dr50', rule_family: 'default_ironmongery', sort_order: 50,
        group_name: 'sash_windows', loop_target: null, label: 'Trickle Vent',
        condition: 'frame_to_be_replaced and not is_front_door and not is_heritage_range',
        qty_expr: '1', product_short_name: 'trickle_vent_xr16', finish_code: 'Wht',
        is_active: true,
      },
    ],
    ironmongery_variants: [
      { id: 1, finish_code: 'Wht', cost: 3.0, ironmongery_products: { short_name: 'trickle_vent_xr16' } },
    ],
    ironmongery_variant_parts: [
      { id: 1, variant_id: 1, part_code: 'RHZ665', quantity: 1 },
    ],
  }
}

describe('loadPricingContext — survives the 1,000-row response cap', () => {
  it('parts past row 1,000 keep their cost in partCostMap and kit lines', async () => {
    const supabase = createMockSupabase(buildMockTables())
    const ctx = await loadPricingContext(supabase, 'pf-test')

    // Over 1,000 parts must all be present
    expect(Object.keys(ctx.partCostMap).length).toBe(1151)
    // The trickle vent part (beyond row 1,000) keeps its cost
    expect(ctx.partCostMap['RHZ665']).toBe(3.0)
    // ...and the variant kit line carries it too
    const variant = ctx.ironmongeryCatalogue['trickle_vent_xr16:Wht']
    expect(variant).toBeTruthy()
    expect(variant.parts).toHaveLength(1)
    expect(variant.parts[0].part_code).toBe('RHZ665')
    expect(variant.parts[0].unit_cost).toBe(3.0)
    expect(variant.parts[0].part_name).toBe('Trickle Vent XR16 Recessed Slot Vent White')
  })

  it('L34046 trickle vent line prices at 3.15 / 6.30 through the shared loader', async () => {
    const supabase = createMockSupabase(buildMockTables())
    const ctx = await loadPricingContext(supabase, 'pf-test')

    const ironmongeryLines = resolveIronmongeryLines(BENCHMARK_L34046.tree, ctx, BENCHMARK_L34046.profileValues)
    const trickleLine = ironmongeryLines.find(l => l.product_short_name === 'trickle_vent_xr16')
    expect(trickleLine).toBeTruthy()
    expect(trickleLine.finish_code).toBe('Wht')
    expect(trickleLine.qty).toBe(1)

    const ironCostRule = PF30_RULES.find(r => r.name === 'Ironmongery Cost')
    expect(ironCostRule).toBeTruthy()

    const results = runPricingOnTree(BENCHMARK_L34046.tree, [ironCostRule], {}, {
      testMode: true,  // PF30 fixture rules are is_active=false (draft import)
      glassCatalogue: ctx.glassCatalogue,
      partCostMap: ctx.partCostMap,
      ironmongeryLines,
      ironmongeryCatalogue: ctx.ironmongeryCatalogue,
      profileValues: BENCHMARK_L34046.profileValues,
    })

    const line = results.price.lines.find(l => l.alloc_iron_part_code === 'RHZ665')
    expect(line).toBeTruthy()
    expect(line.fires).toBe(true)
    expect(line.error).toBeFalsy()
    expect(line.line_cost).toBeCloseTo(3.15, 2)
    expect(line.line_total).toBeCloseTo(6.30, 2)
  })
})

describe('runPricingOnTree — ironmongery warnings instead of silent zeros', () => {
  const IRON_LINES = [{ product_short_name: 'trickle_vent_xr16', finish_code: 'Wht', qty: 1 }]

  it('warns when the product:finish key does not resolve against the catalogue', () => {
    const results = runPricingOnTree(BENCHMARK_L34046.tree, [], {}, {
      ironmongeryLines: IRON_LINES,
      ironmongeryCatalogue: {},  // nothing resolves
      profileValues: BENCHMARK_L34046.profileValues,
    })
    expect(results.warnings).toContain('Ironmongery product not found: trickle_vent_xr16 (Wht)')
  })

  it('warns when a kit line part has no catalogue cost (the silent-zero case)', () => {
    const results = runPricingOnTree(BENCHMARK_L34046.tree, [], {}, {
      ironmongeryLines: IRON_LINES,
      ironmongeryCatalogue: {
        'trickle_vent_xr16:Wht': {
          cost: 3.0,
          parts: [{ part_code: 'RHZ665', part_name: 'Trickle Vent XR16 Recessed Slot Vent White', qty: 1, unit_cost: null }],
        },
      },
      profileValues: BENCHMARK_L34046.profileValues,
    })
    // Step AO extended this warning to cover a unit_cost of exactly 0 (the
    // snapshot has real examples) and to name the set's own cost, so the
    // part and product are asserted by prefix rather than the whole string.
    expect(results.warnings.some(w =>
      w.startsWith('Ironmongery part cost not found: RHZ665 (trickle_vent_xr16)'))).toBe(true)
  })

  it('warns when a kit line part costs exactly 0 — the same silent zero (Step AO)', () => {
    const results = runPricingOnTree(BENCHMARK_L34046.tree, [], {}, {
      ironmongeryLines: IRON_LINES,
      ironmongeryCatalogue: {
        'trickle_vent_xr16:Wht': {
          cost: 3.0,
          parts: [{ part_code: 'RHZ665', part_name: 'Trickle Vent XR16 Recessed Slot Vent White', qty: 1, unit_cost: 0 }],
        },
      },
      profileValues: BENCHMARK_L34046.profileValues,
    })
    const warning = results.warnings.find(w => w.includes('RHZ665'))
    expect(warning).toBeDefined()
    expect(warning).toContain('the line prices at 0')
    expect(warning).toContain('the set itself costs 3')
  })
})
