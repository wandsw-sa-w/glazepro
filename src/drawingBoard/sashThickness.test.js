// sashThickness.test.js — Step AI
//
// Nathan's business rule (9 Oct 2026, sash windows only): a COMPLETE NEW
// sash window is always made 45 mm thick; sash replacements may be
// 35/40/45/50. Integrate does not enforce it (docs/integrate-differences.md
// difference 2). These tests pin the rule itself and the fact that setting
// 45 goes through the SAME path as a hand thickness edit: the bottom rail
// and the frame height move by the whole-millimetre chamfer-allowance
// difference (Step AB).

import { describe, it, expect } from 'vitest'
import {
  COMPLETE_NEW_SASH_THICKNESS_MM,
  isCompleteNewSashWindow,
  pairsOffThickness,
  thicknessChangePatches,
  applyPatches,
  applyCompleteNewThickness,
  owningPair,
} from './sashThickness.js'

// ── Fixtures ─────────────────────────────────────────────────────────────────

// Benchmark-A-shaped box sash: frame 1070 x 1849, bottom rail 88,
// chamfered bottom rail 9° (so the allowance is round(t x tan 9°):
// 35/40 → 6, 45 → 7, 50 → 8).
function boxSash({ typeOfWork = 'complete_new', thickness = 45, pairs = 1, angle = 9 } = {}) {
  const pair = n => ({
    key: `pair${n}`,
    part_type: 'sashPairPart',
    values: { sashThickness: thickness, midrailHeight: 40 },
    children: [
      { key: `top${n}`, part_type: 'topSashPart', values: { topHeight: 49, leftWidth: 49 }, children: [] },
      {
        key: `bot${n}`,
        part_type: 'bottomSashPart',
        values: { bottomHeight: 88, leftWidth: 49, btmRailShapeId: 'chamfered', chamferedBottomRailAngle: angle },
        children: [],
      },
    ],
  })
  return {
    key: 'item1',
    part_type: 'drawingItemPart',
    values: { typeOfWork },
    children: [
      {
        key: 'frame1',
        part_type: 'assemblyFramePart',
        values: { width: 1070, height: 1849, topHeight: 79, leftWidth: 85, rightWidth: 85 },
        children: [
          { key: 'cill1', part_type: 'cillPart', values: { height: 70, depth: 140 }, children: [] },
          ...Array.from({ length: pairs }, (_, i) => pair(i + 1)),
        ],
      },
    ],
  }
}

function withCasement(tree) {
  const frame = tree.children[0]
  return {
    ...tree,
    children: [{
      ...frame,
      children: [...frame.children, { key: 'cas1', part_type: 'casementSashPart', values: {}, children: [] }],
    }],
  }
}

const valuesOf = (tree, key) => {
  let found = null
  ;(function walk(n) { if (n.key === key) found = n.values; (n.children ?? []).forEach(walk) })(tree)
  return found
}

// ── The rule ─────────────────────────────────────────────────────────────────

describe('isCompleteNewSashWindow', () => {
  it('is true for a complete-new box sash', () => {
    expect(isCompleteNewSashWindow(boxSash({ typeOfWork: 'complete_new' }))).toBe(true)
  })

  it('is false for every other type of work (thickness stays editable)', () => {
    for (const tow of ['new_pair_of_sashes', 'draught_seal', 'bi_glass', null]) {
      expect(isCompleteNewSashWindow(boxSash({ typeOfWork: tow })), String(tow)).toBe(false)
    }
  })

  it('is false when a casement sash is present (sash windows only)', () => {
    expect(isCompleteNewSashWindow(withCasement(boxSash()))).toBe(false)
  })
})

describe('pairsOffThickness', () => {
  it('lists only pairs that are not 45', () => {
    expect(pairsOffThickness(boxSash({ thickness: 45 }))).toHaveLength(0)
    expect(pairsOffThickness(boxSash({ thickness: 57 }))).toHaveLength(1)
    expect(pairsOffThickness(boxSash({ thickness: 57, pairs: 2 }))).toHaveLength(2)
  })
})

// ── The hand-edit path ───────────────────────────────────────────────────────

describe('thicknessChangePatches', () => {
  it('57 → 45 moves the bottom rail and the frame height by the allowance difference', () => {
    // allowance(57, 9°) = round(57 x tan 9°) = 9; allowance(45, 9°) = 7;
    // delta = 9 − 7 = +2 → rail 88 → 90, frame 1849 → 1851, so
    // (rail + allowance) and the external sash height are unchanged.
    const tree = boxSash({ thickness: 57 })
    const next = applyPatches(tree, thicknessChangePatches(tree, 'pair1', { thickness: 45 }))
    expect(valuesOf(next, 'pair1').sashThickness).toBe(45)
    expect(valuesOf(next, 'bot1').bottomHeight).toBe(90)
    expect(valuesOf(next, 'frame1').height).toBe(1851)
  })

  it('a change with no allowance movement still stores the thickness', () => {
    // 35 and 40 share an allowance of 6, so only the thickness changes.
    const tree = boxSash({ thickness: 35 })
    const next = applyPatches(tree, thicknessChangePatches(tree, 'pair1', { thickness: 40 }))
    expect(valuesOf(next, 'pair1').sashThickness).toBe(40)
    expect(valuesOf(next, 'bot1').bottomHeight).toBe(88)
    expect(valuesOf(next, 'frame1').height).toBe(1849)
  })

  it('does nothing without a chamfered bottom rail except store the value', () => {
    const tree = boxSash({ thickness: 57, angle: 0 })
    const next = applyPatches(tree, thicknessChangePatches(tree, 'pair1', { thickness: 45 }))
    expect(valuesOf(next, 'pair1').sashThickness).toBe(45)
    expect(valuesOf(next, 'bot1').bottomHeight).toBe(88)
    expect(valuesOf(next, 'frame1').height).toBe(1849)
  })

  it('a chamfer-ANGLE change moves rail and height but not the thickness', () => {
    const tree = boxSash({ thickness: 45 })
    const next = applyPatches(tree, thicknessChangePatches(tree, 'pair1', { chamferAngle: 0 }))
    expect(valuesOf(next, 'pair1').sashThickness).toBe(45)
    expect(valuesOf(next, 'bot1').bottomHeight).toBe(95)    // 88 + (7 − 0)
    expect(valuesOf(next, 'frame1').height).toBe(1856)
  })

  it('touches the EDITED pair, not the first pair', () => {
    const tree = boxSash({ thickness: 57, pairs: 2 })
    const next = applyPatches(tree, thicknessChangePatches(tree, 'pair2', { thickness: 45 }))
    expect(valuesOf(next, 'pair2').sashThickness).toBe(45)
    expect(valuesOf(next, 'bot2').bottomHeight).toBe(90)
    expect(valuesOf(next, 'pair1').sashThickness).toBe(57)  // untouched
    expect(valuesOf(next, 'bot1').bottomHeight).toBe(88)
  })

  it('owningPair resolves a sash key to its own pair', () => {
    const tree = boxSash({ pairs: 2 })
    expect(owningPair(tree, 'bot2').key).toBe('pair2')
    expect(owningPair(tree, 'pair1').key).toBe('pair1')
  })
})

// ── The complete-new enforcement ─────────────────────────────────────────────

describe('applyCompleteNewThickness', () => {
  it('sets 45 on a complete-new pair, shifting rail and frame height', () => {
    const { tree, pairsChanged } = applyCompleteNewThickness(boxSash({ thickness: 57 }))
    expect(pairsChanged).toEqual(['pair1'])
    expect(valuesOf(tree, 'pair1').sashThickness).toBe(COMPLETE_NEW_SASH_THICKNESS_MM)
    expect(valuesOf(tree, 'bot1').bottomHeight).toBe(90)
    expect(valuesOf(tree, 'frame1').height).toBe(1851)
  })

  it('shifts the SHARED frame height once, every pair rail individually', () => {
    const { tree, pairsChanged } = applyCompleteNewThickness(boxSash({ thickness: 57, pairs: 2 }))
    expect(pairsChanged).toEqual(['pair1', 'pair2'])
    expect(valuesOf(tree, 'bot1').bottomHeight).toBe(90)
    expect(valuesOf(tree, 'bot2').bottomHeight).toBe(90)
    expect(valuesOf(tree, 'frame1').height).toBe(1851)      // +2 once, not +4
  })

  it('is a no-op when already 45', () => {
    const tree = boxSash({ thickness: 45 })
    const out = applyCompleteNewThickness(tree)
    expect(out.pairsChanged).toEqual([])
    expect(out.tree).toBe(tree)
  })

  it('never touches a sash replacement, draught seal or bi-glass', () => {
    for (const tow of ['new_pair_of_sashes', 'draught_seal', 'bi_glass']) {
      const tree = boxSash({ typeOfWork: tow, thickness: 35 })
      const out = applyCompleteNewThickness(tree)
      expect(out.pairsChanged, tow).toEqual([])
      expect(valuesOf(out.tree, 'pair1').sashThickness, tow).toBe(35)
    }
  })
})
