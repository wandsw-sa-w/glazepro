import { describe, it, expect } from 'vitest'
import { loadDrawingRunPrices, drawingRunSales } from './drawingRunPrice.js'

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
  it('sums sales and cost from the latest completed run only (not an older run)', async () => {
    const supabase = fakeSupabase({
      pricing_runs: [
        { id: 'run-old', drawing_id: 'd1', price_file_id: 'pf1', status: 'complete', created_at: '2026-01-01' },
        { id: 'run-new', drawing_id: 'd1', price_file_id: 'pf1', status: 'complete', created_at: '2026-02-01' },
      ],
      drawing_rule_results: [
        { drawing_id: 'd1', pricing_run_id: 'run-old', sales: 999, cost: 999 },
        { drawing_id: 'd1', pricing_run_id: 'run-new', sales: 1622.44, cost: 500 },
      ],
    })
    const result = await loadDrawingRunPrices(['d1'], supabase)
    expect(result.d1.sales).toBeCloseTo(1622.44, 2)
    expect(result.d1.pricingRunId).toBe('run-new')
  })

  it('ignores runs with status other than complete', async () => {
    const supabase = fakeSupabase({
      pricing_runs: [
        { id: 'run-failed', drawing_id: 'd1', price_file_id: 'pf1', status: 'failed', created_at: '2026-02-01' },
      ],
      drawing_rule_results: [],
    })
    const result = await loadDrawingRunPrices(['d1'], supabase)
    expect(result.d1.sales).toBeNull()
    expect(result.d1.pricingRunId).toBeNull()
  })

  it('sums multiple rows for the same drawing (price-rule lines)', async () => {
    const supabase = fakeSupabase({
      pricing_runs: [{ id: 'run1', drawing_id: 'd1', price_file_id: 'pf1', status: 'complete', created_at: '2026-01-01' }],
      drawing_rule_results: [
        { drawing_id: 'd1', pricing_run_id: 'run1', sales: 100, cost: 40 },
        { drawing_id: 'd1', pricing_run_id: 'run1', sales: 50, cost: 20 },
      ],
    })
    const result = await loadDrawingRunPrices(['d1'], supabase)
    expect(result.d1.sales).toBeCloseTo(150, 2)
  })

  it('keeps drawings independent — one drawing with no run does not affect another', async () => {
    const supabase = fakeSupabase({
      pricing_runs: [{ id: 'run1', drawing_id: 'd1', price_file_id: 'pf1', status: 'complete', created_at: '2026-01-01' }],
      drawing_rule_results: [{ drawing_id: 'd1', pricing_run_id: 'run1', sales: 1622.44, cost: 500 }],
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

  it('treats null sales rows (labour lines) as not contributing to the sum, without crashing', async () => {
    const supabase = fakeSupabase({
      pricing_runs: [{ id: 'run1', drawing_id: 'd1', price_file_id: 'pf1', status: 'complete', created_at: '2026-01-01' }],
      drawing_rule_results: [
        { drawing_id: 'd1', pricing_run_id: 'run1', sales: 100, cost: 40 },
        { drawing_id: 'd1', pricing_run_id: 'run1', sales: null, cost: 1337 }, // manufacture labour row (minutes, not pounds)
      ],
    })
    const result = await loadDrawingRunPrices(['d1'], supabase)
    expect(result.d1.sales).toBeCloseTo(100, 2)
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
