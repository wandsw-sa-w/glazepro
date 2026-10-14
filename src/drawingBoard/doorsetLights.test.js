// doorsetLights.test.js — Step BH item 1
//
// EVERY doorset can have side lights, top lights and flag windows (Nathan,
// 14 Oct 2026): a French pair in or out, a single garden door in or out, a
// front door, a stable door in or out. Templates exist only for the products
// Nathan sells; everything else is built on the board from any door, and must
// price correctly.
//
// WHAT THE BOARD COULD DO BEFORE THIS STEP, measured rather than assumed:
//
//   + Flag left / + Flag right    WORKED on all four door kinds. addFlagFrame
//                                 acts on FRAMES, so it never knew what was
//                                 in them, and the buttons are offered on
//                                 `isDoorDrawing` — which is every door.
//   Transom / Mullion…            THREW on all four, both the whole-frame
//                                 grid and the split-this-opening tiles:
//                                 "Missing profile value thicknessInFrameSolid".
//                                 A door profile keys its divider section as
//                                 transomPart.thicknessInFrame (41, which is
//                                 Integrate's own doorset divider) and holds
//                                 no mullionPart.thicknessInFrameSolid, so a
//                                 door drawing could not be divided AT ALL.
//   the new opening               would have been a COPY OF THE DOOR — a
//                                 second stable door beside the first — and
//                                 on the whole-frame grid not even that: the
//                                 door was not in that function's idea of an
//                                 opening, so the dividers went in and left
//                                 no opening in the new cells.
//
// All three are fixed here, and these tests are what hold them.

import { describe, it, expect } from 'vitest'

import {
  buildFrenchDoorFrame, buildSingleDoorFrame, buildFrontDoorFrame,
  buildStableDoorFrame, addFlagFrame, isDoorTree,
  doorsetDirectGlazedUnit, newDoorsetOpeningFor,
} from './doorOpenings.js'
import { splitOpening, applyDividers } from './gridActions.js'
import { changeOpening, openingNodes, openingKindOf } from './casementOpenings.js'
import { assertSaveable } from './containment.js'
import { frameInterior, frameCells, itemFrames } from '../pricing/casementGeometry.js'
import { stableDoorSize, doorLeaves, doorLeafSize } from '../pricing/doorGeometry.js'
import { DOOR_PROFILE_VALUES, OPEN_IN_PROFILE_VALUES } from '../pricing/benchmarks/fixtureDoor.js'

/** The board passes its `profileValueMap`: SHORT keys, one namespace. */
const shortOf = map => Object.fromEntries(
  Object.entries(map).map(([k, v]) => [k.split('.').pop(), v]))

const OUT = DOOR_PROFILE_VALUES
const IN  = OPEN_IN_PROFILE_VALUES

const frameOf = tree => itemFrames(tree)[0]
const childTypes = tree => (frameOf(tree).children ?? []).map(c => c.part_type)
const dividersOf = (tree, type) => (frameOf(tree).children ?? [])
  .filter(c => c.part_type === type)

/** The four door kinds, each at its own template size. */
const DOORS = [
  ['a French pair', () => buildFrenchDoorFrame(OUT, {}).tree, OUT, 'frenchDoorPart'],
  ['a single garden door', () => buildSingleDoorFrame(OUT, {}).tree, OUT, 'doorLeafPart'],
  ['a front door', () => buildFrontDoorFrame(IN, {}).tree, IN, 'doorLeafPart'],
  ['a stable door', () => buildStableDoorFrame(IN, {}).tree, IN, 'stableDoorPart'],
]

describe('Step BH — a divider beside or above any door', () => {
  for (const [label, build, pv, doorType] of DOORS) {
    it(`${label} takes a MULLION, and the new opening is a light`, () => {
      const tree = build()
      expect(tree, label).toBeTruthy()
      const frame = frameOf(tree)
      const door = openingNodes(tree, frame)[0]
      expect(door.part_type).toBe(doorType)

      const next = splitOpening(tree, frame.key, door.key, 'mullion', shortOf(pv),
        { newOpeningFor: newDoorsetOpeningFor(pv) })

      // Integrate's own doorset divider: 41, from the door profile
      const mullions = dividersOf(next, 'mullionPart')
      expect(mullions.length).toBe(1)
      expect(mullions[0].values.thicknessInFrame).toBe(41)

      // the door is STILL THERE, exactly once, and the new cell is a direct
      // glazed unit — never a second door
      const openings = openingNodes(next, frameOf(next))
      expect(openings.map(o => o.part_type)).toEqual([doorType, 'glassPart'])
      expect(openingKindOf(openings[1])).toBe('direct_glazed')
      expect(() => assertSaveable(next)).not.toThrow()
    })

    it(`${label} takes a TRANSOM, with the light above it`, () => {
      const tree = build()
      const frame = frameOf(tree)
      const door = openingNodes(tree, frame)[0]
      const next = splitOpening(tree, frame.key, door.key, 'transom', shortOf(pv),
        { newOpeningFor: newDoorsetOpeningFor(pv) })

      expect(dividersOf(next, 'transomPart').length).toBe(1)
      // row-major order: the TOP cell first, so the light comes before the door
      const openings = openingNodes(next, frameOf(next))
      expect(openings.map(o => o.part_type)).toEqual(['glassPart', doorType])
      expect(() => assertSaveable(next)).not.toThrow()
    })

    it(`${label}: the whole-frame 2 x 1 grid keeps the door and adds a light`, () => {
      const tree = build()
      const frame = frameOf(tree)
      const i = frameInterior(tree)
      const next = applyDividers(tree, frame.key, 2, 1, i.width, i.height,
        shortOf(pv), 'solid', { newOpeningFor: newDoorsetOpeningFor(pv) })

      expect(dividersOf(next, 'mullionPart').length).toBe(1)
      const openings = openingNodes(next, frameOf(next))
      expect(openings.map(o => o.part_type)).toEqual([doorType, 'glassPart'])
      // and the cill is still the frame's last child, as every builder leaves it
      expect(childTypes(next)).toContain('cillPart')
      expect(() => assertSaveable(next)).not.toThrow()
    })

    it(`${label}: the new light can be made a fixed or an opening casement`, () => {
      const tree = build()
      const frame = frameOf(tree)
      const door = openingNodes(tree, frame)[0]
      const split = splitOpening(tree, frame.key, door.key, 'mullion', shortOf(pv),
        { newOpeningFor: newDoorsetOpeningFor(pv) })
      const dgu = openingNodes(split, frameOf(split))[1]

      for (const [kind, operation] of [['fixed_casement', 'fix'], ['opening_casement', null]]) {
        const { tree: changed, changed: did } = changeOpening(split, dgu.key, kind, pv)
        expect(did, `${label} -> ${kind}`).toBe(true)
        const openings = openingNodes(changed, frameOf(changed))
        expect(openings.map(o => o.part_type)).toEqual([doorType, 'casementSashPart'])
        if (operation) expect(openings[1].values.operation).toBe(operation)
        else expect(openings[1].values.operation).not.toBe('fix')
        // a side light in a door frame takes the door profile's own sash
        // sections (62 / 62 / 62), not a casement window's
        expect(openings[1].values.topHeight).toBe(62)
        expect(() => assertSaveable(changed)).not.toThrow()
      }
    })

    it(`${label} takes a flag frame on either side`, () => {
      const tree = build()
      expect(isDoorTree(tree)).toBe(true)
      for (const side of ['left', 'right']) {
        const { tree: next, changed, missing } = addFlagFrame(tree, frameOf(tree).key, side, pv)
        expect(missing ?? [], `${label} ${side}`).toEqual([])
        expect(changed, `${label} ${side}`).toBe(true)
        const frames = itemFrames(next)
        expect(frames.length).toBe(2)
        // the door frame is still the door frame, and the flag is the other
        const doorFrames = frames.filter(f => (f.children ?? []).some(
          c => c.part_type === doorType))
        expect(doorFrames.length).toBe(1)
        expect(() => assertSaveable(next)).not.toThrow()
      }
    })
  }

  it('a divider on a CASEMENT window is unchanged — still the solid 27', () => {
    // The fallback must not reach a casement drawing: its own
    // thicknessInFrameSolid still wins, and a profile with neither key still
    // refuses to guess.
    const casementPv = { thicknessInFrameSolid: 27, mullionStopSize: 20 }
    const tree = {
      key: 'item', part_type: 'drawingItemPart', values: {}, children: [
        { key: 'f', part_type: 'assemblyFramePart',
          values: { width: 1199, height: 1299, leftWidth: 47, rightWidth: 47, topHeight: 47, bottomHeight: 47 },
          children: [
            { key: 'cas', part_type: 'casementSashPart', values: { operation: 'fix' }, children: [] },
            { key: 'cill', part_type: 'cillPart', values: { height: 47 }, children: [] },
          ] },
      ],
    }
    const next = splitOpening(tree, 'f', 'cas', 'mullion', casementPv)
    expect(dividersOf(next, 'mullionPart')[0].values.thicknessInFrame).toBe(27)
    // with no divider section at all, nothing is added and the message names
    // BOTH keys it tried
    expect(() => splitOpening(tree, 'f', 'cas', 'mullion', {}))
      .toThrow(/thicknessInFrameSolid.*thicknessInFrame/s)
  })
})

describe('Step BH — a stable door under a transom', () => {
  it('the container sits in its CELL, and its halves follow it', () => {
    const tree = buildStableDoorFrame(IN, {}).tree
    const frame = frameOf(tree)
    const container = openingNodes(tree, frame)[0]
    const before = stableDoorSize(tree, container)

    // a fanlight over the door: the transom goes in the middle of the cell,
    // which is what the palette does; a surveyor then types the offset
    const next = splitOpening(tree, frame.key, container.key, 'transom', shortOf(IN),
        { newOpeningFor: newDoorsetOpeningFor(IN) })
    const after = openingNodes(next, frameOf(next))
      .find(o => o.part_type === 'stableDoorPart')
    const size = stableDoorSize(next, after)

    expect(size.width).toBe(before.width)
    // the door is shorter by the fanlight and the transom
    expect(size.height).toBeLessThan(before.height)
    const cell = frameCells(next, frameOf(next))[1]
    expect(size.height).toBe(cell.height - 4 - 3)   // its own 4 / 3 clearances

    // the TOP half keeps its stored split and the BOTTOM half takes the rest,
    // which is the whole of the stable-door model (Step BF)
    const halves = doorLeaves(next)
    expect(halves.map(h => doorLeafSize(next, h).height))
      .toEqual([1055, size.height - 1055])
    expect(() => assertSaveable(next)).not.toThrow()
  })
})

describe('Step BH — one definition of a doorset light', () => {
  it('the direct glazed unit is Integrate’s doorset unit: 15 clear, 12 hidden', () => {
    const dgu = doorsetDirectGlazedUnit(IN)
    expect(dgu.part_type).toBe('glassPart')
    expect(dgu.values.mechanicalClearanceTop).toBe(15)
    expect(dgu.values.hiddenInRebateTop).toBe(12)
    expect(dgu.values.glazingRebateWidth).toBe(15)
    expect(dgu.values.toBeReplaced).toBe(true)
  })

  it('the factory replaces a DOOR and copies anything else', () => {
    const factory = newDoorsetOpeningFor(IN)
    expect(factory({ part_type: 'doorLeafPart', values: {} }).part_type).toBe('glassPart')
    expect(factory({ part_type: 'frenchDoorPart', values: {} }).part_type).toBe('glassPart')
    expect(factory({ part_type: 'stableDoorPart', values: {} }).part_type).toBe('glassPart')
    // a light beside a light is still a copy of that light — the surveyor's
    // own sections survive, as they do on a casement window
    expect(factory({ part_type: 'casementSashPart', values: {} })).toBe(null)
    expect(factory({ part_type: 'glassPart', values: {} })).toBe(null)
  })

  it('the glass CODES carry over from the door’s own glass', () => {
    const tree = buildFrenchDoorFrame(OUT, {}).tree
    const frame = frameOf(tree)
    const door = openingNodes(tree, frame)[0]
    const next = splitOpening(tree, frame.key, door.key, 'mullion', shortOf(OUT),
      { newOpeningFor: newDoorsetOpeningFor(OUT) })
    const dgu = openingNodes(next, frameOf(next))[1]
    expect(dgu.values.glazingId).toBe('double_glazing')
    expect(dgu.values.internalGlassPartNo).toBeTruthy()
  })
})
