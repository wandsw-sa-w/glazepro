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
  addSideLight,
} from './doorOpenings.js'
import {
  leafCells, leafInterior, doorLeaves, allocatedSectionParts, isOpenInLeaf, gridRectsFor,
} from '../pricing/doorGeometry.js'
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
      // Step BE, decision g
      'Front Door With Side Light 230',
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

describe('Step BE — the side light (Nathan’s decision g)', () => {
  const frameOf = tree => tree.children.find(c => c.part_type === 'assemblyFramePart')
  const sashOf = tree => frameOf(tree).children.find(c => c.part_type === 'casementSashPart')

  it('a surveyor adds one to a front door, and it is a fixed SASH', () => {
    // Decision g replaces decision c: a side light is a casement sash, not a
    // fixed door leaf — which is what Integrate's own drawing 20 has.
    const base = buildFrontDoorFrame(PV, { width: 1400, height: 2182 }).tree
    const { tree, changed, missing } = addSideLight(base, frameOf(base).key, 'right', PV)
    expect({ changed, missing }).toEqual({ changed: true, missing: [] })
    const frame = frameOf(tree)
    // a 41 mullion, the door, then the sash
    expect(frame.children.filter(c => c.part_type === 'mullionPart').length).toBe(1)
    expect(frame.children.filter(c => c.part_type === 'doorLeafPart').length).toBe(1)
    const sash = sashOf(tree)
    expect(sash.values.operation).toBe('fix')
    // glass over a panel, under its own mid rail
    expect((sash.children ?? []).map(c => c.part_type))
      .toEqual(['transomPart', 'glassPart', 'panelPart'])
    expect(() => assertSaveable(tree)).not.toThrow()
    expect(duplicateKeys(tree)).toEqual([])
  })

  it('the mullion leaves the side light Integrate’s 365 column', () => {
    const base = buildFrontDoorFrame(PV, { width: 1400, height: 2182 }).tree
    const { tree } = addSideLight(base, frameOf(base).key, 'right', PV)
    const mull = frameOf(tree).children.find(c => c.part_type === 'mullionPart')
    // interior 1306 = 900 (the door) + 41 (the mullion) + 365 (the light)
    expect(mull.values.offset).toBe(900)
    expect(leafCells(tree, sashOf(tree)).map(c => `${c.width}x${c.height}`))
      // This door is the BOARD default (an even 2 x 2 grid, bottom row 809),
      // so the sash’s rail has to reach 14 + 170 + 809 = 993 above the bottom
      // of the opening; its own 3 + 175 leaves an 815 panel and 857 of glass.
      // The TEMPLATE is Integrate’s Balham (635 bottom row) and reads 1031 /
      // 641 — the test below pins the invariant rather than either pair.
      .toEqual(['235x857', '235x815'])
  })

  it('its mid rail MEETS the door’s — the same height off the cill', () => {
    // The door drops 14 into the frame and has a 170 bottom rail; the sash
    // drops 3 and has 175. So the rails meet when the sash's panel is 6 mm
    // shorter measured from its own bottom — which on Integrate's drawing is
    // 834 both sides, the figure the arithmetic has to produce.
    const base = buildFrontDoorFrame(PV, { width: 1400, height: 2182 }).tree
    const { tree } = addSideLight(base, frameOf(base).key, 'right', PV)
    const door = doorLeaves(tree)[0]
    const doorRows = leafCells(tree, door).filter(c => c.col === 0).map(c => c.height)
    const sashRows = leafCells(tree, sashOf(tree)).filter(c => c.col === 0).map(c => c.height)
    const railHeight = (bottomDrop, bottomRail, panel) => bottomDrop + bottomRail + panel
    expect(railHeight(14, 170, doorRows[1]))
      .toBe(railHeight(3, 175, sashRows[1]))
    // and the stored offset is the GLASS above it, as every divider's is
    const rail = sashOf(tree).children.find(c => c.part_type === 'transomPart')
    expect(rail.values.offset).toBe(sashRows[0])
  })

  it('on the LEFT it is the sash that comes first', () => {
    const base = buildFrontDoorFrame(PV, { width: 1400, height: 2182 }).tree
    const { tree } = addSideLight(base, frameOf(base).key, 'left', PV)
    const kinds = frameOf(tree).children
      .filter(c => c.part_type === 'casementSashPart' || c.part_type === 'doorLeafPart')
      .map(c => c.part_type)
    expect(kinds).toEqual(['casementSashPart', 'doorLeafPart'])
    expect(frameOf(tree).children.find(c => c.part_type === 'mullionPart').values.offset)
      .toBe(365)
  })

  it('the template is Integrate’s Balham with a side light', () => {
    const t = FRONT_DOOR_TEMPLATES.find(x => x.name === 'Front Door With Side Light')
    expect(t.sort_order).toBe(230)
    const { tree, missing } = buildFrontDoorFrame(PV, t.options)
    expect(missing).toEqual([])
    const frame = frameOf(tree)
    expect(`${frame.values.width}x${frame.values.height}`).toBe('1400x2182')
    // the door keeps Integrate's Balham layout (decision f): 983 / 635
    const door = doorLeaves(tree)[0]
    expect(leafCells(tree, door).filter(c => c.col === 0).map(c => c.height))
      .toEqual([983, 635])
    // and the side light's rail meets it
    const sashRows = leafCells(tree, sashOf(tree)).filter(c => c.col === 0).map(c => c.height)
    expect(14 + 170 + 635).toBe(3 + 175 + sashRows[1])
    expect(() => assertSaveable(tree)).not.toThrow()
  })
})

describe('Step BE follow-up — a resized leaf re-centres its grid', () => {
  const frameOf = tree => tree.children.find(c => c.part_type === 'assemblyFramePart')
  const sashOf = tree => frameOf(tree).children.find(c => c.part_type === 'casementSashPart')
  const muntinOf = node => (node.children ?? []).find(c => c.part_type === 'mullionPart')

  it('the template’s muntin is centred in its OWN leaf: 276 / 276', () => {
    // THE LIVE BUG (template 32, drawing 47): the muntin was stored at 479,
    // centred for the 1298-wide leaf the door had BEFORE the side light took
    // 465 mm of the frame. The leaf is 892 wide, its interior 672, so the
    // panels came out 479 / 73.
    const t = FRONT_DOOR_TEMPLATES.find(x => x.name === 'Front Door With Side Light')
    const { tree } = buildFrontDoorFrame(PV, t.options)
    const leaf = doorLeaves(tree)[0]
    expect(leafInterior(tree, leaf).width).toBe(672)
    expect(muntinOf(leaf).values.offset).toBe(276)
    expect(leafCells(tree, leaf).filter(c => c.row === 0).map(c => c.width))
      .toEqual([276, 276])
  })

  it('adding a side light re-centres the muntin, and only the muntin', () => {
    // The mid rail is a LOCK RAIL: its height is a decision (Integrate's 983
    // on the Balham), and a lock rail does not move because the door got
    // narrower. The muntin is a proportion, and it does.
    const base = buildFrontDoorFrame(PV, { width: 1400, height: 2182, rowOffsets: [983] }).tree
    const leafBefore = doorLeaves(base)[0]
    expect(muntinOf(leafBefore).values.offset).toBe(479)
    const { tree } = addSideLight(base, frameOf(base).key, 'right', PV)
    const leaf = doorLeaves(tree)[0]
    expect(muntinOf(leaf).values.offset).toBe(276)
    const rail = (leaf.children ?? []).find(c => c.part_type === 'transomPart')
    expect(rail.values.offset).toBe(983)
    // and the cells still hold what they held: four panels, in order
    expect((leaf.children ?? []).filter(c => c.part_type === 'panelPart').length).toBe(4)
  })

  it('a grid that was NOT even is left alone', () => {
    // A surveyor who has moved a muntin on purpose keeps it: only an EVEN
    // grid is re-evened, because only an even grid was a proportion.
    const base = buildFrontDoorFrame(PV, { width: 1400, height: 2182 }).tree
    const leafKey = doorLeaves(base)[0].key
    const moved = setLeafGrid(base, leafKey, {
      columns: 2, rows: 2, columnOffsets: [700],
    }, PV)
    const { tree } = addSideLight(moved, frameOf(moved).key, 'right', PV)
    expect(muntinOf(doorLeaves(tree)[0]).values.offset).toBe(700)
  })
})

describe('Step BE follow-up — the board DRAWS a sash’s own grid', () => {
  const frameOf = tree => tree.children.find(c => c.part_type === 'assemblyFramePart')
  const sashOf = tree => frameOf(tree).children.find(c => c.part_type === 'casementSashPart')

  it('the side light’s mid rail, glass and panel are rects to draw', () => {
    // THE LIVE BUG: the three parts were in the tree and priced, and the
    // board drew the sash as one pane of glass — gridRectsFor only answered
    // for a DOOR LEAF.
    const t = FRONT_DOOR_TEMPLATES.find(x => x.name === 'Front Door With Side Light')
    const { tree } = buildFrontDoorFrame(PV, t.options)
    const sash = sashOf(tree)
    const rects = gridRectsFor(tree, sash, 100, 50)
    expect(rects.map(r => `${r.kind} ${r.width}x${r.height}`))
      .toEqual(['glass 235x1031', 'panel 235x641'])
    // offset from the interior's top-left corner, which is where the sash's
    // own stiles and rails put it
    expect(rects.map(r => `${r.x},${r.y}`)).toEqual(['100,50', '100,1251'])
    // the nodes come with them, so a click can select one
    expect(rects.map(r => r.node.part_type)).toEqual(['glassPart', 'panelPart'])
  })

  it('a plain fanlight sash has nothing extra to draw', () => {
    // One glass cell and no divider: the renderer must fall through to the
    // drawing it has always done, or every casement window changes.
    const { tree } = buildFrontDoorFrame(PV, { width: 1099, height: 2595, columns: 1, rows: 1 })
    const leaf = doorLeaves(tree)[0]
    const rects = gridRectsFor(tree, leaf, 0, 0)
    expect(rects.length).toBe(1)
    expect(rects[0].kind).toBe('glass')
    // and a part that cannot hold a grid at all answers with nothing
    expect(gridRectsFor(tree, frameOf(tree), 0, 0)).toEqual([])
  })
})
