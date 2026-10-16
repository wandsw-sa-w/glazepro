/**
 * frontDoorBe.test.js — Step BE, Nathan's corrections of 14 Oct 2026.
 *
 * docs/step-be-brief.md, docs/integrate-L31115-front-doors.txt (decisions
 * d-g). Two of Integrate's own errors are corrected rather than copied, and
 * both were proved from its Estimated Labour Time editor:
 *
 *  d. "Door Muntin" fires 60 x sash_muntin_to_be_replaced_qty, and Integrate
 *     counts a leaf's MID RAIL as a muntin.
 *
 *     SUPERSEDED by the Step BM follow-up (16 Oct): decision d said "a mid
 *     rail is not a muntin", and Integrate's labour editor on L33022 Q5 item
 *     12, L34242 Q2 item 8, L34268 item 2 and L34355 Q4 item 7 all say it is.
 *     GlazePro now counts it, and the rows below assert the new figures. The
 *     describe keeps its name because this is still where Door Muntin lives.
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
  it('FT1’s muntin AND mid rail are 120 minutes, production 2,670', () => {
    // The panels are FLAT (type 110 read in Integrate’s dialog), so its
    // flat-panel 60 x 4 is right; and the Step BM follow-up made the MID RAIL
    // count too, so Door Muntin fires twice — which is exactly what
    // Integrate’s labour editor reads on drawing 16:
    //   sash_muntin_to_be_replaced_qty = 2 (the muntin AND the mid rail).
    expect(vars(BENCHMARK_FT1).sash_muntin_to_be_replaced_qty).toBe(2)
    const r = run(BENCHMARK_FT1)
    expect(minutes(r, 'Door Muntin')).toBe(120)
    expect(r.manufacture_labour.total_minutes).toBe(2670)
    expect(r.manufacture_labour.total_minutes / 60).toBeCloseTo(44.50, 2)
  })

  it('a MID RAIL IS a muntin: FT2, FT3 and FD4 each gain its rails', () => {
    for (const [label, bm, qty, production] of [
      // Integrate’s own 2,770 and 3,290, which these now hit exactly. FT3 is
      // the proof of the rule: it has NO real muntin at all, and Integrate
      // fires Door Muntin 1 x 60 for its mid rail regardless.
      ['FT2', BENCHMARK_FT2, 1, 2770],
      ['FT3', BENCHMARK_FT3, 1, 3290],
    ]) {
      expect(vars(bm).sash_muntin_to_be_replaced_qty, label).toBe(qty)
      const r = run(bm)
      expect(minutes(r, 'Door Muntin'), label).toBe(qty * 60)
      expect(r.manufacture_labour.total_minutes, label).toBe(production)
    }
    // FD4's two French leaves have a mid rail each and no real muntin, so it
    // is 2 x 60 — the whole of the -49.32 it used to declare.
    expect(vars(BENCHMARK_FD4).sash_muntin_to_be_replaced_qty).toBe(2)
    expect(minutes(run(BENCHMARK_FD4), 'Door Muntin')).toBe(120)
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
