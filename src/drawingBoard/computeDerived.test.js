import { describe, it, expect } from 'vitest'
import { computeDerived } from './computeDerived'

// Build a minimal tree for testing.
// frameValues  → assemblyFramePart.values
// cillValues   → cillPart.values
// itemValues   → drawingItemPart.values
function makeTree(frameValues = {}, cillValues = {}, itemValues = {}) {
  return {
    key:       'item',
    part_type: 'drawingItemPart',
    values:    itemValues,
    children: [
      {
        key:       'frame',
        part_type: 'assemblyFramePart',
        values:    frameValues,
        children: [
          { key: 'cill',  part_type: 'cillPart',     values: cillValues, children: [] },
          {
            key:       'pair',
            part_type: 'sashPairPart',
            values:    {},
            children: [
              { key: 'top', part_type: 'topSashPart',    values: {}, children: [] },
              { key: 'bot', part_type: 'bottomSashPart', values: {}, children: [] },
            ],
          },
        ],
      },
    ],
  }
}


// ── Integrate check ───────────────────────────────────────────────────────────
// width 500, height 1849, inner jambs 85/85, inner head 79, cill height 70,
// outer jamb 101 → internalWidth 330, internalHeight 1700, jambDifference 16

describe('computeDerived — Integrate check', () => {
  const tree = makeTree(
    { width: 500, height: 1849, leftWidth: 85, rightWidth: 85, topHeight: 79, leftOuterJamb: 101 },
    { height: 70 },
    {},
  )
  const d = computeDerived(tree)

  it('internalWidth = 500 − 85 − 85 = 330', () => {
    expect(d['pair'].internalWidth).toBe(330)
  })

  it('internalHeight = 1849 − 79 − 70 = 1700', () => {
    expect(d['pair'].internalHeight).toBe(1700)
  })

  it('jambDifference = 101 − 85 = 16', () => {
    expect(d['frame'].jambDifference).toBe(16)
  })
})


// ── newFrame / isBiGlass ─────────────────────────────────────────────────────

describe('computeDerived — newFrame / isBiGlass', () => {
  it('newFrame true when typeOfWork = complete_new', () => {
    const d = computeDerived(makeTree({}, {}, { typeOfWork: 'complete_new' }))
    expect(d['item'].newFrame).toBe(true)
    expect(d['item'].isBiGlass).toBe(false)
  })

  it('isBiGlass true when typeOfWork = bi_glass', () => {
    const d = computeDerived(makeTree({}, {}, { typeOfWork: 'bi_glass' }))
    expect(d['item'].isBiGlass).toBe(true)
    expect(d['item'].newFrame).toBe(false)
  })

  it('both null when typeOfWork is absent', () => {
    const d = computeDerived(makeTree({}, {}, {}))
    expect(d['item'].newFrame).toBe(null)
    expect(d['item'].isBiGlass).toBe(null)
  })

  it('both false when typeOfWork is another value', () => {
    const d = computeDerived(makeTree({}, {}, { typeOfWork: 'draught_seal' }))
    expect(d['item'].newFrame).toBe(false)
    expect(d['item'].isBiGlass).toBe(false)
  })
})


// ── Missing inputs → null, never NaN ─────────────────────────────────────────

describe('computeDerived — null for missing inputs', () => {
  it('internalWidth null when frame.width is absent', () => {
    const d = computeDerived(makeTree({ leftWidth: 85, rightWidth: 85 }, { height: 70 }))
    expect(d['pair'].internalWidth).toBe(null)
  })

  it('internalHeight null when cill.height is absent', () => {
    const d = computeDerived(makeTree({ width: 500, height: 1849, topHeight: 79 }, {}))
    expect(d['pair'].internalHeight).toBe(null)
  })

  it('internalHeight null when frame.topHeight is absent', () => {
    const d = computeDerived(makeTree({ width: 500, height: 1849 }, { height: 70 }))
    expect(d['pair'].internalHeight).toBe(null)
  })

  it('jambDifference null when leftOuterJamb is absent', () => {
    const d = computeDerived(makeTree({ leftWidth: 85 }))
    expect(d['frame'].jambDifference).toBe(null)
  })

  it('jambDifference null when leftWidth is absent', () => {
    const d = computeDerived(makeTree({ leftOuterJamb: 101 }))
    expect(d['frame'].jambDifference).toBe(null)
  })
})


// ── Pending formulas return null (not undefined) ──────────────────────────────

describe('computeDerived — pending formulas', () => {
  it('itemWeight is null', () => {
    const d = computeDerived(makeTree())
    expect(d['item'].itemWeight).toBe(null)
  })

  it('topSashPart weight and travel are null', () => {
    const d = computeDerived(makeTree())
    expect(d['top'].weight).toBe(null)
    expect(d['top'].travel).toBe(null)
  })

  it('bottomSashPart weight and travel are null', () => {
    const d = computeDerived(makeTree())
    expect(d['bot'].weight).toBe(null)
    expect(d['bot'].travel).toBe(null)
  })
})


// ── Edge cases ────────────────────────────────────────────────────────────────

describe('computeDerived — edge cases', () => {
  it('returns empty object for null tree', () => {
    expect(computeDerived(null)).toEqual({})
  })

  it('internalHeight null when cillPart is absent from tree', () => {
    const tree = {
      key: 'item', part_type: 'drawingItemPart', values: {}, children: [
        {
          key: 'frame', part_type: 'assemblyFramePart',
          values: { width: 500, height: 1849, leftWidth: 85, rightWidth: 85, topHeight: 79 },
          children: [
            { key: 'pair', part_type: 'sashPairPart', values: {}, children: [] },
          ],
        },
      ],
    }
    const d = computeDerived(tree)
    expect(d['pair'].internalHeight).toBe(null)  // cill missing
    expect(d['pair'].internalWidth).toBe(330)    // still computable
  })

  it('handles multiple topSashPart nodes', () => {
    const tree = {
      key: 'item', part_type: 'drawingItemPart', values: {}, children: [
        {
          key: 'frame', part_type: 'assemblyFramePart', values: {}, children: [
            {
              key: 'pair', part_type: 'sashPairPart', values: {}, children: [
                { key: 'top1', part_type: 'topSashPart', values: {}, children: [] },
                { key: 'top2', part_type: 'topSashPart', values: {}, children: [] },
              ],
            },
          ],
        },
      ],
    }
    const d = computeDerived(tree)
    expect(d['top1'].weight).toBe(null)
    expect(d['top2'].weight).toBe(null)
  })
})
