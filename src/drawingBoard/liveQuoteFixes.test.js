// liveQuoteFixes.test.js — Step BL, on the BOARD path
//
// The brief: "Everything happened on the live board, so check each fix on the
// board path as well as on the fixture." The LQ fixtures are Integrate's saved
// trees; this builds the same windows with the board's own code and checks the
// fixes hold there too — which is what the reviewer will see when leads 11–15
// are re-priced.
//
// Items 3 and 7 are BOX SASH only, and `buildNewBoxSash` needs the live field
// definitions and containment rows, which are not in the repository. Their
// board-path evidence is the facts file itself: the reviewer drew drawings
// 94, 118, 121 and 122 on the live board, and the live GlazePro figures
// recorded there are what the LQ5 / LQ6 / LQ7 / LQ9 fixtures reproduce — the
// horn firing twice, and the hardwood lines at £0.03 and nothing.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import { buildCasementFrame, openingNodes } from './casementOpenings.js'
import { applyDividers } from './gridActions.js'
import { runPricingOnTree } from '../pricing/pricingEngine.js'
import { computeVariables } from '../pricing/computeVariables.js'
import { computeDerived } from './computeDerived.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = resolve(HERE, '../pricing/benchmarks/pf30-snapshot.json')
const SNAPSHOT = existsSync(SNAPSHOT_PATH)
  ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
  : null

/** Profile 2 (casement), as the board loads it, WITH the 16 mm spacer. */
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
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 16,
  'glassPart.defaultDoubleGlazingTolerance': 2,
  // buildCasementFrame resolves the direct-glazed set too and reports them
  // as missing otherwise, even on a drawing with no direct glazed unit
  'glassPart.defaultDirGuStopSize': 20,
  'glassPart.defaultDoubleGlazingRebateWidthForDirGU': 20,
  'glassPart.defaultDoubleGlazingToleranceForDirGU': 2,
}

/** The ENGINE's profile values, short-keyed, as loadPricingContext gives them. */
const ENGINE_PV = {
  defaultDoubleGlazingRebateWidthForSash: 16,
  defaultDoubleGlazingTolerance: 2,
  // what item 1 turns on: the drawing's profile says 16 mm
  spacerDimId: '16mm',
}

const PICKER_PV = { thicknessInFrameSolid: 27, mullionStopSize: 20 }

const d = SNAPSHOT ? describe : describe.skip

/** Put bars on one opening's glass, as the board's bar tool does. */
function addBars(tree, openingKey, { v = 0, h = 0 }) {
  const bars = []
  for (let i = 0; i < v; i++) {
    bars.push({ key: `${openingKey}_vb${i}`, part_type: 'verticalGlazingBarPart',
      values: { thickness: 22, nib: 4 }, children: [] })
  }
  for (let i = 0; i < h; i++) {
    bars.push({ key: `${openingKey}_hb${i}`, part_type: 'horizontalGlazingBarPart',
      values: { thickness: 22, nib: 4 }, children: [] })
  }
  const patch = node => {
    if (node.key === openingKey) {
      return {
        ...node,
        children: (node.children ?? []).map(c => c.part_type !== 'glassPart' ? c
          : { ...c, children: bars }),
      }
    }
    return { ...node, children: (node.children ?? []).map(patch) }
  }
  return patch(tree)
}

function price(tree, { externalAccess = null } = {}) {
  let t = tree
  if (externalAccess) {
    t = {
      ...t,
      children: t.children.map(c => c.part_type !== 'notesPart' ? c
        : { ...c, values: { ...c.values, externalAccessId: externalAccess } }),
    }
  }
  return runPricingOnTree(t, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
    glassCatalogue: SNAPSHOT.glassCatalogue,
    partAllocationRules: SNAPSHOT.partAllocationRules,
    partCostMap: { TP68: 2.85 },
    ironmongeryLines: [],
    ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
    profileValues: ENGINE_PV,
  })
}

const minutes = (r, name) => r.install_labour.lines
  .concat(r.manufacture_labour.lines)
  .filter(l => l.fires && !l.error && l.name === name)
  .reduce((n, l) => n + l.minutes, 0)

const glassBarLines = r => r.price.lines
  .filter(l => l.fires && !l.error && l.group_name === 'glass_done' &&
    /Glazing Bar/.test(l.name))
  .map(l => l.name)

d('Step BL on the board — items 1, 2, 4 and 5', () => {
  /** A board-built casement, three columns, at LQ1's size. */
  function threeColumn() {
    const { tree, missing } = buildCasementFrame(PV, {
      width: 2000, height: 1300, openings: ['opening_casement'], product: 'casement',
    })
    expect(missing).toEqual([])
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    return applyDividers(tree, frame.key, 3, 1, 1926, 1206, PICKER_PV, 'solid')
  }

  it('item 1: a board-built casement’s bars are CHARGED', () => {
    // The board stores no spacer on a casement's glass, which is exactly why
    // this needed the profile fallback: without it the unit is 8 mm thick and
    // the rules are gated on 24.
    const plain = threeColumn()
    const glass = openingNodes(plain)[0].children.find(c => c.part_type === 'glassPart')
    expect(glass.values.spacerDimId, 'the board stores no spacer').toBeUndefined()

    const barred = addBars(plain, openingNodes(plain)[0].key, { v: 1, h: 2 })
    expect(glassBarLines(price(barred))).toEqual(['Square Glass Multiple Glazing Bar'])
    // one bar is "Single", not "Multiple"
    const one = addBars(plain, openingNodes(plain)[0].key, { v: 1 })
    expect(glassBarLines(price(one))).toEqual(['Square Glass Single Glazing Bar'])
    // and no bars charges nothing
    expect(glassBarLines(price(plain))).toEqual([])
  })

  it('item 2: only the barred sash is charged the 30 minutes', () => {
    const plain = threeColumn()
    const keys = openingNodes(plain).map(n => n.key)
    expect(keys.length).toBe(3)
    const oneBarred = addBars(plain, keys[1], { v: 1 })
    expect(minutes(price(oneBarred), 'Additional for Glazing Bars')).toBe(30)
    // bars on all three -> three times, which is LQ1
    let all = plain
    for (const k of keys) all = addBars(all, k, { v: 1, h: 2 })
    expect(minutes(price(all), 'Additional for Glazing Bars')).toBe(90)
  })

  it('item 4: a board-built TALL frame fires both height rules', () => {
    const { tree } = buildCasementFrame(PV, {
      width: 1529, height: 2600, openings: ['opening_casement'], product: 'casement',
    })
    const vars = computeVariables(tree, computeDerived(tree), SNAPSHOT.pfVariables)
    expect(vars.tallest_external_frame_height).toBe(2.6)
    const r = price(tree)
    expect(minutes(r, '1500 Height Casement Frame Replacement')).toBe(60)
    expect(minutes(r, '2500 Height Casement Frame Replacement')).toBe(300)
    // a short one fires neither
    const short = buildCasementFrame(PV, {
      width: 1529, height: 1300, openings: ['opening_casement'], product: 'casement',
    }).tree
    expect(minutes(price(short), '1500 Height Casement Frame Replacement')).toBe(0)
  })

  it('item 5: the tower fires from the board’s own access field', () => {
    const { tree } = buildCasementFrame(PV, {
      width: 1060, height: 1230, openings: ['opening_casement'], product: 'casement',
    })
    // the board writes externalAccessId on the notes part
    expect(minutes(price(tree, { externalAccess: 'tower_by_wsw' }), 'Scaffold Tower')).toBe(180)
    expect(minutes(price(tree, { externalAccess: 'easily_accessible' }), 'Scaffold Tower')).toBe(0)
    expect(minutes(price(tree, { externalAccess: 'scaffold_by_wsw' }), 'Scaffold Tower')).toBe(0)
    expect(minutes(price(tree, { externalAccess: 'scaffold_by_customer' }), 'Scaffold Tower')).toBe(0)
  })

  it('the cill horns are charged on a board-built casement', () => {
    const { tree } = buildCasementFrame(PV, {
      width: 1060, height: 1230, openings: ['opening_casement'], product: 'casement',
    })
    const withHorns = {
      ...tree,
      children: tree.children.map(c => c.part_type !== 'assemblyFramePart' ? c
        : { ...c, values: { ...c.values, leftCillHorn: 60, rightCillHorn: 60 } }),
    }
    const cillOf = r => r.price.lines
      .find(l => l.fires && !l.error && l.name === 'Hardwood Casement Cill')?.line_cost ?? 0
    expect(cillOf(price(withHorns))).toBeGreaterThan(cillOf(price(tree)))
    expect(cillOf(price(withHorns))).toBeCloseTo(13.73, 2)
  })
})
