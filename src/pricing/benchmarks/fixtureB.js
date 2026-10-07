/**
 * fixtureB.js
 * Benchmark B — Draught seal and overhaul (L31115 Item 2, Drawing 12).
 *
 * From docs/integrate-benchmarks-stage4.txt:
 *   Total cost £233.79   Total price £573.55  (with Integrate error)
 *   Corrected:  £208.33 cost / £522.65 price  (after S4 fix)
 *
 * Two versions exported:
 *   BENCHMARK_B             — corrected (S4: sash material rules gated by to_be_replaced)
 *   BENCHMARK_B_UNCORRECTED — matches Integrate exactly (with the three erroneous lines)
 */

import INTEGRATE_TARGETS from './integrate-targets.json'

// ── Part cost map ────────────────────────────────────────────────────────────
const PART_COST_MAP = {
  TP01: 2.59,   // Small staff bead 20x15 Redwood £2.59/m
  TP02: 2.95,   // Large staff bead 25x15 Redwood £2.95/m
  TP03: 2.22,   // Standard parting bead 8x25 Redwood £2.22/m
}

// ── Fixture tree ─────────────────────────────────────────────────────────────
// Spec: Box Sash Window | Draughtseal | Supply & Install
// Range Standard Sash | Material Softwood with Hardwood Cill | Sash material Solid Redwood
// Staff bead Small | Frame 950 wide x 1032 high | Sash thickness 45
// Both sashes Cord Hung | No glass specified | Sash weights none (0 kg)
// Ironmongery PB, 1 x Brighton fastener kit without pulleys
// Finish: Affected areas will be primed only (int/ext/cill) | Surround None
// Installed Internally | First floor | Easily accessible | Not dormer

const TREE = {
  key: 'item1',
  part_type: 'drawingItemPart',
  values: {
    typeOfWork:          'draught_seal',
    frameMaterialId:     'softwood',
    sashMaterialId:      'softwood',
    cillMaterialId:      'utile',
    fitToPreparedOpening: false,
    decoration:          false,
    floorLevel:          'first_floor',
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
        // "Affected areas will be primed only" = clean_white (base finish)
        internalFinish:    'clean_white',
        externalFinish:    'clean_white',
        cillFinish:        'clean_white',
        cutOutBrickReveal: false,
        ironmongeryFinish: 'PB',
        ironmongeryLines: [
          { product_short_name: 'z-brighton_fastener_kit_wpulleys', finish_code: 'PB', qty: 1, source: 'default' },
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
        // OVERALL frame 1120 x 1181 — read from Integrate's drawing labels
        // (docs/step-v-geometry-brief.md): sash width 950 = 1120 − 85 − 85,
        // overall sash height 1032 = 1181 − 79 − 70.
        // frame_area = round(1.120 * 1.181, 2) = 1.32 m2
        width:          1120,
        height:         1181,
        // ASSUMPTION: profile defaults for frame geometry
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
            // Integrate's drawn sash width is 950 = 1120 − 170: NO side
            // clearance on this drawing (step-v brief evidence table)
            mechanicalClearanceLeft:   0,
            mechanicalClearanceRight:  0,
            mechanicalClearanceTop:    0,
            mechanicalClearanceBottom: 0,
            // ASSUMPTION: no horns specified for DSO; default none/none
            topHornTypeShortName:    'none',
            bottomHornTypeShortName: 'none',
            sashSplit:               'half_half',
            sashLip:                 8,
          },
          children: [
            {
              key: 'top1',
              part_type: 'topSashPart',
              values: {
                topHeight:    49,
                leftWidth:    50.75,
                rightWidth:   50.75,
                operation:    'cord_hung',
                toBeReplaced: false,   // DSO: sashes are NOT replaced
                archHead:     false,
              },
              children: [
                // No glass specified for DSO
              ],
            },
            {
              key: 'bot1',
              part_type: 'bottomSashPart',
              values: {
                bottomHeight: 88,
                leftWidth:    50.75,
                rightWidth:   50.75,
                operation:    'cord_hung',
                toBeReplaced: false,   // DSO: sashes are NOT replaced
                archHead:     false,
              },
              children: [
                // No glass specified for DSO
              ],
            },
          ],
        },
      ],
    },
  ],
}

// ── Targets (CORRECTED — after S4 fix) ───────────────────────────────────────
const TARGETS = {
  // Totals and group targets come from integrate-targets.json — the single
  // Integrate fact file. DO NOT EDIT to match GlazePro output.
  ...INTEGRATE_TARGETS.benchmarkB_corrected,
  lines: [
    // Extra Services
    { group: 'extra_services', name: 'DSO SqM Rate', qty: 1.32, value: 10.00, cost: 13.20, markup: 2.00, price: 26.40 },
    // Installation Materials
    { group: 'installation_materials', name: 'Ironmongery: Brighton Fastener Kit', qty: 12.60, value: 1.00, cost: 12.60, markup: 2.00, price: 25.20 },
    { group: 'installation_materials', name: 'Component: Small staff bead width', qty: 2.59, value: 2.20, cost: 5.70, markup: 2.00, price: 11.40 },
    { group: 'installation_materials', name: 'Component: Small staff bead height', qty: 2.59, value: 2.40, cost: 6.22, markup: 2.00, price: 12.43 },
    { group: 'installation_materials', name: 'Component: Standard parting bead width', qty: 2.22, value: 1.10, cost: 2.44, markup: 2.00, price: 4.88 },
    { group: 'installation_materials', name: 'Component: Standard parting bead height', qty: 2.22, value: 2.40, cost: 5.33, markup: 2.00, price: 10.66 },
    // Labour
    { group: 'labour', name: 'Labour', qty: 4.00, value: 40.21, cost: 160.84, markup: 2.00, price: 321.68 },
    // Extra Profits
    { group: 'extra_profits', name: 'DSO Extra Profits', qty: 2.00, value: 1.00, cost: 2.00, markup: 55.00, price: 110.00 },
  ],
  must_not_fire: [
    'Square Glass Cost',
    'Square Glass Multiple GB',
    'All Glass Energy Surcharge',
    'Lead Weight',
    'Steel Weight',
    'Production Time',
    'Installation Consumables',
    'Laminated Softwood for Sashes',
    'Glazing Bead for Sashes',
  ],
  production_hours: 0,
  installation_hours: 4.00,
}

// ── Targets (UNCORRECTED — matches Integrate with the three erroneous lines) ─
const TARGETS_UNCORRECTED = {
  // Totals and group targets come from integrate-targets.json — the single
  // Integrate fact file. DO NOT EDIT to match GlazePro output.
  ...INTEGRATE_TARGETS.benchmarkB_uncorrected,
  lines: [
    // Extra Services
    { group: 'extra_services', name: 'DSO SqM Rate', qty: 1.32, value: 10.00, cost: 13.20, markup: 2.00, price: 26.40 },
    // Installation Materials
    { group: 'installation_materials', name: 'Ironmongery: Brighton Fastener Kit', qty: 12.60, value: 1.00, cost: 12.60, markup: 2.00, price: 25.20 },
    { group: 'installation_materials', name: 'Component: Small staff bead width', qty: 2.59, value: 2.20, cost: 5.70, markup: 2.00, price: 11.40 },
    { group: 'installation_materials', name: 'Component: Small staff bead height', qty: 2.59, value: 2.40, cost: 6.22, markup: 2.00, price: 12.43 },
    { group: 'installation_materials', name: 'Component: Standard parting bead width', qty: 2.22, value: 1.10, cost: 2.44, markup: 2.00, price: 4.88 },
    { group: 'installation_materials', name: 'Component: Standard parting bead height', qty: 2.22, value: 2.40, cost: 5.33, markup: 2.00, price: 10.66 },
    // Labour
    { group: 'labour', name: 'Labour', qty: 4.00, value: 40.21, cost: 160.84, markup: 2.00, price: 321.68 },
    // Manufacture Materials (INTEGRATE ERROR: these fire on DSO even though no sash is made)
    { group: 'manufacture_materials', name: 'Laminated Softwood (bottom)', qty: 2.09, value: 4.95, cost: 10.33, markup: 2.00, price: 20.66 },
    { group: 'manufacture_materials', name: 'Laminated Softwood (top)',    qty: 1.62, value: 4.95, cost:  8.01, markup: 2.00, price: 16.02 },
    { group: 'manufacture_materials', name: 'Glazing Bead for Sashes',     qty: 2.56, value: 1.39, cost:  3.56, markup: 2.00, price:  7.11, note: 'INTEGRATE ERROR: fires without to_be_replaced' },
    // Extra Profits
    { group: 'extra_profits', name: 'DSO Extra Profits', qty: 2.00, value: 1.00, cost: 2.00, markup: 55.00, price: 110.00 },
  ],
  must_not_fire: [
    'Square Glass Cost',
    'Square Glass Multiple GB',
    'All Glass Energy Surcharge',
    'Lead Weight',
    'Steel Weight',
    'Production Time',
    'Installation Consumables',
  ],
  production_hours: 0,
  installation_hours: 4.00,
}

// ── Assumptions ──────────────────────────────────────────────────────────────
const ASSUMPTIONS = [
  'Frame dimensions: 950 x 1032 mm (internal opening from spec)',
  'Outer frame: 1120 x 1181 mm (derived: inner + leftWidth + rightWidth, inner + head + cill)',
  'frame_area = round(1.120 * 1.181, 2) = 1.32 m2',
  'Stile width: 50.75 mm (profile default: 47mm + 3.75mm lip)',
  'Top rail: 49 mm, bottom rail: 88 mm, midrail: 40 mm (profile defaults)',
  'Cill: height 70mm, profiledHeight 45mm (profile defaults)',
  'Horn type: none/none (not specified in DSO)',
  'No glass, no manufacture group, no weights',
  'Ironmongery: Brighton Fastener Kit without Pulleys, PB finish',
  'DSO Extra Profits: qty = sliding_sash_qty - fixed_sliding_sash_qty = 2, markup = 55',
]

// ── Ironmongery fixture data ─────────────────────────────────────────────────
// Benchmark B: 1 x Brighton Fastener Kit without Pulleys, PB finish.
const IRONMONGERY_LINES = [
  { product_short_name: 'z-brighton_fastener_kit_wpulleys', finish_code: 'PB', qty: 1, source: 'default' },
]

const IRONMONGERY_CATALOGUE = {
  'z-brighton_fastener_kit_wpulleys:PB': {
    cost: 12,   // round(12*1, 0) * 1.05 = 12 * 1.05 = 12.60
    parts: [],
  },
}

// DSO has no glass, but profileValues supplied for consistency
const PROFILE_VALUES = {
  defaultDoubleGlazingRebateWidthForSash: 14,
  defaultDoubleGlazingTolerance: 2,
}

export const BENCHMARK_B = {
  name:   'Benchmark B — Draught seal (L31115 Item 2, corrected)',
  tree:   TREE,
  targets: TARGETS,
  glassCatalogue: {},
  partCostMap: PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  ironmongeryLines: IRONMONGERY_LINES,
  ironmongeryCatalogue: IRONMONGERY_CATALOGUE,
  assumptions: ASSUMPTIONS,
}

export const BENCHMARK_B_UNCORRECTED = {
  name:   'Benchmark B — Draught seal (L31115 Item 2, uncorrected / Integrate match)',
  tree:   TREE,
  targets: TARGETS_UNCORRECTED,
  glassCatalogue: {},
  partCostMap: PART_COST_MAP,
  ironmongeryLines: IRONMONGERY_LINES,
  ironmongeryCatalogue: IRONMONGERY_CATALOGUE,
  assumptions: ASSUMPTIONS,
}
