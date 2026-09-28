/**
 * PricingBenchmark.jsx
 * Developer benchmark page at /dev/pricing-benchmark.
 *
 * Loads the "Integrate PF30 (Draft Import)" price file and its rules, runs
 * runPricingOnTree against a fixture tree matching L34046 Item 7, and displays
 * a breakdown table with comparison against known Integrate targets.
 */

import { useState, useEffect } from 'react'
import { supabase } from '../../supabase.js'
import { runPricingOnTree } from '../../pricing/pricingEngine.js'
import { computeDerived } from '../../drawingBoard/computeDerived.js'

// ── Integrate targets for L34046 Item 7 ──────────────────────────────────────
const TARGETS = {
  manufacture_minutes: 1337,
  install_minutes:     450,
  item_cost:           1212.57,
}

// ── Fixture tree — L34046 Item 7 ─────────────────────────────────────────────
// Box sash, complete new, solid redwood frame, solid redwood sash,
// solid utile hardwood cill, both sashes cord hung, 1075 × 1630mm internal,
// sash thickness 45mm, top horn Victorian / bottom horn none,
// double glazed 16mm white warm edge, ground floor, installed internally.

const FIXTURE_TREE = {
  key: 'item1',
  part_type: 'drawingItemPart',
  values: {
    typeOfWork:          'complete_new',
    frameMaterialId:     'solid_redwood',
    sashMaterialId:      'solid_redwood',
    cillMaterialId:      'solid_utile_hardwood',
    fitToPreparedOpening: false,
    decoration:          false,
    floorLevel:          'ground_floor',
    bayFullyCoupledFrames: false,
    frameInKitForm:      false,
    bayPoleRequired:     false,
  },
  children: [
    {
      key: 'paint1',
      part_type: 'paintAndIronmongeryPart',
      values: {
        internalFinish: 'clean_white',
        externalFinish: 'clean_white',
        cillFinish:     'clean_white',
        cutOutBrickReveal: false,
      },
      children: [],
    },
    {
      key: 'notes1',
      part_type: 'notesPart',
      values: {
        installationMethod: 'internally',
      },
      children: [],
    },
    {
      key: 'frame1',
      part_type: 'assemblyFramePart',
      values: {
        width:          1075,
        height:         1630,
        topHeight:      79,
        leftWidth:      85,
        rightWidth:     85,
        frameDepth:     165,
        jambType:       'solid_profiled',
        leftOuterJamb:  101,
        rightOuterJamb: 101,
        leftCillHorn:   50,
        rightCillHorn:  50,
        rakeFrame:      false,
        archHead:       false,
      },
      children: [
        {
          key: 'cill1',
          part_type: 'cillPart',
          values: {
            height: 70,
            depth:  200,
          },
          children: [],
        },
        {
          key: 'pair1',
          part_type: 'sashPairPart',
          values: {
            sashThickness:             45,
            midrailHeight:             40,
            mechanicalClearanceLeft:   2.5,
            mechanicalClearanceRight:  2.5,
            mechanicalClearanceTop:    0,
            mechanicalClearanceBottom: 0,
            topHornTypeShortName:    'victorian',
            bottomHornTypeShortName: 'none',
            sashSplit:               'half_half',
          },
          children: [
            {
              key: 'top1',
              part_type: 'topSashPart',
              values: {
                topHeight:    49,
                leftWidth:    47,
                rightWidth:   47,
                operation:    'cord_hung',
                toBeReplaced: null,
                archHead:     false,
              },
              children: [
                {
                  key: 'glass1',
                  part_type: 'glassPart',
                  values: {
                    glazingId:         'double_glazed',
                    isIndividualPanes: false,
                    spacerDimId:       '16mm_white_warm_edge',
                    barsWide:          2,  // 6-over-6: 2 vertical bars per sash
                    barsHigh:          1,  // 1 horizontal bar per sash
                  },
                  children: [],
                },
              ],
            },
            {
              key: 'bot1',
              part_type: 'bottomSashPart',
              values: {
                bottomHeight: 88,
                leftWidth:    47,
                rightWidth:   47,
                operation:    'cord_hung',
                toBeReplaced: null,
                archHead:     false,
              },
              children: [
                {
                  key: 'glass2',
                  part_type: 'glassPart',
                  values: {
                    glazingId:         'double_glazed',
                    isIndividualPanes: false,
                    spacerDimId:       '16mm_white_warm_edge',
                    barsWide:          2,  // 6-over-6: 2 vertical bars per sash
                    barsHigh:          1,  // 1 horizontal bar per sash
                  },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
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
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n, decimals = 2) {
  if (n == null) return '—'
  return Number(n).toFixed(decimals)
}

function diffLabel(actual, target, isPrice = false) {
  const diff = actual - target
  const ok   = Math.abs(diff) < (isPrice ? 0.01 : 0.5)
  const label = ok
    ? `✓ matches target (${isPrice ? `£${fmt(target)}` : `${target} min`})`
    : `✗ diff ${diff >= 0 ? '+' : ''}${isPrice ? `£${fmt(diff)}` : `${fmt(diff, 1)} min`} (target: ${isPrice ? `£${fmt(target)}` : `${target} min`})`
  return { ok, label }
}

// ── Labour rules table ────────────────────────────────────────────────────────

function LabourTable({ lines, totalMinutes }) {
  if (!lines || lines.length === 0) return <p style={{ color: '#aaa' }}>No rules.</p>

  // Group by group_name
  const groups = {}
  for (const line of lines) {
    const g = line.group_name ?? '(ungrouped)'
    if (!groups[g]) groups[g] = []
    groups[g].push(line)
  }

  return (
    <>
      {Object.entries(groups).map(([group, groupLines]) => (
        <div key={group} style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', color: '#555', marginBottom: '4px', fontSize: '12px' }}>
            {group}
          </div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Rule</th>
                <th style={S.th}>Loop Part</th>
                <th style={S.th}>Condition</th>
                <th style={S.th}>Qty</th>
                <th style={S.th}>× Min/unit</th>
                <th style={S.th}>= Total min</th>
              </tr>
            </thead>
            <tbody>
              {groupLines.map((line, i) => {
                const rowStyle = line.error ? S.errRow : (line.fires ? S.fired : S.noFire)
                return (
                  <tr key={i} style={rowStyle}>
                    <td style={S.td}>{line.name}</td>
                    <td style={S.td}>{line.part_type ?? '—'}</td>
                    <td style={S.td} title={line.condition}>{(line.condition ?? '').slice(0, 50)}{(line.condition ?? '').length > 50 ? '…' : ''}</td>
                    <td style={S.td}>{line.error ? <span style={{ color: '#c00' }}>{line.error}</span> : fmt(line.quantity, 3)}</td>
                    <td style={S.td}>{!line.error && fmt(line.value, 3)}</td>
                    <td style={S.td}>{!line.error && line.fires ? <strong>{fmt(line.minutes, 2)}</strong> : (!line.error ? '—' : '')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
      <div style={S.totals}>Total: {fmt(totalMinutes, 2)} minutes ({fmt(totalMinutes / 60, 3)} hours)</div>
    </>
  )
}

// ── Price rules table ─────────────────────────────────────────────────────────

function PriceTable({ lines, total }) {
  if (!lines || lines.length === 0) return <p style={{ color: '#aaa' }}>No rules.</p>

  const groups = {}
  for (const line of lines) {
    const g = line.group_name ?? '(ungrouped)'
    if (!groups[g]) groups[g] = []
    groups[g].push(line)
  }

  return (
    <>
      {Object.entries(groups).map(([group, groupLines]) => (
        <div key={group} style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', color: '#555', marginBottom: '4px', fontSize: '12px' }}>
            {group}
          </div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Rule</th>
                <th style={S.th}>Loop Part</th>
                <th style={S.th}>Condition</th>
                <th style={S.th}>Qty</th>
                <th style={S.th}>× Value</th>
                <th style={S.th}>× Markup</th>
                <th style={S.th}>= Total</th>
              </tr>
            </thead>
            <tbody>
              {groupLines.map((line, i) => {
                const rowStyle = line.error ? S.errRow : (line.fires ? S.fired : S.noFire)
                return (
                  <tr key={i} style={rowStyle}>
                    <td style={S.td}>{line.name}</td>
                    <td style={S.td}>{line.part_type ?? '—'}</td>
                    <td style={S.td} title={line.condition}>{(line.condition ?? '').slice(0, 50)}{(line.condition ?? '').length > 50 ? '…' : ''}</td>
                    <td style={S.td}>{line.error ? <span style={{ color: '#c00' }}>{line.error}</span> : fmt(line.quantity, 4)}</td>
                    <td style={S.td}>{!line.error && fmt(line.value, 4)}</td>
                    <td style={S.td}>{!line.error && fmt(line.markup, 3)}</td>
                    <td style={S.td}>{!line.error && line.fires ? <strong>£{fmt(line.line_total)}</strong> : (!line.error ? '—' : '')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
      <div style={S.totals}>Total item cost: £{fmt(total)}</div>
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

  if (!varsObj) return <p style={{ color: '#aaa' }}>Loading variables…</p>

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

// ── Main component ────────────────────────────────────────────────────────────

export default function PricingBenchmark() {
  const [state, setState] = useState({ status: 'idle', results: null, pfName: null, ruleCount: 0, error: null })

  useEffect(() => {
    let cancelled = false

    async function run() {
      setState(s => ({ ...s, status: 'loading' }))
      try {
        // Find the price file
        const { data: pfRows, error: pfErr } = await supabase
          .from('price_files')
          .select('id, name')
          .ilike('name', '%Integrate PF30%')
          .limit(1)

        if (pfErr) throw new Error(`price_files query: ${pfErr.message}`)

        let priceFile = pfRows?.[0] ?? null

        // Fall back to the published price file if the named one isn't found
        if (!priceFile) {
          const { data: pubRows, error: pubErr } = await supabase
            .from('price_files')
            .select('id, name')
            .eq('status', 'published')
            .limit(1)
          if (pubErr) throw new Error(`price_files (published) query: ${pubErr.message}`)
          priceFile = pubRows?.[0] ?? null
        }

        if (!priceFile) throw new Error('No price file found (tried "Integrate PF30" and published).')

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

        // Run the engine in testMode (includes inactive rules for full visibility)
        const results = runPricingOnTree(FIXTURE_TREE, rules || [], pfVariables, { testMode: true })

        if (cancelled) return
        setState({
          status:    'done',
          results,
          pfName:    priceFile.name,
          ruleCount: (rules || []).length,
          error:     null,
        })
      } catch (err) {
        if (!cancelled) setState({ status: 'error', results: null, pfName: null, ruleCount: 0, error: err.message })
      }
    }

    run()
    return () => { cancelled = true }
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (state.status === 'loading' || state.status === 'idle') {
    return <div style={S.page}><p style={S.loading}>Loading price file and running engine…</p></div>
  }

  if (state.status === 'error') {
    return (
      <div style={S.page}>
        <h1 style={S.h1}>Pricing Benchmark</h1>
        <div style={S.err}><strong>Error:</strong> {state.error}</div>
      </div>
    )
  }

  const { results, pfName, ruleCount } = state
  const mfgMin  = results.manufacture_labour.total_minutes
  const instMin = results.install_labour.total_minutes
  const price   = results.price.total

  const mfgDiff  = diffLabel(mfgMin,  TARGETS.manufacture_minutes)
  const instDiff = diffLabel(instMin, TARGETS.install_minutes)
  const priceDiff = diffLabel(price,  TARGETS.item_cost, true)

  const errorCount = [
    ...results.manufacture_labour.lines,
    ...results.install_labour.lines,
    ...results.price.lines,
  ].filter(l => l.error).length

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Pricing Benchmark — L34046 Item 7</h1>
      <p style={{ color: '#555', marginBottom: '16px' }}>
        Price file: <strong>{pfName}</strong> · {ruleCount} rules loaded · testMode=true
        {errorCount > 0 && <span style={{ color: '#c00' }}> · {errorCount} rule error(s)</span>}
      </p>

      {/* Totals comparison */}
      <h2 style={S.h2}>Results vs Integrate Targets</h2>
      <table style={{ ...S.table, width: 'auto', minWidth: '500px' }}>
        <thead>
          <tr>
            <th style={S.th}>Pass</th>
            <th style={S.th}>Computed</th>
            <th style={S.th}>Comparison</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={S.td}>Manufacture labour</td>
            <td style={S.td}><strong>{fmt(mfgMin, 1)} min</strong></td>
            <td style={S.td}><span style={mfgDiff.ok ? S.hit : S.miss}>{mfgDiff.label}</span></td>
          </tr>
          <tr>
            <td style={S.td}>Install labour</td>
            <td style={S.td}><strong>{fmt(instMin, 1)} min</strong></td>
            <td style={S.td}><span style={instDiff.ok ? S.hit : S.miss}>{instDiff.label}</span></td>
          </tr>
          <tr>
            <td style={S.td}>Item cost</td>
            <td style={S.td}><strong>£{fmt(price)}</strong></td>
            <td style={S.td}><span style={priceDiff.ok ? S.hit : S.miss}>{priceDiff.label}</span></td>
          </tr>
        </tbody>
      </table>

      {/* Defaulted variables */}
      {(() => {
        const allLines = [
          ...results.manufacture_labour.lines,
          ...results.install_labour.lines,
          ...results.price.lines,
        ]
        const defaultedSet = new Set()
        for (const line of allLines) {
          for (const v of (line.defaulted_vars ?? [])) defaultedSet.add(v)
        }
        if (defaultedSet.size === 0) return null
        const sorted = [...defaultedSet].sort()
        return (
          <>
            <h2 style={S.h2}>Defaulted Variables ({defaultedSet.size})</h2>
            <p style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>
              These variable names appeared in rule expressions but were not defined — they were silently defaulted to 0.
            </p>
            <div style={{ ...S.varGrid, maxHeight: '120px', marginBottom: '16px' }}>
              {sorted.map(name => (
                <div key={name} style={S.varEntry}>
                  <span style={{ ...S.varKey, color: '#a60' }}>{name}</span>
                  <span style={S.varVal}>0</span>
                </div>
              ))}
            </div>
          </>
        )
      })()}

      {/* Manufacture labour */}
      <h2 style={S.h2}>
        Manufacture Labour — {results.manufacture_labour.lines.filter(l => l.fires).length} fired
        / {results.manufacture_labour.lines.length} rules
      </h2>
      <LabourTable
        lines={results.manufacture_labour.lines}
        totalMinutes={mfgMin}
      />

      {/* Install labour */}
      <h2 style={S.h2}>
        Install Labour — {results.install_labour.lines.filter(l => l.fires).length} fired
        / {results.install_labour.lines.length} rules
      </h2>
      <LabourTable
        lines={results.install_labour.lines}
        totalMinutes={instMin}
      />

      {/* Price */}
      <h2 style={S.h2}>
        Price Rules — {results.price.lines.filter(l => l.fires).length} fired
        / {results.price.lines.length} rules
      </h2>
      <PriceTable lines={results.price.lines} total={price} />

      {/* Variables */}
      <details style={S.details}>
        <summary style={S.summary}>All computed variables (click to expand)</summary>
        <VariablesPanel tree={FIXTURE_TREE} />
      </details>
    </div>
  )
}
