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
import { componentLengthMetres, runPricingOnTree } from './pricingEngine.js'
// Profile rebate/tolerance for the measured sash-weight glass cut (Sash profile: 14 / 2)
const PV = { defaultDoubleGlazingRebateWidthForSash: 14, defaultDoubleGlazingTolerance: 2 }

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
    const results = runPricingOnTree(tree, [MFG_RULE, INST_RULE, PRICE_RULE], {}, { profileValues: PV })

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
    const results = runPricingOnTree(tree, [MFG_RULE, INST_RULE, sellsAt1622], {}, { profileValues: PV })

    expect(results.price.total).toBeCloseTo(1622.44, 1)
    expect(results.price.total_cost).toBeLessThan(results.price.total)
    expect(results.price.total_cost).toBeCloseTo(740.50, 2)
  })

  it('an inactive labour rule contributes nothing, confirming is_active gating is independent of the cost fix', () => {
    const tree = makeTree()
    const inactiveMfg = { ...MFG_RULE, is_active: false }
    const results = runPricingOnTree(tree, [inactiveMfg, PRICE_RULE], {}, { profileValues: PV })
    expect(results.manufacture_labour.total_minutes).toBe(0)
    expect(results.price.total_cost).toBeCloseTo(820.11, 2)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Step AR addendum — surround (architrave) length rounding
// ══════════════════════════════════════════════════════════════════════════════
// docs/step-ar-addendum-surround-rounding.md. Integrate does TWO roundings on
// a surround: the board snaps the rule's length up to the next 10 mm, and the
// price uses that to the nearest 0.1 m with halves up. Every figure below is
// a reading from a stored surround list, not a chosen example.
describe('componentLengthMetres', () => {
  const surround = mm => componentLengthMetres(mm, 'surrounds')

  it('matches every surround length the reviewer read', () => {
    // Q and R (1040 x 980): the two that a single ceiling got wrong
    expect(surround(1140)).toBe(1.1)      // width  1040 + 100
    expect(surround(1080)).toBe(1.1)      // height  980 + 100, x 2 = 2.20
    // L34046 7/1 (1245 x 1779)
    expect(surround(1345)).toBe(1.4)      // snaps to 1350
    expect(surround(1879)).toBe(1.9)      // snaps to 1880
    // S (1199 x 1499)
    expect(surround(1299)).toBe(1.3)      // snaps to 1300
    expect(surround(1599)).toBe(1.6)      // snaps to 1600, x 2 = 3.20
    expect(surround(1349)).toBe(1.4)      // the head board, snaps to 1350
    // C (999 x 1199) and D (1800 x 1299)
    expect(surround(1099)).toBe(1.1)      // snaps to 1100
    expect(surround(1399)).toBe(1.4)      // snaps to 1400
    expect(surround(1900)).toBe(1.9)
    // already on a 10 mm boundary
    expect(surround(1350)).toBe(1.4)
  })

  it('an exact half goes UP', () => {
    expect(surround(1050)).toBe(1.1)
    expect(surround(1150)).toBe(1.2)
  })

  it('the 10 mm snap happens BEFORE the 0.1 m rounding', () => {
    // 1349 rounded to the nearest 0.1 m directly would be 1.3; snapping to
    // 1350 first makes it 1.4, which is what Integrate prints. This is the
    // whole reason there are two roundings.
    expect(Math.round(1349 / 100) / 10).toBe(1.3)
    expect(surround(1349)).toBe(1.4)
  })

  it('a non-surround component still ceils to the next 0.1 m', () => {
    // No Integrate reading exists for these, so they are left alone.
    expect(componentLengthMetres(1140)).toBe(1.2)
    expect(componentLengthMetres(1140, 'glass')).toBe(1.2)
    expect(componentLengthMetres(1301)).toBe(1.4)
    expect(componentLengthMetres(1300)).toBe(1.3)
  })

  it('handles a missing or zero measure', () => {
    expect(componentLengthMetres(0, 'surrounds')).toBe(0)
    expect(componentLengthMetres(null, 'surrounds')).toBe(0)
    expect(componentLengthMetres(undefined)).toBe(0)
  })

  it('no float error lands a value on the wrong side of a boundary', () => {
    // 0.1 m steps are not representable in binary, so the arithmetic is done
    // in whole millimetres
    for (let mm = 1000; mm <= 2000; mm += 1) {
      const v = surround(mm)
      expect(Number.isFinite(v)).toBe(true)
      expect(Math.round(v * 10)).toBe(v * 10)      // exactly one decimal
    }
  })
})
