/**
 * stableDoorTemplates.test.js — Step BF follow-up item 2.
 *
 * What a NEW stable door costs, priced on the LIVE rule set with
 * sql/step-bf3 applied — which is the whole point of this file. The Step BF
 * report quoted 2,675.07 / 2,577.73 / 2,701.77 from a test that REPLACED the
 * ironmongery rules with bf3's five, so it could not see the two things the
 * live data already does: the per-leaf hinge rule (which a stable door's two
 * halves fire twice) and the two Trickle Vent rules (which carry
 * `not is_front_door` and so fire on a stable door). Live was £34.65 dearer
 * on each of drawings 50-52, and the test passed.
 *
 * It now adds bf3 TO the live set, so a double shows up here before it shows
 * up on a quote.
 */

import { describe, it, expect } from 'vitest'
import SNAPSHOT from './benchmarks/pf30-snapshot.json'
import { runPricingOnTree } from './pricingEngine.js'
import { resolveIronmongeryLines } from './loadPricingContext.js'
import { buildStableDoorFrame, STABLE_DOOR_TEMPLATES } from '../drawingBoard/doorOpenings.js'
import { DOOR_PART_COST_MAP, OPEN_IN_PROFILE_VALUES } from './benchmarks/fixtureDoor.js'
import {
  STABLE_DOOR_DEFAULT_SET, STABLE_DOOR_IMPORTED_RULES, TRICKLE_VENT_RULES,
  STABLE_DOOR_HINGE_RULE,
} from './benchmarks/liveRuleFixes.js'

/** The live data as the reviewer has it, with sql/step-bf3 re-issued. */
const LIVE = SNAPSHOT

function priceTemplate(options, context = LIVE) {
  const { tree, missing } = buildStableDoorFrame(OPEN_IN_PROFILE_VALUES, options)
  expect(missing).toEqual([])
  const ironmongeryLines = resolveIronmongeryLines(tree, context, context.profileValues,
    { profileCode: 'open_in_doors' })
  const results = runPricingOnTree(tree, context.rules, context.pfVariables, {
    glassCatalogue:       context.glassCatalogue,
    partAllocationRules:  context.partAllocationRules,
    partCostMap:          DOOR_PART_COST_MAP,
    ironmongeryLines,
    ironmongeryCatalogue: context.ironmongeryCatalogue,
    profileValues:        context.profileValues,
    profileCode:          'open_in_doors',
  })
  return { tree, results, ironmongeryLines }
}
const byName = name => STABLE_DOOR_TEMPLATES.find(t => t.name === name).options
const ironOf = r => r.price.lines.filter(l => l.fires && l.name === 'Ironmongery Cost')

describe('Step BF follow-up — what a NEW stable door costs', () => {
  const EXPECTED = [
    ['Stable Door',                   2675.07],
    ['Stable Door Glazed Top',        2577.73],
    ['Stable Door With Vision Panel', 2701.77],
  ]

  for (const [name, cost] of EXPECTED) {
    it(`${name} costs ${cost.toFixed(2)}`, () => {
      const { results } = priceTemplate(byName(name))
      expect(results.price.total_cost).toBeCloseTo(cost, 1)
    })
  }

  it('the set is Nathan’s list, at £102.90 — and the hinges come ONCE', () => {
    const { results, ironmongeryLines } = priceTemplate(byName('Stable Door'))
    // The hinges come from the LIVE per-leaf rule ("4 Hinges per Door",
    // qty 2, loop door_leaf), which a stable door fires ONCE PER HALF — and
    // the resolver merges same-product lines, so it is one line of qty 4:
    // two pairs, 7.04 x 4 = 28.16 -> 28 -> 29.40. That IS what Nathan asked
    // for, which is why bf3 must not add a hinge rule of its own.
    const hinges = ironmongeryLines.filter(l => l.product_short_name === '102mm_hinges')
    expect(hinges.length).toBe(1)
    expect(hinges[0].qty).toBe(4)
    const iron = ironOf(results)
    const hingeLines = iron.filter(l => l.alloc_iron_part_code === 'HHD681')
    expect(hingeLines.map(l => l.line_cost)).toEqual([29.40])
    // and the whole set
    expect(iron.reduce((t, l) => t + l.line_cost, 0)).toBeCloseTo(102.90, 2)
    expect(ironmongeryLines.map(l => l.product_short_name).sort()).toEqual([
      '102mm_hinges', 'era_5_lever_sashlock', 'era_deadlock',
      'trickle_vent_xr16', 'victorian',
    ])
  })

  it('ONE trickle vent, and it is the black XR16', () => {
    // Both live "Trickle Vent" rules carry `not is_front_door`, so they fired
    // on a stable door: XR16 white 3.15 and "trickle" white 2.10, on top of
    // Nathan's black one. That is 5.25 of the 34.65.
    const { ironmongeryLines, results } = priceTemplate(byName('Stable Door'))
    const vents = ironmongeryLines.filter(l => /trickle/.test(l.product_short_name))
    expect(vents.length).toBe(1)
    expect(vents[0]).toMatchObject({ product_short_name: 'trickle_vent_xr16', finish_code: 'Blk' })
    const codes = ironOf(results).map(l => l.alloc_iron_part_code)
    expect(codes).toContain('RHZ651')     // the black XR16
    expect(codes).not.toContain('RHZ665') // the white one
    expect(codes).not.toContain('RHZ771') // "trickle" white
  })

  it('bf3 as first issued would still be £34.65 dearer', () => {
    // WHAT THIS GUARDS. bf3 as first issued added a hinge rule of its own
    // and left the two white Trickle Vent rules alone, which made every new
    // stable door 34.65 too dear:
    //   +29.40  its hinge rule, on top of the live per-leaf one
    //   + 3.15  the live XR16 WHITE vent, beside Nathan’s black one
    //   + 2.10  the live "trickle" white vent
    //
    // The 15 Oct snapshot has the RE-ISSUED bf3, so the old state is
    // reconstructed from the live rows themselves: the duplicate hinge rule
    // is still there and INACTIVE (the reviewer kept the row rather than
    // deleting it), so switching it back on and ungating the two vents is
    // exactly the first issue. If anyone ever does that for real, this test
    // says what it costs.
    const live = SNAPSHOT
    const undone = {
      ...live,
      ironmongeryRules: live.ironmongeryRules.map(r => {
        const id = String(r.id ?? '')
        if (id.startsWith(STABLE_DOOR_HINGE_RULE)) return { ...r, is_active: true }
        if (TRICKLE_VENT_RULES.includes(r.id)) {
          return { ...r, condition: String(r.condition)
            .replace(' and new_stable_door_pair_qty < 1', '') }
        }
        return r
      }),
    }
    // the inactive row really is there, which is what makes this possible
    expect(live.ironmongeryRules.some(r => String(r.id ?? '')
      .startsWith(STABLE_DOOR_HINGE_RULE) && !r.is_active)).toBe(true)

    const before = priceTemplate(byName('Stable Door'), undone)
    const after = priceTemplate(byName('Stable Door'))
    expect(before.results.price.total_cost - after.results.price.total_cost)
      .toBeCloseTo(34.65, 2)
    // 2,709.72 is what the reviewer read on drawing 50 before the re-issue
    expect(before.results.price.total_cost).toBeCloseTo(2709.72, 1)
    // and the set bf3 settled on has no hinge rule of its own
    expect(STABLE_DOOR_DEFAULT_SET.map(x => x.short_name)).not.toContain('102mm_hinges')
    expect(STABLE_DOOR_IMPORTED_RULES.every(id => live.ironmongeryRules
      .find(r => r.id === id)?.is_active === false)).toBe(true)
  })

  it('the two live vent rules keep firing on everything else', () => {
    // The gate is `new_stable_door_pair_qty < 1` and nothing else changes:
    // both rules stay ACTIVE and keep their own conditions, so a casement
    // window and a garden door still get their vents.
    const vents = LIVE.ironmongeryRules.filter(r => TRICKLE_VENT_RULES.includes(r.id))
    expect(vents.length).toBe(2)
    for (const v of vents) {
      expect(v.is_active).toBe(true)
      expect(v.condition).toContain('not is_front_door')
      expect(v.condition).toContain('new_stable_door_pair_qty < 1')
    }
  })
})
