/**
 * frontDoor.test.js — Step BD, front doors (open in, panelled).
 *
 * docs/step-bd-front-doors-brief.md, docs/integrate-L31115-front-doors.txt:
 * L31115 item 10 drawings 16-18, read and priced 13 Oct 2026.
 *
 * A front door differs from the garden door of Step BB in ways that each
 * reach the price, and every one of them is pinned here against Integrate's
 * own figures.
 */

import { describe, it, expect } from 'vitest'
import SNAPSHOT from './benchmarks/pf30-snapshot.json'
import { runPricingOnTree } from './pricingEngine.js'
import { resolveIronmongeryLines } from './loadPricingContext.js'
import { BENCHMARK_FT1, BENCHMARK_FD4, BENCHMARK_SD1 } from './benchmarks/index.js'
import { leafCells, panelSizeFor, allocatedSectionParts } from './doorGeometry.js'

function run(bm, tree = bm.tree) {
  const ironmongeryLines = resolveIronmongeryLines(tree, SNAPSHOT, SNAPSHOT.profileValues,
    { profileCode: bm.profileCode })
  return runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
    glassCatalogue:       SNAPSHOT.glassCatalogue,
    partAllocationRules:  SNAPSHOT.partAllocationRules,
    partCostMap:          bm.partCostMap,
    ironmongeryLines,
    ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
    profileValues:        SNAPSHOT.profileValues,
    profileCode:          bm.profileCode,
  })
}

/** Every install_labour line that actually charges minutes. */
function installLines(r) {
  return (r.install_labour?.lines ?? [])
    .filter(l => (l.minutes ?? 0) > 0)
    .map(l => `${l.rule_name ?? l.name} ${l.minutes}`)
}

describe('Step BD item 1 — a front door is a front door', () => {
  it('fires Front Door and Frame 840, not Single Door Only 660', () => {
    // THE LIVE BUG: is_front_door was hard-coded false (NEEDS-DATA), so a
    // front door was installed as a garden door — 660 minutes instead of
    // 840, and none of Integrate's front-door ironmongery rules could fire.
    const r = run(BENCHMARK_FT1)
    expect(installLines(r)).toEqual(['Front Door and Frame (Base) 840'])
    expect(r.install_labour.total_minutes).toBe(840)
    expect(r.install_labour.total_minutes / 60).toBeCloseTo(14.0, 2)
  })

  it('the flag comes from the drawing, not from the range', () => {
    // A door with isFrontDoor false in the same open_in_doors range is a
    // back door: it keeps Single Door Only.
    const tree = JSON.parse(JSON.stringify(BENCHMARK_FT1.tree))
    const paint = tree.children.find(c => c.part_type === 'paintAndIronmongeryPart')
    paint.values.isFrontDoor = false
    const r = run(BENCHMARK_FT1, tree)
    expect(installLines(r)).toContain('Single Door Only 660')
  })

  it('a front door takes no Thunderbolt: the MPLS allocator rules stand down', () => {
    // All three "MPLS non-front" allocation rules carry `not is_front_door`,
    // and with the flag false GlazePro allocated the Winkhaus Thunderbolt
    // (RJZ2382, 53.55) to a front door that has an AV4 Heritage lock.
    const r = run(BENCHMARK_FT1)
    const codes = r.price.lines.map(l => l.alloc_iron_part_code).filter(Boolean)
    expect(codes).not.toContain('RJZ2382')
  })
})

describe('Step BD item 2 — the leaf carries its own grid', () => {
  const leafOf = tree => tree.children
    .find(c => c.part_type === 'assemblyFramePart').children
    .find(c => c.part_type === 'doorLeafPart')

  it('FT1’s four cells are Integrate’s four panel sizes', () => {
    // Leaf 997 x 2068, interior 777 x 1788. A 120 muntin at 373 and a 170
    // mid rail at 983: 373 / 284 across, 983 / 635 down.
    const tree = BENCHMARK_FT1.tree
    const cells = leafCells(tree, leafOf(tree))
    expect(cells.map(c => `${c.width}x${c.height}`)).toEqual([
      '373x983', '284x983', '373x635', '284x635',
    ])
    expect(cells.map(c => `${c.col}${c.row}`)).toEqual(['00', '10', '01', '11'])
  })

  it('each panel takes its OWN cell, not the leaf’s one leftover', () => {
    // Before the grid every panel measured 777 x 635 — the one-mid-rail
    // answer — so all four Tricoya lines priced the same 0.49 m2.
    const tree = BENCHMARK_FT1.tree
    const leaf = leafOf(tree)
    const panels = leaf.children.filter(c => c.part_type === 'panelPart')
    expect(panels.map(pn => {
      const sz = panelSizeFor(tree, pn)
      return `${sz.width}x${sz.height}`
    })).toEqual(['373x983', '284x983', '373x635', '284x635'])
  })

  it('a leaf with no dividers is one cell, and a mid rail alone is two', () => {
    // FD4's leaf: 662.5 x 2109, interior 442.5 x 1836, one 170 rail at 1241.
    const fd4Leaf = BENCHMARK_FD4.tree.children
      .find(c => c.part_type === 'assemblyFramePart').children
      .find(c => c.part_type === 'frenchDoorPart').children[0]
    const cells = leafCells(BENCHMARK_FD4.tree, fd4Leaf)
    expect(cells.map(c => `${c.width}x${c.height}`)).toEqual(['442.5x1241', '442.5x425'])
    // SD1's leaf has no dividers at all: one cell, the whole interior
    const sd1Leaf = leafOf(BENCHMARK_SD1.tree)
    expect(leafCells(BENCHMARK_SD1.tree, sd1Leaf).map(c => `${c.width}x${c.height}`))
      .toEqual(['779x1837'])
  })
})

describe('Step BD item 3 — pricing the leaf', () => {
  it('each panel prices at its own area: Integrate’s four Tricoya lines', () => {
    const r = run(BENCHMARK_FT1)
    const tricoya = r.price.lines.filter(l => (l.name ?? '') === 'Tricoya Panel')
    // Integrate DISPLAYS 2 dp and prices the UNROUNDED area: 373 x 983 =
    // 0.366659 m2 x 188.85 = 69.24, which is Integrate’s own line.
    expect(tricoya.map(l => l.quantity)).toEqual([0.366659, 0.279172, 0.236855, 0.18034])
    expect(tricoya.map(l => l.line_cost)).toEqual([69.24, 52.72, 44.73, 34.06])
    expect(tricoya.reduce((t, l) => t + l.line_cost, 0)).toBeCloseTo(200.75, 2)
  })

  it('FT1’s production is the rules that fire, and nothing is tuned', () => {
    // The reading Step BD asked for, resolved in two steps. Integrate’s own
    // Estimated Labour Time editor fires flat-panel 60 x 4 and Door Muntin
    // TWICE on a leaf with one muntin and one mid rail. Step BE took the
    // panels to be R&F; Step BF read the ids in Integrate’s dialog and they
    // are FLAT (110), so only the muntin half of decision d survives:
    //   Door Leaf 1035 + Machining & Joining a Door Frame 855
    //   + Door Frame - Dual Finish 240 + Door Leaf - Dual Finish 180
    //   + Additional for Flat Panel 60 x 4 + Door Muntin 60 = 2610 (43.50 h)
    // against Integrate’s 2670 — 60 minutes LESS, for the mid rail it
    // counts as a muntin.
    const r = run(BENCHMARK_FT1)
    const fired = (r.manufacture_labour.lines ?? [])
      .filter(l => (l.minutes ?? 0) > 0)
      .map(l => `${l.rule_name ?? l.name} ${l.minutes}`)
    expect(fired).toEqual([
      'Door Frame - Dual Finish 240',
      'Door Leaf - Dual Finish 180',
      'Door Leaf 1035',
      // the Door Muntin line sits here, before the panels — the rules fire
      // in the live file's own order
      'Door Muntin 60',
      'Additional for Flat Panel 60',
      'Additional for Flat Panel 60',
      'Additional for Flat Panel 60',
      'Additional for Flat Panel 60',
      'Machining & Joining a Door Frame 855',
    ])
    expect(r.manufacture_labour.total_minutes).toBe(2610)
  })

  it('Door Muntin fires 60 for the ONE real muntin', () => {
    // Step BD left sash_muntin_to_be_replaced_qty at 0 because wiring it to
    // the leaf's muntins moved FT1 AWAY from Integrate's 2670. Step BE has
    // the reason: 2670 is wrong, and Integrate reaches it by counting the
    // MID RAIL as a second muntin on top of a flat-panel error. GlazePro
    // charges 60 for the real muntin and nothing for the mid rail.
    const r = run(BENCHMARK_FT1)
    const muntin = (r.manufacture_labour.lines ?? [])
      .filter(l => (l.rule_name ?? l.name) === 'Door Muntin')
    expect(muntin.reduce((t, l) => t + (l.minutes ?? 0), 0)).toBe(60)
  })
})

describe('Step BD item 4 — an open-in door’s timber', () => {
  const sections = tree => Object.fromEntries(
    allocatedSectionParts(tree).map(s => [s.part_code, s.length_mm]))

  it('FT1: Integrate’s three lengths, plus the muntin GlazePro charges', () => {
    const s = sections(BENCHMARK_FT1.tree)
    // Integrate: 67x96 5463, 63x200 3083, 63x120 5113 (2 x 2068 + 997 - 20:
    // an OPEN-IN leaf is -20 where an open-out one is -6).
    expect(s.Utile67x96).toBe(5463)
    expect(s.Utile63x200).toBe(3083)
    // 5113 + the 120 muntin at the leaf's interior height between the rails
    // (1788) — Integrate allocates nothing for it; Nathan's standing rule is
    // that GlazePro charges door timber Integrate omits.
    expect(s.Utile63x120).toBe(5113 + 1788)
  })

  it('the open-out doors keep -6: SD1 and FD4 are untouched', () => {
    const sd1 = sections(BENCHMARK_SD1.tree)
    expect(sd1.Utile63x120).toBe(2 * 2110 + 999 - 6)
    const fd4 = sections(BENCHMARK_FD4.tree)
    expect(fd4.Utile63x120).toBe(2 * (2 * 2109 + 662.5 - 6))
  })
})

describe('Step BD item 7 — what a NEW front door gets by default', () => {
  /** FT1 with its stored list taken away: what the live rules allocate. */
  function defaultsFor(tree) {
    const stripped = JSON.parse(JSON.stringify(tree))
    stripped.children.find(c => c.part_type === 'paintAndIronmongeryPart')
      .values.ironmongeryLines = []
    return {
      lines: resolveIronmongeryLines(stripped, SNAPSHOT, SNAPSHOT.profileValues,
        { profileCode: 'open_in_doors' }),
      tree: stripped,
    }
  }

  it('an OPEN IN left-hand door takes the open-IN rule’s locking system', () => {
    // defaultIronmongery.js hard-coded is_opening_in false / is_opening_out
    // true for every door leaf, so an open-in front door matched Integrate's
    // "Front Door Open Out Left Hand Hung" rule — a different locking system
    // (av3_heritage_locking_system_rh) from the one Integrate's own template
    // stores on FT1.
    const { lines } = defaultsFor(BENCHMARK_FT1.tree)
    const names = lines.map(l => l.product_short_name)
    expect(names).toContain('av3_heritage_locking_system_lh')
    expect(names).not.toContain('av3_heritage_locking_system_rh')
  })

  it('the default set is hinges, letterbox, euro pull and the AV4 system', () => {
    const { lines } = defaultsFor(BENCHMARK_FT1.tree)
    expect(lines.map(l => `${l.product_short_name} x${l.qty}`)).toEqual([
      '102mm_hinges x2',
      'hardwick_classic_sleeved_letterbox x1',
      'hardwick_classic_euro_pull_set_back_to_back x1',
      'av3_heritage_locking_system_lh x1',
    ])
    // and no trickle vent: both Trickle Vent rules carry `not is_front_door`
    expect(lines.map(l => l.product_short_name).join(',')).not.toMatch(/trickle/)
  })

  it('three AV4 parts have NO cost in the live catalogue — named, not hidden', () => {
    // The gap that leaves FT1's installation_materials 149.10 short of
    // Integrate: the Heritage lock, the pocket keep and the centre keep are
    // in the catalogue at cost 0. sql/step-bd1 gives the reviewer the rows.
    const set = SNAPSHOT.ironmongeryCatalogue['av3_heritage_locking_system_lh:PC']
    const zero = set.parts.filter(p => !(p.unit_cost > 0)).map(p => p.part_code)
    expect(zero).toEqual(['RHZ3092', 'RHZ2482', 'RHZ2427'])
  })
})
