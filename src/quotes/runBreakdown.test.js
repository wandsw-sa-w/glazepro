/**
 * runBreakdown.test.js
 * The Price breakdown view maps STORED drawing_rule_results rows to the
 * shared PriceTable line shape — it never re-runs the engine. These tests
 * cover the mapping, the labour-row exclusion, the "detail not recorded"
 * detection for pre-step-T1 runs, and (source-level) that the view and the
 * benchmark page render through the same table component.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { buildBreakdownLines, hasRecordedDetail } from './runBreakdown.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const RULES_BY_ID = {
  r1: { id: 'r1', name: 'Square Glass Cost', group_name: 'glass_done' },
  r2: { id: 'r2', name: 'Component Cost',    group_name: 'installation_materials' },
}

describe('buildBreakdownLines', () => {
  it('maps stored rows to the PriceTable line shape', () => {
    const rows = [
      { price_rule_id: 'r1', cost: 43.88, sales: 87.75, markup_applied: 2, quantity: 0.75, value: 58.50, part_label: null, part_code: 'glassPart' },
      { price_rule_id: 'r2', cost: 10.83, sales: 21.66, markup_applied: 2, quantity: 3.8,  value: 2.85,  part_label: 'Ogee Architrave in MDF', part_code: 'TP68' },
    ]
    const lines = buildBreakdownLines(rows, RULES_BY_ID)
    expect(lines).toHaveLength(2)

    expect(lines[0]).toMatchObject({
      name: 'Square Glass Cost', group_name: 'glass_done',
      quantity: 0.75, value: 58.50, markup: 2,
      line_cost: 43.88, line_total: 87.75,
      alloc_part_code: 'glassPart', fires: true, error: null,
    })
    // Component line: the stored part_label feeds the Rule column fallback,
    // exactly as alloc_label does on the benchmark page
    expect(lines[1].alloc_label).toBe('Ogee Architrave in MDF')
    expect(lines[1].alloc_part_code).toBe('TP68')
  })

  it('excludes labour rows (sales null — they store minutes, not pounds)', () => {
    const rows = [
      { price_rule_id: 'r1', cost: 1337, sales: null, markup_applied: null },
      { price_rule_id: 'r2', cost: 10.83, sales: 21.66, markup_applied: 2 },
    ]
    const lines = buildBreakdownLines(rows, RULES_BY_ID)
    expect(lines).toHaveLength(1)
    expect(lines[0].line_total).toBe(21.66)
  })

  it('a rule missing from the price file is labelled, not dropped', () => {
    const rows = [{ price_rule_id: 'gone', cost: 5, sales: 10, markup_applied: 2 }]
    const lines = buildBreakdownLines(rows, RULES_BY_ID)
    expect(lines).toHaveLength(1)
    expect(lines[0].name).toBe('(rule no longer in price file)')
    expect(lines[0].group_name).toBeNull()
  })
})

describe('hasRecordedDetail — pre-step-T1 runs show "detail not recorded"', () => {
  it('false when no row carries quantity/value/part detail', () => {
    expect(hasRecordedDetail([
      { price_rule_id: 'r1', cost: 43.88, sales: 87.75, markup_applied: 2, quantity: null, value: null, part_label: null, part_code: null },
    ])).toBe(false)
    expect(hasRecordedDetail([])).toBe(false)
  })

  it('true when any row carries detail', () => {
    expect(hasRecordedDetail([
      { quantity: null, value: null, part_label: null, part_code: null },
      { quantity: 0.75, value: 58.5, part_label: null, part_code: null },
    ])).toBe(true)
  })
})

describe('Source-level — one table component, stored data only', () => {
  const breakdownSource = readFileSync(resolve(__dirname, '..', 'components', 'PriceBreakdown.jsx'), 'utf8')
  const benchmarkSource = readFileSync(resolve(__dirname, '..', 'pages', 'dev', 'PricingBenchmark.jsx'), 'utf8')
  const engineSource    = readFileSync(resolve(__dirname, '..', 'pricing', 'pricingEngine.js'), 'utf8')

  it('both the breakdown view and the benchmark page import the shared PriceTable', () => {
    expect(breakdownSource).toContain("from '../pricing/PriceRuleTable.jsx'")
    expect(benchmarkSource).toContain("from '../../pricing/PriceRuleTable.jsx'")
    // Neither defines its own PriceTable
    expect(breakdownSource).not.toContain('function PriceTable(')
    expect(benchmarkSource).not.toContain('function PriceTable(')
  })

  it('the breakdown view never calls the pricing engine', () => {
    expect(breakdownSource).not.toContain('runPricingOnTree')
    expect(breakdownSource).not.toContain('priceDrawing')
  })

  it('priceDrawing stores quantity, value, part_label and part_code on price rows', () => {
    expect(engineSource).toContain('quantity:         l.quantity')
    expect(engineSource).toContain('value:            l.value')
    expect(engineSource).toContain('part_label:       l.alloc_label ?? null')
    expect(engineSource).toContain('part_code:        l.alloc_part_code ?? l.alloc_iron_part_code ?? l.part_type ?? null')
  })

  it('priceDrawing stores run warnings and created_by', () => {
    expect(engineSource).toMatch(/warnings:\s+engineResults\.warnings \?\? \[\]/)
    expect(engineSource).toMatch(/created_by:\s+runUserId/)
  })
})
