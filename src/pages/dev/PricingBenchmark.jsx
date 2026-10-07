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
import { loadPricingContext, resolveIronmongeryLines } from '../../pricing/loadPricingContext.js'
import { PriceTable, fmt, costPriceMatch } from '../../pricing/PriceRuleTable.jsx'
import { BENCHMARK_L34046, BENCHMARK_A, BENCHMARK_B } from '../../pricing/benchmarks/index.js'

const ALL_BENCHMARKS = [BENCHMARK_L34046, BENCHMARK_A, BENCHMARK_B]

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

// The price-rule table, fmt and costPriceMatch live in src/pricing/PriceRuleTable.jsx,
// shared with the Price breakdown view for real drawings so the two cannot drift.

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

function BenchmarkSection({ benchmark, results, ironmongeryLines, ironWarnings }) {
  const { targets, tree, assumptions } = benchmark
  const totalCost  = results.price.total_cost ?? 0
  const totalPrice = results.price.total ?? 0
  const m = costPriceMatch(totalCost, totalPrice, targets)

  // Show the engine's own run warnings (missing glass/part/ironmongery costs)
  // alongside the page-level unresolved-product warnings.
  const allWarnings = [...(ironWarnings ?? []), ...(results.warnings ?? [])]

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
      {allWarnings.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 10px', margin: '8px 0', fontSize: 12 }}>
          {allWarnings.map((w, i) => <div key={i} style={{ color: '#991b1b' }}>{'\u26A0'} {w}</div>)}
        </div>
      )}

      {/* Summary */}
      <table style={{ ...S.table, width: 'auto', minWidth: '400px' }}>
        <tbody>
          <tr>
            <td style={S.td}>Total cost</td>
            <td style={S.td}><strong>{'\u00A3'}{fmt(totalCost)}</strong></td>
            <td style={S.td}>
              <span style={m.costOk ? S.hit : S.miss}>
                target {'\u00A3'}{fmt(targets.total_cost)} {m.costOk ? '-- ok' : `-- diff \u00A3${fmt(m.costDiff)}`}
              </span>
            </td>
          </tr>
          <tr>
            <td style={S.td}>Total price</td>
            <td style={S.td}><strong>{'\u00A3'}{fmt(totalPrice)}</strong></td>
            <td style={S.td}>
              <span style={m.priceOk ? S.hit : S.miss}>
                target {'\u00A3'}{fmt(targets.total_price)} {m.priceOk ? '-- ok' : `-- diff \u00A3${fmt(m.priceDiff)}`}
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
    // Snapshot data (populated on successful load for download)
    snapshotData: null,
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

        // Load full pricing context via shared loader
        const ctx = await loadPricingContext(supabase, priceFile.id)
        const { rules, pfVariables, glassCatalogue, partAllocationRules,
                partCostMap, ironmongeryCatalogue } = ctx

        // Load profile values for the Sash profile (glass rebate + tolerance)
        let profileValuesMap = {}
        const { data: sashProfile } = await supabase
          .from('default_profiles')
          .select('id')
          .eq('code', 'sash')
          .eq('is_active', true)
          .maybeSingle()
        if (sashProfile) {
          const { data: pvRows, error: pvErr } = await supabase
            .from('default_profile_values')
            .select('field_key, default_value')
            .eq('profile_id', sashProfile.id)
          if (pvErr) warnings.push(`Profile values load failed: ${pvErr.message}`)
          for (const pv of (pvRows || [])) {
            const key = pv.field_key?.split('.')?.pop() ?? pv.field_key
            const n = Number(pv.default_value)
            profileValuesMap[key] = isNaN(n) ? pv.default_value : n
          }
        }

        // Run each benchmark
        const benchmarkResults = ALL_BENCHMARKS.map(benchmark => {
          // Ironmongery: resolveIronmongeryLines handles tree-saved vs defaults
          const ironmongeryLines = resolveIronmongeryLines(benchmark.tree, ctx)

          // Check for unresolved ironmongery products
          const ironWarnings = []
          for (const line of ironmongeryLines) {
            const key = `${line.product_short_name}:${line.finish_code}`
            if (!ironmongeryCatalogue[key]) {
              ironWarnings.push(`Product not found: ${line.product_short_name} (${line.finish_code})`)
            }
          }

          const results = runPricingOnTree(benchmark.tree, rules || [], pfVariables, {
            testMode: false,
            glassCatalogue: { ...glassCatalogue, ...(benchmark.glassCatalogue ?? {}) },
            partAllocationRules,
            partCostMap: { ...partCostMap, ...(benchmark.partCostMap ?? {}) },
            ironmongeryLines,
            ironmongeryCatalogue,
            profileValues: benchmark.profileValues ?? profileValuesMap,
          })

          return { benchmark, results, ironmongeryLines, ironWarnings }
        })

        if (cancelled) return
        setState({
          status:    'done',
          benchmarkResults,
          pfName:    priceFile.name,
          ruleCount: (rules || []).length,
          error:     null,
          warnings,
          snapshotData: {
            // Everything loadPricingContext returned (rules, pfVariables,
            // glassCatalogue, partAllocationRules, partCostMap,
            // ironmongeryRules, ironmongeryCatalogue, priceFileId) plus the
            // profile values used — so the snapshot-based tests can price
            // the benchmarks with no other hand-typed catalogue data.
            ...ctx,
            priceFileName: priceFile.name,
            profileValues: profileValuesMap,
          },
        })
      } catch (err) {
        if (!cancelled) setState({ status: 'error', benchmarkResults: [], pfName: null, ruleCount: 0, error: err.message, warnings: [] })
      }
    }

    run()
    return () => { cancelled = true }
  }, [])

  // ── Download snapshot ─────────────────────────────────────────────────────
  function handleDownloadSnapshot() {
    if (!state.snapshotData) return
    const blob = new Blob([JSON.stringify(state.snapshotData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pf30-snapshot.json'
    a.click()
    URL.revokeObjectURL(url)
  }

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
        {state.snapshotData && (
          <button
            onClick={handleDownloadSnapshot}
            style={{ marginLeft: '16px', padding: '3px 10px', fontSize: '12px', cursor: 'pointer' }}
          >
            Download snapshot
          </button>
        )}
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
                <td style={S.td}>{'\u00A3'}{fmt(cost)}</td>
                <td style={S.td}>{'\u00A3'}{fmt(benchmark.targets.total_cost)}</td>
                <td style={S.td}>{'\u00A3'}{fmt(price)}</td>
                <td style={S.td}>{'\u00A3'}{fmt(benchmark.targets.total_price)}</td>
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
      {benchmarkResults.map(({ benchmark, results, ironmongeryLines, ironWarnings }, i) => (
        <BenchmarkSection
          key={i}
          benchmark={benchmark}
          results={results}
          ironmongeryLines={ironmongeryLines}
          ironWarnings={ironWarnings}
        />
      ))}
    </div>
  )
}
