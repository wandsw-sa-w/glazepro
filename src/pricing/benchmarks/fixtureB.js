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
    typeOfWork:          'draught_seal',   // Integrate: draughtseal true, NOT newSashes
    // Step AG: Integrate's saved drawing stores NO frame material
    // (docs/integrate-L31115-A-B-trees.txt) — frameMaterialId removed.
    // sashMaterialId 38 = Solid Redwood; cillMaterialId 44 (utile) is on
    // Integrate's CillPart, GlazePro's real key is item-level.
    sashMaterialId:      'softwood',
    cillMaterialId:      'utile',
    fitToPreparedOpening: false,
    decoration:          false,
    floorLevel:          'first_floor',    // stage-4 fact file (facts line 22)
    staffBeadTypeId:     'small',
    partingBeadTypeId:   'standard',       // Integrate: partingBeadTypeId 280
    bayFullyCoupledFrames: false,
    frameInKitForm:      false,
    bayPoleRequired:     false,
  },
  children: [
    {
      key: 'paint1',
      part_type: 'paintAndIronmongeryPart',
      values: {
        // Step AG: Integrate's finish is "Affected areas will be primed
        // only" (int/ext/cill). GlazePro's six paint_finish codes have no
        // primed-only option, so the finishes are left UNSET (the engine
        // defaults to clean_white; no fired B line reads them) — listed
        // in the step-ag report, not silently mapped.
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
        // Step AG: the rest is Integrate's saved drawing (step-ag facts):
        // head 79, bottom 70, jambs 85/85, frameDepth 140, hollow box,
        // stop sizes 16/16/16. No outer jamb extensions, no cill horns
        // (the old 101/50 were assumptions).
        topHeight:      79,
        bottomHeight:   70,
        leftWidth:      85,
        rightWidth:     85,
        frameDepth:     140,
        jambType:       'hollow_box_for_sash',   // Integrate 'hollow_box'
        frameHeadStopSize:  16,
        frameStileStopSize: 16,
        cillStopSize:       16,
        rakeFrame:      false,
        archHead:       false,
      },
      children: [
        {
          key: 'cill1',
          part_type: 'cillPart',
          values: {
            // Integrate CillPart: height 70, depth 140 (step-ag facts);
            // profiledHeight is not a stored Integrate field — removed.
            height: 70,
            depth:  140,
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
            // Step AG facts: top horn victorian_style_horn 75, bottom
            // no_horn (the old none/none was an assumption). The invented
            // sashLip: 8 is removed — not a stored Integrate field.
            topHornTypeShortName:    'victorian',
            topHornLength:           75,
            bottomHornTypeShortName: 'no_horn',
            bottomHornLength:        0,
            sashSplit:               'half_half',
          },
          children: [
            {
              key: 'top1',
              part_type: 'topSashPart',
              values: {
                topHeight:    49,
                // Step AG facts: stiles 49 (the old 50.75 "47 + lip" was
                // an assumption)
                leftWidth:    49,
                rightWidth:   49,
                operation:    'cord_hung',
                toBeReplaced: false,   // Integrate: not to be replaced
                archHead:     false,
              },
              children: [
                {
                  // Step AG facts: Integrate's saved DSO drawing DOES store
                  // glass on both sashes (GL100010 / GL100080, no bars).
                  // Only the cited fields: two pane codes = double glazed;
                  // no spacer values are in the read.
                  key: 'glassB_t',
                  part_type: 'glassPart',
                  values: {
                    glazingId:            'double_glazing',
                    internalGlassPartNo:  'GL100010',
                    externalGlassPartNo:  'GL100080',
                  },
                  children: [],
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
                toBeReplaced: false,   // Integrate: not to be replaced
                archHead:     false,
                // Step AG facts: chamfered bottom rail 9°
                btmRailShapeId: 'chamfered',
                chamferedBottomRailAngle: 9,
              },
              children: [
                {
                  key: 'glassB_b',
                  part_type: 'glassPart',
                  values: {
                    glazingId:            'double_glazing',
                    internalGlassPartNo:  'GL100010',
                    externalGlassPartNo:  'GL100080',
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
    // 'Production Time' removed (Step AE item 3): its rule condition is
    // literally "true" in Integrate's own file, so it FIRES at qty 0 on a
    // draught seal — Integrate just doesn't display 0.00 lines. The
    // production_hours: 0 target below still asserts the truth.
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
    // 'Production Time' removed (Step AE item 3) — fires at qty 0, see above
    'Installation Consumables',
  ],
  production_hours: 0,
  installation_hours: 4.00,
}

// ── Assumptions ──────────────────────────────────────────────────────────────
// Step AG: the tree is now Integrate's own saved drawing
// (docs/integrate-L31115-A-B-trees.txt).
const ASSUMPTIONS = [
  'Geometry/frame/cill/horns/stiles 49/chamfer 9°/glass codes: Integrate saved drawing, step-ag facts — no longer assumptions',
  'NOT STORABLE in GlazePro (left out): range Standard; installByUs; installationLevel "standard"; cill width 950 (derived); finishes "Affected areas will be primed only" (no primed-only paint_finish code — left unset, engine defaults clean_white, no fired B line reads them); surround auto-calc off flag',
  'Integrate stores NO frame material — frameMaterialId removed; cillMaterialId utile cited from Integrate CillPart (44)',
  'Ironmongery PB Brighton fastener kit: stage-4 spec; DSO Extra Profits qty = sliding_sash_qty − fixed = 2, markup 55',
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

// ── New cill variants (Step AM) ──────────────────────────────────────────────
// Facts: docs/integrate-L31115-cill.txt. Integrate charges the same cill
// block on all three cill benchmarks — a Cill Replacement line 1.00 -> 200.00
// (extra_profits, markup 200) and 2.50 h of install labour ("Hardwood Cill
// Replacement", 150 min) — and NO cill timber, because the Box Frame Utile
// Cill rule only fires when the frame is replaced.
//
//   H = B + New Cill (first floor), L31115 Item 2 Drawing 13. Labour 6.50 h
//       (B's 4.00 + 2.50). Corrected target 309.86 / 923.70 = B corrected
//       208.33 / 522.65 + the cill block 101.53 / 401.05. Integrate's own
//       (uncorrected) figure is 335.32 / 974.60, which is B uncorrected
//       233.79 / 573.55 + the same cill block — reported, not asserted, the
//       way BENCHMARK_B_UNCORRECTED is.
//   I = a stand-alone cill, L31115 Item 2 Drawing 14: B's tree with type of
//       work cill_only, the sashes NOT replaced and New Cill. Integrate
//       stores every item flag false and calls it "Other". Expected lines:
//       Labour 2.50 h (100.53 / 201.05) and Cill Replacement 1.00 / 200.00
//       only — no DSO rate, no DSO extra profits, no ironmongery, no
//       staff/parting beads, no installation consumables. Corrected target
//       101.53 / 401.05; Integrate's own figure 126.99 / 451.95 includes the
//       three S4 lines (deliberate difference 1).

function newCillTree({ typeOfWork = null } = {}) {
  const tree = JSON.parse(JSON.stringify(TREE))
  if (typeOfWork) tree.values.typeOfWork = typeOfWork
  const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
  const cill  = frame.children.find(c => c.part_type === 'cillPart')
  cill.values.repair = 'new_cill'            // Integrate cillRepairId 2
  cill.values.isBrickToBrickCill = false
  return tree
}

const CILL_BLOCK_NOTE =
  'Integrate’s cill block, identical on G/H/I: Cill Replacement 1.00 → 200.00 and 2.50 h install labour; no cill timber (docs/integrate-L31115-cill.txt)'

export const BENCHMARK_H = {
  name:   'Benchmark H — Draught seal + new cill (L31115 Item 2 Drawing 13, corrected)',
  tree:   newCillTree(),
  targets: { ...INTEGRATE_TARGETS.benchmarkH_draught_seal_new_cill_corrected },
  glassCatalogue: {},
  partCostMap: PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  ironmongeryLines: IRONMONGERY_LINES,
  ironmongeryCatalogue: IRONMONGERY_CATALOGUE,
  assumptions: [
    ...ASSUMPTIONS,
    'Derived from benchmark B: cill Repair = New Cill — the only field Integrate changed on the copy',
    CILL_BLOCK_NOTE,
    'Integrate’s own figure is 335.32 / 974.60; the corrected target 309.86 / 923.70 removes the three S4 lines (deliberate difference 1), exactly as for B',
  ],
}

export const BENCHMARK_I = {
  name:   'Benchmark I — Stand-alone cill replacement (L31115 Item 2 Drawing 14, corrected)',
  tree:   newCillTree({ typeOfWork: 'cill_only' }),
  targets: { ...INTEGRATE_TARGETS.benchmarkI_cill_only_corrected },
  glassCatalogue: {},
  partCostMap: PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  // No ironmongery: a stand-alone cill is not a draught seal, so Integrate
  // prices no fastener kit. B's stored lines are deliberately NOT carried
  // over (the tree's own paintAndIronmongeryPart lines are dropped below).
  ironmongeryCatalogue: IRONMONGERY_CATALOGUE,
  assumptions: [
    ...ASSUMPTIONS,
    'Derived from benchmark B: type of work cill_only (Integrate: every item flag false, summary "Other"), sashes not replaced, cill Repair = New Cill',
    CILL_BLOCK_NOTE,
    'Integrate’s own figure is 126.99 / 451.95; the corrected target 101.53 / 401.05 removes the three S4 lines (deliberate difference 1)',
  ],
}

// A stand-alone cill sells no ironmongery: Integrate's I has no fastener kit
// line (its default_ironmongery rule needs needs_draughtsealing). B's tree
// carries a stored Brighton kit line, so it is removed here — a stored line
// would otherwise price regardless of the type of work (Step Z resolution).
;(function stripIronmongeryLines(tree) {
  const paint = tree.children.find(c => c.part_type === 'paintAndIronmongeryPart')
  if (paint?.values?.ironmongeryLines) paint.values.ironmongeryLines = []
})(BENCHMARK_I.tree)
