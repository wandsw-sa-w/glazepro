/**
 * runPricingOnTree.test.js — Step J/K fixes round 3, item 2.
 *
 * Cost was being shown as the sum of ALL drawing_rule_results.cost for a
 * run, including manufacture_labour/install_labour rows — those store
 * `cost: minutes` (literally the rule's minutes value), not pounds, so a
 * run with large labour minutes showed a wildly inflated "cost" next to a
 * much smaller sales figure.
 *
 * runPricingOnTree itself was never the bug: it already keeps labour and
 * price results in separate buckets (results.manufacture_labour,
 * results.install_labour, results.price) and results.price.total_cost
 * only ever sums price-rule lines. This test pins that down directly, so
 * if a future change accidentally folds labour into results.price, it
 * fails here instead of only showing up as a wrong number on screen.
 * (The actual fix in this round is persisting results.price.total_cost
 * onto pricing_runs.total_cost — see src/quotes/drawingRunPrice.js and
 * sql/step-l2-pricing-run-totals.sql — instead of re-deriving cost by
 * summing drawing_rule_results unfiltered, which is what reintroduced
 * the minutes-as-pounds bug in the UI.)
 */

import { describe, it, expect } from 'vitest'
import { runPricingOnTree } from './pricingEngine.js'

// ── Minimal valid box sash tree (same shape as computeVariables.test.js's
// makeBoxSashTree — just enough for computeVariables to succeed) ──────────

function makeTree() {
  return {
    key: 'item1', part_type: 'drawingItemPart',
    values: {
      typeOfWork: 'complete_new', frameMaterialId: 'solid_redwood', sashMaterialId: 'solid_redwood',
      cillMaterialId: 'solid_utile_hardwood', fitToPreparedOpening: false, decoration: false,
    },
    children: [
      { key: 'paint1', part_type: 'paintAndIronmongeryPart', values: { internalFinish: 'clean_white', externalFinish: 'clean_white', cillFinish: 'clean_white' }, children: [] },
      {
        key: 'frame1', part_type: 'assemblyFramePart',
        values: { width: 1075, height: 1630, topHeight: 79, leftWidth: 85, rightWidth: 85, frameDepth: 165, jambType: 'solid_profiled', leftOuterJamb: 101, rightOuterJamb: 101, leftCillHorn: 50, rightCillHorn: 50 },
        children: [
          { key: 'cill1', part_type: 'cillPart', values: { height: 70, depth: 200 }, children: [] },
          {
            key: 'pair1', part_type: 'sashPairPart',
            values: { sashThickness: 45, midrailHeight: 40, mechanicalClearanceLeft: 2.5, mechanicalClearanceRight: 2.5, mechanicalClearanceTop: 0, mechanicalClearanceBottom: 0, topHornTypeShortName: 'victorian', bottomHornTypeShortName: 'none', sashSplit: 'half_half' },
            children: [
              {
                key: 'top1', part_type: 'topSashPart',
                values: { topHeight: 49, leftWidth: 47, rightWidth: 47, operation: 'cord_hung', toBeReplaced: null },
                children: [{ key: 'glass1', part_type: 'glassPart', values: { glazingId: 'double_glazed', isIndividualPanes: false, spacerDimId: '16mm_white_warm_edge' }, children: [] }],
              },
              {
                key: 'bot1', part_type: 'bottomSashPart',
                values: { bottomHeight: 88, leftWidth: 47, rightWidth: 47, operation: 'cord_hung', toBeReplaced: null },
                children: [{ key: 'glass2', part_type: 'glassPart', values: { glazingId: 'double_glazed', isIndividualPanes: false, spacerDimId: '16mm_white_warm_edge' }, children: [] }],
              },
            ],
          },
        ],
      },
    ],
  }
}

// One rule per family, each unconditional (loop_target null -> fires once
// at item level) so the test doesn't depend on tree-walking specifics.
const MFG_RULE = { id: 'mfg1', rule_family: 'manufacture_labour', is_active: true, condition: 'true', quantity: '1', value: '1337', loop_target: null }
const INST_RULE = { id: 'inst1', rule_family: 'install_labour', is_active: true, condition: 'true', quantity: '1', value: '450', loop_target: null }
const PRICE_RULE = { id: 'price1', rule_family: 'price', level: 'item', is_active: true, condition: 'true', quantity: '1', value: '820.11', markup: 1, loop_target: null }

describe('runPricingOnTree — cost excludes labour minutes (item 2)', () => {
  it('results.price.total_cost reflects only the price rule, not the 1,787 labour minutes', () => {
    const tree = makeTree()
    const results = runPricingOnTree(tree, [MFG_RULE, INST_RULE, PRICE_RULE], {})

    expect(results.error).toBeUndefined()
    expect(results.manufacture_labour.total_minutes).toBe(1337)
    expect(results.install_labour.total_minutes).toBe(450)

    // The price-rule-only total — this is what gets persisted as
    // pricing_runs.total_cost / total_sales.
    expect(results.price.total_cost).toBeCloseTo(820.11, 2)
    expect(results.price.total).toBeCloseTo(820.11, 2)

    // Labour minutes must never leak into the cost total (the actual bug:
    // summing drawing_rule_results.cost across all rows, unfiltered, would
    // have given 820.11 + 1337 + 450 = 2607.11 here).
    expect(results.price.total_cost).not.toBeCloseTo(820.11 + 1337 + 450, 2)
  })

  it('a run with price rules only (no labour fired) has cost well below a realistic sales figure', () => {
    // Mirrors "drawing 8's cost comes out well below its £1,622.44 sales":
    // cost is typically well under half of sales once markup is applied.
    const tree = makeTree()
    const sellsAt1622 = { id: 'price2', rule_family: 'price', level: 'item', is_active: true, condition: 'true', quantity: '1', value: '740.50', markup: 2.191, loop_target: null }
    const results = runPricingOnTree(tree, [MFG_RULE, INST_RULE, sellsAt1622], {})

    expect(results.price.total).toBeCloseTo(1622.44, 1)
    expect(results.price.total_cost).toBeLessThan(results.price.total)
    expect(results.price.total_cost).toBeCloseTo(740.50, 2)
  })

  it('an inactive labour rule contributes nothing, confirming is_active gating is independent of the cost fix', () => {
    const tree = makeTree()
    const inactiveMfg = { ...MFG_RULE, is_active: false }
    const results = runPricingOnTree(tree, [inactiveMfg, PRICE_RULE], {})
    expect(results.manufacture_labour.total_minutes).toBe(0)
    expect(results.price.total_cost).toBeCloseTo(820.11, 2)
  })
})
