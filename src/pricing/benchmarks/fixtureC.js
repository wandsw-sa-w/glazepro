/**
 * fixtureC.js
 * Benchmark C — Arched head single box sash (L31115 Quote 1, Item 3).
 *
 * Step AC: GlazePro's REAL shape (keys/structure from
 * real-trees/L507712-drawing9-arched.raw.json, what the board actually
 * saves for an arched box sash) with Integrate's VALUES
 * (docs/integrate-benchmarks-arched-doublebox.txt — fact, read 8 Oct 2026).
 *
 * Shape differences carried as facts, not patched over (step-ac report):
 * - Integrate puts the arch on the TOP SASH (archHeight 100 at the glass,
 *   archRadius 708.9, shoulderHeight 336.5, isFrameLevelArch true,
 *   archedOuterJamb true). GlazePro's board stores archHead/archHeight on
 *   the FRAME and saves none of the other four fields, so this fixture has
 *   frame.archHead=true, frame.archHeight=100 and nothing else.
 * - Integrate's "surround: architrave" (the Ogee Architrave MDF component
 *   lines) has no GlazePro field at all.
 */

import INTEGRATE_TARGETS from './integrate-targets.json'

const PART_COST_MAP = {
  TP68: 2.85,   // Ogee Architrave 20x70 MDF £2.85/m (Integrate's architrave lines)
  TP01: 2.59,   // Small staff bead 20x15 Redwood
  TP03: 2.22,   // Standard parting bead 8x25 Redwood
}

const GLASS_VALUES = {
  glazingId:            'double_glazing',
  isIndividualPanes:    false,
  gasFillId:            'argon',
  spacerDimId:          'spacer_16',
  spacerColourId:       'white_warm_edge',
  internalGlassPartNo:  'GL100010',
  externalGlassPartNo:  'GL100080',
}

const TREE = {
  key: 'item1',
  part_type: 'drawingItemPart',
  values: {
    typeOfWork:        'complete_new',
    isDocL:            true,
    product:           'pair_of_sashes',
    quantity:          1,
    frameMaterialId:   'softwood',     // Integrate 38
    sashMaterialId:    'softwood',     // Integrate 38
    cillMaterialId:    'utile',        // Integrate 44
    staffBeadTypeId:   'small',
    partingBeadTypeId: 'standard',     // Integrate 280
    mouldingTypeId:    'ovolo',        // board-saved value (real tree 9)
    floorLevel:        'ground_floor', // ASSUMPTION: not in the Integrate read (as L34046)
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
        // No stored lines: complete-new defaults come from the
        // default_ironmongery rules (claw fastener kit + trickle vent)
      },
      children: [],
    },
    {
      key: 'notes1',
      part_type: 'notesPart',
      values: {
        installationMethod: 'internally',          // ASSUMPTION (as L34046)
        externalAccessId:   'easily_accessible',   // board-saved value (real tree 9)
      },
      children: [],
    },
    {
      key: 'frame1',
      part_type: 'assemblyFramePart',
      values: {
        width:          999,
        height:         1199,
        archHead:       true,   // GlazePro stores the arch on the FRAME
        archHeight:     100,    // Integrate: archHeight 100 (at the glass, on the top sash)
        topHeight:      79,
        bottomHeight:   70,
        leftWidth:      85,
        rightWidth:     85,
        frameDepth:     140,
        jambType:       'hollow_box_for_sash',
        cillAngle:      9,
        cillStopId:     'ovolo',
        cillStopSize:       16,
        frameHeadStopSize:  16,
        frameStileStopSize: 16,
      },
      children: [
        {
          key: 'cill1',
          part_type: 'cillPart',
          values: { height: 70, depth: 140 },
          children: [],
        },
        {
          key: 'pair1',
          part_type: 'sashPairPart',
          values: {
            sashThickness:             45,
            midrailHeight:             40,
            midRailTypeId:             'chamfered',
            mechanicalClearanceLeft:   2.5,
            mechanicalClearanceRight:  2.5,
            mechanicalClearanceTop:    0,
            mechanicalClearanceBottom: 0,
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
                topHeight:  49,
                leftWidth:  49,
                rightWidth: 49,
                operation:  'cord_hung',
              },
              children: [
                {
                  key: 'glass1',
                  part_type: 'glassPart',
                  values: { ...GLASS_VALUES },
                  // Integrate: 2 vertical (offsets 227.3 / 476.7) + 1
                  // horizontal (offset 207.3), 22 mm, nib 4. tail /
                  // tailLinkType are the board's saved defaults (real tree 9).
                  children: [
                    { key: 'glass1_vb1', part_type: 'verticalGlazingBarPart',
                      values: { offset: 227.3, thickness: 22, nib: 4, tail: 4, tailLinkType: 1 }, children: [] },
                    { key: 'glass1_vb2', part_type: 'verticalGlazingBarPart',
                      values: { offset: 476.7, thickness: 22, nib: 4, tail: 4, tailLinkType: 1 }, children: [] },
                    { key: 'glass1_hb1', part_type: 'horizontalGlazingBarPart',
                      values: { offset: 207.3, thickness: 22, nib: 4, tail: 4, tailLinkType: 1 }, children: [] },
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
                btmRailShapeId: 'chamfered',
                chamferedBottomRailAngle: 9,
              },
              children: [
                {
                  key: 'glass2',
                  part_type: 'glassPart',
                  values: { ...GLASS_VALUES },
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

// Integrate targets — DO NOT EDIT to match GlazePro output.
const TARGETS = {
  ...INTEGRATE_TARGETS.benchmarkC_arched,
}

const ASSUMPTIONS = [
  'Shape: GlazePro board-saved arched box sash (real tree L507712 drawing 9) with Integrate’s values',
  'Arch: frame.archHead/archHeight 100 — Integrate stores it on the top sash with shoulderHeight 336.5, archRadius 708.9, isFrameLevelArch, archedOuterJamb; none of those have a board-saved GlazePro field',
  'Surround architrave (Ogee Architrave MDF): no GlazePro field; surround allocation not built',
  'installationMethod internally / floorLevel ground_floor: not in the Integrate read (as L34046)',
  'Bar tail 4 / tailLinkType 1: board defaults; Integrate read gives thickness 22 and nib 4 only',
]

const PROFILE_VALUES = {
  defaultDoubleGlazingRebateWidthForSash: 14,
  defaultDoubleGlazingTolerance: 2,
  defaultSingleGlazingRebateWidthForSash: 14,
  defaultSingleGlazingTolerance: 2,
}

export const BENCHMARK_C = {
  name:   'Benchmark C — Arched head box sash (L31115 Item 3)',
  tree:   TREE,
  targets: TARGETS,
  partCostMap: PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  assumptions: ASSUMPTIONS,
}
