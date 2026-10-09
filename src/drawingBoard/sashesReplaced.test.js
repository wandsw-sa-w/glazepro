// sashesReplaced.test.js — Step AJ
//
// The type of work owns a box sash window's "To Be Replaced", because every
// sash-replacement price line depends on it and nothing on the board used to
// set it (a saved "New Pair of Sashes" drawing stored toBeReplaced: null on
// both sashes and priced with no sashes at all). Nathan's business rule
// (9 Oct 2026): a sash replacement always replaces both sashes.

import { describe, it, expect } from 'vitest'
import {
  SASHES_REPLACED_BY_TYPE_OF_WORK,
  isSashWindow,
  typeOfWorkOf,
  sashesReplacedTarget,
  sashesDisagreeing,
  applySashesReplaced,
} from './sashesReplaced.js'

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Box sash with `pairs` pairs; `replaced` is the STORED toBeReplaced. */
function boxSash({ typeOfWork = 'new_pair_of_sashes', pairs = 1, replaced = null } = {}) {
  const stored = replaced === null ? {} : { toBeReplaced: replaced }
  const pair = n => ({
    key: `pair${n}`,
    part_type: 'sashPairPart',
    values: { sashThickness: 45 },
    children: [
      { key: `top${n}`, part_type: 'topSashPart',    values: { topHeight: 49, ...stored }, children: [] },
      { key: `bot${n}`, part_type: 'bottomSashPart', values: { bottomHeight: 88, ...stored }, children: [] },
    ],
  })
  return {
    key: 'item1',
    part_type: 'drawingItemPart',
    values: { typeOfWork },
    children: [{
      key: 'frame1',
      part_type: 'assemblyFramePart',
      values: { width: 1070, height: 1849 },
      children: [
        { key: 'cill1', part_type: 'cillPart', values: { height: 70 }, children: [] },
        ...Array.from({ length: pairs }, (_, i) => pair(i + 1)),
      ],
    }],
  }
}

const sashKeys = pairs => Array.from({ length: pairs }, (_, i) => [`top${i + 1}`, `bot${i + 1}`]).flat()

function valueOf(tree, key) {
  let found
  ;(function walk(n) { if (n.key === key) found = n.values; (n.children ?? []).forEach(walk) })(tree)
  return found
}

function allSashValues(tree) {
  const out = []
  ;(function walk(n) {
    if (n.part_type === 'topSashPart' || n.part_type === 'bottomSashPart') out.push(n.values?.toBeReplaced)
    ;(n.children ?? []).forEach(walk)
  })(tree)
  return out
}

// ── The rule, per type of work, on 1 pair and on a double box ────────────────

describe('applySashesReplaced — every type of work', () => {
  const CASES = [
    ['complete_new',       true],
    ['new_pair_of_sashes', true],
    ['draught_seal',       false],
    ['bi_glass',           false],
    ['no_work',            false],
  ]

  for (const [typeOfWork, expected] of CASES) {
    for (const pairs of [1, 2]) {
      it(`${typeOfWork} → ${expected} on every sash of ${pairs} pair(s)`, () => {
        const tree = boxSash({ typeOfWork, pairs, replaced: null })
        const { tree: next, sashesChanged, target } = applySashesReplaced(tree)
        expect(target).toBe(expected)
        expect(sashesChanged.sort()).toEqual(sashKeys(pairs).sort())
        expect(allSashValues(next)).toEqual(Array(pairs * 2).fill(expected))
      })
    }
  }

  it('matches the documented map', () => {
    expect(SASHES_REPLACED_BY_TYPE_OF_WORK).toEqual(Object.fromEntries(CASES))
  })

  it('is a no-op when the sashes already agree', () => {
    const tree = boxSash({ typeOfWork: 'new_pair_of_sashes', replaced: true })
    const out = applySashesReplaced(tree)
    expect(out.sashesChanged).toEqual([])
    expect(out.tree).toBe(tree)
  })

  it('fixes the null a board-drawn sash replacement used to store', () => {
    // The reviewer's live gap: toBeReplaced null on both sashes.
    const tree = boxSash({ typeOfWork: 'new_pair_of_sashes', replaced: null })
    expect(allSashValues(tree)).toEqual([undefined, undefined])
    expect(allSashValues(applySashesReplaced(tree).tree)).toEqual([true, true])
  })

  it('corrects a sash that disagrees in either direction', () => {
    const dsoTrue = boxSash({ typeOfWork: 'draught_seal', replaced: true })
    expect(allSashValues(applySashesReplaced(dsoTrue).tree)).toEqual([false, false])
    const njFalse = boxSash({ typeOfWork: 'new_pair_of_sashes', replaced: false })
    expect(allSashValues(applySashesReplaced(njFalse).tree)).toEqual([true, true])
  })
})

// ── Where the rule does NOT apply ────────────────────────────────────────────

describe('applySashesReplaced — out of scope', () => {
  it('does nothing without a type of work (never invents a value)', () => {
    const tree = boxSash({ typeOfWork: null })
    const out = applySashesReplaced(tree)
    expect(out.target).toBeNull()
    expect(out.sashesChanged).toEqual([])
    expect(allSashValues(out.tree)).toEqual([undefined, undefined])
  })

  it('does nothing for an unknown type of work code', () => {
    expect(applySashesReplaced(boxSash({ typeOfWork: 'something_new' })).target).toBeNull()
  })

  it('leaves casement and door items alone', () => {
    for (const partType of ['casementSashPart', 'doorLeafPart']) {
      const tree = boxSash({ typeOfWork: 'new_pair_of_sashes' })
      const frame = tree.children[0]
      const withOther = {
        ...tree,
        children: [{ ...frame, children: [...frame.children, { key: 'other', part_type: partType, values: {}, children: [] }] }],
      }
      expect(isSashWindow(withOther), partType).toBe(false)
      const out = applySashesReplaced(withOther)
      expect(out.target, partType).toBeNull()
      expect(out.sashesChanged, partType).toEqual([])
    }
  })

  it('touches no other part value', () => {
    const tree = boxSash({ typeOfWork: 'new_pair_of_sashes' })
    const next = applySashesReplaced(tree).tree
    expect(valueOf(next, 'pair1').sashThickness).toBe(45)
    expect(valueOf(next, 'frame1')).toEqual({ width: 1070, height: 1849 })
    expect(valueOf(next, 'cill1')).toEqual({ height: 70 })
    expect(valueOf(next, 'top1').topHeight).toBe(49)
  })
})

// ── Helpers the board uses ───────────────────────────────────────────────────

describe('sashesDisagreeing / target (what the board’s button and note use)', () => {
  it('lists the sashes the "Set sashes to match type of work" button will fix', () => {
    // A saved drawing whose sashes disagree: the button is offered...
    const stale = boxSash({ typeOfWork: 'new_pair_of_sashes', replaced: false, pairs: 2 })
    expect(sashesDisagreeing(stale).map(s => s.key).sort()).toEqual(sashKeys(2).sort())
    // ...and after it runs there is nothing left to fix (and no button).
    const fixed = applySashesReplaced(stale).tree
    expect(sashesDisagreeing(fixed)).toEqual([])
  })

  it('reads the type of work and the target', () => {
    expect(typeOfWorkOf(boxSash({ typeOfWork: 'draught_seal' }))).toBe('draught_seal')
    expect(sashesReplacedTarget(boxSash({ typeOfWork: 'draught_seal' }))).toBe(false)
    expect(sashesReplacedTarget(boxSash({ typeOfWork: 'complete_new' }))).toBe(true)
  })
})
