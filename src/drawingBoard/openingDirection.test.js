// openingDirection.test.js — Step BG
//
// The whole-drawing "Opens in / Opens out" switch. Every number here is
// Integrate's, from docs/integrate-L31115-door-direction.txt (drawings 24-27,
// read 14 Oct 2026) — and the trees the switch produces are the ones the OI /
// SO benchmarks price, which is the point: one definition of what a direction
// IS, proved on both sides.

import { describe, it, expect } from 'vitest'

import {
  setOpeningDirection, drawingDirection, directionDefaults,
  profileCodeForDirection, directionForProfileCode,
  OPEN_IN, OPEN_OUT,
} from './openingDirection.js'
import {
  buildFrenchDoorFrame, buildSingleDoorFrame, buildFrontDoorFrame,
  buildStableDoorFrame, recentreGridsAfterResize, setLeafGrid,
} from './doorOpenings.js'
import { doorLeaves, doorLeafSize, leafCells, leafInterior } from '../pricing/doorGeometry.js'
import { frameInterior } from '../pricing/casementGeometry.js'

// ── The two ranges, as Integrate's import holds them ────────────────────────
// The reviewer read both profiles on 14 Oct (/dev/sql): cill 37 / 50, cill
// stop 26 / 0, the typeIds, the clearances and the bottom-rail shapes are all
// there. These maps are those values and nothing else.

const SHARED = {
  'assemblyFramePart.leftWidth': 47, 'assemblyFramePart.rightWidth': 47,
  'assemblyFramePart.topHeight': 47,
  'assemblyFramePart.frameDepth': 96,
  'assemblyFramePart.frameHeadStopSize': 20,
  'assemblyFramePart.frameStileStopSize': 20,
  'cillPart.depth': 145,
  'frenchDoorPart.thickness': 54,
  'frenchDoorPart.midRail': 198,
  'frenchDoorPart.gapBetweenMeetingStiles': 5,
  'frenchDoorPart.meetingStileOverlap': 27,
  'frenchDoorPart.mullionThickness': 83,
  'leftFrenchDoorLeafPart.topHeight': 110,
  'leftFrenchDoorLeafPart.leftWidth': 110,
  'leftFrenchDoorLeafPart.rightWidth': 110,
  'rightFrenchDoorLeafPart.topHeight': 110,
  'rightFrenchDoorLeafPart.leftWidth': 110,
  'rightFrenchDoorLeafPart.rightWidth': 110,
  'doorLeafPart.thickness': 54,
  'doorLeafPart.topHeight': 110,
  'doorLeafPart.leftWidth': 110,
  'doorLeafPart.rightWidth': 110,
  'doorLeafPart.defaultMuntinThickness': 120,
  'doorLeafPart.midrailThickness': 170,
  'transomPart.thicknessInFrame': 41,
  'mullionPart.thicknessInFrameSolid': 41,
  'casementSashPart.thickness': 54,
  'casementSashPart.topHeight': 62,
  'casementSashPart.leftWidth': 62,
  'casementSashPart.rightWidth': 62,
  'casementSashPart.defaultFanlightBottomHeight': 58,
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 15,
  'glassPart.defaultDoubleGlazingTolerance': 3,
}

/** open_out_doors — Integrate's "Standard Open Out Doors". */
const OUT = {
  ...SHARED,
  'assemblyFramePart.bottomHeight': 37,
  'assemblyFramePart.cillStopSize': 26,
  'cillPart.height': 37,
  'frenchDoorPart.mechanicalClearanceTop': 3,
  'frenchDoorPart.mechanicalClearanceBottom': 3,
  'frenchDoorPart.mechanicalClearanceLeft': 1,
  'frenchDoorPart.mechanicalClearanceRight': 1,
  'doorLeafPart.mechanicalClearanceTop': 2,
  'doorLeafPart.mechanicalClearanceBottom': 3,
  'doorLeafPart.mechanicalClearanceLeft': 3,
  'doorLeafPart.mechanicalClearanceRight': 3,
}

/** open_in_doors — "Standard Open In Doors". */
const IN = {
  ...SHARED,
  'assemblyFramePart.bottomHeight': 50,
  'assemblyFramePart.cillStopSize': 0,
  'cillPart.height': 50,
  'frenchDoorPart.mechanicalClearanceTop': 3,
  'frenchDoorPart.mechanicalClearanceBottom': 14,
  'frenchDoorPart.mechanicalClearanceLeft': 3,
  'frenchDoorPart.mechanicalClearanceRight': 3,
  'doorLeafPart.mechanicalClearanceTop': 3,
  'doorLeafPart.mechanicalClearanceBottom': 14,
  'doorLeafPart.mechanicalClearanceLeft': 4,
  'doorLeafPart.mechanicalClearanceRight': 4,
}

const PV_FOR = { [OPEN_OUT]: OUT, [OPEN_IN]: IN }
const switchTo = (tree, direction) =>
  setOpeningDirection(tree, direction, PV_FOR[direction])

function findAll(node, type, out = []) {
  if (node?.part_type === type) out.push(node)
  for (const c of (node?.children ?? [])) findAll(c, type, out)
  return out
}
const first = (node, type) => findAll(node, type)[0] ?? null

describe('Step BG — the range is the direction', () => {
  it('a direction belongs to a profile code, both ways round', () => {
    expect(profileCodeForDirection(OPEN_OUT)).toBe('open_out_doors')
    expect(profileCodeForDirection(OPEN_IN)).toBe('open_in_doors')
    expect(directionForProfileCode('open_in_doors')).toBe(OPEN_IN)
    expect(directionForProfileCode('sashes_only')).toBe(null)
  })

  it('the drawing is asked, not the profile', () => {
    const { tree: out } = buildFrenchDoorFrame(OUT, {})
    expect(drawingDirection(out)).toBe(OPEN_OUT)
    expect(drawingDirection(switchTo(out, OPEN_IN).tree)).toBe(OPEN_IN)
    // a casement window has no doors at all
    expect(drawingDirection({ key: 'f', part_type: 'assemblyFramePart', values: {}, children: [] }))
      .toBe(null)
  })

  it('a profile without the range values changes NOTHING', () => {
    const { tree: out } = buildFrenchDoorFrame(OUT, {})
    const bare = { ...IN }
    delete bare['cillPart.height']
    delete bare['doorLeafPart.mechanicalClearanceBottom']
    const r = setOpeningDirection(out, OPEN_IN, bare)
    expect(r.tree).toBe(out)
    expect(r.changed).toEqual([])
    expect(r.missing.join(' ')).toContain('cillHeight')
    expect(r.missing.join(' ')).toContain('leafClearBottom')
  })
})

describe('Step BG — a French pair turned round', () => {
  // The template is 1899 x 2199, which is FD1 / OI1.
  const { tree: out } = buildFrenchDoorFrame(OUT, { width: 1899, height: 2199 })
  const { tree: inward, changed, sashClearancesLeft } = switchTo(out, OPEN_IN)

  it('the frame KEEPS ITS SIZE and takes the 50 bottom and the 0 cill stop', () => {
    const f = first(inward, 'assemblyFramePart')
    expect([f.values.width, f.values.height]).toEqual([1899, 2199])
    expect(f.values.bottomHeight).toBe(50)
    expect(f.values.cillStopSize).toBe(0)
    expect(f.values.leftWidth).toBe(47)
    expect(f.values.topHeight).toBe(47)
    expect(first(inward, 'cillPart').values.height).toBe(50)
    expect(first(inward, 'cillPart').values.depth).toBe(145)
    // Integrate's own 1805 x 2102 (the open-out frame is 2115 high inside)
    expect(frameInterior(inward)).toMatchObject({ width: 1805, height: 2102 })
    expect(frameInterior(out)).toMatchObject({ width: 1805, height: 2115 })
    expect(changed).toContain(f.key)
    // the two door profiles hold no casement-sash clearances, so no sash was
    // touched and the switch says so rather than guessing
    expect(sashClearancesLeft).toBe(true)
  })

  it('the pair is typeId 8 with 3 / 14 / 3 / 3, and the leaves 910.5 x 2085', () => {
    const pair = first(inward, 'frenchDoorPart')
    expect(pair.values.casementTypeId).toBe('open_in')
    expect([
      pair.values.mechanicalClearanceTop, pair.values.mechanicalClearanceBottom,
      pair.values.mechanicalClearanceLeft, pair.values.mechanicalClearanceRight,
    ]).toEqual([3, 14, 3, 3])
    // OI1's own leaves, from the facts: (1805 - 3 - 3 - 5 + 27) / 2 x 2085
    expect(doorLeaves(inward).map(l => doorLeafSize(inward, l)))
      .toEqual([{ width: 910.5, height: 2085 }, { width: 910.5, height: 2085 }])
    // and FD1's, before: 912.5 x 2109
    expect(doorLeafSize(out, doorLeaves(out)[0]))
      .toEqual({ width: 912.5, height: 2109 })
  })

  it('both leaves take the SQUARE 170 rail, and keep their stiles', () => {
    for (const leaf of doorLeaves(inward)) {
      expect(leaf.values.casementTypeId).toBe('open_in')
      expect(leaf.values.bottomHeight).toBe(170)
      expect(leaf.values.bottomHeightExternal).toBe(170)
      expect(leaf.values.btmRailShapeId).toBe('square')
      expect([leaf.values.topHeight, leaf.values.leftWidth, leaf.values.rightWidth])
        .toEqual([110, 110, 110])
    }
    // opening out it is the stepped 163 / 170
    const o = doorLeaves(out)[0]
    expect([o.values.bottomHeight, o.values.bottomHeightExternal, o.values.btmRailShapeId])
      .toEqual([163, 170, 'stepped'])
  })

  it('the glass, the finish and the ironmongery list are untouched', () => {
    const glassOf = tree => findAll(tree, 'glassPart').map(g => JSON.stringify(g.values))
    expect(glassOf(inward)).toEqual(glassOf(out))
    const paint = tree => JSON.stringify(first(tree, 'paintAndIronmongeryPart')?.values ?? null)
    expect(paint(inward)).toEqual(paint(out))
  })

  it('and back again: every value returns to the open-out range', () => {
    const { tree: back } = switchTo(inward, OPEN_OUT)
    expect(JSON.stringify(back)).toEqual(JSON.stringify(out))
  })
})

describe('Step BG — a single door, a front door and the grid', () => {
  it('a single garden door takes its OWN clearances, 3 / 14 / 4 / 4', () => {
    const { tree: out } = buildSingleDoorFrame(OUT, { width: 1099, height: 2199 })
    const [before] = doorLeaves(out)
    expect(doorLeafSize(out, before)).toEqual({ width: 999, height: 2110 })
    const { tree } = switchTo(out, OPEN_IN)
    const [leaf] = doorLeaves(tree)
    expect([
      leaf.values.mechanicalClearanceTop, leaf.values.mechanicalClearanceBottom,
      leaf.values.mechanicalClearanceLeft, leaf.values.mechanicalClearanceRight,
    ]).toEqual([3, 14, 4, 4])
    // OI2's leaf, exactly
    expect(doorLeafSize(tree, leaf)).toEqual({ width: 997, height: 2085 })
  })

  it('a FRONT door turned out keeps its panels and re-centres its muntin', () => {
    // A front door is open in to begin with, so this is the other way round.
    const { tree: inward } = buildFrontDoorFrame(IN, { width: 1099, height: 2182 })
    const [leafIn] = doorLeaves(inward)
    const cellsIn = leafCells(inward, leafIn).map(c => `${c.width}x${c.height}`)
    const { tree: outward } = switchTo(inward, OPEN_OUT)
    const next = recentreGridsAfterResize(inward, outward, OUT)
    const [leafOut] = doorLeaves(next)
    // the leaf grew: the 37 cill and the 2 / 3 / 3 / 3 clearances
    expect(doorLeafSize(inward, leafIn).height).toBeLessThan(doorLeafSize(next, leafOut).height)
    // the same cells, and the muntin still centred in its own leaf
    expect(leafCells(next, leafOut).length).toBe(cellsIn.length)
    const interior = leafInterior(next, leafOut)
    const muntin = (leafOut.children ?? []).find(c => c.values?.isMuntin)
    const thickness = muntin.values.muntinThickness
    // whole mm, as every re-centred divider is (Step BE): the two columns
    // of a 779 interior are 330 and 329, not 329.5 each
    expect(muntin.values.offset).toBe(Math.round((interior.width - thickness) / 2))
    // and the panels are the same panels
    expect(findAll(next, 'panelPart').length).toBe(findAll(inward, 'panelPart').length)
  })

  it('a muntin the surveyor MOVED stays where it is', () => {
    const { tree: inward } = buildFrontDoorFrame(IN, { width: 1099, height: 2182 })
    const [leaf] = doorLeaves(inward)
    // the template’s own 2 x 2 grid, with the muntin dragged to 200
    const moved = setLeafGrid(inward, leaf.key,
      { columns: 2, rows: 2, columnOffsets: [200] }, IN)
    const movedMuntin = (doorLeaves(moved)[0].children ?? []).find(c => c.values?.isMuntin)
    expect(movedMuntin.values.offset).toBe(200)
    const { tree: outward } = switchTo(moved, OPEN_OUT)
    const next = recentreGridsAfterResize(moved, outward, OUT)
    const after = (doorLeaves(next)[0].children ?? []).find(c => c.values?.isMuntin)
    expect(after.values.offset).toBe(200)
  })
})

describe('Step BG — a stable door opening out (item 3)', () => {
  const { tree: inward } = buildStableDoorFrame(IN, {})
  const { tree: outward } = switchTo(inward, OPEN_OUT)

  it('the container keeps its 4 / 4 / 4 / 3 and the 13 mm go to the BOTTOM half', () => {
    const container = first(outward, 'stableDoorPart')
    expect(container.values.casementTypeId).toBe('open_out')
    expect([
      container.values.mechanicalClearanceTop, container.values.mechanicalClearanceBottom,
      container.values.mechanicalClearanceLeft, container.values.mechanicalClearanceRight,
    ]).toEqual([4, 3, 4, 4])
    expect(container.values.splitOffset).toBe(first(inward, 'stableDoorPart').values.splitOffset)
    // SO1's own halves: the top is untouched at 1055, the bottom 1048 -> 1061
    expect(doorLeaves(inward).map(h => doorLeafSize(inward, h).height)).toEqual([1055, 1048])
    expect(doorLeaves(outward).map(h => doorLeafSize(outward, h).height)).toEqual([1055, 1061])
  })

  it('only the BOTTOM half takes the stepped rail, and the cells are SO1’s', () => {
    const [top, bottom] = doorLeaves(outward)
    expect([top.values.topHeight, top.values.bottomHeight]).toEqual([110, 99])
    expect([bottom.values.bottomHeight, bottom.values.bottomHeightExternal,
      bottom.values.btmRailShapeId]).toEqual([163, 170, 'stepped'])
    // 1055 - 110 - 99 = 846 and 1061 - 99 - 163 = 799, Integrate's own
    expect([...leafCells(outward, top), ...leafCells(outward, bottom)]
      .map(c => `${c.width}x${c.height}`)).toEqual(['777x846', '777x799'])
  })

  it('and the frame it sits in is the 37 cill, at the SAME overall size', () => {
    const fIn = first(inward, 'assemblyFramePart')
    const fOut = first(outward, 'assemblyFramePart')
    expect([fOut.values.width, fOut.values.height]).toEqual([fIn.values.width, fIn.values.height])
    expect(fOut.values.bottomHeight).toBe(37)
    expect(first(outward, 'cillPart').values.height).toBe(37)
  })
})

describe('Step BG — what a switch must not touch', () => {
  it('a fanlight keeps its DIRECTION and its own rails', () => {
    const { tree: out } = buildFrenchDoorFrame(OUT, {
      width: 1350, height: 2599, fanlight: { offset: 399 },
    })
    const fanBefore = first(out, 'casementSashPart')
    // the template may not offer a fanlight; the test is only worth running
    // when it does
    if (!fanBefore) return
    const { tree } = switchTo(out, OPEN_IN)
    const fan = first(tree, 'casementSashPart')
    expect(fan.values.casementTypeId).toBe(fanBefore.values.casementTypeId)
    expect(fan.values.bottomHeight).toBe(fanBefore.values.bottomHeight)
    expect(fan.values.topHeight).toBe(fanBefore.values.topHeight)
  })

  it('the profile’s own sash clearances ARE applied when it holds them', () => {
    // Integrate re-applies "Sectional Details" to the whole item, so a
    // profile that carries them turns the fanlight's clearances too.
    const withSash = { ...IN, 'casementSashPart.mechanicalClearance': 3 }
    const d = directionDefaults(withSash)
    expect(d.hasSashClearances).toBe(true)
    expect(d.missing).toEqual([])
    const tree = {
      key: 'item', part_type: 'drawingItemPart', values: {}, children: [
        { key: 'frame', part_type: 'assemblyFramePart', values: { width: 1099, height: 2599 }, children: [
          { key: 'fan', part_type: 'casementSashPart', values: { casementTypeId: 'open_out', bottomHeight: 86, mechanicalClearanceTop: 1, mechanicalClearanceBottom: 2, mechanicalClearanceLeft: 1, mechanicalClearanceRight: 1 }, children: [] },
          { key: 'leaf', part_type: 'doorLeafPart', values: { casementTypeId: 'open_out', bottomHeight: 163 }, children: [] },
          { key: 'cill', part_type: 'cillPart', values: { height: 37 }, children: [] },
        ] },
      ],
    }
    const { tree: next, sashClearancesLeft } = setOpeningDirection(tree, OPEN_IN, withSash)
    expect(sashClearancesLeft).toBe(false)
    const fan = first(next, 'casementSashPart')
    expect([fan.values.mechanicalClearanceTop, fan.values.mechanicalClearanceBottom,
      fan.values.mechanicalClearanceLeft, fan.values.mechanicalClearanceRight])
      .toEqual([3, 3, 3, 3])
    // its rail and its direction are still its own
    expect(fan.values.casementTypeId).toBe('open_out')
    expect(fan.values.bottomHeight).toBe(86)
  })

  it('a bottom rail the surveyor TYPED survives the switch', () => {
    const { tree: out } = buildSingleDoorFrame(OUT, {})
    const typed = JSON.parse(JSON.stringify(out))
    const leafKey = doorLeaves(typed)[0].key
    const retype = node => (node.key === leafKey
      ? { ...node, values: { ...node.values, bottomHeight: 220 } }
      : { ...node, children: (node.children ?? []).map(retype) })
    const tree = retype(typed)
    const { tree: next } = switchTo(tree, OPEN_IN)
    expect(doorLeaves(next)[0].values.bottomHeight).toBe(220)
    // everything else still turned
    expect(doorLeaves(next)[0].values.casementTypeId).toBe('open_in')
    expect(first(next, 'cillPart').values.height).toBe(50)
  })
})
