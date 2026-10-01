import { describe, it, expect } from 'vitest'
import { loadDrawingRunPrices, drawingRunSales, drawingQuoteItemNet } from './drawingRunPrice.js'

// ── Minimal fake Supabase client ───────────────────────────────────────────────
// Supports exactly the chain this module uses: .from(table).select(...).in(col,
// vals).eq(col,val).order(...) — awaited at the end, resolving to { data }.

function fakeSupabase(tables) {
  return {
    from(table) {
      let rows = [...(tables[table] || [])]
      const builder = {
        select() { return builder },
        in(col, vals) { rows = rows.filter(r => vals.includes(r[col])); return builder },
        eq(col, val) { rows = rows.filter(r => r[col] === val); return builder },
        order(col, { ascending = true } = {}) {
          rows = [...rows].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (ascending ? 1 : -1))
          return builder
        },
        then(resolve) { resolve({ data: rows, error: null }) },
      }
      return builder
    },
  }
}

describe('loadDrawingRunPrices', () => {
  it('reads total_sales/total_cost from the latest completed run only (not an older run)', async () => {
    const supabase = fakeSupabase({
      pricing_runs: [
        { id: 'run-old', drawing_id: 'd1', price_file_id: 'pf1', status: 'complete', total_sales: 999,     total_cost: 999,    created_at: '2026-01-01' },
        { id: 'run-new', drawing_id: 'd1', price_file_id: 'pf1', status: 'complete', total_sales: 1622.44, total_cost: 820.11, created_at: '2026-02-01' },
      ],
    })
    const result = await loadDrawingRunPrices(['d1'], supabase)
    expect(result.d1.sales).toBeCloseTo(1622.44, 2)
    expect(result.d1.cost).toBeCloseTo(820.11, 2)
    expect(result.d1.pricingRunId).toBe('run-new')
  })

  it('ignores runs with status other than complete', async () => {
    const supabase = fakeSupabase({
      pricing_runs: [
        { id: 'run-failed', drawing_id: 'd1', price_file_id: 'pf1', status: 'failed', total_sales: 1622.44, total_cost: 820.11, created_at: '2026-02-01' },
      ],
    })
    const result = await loadDrawingRunPrices(['d1'], supabase)
    expect(result.d1.sales).toBeNull()
    expect(result.d1.pricingRunId).toBeNull()
  })

  it('cost is well below sales for a typical run (labour minutes are not folded in)', async () => {
    // A run with 1,337 manufacture + 450 install minutes used to add ~1,787
    // to "cost" when it was summed from all drawing_rule_results rows
    // unfiltered. total_cost here is pricing_runs' own column, written from
    // engineResults.price.total_cost — which never included those rows.
    const supabase = fakeSupabase({
      pricing_runs: [
        { id: 'run1', drawing_id: 'd8', price_file_id: 'pf30', status: 'complete', total_sales: 1622.44, total_cost: 740.50, created_at: '2026-01-01' },
      ],
    })
    const result = await loadDrawingRunPrices(['d8'], supabase)
    expect(result.d8.cost).toBeLessThan(result.d8.sales)
    expect(result.d8.cost).toBeLessThan(1787) // sanity: nowhere near minutes-as-pounds territory
  })

  it('keeps drawings independent — one drawing with no run does not affect another', async () => {
    const supabase = fakeSupabase({
      pricing_runs: [{ id: 'run1', drawing_id: 'd1', price_file_id: 'pf1', status: 'complete', total_sales: 1622.44, total_cost: 740.50, created_at: '2026-01-01' }],
    })
    const result = await loadDrawingRunPrices(['d1', 'd2'], supabase)
    expect(result.d1.sales).toBeCloseTo(1622.44, 2)
    expect(result.d2.sales).toBeNull()
  })

  it('returns an empty map without querying for an empty drawing id list', async () => {
    const supabase = fakeSupabase({})
    const result = await loadDrawingRunPrices([], supabase)
    expect(result).toEqual({})
  })

  it('treats a null total_cost/total_sales as "no price yet", not zero', async () => {
    const supabase = fakeSupabase({
      pricing_runs: [{ id: 'run1', drawing_id: 'd1', price_file_id: 'pf1', status: 'complete', total_sales: null, total_cost: null, created_at: '2026-01-01' }],
    })
    const result = await loadDrawingRunPrices(['d1'], supabase)
    expect(result.d1.sales).toBeNull()
    expect(result.d1.cost).toBeNull()
    expect(result.d1.pricingRunId).toBe('run1') // the run exists, it just has no totals written (pre-step-l2 row)
  })
})

describe('drawingRunSales', () => {
  const runPrices = { d1: { sales: 1622.44 } }

  it('reads the run price when there is no override', () => {
    expect(drawingRunSales({ id: 'd1', price_override: null }, runPrices)).toBeCloseTo(1622.44, 2)
  })

  it('price_override wins over the run price', () => {
    expect(drawingRunSales({ id: 'd1', price_override: 2000 }, runPrices)).toBe(2000)
  })

  it('returns null when there is no run and no override', () => {
    expect(drawingRunSales({ id: 'd2', price_override: null }, runPrices)).toBeNull()
  })

  it('returns null for a null drawing', () => {
    expect(drawingRunSales(null, runPrices)).toBeNull()
  })

  it('ignores an empty-string override (treated as unset)', () => {
    expect(drawingRunSales({ id: 'd1', price_override: '' }, runPrices)).toBeCloseTo(1622.44, 2)
  })
})

// ── drawingQuoteItemNet — J+K fixes round 4, item 1 ───────────────────────────
// The picker Total used to forget the quote's apportioned InstallSure share
// (it only added the drawing's own run price), so it disagreed with the
// Overview's total — Q1 showed 1,946.93 on the matrix but 2,029.49 on the
// Overview (1,946.93 + 68.80 InstallSure apportionment ~= the real total
// once the second item/discount effects are accounted for in a real quote;
// the key point these tests pin down is that the apportioned share is
// always added, which it previously wasn't on the picker).

describe('drawingQuoteItemNet', () => {
  const runPrices = { d1: { sales: 1622.44 } }

  it('adds the apportioned share on top of the drawing-level run price', () => {
    const apportionment = { d1: 68.80 }
    expect(drawingQuoteItemNet({ id: 'd1', price_override: null }, runPrices, apportionment)).toBeCloseTo(1691.24, 2)
  })

  it('with no apportionment for this quote, is just the drawing-level price', () => {
    expect(drawingQuoteItemNet({ id: 'd1', price_override: null }, runPrices, {})).toBeCloseTo(1622.44, 2)
  })

  it('with no apportionment map at all, does not throw and uses 0', () => {
    expect(drawingQuoteItemNet({ id: 'd1', price_override: null }, runPrices, undefined)).toBeCloseTo(1622.44, 2)
  })

  it('price_override still replaces the run price, with the apportionment still added on top', () => {
    const apportionment = { d1: 68.80 }
    expect(drawingQuoteItemNet({ id: 'd1', price_override: 2000 }, runPrices, apportionment)).toBeCloseTo(2068.80, 2)
  })

  it('a drawing with no run and no override contributes 0 plus its apportionment', () => {
    const apportionment = { d2: 10 }
    expect(drawingQuoteItemNet({ id: 'd2', price_override: null }, runPrices, apportionment)).toBe(10)
  })

  it('returns 0 for a null drawing', () => {
    expect(drawingQuoteItemNet(null, runPrices, { d1: 68.80 })).toBe(0)
  })

  it('two quotes sharing the same drawing each get their own apportionment, not the other\'s', () => {
    const q1Apportionment = { d1: 68.80 }
    const q2Apportionment = { d1: 12.34 }
    expect(drawingQuoteItemNet({ id: 'd1', price_override: null }, runPrices, q1Apportionment)).toBeCloseTo(1691.24, 2)
    expect(drawingQuoteItemNet({ id: 'd1', price_override: null }, runPrices, q2Apportionment)).toBeCloseTo(1634.78, 2)
  })
})
