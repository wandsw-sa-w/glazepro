/**
 * coupledBoardActions.test.js — Step BC board
 *
 * On the live board a coupled set's edits went to the FIRST frame whatever
 * frame was selected: the reviewer selected frame C (650 wide), typed 720, and
 * frame A became 720. The panel still showed C's own unchanged values, so the
 * drawing quietly disagreed with the screen.
 *
 * These tests go through the same functions the buttons call, with the frame
 * the selection belongs to — which is what the board now resolves.
 */

import { describe, it, expect } from 'vitest'
import {
  resizeCasementFrame, changeOpening, isCasementFrameTree, actionFrameKey,
  openingNodes, openingLabel, openingKindOf, openingOf, dividerSpacingFor,
} from './casementOpenings.js'
import { diffTrees } from './diffTrees.js'
import { applyDividers, makeDividersEqual, removeDivider } from './gridActions.js'
import {
  buildCoupledSingleDoorFrame, buildSingleDoorFrame, addFlagFrame, removeFrame, isDoorTree,
} from './doorOpenings.js'
import { itemFrames, frameSizeLabel, frameColumns, frameRows } from '../pricing/casementGeometry.js'
import { internalSizeOf } from './internalSize.js'
import { assertSaveable } from './containment.js'
import { partLabel, PART_LABELS } from './partLabels.js'

/** The open_out_doors profile, as frenchDoor.test.js holds it. */
const PV = {
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
  'mullionPart.thicknessInFrameSolid': 41,
  // applyDividers reads the SHORT-keyed map the board passes it
  thicknessInFrameSolid: 41,
  'casementSashPart.thickness': 54, 'casementSashPart.topHeight': 62,
  'casementSashPart.leftWidth': 62, 'casementSashPart.rightWidth': 62,
  'casementSashPart.defaultFanlightBottomHeight': 58,
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 15,
  'glassPart.defaultDoubleGlazingTolerance': 3,
}

/** The reviewer's drawing 39: three frames, 650 | 1082 | 650. */
function coupled() {
  const { tree, missing } = buildCoupledSingleDoorFrame(PV, {
    doorWidth: 1082, doorHeight: 2496, flagWidth: 650, flagHeight: 1632,
    flags: ['left', 'right'], fanlights: { doorOffset: 348, flagOffset: 348 },
    operation: 'right_hand_hung',
  })
  expect(missing).toEqual([])
  return tree
}
const sizes = tree => itemFrames(tree).map(f => `${f.values.width}x${f.values.height}`)

describe('Step BC board — a board action acts on the frame that owns the selection', () => {
  it('actionFrameKey resolves the selection’s own frame', () => {
    const tree = coupled()
    const [a, b, c] = itemFrames(tree)
    // the frame itself
    expect(actionFrameKey(tree, c.key)).toBe(c.key)
    // a node INSIDE it — the sash of the third frame
    const cSash = c.children.find(x => x.part_type === 'casementSashPart')
    expect(actionFrameKey(tree, cSash.key)).toBe(c.key)
    // a node two deep — that sash's glass
    expect(actionFrameKey(tree, cSash.children[0].key)).toBe(c.key)
    // the door leaf is in the middle frame
    const leaf = b.children.find(x => x.part_type === 'doorLeafPart')
    expect(actionFrameKey(tree, leaf.key)).toBe(b.key)
    // nothing selected, or a node outside any frame: the FIRST frame, which
    // is what a one-frame drawing has always meant
    expect(actionFrameKey(tree, null)).toBe(a.key)
    expect(actionFrameKey(tree, 'no-such-key')).toBe(a.key)
  })

  it('resizing frame C changes C and nothing else', () => {
    // THE LIVE BUG: the reviewer typed 720 on frame C and frame A became 720.
    const tree = coupled()
    const c = itemFrames(tree)[2]
    const { tree: next } = resizeCasementFrame(tree, { width: 720 }, c.key)
    expect(sizes(next)).toEqual(['650x1632', '1082x2496', '720x1632'])
    expect(frameSizeLabel(next)).toBe('2358 × 2496 mm (3 frames, coupled)')
  })

  it('resizing the DOOR frame changes it only, and the set follows', () => {
    const tree = coupled()
    const b = itemFrames(tree)[1]
    const { tree: next } = resizeCasementFrame(tree, { height: 2450 }, b.key)
    expect(sizes(next)).toEqual(['650x1632', '1082x2450', '650x1632'])
    // the set's height is the DOOR frame's, so the label moves with it
    expect(frameSizeLabel(next)).toBe('2288 × 2450 mm (3 frames, coupled)')
  })

  it('a resize re-spaces only that frame’s own mullions', () => {
    // Frame A has no mullions and the door frame has none either, so add one
    // to A and resize A: its own divider re-spaces, and B and C are untouched.
    const tree = coupled()
    const a = itemFrames(tree)[0]
    const withMullion = applyDividers(tree, a.key, 2, 1, 556, 1548, PV, 'solid')
    expect(frameColumns(withMullion, itemFrames(withMullion)[0]).length).toBe(2)
    const { tree: next } = resizeCasementFrame(withMullion, { width: 800 }, a.key)
    expect(sizes(next)).toEqual(['800x1632', '1082x2496', '650x1632'])
    const cols = frameColumns(next, itemFrames(next)[0]).map(x => x.width)
    expect(cols.length, 'still two columns').toBe(2)
    expect(cols[0] + cols[1] + 41, 'they share the new interior').toBe(800 - 94)
  })

  it('a one-frame drawing resizes exactly as before', () => {
    // No frame passed at all — the signature a one-frame caller uses.
    const tree = buildSingleDoorFrame(PV, { width: 1099, height: 2199 }).tree
    const { tree: next } = resizeCasementFrame(tree, { width: 1200 })
    expect(sizes(next)).toEqual(['1200x2199'])
    expect(frameSizeLabel(next)).toBe('1200 × 2199 mm')
  })

  it('the divider picker adds the divider to the selected frame only', () => {
    const tree = coupled()
    const [a, b, c] = itemFrames(tree)
    // frame C gets a mullion; A and B keep their own dividers (one transom each)
    const next = applyDividers(tree, c.key, 2, 1, 556, 1548, PV, 'solid')
    const frames = itemFrames(next)
    const mullionsOf = f => (f.children ?? []).filter(x => x.part_type === 'mullionPart').length

    expect(mullionsOf(frames[0]), 'A untouched').toBe(0)
    expect(mullionsOf(frames[1]), 'B untouched').toBe(0)
    expect(mullionsOf(frames[2]), 'C has the new mullion').toBe(1)
    // The picker SETS the selected frame's grid, so a 2 x 1 pick leaves C
    // with one row and takes its transom — that is the picker's own
    // behaviour, and what matters here is that A and B keep theirs.
    const transomsOf = f => (f.children ?? []).filter(x => x.part_type === 'transomPart').length
    expect(transomsOf(frames[0]), 'A keeps its transom').toBe(1)
    expect(transomsOf(frames[1]), 'B keeps its transom').toBe(1)
    expect(transomsOf(frames[2]), 'C took the 2 x 1 grid').toBe(0)
    expect([a.key, b.key, c.key], 'the frames are still the same three')
      .toEqual(frames.map(f => f.key))
    expect(() => assertSaveable(next)).not.toThrow()
  })

  it('making dividers equal works on the selected frame', () => {
    const tree = coupled()
    const c = itemFrames(tree)[2]
    const withTwo = applyDividers(tree, c.key, 3, 1, 556, 1548, PV, 'solid')
    const next = makeDividersEqual(withTwo, c.key, 'widths')
    const cols = frameColumns(next, itemFrames(next)[2]).map(x => x.width)
    expect(cols.length).toBe(3)
    expect(new Set(cols).size, 'equal columns').toBe(1)
    // the other frames are untouched
    expect(frameColumns(next, itemFrames(next)[0]).length).toBe(1)
  })

  it('removing a divider works on the selected frame', () => {
    // 2 x 2 so the frame keeps a transom through the pick, then remove the
    // mullion alone: the row stays, the column goes, and only in C.
    const tree = coupled()
    const c = itemFrames(tree)[2]
    const picked = applyDividers(tree, c.key, 2, 2, 556, 1548, PV, 'solid')
    expect(frameColumns(picked, itemFrames(picked)[2]).length).toBe(2)
    expect(frameRows(picked, itemFrames(picked)[2]).length).toBe(2)
    const mullion = itemFrames(picked)[2].children.find(x => x.part_type === 'mullionPart')
    const next = removeDivider(picked, itemFrames(picked)[2].key, mullion.key)
    expect(frameColumns(next, itemFrames(next)[2]).length, 'the column goes').toBe(1)
    expect(frameRows(next, itemFrames(next)[2]).length, 'the row stays').toBe(2)
    expect(frameRows(next, itemFrames(next)[0]).length, 'A untouched').toBe(2)
  })

  it('changing an opening works in a frame other than the first', () => {
    // changeOpening returned "unchanged" for an opening in any frame but the
    // first, because it looked the key up in the first frame's children.
    const tree = coupled()
    const c = itemFrames(tree)[2]
    const light = openingNodes(tree, c).find(n => n.part_type === 'casementSashPart' &&
      n.values.operation === 'fix')
    const { tree: next, changed } = changeOpening(tree, light.key, 'direct_glazed', PV)
    expect(changed, 'the change happened').toBe(true)
    const frames = itemFrames(next)
    expect(openingNodes(next, frames[2]).some(n => n.part_type === 'glassPart')).toBe(true)
    // the other frames' openings are untouched
    expect(openingNodes(next, frames[0]).map(n => n.part_type))
      .toEqual(openingNodes(tree, itemFrames(tree)[0]).map(n => n.part_type))
    expect(() => assertSaveable(next)).not.toThrow()
  })

  it('a coupled set is a casement frame tree whichever frame comes first', () => {
    const tree = coupled()
    expect(isCasementFrameTree(tree)).toBe(true)
    // and so is a set whose FIRST frame holds only the door
    const right = addFlagFrame(
      buildSingleDoorFrame(PV, { width: 1099, height: 2199 }).tree,
      itemFrames(buildSingleDoorFrame(PV, { width: 1099, height: 2199 }).tree)[0].key,
      'right', PV)
    expect(isCasementFrameTree(right.tree)).toBe(true)
  })

  it('the internal size reads the selected frame', () => {
    const tree = coupled()
    const [a, , c] = itemFrames(tree)
    // 650 - 47 - 47 by 1632 - 47 - 37
    expect(internalSizeOf(tree, a.key)).toEqual({ width: 556, height: 1548 })
    expect(internalSizeOf(tree, c.key)).toEqual({ width: 556, height: 1548 })
    const b = itemFrames(tree)[1]
    expect(internalSizeOf(tree, b.key)).toEqual({ width: 988, height: 2412 })
    // asked nothing, it is the first frame — as a one-frame drawing means
    expect(internalSizeOf(tree)).toEqual({ width: 556, height: 1548 })
  })

  it('add a flag left, add a flag right, and remove back to one frame', () => {
    // The toolbar path: the same calls the buttons make.
    const one = buildSingleDoorFrame(PV, { width: 1099, height: 2199 }).tree
    const doorKey = itemFrames(one)[0].key

    const left = addFlagFrame(one, doorKey, 'left', PV)
    expect(left.changed).toBe(true)
    expect(sizes(left.tree)).toEqual(['693x1136', '1099x2199'])
    expect(frameSizeLabel(left.tree)).toBe('1745 × 2199 mm (2 frames, coupled)')

    const both = addFlagFrame(left.tree, doorKey, 'right', PV)
    expect(sizes(both.tree)).toEqual(['693x1136', '1099x2199', '693x1136'])
    expect(frameSizeLabel(both.tree)).toBe('2391 × 2199 mm (3 frames, coupled)')
    expect(() => assertSaveable(both.tree)).not.toThrow()

    // remove the right-hand flag, then the left: back to a one-frame drawing
    const flagC = itemFrames(both.tree)[2].key
    const two = removeFrame(both.tree, flagC)
    expect(sizes(two.tree)).toEqual(['693x1136', '1099x2199'])
    const flagA = itemFrames(two.tree)[0].key
    const back = removeFrame(two.tree, flagA)
    expect(sizes(back.tree)).toEqual(['1099x2199'])
    expect(back.tree.children.some(c => c.part_type === 'containerPart')).toBe(false)
    expect(frameSizeLabel(back.tree)).toBe('1099 × 2199 mm')

    // and the door frame and the last frame are refused
    expect(removeFrame(two.tree, itemFrames(two.tree)[1].key).changed).toBe(false)
    expect(removeFrame(back.tree, itemFrames(back.tree)[0].key).changed).toBe(false)
  })

  it('the parts list names a coupled door leaf, not its part type', () => {
    const tree = coupled()
    const leaf = itemFrames(tree)[1].children.find(c => c.part_type === 'doorLeafPart')
    expect(partLabel(leaf, tree)).toBe('Single Door B2')
    // a flag light reads as its own frame's opening
    const light = itemFrames(tree)[2].children.find(c => c.part_type === 'casementSashPart' &&
      c.values.operation === 'fix')
    expect(partLabel(light, tree)).toBe('Casement Sash C2')
    // and the frames themselves read with their place in the set
    expect(partLabel(itemFrames(tree)[0], tree)).toBe('Frame A')
    expect(partLabel(itemFrames(tree)[1], tree)).toBe('Frame B')
    // a one-frame drawing's frame is just "Frame"
    const one = buildSingleDoorFrame(PV, { width: 1099, height: 2199 }).tree
    expect(partLabel(itemFrames(one)[0], one)).toBe('Frame')
    expect(partLabel(openingNodes(one)[0], one)).toBe('Single Door A1')
  })
})

describe('isDoorTree — what the flag-frame buttons are offered on', () => {
  it('a coupled set, a single door and a French pair are all doors', () => {
    expect(isDoorTree(coupled())).toBe(true)
    expect(isDoorTree(buildSingleDoorFrame(PV, { width: 1099, height: 2199 }).tree)).toBe(true)
  })

  it('a drawing with no door is not', () => {
    // the same frame with its leaf taken out
    const tree = buildSingleDoorFrame(PV, { width: 1099, height: 2199 }).tree
    const frame = itemFrames(tree)[0]
    const stripped = {
      ...tree,
      children: tree.children.map(c => c.key !== frame.key ? c : {
        ...frame,
        children: frame.children.filter(x => x.part_type !== 'doorLeafPart'),
      }),
    }
    expect(isDoorTree(stripped)).toBe(false)
  })
})

// ── Part 2: the three panels that still saw only the first frame ────────────

describe('Step BC board 2 — the opening a panel is about', () => {
  it('openingOf finds the opening in the node’s OWN frame', () => {
    const tree = coupled()
    const [a, b, c] = itemFrames(tree)
    // the opening itself
    const cLight = c.children.find(x => x.part_type === 'casementSashPart' &&
      x.values.operation === 'fix')
    expect(openingOf(tree, cLight)?.key).toBe(cLight.key)
    // its GLASS, which is where a surveyor usually clicks
    expect(openingOf(tree, cLight.children[0])?.key).toBe(cLight.key)
    // the door leaf of the middle frame
    const leaf = b.children.find(x => x.part_type === 'doorLeafPart')
    expect(openingOf(tree, leaf)?.key).toBe(leaf.key)
    // a fanlight of the FIRST frame still works
    const aFan = a.children.find(x => x.part_type === 'casementSashPart' &&
      x.values.operation === 'top_hung')
    expect(openingOf(tree, aFan)?.key).toBe(aFan.key)
    // something that is not in an opening at all
    expect(openingOf(tree, c)).toBe(null)
    expect(openingOf(tree, null)).toBe(null)
  })

  it('the change-to bar appears for an opening in any frame', () => {
    // Live: selecting Fanlight B1 or anything outside frame A showed no bar,
    // because the kind was only resolved for the first frame's openings.
    const tree = coupled()
    for (const f of itemFrames(tree)) {
      for (const o of openingNodes(tree, f)) {
        expect(openingOf(tree, o), `${openingLabel(tree, o)} is an opening`).toBeTruthy()
        expect(openingKindOf(o), `${openingLabel(tree, o)} has a kind`).toBeTruthy()
      }
    }
    // and the door leaf's own kind is the single door
    const leaf = itemFrames(tree)[1].children.find(x => x.part_type === 'doorLeafPart')
    expect(openingKindOf(leaf)).toBe('single_door')
  })

  it('Divider Spacing counts the selected frame’s own dividers', () => {
    const tree = coupled()
    const [a, , c] = itemFrames(tree)
    const aFan = a.children.find(x => x.part_type === 'casementSashPart')
    // every frame has a transom and no mullion, so heights yes, widths no
    expect(dividerSpacingFor(tree, aFan)).toEqual({ canWidths: false, canHeights: true })

    // give frame C a mullion: C can do widths, A still cannot
    const picked = applyDividers(tree, c.key, 2, 2, 556, 1548, PV, 'solid')
    const cOpening = openingNodes(picked, itemFrames(picked)[2])[0]
    const aOpening = openingNodes(picked, itemFrames(picked)[0])[0]
    expect(dividerSpacingFor(picked, cOpening)).toEqual({ canWidths: true, canHeights: true })
    expect(dividerSpacingFor(picked, aOpening), 'A has no mullion of its own')
      .toEqual({ canWidths: false, canHeights: true })

    // and nothing for a part that is not an opening
    expect(dividerSpacingFor(tree, itemFrames(tree)[0])).toBe(null)
  })
})

describe('Step BC board 2 — the drawing history names the frames', () => {
  const OPTS = () => ({
    fieldDefs: {
      assemblyFramePart: [
        // role 'input' matters: diffTrees reports input changes only
        { property_name: 'width',  label: 'Width',  data_type: 'number', role: 'input' },
        { property_name: 'height', label: 'Height', data_type: 'number', role: 'input' },
      ],
    },
    partLabels: PART_LABELS,
  })

  it('an edit in frame C is reported as frame C', () => {
    const before = coupled()
    const c = itemFrames(before)[2]
    const { tree: after } = resizeCasementFrame(before, { width: 720 }, c.key)
    const changes = diffTrees(before, after, { ...OPTS(), labelFor: node => partLabel(node, after) })
    expect(changes.length).toBe(1)
    expect(changes[0].part).toContain('Frame C')
    expect(changes[0].field).toBe('Width')
    expect(String(changes[0].from)).toBe('650')
    expect(String(changes[0].to)).toBe('720')
  })

  it('removing a flag frame reads as REMOVED, not as a width change', () => {
    // Live: the history paired frames by position, so taking the left flag
    // away reported "Frame — Width: 650 → 1082" — the door frame's width
    // against the flag's, a change nobody made.
    const before = coupled()
    const flagA = itemFrames(before)[0].key
    const after = removeFrame(before, flagA).tree
    const changes = diffTrees(before, after, { ...OPTS(), labelFor: node => partLabel(node, before) })
    const widthChanges = changes.filter(ch => ch.field === 'Width' || ch.field === 'Height')
    expect(widthChanges, 'no frame changed size').toEqual([])
    expect(changes.some(ch => ch.field === '(removed)'), 'a part was removed').toBe(true)
  })

  it('adding a flag frame reads as ADDED', () => {
    const before = buildSingleDoorFrame(PV, { width: 1099, height: 2199 }).tree
    const doorKey = itemFrames(before)[0].key
    const after = addFlagFrame(before, doorKey, 'right', PV).tree
    const changes = diffTrees(before, after, { ...OPTS(), labelFor: node => partLabel(node, after) })
    expect(changes.filter(ch => ch.field === 'Width' || ch.field === 'Height'), 'the door frame is unchanged')
      .toEqual([])
    expect(changes.some(ch => ch.field === '(added)')).toBe(true)
  })

  it('a ONE-frame drawing’s history is unchanged', () => {
    const before = buildSingleDoorFrame(PV, { width: 1099, height: 2199 }).tree
    const { tree: after } = resizeCasementFrame(before, { width: 1200 })
    const changes = diffTrees(before, after, { ...OPTS(), labelFor: node => partLabel(node, after) })
    expect(changes.length).toBe(1)
    // the part path carries its ancestors, as it always has
    expect(changes[0].part).toBe('Item > Frame')
    expect(changes[0].field).toBe('Width')
  })
})
