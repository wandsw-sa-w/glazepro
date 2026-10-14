/**
 * stableDoor.test.js — Step BF part B: the stable door on the board.
 *
 * docs/integrate-L31115-stable-doors.txt, Nathan's decisions h-k. A stable
 * door is one container in the frame holding a TOP and a BOTTOM half, each an
 * ordinary door leaf with its own grid — so every count, loop and label that
 * knows a door leaf sees both halves without being told about stable doors.
 */

import { describe, it, expect } from 'vitest'
import {
  buildStableDoorFrame, isStableDoorTree, isDoorTree, isFrontDoorTree,
  STABLE_DOOR_TEMPLATES, STABLE_DOOR_DEFAULTS,
} from './doorOpenings.js'
import {
  doorLeaves, doorLeafSize, leafCells, stableDoorParts, stableHalves,
  isStableHalf, stableDoorSize, allocatedSectionParts,
} from '../pricing/doorGeometry.js'
import { assertSaveable, duplicateKeys } from './containment.js'
import { partLabel } from './partLabels.js'

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

const frameOf = tree => tree.children.find(c => c.part_type === 'assemblyFramePart')
const kindsOf = half => (half.children ?? [])
  .filter(c => c.part_type === 'panelPart' || c.part_type === 'glassPart')
  .map(c => (c.part_type === 'panelPart' ? 'panel' : 'glass'))

describe('Step BF — the stable door on the board', () => {
  it('builds Integrate’s own door: one container, two halves, two cells', () => {
    const { tree, missing } = buildStableDoorFrame(PV, {})
    expect(missing).toEqual([])
    expect(isStableDoorTree(tree)).toBe(true)
    expect(isDoorTree(tree)).toBe(true)
    expect(isFrontDoorTree(tree)).toBe(false)

    const containers = stableDoorParts(tree)
    expect(containers.length).toBe(1)
    // 1005 x 2110 of opening less 4 / 4 / 4 / 3 = Integrate's 997 x 2103
    expect(stableDoorSize(tree, containers[0])).toEqual({ width: 997, height: 2103 })

    const { top, bottom } = stableHalves(containers[0])
    expect([top, bottom].every(isStableHalf)).toBe(true)
    // the stored split: 1055 and the rest, which is Integrate's 1048
    expect(doorLeafSize(tree, top)).toEqual({ width: 997, height: 1055 })
    expect(doorLeafSize(tree, bottom)).toEqual({ width: 997, height: 1048 })
    // and its cells, which are the panels Integrate prices
    expect(leafCells(tree, top).map(c => `${c.width}x${c.height}`)).toEqual(['777x846'])
    expect(leafCells(tree, bottom).map(c => `${c.width}x${c.height}`)).toEqual(['777x779'])
  })

  it('a single finish, no front door, no multipoint lock', () => {
    // Nathan's decision i, and Integrate's own template: Clean White both
    // sides. isDoorMpls false — with it true the allocator gives each half a
    // Winkhaus Thunderbolt, 107.10 on a door whose whole set is 88.20.
    const { tree } = buildStableDoorFrame(PV, {})
    const paint = tree.children.find(c => c.part_type === 'paintAndIronmongeryPart')
    expect(paint.values.internalFinish).toBe('clean_white')
    expect(paint.values.externalFinish).toBe('clean_white')
    expect(paint.values.isFrontDoor).toBe(false)
    expect(paint.values.isDoorMpls).toBe(false)
    // the frame bottom and the cill are 50, as every open-in door's are
    expect(frameOf(tree).values.bottomHeight).toBe(50)
    expect(frameOf(tree).children.find(c => c.part_type === 'cillPart').values.height).toBe(50)
  })

  it('saves: the containment allows a container, its halves and a vision panel', () => {
    for (const t of STABLE_DOOR_TEMPLATES) {
      const { tree } = buildStableDoorFrame(PV, t.options)
      expect(() => assertSaveable(tree), t.name).not.toThrow()
      expect(duplicateKeys(tree), t.name).toEqual([])
    }
  })

  it('the three templates are the three doors Nathan sells', () => {
    expect(STABLE_DOOR_TEMPLATES.map(t => `${t.name} ${t.sort_order}`)).toEqual([
      'Stable Door 300',
      'Stable Door Glazed Top 310',
      'Stable Door With Vision Panel 320',
    ])
    const byName = name => {
      const t = STABLE_DOOR_TEMPLATES.find(x => x.name === name)
      return buildStableDoorFrame(PV, t.options).tree
    }
    // panelled both halves
    const plain = byName('Stable Door')
    expect(doorLeaves(plain).map(kindsOf)).toEqual([['panel'], ['panel']])
    // glass over the top half, panel below
    const glazed = byName('Stable Door Glazed Top')
    expect(doorLeaves(glazed).map(kindsOf)).toEqual([['glass'], ['panel']])
    // and the vision panel: glass INSIDE the top panel, which stays a panel
    const vision = byName('Stable Door With Vision Panel')
    expect(doorLeaves(vision).map(kindsOf)).toEqual([['panel'], ['panel']])
    const topPanel = doorLeaves(vision)[0].children
      .find(c => c.part_type === 'panelPart')
    expect((topPanel.children ?? []).map(c => c.part_type)).toEqual(['glassPart'])
    expect(topPanel.children[0].values.visionPanelWidth).toBe(200)
    expect(topPanel.children[0].values.visionPanelHeight).toBe(350)
    expect(STABLE_DOOR_DEFAULTS.visionPanel).toEqual({ width: 200, height: 350 })
  })

  it('every template is 1099 x 2207, as Integrate’s are', () => {
    for (const t of STABLE_DOOR_TEMPLATES) {
      const { tree } = buildStableDoorFrame(PV, t.options)
      const f = frameOf(tree)
      expect(`${f.values.width}x${f.values.height}`, t.name).toBe('1099x2207')
    }
  })

  it('the parts list names both halves', () => {
    const { tree } = buildStableDoorFrame(PV, {})
    const halves = doorLeaves(tree)
    // both are door leaves in the SAME opening, so the opening label alone
    // would name them the same thing twice: the half says which it is.
    expect(halves.map(h => partLabel(h, tree)))
      .toEqual(['Stable Door Top A1', 'Stable Door Bottom A1'])
    // and the container is the opening
    expect(partLabel(stableDoorParts(tree)[0], tree)).toBe('Stable Door A1')
  })

  it('the halves’ timber is charged, the frame and cill as Integrate has them', () => {
    const { tree } = buildStableDoorFrame(PV, {})
    const s = Object.fromEntries(
      allocatedSectionParts(tree).map(x => [x.part_code, x.length_mm]))
    expect(s.Utile67x96).toBe(1099 + 2 * 2207)
    expect(s.Utile63x200).toBe(1099 + 997)
    expect(s.Utile63x120).toBe((2 * 1055 + 997 - 20) + (2 * 1048 + 997 - 20) + 997)
  })
})
