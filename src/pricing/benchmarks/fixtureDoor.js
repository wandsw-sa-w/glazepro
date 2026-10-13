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
 * THE FOUR LOCK COSTS ARE INTEGRATE'S OWN PART COSTS, from its part list read
 * 13 Oct 2026 — and they are now in the live parts_catalogue too
 * (sql/step-az1, run 13 Oct), so offline and live read the same figures.
 *
 * They were first DERIVED BACKWARDS from Integrate's priced lines, because
 * none of the four codes existed in pf30-snapshot.json. That gave the right
 * four amounts attached to the WRONG THREE CODES: the allocator rules' own
 * labels, which were all there was to go on, do not say what the part is.
 * "Slave flush bolt" is the KEEP, and "Slave hinge keep 1997-2139" is a
 * SHOOTBOLT. The group total was right either way, which is exactly why it
 * went unnoticed.
 *
 * Code, Integrate's name, its cost, and the line it makes. "Ironmongery Cost"
 * is round(cost x qty, 0.1) x 1.05 — round() takes DECIMAL PLACES, floored,
 * so 0.1 means whole pounds:
 *   RJZ2382  Winkhaus Thunderbolt Master Multipoint Lock  50.83 -> 51 -> 53.55
 *   RHZ1648  Winkhaus Flushbolt LH                        89.47 -> 89 -> 93.45
 *   RHZ1653  Winkhaus FAB Shootbolt 399                   34.92 -> 35 -> 36.75
 *   RHZ1667  Adj Single Shootbolt Keep                     5.61 ->  6 ->  6.30
 * Those four lines are Integrate's, by name and to the penny
 * (docs/integrate-L31115-french-doors.txt), and benchmarks.test.js asserts
 * each code against its own line so a reshuffle cannot hide in the total.
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
  RJZ2382: 50.83,
  RHZ1648: 89.47,
  RHZ1653: 34.92,
  RHZ1667: 5.61,
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
          // Integrate stores both of these on the paint part (SD1 facts), and
          // the allocator reads isDoorMpls to add the multipoint lock.
          isDoorMpls: true,
          isFrontDoor: false,
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

// ═════════════════════════════════════════════════════════════════════════════
// Step BA — the variants: panelled leaves, and doorsets with side and top lights
// docs/integrate-L31115-french-doors.txt, "French door variants", read 13 Oct.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * A leaf MID RAIL. Integrate stores it as a TransomPart INSIDE the leaf with
 * `isMidrail` true — a divider in the leaf, exactly as a frame transom is a
 * divider in the frame — splitting the leaf into glass above and a panel
 * below. GlazePro models it the same way: a `transomPart` child of the leaf,
 * `isMidrail: true`, carrying the divider's own `offset` (the opening ABOVE
 * it), so the existing divider layout code measures it.
 *
 * FD4: 2109 − 110 (head) − 163 (bottom rail) = 1836 = 1241 + 170 + 425.
 */
function leafMidRail(key, { offset, thickness = 170 }) {
  return {
    key,
    part_type: 'transomPart',
    values: {
      isMidrail: true,
      offset,
      thicknessInFrame: thickness,
      midrailThickness: thickness,
      transomStopSize: 18,
      startDivider: '0', endDivider: '0',
    },
    children: [],
  }
}

/**
 * The Tricoya panel under a leaf's mid rail: raised and fielded BOTH sides,
 * ovolo bead both sides.
 *
 * Integrate stores the four option ids as numbers (internalPanelTypeId 110 =
 * Raised & Fielded, internalPanelBeadId 120 = Ovolo — its own defaults, in
 * docs/integrate-drawingboard-schema.txt). GlazePro stores CODES, as it does
 * for every other option, and the id-to-code mapping lives in
 * optionVocabulary.js so a tree imported from Integrate prices the same.
 *
 * NOT VERIFIED: that the live `reference_options` hold these two categories
 * under these codes. SECTION 0 of sql/step-ba2 asks for the rows.
 */
function doorPanel(key) {
  return {
    key,
    part_type: 'panelPart',
    values: {
      internalPanelTypeId: 'raised_and_fielded',
      externalPanelTypeId: 'raised_and_fielded',
      internalPanelBeadId: 'ovolo',
      externalPanelBeadId: 'ovolo',
      insulationThickness: 15,
      createVisionPanel: true,
      panelThickness: 0,
      toBeReplaced: true,
    },
    children: [],
  }
}

/**
 * FD4's pair: FD1's pair, but each leaf carries a mid rail, its glass ABOVE
 * the rail and a panel BELOW it.
 */
function panelledFrenchDoorPair(key, { masterLeaf = 'right', midRailOffset = 1241 } = {}) {
  const pair = frenchDoorPair(key, { masterLeaf })
  return {
    ...pair,
    children: pair.children.map(leaf => ({
      ...leaf,
      children: [
        leafMidRail(`${leaf.key}_midrail`, { offset: midRailOffset }),
        ...leaf.children,                   // the glass, above the rail
        doorPanel(`${leaf.key}_panel`),     // the panel, below it
      ],
    })),
  }
}

/** A FIXED casement sash in a door frame — a side light or a top light. */
function doorsetCasementSash(key, { bottomHeight = 86, bottomHeightExternal = 93 } = {}) {
  return {
    key,
    part_type: 'casementSashPart',
    values: {
      operation: 'fix',                // Integrate operation 11
      casementTypeId: 'open_out',
      thickness: 54,
      topHeight: 62, leftWidth: 62, rightWidth: 62,
      bottomHeight, bottomHeightExternal,
      btmRailShapeId: 'stepped',
      mechanicalClearanceTop: 1,
      mechanicalClearanceLeft: 1,
      mechanicalClearanceRight: 1,
      mechanicalClearanceBottom: 2,
      toBeReplaced: true,
    },
    children: [glassChild(key)],
  }
}

/**
 * A DIRECT GLAZED unit in a door frame: a glassPart that is a direct child of
 * the frame, its visible size the opening less 15 mm clearance all round and
 * its glass that plus what the rebate hides.
 *
 * FD5's A1 stores hidden 0 where B1 and D1 store 12 — an Integrate template
 * quirk the fixture KEEPS, because a fixture's job is Integrate's figures.
 * GlazePro's own template uses 12 on all three (brief §2).
 */
function doorsetDirectGlazed(key, { hidden = 12 } = {}) {
  return {
    key,
    part_type: 'glassPart',
    values: {
      ...GLASS_CODES,
      glazingRebateWidth: 15, glazingTolerance: 3,
      mechanicalClearanceTop: 15, mechanicalClearanceBottom: 15,
      mechanicalClearanceLeft: 15, mechanicalClearanceRight: 15,
      hiddenInRebateTop: hidden, hiddenInRebateBottom: hidden,
      hiddenInRebateLeft: hidden, hiddenInRebateRight: hidden,
      toBeReplaced: true,
    },
    children: [],
  }
}

function mullion(key, offset) {
  return {
    key,
    part_type: 'mullionPart',
    values: { offset, thicknessInFrame: 41, mullionStopSize: 20 },
    children: [],
  }
}

const DOORSET_ASSUMPTIONS = [
  ...DOOR_ASSUMPTIONS,
  'A doorset’s frame MULLIONS and TRANSOM are charged at Utile67x96 for their full internal length — Integrate allocates nothing for them. The reviewer applied Nathan’s transom decision to mullions for consistency (difference 11), flagged to Nathan',
  'A panel’s option ids are Integrate’s own defaults (110 Raised & Fielded, 120 Ovolo) from the drawing board schema; the live reference_options rows are NOT verified — SECTION 0 of sql/step-ba2 asks for them',
]

// ── FD4: panelled leaves (template 79) ───────────────────────────────────────
// 1399 x 2199, internal 1305 x 2115. Leaves (1305 − 1 − 1 − 5 + 27) / 2
// = 662.5 x 2109. Each leaf: a 170 mid rail at 1241, glass 442.5 x 1241 above
// it, and a raised-and-fielded Tricoya panel 442.5 x 425 below. Production is
// FD1's 3325 + 2 x 120 for the R&F panels; labour 780, both leaves under 50 kg.

export const BENCHMARK_FD4 = {
  name: 'Benchmark FD4 — French doors with panels (L31115 Item 10 Drawing 4)',
  tree: doorTree({
    width: 1399, height: 2199,
    openings: [panelledFrenchDoorPair('fd4')],
    ironmongeryLines: DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkFD4_french_doors_with_panels },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: DOOR_IRONMONGERY,
  profileCode: 'open_out_doors',
  assumptions: DOORSET_ASSUMPTIONS,
}

// ── FD5 / FD6: the doorsets (templates 29 and 46) ────────────────────────────
// 2814 x 2710, internal 2720 x 2626. Two full-height mullions (41) at 648 and
// 2028 and a full-width transom (41) at 448 give columns 648 / 1339 / 651 and
// rows 448 / 2137. The pair sits in the middle BOTTOM opening, a fixed
// casement sash each side of it, and the top row is three direct glazed units
// (FD5) or three fixed casement sashes (FD6).

const DOORSET_DIVIDERS = [mullion('mull_a', 648), mullion('mull_b', 2028), transom('trans_1', 448)]

export const BENCHMARK_FD5 = {
  name: 'Benchmark FD5 — French doorset, side lights and direct glazed top lights (L31115 Item 10 Drawing 5)',
  tree: doorTree({
    width: 2814, height: 2710,
    dividers: DOORSET_DIVIDERS,
    openings: [
      doorsetDirectGlazed('dgu_a1', { hidden: 0 }),
      doorsetDirectGlazed('dgu_b1'),
      doorsetDirectGlazed('dgu_d1'),
      doorsetCasementSash('side_a2'),
      frenchDoorPair('fd5'),
      doorsetCasementSash('side_d2'),
    ],
    ironmongeryLines: DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkFD5_french_doorset_sidelights_toplights },
  deliberateDifference: {
    cost: 108.42,
    reason: 'the frame mullions and transom, charged at Utile67x96 for their full internal length (2 x 2626 + 2720 = 7972 mm) — Integrate allocates no timber for them (PROVISIONAL, as the transom is)',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: DOOR_IRONMONGERY,
  profileCode: 'open_out_doors',
  assumptions: DOORSET_ASSUMPTIONS,
}

/** FD6's stored list is FD5's plus the XHD16 grille. */
const DOORSET_IRONMONGERY_FD6 = [
  ...DOOR_IRONMONGERY,
  { product_short_name: 'trickle', finish_code: 'Wht', qty: 1, source: 'survey' },
]

export const BENCHMARK_FD6 = {
  name: 'Benchmark FD6 — French doorset with casement top lights (L31115 Item 10 Drawing 6)',
  tree: doorTree({
    width: 2814, height: 2710,
    dividers: DOORSET_DIVIDERS,
    openings: [
      // The top row's three sashes are FANLIGHTS: row 0 of two rows, each
      // within its own column. Integrate's drawing has them at an 86 bottom
      // rail; GlazePro's own template uses Nathan's 62 (difference 5), which
      // moves those three rails from 63x96 to 63x63.
      doorsetCasementSash('fan_a1'),
      doorsetCasementSash('fan_b1'),
      doorsetCasementSash('fan_d1'),
      doorsetCasementSash('side_a2'),
      frenchDoorPair('fd6'),
      doorsetCasementSash('side_d2'),
    ],
    ironmongeryLines: DOORSET_IRONMONGERY_FD6,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkFD6_french_doorset_casement_lights },
  deliberateDifference: {
    cost: 108.42,
    reason: 'the frame mullions and transom, charged at Utile67x96 for their full internal length (2 x 2626 + 2720 = 7972 mm) — Integrate allocates no timber for them (PROVISIONAL, as the transom is)',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: DOORSET_IRONMONGERY_FD6,
  profileCode: 'open_out_doors',
  assumptions: DOORSET_ASSUMPTIONS,
}

// ═════════════════════════════════════════════════════════════════════════════
// Step BB — single garden doors (open out): SD1-SD4, and FD7's glazed panels
// docs/integrate-L31115-single-doors.txt, read 13 Oct 2026.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * A SINGLE door leaf. Integrate stores it as a plain `DoorLeafPart` DIRECTLY
 * in a frame opening — no pair part, which is the whole difference from a
 * French door (contrast `frenchDoorPart`).
 *
 * Its clearances are its OWN, and they are not a French pair's: 2 top,
 * 3 each side, 3 bottom, against the pair's 3 / 1 / 1 / 3. So a leaf in a
 * 1005 x 2115 opening is 999 x 2110, which `doorLeafSize` already works out
 * for a leaf with no pair.
 */
function singleDoorLeaf(key, { operation = 'left_hand_hung' } = {}) {
  return {
    key,
    part_type: 'doorLeafPart',
    values: {
      operation,                        // Integrate 17 LH / 18 RH / 11 Fix
      casementTypeId: 'open_out',       // typeId 7
      thickness: 54,
      topHeight: 110,
      leftWidth: 110,
      rightWidth: 110,
      bottomHeight: 163,
      bottomHeightExternal: 170,
      btmRailShapeId: 'stepped',
      mechanicalClearanceTop: 2,
      mechanicalClearanceLeft: 3,
      mechanicalClearanceRight: 3,
      mechanicalClearanceBottom: 3,
      // Integrate's board gave this leaf an ARCH HEAD when it was dropped
      // into an opening (archHeight 389.5), which priced shaped glass and
      // 240 minutes of swept-head work. The reviewer unticked it and
      // re-read; a GlazePro single door is square and never arched by
      // default (brief item 3).
      archHead: false,
      toBeReplaced: true,
    },
    children: [glassChild(key)],
  }
}

/** SD1-SD4's stored list: a SINGLE door takes two hinge pairs, not four. */
const SINGLE_DOOR_IRONMONGERY = [
  { product_short_name: '102mm_hinges', finish_code: 'PB', qty: 2, source: 'survey' },
  { product_short_name: 'double_euro_cylinder', finish_code: 'PB', qty: 1, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16', finish_code: 'Wht', qty: 1, source: 'survey' },
  { product_short_name: 'windsor_inline_handle', finish_code: 'PB', qty: 1, source: 'survey' },
]

const SINGLE_DOOR_ASSUMPTIONS = [
  ...DOOR_ASSUMPTIONS,
  'A single door leaf is a plain doorLeafPart in the frame opening, with its OWN clearances 2 / 3 / 3 / 3 — a French pair’s are 3 / 1 / 1 / 3',
  'The transom and the mullions are charged at Utile67x96 for their full internal length (differences 7b and 11) — Integrate allocates nothing for them',
  'Integrate’s board arrives at a dropped-in door leaf with Arch Head and Half Circle ON; the reviewer unticked them before reading, and a GlazePro single door is never arched by default',
]

// ── SD1: a plain single garden door (Integrate template 15) ──────────────────
// 1099 x 2199, internal 1005 x 2115, leaf 999 x 2110, glass 779 x 1837.
// Production 2180 min; labour 705 = Single Door Only 660 + Any Door
// Overweight 45 (the leaf is over 50 kg). EXACT in every line.

export const BENCHMARK_SD1 = {
  name: 'Benchmark SD1 — single garden door, fully glazed (L31115 Item 10 Drawing 7)',
  tree: doorTree({
    width: 1099, height: 2199,
    openings: [singleDoorLeaf('sd1_leaf')],
    ironmongeryLines: SINGLE_DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkSD1_single_door },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: SINGLE_DOOR_IRONMONGERY,
  profileCode: 'open_out_doors',
  assumptions: SINGLE_DOOR_ASSUMPTIONS,
}

// ── SD2: the same door with a fixed fanlight over ────────────────────────────
// 1099 x 2599, transom at 399; fanlight 1003 x 396 at the 86 rail, door
// 999 x 2070. Labour 825 = 660 + Fixed Fanlight 120 + Any Door Overweight 45.

export const BENCHMARK_SD2 = {
  name: 'Benchmark SD2 — single door with a fixed fanlight (L31115 Item 10 Drawing 9)',
  tree: doorTree({
    width: 1099, height: 2599,
    dividers: [transom('sd2_trans', 399)],
    openings: [
      doorsetCasementSash('sd2_fan'),
      singleDoorLeaf('sd2_leaf'),
    ],
    ironmongeryLines: SINGLE_DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkSD2_single_door_with_fanlight },
  deliberateDifference: {
    cost: 13.67,
    reason: 'the transom, charged at Utile67x96 for the internal frame width (1005 mm) — Integrate allocates nothing for it (PROVISIONAL)',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: SINGLE_DOOR_IRONMONGERY,
  profileCode: 'open_out_doors',
  assumptions: SINGLE_DOOR_ASSUMPTIONS,
}

// ── SD3: the door with one full-height side light beside it ──────────────────
// 1699 x 2199, mullion at 1005: the door in the LEFT column (1005) and a
// fixed side light 557 x 2112 in the right. Labour 870 = 660 + Fixed
// Fanlight 120 (Integrate's rule counts every fixed casement sash in a door)
// + Any Sash Overweight 45 (the side light is over 25 kg) + Any Door
// Overweight 45.

export const BENCHMARK_SD3 = {
  name: 'Benchmark SD3 — single door with a side light (L31115 Item 10 Drawing 10)',
  tree: doorTree({
    width: 1699, height: 2199,
    dividers: [mullion('sd3_mull', 1005)],
    openings: [
      singleDoorLeaf('sd3_leaf'),
      doorsetCasementSash('sd3_side'),
    ],
    ironmongeryLines: SINGLE_DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkSD3_single_door_with_sidelight },
  deliberateDifference: {
    cost: 28.76,
    reason: 'the mullion, charged at Utile67x96 for the internal frame height (2115 mm) — Integrate allocates nothing for it (PROVISIONAL)',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: SINGLE_DOOR_IRONMONGERY,
  profileCode: 'open_out_doors',
  assumptions: SINGLE_DOOR_ASSUMPTIONS,
}

// ── SD4: three columns by two rows, the door in the middle ───────────────────
// 2249 x 2599, mullions at 534 and 1580, transom at 399 — columns
// 534 / 1005 / 534 and rows 399 / 2075. Three fixed fanlights over a side
// light, the door, and a side light. Labour 1395 = 660 + Fixed Fanlight
// 120 x 5 + Any Sash Overweight 45 x 2 + Any Door Overweight 45.

export const BENCHMARK_SD4 = {
  name: 'Benchmark SD4 — single door with side lights and fanlights (L31115 Item 10 Drawing 11)',
  tree: doorTree({
    width: 2249, height: 2599,
    dividers: [mullion('sd4_mull_a', 534), mullion('sd4_mull_b', 1580), transom('sd4_trans', 399)],
    openings: [
      doorsetCasementSash('sd4_fan_a'),
      doorsetCasementSash('sd4_fan_b'),
      doorsetCasementSash('sd4_fan_c'),
      doorsetCasementSash('sd4_side_a'),
      singleDoorLeaf('sd4_leaf'),
      doorsetCasementSash('sd4_side_c'),
    ],
    ironmongeryLines: SINGLE_DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkSD4_single_doorset_sidelights_fanlights },
  deliberateDifference: {
    cost: 97.72,
    reason: 'the transom (2155 mm) and both mullions (2 x 2515 mm), charged at Utile67x96 for their full internal length — Integrate allocates nothing for them (PROVISIONAL)',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: SINGLE_DOOR_IRONMONGERY,
  profileCode: 'open_out_doors',
  assumptions: SINGLE_DOOR_ASSUMPTIONS,
}

// ── FD7: a French pair between two direct glazed side panels ─────────────────
// Integrate template 28, 2820 x 2199. Two full-height mullions give columns
// 618 / 1405 / 621; the pair's leaves are 712.5 x 2109. A1 keeps Integrate's
// hidden 0, D1 has 12 — the same template quirk as FD5's A1.
// A doorset of the Step BA family, benchmarked here because Nathan sells it.

export const BENCHMARK_FD7 = {
  name: 'Benchmark FD7 — French doors with glazed side panels (L31115 Item 10 Drawing 8)',
  tree: doorTree({
    width: 2820, height: 2199,
    dividers: [mullion('fd7_mull_a', 618), mullion('fd7_mull_b', 2064)],
    openings: [
      doorsetDirectGlazed('fd7_dgu_a', { hidden: 0 }),
      frenchDoorPair('fd7'),
      doorsetDirectGlazed('fd7_dgu_d'),
    ],
    ironmongeryLines: DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkFD7_french_doorset_dgu_sidelights },
  deliberateDifference: {
    cost: 57.53,
    reason: 'both frame mullions, charged at Utile67x96 for the internal frame height (2 x 2115 mm) — Integrate allocates nothing for them (PROVISIONAL)',
  },
  // The ONE figure in this step nobody has explained. FD7’s A1 is a direct
  // glazed unit with Integrate’s hidden-0 template quirk, 588 x 2085 =
  // 1.22598 m2. GlazePro prices 1.23 (round half up, as every other glass
  // line in every benchmark); Integrate prices 1.22, and its own D1 rounds
  // 1.29704 UP to 1.30 in the same drawing. Under the GBP 1.00 small-differences
  // policy it is PARKED, not closed, and nothing has been tuned to hide it:
  // 0.01 m2 x 58.50 + 0.2 kg x 0.17 = 0.62.
  parkedResidual: {
    cost: 0.62,
    reason: 'A1’s area: Integrate prices 1.22 m2 where 588 x 2085 is 1.22598, which rounds to 1.23 — and its own D1 rounds 1.29704 up to 1.30',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: DOOR_IRONMONGERY,
  profileCode: 'open_out_doors',
  assumptions: SINGLE_DOOR_ASSUMPTIONS,
}
