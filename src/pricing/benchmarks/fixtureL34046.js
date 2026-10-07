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
// Step X: EVERY value comes from Integrate's own saved drawing for this
// benchmark — docs/integrate-L34046-item7-tree.txt (fact, read 7 Oct 2026) —
// expressed with GlazePro's real keys and codes (as a saved GlazePro drawing
// stores them). No field a saved GlazePro drawing does not store. Integrate
// values with no GlazePro field (range, isSecuredByDesign, installByUs /
// deliveryByUs, hasHeadDrip, cill width, per-unit glazing rebate/tolerance,
// bar thickness/nib) are listed in the Step X report, not invented here.
// Integrate's numeric staffBeadTypeId 0 / partingBeadTypeId 280 /
// mouldingTypeId 0 map to GlazePro codes 'small' / 'standard' / (unset).
// The paint finishes, ironmongery finish and spacer codes are from the
// original L34046 Item 7 spec (not in the Integrate geometry read).
const TREE = {
  key: 'item1',
  part_type: 'drawingItemPart',
  values: {
    typeOfWork:          'complete_new',      // Integrate: newSashes + newFrame
    isDocL:              true,                // Integrate: isDocL true
    frameMaterialId:     'softwood',          // Integrate 38 = Solid Redwood
    sashMaterialId:      'softwood',          // Integrate 38 = Solid Redwood
    cillMaterialId:      'utile',             // Integrate 44 = Solid Utile Hardwood
    staffBeadTypeId:     'small',
    partingBeadTypeId:   'standard',
    floorLevel:          'ground_floor',      // original L34046 spec (not in the Integrate geometry read)
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
        // All from Integrate's saved drawing (the Step V open choice is
        // settled: overall 1245 x 1779)
        width:          1245,
        height:         1779,
        topHeight:      79,
        bottomHeight:   70,
        leftWidth:      85,
        rightWidth:     85,
        frameDepth:     140,
        jambType:       'hollow_box_for_sash',   // Integrate 'hollow_box'
        // Integrate: outer jamb extensions 0 → outer jamb = inner jamb (85)
        leftOuterJamb:  85,
        rightOuterJamb: 85,
        // Integrate: cill horn lengths 0 / 0
        frameHeadStopSize:  16,
        frameStileStopSize: 16,
        cillStopSize:       16,
      },
      children: [
        {
          key: 'cill1',
          part_type: 'cillPart',
          values: {
            // Integrate CillPart: height 70, depth 140. profiledHeight is
            // NOT a stored field in Integrate — removed (the old 45 was an
            // invention; cill height 70 is the truth).
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
            // Integrate: clearances 2.5 / 2.5 → drawn sash width 1070
            mechanicalClearanceLeft:   2.5,
            mechanicalClearanceRight:  2.5,
            mechanicalClearanceTop:    0,
            mechanicalClearanceBottom: 0,
            topHornTypeShortName:    'victorian',   // Integrate 'victorian_style_horn'
            topHornLength:           75,
            bottomHornTypeShortName: 'no_horn',
            bottomHornLength:        0,
            sashSplit:               'half_half',   // equal shoulder heights 726.5 / 726.5
          },
          children: [
            {
              key: 'top1',
              part_type: 'topSashPart',
              values: {
                topHeight:    49,
                // Integrate: stiles 49 (the old 50.75 was an assumption)
                leftWidth:    49,
                rightWidth:   49,
                operation:    'cord_hung',
                toBeReplaced: true,   // Integrate: toBeReplaced true
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
                leftWidth:    49,
                rightWidth:   49,
                operation:    'cord_hung',
                toBeReplaced: true,   // Integrate: toBeReplaced true
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
// Geometry is now FACT from docs/integrate-L34046-item7-tree.txt; only the
// entries below remain assumption/spec-sourced.
const ASSUMPTIONS = [
  'Geometry: Integrate’s saved drawing (overall 1245x1779, sash 1070, stiles 49, cill 1245x70x140, horn 75/0) — fact, step-x brief',
  'Glass: GL100010 (4mm Clear Pilkington K Toughened), GL100080 (4mm Clear Toughened)',
  'Ironmongery finish: ABs (Antique Brass); finishes clean white; floor ground (original L34046 spec, not in the geometry read)',
  'Spacer: 16mm White Warm Edge (original spec, not in the geometry read)',
]

// Sash profile values for glass cut size (rebate width 14, tolerance 2 → cover
// 12mm per edge). Integrate stores rebate/tolerance PER GLASS UNIT (14/2 on
// both units of this drawing); GlazePro reads them from the profile.
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
