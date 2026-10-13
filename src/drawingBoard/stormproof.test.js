// stormproof.test.js — Step AU
//
// The whole-window conversion, and the benchmark trees built through the real
// board code. The reconciliations in docs/integrate-L31115-stormproof.txt all
// come out of the ORDINARY casement formulas, so these tests are about the
// TREE: get the sections right and the price follows.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import {
  buildCasementFrame, openingNodes, openingLabel, setCasementOperation,
  changeOpening, applyFanlightBottomRails, resizeCasementFrame,
  isStormproofSash, isStormproofWindow, stormproofProfileDefaults,
  stormproofSectionsFor, SASH_TYPE_STORMPROOF, SASH_TYPE_FLUSH,
} from './casementOpenings.js'
import { setStormproof, stormproofSashValues } from './stormproof.js'
import { applyDividers } from './gridActions.js'
import { assertSaveable } from './containment.js'
import { findRequiredEmpty } from './requiredFields.js'
import { computeVariables } from '../pricing/computeVariables.js'
import { computeDerived } from './computeDerived.js'
import { runPricingOnTree } from '../pricing/pricingEngine.js'
import { resolveIronmongeryLines } from '../pricing/loadPricingContext.js'
import {
  BENCHMARK_SA, BENCHMARK_SC, BENCHMARK_SF,
} from '../pricing/benchmarks/fixtureCasement.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = resolve(HERE, '../pricing/benchmarks/pf30-snapshot.json')
const SNAPSHOT = existsSync(SNAPSHOT_PATH)
  ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
  : null

// The casement profile AFTER sql/step-au1: the flush keys plus the twelve
// stormproof ones.
const PV = {
  'assemblyFramePart.leftWidth': 37, 'assemblyFramePart.rightWidth': 37,
  'assemblyFramePart.topHeight': 47, 'assemblyFramePart.bottomHeight': 47,
  'assemblyFramePart.frameDepth': 96, 'assemblyFramePart.frameHeadStopSize': 20,
  'assemblyFramePart.frameStileStopSize': 20, 'assemblyFramePart.cillStopSize': 20,
  'assemblyFramePart.cillAngle': 6, 'assemblyFramePart.jambType': 'solid_profiled',
  'cillPart.height': 47, 'cillPart.depth': 128,
  'mullionPart.thicknessInFrameSolid': 27, 'mullionPart.mullionStopSize': 20,
  'casementSashPart.thickness': 54, 'casementSashPart.topHeight': 62,
  'casementSashPart.leftWidth': 62, 'casementSashPart.rightWidth': 62,
  'casementSashPart.bottomHeight': 83,
  'casementSashPart.defaultFanlightBottomHeight': 62,
  'casementSashPart.mechanicalClearanceLeft': 4, 'casementSashPart.mechanicalClearanceRight': 4,
  'casementSashPart.mechanicalClearanceTop': 4, 'casementSashPart.mechanicalClearanceBottom': 4,
  'casementSashPart.btmRailShapeId': 'square',
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 16,
  'glassPart.defaultDoubleGlazingTolerance': 2,
  'glassPart.defaultDirGuStopSize': 20,
  'glassPart.defaultDoubleGlazingRebateWidthForDirGU': 20,
  'glassPart.defaultDoubleGlazingToleranceForDirGU': 2,
  'assemblyFramePart.stormProofLeftWidth': 41, 'assemblyFramePart.stormProofRightWidth': 41,
  'assemblyFramePart.stormProofTopHeight': 41, 'assemblyFramePart.stormProofBottomHeight': 56,
  'assemblyFramePart.stormProofFrameDepth': 69,
  'assemblyFramePart.stormProofHeadStopSize': 15, 'assemblyFramePart.stormProofStileStopSize': 15,
  'assemblyFramePart.stormProofCillStopSize': 15,
  'cillPart.stormProofHeight': 56, 'cillPart.stormProofDepth': 69,
  'casementSashPart.stormProofBottomHeight': 76, 'casementSashPart.stormProofOverlap': 7,
}
// Before sql/step-au1 the profile has none of the stormproof keys
const PV_BEFORE_SQL = Object.fromEntries(
  Object.entries(PV).filter(([k]) => !/stormProof/i.test(k)))

const PICKER_PV = { thicknessInFrameSolid: 27, mullionStopSize: 20 }

const REQUIRED_DEFS = {
  drawingItemPart: [
    { field_key: 'drawingItemPart.product',  property_name: 'product',
      label: 'Product',  data_type: 'reference', role: 'input', is_required: true },
    { field_key: 'drawingItemPart.quantity', property_name: 'quantity',
      label: 'Quantity', data_type: 'number',    role: 'input', is_required: true },
  ],
}

function frameOf(tree) {
  return tree.children.find(c => c.part_type === 'assemblyFramePart')
}
function cillOf(tree) {
  return frameOf(tree).children.find(c => c.part_type === 'cillPart')
}
function applyGrid(tree, cols, rows) {
  const frame = frameOf(tree)
  const iW = frame.values.width - frame.values.leftWidth - frame.values.rightWidth
  const iH = frame.values.height - frame.values.topHeight - cillOf(tree).values.height
  const next = applyDividers(tree, frame.key, cols, rows, iW, iH, PICKER_PV, 'solid')
  return applyFanlightBottomRails(next, PV).tree
}
function priceFromSnapshot(tree, ironmongeryLines) {
  return runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
    glassCatalogue: SNAPSHOT.glassCatalogue,
    partAllocationRules: SNAPSHOT.partAllocationRules,
    partCostMap: { TP68: 2.85 },
    ironmongeryLines,
    ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
    profileValues: SNAPSHOT.profileValues,
  })
}
/** Give a board tree a fixture's stored ironmongery list. */
function withFixtureIronmongery(tree, bm) {
  const paint = tree.children.find(c => c.part_type === 'paintAndIronmongeryPart')
  paint.values.ironmongeryLines = bm.ironmongeryLines.map(l => ({ ...l }))
  return tree
}

const STORMPROOF_FRAME = {
  leftWidth: 41, rightWidth: 41, topHeight: 41, bottomHeight: 56,
  frameDepth: 69, frameHeadStopSize: 15, frameStileStopSize: 15,
  cillStopSize: 15, jambType: 'solid_profiled',
}

// ── The profile ─────────────────────────────────────────────────────────────

describe('Step AU — the stormproof sections', () => {
  it('resolves Integrate’s own values once sql/step-au1 has run', () => {
    const { values, missing } = stormproofProfileDefaults(PV)
    expect(missing).toEqual([])
    expect(values).toMatchObject({
      frameJambLeft: 41, frameJambRight: 41, frameHead: 41, frameBottom: 56,
      frameDepth: 69, headStop: 15, stileStop: 15, cillStop: 15,
      cillHeight: 56, cillDepth: 69, sashBottom: 76, sashOverlap: 7,
    })
  })

  it('reports every missing key before the SQL has run, and converts nothing', () => {
    const { missing } = stormproofProfileDefaults(PV_BEFORE_SQL)
    expect(missing.length).toBe(12)
    expect(missing.join(' ')).toMatch(/stormProofLeftWidth/)
    // All-or-nothing: no half set of sections
    expect(stormproofSectionsFor(PV_BEFORE_SQL)).toBeNull()
  })

  it('a stormproof build with no sections fails instead of falling back to flush', () => {
    const { tree, missing } = buildCasementFrame(PV_BEFORE_SQL, {
      width: 499, height: 999, openings: ['opening_casement'], stormproof: true,
    })
    expect(tree).toBeNull()
    expect(missing.length).toBeGreaterThan(0)
  })
})

// ── The template ────────────────────────────────────────────────────────────

describe('Step AU — the Single Stormproof Casement template', () => {
  it('is Integrate’s template 21: 499 x 999, one LH stormproof opener', () => {
    const { tree, missing } = buildCasementFrame(PV, {
      width: 499, height: 999, openings: ['opening_casement'],
      stormproof: true, product: 'casement',
    })
    expect(missing).toEqual([])
    expect(frameOf(tree).values).toMatchObject({ width: 499, height: 999, ...STORMPROOF_FRAME })
    expect(cillOf(tree).values).toMatchObject({ height: 56, depth: 69 })

    const sash = openingNodes(tree)[0]
    expect(sash.values).toMatchObject({
      operation: 'left_hand_hung',
      casementTypeId: SASH_TYPE_STORMPROOF,
      thickness: 54, topHeight: 62, leftWidth: 62, rightWidth: 62,
      bottomHeight: 76,                 // Nathan, 13 Oct — not Integrate's 83
      stormProofOverlap: 7,
      mechanicalClearanceLeft: 4, mechanicalClearanceBottom: 4,
    })
    expect(isStormproofWindow(tree)).toBe(true)
    expect(() => assertSaveable(tree)).not.toThrow()
    expect(findRequiredEmpty(tree, REQUIRED_DEFS)).toEqual([])
  })

  it('a flush build is completely unchanged by this step', () => {
    const { tree } = buildCasementFrame(PV, {
      width: 1200, height: 1300, openings: ['opening_casement'], product: 'casement',
    })
    expect(frameOf(tree).values).toMatchObject({
      leftWidth: 37, rightWidth: 37, topHeight: 47, frameDepth: 96,
      frameHeadStopSize: 20, cillStopSize: 20,
    })
    expect(cillOf(tree).values).toMatchObject({ height: 47, depth: 128 })
    const sash = openingNodes(tree)[0]
    expect(sash.values.casementTypeId).toBe(SASH_TYPE_FLUSH)
    expect(sash.values.bottomHeight).toBe(83)
    expect(sash.values.stormProofOverlap).toBeUndefined()
    expect(isStormproofWindow(tree)).toBe(false)
  })
})

// ── Converting ──────────────────────────────────────────────────────────────

describe('Step AU — converting a whole window', () => {
  const flushDouble = () => {
    const { tree } = buildCasementFrame(PV, {
      width: 1199, height: 1299, openings: ['opening_casement'], product: 'casement',
    })
    return applyGrid(tree, 2, 1)
  }

  it('turning it on converts the frame, the cill and EVERY sash', () => {
    const before = flushDouble()
    const { tree, changed, missing } = setStormproof(before, true, PV)
    expect(missing).toEqual([])
    expect(changed.length).toBeGreaterThan(0)
    expect(frameOf(tree).values).toMatchObject(STORMPROOF_FRAME)
    expect(cillOf(tree).values).toMatchObject({ height: 56, depth: 69 })
    for (const sash of openingNodes(tree)) {
      expect(isStormproofSash(sash)).toBe(true)
      expect(sash.values.bottomHeight).toBe(76)
      expect(sash.values.stormProofOverlap).toBe(7)
    }
    expect(isStormproofWindow(tree)).toBe(true)
  })

  it('turning it off restores the flush values and REMOVES the overlap', () => {
    const storm = setStormproof(flushDouble(), true, PV).tree
    const { tree } = setStormproof(storm, false, PV)
    expect(frameOf(tree).values).toMatchObject({
      leftWidth: 37, rightWidth: 37, topHeight: 47, bottomHeight: 47,
      frameDepth: 96, frameHeadStopSize: 20, frameStileStopSize: 20, cillStopSize: 20,
    })
    expect(cillOf(tree).values).toMatchObject({ height: 47, depth: 128 })
    for (const sash of openingNodes(tree)) {
      expect(sash.values.casementTypeId).toBe(SASH_TYPE_FLUSH)
      expect(sash.values.bottomHeight).toBe(83)
      // removed, not zeroed — a flush sash has no lap at all
      expect('stormProofOverlap' in sash.values).toBe(false)
    }
    expect(isStormproofWindow(tree)).toBe(false)
  })

  it('a conversion the profile cannot supply changes NOTHING', () => {
    const before = flushDouble()
    const { tree, changed, missing } = setStormproof(before, true, PV_BEFORE_SQL)
    expect(missing.length).toBeGreaterThan(0)
    expect(changed).toEqual([])
    expect(tree).toBe(before)             // the very same object
    expect(isStormproofWindow(tree)).toBe(false)
  })

  it('the transom, the mullion and a direct glazed unit are untouched', () => {
    let { tree } = buildCasementFrame(PV, {
      width: 1199, height: 1299, openings: ['opening_casement'], product: 'casement',
    })
    tree = applyGrid(tree, 2, 1)
    tree = changeOpening(tree, openingNodes(tree)[1].key, 'direct_glazed', PV).tree
    const mullionBefore = JSON.stringify(
      frameOf(tree).children.find(c => c.part_type === 'mullionPart').values)
    const dguBefore = JSON.stringify(openingNodes(tree)[1].values)

    const after = setStormproof(tree, true, PV).tree
    expect(JSON.stringify(frameOf(after).children
      .find(c => c.part_type === 'mullionPart').values)).toBe(mullionBefore)
    expect(JSON.stringify(openingNodes(after)[1].values)).toBe(dguBefore)
    // ...while the sash beside it did convert
    expect(isStormproofSash(openingNodes(after)[0])).toBe(true)
  })

  it('a bottom rail the surveyor typed survives the conversion both ways', () => {
    const before = flushDouble()
    openingNodes(before)[0].values.bottomHeight = 70
    const storm = setStormproof(before, true, PV).tree
    expect(openingNodes(storm)[0].values.bottomHeight).toBe(70)
    expect(openingNodes(storm)[1].values.bottomHeight).toBe(76)
    const back = setStormproof(storm, false, PV).tree
    expect(openingNodes(back)[0].values.bottomHeight).toBe(70)
    expect(openingNodes(back)[1].values.bottomHeight).toBe(83)
  })

  it('stormproofSashValues moves a rail only off a PROFILE value', () => {
    const storm = stormproofProfileDefaults(PV).values
    const flush = { sashBottom: 83, sashBottomFanlight: 62 }
    // on a profile value -> moves
    expect(stormproofSashValues({ bottomHeight: 83 }, true, storm, flush).bottomHeight).toBe(76)
    expect(stormproofSashValues({ bottomHeight: 62 }, true, storm, flush).bottomHeight).toBe(76)
    // the surveyor's own -> kept
    expect(stormproofSashValues({ bottomHeight: 70 }, true, storm, flush).bottomHeight).toBe(70)
  })
})

// ── Fanlights and later openings ────────────────────────────────────────────

describe('Step AU — fanlights and openings added later', () => {
  const stormSingle = () => setStormproof(
    buildCasementFrame(PV, {
      width: 1040, height: 980, openings: ['opening_casement'], product: 'casement',
    }).tree, true, PV).tree

  it('a stormproof fanlight keeps 76, not the flush 62', () => {
    const withRow = applyGrid(stormSingle(), 1, 2)
    expect(openingLabel(withRow, openingNodes(withRow)[0])).toBe('Fanlight A1')
    expect(openingNodes(withRow).map(n => n.values.bottomHeight)).toEqual([76, 76])
    // the flush rule still applies to a FLUSH window
    const flush = applyGrid(buildCasementFrame(PV, {
      width: 1040, height: 980, openings: ['opening_casement'], product: 'casement',
    }).tree, 1, 2)
    expect(openingNodes(flush).map(n => n.values.bottomHeight)).toEqual([62, 83])
  })

  it('an opening added by the picker is stormproof (it copies the one it splits)', () => {
    const grid = applyGrid(stormSingle(), 2, 1)
    expect(openingNodes(grid)).toHaveLength(2)
    for (const sash of openingNodes(grid)) {
      expect(isStormproofSash(sash)).toBe(true)
      expect(sash.values.stormProofOverlap).toBe(7)
      expect(sash.values.bottomHeight).toBe(76)
    }
  })

  it('a direct glazed unit changed INTO a casement comes out stormproof', () => {
    let tree = applyGrid(stormSingle(), 2, 1)
    const b1 = openingNodes(tree)[1].key
    tree = changeOpening(tree, b1, 'direct_glazed', PV).tree
    expect(openingNodes(tree)[1].part_type).toBe('glassPart')
    const dguKey = openingNodes(tree)[1].key
    tree = changeOpening(tree, dguKey, 'opening_casement', PV).tree
    const back = openingNodes(tree)[1]
    expect(back.part_type).toBe('casementSashPart')
    expect(isStormproofSash(back)).toBe(true)
    expect(back.values.bottomHeight).toBe(76)
    expect(back.values.stormProofOverlap).toBe(7)
  })

  it('resizing a stormproof window behaves exactly as a flush one', () => {
    const grid = applyGrid(stormSingle(), 2, 1)
    // interior 1040 - 82 = 958, mullion 27 -> two 465.5 openings
    const { tree: wider } = resizeCasementFrame(grid, { width: 1199 })
    const frame = frameOf(wider)
    expect(frame.values.width).toBe(1199)
    // the proportions are kept (equal stays equal): interior 1117, openings 545
    const mullion = frame.children.find(c => c.part_type === 'mullionPart')
    expect(mullion.values.offset).toBe(545)
    // and it is still stormproof
    expect(isStormproofWindow(wider)).toBe(true)
  })
})

// ── The board builds the benchmarks ─────────────────────────────────────────

describe.skipIf(!SNAPSHOT)('Step AU — the board builds SA, SC and SF', () => {
  function expectSameAsFixture(tree, bm, label) {
    const board = priceFromSnapshot(tree, bm.ironmongeryLines)
    const fixture = priceFromSnapshot(bm.tree, bm.ironmongeryLines)
    expect(board.price.total_cost, `${label} cost`).toBeCloseTo(fixture.price.total_cost, 2)
    expect(board.price.total, `${label} price`).toBeCloseTo(fixture.price.total, 2)
    expect(board.manufacture_labour.total_minutes, `${label} production`)
      .toBe(fixture.manufacture_labour.total_minutes)
    expect(board.install_labour.total_minutes, `${label} labour`)
      .toBe(fixture.install_labour.total_minutes)
  }

  it('SC: template → stormproof → resize → transom → A1 fixed', () => {
    let { tree } = buildCasementFrame(PV, {
      width: 1040, height: 980, openings: ['opening_casement'], product: 'casement',
    })
    tree = setStormproof(tree, true, PV).tree
    tree = applyGrid(tree, 1, 2)
    // Integrate's fanlight row is 349 on this frame, not the template's 356
    frameOf(tree).children.find(c => c.part_type === 'transomPart').values.offset = 349
    const a1 = openingNodes(tree)[0]
    tree = setCasementOperation(tree, a1.key, 'fix').tree

    expect(() => assertSaveable(tree), 'SC containment').not.toThrow()
    expect(findRequiredEmpty(tree, REQUIRED_DEFS), 'SC required').toEqual([])
    expectSameAsFixture(withFixtureIronmongery(tree, BENCHMARK_SC), BENCHMARK_SC, 'SC')
  })

  it('SF: template → stormproof → resize → mullion → B1 direct glazed', () => {
    let { tree } = buildCasementFrame(PV, {
      width: 1199, height: 1299, openings: ['opening_casement'], product: 'casement',
    })
    tree = setStormproof(tree, true, PV).tree
    tree = applyGrid(tree, 2, 1)
    tree = changeOpening(tree, openingNodes(tree)[1].key, 'direct_glazed', PV).tree

    expect(() => assertSaveable(tree), 'SF containment').not.toThrow()
    expect(findRequiredEmpty(tree, REQUIRED_DEFS), 'SF required').toEqual([])
    expectSameAsFixture(withFixtureIronmongery(tree, BENCHMARK_SF), BENCHMARK_SF, 'SF')
  })

  it('SA from GlazePro’s template differs from fixture SA in timber and glass ONLY', () => {
    // GlazePro uses 76 everywhere; Integrate's template drawing (SA) has 83.
    // The brief: assert the difference is sash timber and glass alone.
    const { tree } = buildCasementFrame(PV, {
      width: 599, height: 1199, openings: ['opening_casement'],
      stormproof: true, product: 'casement',
    })
    withFixtureIronmongery(tree, BENCHMARK_SA)
    const ours = priceFromSnapshot(tree, BENCHMARK_SA.ironmongeryLines)
    const theirs = priceFromSnapshot(BENCHMARK_SA.tree, BENCHMARK_SA.ironmongeryLines)

    expect(openingNodes(tree)[0].values.bottomHeight).toBe(76)
    // 76 instead of 83: sash timber 11.12 against 11.31, glass 0.41 against 0.40
    const qty = (r, name) => r.price.lines
      .filter(l => l.fires && l.name === name).map(l => l.quantity)
    expect(qty(ours, 'Softwood Casement Sashes')).toEqual([11.12])
    expect(qty(theirs, 'Softwood Casement Sashes')).toEqual([11.31])
    expect(qty(ours, 'Square Glass Cost')).toEqual([0.41])
    expect(qty(theirs, 'Square Glass Cost')).toEqual([0.4])

    // The energy surcharge is a function of the glass AREA, so it moves with
    // the glass: 0.41 m2 gives 8.20 where 0.40 gives 8.00. That is the glass
    // difference showing up on a second line, not a third difference.
    const energy = r => r.price.lines
      .filter(l => l.fires && l.name === 'All Glass Energy Surcharge').map(l => l.quantity)
    expect(energy(ours)).toEqual([8.2])
    expect(energy(theirs)).toEqual([8])

    // EVERY other line is identical — frame timber, cill, labour, production,
    // ironmongery, components, consumables, LTW.
    const others = r => r.price.lines
      .filter(l => l.fires && !l.error
        && l.name !== 'Softwood Casement Sashes' && l.name !== 'Square Glass Cost'
        && l.name !== 'All Glass Energy Surcharge')
      .map(l => `${l.name} ${l.quantity} ${l.line_cost.toFixed(2)}`).sort()
    expect(others(ours)).toEqual(others(theirs))

    // The hours do not move: the rail changes no minute rule
    expect(ours.manufacture_labour.total_minutes).toBe(theirs.manufacture_labour.total_minutes)
    expect(ours.install_labour.total_minutes).toBe(theirs.install_labour.total_minutes)
  })
})
