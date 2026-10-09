/**
 * fixtureE.js
 * Benchmark E — Complete new SPIRAL BALANCE sash window
 * (L31115 Item 3 Drawing 2, ground floor).
 *
 * Step AK: every value comes from Integrate's own saved drawing
 * (docs/integrate-L31115-spiral.txt — fact, read 9 Oct 2026), expressed with
 * GlazePro's real keys and codes. The drawing was made from Integrate's own
 * "3. Spiral Sash Windows > Spiral Sash Window" template and then sized to
 * 1000 x 1500, so its frame sizes are Integrate's spiral defaults — which are
 * also GlazePro's profile spiral defaults (facts file last line:
 * defaultSpiralFrameJamb 28, Head 28, Depth 140, CillHeight 70, CillDepth 140,
 * JambType Solid Spiral for Sash).
 *
 * How GlazePro recognises "spiral" (step-ak brief §1). Integrate stores
 * itemTypeId 2 "Spiral Sash Window"; GlazePro has no such field and does not
 * need one — the sash OPERATION and the frame's JAMB TYPE carry it. This tree
 * produces:
 *   is_sw / is_box_sash          true  (a sashPairPart, no casement, no door)
 *   is_spiral_hung               true  (both sashes' operation is spiral;
 *                                      per-sash in the sliding_sash loop)
 *   is_cord_hung                 false (so no Lead Weight and no Steel Weight)
 *   is_solid_spiral_jamb         true  (jambType solid_spiral_for_sash → the
 *                                      Spiral Frame / Spiral Frame Linings
 *                                      rules fire and Box Frame Linings /
 *                                      Pulley Stiles do not)
 *   is_spiral_sash               FALSE — it keys on a `spiralSashPairPart`
 *                                      part type that GlazePro never builds.
 *                                      No PF30 rule uses it (reported in
 *                                      docs/step-ak-findings.md).
 */

import INTEGRATE_TARGETS from './integrate-targets.json'

// ── Part cost map ────────────────────────────────────────────────────────────
const PART_COST_MAP = {
  TP68: 2.85,   // Ogee Architrave 20x70 MDF £2.85/m — Integrate's surround
  TP01: 2.59,   // Small staff bead 20x15 Redwood
  TP03: 2.22,   // Standard parting bead 8x25 Redwood
}

const GLASS_VALUES = {
  glazingId:           'double_glazing',   // Integrate glazingId 2
  isIndividualPanes:   false,
  internalGlassPartNo: 'GL100010',
  externalGlassPartNo: 'GL100080',
}

// Integrate stores operationId 14 "Spiral Hung". GlazePro's sash_operation
// options were created outside the repo and only their LABELS are recorded
// ("Cord Hung", "…Spiral…", "Fix…" — sql/step-b2c-applies-to.sql, and
// docs/pricing-vocabulary-audit.md says the spiral and fix CODES are
// live-only). 'spiral_hung' follows the one real code we hold ('cord_hung',
// from the saved L507712 tree) and Integrate's own label. Pricing does not
// depend on the exact spelling — operationKind() matches any code containing
// "spiral" — but the code itself is NOT VERIFIED against the live options.
const SPIRAL_OPERATION = 'spiral_hung'

const TREE = {
  key: 'item1',
  part_type: 'drawingItemPart',
  values: {
    typeOfWork:        'complete_new',    // Integrate: newSashes + newFrame true
    isDocL:            true,
    frameMaterialId:   'softwood',        // Integrate 38
    sashMaterialId:    'softwood',        // Integrate 38
    cillMaterialId:    'utile',           // Integrate 44
    partingBeadTypeId: 'standard',        // Integrate 280
    staffBeadTypeId:   'small',           // ASSUMPTION: not in the read (as C)
    floorLevel:        'ground_floor',    // Integrate: item 3, GROUND floor
  },
  children: [
    {
      key: 'paint1',
      part_type: 'paintAndIronmongeryPart',
      values: {
        // Integrate: Teknos Spray Finish Clean White int/ext/cill
        internalFinish:    'clean_white',
        externalFinish:    'clean_white',
        cillFinish:        'clean_white',
        cutOutBrickReveal: false,
        ironmongeryFinish: 'PB',
        // No stored lines — the complete-new defaults produce Integrate's
        // two: the claw fastener kit WITHOUT pulleys (the default rule
        // "is_complete_new and is_spiral_hung", 0.5 per sliding sash → 1)
        // and the trickle vent. Same handling as L34046 / C (step-ak brief).
      },
      children: [],
    },
    {
      key: 'notes1',
      part_type: 'notesPart',
      values: {
        installationMethod: 'internally',   // ASSUMPTION: not in the read (as C)
      },
      children: [],
    },
    {
      key: 'frame1',
      part_type: 'assemblyFramePart',
      values: {
        width:          1000,
        height:         1500,
        jambType:       'solid_spiral_for_sash',   // Integrate 'solid_spiral'
        leftWidth:      28,
        rightWidth:     28,
        topHeight:      28,
        bottomHeight:   70,
        frameDepth:     140,
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
          // Integrate CillPart: height 70, depth 140 (width 944 is derived
          // in GlazePro, so it is not stored — as Step AG settled)
          values: { height: 70, depth: 140 },
          children: [],
        },
        {
          key: 'pair1',
          part_type: 'sashPairPart',
          values: {
            sashThickness:             45,
            midrailHeight:             40,
            mechanicalClearanceLeft:   2.5,
            mechanicalClearanceRight:  2.5,
            mechanicalClearanceTop:    0,
            mechanicalClearanceBottom: 0,
            topHornTypeShortName:    'victorian',   // Integrate victorian_style_horn 75
            topHornLength:           75,
            bottomHornTypeShortName: 'no_horn',
            bottomHornLength:        0,
            sashSplit:               'half_half',   // equal shoulders 612.5 / 612.5
          },
          children: [
            {
              key: 'top1',
              part_type: 'topSashPart',
              values: {
                topHeight:    49,
                leftWidth:    49,
                rightWidth:   49,
                operation:    SPIRAL_OPERATION,     // Integrate operationId 14
                toBeReplaced: true,
                archHead:     false,
              },
              children: [
                { key: 'glass1', part_type: 'glassPart', values: { ...GLASS_VALUES }, children: [] },
              ],
            },
            {
              key: 'bot1',
              part_type: 'bottomSashPart',
              values: {
                bottomHeight: 88,
                leftWidth:    49,
                rightWidth:   49,
                operation:    SPIRAL_OPERATION,
                toBeReplaced: true,
                btmRailShapeId: 'chamfered',
                chamferedBottomRailAngle: 9,
              },
              children: [
                { key: 'glass2', part_type: 'glassPart', values: { ...GLASS_VALUES }, children: [] },
              ],
            },
          ],
        },
      ],
    },
  ],
}

// Integrate targets — DO NOT EDIT to match GlazePro output.
const TARGETS = { ...INTEGRATE_TARGETS.benchmarkE_spiral_complete_new }

const ASSUMPTIONS = [
  'Geometry, frame, cill, horns, glass, operation and jamb type: Integrate’s saved drawing (docs/integrate-L31115-spiral.txt)',
  'Sash operation code "spiral_hung": NOT VERIFIED — the live sash_operation codes for spiral/fix are not in the repo (docs/pricing-vocabulary-audit.md); only the labels are. Pricing matches on the substring "spiral", so the spelling does not change any figure',
  'staffBeadTypeId small / installationMethod internally: ASSUMPTIONS, not in the Integrate read (same as C)',
  'Spacer and gas fill: not in the Integrate read for this drawing (E has no spacer-dependent line; glass unit thickness comes from the two pane codes)',
  'Surround (Ogee Architrave MDF) and trickle vent: no GlazePro fields — the snapshot’s "Surround timber" allocator (TP68) and the default trickle-vent ironmongery rule produce Integrate’s lines, as on L34046 / C',
]

const PROFILE_VALUES = {
  defaultDoubleGlazingRebateWidthForSash: 14,
  defaultDoubleGlazingTolerance: 2,
  defaultSingleGlazingRebateWidthForSash: 14,
  defaultSingleGlazingTolerance: 2,
}

export const BENCHMARK_E = {
  name:   'Benchmark E — Complete new spiral sash window (L31115 Item 3)',
  tree:   TREE,
  targets: TARGETS,
  partCostMap: PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  assumptions: ASSUMPTIONS,
}
