/**
 * fixtureDoor.js — French door benchmarks (Step AZ).
 *
 * docs/integrate-L31115-french-doors.txt, L31115 item 10, read 13 Oct 2026.
 *
 * All four are SAVED Integrate drawings, which matters for doors: on the
 * first save Integrate's server recomputes the allocated parts, ADDING the
 * multipoint-lock parts (allocator rules 2000-2120) and recomputing the utile
 * section lengths. An unsaved FD1 priced 5,258.91; saved, 5,639.01. A saved
 * drawing is what a surveyor's quote actually holds, so that is what these
 * are.
 *
 * A door's timber is NOT a volume. Integrate allocates lengths of five utile
 * stock sections and prices them per metre, and prices no frame, sash or cill
 * volume at all.
 */

import INTEGRATE_TARGETS from './integrate-targets.json'

const GLASS_CODES = {
  glazingId: 'double_glazing',
  isIndividualPanes: false,
  internalGlassPartNo: 'GL100010',
  externalGlassPartNo: 'GL100080',
}

/**
 * The five utile stock sections at Integrate's per-metre purchase costs, and
 * the four multipoint-lock parts the allocator adds on save.
 *
 * THE FOUR LOCK COSTS ARE DERIVED FROM INTEGRATE'S OWN PRICED LINES, not read
 * from a part table: none of the four codes exists in pf30-snapshot.json, so
 * there is nothing offline to read. Integrate's lines are whole pounds x 1.05
 * (the "Ironmongery Cost" rule), so 36.75 / 93.45 / 6.30 / 53.55 are costs
 * of 35 / 89 / 6 / 51.
 *
 * WHICH CODE IS WHICH IS A READING, from the allocator rules' own labels
 * against the facts' part names — NOT verified against live data:
 *   RJZ2382  rule 2010 "MPLS master ... shootbolt" -> Winkhaus Thunderbolt
 *            MASTER Multipoint Lock, 51
 *   RHZ1648  rule 2030 "Slave LH 1853-2565 opening out" -> Winkhaus FAB
 *            Shootbolt 399, 35
 *   RHZ1653  "slave hinge keep 1997-2139" -> Adj Single Shootbolt Keep, 6
 *   RHZ1667  "slave flush bolt" -> Winkhaus Flushbolt LH, 89
 * If two of them are the wrong way round the GROUP total is still right and
 * only the line labels are wrong. Flagged in docs/reports/step-az.md.
 */
export const DOOR_PART_COST_MAP = {
  Utile63x63:  8.60,
  Utile63x96:  12.20,
  Utile63x120: 17.30,
  Utile63x200: 29.00,
  Utile67x96:  13.60,
  // The Ogee Architrave in MDF the surround allocator adds on save (the
  // same part, at the same price, as every casement drawing uses).
  TP68: 2.85,
  RJZ2382: 51,
  RHZ1648: 35,
  RHZ1653: 6,
  RHZ1667: 89,
}

/**
 * The open_out_doors profile values the board reads. Integrate's import
 * already holds every one of these on the live profile; the bottom rails
 * (163 internal / 170 external) come from the TEMPLATE, not the profile.
 */
export const DOOR_PROFILE_VALUES = {
  'assemblyFramePart.leftWidth': 47, 'assemblyFramePart.rightWidth': 47,
  'assemblyFramePart.topHeight': 47, 'assemblyFramePart.bottomHeight': 37,
  'assemblyFramePart.frameDepth': 96,
  'assemblyFramePart.frameHeadStopSize': 20,
  'assemblyFramePart.frameStileStopSize': 20,
  'assemblyFramePart.cillStopSize': 26,
  'cillPart.height': 37, 'cillPart.depth': 145,
  'frenchDoorPart.thickness': 54,
  'frenchDoorPart.midRail': 198,
  'frenchDoorPart.gapBetweenMeetingStiles': 5,
  'frenchDoorPart.meetingStileOverlap': 27,
  'frenchDoorPart.mullionThickness': 83,
  'frenchDoorPart.mechanicalClearanceTop': 3,
  'frenchDoorPart.mechanicalClearanceBottom': 3,
  'frenchDoorPart.mechanicalClearanceLeft': 1,
  'frenchDoorPart.mechanicalClearanceRight': 1,
  'leftFrenchDoorLeafPart.topHeight': 110,
  'leftFrenchDoorLeafPart.leftWidth': 110,
  'leftFrenchDoorLeafPart.rightWidth': 110,
  'rightFrenchDoorLeafPart.topHeight': 110,
  'rightFrenchDoorLeafPart.leftWidth': 110,
  'rightFrenchDoorLeafPart.rightWidth': 110,
  'transomPart.thicknessInFrame': 41,
  'casementSashPart.thickness': 54,
  'casementSashPart.topHeight': 62,
  'casementSashPart.leftWidth': 62,
  'casementSashPart.rightWidth': 62,
  // Integrate's own fanlight rail on this profile is 58; Nathan's rule for a
  // NEW fanlight is 62. FD3 was drawn at Integrate's 86 and FD3b at 62.
  'casementSashPart.defaultFanlightBottomHeight': 58,
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 15,
  'glassPart.defaultDoubleGlazingTolerance': 3,
}

// ── Tree builders ────────────────────────────────────────────────────────────

function glassChild(key) {
  return {
    key: `${key}_glass`,
    part_type: 'glassPart',
    values: { ...GLASS_CODES, glazingRebateWidth: 15, glazingTolerance: 3 },
    children: [],
  }
}

/**
 * The French door pair: one opening, two leaves, no mullion.
 *
 * The leaves OVERLAP at the meeting stile (27 mm), which is what makes each
 * leaf wider than half the opening — the opposite of a French casement,
 * whose sashes are narrower than half by the gap.
 */
function frenchDoorPair(key, { masterLeaf = 'right' } = {}) {
  const leaf = (side, operation) => ({
    key: `${key}_${side}`,
    part_type: side === 'left' ? 'leftFrenchDoorLeafPart' : 'rightFrenchDoorLeafPart',
    values: {
      operation,
      casementTypeId: 'open_out',      // Integrate typeId 7
      thickness:     54,
      topHeight:     110,
      leftWidth:     110,
      rightWidth:    110,
      bottomHeight:  163,              // from the template, not the profile
      bottomHeightExternal: 170,
      btmRailShapeId: 'stepped',
      stormProofOverlap: 7,
      isMasterLeaf: masterLeaf === side,
      toBeReplaced: true,
    },
    children: [glassChild(`${key}_${side}`)],
  })
  return {
    key,
    part_type: 'frenchDoorPart',
    values: {
      casementTypeId: 'open_out',
      thickness: 54,
      midRail: 198,
      gapBetweenMeetingStiles: 5,
      meetingStileOverlap: 27,
      mullionThickness: 83,
      mechanicalClearanceTop: 3,
      mechanicalClearanceBottom: 3,
      mechanicalClearanceLeft: 1,
      mechanicalClearanceRight: 1,
      masterLeaf,
    },
    children: [leaf('left', 'left_hand_hung'), leaf('right', 'right_hand_hung')],
  }
}

/** The top-hung fanlight over the pair on FD3 / FD3b. */
function doorFanlight(key, { bottomHeight, bottomHeightExternal }) {
  return {
    key,
    part_type: 'casementSashPart',
    values: {
      operation: 'top_hung',
      casementTypeId: 'open_out',
      thickness: 54,
      topHeight: 62, leftWidth: 62, rightWidth: 62,
      bottomHeight, bottomHeightExternal,
      btmRailShapeId: 'stepped',
      // Integrate stores a different clearance per edge on this sash
      mechanicalClearanceTop: 1,
      mechanicalClearanceLeft: 1,
      mechanicalClearanceRight: 1,
      mechanicalClearanceBottom: 2,
      toBeReplaced: true,
    },
    children: [glassChild(key)],
  }
}

function transom(key, offset) {
  return {
    key,
    part_type: 'transomPart',
    values: {
      offset,
      thicknessInFrame: 41,
      transomStopSize: 18,
      startDivider: '0', endDivider: '0',
    },
    children: [],
  }
}

function doorTree({ width, height, dividers = [], openings, ironmongeryLines }) {
  return {
    key: 'item1',
    part_type: 'drawingItemPart',
    values: {
      typeOfWork:      'complete_new',
      // Solid Utile Hardwood throughout (Integrate material 44)
      frameMaterialId: 'utile',
      sashMaterialId:  'utile',
      cillMaterialId:  'utile',
      floorLevel:      'ground_floor',
      product:         'french_door',
      quantity:        1,
    },
    children: [
      {
        key: 'paint1',
        part_type: 'paintAndIronmongeryPart',
        values: {
          // Teknos Spray Finish Clean White both sides — a SINGLE finish,
          // which is what fires the three "- Single Finish" door rules.
          internalFinish: 'clean_white',
          externalFinish: 'clean_white',
          cillFinish: 'clean_white',
          cutOutBrickReveal: false,
          ironmongeryFinish: 'PB',
          ironmongeryLines: ironmongeryLines.map(l => ({ ...l })),
        },
        children: [],
      },
      { key: 'notes1', part_type: 'notesPart', values: {}, children: [] },
      { key: 'price1', part_type: 'pricePart', values: {}, children: [] },
      {
        key: 'frame1',
        part_type: 'assemblyFramePart',
        values: {
          width, height,
          leftWidth: 47, rightWidth: 47, topHeight: 47, bottomHeight: 37,
          frameDepth: 96, jambType: 'solid_profiled',
          frameHeadStopSize: 20, frameStileStopSize: 20, cillStopSize: 26,
          rakeFrame: false, archHead: false,
          toBeReplaced: true,
        },
        children: [
          ...dividers,
          ...openings,
          {
            key: 'cill1',
            part_type: 'cillPart',
            values: { height: 37, depth: 145 },
            children: [],
          },
        ],
      },
    ],
  }
}

// ── The stored ironmongery lists ─────────────────────────────────────────────

/** FD1 / FD2's template list. */
const DOOR_IRONMONGERY = [
  { product_short_name: '102mm_hinges', finish_code: 'PB', qty: 4, source: 'survey' },
  { product_short_name: 'double_euro_cylinder', finish_code: 'PB', qty: 1, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16', finish_code: 'Wht', qty: 1, source: 'survey' },
  { product_short_name: 'windsor_inline_handle', finish_code: 'PB', qty: 1, source: 'survey' },
]

/** FD3 keeps the template's fanlight ironmongery on top. */
const FANLIGHT_IRONMONGERY = [
  { product_short_name: 'connoisseur_handle_lh', finish_code: 'PB', qty: 1, source: 'survey' },
  { product_short_name: 'defender_310mm', finish_code: 'PC', qty: 1, source: 'survey' },
  { product_short_name: 'kenrick_extension_1210mm', finish_code: 'PC', qty: 2, source: 'survey' },
  { product_short_name: 'kenrick_extension_gear_box', finish_code: 'PC', qty: 1, source: 'survey' },
]

const DOOR_ASSUMPTIONS = [
  'Every FD drawing is SAVED in Integrate — doors recompute their allocated parts on save, which is what adds the multipoint-lock parts and the final section lengths',
  'The -6 per leaf and +14 per fanlight in the section lengths are single readings, confirmed fixed by FD1 -> FD2 (resizing moved every length by exactly the size change)',
  'The TRANSOM section (FD3) and a 62 mm fanlight bottom rail (FD3b) are GlazePro charges Integrate does not make — deliberate difference 7 in docs/integrate-differences.md',
  'installationMethod internally: ASSUMPTION, as the other fixtures; the engine does not read it',
]

// ── FD1: fully glazed French doors at the template size ──────────────────────
// 1899 x 2199, internal 1805 x 2115. Each leaf (1805 - 1 - 1 - 5 + 27) / 2
// = 912.5 by 2115 - 3 - 3 = 2109. Both leaves over 50 kg (54 kg), so
// "Any Door Overweight" charges 45 install minutes each.

export const BENCHMARK_FD1 = {
  name: 'Benchmark FD1 — French doors, fully glazed (L31115 Item 10 Drawing 1)',
  tree: doorTree({
    width: 1899, height: 2199,
    openings: [frenchDoorPair('fd1')],
    ironmongeryLines: DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkFD1_french_doors },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: DOOR_IRONMONGERY,
  profileCode: 'open_out_doors',
  assumptions: DOOR_ASSUMPTIONS,
}

// ── FD2: the same drawing resized to 1599 x 2099 ─────────────────────────────
// internal 1505 x 2015; each leaf 762.5 x 2009, 45 kg — under 50, so no
// overweight minutes and labour drops from 14.50 h to 13.00 h.

export const BENCHMARK_FD2 = {
  name: 'Benchmark FD2 — French doors resized to 1599 x 2099 (L31115 Item 10 Drawing 2)',
  tree: doorTree({
    width: 1599, height: 2099,
    openings: [frenchDoorPair('fd2')],
    ironmongeryLines: DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkFD2_french_doors_resized },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: DOOR_IRONMONGERY,
  profileCode: 'open_out_doors',
  assumptions: DOOR_ASSUMPTIONS,
}

// ── FD3: a top-hung fanlight over the pair, fanlight rail 86 ─────────────────
// 1350 x 2599, internal 1256 x 2515 = 399 + 41 + 2075. The fanlight is
// 1254 x 396 and the pair below 638 x 2069 each.

const FD3_OPENINGS = bottomRail => [
  doorFanlight('fan_a1', bottomRail),
  frenchDoorPair('fd3'),
]

export const BENCHMARK_FD3 = {
  name: 'Benchmark FD3 — French doors with a fanlight, rail 86 (L31115 Item 10 Drawing 3)',
  tree: doorTree({
    width: 1350, height: 2599,
    dividers: [transom('trans1', 399)],
    openings: FD3_OPENINGS({ bottomHeight: 86, bottomHeightExternal: 93 }),
    ironmongeryLines: [...DOOR_IRONMONGERY, ...FANLIGHT_IRONMONGERY],
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkFD3_french_doors_with_fanlight },
  // The target is INTEGRATE's figure and stays that way. GlazePro charges
  // more on purpose, so the benchmark page labels the difference instead of
  // calling it a failure (difference 7 in docs/integrate-differences.md).
  deliberateDifference: {
    cost: 17.08,
    reason: 'the transom, charged at Utile67x96 for the internal frame width (PROVISIONAL — no listed section fits 77 x 96)',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: [...DOOR_IRONMONGERY, ...FANLIGHT_IRONMONGERY],
  profileCode: 'open_out_doors',
  assumptions: DOOR_ASSUMPTIONS,
}

// ── FD3b: the same drawing with the fanlight rail set to 62 ──────────────────
// Integrate's 63x96 section disappears and NOTHING replaces it. Nathan
// (13 Oct): GlazePro charges the 62 rail at 63x63 for the sash width, as the
// 86 rail is charged at 63x96.

export const BENCHMARK_FD3b = {
  name: 'Benchmark FD3b — the same drawing, fanlight rail 62 (L31115 Item 10 Drawing 3, after the change)',
  tree: doorTree({
    width: 1350, height: 2599,
    dividers: [transom('trans1', 399)],
    openings: FD3_OPENINGS({ bottomHeight: 62, bottomHeightExternal: 69 }),
    ironmongeryLines: [...DOOR_IRONMONGERY, ...FANLIGHT_IRONMONGERY],
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkFD3b_french_doors_fanlight_rail_62 },
  deliberateDifference: {
    cost: 27.86,
    reason: 'the transom (17.08) and the 62 mm fanlight bottom rail at Utile63x63 (10.78), neither of which Integrate charges',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: [...DOOR_IRONMONGERY, ...FANLIGHT_IRONMONGERY],
  profileCode: 'open_out_doors',
  assumptions: DOOR_ASSUMPTIONS,
}
