/**
 * priceQuote.test.js — K2 unit tests for the quote-level pass.
 *
 * Verifies that items_net_value and nj_item_qty are populated and that
 * a quote-level rule (InstallSure-style) fires, is written to the DB,
 * and is apportioned back to the drawing's calculated_price.
 */

import { describe, it, expect, vi } from 'vitest'
import { priceQuote } from './pricingEngine.js'

// ── Supabase mock builder ────────────────────────────────────────────────────
// Each .from() call returns a new query chain whose final await resolves
// to { data, error }.  Call chain records the ops so we can verify them.

function makeSb(handlers) {
  // handlers: Map of 'table:operation' → { data, error } | fn(args) => { data, error }
  function chain(table, ops = []) {
    const proxy = new Proxy({}, {
      get(_, method) {
        if (method === 'then') {
          // awaited — resolve
          const key = `${table}:${ops.map(o => o[0]).join(',')}`
          const handler = handlers[key]
          if (typeof handler === 'function') {
            const result = handler(ops)
            return (resolve) => resolve(result)
          }
          if (handler !== undefined) return (resolve) => resolve(handler)
          // fallback — success with empty data
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
const DRAWING_ID   = 'dwg1'
const PRICE_FILE_ID = 'pf30'
const RUN_ID       = 'run1'
const QRUN_ID      = 'qrun1'
const RULE_ID      = 'rule_installsure'
const QRR_ID       = 'qrr1'

const DRAWING_NET = 1622.44

// The mock InstallSure rule: fires when nj_item_qty >= 1 and
// items_net_value <= 5000; cost/sales = £34.40
const INSTALLSURE_RULE = {
  id:        RULE_ID,
  name:      'InstallSure Up to £5,000',
  condition: 'nj_item_qty >= 1 and items_net_value <= 5000',
  quantity:  '1',
  value:     '34.40',
  markup:    1,
}

// ── Test ──────────────────────────────────────────────────────────────────────

describe('priceQuote – K2 quote-level variables', () => {
  it('adds InstallSure £34.40 for one Complete New item at £1,622.44 net', async () => {
    // Track what gets written to the DB
    const written = { qrResults: [], apportionments: [], drawnPriceUpdate: null, qrunStatus: null }

    const sb = makeSb({
      // 1. quote_drawings
      'quote_drawings:select,eq': {
        data: [{ drawing_id: DRAWING_ID, drawings: { calculated_price: DRAWING_NET } }],
        error: null,
      },

      // 2b. pricing_runs — latest run per drawing
      'pricing_runs:select,in,eq,order': {
        data: [{ id: RUN_ID, drawing_id: DRAWING_ID }],
        error: null,
      },

      // 2b. drawing_pricing_variables — typeOfWork for the run
      'drawing_pricing_variables:select,in': {
        data: [{ drawing_id: DRAWING_ID, variables: { typeOfWork: 'complete_new' } }],
        error: null,
      },

      // 3. price file already supplied — skip resolution queries

      // 4. quote_pricing_runs insert
      'quote_pricing_runs:insert,select,single': {
        data: { id: QRUN_ID },
        error: null,
      },

      // 5. price_rules for quote level
      'price_rules:select,eq,eq,eq,eq,order': {
        data: [INSTALLSURE_RULE],
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

      // 7. drawings.update (calculated_price)
      'drawings:update,eq': (ops) => {
        const upd = ops.find(([m]) => m === 'update')
        if (upd) written.drawnPriceUpdate = upd[1][0]
        return { data: null, error: null }
      },

      // 8. quote_pricing_runs.update (status complete)
      'quote_pricing_runs:update,eq': (ops) => {
        const upd = ops.find(([m]) => m === 'update')
        if (upd) written.qrunStatus = upd[1][0]
        return { data: null, error: null }
      },
    })

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

    // Drawing's calculated_price updated to 1622.44 + 34.40 = 1656.84
    expect(written.drawnPriceUpdate).toMatchObject({
      calculated_price: expect.closeTo(DRAWING_NET + 34.40, 2),
    })

    // Run marked complete
    expect(written.qrunStatus).toMatchObject({ status: 'complete' })
  })

  it('fires no rule for a Draught Seal item (nj_item_qty = 0)', async () => {
    const written = { qrResults: [] }

    const sb = makeSb({
      'quote_drawings:select,eq': {
        data: [{ drawing_id: DRAWING_ID, drawings: { calculated_price: 800 } }],
        error: null,
      },
      'pricing_runs:select,in,eq,order': {
        data: [{ id: RUN_ID, drawing_id: DRAWING_ID }],
        error: null,
      },
      'drawing_pricing_variables:select,in': {
        data: [{ drawing_id: DRAWING_ID, variables: { typeOfWork: 'draught_seal' } }],
        error: null,
      },
      'quote_pricing_runs:insert,select,single': { data: { id: QRUN_ID }, error: null },
      'price_rules:select,eq,eq,eq,eq,order': {
        data: [INSTALLSURE_RULE],
        error: null,
      },
      'quote_rule_results:insert,select,single': (ops) => {
        written.qrResults.push(ops.find(([m]) => m === 'insert')[1][0])
        return { data: { id: QRR_ID }, error: null }
      },
      'quote_item_apportionment:insert': { data: null, error: null },
      'drawings:update,eq': { data: null, error: null },
      'quote_pricing_runs:update,eq': { data: null, error: null },
    })

    const result = await priceQuote(QUOTE_ID, sb, { priceFileId: PRICE_FILE_ID })

    expect(result.success).toBe(true)
    // nj_item_qty = 0 → condition `nj_item_qty >= 1` fails → rule does not fire
    expect(written.qrResults).toHaveLength(0)
  })
})
