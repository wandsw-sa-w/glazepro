import { describe, it, expect } from 'vitest'
import { computeSashWeight, TIMBER_DENSITIES, HORN_LENGTHS_MM } from './sashWeight'

// ── Fixture tree — L34046 Item 7 ─────────────────────────────────────────────
// Complete new box sash, solid redwood ('softwood'), cord hung. Step V:
// the frame stores the OVERALL size (1245×1779 → interior 1075×1630 →
// drawn sashes 1075 wide, 815.5 / 854.5 high); weights come from those
// drawn sizes via derivedGeometry.js.

const FIXTURE_TREE = {
  key: 'item1',
  part_type: 'drawingItemPart',
  values: {
    typeOfWork:      'complete_new',
    sashMaterialId:  'softwood',
  },
  children: [
    {
      key: 'frame1',
      part_type: 'assemblyFramePart',
      values: {
        width:          1245,
        height:         1779,
        topHeight:      79,
        leftWidth:      85,
        rightWidth:     85,
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
                    glazingId: 'double_glazing',
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
                    glazingId: 'double_glazing',
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
const PV = { defaultDoubleGlazingRebateWidthForSash: 14, defaultDoubleGlazingTolerance: 2 }
const GLASS_CATALOGUE = {
  GL100010: { cost_per_m2: 32.00, thickness_mm: 4 },
  GL100080: { cost_per_m2: 25.50, thickness_mm: 4 },
}

// ── Calibration tests (±0.3 kg) ───────────────────────────────────────────────
// Integrate's weights for Item 7 are 19.4 / 20.4 kg (facts). The Step W
// MEASURED model (docs/step-w-sash-weight-brief.md) computes 19.57 / 20.53
// for this tree — back inside the ±0.3 band Step V had fallen out of.

describe('computeSashWeight — L34046 Item 7 calibration', () => {
  it('top sash weight is 19.4 kg ±0.3 kg', () => {
    const result = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE, PV)
    expect(result.weight_in_kg).toBeGreaterThanOrEqual(19.1)
    expect(result.weight_in_kg).toBeLessThanOrEqual(19.7)
  })

  it('bottom sash weight is 20.4 kg ±0.3 kg', () => {
    const result = computeSashWeight(BOT_NODE, FIXTURE_TREE, GLASS_CATALOGUE, PV)
    expect(result.weight_in_kg).toBeGreaterThanOrEqual(20.1)
    expect(result.weight_in_kg).toBeLessThanOrEqual(20.7)
  })

  it('lb conversion is consistent with kg × 2.20462', () => {
    const r = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE, PV)
    expect(r.weight_in_lb).toBeCloseTo(r.weight_in_kg * 2.20462, 4)
  })

  it('weight_incl_panel equals weight when no panels in tree', () => {
    const r = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE, PV)
    expect(r.weight_incl_panel_in_kg).toBeCloseTo(r.weight_in_kg, 6)
    expect(r.weight_incl_panel_in_lb).toBeCloseTo(r.weight_in_lb, 6)
  })
})

// ── Geometry outputs ──────────────────────────────────────────────────────────

describe('computeSashWeight — geometry fields', () => {
  it('gross_sash_width_in_mm is the drawn sash width (interior, no clearances)', () => {
    const r = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE, PV)
    expect(r.gross_sash_width_in_mm).toBe(1245 - 85 - 85)  // 1075
  })

  it('top sash gross_sash_height_in_mm is the drawn height — the horn is NOT in the weight', () => {
    const r = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE, PV)
    // interior height 1779 − 79 − 70 = 1630; glass (1630 − 40 − 49 − 88)/2 = 726.5
    // drawn top = 726.5 + 49 + 40 = 815.5 (measurement rows 10 vs 11: horn excluded)
    expect(r.gross_sash_height_in_mm).toBeCloseTo(815.5, 1)
  })

  it('bottom sash gross_sash_height_in_mm is the drawn height (no horn, no cill extension)', () => {
    const r = computeSashWeight(BOT_NODE, FIXTURE_TREE, GLASS_CATALOGUE, PV)
    // drawn bottom = 726.5 + 88 + 40 = 854.5
    expect(r.gross_sash_height_in_mm).toBeCloseTo(854.5, 1)
  })

  it('sash_thickness comes from sashPairPart.values.sashThickness', () => {
    const r = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE, PV)
    expect(r.sash_thickness).toBe(45)
  })
})

// ── Falls back to 4 mm panes when catalogue is empty ─────────────────────────

describe('computeSashWeight — catalogue fallback', () => {
  it('falls back gracefully when glassCatalogue is empty', () => {
    const r = computeSashWeight(TOP_NODE, FIXTURE_TREE, {}, PV)
    // Should still compute (using 4+4 mm fallback)
    expect(r.weight_in_kg).toBeGreaterThan(0)
    expect(r.weight_in_lb).toBeGreaterThan(0)
  })

  it('glass weight is same with 4+4 mm catalogue as with 4+4 mm fallback', () => {
    const withCat = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE, PV)
    const noCat   = computeSashWeight(TOP_NODE, FIXTURE_TREE, {}, PV)
    // Both should use 4+4 mm → identical glass weight
    expect(withCat._debug.glass_kg).toBeCloseTo(noCat._debug.glass_kg, 6)
  })
})

// ── Material density variation ────────────────────────────────────────────────

describe('computeSashWeight — material density', () => {
  it('utile sash is heavier than redwood sash (higher density)', () => {
    const utileTree = JSON.parse(JSON.stringify(FIXTURE_TREE))
    utileTree.values.sashMaterialId = 'utile'

    const redwoodResult = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE, PV)
    const utileResult   = computeSashWeight(
      utileTree.children[0].children[1].children[0],  // topSashPart in cloned tree
      utileTree,
      GLASS_CATALOGUE
      , PV)
    expect(utileResult.weight_in_kg).toBeGreaterThan(redwoodResult.weight_in_kg)
  })

  it('TIMBER_DENSITIES exports the four calibrated family densities', () => {
    expect(TIMBER_DENSITIES.redwood).toBe(508.3)
    expect(TIMBER_DENSITIES.accoya).toBe(508.3)
    expect(TIMBER_DENSITIES.utile_hardwood).toBe(780.1)
    expect(TIMBER_DENSITIES.idigbo).toBe(780.1)
  })
})

// ── Band lookup (should fall in 21 lb / 22 lb band) ──────────────────────────
// Integrate allocates 21 lb / 22 lb steel for Item 7 (facts). The Step W
// measured model puts this tree back in those bands (19.57 / 20.53 kg).

describe('computeSashWeight — weight band verification for Item 7', () => {
  it('top sash falls in 21 lb steel band (19.05 ≤ kg < 19.96)', () => {
    const r = computeSashWeight(TOP_NODE, FIXTURE_TREE, GLASS_CATALOGUE, PV)
    expect(r.weight_in_kg).toBeGreaterThanOrEqual(19.05)
    expect(r.weight_in_kg).toBeLessThan(19.96)
  })

  it('bottom sash falls in 22 lb steel band (19.96 ≤ kg < 20.87)', () => {
    const r = computeSashWeight(BOT_NODE, FIXTURE_TREE, GLASS_CATALOGUE, PV)
    expect(r.weight_in_kg).toBeGreaterThanOrEqual(19.96)
    expect(r.weight_in_kg).toBeLessThan(20.87)
  })
})
