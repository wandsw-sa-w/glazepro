import { describe, it, expect } from 'vitest'
import { computeSashWeight, TIMBER_DENSITIES } from './sashWeight'
import { runPricingOnTree } from './pricingEngine.js'

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

// ══════════════════════════════════════════════════════════════════════════════
// Step W — the measurement table from docs/step-w-sash-weight-brief.md.
// Read from Integrate on 7 Oct 2026 by changing one thing at a time on
// L31115 Item 1 Drawing 4 (sash replacement); the table is FACT. Each sash
// weight is known to about ±0.1 kg (counterweights display to 0.1); the
// item weight in lb is precise to 0.1 lb.
// Where the model misses a row it is REPORTED, never tuned.
// ══════════════════════════════════════════════════════════════════════════════

const MEASURE_CAT = {
  GL4:   { cost_per_m2: 30, thickness_mm: 4 },     // 4mm pane
  GLACL: { cost_per_m2: 90, thickness_mm: 6.8 },   // 6.8mm Acoustic Laminated (rows 10/11)
}

// Fixed throughout the measurements: stiles 49, top rail 49, bottom rail 88,
// meeting rail 40, 1/2-1/2 split, bars only on the TOP sash, bottom no horn.
function measurementTree({ W, H, t, timber, nV = 0, nH = 0, outerCode = 'GL4', topHorn = 'victorian' }) {
  const bars = [
    ...Array.from({ length: nV }, (_, i) => ({ key: `vb${i}`, part_type: 'verticalGlazingBarPart', values: {}, children: [] })),
    ...Array.from({ length: nH }, (_, i) => ({ key: `hb${i}`, part_type: 'horizontalGlazingBarPart', values: {}, children: [] })),
  ]
  const glass = (key, children) => ({
    key, part_type: 'glassPart',
    values: { glazingId: 'double_glazing', internalGlassPartNo: 'GL4', externalGlassPartNo: outerCode },
    children,
  })
  return {
    key: 'item', part_type: 'drawingItemPart',
    values: { typeOfWork: 'new_pair_of_sashes', sashMaterialId: timber, frameMaterialId: timber, cillMaterialId: 'utile' },
    children: [{
      key: 'frame', part_type: 'assemblyFramePart',
      // Overall frame chosen so the DRAWN sash sizes equal the measured ones:
      // sash width = width − 85 − 85 = W; interior height = height − 79 − 70 = H
      values: { width: W + 170, height: H + 149, topHeight: 79, leftWidth: 85, rightWidth: 85 },
      children: [
        { key: 'cill', part_type: 'cillPart', values: { height: 70, depth: 200 }, children: [] },
        {
          key: 'pair', part_type: 'sashPairPart',
          values: {
            sashThickness: t, midrailHeight: 40, sashSplit: 'half_half',
            topHornTypeShortName: topHorn, bottomHornTypeShortName: 'none',
          },
          children: [
            {
              key: 'top', part_type: 'topSashPart',
              values: { topHeight: 49, leftWidth: 49, rightWidth: 49, operation: 'cord_hung', toBeReplaced: true },
              children: [glass('g1', bars)],
            },
            {
              key: 'bot', part_type: 'bottomSashPart',
              values: { bottomHeight: 88, leftWidth: 49, rightWidth: 49, operation: 'cord_hung', toBeReplaced: true },
              children: [glass('g2', [])],
            },
          ],
        },
      ],
    }],
  }
}

function measuredWeights(row) {
  const tree = measurementTree(row)
  const top = computeSashWeight(tree.children[0].children[1].children[0], tree, MEASURE_CAT, PV)
  const bot = computeSashWeight(tree.children[0].children[1].children[1], tree, MEASURE_CAT, PV)
  // Item weight via the engine (sash replacement → 1.1 × (top + bottom)),
  // read back through a probe rule on item_nj_weight_in_lb
  const probe = [{
    id: 'probe', rule_family: 'price', level: 'item', is_active: true, sort_order: 1,
    group_name: 'probe', loop_target: null, name: 'item_lb_probe',
    condition: 'true', quantity: 'item_nj_weight_in_lb', value: '1', markup: 1,
  }]
  const res = runPricingOnTree(tree, probe, {}, { glassCatalogue: MEASURE_CAT, profileValues: PV })
  const itemLb = res.price.lines.find(l => l.name === 'item_lb_probe' && l.fires)?.quantity ?? null
  return { top: top.weight_in_kg, bot: bot.weight_in_kg, itemLb }
}

describe('Step W — Integrate measurement rows 1-9 (sash kg ±0.1, item lb ±0.2)', () => {
  const ROWS = [
    { n: 1, W: 900,  H: 1700, t: 45, timber: 'softwood', nV: 2, nH: 1, top: 17.2, bottom: 17.3, itemLb: 83.6 },
    { n: 2, W: 1200, H: 1700, t: 45, timber: 'softwood', nV: 2, nH: 1, top: 22.6, bottom: 22.8, itemLb: 110.3 },
    { n: 3, W: 1200, H: 1700, t: 45, timber: 'softwood', nV: 0, nH: 0, top: 21.8, bottom: 22.8, itemLb: 108.4 },
    { n: 4, W: 1200, H: 1699, t: 50, timber: 'softwood', nV: 0, nH: 0, top: 22.2, bottom: 23.4, itemLb: 110.9 },
    { n: 5, W: 1200, H: 1699, t: 50, timber: 'softwood', nV: 2, nH: 1, top: 23.2, bottom: 23.4, itemLb: 112.9 },
    { n: 6, W: 1200, H: 1699, t: 50, timber: 'softwood', nV: 6, nH: 6, top: 25.6, bottom: 23.4, itemLb: 119.1 },
    { n: 7, W: 1200, H: 1700, t: 45, timber: 'softwood', nV: 6, nH: 6, top: 25.2, bottom: 22.8, itemLb: 116.6 },
    { n: 8, W: 1200, H: 1700, t: 45, timber: 'utile',    nV: 6, nH: 6, top: 27.4, bottom: 25.6, itemLb: 128.8 },
    { n: 9, W: 1200, H: 1700, t: 45, timber: 'utile',    nV: 0, nH: 6, top: 26.0, bottom: 25.6, itemLb: 125.4 },
  ]

  for (const row of ROWS) {
    it(`row ${row.n}: ${row.W}x${row.H} t${row.t} ${row.timber} bars ${row.nV}v/${row.nH}h → ${row.top} / ${row.bottom} kg, ${row.itemLb} lb`, () => {
      const { top, bot, itemLb } = measuredWeights(row)
      expect.soft(Math.abs(top - row.top), `top sash: model ${top.toFixed(3)} vs Integrate ${row.top}`).toBeLessThanOrEqual(0.1)
      expect.soft(Math.abs(bot - row.bottom), `bottom sash: model ${bot.toFixed(3)} vs Integrate ${row.bottom}`).toBeLessThanOrEqual(0.1)
      expect.soft(Math.abs(itemLb - row.itemLb), `item lb: model ${itemLb?.toFixed(2)} vs Integrate ${row.itemLb}`).toBeLessThanOrEqual(0.2)
    })
  }
})

describe('Step W — row 11: the horn is NOT in the weight', () => {
  it('row 11 (no horn) weighs exactly the same as row 10 (Victorian 75)', () => {
    const base = { W: 1200, H: 1699, t: 50, timber: 'softwood', nV: 0, nH: 0, outerCode: 'GLACL' }
    const r10 = measuredWeights({ ...base, topHorn: 'victorian' })
    const r11 = measuredWeights({ ...base, topHorn: 'none' })
    expect(r11.top).toBe(r10.top)
    expect(r11.bot).toBe(r10.bot)
    expect(r11.itemLb).toBe(r10.itemLb)
  })
})

describe('Step W — row 10: KNOWN OPEN QUESTION (6.8mm Acoustic Laminated)', () => {
  // Integrate measured 26.8 / 28.0 kg and 132.6 lb for this row. The 6.8 mm
  // laminated pane behaves like about 6.0 mm of glass in Integrate. The
  // model uses the catalogue thickness as-is (6.8), giving ~28.5 / ~29.7 kg
  // — about 1.7 kg per sash over. NOT fitted (brief §6); these assertions
  // pin what the model currently produces so any change is visible.
  it('model output with the catalogue 6.8mm thickness (does NOT match Integrate — open question)', () => {
    const r10 = measuredWeights({ W: 1200, H: 1699, t: 50, timber: 'softwood', nV: 0, nH: 0, outerCode: 'GLACL' })
    expect(r10.top).toBeCloseTo(28.47, 1)
    expect(r10.bot).toBeCloseTo(29.66, 1)
    // Integrate's measured figures, for the record:
    expect(Math.abs(r10.top - 26.8)).toBeGreaterThan(1)   // unexplained gap
    expect(Math.abs(r10.bot - 28.0)).toBeGreaterThan(1)   // unexplained gap
  })
})
