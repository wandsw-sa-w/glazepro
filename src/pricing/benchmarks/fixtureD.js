/**
 * fixtureD.js
 * Benchmark D — Double box sash, two pairs (L31115 Quote 1, Item 4).
 *
 * Step AC: GlazePro's REAL shape (keys/structure from
 * real-trees/L507712-drawing10-doublebox.raw.json, what the board actually
 * saves for a double box sash) with Integrate's VALUES
 * (docs/integrate-benchmarks-arched-doublebox.txt — fact, read 8 Oct 2026).
 *
 * Shape differences carried as facts, not patched over (step-ac report):
 * - Integrate: hollow mullion 144 thick at offset 743 (isHollowMullion true,
 *   mullion stop 16) and TWO cills, 743 each. GlazePro's board saves ONE
 *   mullionPart {offset, thicknessInFrame} and ONE cillPart; there is no
 *   hollow flag and no mullion stop size. This fixture carries Integrate's
 *   144 in GlazePro's thicknessInFrame key.
 * - Step AD decision 3: each pair has its own opening — interior 1630,
 *   mullion 144 at offset 743 (left face) → openings 743/743, each pair
 *   738 wide, as Integrate draws it. The mullion thickness comes from
 *   the profile value thicknessInFrameHollow (144), never the template's
 *   stored thicknessInFrame.
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

const PAIR_VALUES = {
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
}

function pair(n) {
  return {
    key: `pair${n}`,
    part_type: 'sashPairPart',
    values: { ...PAIR_VALUES },
    children: [
      {
        key: `top${n}`,
        part_type: 'topSashPart',
        values: {
          topHeight:  49,
          leftWidth:  49,
          rightWidth: 49,
          operation:  'cord_hung',
        },
        children: [
          { key: `glass_t${n}`, part_type: 'glassPart', values: { ...GLASS_VALUES }, children: [] },
        ],
      },
      {
        key: `bot${n}`,
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
          { key: `glass_b${n}`, part_type: 'glassPart', values: { ...GLASS_VALUES }, children: [] },
        ],
      },
    ],
  }
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
    mouldingTypeId:    'ovolo',        // board-saved value (real tree 10)
    // Integrate item 4 is "Third Floor Front Bedroom" (facts file, second
    // read 8 Oct — the first read filtered floor fields out by mistake).
    // The "Third Floor 30 minutes" install rule (60 min) is D's 16th hour.
    floorLevel:        'third_floor',
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
        // default_ironmongery rules
      },
      children: [],
    },
    {
      key: 'notes1',
      part_type: 'notesPart',
      values: {
        installationMethod: 'internally',          // ASSUMPTION (as L34046)
        externalAccessId:   'easily_accessible',   // board-saved value (real tree 10)
      },
      children: [],
    },
    {
      key: 'frame1',
      part_type: 'assemblyFramePart',
      values: {
        width:          1800,
        height:         1299,
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
          key: 'mullion1',
          part_type: 'mullionPart',
          // GlazePro's key with Integrate's value. Integrate also stores
          // isHollowMullion true and mullion stop 16 — no GlazePro fields.
          values: { offset: 743, thicknessInFrame: 144 },
          children: [],
        },
        {
          key: 'cill1',
          part_type: 'cillPart',
          // ONE cill — GlazePro's shape; Integrate stores TWO (743 each)
          values: { height: 70, depth: 140 },
          children: [],
        },
        pair(1),
        pair(2),
      ],
    },
  ],
}

// Integrate targets — DO NOT EDIT to match GlazePro output.
const TARGETS = {
  ...INTEGRATE_TARGETS.benchmarkD_doublebox,
}

const ASSUMPTIONS = [
  'Shape: GlazePro board-saved double box sash (real tree L507712 drawing 10) with Integrate’s values',
  'Mullion: thicknessInFrame carries Integrate’s 144; no GlazePro field for isHollowMullion or mullion stop 16',
  'One cillPart (GlazePro shape); Integrate stores two cills, 743 each',
  'Surround architrave: no GlazePro field, but the "Surround timber" allocator (TP68) matches Integrate’s Ogee Architrave lines to the penny',
  'floorLevel third_floor: Integrate item 4 "Third Floor Front Bedroom" (facts file, 8 Oct second read) — the "Third Floor 30 minutes" rule (60 min) is the 16th labour hour',
  'installationMethod internally: ASSUMPTION, not in the Integrate read (as L34046)',
]

const PROFILE_VALUES = {
  defaultDoubleGlazingRebateWidthForSash: 14,
  defaultDoubleGlazingTolerance: 2,
  defaultSingleGlazingRebateWidthForSash: 14,
  defaultSingleGlazingTolerance: 2,
  // Step AD decision 3: a box-sash mullion is hollow — its thickness is
  // this profile value (144 on the snapshot's Sash profile), not the
  // template's stored thicknessInFrame. Missing value = error.
  thicknessInFrameHollow: 144,
}

export const BENCHMARK_D = {
  name:   'Benchmark D — Double box sash (L31115 Item 4)',
  tree:   TREE,
  targets: TARGETS,
  partCostMap: PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  assumptions: ASSUMPTIONS,
}
