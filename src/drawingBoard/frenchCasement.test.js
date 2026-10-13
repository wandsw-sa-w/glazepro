// frenchCasement.test.js — Step AX
//
// French casements built the way a surveyor builds them: the template, the
// transom picker for the fanlight one, then "Change to: French casement".
// The trees have to come out equal to the FR1 / FR2 fixtures and price to
// the same money, and the whole-window Flush / Stormproof switch has to
// convert a French window completely.
//
// Also here: what the four Step AV combination templates price with and
// without their stored surround list (item 4), and what the default
// ironmongery rules give a French drawing (item 5).

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import {
  buildCasementFrame, changeOpening, setCasementOperation, openingNodes,
  openingMatrixIndex, openingTypeLabel, applyFanlightBottomRails,
  buildFrenchPair, frenchProfileDefaults, frenchMeetingStileMm,
  setFrenchMasterLeaf, isStormproofSash, isStormproofWindow,
  SASH_TYPE_STORMPROOF, SASH_TYPE_FLUSH,
} from './casementOpenings.js'
import { setStormproof } from './stormproof.js'
import { validateDrawing } from '../validation/validate.js'
import { CASEMENT_VALIDATION_RULES } from '../validation/casementRules.fixture.js'
import { applyDividers } from './gridActions.js'
import { assertSaveable } from './containment.js'
import { findRequiredEmpty } from './requiredFields.js'
import { computeDerived } from './computeDerived.js'
import {
  frameCells, frameInterior, casementSashSize, casementSashTimberVolumeDm3,
  CASEMENT_SASH_TYPES, FRENCH_SASH_TYPES, FRENCH_PAIR_PART,
} from '../pricing/casementGeometry.js'
import { runPricingOnTree } from '../pricing/pricingEngine.js'
import { computeVariables } from '../pricing/computeVariables.js'
import { defaultIronmonger } from '../pricing/defaultIronmongery.js'
import {
  BENCHMARK_FR1, BENCHMARK_FR2,
  BENCHMARK_TC1, BENCHMARK_TC2, BENCHMARK_TC3,
} from '../pricing/benchmarks/fixtureCasement.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = resolve(HERE, '../pricing/benchmarks/pf30-snapshot.json')
const SNAPSHOT = existsSync(SNAPSHOT_PATH)
  ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
  : null

// Profile 2 (casement) live: the casement keys, the French pair's own, and
// casementSashPart.bottomHeight 83 with defaultFanlightBottomHeight 62
// (sql/step-as0 has run), plus the twelve stormproof keys Step AU added.
const PV = {
  'assemblyFramePart.leftWidth': 37, 'assemblyFramePart.rightWidth': 37,
  'assemblyFramePart.topHeight': 47, 'assemblyFramePart.bottomHeight': 47,
  'assemblyFramePart.frameDepth': 96, 'assemblyFramePart.frameHeadStopSize': 20,
  'assemblyFramePart.frameStileStopSize': 20, 'assemblyFramePart.cillStopSize': 20,
  'assemblyFramePart.cillAngle': 6,
  'cillPart.height': 47, 'cillPart.depth': 128,
  'mullionPart.thicknessInFrameSolid': 27, 'mullionPart.mullionStopSize': 20,
  'casementSashPart.thickness': 54, 'casementSashPart.topHeight': 62,
  'casementSashPart.leftWidth': 62, 'casementSashPart.rightWidth': 62,
  'casementSashPart.bottomHeight': 83,
  'casementSashPart.defaultFanlightBottomHeight': 62,
  'casementSashPart.mechanicalClearanceLeft': 4, 'casementSashPart.mechanicalClearanceRight': 4,
  'casementSashPart.mechanicalClearanceTop': 4, 'casementSashPart.mechanicalClearanceBottom': 4,
  'casementSashPart.btmRailShapeId': 'square',
  'frenchCasementPart.thickness': 57,
  'frenchCasementPart.midRail': 130,
  'frenchCasementPart.gapBetweenMeetingStiles': 4,
  'frenchCasementPart.mechanicalClearanceLeft': 4,
  'frenchCasementPart.mechanicalClearanceRight': 4,
  'frenchCasementPart.mechanicalClearanceTop': 4,
  'frenchCasementPart.mechanicalClearanceBottom': 4,
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 16,
  'glassPart.defaultDoubleGlazingTolerance': 2,
  'glassPart.defaultDirGuStopSize': 20,
  'glassPart.defaultDoubleGlazingRebateWidthForDirGU': 20,
  'glassPart.defaultDoubleGlazingToleranceForDirGU': 2,
  // Step AU's stormproof set, on Integrate's own keys (the live spellings,
  // as stormproof.test.js has them)
  'casementSashPart.defaultStormProofFrameJamb': 41,
  'casementSashPart.defaultStormProofFrameHead': 41,
  'casementSashPart.defaultStormProofFrameDepth': 69,
  'casementSashPart.defaultStormProofFrameJambType': 'Solid Profiled',
  'casementSashPart.defaultStormProofCillHeight': 56,
  'casementSashPart.defaultStormProofCillDepth': 69,
  'casementSashPart.defaultStormProofFrameHeadStopSize': 15,
  'casementSashPart.defaultStormProofFrameStileStopSize': 15,
  'casementSashPart.defaultStormProofCillStopSize': 15,
  'casementSashPart.stormProofOverlap': 7,
  'casementSashPart.stormProofLipThickness': 15,
  'casementSashPart.defaultStormProofBottomHeight': 76,
}
const PICKER_PV = { thicknessInFrameSolid: 27, mullionStopSize: 20 }

const REQUIRED_DEFS = {
  drawingItemPart: [
    { field_key: 'drawingItemPart.product',  property_name: 'product',
      label: 'Product',  data_type: 'reference', role: 'input', is_required: true },
    { field_key: 'drawingItemPart.quantity', property_name: 'quantity',
      label: 'Quantity', data_type: 'number',    role: 'input', is_required: true },
  ],
}

const frameOf = t => t.children.find(c => c.part_type === 'assemblyFramePart')
const pairOf  = t => frameOf(t).children.find(c => c.part_type === FRENCH_PAIR_PART)
const leavesOf = t => (pairOf(t)?.children ?? [])
const allSashes = t => CASEMENT_SASH_TYPES.flatMap(type => {
  const out = []
  ;(function walk(n) { if (n.part_type === type) out.push(n); (n.children ?? []).forEach(walk) })(t)
  return out
})

function setOffset(tree, partType, offset) {
  return {
    ...tree,
    children: tree.children.map(c => c.part_type !== 'assemblyFramePart' ? c : ({
      ...c,
      children: c.children.map(g => g.part_type !== partType ? g
        : ({ ...g, values: { ...g.values, offset } })),
    })),
  }
}

/** Template 10: a plain French casement at Integrate's size. */
function boardFR1() {
  const { tree, missing } = buildCasementFrame(PV, {
    width: 1199, height: 1313, openings: ['opening_casement'], product: 'casement',
  })
  expect(missing, 'profile values the build could not resolve').toEqual([])
  const res = changeOpening(tree, openingNodes(tree)[0].key, 'french_casement', PV)
  expect(res.changed, 'changeOpening to french_casement').toBe(true)
  return res.tree
}

/** Template 11: a top-hung fanlight over a French pair. */
function boardFR2() {
  const { tree } = buildCasementFrame(PV, {
    width: 899, height: 1499, openings: ['opening_casement'], product: 'casement',
  })
  const i = frameInterior(tree)
  let t = applyDividers(tree, frameOf(tree).key, 1, 2, i.width, i.height, PICKER_PV, 'solid')
  t = setOffset(t, 'transomPart', 304)
  t = applyFanlightBottomRails(t, PV).tree
  t = setCasementOperation(t, openingNodes(t)[0].key, 'top_hung').tree
  const res = changeOpening(t, openingNodes(t)[1].key, 'french_casement', PV)
  expect(res.changed).toBe(true)
  return res.tree
}

// ── The board builds the pair ────────────────────────────────────────────────

describe('Step AX — the board builds a French casement', () => {
  it('FR1: one opening, two leaves, no mullion — the fixture’s geometry', () => {
    const tree = boardFR1()
    expect(frameCells(tree).map(c => [c.width, c.height]))
      .toEqual(frameCells(BENCHMARK_FR1.tree).map(c => [c.width, c.height]))
    expect(frameCells(tree).map(c => [c.width, c.height])).toEqual([[1125, 1219]])
    expect(openingNodes(tree).map(n => n.part_type)).toEqual([FRENCH_PAIR_PART])
    expect(frameOf(tree).children.filter(c => c.part_type === 'mullionPart')).toHaveLength(0)

    expect(allSashes(tree).map(s => {
      const z = casementSashSize(tree, s)
      return [z.width, z.height]
    })).toEqual([[556.5, 1211], [556.5, 1211]])
    expect(() => assertSaveable(tree)).not.toThrow()
    expect(findRequiredEmpty(tree, REQUIRED_DEFS)).toEqual([])
  })

  it('FR1: each leaf carries the fixture’s own values', () => {
    const tree = boardFR1()
    const mine = leavesOf(tree)
    const theirs = leavesOf(BENCHMARK_FR1.tree)
    expect(mine.map(n => n.part_type)).toEqual(theirs.map(n => n.part_type))
    for (let i = 0; i < mine.length; i++) {
      for (const k of ['operation', 'thickness', 'topHeight', 'leftWidth', 'rightWidth',
        'bottomHeight', 'isMasterLeaf']) {
        expect(mine[i].values[k], `leaf ${i} ${k}`).toBe(theirs[i].values[k])
      }
    }
    // 57 thick, an outer stile of 62 and a meeting stile of 63
    expect(mine.map(n => n.values.thickness)).toEqual([57, 57])
    expect(mine.map(n => [n.values.leftWidth, n.values.rightWidth]))
      .toEqual([[62, 63], [63, 62]])
    expect(mine.map(n => casementSashTimberVolumeDm3(tree, n))).toEqual([13.23, 13.23])
  })

  it('FR2: the fanlight over the pair, at the fixture’s sizes', () => {
    const tree = boardFR2()
    expect(frameCells(tree).map(c => [c.width, c.height]))
      .toEqual(frameCells(BENCHMARK_FR2.tree).map(c => [c.width, c.height]))
    expect(frameCells(tree).map(c => [c.width, c.height])).toEqual([[825, 304], [825, 1074]])
    expect(allSashes(tree).map(s => {
      const z = casementSashSize(tree, s)
      return [z.width, z.height, s.values.thickness, s.values.bottomHeight]
    })).toEqual([
      [817, 296, 54, 62],        // the fanlight: 54 thick, Nathan's 62 rail
      [406.5, 1066, 57, 83],     // the leaves: 57 thick, the ordinary 83
      [406.5, 1066, 57, 83],
    ])
    expect(() => assertSaveable(tree)).not.toThrow()
  })

  it('the labels are Integrate’s: A1 / B1, and A1 over A2 / B2', () => {
    const labelled = tree => allSashes(tree).map(n =>
      `${openingTypeLabel(tree, n)} ${openingMatrixIndex(tree, n)}`)
    // FR1 has no mullion, yet Integrate still calls the leaves A1 and B1
    expect(labelled(boardFR1()))
      .toEqual(['French Casement Sash A1', 'French Casement Sash B1'])
    expect(labelled(boardFR2()))
      .toEqual(['Fanlight A1', 'French Casement Sash A2', 'French Casement Sash B2'])
    expect(openingTypeLabel(boardFR1(), pairOf(boardFR1()))).toBe('French Casement')
  })

  it('the master leaf is the RIGHT one, and can be moved to the left', () => {
    const tree = boardFR1()
    expect(pairOf(tree).values.masterLeaf).toBe('right')
    expect(leavesOf(tree).map(n => n.values.isMasterLeaf)).toEqual([false, true])

    const moved = setFrenchMasterLeaf(tree, pairOf(tree).key, 'left')
    expect(moved.changed).toBe(true)
    expect(pairOf(moved.tree).values.masterLeaf).toBe('left')
    expect(leavesOf(moved.tree).map(n => n.values.isMasterLeaf)).toEqual([true, false])
    // the leaves keep everything else
    expect(leavesOf(moved.tree).map(n => n.values.thickness)).toEqual([57, 57])

    // and asking for what it already is, or for a side that is not a side,
    // changes nothing
    expect(setFrenchMasterLeaf(moved.tree, pairOf(tree).key, 'left').changed).toBe(false)
    expect(setFrenchMasterLeaf(tree, pairOf(tree).key, 'middle').changed).toBe(false)
  })

  it('the meeting stile is derived from the profile, not hard-coded', () => {
    const { values, missing, keysUsed } = frenchProfileDefaults(PV)
    expect(missing).toEqual([])
    expect(values.frenchThickness).toBe(57)
    expect(values.frenchMidRail).toBe(130)
    expect(values.frenchGap).toBe(4)
    expect(keysUsed.frenchThickness).toBe('frenchCasementPart.thickness')
    // (midRail - gap) / 2
    expect(frenchMeetingStileMm(values.frenchMidRail, values.frenchGap)).toBe(63)
    expect(frenchMeetingStileMm(100, 0)).toBe(50)
    expect(frenchMeetingStileMm(null, 4)).toBe(null)
  })

  it('a profile without the French keys builds nothing and names them', () => {
    const bare = { ...PV }
    delete bare['frenchCasementPart.thickness']
    delete bare['frenchCasementPart.midRail']
    const { node, missing } = buildFrenchPair(bare)
    expect(node).toBe(null)
    expect(missing.join(' ')).toMatch(/frenchThickness/)
    expect(missing.join(' ')).toMatch(/frenchMidRail/)

    // and changeOpening refuses rather than building a guessed pair
    const { tree } = buildCasementFrame(bare, { openings: ['opening_casement'] })
    const res = changeOpening(tree, openingNodes(tree)[0].key, 'french_casement', bare)
    expect(res.changed).toBe(false)
    expect(res.tree).toBe(tree)
  })

  it('a pair can be changed back to an ordinary casement', () => {
    const tree = boardFR1()
    const back = changeOpening(tree, pairOf(tree).key, 'opening_casement', PV)
    expect(back.changed).toBe(true)
    expect(openingNodes(back.tree).map(n => n.part_type)).toEqual(['casementSashPart'])
    expect(allSashes(back.tree)).toHaveLength(1)
    expect(() => assertSaveable(back.tree)).not.toThrow()
  })
})

// ── Stormproof French (item 3) ───────────────────────────────────────────────

describe('Step AX — a stormproof French casement is FULLY stormproof', () => {
  it('converts the frame, the cill, the pair and both leaves', () => {
    // Integrate's own conversion (FR3) only relabels: its frame stayed flush
    // at 37/47 with a 47 cill and its leaves kept 83 rails. Nathan (13 Oct):
    // GlazePro converts completely.
    const flushTree = boardFR1()
    const { tree, missing, changed } = setStormproof(flushTree, true, PV)
    expect(missing).toEqual([])
    expect(changed.length).toBeGreaterThan(0)

    const frame = frameOf(tree)
    expect(frame.values).toMatchObject({
      leftWidth: 41, rightWidth: 41, topHeight: 41, bottomHeight: 56,
      frameDepth: 69, frameHeadStopSize: 15, frameStileStopSize: 15,
      cillStopSize: 15,
    })
    const cill = frame.children.find(c => c.part_type === 'cillPart')
    expect([cill.values.height, cill.values.depth]).toEqual([56, 69])

    // the pair and both leaves
    expect(pairOf(tree).values.casementTypeId).toBe(SASH_TYPE_STORMPROOF)
    expect(pairOf(tree).values.stormProofOverlap).toBe(7)
    for (const leaf of leavesOf(tree)) {
      expect(leaf.values.casementTypeId, leaf.part_type).toBe(SASH_TYPE_STORMPROOF)
      expect(leaf.values.bottomHeight, 'the 76 mm stormproof rail').toBe(76)
      expect(leaf.values.stormProofOverlap).toBe(7)
      // the French THICKNESS stays 57 (Nathan, 13 Oct)
      expect(leaf.values.thickness, 'French leaves stay 57 thick').toBe(57)
      // and each leaf keeps its own two stiles
      expect(leaf.values.leftWidth !== leaf.values.rightWidth).toBe(true)
    }
    expect(isStormproofWindow(tree)).toBe(true)
    expect(leavesOf(tree).every(isStormproofSash)).toBe(true)
    expect(() => assertSaveable(tree)).not.toThrow()
  })

  it('converts a fanlight-over-pair window throughout, and back again', () => {
    const flushTree = boardFR2()
    const storm = setStormproof(flushTree, true, PV).tree
    // every sash, the fanlight included, is stormproof on 76
    expect(allSashes(storm).map(s => s.values.casementTypeId))
      .toEqual([SASH_TYPE_STORMPROOF, SASH_TYPE_STORMPROOF, SASH_TYPE_STORMPROOF])
    expect(allSashes(storm).map(s => s.values.bottomHeight)).toEqual([76, 76, 76])
    expect(allSashes(storm).map(s => s.values.thickness)).toEqual([54, 57, 57])

    const back = setStormproof(storm, false, PV).tree
    expect(allSashes(back).map(s => s.values.casementTypeId))
      .toEqual([SASH_TYPE_FLUSH, SASH_TYPE_FLUSH, SASH_TYPE_FLUSH])
    // the ordinary flush rail everywhere, and no lap left behind
    expect(allSashes(back).map(s => s.values.bottomHeight)).toEqual([83, 83, 83])
    expect(allSashes(back).some(s => 'stormProofOverlap' in s.values)).toBe(false)
    expect(pairOf(back).values.casementTypeId).toBe(SASH_TYPE_FLUSH)
    expect('stormProofOverlap' in pairOf(back).values).toBe(false)
    expect(isStormproofWindow(back)).toBe(false)
    expect(frameOf(back).values).toMatchObject({ leftWidth: 37, topHeight: 47, frameDepth: 96 })
  })

  it('every stormproof leaf counts for rule 43’s quote note', () => {
    const storm = setStormproof(boardFR1(), true, PV).tree
    const v = computeVariables(storm, computeDerived(storm), SNAPSHOT?.pfVariables ?? {})
    expect(v.is_stormproof_casement).toBe(true)
    expect(v.is_flush_casement).toBe(false)
    expect(v.casement_sash_qty, 'both leaves are sashes').toBe(2)

    // Rule 43 loops casement_sash, which did NOT include a French leaf — so
    // no casement validation rule saw one at all and the quote note could
    // not fire on a stormproof French window. It fires per leaf now.
    const fired = tree => validateDrawing(
      tree,
      computeVariables(tree, computeDerived(tree), SNAPSHOT?.pfVariables ?? {}) ?? {},
      CASEMENT_VALIDATION_RULES, {}, { glassCatalogue: {} },
    ).filter(r => r.status === 'fired')
    const note = fired(storm).filter(r => /Storm proof casement windows/.test(r.message))
    expect(note.length, 'rule 43 on a stormproof French pair').toBeGreaterThan(0)
    // and not on the flush one
    expect(fired(boardFR1()).filter(r => /Storm proof casement windows/.test(r.message)))
      .toHaveLength(0)
  })
})

// ── The money (items 3, 4 and 5) ─────────────────────────────────────────────

const d = SNAPSHOT ? describe : describe.skip

d('Step AX — what it all prices', () => {
  function price(tree, bm, { ironmongeryLines = null } = {}) {
    return runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: bm.partCostMap,
      ironmongeryLines: ironmongeryLines ?? bm.ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
    })
  }
  /** Give a board tree the fixture's stored surround list. */
  const withSurrounds = (tree, bm) =>
    ({ ...tree, values: { ...tree.values, surroundLines: bm.tree.values.surroundLines } })

  const lines = r => r.price.lines.filter(l => l.fires && !l.error)
    .map(l => [l.name, l.alloc_part_code ?? l.alloc_iron_part_code ?? '',
      Number(l.quantity.toFixed(4)), Number(l.line_cost.toFixed(2))])

  it('FR1: the board’s tree prices as the fixture does, line for line', () => {
    const mine   = price(withSurrounds(boardFR1(), BENCHMARK_FR1), BENCHMARK_FR1)
    const theirs = price(BENCHMARK_FR1.tree, BENCHMARK_FR1)
    expect(mine.manufacture_labour.total_minutes).toBe(theirs.manufacture_labour.total_minutes)
    expect(mine.install_labour.total_minutes).toBe(theirs.install_labour.total_minutes)
    expect(mine.price.total_cost).toBeCloseTo(theirs.price.total_cost, 2)
    expect(lines(mine)).toEqual(lines(theirs))
  })

  it('FR2: the same but the fanlight rail, which is 62 by Nathan’s decision', () => {
    // Integrate's FR2 fanlight has an 83 bottom rail (its 8.38 dm³ of timber
    // is 2 x 296 x 62 + 817 x 145). Nathan decided on 12 Oct that a NEW
    // GlazePro fanlight defaults to 62, so the board builds 62 and the
    // drawing is 0.51 cheaper on cost. That is a deliberate difference
    // (difference 5 in docs/integrate-differences.md), not a modelling gap:
    // put Integrate's own 83 back and every line agrees.
    const mine   = price(withSurrounds(boardFR2(), BENCHMARK_FR2), BENCHMARK_FR2)
    const theirs = price(BENCHMARK_FR2.tree, BENCHMARK_FR2)
    expect(mine.price.total_cost).toBeCloseTo(theirs.price.total_cost - 0.51, 2)

    const asIntegrate = JSON.parse(JSON.stringify(withSurrounds(boardFR2(), BENCHMARK_FR2)))
    const frame = asIntegrate.children.find(c => c.part_type === 'assemblyFramePart')
    const fanlight = frame.children.find(c => c.part_type === 'casementSashPart')
    expect(fanlight.values.bottomHeight, 'the board’s default').toBe(62)
    fanlight.values.bottomHeight = 83
    const matched = price(asIntegrate, BENCHMARK_FR2)
    expect(matched.manufacture_labour.total_minutes).toBe(theirs.manufacture_labour.total_minutes)
    expect(matched.install_labour.total_minutes).toBe(theirs.install_labour.total_minutes)
    expect(matched.price.total_cost).toBeCloseTo(theirs.price.total_cost, 2)
    expect(lines(matched)).toEqual(lines(theirs))
  })

  it('reports the stormproof FR1 price — no Integrate figure to compare', () => {
    // FR3 is a FACT, not a benchmark: Integrate's conversion only relabels,
    // so its price equals FR1's less the nosing. GlazePro's is a different
    // window — a stormproof frame and cill and 76 mm rails — so there is
    // nothing to check it against, only to report.
    const flushTree  = withSurrounds(boardFR1(), BENCHMARK_FR1)
    const stormTree  = setStormproof(flushTree, true, PV).tree
    const flush = price(flushTree, BENCHMARK_FR1)
    const storm = price(stormTree, BENCHMARK_FR1)
    console.log('FR1 flush       cost', flush.price.total_cost.toFixed(2),
      'price', flush.price.total.toFixed(2),
      'production', (flush.manufacture_labour.total_minutes / 60).toFixed(2), 'h',
      'install', (flush.install_labour.total_minutes / 60).toFixed(2), 'h')
    console.log('FR1 stormproof  cost', storm.price.total_cost.toFixed(2),
      'price', storm.price.total.toFixed(2),
      'production', (storm.manufacture_labour.total_minutes / 60).toFixed(2), 'h',
      'install', (storm.install_labour.total_minutes / 60).toFixed(2), 'h')
    expect(storm.price.total_cost).toBeGreaterThan(0)
    // The stormproof frame and cill are smaller sections, so the timber is
    // less; this records which way it goes rather than asserting a target.
    expect(storm.price.total_cost).not.toBe(flush.price.total_cost)
  })

  it('reports each combination template with and WITHOUT the surround list', () => {
    // Item 4: the templates stop carrying a nosing, so a new drawing prices
    // its surround through the allocator. The fixtures keep theirs, because
    // the Integrate drawings they were read from were never saved.
    const rows = []
    for (const [label, bm] of [['TC1', BENCHMARK_TC1], ['TC2', BENCHMARK_TC2],
      ['TC3', BENCHMARK_TC3], ['FR1', BENCHMARK_FR1], ['FR2', BENCHMARK_FR2]]) {
      const stripped = JSON.parse(JSON.stringify(bm.tree))
      delete stripped.values.surroundLines
      const withList = price(bm.tree, bm)
      const without  = price(stripped, bm)
      rows.push({
        label,
        with_cost: Number(withList.price.total_cost.toFixed(2)),
        without_cost: Number(without.price.total_cost.toFixed(2)),
        cost_drop: Number((withList.price.total_cost - without.price.total_cost).toFixed(2)),
        install_min_with: withList.install_labour.total_minutes,
        install_min_without: without.install_labour.total_minutes,
      })
      // The nosing costs its component line, and rule 251's 30 minutes of
      // install labour go with it.
      expect(without.install_labour.total_minutes,
        `${label} install without the nosing`).toBe(withList.install_labour.total_minutes - 30)
      expect(without.price.total_cost).toBeLessThan(withList.price.total_cost)
      const comps = r => r.price.lines
        .filter(l => l.fires && l.name === 'Component Cost')
        .map(l => l.alloc_part_code)
      expect(comps(withList), `${label} with`).toContain('TP61')
      expect(comps(without), `${label} without`).not.toContain('TP61')
      expect(comps(without), `${label} architrave only`).toEqual(['TP68', 'TP68'])
    }
    console.log('with / without the stored surround list:', JSON.stringify(rows, null, 1))
  })

  it('reports the default ironmongery for FR1 and FR2, and the two trickle rules', () => {
    // Item 5. Integrate's stored lists, from the facts:
    //   FR1  handle LH 1, handle RH 1, defender side hung 310 x2,
    //        kenrick 950 x4, gear box x2, trickle_vent_xr16 1
    //   FR2  handle LH 2, handle RH 1, defender 209 1, defender 310 x2,
    //        kenrick 690 x2, kenrick 950 x4, gear box x3, vent 1
    const report = {}
    for (const [label, build] of [['FR1', boardFR1], ['FR2', boardFR2]]) {
      const tree = build()
      const vars = computeVariables(tree, computeDerived(tree), SNAPSHOT.pfVariables)
      const lines = defaultIronmonger(tree, vars, SNAPSHOT.ironmongeryRules ?? [], {},
        SNAPSHOT.profileValues ?? {})
      report[label] = (lines ?? []).map(l => `${l.product_short_name} x${l.qty}`)
    }
    console.log('default ironmongery for a French drawing:', JSON.stringify(report, null, 1))

    // The default rules follow the openings, so a French pair gets a handle
    // per leaf and a gear box per opener, as Integrate's stored list has.
    expect(report.FR1).toEqual(expect.arrayContaining([
      'connoisseur_handle_lh x1', 'connoisseur_handle_rh x1',
      'kenrick_extension_gear_box x2',
    ]))
    expect(report.FR2).toEqual(expect.arrayContaining([
      'kenrick_extension_gear_box x3',
    ]))

    // The bare "trickle" line, recorded as it stands. Both rules are active
    // and both fire on a casement, which is why the vent is listed twice.
    const trickles = (SNAPSHOT.ironmongeryRules ?? [])
      .filter(r => /trickle/i.test(r.product_short_name ?? ''))
      .map(r => ({ sort_order: r.sort_order, label: r.label, product: r.product_short_name,
        condition: r.condition, is_active: r.is_active }))
    console.log('the trickle vent rules:', JSON.stringify(trickles, null, 1))
    expect(trickles).toHaveLength(2)
    // Rule 52 is gated on "not is_sw" and rule 50 is not gated either way,
    // so on a casement (is_sw false) both fire; on a box sash only rule 50.
    const byProduct = Object.fromEntries(trickles.map(r => [r.product, r]))
    expect(byProduct.trickle_vent_xr16.condition).not.toMatch(/is_sw/)
    expect(byProduct.trickle.condition).toMatch(/not is_sw/)
    for (const label of ['FR1', 'FR2']) {
      expect(report[label], `${label} vent listed twice`).toEqual(expect.arrayContaining([
        'trickle_vent_xr16 x1', 'trickle x1',
      ]))
    }
  })
})
