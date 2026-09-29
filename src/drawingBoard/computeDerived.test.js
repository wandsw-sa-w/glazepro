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

  it('internalHeight treats absent cill.height as 0', () => {
    // cill.height null → default 0; internalHeight = frameHeight − topHeight − 0
    const d = computeDerived(makeTree({ width: 500, height: 1849, topHeight: 79 }, {}))
    expect(d['pair'].internalHeight).toBe(1849 - 79)
  })

  it('internalHeight treats absent frame.topHeight as 0', () => {
    // topHeight null → default 0; internalHeight = frameHeight − 0 − cillHeight
    const d = computeDerived(makeTree({ width: 500, height: 1849 }, { height: 70 }))
    expect(d['pair'].internalHeight).toBe(1849 - 70)
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

  it('internalHeight treats missing cillPart as cillHeight=0', () => {
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
    expect(d['pair'].internalHeight).toBe(1849 - 79)  // cill absent → treated as 0
    expect(d['pair'].internalWidth).toBe(330)          // still computable
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


// ── Glazing bar positions — Step J fixes #2 ───────────────────────────────────
// Box sash 1100 x 1600, jambs 79/79, cill 70, no clearances, rails 49/88, stile 47.
// internalWidth 942, sashWidth 942, glassW = 942 - 2*47 = 848.
// internalHeight 1451, totalGlass 1274, half_half -> topGlassHeight = bottomGlassHeight = 637.

function makeBarTree({ topVBars = [], topHBars = [], botVBars = [], botHBars = [] } = {}) {
  return {
    key: 'item', part_type: 'drawingItemPart', values: {}, children: [
      {
        key: 'frame', part_type: 'assemblyFramePart',
        values: { width: 1100, height: 1600, leftWidth: 79, rightWidth: 79, topHeight: 79 },
        children: [
          { key: 'cill', part_type: 'cillPart', values: { height: 70 }, children: [] },
          {
            key: 'pair', part_type: 'sashPairPart', values: {}, children: [
              {
                key: 'top', part_type: 'topSashPart', values: { topHeight: 49, stileWidth: 47 }, children: [
                  { key: 'tglass', part_type: 'glassPart', values: {}, children: [...topVBars, ...topHBars] },
                ],
              },
              {
                key: 'bot', part_type: 'bottomSashPart', values: { bottomHeight: 88 }, children: [
                  { key: 'bglass', part_type: 'glassPart', values: {}, children: [...botVBars, ...botHBars] },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}

function vbar(key, values = {}) { return { key, part_type: 'verticalGlazingBarPart', values, children: [] } }
function hbar(key, values = {}) { return { key, part_type: 'horizontalGlazingBarPart', values, children: [] } }

describe('computeDerived — glazing bar positions use the true glass sightline (not frame width)', () => {
  it('2 vertical bars (3 panes): pane widths equal to within 0.5mm', () => {
    const tree = makeBarTree({ topVBars: [vbar('v1'), vbar('v2')] })
    const d = computeDerived(tree)
    const p1 = d['v1'].position
    const p2 = d['v2'].position
    expect(p1).not.toBeNull()
    expect(p2).not.toBeNull()

    const glassW = 848 // 942 - 2*47
    const gap0 = p1 - 0
    const gap1 = p2 - p1
    const gap2 = glassW - p2
    expect(Math.abs(gap0 - gap1)).toBeLessThan(0.5)
    expect(Math.abs(gap1 - gap2)).toBeLessThan(0.5)
  })

  it('is a real fix, not a coincidence — old frame-width approximation would have put v2 near 733mm, not ~565mm', () => {
    const tree = makeBarTree({ topVBars: [vbar('v1'), vbar('v2')] })
    const d = computeDerived(tree)
    expect(d['v2'].position).toBeLessThan(600)
    expect(d['v2'].position).toBeGreaterThan(550)
  })

  it('6-over-6: 2 vertical + 1 horizontal bar on both top and bottom glass', () => {
    const tree = makeBarTree({
      topVBars: [vbar('tv1'), vbar('tv2')], topHBars: [hbar('th1')],
      botVBars: [vbar('bv1'), vbar('bv2')], botHBars: [hbar('bh1')],
    })
    const d = computeDerived(tree)

    const glassW = 848
    for (const [aKey, bKey] of [['tv1', 'tv2'], ['bv1', 'bv2']]) {
      const a = d[aKey].position, b = d[bKey].position
      const gap0 = a - 0, gap1 = b - a, gap2 = glassW - b
      expect(Math.abs(gap0 - gap1)).toBeLessThan(0.5)
      expect(Math.abs(gap1 - gap2)).toBeLessThan(0.5)
    }

    // Horizontal bar sits at the midpoint of its own sash's glass height (637/2),
    // not a frame-derived approximation.
    expect(d['th1'].position).toBeCloseTo(637 / 2, 1)
    expect(d['bh1'].position).toBeCloseTo(637 / 2, 1)
  })

  it('a partial bar (offset/offset2 set) is left alone — no auto position assigned', () => {
    const tree = makeBarTree({ topVBars: [vbar('partial', { offset: 200, offset2: 400 })] })
    const d = computeDerived(tree)
    expect(d['partial']?.position).toBeUndefined()
  })

  it('a manual bar disables auto-position for its siblings on the same glass too', () => {
    const tree = makeBarTree({ topVBars: [vbar('manual', { offset: 300 }), vbar('auto')] })
    const d = computeDerived(tree)
    expect(d['manual']?.position).toBeUndefined()
    expect(d['auto']?.position).toBeUndefined()
  })
})
