/**
 * PricingBenchmark.jsx
 * Developer benchmark page at /dev/pricing-benchmark.
 *
 * Loads the current price file and runs runPricingOnTree against three
 * fixture trees — L34046 Item 7, Benchmark A (sash replacement),
 * Benchmark B (draught seal) — and displays a rule-by-rule comparison
 * against known Integrate targets.
 */

import { useState, useEffect } from 'react'
import { supabase } from '../../supabase.js'
import { runPricingOnTree } from '../../pricing/pricingEngine.js'
import { computeDerived } from '../../drawingBoard/computeDerived.js'
import { defaultIronmonger } from '../../pricing/defaultIronmongery.js'
import { computeVariables } from '../../pricing/computeVariables.js'
import { BENCHMARK_L34046, BENCHMARK_A, BENCHMARK_B } from '../../pricing/benchmarks/index.js'

const ALL_BENCHMARKS = [BENCHMARK_L34046, BENCHMARK_A, BENCHMARK_B]

// Merge all part cost maps across benchmarks
const MERGED_PART_COST_MAP = {}
for (const b of ALL_BENCHMARKS) {
  Object.assign(MERGED_PART_COST_MAP, b.partCostMap ?? {})
}

// Merge all glass catalogues (fixture fallback)
const MERGED_GLASS_CATALOGUE = {}
for (const b of ALL_BENCHMARKS) {
  Object.assign(MERGED_GLASS_CATALOGUE, b.glassCatalogue ?? {})
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  page: {
    fontFamily: 'monospace',
    fontSize:   '13px',
    padding:    '24px',
    maxWidth:   '1400px',
    margin:     '0 auto',
    color:      '#222',
  },
  h1: { fontSize: '20px', marginBottom: '4px' },
  h2: { fontSize: '15px', margin: '20px 0 6px', borderBottom: '1px solid #ccc', paddingBottom: '4px' },
  h3: { fontSize: '14px', margin: '16px 0 4px', color: '#333' },
  table: { width: '100%', borderCollapse: 'collapse', marginBottom: '16px' },
  th: { background: '#f0f0f0', padding: '4px 8px', textAlign: 'left', border: '1px solid #ddd', whiteSpace: 'nowrap' },
  td: { padding: '3px 8px', border: '1px solid #ddd', verticalAlign: 'top' },
  fired:   { background: '#fff' },
  noFire:  { background: '#f9f9f9', color: '#aaa' },
  errRow:  { background: '#fff0f0', color: '#c00' },
  totals:  { fontWeight: 'bold', padding: '12px', background: '#f7f7f7', border: '1px solid #ddd', marginBottom: '16px' },
  hit:     { color: '#080' },
  miss:    { color: '#c00', fontWeight: 'bold' },
  loading: { color: '#888', padding: '40px' },
  err:     { color: '#c00', padding: '16px', background: '#fff0f0', border: '1px solid #fcc' },
  details: { marginTop: '20px' },
  summary: { cursor: 'pointer', fontWeight: 'bold', padding: '4px 0' },
  varGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '2px 16px',
    fontSize: '12px',
    maxHeight: '400px',
    overflowY: 'auto',
    padding: '8px',
    background: '#f9f9f9',
    border: '1px solid #ddd',
  },
  varEntry: { display: 'flex', justifyContent: 'space-between', gap: '8px' },
  varKey:   { color: '#555' },
  varVal:   { fontWeight: 'bold', color: '#222' },
  benchmarkSection: {
    marginBottom: '40px',
    paddingBottom: '24px',
    borderBottom: '3px solid #333',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n, decimals = 2) {
  if (n == null) return '\u2014'
  return Number(n).toFixed(decimals)
}

function costPriceMatch(actualCost, actualPrice, targets) {
  const costDiff  = actualCost  - targets.total_cost
  const priceDiff = actualPrice - targets.total_price
  const costOk    = Math.abs(costDiff)  < 0.02
  const priceOk   = Math.abs(priceDiff) < 0.02
  return { costOk, priceOk, costDiff, priceDiff }
}

// ── Price rules table (parameterised) ─────────────────────────────────────────

function PriceTable({ lines, targets }) {
  if (!lines || lines.length === 0) return <p style={{ color: '#aaa' }}>No rules.</p>

  const groups = {}
  for (const line of lines) {
    const g = line.group_name ?? '(ungrouped)'
    if (!groups[g]) groups[g] = { lines: [], cost: 0, price: 0 }
    groups[g].lines.push(line)
    if (line.fires && !line.error) {
      groups[g].cost  += line.line_cost
      groups[g].price += line.line_total
    }
  }

  const totalCost  = Object.values(groups).reduce((s, g) => s + g.cost,  0)
  const totalPrice = Object.values(groups).reduce((s, g) => s + g.price, 0)
  const groupTargets = targets.groups ?? targets.group_cost ?? {}

  return (
    <>
      {/* Per-group summary */}
      <table style={{ ...S.table, width: 'auto', minWidth: '600px', marginBottom: '16px' }}>
        <thead>
          <tr>
            <th style={S.th}>Group</th>
            <th style={S.th}>Cost</th>
            <th style={S.th}>Price</th>
            <th style={S.th}>vs Target</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groups).map(([group, g]) => {
            const gt = groupTargets[group]
            // Support both { cost, price } and flat cost number
            const targetCost  = gt != null ? (typeof gt === 'number' ? gt : gt.cost) : null
            const targetPrice = gt != null ? (typeof gt === 'number' ? null : gt.price) : null
            const costDiff  = targetCost  != null ? g.cost  - targetCost  : null
            const priceDiff = targetPrice != null ? g.price - targetPrice : null
            const costOk    = costDiff  != null && Math.abs(costDiff)  < 0.02
            const priceOk   = priceDiff != null && Math.abs(priceDiff) < 0.02
            return (
              <tr key={group} style={S.fired}>
                <td style={S.td}><strong>{group}</strong></td>
                <td style={S.td}>\u00A3{fmt(g.cost)}</td>
                <td style={S.td}>\u00A3{fmt(g.price)}</td>
                <td style={S.td}>
                  {costDiff == null
                    ? <span style={{ color: '#aaa' }}>\u2014</span>
                    : <>
                        <span style={costOk ? S.hit : S.miss}>
                          {costOk ? `C: ok` : `C: diff \u00A3${fmt(costDiff)}`}
                        </span>
                        {priceDiff != null && <>
                          {' '}
                          <span style={priceOk ? S.hit : S.miss}>
                            {priceOk ? `P: ok` : `P: diff \u00A3${fmt(priceDiff)}`}
                          </span>
                        </>}
                      </>
                  }
                </td>
              </tr>
            )
          })}
          <tr style={{ fontWeight: 'bold', background: '#f0f0f0' }}>
            <td style={S.td}>TOTAL</td>
            <td style={S.td}>\u00A3{fmt(totalCost)}</td>
            <td style={S.td}>\u00A3{fmt(totalPrice)}</td>
            <td style={S.td}>
              {(() => {
                const m = costPriceMatch(totalCost, totalPrice, targets)
                return (
                  <>
                    <span style={m.costOk ? S.hit : S.miss}>
                      Cost: {m.costOk ? 'ok' : `diff \u00A3${fmt(m.costDiff)}`} (target \u00A3{fmt(targets.total_cost)})
                    </span>
                    {' | '}
                    <span style={m.priceOk ? S.hit : S.miss}>
                      Price: {m.priceOk ? 'ok' : `diff \u00A3${fmt(m.priceDiff)}`} (target \u00A3{fmt(targets.total_price)})
                    </span>
                  </>
                )
              })()}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Detailed rule lines per group */}
      {Object.entries(groups).map(([group, g]) => (
        <details key={group} style={{ marginBottom: '12px' }}>
          <summary style={{ ...S.summary, fontSize: '12px', color: '#555' }}>
            {group} \u2014 cost \u00A3{fmt(g.cost)} / price \u00A3{fmt(g.price)}
          </summary>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Rule</th>
                <th style={S.th}>Loop Part</th>
                <th style={S.th}>Qty</th>
                <th style={S.th}>Value</th>
                <th style={S.th}>Markup</th>
                <th style={S.th}>Cost</th>
                <th style={S.th}>Price</th>
              </tr>
            </thead>
            <tbody>
              {g.lines.map((line, i) => {
                const rowStyle = line.error ? S.errRow : (line.fires ? S.fired : S.noFire)
                const lineCost  = line.fires && !line.error ? line.line_cost : null
                const linePrice = line.fires && !line.error ? line.line_total : null
                return (
                  <tr key={i} style={rowStyle}>
                    <td style={S.td}>{line.alloc_label ?? line.name}</td>
                    <td style={S.td}>{line.alloc_part_code ?? line.part_type ?? '\u2014'}</td>
                    <td style={S.td}>{line.error ? <span style={{ color: '#c00' }}>{line.error}</span> : fmt(line.quantity, 4)}</td>
                    <td style={S.td}>{!line.error && fmt(line.value, 4)}</td>
                    <td style={S.td}>{!line.error && fmt(line.markup, 3)}</td>
                    <td style={S.td}>{lineCost != null ? <strong>\u00A3{fmt(lineCost)}</strong> : (!line.error ? '\u2014' : '')}</td>
                    <td style={S.td}>{linePrice != null ? <strong>\u00A3{fmt(linePrice)}</strong> : (!line.error ? '\u2014' : '')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </details>
      ))}
    </>
  )
}

// ── Variables panel ───────────────────────────────────────────────────────────

function VariablesPanel({ tree }) {
  const derived = computeDerived(tree)
  const [varsObj, setVarsObj] = useState(null)

  useEffect(() => {
    import('../../pricing/computeVariables.js').then(m => {
      setVarsObj(m.computeVariables(tree, derived))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!varsObj) return <p style={{ color: '#aaa' }}>Loading variables...</p>

  const entries = Object.entries(varsObj).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div style={S.varGrid}>
      {entries.map(([key, val]) => (
        <div key={key} style={S.varEntry}>
          <span style={S.varKey}>{key}</span>
          <span style={S.varVal}>
            {val === null ? 'null'
              : val === true  ? 'true'
              : val === false ? 'false'
              : typeof val === 'number' ? fmt(val, 4)
              : String(val)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Single benchmark section ─────────────────────────────────────────────────

function BenchmarkSection({ benchmark, results, ironmongeryLines }) {
  const { targets, tree, assumptions } = benchmark
  const totalCost  = results.price.total_cost ?? 0
  const totalPrice = results.price.total ?? 0
  const m = costPriceMatch(totalCost, totalPrice, targets)

  // Must-not-fire analysis
  const firedNames = new Set(
    results.price.lines
      .filter(l => l.fires && !l.error)
      .map(l => l.name)
  )
  const mustNotFire = targets.must_not_fire ?? []
  const shouldNotHaveFired = mustNotFire.filter(n => firedNames.has(n))

  return (
    <div style={S.benchmarkSection}>
      <h2 style={{ ...S.h2, fontSize: '17px', borderBottom: '2px solid #555' }}>
        {benchmark.name}
      </h2>

      {/* Summary */}
      <table style={{ ...S.table, width: 'auto', minWidth: '400px' }}>
        <tbody>
          <tr>
            <td style={S.td}>Total cost</td>
            <td style={S.td}><strong>\u00A3{fmt(totalCost)}</strong></td>
            <td style={S.td}>
              <span style={m.costOk ? S.hit : S.miss}>
                target \u00A3{fmt(targets.total_cost)} {m.costOk ? '-- ok' : `-- diff \u00A3${fmt(m.costDiff)}`}
              </span>
            </td>
          </tr>
          <tr>
            <td style={S.td}>Total price</td>
            <td style={S.td}><strong>\u00A3{fmt(totalPrice)}</strong></td>
            <td style={S.td}>
              <span style={m.priceOk ? S.hit : S.miss}>
                target \u00A3{fmt(targets.total_price)} {m.priceOk ? '-- ok' : `-- diff \u00A3${fmt(m.priceDiff)}`}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Must-not-fire violations */}
      {shouldNotHaveFired.length > 0 && (
        <div style={{ background: '#fff0f0', border: '1px solid #fcc', padding: '8px 12px', marginBottom: '10px', borderRadius: '3px' }}>
          <strong style={{ color: '#c00' }}>Rules that fired but should NOT have:</strong>{' '}
          {shouldNotHaveFired.join(', ')}
        </div>
      )}

      {/* Price rules table */}
      <PriceTable lines={results.price.lines} targets={targets} />

      {/* Assumptions */}
      {assumptions && assumptions.length > 0 && (
        <details style={{ marginTop: '8px' }}>
          <summary style={S.summary}>Assumptions ({assumptions.length})</summary>
          <ul style={{ fontSize: '12px', color: '#555', margin: '4px 0', paddingLeft: '20px' }}>
            {assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </details>
      )}

      {/* Variables */}
      <details style={S.details}>
        <summary style={S.summary}>All computed variables</summary>
        <VariablesPanel tree={tree} />
      </details>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PricingBenchmark() {
  const [state, setState] = useState({
    status: 'idle', benchmarkResults: [], pfName: null, ruleCount: 0,
    error: null, warnings: [],
  })

  useEffect(() => {
    let cancelled = false

    async function run() {
      setState(s => ({ ...s, status: 'loading' }))
      const warnings = []
      try {
        // Find the current price file
        const { data: currentRows, error: pfErr } = await supabase
          .from('price_files')
          .select('id, name')
          .eq('is_current', true)
          .limit(1)

        if (pfErr) throw new Error(`price_files query: ${pfErr.message}`)

        let priceFile = currentRows?.[0] ?? null

        if (!priceFile) {
          const { data: namedRows, error: namedErr } = await supabase
            .from('price_files')
            .select('id, name')
            .eq('name', 'PF30')
            .limit(1)
          if (namedErr) throw new Error(`price_files (PF30) query: ${namedErr.message}`)
          priceFile = namedRows?.[0] ?? null
        }

        if (!priceFile) throw new Error('No price file found (no is_current file and no file named "PF30").')

        // Load price-file variables
        const { data: pfVarRows, error: pfvErr } = await supabase
          .from('price_file_variables')
          .select('name, value_numeric, value_text')
          .eq('price_file_id', priceFile.id)

        if (pfvErr) throw new Error(`price_file_variables: ${pfvErr.message}`)
        const pfVariables = Object.fromEntries((pfVarRows || []).map(r => [r.name, r.value_numeric ?? r.value_text]))

        // Load all rules
        const { data: rules, error: rulesErr } = await supabase
          .from('price_rules')
          .select('id, name, rule_family, level, condition, quantity, value, markup, loop_target, group_name, is_active, sort_order')
          .eq('price_file_id', priceFile.id)
          .order('sort_order')

        if (rulesErr) throw new Error(`price_rules: ${rulesErr.message}`)

        // Load glass catalogue
        let glassCatalogue = MERGED_GLASS_CATALOGUE
        try {
          const { data: catalogueRows, error: catErr } = await supabase
            .from('parts_catalogue')
            .select('part_code, unit_cost, thickness_mm')
            .eq('category', 'Glass')
          if (catErr) throw catErr
          const built = Object.fromEntries(
            (catalogueRows || []).map(r => [r.part_code, { cost_per_m2: r.unit_cost, thickness_mm: r.thickness_mm }])
          )
          if (Object.keys(built).length > 0) glassCatalogue = built
          else warnings.push('parts_catalogue returned no glass rows -- using fixture fallback')
        } catch (err) {
          warnings.push(`parts_catalogue query failed (${err.message}) -- using fixture fallback`)
        }

        // Load part allocation rules
        let partAllocationRules = []
        try {
          const { data: allocRules, error: allocErr } = await supabase
            .from('part_allocation_rules')
            .select('id, rule_family, sort_order, group_name, loop_target, label, condition, qty_expr, part_code, measure_expr, is_active')
            .eq('rule_family', 'part_allocator')
            .order('sort_order')
          if (allocErr) throw allocErr
          partAllocationRules = allocRules || []
        } catch (err) {
          warnings.push(`part_allocation_rules query failed (${err.message})`)
        }

        // Load ironmongery data
        let ironmongeryCatalogue = {}
        let ironRules = []
        try {
          const [{ data: irData }, { data: ironVariants }, { data: ironKitLines }] = await Promise.all([
            supabase
              .from('part_allocation_rules')
              .select('id, sort_order, group_name, loop_target, label, condition, qty_expr, product_short_name, finish_code, is_active')
              .eq('rule_family', 'default_ironmongery')
              .order('sort_order'),
            supabase
              .from('ironmongery_variants')
              .select('id, finish_code, cost, ironmongery_products!inner(short_name)')
              .eq('ironmongery_products.is_active', true),
            supabase
              .from('ironmongery_variant_parts')
              .select('variant_id, part_code, quantity, parts_catalogue(part_name, unit_cost)'),
          ])
          ironRules = irData || []

          const kitLinesByVariant = {}
          for (const kl of (ironKitLines ?? [])) {
            if (!kitLinesByVariant[kl.variant_id]) kitLinesByVariant[kl.variant_id] = []
            kitLinesByVariant[kl.variant_id].push({
              part_code: kl.part_code,
              part_name: kl.parts_catalogue?.part_name ?? kl.part_code,
              qty:       kl.quantity ?? 1,
              unit_cost: kl.parts_catalogue?.unit_cost ?? null,
            })
          }

          for (const v of (ironVariants ?? [])) {
            const shortName = v.ironmongery_products?.short_name
            if (!shortName) continue
            ironmongeryCatalogue[`${shortName}:${v.finish_code}`] = {
              cost:  v.cost ?? 0,
              parts: kitLinesByVariant[v.id] ?? [],
            }
          }
        } catch (err) {
          warnings.push(`Ironmongery data failed (${err.message})`)
        }

        // Run each benchmark
        const benchmarkResults = ALL_BENCHMARKS.map(benchmark => {
          // Compute ironmongery lines for this benchmark's tree
          let ironmongeryLines = []
          if (ironRules.length > 0) {
            const derived  = computeDerived(benchmark.tree)
            const itemVars = computeVariables(benchmark.tree, derived, pfVariables) ?? {}
            ironmongeryLines = defaultIronmonger(benchmark.tree, { ...pfVariables, ...itemVars }, ironRules)
          }

          const results = runPricingOnTree(benchmark.tree, rules || [], pfVariables, {
            testMode: false,
            glassCatalogue: { ...glassCatalogue, ...(benchmark.glassCatalogue ?? {}) },
            partAllocationRules,
            partCostMap: { ...MERGED_PART_COST_MAP, ...(benchmark.partCostMap ?? {}) },
            ironmongeryLines,
            ironmongeryCatalogue,
          })

          return { benchmark, results, ironmongeryLines }
        })

        if (cancelled) return
        setState({
          status:    'done',
          benchmarkResults,
          pfName:    priceFile.name,
          ruleCount: (rules || []).length,
          error:     null,
          warnings,
        })
      } catch (err) {
        if (!cancelled) setState({ status: 'error', benchmarkResults: [], pfName: null, ruleCount: 0, error: err.message, warnings: [] })
      }
    }

    run()
    return () => { cancelled = true }
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (state.status === 'loading' || state.status === 'idle') {
    return <div style={S.page}><p style={S.loading}>Loading price file and running benchmarks...</p></div>
  }

  if (state.status === 'error') {
    return (
      <div style={S.page}>
        <h1 style={S.h1}>Pricing Benchmarks</h1>
        <div style={S.err}><strong>Error:</strong> {state.error}</div>
      </div>
    )
  }

  const { benchmarkResults, pfName, ruleCount, warnings } = state

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Pricing Benchmarks</h1>
      <p style={{ color: '#555', marginBottom: '16px' }}>
        Price file: <strong>{pfName}</strong> | {ruleCount} rules loaded | {benchmarkResults.length} benchmarks
      </p>

      {warnings.map((w, i) => (
        <div key={i} style={{ background: '#fffbe6', border: '1px solid #e6c800', padding: '8px 12px', marginBottom: '10px', borderRadius: '3px' }}>
          {w}
        </div>
      ))}

      {/* Top-level summary table */}
      <table style={{ ...S.table, width: 'auto', minWidth: '700px', marginBottom: '24px' }}>
        <thead>
          <tr>
            <th style={S.th}>Benchmark</th>
            <th style={S.th}>Cost</th>
            <th style={S.th}>Target cost</th>
            <th style={S.th}>Price</th>
            <th style={S.th}>Target price</th>
            <th style={S.th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {benchmarkResults.map(({ benchmark, results }, i) => {
            const cost  = results.price.total_cost ?? 0
            const price = results.price.total ?? 0
            const m = costPriceMatch(cost, price, benchmark.targets)
            const allOk = m.costOk && m.priceOk
            return (
              <tr key={i} style={allOk ? { background: '#f0fff0' } : { background: '#fff0f0' }}>
                <td style={S.td}><strong>{benchmark.name}</strong></td>
                <td style={S.td}>\u00A3{fmt(cost)}</td>
                <td style={S.td}>\u00A3{fmt(benchmark.targets.total_cost)}</td>
                <td style={S.td}>\u00A3{fmt(price)}</td>
                <td style={S.td}>\u00A3{fmt(benchmark.targets.total_price)}</td>
                <td style={S.td}>
                  <span style={allOk ? S.hit : S.miss}>
                    {allOk ? 'PASS' : `FAIL (cost diff \u00A3${fmt(m.costDiff)}, price diff \u00A3${fmt(m.priceDiff)})`}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Individual benchmark sections */}
      {benchmarkResults.map(({ benchmark, results, ironmongeryLines }, i) => (
        <BenchmarkSection
          key={i}
          benchmark={benchmark}
          results={results}
          ironmongeryLines={ironmongeryLines}
        />
      ))}
    </div>
  )
}
