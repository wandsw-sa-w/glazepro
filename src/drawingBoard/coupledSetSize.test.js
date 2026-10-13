/**
 * coupledSetSize.test.js — Step BC follow-up item 2
 *
 * The board summary's "Frame:" line read the FIRST frame, so a coupled set
 * said 693 x 1136 — a flag light — where the drawing is a 2287 x 2101 door
 * set. The size of a set is not a thing the tree states: it is the frames'
 * widths less one jamb per joint (containerPart.partSpacing is -47), by the
 * DOOR frame's height.
 */

import { describe, it, expect } from 'vitest'
import { coupledSetSize, frameSizeLabel } from '../pricing/casementGeometry.js'
import { buildCoupledSingleDoorFrame, buildSingleDoorFrame, FLAG_FRAME_TEMPLATES } from './doorOpenings.js'
import { itemFrames } from '../pricing/casementGeometry.js'
/** The open_out_doors profile, as frenchDoor.test.js holds it. */
const PV_DOORS = {
  'assemblyFramePart.leftWidth': 47, 'assemblyFramePart.rightWidth': 47,
  'assemblyFramePart.topHeight': 47, 'assemblyFramePart.bottomHeight': 37,
  'assemblyFramePart.frameDepth': 96,
  'assemblyFramePart.frameHeadStopSize': 20,
  'assemblyFramePart.frameStileStopSize': 20,
  'assemblyFramePart.cillStopSize': 26,
  'cillPart.height': 37, 'cillPart.depth': 145,
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
  'casementSashPart.thickness': 54, 'casementSashPart.topHeight': 62,
  'casementSashPart.leftWidth': 62, 'casementSashPart.rightWidth': 62,
  'casementSashPart.defaultFanlightBottomHeight': 58,
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 15,
  'glassPart.defaultDoubleGlazingTolerance': 3,
}

describe('coupledSetSize — the size of a coupled set', () => {
  it('CD1’s three frames are one 2287 x 2101 set', () => {
    const { tree } = buildCoupledSingleDoorFrame(PV_DOORS, {
      doorWidth: 995, doorHeight: 2101,
    })
    // 693 + 995 + 693 = 2381, less one jamb per joint: 2381 - 2 x 47 = 2287
    expect(coupledSetSize(tree)).toEqual({ width: 2287, height: 2101, frames: 3 })
  })

  it('two frames lose ONE jamb, not two', () => {
    const { tree } = buildCoupledSingleDoorFrame(PV_DOORS, {
      doorWidth: 998, doorHeight: 2101, flags: ['right'],
    })
    expect(coupledSetSize(tree)).toEqual({ width: 998 + 693 - 47, height: 2101, frames: 2 })
  })

  it('the height is the DOOR frame’s, not the tallest or the first', () => {
    // Template 69: flags 1632 high, door frame 2496. The flags come first in
    // the tree, so "the first frame" and "the door frame" differ.
    const { tree } = buildCoupledSingleDoorFrame(PV_DOORS, {
      doorWidth: 1082, doorHeight: 2496, flagWidth: 650, flagHeight: 1632,
      fanlights: { doorOffset: 348, flagOffset: 348 },
    })
    const size = coupledSetSize(tree)
    expect(size.height).toBe(2496)
    expect(size.width).toBe(650 + 1082 + 650 - 2 * 47)
  })

  it('a ONE-frame drawing is just its frame', () => {
    const { tree } = buildSingleDoorFrame(PV_DOORS, { width: 1099, height: 2199 })
    expect(coupledSetSize(tree)).toEqual({ width: 1099, height: 2199, frames: 1 })
  })

  it('the summary label says the set size and how many frames', () => {
    const coupled = buildCoupledSingleDoorFrame(PV_DOORS, {
      doorWidth: 995, doorHeight: 2101,
    }).tree
    expect(frameSizeLabel(coupled)).toBe('2287 × 2101 mm (3 frames, coupled)')

    const single = buildSingleDoorFrame(PV_DOORS, { width: 1099, height: 2199 }).tree
    expect(frameSizeLabel(single)).toBe('1099 × 2199 mm')

    expect(frameSizeLabel(null)).toBe('—')
  })
})

// ── Step BC follow-up item 3: the flag-and-fan template's door hand ─────────

describe('FLAG_FRAME_TEMPLATES — the four coupled templates, as code', () => {
  it('names the four templates with their sizes and sort orders', () => {
    expect(FLAG_FRAME_TEMPLATES.map(t => [t.name, t.sort_order])).toEqual([
      ['Single Door With Flag Lights', 100],
      ['Single Door With Flag Light Right', 110],
      ['Single Door With Flag Light Left', 120],
      ['Single Door With Flag And Fan Lights', 130],
    ])
  })

  it('the flag-and-fan door is RIGHT hand, as Integrate’s CD4 is', () => {
    // Integrate's drawing 15 has the leaf at operation 18 (right hand hung);
    // sql/step-bc2 built the template left hand, which is the board's default
    // for a single door and wrong for this one. sql/step-bc3 corrects the
    // live row.
    const spec = FLAG_FRAME_TEMPLATES.find(t => t.name === 'Single Door With Flag And Fan Lights')
    expect(spec.options.operation).toBe('right_hand_hung')

    const { tree, missing } = buildCoupledSingleDoorFrame(PV_DOORS, spec.options)
    expect(missing).toEqual([])
    const leaves = []
    const walk = n => {
      if (n.part_type === 'doorLeafPart') leaves.push(n)
      for (const c of (n.children ?? [])) walk(c)
    }
    walk(tree)
    expect(leaves.length).toBe(1)
    expect(leaves[0].values.operation).toBe('right_hand_hung')
  })

  it('the other three keep the board’s left-hand default, as Integrate has them', () => {
    for (const name of ['Single Door With Flag Lights',
      'Single Door With Flag Light Right', 'Single Door With Flag Light Left']) {
      const spec = FLAG_FRAME_TEMPLATES.find(t => t.name === name)
      const { tree } = buildCoupledSingleDoorFrame(PV_DOORS, spec.options)
      const leaf = (function find(n) {
        if (n.part_type === 'doorLeafPart') return n
        for (const c of (n.children ?? [])) { const f = find(c); if (f) return f }
        return null
      })(tree)
      expect(leaf.values.operation, name).toBe('left_hand_hung')
    }
  })

  it('every spec builds a saveable tree with the frames it promises', () => {
    const sizes = {
      'Single Door With Flag Lights': ['693x1136', '995x2101', '693x1136'],
      'Single Door With Flag Light Right': ['998x2101', '693x1136'],
      'Single Door With Flag Light Left': ['693x1136', '998x2101'],
      'Single Door With Flag And Fan Lights': ['650x1632', '1082x2496', '650x1632'],
    }
    for (const spec of FLAG_FRAME_TEMPLATES) {
      const { tree, missing } = buildCoupledSingleDoorFrame(PV_DOORS, spec.options)
      expect(missing, spec.name).toEqual([])
      expect(itemFrames(tree).map(f => `${f.values.width}x${f.values.height}`), spec.name)
        .toEqual(sizes[spec.name])
    }
  })
})
