// Temporary inspection script (not part of the app): prints totals and every
// fired price line for the three benchmarks + the real tree, using the same
// configuration as benchmarks.test.js. Run: npx vite-node scripts/dump-benchmarks.mjs
import { readFileSync } from 'fs'
import { runPricingOnTree } from '../src/pricing/pricingEngine.js'
import { computeSashWeight } from '../src/pricing/sashWeight.js'
import { BENCHMARK_L34046, BENCHMARK_A, BENCHMARK_B } from '../src/pricing/benchmarks/index.js'
import { PF30_RULES } from '../src/pricing/benchmarks/pf30Rules.js'

const PF_VARIABLES = {
  accoya_cubic_meter: 4.65, decoration_labour_hourly: 42.50, douglas_fir_cubic_meter: 2.05,
  idigbo_cubic_meter: 3.50, installation_labour_hourly: 40.21, meranti_cubic_meter: 3.54,
  oak_cubic_meter: 7.00, softwood_cubic_meter: 1.25, special_glass: 'GL100045',
  utile: 'utile', utile_cubic_meter: 3.54, workshop_hourly_additional: 24.66,
}
const S4 = ['Laminated Softwood for Sashes (Bottom)', 'Laminated Softwood for Sashes (Top)', 'Glazing Bead for Sashes']
const RULES = PF30_RULES.map(r => (r.rule_family === 'price' && S4.includes(r.name))
  ? { ...r, condition: r.condition + ' and to_be_replaced' } : r)

const ALLOC = [
  { id: 'sw0', sort_order: 0, group_name: 'sash_windows', loop_target: 'sliding_sash', label: 'Staff bead for width',  condition: 'is_small_staff_bead and not frame_to_be_replaced', qty_expr: 'interior_qty', part_code: 'TP01', measure_expr: 'round_up_to_nearest(profiled_frame_interior_width_in_mm, 100) + 100', is_active: true },
  { id: 'sw1', sort_order: 1, group_name: 'sash_windows', loop_target: 'sliding_sash', label: 'Staff bead for height', condition: 'is_small_staff_bead and not frame_to_be_replaced', qty_expr: '1', part_code: 'TP01', measure_expr: 'round_up_to_nearest(profiled_frame_interior_height_in_mm, 100) + 100', is_active: true },
  { id: 'sw4h', sort_order: 4, group_name: 'sash_windows', loop_target: 'sliding_sash', label: 'Parting bead for height', condition: 'not frame_to_be_replaced', qty_expr: 'interior_qty', part_code: 'TP03', measure_expr: 'round_up_to_nearest(profiled_frame_interior_height_in_mm, 100) + 100', is_active: true },
  { id: 'sw4w', sort_order: 4, group_name: 'sash_windows', loop_target: 'sliding_sash', label: 'Parting bead for width', condition: 'not frame_to_be_replaced', qty_expr: '0.5', part_code: 'TP03', measure_expr: 'round_up_to_nearest(profiled_frame_interior_width_in_mm, 100) + 100', is_active: true },
]

function dump(name, tree, opts) {
  const r = runPricingOnTree(tree, RULES, PF_VARIABLES, { testMode: true, ...opts })
  console.log(`\n===== ${name}  cost ${r.price.total_cost.toFixed(2)}  price ${r.price.total.toFixed(2)}`)
  for (const l of r.price.lines) {
    if (!l.fires || l.error) continue
    console.log(`  [${l.group_name}] ${l.alloc_label ?? l.name} | qty ${Number(l.quantity).toFixed(4)} x ${Number(l.value).toFixed(4)} = ${l.line_cost.toFixed(2)} xm${l.markup} = ${l.line_total.toFixed(2)} | ${l.alloc_part_code ?? l.alloc_iron_part_code ?? l.part_type ?? ''}`)
  }
  for (const w of r.warnings) console.log(`  WARN: ${w}`)
  const sashes = []
  ;(function walk(n) { if (n.part_type === 'topSashPart' || n.part_type === 'bottomSashPart') sashes.push(n); (n.children ?? []).forEach(walk) })(tree)
  for (const s of sashes) {
    const w = computeSashWeight(s, tree, opts.glassCatalogue ?? {}, opts.profileValues ?? {})
    console.log(`  weight ${s.part_type}: ${w.weight_in_kg.toFixed(3)} kg`)
  }
}

function run(benchmark) {
  const paint = (benchmark.tree.children ?? []).find(c => c.part_type === 'paintAndIronmongeryPart')
  const ironmongeryLines = benchmark.ironmongeryLines ?? paint?.values?.ironmongeryLines ?? []
  dump(benchmark.name, benchmark.tree, {
    glassCatalogue: benchmark.glassCatalogue ?? {},
    partAllocationRules: ALLOC,
    partCostMap: benchmark.partCostMap ?? {},
    ironmongeryLines,
    ironmongeryCatalogue: benchmark.ironmongeryCatalogue ?? {},
    profileValues: benchmark.profileValues ?? {},
  })
}

run(BENCHMARK_L34046)
run(BENCHMARK_A)
run(BENCHMARK_B)

const raw = JSON.parse(readFileSync(new URL('../src/pricing/benchmarks/real-trees/L507712-drawing1.raw.json', import.meta.url), 'utf8'))
const MAP = { '4mm Clear Pilkington K Toughened': 'GL100010', '4mm Clear Toughened': 'GL100080' }
function conv(n) {
  const c = { ...n, values: { ...(n.values ?? {}) } }
  if (c.part_type === 'glassPart') for (const k of ['internalGlassPartNo', 'externalGlassPartNo', 'singleGlassPartNo']) if (MAP[c.values[k]]) c.values[k] = MAP[c.values[k]]
  c.children = (n.children ?? []).map(conv)
  return c
}
dump('REAL L507712 d1', conv(raw), {
  glassCatalogue: { GL100010: { cost_per_m2: 32.0, thickness_mm: 4 }, GL100080: { cost_per_m2: 25.5, thickness_mm: 4 } },
  profileValues: { defaultDoubleGlazingRebateWidthForSash: 14, defaultDoubleGlazingTolerance: 2 },
})
