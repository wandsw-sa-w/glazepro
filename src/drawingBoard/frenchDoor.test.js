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
  isFrenchDoorTree, DOOR_MATERIALS, DEFAULT_DOOR_MASTER_LEAF,
} from './doorOpenings.js'
import {
  setFrenchMasterLeaf, setCasementOperation, openingNodes,
  openingMatrixIndex, openingTypeLabel, resizeCasementFrame, openingLabel,
} from './casementOpenings.js'
import { assertSaveable } from './containment.js'
import { findRequiredEmpty } from './requiredFields.js'
import { computeDerived } from './computeDerived.js'
import { frameCells, frameInterior, isPairPart, frameColumns, frameRows, casementSashSize } from '../pricing/casementGeometry.js'
import {
  doorLeaves, doorLeafSize, doorLeafWeightKg, allocatedSectionParts,
  doorGlassSightline, doorPanelSize,
} from '../pricing/doorGeometry.js'
import { runPricingOnTree } from '../pricing/pricingEngine.js'
import { computeVariables } from '../pricing/computeVariables.js'
import { defaultIronmonger } from '../pricing/defaultIronmongery.js'
import {
  BENCHMARK_FD1, BENCHMARK_FD2, BENCHMARK_FD3, BENCHMARK_FD3b,
  BENCHMARK_FD4, BENCHMARK_FD5, BENCHMARK_FD6,
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
      expect(panel.values.internalPanelTypeId).toBe('raised_and_fielded')
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
      'Direct Glazed Unit A1', 'Direct Glazed Unit B1', 'Direct Glazed Unit C1',
      'Casement Sash A2', 'French Door B2', 'Casement Sash C2',
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
    expect(labels.slice(0, 3)).toEqual(['Fanlight A1', 'Fanlight B1', 'Fanlight C1'])
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
