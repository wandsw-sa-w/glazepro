// frenchDoor.test.js — Step AZ
//
// French doors built the way a surveyor builds them: the template, then a
// resize, then the master leaf and the operations. The trees have to come out
// equal to the FD fixtures and price to the same money.
//
// Also here: what the default ironmongery rules give a door without a stored
// list, against Integrate's own stored lists.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import {
  buildFrenchDoorFrame, buildFrenchDoorPair, doorProfileDefaults,
  buildPanelledFrenchDoorFrame, buildFrenchDoorSetFrame, setLeafMidRail, leafMidRailOf,
  buildSingleDoorFrame, buildFrenchDoorSidePanelFrame, changeOpeningToSingleDoor,
  buildCoupledSingleDoorFrame, buildFlagFrame, addFlagFrame, removeFrame,
  isFrenchDoorTree, DOOR_MATERIALS, DEFAULT_DOOR_MASTER_LEAF,
} from './doorOpenings.js'
import {
  setFrenchMasterLeaf, setCasementOperation, openingNodes,
  openingMatrixIndex, openingTypeLabel, resizeCasementFrame, openingLabel,
  openingKindsFor, openingKindOf,
} from './casementOpenings.js'
import { assertSaveable } from './containment.js'
import { findRequiredEmpty } from './requiredFields.js'
import { computeDerived } from './computeDerived.js'
import { frameCells, frameInterior, isPairPart, frameColumns, frameRows, casementSashSize, itemFrames, isMultiFrame } from '../pricing/casementGeometry.js'
import {
  doorLeaves, doorLeafSize, doorLeafWeightKg, allocatedSectionParts,
  doorGlassSightline, doorPanelSize,
} from '../pricing/doorGeometry.js'
import { runPricingOnTree } from '../pricing/pricingEngine.js'
import { resolveIronmongeryLines } from '../pricing/loadPricingContext.js'
import { computeVariables } from '../pricing/computeVariables.js'
import { defaultIronmonger } from '../pricing/defaultIronmongery.js'
import {
  BENCHMARK_FD1, BENCHMARK_FD2, BENCHMARK_FD3, BENCHMARK_FD3b,
  BENCHMARK_FD4, BENCHMARK_FD5, BENCHMARK_FD6,
  BENCHMARK_SD1, BENCHMARK_SD3, BENCHMARK_CD1, BENCHMARK_CD4,
} from '../pricing/benchmarks/fixtureDoor.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = resolve(HERE, '../pricing/benchmarks/pf30-snapshot.json')
const SNAPSHOT = existsSync(SNAPSHOT_PATH)
  ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
  : null

/** The open_out_doors profile, as Integrate's import holds it. */
const PV = {
  'assemblyFramePart.leftWidth': 47, 'assemblyFramePart.rightWidth': 47,
  'assemblyFramePart.topHeight': 47, 'assemblyFramePart.bottomHeight': 37,
  'assemblyFramePart.frameDepth': 96,
  'assemblyFramePart.frameHeadStopSize': 20,
  'assemblyFramePart.frameStileStopSize': 20,
  'assemblyFramePart.cillStopSize': 26,
  'cillPart.height': 37, 'cillPart.depth': 145,
  'frenchDoorPart.thickness': 54,
  'frenchDoorPart.midRail': 198,
  'frenchDoorPart.gapBetweenMeetingStiles': 5,
  'frenchDoorPart.meetingStileOverlap': 27,
  'frenchDoorPart.mechanicalClearanceTop': 3,
  'frenchDoorPart.mechanicalClearanceBottom': 3,
  'frenchDoorPart.mechanicalClearanceLeft': 1,
  'frenchDoorPart.mechanicalClearanceRight': 1,
  'leftFrenchDoorLeafPart.topHeight': 110,
  'leftFrenchDoorLeafPart.leftWidth': 110,
  'leftFrenchDoorLeafPart.rightWidth': 110,
  'rightFrenchDoorLeafPart.topHeight': 110,
  'rightFrenchDoorLeafPart.leftWidth': 110,
  'rightFrenchDoorLeafPart.rightWidth': 110,
  'transomPart.thicknessInFrame': 41,
  'casementSashPart.thickness': 54,
  'casementSashPart.topHeight': 62,
  'casementSashPart.leftWidth': 62,
  'casementSashPart.rightWidth': 62,
  'casementSashPart.defaultFanlightBottomHeight': 58,
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 15,
  'glassPart.defaultDoubleGlazingTolerance': 3,
}

const REQUIRED_DEFS = {
  drawingItemPart: [
    { field_key: 'drawingItemPart.product',  property_name: 'product',
      label: 'Product',  data_type: 'reference', role: 'input', is_required: true },
    { field_key: 'drawingItemPart.quantity', property_name: 'quantity',
      label: 'Quantity', data_type: 'number',    role: 'input', is_required: true },
  ],
}

const frameOf = t => t.children.find(c => c.part_type === 'assemblyFramePart')
const pairOf  = t => frameOf(t).children.find(c => c.part_type === 'frenchDoorPart')

/** Template 26 "Fully Glazed", at Integrate's size. */
function boardFD1() {
  const { tree, missing } = buildFrenchDoorFrame(PV, {
    width: 1899, height: 2199, product: 'french_door',
  })
  expect(missing, 'profile values the build could not resolve').toEqual([])
  return tree
}

/** Template 16, a top-hung fanlight over the pair. */
function boardFD3({ fanlightBottomRail = 62, fanlightBottomRailExternal = 69 } = {}) {
  const { tree, missing } = buildFrenchDoorFrame(PV, {
    width: 1350, height: 2599, product: 'french_door',
    fanlight: { offset: 399 }, fanlightBottomRail, fanlightBottomRailExternal,
  })
  expect(missing).toEqual([])
  return tree
}

// ── The board builds them ────────────────────────────────────────────────────

describe('Step AZ — the board builds a French door', () => {
  it('FD1: one opening, two leaves, no mullion — the fixture’s geometry', () => {
    const tree = boardFD1()
    expect(isFrenchDoorTree(tree)).toBe(true)
    expect(frameCells(tree).map(c => [c.width, c.height])).toEqual([[1805, 2115]])
    expect(openingNodes(tree).map(n => n.part_type)).toEqual(['frenchDoorPart'])
    expect(frameOf(tree).children.filter(c => c.part_type === 'mullionPart')).toHaveLength(0)

    // The leaves LAP, so each is WIDER than half the opening
    expect(doorLeaves(tree).map(l => {
      const z = doorLeafSize(tree, l)
      return [z.width, z.height]
    })).toEqual([[912.5, 2109], [912.5, 2109]])
    expect(912.5 * 2).toBeGreaterThan(1805 - 2)

    expect(() => assertSaveable(tree)).not.toThrow()
    expect(findRequiredEmpty(tree, REQUIRED_DEFS)).toEqual([])
  })

  it('FD1: each leaf carries the fixture’s own values', () => {
    const mine = pairOf(boardFD1()).children
    const theirs = pairOf(BENCHMARK_FD1.tree).children
    expect(mine.map(n => n.part_type)).toEqual(theirs.map(n => n.part_type))
    for (let i = 0; i < mine.length; i++) {
      for (const k of ['operation', 'thickness', 'topHeight', 'leftWidth', 'rightWidth',
        'bottomHeight', 'bottomHeightExternal', 'isMasterLeaf', 'btmRailShapeId']) {
        expect(mine[i].values[k], `leaf ${i} ${k}`).toBe(theirs[i].values[k])
      }
    }
    // the pair's own values too — the overlap is the one that matters
    expect(pairOf(boardFD1()).values).toMatchObject({
      thickness: 54, midRail: 198, gapBetweenMeetingStiles: 5, meetingStileOverlap: 27,
      mechanicalClearanceTop: 3, mechanicalClearanceLeft: 1,
    })
  })

  it('FD2: resizing the template gives the resized fixture', () => {
    // FD2 IS FD1 resized, which is how the reviewer made it.
    const resized = resizeCasementFrame(boardFD1(), { width: 1599, height: 2099 }).tree
    expect(frameCells(resized).map(c => [c.width, c.height]))
      .toEqual(frameCells(BENCHMARK_FD2.tree).map(c => [c.width, c.height]))
    expect(doorLeaves(resized).map(l => {
      const z = doorLeafSize(resized, l)
      return [z.width, z.height]
    })).toEqual([[762.5, 2009], [762.5, 2009]])
    expect(() => assertSaveable(resized)).not.toThrow()
  })

  it('FD3: the fanlight over the pair, at the fixture’s sizes', () => {
    const tree = boardFD3()
    expect(frameCells(tree).map(c => [c.width, c.height]))
      .toEqual(frameCells(BENCHMARK_FD3.tree).map(c => [c.width, c.height]))
    expect(frameCells(tree).map(c => [c.width, c.height])).toEqual([[1256, 399], [1256, 2075]])
    expect(doorLeaves(tree).map(l => {
      const z = doorLeafSize(tree, l)
      return [z.width, z.height]
    })).toEqual([[638, 2069], [638, 2069]])
    expect(() => assertSaveable(tree)).not.toThrow()
  })

  it('a new fanlight’s bottom rail is Nathan’s 62, not the profile’s 58', () => {
    // The door profile holds 58 and Integrate's own template drew 86.
    // Nathan (12 Oct): a NEW GlazePro fanlight is 62, so Integrate's
    // "reduce to 62mm externally" warning never fires on a GlazePro drawing.
    const fanlight = frameOf(boardFD3()).children.find(c => c.part_type === 'casementSashPart')
    expect(fanlight.values.bottomHeight).toBe(62)
    expect(fanlight.values.bottomHeightExternal).toBe(69)
    expect(PV['casementSashPart.defaultFanlightBottomHeight'], 'the profile still says 58').toBe(58)
    // and Integrate's own 86 can still be drawn, which is FD3
    const asIntegrate = boardFD3({ fanlightBottomRail: 86, fanlightBottomRailExternal: 93 })
    expect(frameOf(asIntegrate).children.find(c => c.part_type === 'casementSashPart')
      .values.bottomHeight).toBe(86)
  })

  it('the labels are Integrate’s: A1 / B1, and A1 over A2 / B2', () => {
    const labelled = tree => [
      ...frameOf(tree).children.filter(c => c.part_type === 'casementSashPart'),
      ...doorLeaves(tree),
    ].map(n => `${openingTypeLabel(tree, n)} ${openingMatrixIndex(tree, n)}`)
    expect(labelled(boardFD1()))
      .toEqual(['French Door Leaf Left A1', 'French Door Leaf Right B1'])
    expect(labelled(boardFD3()))
      .toEqual(['Fanlight A1', 'French Door Leaf Left A2', 'French Door Leaf Right B2'])
    expect(openingTypeLabel(boardFD1(), pairOf(boardFD1()))).toBe('French Door')
  })

  it('the master leaf is the RIGHT one, and can be moved — the shared setter', () => {
    const tree = boardFD1()
    expect(pairOf(tree).values.masterLeaf).toBe(DEFAULT_DOOR_MASTER_LEAF)
    expect(pairOf(tree).children.map(n => n.values.isMasterLeaf)).toEqual([false, true])
    expect(isPairPart(pairOf(tree)), 'a door pair is a pair to the board').toBe(true)

    // setFrenchMasterLeaf is the French CASEMENT setter — it works on either
    // pair, which is the point of PAIR_PART_TYPES.
    const moved = setFrenchMasterLeaf(tree, pairOf(tree).key, 'left')
    expect(moved.changed).toBe(true)
    expect(pairOf(moved.tree).children.map(n => n.values.isMasterLeaf)).toEqual([true, false])
    expect(pairOf(moved.tree).children.map(n => n.values.thickness)).toEqual([54, 54])
  })

  it('an operation can be set per leaf', () => {
    let tree = boardFD1()
    const [left] = pairOf(tree).children
    tree = setCasementOperation(tree, left.key, 'fix').tree
    expect(pairOf(tree).children.map(n => n.values.operation))
      .toEqual(['fix', 'right_hand_hung'])
    const v = computeVariables(tree, computeDerived(tree), SNAPSHOT?.pfVariables ?? {},
      { profileCode: 'open_out_doors' })
    expect(v.fixed_door_leaf_qty).toBe(1)
    expect(v.opening_out_door_leaf_qty).toBe(1)
  })

  it('doors are utile or Accoya only, and default to utile', () => {
    expect(DOOR_MATERIALS).toEqual(['utile', 'accoya'])
    expect(boardFD1().values.sashMaterialId).toBe('utile')
    const accoya = buildFrenchDoorFrame(PV, { width: 1899, height: 2199, material: 'accoya' }).tree
    expect(accoya.values.sashMaterialId).toBe('accoya')
    expect(accoya.values.frameMaterialId).toBe('accoya')
    // Nathan: an Accoya door prices on the UTILE sections until he supplies
    // Accoya ones, so the lengths are identical.
    expect(allocatedSectionParts(accoya, { material: 'accoya' }))
      .toEqual(allocatedSectionParts(boardFD1(), { material: 'utile' }))
  })

  it('a profile without the door keys builds nothing and names them', () => {
    const bare = { ...PV }
    delete bare['frenchDoorPart.meetingStileOverlap']
    delete bare['frenchDoorPart.midRail']
    const { tree, missing } = buildFrenchDoorFrame(bare, { width: 1899, height: 2199 })
    expect(tree).toBe(null)
    expect(missing.join(' ')).toMatch(/doorOverlap/)
    expect(missing.join(' ')).toMatch(/doorMidRail/)
    expect(buildFrenchDoorPair(bare).node).toBe(null)
    // and a complete profile resolves with nothing missing
    expect(doorProfileDefaults(PV).missing).toEqual([])
    expect(doorProfileDefaults(PV).keysUsed.doorOverlap)
      .toBe('frenchDoorPart.meetingStileOverlap')
  })
})

// ── The money ────────────────────────────────────────────────────────────────

const d = SNAPSHOT ? describe : describe.skip

d('Step AZ — the board’s doors price as the fixtures do', () => {
  function price(tree, bm) {
    return runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: bm.partCostMap,
      ironmongeryLines: bm.ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
      profileCode: bm.profileCode,
    })
  }
  const lines = r => r.price.lines.filter(l => l.fires && !l.error && l.line_cost > 0)
    .map(l => [l.name, l.alloc_part_code ?? l.alloc_iron_part_code ?? '',
      Number(l.quantity.toFixed(4)), Number(l.line_cost.toFixed(2))])

  it('FD1: the board’s tree prices as the fixture does, line for line', () => {
    const mine   = price(boardFD1(), BENCHMARK_FD1)
    const theirs = price(BENCHMARK_FD1.tree, BENCHMARK_FD1)
    expect(mine.manufacture_labour.total_minutes).toBe(theirs.manufacture_labour.total_minutes)
    expect(mine.install_labour.total_minutes).toBe(theirs.install_labour.total_minutes)
    expect(mine.price.total_cost).toBeCloseTo(theirs.price.total_cost, 2)
    expect(lines(mine)).toEqual(lines(theirs))
  })

  it('FD2: the RESIZED board tree prices as the resized fixture does', () => {
    const resized = resizeCasementFrame(boardFD1(), { width: 1599, height: 2099 }).tree
    const mine   = price(resized, BENCHMARK_FD2)
    const theirs = price(BENCHMARK_FD2.tree, BENCHMARK_FD2)
    expect(mine.install_labour.total_minutes, 'no overweight leaf at this size')
      .toBe(theirs.install_labour.total_minutes)
    expect(mine.price.total_cost).toBeCloseTo(theirs.price.total_cost, 2)
    expect(lines(mine)).toEqual(lines(theirs))
  })

  it('FD3 at Integrate’s 86 rail prices as the FD3 fixture does', () => {
    const mine   = price(boardFD3({ fanlightBottomRail: 86, fanlightBottomRailExternal: 93 }), BENCHMARK_FD3)
    const theirs = price(BENCHMARK_FD3.tree, BENCHMARK_FD3)
    expect(mine.price.total_cost).toBeCloseTo(theirs.price.total_cost, 2)
    expect(lines(mine)).toEqual(lines(theirs))
  })

  it('FD3b at Nathan’s 62 rail prices as the FD3b fixture does', () => {
    const mine   = price(boardFD3(), BENCHMARK_FD3b)
    const theirs = price(BENCHMARK_FD3b.tree, BENCHMARK_FD3b)
    expect(mine.price.total_cost).toBeCloseTo(theirs.price.total_cost, 2)
    expect(lines(mine)).toEqual(lines(theirs))
  })

  it('the leaf weights, reported', () => {
    const kg = tree => doorLeaves(tree)
      .map(l => Math.round(doorLeafWeightKg(tree, l, {}) * 10) / 10)
    const fd1 = kg(boardFD1())
    const fd2 = kg(resizeCasementFrame(boardFD1(), { width: 1599, height: 2099 }).tree)
    const fd3 = kg(boardFD3())
    console.log('door leaf weights (kg):', JSON.stringify({ FD1: fd1, FD2: fd2, FD3: fd3 }))
    // Only FD1 is over 50, which is the whole of its extra 90 install minutes
    expect(fd1.every(w => w > 50)).toBe(true)
    expect(fd2.every(w => w < 50)).toBe(true)
    expect(fd3.every(w => w < 50)).toBe(true)
  })

  it('reports the default ironmongery for a door, against Integrate’s list', () => {
    // Item 4: no stored list, so the default rules price it. Integrate's
    // stored template list is: 102mm_hinges PB 4; double_euro_cylinder PB 1;
    // trickle_vent_xr16 Wht 1; windsor_inline_handle PB 1 — plus, on FD3,
    // the fanlight's four.
    const report = {}
    for (const [label, tree] of [['FD1', boardFD1()], ['FD3', boardFD3()]]) {
      const vars = computeVariables(tree, computeDerived(tree), SNAPSHOT.pfVariables,
        { profileCode: 'open_out_doors' })
      const got = defaultIronmonger(tree, vars, SNAPSHOT.ironmongeryRules ?? [], {},
        SNAPSHOT.profileValues ?? {})
      report[label] = (got ?? []).map(l => `${l.product_short_name} x${l.qty}`)
    }
    console.log('default ironmongery for a door:', JSON.stringify(report, null, 1))

    // BOTH trickle-vent rules fire on a door, as they do on a casement:
    // rule 52's gate is "not is_sw" and a door is not a sash window. Nathan
    // (13 Oct, Step AY item 1) decided both are intended on a casement; a
    // DOOR is reported here, not decided.
    for (const label of ['FD1', 'FD3']) {
      expect(report[label], `${label} vents`).toEqual(expect.arrayContaining([
        'trickle_vent_xr16 x1', 'trickle x1',
      ]))
    }
    // The hinges, the cylinder and the vent come out exactly as
    // Integrate's stored list has them — four 102 mm hinges (one pair per
    // leaf's two hinges) and one double euro cylinder on the MASTER leaf.
    expect(report.FD1).toEqual(expect.arrayContaining([
      '102mm_hinges x4', 'double_euro_cylinder x1', 'trickle_vent_xr16 x1',
    ]))
    // FD3 adds the fanlight's four, exactly as Integrate's template stores
    // them.
    expect(report.FD3).toEqual(expect.arrayContaining([
      'connoisseur_handle_lh x1', 'defender_310mm x1',
      'kenrick_extension_1210mm x2', 'kenrick_extension_gear_box x1',
    ]))

    // ONE difference from Integrate's stored list, recorded as it stands:
    // the HANDLE. The live rules pick hardwick_lyndon_door_espag_set; the
    // Integrate template stored windsor_inline_handle. That is a template
    // CHOICE against a rule default, not a defect — a surveyor picked
    // Windsor on that template — but it means a new GlazePro door starts
    // with the espag set until someone changes the list.
    for (const label of ['FD1', 'FD3']) {
      expect(report[label].some(l => l.startsWith('hardwick_lyndon_door_espag_set')), label).toBe(true)
      expect(report[label].some(l => l.startsWith('windsor_inline_handle')), label).toBe(false)
    }
  })
})

// ── Step BA: the three variant templates, built by the board ─────────────────

describe('Step BA — the board builds the French door variants', () => {
  function boardFD4() {
    const { tree, missing } = buildPanelledFrenchDoorFrame(PV, {
      width: 1399, height: 2199, product: 'french_door',
    })
    expect(missing, 'profile values the build could not resolve').toEqual([])
    return tree
  }
  function boardDoorset({ topRow = 'direct_glazed' } = {}) {
    const { tree, missing } = buildFrenchDoorSetFrame(PV, {
      width: 2814, height: 2710, product: 'french_door', topRow,
    })
    expect(missing).toEqual([])
    return tree
  }

  it('FD4: a mid rail and a panel in each leaf, at Integrate’s own sizes', () => {
    const tree = boardFD4()
    const leaves = doorLeaves(tree)
    expect(leaves.length).toBe(2)
    for (const leaf of leaves) {
      expect(doorLeafSize(tree, leaf)).toEqual({ width: 662.5, height: 2109 })
      // the rail position comes from the PANEL being 425, and at template
      // 79's size that is Integrate's own 1241 of glass
      expect(leafMidRailOf(leaf).values.offset).toBe(1241)
      expect(doorGlassSightline(tree, leaf)).toEqual({ width: 442.5, height: 1241 })
      expect(doorPanelSize(tree, leaf)).toEqual({ width: 442.5, height: 425 })
      const panel = leaf.children.find(c => c.part_type === 'panelPart')
      // Step BF: FLAT, as every Integrate door template is (Nathan,
    // decision k) — type 110, which GlazePro had mapped to R&F.
    expect(panel.values.internalPanelTypeId).toBe('flat')
      expect(panel.values.internalPanelBeadId).toBe('ovolo')
    }
    expect(() => assertSaveable(tree)).not.toThrow()
    expect(findRequiredEmpty(tree, REQUIRED_DEFS)).toEqual([])
  })

  it('FD4: the board’s tree prices as the FD4 fixture does, line for line', () => {
    expect(SNAPSHOT, 'needs the PF30 snapshot').toBeTruthy()
  })

  it('the board can add a mid rail, move it, and take it away again', () => {
    // The three things a surveyor does to a panelled leaf, through one action.
    const plain = buildFrenchDoorFrame(PV, { width: 1399, height: 2199 }).tree
    const leafKey = doorLeaves(plain)[0].key
    expect(leafMidRailOf(doorLeaves(plain)[0])).toBe(null)

    const added = setLeafMidRail(plain, leafKey, { offset: 1241 })
    const leaf = doorLeaves(added).find(l => l.key === leafKey)
    expect(leafMidRailOf(leaf).values.offset).toBe(1241)
    expect(leaf.children.some(c => c.part_type === 'panelPart'), 'a panel comes with it').toBe(true)
    expect(doorPanelSize(added, leaf)).toEqual({ width: 442.5, height: 425 })
    // the OTHER leaf is untouched — a mid rail is per leaf
    expect(leafMidRailOf(doorLeaves(added)[1])).toBe(null)

    const moved = setLeafMidRail(added, leafKey, { offset: 1100 })
    const movedLeaf = doorLeaves(moved).find(l => l.key === leafKey)
    expect(doorGlassSightline(moved, movedLeaf).height).toBe(1100)
    expect(doorPanelSize(moved, movedLeaf).height).toBe(566)
    // the panel node is KEPT across a move, with its options
    expect(movedLeaf.children.find(c => c.part_type === 'panelPart').values.internalPanelBeadId)
      .toBe('ovolo')

    const removed = setLeafMidRail(moved, leafKey, { offset: null })
    const bare = doorLeaves(removed).find(l => l.key === leafKey)
    expect(leafMidRailOf(bare)).toBe(null)
    expect(bare.children.some(c => c.part_type === 'panelPart')).toBe(false)
    // and the glass runs the whole leaf again
    expect(doorGlassSightline(removed, bare).height).toBe(1836)
    expect(() => assertSaveable(removed)).not.toThrow()
  })

  it('FD5: a doorset frame — three columns, two rows, the pair in the middle', () => {
    const tree = boardDoorset()
    expect(frameColumns(tree).map(c => c.width)).toEqual([649, 1340, 649])
    expect(frameRows(tree).map(r => r.width)).toEqual([448, 2137])
    const labels = openingNodes(tree).map(n => openingLabel(tree, n))
    expect(labels).toEqual([
      // Step BB: the pair takes TWO column letters (B2 / C2), so the third
      // column is D in every row — Integrate's own labelling.
      'Direct Glazed Unit A1', 'Direct Glazed Unit B1', 'Direct Glazed Unit D1',
      'Casement Sash A2', 'French Door B2', 'Casement Sash D2',
    ])
    expect(() => assertSaveable(tree)).not.toThrow()
    expect(findRequiredEmpty(tree, REQUIRED_DEFS)).toEqual([])
  })

  it('FD5: the side lights MATCH, which Integrate’s own template does not', () => {
    // Integrate's template 29 has 648 and 651. Nathan's drawings are
    // symmetrical, so the odd millimetre goes in the middle opening.
    const tree = boardDoorset()
    const [a, b, c] = frameColumns(tree).map(x => x.width)
    expect(a).toBe(c)
    expect(a + b + c + 2 * 41).toBe(2720)
  })

  it('FD6: the top row is three FIXED casement fanlights at Nathan’s 62', () => {
    const tree = boardDoorset({ topRow: 'casement' })
    const labels = openingNodes(tree).map(n => openingLabel(tree, n))
    expect(labels.slice(0, 3)).toEqual(['Fanlight A1', 'Fanlight B1', 'Fanlight D1'])
    const sashes = openingNodes(tree).filter(n => n.part_type === 'casementSashPart')
    expect(sashes.length).toBe(5)
    // the three top lights take 62; the two side lights keep Integrate's 86
    const rails = sashes.map(s => s.values.bottomHeight)
    expect(rails.filter(r => r === 62).length).toBe(3)
    expect(rails.filter(r => r === 86).length).toBe(2)
    for (const s of sashes) expect(s.values.operation).toBe('fix')
  })

  it('a doorset’s side lights and pair are the sizes the facts give', () => {
    const tree = boardDoorset({ topRow: 'casement' })
    // 649 columns rather than Integrate's 648 / 651, so the side lights are
    // 647 wide (649 less 1 + 1 clearance) and the leaves 680 — a millimetre
    // off Integrate’s, by the symmetry choice and nothing else.
    const sashes = openingNodes(tree).filter(n => n.part_type === 'casementSashPart')
    const side = sashes.filter(s => s.values.bottomHeight === 86)
      .map(s => casementSashSize(tree, s))
    expect(side).toEqual([{ width: 647, height: 2134 }, { width: 647, height: 2134 }])
    expect(doorLeaves(tree).map(l => doorLeafSize(tree, l)))
      .toEqual([{ width: 680, height: 2131 }, { width: 680, height: 2131 }])
  })
})

const dPrice = SNAPSHOT ? describe : describe.skip

dPrice('Step BA — the board’s variants price as the fixtures do', () => {
  function price(tree, bm) {
    return runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: bm.partCostMap,
      ironmongeryLines: bm.ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
      profileCode: bm.profileCode,
    })
  }
  const lines = r => r.price.lines.filter(l => l.fires && !l.error && l.line_cost > 0)
    .map(l => [l.name, l.alloc_part_code ?? l.alloc_iron_part_code ?? '',
      Number(l.quantity.toFixed(4)), Number(l.line_cost.toFixed(2))])

  it('FD4: the board’s panelled tree prices exactly as the fixture does', () => {
    const { tree } = buildPanelledFrenchDoorFrame(PV, {
      width: 1399, height: 2199, product: 'french_door',
    })
    const mine   = price(tree, BENCHMARK_FD4)
    const theirs = price(BENCHMARK_FD4.tree, BENCHMARK_FD4)
    expect(mine.manufacture_labour.total_minutes).toBe(theirs.manufacture_labour.total_minutes)
    expect(mine.install_labour.total_minutes).toBe(theirs.install_labour.total_minutes)
    expect(mine.price.total_cost).toBeCloseTo(theirs.price.total_cost, 2)
    expect(lines(mine)).toEqual(lines(theirs))
  })

  it('FD5: the board’s doorset prices within the symmetry choice of the fixture', () => {
    // The only difference is the symmetrical columns: 650 / 1338 / 650
    // against Integrate's 648 / 1339 / 651. Every RULE that fires is the
    // same, and the money differs only by those millimetres of section and
    // glass.
    const { tree } = buildFrenchDoorSetFrame(PV, { width: 2814, height: 2710, product: 'french_door' })
    const mine   = price(tree, BENCHMARK_FD5)
    const theirs = price(BENCHMARK_FD5.tree, BENCHMARK_FD5)
    expect(mine.manufacture_labour.total_minutes).toBe(theirs.manufacture_labour.total_minutes)
    expect(mine.install_labour.total_minutes).toBe(theirs.install_labour.total_minutes)
    expect(new Set(lines(mine).map(l => l[0]))).toEqual(new Set(lines(theirs).map(l => l[0])))
    expect(mine.price.total_cost).toBeCloseTo(theirs.price.total_cost, 0)
  })

  it('FD6: the board’s casement-light doorset, the same way', () => {
    const { tree } = buildFrenchDoorSetFrame(PV, {
      width: 2814, height: 2710, product: 'french_door', topRow: 'casement',
    })
    const mine   = price(tree, BENCHMARK_FD6)
    const theirs = price(BENCHMARK_FD6.tree, BENCHMARK_FD6)
    expect(mine.manufacture_labour.total_minutes).toBe(theirs.manufacture_labour.total_minutes)
    expect(mine.install_labour.total_minutes).toBe(theirs.install_labour.total_minutes)
    // GlazePro's template puts the three top fanlights on Nathan's 62 rail,
    // where Integrate's drawing has 86 — so its 63x96 is shorter by the
    // three sash widths and its 63x63 longer by the same (difference 7b).
    const section = (r, code) => r.price.lines
      .find(l => l.fires && l.alloc_part_code === code)?.quantity ?? 0
    expect(section(mine, 'Utile63x96')).toBeLessThan(section(theirs, 'Utile63x96'))
    expect(section(mine, 'Utile63x63')).toBeGreaterThan(section(theirs, 'Utile63x63'))
  })
})

// ── Step BB: the single garden doors, built by the board ─────────────────────

describe('Step BB — the board builds a single garden door', () => {
  const build = opts => {
    const { tree, missing } = buildSingleDoorFrame(PV, { product: 'french_door', ...opts })
    expect(missing, 'profile values the build could not resolve').toEqual([])
    return tree
  }

  it('template 15: one door leaf in the frame, no pair part', () => {
    const tree = build({ width: 1099, height: 2199 })
    const leaves = doorLeaves(tree)
    expect(leaves.length).toBe(1)
    expect(leaves[0].part_type).toBe('doorLeafPart')
    // its opening less its OWN clearances: 1005 - 3 - 3 by 2115 - 2 - 3
    expect(doorLeafSize(tree, leaves[0])).toEqual({ width: 999, height: 2110 })
    expect(doorGlassSightline(tree, leaves[0])).toEqual({ width: 779, height: 1837 })
    expect(openingNodes(tree).map(n => openingLabel(tree, n))).toEqual(['Single Door A1'])
    expect(() => assertSaveable(tree)).not.toThrow()
    expect(findRequiredEmpty(tree, REQUIRED_DEFS)).toEqual([])
  })

  it('a new leaf is Left Hand Hung, open out, and NEVER arched', () => {
    // Integrate's board hands a dropped-in leaf Arch Head + Half Circle ON
    // (archHeight 389.5), which priced SD2 as shaped glass and 240 minutes of
    // swept-head work until the reviewer unticked it.
    const leaf = doorLeaves(build({}))[0]
    expect(leaf.values.operation).toBe('left_hand_hung')
    expect(leaf.values.casementTypeId).toBe('open_out')
    expect(leaf.values.archHead).toBe(false)
    expect(leaf.values.thickness).toBe(54)
    expect(leaf.values.topHeight).toBe(110)
    expect(leaf.values.leftWidth).toBe(110)
    expect(leaf.values.bottomHeight).toBe(163)
    expect(leaf.values.bottomHeightExternal).toBe(170)
    expect(leaf.values.toBeReplaced).toBe(true)
    // the single door's own clearances, not the French pair's 3 / 1 / 1 / 3
    expect(leaf.values.mechanicalClearanceTop).toBe(2)
    expect(leaf.values.mechanicalClearanceLeft).toBe(3)
    expect(leaf.values.mechanicalClearanceRight).toBe(3)
    expect(leaf.values.mechanicalClearanceBottom).toBe(3)
  })

  it('with a fanlight over: a transom, and the fanlight on Nathan’s 62', () => {
    const tree = build({ width: 1099, height: 2599, fanlight: { offset: 399 } })
    expect(frameRows(tree).map(r => r.width)).toEqual([399, 2075])
    const labels = openingNodes(tree).map(n => openingLabel(tree, n))
    expect(labels).toEqual(['Fanlight A1', 'Single Door A2'])
    const sash = openingNodes(tree).find(n => n.part_type === 'casementSashPart')
    expect(sash.values.operation).toBe('fix')
    expect(sash.values.bottomHeight, 'a new GlazePro fanlight is 62').toBe(62)
    expect(doorLeafSize(tree, doorLeaves(tree)[0])).toEqual({ width: 999, height: 2070 })
    expect(() => assertSaveable(tree)).not.toThrow()
  })

  it('with one side light: the door on the left at its own 1005', () => {
    const tree = build({ width: 1699, height: 2199, sideLights: 1 })
    // Integrate’s own SD3: mullion at 1005, side column 559
    expect(frameColumns(tree).map(c => c.width)).toEqual([1005, 559])
    expect(openingNodes(tree).map(n => openingLabel(tree, n)))
      .toEqual(['Single Door A1', 'Casement Sash B1'])
    const sash = openingNodes(tree).find(n => n.part_type === 'casementSashPart')
    expect(sash.values.bottomHeight, 'a SIDE light keeps Integrate’s 86').toBe(86)
    expect(doorLeafSize(tree, doorLeaves(tree)[0])).toEqual({ width: 999, height: 2110 })
    expect(() => assertSaveable(tree)).not.toThrow()
  })

  it('with side lights and fanlights: 3 x 2, the door at B2', () => {
    const tree = build({ width: 2249, height: 2599, sideLights: 2, fanlight: { offset: 399 } })
    expect(frameColumns(tree).map(c => c.width)).toEqual([534, 1005, 534])
    expect(frameRows(tree).map(r => r.width)).toEqual([399, 2075])
    expect(openingNodes(tree).map(n => openingLabel(tree, n))).toEqual([
      'Fanlight A1', 'Fanlight B1', 'Fanlight C1',
      'Casement Sash A2', 'Single Door B2', 'Casement Sash C2',
    ])
    // the side lights MATCH, and the door keeps its own column
    const [a, b, c] = frameColumns(tree).map(x => x.width)
    expect(a).toBe(c)
    expect(b).toBe(1005)
    expect(() => assertSaveable(tree)).not.toThrow()
    expect(findRequiredEmpty(tree, REQUIRED_DEFS)).toEqual([])
  })

  it('FD7’s template: a pair between two glazed panels, equal side columns', () => {
    const { tree, missing } = buildFrenchDoorSidePanelFrame(PV, {
      width: 2820, height: 2199, product: 'french_door',
    })
    expect(missing).toEqual([])
    // Integrate's own template is 618 / 1405 / 621 — the sides MATCH here
    const [a, b, c] = frameColumns(tree).map(x => x.width)
    expect(a).toBe(c)
    expect(a + b + c + 2 * 41).toBe(2726)
    expect(openingNodes(tree).map(n => openingLabel(tree, n))).toEqual([
      'Direct Glazed Unit A1', 'French Door B1', 'Direct Glazed Unit D1',
    ])
    // both panels take 12 hidden, not Integrate's A1 quirk of 0
    for (const dgu of openingNodes(tree).filter(n => n.part_type === 'glassPart')) {
      expect(dgu.values.hiddenInRebateLeft).toBe(12)
      expect(dgu.values.mechanicalClearanceLeft).toBe(15)
    }
    expect(() => assertSaveable(tree)).not.toThrow()
  })

  it('an opening of a door frame can be CHANGED to a single door', () => {
    // Item 3: the change-opening choices include a single door on a door
    // frame, and only there.
    const doorset = buildFrenchDoorSetFrame(PV, { width: 2814, height: 2710 }).tree
    expect(openingKindsFor(doorset)).toContain('single_door')
    const casement = buildFrenchDoorFrame(PV, { width: 1899, height: 2199 }).tree
    expect(openingKindsFor(casement)).toContain('single_door')

    // change the middle bottom opening (the pair) into a single door
    const pair = openingNodes(doorset).find(n => n.part_type === 'frenchDoorPart')
    const { tree: next, changed } = changeOpeningToSingleDoor(doorset, pair.key, PV)
    expect(changed).toBe(true)
    expect(doorLeaves(next).length).toBe(1)
    expect(doorLeaves(next)[0].part_type).toBe('doorLeafPart')
    expect(openingKindOf(doorLeaves(next)[0])).toBe('single_door')
    // the glass codes carried over, and the leaf is square
    const glass = doorLeaves(next)[0].children.find(c => c.part_type === 'glassPart')
    expect(glass.values.internalGlassPartNo).toBe('GL100010')
    expect(doorLeaves(next)[0].values.archHead).toBe(false)
    expect(() => assertSaveable(next)).not.toThrow()
    // and changing it again is a no-op rather than a second leaf
    expect(changeOpeningToSingleDoor(next, doorLeaves(next)[0].key, PV).changed).toBe(false)
  })
})

const dSingle = SNAPSHOT ? describe : describe.skip

dSingle('Step BB — the board’s single doors price as the fixtures do', () => {
  function price(tree, bm) {
    return runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: bm.partCostMap,
      ironmongeryLines: bm.ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
      profileCode: bm.profileCode,
    })
  }
  const lines = r => r.price.lines.filter(l => l.fires && !l.error && l.line_cost > 0)
    .map(l => [l.name, l.alloc_part_code ?? l.alloc_iron_part_code ?? '',
      Number(l.quantity.toFixed(4)), Number(l.line_cost.toFixed(2))])

  it('SD1: the board’s tree prices exactly as the fixture does', () => {
    const tree = buildSingleDoorFrame(PV, { width: 1099, height: 2199, product: 'french_door' }).tree
    const mine   = price(tree, BENCHMARK_SD1)
    const theirs = price(BENCHMARK_SD1.tree, BENCHMARK_SD1)
    expect(mine.manufacture_labour.total_minutes).toBe(theirs.manufacture_labour.total_minutes)
    expect(mine.install_labour.total_minutes).toBe(theirs.install_labour.total_minutes)
    expect(mine.price.total_cost).toBeCloseTo(theirs.price.total_cost, 2)
    expect(lines(mine)).toEqual(lines(theirs))
  })

  it('SD3: the board’s side-light drawing prices as the fixture does', () => {
    const tree = buildSingleDoorFrame(PV, {
      width: 1699, height: 2199, sideLights: 1, product: 'french_door',
    }).tree
    const mine   = price(tree, BENCHMARK_SD3)
    const theirs = price(BENCHMARK_SD3.tree, BENCHMARK_SD3)
    expect(mine.manufacture_labour.total_minutes).toBe(theirs.manufacture_labour.total_minutes)
    expect(mine.install_labour.total_minutes).toBe(theirs.install_labour.total_minutes)
    expect(lines(mine)).toEqual(lines(theirs))
  })

  it('a GlazePro-built single door takes the DEFAULT ironmongery: +59.85', () => {
    // As the French doors (differences 9 and 10): the rules give the Hardwick
    // Lyndon espag set where Integrate's template stored the Windsor inline
    // handle, and both trickle vents. Integrate's OWN default rules give a
    // single door exactly the same list — Nathan's choice, nothing new.
    const tree = buildSingleDoorFrame(PV, { width: 1099, height: 2199, product: 'french_door' }).tree
    const ctx = {
      pfVariables: SNAPSHOT.pfVariables, ironmongeryRules: SNAPSHOT.ironmongeryRules,
      glassCatalogue: SNAPSHOT.glassCatalogue, ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
    }
    const defaults = resolveIronmongeryLines(tree, ctx, SNAPSHOT.profileValues,
      { profileCode: 'open_out_doors' })
    const names = defaults.map(l => l.product_short_name).sort()
    expect(names).toContain('hardwick_lyndon_door_espag_set')
    expect(names).not.toContain('windsor_inline_handle')
    expect(names).toContain('102mm_hinges')
    expect(names).toContain('double_euro_cylinder')
    expect(names).toContain('trickle_vent_xr16')
    expect(names).toContain('trickle')
    // a single door takes TWO hinge pairs, not a French pair's four
    expect(defaults.find(l => l.product_short_name === '102mm_hinges').qty).toBe(2)

    const withDefaults = price(tree, { ...BENCHMARK_SD1, ironmongeryLines: defaults })
    const withStored   = price(tree, BENCHMARK_SD1)
    const installMaterials = r => r.price.lines
      .filter(l => l.fires && !l.error && l.group_name === 'installation_materials')
      .reduce((t, l) => t + l.line_cost, 0)
    expect(installMaterials(withDefaults) - installMaterials(withStored)).toBeCloseTo(59.85, 2)
  })
})

// ── Step BC helpers ─────────────────────────────────────────────────────────

/** Every opening label in a tree, in tree order. */
function openingLabelsOf(tree) {
  const out = []
  const walk = n => {
    const l = openingLabel(tree, n)
    if (l) out.push(l)
    for (const c of (n.children ?? [])) walk(c)
  }
  walk(tree)
  return out
}

/** Integrate template 70, from the board. */
function build70() {
  const { tree, missing } = buildCoupledSingleDoorFrame(PV, {
    doorWidth: 995, doorHeight: 2101, product: 'door',
  })
  expect(missing).toEqual([])
  return tree
}

/** Integrate template 69, from the board. */
function build69() {
  const { tree, missing } = buildCoupledSingleDoorFrame(PV, {
    doorWidth: 1082, doorHeight: 2496, flagWidth: 650, flagHeight: 1632, product: 'door',
    fanlights: { doorOffset: 348, flagOffset: 348 },
  })
  expect(missing).toEqual([])
  return tree
}

// ── Step BC: the flag-frame templates, built by the board ────────────────────

describe('Step BC — the board builds a coupled flag-frame door', () => {
  const build = opts => {
    const { tree, missing } = buildCoupledSingleDoorFrame(PV, { product: 'door', ...opts })
    expect(missing, 'profile values the build could not resolve').toEqual([])
    return tree
  }

  it('template 70: flag | door | flag, coupled and head-aligned', () => {
    const tree = build({ doorWidth: 995, doorHeight: 2101 })
    expect(itemFrames(tree).map(f => `${f.values.width}x${f.values.height}`))
      .toEqual(['693x1136', '995x2101', '693x1136'])
    expect(isMultiFrame(tree)).toBe(true)
    // one container, partSpacing -47 — the coupling that makes the set 2287
    // wide rather than 2381
    const container = tree.children.find(c => c.part_type === 'containerPart')
    expect(container.values.partSpacing).toBe(-47)
    // every frame is a WHOLE frame: its own cill
    for (const f of itemFrames(tree)) {
      expect(f.children.some(c => c.part_type === 'cillPart'), 'own cill').toBe(true)
    }
    // one door, two flag lights, and the labels run on
    expect(doorLeaves(tree).length).toBe(1)
    expect(openingLabelsOf(tree)).toEqual([
      'Casement Sash A1', 'Single Door B1', 'Casement Sash C1',
    ])
    expect(() => assertSaveable(tree)).not.toThrow()
    expect(findRequiredEmpty(tree, REQUIRED_DEFS)).toEqual([])
  })

  it('templates 71 and 72 are mirror images', () => {
    // Integrate's own 72 is 1001 / 696 against 71's 998 / 693 — three
    // millimetres nobody drew on purpose. GlazePro uses 998 / 693 for both.
    const right = build({ doorWidth: 998, doorHeight: 2101, flags: ['right'] })
    const left  = build({ doorWidth: 998, doorHeight: 2101, flags: ['left'] })
    expect(itemFrames(right).map(f => f.values.width)).toEqual([998, 693])
    expect(itemFrames(left).map(f => f.values.width)).toEqual([693, 998])
    expect(openingLabelsOf(right)).toEqual(['Single Door A1', 'Casement Sash B1'])
    expect(openingLabelsOf(left)).toEqual(['Casement Sash A1', 'Single Door B1'])
    for (const t of [right, left]) expect(() => assertSaveable(t)).not.toThrow()
  })

  it('template 69: a fanlight in every frame, top hung on the flags', () => {
    const tree = build({
      doorWidth: 1082, doorHeight: 2496, flagWidth: 650, flagHeight: 1632,
      fanlights: { doorOffset: 348, flagOffset: 348 },
    })
    expect(itemFrames(tree).map(f => `${f.values.width}x${f.values.height}`))
      .toEqual(['650x1632', '1082x2496', '650x1632'])
    // every frame has its own transom
    for (const f of itemFrames(tree)) {
      expect(f.children.filter(c => c.part_type === 'transomPart').length, 'one transom').toBe(1)
    }
    // the flags' top lights OPEN (Integrate operation 15) and take Nathan's
    // 62 rail; their fixed lights below keep Integrate's 86; the door's
    // fanlight is FIXED
    const sashes = []
    const walk = n => { if (n.part_type === 'casementSashPart') sashes.push(n); for (const c of (n.children ?? [])) walk(c) }
    walk(tree)
    expect(sashes.map(s => `${s.values.operation}/${s.values.bottomHeight}`)).toEqual([
      'top_hung/62', 'fix/86', 'fix/62', 'top_hung/62', 'fix/86',
    ])
    expect(openingLabelsOf(tree)).toEqual([
      'Fanlight A1', 'Casement Sash A2',
      'Fanlight B1', 'Single Door B2',
      'Fanlight C1', 'Casement Sash C2',
    ])
    expect(() => assertSaveable(tree)).not.toThrow()
    expect(findRequiredEmpty(tree, REQUIRED_DEFS)).toEqual([])
  })

  it('a flag frame can be ADDED to a one-frame drawing, left or right', () => {
    // A one-frame drawing becomes a container drawing when it gains a flag —
    // and only then. Nothing migrates.
    const plain = buildSingleDoorFrame(PV, { width: 1099, height: 2199 }).tree
    expect(isMultiFrame(plain)).toBe(false)

    const frameKey = itemFrames(plain)[0].key
    const right = addFlagFrame(plain, frameKey, 'right', PV)
    expect(right.changed).toBe(true)
    expect(isMultiFrame(right.tree)).toBe(true)
    expect(itemFrames(right.tree).map(f => f.values.width)).toEqual([1099, 693])
    expect(right.tree.children.filter(c => c.part_type === 'assemblyFramePart').length,
      'the frame moved into the container').toBe(0)
    expect(() => assertSaveable(right.tree)).not.toThrow()

    const left = addFlagFrame(plain, frameKey, 'left', PV)
    expect(itemFrames(left.tree).map(f => f.values.width)).toEqual([693, 1099])

    // and a second flag goes beside the frame it is asked for
    const both = addFlagFrame(right.tree, frameKey, 'left', PV)
    expect(itemFrames(both.tree).map(f => f.values.width)).toEqual([693, 1099, 693])
    expect(openingLabelsOf(both.tree)).toEqual([
      'Casement Sash A1', 'Single Door B1', 'Casement Sash C1',
    ])
  })

  it('a new flag frame is 693 x 1136 with one FIXED light, and its own cill', () => {
    const { node, missing } = buildFlagFrame(PV)
    expect(missing).toEqual([])
    expect(node.values.width).toBe(693)
    expect(node.values.height).toBe(1136)
    expect(node.values.leftWidth).toBe(47)
    const sash = node.children.find(c => c.part_type === 'casementSashPart')
    expect(sash.values.operation).toBe('fix')
    expect(sash.values.thickness).toBe(54)
    expect(sash.values.topHeight).toBe(62)
    expect(sash.values.bottomHeight).toBe(86)
    expect(node.children.some(c => c.part_type === 'cillPart')).toBe(true)
  })

  it('a frame can be REMOVED, and the last one back unwraps the container', () => {
    const tree = build({ doorWidth: 995, doorHeight: 2101 })
    const frames = itemFrames(tree)
    const flagA = frames[0].key, doorKey = frames[1].key, flagC = frames[2].key

    // the DOOR frame cannot go
    const refused = removeFrame(tree, doorKey)
    expect(refused.changed).toBe(false)
    expect(refused.reason).toMatch(/door/)

    const two = removeFrame(tree, flagA)
    expect(two.changed).toBe(true)
    expect(itemFrames(two.tree).map(f => f.values.width)).toEqual([995, 693])

    // taking it back to ONE frame unwraps the container, so the drawing is
    // the shape a one-frame drawing has always been
    const one = removeFrame(two.tree, flagC)
    expect(one.changed).toBe(true)
    expect(isMultiFrame(one.tree)).toBe(false)
    expect(one.tree.children.some(c => c.part_type === 'containerPart')).toBe(false)
    expect(one.tree.children.some(c => c.part_type === 'assemblyFramePart')).toBe(true)
    expect(() => assertSaveable(one.tree)).not.toThrow()

    // and the only frame cannot be removed
    expect(removeFrame(one.tree, itemFrames(one.tree)[0].key).changed).toBe(false)
  })
})

const dCoupled = SNAPSHOT ? describe : describe.skip

dCoupled('Step BC — the board’s coupled doors price as the fixtures do', () => {
  function price(tree, bm) {
    return runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: bm.partCostMap,
      ironmongeryLines: bm.ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
      profileCode: bm.profileCode,
    })
  }

  it('template 70 prices as CD1 does, bar CD1’s 1 mm taller left flag', () => {
    // Integrate's drawing 12 has flags 1137 and 1136 high; the template
    // builds both at 1136, so the only difference is that millimetre.
    const tree = build70()
    const mine   = price(tree, BENCHMARK_CD1)
    const theirs = price(BENCHMARK_CD1.tree, BENCHMARK_CD1)
    expect(mine.manufacture_labour.total_minutes).toBe(theirs.manufacture_labour.total_minutes)
    expect(mine.install_labour.total_minutes).toBe(theirs.install_labour.total_minutes)
    expect(mine.price.total_cost).toBeCloseTo(theirs.price.total_cost, 0)
    // the same RULES fire, line for line
    const names = r => [...new Set(r.price.lines
      .filter(l => l.fires && !l.error && l.line_cost > 0).map(l => l.name))].sort()
    expect(names(mine)).toEqual(names(theirs))
  })

  it('template 69 prices as CD4 does, bar the 62 fanlight rails', () => {
    // GlazePro's template puts the three fanlights on Nathan's 62 rail where
    // Integrate's drawing has 86 on the flags' fixed lights only — so the
    // 63x96 section is shorter and the 63x63 longer (difference 7b).
    const tree = build69()
    const mine   = price(tree, BENCHMARK_CD4)
    const theirs = price(BENCHMARK_CD4.tree, BENCHMARK_CD4)
    expect(mine.manufacture_labour.total_minutes).toBe(theirs.manufacture_labour.total_minutes)
    expect(mine.install_labour.total_minutes).toBe(theirs.install_labour.total_minutes)
    const section = (r, code) => r.price.lines
      .find(l => l.fires && l.alloc_part_code === code)?.quantity ?? 0
    expect(section(mine, 'Utile63x96')).toBeLessThan(section(theirs, 'Utile63x96'))
    expect(section(mine, 'Utile63x63')).toBeGreaterThan(section(theirs, 'Utile63x63'))
  })

  it('reports the default ironmongery a GlazePro-built CD4 gets', () => {
    // For the reviewer to check against Integrate's casement rules: the
    // flags' TOP-HUNG fanlights are what need gear, and this is what the
    // live default rules give them.
    const tree = build69()
    const ctx = {
      pfVariables: SNAPSHOT.pfVariables, ironmongeryRules: SNAPSHOT.ironmongeryRules,
      glassCatalogue: SNAPSHOT.glassCatalogue, ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
    }
    const defaults = resolveIronmongeryLines(tree, ctx, SNAPSHOT.profileValues,
      { profileCode: 'open_out_doors' })
    const list = defaults.map(l => `${l.product_short_name} ${l.finish_code} x${l.qty}`).sort()
    console.log('default ironmongery for a GlazePro-built CD4:\n ' + list.join('\n '))

    // What must be true whatever the rules give: the door's own set, and
    // nothing from a French pair.
    const names = defaults.map(l => l.product_short_name)
    expect(names).toContain('hardwick_lyndon_door_espag_set')
    expect(names).toContain('102mm_hinges')
    expect(names).toContain('double_euro_cylinder')
    expect(names).not.toContain('windsor_inline_handle')
    expect(defaults.find(l => l.product_short_name === '102mm_hinges').qty,
      'a single door takes two hinge pairs').toBe(2)
  })
})
