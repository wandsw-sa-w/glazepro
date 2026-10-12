// boardPath.test.js — Step AK item 3
//
// Benchmarks E and F are hand-built fixtures of Integrate's saved drawings.
// This file proves the other half: that a spiral window DRAWN ON GLAZEPRO'S
// BOARD prices the same. Nothing here is a fixture tree — each test starts
// from the board's own box sash build or from benchmark A, drives the real
// board code paths (buildNewBoxSash, applyOperationDefaults,
// applySashesReplaced, applyCompleteNewThickness) in the order
// DrawingBoard.jsx's field handler runs them, and then prices from the live
// snapshot and compares with Integrate.
//
// (The React handler itself cannot be called from a unit test; the brief
// names the three modules it calls, and this file calls exactly those, in
// the handler's order — see handleChangeField in src/pages/DrawingBoard.jsx.)

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import { buildNewBoxSash } from '../../drawingBoard/buildTree.js'
import { applyOperationDefaults } from '../../drawingBoard/applyOperationDefaults.js'
import { applySashesReplaced } from '../../drawingBoard/sashesReplaced.js'
import { applyCompleteNewThickness } from '../../drawingBoard/sashThickness.js'
import { computeDerived } from '../../drawingBoard/computeDerived.js'
import { assertSaveable } from '../../drawingBoard/containment.js'
import { internalSizeOf, keepInternalSize, frameFromInternalSize } from '../../drawingBoard/internalSize.js'
import {
  NEW_CILL_REPAIR_CODE, CILL_ONLY_TYPE_OF_WORK, cillRepairApplies, applyCillRules,
} from '../../drawingBoard/cillReplacement.js'
import {
  buildCasementFrame, changeOpening, setCasementOperation, openingNodes,
  openingKindOf, isCasementFrameTree,
} from '../../drawingBoard/casementOpenings.js'
import { applyDividers } from '../../drawingBoard/gridActions.js'
import { isSashWindow } from '../../drawingBoard/sashesReplaced.js'
import { isCompleteNewSashWindow } from '../../drawingBoard/sashThickness.js'
import { sizeEntryMode } from '../../drawingBoard/internalSize.js'
import { BENCHMARK_K, BENCHMARK_L, BENCHMARK_M, BENCHMARK_N, BENCHMARK_P } from './index.js'
import { runPricingOnTree } from '../pricingEngine.js'
import { resolveIronmongeryLines } from '../loadPricingContext.js'
import { BENCHMARK_A, BENCHMARK_B } from './index.js'
import INTEGRATE from './integrate-targets.json'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = resolve(__dirname, 'pf30-snapshot.json')
const SNAPSHOT = existsSync(SNAPSHOT_PATH) ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8')) : null

// ── The live reference options and profile values, as the board gets them ───
//
// sash_operation holds three options; only their LABELS are recorded in the
// repo (sql/step-b2c-applies-to.sql) — the spiral and fix CODES are live-only
// (docs/pricing-vocabulary-audit.md), so the code below is the fixtures'
// unverified 'spiral_hung'. applyOperationDefaults matches the LABEL, which
// is the part that is known.
const refOptions = {
  sash_operation: [
    { code: 'cord_hung',   label: 'Cord Hung' },
    { code: 'spiral_hung', label: 'Spiral Hung' },
    { code: 'fix',         label: 'Fix' },
  ],
  jamb_type: [
    { code: 'hollow_box_for_sash',   label: 'Hollow Box for Sash' },
    { code: 'solid_spiral_for_sash', label: 'Solid Spiral for Sash' },
  ],
}

// Integrate's spiral defaults = GlazePro's profile spiral defaults
// (docs/integrate-L31115-spiral.txt, last line: Jamb 28, Head 28, Depth 140,
// CillHeight 70, CillDepth 140, JambType Solid Spiral for Sash). The cord
// defaults are benchmark A's / L34046's read frame (85 / 79 / 140).
const profileValues = [
  { field_key: 'sashPairPart.defaultCordFrameHead',       default_value: '79' },
  { field_key: 'sashPairPart.defaultCordFrameJamb',       default_value: '85' },
  { field_key: 'sashPairPart.defaultCordFrameDepth',      default_value: '140' },
  { field_key: 'sashPairPart.defaultCordFrameJambType',   default_value: 'Hollow Box for Sash' },
  { field_key: 'sashPairPart.defaultCordCillHeight',      default_value: '70' },
  { field_key: 'sashPairPart.defaultCordCillDepth',       default_value: '140' },
  { field_key: 'sashPairPart.defaultSpiralFrameHead',     default_value: '28' },
  { field_key: 'sashPairPart.defaultSpiralFrameJamb',     default_value: '28' },
  { field_key: 'sashPairPart.defaultSpiralFrameDepth',    default_value: '140' },
  { field_key: 'sashPairPart.defaultSpiralFrameJambType', default_value: 'Solid Spiral for Sash' },
  { field_key: 'sashPairPart.defaultSpiralCillHeight',    default_value: '70' },
  { field_key: 'sashPairPart.defaultSpiralCillDepth',     default_value: '140' },
]

// The min_count rows that make buildNewBoxSash produce sashes and glass
// (same set as gridActions.test.js).
const CONTAINMENT = [
  { parent_code: 'sashPairPart',   child_code: 'topSashPart',    min_count: 1, sort_order: 10 },
  { parent_code: 'sashPairPart',   child_code: 'bottomSashPart', min_count: 1, sort_order: 20 },
  { parent_code: 'topSashPart',    child_code: 'glassPart',      min_count: 1, sort_order: 10 },
  { parent_code: 'bottomSashPart', child_code: 'glassPart',      min_count: 1, sort_order: 10 },
]

// ── Board actions (the real modules, in DrawingBoard's order) ───────────────

function setValues(tree, partType, values) {
  if (tree.part_type === partType) return { ...tree, values: { ...tree.values, ...values } }
  return { ...tree, children: (tree.children ?? []).map(c => setValues(c, partType, values)) }
}

/** Choosing a Type of Work: the field, then the 45 mm rule, then the sashes. */
function boardSetTypeOfWork(tree, typeOfWork) {
  let out = setValues(tree, 'drawingItemPart', { typeOfWork })
  out = applyCompleteNewThickness(out).tree     // Step AI
  out = applySashesReplaced(out).tree           // Step AJ
  return out
}

/**
 * Choosing a sash Operation: the field, then the frame/cill defaults, then
 * Step AL's "keep the sash size" on a sash replacement — the handler's order.
 */
function boardSetOperation(tree, operation) {
  const internalBefore = internalSizeOf(tree)
  let out = setValues(tree, 'topSashPart', { operation })
  out = setValues(out, 'bottomSashPart', { operation })
  out = applyOperationDefaults(out, profileValues, refOptions)    // OPERATION_FIELDS
  return keepInternalSize(out, internalBefore)                    // Step AL §2
}

function priceFromSnapshot(tree) {
  const ironmongeryLines = resolveIronmongeryLines(tree, SNAPSHOT, SNAPSHOT.profileValues)
  return runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
    glassCatalogue:       SNAPSHOT.glassCatalogue,
    partAllocationRules:  SNAPSHOT.partAllocationRules,
    partCostMap:          SNAPSHOT.partCostMap,
    ironmongeryLines,
    ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
    profileValues:        SNAPSHOT.profileValues,
  })
}

function expectTotals(results, target) {
  expect(results.price.total_cost).toBeCloseTo(target.total_cost, 2)
  expect(results.price.total).toBeCloseTo(target.total_price, 2)
}

const d = describe.skipIf(SNAPSHOT === null)

// ── F: a cord sash replacement switched to spiral, as Integrate made it ─────

d('Step AK item 3 — board path: spiral sash replacement (F)', () => {
  // Step AL §2 changed this deliberately. Integrate kept the overall frame
  // (1070 x 1849) and let the sashes grow 900 -> 1014 when the spiral jambs
  // went on, which is what benchmark F records. GlazePro keeps the SASH size
  // a surveyor measured and recomputes the frame instead
  // (docs/integrate-differences.md difference 3), so the same action on the
  // board no longer reproduces F's figure — F's fixture still does, and
  // still prices exactly (benchmarks.test.js).
  it('benchmark A + "both sashes Spiral Hung" keeps the sash size (difference 3)', () => {
    const before = internalSizeOf(BENCHMARK_A.tree)
    expect(before).toEqual({ width: 900, height: 1700 })

    const drawn = boardSetOperation(BENCHMARK_A.tree, 'spiral_hung')

    // The board made the frame switch Integrate makes...
    const frame = drawn.children.find(c => c.part_type === 'assemblyFramePart')
    expect(frame.values.jambType).toBe('solid_spiral_for_sash')
    expect([frame.values.leftWidth, frame.values.rightWidth, frame.values.topHeight]).toEqual([28, 28, 28])

    // ...but kept the sash size and recomputed the frame around it:
    // 900 + 28 + 28 = 956 and 1700 + 28 + 70 = 1798.
    expect(internalSizeOf(drawn)).toEqual({ width: 900, height: 1700 })
    expect([frame.values.width, frame.values.height]).toEqual([956, 1798])

    const pair = frame.children.find(c => c.part_type === 'sashPairPart')
    const der = computeDerived(drawn)[pair.key]
    expect(der.sashWidth).toBe(900)          // unchanged, as the surveyor measured
    expect(der.topSashHeight).toBe(850.5)    // = A's

    // Integrate's F geometry (sashes grown to 1014) is therefore NOT what
    // this board action produces, and its price is not F's.
    const priced = priceFromSnapshot(drawn)
    expect(priced.price.total).not.toBeCloseTo(INTEGRATE.benchmarkF_spiral_replacement.total_price, 2)
  })

  it('and switching back to Cord Hung prices exactly like A again', () => {
    const toSpiral = boardSetOperation(BENCHMARK_A.tree, 'spiral_hung')
    const backToCord = boardSetOperation(toSpiral, 'cord_hung')
    expectTotals(priceFromSnapshot(backToCord), INTEGRATE.benchmarkA)
  })
})

// ── A sash replacement entered by SASH size (Step AL) ──────────────────────

d('Step AL item 3 — board path: a replacement entered as 900 x 1700 internal', () => {
  it('produces benchmark A’s frame and prices 728.26 / 1,408.66', () => {
    // A surveyor measures the sashes, not the box frame. Start from
    // benchmark A's drawing with the frame size NOT yet entered, type the
    // sash size through the Step AL path, and the cord jambs give A's frame
    // and A's price to the penny.
    const blankFrame = JSON.parse(JSON.stringify(BENCHMARK_A.tree))
    const frame = blankFrame.children.find(c => c.part_type === 'assemblyFramePart')
    delete frame.values.width
    delete frame.values.height
    expect(internalSizeOf(blankFrame)).toEqual({ width: null, height: null })

    // Typing Internal Width / Height (the board's handleChangeInternalSize)
    const drawn = frameFromInternalSize(blankFrame, { width: 900, height: 1700 })

    const f = drawn.children.find(c => c.part_type === 'assemblyFramePart')
    expect([f.values.width, f.values.height]).toEqual([1070, 1849])   // A's frame
    expect(internalSizeOf(drawn)).toEqual({ width: 900, height: 1700 })

    expectTotals(priceFromSnapshot(drawn), INTEGRATE.benchmarkA)
  })

  it('and the drawn sash sizes are A’s', () => {
    const blankFrame = JSON.parse(JSON.stringify(BENCHMARK_A.tree))
    const fr = blankFrame.children.find(c => c.part_type === 'assemblyFramePart')
    delete fr.values.width
    delete fr.values.height
    const drawn = frameFromInternalSize(blankFrame, { width: 900, height: 1700 })
    const pair = drawn.children.find(c => c.part_type === 'assemblyFramePart')
      .children.find(c => c.part_type === 'sashPairPart')
    const der = computeDerived(drawn)[pair.key]
    expect(der.sashWidth).toBe(900)
    expect(der.topSashHeight).toBe(850.5)
    expect(der.bottomSashHeight).toBe(889.5)
  })
})

// ── Cill replacement set on the board (Step AM) ─────────────────────────────

d('Step AM — board path: cill replacement', () => {
  /** Choosing a Type of Work: the handler's order, now including the cill. */
  function boardSetTypeOfWorkWithCill(tree, typeOfWork) {
    let out = setValues(tree, 'drawingItemPart', { typeOfWork })
    out = applyCompleteNewThickness(out).tree          // Step AI
    out = applySashesReplaced(out).tree                // Step AJ
    return applyCillRules(out).tree                    // Step AM
  }

  /** Choosing Cill > Repair = New Cill (an ordinary field edit). */
  const boardSetNewCill = tree => setValues(tree, 'cillPart', { repair: NEW_CILL_REPAIR_CODE })

  it('G: benchmark A + Repair "New Cill" prices 829.78 / 1,809.71', () => {
    const base = JSON.parse(JSON.stringify(BENCHMARK_A.tree))
    const cill = base.children.find(c => c.part_type === 'assemblyFramePart')
      .children.find(c => c.part_type === 'cillPart')
    delete cill.values.repair
    expect(cillRepairApplies(base)).toBe(true)         // offered on a replacement

    const drawn = boardSetNewCill(base)
    expectTotals(priceFromSnapshot(drawn), INTEGRATE.benchmarkG_sash_replacement_new_cill)
  })

  it('H: benchmark B + Repair "New Cill" prices 309.86 / 923.70', () => {
    const base = JSON.parse(JSON.stringify(BENCHMARK_B.tree))
    expect(cillRepairApplies(base)).toBe(true)         // offered on a draught seal
    const drawn = boardSetNewCill(base)
    expectTotals(priceFromSnapshot(drawn), INTEGRATE.benchmarkH_draught_seal_new_cill_corrected)
  })

  it('I: benchmark B switched to "Cill Replacement Only" prices 101.53 / 401.05', () => {
    // The type of work alone sets the cill Repair and takes the sashes out
    // of replacement; the ironmongery line a draught seal sold is removed
    // as a user would (a stand-alone cill sells no fastener kit).
    const base = JSON.parse(JSON.stringify(BENCHMARK_B.tree))
    const drawn = boardSetTypeOfWorkWithCill(base, CILL_ONLY_TYPE_OF_WORK)

    const cill = drawn.children.find(c => c.part_type === 'assemblyFramePart')
      .children.find(c => c.part_type === 'cillPart')
    expect(cill.values.repair).toBe(NEW_CILL_REPAIR_CODE)   // set by the type of work
    for (const sash of ['topSashPart', 'bottomSashPart']) {
      const found = []
      ;(function walk(n) { if (n.part_type === sash) found.push(n); (n.children ?? []).forEach(walk) })(drawn)
      for (const sNode of found) expect(sNode.values.toBeReplaced).toBe(false)
    }

    const paint = drawn.children.find(c => c.part_type === 'paintAndIronmongeryPart')
    paint.values.ironmongeryLines = []
    expectTotals(priceFromSnapshot(drawn), INTEGRATE.benchmarkI_cill_only_corrected)
  })

  it('a complete new or no-work item is not offered a cill repair, and a stored one is cleared', () => {
    const withCill = boardSetNewCill(JSON.parse(JSON.stringify(BENCHMARK_B.tree)))
    for (const typeOfWork of ['complete_new', 'no_work']) {
      const switched = boardSetTypeOfWorkWithCill(withCill, typeOfWork)
      expect(cillRepairApplies(switched), typeOfWork).toBe(false)
      const cill = switched.children.find(c => c.part_type === 'assemblyFramePart')
        .children.find(c => c.part_type === 'cillPart')
      expect(cill.values.repair, typeOfWork).toBeNull()
      // ...so no cill is priced
      const fired = priceFromSnapshot(switched).price.lines
        .filter(l => l.fires && !l.error && l.line_cost > 0).map(l => l.name)
      expect(fired, typeOfWork).not.toContain('Cill Replacement Profit')
    }
  })
})

// ── E: a complete new spiral window drawn from scratch on the board ─────────

d('Step AK item 3 — board path: complete new spiral window (E)', () => {
  /**
   * Draw benchmark E on the board: start from the board's own box sash build,
   * then make the choices a user makes. Only values a user really enters are
   * set here — the frame jambs/head/depth, the jamb type, the cill sizes, the
   * sash thickness and both sashes' To Be Replaced all come from the board's
   * own code paths.
   */
  function drawSpiralCompleteNew() {
    const { tree } = buildNewBoxSash({
      profile: null, fieldDefs: {}, profileValues, containment: CONTAINMENT, refOptions,
    })

    // Type of work → 45 mm (Step AI) and both sashes replaced (Step AJ)
    let t = boardSetTypeOfWork(tree, 'complete_new')

    // Materials, finishes and floor (item and finish fields)
    t = setValues(t, 'drawingItemPart', {
      isDocL: true,
      frameMaterialId: 'softwood', sashMaterialId: 'softwood', cillMaterialId: 'utile',
      partingBeadTypeId: 'standard', staffBeadTypeId: 'small',
      floorLevel: 'ground_floor',
    })
    t = setValues(t, 'paintAndIronmongeryPart', {
      internalFinish: 'clean_white', externalFinish: 'clean_white', cillFinish: 'clean_white',
      cutOutBrickReveal: false, ironmongeryFinish: 'PB',
    })
    t = setValues(t, 'notesPart', { installationMethod: 'internally' })

    // Frame size and stop sizes (the jambs, head, depth, jamb type and cill
    // are NOT set here — the operation change below supplies them)
    t = setValues(t, 'assemblyFramePart', {
      width: 1000, height: 1500, bottomHeight: 70,
      frameHeadStopSize: 16, frameStileStopSize: 16, cillStopSize: 16,
      rakeFrame: false, archHead: false,
    })

    // Sash pair, rails and stiles
    t = setValues(t, 'sashPairPart', {
      midrailHeight: 40,
      mechanicalClearanceLeft: 2.5, mechanicalClearanceRight: 2.5,
      mechanicalClearanceTop: 0, mechanicalClearanceBottom: 0,
      topHornTypeShortName: 'victorian', topHornLength: 75,
      bottomHornTypeShortName: 'no_horn', bottomHornLength: 0,
      sashSplit: 'half_half',
    })
    t = setValues(t, 'topSashPart', { topHeight: 49, leftWidth: 49, rightWidth: 49, archHead: false })
    t = setValues(t, 'bottomSashPart', {
      bottomHeight: 88, leftWidth: 49, rightWidth: 49,
      btmRailShapeId: 'chamfered', chamferedBottomRailAngle: 9,
    })
    t = setValues(t, 'glassPart', {
      glazingId: 'double_glazing', isIndividualPanes: false,
      internalGlassPartNo: 'GL100010', externalGlassPartNo: 'GL100080',
    })

    // Both sashes Spiral Hung → the board stamps the spiral frame and cill
    return boardSetOperation(t, 'spiral_hung')
  }

  it('prices exactly like benchmark E', () => {
    const drawn = drawSpiralCompleteNew()
    expectTotals(priceFromSnapshot(drawn), INTEGRATE.benchmarkE_spiral_complete_new)
  })

  it('the board supplied the spiral frame, cill, 45 mm and both sashes replaced', () => {
    const drawn = drawSpiralCompleteNew()
    const frame = drawn.children.find(c => c.part_type === 'assemblyFramePart')
    expect(frame.values.jambType).toBe('solid_spiral_for_sash')
    expect([frame.values.leftWidth, frame.values.rightWidth, frame.values.topHeight]).toEqual([28, 28, 28])
    expect(frame.values.frameDepth).toBe(140)

    const cill = frame.children.find(c => c.part_type === 'cillPart')
    expect([cill.values.height, cill.values.depth]).toEqual([70, 140])

    const pair = frame.children.find(c => c.part_type === 'sashPairPart')
    expect(pair.values.sashThickness).toBe(45)          // Step AI
    for (const sash of pair.children) {
      if (sash.part_type.endsWith('SashPart')) expect(sash.values.toBeReplaced).toBe(true)  // Step AJ
    }

    // Integrate's drawn sizes for E
    const der = computeDerived(drawn)[pair.key]
    expect(der.sashWidth).toBe(939)
    expect(der.topSashHeight).toBe(701.5)
    expect(der.topSashHeight - 49 - 40).toBe(612.5)
  })
})

// ── Step AP — casement and direct glazed frames BUILT ON THE BOARD ─────────
// Step AO's J–P are hand-built fixtures of Integrate's drawings. These tests
// build K, L, M, N and P through the real board code — the template tree
// (casementOpenings.buildCasementFrame, which is what sql/step-ap1 stores),
// then resize, then the mullion picker (gridActions.applyDividers), then
// "Change to" / the operation buttons — and price the result from the
// snapshot. With the fixtures' stored ironmongery list injected they must
// give the SAME totals and hours as the fixtures.
describe('Step AP — the board builds the casement benchmarks', () => {
  // The casement profile's values, as the reviewer read them live
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
    'casementSashPart.defaultFanlightBottomHeight': 83,
    'casementSashPart.mechanicalClearance': 4, 'casementSashPart.btmRailShapeId': 'square',
    'glassPart.defaultDoubleGlazingRebateWidthForSash': 16,
    'glassPart.defaultDoubleGlazingTolerance': 2,
    'glassPart.defaultDirGuStopSize': 20,
    'glassPart.defaultDoubleGlazingRebateWidthForDirGU': 20,
    'glassPart.defaultDoubleGlazingToleranceForDirGU': 2,
  }
  // The short map the mullion picker takes
  const PICKER_PV = { thicknessInFrameSolid: 27, mullionStopSize: 20 }

  /** The board's own resize: type the frame size. */
  function setFrameSize(tree, width, height) {
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    frame.values.width = width
    frame.values.height = height
    return tree
  }

  /** The mullion picker, as DrawingBoard calls it on a casement frame. */
  function applyColumns(tree, cols) {
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    const cill = frame.children.find(c => c.part_type === 'cillPart')
    const iW = frame.values.width - frame.values.leftWidth - frame.values.rightWidth
    const iH = frame.values.height - frame.values.topHeight - cill.values.height
    expect(isCasementFrameTree(tree)).toBe(true)      // so the picker goes solid
    return applyDividers(tree, frame.key, cols, 1, iW, iH, PICKER_PV, 'solid')
  }

  /** Give the board tree the fixtures' stored ironmongery list. */
  function withFixtureIronmongery(tree, bm) {
    const paint = tree.children.find(c => c.part_type === 'paintAndIronmongeryPart')
    paint.values.ironmongeryLines = bm.ironmongeryLines.map(l => ({ ...l }))
    return tree
  }

  /** Price a board tree exactly as the fixtures are priced. */
  function priceBoardTree(tree) {
    return priceFromSnapshot(tree)
  }

  function expectSameAsFixture(tree, bm, label) {
    // Step AQ: a tree that prices correctly but cannot be SAVED is no use.
    // save_drawing_parts refused the direct glazed unit these tests built,
    // and no test noticed, so every board-path comparison now runs the same
    // containment check the save runs.
    expect(() => assertSaveable(tree), `${label} saveable`).not.toThrow()
    const board = priceBoardTree(tree)
    const fixture = priceFromSnapshot(bm.tree)
    expect(board.price.total_cost, `${label} cost`).toBeCloseTo(fixture.price.total_cost, 2)
    expect(board.price.total, `${label} price`).toBeCloseTo(fixture.price.total, 2)
    expect(board.manufacture_labour.total_minutes, `${label} production`)
      .toBe(fixture.manufacture_labour.total_minutes)
    expect(board.install_labour.total_minutes, `${label} labour`)
      .toBe(fixture.install_labour.total_minutes)
  }

  it('K: template → resize → mullion → change B1 to direct glazed', () => {
    // Start from the Single Flush Casement template
    let { tree, missing } = buildCasementFrame(PV, { openings: ['opening_casement'] })
    expect(missing).toEqual([])
    tree = setFrameSize(tree, 1199, 1299)
    tree = applyColumns(tree, 2)                       // adds the solid mullion + copies A1
    const b1 = openingNodes(tree)[1]
    tree = changeOpening(tree, b1.key, 'direct_glazed', PV).tree
    expect(openingNodes(tree).map(openingKindOf)).toEqual(['opening_casement', 'direct_glazed'])
    expectSameAsFixture(withFixtureIronmongery(tree, BENCHMARK_K), BENCHMARK_K, 'K')
  })

  it('L: Direct Glazed Frame template → resize → mullion (copies the unit)', () => {
    let { tree } = buildCasementFrame(PV, { openings: ['direct_glazed'] })
    tree = setFrameSize(tree, 1199, 1299)
    tree = applyColumns(tree, 2)
    expect(openingNodes(tree).map(openingKindOf)).toEqual(['direct_glazed', 'direct_glazed'])
    expectSameAsFixture(withFixtureIronmongery(tree, BENCHMARK_L), BENCHMARK_L, 'L')
  })

  it('M: Direct Glazed Frame template → resize only', () => {
    let { tree } = buildCasementFrame(PV, { openings: ['direct_glazed'] })
    tree = setFrameSize(tree, 1199, 1299)
    expect(openingNodes(tree).map(openingKindOf)).toEqual(['direct_glazed'])
    expectSameAsFixture(withFixtureIronmongery(tree, BENCHMARK_M), BENCHMARK_M, 'M')
  })

  it('N: template → resize → mullion → B1 set to Fix', () => {
    // The mullion is added AFTER the resize so it is centred on the final
    // frame. Resizing a frame does NOT move mullions already on it (a
    // surveyor may have placed them deliberately), so opening a Double
    // template and resizing leaves its mullion at the template's offset —
    // on 1199 that is 549.5 instead of 549, which is 1p of glass and
    // timber. Reported in docs/step-ap-findings.md.
    let { tree } = buildCasementFrame(PV, { openings: ['opening_casement'] })
    tree = setFrameSize(tree, 1199, 1299)
    tree = applyColumns(tree, 2)
    const b1 = openingNodes(tree)[1]
    tree = setCasementOperation(tree, b1.key, 'fix').tree
    expect(openingNodes(tree).map(openingKindOf)).toEqual(['opening_casement', 'fixed_casement'])
    expectSameAsFixture(withFixtureIronmongery(tree, BENCHMARK_N), BENCHMARK_N, 'N')
  })

  it('resizing does not move a mullion already on the frame (reported)', () => {
    // The Double Flush Casement template centres its mullion on 1200
    // (offset 549.5); resizing to 1199 leaves it there.
    let { tree } = buildCasementFrame(PV, { openings: ['opening_casement', 'opening_casement'] })
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    expect(frame.children.find(c => c.part_type === 'mullionPart').values.offset).toBe(549.5)
    tree = setFrameSize(tree, 1199, 1299)
    expect(frame.children.find(c => c.part_type === 'mullionPart').values.offset).toBe(549.5)
    // Re-applying the picker re-centres it on the new size
    tree = applyColumns(tree, 2)
    expect(tree.children.find(c => c.part_type === 'assemblyFramePart')
      .children.find(c => c.part_type === 'mullionPart').values.offset).toBe(549)
  })

  it('P: Single Flush Casement template → resize to 1599 x 1599', () => {
    let { tree } = buildCasementFrame(PV, { openings: ['opening_casement'] })
    tree = setFrameSize(tree, 1599, 1599)
    expectSameAsFixture(withFixtureIronmongery(tree, BENCHMARK_P), BENCHMARK_P, 'P')
  })

  it('a board-built direct glazed unit stores its hidden-in-rebate, so no warning', () => {
    let { tree } = buildCasementFrame(PV, { openings: ['direct_glazed'] })
    tree = setFrameSize(tree, 1199, 1299)
    const warnings = priceFromSnapshot(tree).warnings.filter(w => w.includes('hidden in the rebate'))
    expect(warnings).toEqual([])
  })

  it('a direct glazed unit WITHOUT it warns instead of pricing the visible size', () => {
    let { tree } = buildCasementFrame(PV, { openings: ['direct_glazed'] })
    tree = setFrameSize(tree, 1199, 1299)
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    const dgu = frame.children.find(c => c.part_type === 'glassPart')
    for (const k of ['hiddenInRebateLeft', 'hiddenInRebateRight', 'hiddenInRebateTop', 'hiddenInRebateBottom']) {
      delete dgu.values[k]
    }
    const r = priceFromSnapshot(tree)
    expect(r.warnings.some(w => w.includes('hidden in the rebate'))).toBe(true)
    // and the glass really is smaller, which is why it must warn
    const area = r.price.lines.find(l => l.fires && l.name === 'Square Glass Cost').quantity
    expect(area).toBeLessThan(1.35)
  })

  // Item 5: with NO stored list, Integrate's own default_ironmongery rules
  // price the ironmongery and follow the openings.
  it('the default ironmongery list follows the openings (no stored list)', () => {
    const lines = tree => resolveIronmongeryLines(tree, SNAPSHOT, SNAPSHOT.profileValues)
      .map(l => `${l.product_short_name}:${l.finish_code} x${l.qty}`).sort()

    // K's shape: one opening casement + one direct glazed unit
    let { tree: k } = buildCasementFrame(PV, { openings: ['opening_casement'] })
    k = setFrameSize(k, 1199, 1299)
    k = applyColumns(k, 2)
    k = changeOpening(k, openingNodes(k)[1].key, 'direct_glazed', PV).tree
    const kLines = lines(k)
    expect(kLines.length).toBeGreaterThan(0)

    // N's shape: the same frame with B1 FIXED instead — a fixed sash gets no
    // handle, gearbox or extensions, so the list must shrink
    let { tree: n } = buildCasementFrame(PV, {
      openings: ['opening_casement', 'opening_casement'],
    })
    n = setFrameSize(n, 1199, 1299)
    // The lines MERGE by product and finish, so fixing B1 halves the
    // quantities rather than removing lines: handle, gearbox, hinge and
    // extensions all drop from 2 (or 4) to 1 (or 2).
    const totalQty = t => resolveIronmongeryLines(t, SNAPSHOT, SNAPSHOT.profileValues)
      .filter(l => /connoisseur|kenrick|hinge/.test(l.product_short_name))
      .reduce((sum, l) => sum + l.qty, 0)
    const bothQty = totalQty(n)
    n = setCasementOperation(n, openingNodes(n)[1].key, 'fix').tree
    const fixedQty = totalQty(n)
    expect(fixedQty).toBeLessThan(bothQty)
    expect(fixedQty * 2).toBe(bothQty)      // exactly half: one opening sash, not two

    // A frame of only direct glazed units sells no casement ironmongery
    let { tree: l } = buildCasementFrame(PV, { openings: ['direct_glazed'] })
    l = setFrameSize(l, 1199, 1299)
    const lLines = lines(l)
    expect(lLines.filter(s => s.includes('connoisseur') || s.includes('kenrick'))).toEqual([])
  })

  it('Casement MPLS is on by default and the surveyor can turn it off', () => {
    let { tree } = buildCasementFrame(PV, { openings: ['opening_casement'] })
    tree = setFrameSize(tree, 1199, 1299)
    const paint = tree.children.find(c => c.part_type === 'paintAndIronmongeryPart')
    expect(paint.values.isCasementMpls).toBe(true)
    const withMpls = resolveIronmongeryLines(tree, SNAPSHOT, SNAPSHOT.profileValues).length
    paint.values.isCasementMpls = false
    const without = resolveIronmongeryLines(tree, SNAPSHOT, SNAPSHOT.profileValues).length
    expect(without).toBeLessThan(withMpls)
  })

  it('the sash-only board rules do not touch a casement drawing', () => {
    const { tree } = buildCasementFrame(PV, { openings: ['opening_casement'] })
    expect(isSashWindow(tree)).toBe(false)
    expect(isCompleteNewSashWindow(tree)).toBe(false)
    expect(sizeEntryMode(tree)).toBe('frame_only')
    expect(cillRepairApplies(tree)).toBe(false)
    // and the rules themselves change nothing
    expect(applySashesReplaced(tree).sashesChanged).toEqual([])
    expect(applyCompleteNewThickness(tree).pairsChanged).toEqual([])
    expect(applyCillRules(tree).changed).toEqual([])
  })

  // Reads either thickness key, so this block is unaffected by item 3's
  // migration from sashThickness to thickness.
  const sashThicknessOf = s => s.values.thickness ?? s.values.sashThickness

  // ── Step AQ item 2 — making an opening fixed keeps its sections ──────────
  // The reviewer's live test (12 Oct, L507712 item 8): B1 was an opening
  // casement copied from A1 (62/62/62/83, 54 thick, clearance 4), and
  // "Change to: Fixed casement" saved it as 94/94/94/47, 58 thick,
  // clearance 2 — glass 0.42 instead of 0.48, sash timber 17.55 instead of
  // 12.25. changeOpening rebuilt the sash from the profile instead of just
  // setting the operation.
  it('N: Double template at 1199 → B1 Fixed casement → exactly N', () => {
    // Built at the final size so the mullion is centred (549) and this test
    // is about §2 alone, not the resize behaviour of §7.
    let { tree } = buildCasementFrame(PV, {
      width: 1199, height: 1299,
      openings: ['opening_casement', 'opening_casement'],
    })
    const b1 = openingNodes(tree)[1]
    const { tree: next, changed } = changeOpening(tree, b1.key, 'fixed_casement', PV)
    expect(changed).toBe(true)
    tree = next

    // The sash is the SAME node, with only its operation changed
    const after = openingNodes(tree)
    expect(after[1].key).toBe(b1.key)
    expect(after.map(openingKindOf)).toEqual(['opening_casement', 'fixed_casement'])
    expect(after[1].values.operation).toBe('fix')

    // Every section survives — these are the numbers the live save lost
    for (const sash of after) {
      expect(sash.values.topHeight).toBe(62)
      expect(sash.values.leftWidth).toBe(62)
      expect(sash.values.rightWidth).toBe(62)
      expect(sash.values.bottomHeight).toBe(83)
      expect(sashThicknessOf(sash)).toBe(54)
      expect(sash.values.mechanicalClearanceLeft).toBe(4)
      expect(sash.values.mechanicalClearanceRight).toBe(4)
    }
    expectSameAsFixture(withFixtureIronmongery(tree, BENCHMARK_N), BENCHMARK_N, 'N')
  })

  it('the "Fixed casement" change and the "fix" button give the same tree', () => {
    // Integrate's Fix is one operation reached two ways; they must not differ
    const build = () => buildCasementFrame(PV, {
      width: 1199, height: 1299,
      openings: ['opening_casement', 'opening_casement'],
    }).tree
    const viaChange = (() => {
      const t = build()
      return changeOpening(t, openingNodes(t)[1].key, 'fixed_casement', PV).tree
    })()
    const viaButton = (() => {
      const t = build()
      return setCasementOperation(t, openingNodes(t)[1].key, 'fix').tree
    })()
    const strip = t => JSON.stringify(openingNodes(t).map(n => n.values))
    expect(strip(viaChange)).toBe(strip(viaButton))
    expect(priceFromSnapshot(withFixtureIronmongery(viaChange, BENCHMARK_N)).price.total)
      .toBeCloseTo(priceFromSnapshot(withFixtureIronmongery(viaButton, BENCHMARK_N)).price.total, 2)
  })

  it('a sash the surveyor has altered keeps its own sections when fixed', () => {
    // The real reason this must not rebuild: the sections may be the
    // surveyor's, not the profile's.
    let { tree } = buildCasementFrame(PV, { width: 1199, height: 1299, openings: ['opening_casement'] })
    const sash = openingNodes(tree)[0]
    sash.values.topHeight = 70
    sash.values.bottomHeight = 120
    tree = changeOpening(tree, sash.key, 'fixed_casement', PV).tree
    const after = openingNodes(tree)[0]
    expect(after.values.topHeight).toBe(70)
    expect(after.values.bottomHeight).toBe(120)
    expect(after.values.operation).toBe('fix')
  })

  it('fixed → opening casement gives it a hinge side and keeps its sections', () => {
    let { tree } = buildCasementFrame(PV, { width: 1199, height: 1299, openings: ['opening_casement'] })
    const sash = openingNodes(tree)[0]
    tree = changeOpening(tree, sash.key, 'fixed_casement', PV).tree
    tree = changeOpening(tree, sash.key, 'opening_casement', PV).tree
    const after = openingNodes(tree)[0]
    expect(after.key).toBe(sash.key)
    expect(after.values.operation).toBe('left_hand_hung')
    expect(after.values.topHeight).toBe(62)
    expect(sashThicknessOf(after)).toBe(54)
  })

  it('a direct glazed unit becoming a casement DOES build a new sash', () => {
    // There is no sash to keep, so the profile is the only source — the one
    // case where building is right (brief §2).
    let { tree } = buildCasementFrame(PV, { width: 1199, height: 1299, openings: ['direct_glazed'] })
    const dgu = openingNodes(tree)[0]
    const { tree: next, changed } = changeOpening(tree, dgu.key, 'opening_casement', PV)
    expect(changed).toBe(true)
    const after = openingNodes(next)[0]
    expect(after.part_type).toBe('casementSashPart')
    expect(after.key).not.toBe(dgu.key)
    expect(after.values.topHeight).toBe(62)
    expect(sashThicknessOf(after)).toBe(54)
  })

  // ── Step AQ item 3 — one key for the sash thickness ──────────────────────
  it('a drawing saved with the OLD sashThickness key still prices the same', () => {
    // L507712 item 8 was saved before the migration, and the reviewer will
    // re-test on it, so it must keep working. casementSashThicknessMm reads
    // `thickness` and falls back to `sashThickness`.
    const fresh = JSON.parse(JSON.stringify(BENCHMARK_N.tree))
    const sashes = openingNodes(fresh).filter(n => n.part_type === 'casementSashPart')
    expect(sashes.length).toBeGreaterThan(0)
    for (const sash of sashes) {
      expect(sash.values.thickness).toBe(54)
      sash.values.sashThickness = sash.values.thickness
      delete sash.values.thickness
    }
    const oldKey = priceFromSnapshot(fresh)
    const newKey = priceFromSnapshot(BENCHMARK_N.tree)
    expect(oldKey.price.total_cost).toBeCloseTo(newKey.price.total_cost, 2)
    expect(oldKey.price.total).toBeCloseTo(newKey.price.total, 2)
  })

  it('a casement sash with NO thickness at all prices no sash timber', () => {
    // Not a silent 54: a missing thickness must give 0, so a tree built some
    // other way cannot quietly inherit a default section.
    const fresh = JSON.parse(JSON.stringify(BENCHMARK_N.tree))
    for (const sash of openingNodes(fresh).filter(n => n.part_type === 'casementSashPart')) {
      delete sash.values.thickness
      delete sash.values.sashThickness
    }
    const r = priceFromSnapshot(fresh)
    const timber = r.price.lines.filter(l => l.fires && /Casement Sashes/i.test(l.name))
    for (const line of timber) expect(line.quantity).toBe(0)
    expect(r.price.total_cost).toBeLessThan(priceFromSnapshot(BENCHMARK_N.tree).price.total_cost)
  })

  // ── Step AQ item 5 — the default finish rule ─────────────────────────────
  it("K's default hinges, gearbox and extensions price in PC, not the item's PB", () => {
    // They exist ONLY in PC; the casement item finish is PB. Before the fix
    // all three resolved to PB, found nothing and priced 0.00.
    let { tree } = buildCasementFrame(PV, { width: 1199, height: 1299, openings: ['opening_casement'] })
    tree = applyColumns(tree, 2)
    tree = changeOpening(tree, openingNodes(tree)[1].key, 'direct_glazed', PV).tree

    const lines = resolveIronmongeryLines(tree, SNAPSHOT, SNAPSHOT.profileValues)
    const byName = name => lines.find(l => l.product_short_name === name)
    expect(byName('defender_friction_hinge_-_side_hung_310mm').finish_code).toBe('PC')
    expect(byName('kenrick_extension_gear_box').finish_code).toBe('PC')
    expect(byName('kenrick_extension_950mm').finish_code).toBe('PC')
    // the handle DOES exist in PB, so it keeps the item's finish
    expect(byName('connoisseur_handle_lh').finish_code).toBe('PB')
    // and the white vents still come from their rule
    expect(byName('trickle_vent_xr16').finish_code).toBe('Wht')

    // No "product not found" warnings left for these three
    const r = priceFromSnapshot(tree)
    expect(r.warnings.filter(w => /product not found/i.test(w))).toEqual([])

    // The hinge now actually prices (7.82 -> 8 -> x1.05)
    const hinge = r.price.lines.find(l => l.fires && l.alloc_iron_part_code === 'RFH203')
    expect(hinge).toBeTruthy()
    expect(hinge.line_cost).toBeCloseTo(8.40, 2)
  })

  it('the breakdown label says which finish each line used', () => {
    let { tree } = buildCasementFrame(PV, { width: 1199, height: 1299, openings: ['opening_casement'] })
    const r = priceFromSnapshot(tree)
    const labels = r.price.lines.filter(l => l.fires && l.alloc_label).map(l => l.alloc_label)
    expect(labels).toContain('connoisseur_handle_lh (PB, item finish)')
    expect(labels.some(l => l.includes('(PC, rule finish)'))).toBe(true)
    expect(labels.some(l => l.includes('trickle_vent_xr16 (Wht, rule finish)'))).toBe(true)
  })
})
