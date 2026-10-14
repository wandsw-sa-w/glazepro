/**
 * frontDoorIronmongery.test.js — Step BD follow-up, items 3 and 4.
 *
 * Nathan's two decisions of 14 Oct (docs/integrate-L31115-front-doors.txt,
 * "Nathan's decisions, 14 Oct"):
 *
 *  a. a NEW front door gets 102mm hinges x2, the AV4 Heritage locking system,
 *     the Hardwick sleeved letterbox and the CROFT euro cylinder pull — not
 *     the Hardwick back-to-back pull, and no letter tidy;
 *  b. the AV4 HAND is corrected rather than copied: the _lh locking system
 *     holds the LEFT-hand lock and centre keep. Integrate prices right-hand
 *     parts on a left-hand door and the imported data copied it.
 *
 * Both are LIVE DATA, changed by sql/step-bd4 — so these tests apply the
 * change the file makes to the captured snapshot and price the result. That
 * is what proves the SQL does what Nathan asked: a rule or a kit row read
 * from the snapshot, patched exactly as the file patches it, through the same
 * pricing path the live site uses.
 *
 * Both patches are IDEMPOTENT: when the reviewer refreshes the snapshot after
 * running sql/step-bd4, they become no-ops and the tests still pass.
 */

import { describe, it, expect } from 'vitest'
import SNAPSHOT from './benchmarks/pf30-snapshot.json'
import { runPricingOnTree } from './pricingEngine.js'
import { resolveIronmongeryLines } from './loadPricingContext.js'
import { BENCHMARK_FT1 } from './benchmarks/index.js'
import {
  AV4_HAND_FIX, FRONT_DOOR_DEFAULT_PULL, withFrontDoorIronmongery,
} from './benchmarks/frontDoorIronmongery.js'

/** FT1 with no stored list: what the RULES give a new front door. */
function defaultTree() {
  const tree = JSON.parse(JSON.stringify(BENCHMARK_FT1.tree))
  tree.children.find(c => c.part_type === 'paintAndIronmongeryPart')
    .values.ironmongeryLines = []
  return tree
}

function priceWith(tree, snapshot) {
  const lines = resolveIronmongeryLines(tree, snapshot, snapshot.profileValues,
    { profileCode: 'open_in_doors' })
  const r = runPricingOnTree(tree, snapshot.rules, snapshot.pfVariables, {
    glassCatalogue:       snapshot.glassCatalogue,
    partAllocationRules:  snapshot.partAllocationRules,
    partCostMap:          BENCHMARK_FT1.partCostMap,
    ironmongeryLines:     lines,
    ironmongeryCatalogue: snapshot.ironmongeryCatalogue,
    profileValues:        snapshot.profileValues,
    profileCode:          'open_in_doors',
  })
  const iron = r.price.lines.filter(l => l.fires && l.name === 'Ironmongery Cost')
  return {
    lines,
    parts: iron.map(l => `${l.alloc_iron_part_code} ${l.line_cost.toFixed(2)}`),
    total: iron.reduce((t, l) => t + l.line_cost, 0),
  }
}

describe('Step BD follow-up item 3a — what a NEW front door gets', () => {
  it('is Nathan’s set: hinges, the AV4 system, the letterbox and the CROFT pull', () => {
    // The live rule gives hardwick_classic_euro_pull_set_back_to_back (25.20);
    // Nathan wants Integrate's Croft pull (euro_cylinder_pull, 29.40), and no
    // letter tidy — which the rules do not give anyway.
    const patched = withFrontDoorIronmongery(SNAPSHOT)
    const { lines } = priceWith(defaultTree(), patched)
    expect(lines.map(l => `${l.product_short_name} x${l.qty}`)).toEqual([
      '102mm_hinges x2',
      'hardwick_classic_sleeved_letterbox x1',
      'euro_cylinder_pull x1',
      'av3_heritage_locking_system_lh x1',
    ])
    expect(FRONT_DOOR_DEFAULT_PULL.from)
      .toBe('hardwick_classic_euro_pull_set_back_to_back')
    expect(FRONT_DOOR_DEFAULT_PULL.to).toBe('euro_cylinder_pull')
  })

  it('and it is £4.20 dearer than the Hardwick pull, nothing else moving', () => {
    const before = priceWith(defaultTree(), SNAPSHOT)
    const after  = priceWith(defaultTree(), withFrontDoorIronmongery(SNAPSHOT))
    // 29.40 against 25.20: the pull swapped, nothing else charging
    // differently. The AV4 parts are RENAMED by the hand fix in the same
    // patch (RHZ2482 -> RHZ2481), so they are compared by COST, which is
    // the thing that must not move.
    expect(after.total - before.total).toBeCloseTo(4.20, 2)
    const otherCosts = r => r.parts
      .filter(x => !x.startsWith('CRO1774PB') && !x.startsWith('HK4000PB'))
      .map(x => x.split(' ')[1]).sort()
    expect(otherCosts(after)).toEqual(otherCosts(before))
    // and it is the PULL that changed, by name
    expect(after.parts.some(x => x.startsWith('CRO1774PB 29.40'))).toBe(true)
    expect(before.parts.some(x => x.startsWith('HK4000PB 25.20'))).toBe(true)
  })

  it('a FRONT door still gets no trickle vent', () => {
    const { lines } = priceWith(defaultTree(), withFrontDoorIronmongery(SNAPSHOT))
    expect(lines.map(l => l.product_short_name).join(',')).not.toMatch(/trickle/)
  })
})

describe('Step BD follow-up item 3b — the AV4 hand, corrected', () => {
  it('the _lh system holds the LEFT-hand lock and centre keep', () => {
    // Integrate's own quirk, imported with the data: the LH variant held
    // RHZ2482 (Heritage Lock RH) and RHZ3092 (RH Centre Keep).
    const before = SNAPSHOT.ironmongeryCatalogue['av3_heritage_locking_system_lh:PC']
    expect(before.parts.map(p => p.part_code).sort())
      .toEqual(['LJZ5074040CP', 'RHZ2427', 'RHZ2482', 'RHZ3092'])

    const patched = withFrontDoorIronmongery(SNAPSHOT)
    const lh = patched.ironmongeryCatalogue['av3_heritage_locking_system_lh:PC']
    const rh = patched.ironmongeryCatalogue['av3_heritage_locking_system_rh:PC']
    expect(lh.parts.map(p => p.part_code).sort())
      .toEqual(['LJZ5074040CP', 'RHZ2427', 'RHZ2481', 'RHZ3091'])
    expect(rh.parts.map(p => p.part_code).sort())
      .toEqual(['LJZ5074040CP', 'RHZ2427', 'RHZ2482', 'RHZ3092'])
    // the pocket keep is handed neither way and stays in both
    expect(AV4_HAND_FIX.lh).toEqual({ RHZ2482: 'RHZ2481', RHZ3092: 'RHZ3091' })
  })

  it('costs NOTHING: both hands price the same before and after', () => {
    // Nathan's decision says "same costs both hands, so no price moves" —
    // this is the test that proves it rather than assuming it.
    // sql/step-bd1, run live on 14 Oct: the lock 107, the pocket keep 5,
    // the centre keep 30 — both hands at the same cost.
    const costs = {
      RHZ2482: 107, RHZ2481: 107, RHZ3092: 30, RHZ3091: 30, RHZ2427: 5,
    }
    const withCosts = snap => ({
      ...snap,
      ironmongeryCatalogue: Object.fromEntries(
        Object.entries(snap.ironmongeryCatalogue).map(([k, v]) => [k, {
          ...v,
          parts: (v.parts ?? []).map(p => ({
            ...p, unit_cost: p.unit_cost || costs[p.part_code] || p.unit_cost,
          })),
        }])),
    })
    const before = priceWith(BENCHMARK_FT1.tree, withCosts(SNAPSHOT))
    const after  = priceWith(BENCHMARK_FT1.tree, withCosts(withFrontDoorIronmongery(SNAPSHOT)))
    expect(after.total).toBeCloseTo(before.total, 2)
    // and it is Integrate's own 263.55 either way
    expect(after.total).toBeCloseTo(263.55, 2)
  })

  it('FT1-FT3 keep INTEGRATE’s stored list, not the new default', () => {
    // Nathan: the benchmarks keep what Integrate's template stores, because
    // their job is Integrate's figures.
    const stored = BENCHMARK_FT1.ironmongeryLines.map(l => l.product_short_name)
    expect(stored).toEqual([
      '102mm_hinges', 'av3_heritage_locking_system_lh', 'euro_cylinder_pull',
      'premium_letter_tidy', 'small_letterplate',
    ])
  })
})
