// Inspection tool: prints totals and every fired price line for the three
// benchmarks + the real tree, from the LIVE snapshot
// (src/pricing/benchmarks/pf30-snapshot.json — real is_active flags, no
// testMode), the same configuration as the honest benchmark tests.
// Run: npx vite-node scripts/dump-benchmarks.mjs
import { readFileSync } from 'fs'
import { runPricingOnTree } from '../src/pricing/pricingEngine.js'
import { computeSashWeight } from '../src/pricing/sashWeight.js'
import { resolveIronmongeryLines } from '../src/pricing/loadPricingContext.js'
import { BENCHMARK_L34046, BENCHMARK_A, BENCHMARK_A35, BENCHMARK_A40, BENCHMARK_A50, BENCHMARK_A35_H1700, BENCHMARK_B } from '../src/pricing/benchmarks/index.js'
import snapshot from '../src/pricing/benchmarks/pf30-snapshot.json'

function dump(name, tree, { extraGlass = {} } = {}) {
  const glassCatalogue = { ...snapshot.glassCatalogue, ...extraGlass }
  const ironmongeryLines = resolveIronmongeryLines(tree, snapshot, snapshot.profileValues)
  const r = runPricingOnTree(tree, snapshot.rules, snapshot.pfVariables, {
    glassCatalogue,
    partAllocationRules: snapshot.partAllocationRules,
    partCostMap:         snapshot.partCostMap,
    ironmongeryLines,
    ironmongeryCatalogue: snapshot.ironmongeryCatalogue,
    profileValues:        snapshot.profileValues,
  })
  console.log(`\n===== ${name}  cost ${r.price.total_cost.toFixed(2)}  price ${r.price.total.toFixed(2)}`)
  for (const l of r.price.lines) {
    if (!l.fires || l.error) continue
    console.log(`  [${l.group_name}] ${l.alloc_label ?? l.name} | qty ${Number(l.quantity).toFixed(4)} x ${Number(l.value).toFixed(4)} = ${l.line_cost.toFixed(2)} xm${l.markup} = ${l.line_total.toFixed(2)} | ${l.alloc_part_code ?? l.alloc_iron_part_code ?? l.part_type ?? ''}`)
  }
  for (const w of r.warnings) console.log(`  WARN: ${w}`)
  const sashes = []
  ;(function walk(n) { if (n.part_type === 'topSashPart' || n.part_type === 'bottomSashPart') sashes.push(n); (n.children ?? []).forEach(walk) })(tree)
  for (const s of sashes) {
    const w = computeSashWeight(s, tree, glassCatalogue, snapshot.profileValues)
    console.log(`  weight ${s.part_type}: ${w.weight_in_kg.toFixed(3)} kg`)
  }
}

dump(BENCHMARK_L34046.name, BENCHMARK_L34046.tree)
dump(BENCHMARK_A.name, BENCHMARK_A.tree)
dump(BENCHMARK_A35.name, BENCHMARK_A35.tree)
dump(BENCHMARK_A40.name, BENCHMARK_A40.tree)
dump(BENCHMARK_A50.name, BENCHMARK_A50.tree)
dump(BENCHMARK_A35_H1700.name, BENCHMARK_A35_H1700.tree)
dump(BENCHMARK_B.name, BENCHMARK_B.tree)

const raw = JSON.parse(readFileSync(new URL('../src/pricing/benchmarks/real-trees/L507712-drawing1.raw.json', import.meta.url), 'utf8'))
const MAP = { '4mm Clear Pilkington K Toughened': 'GL100010', '4mm Clear Toughened': 'GL100080' }
function conv(n) {
  const c = { ...n, values: { ...(n.values ?? {}) } }
  if (c.part_type === 'glassPart') for (const k of ['internalGlassPartNo', 'externalGlassPartNo', 'singleGlassPartNo']) if (MAP[c.values[k]]) c.values[k] = MAP[c.values[k]]
  c.children = (n.children ?? []).map(conv)
  return c
}
dump('REAL L507712 d1', conv(raw))
