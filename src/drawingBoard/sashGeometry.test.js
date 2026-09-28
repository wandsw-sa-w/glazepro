import { describe, it, expect } from 'vitest'
import { computeSashGeometry } from './sashGeometry.js'

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeTree(opts = {}) {
  const {
    clearLeft       = 2.5,
    clearRight      = 2.5,
    clearTop        = 0,
    clearBottom     = 0,
    M               = 40,
    sashSplit       = 'half_half',
    fixedSashHeight = null,
    topRail         = 49,
    bottomRail      = 88,
  } = opts

  return {
    key: 'item1',
    part_type: 'drawingItemPart',
    sort_order: 0,
    values: {},
    children: [{
      key: 'frame1',
      part_type: 'assemblyFramePart',
      sort_order: 1,
      values: {},
      children: [{
        key: 'pair1',
        part_type: 'sashPairPart',
        sort_order: 2,
        values: {
          mechanicalClearanceLeft:   clearLeft,
          mechanicalClearanceRight:  clearRight,
          mechanicalClearanceTop:    clearTop,
          mechanicalClearanceBottom: clearBottom,
          midrailHeight:             M,
          sashSplit,
          fixedSashHeight,
        },
        children: [
          {
            key: 'top1',
            part_type: 'topSashPart',
            sort_order: 3,
            values: { topHeight: topRail },
            children: [],
          },
          {
            key: 'bot1',
            part_type: 'bottomSashPart',
            sort_order: 4,
            values: { bottomHeight: bottomRail },
            children: [],
          },
        ],
      }],
    }],
  }
}

function makeDerived(iW, iH) {
  return {
    pair1: { internalWidth: iW, internalHeight: iH },
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computeSashGeometry', () => {

  it('1. half_half 330×1700 → correct sash and glass dimensions', () => {
    const tree    = makeTree()
    const derived = makeDerived(330, 1700)
    const geo     = computeSashGeometry(tree, derived)

    expect(geo).not.toBeNull()
    expect(geo.sashWidth).toBe(325)
    expect(geo.topSashHeight).toBe(850.5)
    expect(geo.bottomSashHeight).toBe(889.5)
    expect(geo.topGlassHeight).toBe(761.5)
    expect(geo.bottomGlassHeight).toBe(761.5)
  })

  it('2. half_half 1075×1630 → sashWidth 1070, topSash 815.5, bottomSash 854.5', () => {
    const tree    = makeTree()
    const derived = makeDerived(1075, 1630)
    const geo     = computeSashGeometry(tree, derived)

    expect(geo).not.toBeNull()
    expect(geo.sashWidth).toBe(1070)
    expect(geo.topSashHeight).toBe(815.5)
    expect(geo.bottomSashHeight).toBe(854.5)
  })

  it('3. third_two_thirds 330×1700 → topGlassHeight ≈ totalGlass/3, topSashHeight ≈ 596.67', () => {
    const tree    = makeTree({ sashSplit: 'third_two_thirds' })
    const derived = makeDerived(330, 1700)
    const geo     = computeSashGeometry(tree, derived)

    // totalGlass = 1700 - 40 - 49 - 88 = 1523
    const expectedTopGlass = 1523 / 3        // ≈ 507.666...
    const expectedTopSash  = expectedTopGlass + 49 + 40  // ≈ 596.666...

    expect(geo).not.toBeNull()
    expect(geo.topGlassHeight).toBeCloseTo(expectedTopGlass, 5)
    expect(geo.topSashHeight).toBeCloseTo(expectedTopSash, 5)
  })

  it('4. set_top fixedSashHeight=860 → topSashHeight=860, bottomSashHeight=880', () => {
    // topGlass = 860 - 49 - 40 = 771
    // totalGlass = 1700 - 40 - 49 - 88 = 1523
    // botGlass = 1523 - 771 = 752
    // bottomSashHeight = 752 + 88 + 40 = 880
    const tree    = makeTree({ sashSplit: 'set_top', fixedSashHeight: 860 })
    const derived = makeDerived(330, 1700)
    const geo     = computeSashGeometry(tree, derived)

    expect(geo).not.toBeNull()
    expect(geo.topSashHeight).toBe(860)
    expect(geo.bottomSashHeight).toBe(880)
  })

  it('5. set_bottom fixedSashHeight=900 → bottomSashHeight=900', () => {
    // botGlass = 900 - 88 - 40 = 772
    // topGlass = 1523 - 772 = 751
    // bottomSashHeight = 772 + 88 + 40 = 900
    const tree    = makeTree({ sashSplit: 'set_bottom', fixedSashHeight: 900 })
    const derived = makeDerived(330, 1700)
    const geo     = computeSashGeometry(tree, derived)

    expect(geo).not.toBeNull()
    expect(geo.bottomSashHeight).toBe(900)
  })

  it('6. falls back to default 49 when topRail is null', () => {
    // topRail null → use profile default 49; geometry should still be computed
    const tree    = makeTree({ topRail: null })
    const derived = makeDerived(330, 1700)
    const geo     = computeSashGeometry(tree, derived)
    expect(geo).not.toBeNull()
    expect(geo.topSashHeight).toBe(761.5 + 49 + 40)   // topGlass + defaultTopRail + M
  })

  it('7. returns null when derived is {} (no internalWidth)', () => {
    const tree    = makeTree()
    expect(computeSashGeometry(tree, {})).toBeNull()
  })

  it('8. returns null when fixedSashHeight=null and sashSplit=set_top', () => {
    const tree    = makeTree({ sashSplit: 'set_top', fixedSashHeight: null })
    const derived = makeDerived(330, 1700)
    expect(computeSashGeometry(tree, derived)).toBeNull()
  })

  it('9. no NaN in any returned field', () => {
    const tree    = makeTree()
    const derived = makeDerived(330, 1700)
    const geo     = computeSashGeometry(tree, derived)

    expect(geo).not.toBeNull()
    for (const [key, val] of Object.entries(geo)) {
      expect(Number.isNaN(val), `${key} should not be NaN`).toBe(false)
    }
  })

})
