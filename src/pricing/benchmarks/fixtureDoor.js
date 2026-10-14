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

/**
 * Step BD: the open-in options. A FRONT door sits in the same frame part as
 * every other door, with three differences the facts file records: the
 * frame bottom (and so the cill) is 50 not 37, the finish is DUAL (Clean
 * White inside, Custom Colour TBC outside — which is what fires the three
 * "- Dual Finish" door rules instead of the "- Single Finish" ones), and
 * the paint part carries isFrontDoor.
 *
 * The defaults are the open-out garden door, so FD1-FD7, SD1-SD4 and
 * CD1-CD4 are untouched by construction.
 */
function doorTree({
  width, height, dividers = [], openings, ironmongeryLines, product = 'french_door',
  frameBottomHeight = 37, cillHeight = 37, isFrontDoor = false, isDoorMpls = true,
  internalFinish = 'clean_white', externalFinish = 'clean_white',
  frameArch = null,
}) {
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
      // Step BC item 0: a SINGLE door is product 'door', not
      // 'french_door' — the reviewer corrected sql/step-bb2 before running
      // it, and it is live that way. Cosmetic here: no rule reads product.
      product,
      quantity:        1,
    },
    children: [
      {
        key: 'paint1',
        part_type: 'paintAndIronmongeryPart',
        values: {
          // Teknos Spray Finish Clean White both sides — a SINGLE finish,
          // which is what fires the three "- Single Finish" door rules.
          internalFinish,
          externalFinish,
          cillFinish: 'clean_white',
          cutOutBrickReveal: false,
          ironmongeryFinish: 'PB',
          // Integrate stores both of these on the paint part (SD1 facts), and
          // the allocator reads isDoorMpls to add the multipoint lock.
          // Step BF: a STABLE door has no multipoint lock at all (Integrate
          // stores isDoorMpls false on all three), and with it true the
          // allocator gave each half a Winkhaus Thunderbolt — 107.10 of
          // ironmongery on a door whose whole stored set is 88.20.
          isDoorMpls,
          isFrontDoor,
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
          leftWidth: 47, rightWidth: 47, topHeight: 47, bottomHeight: frameBottomHeight,
          frameDepth: 96, jambType: 'solid_profiled',
          frameHeadStopSize: 20, frameStileStopSize: 20, cillStopSize: 26,
          rakeFrame: false, archHead: false,
          ...(frameArch ?? {}),
          toBeReplaced: true,
        },
        children: [
          ...dividers,
          ...openings,
          {
            key: 'cill1',
            part_type: 'cillPart',
            values: { height: cillHeight, depth: 145 },
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
 * The Tricoya panel in a leaf's cell: FLAT both sides, ovolo bead both
 * sides — which is what every Integrate door stores.
 *
 * Step BF: the ids are Integrate’s own, 110 = FLAT and 120 = Ovolo (read in
 * its panel-type dialog, 14 Oct). A FIXTURE keeps the id rather than
 * GlazePro’s code, because a fixture’s job is Integrate’s drawing and that
 * makes the id-to-code mapping part of what the benchmark proves. The BOARD
 * stores codes, as it does for every other option.
 *
 * Until this step 110 was mapped to raised_and_fielded (from the
 * French-door facts, which mislabel it), so every one of these panels was
 * priced R&F 120 where Integrate charges flat 60.
 *
 * NOT VERIFIED: that the live `reference_options` hold these two categories
 * under these codes. SECTION 0 of sql/step-ba2 asks for the rows.
 */
export const INTEGRATE_PANEL_FLAT = 110
export const INTEGRATE_PANEL_BEAD_OVOLO = 120

function doorPanel(key) {
  return {
    key,
    part_type: 'panelPart',
    values: {
      internalPanelTypeId: INTEGRATE_PANEL_FLAT,
      externalPanelTypeId: INTEGRATE_PANEL_FLAT,
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
  // Step BF follow-up: RESOLVED, and it is a decision.
  //
  // The reviewer re-read drawing 10/4 (310627) on 14 Oct: both panels are
  // internalPanelTypeId 110 / externalPanelTypeId 110 — FLAT. So FD4 is the
  // FT3 pattern, and its old penny-exact match was two errors cancelling:
  //
  //   Integrate   flat 2 x 60 + "Door Muntin" 2 x 60 (each leaf’s MID RAIL
  //               counted as a muntin)                        = 240
  //   GlazePro    R&F 2 x 120                                 = 240
  //
  // GlazePro now charges flat 2 x 60 and nothing for the mid rails, which
  // is Nathan’s decision d: a mid rail is not a muntin. 120 minutes less
  // than Integrate = -49.32, BY DESIGN on exactly the same ground as
  // FT1-FT4 (difference 19).
  deliberateDifference: {
    cost: -49.32,
    reason: '120 production minutes LESS than Integrate (-49.32): its two panels are FLAT (type 110, re-read 14 Oct) so they cost 60 each, and Integrate fires “Door Muntin” 60 for each leaf’s MID RAIL where GlazePro charges 60 per REAL muntin only (Nathan, decision d). The old penny-exact match was Integrate’s 2 x 60 + 2 x 60 against GlazePro’s old R&F 2 x 120',
  },
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
    product: 'door',
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
    product: 'door',
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
    product: 'door',
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
    product: 'door',
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

// ═════════════════════════════════════════════════════════════════════════════
// Step BC — single doors with FLAG frames: CD1-CD4, several frames in one item
// docs/integrate-L31115-single-doors.txt, "Coupled multi-frame doorsets".
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Integrate stores a door with flag lights as ONE item holding a
 * `containerPart` ("Frames", bayTypeId 176, partSpacing -47) with separate
 * `assemblyFrameParts` side by side, left to right.
 *
 * `partSpacing -47` is the coupling: each frame starts one jamb (47 mm) before
 * the previous one ends, so CD1's 693 + 995 + 693 set is 2287 mm overall and
 * not 2381. The frames are HEAD-ALIGNED (all at top 0) — flag lights are high
 * side windows over a wall, not floor-standing.
 */
export const CONTAINER_FRAME_SPACING_MM = -47

function frameNode(key, { width, height, dividers = [], openings }) {
  return {
    key,
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
      // Every frame is a WHOLE frame and carries its own cill, as Integrate's
      // does — which is Nathan's decision (a): GlazePro charges each one.
      { key: `${key}_cill`, part_type: 'cillPart', values: { height: 37, depth: 145 }, children: [] },
    ],
  }
}

/** A door item holding several frames, left to right. */
function coupledDoorTree({ frames, ironmongeryLines, product = 'door' }) {
  return {
    key: 'item1',
    part_type: 'drawingItemPart',
    values: {
      typeOfWork:      'complete_new',
      frameMaterialId: 'utile',
      sashMaterialId:  'utile',
      cillMaterialId:  'utile',
      floorLevel:      'ground_floor',
      product,
      quantity:        1,
    },
    children: [
      {
        key: 'paint1',
        part_type: 'paintAndIronmongeryPart',
        values: {
          internalFinish: 'clean_white',
          externalFinish: 'clean_white',
          cillFinish: 'clean_white',
          cutOutBrickReveal: false,
          ironmongeryFinish: 'PB',
          isDoorMpls: true,
          isFrontDoor: false,
          ironmongeryLines: ironmongeryLines.map(l => ({ ...l })),
        },
        children: [],
      },
      { key: 'notes1', part_type: 'notesPart', values: {}, children: [] },
      { key: 'price1', part_type: 'pricePart', values: {}, children: [] },
      {
        key: 'frames1',
        part_type: 'containerPart',
        values: {
          bayTypeId: 176,
          partSpacing: CONTAINER_FRAME_SPACING_MM,
          isCoupledInTheFactory: false,
          isBayPoleRequired: false,
          hasContinousSubCill: false,
          isCornerpostRequired: false,
        },
        children: frames,
      },
    ],
  }
}

/** A FLAG frame: one fixed casement light, and nothing else. */
function flagFrame(key, { width, height }) {
  return frameNode(key, {
    width, height,
    openings: [doorsetCasementSash(`${key}_light`)],
  })
}

/** A flag frame with a TOP-HUNG fanlight over a fixed light (CD4). */
function flagFrameWithFanlight(key, { width, height, transomOffset }) {
  const fan = doorsetCasementSash(`${key}_fan`)
  return frameNode(key, {
    width, height,
    dividers: [transom(`${key}_trans`, transomOffset)],
    openings: [
      // Integrate's operation 15 — the flag fanlights OPEN, which is what
      // makes them 90 install minutes each and what their Kenrick gear is for
      { ...fan, values: { ...fan.values, operation: 'top_hung' } },
      doorsetCasementSash(`${key}_light`),
    ],
  })
}

/** The door frame of a coupled set. */
function doorFrame(key, { width, height, operation = 'left_hand_hung', fanlight = null }) {
  return frameNode(key, {
    width, height,
    dividers: fanlight ? [transom(`${key}_trans`, fanlight.offset)] : [],
    openings: [
      ...(fanlight ? [doorsetCasementSash(`${key}_fan`)] : []),
      singleDoorLeaf(`${key}_leaf`, { operation }),
    ],
  })
}

/** CD2 / CD3's list is SD1's; CD1 adds the XHD16 grille. */
const COUPLED_IRONMONGERY_GRILLE = [
  ...SINGLE_DOOR_IRONMONGERY,
  { product_short_name: 'trickle', finish_code: 'Wht', qty: 1, source: 'survey' },
]

/** CD4 adds the top-hung flags' own gear. */
const COUPLED_IRONMONGERY_CD4 = [
  ...SINGLE_DOOR_IRONMONGERY,
  { product_short_name: 'connoisseur_handle_lh', finish_code: 'PB', qty: 2, source: 'survey' },
  { product_short_name: 'defender_209mm', finish_code: 'PC', qty: 2, source: 'survey' },
  { product_short_name: 'kenrick_extension_490mm', finish_code: 'PC', qty: 4, source: 'survey' },
  { product_short_name: 'kenrick_extension_gear_box', finish_code: 'PC', qty: 2, source: 'survey' },
]

const COUPLED_ASSUMPTIONS = [
  ...SINGLE_DOOR_ASSUMPTIONS,
  'The frames are HEAD-ALIGNED and coupled at partSpacing -47, so the set is one jamb narrower per joint than the sum of its frames (CD1: 2287, not 2381)',
  'Nathan’s decisions a-d: every frame’s own timber and cill are charged, ONE architrave round the whole set, +4 h fitting and +180 min workshop per flag frame. Integrate charges none of them',
  'CD4’s flag fanlights are Integrate operation 15 (top hung), which is what makes them 90 install minutes each rather than a fixed light’s 120',
]

// ── CD1: flag | single door | flag (Integrate template 70) ───────────────────
// Frames 693 x 1137 | 995 x 2101 | 693 x 1136, coupled to 2287 overall.
// Production 4260 min: the door frame's 855 ONCE, "Door Frame - Single Finish"
// 180 x 3 (frame_qty), LTW 25 PER FRAME, and the two flag lights as side
// lights (780 each) — they sit beside the door, not above a transom.

export const BENCHMARK_CD1 = {
  name: 'Benchmark CD1 — single door with a flag frame each side (L31115 Item 10 Drawing 12)',
  tree: coupledDoorTree({
    frames: [
      flagFrame('cd1_flag_a', { width: 693, height: 1137 }),
      doorFrame('cd1_door', { width: 995, height: 2101 }),
      flagFrame('cd1_flag_c', { width: 693, height: 1136 }),
    ],
    ironmongeryLines: COUPLED_IRONMONGERY_GRILLE,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkCD1_single_door_two_flag_frames },
  deliberateDifference: {
    cost: 591.03,
    reason: 'Nathan’s decisions a-d: each flag frame’s own timber (+61.82) and cill (+40.19), one architrave round the set (+19.38), +180 min workshop a flag frame (+147.96) and +4 h fitting a flag frame (+321.68)',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: COUPLED_IRONMONGERY_GRILLE,
  profileCode: 'open_out_doors',
  assumptions: COUPLED_ASSUMPTIONS,
}

// ── CD2: single door | flag right (template 71) ──────────────────────────────

export const BENCHMARK_CD2 = {
  name: 'Benchmark CD2 — single door with a flag frame to the right (L31115 Item 10 Drawing 13)',
  tree: coupledDoorTree({
    frames: [
      doorFrame('cd2_door', { width: 998, height: 2101 }),
      flagFrame('cd2_flag_b', { width: 693, height: 1136 }),
    ],
    ironmongeryLines: SINGLE_DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkCD2_single_door_flag_right },
  deliberateDifference: {
    cost: 303.49,
    reason: 'Nathan’s decisions a-d on one flag frame: its timber (+30.90) and cill (+20.10), the architrave (+17.67), +180 min workshop (+73.98) and +4 h fitting (+160.84)',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: SINGLE_DOOR_IRONMONGERY,
  profileCode: 'open_out_doors',
  assumptions: COUPLED_ASSUMPTIONS,
}

// ── CD3: flag left | single door (template 72) ───────────────────────────────

export const BENCHMARK_CD3 = {
  name: 'Benchmark CD3 — single door with a flag frame to the left (L31115 Item 10 Drawing 14)',
  tree: coupledDoorTree({
    frames: [
      flagFrame('cd3_flag_a', { width: 696, height: 1136 }),
      doorFrame('cd3_door', { width: 1001, height: 2101 }),
    ],
    ironmongeryLines: SINGLE_DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkCD3_single_door_flag_left },
  deliberateDifference: {
    cost: 303.57,
    reason: 'Nathan’s decisions a-d on one flag frame: its timber (+30.90) and cill (+20.18), the architrave (+17.67), +180 min workshop (+73.98) and +4 h fitting (+160.84)',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: SINGLE_DOOR_IRONMONGERY,
  profileCode: 'open_out_doors',
  assumptions: COUPLED_ASSUMPTIONS,
}

// ── CD4: flag + fan | door with fanlight | flag + fan (template 69) ──────────
// Every frame has a transom: the two flags carry a TOP-HUNG fanlight over a
// fixed light, the door frame a FIXED fanlight over the leaf. So A1, B1 and C1
// are fanlights of their own frames (300 min each) and A2 / C2 side lights
// (780) — which is the whole point of scoping is_fanlight per frame.

export const BENCHMARK_CD4 = {
  name: 'Benchmark CD4 — single door with flag and fan lights (L31115 Item 10 Drawing 15)',
  tree: coupledDoorTree({
    frames: [
      flagFrameWithFanlight('cd4_flag_a', { width: 650, height: 1632, transomOffset: 348 }),
      doorFrame('cd4_door', {
        width: 1082, height: 2496, operation: 'right_hand_hung', fanlight: { offset: 348 },
      }),
      flagFrameWithFanlight('cd4_flag_c', { width: 650, height: 1632, transomOffset: 348 }),
    ],
    ironmongeryLines: COUPLED_IRONMONGERY_CD4,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkCD4_single_door_flag_and_fan_lights },
  deliberateDifference: {
    cost: 646.34,
    reason: 'Nathan’s decisions a-d: each flag frame’s own timber and transom (+117.34) and cill (+37.70), one architrave round the set (+21.66), +180 min workshop a flag frame (+147.96) and +4 h fitting a flag frame (+321.68)',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: COUPLED_IRONMONGERY_CD4,
  profileCode: 'open_out_doors',
  assumptions: COUPLED_ASSUMPTIONS,
}

// ═════════════════════════════════════════════════════════════════════════════
// Step BD — FRONT DOORS (open in, panelled): FT1-FT3
// docs/integrate-L31115-front-doors.txt, L31115 item 10 drawings 16-18,
// read and priced 13 Oct 2026. All three are SAVED drawings.
//
// A front door is an OPEN IN door (Integrate range open_in_doors, leaf
// typeId 8) and differs from the open-out garden door of Step BB in four
// ways that reach the price:
//   - the frame bottom and the cill are 50, not 37;
//   - the leaf's clearances are 3 / 4 / 4 / 14 against the garden door's
//     2 / 3 / 3 / 3, and its bottom rail is 170;
//   - the leaf carries its OWN GRID — a 120 muntin and a mid rail — with a
//     Tricoya panel (or a glass unit) in each cell;
//   - the finish is DUAL (Clean White in, Custom Colour TBC out), so the
//     three "- Dual Finish" door rules fire instead of the single-finish ones.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The open_in_doors profile. Integrate's own values, from the facts file.
 *
 * The leaf keys are what the BOARD reads when a surveyor drops a front door
 * in; the fixtures carry the same figures on the nodes, as every other door
 * fixture does.
 */
export const OPEN_IN_PROFILE_VALUES = {
  ...DOOR_PROFILE_VALUES,
  // the frame: a 50 bottom and a 50 cill, not the garden door's 37
  'assemblyFramePart.bottomHeight': 50,
  'cillPart.height': 50,
  // the leaf
  'doorLeafPart.thickness': 54,
  'doorLeafPart.topHeight': 110,
  'doorLeafPart.leftWidth': 110,
  'doorLeafPart.rightWidth': 110,
  'doorLeafPart.bottomHeight': 170,
  'doorLeafPart.mechanicalClearanceTop': 3,
  'doorLeafPart.mechanicalClearanceLeft': 4,
  'doorLeafPart.mechanicalClearanceRight': 4,
  'doorLeafPart.mechanicalClearanceBottom': 14,
  'doorLeafPart.defaultMuntinThickness': 120,
  'doorLeafPart.midrailThickness': 170,
}

/** A muntin INSIDE a leaf: a vertical divider of the leaf's own grid. */
function leafMuntin(key, { offset, thickness = 120 }) {
  return {
    key,
    part_type: 'mullionPart',
    values: {
      isMuntin: true,
      offset,
      thicknessInFrame: thickness,
      muntinThickness: thickness,
      mullionStopSize: 0,
      startDivider: '0', endDivider: '0',
    },
    children: [],
  }
}

/** A raised-and-fielded Tricoya panel, as doorPanel but with its own key. */
function frontDoorPanel(key) {
  return doorPanel(key)
}

/**
 * A front door leaf: open in, its own clearances and rails, and its own grid.
 *
 * `cells` are the leaf's children in CELL ORDER (left to right, top row
 * first) — a panel or a glass unit each, exactly as the frame's openings sit
 * in the frame's cells.
 */
function frontDoorLeaf(key, {
  operation = 'left_hand_hung',
  bottomHeight = 170,
  dividers = [],
  cells = [],
  arch = null,
} = {}) {
  return {
    key,
    part_type: 'doorLeafPart',
    values: {
      operation,                      // Integrate 17 LH / 18 RH
      casementTypeId: 'open_in',      // Integrate typeId 8
      thickness: 54,
      topHeight: 110,
      leftWidth: 110,
      rightWidth: 110,
      bottomHeight,
      bottomHeightExternal: bottomHeight,
      btmRailShapeId: 'stepped',
      // open IN: Integrate's own clearances, which are not a garden door's
      mechanicalClearanceTop: 3,
      mechanicalClearanceLeft: 4,
      mechanicalClearanceRight: 4,
      mechanicalClearanceBottom: 14,
      defaultMuntinThickness: 120,
      archHead: false,
      ...(arch ?? {}),
      toBeReplaced: true,
    },
    children: [...dividers, ...cells],
  }
}

/**
 * FT1-FT3's stored ironmongery: Integrate's Balham set.
 *
 * av3_heritage_locking_system_lh is a SET of four parts in the live
 * catalogue (a thumbturn cylinder, the AV4 Heritage Lock, a pocket keep and
 * a centre keep w dayswitch) — which is how GlazePro holds what Integrate's
 * ALLOCATOR adds on save. Integrate prices RIGHT-hand AV4 parts on this
 * LEFT-hand door and so does the live GlazePro set; brief item 7.
 */
const FRONT_DOOR_IRONMONGERY = [
  { product_short_name: '102mm_hinges', finish_code: 'PB', qty: 2, source: 'survey' },
  { product_short_name: 'av3_heritage_locking_system_lh', finish_code: 'PC', qty: 1, source: 'survey' },
  { product_short_name: 'euro_cylinder_pull', finish_code: 'PB', qty: 1, source: 'survey' },
  { product_short_name: 'premium_letter_tidy', finish_code: 'PB', qty: 1, source: 'survey' },
  { product_short_name: 'small_letterplate', finish_code: 'PB', qty: 1, source: 'survey' },
]

const FRONT_DOOR_ASSUMPTIONS = [
  'Every FT drawing is SAVED in Integrate — a door recomputes its allocated sections on save',
  'The leaf grid is stored as the leaf\'s OWN dividers (a 120 mullionPart muntin and a transomPart mid rail) with a panel or a glass unit per cell, which is how Integrate stores it',
  'btmRailShapeId 99 on Integrate\'s front door leaf is mapped to GlazePro\'s "stepped": NOT VERIFIED, and no rule reads it',
  'The open-in clearances 3 / 4 / 4 / 14 and the 50 cill are single readings from drawings 16-18, consistent across all three',
]

// ── FT1: the Balham, on its own (Integrate template 128168) ──────────────────
// 1099 x 2182; leaf 997 x 2068, leaf interior 777 x 1788. A 120 muntin at
// 373 and a 170 mid rail at 983 give four cells: 373 x 983, 284 x 983,
// 373 x 635, 284 x 635 — four raised-and-fielded Tricoya panels, no glass.

export const BENCHMARK_FT1 = {
  name: 'Benchmark FT1 — front door, four panels (L31115 Item 10 Drawing 16)',
  tree: doorTree({
    width: 1099, height: 2182,
    openings: [frontDoorLeaf('ft1_leaf', {
      dividers: [
        leafMuntin('ft1_muntin', { offset: 373 }),
        leafMidRail('ft1_midrail', { offset: 983, thickness: 170 }),
      ],
      cells: [
        frontDoorPanel('ft1_panel_a1'),
        frontDoorPanel('ft1_panel_b1'),
        frontDoorPanel('ft1_panel_a2'),
        frontDoorPanel('ft1_panel_b2'),
      ],
    })],
    product: 'door',
    frameBottomHeight: 50,
    cillHeight: 50,
    isFrontDoor: true,
    internalFinish: 'clean_white',
    // The paint_finish option code for Integrate's “Custom Colour TBC” is
    // 'custom' (reviewer, 14 Oct): 'custom_colour_tbc' is not an option at
    // all. No rule reads the VALUE — only whether the two sides differ — so
    // this moves no money; it stops a drawing carrying a code the board
    // cannot show.
    externalFinish: 'custom',
    ironmongeryLines: FRONT_DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkFT1_front_door_balham },
  // Step BF: the panels are FLAT (type 110), so Integrate’s flat-panel 60
  // was right and GlazePro’s R&F 120 was the error. What is left of
  // decision d is the muntin, and it makes GlazePro CHEAPER:
  //   +30.94  the leaf’s 120 muntin at Utile63x120 (1788 mm), PROVISIONAL
  //   and 60 production minutes LESS than Integrate (-24.66):
  //   Integrate counts a leaf’s MID RAIL as a muntin and fires "Door Muntin"
  //   60 for it; GlazePro charges 60 per REAL muntin only, which is the half
  //   of Nathan’s decision d that survived the panel-type correction.
  deliberateDifference: {
    cost: 6.28,
    reason: 'the leaf’s 120 muntin at Utile63x120 for its interior height (1788 mm, +30.94, PROVISIONAL — Integrate allocates nothing for it), LESS 60 production minutes (-24.66): Integrate counts the leaf’s mid rail as a second muntin and GlazePro charges 60 per REAL muntin only (Nathan, decision d)',
  },
  // The three AV4 parts the live catalogue holds at cost 0 — the Heritage
  // lock (112.35), the pocket keep (5.25) and the centre keep w dayswitch
  // (31.50), Integrate’s own prices. sql/step-bd1 gives the reviewer the
  // rows; until it is run every front door is 149.10 light, and the row
  // declares it rather than reading FAIL.
  //
  // AND FT1’s production: GlazePro fires Door Leaf 1035 + Machining &
  // Joining a Door Frame 855 + Door Frame Dual Finish 240 + Door Leaf Dual
  // Finish 180 + 4 x Additional for R&F Panel 120 = 2790 min (46.50 h),
  // where Integrate charges 2670 (44.50 h). The 120 is UNEXPLAINED and the
  // reviewer settles it with Integrate — nothing here is tuned to it.
  //   -149.10 (the catalogue rows) + 49.32 (2 h of production) = -99.78
  // RESOLVED 14 Oct (Step BE): the 120 minutes were two Integrate errors,
  // read in its own Estimated Labour Time editor — rule 1240 flat-panel
  // 60 x 4 on panels that ARE type-110 R&F, and rule 1235 Door Muntin
  // twice on a leaf with one muntin and one mid rail. GlazePro corrects
  // both, so the difference is a DECISION and no longer pending.
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: OPEN_IN_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: FRONT_DOOR_IRONMONGERY,
  profileCode: 'open_in_doors',
  assumptions: FRONT_DOOR_ASSUMPTIONS,
}

// ── FT2: the Balham leaf under a direct glazed fanlight (template 22253) ─────
// 1099 x 2595, a 41 transom at 431. The FANLIGHT IS A DIRECT GLAZED UNIT —
// a glassPart straight in the frame, not a casement sash — and the leaf is
// 997 x 2009 with glass above a 170 mid rail and one panel below.

export const BENCHMARK_FT2 = {
  name: 'Benchmark FT2 — front door with a direct glazed fanlight (L31115 Item 10 Drawing 17)',
  tree: doorTree({
    width: 1099, height: 2595,
    dividers: [transom('ft2_trans', 431)],
    openings: [
      // Integrate stores 15 clearance all round and 15 hidden in the rebate,
      // so the cut glass is the opening itself: 1005 x 431 = 0.43 m2.
      doorsetDirectGlazed('ft2_fan', { hidden: 15 }),
      frontDoorLeaf('ft2_leaf', {
        dividers: [leafMidRail('ft2_midrail', { offset: 941, thickness: 170 })],
        cells: [
          glassChild('ft2_leaf'),          // the glass, above the rail
          frontDoorPanel('ft2_panel'),     // the panel, below it
        ],
      }),
    ],
    product: 'door',
    frameBottomHeight: 50,
    cillHeight: 50,
    isFrontDoor: true,
    internalFinish: 'clean_white',
    // The paint_finish option code for Integrate's “Custom Colour TBC” is
    // 'custom' (reviewer, 14 Oct): 'custom_colour_tbc' is not an option at
    // all. No rule reads the VALUE — only whether the two sides differ — so
    // this moves no money; it stops a drawing carrying a code the board
    // cannot show.
    externalFinish: 'custom',
    ironmongeryLines: FRONT_DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkFT2_front_door_fanlight },
  // Step BF: +13.67 of transom, less 60 production minutes (-24.66) for the
  // mid rail Integrate counts as a muntin. The panels are FLAT either way.
  deliberateDifference: {
    cost: -10.99,
    reason: 'the frame transom at Utile67x96 for the internal frame width (1005 mm, +13.67, PROVISIONAL — Integrate allocates nothing for it), LESS 60 production minutes (-24.66) for the mid rail Integrate counts as a muntin (Nathan, decision d)',
  },
  // sql/step-bd1 is RUN LIVE (14 Oct): the three AV4 parts have their costs
  // and this row is Integrate’s own figure plus its declared timber, with
  // nothing pending at all.
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: OPEN_IN_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: FRONT_DOOR_IRONMONGERY,
  profileCode: 'open_in_doors',
  assumptions: FRONT_DOOR_ASSUMPTIONS,
}

// ── FT3: the arched front door (Integrate template 6619) ─────────────────────
// 1099 x 2199 with a segmental arch at FRAME level (rise 508.891, radius
// 551.121, shoulders 1690) and an arched leaf (rise 345.92, radius 391.12,
// shoulder 1459.08). Shaped glass over a 120 mid rail and one panel.

export const BENCHMARK_FT3 = {
  name: 'Benchmark FT3 — arched front door (L31115 Item 10 Drawing 18)',
  tree: doorTree({
    width: 1099, height: 2199,
    openings: [
      frontDoorLeaf('ft3_leaf', {
        // curvedSashHead is what fires "Additional for Curved Head (Door)"
        // 360; archHead + archHeight are what make the GLASS shaped.
        arch: {
          archHead: true,
          archHeight: 345.92,
          archRadius: 391.12,
          curvedSashHead: true,
          shoulderHeight: 1459.08,
        },
        dividers: [leafMidRail('ft3_midrail', { offset: 1103, thickness: 120 })],
        cells: [
          glassChild('ft3_leaf'),
          frontDoorPanel('ft3_panel'),
        ],
      }),
    ],
    product: 'door',
    frameBottomHeight: 50,
    cillHeight: 50,
    isFrontDoor: true,
    internalFinish: 'clean_white',
    // The paint_finish option code for Integrate's “Custom Colour TBC” is
    // 'custom' (reviewer, 14 Oct): 'custom_colour_tbc' is not an option at
    // all. No rule reads the VALUE — only whether the two sides differ — so
    // this moves no money; it stops a drawing carrying a code the board
    // cannot show.
    externalFinish: 'custom',
    // The frame's own arch. curvedFrameHead fires both frame rules
    // ("Additional Frame Curved Head (Door)" and "Additional Frame Swept
    // Head (Door)", 240 each); archHead is deliberately NOT set, because on
    // a frame that is GlazePro's legacy spelling for a top-sash arch and it
    // would fire the 240 swept-head sash rule instead of the 360 curved one.
    frameArch: {
      curvedFrameHead: true,
      frameLevelArchHead: true,
      frameLevelArchHeight: 508.891,
      frameLevelArchRadius: 551.121,
      archShoulderLeft: 1690,
      archShoulderRight: 1690,
    },
    ironmongeryLines: FRONT_DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkFT3_front_door_arched },
  // Step BF: +13.45 of mid-rail timber +23.28 of shaped glass, less 60
  // production minutes (-24.66) for the mid rail Integrate counts as a
  // muntin. Its one panel is FLAT, as Integrate has it.
  deliberateDifference: {
    cost: 12.07,   // 13.45 mid rail + 23.28 shaped glass - 24.66 production
    reason: 'the leaf’s 120 mid rail at Utile63x120 for its interior width (777 mm, +13.45, PROVISIONAL), the SHAPED GLASS (+23.28): 1.13 m2 at the square rate against Integrate’s 0.62 at its shaped rate — the largest rectangle of the cut glass (801 x 1127) plus the supplier’s quarter (Nathan, decision e) with the energy surcharge following it — LESS 60 production minutes (-24.66) for the mid rail Integrate counts as a muntin',
  },
  // sql/step-bd1 is RUN LIVE (14 Oct): the three AV4 parts have their costs
  // and this row is Integrate’s own figure plus its declared timber, with
  // nothing pending at all.
  // NOT a small difference, and NOT a decision: the arched leaf’s GLASS.
  // GlazePro prices 0.83 m2 of shaped glass, Integrate 0.62, on the same
  // 777 x 1103 sightline with a 345.92 rise. GlazePro’s model is the one
  // that reproduces benchmark C exactly (the sightline shape grown by the
  // cover, arc concentric), so the shallow-arch case is right and this
  // NEAR-SEMICIRCULAR head is not: with radius 391.12 against a 777
  // chord, the head’s inner edge spans only 2 x (391.12 - 110) = 562, so
  // the glass is narrower than the leaf interior and the rail’s feet eat
  // the top corners. A rectangle 562 x 822 plus a semicircular head,
  // CLOSED 14 Oct (Step BE, Nathan’s decision e). The question was which of
  // two models described the glass; the answer is NEITHER — a shaped unit is
  // billed on the SHEET the supplier cuts it from. The largest rectangle of
  // the cut glass (801 x 1127 = 0.902727 m2) plus a quarter = 1.13 m2, at
  // the SQUARE rate, on every product. Integrate’s 0.62 at a shaped rate of
  // 71.875 is wrong twice over, and GlazePro’s own exact-shape 0.83 was
  // measuring the glass rather than the bill.
  // sql/step-be1 is RUN LIVE (14 Oct): a shaped unit is priced at the
  // SQUARE rate, so the quarter is on the area alone and this row has
  // nothing pending. The captured snapshot pre-dates the run, which is why
  // the offline tests apply withShapedGlassRate.
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: OPEN_IN_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: FRONT_DOOR_IRONMONGERY,
  profileCode: 'open_in_doors',
  assumptions: FRONT_DOOR_ASSUMPTIONS,
}

// ── FT4: the Balham with a FIXED SIDE LIGHT (Nathan's drawing 20) ───────────
// One 1400 x 2182 frame with a 41 mullion at 900: the door in the left
// column (900) and a FIXED CASEMENT SASH in the right (365). Nathan's
// decision g, 14 Oct: a side light is a casement sash, not a fixed door leaf
// — and it carries the same grid a leaf does, glass over a panel, its mid
// rail lining up with the door's.
//
// Integrate's own tree, as read: the door's muntin and mid rail are CENTRED
// (276 / 276 across, 834 / 834 down) because that is how Nathan drew it; the
// TEMPLATE keeps Integrate's Balham layout (983 / 635), which is decision f.

/**
 * A FIXED SIDE LIGHT: a casement sash beside the door, holding a mid rail
 * with glass above and a raised-and-fielded panel below.
 *
 * Integrate draws it 359 x 2079 in a 365 x 2085 opening, which is 3 mm of
 * clearance on every edge. NOT VERIFIED (the facts give the drawn size, not
 * the clearances) — but 3 / 3 / 3 / 3 reproduces both figures exactly, where
 * a doorset fanlight's 1 / 1 / 1 / 2 gives 363 x 2082.
 */
function frontDoorSideLight(key, {
  bottomHeight = 175,
  midRailOffset = 888,
  midRailThickness = 120,
  midRailProperty = 170,
} = {}) {
  return {
    key,
    part_type: 'casementSashPart',
    values: {
      operation: 'fix',                 // Integrate operation 11
      casementTypeId: 'open_in',
      thickness: 54,
      topHeight: 62, leftWidth: 62, rightWidth: 62,
      bottomHeight,
      bottomHeightExternal: bottomHeight,
      btmRailShapeId: 'stepped',
      mechanicalClearanceTop: 3,
      mechanicalClearanceBottom: 3,
      mechanicalClearanceLeft: 3,
      mechanicalClearanceRight: 3,
      toBeReplaced: true,
    },
    children: [
      // The mid rail is DRAWN at 120 with a midrailThickness property of 170,
      // which is what Integrate stores. The drawn figure is what divides the
      // sash (888 + 120 + 834 = its 1842 interior) and what decides the
      // section, so both are kept.
      {
        key: `${key}_midrail`,
        part_type: 'transomPart',
        values: {
          isMidrail: true,
          offset: midRailOffset,
          thicknessInFrame: midRailThickness,
          midrailThickness: midRailProperty,
          transomStopSize: 18,
          startDivider: '0', endDivider: '0',
        },
        children: [],
      },
      glassChild(key),
      doorPanel(`${key}_panel`),
    ],
  }
}

export const BENCHMARK_FT4 = {
  name: 'Benchmark FT4 — front door with a fixed side light (L31115 Item 10 Drawing 20)',
  tree: doorTree({
    width: 1400, height: 2182,
    dividers: [mullion('ft4_mull', 900)],
    openings: [
      frontDoorLeaf('ft4_leaf', {
        dividers: [
          leafMuntin('ft4_muntin', { offset: 276 }),
          // drawn 120, property 170 — Integrate's own drawing 20
          {
            key: 'ft4_midrail',
            part_type: 'transomPart',
            values: {
              isMidrail: true,
              offset: 834,
              thicknessInFrame: 120,
              midrailThickness: 170,
              transomStopSize: 18,
              startDivider: '0', endDivider: '0',
            },
            children: [],
          },
        ],
        cells: [
          frontDoorPanel('ft4_panel_a1'),
          frontDoorPanel('ft4_panel_b1'),
          frontDoorPanel('ft4_panel_a2'),
          frontDoorPanel('ft4_panel_b2'),
        ],
      }),
      frontDoorSideLight('ft4_side'),
    ],
    product: 'door',
    frameBottomHeight: 50,
    cillHeight: 50,
    isFrontDoor: true,
    internalFinish: 'clean_white',
    externalFinish: 'custom',
    ironmongeryLines: FRONT_DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkFT4_front_door_side_light },
  // Three charges, each recomputed from a length and a per-metre cost:
  //   the frame MULLION    2085 mm at Utile67x96  13.60/m = 28.36  (difference 11)
  //   the leaf MUNTIN      1788 mm at Utile63x120 17.30/m = 30.93  (difference 13)
  //   the leaf 120 MID RAIL 672 mm at Utile63x120 17.30/m = 11.63  (difference 13)
  //                                                       = 70.92
  // and 180 production minutes at 24.66/h = 73.98 — Integrate’s flat-panel
  // error on five type-110 R&F panels (-300) and its mid-rail-as-muntin
  // firings (+120 for two rails, against the one real muntin’s 60).
  // Step BF: the five panels are FLAT, so what is left is the timber and
  // TWO mid rails Integrate counts as muntins (-120 min, -49.32).
  deliberateDifference: {
    cost: 21.60,
    reason: 'the frame mullion (2085 mm at Utile67x96, +28.36), the leaf’s 120 muntin (1788 mm) and its 120 mid rail (672 mm) at Utile63x120 (+42.56) — Integrate allocates nothing for any of the three (PROVISIONAL) — LESS 120 production minutes (-49.32) for the TWO mid rails Integrate counts as muntins (Nathan, decision d)',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: OPEN_IN_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: FRONT_DOOR_IRONMONGERY,
  profileCode: 'open_in_doors',
  assumptions: [
    ...FRONT_DOOR_ASSUMPTIONS,
    'The side light is a FIXED CASEMENT SASH (Nathan, decision g), with its own mid rail, glass and panel — not a fixed door leaf',
    'Its clearances 3 / 3 / 3 / 3 are NOT VERIFIED: they are what reproduces Integrate\'s drawn 359 x 2079 in a 365 x 2085 opening',
  ],
}

// ═════════════════════════════════════════════════════════════════════════════
// Step BF — STABLE DOORS: ST1, ST2, ST3
// docs/integrate-L31115-stable-doors.txt, L31115 item 10 drawings 21-23,
// read and priced 14 Oct 2026. All three SAVED.
//
// Integrate stores a StableDoorPart in the frame holding a TOP and a BOTTOM
// stable leaf. GlazePro stores the container with two ordinary doorLeafParts
// in it, each marked `stableHalf`, so door_leaf_qty is 2 and every rule that
// knows a door leaf needs no change — which is what Integrate's own editor
// shows it does: "Door Leaf" 1035 fires PER HALF.
//
// Frame 1099 x 2207, cill 50, interior 1005 x 2110. The container takes
// 4 / 4 / 4 / 3 off that (997 x 2103) and the split is STORED: the top half
// is 1055 and the bottom 1048, which is Integrate's own drawing — not half
// each. The halves' rails differ (top 110 / 99, bottom 99 / 170), so the
// cells are 777 x 846 and 777 x 779, and those are the panels it prices.
//
// SINGLE finish (Clean White both sides and the cill), isFrontDoor false,
// isDoorMpls false.
// ═════════════════════════════════════════════════════════════════════════════

export const STABLE_DOOR_CLEARANCES = { top: 4, left: 4, right: 4, bottom: 3, between: 3 }
export const STABLE_TOP_SPLIT_MM = 1055

/** One half of a stable door: a door leaf with its own rails and one cell. */
function stableHalf(key, half, { cells = [], bottomHeight, topHeight }) {
  return {
    key,
    part_type: 'doorLeafPart',
    values: {
      stableHalf: half,
      operation: 'left_hand_hung',
      casementTypeId: 'open_in',
      thickness: 54,
      topHeight,
      leftWidth: 110,
      rightWidth: 110,
      bottomHeight,
      bottomHeightExternal: bottomHeight,
      btmRailShapeId: 'stepped',
      archHead: false,
      toBeReplaced: true,
    },
    children: cells,
  }
}

/**
 * The stable-door container: the two halves, and the split between them.
 *
 * The clearances are the CONTAINER's (Integrate stores them there, as it does
 * a French pair's), and `splitOffset` is the top half's height — the same
 * "offset is the span before it" convention every divider follows.
 */
function stableDoor(key, { top, bottom, splitOffset = STABLE_TOP_SPLIT_MM }) {
  return {
    key,
    part_type: 'stableDoorPart',
    values: {
      thickness: 58,
      splitOffset,
      mechanicalClearanceTop:    STABLE_DOOR_CLEARANCES.top,
      mechanicalClearanceLeft:   STABLE_DOOR_CLEARANCES.left,
      mechanicalClearanceRight:  STABLE_DOOR_CLEARANCES.right,
      mechanicalClearanceBottom: STABLE_DOOR_CLEARANCES.bottom,
      clearanceBetweenHalves:    STABLE_DOOR_CLEARANCES.between,
      toBeReplaced: true,
    },
    children: [top, bottom],
  }
}

/** A VISION PANEL: a small glass unit inside a panel (Integrate's ST2). */
function visionPanel(key, { width = 200, height = 350 } = {}) {
  return {
    key,
    part_type: 'glassPart',
    values: {
      ...GLASS_CODES,
      glazingRebateWidth: 15, glazingTolerance: 3,
      // A vision panel's size is its OWN, not a cell's: it is a hole cut in
      // the panel, and the panel is still charged in full.
      visionPanelWidth: width,
      visionPanelHeight: height,
      isVisionPanel: true,
      toBeReplaced: true,
    },
    children: [],
  }
}

/** ST1 / ST3's stored list. ST2 has none. */
const STABLE_DOOR_IRONMONGERY = [
  { product_short_name: '102mm_hinges', finish_code: 'PB', qty: 2, source: 'survey' },
  { product_short_name: 'era_5_lever_sashlock', finish_code: 'PB', qty: 1, source: 'survey' },
  { product_short_name: 'era_deadlock', finish_code: 'PB', qty: 1, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16', finish_code: 'Blk', qty: 1, source: 'survey' },
  { product_short_name: 'victorian', finish_code: 'PB', qty: 1, source: 'survey' },
]

const STABLE_DOOR_ASSUMPTIONS = [
  'Integrate stores a StableDoorPart with Top / Bottom StableDoorLeafParts; GlazePro stores two doorLeafParts in a stableDoorPart, so door_leaf_qty is 2 and every door rule fires per half as Integrate\'s editor shows',
  'The split 1055 / 1048 is STORED, not computed: Integrate\'s own drawing has the top half 7 mm taller and nothing says why',
  'The 3 mm clearance BETWEEN the halves is recorded and reaches no priced figure — 1055 + 1048 is the whole 2103 container',
  'Integrate allocates NO timber for either half (only the cill and the frame); GlazePro charges the halves as it charges a door leaf (Nathan\'s standing rule), declared on each row',
]

function stableDoorTree({ cells, ironmongeryLines }) {
  return doorTree({
    width: 1099, height: 2207,
    openings: [stableDoor('st_pair', {
      top: stableHalf('st_top', 'top', {
        topHeight: 110, bottomHeight: 99, cells: cells.top,
      }),
      bottom: stableHalf('st_bottom', 'bottom', {
        topHeight: 99, bottomHeight: 170, cells: cells.bottom,
      }),
    })],
    product: 'door',
    frameBottomHeight: 50,
    cillHeight: 50,
    isFrontDoor: false,
    isDoorMpls: false,
    // Nathan's decision i: Clean White both sides, a SINGLE finish, as
    // Integrate's template has it.
    internalFinish: 'clean_white',
    externalFinish: 'clean_white',
    ironmongeryLines,
  })
}

// ── ST1: both halves one flat panel (Integrate template 4553) ───────────────
// Production 3,405 = Door Leaf 1035 x 2 + Flat Panel 60 x 2 + Door Frame 855
// + Door Frame Single Finish 180 + Door Leaf Single Finish 90 x 2.
// Fitting 900: rule 200 "Stable Door", and no other door rule.

export const BENCHMARK_ST1 = {
  name: 'Benchmark ST1 — stable door, panelled both halves (L31115 Item 10 Drawing 21)',
  tree: stableDoorTree({
    cells: {
      top:    [doorPanel('st1_panel_top')],
      bottom: [doorPanel('st1_panel_bottom')],
    },
    ironmongeryLines: STABLE_DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkST1_stable_door },
  // The two halves’ TIMBER, which Integrate allocates nothing for (it
  // charges only the cill and the frame). Nathan’s standing rule: where
  // Integrate omits door timber, GlazePro charges it — the same way it
  // charges a door leaf’s, recomputed from the lengths:
  //
  //   Utile63x120  7157 mm at 17.30/m = 123.82
  //        = each half’s two stiles and top rail (2 x 1055 + 997 - 20 and
  //          2 x 1048 + 997 - 20, the open-in offset) + the TOP half’s 99
  //          MEETING rail at the leaf width (997), which is too deep for
  //          63x96 and comes from 63x120
  //   Utile63x200  2096 mm against Integrate’s 1099  = +28.91
  //        = its cill, plus the BOTTOM half’s 170 rail (997)
  //                                                    = 152.73
  //
  // PROVISIONAL in the same way every other door-timber charge is: the
  // sections are the ones a door leaf uses, and the workshop has to confirm
  // what is actually cut for a stable door.
  deliberateDifference: {
    cost: 152.73,
    reason: 'the two halves’ timber, which Integrate allocates nothing for: 7157 mm of Utile63x120 (their stiles, top rails and the top half’s 99 meeting rail) = 123.82, and 997 mm more Utile63x200 than its cill alone (the bottom half’s 170 rail) = 28.91. PROVISIONAL, as every door-timber charge is',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: OPEN_IN_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: STABLE_DOOR_IRONMONGERY,
  profileCode: 'open_in_doors',
  assumptions: STABLE_DOOR_ASSUMPTIONS,
}

// ── ST2: ST1 with a 200 x 350 VISION PANEL in the top panel (template 6618) ─
// The panel is charged IN FULL (0.66, not less the hole) and the glass prices
// at the 0.30 m2 minimum. No stored ironmongery at all.

export const BENCHMARK_ST2 = {
  name: 'Benchmark ST2 — stable door with a vision panel (L31115 Item 10 Drawing 22)',
  tree: stableDoorTree({
    cells: {
      top: [{
        ...doorPanel('st2_panel_top'),
        children: [visionPanel('st2_vision')],
      }],
      bottom: [doorPanel('st2_panel_bottom')],
    },
    ironmongeryLines: [],
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkST2_stable_door_vision_panel },
  // The two halves’ TIMBER, which Integrate allocates nothing for (it
  // charges only the cill and the frame). Nathan’s standing rule: where
  // Integrate omits door timber, GlazePro charges it — the same way it
  // charges a door leaf’s, recomputed from the lengths:
  //
  //   Utile63x120  7157 mm at 17.30/m = 123.82
  //        = each half’s two stiles and top rail (2 x 1055 + 997 - 20 and
  //          2 x 1048 + 997 - 20, the open-in offset) + the TOP half’s 99
  //          MEETING rail at the leaf width (997), which is too deep for
  //          63x96 and comes from 63x120
  //   Utile63x200  2096 mm against Integrate’s 1099  = +28.91
  //        = its cill, plus the BOTTOM half’s 170 rail (997)
  //                                                    = 152.73
  //
  // PROVISIONAL in the same way every other door-timber charge is: the
  // sections are the ones a door leaf uses, and the workshop has to confirm
  // what is actually cut for a stable door.
  deliberateDifference: {
    cost: 152.73,
    reason: 'the two halves’ timber, which Integrate allocates nothing for: 7157 mm of Utile63x120 (their stiles, top rails and the top half’s 99 meeting rail) = 123.82, and 997 mm more Utile63x200 than its cill alone (the bottom half’s 170 rail) = 28.91. PROVISIONAL, as every door-timber charge is',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: OPEN_IN_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: [],
  profileCode: 'open_in_doors',
  assumptions: [
    ...STABLE_DOOR_ASSUMPTIONS,
    'A VISION PANEL is a glass unit inside the panel: the panel is charged in full (Integrate does not deduct the hole) and the glass prices at the 0.30 m2 minimum',
  ],
}

// ── ST3: the top panel replaced by GLASS (the reviewer's drawing 23) ────────
// Glass 777 x 846 of sightline, so 801 x 870 cut = 0.70 m2 at the square
// rate; the bottom half keeps its panel.

export const BENCHMARK_ST3 = {
  name: 'Benchmark ST3 — stable door, glazed top half (L31115 Item 10 Drawing 23)',
  tree: stableDoorTree({
    cells: {
      top:    [glassChild('st3_top')],
      bottom: [doorPanel('st3_panel_bottom')],
    },
    ironmongeryLines: STABLE_DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkST3_stable_door_glazed_top },
  // The two halves’ TIMBER, which Integrate allocates nothing for (it
  // charges only the cill and the frame). Nathan’s standing rule: where
  // Integrate omits door timber, GlazePro charges it — the same way it
  // charges a door leaf’s, recomputed from the lengths:
  //
  //   Utile63x120  7157 mm at 17.30/m = 123.82
  //        = each half’s two stiles and top rail (2 x 1055 + 997 - 20 and
  //          2 x 1048 + 997 - 20, the open-in offset) + the TOP half’s 99
  //          MEETING rail at the leaf width (997), which is too deep for
  //          63x96 and comes from 63x120
  //   Utile63x200  2096 mm against Integrate’s 1099  = +28.91
  //        = its cill, plus the BOTTOM half’s 170 rail (997)
  //                                                    = 152.73
  //
  // PROVISIONAL in the same way every other door-timber charge is: the
  // sections are the ones a door leaf uses, and the workshop has to confirm
  // what is actually cut for a stable door.
  deliberateDifference: {
    cost: 152.73,
    reason: 'the two halves’ timber, which Integrate allocates nothing for: 7157 mm of Utile63x120 (their stiles, top rails and the top half’s 99 meeting rail) = 123.82, and 997 mm more Utile63x200 than its cill alone (the bottom half’s 170 rail) = 28.91. PROVISIONAL, as every door-timber charge is',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: OPEN_IN_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: STABLE_DOOR_IRONMONGERY,
  profileCode: 'open_in_doors',
  assumptions: STABLE_DOOR_ASSUMPTIONS,
}
