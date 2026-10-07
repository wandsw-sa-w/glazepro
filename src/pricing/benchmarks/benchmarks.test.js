/**
 * benchmarks.test.js — Step S pricing benchmark tests.
 *
 * Runs the pricing engine against all three fixture trees and compares
 * cost and price totals to the Integrate targets.
 */

import { describe, it, expect } from 'vitest'
import { runPricingOnTree } from '../pricingEngine.js'
import { computeDerived } from '../../drawingBoard/computeDerived.js'
import { computeVariables } from '../computeVariables.js'
import { BENCHMARK_L34046, BENCHMARK_A, BENCHMARK_B, BENCHMARK_B_UNCORRECTED } from './index.js'
import { PF30_RULES } from './pf30Rules.js'

// ── Minimal price-file variables (PF30 scalars) ────────────────────────────
const PF_VARIABLES = {
  accoya_cubic_meter: 4.65,
  decoration_labour_hourly: 42.50,
  douglas_fir_cubic_meter: 2.05,
  idigbo_cubic_meter: 3.50,
  installation_labour_hourly: 40.21,
  meranti_cubic_meter: 3.54,
  oak_cubic_meter: 7.00,
  softwood_cubic_meter: 1.25,
  special_glass: 'GL100045',
  utile: 'utile',
  utile_cubic_meter: 3.54,
  workshop_hourly_additional: 24.66,
}

// These tests verify the fixture module can be imported and the engine
// can run against each tree without errors. Exact cost/price matching
// is expected to fail until S2-S4 are implemented — the tests are
// structured to show the gap for each benchmark.

describe('Benchmark fixtures load and engine runs without errors', () => {
  it('L34046 fixture tree is valid', () => {
    const { tree } = BENCHMARK_L34046
    expect(tree).toBeTruthy()
    expect(tree.part_type).toBe('drawingItemPart')
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived, PF_VARIABLES)
    expect(vars).toBeTruthy()
    expect(vars.is_complete_new).toBe(true)
  })

  it('Benchmark A fixture tree is valid', () => {
    const { tree } = BENCHMARK_A
    expect(tree).toBeTruthy()
    expect(tree.part_type).toBe('drawingItemPart')
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived, PF_VARIABLES)
    expect(vars).toBeTruthy()
    expect(vars.is_sash_replacement).toBe(true)
    expect(vars.is_complete_new).toBe(false)
    expect(vars.frame_to_be_replaced).toBe(false)
  })

  it('Benchmark B fixture tree is valid', () => {
    const { tree } = BENCHMARK_B
    expect(tree).toBeTruthy()
    expect(tree.part_type).toBe('drawingItemPart')
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived, PF_VARIABLES)
    expect(vars).toBeTruthy()
    expect(vars.needs_draughtsealing).toBe(true)
    expect(vars.is_complete_new).toBe(false)
    expect(vars.nj_involved).toBe(false)
  })

  it('engine runs on each fixture without throwing', () => {
    // Empty rules — just verifying the engine doesn't throw
    for (const benchmark of [BENCHMARK_L34046, BENCHMARK_A, BENCHMARK_B]) {
      const results = runPricingOnTree(benchmark.tree, [], PF_VARIABLES)
      expect(results.error).toBeUndefined()
    }
  })
})

describe('Benchmark B — DSO variables are correct', () => {
  it('frame_area = 1.32 m2 for the DSO SqM Rate rule', () => {
    const { tree } = BENCHMARK_B
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived, PF_VARIABLES)
    // frame_area is the outer frame area: 1100 * 1200 / 1e6 = 1.32
    expect(vars.frame_area).toBeCloseTo(1.32, 2)
  })

  it('sliding_sash_qty=2, fixed_sliding_sash_qty=0 for DSO Extra Profits', () => {
    const { tree } = BENCHMARK_B
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived, PF_VARIABLES)
    expect(vars.sliding_sash_qty).toBe(2)
    expect(vars.fixed_sliding_sash_qty).toBe(0)
  })

  it('frame_to_be_replaced=false, needs_draughtsealing=true', () => {
    const { tree } = BENCHMARK_B
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived, PF_VARIABLES)
    expect(vars.frame_to_be_replaced).toBe(false)
    expect(vars.needs_draughtsealing).toBe(true)
    expect(vars.nj_involved).toBe(false)
  })
})

describe('Benchmark A — sash replacement variables are correct', () => {
  it('to_be_replaced=true for sashes, frame_to_be_replaced=false', () => {
    const { tree } = BENCHMARK_A
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived, PF_VARIABLES)
    expect(vars.is_sash_replacement).toBe(true)
    expect(vars.frame_to_be_replaced).toBe(false)
    expect(vars.nj_involved).toBe(true)
    expect(vars.new_sliding_sash_qty).toBe(2)
  })
})

describe('S4 — sash material rule correction', () => {
  // Fixture rules simulating the three sash material lines.
  // UNCORRECTED: no to_be_replaced condition (Integrate's original)
  // CORRECTED: with to_be_replaced condition (GlazePro's fix)

  const UNCORRECTED_RULES = [
    {
      id: 'lam_bottom', rule_family: 'price', level: 'item', is_active: true,
      group_name: 'manufacture_materials', loop_target: 'sliding_sash',
      name: 'Laminated Softwood (bottom)',
      condition: 'is_solid_redwood_sash and is_bottom_sash',
      quantity: '((gross_sash_height_in_mm + (gross_sash_width_in_mm * 1.5)) / 1000) * 1.05',
      value: '4.95', markup: 2, sort_order: 10,
    },
    {
      id: 'lam_top', rule_family: 'price', level: 'item', is_active: true,
      group_name: 'manufacture_materials', loop_target: 'sliding_sash',
      name: 'Laminated Softwood (top)',
      condition: 'is_solid_redwood_sash and is_top_sash',
      quantity: '((gross_sash_height_in_mm + (gross_sash_width_in_mm * 1)) / 1000) * 1.05',
      value: '4.95', markup: 2, sort_order: 15,
    },
    {
      id: 'glaze_bead', rule_family: 'price', level: 'item', is_active: true,
      group_name: 'manufacture_materials', loop_target: 'sliding_sash',
      name: 'Glazing Bead for Sashes',
      condition: 'not is_square_top_with_arched_sightline and not is_curved_head_sash',
      quantity: '((sash_sightline_width_in_mm + sash_sightline_height_in_mm) / 1000) * 2',
      value: '1.39', markup: 2, sort_order: 310,
    },
  ]

  const CORRECTED_RULES = UNCORRECTED_RULES.map(r => ({
    ...r,
    condition: r.condition + ' and to_be_replaced',
  }))

  it('uncorrected rules fire on DSO (Benchmark B) — all three produce cost > 0', () => {
    const { tree } = BENCHMARK_B_UNCORRECTED
    const results = runPricingOnTree(tree, UNCORRECTED_RULES, PF_VARIABLES)
    const firedLines = results.price.lines.filter(l => l.fires && !l.error)
    // All three rules should fire on both sashes (but lam_bottom only fires
    // for bottomSashPart and lam_top only for topSashPart; glaze_bead fires
    // for both). So: lam_bottom x1, lam_top x1, glaze_bead x2 = 4 fired lines.
    expect(firedLines.length).toBe(4)
    expect(results.price.total_cost).toBeGreaterThan(0)
  })

  it('corrected rules do NOT fire on DSO (Benchmark B) — cost = 0', () => {
    const { tree } = BENCHMARK_B
    const results = runPricingOnTree(tree, CORRECTED_RULES, PF_VARIABLES)
    const firedLines = results.price.lines.filter(l => l.fires && !l.error)
    // to_be_replaced=false on DSO sashes, so none of the corrected rules fire
    expect(firedLines.length).toBe(0)
    expect(results.price.total_cost).toBe(0)
  })

  it('corrected rules still fire on sash replacement (Benchmark A) — unchanged', () => {
    const { tree } = BENCHMARK_A
    const resultsUncorrected = runPricingOnTree(tree, UNCORRECTED_RULES, PF_VARIABLES)
    const resultsCorrected   = runPricingOnTree(tree, CORRECTED_RULES, PF_VARIABLES)

    // Both sashes have toBeReplaced=true, so corrected rules fire identically
    const firedUncorrected = resultsUncorrected.price.lines.filter(l => l.fires && !l.error).length
    const firedCorrected   = resultsCorrected.price.lines.filter(l => l.fires && !l.error).length
    expect(firedCorrected).toBe(firedUncorrected)
    expect(resultsCorrected.price.total_cost).toBeCloseTo(resultsUncorrected.price.total_cost, 2)
  })

  it('corrected rules still fire on complete new (L34046) — unchanged', () => {
    const { tree } = BENCHMARK_L34046
    const resultsUncorrected = runPricingOnTree(tree, UNCORRECTED_RULES, PF_VARIABLES)
    const resultsCorrected   = runPricingOnTree(tree, CORRECTED_RULES, PF_VARIABLES)

    const firedUncorrected = resultsUncorrected.price.lines.filter(l => l.fires && !l.error).length
    const firedCorrected   = resultsCorrected.price.lines.filter(l => l.fires && !l.error).length
    expect(firedCorrected).toBe(firedUncorrected)
    expect(resultsCorrected.price.total_cost).toBeCloseTo(resultsUncorrected.price.total_cost, 2)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Item 1 — Honest tests: run each benchmark against the full PF30 rule set
// and assert total cost/price to the penny plus group totals.
// S4 correction: sash material rules are gated by to_be_replaced.
// ══════════════════════════════════════════════════════════════════════════════

// Apply the S4 correction to the PF30 rules: sash material rules (sort 10, 15, 310
// in manufacture_materials) get "and to_be_replaced" appended to their condition.
const S4_SASH_MATERIAL_NAMES = [
  'Laminated Softwood for Sashes (Bottom)',
  'Laminated Softwood for Sashes (Top)',
  'Glazing Bead for Sashes',
]

const PF30_RULES_S4 = PF30_RULES.map(r => {
  if (r.rule_family === 'price' && S4_SASH_MATERIAL_NAMES.includes(r.name)) {
    return { ...r, condition: r.condition + ' and to_be_replaced' }
  }
  return r
})

// Part allocation rules for sash_windows beads (from integrate-part-allocator.txt)
const SASH_WINDOW_ALLOC_RULES = [
  {
    id: 'sw0', sort_order: 0, group_name: 'sash_windows', loop_target: 'sliding_sash',
    label: 'Staff bead for width',
    condition: 'is_small_staff_bead and not frame_to_be_replaced',
    qty_expr: 'interior_qty', part_code: 'TP01',
    measure_expr: 'round_up_to_nearest(profiled_frame_interior_width_in_mm, 100) + 100',
    is_active: true,
  },
  {
    id: 'sw1', sort_order: 1, group_name: 'sash_windows', loop_target: 'sliding_sash',
    label: 'Staff bead for height',
    condition: 'is_small_staff_bead and not frame_to_be_replaced',
    qty_expr: '1', part_code: 'TP01',
    measure_expr: 'round_up_to_nearest(profiled_frame_interior_height_in_mm, 100) + 100',
    is_active: true,
  },
  {
    id: 'sw2', sort_order: 2, group_name: 'sash_windows', loop_target: 'sliding_sash',
    label: 'Staff bead for width (large)',
    condition: 'is_large_staff_bead and not frame_to_be_replaced',
    qty_expr: 'interior_qty', part_code: 'TP02',
    measure_expr: 'round_up_to_nearest(profiled_frame_interior_width_in_mm, 100) + 100',
    is_active: true,
  },
  {
    id: 'sw3', sort_order: 3, group_name: 'sash_windows', loop_target: 'sliding_sash',
    label: 'Staff bead for height (large)',
    condition: 'is_large_staff_bead and not frame_to_be_replaced',
    qty_expr: '2', part_code: 'TP02',
    measure_expr: 'round_up_to_nearest(profiled_frame_interior_height_in_mm, 100) + 100',
    is_active: true,
  },
  {
    id: 'sw4h', sort_order: 4, group_name: 'sash_windows', loop_target: 'sliding_sash',
    label: 'Parting bead for height',
    condition: 'not frame_to_be_replaced',
    qty_expr: 'interior_qty', part_code: 'TP03',
    measure_expr: 'round_up_to_nearest(profiled_frame_interior_height_in_mm, 100) + 100',
    is_active: true,
  },
  {
    id: 'sw4w', sort_order: 4, group_name: 'sash_windows', loop_target: 'sliding_sash',
    label: 'Parting bead for width',
    condition: 'not frame_to_be_replaced',
    qty_expr: '0.5', part_code: 'TP03',
    measure_expr: 'round_up_to_nearest(profiled_frame_interior_width_in_mm, 100) + 100',
    is_active: true,
  },
]

/**
 * Helper: run a benchmark through the full PF30 engine and return results.
 */
function runBenchmark(benchmark, rules = PF30_RULES_S4) {
  return runPricingOnTree(benchmark.tree, rules, PF_VARIABLES, {
    testMode: true,  // PF30 rules are is_active=false (draft import)
    glassCatalogue: benchmark.glassCatalogue ?? {},
    partAllocationRules: SASH_WINDOW_ALLOC_RULES,
    partCostMap: benchmark.partCostMap ?? {},
    ironmongeryLines: benchmark.ironmongeryLines ?? [],
    ironmongeryCatalogue: benchmark.ironmongeryCatalogue ?? {},
  })
}

/**
 * Helper: sum cost/price by group from engine results.
 */
function groupTotals(results) {
  const groups = {}
  for (const line of results.price.lines) {
    if (!line.fires || line.error) continue
    const g = line.group_name ?? '(ungrouped)'
    if (!groups[g]) groups[g] = { cost: 0, price: 0 }
    groups[g].cost  += line.line_cost
    groups[g].price += line.line_total
  }
  // Round totals to avoid float accumulation noise
  for (const g of Object.values(groups)) {
    g.cost  = Math.round(g.cost  * 100) / 100
    g.price = Math.round(g.price * 100) / 100
  }
  return groups
}

describe('Item 1 — L34046 honest test against PF30 rules', () => {
  const results = runBenchmark(BENCHMARK_L34046)

  it('total cost matches target £1,241.58', () => {
    expect(results.price.total_cost).toBeCloseTo(BENCHMARK_L34046.targets.total_cost, 2)
  })

  it('total price matches target £2,456.25', () => {
    expect(results.price.total).toBeCloseTo(BENCHMARK_L34046.targets.total_price, 2)
  })

  it('group cost totals match targets', () => {
    const groups = groupTotals(results)
    const targets = BENCHMARK_L34046.targets.group_cost
    for (const [group, targetCost] of Object.entries(targets)) {
      expect(groups[group]?.cost ?? 0).toBeCloseTo(targetCost, 1)
    }
  })
})

describe('Item 1 — Benchmark A honest test against PF30 rules (S4 corrected)', () => {
  const results = runBenchmark(BENCHMARK_A)

  it('total cost matches target £728.26', () => {
    expect(results.price.total_cost).toBeCloseTo(BENCHMARK_A.targets.total_cost, 2)
  })

  it('total price matches target £1,408.66', () => {
    expect(results.price.total).toBeCloseTo(BENCHMARK_A.targets.total_price, 2)
  })

  it('group totals match targets', () => {
    const groups = groupTotals(results)
    const targets = BENCHMARK_A.targets.groups
    for (const [group, target] of Object.entries(targets)) {
      expect(groups[group]?.cost  ?? 0).toBeCloseTo(target.cost,  1)
      expect(groups[group]?.price ?? 0).toBeCloseTo(target.price, 1)
    }
  })
})

describe('Item 1 — Benchmark B honest test against PF30 rules (S4 corrected)', () => {
  const results = runBenchmark(BENCHMARK_B)

  it('total cost matches target £208.33', () => {
    expect(results.price.total_cost).toBeCloseTo(BENCHMARK_B.targets.total_cost, 2)
  })

  it('total price matches target £522.65', () => {
    expect(results.price.total).toBeCloseTo(BENCHMARK_B.targets.total_price, 2)
  })

  it('group totals match targets', () => {
    const groups = groupTotals(results)
    const targets = BENCHMARK_B.targets.groups
    for (const [group, target] of Object.entries(targets)) {
      expect(groups[group]?.cost  ?? 0).toBeCloseTo(target.cost,  1)
      expect(groups[group]?.price ?? 0).toBeCloseTo(target.price, 1)
    }
  })
})
