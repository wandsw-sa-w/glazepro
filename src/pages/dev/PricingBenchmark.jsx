/**
 * PricingBenchmark.jsx
 * Developer benchmark page at /dev/pricing-benchmark.
 *
 * Loads the current price file (is_current = true, fallback name = 'PF30') and its rules, runs
 * runPricingOnTree against a fixture tree matching L34046 Item 7, and displays
 * a breakdown table with comparison against known Integrate targets.
 */

import { useState, useEffect } from 'react'
import { supabase } from '../../supabase.js'
import { runPricingOnTree } from '../../pricing/pricingEngine.js'
import { computeDerived } from '../../drawingBoard/computeDerived.js'
import { defaultIronmonger } from '../../pricing/defaultIronmongery.js'
import { computeVariables } from '../../pricing/computeVariables.js'

// ── Fixture glass catalogue (fallback when parts_catalogue query fails) ───────
const FIXTURE_GLASS_CATALOGUE = {
  GL100010: { cost_per_m2: 32.00, thickness_mm: 4 },  // 4mm Clear Pilkington K Toughened
  GL100080: { cost_per_m2: 25.50, thickness_mm: 4 },  // 4mm Clear Toughened
}

// ── Fixture part cost map (F3) — from "Referenced parts" in integrate-part-allocator.txt ──
// Timber parts: cost per mm (£/m ÷ 1000). Nominal each: cost per unit (measure=1).
// Steel/lead: not priced via component loop — priced by sliding_sash weight rules.
const FIXTURE_PART_COST_MAP = {
  TP68: 2.85,   // Ogee Architrave 20x70 MDF £2.85/m
  TP74: 4.50,   // Chamfered Architrave 20x70 MDF £4.50/m
  TT69: 2.59,   // Pencil Round Architrave 20x70 MDF £2.59/m
  TP61: 2.76,   // Nosing 25x50 Redwood £2.76/m
  TP01: 2.59,   // Small staff bead 20x15 Redwood £2.59/m
  TP02: 2.95,   // Large staff bead 25x15 Redwood £2.95/m
  TP03: 2.22,   // Standard parting bead 8x25 Redwood £2.22/m
  AA01: 50.00,  // Internal Linings MDF (nominal each)
  AA02: 30.00,  // Windowboard MDF (nominal each)
  AA03: 75.00,  // External Linings Utile (nominal each)
}

// ── Integrate targets for L34046 Item 7 ──────────────────────────────────────
// Integrate PF30 Item 7 targets (from live run)
const TARGETS = {
  manufacture_minutes: 1337,
  install_minutes:     450,
  // Per-group COST targets (qty × value, no markup)
  group_cost: {
    manufacture:           549.42,
    labour:                301.58,
    manufacture_materials: 115.45,
    glass_done:            136.66,
    installation_materials: 138.45,
  },
  total_cost:  1241.56,
  total_price: 2456.24,
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
        internalFinish:    'clean_white',
        externalFinish:    'clean_white',
        cillFinish:        'clean_white',
        cutOutBrickReveal: false,
        ironmongeryFinish: 'ABs',  // Antique Brass — selects HKKS1075AB claw fastener
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
        // Outer frame dimensions set explicitly (inner opening is 1075×1630;
        // derivation from sash defaults is non-trivial without Integrate's geometry engine)
        outerWidth:  1255,
        outerHeight: 1775,
      },
      children: [
        {
          key: 'cill1',
          part_type: 'cillPart',
          values: {
            height: 70,
            depth:  200,
            // profiledHeight: cill height excluding frame stop (~25mm assumed)
            profiledHeight: 45,
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
                leftWidth:    50.75,  // gross stile incl. sash lip (47 + 3.75 mm lip)
                rightWidth:   50.75,
                operation:    'cord_hung',
                toBeReplaced: null,
                archHead:     false,
              },
              children: [
                {
                  key: 'glass1',
                  part_type: 'glassPart',
                  values: {
                    glazingId:            'double_glazed',
                    isIndividualPanes:    false,
                    spacerDimId:          '16mm_white_warm_edge',
                    barsWide:             2,   // 6-over-6: 2 vertical bars per sash
                    barsHigh:             1,   // 1 horizontal bar per sash
                    // Glass part codes — costs/thicknesses resolved from parts_catalogue
                    internalGlassPartNo:  'GL100010',  // 4mm Clear Pilkington K Toughened £32.00/m²
                    externalGlassPartNo:  'GL100080',  // 4mm Clear Toughened £25.50/m²
                    spacerHeight:         16,  // → glass_unit_thickness = 4+16+4 = 24mm
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
                leftWidth:    50.75,  // gross stile incl. sash lip (47 + 3.75 mm lip)
                rightWidth:   50.75,
                operation:    'cord_hung',
                toBeReplaced: null,
                archHead:     false,
              },
              children: [
                {
                  key: 'glass2',
                  part_type: 'glassPart',
                  values: {
                    glazingId:            'double_glazed',
                    isIndividualPanes:    false,
                    spacerDimId:          '16mm_white_warm_edge',
                    barsWide:             2,   // 6-over-6: 2 vertical bars per sash
                    barsHigh:             1,   // 1 horizontal bar per sash
                    // Glass part codes — costs/thicknesses resolved from parts_catalogue
                    internalGlassPartNo:  'GL100010',  // 4mm Clear Pilkington K Toughened £32.00/m²
                    externalGlassPartNo:  'GL100080',  // 4mm Clear Toughened £25.50/m²
                    spacerHeight:         16,  // → glass_unit_thickness = 4+16+4 = 24mm
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
    if (!groups[g]) groups[g] = { lines: [], cost: 0, price: 0 }
    groups[g].lines.push(line)
    if (line.fires && !line.error) {
      groups[g].cost  += line.line_cost
      groups[g].price += line.line_total
    }
  }

  const totalCost  = Object.values(groups).reduce((s, g) => s + g.cost,  0)
  const totalPrice = Object.values(groups).reduce((s, g) => s + g.price, 0)

  return (
    <>
      {/* Per-group cost vs target summary */}
      <table style={{ ...S.table, width: 'auto', minWidth: '600px', marginBottom: '16px' }}>
        <thead>
          <tr>
            <th style={S.th}>Group</th>
            <th style={S.th}>Cost (no markup)</th>
            <th style={S.th}>Price (with markup)</th>
            <th style={S.th}>vs Integrate target (cost)</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groups).map(([group, g]) => {
            const target = TARGETS.group_cost?.[group]
            const diff   = target != null ? g.cost - target : null
            const ok     = diff != null && Math.abs(diff) < 0.02
            return (
              <tr key={group} style={S.fired}>
                <td style={S.td}><strong>{group}</strong></td>
                <td style={S.td}>£{fmt(g.cost)}</td>
                <td style={S.td}>£{fmt(g.price)}</td>
                <td style={S.td}>
                  {diff == null
                    ? <span style={{ color: '#aaa' }}>—</span>
                    : <span style={ok ? S.hit : S.miss}>
                        {ok ? `✓ £${fmt(target)}` : `✗ diff ${diff >= 0 ? '+' : ''}£${fmt(diff)} (target £${fmt(target)})`}
                      </span>
                  }
                </td>
              </tr>
            )
          })}
          <tr style={{ fontWeight: 'bold', background: '#f0f0f0' }}>
            <td style={S.td}>TOTAL</td>
            <td style={S.td}>£{fmt(totalCost)}</td>
            <td style={S.td}>£{fmt(totalPrice)}</td>
            <td style={S.td}>
              {(() => {
                const costDiff  = totalCost  - TARGETS.total_cost
                const priceDiff = totalPrice - TARGETS.total_price
                const costOk    = Math.abs(costDiff)  < 0.02
                const priceOk   = Math.abs(priceDiff) < 0.02
                return (
                  <>
                    <span style={costOk ? S.hit : S.miss}>
                      Cost: {costOk ? '✓' : `✗ diff £${fmt(costDiff)}`} (target £{fmt(TARGETS.total_cost)})
                    </span>
                    {' · '}
                    <span style={priceOk ? S.hit : S.miss}>
                      Price: {priceOk ? '✓' : `✗ diff £${fmt(priceDiff)}`} (target £{fmt(TARGETS.total_price)})
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
        <div key={group} style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', color: '#555', marginBottom: '4px', fontSize: '12px' }}>
            {group} — cost £{fmt(g.cost)} · price £{fmt(g.price)}
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
                    <td style={S.td}>{line.name}</td>
                    <td style={S.td}>{line.part_type ?? '—'}</td>
                    <td style={S.td} title={line.condition}>{(line.condition ?? '').slice(0, 50)}{(line.condition ?? '').length > 50 ? '…' : ''}</td>
                    <td style={S.td}>{line.error ? <span style={{ color: '#c00' }}>{line.error}</span> : fmt(line.quantity, 4)}</td>
                    <td style={S.td}>{!line.error && fmt(line.value, 4)}</td>
                    <td style={S.td}>{!line.error && fmt(line.markup, 3)}</td>
                    <td style={S.td}>{lineCost != null ? <strong>£{fmt(lineCost)}</strong> : (!line.error ? '—' : '')}</td>
                    <td style={S.td}>{linePrice != null ? <strong>£{fmt(linePrice)}</strong> : (!line.error ? '—' : '')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
  const [state, setState] = useState({
    status: 'idle', results: null, pfName: null, ruleCount: 0,
    error: null, catalogueWarning: null, allocRulesWarning: null,
    ironmongeryWarning: null, ironmongeryLines: [],
  })

  useEffect(() => {
    let cancelled = false

    async function run() {
      setState(s => ({ ...s, status: 'loading' }))
      try {
        // Find the current price file (is_current = true), falling back to name = 'PF30'
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

        // Load glass catalogue — fall back to fixture if query fails (F0 tolerance)
        let glassCatalogue = FIXTURE_GLASS_CATALOGUE
        let catalogueWarning = null
        try {
          const { data: catalogueRows, error: catErr } = await supabase
            .from('parts_catalogue')
            .select('part_code, unit_cost, thickness_mm')
            .eq('category', 'Glass')
          if (catErr) throw catErr
          const built = Object.fromEntries(
            (catalogueRows || []).map(r => [r.part_code, { cost_per_m2: r.unit_cost, thickness_mm: r.thickness_mm }])
          )
          if (Object.keys(built).length === 0) {
            catalogueWarning = 'parts_catalogue returned no glass rows — using fixture fallback costs'
          } else {
            glassCatalogue = built
          }
        } catch (err) {
          catalogueWarning = `parts_catalogue query failed (${err.message}) — using fixture fallback costs`
        }

        // Load part allocation rules (F3) — fall back gracefully if table not yet seeded
        let partAllocationRules = []
        let allocRulesWarning = null
        try {
          const { data: allocRules, error: allocErr } = await supabase
            .from('part_allocation_rules')
            .select('id, rule_family, sort_order, group_name, loop_target, label, condition, qty_expr, part_code, measure_expr, is_active')
            .eq('rule_family', 'part_allocator')
            .order('sort_order')
          if (allocErr) throw allocErr
          partAllocationRules = allocRules || []
        } catch (err) {
          allocRulesWarning = `part_allocation_rules query failed (${err.message}) — run sql/step-f2-part-allocator.sql first`
        }

        // Load default ironmongery rules + variant catalogue (G5)
        let ironmongeryLines = []
        let ironmongeryCatalogue = {}
        let ironmongeryWarning = null
        try {
          const [{ data: ironRules }, { data: ironVariants }, { data: ironKitLines }] = await Promise.all([
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

          // Build kit-line map: variant_id → [{ part_code, part_name, qty, unit_cost }]
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

          // Build catalogue map: 'short_name:finish_code' → { cost, parts }
          for (const v of (ironVariants ?? [])) {
            const shortName = v.ironmongery_products?.short_name
            if (!shortName) continue
            const key = `${shortName}:${v.finish_code}`
            ironmongeryCatalogue[key] = {
              cost:  v.cost ?? 0,
              parts: kitLinesByVariant[v.id] ?? [],
            }
          }

          if (ironRules && ironRules.length > 0) {
            const derived  = computeDerived(FIXTURE_TREE)
            const itemVars = computeVariables(FIXTURE_TREE, derived, pfVariables) ?? {}
            ironmongeryLines = defaultIronmonger(FIXTURE_TREE, { ...pfVariables, ...itemVars }, ironRules)
          } else {
            ironmongeryWarning = 'part_allocation_rules has no default_ironmongery rows — run sql/step-g3-default-ironmongery.sql first'
          }
        } catch (err) {
          ironmongeryWarning = `Ironmongery data failed (${err.message}) — G5 section will be empty`
        }

        // Run the engine with testMode=false (active rules only — production behaviour)
        const results = runPricingOnTree(FIXTURE_TREE, rules || [], pfVariables, {
          testMode: false,
          glassCatalogue,
          partAllocationRules,
          partCostMap: FIXTURE_PART_COST_MAP,
          ironmongeryLines,
          ironmongeryCatalogue,
        })

        if (cancelled) return
        setState({
          status:    'done',
          results,
          pfName:    priceFile.name,
          ruleCount: (rules || []).length,
          error:     null,
          catalogueWarning,
          allocRulesWarning,
          ironmongeryWarning,
          ironmongeryLines,
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

  const { results, pfName, ruleCount, catalogueWarning, allocRulesWarning, ironmongeryWarning, ironmongeryLines } = state
  const mfgMin  = results.manufacture_labour.total_minutes
  const instMin = results.install_labour.total_minutes
  const price   = results.price.total

  const mfgDiff  = diffLabel(mfgMin,  TARGETS.manufacture_minutes)
  const instDiff = diffLabel(instMin, TARGETS.install_minutes)

  const errorCount = [
    ...results.manufacture_labour.lines,
    ...results.install_labour.lines,
    ...results.price.lines,
  ].filter(l => l.error).length

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Pricing Benchmark — L34046 Item 7</h1>
      <p style={{ color: '#555', marginBottom: '16px' }}>
        Price file: <strong>{pfName}</strong> · {ruleCount} rules loaded
        {errorCount > 0 && <span style={{ color: '#c00' }}> · {errorCount} rule error(s)</span>}
      </p>

      {/* F0: Yellow warning banners when catalogue / alloc rules unavailable */}
      {catalogueWarning && (
        <div style={{ background: '#fffbe6', border: '1px solid #e6c800', padding: '8px 12px', marginBottom: '10px', borderRadius: '3px' }}>
          ⚠ {catalogueWarning}
        </div>
      )}
      {allocRulesWarning && (
        <div style={{ background: '#fffbe6', border: '1px solid #e6c800', padding: '8px 12px', marginBottom: '10px', borderRadius: '3px' }}>
          ⚠ {allocRulesWarning}
        </div>
      )}
      {ironmongeryWarning && (
        <div style={{ background: '#fffbe6', border: '1px solid #e6c800', padding: '8px 12px', marginBottom: '10px', borderRadius: '3px' }}>
          ⚠ {ironmongeryWarning}
        </div>
      )}

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
            <td style={S.td}>Total price (all groups)</td>
            <td style={S.td}><strong>£{fmt(price)}</strong></td>
            <td style={S.td}>
              {(() => {
                const diff = price - TARGETS.total_price
                const ok   = Math.abs(diff) < 0.02
                return <span style={ok ? S.hit : S.miss}>{ok ? `✓ £${fmt(TARGETS.total_price)}` : `✗ diff £${fmt(diff)} (target £${fmt(TARGETS.total_price)})`}</span>
              })()}
            </td>
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

      {/* Allocated parts table (F2/F3) */}
      <h2 style={S.h2}>
        Allocated Parts — {(results.allocated_parts ?? []).length} part line(s)
      </h2>
      {(results.allocated_parts ?? []).length === 0 ? (
        <p style={{ color: '#888', fontSize: '12px' }}>
          No parts allocated — run sql/step-f2-part-allocator.sql then reload.
        </p>
      ) : (
        <table style={{ ...S.table, width: 'auto', minWidth: '700px' }}>
          <thead>
            <tr>
              <th style={S.th}>Group</th>
              <th style={S.th}>Label</th>
              <th style={S.th}>Part</th>
              <th style={S.th}>Qty</th>
              <th style={S.th}>Measure</th>
              <th style={S.th}>Unit cost</th>
              <th style={S.th}>Line cost</th>
            </tr>
          </thead>
          <tbody>
            {(results.allocated_parts ?? []).map((a, i) => {
              const unitCost = FIXTURE_PART_COST_MAP[a.part_code]
              const isTimber = unitCost != null && unitCost < 1  // per-mm cost
              const lineCost = unitCost != null ? unitCost * a.measure * a.qty : null
              return (
                <tr key={i} style={S.fired}>
                  <td style={S.td}>{a.group}</td>
                  <td style={S.td}>{a.label}</td>
                  <td style={S.td}><strong>{a.part_code}</strong></td>
                  <td style={S.td}>{a.qty}</td>
                  <td style={S.td}>
                    {a.group === 'sash_weights'
                      ? `${fmt(a.measure, 1)} kg`
                      : isTimber
                        ? `${fmt(a.measure, 0)} mm`
                        : `${fmt(a.measure, 0)} ea`}
                  </td>
                  <td style={S.td}>
                    {unitCost != null
                      ? isTimber ? `£${fmt(unitCost * 1000, 2)}/m` : `£${fmt(unitCost, 2)}/ea`
                      : <span style={{ color: '#a60' }}>no fixture cost</span>}
                  </td>
                  <td style={S.td}>
                    {lineCost != null ? <strong>£{fmt(lineCost)}</strong> : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* Installation Materials gap analysis (F3) */}
      {(() => {
        const instLines = results.price.lines.filter(l => l.group_name === 'installation_materials' && l.fires && !l.error)
        if (instLines.length === 0) return null
        const instCost  = instLines.reduce((s, l) => s + l.quantity * l.value, 0)
        const instTarget = TARGETS.group_cost.installation_materials
        const gap = instTarget - instCost
        const ok  = Math.abs(gap) < 0.02
        return (
          <>
            <h2 style={S.h2}>Installation Materials — Line-by-line vs £{fmt(instTarget)} target</h2>
            <table style={{ ...S.table, width: 'auto', minWidth: '600px' }}>
              <thead>
                <tr>
                  <th style={S.th}>Rule</th>
                  <th style={S.th}>Scope</th>
                  <th style={S.th}>Qty (cost/kg or £)</th>
                  <th style={S.th}>× Value</th>
                  <th style={S.th}>Cost (no markup)</th>
                </tr>
              </thead>
              <tbody>
                {instLines.map((l, i) => (
                  <tr key={i} style={S.fired}>
                    <td style={S.td}>{l.alloc_label ?? l.name}</td>
                    <td style={S.td}>{l.alloc_part_code ? `${l.alloc_part_code}` : (l.part_type ?? '—')}</td>
                    <td style={S.td}>{fmt(l.quantity, 4)}</td>
                    <td style={S.td}>{fmt(l.value, 4)}</td>
                    <td style={S.td}><strong>£{fmt(l.quantity * l.value)}</strong></td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 'bold', background: '#f0f0f0' }}>
                  <td style={S.td} colSpan={4}>Total computed</td>
                  <td style={S.td}>£{fmt(instCost)}</td>
                </tr>
                <tr style={{ background: ok ? '#f0fff0' : '#fff8e6' }}>
                  <td style={S.td} colSpan={4}>
                    <span style={ok ? S.hit : { color: '#a60', fontWeight: 'bold' }}>
                      {ok ? '✓ matches target' : `Gap £${fmt(gap)} — ironmongery kit not yet built`}
                    </span>
                  </td>
                  <td style={{ ...S.td, color: '#555' }}>target £{fmt(instTarget)}</td>
                </tr>
              </tbody>
            </table>
            {!ok && gap > 0 && (
              <p style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>
                Remaining gap ~£{fmt(gap)}: this is the ironmongery kit (sash lifts, fasteners, pulleys, etc.) —
                priced via the <code>ironmongery_part</code> loop_target once ironmongery parts are added to the drawing.
              </p>
            )}
          </>
        )
      })()}

      {/* G5 — Default Ironmongery lines + pricing */}
      <h2 style={S.h2}>
        Default Ironmongery (G5) — {(ironmongeryLines ?? []).length} product line(s)
      </h2>
      {(ironmongeryLines ?? []).length === 0 ? (
        <p style={{ color: '#888', fontSize: '12px' }}>
          No ironmongery lines — run sql/step-g3-default-ironmongery.sql to seed the rules.
        </p>
      ) : (
        <>
          <table style={{ ...S.table, width: 'auto', minWidth: '600px', marginBottom: '10px' }}>
            <thead>
              <tr>
                <th style={S.th}>Product (short_name)</th>
                <th style={S.th}>Finish</th>
                <th style={S.th}>Qty</th>
                <th style={S.th}>Source</th>
              </tr>
            </thead>
            <tbody>
              {(ironmongeryLines ?? []).map((l, i) => (
                <tr key={i} style={S.fired}>
                  <td style={S.td}><strong>{l.product_short_name}</strong></td>
                  <td style={S.td}>{l.finish_code ?? '(item finish)'}</td>
                  <td style={S.td}>{fmt(l.qty, 2)}</td>
                  <td style={S.td}>{l.source ?? 'default'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(() => {
            const ironLines = results.price.lines.filter(l => l.alloc_iron_short_name && l.fires && !l.error)
            if (ironLines.length === 0) return (
              <p style={{ color: '#a60', fontSize: '12px' }}>
                No ironmongery price lines fired — check that the price file has an
                <code> ironmongery_part</code> rule and that ironmongery catalogue data is loaded (sql/step-g2).
              </p>
            )
            const ironTotal = ironLines.reduce((s, l) => s + l.line_total, 0)
            return (
              <table style={{ ...S.table, width: 'auto', minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th style={S.th}>Product</th>
                    <th style={S.th}>Part</th>
                    <th style={S.th}>Cost × Qty</th>
                    <th style={S.th}>Rounded</th>
                    <th style={S.th}>Line total (×markup)</th>
                  </tr>
                </thead>
                <tbody>
                  {ironLines.map((l, i) => (
                    <tr key={i} style={S.fired}>
                      <td style={S.td}>{l.alloc_iron_short_name}</td>
                      <td style={S.td}>{l.alloc_iron_part_code ?? '(kit lump)'}</td>
                      <td style={S.td}>{fmt(l.quantity / 1.05, 2)}</td>
                      <td style={S.td}>£{fmt(l.quantity, 2)}</td>
                      <td style={S.td}><strong>£{fmt(l.line_total)}</strong></td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 'bold', background: '#f0f0f0' }}>
                    <td style={S.td} colSpan={4}>Ironmongery total (cost×markup)</td>
                    <td style={S.td}>£{fmt(ironTotal)}</td>
                  </tr>
                </tbody>
              </table>
            )
          })()}
        </>
      )}

      {/* Items left for next step */}
      <h2 style={S.h2}>Not Yet Built (Next Step)</h2>
      <ul style={{ fontFamily: 'monospace', fontSize: '12px', color: '#888' }}>
        <li>Sash weight display on drawing board (F1 show-on-board)</li>
      </ul>

      {/* Variables */}
      <details style={S.details}>
        <summary style={S.summary}>All computed variables (click to expand)</summary>
        <VariablesPanel tree={FIXTURE_TREE} />
      </details>
    </div>
  )
}
