/**
 * frontDoorTemplates.test.js — Step BD templates fix, item 4.
 *
 * What a drawing made from each live template costs, priced the way the live
 * site prices it: no stored ironmongery (the rules allocate), the live
 * default rules as `sql/step-bd4` left them, and the three AV4 part costs
 * `sql/step-bd1` wrote.
 *
 * The reviewer's own figures, from drawings 41-43 on L507712 item 9 (made
 * from the templates as first issued, saved and priced through Q1):
 *
 *   41 Front Door                2,580.00
 *   42 Front Door With Fanlight  2,683.39   <- centred mid rail
 *   43 Arched Front Door         2,740.74   <- centred mid rail
 *
 * and what the corrected templates should come to (the benchmark's GlazePro
 * cost plus the 51.45 of ironmongery a NEW door carries over Integrate's
 * stored list):
 *
 *   Front Door                   2,580.01
 *   Front Door With Fanlight     2,697.97
 *   Arched Front Door            2,717.65
 *
 * The Balham is PRICE-NEUTRAL — four panels of the same total area, so moving
 * the rail moves no money — which is exactly why the defect could sit on the
 * live site looking right.
 */

import { describe, it, expect } from 'vitest'
import SNAPSHOT from './benchmarks/pf30-snapshot.json'
import { runPricingOnTree } from './pricingEngine.js'
import { resolveIronmongeryLines } from './loadPricingContext.js'
import { buildFrontDoorFrame, FRONT_DOOR_TEMPLATES } from '../drawingBoard/doorOpenings.js'
import { DOOR_PART_COST_MAP, OPEN_IN_PROFILE_VALUES } from './benchmarks/fixtureDoor.js'
import { withAv4Costs, withFrontDoorIronmongery } from './benchmarks/frontDoorIronmongery.js'

/** The live data as it stands after sql/step-bd1 and sql/step-bd4. */
const LIVE = withAv4Costs(withFrontDoorIronmongery(SNAPSHOT))

function priceTemplate(options) {
  const { tree, missing } = buildFrontDoorFrame(OPEN_IN_PROFILE_VALUES, options)
  expect(missing).toEqual([])
  const ironmongeryLines = resolveIronmongeryLines(tree, LIVE, LIVE.profileValues,
    { profileCode: 'open_in_doors' })
  const results = runPricingOnTree(tree, LIVE.rules, LIVE.pfVariables, {
    glassCatalogue:       LIVE.glassCatalogue,
    partAllocationRules:  LIVE.partAllocationRules,
    partCostMap:          DOOR_PART_COST_MAP,
    ironmongeryLines,
    ironmongeryCatalogue: LIVE.ironmongeryCatalogue,
    profileValues:        LIVE.profileValues,
    profileCode:          'open_in_doors',
  })
  return { tree, results, ironmongeryLines }
}

const byName = name => FRONT_DOOR_TEMPLATES.find(t => t.name === name).options

describe('Step BD templates fix — what each template prices', () => {
  // Step BE moves two of the three. The reviewer’s live drawings 44-46
  // (2,580.01 / 2,697.97 / 2,717.65) were priced BEFORE it:
  //   Front Door  +24.66  the ONE real muntin, 60 minutes at 24.66/h
  //                       (Nathan’s decision d)
  //   Arched      +22.58  the shaped glass: 1.13 m2 (the largest rectangle
  //                       of the cut glass + 25%) where the exact shape was
  //                       0.83, plus the energy surcharge following it.
  //                       Still at Integrate’s shaped RATE — sql/step-be1
  //                       takes another 15.11 off it (1.13 x 13.375).
  //   With Fanlight        unchanged: no muntin and no shaped glass.
  const EXPECTED = [
    ['Front Door',               2604.67],
    ['Front Door With Fanlight', 2697.97],
    ['Arched Front Door',        2740.23],
  ]

  for (const [name, cost] of EXPECTED) {
    it(`${name} costs ${cost.toFixed(2)}`, () => {
      const { results } = priceTemplate(byName(name))
      expect(results.price.total_cost).toBeCloseTo(cost, 1)
    })
  }

  it('a NEW front door’s ironmongery is 315.00, Nathan’s own set', () => {
    // 51.45 more than Integrate's stored list (263.55): the Hardwick sleeved
    // letterbox instead of a letter tidy and a small letterplate, which is
    // decision (a) and not a difference to be chased.
    for (const [name] of EXPECTED) {
      const { results } = priceTemplate(byName(name))
      const iron = results.price.lines
        .filter(l => l.fires && l.name === 'Ironmongery Cost')
      expect(iron.reduce((t, l) => t + l.line_cost, 0), name).toBeCloseTo(315.00, 2)
      // and the CROFT pull, which sql/step-bd4 put on a new door
      expect(iron.map(l => l.alloc_iron_part_code), name).toContain('CRO1774PB')
    }
  })

  it('the Balham is price-neutral: the rail moved, the money did not', () => {
    // Four panels of the same total area. This is why the centred rail
    // survived a live reading: the figure was right and the door was wrong.
    const centred = priceTemplate({ ...byName('Front Door'), rowOffsets: null })
    const integrate = priceTemplate(byName('Front Door'))
    // To a PENNY, not to the digit: the four panel areas are identical in
    // total (1.063026 m2 either way) but each Tricoya line rounds to 2 dp on
    // its own, so the split moves a rounding and not an area.
    expect(integrate.results.price.total_cost)
      .toBeCloseTo(centred.results.price.total_cost, 1)
    expect(Math.abs(integrate.results.price.total_cost -
      centred.results.price.total_cost)).toBeLessThanOrEqual(0.011)
  })

  it('the fanlight and the arched door are NOT price-neutral', () => {
    // Glass and panel are priced per m2 at different rates, so moving the
    // rail moves money — and on the fanlight it also moves the leaf over
    // Integrate's 50 kg overweight line.
    const bedford = {
      centred: priceTemplate({ ...byName('Front Door With Fanlight'), rowOffsets: null }),
      live:    priceTemplate(byName('Front Door With Fanlight')),
    }
    expect(bedford.live.results.price.total_cost)
      .toBeGreaterThan(bedford.centred.results.price.total_cost)
    // the reviewer's drawing 42, made from the centred template — no
    // shaped glass and no muntin on it, so Step BE leaves it where it was
    expect(bedford.centred.results.price.total_cost).toBeCloseTo(2683.39, 1)
    // 45 minutes of "Any Door Overweight" come back with the longer glass
    const mins = r => r.results.install_labour.total_minutes
    expect(mins(bedford.live) - mins(bedford.centred)).toBe(45)

    const arched = {
      centred: priceTemplate({ ...byName('Arched Front Door'), rowOffsets: null }),
      live:    priceTemplate(byName('Arched Front Door')),
    }
    // the reviewer’s drawing 43 figure plus Step BE’s shaped glass
    expect(arched.centred.results.price.total_cost).toBeCloseTo(2758.81, 1)
    expect(arched.live.results.price.total_cost)
      .toBeLessThan(arched.centred.results.price.total_cost)
  })
})
