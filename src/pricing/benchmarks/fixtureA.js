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
    typeOfWork:          'new_pair_of_sashes',   // Integrate: newSashes true
    // Step AG: Integrate's saved drawing stores NO frame material on a sash
    // replacement (docs/integrate-L31115-A-B-trees.txt) — frameMaterialId
    // removed. sashMaterialId 38 = Solid Redwood; cillMaterialId 44 (utile)
    // is stored on Integrate's CillPart, GlazePro's real key is item-level.
    sashMaterialId:      'softwood',
    cillMaterialId:      'utile',
    fitToPreparedOpening: false,
    decoration:          false,
    floorLevel:          'third_floor',          // Integrate item location: Third Floor Front Living Room
    staffBeadTypeId:     'small',
    partingBeadTypeId:   'standard',             // Integrate: partingBeadTypeId 280
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
        // Step AG: the rest of the frame is now Integrate's saved drawing
        // (docs/integrate-L31115-A-B-trees.txt): head 79, bottom 70, jambs
        // 85/85, frameDepth 140, hollow box, stop sizes 16/16 and CILL
        // STOP 20 (unlike every other benchmark's 16). No outer jamb
        // extensions and no cill horns (all 0 in Integrate — the old 101
        // and 50 were assumptions).
        topHeight:      79,
        bottomHeight:   70,
        leftWidth:      85,
        rightWidth:     85,
        frameDepth:     140,
        jambType:       'hollow_box_for_sash',   // Integrate 'hollow_box'
        frameHeadStopSize:  16,
        frameStileStopSize: 16,
        cillStopSize:       20,
        rakeFrame:      false,
        archHead:       false,
      },
      children: [
        {
          key: 'cill1',
          part_type: 'cillPart',
          values: {
            // Integrate CillPart: height 70, depth 140 (step-ag facts).
            // profiledHeight is not a stored Integrate field — removed
            // (the old depth 200 / profiledHeight 45 were assumptions).
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
            // Integrate's drawn sash width is 900 = 1070 − 170: NO side
            // clearance on this drawing (step-v brief evidence table)
            mechanicalClearanceLeft:   0,
            mechanicalClearanceRight:  0,
            mechanicalClearanceTop:    0,
            mechanicalClearanceBottom: 0,
            topHornTypeShortName:    'victorian',  // Integrate victorian_style_horn 75
            topHornLength:           75,
            bottomHornTypeShortName: 'no_horn',    // Integrate no_horn (step-ag facts)
            bottomHornLength:        0,
            sashSplit:               'half_half',
            // (the invented sashLip: 8 is gone — step-y brief §1)
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
                  // Glazing bars on the TOP sash only (step-ag facts):
                  // 2 vertical (offsets 252.7 / 527.3) + 1 horizontal
                  // (369.8), 22 mm, nib 4 — Integrate's stored values.
                  children: [
                    { key: 'glass1_vb1', part_type: 'verticalGlazingBarPart',
                      values: { offset: 252.7, thickness: 22, nib: 4 }, children: [] },
                    { key: 'glass1_vb2', part_type: 'verticalGlazingBarPart',
                      values: { offset: 527.3, thickness: 22, nib: 4 }, children: [] },
                    { key: 'glass1_hb1', part_type: 'horizontalGlazingBarPart',
                      values: { offset: 369.8, thickness: 22, nib: 4 }, children: [] },
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
                // Chamfered bottom rail at 9° (step-y brief §1: both
                // Integrate drawings) — drives the gross-height allowance
                btmRailShapeId: 'chamfered',
                chamferedBottomRailAngle: 9,
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
// Step AG: the tree is now Integrate's own saved drawing
// (docs/integrate-L31115-A-B-trees.txt). What remains below is what a saved
// GlazePro drawing has NO field for (left out, listed), plus the one
// spec-sourced block.
const ASSUMPTIONS = [
  'Geometry/frame/cill/horns/bars: Integrate saved drawing, step-ag facts — no longer assumptions',
  'NOT STORABLE in GlazePro (left out): range Replacement_Sashes; draughtseal true ALONGSIDE newSashes (typeOfWork is single-valued); installByUs/deliveryByUs; installationLevel (blank); cill width 900 (derived in GlazePro); per-unit glass rebate 14/tolerance 2 (GlazePro reads the profile); surround auto-calc architrave_and_bullnose flag',
  'Integrate stores NO frame material on a sash replacement — frameMaterialId removed; cillMaterialId utile cited from Integrate CillPart (44)',
  'Spacer 16mm White Warm Edge + argon, finishes Teknos Clean White, ironmongery PB claw kit: stage-4 spec (facts file line 20 block)',
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

// ── Thickness variants (Steps AA/AB) ─────────────────────────────────────────
// DERIVED from benchmark A's tree — A stays the single source. Facts from
// docs/integrate-benchmarks-thickness.txt: the reviewer changed only the
// sash thickness on Integrate's drawing; Integrate's board moved the
// internal sash height (1701 at 35/40, 1699 at 50 — keeping the external
// height, internal + chamfer allowance, constant) and RE-STORED the
// bottom rail so (rail + whole-mm allowance) stays 95: 89 at 35/40
// (allowance 6), 88 at 45 (7), 87 at 50 (8) — second visit, GetDrawing.
// With Integrate's stored rail a plain half_half split draws exactly
// Integrate's heights (equal glass sightlines of 761.5), so the Step AA
// set_top/fixedSashHeight workaround is gone (step-ab brief §2).
function thicknessVariant(name, targets, sashThickness, interiorHeight, bottomRail) {
  const tree = JSON.parse(JSON.stringify(TREE))
  const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
  frame.values.height = interiorHeight + 79 + 70   // head 79 + cill 70, as A
  const pair = frame.children.find(c => c.part_type === 'sashPairPart')
  pair.values.sashThickness = sashThickness
  const bot = pair.children.find(c => c.part_type === 'bottomSashPart')
  bot.values.bottomHeight = bottomRail             // Integrate's stored rail
  return {
    name,
    tree,
    targets,
    partCostMap: PART_COST_MAP,
    profileValues: PROFILE_VALUES,
    ironmongeryLines: IRONMONGERY_LINES,
    ironmongeryCatalogue: IRONMONGERY_CATALOGUE,
    assumptions: [
      ...ASSUMPTIONS,
      `Derived from benchmark A: sash thickness ${sashThickness} mm, internal sash height ${interiorHeight}, stored bottom rail ${bottomRail} (Integrate, second visit), plain half_half`,
    ],
  }
}

export const BENCHMARK_A35 = thicknessVariant(
  'Benchmark A35 — Sash replacement at 35 mm', INTEGRATE_TARGETS.benchmarkA35, 35, 1701, 89)
export const BENCHMARK_A40 = thicknessVariant(
  'Benchmark A40 — Sash replacement at 40 mm', INTEGRATE_TARGETS.benchmarkA40, 40, 1701, 89)
export const BENCHMARK_A50 = thicknessVariant(
  'Benchmark A50 — Sash replacement at 50 mm', INTEGRATE_TARGETS.benchmarkA50, 50, 1699, 87)
export const BENCHMARK_A35_H1700 = thicknessVariant(
  'Benchmark A35/h1700 — 35 mm with sash height set back to 1700',
  INTEGRATE_TARGETS.benchmarkA35_h1700, 35, 1700, 89)

// ── Spiral variant (Step AK) ─────────────────────────────────────────────────
// Benchmark F = L31115 Item 1 Drawing 14: a copy of A with BOTH sashes set to
// Spiral Hung and saved. Integrate itself then changed the frame — jambType
// hollow_box → solid_spiral and jambs/head 85/85/79 → 28/28/28, with the
// frame width and height unchanged at 1070 x 1849 — so the sashes GREW:
// width 900 → 1014, top sash 850.5 → 876.0, shoulders 761.5 → 787
// (docs/integrate-L31115-spiral.txt). GlazePro derives those same sizes from
// its one geometry source, so only the stored fields Integrate changed are
// set here; everything else is A (third floor, no mechanical clearance, cill
// stop 20, bars 2V + 1H on the top glass).
//
// Integrate reset the bar offsets to 0 on the copy (its default spacing), so
// the offsets are cleared here too; bar offsets do not enter any priced
// quantity (only the counts and the glass sightlines do).
function spiralVariant(name, targets) {
  const tree = JSON.parse(JSON.stringify(TREE))
  const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
  frame.values.jambType   = 'solid_spiral_for_sash'   // Integrate 'solid_spiral'
  frame.values.leftWidth  = 28
  frame.values.rightWidth = 28
  frame.values.topHeight  = 28
  const pair = frame.children.find(c => c.part_type === 'sashPairPart')
  for (const sash of pair.children) {
    if (sash.part_type === 'topSashPart' || sash.part_type === 'bottomSashPart') {
      sash.values.operation = 'spiral_hung'   // Integrate operationId 14; code
                                              // itself not verified (see below)
      const glass = (sash.children ?? []).find(c => c.part_type === 'glassPart')
      for (const bar of (glass?.children ?? [])) {
        if (bar.values && 'offset' in bar.values) bar.values.offset = 0
      }
    }
  }
  return {
    name,
    tree,
    targets,
    partCostMap: PART_COST_MAP,
    profileValues: PROFILE_VALUES,
    ironmongeryLines: IRONMONGERY_LINES,          // claw kit without pulleys PB x1, as A
    ironmongeryCatalogue: IRONMONGERY_CATALOGUE,
    assumptions: [
      ...ASSUMPTIONS,
      'Derived from benchmark A: both sashes Spiral Hung, jambs and head 28, jambType solid spiral, bar offsets reset to 0 — the only fields Integrate changed on the copy (docs/integrate-L31115-spiral.txt)',
      'Sash operation code "spiral_hung": NOT VERIFIED — the live sash_operation code for spiral is not in the repo (docs/pricing-vocabulary-audit.md records only the labels). Pricing matches the substring "spiral", so the spelling changes no figure',
    ],
  }
}

// ── New cill variant (Step AM) ───────────────────────────────────────────────
// Benchmark G = L31115 Item 1 Drawing 15: a copy of A with the cill's Repair
// set to New Cill (Integrate CillPart.cillRepairId 2), third floor,
// isBrickToBrickCill false. Everything else is exactly A
// (docs/integrate-L31115-cill.txt). Integrate charges the same cill block on
// all three cill benchmarks: a Cill Replacement line 1.00 -> 200.00 and
// 2.50 h of install labour, so G's labour is A's 4.75 + 2.50 = 7.25 h and
// no cill timber is priced.
function newCillVariant(name, targets) {
  const tree = JSON.parse(JSON.stringify(TREE))
  const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
  const cill = frame.children.find(c => c.part_type === 'cillPart')
  cill.values.repair = 'new_cill'              // Integrate cillRepairId 2
  cill.values.isBrickToBrickCill = false       // Integrate: left unticked on G
  return {
    name,
    tree,
    targets,
    partCostMap: PART_COST_MAP,
    profileValues: PROFILE_VALUES,
    ironmongeryLines: IRONMONGERY_LINES,
    ironmongeryCatalogue: IRONMONGERY_CATALOGUE,
    assumptions: [
      ...ASSUMPTIONS,
      'Derived from benchmark A: cill Repair = New Cill, Full Cill Replacement unticked — the only fields Integrate changed on the copy (docs/integrate-L31115-cill.txt)',
      'Full Cill Replacement changes no price in Integrate (GBP 1,809.71 both ways) and none here either: GlazePro derives cill_length_in_mm from the frame width already',
    ],
  }
}

export const BENCHMARK_G = newCillVariant(
  'Benchmark G — Sash replacement + new cill (L31115 Item 1 Drawing 15)',
  INTEGRATE_TARGETS.benchmarkG_sash_replacement_new_cill)

export const BENCHMARK_F = spiralVariant(
  'Benchmark F — Spiral sash replacement (L31115 Item 1 Drawing 14)',
  INTEGRATE_TARGETS.benchmarkF_spiral_replacement)
