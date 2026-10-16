/**
 * priceDrawingPersistence.test.js — Step BS follow-ups 1 and 2
 *
 * Follow-up 1: drawing 117 saved its 180-minute POA line and then could not
 * be PRICED — the breakdown line had no rule behind it (price_rule_id NOT
 * NULL), and the failure path called `.catch()` on a PostgREST builder, which
 * has none, so the run was never marked failed.
 *
 * Follow-up 2: the fix wrote the POA line under the Labour PRICE rule's id
 * with its MINUTES in `cost` (quantity 180, cost 180, sales null), so the
 * Labour rule's rows summed to 1,195.30 against a group of 1,015.30. The
 * rows now mirror Integrate's labour editor: the plain Labour row carries
 * the fitting-units hours (22.25 h / 894.67) and the POA row its own
 * (3.00 h / 120.63), both value 40.21 markup 2, summing to the group.
 *
 * The offline suite never persisted a run, which is why none of this was
 * seen. These tests go through priceDrawing against a fake client shaped
 * like the real one — thenable, with NO `.catch` — and assert on what is
 * written; the last describe does it for EVERY benchmark fixture.
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

const { priceDrawing, installResultRows, runPricingOnTree } = await import('./pricingEngine.js')
const LQ  = await import('./benchmarks/fixtureLiveQuotes.js')
const ALL = await import('./benchmarks/index.js')
const { BENCHMARK_LQ4 } = LQ

/**
 * A fake Supabase client shaped like the real one: every builder method
 * returns the builder, the builder is thenable, and — the point — it has NO
 * `.catch`. `failInsert` makes an insert into that table come back with an
 * error, as the live NOT NULL violation did. The profile code and values are
 * the fixture's, served as the live tables hold them.
 */
function makeSupabase({ failInsert = null, profileCode = 'casement', profileValues = {} } = {}) {
  const inserted = {}
  const updated  = []        // [{ table, payload, filters }] in order
  const ops      = []        // every insert / update, in order

  const answer = (table, q) => {
    switch (table) {
      case 'price_files':            return { id: 'pf-1' }
      case 'drawings':               return { default_profile_id: 4 }
      case 'default_profiles':       return { code: profileCode }
      // keyed by the LAST segment of field_key, as priceDrawing reads them
      case 'default_profile_values': return Object.entries(profileValues)
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
const r2 = x => Math.round(x * 100) / 100

const PRICE_RULE_IDS = new Set((SNAPSHOT?.rules ?? []).filter(r => r.rule_family === 'price').map(r => r.id))
const ruleById = id => (SNAPSHOT?.rules ?? []).find(r => r.id === id)
const labourRule = () => SNAPSHOT.rules.find(r => r.rule_family === 'price' && r.name === 'Labour')

function useFixture(bm) {
  CTX = {
    rules: SNAPSHOT.rules, pfVariables: SNAPSHOT.pfVariables,
    glassCatalogue: SNAPSHOT.glassCatalogue, partAllocationRules: SNAPSHOT.partAllocationRules,
    partCostMap: bm.partCostMap ?? {}, ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
  }
  IRON_LINES = bm.ironmongeryLines ?? []
  TREE = bm.tree
  return makeSupabase({ profileCode: bm.profileCode ?? 'casement', profileValues: bm.profileValues ?? {} })
}

/** The price rows (a price rule's) and the minutes rows (a labour rule's) a run wrote. */
const priceRows   = sb => (sb.inserted.drawing_rule_results ?? []).filter(r => PRICE_RULE_IDS.has(r.price_rule_id))
const minutesRows = sb => (sb.inserted.drawing_rule_results ?? []).filter(r => !PRICE_RULE_IDS.has(r.price_rule_id))

d('Step BS follow-up 2 — the POA labour row is hours and pounds, and the rows add up', () => {
  beforeEach(() => useFixture(BENCHMARK_LQ4))

  it('the Labour rule has two rows: the fitting units, and the POA line in hours', async () => {
    const sb = useFixture(BENCHMARK_LQ4)
    const res = await priceDrawing(117, sb)
    expect(res.success, res.error).toBe(true)
    const labour = priceRows(sb).filter(r => r.price_rule_id === labourRule().id)
      .map(r => ({ q: r.quantity, v: r.value, cost: r.cost, sales: r.sales, m: r.markup_applied,
        label: r.part_label, loop: r.loop_target_type }))
    expect(labour).toEqual([
      { q: 22.25, v: 40.21, cost: 894.67, sales: 1789.35, m: 2, label: null, loop: null },
      { q: 3,     v: 40.21, cost: 120.63, sales: 241.26,  m: 2,
        label: 'POA — Frame buried extra rip out time (180 min)', loop: 'drawing_poa' },
    ])
    // and they sum to the group, which is Integrate's single Labour line
    expect(r2(labour.reduce((n, r) => n + r.cost, 0))).toBe(1015.30)
    expect(r2(labour.reduce((n, r) => n + r.sales, 0))).toBe(2030.61)
  })

  it('no minutes are stored as pounds: every price-rule row has numeric cost AND sales', async () => {
    const sb = useFixture(BENCHMARK_LQ4)
    await priceDrawing(117, sb)
    for (const row of priceRows(sb)) {
      expect(typeof row.cost, JSON.stringify(row)).toBe('number')
      expect(typeof row.sales, JSON.stringify(row)).toBe('number')
    }
    // the minutes rows belong to labour-family rules only, never to a price rule
    for (const row of minutesRows(sb)) {
      expect(ruleById(row.price_rule_id)?.rule_family, JSON.stringify(row)).toMatch(/_labour$/)
      expect(row.sales).toBe(null)
    }
    // the POA minutes line is in the engine's breakdown, not in the table
    expect(minutesRows(sb).filter(r => r.loop_target_type === 'drawing_poa')).toEqual([])
  })

  it('the hours are as they were: installation_labour_time 25.25, total 2,464.13', async () => {
    const sb = useFixture(BENCHMARK_LQ4)
    await priceDrawing(117, sb)
    expect(sb.inserted.drawing_pricing_variables[0].variables.installation_labour_time).toBeCloseTo(25.25, 2)
    expect(sb.inserted.drawing_pricing_variables[0].variables.total_install_minutes).toBe(1515)
    const complete = sb.updated.find(u => u.table === 'pricing_runs' && u.payload.status === 'complete')
    expect(complete.payload.total_cost).toBeCloseTo(2464.13, 2)
    expect(complete.payload.total_sales).toBeCloseTo(4928.27, 2)
  })

  it('the engine’s own breakdown shows the same two Labour lines', () => {
    const r = runPricingOnTree(BENCHMARK_LQ4.tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue, partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: BENCHMARK_LQ4.partCostMap, ironmongeryLines: BENCHMARK_LQ4.ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue, profileValues: BENCHMARK_LQ4.profileValues,
    })
    const labour = r.price.lines.filter(l => l.fires && l.name === 'Labour')
      .map(l => [l.alloc_label, l.quantity, l.line_cost, l.line_total])
    expect(labour).toEqual([
      [null, 22.25, 894.67, 1789.35],
      ['POA — Frame buried extra rip out time (180 min)', 3, 120.63, 241.26],
    ])
    expect(r.install_labour.total_minutes / 60).toBeCloseTo(25.25, 2)
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
  beforeEach(() => useFixture(BENCHMARK_LQ4))

  it('a thrown error marks the run FAILED with the message, and returns success false', async () => {
    const sb = makeSupabase({
      profileCode: 'casement', profileValues: BENCHMARK_LQ4.profileValues,
      failInsert: {
        table: 'drawing_rule_results',
        when: r => r.loop_target_type === 'drawing_poa',
        message: 'null value in column "price_rule_id" of relation "drawing_rule_results" violates not-null constraint',
      } })
    const res = await priceDrawing(117, sb)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/results/)
    const failed = sb.updated.find(u => u.table === 'pricing_runs' && u.payload.status === 'failed'
      && u.filters.some(([c, v]) => c === 'id' && v === 'run-1'))
    expect(failed, 'the run is marked failed').toBeTruthy()
    expect(failed.payload.warnings.join(' ')).toMatch(/not-null constraint/)
    expect(sb.updated.some(u => u.payload.status === 'complete')).toBe(false)
  })

  it('a stale in_progress run on the drawing is marked failed BEFORE the new run is made', async () => {
    const sb = useFixture(BENCHMARK_LQ4)
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

// ── Every benchmark fixture: the rows a run writes add up to what it reports ──

d('Step BS follow-up 2 — persisted rows sum to the engine’s groups, on every fixture', () => {
  const fixtures = Object.entries({ ...ALL, ...LQ })
    .filter(([name, bm]) => name.startsWith('BENCHMARK_') && bm?.tree)

  it('there are fixtures to check', () => {
    expect(fixtures.length).toBeGreaterThan(40)
  })

  for (const [name, bm] of fixtures) {
    it(`${name}: every price row is pounds, and the rows per group sum to the run`, async () => {
      const sb = useFixture(bm)
      const res = await priceDrawing(1, sb)

      // what the engine reports for the same inputs priceDrawing was given
      const engineRun = () => runPricingOnTree(bm.tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
        glassCatalogue: SNAPSHOT.glassCatalogue, partAllocationRules: SNAPSHOT.partAllocationRules,
        partCostMap: bm.partCostMap ?? {}, ironmongeryLines: bm.ironmongeryLines ?? [],
        ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue, profileValues: bm.profileValues ?? {},
        profileCode: bm.profileCode ?? null,
      })
      if (!res.success) {
        // A fixture the ENGINE cannot price (B_UNCORRECTED carries no profile
        // values, so the sash-weight model throws) is not a persistence
        // failure: the same inputs must throw the same way outside
        // priceDrawing, and the run must have been marked failed.
        expect(engineRun, `${name}: ${res.error}`).toThrow(res.error)
        expect(sb.updated.some(u => u.table === 'pricing_runs' && u.payload.status === 'failed')).toBe(true)
        return
      }
      const engine = engineRun()
      const engineGroups = {}
      for (const l of engine.price.lines) {
        if (!l.fires || l.error) continue
        const g = l.group_name ?? '(ungrouped)'
        engineGroups[g] = r2((engineGroups[g] ?? 0) + l.line_cost)
      }

      const rowGroups = {}
      for (const row of priceRows(sb)) {
        expect(typeof row.cost,  `${name} ${row.part_label ?? ''} cost`).toBe('number')
        expect(typeof row.sales, `${name} ${row.part_label ?? ''} sales`).toBe('number')
        const g = ruleById(row.price_rule_id)?.group_name ?? '(ungrouped)'
        rowGroups[g] = r2((rowGroups[g] ?? 0) + row.cost)
      }
      expect(rowGroups).toEqual(engineGroups)

      // the minutes rows are the labour families', never a price rule's
      for (const row of minutesRows(sb)) {
        expect(ruleById(row.price_rule_id)?.rule_family, `${name} minutes row`).toMatch(/_labour$/)
      }

      // and the run header is the rows
      const complete = sb.updated.find(u => u.table === 'pricing_runs' && u.payload.status === 'complete')
      expect(r2(priceRows(sb).reduce((n, r) => n + r.cost, 0))).toBeCloseTo(complete.payload.total_cost, 2)
    })
  }
})
