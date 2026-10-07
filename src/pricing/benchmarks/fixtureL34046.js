/**
 * fixtureL34046.js
 * L34046 Item 7 — Complete new box sash window.
 * Extracted from PricingBenchmark.jsx so page and tests share the same fixture.
 */

import INTEGRATE_TARGETS from './integrate-targets.json'

// ── Part cost map (from integrate-part-allocator.txt "Referenced parts") ──────
const PART_COST_MAP = {
  TP68: 2.85,   // Ogee Architrave 20x70 MDF £2.85/m
  TP74: 4.50,   // Chamfered Architrave 20x70 MDF £4.50/m
  TT69: 2.59,   // Pencil Round Architrave 20x70 MDF £2.59/m
  TP61: 2.76,   // Nosing 25x50 Redwood £2.76/m
  TP01: 2.59,   // Small staff bead 20x15 Redwood £2.59/m
  TP02: 2.95,   // Large staff bead 25x15 Redwood £2.95/m
  TP03: 2.22,   // Standard parting bead 8x25 Redwood £2.22/m
  AA01: 50.00,  // Internal Linings MDF (nominal each)
  AA02: 30.00,  // Windowboard MDF (nominal each)
  AA03: 75.00,  // External Linings Utile (nominal each)
}

// ── Fixture tree ─────────────────────────────────────────────────────────────
// Vocabulary and shape follow a real saved drawing
// (src/pricing/benchmarks/real-trees/L507712-drawing1.raw.json): real
// timber_species codes ('softwood'/'utile'), real glazing_type codes
// ('double_glazing'), spacer as spacerDimId/spacerColourId codes, glazing
// bars as child parts. EXCEPTION, flagged in docs/pricing-vocabulary-audit.md
// §shape: outerWidth/outerHeight stay on the frame although a saved drawing
// does not store them — the weight calibration (19.4/20.4 kg) depends on the
// outer dimensions and the board/engine width-semantics conflict is an open
// decision.
const TREE = {
  key: 'item1',
  part_type: 'drawingItemPart',
  values: {
    typeOfWork:          'complete_new',
    frameMaterialId:     'softwood',          // timber_species: Integrate "Solid Redwood"
    sashMaterialId:      'softwood',
    cillMaterialId:      'utile',             // timber_species: Integrate "Solid Utile Hardwood"
    staffBeadTypeId:     'small',
    partingBeadTypeId:   'standard',
    fitToPreparedOpening: false,
    decoration:          false,
    floorLevel:          'ground_floor',
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
        ironmongeryFinish: 'ABs',
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
        // OVERALL frame — OPEN CHOICE for the reviewer (step-v brief: the
        // L34046 drawing has not been read in Integrate). The original
        // fixture transcribed an inner opening of 1075 x 1630 and ASSUMED
        // outer 1255 x 1775. 1245 x 1779 is used here because it preserves
        // the transcribed interior exactly (1245−85−85 = 1075,
        // 1779−79−70 = 1630), so every sightline-driven quantity is
        // unchanged. The alternative reading, overall 1255 x 1775
        // (interior 1085 x 1626), shifts every sash/glass quantity by
        // 10/−4 mm — both results are quantified in the Step V report.
        width:          1245,
        height:         1779,
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
            // Zero like A and B (Integrate shows no side clearance on the
            // drawings it was read from); keeps the drawn sash width equal
            // to the interior 1075 the engine always used for this item
            mechanicalClearanceLeft:   0,
            mechanicalClearanceRight:  0,
            mechanicalClearanceTop:    0,
            mechanicalClearanceBottom: 0,
            topHornTypeShortName:    'victorian',
            bottomHornTypeShortName: 'none',
            sashSplit:               'half_half',
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
                toBeReplaced: null,
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
                  // 2 vertical + 1 horizontal glazing bars, as real drawings
                  // store them (child parts, not barsWide/barsHigh counts)
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
                leftWidth:    50.75,
                rightWidth:   50.75,
                operation:    'cord_hung',
                toBeReplaced: null,
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
                  children: [
                    { key: 'glass2_vb1', part_type: 'verticalGlazingBarPart',   values: {}, children: [] },
                    { key: 'glass2_vb2', part_type: 'verticalGlazingBarPart',   values: {}, children: [] },
                    { key: 'glass2_hb1', part_type: 'horizontalGlazingBarPart', values: {}, children: [] },
                  ],
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
// Totals and group targets come from integrate-targets.json — the single
// Integrate fact file. DO NOT EDIT to match GlazePro output.
const TARGETS = {
  ...INTEGRATE_TARGETS.L34046,
  // Labour-minute targets from docs/integrate-benchmarks-stage4.txt
  // (Production Time 22.28 h, Labour 7.50 h)
  manufacture_minutes: 1337,
  install_minutes:     450,
}

// ── Assumptions ──────────────────────────────────────────────────────────────
const ASSUMPTIONS = [
  'Overall frame: 1245x1779 mm (OPEN CHOICE — preserves the transcribed interior 1075x1630; reviewer to read the real drawing; alternative reading 1255x1775)',
  'Stile width: 50.75 mm (gross stile incl. sash lip = 47 + 3.75 mm)',
  'Top rail: 49 mm, bottom rail: 88 mm, midrail: 40 mm (profile defaults)',
  'Cill profiled height: 45 mm (height excluding frame stop)',
  'Glass: GL100010 (4mm Clear Pilkington K Toughened), GL100080 (4mm Clear Toughened)',
  'Ironmongery finish: ABs (Antique Brass)',
]

// Sash profile values for glass cut size (rebate width 14, tolerance 2 → cover 12mm per edge)
const PROFILE_VALUES = {
  defaultDoubleGlazingRebateWidthForSash: 14,
  defaultDoubleGlazingTolerance: 2,
  defaultSingleGlazingRebateWidthForSash: 14,
  defaultSingleGlazingTolerance: 2,
}

export const BENCHMARK_L34046 = {
  name:   'L34046 Item 7 — Complete new box sash',
  tree:   TREE,
  targets: TARGETS,
  partCostMap: PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  assumptions: ASSUMPTIONS,
}
