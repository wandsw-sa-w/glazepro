/**
 * priceDrawingProfile.test.js — Step AZ hotfix item 1
 *
 * A LIVE door priced no timber. priceDrawing loads the drawing's
 * default_profile_id for the profile VALUES but never resolves the profile
 * CODE, and called runPricingOnTree without `profileCode`. computeVariables
 * derives is_single_and_french_doors_range, is_open_in_doors_range and
 * is_replacement_sashes_range from that code alone, so on EVERY drawing priced
 * through priceDrawing all three were false — and the live rule
 * "Utile Section Part" needs the first one.
 *
 * Every test and the benchmark page passed the code explicitly, which is
 * exactly why nothing caught it. These tests go through priceDrawing itself,
 * against a mock Supabase client, and assert on what it WRITES: the price rows
 * and the stored variable snapshot.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = resolve(HERE, 'benchmarks/pf30-snapshot.json')
const SNAPSHOT = existsSync(SNAPSHOT_PATH)
  ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
  : null

// The drawing tree priceDrawing is given. Mocked at the module level because
// loadDrawingParts uses api.js's own Supabase client, not the injected one.
let TREE = null
vi.mock('../drawingBoard/api.js', () => ({
  loadDrawingParts: vi.fn(async () => TREE),
}))

// The pricing context. The real loader reads a dozen tables; this step is
// about the profile CODE, so the context is handed over whole.
let CTX = null
let IRON_LINES = []
vi.mock('./loadPricingContext.js', () => ({
  loadPricingContext: vi.fn(async () => CTX),
  resolveIronmongeryLines: vi.fn(() => IRON_LINES),
}))

const { priceDrawing } = await import('./pricingEngine.js')
const { BENCHMARK_FD1, DOOR_PART_COST_MAP } = await import('./benchmarks/fixtureDoor.js')
const { BENCHMARK_L34046 } = await import('./benchmarks/index.js')

const PROFILE_ID = 4

// default_profile_values rows as the live table holds them: priceDrawing keys
// them by the LAST segment of field_key, which is what the sash-weight model
// reads. A box-sash drawing cannot price without the glass cut size.
const SASH_PROFILE_VALUE_ROWS = [
  { field_key: 'glassPart.defaultDoubleGlazingRebateWidthForSash', default_value: '14' },
  { field_key: 'glassPart.defaultDoubleGlazingTolerance',          default_value: '2' },
]

/**
 * A mock Supabase client that answers the queries priceDrawing makes and
 * records every insert and update, so a test can read back what was written.
 */
function makeSupabase({ profileCode, profileValueRows = [] }) {
  const inserted = {}
  const updated  = {}

  const answer = (table, q) => {
    switch (table) {
      case 'price_files':            return { id: 'pf-1' }
      case 'drawings':               return { default_profile_id: PROFILE_ID }
      case 'default_profiles':       return profileCode === undefined ? null : { code: profileCode }
      case 'default_profile_values': return profileValueRows
      case 'users':                  return { id: 'user-1' }
      case 'pricing_runs':           return { id: 'run-1' }
      case 'price_file_parts':       return []
      default:                       return q._insert ?? null
    }
  }

  const client = {
    inserted,
    updated,
    auth: {
      getUser: async () => ({ data: { user: { email: 'tests@example.com' } }, error: null }),
    },
    from(table) {
      const q = {
        _insert: null,
        select: () => q,
        eq:     () => q,
        order:  () => q,
        limit:  () => q,
        insert(payload) {
          const rows = Array.isArray(payload) ? payload : [payload]
          ;(inserted[table] ??= []).push(...rows)
          q._insert = rows[0]
          return q
        },
        update(payload) {
          ;(updated[table] ??= []).push(payload)
          return q
        },
        maybeSingle: async () => ({ data: answer(table, q), error: null }),
        single:      async () => ({ data: answer(table, q), error: null }),
        then: (onFulfilled, onRejected) =>
          Promise.resolve({ data: answer(table, q), error: null }).then(onFulfilled, onRejected),
        catch: () => q,
      }
      return q
    },
  }
  return client
}

/** The variable snapshot priceDrawing stored. */
const storedVariables = sb => sb.inserted.drawing_pricing_variables?.[0]?.variables ?? null

/** The price rows it wrote, as [part_code, cost]. */
const pricedParts = sb => (sb.inserted.drawing_rule_results ?? [])
  .filter(r => r.part_code)
  .map(r => [r.part_code, r.cost])

const d = SNAPSHOT ? describe : describe.skip

d('Step AZ hotfix — priceDrawing passes the drawing’s profile code', () => {
  beforeEach(() => {
    CTX = {
      rules:               SNAPSHOT.rules,
      pfVariables:         SNAPSHOT.pfVariables,
      glassCatalogue:      SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      // The live catalogue holds the Utile sections and the lock parts since
      // sql/step-az1 ran (13 Oct), so the context carries their costs.
      partCostMap:         { ...SNAPSHOT.partCostMap, ...DOOR_PART_COST_MAP },
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
    }
    IRON_LINES = []
    TREE = null
  })

  it('a door priced through priceDrawing gets its Utile Section Part lines', async () => {
    // THE LIVE BUG. Drawing 25 — FD1's tree, profile open_out_doors — priced
    // manufacture_materials 25.00 (LTW alone) instead of 395.95, because
    // "Utile Section Part" is conditioned on
    // (is_single_and_french_doors_range or is_open_in_doors_range).
    TREE = BENCHMARK_FD1.tree
    IRON_LINES = BENCHMARK_FD1.ironmongeryLines
    const sb = makeSupabase({ profileCode: 'open_out_doors' })

    const result = await priceDrawing('drawing-25', sb)
    expect(result.success, result.error).toBe(true)

    const sections = pricedParts(sb).filter(([code]) => String(code).startsWith('Utile'))
    expect(sections.length, 'Utile Section Part lines written').toBe(3)
    expect(sections.reduce((t, [, cost]) => t + cost, 0)).toBeCloseTo(370.95, 2)
  })

  it('the stored variable snapshot carries the range flags, not false', async () => {
    // The reviewer read is_single_and_french_doors_range: false off the
    // STORED variables of a drawing whose profile is open_out_doors. The
    // snapshot is written from its own computeVariables call, which also had
    // no profile code — so both had to be fixed, not just the pricing one.
    TREE = BENCHMARK_FD1.tree
    IRON_LINES = BENCHMARK_FD1.ironmongeryLines
    const sb = makeSupabase({ profileCode: 'open_out_doors' })

    await priceDrawing('drawing-25', sb)
    const vars = storedVariables(sb)
    expect(vars, 'drawing_pricing_variables row').toBeTruthy()
    expect(vars.is_single_and_french_doors_range).toBe(true)
    expect(vars.is_open_in_doors_range).toBe(false)
    expect(vars.is_door).toBe(true)
  })

  it('a sashes_only drawing gets is_replacement_sashes_range', async () => {
    // Step AY item 4's variable, wired the same way and broken the same way.
    TREE = BENCHMARK_L34046.tree
    const sb = makeSupabase({
      profileCode: 'sashes_only', profileValueRows: SASH_PROFILE_VALUE_ROWS,
    })

    const result = await priceDrawing('drawing-sashes', sb)
    expect(result.success, result.error).toBe(true)
    expect(storedVariables(sb).is_replacement_sashes_range).toBe(true)
  })

  it('a drawing whose profile cannot be read still prices, with the flags false', async () => {
    // loadDrawingProfileCode returns null rather than throwing, and this path
    // has to behave the same way: no profile row is not a pricing failure.
    TREE = BENCHMARK_L34046.tree
    const sb = makeSupabase({
      profileCode: undefined, profileValueRows: SASH_PROFILE_VALUE_ROWS,
    })

    const result = await priceDrawing('drawing-no-profile', sb)
    expect(result.success, result.error).toBe(true)
    expect(storedVariables(sb).is_replacement_sashes_range).toBe(false)
  })
})

/**
 * The default-ironmongery path takes the same variables, from its own
 * computeVariables call inside resolveIronmongeryLines. No LIVE
 * default-ironmongery rule reads a range variable today — "Utile Section
 * Part" is the only live rule that does — so this uses a rule of its own to
 * hold the wiring. Without it, the next rule Nathan writes on a range
 * variable would be silently dead on every real drawing, exactly as the
 * Utile one was.
 */
describe('Step AZ hotfix — the default ironmongery path takes the profile code too', () => {
  const RANGE_RULE = [{
    id: 'test-range-rule',
    sort_order: 1,
    group_name: 'test',
    loop_target: null,
    label: 'door range probe',
    condition: 'is_single_and_french_doors_range',
    qty_expr: '1',
    product_short_name: 'trickle_vent_xr16',
    finish_code: 'Wht',
    is_active: true,
  }]

  it('a default-ironmongery rule conditioned on the door range fires', async () => {
    const { resolveIronmongeryLines } = await vi.importActual('./loadPricingContext.js')
    // A tree with NO stored ironmongery: tree-saved lines win over the
    // default rules, and a door built from the live template has none.
    const tree = JSON.parse(JSON.stringify(BENCHMARK_FD1.tree))
    for (const child of tree.children ?? []) {
      if (child.part_type === 'paintAndIronmongeryPart') delete child.values.ironmongeryLines
    }
    const ctx = { pfVariables: {}, ironmongeryRules: RANGE_RULE, glassCatalogue: {}, ironmongeryCatalogue: {} }

    const withCode = resolveIronmongeryLines(tree, ctx, {}, { profileCode: 'open_out_doors' })
    expect(withCode.map(l => l.product_short_name)).toEqual(['trickle_vent_xr16'])

    // and stays silent without one, which is what a sash drawing's profile does
    const withoutCode = resolveIronmongeryLines(tree, ctx, {}, {})
    expect(withoutCode).toEqual([])
  })
})
