/**
 * livePartCosts.test.js — Step AZ hotfix item 4
 *
 * The benchmark page built its cost map as
 * `{ ...partCostMap, ...(benchmark.partCostMap ?? {}) }` — the FIXTURE
 * winning over the live catalogue. That is how the fourteen missing
 * mpls_doors lock parts stayed invisible: the page priced a door with the
 * fixture's own costs, so the row read PASS while the live catalogue had no
 * such part and a real door would have lost £190.05.
 *
 * Inverted: the LIVE catalogue wins, a fixture cost fills a gap only, and the
 * page says which codes it had to fill so the smoke test fails on it.
 */

import { describe, it, expect } from 'vitest'
import { mergeBenchmarkPartCosts } from './livePartCosts.js'
import * as BENCHMARKS from './index.js'
import SNAPSHOT from './pf30-snapshot.json'

describe('mergeBenchmarkPartCosts — the live catalogue wins', () => {
  it('a live cost beats the fixture’s', () => {
    const { partCostMap, missingLive } = mergeBenchmarkPartCosts(
      { TP68: 3.10 }, { TP68: 2.85 })
    expect(partCostMap.TP68).toBe(3.10)
    expect(missingLive).toEqual([])
  })

  it('a fixture cost fills a gap, and the gap is REPORTED', () => {
    const { partCostMap, missingLive } = mergeBenchmarkPartCosts(
      { TP68: 2.85 }, { RJZ2382: 50.83, Utile67x96: 13.60 })
    expect(partCostMap.RJZ2382).toBe(50.83)
    expect(partCostMap.TP68).toBe(2.85)
    expect(missingLive).toEqual(['RJZ2382', 'Utile67x96'])
  })

  it('a live cost of 0 still wins, and is not called missing', () => {
    // The four Kenrick gearbox parts really do carry unit_cost 0 live
    // (sql/step-ap0 is the pending data fix). That is the live catalogue's
    // answer and the page must show what it costs today, not paper over it
    // with a fixture figure.
    const { partCostMap, missingLive } = mergeBenchmarkPartCosts(
      { TP61: 0 }, { TP61: 14.70 })
    expect(partCostMap.TP61).toBe(0)
    expect(missingLive).toEqual([])
  })

  it('no fixture map leaves the live map alone', () => {
    const { partCostMap, missingLive } = mergeBenchmarkPartCosts({ TP68: 2.85 }, undefined)
    expect(partCostMap).toEqual({ TP68: 2.85 })
    expect(missingLive).toEqual([])
  })

  it('it never mutates either input', () => {
    const live = { TP68: 2.85 }
    const fixture = { RJZ2382: 50.83 }
    mergeBenchmarkPartCosts(live, fixture)
    expect(live).toEqual({ TP68: 2.85 })
    expect(fixture).toEqual({ RJZ2382: 50.83 })
  })
})

describe('no benchmark depends on an override that DIFFERS from the live cost', () => {
  it('every fixture cost either matches the captured catalogue or is absent from it', () => {
    // Step BC follow-up: the snapshot the reviewer refreshed after sql/step-bc1
    // CONTAINS the nineteen door parts az1 inserted — the five Utile sections
    // and the fourteen mpls_doors locks — so there is nothing left for a
    // fixture to fill, and every fixture cost must now MATCH the catalogue.
    // That is the Step AZ follow-up's open point closed in the captured file:
    // the fixture maps are no longer propping the door benchmarks up.
    const live = SNAPSHOT.partCostMap ?? {}
    const disagreements = []
    const filled = []
    for (const [name, bm] of Object.entries(BENCHMARKS)) {
      if (!bm || typeof bm !== 'object' || !bm.partCostMap) continue
      for (const [code, cost] of Object.entries(bm.partCostMap)) {
        if (!(code in live)) { filled.push(code); continue }
        if (Math.abs(live[code] - cost) > 0.0001) {
          disagreements.push(`${name}: ${code} fixture ${cost} vs live ${live[code]}`)
        }
      }
    }
    expect(disagreements, disagreements.join('\n')).toEqual([])
    // and NO gap is filled any more: every code a fixture names is in the
    // catalogue, at the same cost
    expect([...new Set(filled)].sort()).toEqual([])
  })
})

describe('the benchmark page uses it (source check)', () => {
  it('PricingBenchmark.jsx merges through mergeBenchmarkPartCosts, not a spread', async () => {
    const fs = await import('fs')
    const src = fs.readFileSync('src/pages/dev/PricingBenchmark.jsx', 'utf-8')
    expect(src).toContain('mergeBenchmarkPartCosts(')
    // the inverted-precedence spread must be gone
    expect(src).not.toContain('{ ...partCostMap, ...(benchmark.partCostMap ?? {}) }')
  })

  it('a row whose live catalogue lacks a part is labelled, so the smoke test fails on it', async () => {
    const fs = await import('fs')
    const src = fs.readFileSync('src/pages/dev/PricingBenchmark.jsx', 'utf-8')
    expect(src).toContain('part missing live')
    // and it is a status of its own, not PASS or BY DESIGN
    expect(src).toContain('PART MISSING')
  })
})
