// casementOpenings.test.js — Step AP
//
// The board must BUILD the trees Step AO's fixtures pin, so these tests
// check the module against those fixtures' own values, and that changing an
// opening keeps its place, its glass and everything else in the frame.

import { describe, it, expect } from 'vitest'
import {
  OPENING_KINDS, CASEMENT_OPERATIONS, DEFAULT_CASEMENT_OPERATION,
  casementProfileDefaults, buildCasementSash, buildDirectGlazedUnit,
  buildOpening, buildCasementFrame, changeOpening, setCasementOperation,
  openingKindOf, openingNodes, matrixIndexOf, isCasementFrameTree,
} from './casementOpenings.js'
import { applyDividers } from './gridActions.js'
import { BENCHMARK_K, BENCHMARK_L, BENCHMARK_N } from '../pricing/benchmarks/index.js'

// The casement profile's values, as the reviewer read them in the live
// database (step-ap brief). Passed as the board's short map.
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

// Also accepted as the board's raw rows
const PV_ROWS = Object.entries(PV).map(([field_key, default_value]) => ({ field_key, default_value }))

const fixtureSash = bm => {
  const frame = bm.tree.children.find(c => c.part_type === 'assemblyFramePart')
  return frame.children.find(c => c.part_type === 'casementSashPart')
}
const fixtureDgu = bm => {
  const frame = bm.tree.children.find(c => c.part_type === 'assemblyFramePart')
  return frame.children.find(c => c.part_type === 'glassPart')
}

// ── The profile ──────────────────────────────────────────────────────────────

describe('casementProfileDefaults', () => {
  it('finds every required value in the casement profile', () => {
    expect(casementProfileDefaults(PV).missing).toEqual([])
    expect(casementProfileDefaults(PV_ROWS).missing).toEqual([])
  })

  it('names what is missing rather than defaulting it to 0', () => {
    const { missing } = casementProfileDefaults({ 'assemblyFramePart.leftWidth': 37 })
    expect(missing.length).toBeGreaterThan(10)
    expect(missing.join(' ')).toContain('dirGuRebate')
    expect(missing.join(' ')).toContain('tried')      // says which keys it tried
  })

  it('reads the same values from rows and from the short map', () => {
    expect(casementProfileDefaults(PV_ROWS).values).toEqual(casementProfileDefaults(PV).values)
  })
})

// ── Builders match the Step AO fixtures ──────────────────────────────────────

describe('buildCasementSash / buildDirectGlazedUnit', () => {
  it('builds the casement sash benchmark K prices', () => {
    const built = buildCasementSash(PV).values
    const fixture = fixtureSash(BENCHMARK_K).values
    for (const k of ['thickness', 'topHeight', 'leftWidth', 'rightWidth', 'bottomHeight',
                     'mechanicalClearanceLeft', 'mechanicalClearanceRight',
                     'mechanicalClearanceTop', 'mechanicalClearanceBottom', 'toBeReplaced']) {
      expect(built[k], k).toBe(fixture[k])
      expect(built[k], `${k} must not be undefined on both sides`).not.toBeUndefined()
    }
    // Step AQ item 3: the key is `thickness`. Spelled sashThickness, this
    // loop compared undefined with undefined and passed while the property
    // panel showed Thickness blank.
    expect(built.thickness).toBe(54)
    expect(built.sashThickness).toBeUndefined()
    expect(built.operation).toBe(DEFAULT_CASEMENT_OPERATION)
    expect(built.casementTypeId).toBe('open_out')
  })

  it('gives the sash glass the SASH rebate and tolerance', () => {
    const glass = buildCasementSash(PV).children[0].values
    const fixture = fixtureSash(BENCHMARK_K).children[0].values
    expect(glass.glazingRebateWidth).toBe(fixture.glazingRebateWidth)   // 16
    expect(glass.glazingTolerance).toBe(fixture.glazingTolerance)       // 2
    expect(glass.internalGlassPartNo).toBe('GL100010')
  })

  it('builds the direct glazed unit benchmark L prices, hidden-in-rebate STORED', () => {
    const built = buildDirectGlazedUnit(PV).values
    const fixture = fixtureDgu(BENCHMARK_L).values
    for (const k of ['toBeReplaced', 'mechanicalClearanceLeft', 'mechanicalClearanceTop',
                     'hiddenInRebateLeft', 'hiddenInRebateRight',
                     'hiddenInRebateTop', 'hiddenInRebateBottom',
                     'glazingRebateWidth', 'glazingTolerance']) {
      expect(built[k], k).toBe(fixture[k])
    }
    // hidden in rebate = rebate − tolerance, stored so pricing never assumes
    expect(built.hiddenInRebateLeft).toBe(built.glazingRebateWidth - built.glazingTolerance)
  })

  it('a fixed casement is the same sash with operation fix', () => {
    const fixed = buildOpening('fixed_casement', PV)
    expect(fixed.part_type).toBe('casementSashPart')
    expect(fixed.values.operation).toBe('fix')
    expect(fixed.values.thickness).toBe(54)
    expect(fixed.values.thickness).toBe(buildCasementSash(PV).values.thickness)
    expect(openingKindOf(fixed)).toBe('fixed_casement')
  })
})

// ── A whole frame ────────────────────────────────────────────────────────────

describe('buildCasementFrame', () => {
  it('builds benchmark K’s frame, mullion and openings', () => {
    const { tree, missing } = buildCasementFrame(PV, {
      width: 1199, height: 1299, openings: ['opening_casement', 'direct_glazed'],
    })
    expect(missing).toEqual([])
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    const fixtureFrame = BENCHMARK_K.tree.children.find(c => c.part_type === 'assemblyFramePart')
    for (const k of ['width', 'height', 'leftWidth', 'rightWidth', 'topHeight', 'bottomHeight',
                     'frameDepth', 'jambType', 'frameHeadStopSize', 'frameStileStopSize', 'cillStopSize']) {
      expect(frame.values[k], k).toBe(fixtureFrame.values[k])
    }
    // The solid mullion at the left face: (1125 − 27) / 2 = 549
    const mullion = frame.children.find(c => c.part_type === 'mullionPart')
    expect(mullion.values).toMatchObject({ offset: 549, thicknessInFrame: 27, mullionStopSize: 20 })
    // Openings in order, then the cill
    expect(openingNodes(tree).map(openingKindOf)).toEqual(['opening_casement', 'direct_glazed'])
    const cill = frame.children.find(c => c.part_type === 'cillPart')
    expect(cill.values).toMatchObject({ height: 47, depth: 128 })
  })

  it('is complete new, multipoint by default, and stores NO ironmongery list', () => {
    const { tree } = buildCasementFrame(PV, {})
    expect(tree.values.typeOfWork).toBe('complete_new')
    const paint = tree.children.find(c => c.part_type === 'paintAndIronmongeryPart')
    expect(paint.values.isCasementMpls).toBe(true)
    expect(paint.values.ironmongeryLines).toBeUndefined()
  })

  it('a single opening has no mullion', () => {
    const { tree } = buildCasementFrame(PV, { openings: ['direct_glazed'] })
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    expect(frame.children.filter(c => c.part_type === 'mullionPart')).toHaveLength(0)
    expect(isCasementFrameTree(tree)).toBe(true)
  })

  it('three openings put two mullions at equal left faces', () => {
    const { tree } = buildCasementFrame(PV, {
      width: 1199, openings: ['opening_casement', 'opening_casement', 'opening_casement'],
    })
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    const offsets = frame.children.filter(c => c.part_type === 'mullionPart').map(m => m.values.offset)
    // interior 1125, two 27 mullions → openings (1125 − 54)/3 = 357
    expect(offsets).toEqual([357, 741])
  })
})

// ── Changing an opening ──────────────────────────────────────────────────────

describe('changeOpening / setCasementOperation', () => {
  function frameOf(tree) { return tree.children.find(c => c.part_type === 'assemblyFramePart') }

  it('swaps the kind in place, keeping position and glass codes', () => {
    const { tree } = buildCasementFrame(PV, { openings: ['opening_casement', 'direct_glazed'] })
    const dgu = openingNodes(tree)[1]
    // mark the glass so we can see it carried over
    dgu.values.internalGlassPartNo = 'GL100099'

    const { tree: next, changed } = changeOpening(tree, dgu.key, 'opening_casement', PV)
    expect(changed).toBe(true)
    expect(openingNodes(next).map(openingKindOf)).toEqual(['opening_casement', 'opening_casement'])
    // still SECOND (B1), and the glass code came with it
    expect(openingNodes(next)[1].children[0].values.internalGlassPartNo).toBe('GL100099')
  })

  it('touches neither the frame, the mullion, the cill nor the other opening', () => {
    const { tree } = buildCasementFrame(PV, { openings: ['opening_casement', 'direct_glazed'] })
    const before = frameOf(tree)
    const firstKey = openingNodes(tree)[0].key
    const { tree: next } = changeOpening(tree, openingNodes(tree)[1].key, 'fixed_casement', PV)
    const after = frameOf(next)
    expect(after.values).toEqual(before.values)
    expect(after.children.find(c => c.part_type === 'mullionPart').values)
      .toEqual(before.children.find(c => c.part_type === 'mullionPart').values)
    expect(after.children.find(c => c.part_type === 'cillPart').values)
      .toEqual(before.children.find(c => c.part_type === 'cillPart').values)
    expect(openingNodes(next)[0].key).toBe(firstKey)      // untouched, same node
  })

  it('does nothing when the kind is already right, or the key is not an opening', () => {
    const { tree } = buildCasementFrame(PV, { openings: ['opening_casement'] })
    expect(changeOpening(tree, openingNodes(tree)[0].key, 'opening_casement', PV).changed).toBe(false)
    expect(changeOpening(tree, frameOf(tree).key, 'direct_glazed', PV).changed).toBe(false)
    expect(changeOpening(tree, 'nope', 'direct_glazed', PV).changed).toBe(false)
  })

  it('sets any of Integrate’s five operations, and fix makes it fixed', () => {
    const { tree } = buildCasementFrame(PV, { openings: ['opening_casement'] })
    const sashKey = openingNodes(tree)[0].key
    for (const op of CASEMENT_OPERATIONS) {
      const { tree: next, changed } = setCasementOperation(tree, sashKey, op)
      expect(changed, op).toBe(op !== DEFAULT_CASEMENT_OPERATION)
      const sash = openingNodes(next)[0]
      expect(sash.values.operation, op).toBe(op)
      expect(openingKindOf(sash), op).toBe(op === 'fix' ? 'fixed_casement' : 'opening_casement')
    }
  })

  it('refuses an operation that is not one of Integrate’s', () => {
    const { tree } = buildCasementFrame(PV, { openings: ['opening_casement'] })
    expect(setCasementOperation(tree, openingNodes(tree)[0].key, 'sideways').changed).toBe(false)
  })

  it('matrix labels run A1, B1, C1', () => {
    expect([0, 1, 2].map(matrixIndexOf)).toEqual(['A1', 'B1', 'C1'])
  })

  it('every kind is offered and round-trips', () => {
    const { tree } = buildCasementFrame(PV, { openings: ['opening_casement'] })
    let t = tree
    for (const kind of [...OPENING_KINDS, 'opening_casement']) {
      t = changeOpening(t, openingNodes(t)[0].key, kind, PV).tree
      expect(openingKindOf(openingNodes(t)[0])).toBe(kind)
    }
  })
})

// ── The mullion picker on a casement frame (step-ap §3) ─────────────────────

describe('applyDividers on a casement frame', () => {
  const SOLID_PV = { thicknessInFrameSolid: 27, mullionStopSize: 20, thicknessInFrameHollow: 144 }

  it('adds SOLID mullions and copies the first opening', () => {
    const { tree } = buildCasementFrame(PV, { openings: ['opening_casement'] })
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    const next = applyDividers(tree, frame.key, 2, 1, 1125, 1205, SOLID_PV, 'solid')

    const nextFrame = next.children.find(c => c.part_type === 'assemblyFramePart')
    const mullions = nextFrame.children.filter(c => c.part_type === 'mullionPart')
    expect(mullions).toHaveLength(1)
    // SOLID thickness from the profile, not the hollow 144
    expect(mullions[0].values).toMatchObject({ thicknessInFrame: 27, mullionStopSize: 20, offset: 549 })
    // the new opening copies the first one, with its own keys
    const openings = openingNodes(next)
    expect(openings.map(openingKindOf)).toEqual(['opening_casement', 'opening_casement'])
    expect(openings[0].key).not.toBe(openings[1].key)
    expect(openings[1].children[0].key).not.toBe(openings[0].children[0].key)
  })

  it('copies a direct glazed unit when that is the first opening', () => {
    const { tree } = buildCasementFrame(PV, { openings: ['direct_glazed'] })
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    const next = applyDividers(tree, frame.key, 2, 1, 1125, 1205, SOLID_PV, 'solid')
    expect(openingNodes(next).map(openingKindOf)).toEqual(['direct_glazed', 'direct_glazed'])
  })

  it('adds no transom on a casement frame (out of scope this step)', () => {
    const { tree } = buildCasementFrame(PV, { openings: ['opening_casement'] })
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    const next = applyDividers(tree, frame.key, 1, 3, 1125, 1205, SOLID_PV, 'solid')
    expect(next.children.find(c => c.part_type === 'assemblyFramePart')
      .children.filter(c => c.part_type === 'transomPart')).toHaveLength(0)
  })

  it('needs the SOLID profile value, and says so', () => {
    const { tree } = buildCasementFrame(PV, { openings: ['opening_casement'] })
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    expect(() => applyDividers(tree, frame.key, 2, 1, 1125, 1205, { thicknessInFrameHollow: 144 }, 'solid'))
      .toThrow(/thicknessInFrameSolid/)
  })

  it('a box sash frame still gets the HOLLOW mullion', () => {
    // benchmark N's casement frame and a sash tree must not cross wires:
    // the kind comes from the caller (the drawing's profile), not the tree
    const { tree } = buildCasementFrame(PV, { openings: ['opening_casement'] })
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    const asHollow = applyDividers(tree, frame.key, 2, 1, 1125, 1205, SOLID_PV, 'hollow')
    expect(asHollow.children.find(c => c.part_type === 'assemblyFramePart')
      .children.find(c => c.part_type === 'mullionPart').values.thicknessInFrame).toBe(144)
  })
})

// ── Casement drawings are not sash drawings ─────────────────────────────────

describe('isCasementFrameTree', () => {
  it('is true for the casement and direct glazed benchmarks', () => {
    for (const bm of [BENCHMARK_K, BENCHMARK_L, BENCHMARK_N]) {
      expect(isCasementFrameTree(bm.tree), bm.name).toBe(true)
    }
  })

  it('is false for a box sash frame', async () => {
    const { BENCHMARK_A } = await import('../pricing/benchmarks/index.js')
    expect(isCasementFrameTree(BENCHMARK_A.tree)).toBe(false)
  })
})
