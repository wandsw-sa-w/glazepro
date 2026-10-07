/**
 * PriceRuleTable.jsx
 * The price-rule results table, grouped the way the benchmark page groups
 * rules (group summary with totals, then detailed lines per group).
 *
 * Shared by the dev benchmark page (/dev/pricing-benchmark) and the
 * Price breakdown view for real drawings, so the two cannot drift.
 *
 * `targets` is optional: the benchmark page passes Integrate targets and
 * gets the vs-target comparison columns; the breakdown view passes nothing
 * and gets the same table without target columns.
 */

// ── Styles (table subset shared by both pages) ───────────────────────────────

export const TS = {
  table: { width: '100%', borderCollapse: 'collapse', marginBottom: '16px' },
  th: { background: '#f0f0f0', padding: '4px 8px', textAlign: 'left', border: '1px solid #ddd', whiteSpace: 'nowrap' },
  td: { padding: '3px 8px', border: '1px solid #ddd', verticalAlign: 'top' },
  fired:   { background: '#fff' },
  noFire:  { background: '#f9f9f9', color: '#aaa' },
  errRow:  { background: '#fff0f0', color: '#c00' },
  hit:     { color: '#080' },
  miss:    { color: '#c00', fontWeight: 'bold' },
  summary: { cursor: 'pointer', fontWeight: 'bold', padding: '4px 0' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmt(n, decimals = 2) {
  if (n == null) return '—'
  return Number(n).toFixed(decimals)
}

export function costPriceMatch(actualCost, actualPrice, targets) {
  const costDiff  = actualCost  - targets.total_cost
  const priceDiff = actualPrice - targets.total_price
  const costOk    = Math.abs(costDiff)  < 0.02
  const priceOk   = Math.abs(priceDiff) < 0.02
  return { costOk, priceOk, costDiff, priceDiff }
}

// ── Price rules table ─────────────────────────────────────────────────────────

export function PriceTable({ lines, targets }) {
  if (!lines || lines.length === 0) return <p style={{ color: '#aaa' }}>No rules.</p>

  const hasTargets = targets != null

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
  const groupTargets = targets?.groups ?? targets?.group_cost ?? {}

  return (
    <>
      {/* Per-group summary */}
      <table style={{ ...TS.table, width: 'auto', minWidth: '600px', marginBottom: '16px' }}>
        <thead>
          <tr>
            <th style={TS.th}>Group</th>
            <th style={TS.th}>Cost</th>
            <th style={TS.th}>Price</th>
            {hasTargets && <th style={TS.th}>vs Target</th>}
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
              <tr key={group} style={TS.fired}>
                <td style={TS.td}><strong>{group}</strong></td>
                <td style={TS.td}>{'£'}{fmt(g.cost)}</td>
                <td style={TS.td}>{'£'}{fmt(g.price)}</td>
                {hasTargets && (
                  <td style={TS.td}>
                    {costDiff == null
                      ? <span style={{ color: '#aaa' }}>{'—'}</span>
                      : <>
                          <span style={costOk ? TS.hit : TS.miss}>
                            {costOk ? `C: ok` : `C: diff £${fmt(costDiff)}`}
                          </span>
                          {priceDiff != null && <>
                            {' '}
                            <span style={priceOk ? TS.hit : TS.miss}>
                              {priceOk ? `P: ok` : `P: diff £${fmt(priceDiff)}`}
                            </span>
                          </>}
                        </>
                    }
                  </td>
                )}
              </tr>
            )
          })}
          <tr style={{ fontWeight: 'bold', background: '#f0f0f0' }}>
            <td style={TS.td}>TOTAL</td>
            <td style={TS.td}>{'£'}{fmt(totalCost)}</td>
            <td style={TS.td}>{'£'}{fmt(totalPrice)}</td>
            {hasTargets && (
              <td style={TS.td}>
                {(() => {
                  const m = costPriceMatch(totalCost, totalPrice, targets)
                  return (
                    <>
                      <span style={m.costOk ? TS.hit : TS.miss}>
                        Cost: {m.costOk ? 'ok' : `diff £${fmt(m.costDiff)}`} (target {'£'}{fmt(targets.total_cost)})
                      </span>
                      {' | '}
                      <span style={m.priceOk ? TS.hit : TS.miss}>
                        Price: {m.priceOk ? 'ok' : `diff £${fmt(m.priceDiff)}`} (target {'£'}{fmt(targets.total_price)})
                      </span>
                    </>
                  )
                })()}
              </td>
            )}
          </tr>
        </tbody>
      </table>

      {/* Detailed rule lines per group */}
      {Object.entries(groups).map(([group, g]) => (
        <details key={group} style={{ marginBottom: '12px' }}>
          <summary style={{ ...TS.summary, fontSize: '12px', color: '#555' }}>
            {group} {'—'} cost {'£'}{fmt(g.cost)} / price {'£'}{fmt(g.price)}
          </summary>
          <table style={TS.table}>
            <thead>
              <tr>
                <th style={TS.th}>Rule</th>
                <th style={TS.th}>Loop Part</th>
                <th style={TS.th}>Qty</th>
                <th style={TS.th}>Value</th>
                <th style={TS.th}>Markup</th>
                <th style={TS.th}>Cost</th>
                <th style={TS.th}>Price</th>
              </tr>
            </thead>
            <tbody>
              {g.lines.map((line, i) => {
                const rowStyle = line.error ? TS.errRow : (line.fires ? TS.fired : TS.noFire)
                const lineCost  = line.fires && !line.error ? line.line_cost : null
                const linePrice = line.fires && !line.error ? line.line_total : null
                return (
                  <tr key={i} style={rowStyle}>
                    <td style={TS.td}>{line.alloc_label ?? line.name}</td>
                    <td style={TS.td}>{line.alloc_part_code ?? line.alloc_iron_part_code ?? line.part_type ?? '—'}</td>
                    <td style={TS.td}>{line.error ? <span style={{ color: '#c00' }}>{line.error}</span> : fmt(line.quantity, 4)}</td>
                    <td style={TS.td}>{!line.error && fmt(line.value, 4)}</td>
                    <td style={TS.td}>{!line.error && fmt(line.markup, 3)}</td>
                    <td style={TS.td}>{lineCost != null ? <strong>{'£'}{fmt(lineCost)}</strong> : (!line.error ? '—' : '')}</td>
                    <td style={TS.td}>{linePrice != null ? <strong>{'£'}{fmt(linePrice)}</strong> : (!line.error ? '—' : '')}</td>
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
