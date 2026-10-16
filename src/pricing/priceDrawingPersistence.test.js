/**
 * priceDrawingPersistence.test.js — Step BS follow-up
 *
 * Drawing 117 saved its 180-minute POA line and then could not be PRICED:
 * the breakdown line Step BS pushed had no rule behind it, so its
 * drawing_rule_results row had price_rule_id null against a NOT NULL column;
 * and the failure path then called `.catch()` on a PostgREST builder, which
 * is not a Promise, so the run was never marked failed and sat in_progress.
 *
 * The offline suite never persisted a run, which is why neither was seen.
 * These tests go through priceDrawing against a fake client that behaves as
 * the real one does — a builder is thenable but has NO `.catch` — and assert
 * on what is written.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = resolve(HERE, 'benchmarks/pf30-snapshot.json')
const SNAPSHOT = existsSync(SNAPSHOT_PATH) ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) : null

let TREE = null
vi.mock('../drawingBoard/api.js', () => ({
  loadDrawingParts: vi.fn(async () => TREE),
}))
let CTX = null
let IRON_LINES = []
vi.mock('./loadPricingContext.js', () => ({
  loadPricingContext: vi.fn(async () => CTX),
  resolveIronmongeryLines: vi.fn(() => IRON_LINES),
}))

const { priceDrawing, installResultRows } = await import('./pricingEngine.js')
const { BENCHMARK_LQ4 } = await import('./benchmarks/fixtureLiveQuotes.js')

/**
 * A fake Supabase client shaped like the real one: every builder method
 * returns the builder, the builder is thenable, and — the point — it has NO
 * `.catch`. `failInsert` makes an insert into that table come back with an
 * error, as the live NOT NULL violation did.
 */
function makeSupabase({ failInsert = null } = {}) {
  const inserted = {}
  const updated  = []        // [{ table, payload, filters }] in order
  const ops      = []        // every insert / update, in order

  const answer = (table, q) => {
    switch (table) {
      case 'price_files':            return { id: 'pf-1' }
      case 'drawings':               return { default_profile_id: 4 }
      case 'default_profiles':       return { code: 'casement' }
      // LQ4's own profile values, as the live table holds them (keyed by the
      // last segment of field_key): without the spacer the barred sash's
      // 9.21 glazing-bar glass line cannot fire, and the run is not LQ4.
      case 'default_profile_values': return Object.entries(BENCHMARK_LQ4.profileValues)
        .map(([k, v]) => ({ field_key: `x.${k}`, default_value: String(v) }))
      case 'users':                  return { id: 'user-1' }
      case 'pricing_runs':           return { id: 'run-1' }
      case 'price_file_parts':       return []
      default:                       return q._insert ?? null
    }
  }

  return {
    inserted, updated, ops,
    auth: { getUser: async () => ({ data: { user: { email: 'tests@example.com' } }, error: null }) },
    from(table) {
      const q = {
        _insert: null, _error: null, _filters: [],
        select: () => q, order: () => q, limit: () => q,
        eq: (col, val) => { q._filters.push([col, val]); return q },
        insert(payload) {
          const rows = Array.isArray(payload) ? payload : [payload]
          ops.push({ op: 'insert', table, rows })
          if (failInsert && failInsert.table === table && rows.some(failInsert.when)) {
            q._error = { message: failInsert.message }
            return q
          }
          ;(inserted[table] ??= []).push(...rows)
          q._insert = rows[0]
          return q
        },
        update(payload) {
          const rec = { table, payload, filters: q._filters }
          updated.push(rec); ops.push({ op: 'update', table, payload, rec })
          return q
        },
        maybeSingle: async () => ({ data: answer(table, q), error: q._error }),
        single:      async () => ({ data: answer(table, q), error: q._error }),
        then: (onFulfilled, onRejected) =>
          Promise.resolve({ data: q._error ? null : answer(table, q), error: q._error })
            .then(onFulfilled, onRejected),
        // deliberately no `catch`: a PostgREST builder has none
      }
      return q
    },
  }
}

const d = SNAPSHOT ? describe : describe.skip

d('Step BS follow-up — the POA labour line persists', () => {
  const labourRule = () => SNAPSHOT.rules.find(r => r.rule_family === 'price' && r.name === 'Labour')

  beforeEach(() => {
    CTX = {
      rules: SNAPSHOT.rules, pfVariables: SNAPSHOT.pfVariables,
      glassCatalogue: SNAPSHOT.glassCatalogue, partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: BENCHMARK_LQ4.partCostMap, ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
    }
    IRON_LINES = BENCHMARK_LQ4.ironmongeryLines
    TREE = BENCHMARK_LQ4.tree
  })

  it('every drawing_rule_results row has a price_rule_id — the POA line hangs off "Labour"', async () => {
    const sb = makeSupabase()
    const res = await priceDrawing(117, sb)
    expect(res.success, res.error).toBe(true)
    const rows = sb.inserted.drawing_rule_results ?? []
    expect(rows.length).toBeGreaterThan(50)
    expect(rows.filter(r => r.price_rule_id == null)).toEqual([])

    const poa = rows.filter(r => r.loop_target_type === 'drawing_poa')
    expect(poa).toHaveLength(1)
    expect(poa[0]).toMatchObject({
      price_rule_id: labourRule().id,
      cost: 180,
      quantity: 180,
      part_label: 'POA — Frame buried extra rip out time',
    })
  })

  it('the hours arithmetic is exactly as it was: 25.25 h, 1,015.30, 2,464.13', async () => {
    const sb = makeSupabase()
    await priceDrawing(117, sb)
    const vars = sb.inserted.drawing_pricing_variables[0].variables
    expect(vars.installation_labour_time).toBeCloseTo(25.25, 2)
    const complete = sb.updated.find(u => u.table === 'pricing_runs' && u.payload.status === 'complete')
    expect(complete.payload.total_cost).toBeCloseTo(2464.13, 2)
    const labour = (sb.inserted.drawing_rule_results ?? [])
      .filter(r => r.price_rule_id === labourRule().id && r.loop_target_type !== 'drawing_poa')
    expect(labour.map(r => Math.round(r.cost * 100) / 100)).toEqual([1015.30])
  })

  it('a row with no rule cannot be produced: the writer refuses it by name', () => {
    const ok = installResultRows(
      [{ fires: true, error: null, rule_id: 'r1', loop_target: null, minutes: 60, alloc_label: null }],
      { drawingId: 1, priceFileId: 'pf', pricingRunId: 'run' })
    expect(ok).toHaveLength(1)
    expect(ok[0]).toMatchObject({ price_rule_id: 'r1', cost: 60, quantity: 60 })
    expect(() => installResultRows(
      [{ fires: true, error: null, rule_id: null, loop_target: 'drawing_poa', minutes: 180, name: 'POA — x' }],
      { drawingId: 1, priceFileId: 'pf', pricingRunId: 'run' }))
      .toThrow(/POA — x.*no price rule/)
  })
})

d('Step BS follow-up — a run is never left in_progress', () => {
  beforeEach(() => {
    CTX = {
      rules: SNAPSHOT.rules, pfVariables: SNAPSHOT.pfVariables,
      glassCatalogue: SNAPSHOT.glassCatalogue, partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: BENCHMARK_LQ4.partCostMap, ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
    }
    IRON_LINES = BENCHMARK_LQ4.ironmongeryLines
    TREE = BENCHMARK_LQ4.tree
  })

  it('a thrown error marks the run FAILED with the message, and returns success false', async () => {
    const sb = makeSupabase({ failInsert: {
      table: 'drawing_rule_results',
      when: r => r.loop_target_type === 'drawing_poa',
      message: 'null value in column "price_rule_id" of relation "drawing_rule_results" violates not-null constraint',
    } })
    const res = await priceDrawing(117, sb)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/install_labour results/)
    const failed = sb.updated.find(u => u.table === 'pricing_runs' && u.payload.status === 'failed'
      && u.filters.some(([c, v]) => c === 'id' && v === 'run-1'))
    expect(failed, 'the run is marked failed').toBeTruthy()
    expect(failed.payload.warnings.join(' ')).toMatch(/not-null constraint/)
    expect(sb.updated.some(u => u.payload.status === 'complete')).toBe(false)
  })

  it('a stale in_progress run on the drawing is marked failed BEFORE the new run is made', async () => {
    const sb = makeSupabase()
    await priceDrawing(117, sb)
    const stale = sb.ops.findIndex(o => o.op === 'update' && o.table === 'pricing_runs'
      && o.payload.status === 'failed'
      && o.rec.filters.some(([c, v]) => c === 'drawing_id' && v === 117)
      && o.rec.filters.some(([c, v]) => c === 'status' && v === 'in_progress'))
    const created = sb.ops.findIndex(o => o.op === 'insert' && o.table === 'pricing_runs')
    expect(stale, 'the stale-run sweep happens').toBeGreaterThanOrEqual(0)
    expect(stale).toBeLessThan(created)
  })
})
