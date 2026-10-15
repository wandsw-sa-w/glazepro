// templateKeys.test.js — Step BH follow-up item 1
//
// THE LIVE BUG. Template 38 ("Front Door With Side Lights And Fanlight Over
// Door") stores a SHORT transom: one that stops at the two mullions, so the
// side lights run full height and the fanlight sits over the door alone.
// Integrate's own model, and Step AV's: a divider names the dividers it
// starts and ends at (`startDivider` / `endDivider`), by KEY.
//
// `regenerateKeys` gave every node a fresh UUID when the drawing was created
// from the template — and left those two references pointing at keys that no
// longer existed. `dividerRefIndex` then resolved neither, so the transom was
// read as running frame to frame: a 3 x 2 grid of SIX cells for a frame with
// FOUR openings. Everything downstream followed the wrong cells:
//
//   the labels     "Fanlight A1" / "Fanlight C1" for the side lights and
//                  "Single Door A2" for the door
//   the drawing    the door's cell blank, one side light short
//   the price      Sidelights in Doorsets 780 x 2 became Fanlights in
//                  Doorsets 300 x 2; the door leaf, squeezed into a 365-wide
//                  cell, priced panels of NEGATIVE area (-211.00); the timber
//                  lengths all moved. £7,095.53 against £8,928.07.
//
// WHY THE OFFLINE TEST MISSED IT: it priced the tree the BUILDER returns. The
// live site prices the tree `prepareTemplateTree` returns — the same tree with
// every key replaced. One function stood between them and no test crossed it.
// doorsetTemplates.test.js now prices through that function.

import { describe, it, expect } from 'vitest'

import { regenerateKeys, prepareTemplateTree, remapDividerRefs } from './templates.js'
import { buildFrontDoorSetFrame, DOORSET_TEMPLATES, buildDoorsetTemplate } from './doorOpenings.js'
import { cloneWithNewKeys } from './gridActions.js'
import { frameCells, itemFrames, sortedDividers } from '../pricing/casementGeometry.js'
import { doorLeaves, doorLeafSize, leafCells } from '../pricing/doorGeometry.js'
import { OPEN_IN_PROFILE_VALUES as PV } from '../pricing/benchmarks/fixtureDoor.js'

const frameOf = tree => itemFrames(tree)[0]
const refsOf = tree => sortedDividers(frameOf(tree), 'transomPart')
  .map(t => [t.values?.startDivider, t.values?.endDivider])
/** Every key in the tree, so a reference can be checked against it. */
const keysOf = (node, acc = new Set()) => {
  acc.add(node.key)
  for (const c of (node.children ?? [])) keysOf(c, acc)
  return acc
}

describe('Step BH follow-up — a SHORT divider survives a key change', () => {
  const { tree: built } = buildFrontDoorSetFrame(PV, { fanlight: 'over_door' })

  it('the template itself has a short transom, and FOUR cells', () => {
    const [[start, end]] = refsOf(built)
    const mullions = sortedDividers(frameOf(built), 'mullionPart').map(m => m.key)
    expect(mullions).toContain(start)
    expect(mullions).toContain(end)
    expect(frameCells(built, frameOf(built)).length).toBe(4)
  })

  it('every divider reference still names a node after regenerateKeys', () => {
    const fresh = regenerateKeys(built)
    const keys = keysOf(fresh)
    for (const [start, end] of refsOf(fresh)) {
      // '0' means "the frame itself" and is not a key
      for (const ref of [start, end]) {
        expect(ref, `reference ${ref}`).toBeTruthy()
        if (ref !== '0') expect(keys.has(ref), `reference ${ref} resolves`).toBe(true)
      }
    }
    // and nothing points at the OLD tree any more
    const old = keysOf(built)
    for (const [start, end] of refsOf(fresh)) {
      for (const ref of [start, end]) {
        if (ref !== '0') expect(old.has(ref)).toBe(false)
      }
    }
  })

  it('so the drawing a surveyor gets has the SAME four cells', () => {
    const { tree } = prepareTemplateTree(built)
    const before = frameCells(built, frameOf(built))
      .map(c => `${c.col},${c.row} ${Math.round(c.width)}x${Math.round(c.height)}`)
    const after = frameCells(tree, frameOf(tree))
      .map(c => `${c.col},${c.row} ${Math.round(c.width)}x${Math.round(c.height)}`)
    expect(after).toEqual(before)
    expect(after.length).toBe(4)
  })

  it('and the door is its own 892 x 2068, with no negative cell', () => {
    const { tree } = prepareTemplateTree(built)
    const [leaf] = doorLeaves(tree)
    expect(doorLeafSize(tree, leaf)).toEqual({ width: 892, height: 2068 })
    for (const cell of leafCells(tree, leaf)) {
      expect(cell.width, 'cell width').toBeGreaterThan(0)
      expect(cell.height, 'cell height').toBeGreaterThan(0)
    }
    // the bug: a 365-wide cell made two of the four panels negative
    expect(leafCells(tree, leaf).map(c => c.width)).toEqual([276, 276, 276, 276])
  })

  it('cloneWithNewKeys keeps a reference INSIDE what it copies', () => {
    // A split opening carrying its own dividers is copied with fresh keys the
    // same way, and the same rule applies: a reference to a node that came
    // along is re-pointed, and one to a node outside is left alone.
    const node = {
      key: 'sash', part_type: 'casementSashPart', values: {}, children: [
        { key: 'rail', part_type: 'transomPart', values: { startDivider: '0', endDivider: '0' }, children: [] },
        { key: 'bar', part_type: 'mullionPart', values: { startDivider: 'rail', endDivider: 'outside' }, children: [] },
      ],
    }
    const copy = cloneWithNewKeys(node)
    const railKey = copy.children[0].key
    expect(railKey).not.toBe('rail')
    expect(copy.children[1].values.startDivider).toBe(railKey)
    // 'outside' is not in the copy, so it is left as it was for a caller to
    // deal with rather than silently pointed somewhere new
    expect(copy.children[1].values.endDivider).toBe('outside')
  })

  it('remapDividerRefs is a no-op on a tree with none', () => {
    const plain = { key: 'a', part_type: 'assemblyFramePart', values: {}, children: [] }
    expect(remapDividerRefs(plain, new Map())).toEqual(plain)
  })

  it('every Step BH template survives creation unchanged', () => {
    for (const t of DOORSET_TEMPLATES) {
      const { tree: built2 } = buildDoorsetTemplate(t, PV)
      const { tree } = prepareTemplateTree(built2)
      const cells = (x) => frameCells(x, frameOf(x))
        .map(c => `${c.col},${c.row} ${Math.round(c.width)}x${Math.round(c.height)}`)
      expect(cells(tree), t.name).toEqual(cells(built2))
      for (const leaf of doorLeaves(tree)) {
        for (const cell of leafCells(tree, leaf)) {
          expect(cell.width, `${t.name} cell width`).toBeGreaterThan(0)
          expect(cell.height, `${t.name} cell height`).toBeGreaterThan(0)
        }
      }
    }
  })
})
