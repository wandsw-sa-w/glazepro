// typeOfWorkOptions.test.js — Step BJ follow-up item 2
//
// THE TEST THAT WAS MISSING. Step BJ built the bi-glass rule, tested it
// thoroughly, and shipped it unreachable: the Type of Work select on a
// casement drawing offered Complete New and No Work only, so nobody could
// choose Bi-Glass and `applyBiGlassCasement` was never called from the board.
// Every offline test drove the rule directly.
//
// So this tests the OPTIONS a drawing offers — the level the reviewer hit on
// live drawing 69 — for a casement window, a door and a box sash. There is no
// DOM test setup in this repo, which is why the rule lives in a module that
// `PropertyField` calls rather than inline in the component: the select
// renders exactly what this returns.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  typeOfWorkOptionsFor, typeOfWorkCodesFor, CASEMENT_TYPES_OF_WORK, BI_GLASS_CODE,
} from './typeOfWorkOptions.js'
import { canBeBiGlass, applyBiGlassCasement } from './biGlassCasement.js'
import { applyCompleteNewThickness } from './sashThickness.js'
import { applySashesReplaced } from './sashesReplaced.js'
import { applyCillRules } from './cillReplacement.js'
import { frameCells, casementSashSize, itemFrames } from '../pricing/casementGeometry.js'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')
import { buildCasementFrame } from './casementOpenings.js'
import { buildFrontDoorSetFrame, buildStableDoorFrame } from './doorOpenings.js'
import { OPEN_IN_PROFILE_VALUES as DOOR_PV } from '../pricing/benchmarks/fixtureDoor.js'
import {
  BENCHMARK_FR1, BENCHMARK_FR2,
} from '../pricing/benchmarks/fixtureCasement.js'

/** Every part type in a tree — for saying what a fixture actually holds. */
function findPartTypes(tree) {
  const out = []
  ;(function walk(n) {
    if (!n) return
    out.push(n.part_type)
    for (const c of (n.children ?? [])) walk(c)
  })(tree)
  return out
}

// The live `type_of_work` reference list, in its live order.
const TYPE_OF_WORK_OPTIONS = [
  { code: 'complete_new',       label: 'Complete New' },
  { code: 'new_pair_of_sashes', label: 'New Pair of Sashes' },
  { code: 'draught_seal',       label: 'Draught Seal & Overhaul' },
  { code: 'bi_glass',           label: 'Bi-Glass' },
  { code: 'cill_only',          label: 'Cill Replacement Only' },
  { code: 'no_work',            label: 'No Work' },
]

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
  'frenchCasementPart.thickness': 57, 'frenchCasementPart.midRail': 130,
  'frenchCasementPart.gapBetweenMeetingStiles': 4,
  'frenchCasementPart.mechanicalClearanceLeft': 4,
  'frenchCasementPart.mechanicalClearanceRight': 4,
  'frenchCasementPart.mechanicalClearanceTop': 4,
  'frenchCasementPart.mechanicalClearanceBottom': 4,
  'leftFrenchCasementSashPart.topHeight': 62,
  'leftFrenchCasementSashPart.leftWidth': 62,
  'leftFrenchCasementSashPart.bottomHeight': 83,
  'rightFrenchCasementSashPart.topHeight': 62,
  'rightFrenchCasementSashPart.leftWidth': 62,
  'rightFrenchCasementSashPart.bottomHeight': 83,
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 16,
  'glassPart.defaultDoubleGlazingTolerance': 2,
  'glassPart.defaultDirGuStopSize': 20,
  'glassPart.defaultDoubleGlazingRebateWidthForDirGU': 20,
  'glassPart.defaultDoubleGlazingToleranceForDirGU': 2,
}

const casementWindow = (openings = ['opening_casement']) => {
  const { tree, missing } = buildCasementFrame(PV, {
    width: 1299, height: 1307, openings, product: 'casement',
  })
  expect(missing, 'profile values').toEqual([])
  return tree
}

/** A box sash, minimal — a sash pair and no casement sash. */
const boxSash = () => ({
  key: 'item1', part_type: 'drawingItemPart', values: { typeOfWork: 'complete_new' },
  children: [{
    key: 'frame1', part_type: 'assemblyFramePart', values: { width: 1120, height: 1800 },
    children: [{
      key: 'pair1', part_type: 'sashPairPart', values: { sashThickness: 45 },
      children: [
        { key: 'top1', part_type: 'topSashPart', values: {}, children: [] },
        { key: 'bot1', part_type: 'bottomSashPart', values: {}, children: [] },
      ],
    }],
  }],
})

describe('Step BJ follow-up — what the Type of Work select offers', () => {
  it('(a) a CASEMENT WINDOW: Complete New, Bi-Glass, No Work', () => {
    const codes = typeOfWorkCodesFor(casementWindow(), TYPE_OF_WORK_OPTIONS)
    expect(codes).toEqual(['complete_new', 'bi_glass', 'no_work'])
    // and the labels come through for the select to render
    expect(typeOfWorkOptionsFor(casementWindow(), TYPE_OF_WORK_OPTIONS)
      .map(o => o.label)).toEqual(['Complete New', 'Bi-Glass', 'No Work'])
  })

  it('(a) every casement layout offers it, not just a single opener', () => {
    for (const openings of [
      ['opening_casement'],
      ['opening_casement', 'opening_casement'],
      ['opening_casement', 'fixed_casement', 'opening_casement'],
    ]) {
      const codes = typeOfWorkCodesFor(casementWindow(openings), TYPE_OF_WORK_OPTIONS)
      expect(codes, openings.join('|')).toContain(BI_GLASS_CODE)
    }
  })

  it('(b) a DOOR: Complete New and No Work only — never Bi-Glass', () => {
    const doorset = buildFrontDoorSetFrame(DOOR_PV, { fanlight: 'over_door' }).tree
    expect(typeOfWorkCodesFor(doorset, TYPE_OF_WORK_OPTIONS))
      .toEqual(CASEMENT_TYPES_OF_WORK)
    expect(canBeBiGlass(doorset)).toBe(false)

    // A doorset HAS casement sashes (its side lights), which is exactly the
    // trap: `is_casement_window` is false because of the door leaf, so the
    // casement rules do not fire and the bi-glass figures do not apply.
    const stable = buildStableDoorFrame(DOOR_PV, {}).tree
    expect(typeOfWorkCodesFor(stable, TYPE_OF_WORK_OPTIONS))
      .toEqual(CASEMENT_TYPES_OF_WORK)
    expect(canBeBiGlass(stable)).toBe(false)
  })

  it('(c) a BOX SASH: every type of work, exactly as before', () => {
    expect(typeOfWorkCodesFor(boxSash(), TYPE_OF_WORK_OPTIONS))
      .toEqual(TYPE_OF_WORK_OPTIONS.map(o => o.code))
    expect(canBeBiGlass(boxSash())).toBe(false)
  })

  it('a casement never offers the sash-window services', () => {
    const codes = typeOfWorkCodesFor(casementWindow(), TYPE_OF_WORK_OPTIONS)
    for (const hidden of ['new_pair_of_sashes', 'draught_seal', 'cill_only']) {
      expect(codes, hidden).not.toContain(hidden)
    }
  })

  it('a FRENCH CASEMENT is OUT, and deliberately so', () => {
    // Its leaves are in CASEMENT_SASH_TYPES, so the step's own scope would
    // have taken it — but a French pair stores its mechanical clearances on
    // the PAIR, not the leaves, so applyBiGlassCasement would leave the
    // sashes at their 4 mm inset and size the glass as though clearance
    // still applied. Integrate has no reading for one either.
    //
    // FR1's own tree, which is Integrate's French casement as read: one
    // frenchCasementPart holding a left and a right leaf, and no mullion.
    const tree = BENCHMARK_FR1.tree
    expect(findPartTypes(tree)).toContain('frenchCasementPart')
    expect(canBeBiGlass(tree)).toBe(false)
    expect(typeOfWorkCodesFor(tree, TYPE_OF_WORK_OPTIONS)).toEqual(CASEMENT_TYPES_OF_WORK)
  })

  it('and a fanlight OVER a French pair is out too — the pair is still there', () => {
    // FR2: an ordinary casement fanlight above a French pair. The fanlight
    // alone would qualify, so this is the mixed case that must not slip
    // through — half the openings would switch properly and half would not.
    const tree = BENCHMARK_FR2.tree
    expect(findPartTypes(tree)).toContain('casementSashPart')
    expect(findPartTypes(tree)).toContain('frenchCasementPart')
    expect(canBeBiGlass(tree)).toBe(false)
  })

  it('a DIRECT-GLAZED-ONLY frame is OUT — there is no sash to keep', () => {
    const { tree, missing } = buildCasementFrame(PV, {
      width: 1199, height: 1299, openings: ['direct_glazed'], product: 'casement',
    })
    expect(missing, 'dgu profile values').toEqual([])
    expect(canBeBiGlass(tree)).toBe(false)
    expect(typeOfWorkCodesFor(tree, TYPE_OF_WORK_OPTIONS)).toEqual(CASEMENT_TYPES_OF_WORK)
  })

  it('a casement with a direct glazed unit BESIDE a sash is IN', () => {
    // There is still a sash to keep, and is_casement_window is true, so the
    // switch applies and prices.
    const tree = casementWindow(['opening_casement', 'direct_glazed'])
    expect(canBeBiGlass(tree)).toBe(true)
    expect(typeOfWorkCodesFor(tree, TYPE_OF_WORK_OPTIONS)).toContain(BI_GLASS_CODE)
  })

  it('an empty or unknown tree is left alone rather than guessed at', () => {
    expect(typeOfWorkCodesFor(null, TYPE_OF_WORK_OPTIONS))
      .toEqual(TYPE_OF_WORK_OPTIONS.map(o => o.code))
    expect(typeOfWorkOptionsFor(casementWindow(), null)).toEqual([])
  })
})

// ── Item 3: choosing it from the select really runs the rule ────────────────
//
// The other half of the blocker. It is not enough that Bi-Glass appears in
// the list: picking it has to run `applyBiGlassCasement` rather than only
// store the string, or a surveyor would get a drawing marked bi-glass whose
// sashes, glass and MPLS were still a complete-new casement's — and it would
// price as one.
//
// Two tests, because there are two ways for that to be wrong: the chain
// itself, and whether the board is wired to it. The second is a source-level
// guard, the same shape as profileCodeCallers.test.js and for the same stated
// reason — a missing call is invisible at runtime, so what is worth testing
// is that the call site has not forgotten.

describe('Step BJ follow-up — choosing Bi-Glass runs the rule', () => {
  /**
   * The board's own chain for a Type of Work change, in its order
   * (DrawingBoard.jsx, `fieldKey === 'drawingItemPart.typeOfWork'`).
   */
  function chooseTypeOfWork(tree, code) {
    let next = { ...tree, values: { ...tree.values, typeOfWork: code } }
    next = applyCompleteNewThickness(next).tree
    next = applySashesReplaced(next).tree
    next = applyCillRules(next).tree
    next = applyBiGlassCasement(next).tree
    return next
  }

  const sashesOf = t => itemFrames(t)[0].children
    .filter(c => c.part_type === 'casementSashPart')
  const paintOf = t => t.children.find(c => c.part_type === 'paintAndIronmongeryPart')

  it('the whole switch happens, not just the value', () => {
    const start = {
      ...casementWindow(['opening_casement', 'fixed_casement', 'opening_casement']),
    }
    const withSurround = {
      ...start,
      values: {
        ...start.values,
        surroundLines: [{ part_code: 'TP61', qty: 1, length_mm: 1450, label: 'Nosing' }],
      },
    }
    const bg = chooseTypeOfWork(withSurround, 'bi_glass')

    expect(bg.values.typeOfWork).toBe('bi_glass')
    // and every one of the five things the brief lists
    for (const sash of sashesOf(bg)) {
      expect(sash.values.toBeReplaced, 'sash kept').toBe(false)
      for (const f of ['mechanicalClearanceLeft', 'mechanicalClearanceRight',
        'mechanicalClearanceTop', 'mechanicalClearanceBottom']) {
        expect(sash.values[f], `sash ${f}`).toBe(0)
      }
      const glass = sash.children.find(c => c.part_type === 'glassPart')
      expect(glass.values.glazingId, 'single').toBe('single_glazing')
      expect(glass.values.singleGlassPartNo, '4mm Clear Toughened').toBe('GL100080')
      expect(glass.values.toBeReplaced, 'glass replaced').toBe(true)
    }
    expect(paintOf(bg).values.isCasementMpls, 'MPLS off').toBe(false)
    expect(bg.values.surroundLines, 'surround cleared').toBeUndefined()
    // the sash IS the opening now
    const cells = frameCells(bg)
    sashesOf(bg).forEach((s, i) => {
      const size = casementSashSize(bg, s)
      expect([size.width, size.height]).toEqual([cells[i].width, cells[i].height])
    })
  })

  it('and choosing Complete New again puts it all back', () => {
    const start = casementWindow(['opening_casement', 'fixed_casement'])
    const back = chooseTypeOfWork(chooseTypeOfWork(start, 'bi_glass'), 'complete_new')
    for (const sash of sashesOf(back)) {
      expect(sash.values.toBeReplaced).toBe(true)
      expect(sash.values.mechanicalClearanceLeft).toBe(4)
      const glass = sash.children.find(c => c.part_type === 'glassPart')
      expect(glass.values.glazingId).toBe('double_glazing')
      expect(glass.values.toBeReplaced).toBeUndefined()
    }
    expect(paintOf(back).values.isCasementMpls).toBe(true)
  })

  it('choosing No Work leaves the drawing alone', () => {
    const start = casementWindow()
    const nw = chooseTypeOfWork(start, 'no_work')
    expect(sashesOf(nw).map(s => s.values.mechanicalClearanceLeft)).toEqual([4])
    expect(sashesOf(nw)[0].children.find(c => c.part_type === 'glassPart').values.glazingId)
      .toBe('double_glazing')
  })

  it('the BOARD is wired to both halves of this', () => {
    // A source-level guard, as profileCodeCallers.test.js is: the two things
    // that broke are a select that filters inline and a handler that stores
    // the value without running the rule. Neither shows up at runtime
    // without a browser.
    const src = readFileSync(resolve(SRC, 'pages/DrawingBoard.jsx'), 'utf8')

    // 1. the select's options come from the shared rule, not an inline filter
    expect(src).toContain('typeOfWorkOptionsFor(tree, opts)')
    expect(src, 'the old inline filter is gone')
      .not.toContain("o.code === 'complete_new' || o.code === 'no_work'")

    // 2. a Type of Work change runs applyBiGlassCasement, inside the same
    //    branch as the other type-of-work rules
    const at = src.indexOf("fieldKey === 'drawingItemPart.typeOfWork'")
    expect(at, 'the typeOfWork branch').toBeGreaterThan(-1)
    const branch = src.slice(at, src.indexOf('commit(newTree)', at))
    expect(branch).toContain('applyBiGlassCasement(newTree)')
    // and the field the select reports is the one the branch tests
    expect(src).toContain('onChangeField(node.key, field.property_name, v, field.field_key)')
  })
})
