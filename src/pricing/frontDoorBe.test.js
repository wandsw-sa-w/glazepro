/**
 * frontDoorBe.test.js — Step BE, Nathan's corrections of 14 Oct 2026.
 *
 * docs/step-be-brief.md, docs/integrate-L31115-front-doors.txt (decisions
 * d-g). Two of Integrate's own errors are corrected rather than copied, and
 * both were proved from its Estimated Labour Time editor:
 *
 *  d. "Door Muntin" fires 60 x sash_muntin_to_be_replaced_qty, and Integrate
 *     counts a leaf's MID RAIL as a muntin. A mid rail is not a muntin.
 *  e. a SHAPED glass unit is priced on the largest rectangle of its cut glass
 *     + 25%, at the SQUARE glass rate.
 */

import { describe, it, expect } from 'vitest'
import SNAPSHOT from './benchmarks/pf30-snapshot.json'
import { runPricingOnTree } from './pricingEngine.js'
import { computeVariables } from './computeVariables.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'
import { shapedGlassBillableAreaM2 } from './pricingEngine.js'
import {
  BENCHMARK_FT1, BENCHMARK_FT2, BENCHMARK_FT3, BENCHMARK_FD4, BENCHMARK_C,
} from './benchmarks/index.js'

// sql/step-be1 is RUN LIVE (14 Oct): a shaped unit is priced at the SQUARE
// rate. The captured snapshot pre-dates it.
const LIVE = SNAPSHOT

function run(bm) {
  return runPricingOnTree(bm.tree, LIVE.rules, LIVE.pfVariables, {
    glassCatalogue:       LIVE.glassCatalogue,
    partAllocationRules:  LIVE.partAllocationRules,
    partCostMap:          bm.partCostMap,
    ironmongeryLines:     bm.ironmongeryLines,
    ironmongeryCatalogue: LIVE.ironmongeryCatalogue,
    profileValues:        LIVE.profileValues,
    profileCode:          bm.profileCode,
  })
}
const minutes = (r, name) => (r.manufacture_labour?.lines ?? [])
  .filter(l => (l.rule_name ?? l.name) === name)
  .reduce((t, l) => t + (l.minutes ?? 0), 0)
const vars = bm => computeVariables(bm.tree, computeDerived(bm.tree), LIVE.pfVariables,
  { profileCode: bm.profileCode })

describe('Step BE A — Door Muntin, 60 a REAL muntin', () => {
  it('FT1’s one muntin is 60 minutes, and its production is 2,610', () => {
    // Step BF: the panels are FLAT (type 110 read in Integrate’s dialog), so
    // its flat-panel 60 x 4 was right. What is left is the muntin: Integrate
    // fires Door Muntin TWICE, counting the mid rail, and GlazePro once.
    expect(vars(BENCHMARK_FT1).sash_muntin_to_be_replaced_qty).toBe(1)
    const r = run(BENCHMARK_FT1)
    expect(minutes(r, 'Door Muntin')).toBe(60)
    expect(r.manufacture_labour.total_minutes).toBe(2610)
    expect(r.manufacture_labour.total_minutes / 60).toBeCloseTo(43.50, 2)
  })

  it('a MID RAIL is not a muntin: FT2, FT3 and FD4 do not move', () => {
    for (const [label, bm, production] of [
      // Step BF: 60 less than Integrate’s 2,770 and 3,290 — the mid rail it
      // counts as a muntin — and their panels are FLAT.
      ['FT2', BENCHMARK_FT2, 2710],
      ['FT3', BENCHMARK_FT3, 3230],
    ]) {
      expect(vars(bm).sash_muntin_to_be_replaced_qty, label).toBe(0)
      const r = run(bm)
      expect(minutes(r, 'Door Muntin'), label).toBe(0)
      expect(r.manufacture_labour.total_minutes, label).toBe(production)
    }
    // FD4's two French leaves have a mid rail each and no muntin
    expect(vars(BENCHMARK_FD4).sash_muntin_to_be_replaced_qty).toBe(0)
    expect(minutes(run(BENCHMARK_FD4), 'Door Muntin')).toBe(0)
  })

  it('a SASH window’s glazing bars are still not muntins', () => {
    // The variable is Integrate's own name and a sash window's real glazing
    // bars are counted as gb_to_be_replaced_qty elsewhere. A box sash has no
    // door leaf, so it has no muntins by this count — which is what it was.
    expect(vars(BENCHMARK_C).sash_muntin_to_be_replaced_qty).toBe(0)
  })
})

describe('Step BE B — shaped glass: the largest rectangle + 25%', () => {
  it('the billable area is the cut rectangle plus a quarter', () => {
    // Nathan's own arithmetic for FT3: 799 x 1125 = 0.899 m2 -> 1.12.
    expect(shapedGlassBillableAreaM2(799, 1125)).toBeCloseTo(1.1235938, 6)
    // GlazePro's own cut size for the same unit is 801 x 1127 (sightline
    // 777 x 1103 grown by the 12 mm cover on every edge), which gives
    expect(shapedGlassBillableAreaM2(801, 1127)).toBeCloseTo(1.128409, 6)
  })

  it('FT3’s glass is 1.13 m2 at the SQUARE rate: 66.11', () => {
    const r = run(BENCHMARK_FT3)
    const glass = r.price.lines.filter(l => l.fires && /Glass Cost/.test(l.name ?? ''))
    expect(glass.length).toBe(1)
    expect(glass[0].quantity).toBeCloseTo(1.13, 2)
    // sql/step-be1 is live: the quarter is on the AREA and the rate is the
    // square rule’s own 58.50. Nathan’s own figure was 65.52 from a
    // 799 x 1125 cut; GlazePro’s cut is 801 x 1127, which is 59p more.
    expect(glass[0].value).toBeCloseTo(58.50, 2)
    expect(glass[0].line_cost).toBeCloseTo(66.11, 2)
  })

  it('the energy surcharge follows the same rounded area, untouched', () => {
    // "(rounded_area x (inner + outer thickness)) x 2.5" at 0.17 — the rule
    // is not changed in this step, so a bigger billable area means more
    // energy: 1.13 x 8 x 2.5 = 22.6 kg.
    const r = run(BENCHMARK_FT3)
    const energy = r.price.lines.filter(l => l.fires && /Energy/.test(l.name ?? ''))
    expect(energy.length).toBe(1)
    expect(energy[0].quantity).toBeCloseTo(22.6, 1)
  })

  it('benchmark C’s arched sashes move too — every product, as Nathan said', () => {
    const r = run(BENCHMARK_C)
    const glass = r.price.lines.filter(l => l.fires && /Shaped Glass/.test(l.name ?? ''))
    expect(glass.length).toBe(2)
    // both were 0.32 (the exact shaped area); the cut rectangle + 25% is more
    for (const l of glass) expect(l.quantity).toBeGreaterThan(0.32)
  })
})
