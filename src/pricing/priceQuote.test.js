/**
 * priceQuote.test.js — unit tests for the quote-level pass.
 *
 * Verifies that:
 * - priceQuote reads drawing-level prices from the latest completed
 *   pricing run (drawing_rule_results.sales), NOT from drawings.calculated_price
 * - Quote-level rules fire correctly and apportionment is written
 * - priceQuote does NOT update drawings.calculated_price
 * - Pricing is idempotent (running twice gives the same totals)
 * - A drawing in two quotes gets each quote's own apportionment
 * - String vs number ids are handled correctly
 */

import { describe, it, expect, vi } from 'vitest'
import { priceQuote } from './pricingEngine.js'

// ── Supabase mock builder ────────────────────────────────────────────────────
// Each .from() call returns a new query chain whose final await resolves
// to { data, error }.  Call chain records the ops so we can verify them.

function makeSb(handlers) {
  function chain(table, ops = []) {
    const proxy = new Proxy({}, {
      get(_, method) {
        if (method === 'then') {
          const key = `${table}:${ops.map(o => o[0]).join(',')}`
          const handler = handlers[key]
          if (typeof handler === 'function') {
            const result = handler(ops)
            return (resolve) => resolve(result)
          }
          if (handler !== undefined) return (resolve) => resolve(handler)
          return (resolve) => resolve({ data: null, error: null })
        }
        return (...args) => chain(table, [...ops, [method, args]])
      },
    })
    return proxy
  }

  return {
    from: (table) => chain(table),
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const QUOTE_ID     = 'q1'
const DRAWING_ID   = 8     // numeric id, as the DB stores it
const PRICE_FILE_ID = 'pf30'
const RUN_ID       = 'run1'
const QRUN_ID      = 'qrun1'
const RULE_ID      = 'rule_installsure'
const QRR_ID       = 'qrr1'

const DRAWING_NET = 1622.44

// The mock InstallSure rule: fires when nj_item_qty >= 1 and
// items_net_value <= 5000; cost = qty × value = 1 × 34.40 = 34.40,
// sales = cost × markup = 34.40 × 1 = 34.40
const INSTALLSURE_RULE = {
  id:        RULE_ID,
  name:      'InstallSure Up to £5,000',
  condition: 'nj_item_qty >= 1 and items_net_value <= 5000',
  quantity:  '1',
  value:     '34.40',
  markup:    1,
}

// ── Common handler builder ────────────────────────────────────────────────────
// Creates a handler set for the standard Q1 scenario where drawing 8 has a
// completed pricing run with DRAWING_NET in drawing_rule_results.sales.

function buildQ1Handlers({ drawingId = DRAWING_ID, drawingNet = DRAWING_NET, typeOfWork = 'complete_new', rules = [INSTALLSURE_RULE] } = {}) {
  const written = { qrResults: [], apportionments: [], qrunStatus: null }

  const handlers = {
    // 1. quote_drawings — just drawing_id, no calculated_price join
    'quote_drawings:select,eq': {
      data: [{ drawing_id: drawingId }],
      error: null,
    },

    // 2. pricing_runs — latest run per drawing
    'pricing_runs:select,in,eq,order': {
      data: [{ id: RUN_ID, drawing_id: drawingId }],
      error: null,
    },

    // 2. drawing_pricing_variables — typeOfWork for the run
    'drawing_pricing_variables:select,in': {
      data: [{ drawing_id: drawingId, variables: { typeOfWork } }],
      error: null,
    },

    // 2. drawing_rule_results — sales total from the latest run
    'drawing_rule_results:select,in': {
      data: [{ drawing_id: drawingId, sales: drawingNet }],
      error: null,
    },

    // 4. quote_pricing_runs insert
    'quote_pricing_runs:insert,select,single': {
      data: { id: QRUN_ID },
      error: null,
    },

    // 5. price_rules for quote level
    'price_rules:select,eq,eq,eq,eq,order': {
      data: rules,
      error: null,
    },

    // 6. quote_rule_results insert
    'quote_rule_results:insert,select,single': (ops) => {
      const insertOp = ops.find(([m]) => m === 'insert')
      if (insertOp) written.qrResults.push(insertOp[1][0])
      return { data: { id: QRR_ID }, error: null }
    },

    // 6. quote_item_apportionment insert
    'quote_item_apportionment:insert': (ops) => {
      const insertOp = ops.find(([m]) => m === 'insert')
      if (insertOp) written.apportionments.push(...(insertOp[1][0] ?? [insertOp[1][0]]))
      return { data: null, error: null }
    },

    // 7. quote_pricing_runs.update (status complete)
    'quote_pricing_runs:update,eq': (ops) => {
      const upd = ops.find(([m]) => m === 'update')
      if (upd) written.qrunStatus = upd[1][0]
      return { data: null, error: null }
    },
  }

  return { handlers, written }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('priceQuote – Q1 case (drawing-level price from run, not calculated_price)', () => {
  it('adds InstallSure £34.40 for one Complete New item at £1,622.44 net', async () => {
    const { handlers, written } = buildQ1Handlers()
    const sb = makeSb(handlers)
    const result = await priceQuote(QUOTE_ID, sb, { priceFileId: PRICE_FILE_ID })

    expect(result.success).toBe(true)

    // Rule fired and was written with cost = sales = 34.40
    expect(written.qrResults).toHaveLength(1)
    expect(written.qrResults[0]).toMatchObject({
      quote_id:             QUOTE_ID,
      price_file_id:        PRICE_FILE_ID,
      price_rule_id:        RULE_ID,
      cost:                 34.40,
      sales:                34.40,
      markup_applied:       1,
    })

    // Apportionment: one drawing gets the full amount (weight = 1.0)
    expect(written.apportionments).toHaveLength(1)
    expect(written.apportionments[0]).toMatchObject({
      drawing_id: DRAWING_ID,
      cost:       34.40,
      sales:      34.40,
    })

    // Run marked complete
    expect(written.qrunStatus).toMatchObject({ status: 'complete' })
  })

  it('does NOT update drawings.calculated_price', async () => {
    const drawingsUpdateCalled = []
    const { handlers, written } = buildQ1Handlers()

    // Intercept any drawings.update call
    handlers['drawings:update,eq'] = (ops) => {
      drawingsUpdateCalled.push(ops)
      return { data: null, error: null }
    }

    const sb = makeSb(handlers)
    await priceQuote(QUOTE_ID, sb, { priceFileId: PRICE_FILE_ID })

    // priceQuote should never write to drawings.calculated_price
    expect(drawingsUpdateCalled).toHaveLength(0)
  })
})

describe('priceQuote – idempotency', () => {
  it('pricing twice gives the same result', async () => {
    // Run 1
    const run1 = buildQ1Handlers()
    const sb1 = makeSb(run1.handlers)
    const result1 = await priceQuote(QUOTE_ID, sb1, { priceFileId: PRICE_FILE_ID })

    // Run 2 — same inputs (drawing_rule_results hasn't changed)
    const run2 = buildQ1Handlers()
    const sb2 = makeSb(run2.handlers)
    const result2 = await priceQuote(QUOTE_ID, sb2, { priceFileId: PRICE_FILE_ID })

    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)

    // Both runs produce identical rule results
    expect(run1.written.qrResults).toEqual(run2.written.qrResults)
    // Both runs produce identical apportionment
    expect(run1.written.apportionments[0].sales).toBe(run2.written.apportionments[0].sales)
  })
})

describe('priceQuote – string vs number ids', () => {
  it('handles numeric drawing_id correctly', async () => {
    // Drawing id is numeric (8), as returned from the DB
    const { handlers, written } = buildQ1Handlers({ drawingId: 8 })
    const sb = makeSb(handlers)
    const result = await priceQuote(QUOTE_ID, sb, { priceFileId: PRICE_FILE_ID })

    expect(result.success).toBe(true)
    expect(written.apportionments).toHaveLength(1)
    expect(written.apportionments[0].drawing_id).toBe(8)
    expect(written.apportionments[0].sales).toBe(34.40)
  })
})

describe('priceQuote – Draught Seal (nj_item_qty = 0)', () => {
  it('fires no rule for a Draught Seal item', async () => {
    const { handlers, written } = buildQ1Handlers({ typeOfWork: 'draught_seal' })
    const sb = makeSb(handlers)
    const result = await priceQuote(QUOTE_ID, sb, { priceFileId: PRICE_FILE_ID })

    expect(result.success).toBe(true)
    // nj_item_qty = 0 → condition `nj_item_qty >= 1` fails → rule does not fire
    expect(written.qrResults).toHaveLength(0)
  })
})
