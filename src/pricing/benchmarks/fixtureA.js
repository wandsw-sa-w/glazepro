/**
 * fixtureA.js
 * Benchmark A — Sash replacement (L31115 Item 1, Drawing 4).
 * New pair of sashes into existing box frame.
 *
 * From docs/integrate-benchmarks-stage4.txt:
 *   Total cost £728.26   Total price £1,408.66
 */

import INTEGRATE_TARGETS from './integrate-targets.json'

// ── Part cost map ────────────────────────────────────────────────────────────
const PART_COST_MAP = {
  TP01: 2.59,   // Small staff bead 20x15 Redwood £2.59/m
  TP02: 2.95,   // Large staff bead 25x15 Redwood £2.95/m
  TP03: 2.22,   // Standard parting bead 8x25 Redwood £2.22/m
}

// ── Fixture tree ─────────────────────────────────────────────────────────────
// Spec: Box Sash Window | New Pair of Sashes | Supply & Install
// Sash width 900 | Sash height 1700 | Sash thickness 45
// Top horn Victorian | Bottom horn None
// Glazing bar "22 with 4 Nib" (bars on one sash only: one glass unit prices bars)
// Both sashes Solid Redwood, both cord hung
// Inner glass 4mm Clear Pilkington K Toughened, Outer glass 4mm Clear Toughened
// White Warm Edge spacer, Argon filled
// Ironmongery PB, 1x Claw Fastener Ironmongery Set without Pulleys
// Finish Teknos Spray Finish Clean White (int/ext/cill) | Surround None
// Installed Internally | Third floor | Easily accessible | Not dormer
// Lead weights, 40mm diameter

const TREE = {
  key: 'item1',
  part_type: 'drawingItemPart',
  values: {
    typeOfWork:          'new_pair_of_sashes',
    frameMaterialId:     'softwood',
    sashMaterialId:      'softwood',
    cillMaterialId:      'utile',
    fitToPreparedOpening: false,
    decoration:          false,
    floorLevel:          'third_floor',
    staffBeadTypeId:     'small',
    bayFullyCoupledFrames: false,
    frameInKitForm:      false,
    bayPoleRequired:     false,
  },
  children: [
    {
      key: 'paint1',
      part_type: 'paintAndIronmongeryPart',
      values: {
        internalFinish:    'clean_white',
        externalFinish:    'clean_white',
        cillFinish:        'clean_white',
        cutOutBrickReveal: false,
        ironmongeryFinish: 'PB',
        ironmongeryLines: [
          { product_short_name: 'z-claw_fastener_kit_wopulleys', finish_code: 'PB', qty: 1, source: 'default' },
        ],
      },
      children: [],
    },
    {
      key: 'notes1',
      part_type: 'notesPart',
      values: {
        installationMethod: 'internally',
      },
      children: [],
    },
    {
      key: 'frame1',
      part_type: 'assemblyFramePart',
      values: {
        // OVERALL frame 1070 x 1849 — read from Integrate's drawing labels
        // (docs/step-v-geometry-brief.md): sash width 900 = 1070 − 85 − 85,
        // overall sash height 1700 = 1849 − 79 − 70. The previous
        // outerWidth 1102 was a guess and was wrong.
        width:          1070,
        height:         1849,
        // ASSUMPTION: profile defaults for rail/jamb sizes
        topHeight:      79,
        leftWidth:      85,
        rightWidth:     85,
        frameDepth:     165,
        jambType:       'solid_profiled',
        leftOuterJamb:  101,
        rightOuterJamb: 101,
        leftCillHorn:   50,
        rightCillHorn:  50,
        rakeFrame:      false,
        archHead:       false,
      },
      children: [
        {
          key: 'cill1',
          part_type: 'cillPart',
          values: {
            // ASSUMPTION: profile defaults (same as L34046)
            height: 70,
            depth:  200,
            profiledHeight: 45,
          },
          children: [],
        },
        {
          key: 'pair1',
          part_type: 'sashPairPart',
          values: {
            sashThickness:             45,
            midrailHeight:             40,
            // Integrate's drawn sash width is 900 = 1070 − 170: NO side
            // clearance on this drawing (step-v brief evidence table)
            mechanicalClearanceLeft:   0,
            mechanicalClearanceRight:  0,
            mechanicalClearanceTop:    0,
            mechanicalClearanceBottom: 0,
            topHornTypeShortName:    'victorian',
            topHornLength:           75,  // Integrate drawing label (step-w brief §3); not in the weight
            bottomHornTypeShortName: 'none',
            sashSplit:               'half_half',
            // Sash lip: meeting-rail overhang included in Integrate's
            // gross_sash_height_in_mm. 8mm is the standard profile default.
            sashLip:                 8,
          },
          children: [
            {
              key: 'top1',
              part_type: 'topSashPart',
              values: {
                topHeight:    49,
                // Stile 49 — read from Integrate's drawing (step-w brief §3). NOTE:
                // Integrate's own stage-4 Glazing Bead qty (3.12) back-computes to a
                // 50.75 pricing stile — drawn 49 vs priced 50.75 is reported, not fudged.
                leftWidth:    49,
                rightWidth:   49,
                operation:    'cord_hung',
                toBeReplaced: true,  // sash replacement: both sashes replaced
                archHead:     false,
              },
              children: [
                {
                  key: 'glass1',
                  part_type: 'glassPart',
                  values: {
                    glazingId:            'double_glazing',
                    isIndividualPanes:    false,
                    spacerDimId:          'spacer_16',
                    spacerColourId:       'white_warm_edge',
                    internalGlassPartNo:  'GL100010',
                    externalGlassPartNo:  'GL100080',
                  },
                  // Glazing bars: "22 with 4 Nib" — one unit prices bars.
                  // This sash has the bars: 2 vertical + 1 horizontal = 3 bars,
                  // stored as child parts the way real drawings store them.
                  // Integrate shows unit_gb_qty on this unit drives the
                  // "Square Glass Multiple GB" rule.
                  children: [
                    { key: 'glass1_vb1', part_type: 'verticalGlazingBarPart',   values: {}, children: [] },
                    { key: 'glass1_vb2', part_type: 'verticalGlazingBarPart',   values: {}, children: [] },
                    { key: 'glass1_hb1', part_type: 'horizontalGlazingBarPart', values: {}, children: [] },
                  ],
                },
              ],
            },
            {
              key: 'bot1',
              part_type: 'bottomSashPart',
              values: {
                bottomHeight: 88,
                leftWidth:    49,
                rightWidth:   49,
                operation:    'cord_hung',
                toBeReplaced: true,  // sash replacement: both sashes replaced
                archHead:     false,
              },
              children: [
                {
                  key: 'glass2',
                  part_type: 'glassPart',
                  values: {
                    glazingId:            'double_glazing',
                    isIndividualPanes:    false,
                    spacerDimId:          'spacer_16',
                    spacerColourId:       'white_warm_edge',
                    internalGlassPartNo:  'GL100010',
                    externalGlassPartNo:  'GL100080',
                  },
                  // No bars on this sash
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

// ── Targets ──────────────────────────────────────────────────────────────────
// Integrate targets — DO NOT EDIT to match GlazePro output.
// See src/pricing/benchmarks/integrate-targets.json.
const TARGETS = {
  // Totals and group targets come from integrate-targets.json — the single
  // Integrate fact file. DO NOT EDIT to match GlazePro output.
  ...INTEGRATE_TARGETS.benchmarkA,
  // Per-line targets from benchmark file
  lines: [
    // Glass _ Done
    { group: 'glass_done', name: 'Square Glass Cost',           qty: 0.65, value: 58.50, cost: 38.03, markup: 2.00, price: 76.05, note: 'x2 units' },
    { group: 'glass_done', name: 'Square Glass Multiple GB',    qty: 0.65, value: 29.20, cost: 18.98, markup: 2.00, price: 37.96, note: 'one unit' },
    { group: 'glass_done', name: 'All Glass Energy Surcharge',  qty: 13.00, value: 0.17, cost: 2.21, markup: 2.00, price: 4.42, note: 'x2 units' },
    // Installation Materials
    { group: 'installation_materials', name: 'Ironmongery: Claw Fastener Kit', qty: 13.65, value: 1.00, cost: 13.65, markup: 2.00, price: 27.30 },
    { group: 'installation_materials', name: 'Component: Small staff bead width', qty: 2.59, value: 2.00, cost: 5.18, markup: 2.00, price: 10.36 },
    { group: 'installation_materials', name: 'Component: Small staff bead height', qty: 2.59, value: 3.60, cost: 9.32, markup: 2.00, price: 18.65 },
    { group: 'installation_materials', name: 'Component: Standard parting bead height', qty: 2.22, value: 3.60, cost: 7.99, markup: 2.00, price: 15.98 },
    { group: 'installation_materials', name: 'Component: Standard parting bead width', qty: 2.22, value: 1.00, cost: 2.22, markup: 2.00, price: 4.44 },
    { group: 'installation_materials', name: 'Lead Weight (top)',    qty: 19.78, value: 2.41, cost: 47.67, markup: 1.50, price: 71.50 },
    { group: 'installation_materials', name: 'Lead Weight (bottom)', qty: 19.90, value: 2.41, cost: 47.95, markup: 1.50, price: 71.92 },
    // Manufacture
    { group: 'manufacture', name: 'Production Time', qty: 10.93, value: 24.66, cost: 269.53, markup: 2.00, price: 539.07 },
    // Labour
    { group: 'labour', name: 'Labour', qty: 4.75, value: 40.21, cost: 191.00, markup: 2.00, price: 382.00 },
    // Manufacture Materials
    { group: 'manufacture_materials', name: 'Laminated Softwood (bottom)', qty: 2.36, value: 4.95, cost: 11.68, markup: 2.00, price: 23.35 },
    { group: 'manufacture_materials', name: 'Laminated Softwood (top)',    qty: 1.92, value: 4.95, cost:  9.49, markup: 2.00, price: 18.98 },
    { group: 'manufacture_materials', name: 'Glazing Bead for Sashes',     qty: 3.13, value: 1.39, cost:  4.35, markup: 2.00, price:  8.69, note: 'x2 sashes' },
    { group: 'manufacture_materials', name: 'Glazing Bar',                 qty: 2.40, value: 1.84, cost:  4.42, markup: 2.00, price:  8.83, note: 'one unit' },
  ],
  // Rules that must NOT fire
  must_not_fire: [
    'Installation Consumables',
    'Steel Weight',
    'Box Frame Staff Bead',
    'Box Frame Parting Bead',
  ],
  // Production time and installation time
  production_hours: 10.93,
  installation_hours: 4.75,
}

// ── Assumptions ──────────────────────────────────────────────────────────────
const ASSUMPTIONS = [
  'Inner frame dimensions: 900 x 1700 mm (from spec "Sash width" x "Sash height")',
  'Outer frame: 1102 x 1849 mm (derived: inner + 2*outerJamb width, inner + head + cill)',
  'Stile width: 49 mm (Integrate drawing label, step-w brief; stage-4 bead qty implies 50.75 in pricing — reported discrepancy)',
  'Top rail: 49 mm, bottom rail: 88 mm, midrail: 40 mm (profile defaults)',
  'Cill: height 70mm, profiledHeight 45mm, depth 200mm (profile defaults)',
  'Frame depth: 165 mm, outerJamb: 101 mm (profile defaults)',
  'Horn lengths: victorian=70mm (pricingEngine), victorian=50mm (sashWeight)',
  'Sash lip: 8mm (meeting-rail overhang, standard profile default)',
  'Glazing bars: 2 wide + 1 high on top sash only, none on bottom sash',
  'Ironmongery: Claw Fastener Kit without Pulleys, PB finish',
  'Sash weights: lead, 40mm — target 17.2 kg top, 17.3 kg bottom; engine produces ~17.4/17.9 (sashWeight geometry mismatch)',
  'Glazing Bead qty: target 3.13, engine gives 3.12; 5mm sightline sum gap (1560 vs ~1565mm), likely different stile/sightline convention in Integrate',
]

// ── Ironmongery fixture data ─────────────────────────────────────────────────
// Benchmark A: 1 x Claw Fastener Kit without Pulleys, PB finish.
// The default_ironmongery rules allocate product_short_name based on conditions.
// This fixture provides the pre-resolved ironmongery lines and catalogue
// so the engine can price them without the DB.
const IRONMONGERY_LINES = [
  { product_short_name: 'z-claw_fastener_kit_wopulleys', finish_code: 'PB', qty: 1, source: 'default' },
]

const IRONMONGERY_CATALOGUE = {
  'z-claw_fastener_kit_wopulleys:PB': {
    cost: 13,   // round(13*1, 0) * 1.05 = 13 * 1.05 = 13.65
    parts: [],  // kit lines not broken out; cost used directly
  },
}

const PROFILE_VALUES = {
  defaultDoubleGlazingRebateWidthForSash: 14,
  defaultDoubleGlazingTolerance: 2,
}

export const BENCHMARK_A = {
  name:   'Benchmark A — Sash replacement (L31115 Item 1)',
  tree:   TREE,
  targets: TARGETS,
  partCostMap: PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  ironmongeryLines: IRONMONGERY_LINES,
  ironmongeryCatalogue: IRONMONGERY_CATALOGUE,
  assumptions: ASSUMPTIONS,
}
