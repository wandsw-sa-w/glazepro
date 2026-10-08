import { describe, it, expect } from 'vitest'
import { computeSashGeometry, computeOpeningLayout, computeGlassWidth, chamferAllowanceMm } from './sashGeometry.js'

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


// ── computeOpeningLayout — Step J fixes #2/#4 ─────────────────────────────────

describe('computeOpeningLayout', () => {
  it('no mullions -> a single opening spanning the full interior width', () => {
    expect(computeOpeningLayout([], 842)).toEqual([{ x: 0, width: 842 }])
  })

  it('one mullion -> two openings split at the mullion offset', () => {
    const mullions = [{ values: { offset: 421 } }]
    expect(computeOpeningLayout(mullions, 842)).toEqual([
      { x: 0, width: 421 },
      { x: 421, width: 421 },
    ])
  })

  it('two mullions, unsorted input -> three openings sorted left to right', () => {
    const mullions = [{ values: { offset: 600 } }, { values: { offset: 300 } }]
    expect(computeOpeningLayout(mullions, 900)).toEqual([
      { x: 0, width: 300 },
      { x: 300, width: 300 },
      { x: 600, width: 300 },
    ])
  })

  it('treats a non-positive or missing offset as 0 rather than crashing', () => {
    const mullions = [{ values: {} }, { values: { offset: -5 } }]
    expect(() => computeOpeningLayout(mullions, 500)).not.toThrow()
  })
})


// ── computeGlassWidth — Step J fixes #2 ───────────────────────────────────────

describe('computeGlassWidth', () => {
  it('subtracts the stile width from each side', () => {
    expect(computeGlassWidth(942, 47)).toBe(942 - 2 * 47)
  })

  it('falls back to 47mm stile when stileWidth is absent', () => {
    expect(computeGlassWidth(942, undefined)).toBe(942 - 2 * 47)
  })

  it('falls back to 47mm stile when stileWidth is zero or negative', () => {
    expect(computeGlassWidth(942, 0)).toBe(942 - 2 * 47)
    expect(computeGlassWidth(942, -10)).toBe(942 - 2 * 47)
  })

  it('never goes negative', () => {
    expect(computeGlassWidth(50, 47)).toBe(0)
  })

  it('returns null when sashWidth is missing', () => {
    expect(computeGlassWidth(null, 47)).toBeNull()
  })
})

// ── chamferAllowanceMm ────────────────────────────────────────────────────────
// Facts from docs/integrate-benchmarks-thickness.txt (second visit): the
// allowance is round(thickness × tan(angle)) in whole millimetres —
// 35/40 → 6, 45 → 7, 50 → 8 at the measured 9° rail.
describe('chamferAllowanceMm', () => {
  it('matches Integrate at 9° for every measured thickness', () => {
    expect(chamferAllowanceMm(35, 9)).toBe(6)
    expect(chamferAllowanceMm(40, 9)).toBe(6)
    expect(chamferAllowanceMm(45, 9)).toBe(7)
    expect(chamferAllowanceMm(50, 9)).toBe(8)
  })

  it('is 0 without a chamfer', () => {
    expect(chamferAllowanceMm(45, 0)).toBe(0)
    expect(chamferAllowanceMm(45, null)).toBe(0)
    expect(chamferAllowanceMm(45, undefined)).toBe(0)
  })

  it('is 0 when the thickness is missing', () => {
    expect(chamferAllowanceMm(null, 9)).toBe(0)
  })
})
