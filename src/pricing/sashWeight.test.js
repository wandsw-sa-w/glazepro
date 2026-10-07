import { describe, it, expect } from 'vitest'
import { computeSashWeight, TIMBER_DENSITIES, HORN_LENGTHS_MM } from './sashWeight'

// ── Fixture tree — L34046 Item 7 ─────────────────────────────────────────────
// Complete new box sash, solid redwood, cord hung, 1255×1775mm outer frame,
// 6-over-6 glazing pattern (barsWide=2, barsHigh=1), Victorian horn on top.

const FIXTURE_TREE = {
  key: 'item1',
  part_type: 'drawingItemPart',
  values: {
    typeOfWork:      'complete_new',
    sashMaterialId:  'solid_redwood',
  },
  children: [
    {
      key: 'frame1',
      part_type: 'assemblyFramePart',
      values: {
        outerWidth:     1255,
        outerHeight:    1775,
        topHeight:      79,
        leftOuterJamb:  101,
        rightOuterJamb: 101,
      },
      children: [
        {
          key: 'cill1',
          part_type: 'cillPart',
          values: { height: 70, depth: 200, profiledHeight: 45 },
          children: [],
        },
        {
          key: 'pair1',
          part_type: 'sashPairPart',
          values: {
            sashThickness:           45,
            midrailHeight:           40,
            topHornTypeShortName:    'victorian',
            bottomHornTypeShortName: 'none',
          },
          children: [
            {
              key: 'top1',
              part_type: 'topSashPart',
              values: { topHeight: 49, leftWidth: 47, rightWidth: 47, operation: 'cord_hung' },
              children: [
                {
                  key: 'glass1',
                  part_type: 'glassPart',
                  values: {
                    glazingId: 'double_glazed',
                    barsWide:  2,
                    barsHigh:  1,
                    internalGlassPartNo: 'GL100010',
                    externalGlassPartNo: 'GL100080',
                    spacerHeight: 16,
                  },
                  children: [],
                },
              ],
            },
            {
              key: 'bot1',
              part_type: 'bottomSashPart',
              values: { bottomHeight: 88, leftWidth: 47, rightWidth: 47, operation: 'cord_hung' },
              children: [
                {
                  key: 'glass2',
                  part_type: 'glassPart',
                  values: {
                    glazingId: 'double_glazed',
                    barsWide:  2,
                    barsHigh:  1,
                    internalGlassPartNo: 'GL100010',
                    externalGlassPartNo: 'GL100080',
                    spacerHeight: 16,
                  },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

const TOP_NODE = FIXTURE_TREE.children[0].children[1].children[0]   // topSashPart
const BOT_NODE = FIXTURE_TREE.children[0].children[1].children[1]   // bottomSashPart

// Glass catalogue with known thicknesses
const GLASS_CATALOGUE = {
  GL100010: { cost_per_m2: 32.00, thickness_mm: 4 },
  GL100080: { cost_per_m2: 25.50, thickness_mm: 4 },
}

// ── Glass cut size verification ──────────────────────────────────────────────
// With default profile values (rebate=14, tolerance=2), cover = 12 mm per edge.
// sightlineWidth = 1053 - 2*47 = 959, sightlineHeight = (1775-79-70-40)/2 = 793
// paneWidth = 959 + 24 = 983, paneHeight = 793 + 24 = 817
// glass_area_m2 = 983 * 817 / 1e6 = 0.803111

describe('computeSashWeight — L34046 Item 7 with glass cut size', () => {
  it('glass pane uses cut size (sightline + 2*cover), cover=12 by default', () => {
    const r = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE)
    expect(r._debug.cover).toBe(12)
    expect(r._debug.paneWidth).toBe(983)
    expect(r._debug.paneHeight).toBe(817)
    expect(r._debug.glass_area_m2).toBeCloseTo(0.803111, 4)
  })

  it('top sash weight with default profile (rebate=14, tolerance=2)', () => {
    const result = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE)
    // With cover=12: glass_area increases, weight goes up vs old GLAZING_REBATE_MM=0
    expect(result.weight_in_kg).toBeGreaterThan(19.5)
    expect(result.weight_in_kg).toBeLessThan(21.5)
  })

  it('bottom sash weight with default profile (rebate=14, tolerance=2)', () => {
    const result = computeSashWeight(BOT_NODE, FIXTURE_TREE, GLASS_CATALOGUE)
    expect(result.weight_in_kg).toBeGreaterThan(20.5)
    expect(result.weight_in_kg).toBeLessThan(22.5)
  })

  it('lb conversion is consistent with kg * 2.20462', () => {
    const r = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE)
    expect(r.weight_in_lb).toBeCloseTo(r.weight_in_kg * 2.20462, 4)
  })

  it('weight_incl_panel equals weight when no panels in tree', () => {
    const r = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE)
    expect(r.weight_incl_panel_in_kg).toBeCloseTo(r.weight_in_kg, 6)
    expect(r.weight_incl_panel_in_lb).toBeCloseTo(r.weight_in_lb, 6)
  })
})

// ── Geometry outputs ──────────────────────────────────────────────────────────

describe('computeSashWeight — geometry fields', () => {
  it('gross_sash_width_in_mm = outerWidth - leftOuterJamb - rightOuterJamb', () => {
    const r = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE)
    expect(r.gross_sash_width_in_mm).toBe(1255 - 101 - 101)  // 1053
  })

  it('top sash gross_sash_height_in_mm includes victorian horn (50 mm)', () => {
    const r = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE)
    // sightlineHeight = (1775 - 79 - 70 - 40) / 2 = 793  (profiledCill = cv.height = 70)
    // top = 793 + 49 + 40 + 50 = 932
    expect(r.gross_sash_height_in_mm).toBeCloseTo(932, 1)
  })

  it('bottom sash gross_sash_height_in_mm includes cill extension', () => {
    const r = computeSashWeight(BOT_NODE, FIXTURE_TREE, GLASS_CATALOGUE)
    // 793 + 88 + 40 + 0 (horn) + 45 (cillExtension = cv.profiledHeight) = 966
    expect(r.gross_sash_height_in_mm).toBeCloseTo(966, 1)
  })

  it('sash_thickness comes from sashPairPart.values.sashThickness', () => {
    const r = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE)
    expect(r.sash_thickness).toBe(45)
  })
})

// ── Falls back to 4 mm panes when catalogue is empty ─────────────────────────

describe('computeSashWeight — catalogue fallback', () => {
  it('falls back gracefully when glassCatalogue is empty', () => {
    const r = computeSashWeight(TOP_NODE, FIXTURE_TREE, {})
    // Should still compute (using 4+4 mm fallback)
    expect(r.weight_in_kg).toBeGreaterThan(0)
    expect(r.weight_in_lb).toBeGreaterThan(0)
  })

  it('glass weight is same with 4+4 mm catalogue as with 4+4 mm fallback', () => {
    const withCat = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE)
    const noCat   = computeSashWeight(TOP_NODE, FIXTURE_TREE, {})
    // Both should use 4+4 mm -> identical glass weight
    expect(withCat._debug.glass_kg).toBeCloseTo(noCat._debug.glass_kg, 6)
  })
})

// ── Material density variation ────────────────────────────────────────────────

describe('computeSashWeight — material density', () => {
  it('utile sash is heavier than redwood sash (higher density)', () => {
    const utileTree = JSON.parse(JSON.stringify(FIXTURE_TREE))
    utileTree.values.sashMaterialId = 'solid_utile_hardwood'

    const redwoodResult = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE)
    const utileResult   = computeSashWeight(
      utileTree.children[0].children[1].children[0],  // topSashPart in cloned tree
      utileTree,
      GLASS_CATALOGUE
    )
    expect(utileResult.weight_in_kg).toBeGreaterThan(redwoodResult.weight_in_kg)
  })

  it('TIMBER_DENSITIES exports the four standard material codes', () => {
    expect(TIMBER_DENSITIES.solid_redwood).toBe(508.3)
    expect(TIMBER_DENSITIES.accoya).toBe(508.3)
    expect(TIMBER_DENSITIES.solid_utile_hardwood).toBe(780.1)
    expect(TIMBER_DENSITIES.idigbo).toBe(780.1)
  })
})

// ── Profile values override ─────────────────────────────────────────────────

describe('computeSashWeight — profile values', () => {
  it('custom profile values change glass cut size and weight', () => {
    const defaultResult = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE)
    const customResult  = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE, {
      defaultDoubleGlazingRebateWidthForSash: 18,
      defaultDoubleGlazingTolerance: 2,
    })
    // cover = 18-2 = 16 vs default 14-2 = 12
    expect(customResult._debug.cover).toBe(16)
    expect(customResult._debug.paneWidth).toBeGreaterThan(defaultResult._debug.paneWidth)
    expect(customResult.weight_in_kg).toBeGreaterThan(defaultResult.weight_in_kg)
  })
})
