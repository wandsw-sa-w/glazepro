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
import { internalSizeOf, keepInternalSize, frameFromInternalSize } from '../../drawingBoard/internalSize.js'
import {
  NEW_CILL_REPAIR_CODE, CILL_ONLY_TYPE_OF_WORK, cillRepairApplies, applyCillRules,
} from '../../drawingBoard/cillReplacement.js'
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
