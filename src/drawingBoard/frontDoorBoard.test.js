/**
 * frontDoorBoard.test.js — Step BD, the front door ON THE BOARD.
 *
 * The brief (item 2): a surveyor sets the panel layout of a leaf, so the
 * board needs the leaf's grid — not just the one mid rail Step BA built for
 * a French door.
 *
 * Every test goes through the functions the board's own buttons call.
 */

import { describe, it, expect } from 'vitest'
import {
  buildFrontDoorFrame, buildSingleDoorFrame, setLeafGrid, setLeafCellKind,
  isFrontDoorTree, isDoorTree, FRONT_DOOR_TEMPLATES, FRONT_DOOR_DEFAULTS,
} from './doorOpenings.js'
import { leafCells, leafInterior, doorLeaves, allocatedSectionParts, isOpenInLeaf } from '../pricing/doorGeometry.js'
import { assertSaveable, duplicateKeys } from './containment.js'
import { partLabel } from './partLabels.js'

/** The open_in_doors profile, as the FT fixtures hold it. */
const PV = {
  'assemblyFramePart.leftWidth': 47, 'assemblyFramePart.rightWidth': 47,
  'assemblyFramePart.topHeight': 47, 'assemblyFramePart.bottomHeight': 50,
  'assemblyFramePart.frameDepth': 96,
  'assemblyFramePart.frameHeadStopSize': 20,
  'assemblyFramePart.frameStileStopSize': 20,
  'assemblyFramePart.cillStopSize': 26,
  'cillPart.height': 50, 'cillPart.depth': 145,
  'frenchDoorPart.thickness': 54, 'frenchDoorPart.midRail': 198,
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
  'mullionPart.thicknessInFrameSolid': 41,
  'casementSashPart.thickness': 54, 'casementSashPart.topHeight': 62,
  'casementSashPart.leftWidth': 62, 'casementSashPart.rightWidth': 62,
  'casementSashPart.defaultFanlightBottomHeight': 58,
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 15,
  'glassPart.defaultDoubleGlazingTolerance': 3,
}

const leafOf = tree => doorLeaves(tree)[0]
const cellKinds = tree => (leafOf(tree).children ?? [])
  .filter(c => c.part_type === 'panelPart' || c.part_type === 'glassPart')
  .map(c => (c.part_type === 'panelPart' ? 'panel' : 'glass'))

describe('Step BD — a front door on the board', () => {
  it('is an open-in door, 50 in the cill, dual finish and a front door', () => {
    const { tree, missing } = buildFrontDoorFrame(PV, {})
    expect(missing).toEqual([])
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    expect(frame.values.bottomHeight).toBe(50)
    expect(frame.children.find(c => c.part_type === 'cillPart').values.height).toBe(50)
    const paint = tree.children.find(c => c.part_type === 'paintAndIronmongeryPart')
    expect(paint.values.isFrontDoor).toBe(true)
    expect(paint.values.internalFinish).toBe('clean_white')
    // the paint_finish option CODE for Integrate’s “Custom Colour TBC” is
    // 'custom' (reviewer, 14 Oct) — 'custom_colour_tbc' is not an option
    expect(paint.values.externalFinish).toBe('custom')
    // what reaches a price is only that the two sides DIFFER
    expect(paint.values.internalFinish).not.toBe(paint.values.externalFinish)
    expect(isFrontDoorTree(tree)).toBe(true)
    expect(isDoorTree(tree)).toBe(true)
    // the leaf opens IN, which is what the -20 section offset and the
    // open-in ironmongery rules turn on
    expect(isOpenInLeaf(leafOf(tree))).toBe(true)
    expect(leafOf(tree).values.mechanicalClearanceBottom).toBe(14)
    // and a GARDEN door is none of those things
    const garden = buildSingleDoorFrame(PV, {}).tree
    expect(isFrontDoorTree(garden)).toBe(false)
    expect(isOpenInLeaf(leafOf(garden))).toBe(false)
  })

  it('the default is four panels, evenly split', () => {
    // Integrate's Balham is 373 / 284 across; GlazePro centres the muntin,
    // because that split is its template's accident (brief item 8).
    const { tree } = buildFrontDoorFrame(PV, {})
    const cells = leafCells(tree, leafOf(tree))
    expect(cells.length).toBe(4)
    // 777 interior less the 120 muntin, halved and stored as whole mm:
    // the odd millimetre goes to the left cell, as the board does
    // everywhere else it splits a span.
    expect(cells.map(c => c.width)).toEqual([329, 328, 329, 328])
    // 1788 interior less the 170 rail, halved
    expect(cells.map(c => c.height)).toEqual([809, 809, 809, 809])
    expect(cellKinds(tree)).toEqual(['panel', 'panel', 'panel', 'panel'])
  })

  it('a surveyor sets the layout, and a cell’s kind, through the board', () => {
    const { tree } = buildFrontDoorFrame(PV, {})
    // three rows of two, glass across the top
    const next = setLeafGrid(tree, leafOf(tree).key, {
      columns: 2, rows: 3, cells: ['glass', 'glass', 'panel', 'panel', 'panel', 'panel'],
    }, PV)
    expect(leafCells(next, leafOf(next)).length).toBe(6)
    expect(cellKinds(next)).toEqual(['glass', 'glass', 'panel', 'panel', 'panel', 'panel'])
    // one cell at a time
    const cell = (leafOf(next).children ?? []).filter(
      c => c.part_type === 'panelPart')[0]
    const swapped = setLeafCellKind(next, cell.key, 'glass', PV)
    expect(cellKinds(swapped)).toEqual(['glass', 'glass', 'glass', 'panel', 'panel', 'panel'])
    // and back to one cell: a leaf with no grid is a glazed door
    const plain = setLeafGrid(swapped, leafOf(swapped).key, { columns: 1, rows: 1 }, PV)
    expect(leafCells(plain, leafOf(plain)).length).toBe(1)
    expect(cellKinds(plain)).toEqual(['glass'])
  })

  it('every layout saves: no duplicate keys, and the containment holds', () => {
    let tree = buildFrontDoorFrame(PV, {}).tree
    for (const [columns, rows] of [[1, 1], [2, 2], [3, 2], [1, 3], [2, 4]]) {
      tree = setLeafGrid(tree, leafOf(tree).key, { columns, rows }, PV)
      expect(duplicateKeys(tree), `${columns}x${rows}`).toEqual([])
      expect(() => assertSaveable(tree), `${columns}x${rows}`).not.toThrow()
      expect(leafCells(tree, leafOf(tree)).length).toBe(columns * rows)
    }
  })

  it('the fanlight template is a DIRECT GLAZED unit over a transom', () => {
    const { tree } = buildFrontDoorFrame(PV, {
      ...FRONT_DOOR_TEMPLATES[1].options,
    })
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    const transoms = frame.children.filter(c => c.part_type === 'transomPart')
    expect(transoms.length).toBe(1)
    expect(transoms[0].values.offset).toBe(431)
    // the fanlight is a glassPart straight in the frame, not a casement sash
    expect(frame.children.filter(c => c.part_type === 'casementSashPart').length).toBe(0)
    expect(frame.children.filter(c => c.part_type === 'glassPart').length).toBe(1)
    // and the leaf is glass over one panel
    expect(cellKinds(tree)).toEqual(['glass', 'panel'])
  })

  it('the arched template gives the FRAME and the LEAF a curved head', () => {
    const { tree } = buildFrontDoorFrame(PV, { ...FRONT_DOOR_TEMPLATES[2].options })
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    expect(frame.values.curvedFrameHead).toBe(true)
    expect(frame.values.frameLevelArchHeight).toBeCloseTo(508.891, 3)
    const leaf = leafOf(tree)
    expect(leaf.values.curvedSashHead).toBe(true)
    expect(leaf.values.archHead).toBe(true)
    expect(leaf.values.archHeight).toBeCloseTo(345.92, 2)
    // its 120 mid rail, not the 170 of a square door
    const rail = leaf.children.find(c => c.part_type === 'transomPart')
    expect(rail.values.midrailThickness ?? rail.values.thicknessInFrame).toBe(120)
    // a SQUARE front door has no arch anywhere, which is the brief's
    // "leaf never arched unless the template is the arched one"
    const square = buildFrontDoorFrame(PV, {}).tree
    expect(leafOf(square).values.archHead).toBe(false)
    expect(square.children.find(c => c.part_type === 'assemblyFramePart')
      .values.curvedFrameHead).toBeUndefined()
  })

  it('the leaf’s timber follows the layout the board sets', () => {
    // Four panels: the 120 muntin is charged (PROVISIONAL) at the leaf's
    // interior height. One panel: no muntin, nothing charged for it.
    const four = buildFrontDoorFrame(PV, {}).tree
    const one  = setLeafGrid(four, leafOf(four).key, { columns: 1, rows: 2 }, PV)
    const len = tree => Object.fromEntries(
      allocatedSectionParts(tree).map(s => [s.part_code, s.length_mm]))
    expect(len(four).Utile63x120 - len(one).Utile63x120).toBe(1788)
  })

  it('the parts list names the leaf and its panels', () => {
    const { tree } = buildFrontDoorFrame(PV, {})
    expect(partLabel(leafOf(tree), tree)).toBe('Single Door A1')
  })

  it('the three templates are Integrate’s three front doors', () => {
    expect(FRONT_DOOR_TEMPLATES.map(t => `${t.name} ${t.sort_order}`)).toEqual([
      'Front Door 200',
      'Front Door With Fanlight 210',
      'Arched Front Door 220',
    ])
    // each builds, and at Integrate's own template size
    for (const t of FRONT_DOOR_TEMPLATES) {
      const { tree, missing } = buildFrontDoorFrame(PV, t.options)
      expect(missing, t.name).toEqual([])
      const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
      expect(`${frame.values.width}x${frame.values.height}`, t.name)
        .toBe(`${t.options.width}x${t.options.height}`)
      expect(() => assertSaveable(tree), t.name).not.toThrow()
    }
    expect(FRONT_DOOR_DEFAULTS.frameBottom).toBe(50)
  })
})

describe('Step BD templates fix — Integrate’s own mid rails', () => {
  const leafOf2 = tree => doorLeaves(tree)[0]
  /** The leaf's cell heights, top row first — what a lock rail's height is. */
  const rows = tree => {
    const cells = leafCells(tree, leafOf2(tree))
    return cells.filter(c => c.col === 0).map(c => c.height)
  }
  const cols = tree => {
    const cells = leafCells(tree, leafOf2(tree))
    return cells.filter(c => c.row === 0).map(c => c.width)
  }
  const byName = name => FRONT_DOOR_TEMPLATES.find(t => t.name === name)

  it('the Balham’s rail sits LOW: 983 over 635, muntin 329 / 328', () => {
    // A front door's lock rail is low — long panels over a short one. The
    // first templates centred it (809 / 809), which is the door nobody sells.
    // The MUNTIN stays centred: Integrate's 373 / 284 is its own accident.
    const { tree } = buildFrontDoorFrame(PV, byName('Front Door').options)
    expect(rows(tree)).toEqual([983, 635])
    expect(cols(tree)).toEqual([329, 328])
  })

  it('the Bedford’s glass is 941 over a 618 panel', () => {
    const { tree } = buildFrontDoorFrame(PV, byName('Front Door With Fanlight').options)
    expect(rows(tree)).toEqual([941, 618])
    expect(cellKinds(tree)).toEqual(['glass', 'panel'])
  })

  it('the arched door’s shaped glass is 1103 over a 582 panel', () => {
    const { tree } = buildFrontDoorFrame(PV, byName('Arched Front Door').options)
    expect(rows(tree)).toEqual([1103, 582])
    // and its rail is Integrate's 120, not the 170 of a square door
    const rail = leafOf2(tree).children.find(c => c.part_type === 'transomPart')
    expect(rail.values.midrailThickness ?? rail.values.thicknessInFrame).toBe(120)
  })

  it('every template’s rows add up to the leaf interior', () => {
    // top + rail + bottom = the interior height, which is the arithmetic a
    // stored offset has to satisfy however it is written down.
    for (const t of FRONT_DOOR_TEMPLATES) {
      const { tree } = buildFrontDoorFrame(PV, t.options)
      const leaf = leafOf2(tree)
      const rail = leaf.children.find(c => c.part_type === 'transomPart')
      const thickness = rail.values.midrailThickness ?? rail.values.thicknessInFrame
      const interior = leafInterior(tree, leaf)
      expect(rows(tree).reduce((a, b) => a + b, 0) + thickness, t.name)
        .toBe(interior.height)
      // the stored offset IS the top cell, which is the board's convention
      // for every divider: `offset` is the span BEFORE it.
      expect(rail.values.offset, t.name).toBe(rows(tree)[0])
    }
  })
})
