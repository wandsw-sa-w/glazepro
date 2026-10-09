// internalSize.test.js — Step AL
//
// Nathan's rule (docs/integrate-internal-size-entry.txt): on a sash
// replacement surveyors only ever enter the SASH size (Integrate's Pair of
// Sashes "Internal Frame Width / Height"); on a complete new they enter
// either. Integrate's arithmetic: overall = internal + jambs, and
// internal height + head + cill height.

import { describe, it, expect } from 'vitest'
import {
  INTERNAL_ENTRY_NOTE,
  JAMB_SIZE_FIELDS,
  isSingleOpeningSashWindow,
  sizeEntryMode,
  internalSizeOf,
  frameFromInternalSize,
  keepInternalSize,
} from './internalSize.js'
import { computeDerived } from './computeDerived.js'

// ── Fixtures ─────────────────────────────────────────────────────────────────

// Benchmark A's frame: 1070 x 1849 overall, jambs 85, head 79, cill 70 →
// internal 900 x 1700 (docs/integrate-internal-size-entry.txt: "frame 1070 =
// 900 + 85 + 85; 1849 = 1700 + 79 + 70").
function boxSash({
  typeOfWork = 'new_pair_of_sashes',
  width = 1070, height = 1849,
  jamb = 85, head = 79, cill = 70,
  pairs = 1, mullion = false, extraPart = null,
} = {}) {
  const pair = n => ({
    key: `pair${n}`,
    part_type: 'sashPairPart',
    values: { sashThickness: 45, midrailHeight: 40 },
    children: [
      { key: `top${n}`, part_type: 'topSashPart',    values: { topHeight: 49, leftWidth: 49, rightWidth: 49 }, children: [] },
      { key: `bot${n}`, part_type: 'bottomSashPart', values: { bottomHeight: 88, leftWidth: 49, rightWidth: 49 }, children: [] },
    ],
  })
  const frameChildren = [
    { key: 'cill1', part_type: 'cillPart', values: { height: cill, depth: 140 }, children: [] },
    ...(mullion ? [{ key: 'mull1', part_type: 'mullionPart', values: { offset: 500, thicknessInFrame: 144 }, children: [] }] : []),
    ...Array.from({ length: pairs }, (_, i) => pair(i + 1)),
    ...(extraPart ? [{ key: 'extra', part_type: extraPart, values: {}, children: [] }] : []),
  ]
  return {
    key: 'item1',
    part_type: 'drawingItemPart',
    values: { typeOfWork },
    children: [{
      key: 'frame1',
      part_type: 'assemblyFramePart',
      values: { width, height, leftWidth: jamb, rightWidth: jamb, topHeight: head },
      children: frameChildren,
    }],
  }
}

const frameOf = tree => tree.children[0].values

// ── Where the rule applies ───────────────────────────────────────────────────

describe('sizeEntryMode', () => {
  it('sash replacement work types enter the SASH size', () => {
    for (const tow of ['new_pair_of_sashes', 'draught_seal', 'bi_glass', 'no_work']) {
      expect(sizeEntryMode(boxSash({ typeOfWork: tow })), tow).toBe('internal')
    }
  })

  it('complete new may enter either', () => {
    expect(sizeEntryMode(boxSash({ typeOfWork: 'complete_new' }))).toBe('both')
  })

  it('frames with a mullion (more than one pair) keep frame-only entry', () => {
    // Integrate asks "set for all sliding frames / this one only" there —
    // out of scope for this step (step-al brief §1).
    expect(sizeEntryMode(boxSash({ pairs: 2, mullion: true }))).toBe('frame_only')
    expect(isSingleOpeningSashWindow(boxSash({ pairs: 2, mullion: true }))).toBe(false)
  })

  it('casements and doors keep frame-only entry', () => {
    expect(sizeEntryMode(boxSash({ extraPart: 'casementSashPart' }))).toBe('frame_only')
    expect(sizeEntryMode(boxSash({ extraPart: 'doorLeafPart' }))).toBe('frame_only')
  })

  it('a drawing with no type of work yet keeps frame-only entry', () => {
    expect(sizeEntryMode(boxSash({ typeOfWork: null }))).toBe('frame_only')
  })
})

// ── Both directions ──────────────────────────────────────────────────────────

describe('internalSizeOf / frameFromInternalSize', () => {
  it('reads benchmark A’s internal size from its frame', () => {
    expect(internalSizeOf(boxSash())).toEqual({ width: 900, height: 1700 })
  })

  it('agrees with the derived values the board shows', () => {
    const tree = boxSash()
    const der = computeDerived(tree).pair1
    const internal = internalSizeOf(tree)
    expect(internal.width).toBe(der.internalWidth)
    expect(internal.height).toBe(der.internalHeight)
  })

  it('typing an internal WIDTH sets the frame, keeping the jambs', () => {
    // Integrate: internal 930 → 940 made the frame 1100 → 1110.
    const tree = boxSash({ width: 1100, height: 1600, jamb: 85, head: 79, cill: 70 })
    expect(internalSizeOf(tree).width).toBe(930)
    const next = frameFromInternalSize(tree, { width: 940 })
    expect(frameOf(next).width).toBe(1110)
    expect(frameOf(next).height).toBe(1600)            // untouched
    expect([frameOf(next).leftWidth, frameOf(next).rightWidth]).toEqual([85, 85])
  })

  it('typing an internal HEIGHT sets the frame, keeping head and cill', () => {
    // Integrate: internal height 1451 → 1461 made the frame 1600 → 1610.
    const tree = boxSash({ width: 1100, height: 1600, jamb: 85, head: 79, cill: 70 })
    expect(internalSizeOf(tree).height).toBe(1451)
    const next = frameFromInternalSize(tree, { height: 1461 })
    expect(frameOf(next).height).toBe(1610)
    expect(frameOf(next).width).toBe(1100)             // untouched
  })

  it('entering 900 x 1700 on cord defaults gives benchmark A’s frame', () => {
    const tree = boxSash({ width: 0, height: 0 })
    const next = frameFromInternalSize(tree, { width: 900, height: 1700 })
    expect([frameOf(next).width, frameOf(next).height]).toEqual([1070, 1849])
  })

  it('and the sash sizes follow, as they do today', () => {
    const next = frameFromInternalSize(boxSash({ width: 0, height: 0 }), { width: 900, height: 1700 })
    const der = computeDerived(next).pair1
    expect(der.sashWidth).toBe(900)                    // no clearance on A
    expect(der.topSashHeight).toBe(850.5)
  })

  it('a blank or non-numeric entry writes nothing', () => {
    const tree = boxSash()
    for (const v of [null, undefined, '']) {
      const next = frameFromInternalSize(tree, { width: v })
      expect([frameOf(next).width, frameOf(next).height]).toEqual([1070, 1849])
    }
  })

  it('round-trips: frame → internal → frame', () => {
    const tree = boxSash({ width: 1245, height: 1779, jamb: 85, head: 79, cill: 70 })
    const internal = internalSizeOf(tree)
    const next = frameFromInternalSize(tree, internal)
    expect([frameOf(next).width, frameOf(next).height]).toEqual([1245, 1779])
  })
})

// ── Keeping the sash size when the jambs change (step-al §2) ────────────────

describe('keepInternalSize', () => {
  // Switching to Spiral Hung stamps the profile's 28 mm spiral jambs/head.
  function withSpiralJambs(tree) {
    return {
      ...tree,
      children: [{
        ...tree.children[0],
        values: { ...tree.children[0].values, leftWidth: 28, rightWidth: 28, topHeight: 28 },
      }],
    }
  }

  it('sash replacement: the SASH size is kept and the frame recomputed', () => {
    const before = internalSizeOf(boxSash())
    const next = keepInternalSize(withSpiralJambs(boxSash()), before)
    expect(internalSizeOf(next)).toEqual({ width: 900, height: 1700 })
    expect([frameOf(next).width, frameOf(next).height]).toEqual([956, 1798])
    // 900 + 28 + 28 = 956; 1700 + 28 + 70 = 1798
  })

  it('complete new: the overall FRAME is kept, as Integrate does', () => {
    const tree = boxSash({ typeOfWork: 'complete_new' })
    const before = internalSizeOf(tree)
    const next = keepInternalSize(withSpiralJambs(tree), before)
    expect([frameOf(next).width, frameOf(next).height]).toEqual([1070, 1849])
    expect(internalSizeOf(next)).toEqual({ width: 1014, height: 1751 })  // sashes grow
  })

  it('multi-opening frames are left alone', () => {
    const tree = boxSash({ pairs: 2, mullion: true })
    const before = internalSizeOf(tree)
    const next = keepInternalSize(withSpiralJambs(tree), before)
    expect([frameOf(next).width, frameOf(next).height]).toEqual([1070, 1849])
  })

  it('is a no-op without a recorded size', () => {
    const tree = withSpiralJambs(boxSash())
    expect(keepInternalSize(tree, null)).toBe(tree)
  })

  it('names the fields that trigger it', () => {
    expect([...JAMB_SIZE_FIELDS].sort()).toEqual([
      'assemblyFramePart.leftWidth',
      'assemblyFramePart.rightWidth',
      'assemblyFramePart.topHeight',
      'cillPart.height',
    ])
    expect(INTERNAL_ENTRY_NOTE).toBe('Sash replacement: enter the sash size')
  })
})
