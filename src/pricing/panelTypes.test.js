/**
 * panelTypes.test.js — Step BF part A: Integrate's panel type ids.
 *
 * The reviewer read them in Integrate's own panel-type dialog (14 Oct 2026,
 * docs/integrate-L31115-stable-doors.txt):
 *
 *   110 = FLAT   112 = RAISED & FIELDED   114 = VERTICAL T&G   116 = HORIZONTAL T&G
 *
 * GlazePro mapped 110 to raised_and_fielded, which came from the French-door
 * facts of Step BA and was repeated through Steps BD and BE. So Integrate's
 * "Flat Panel" 60 minutes on FT1-FT4 was RIGHT, and GlazePro's R&F 120 was
 * the error — the opposite way round from what Step BE concluded.
 */

import { describe, it, expect } from 'vitest'
import { panelType, PANEL_TYPES } from './optionVocabulary.js'
import SNAPSHOT from './benchmarks/pf30-snapshot.json'
import { runPricingOnTree } from './pricingEngine.js'
import {
  BENCHMARK_FT1, BENCHMARK_FT2, BENCHMARK_FT3, BENCHMARK_FT4, BENCHMARK_FD4,
} from './benchmarks/index.js'

const LIVE = SNAPSHOT
const run = bm => runPricingOnTree(bm.tree, LIVE.rules, LIVE.pfVariables, {
  glassCatalogue:       LIVE.glassCatalogue,
  partAllocationRules:  LIVE.partAllocationRules,
  partCostMap:          bm.partCostMap,
  ironmongeryLines:     bm.ironmongeryLines,
  ironmongeryCatalogue: LIVE.ironmongeryCatalogue,
  profileValues:        LIVE.profileValues,
  profileCode:          bm.profileCode,
})
const minutesOf = (r, name) => (r.manufacture_labour?.lines ?? [])
  .filter(l => (l.rule_name ?? l.name) === name)
  .reduce((t, l) => t + (l.minutes ?? 0), 0)

describe('Step BF A — 110 is FLAT', () => {
  it('Integrate’s four ids map to their four panel types', () => {
    expect(panelType(110)).toBe('flat')
    expect(panelType(112)).toBe('raised_and_fielded')
    expect(panelType(114)).toBe('vertical_tongue_and_groove')
    expect(panelType(116)).toBe('horizontal_tongue_and_groove')
    // and the codes still map to themselves, so a GlazePro tree is unaffected
    expect(panelType('flat')).toBe('flat')
    expect(panelType('raised_and_fielded')).toBe('raised_and_fielded')
    // an id nobody has read is not quietly a panel
    expect(panelType(118)).toBeUndefined()
    expect(Object.keys(PANEL_TYPES)).toContain('112')
  })

  it('the FT fixtures’ panels are FLAT, so the 60 rule fires', () => {
    // Integrate's own drawings: Balham, Bedford, Arched and drawing 20 all
    // store 110, which is flat. GlazePro charged R&F 120 on each.
    for (const [label, bm, flat] of [
      ['FT1', BENCHMARK_FT1, 4],
      ['FT2', BENCHMARK_FT2, 1],
      ['FT3', BENCHMARK_FT3, 1],
      ['FT4', BENCHMARK_FT4, 5],
    ]) {
      const r = run(bm)
      expect(minutesOf(r, 'Additional for Flat Panel'), `${label} flat`).toBe(flat * 60)
      expect(minutesOf(r, 'Additional for R&F Panel'), `${label} R&F`).toBe(0)
    }
  })

  it('each FT row’s production is now UNDER Integrate, by its mid rails', () => {
    // The brief's own figures. What is left is decision d: Integrate counts a
    // leaf's MID RAIL as a muntin and GlazePro does not, so GlazePro is 60
    // short per mid rail — FT4 has two.
    for (const [label, bm, mine, theirs] of [
      ['FT1', BENCHMARK_FT1, 2610, 2670],
      ['FT2', BENCHMARK_FT2, 2710, 2770],
      ['FT3', BENCHMARK_FT3, 3230, 3290],
      ['FT4', BENCHMARK_FT4, 3785, 3905],
    ]) {
      const r = run(bm)
      expect(r.manufacture_labour.total_minutes, label).toBe(mine)
      expect(theirs - mine, `${label} is short by its mid rails`)
        .toBe(label === 'FT4' ? 120 : 60)
    }
  })

  it('FD4’s French panels are flat too, and it was never exact', () => {
    // FD4 reads 110 on both leaves' panels. It matched Integrate before this
    // step, which it could only have done by charging R&F 120 where Integrate
    // charged flat 60 and being wrong by the same amount somewhere else — so
    // the fixture's old agreement is not evidence of anything. Nothing here is
    // tuned to keep it.
    const r = run(BENCHMARK_FD4)
    expect(minutesOf(r, 'Additional for Flat Panel')).toBe(120)
    expect(minutesOf(r, 'Additional for R&F Panel')).toBe(0)
  })
})
