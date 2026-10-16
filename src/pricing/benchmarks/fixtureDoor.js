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
 *   RHZ1649  Winkhaus Flushbolt RH                        89.47 -> 89 -> 93.45
 *            (Step BG: the SAME part the other way round. The allocator
 *            picks one or the other by the leaf’s direction, at the same
 *            cost, so an open-in French pair’s ironmongery is FD1’s to the
 *            penny — and it is already in the live catalogue, so no file
 *            was needed for it.)
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
  RHZ1649: 89.47,
  RHZ1653: 34.92,
  RHZ1667: 5.61,
  // Step BP: the shootbolt the allocator picks for a TALLER leaf — DG1's
  // 2140 mm leaves take "Slave hinge keep 2140–2281", which is the Winkhaus
  // FAB Shootbolt 541 (RHZ1654, 36.45 in the live catalogue and the
  // snapshot -> 36 -> 37.80, Integrate's own line on L34242 item 8).
  RHZ1654: 36.45,
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

// ── Step BG: opening direction ───────────────────────────────────────────────
//
// docs/integrate-L31115-door-direction.txt, drawings 24-27 read 14 Oct 2026.
//
// OPENING DIRECTION IS THE DRAWING’S RANGE, not a property of a leaf: Integrate
// switches "Standard Open Out Doors" (single_and_french_doors) to "Standard
// Open In Doors" (open_in_doors) and re-applies the range’s values. What
// reaches a price is all in the TREE — the cill, the leaf clearances, the
// bottom rail and typeId 7 / 8 — which is why these fixtures carry Integrate’s
// own stored values and nothing in the engine needed a flag.

export const OPEN_OUT = 'open_out'   // Integrate typeId 7
export const OPEN_IN  = 'open_in'    // Integrate typeId 8

/**
 * A door leaf’s bottom rail, by direction.
 *
 * OUT: 163 internal / 170 external, STEPPED (Integrate btmRailShapeId 101) —
 *      the rail is cut back inside so the door clears the cill.
 * IN:  170 both sides, SQUARE (99). The interior (and so the glass or the
 *      panel) is measured from the INTERNAL rail, so an open-in leaf’s cell
 *      is 7 mm shorter than the same leaf opening out.
 */
export const LEAF_BOTTOM_RAIL = {
  [OPEN_OUT]: { bottomHeight: 163, bottomHeightExternal: 170, btmRailShapeId: 'stepped' },
  [OPEN_IN]:  { bottomHeight: 170, bottomHeightExternal: 170, btmRailShapeId: 'square' },
}

/** A French PAIR part’s clearances, by direction (Integrate’s own, per edge). */
export const PAIR_CLEARANCES = {
  [OPEN_OUT]: { mechanicalClearanceTop: 3, mechanicalClearanceBottom: 3, mechanicalClearanceLeft: 1, mechanicalClearanceRight: 1 },
  [OPEN_IN]:  { mechanicalClearanceTop: 3, mechanicalClearanceBottom: 14, mechanicalClearanceLeft: 3, mechanicalClearanceRight: 3 },
}

/** A SINGLE leaf’s own clearances, by direction. */
export const LEAF_CLEARANCES = {
  [OPEN_OUT]: { mechanicalClearanceTop: 2, mechanicalClearanceBottom: 3, mechanicalClearanceLeft: 3, mechanicalClearanceRight: 3 },
  [OPEN_IN]:  { mechanicalClearanceTop: 3, mechanicalClearanceBottom: 14, mechanicalClearanceLeft: 4, mechanicalClearanceRight: 4 },
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
function frenchDoorPair(key, { masterLeaf = 'right', direction = OPEN_OUT } = {}) {
  const leaf = (side, operation) => ({
    key: `${key}_${side}`,
    part_type: side === 'left' ? 'leftFrenchDoorLeafPart' : 'rightFrenchDoorLeafPart',
    values: {
      operation,
      casementTypeId: direction,       // Integrate typeId 7 out / 8 in
      thickness:     54,
      topHeight:     110,
      leftWidth:     110,
      rightWidth:    110,
      // from the TEMPLATE, not the profile — and it follows the direction
      ...LEAF_BOTTOM_RAIL[direction],
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
      casementTypeId: direction,
      thickness: 54,
      midRail: 198,
      gapBetweenMeetingStiles: 5,
      meetingStileOverlap: 27,
      mullionThickness: 83,
      ...PAIR_CLEARANCES[direction],
      masterLeaf,
    },
    children: [leaf('left', 'left_hand_hung'), leaf('right', 'right_hand_hung')],
  }
}

/**
 * The top-hung fanlight over the pair on FD3 / FD3b / OI3.
 *
 * Step BG: a fanlight in a door frame KEEPS ITS OWN DIRECTION when the doors
 * are switched to open in — Integrate leaves it typeId 7 and so does GlazePro
 * (Nathan, 14 Oct). Only its CLEARANCES follow the range, which is why OI3’s
 * are 3 all round against FD3’s 1 / 1 / 1 / 2.
 */
function doorFanlight(key, { bottomHeight, bottomHeightExternal, clearances = null }) {
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
      ...(clearances ?? {
        mechanicalClearanceTop: 1,
        mechanicalClearanceLeft: 1,
        mechanicalClearanceRight: 1,
        mechanicalClearanceBottom: 2,
      }),
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
  frameBottomHeight = 37, cillHeight = 37, cillStopSize = 26,
  isFrontDoor = false, isDoorMpls = true,
  internalFinish = 'clean_white', externalFinish = 'clean_white',
  frameArch = null,
  // Step BP: anything else Integrate stores on the paint part — the
  // surround ticks (Step BN), isCasementMpls — and on the price part
  // (Step BS's POA lines).
  paintExtra = {}, priceExtra = {},
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
          ...paintExtra,
          ironmongeryLines: ironmongeryLines.map(l => ({ ...l })),
        },
        children: [],
      },
      { key: 'notes1', part_type: 'notesPart', values: {}, children: [] },
      { key: 'price1', part_type: 'pricePart', values: { ...priceExtra }, children: [] },
      {
        key: 'frame1',
        part_type: 'assemblyFramePart',
        values: {
          width, height,
          leftWidth: 47, rightWidth: 47, topHeight: 47, bottomHeight: frameBottomHeight,
          frameDepth: 96, jambType: 'solid_profiled',
          frameHeadStopSize: 20, frameStileStopSize: 20, cillStopSize,
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

function doorPanel(key, { bead = 'ovolo' } = {}) {
  return {
    key,
    part_type: 'panelPart',
    values: {
      internalPanelTypeId: INTEGRATE_PANEL_FLAT,
      externalPanelTypeId: INTEGRATE_PANEL_FLAT,
      // Step BP: G4 / FT5 store Integrate's 126 (bolection) on both faces
      internalPanelBeadId: bead,
      externalPanelBeadId: bead,
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
  // EXACT on every group, as of the Step BM follow-up.
  //
  // The reviewer re-read drawing 10/4 (310627) on 14 Oct: both panels are
  // internalPanelTypeId 110 / externalPanelTypeId 110 — FLAT. So FD4 charges
  // flat 2 x 60, and Integrate fires "Door Muntin" 2 x 60 for the two leaves'
  // MID RAILS. GlazePro now does both, so the -49.32 this carried under Step
  // BE's decision d ("a mid rail is not a muntin") is gone — the whole of
  // that declared difference WAS the two mid rails.
  //
  // Its old penny-exact match, before the panels were re-read, was two errors
  // cancelling: Integrate's flat 2 x 60 + muntin 2 x 60 = 240 against
  // GlazePro's R&F 2 x 120 = 240. It is now 240 against 240 the right way
  // round, which is why this fixture has nothing left to declare.
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
function singleDoorLeaf(key, { operation = 'left_hand_hung', direction = OPEN_OUT } = {}) {
  return {
    key,
    part_type: 'doorLeafPart',
    values: {
      operation,                        // Integrate 17 LH / 18 RH / 11 Fix
      casementTypeId: direction,        // typeId 7 out / 8 in
      thickness: 54,
      topHeight: 110,
      leftWidth: 110,
      rightWidth: 110,
      ...LEAF_BOTTOM_RAIL[direction],
      ...LEAF_CLEARANCES[direction],
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
  // the frame: a 50 bottom and a 50 cill, not the garden door's 37 — and
  // NO cill stop, where the open-out range has 26 (Step BG's facts: the
  // range writes cill 37 / 50 and stop 26 / 0). Step BH found the 26 still
  // here, which is what a board-built open-in door was carrying.
  'assemblyFramePart.bottomHeight': 50,
  'assemblyFramePart.cillStopSize': 0,
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
  // Step BG: the FRENCH pair's own open-in values. The range sets these too
  // (docs/integrate-L31115-door-direction.txt): the pair's clearances go
  // 3 / 3 / 1 / 1 -> 3 / 14 / 3 / 3 and both leaves take the square 170 rail.
  'frenchDoorPart.mechanicalClearanceTop': 3,
  'frenchDoorPart.mechanicalClearanceBottom': 14,
  'frenchDoorPart.mechanicalClearanceLeft': 3,
  'frenchDoorPart.mechanicalClearanceRight': 3,
  'leftFrenchDoorLeafPart.bottomHeight': 170,
  'rightFrenchDoorLeafPart.bottomHeight': 170,
  // a casement light in an open-in door frame: 3 all round, not the
  // open-out range's 1 / 1 / 1 / 2 (OI3's fanlight, as stored)
  'casementSashPart.mechanicalClearanceTop': 3,
  'casementSashPart.mechanicalClearanceBottom': 3,
  'casementSashPart.mechanicalClearanceLeft': 3,
  'casementSashPart.mechanicalClearanceRight': 3,
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
      // Step BG: 99 is SQUARE and 101 is STEPPED — the door-direction facts
      // settle what Step BD could not verify. An open-in leaf's rail is
      // square, and nothing prices it either way.
      btmRailShapeId: 'square',
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
  'btmRailShapeId 99 on Integrate\'s front door leaf is GlazePro\'s "square", and 101 is "stepped" — read in the door-direction facts (Step BG), which is what the opens-in / opens-out switch writes. No rule reads it either way',
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
  // The panels are FLAT (type 110), so Integrate’s flat-panel 60 is right.
  // Production is now EXACTLY Integrate’s 44.50 h: the Step BM follow-up made
  // the leaf’s MID RAIL count as a muntin, so "Door Muntin" fires 2 x 60 here
  // — once for the real muntin and once for the mid rail — which is what
  // Integrate’s labour editor reads on drawing 16. The -24.66 this used to
  // declare under decision d is gone.
  //
  // What remains is only the TIMBER, which is a separate open question:
  //   +30.94  the leaf’s 120 muntin at Utile63x120 (1788 mm), PROVISIONAL
  deliberateDifference: {
    cost: 30.94,
    reason: 'the leaf’s 120 muntin at Utile63x120 for its interior height (1788 mm, +30.94, PROVISIONAL — Integrate allocates nothing for it). The -24.66 that sat beside this is GONE: the mid rail now counts as a muntin, so production is exactly Integrate’s 44.50 h (Step BM follow-up, Integrate’s labour editor on drawing 16)',
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
  // +13.67 of transom timber, and nothing else. Production is now EXACTLY
  // Integrate’s 46.17 h: the Step BM follow-up made the mid rail count, so
  // the -24.66 that used to sit beside this is gone. The panels are FLAT
  // either way.
  deliberateDifference: {
    cost: 13.67,
    reason: 'the frame transom at Utile67x96 for the internal frame width (1005 mm, +13.67, PROVISIONAL — Integrate allocates nothing for it). The -24.66 beside this is GONE: the mid rail now counts as a muntin, so production is exactly Integrate’s 46.17 h (Step BM follow-up)',
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
  // +13.45 of mid-rail timber +23.28 of shaped glass, and nothing else.
  // Production is now EXACTLY Integrate’s 54.83 h: the Step BM follow-up made
  // the mid rail count, so the -24.66 is gone. FT3 is the case that proved
  // the point — it has NO real muntin at all, and Integrate fires "Door
  // Muntin" 1 x 60 on it regardless. Its one panel is FLAT, as Integrate has.
  deliberateDifference: {
    cost: 36.73,   // 13.45 mid rail + 23.28 shaped glass
    reason: 'the leaf’s 120 mid rail at Utile63x120 for its interior width (777 mm, +13.45, PROVISIONAL) and the SHAPED GLASS (+23.28): 1.13 m2 at the square rate against Integrate’s 0.62 at its shaped rate — the largest rectangle of the cut glass (801 x 1127) plus the supplier’s quarter (Nathan, decision e) with the energy surcharge following it. The -24.66 that used to sit beside these is GONE: the mid rail now counts as a muntin, so production is exactly Integrate’s 54.83 h (Step BM follow-up)',
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
  // The five panels are FLAT, so what is left is the TIMBER alone. Production
  // is now EXACTLY Integrate’s 65.08 h: the Step BM follow-up made both mid
  // rails count — the leaf’s and the side casement’s — so "Door Muntin" fires
  // 3 x 60 here (one real muntin plus two mid rails), which is what the facts
  // file reads off Integrate for this item. The -49.32 is gone.
  deliberateDifference: {
    cost: 70.92,
    reason: 'TIMBER ONLY, all PROVISIONAL — Integrate allocates nothing for any of the three: the frame mullion (2085 mm at Utile67x96, +28.36), the leaf’s 120 muntin (1788 mm) and its 120 mid rail (672 mm) at Utile63x120 (+42.56). The -49.32 that used to net against these is GONE: both mid rails now count as muntins, so production is exactly Integrate’s 65.08 h (Step BM follow-up)',
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
function stableHalf(key, half, {
  cells = [], bottomHeight, topHeight, direction = OPEN_IN,
  bottomHeightExternal = null, btmRailShapeId = null,
}) {
  return {
    key,
    part_type: 'doorLeafPart',
    values: {
      stableHalf: half,
      operation: 'left_hand_hung',
      casementTypeId: direction,
      thickness: 54,
      topHeight,
      leftWidth: 110,
      rightWidth: 110,
      bottomHeight,
      bottomHeightExternal: bottomHeightExternal ?? bottomHeight,
      // Step BG: the shape follows the direction — 101 stepped opening out,
      // 99 square opening in. Nothing prices it; it is what Integrate stores.
      btmRailShapeId: btmRailShapeId ?? (direction === OPEN_OUT ? 'stepped' : 'square'),
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
function stableDoor(key, { top, bottom, splitOffset = STABLE_TOP_SPLIT_MM, direction = OPEN_IN }) {
  return {
    key,
    part_type: 'stableDoorPart',
    values: {
      // Step BG: typeId 7 / 8 on the CONTAINER, as Integrate stores it; its
      // clearances are 4 / 4 / 4 / 3 BOTH WAYS, the one door part the range
      // switch leaves alone.
      casementTypeId: direction,
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

/**
 * A stable-door drawing, either way round.
 *
 * Step BG item 3, from drawing 26: opening OUT the frame bottom and the cill
 * are 37 instead of 50, so the container gains 13 mm — and ALL 13 go to the
 * BOTTOM half, because the split (1055) is the TOP half's stored height. The
 * bottom half is 1061 against 1048, and its rail is the stepped 163 internal /
 * 170 external, so its panel is 1061 - 99 - 163 = 799 against 779. The top
 * half, its cell and the 3 mm between the halves are untouched.
 */
function stableDoorTree({ cells, ironmongeryLines, direction = OPEN_IN }) {
  const out = direction === OPEN_OUT
  return doorTree({
    width: 1099, height: 2207,
    openings: [stableDoor('st_pair', {
      direction,
      top: stableHalf('st_top', 'top', {
        direction, topHeight: 110, bottomHeight: 99, cells: cells.top,
      }),
      bottom: stableHalf('st_bottom', 'bottom', {
        direction, topHeight: 99, cells: cells.bottom,
        ...(out
          ? { bottomHeight: 163, bottomHeightExternal: 170 }
          : { bottomHeight: 170 }),
      }),
    })],
    product: 'door',
    frameBottomHeight: out ? 37 : 50,
    cillHeight: out ? 37 : 50,
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

// ═════════════════════════════════════════════════════════════════════════════
// Step BG — OPENING DIRECTION: OI1, OI2, OI3 (open in) and SO1 (open out)
// docs/integrate-L31115-door-direction.txt, L31115 item 10 drawings 24-27,
// read and priced 14 Oct 2026. All four SAVED, each created from an Integrate
// template and then switched with the item's RANGE.
//
// Each one is the SAME DRAWING as a benchmark already here, the other way
// round, which is what makes them worth having:
//   OI1 is FD1 opening in   (2,814.71 against FD1's 2,819.53)
//   OI2 is SD1 opening in   (1,864.68 against SD1's 1,867.12)
//   SO1 is ST1 opening out  (2,510.57 against ST1's 2,507.64)
//   OI3 is FD3 opening in, as Integrate stored it after the switch
//
// NOTHING in the engine reads a direction FLAG: every penny of the difference
// is in the tree the range writes — the cill, the clearances, the bottom rail
// and typeId 7 / 8. The one thing that follows the drawing's PROFILE is which
// of the two door ranges it is in, and the only live rule that bands on them
// ("Utile Section Part") fires on either.
// ═════════════════════════════════════════════════════════════════════════════

const OPEN_IN_DOOR_ASSUMPTIONS = [
  ...DOOR_ASSUMPTIONS,
  'Opening direction is the drawing\u2019s RANGE in Integrate, not a property of a leaf: these trees carry the values the range wrote, as read after the switch and the save',
  'An opening fanlight or casement light in an open-in door frame STILL OPENS OUT (Nathan, 14 Oct), which is why rule 245 "Frame with inward opening and outward opening" fires on OI3 and on no other door here',
]

// ── OI1: FD1 opening in (drawing 24) ───────────────────────────────────────
// 1899 x 2199, internal 1805 x 2102 (the cill is 50, not 37). The pair's
// clearances 3 / 14 / 3 / 3 make each leaf 910.5 x 2085, and the square 170
// rail leaves 690.5 x 1805 of glass. Production 3,325 and fitting 870 are
// FD1's exactly: Integrate charges nothing for the direction.

export const BENCHMARK_OI1 = {
  name: 'Benchmark OI1 — French doors opening IN (L31115 Item 10 Drawing 24)',
  tree: doorTree({
    width: 1899, height: 2199,
    openings: [frenchDoorPair('oi1', { direction: OPEN_IN })],
    frameBottomHeight: 50, cillHeight: 50, cillStopSize: 0,
    ironmongeryLines: DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkOI1_french_doors_open_in },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: OPEN_IN_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: DOOR_IRONMONGERY,
  profileCode: 'open_in_doors',
  assumptions: OPEN_IN_DOOR_ASSUMPTIONS,
}

// ── OI2: SD1 opening in (drawing 25) ───────────────────────────────────────
// 1099 x 2199, internal 1005 x 2102; the leaf's own clearances 3 / 14 / 4 / 4
// make it 997 x 2085 and the glass 777 x 1805.

export const BENCHMARK_OI2 = {
  name: 'Benchmark OI2 — single garden door opening IN (L31115 Item 10 Drawing 25)',
  tree: doorTree({
    width: 1099, height: 2199,
    openings: [singleDoorLeaf('oi2_leaf', { direction: OPEN_IN })],
    product: 'door',
    frameBottomHeight: 50, cillHeight: 50, cillStopSize: 0,
    ironmongeryLines: SINGLE_DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkOI2_single_door_open_in },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: OPEN_IN_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: SINGLE_DOOR_IRONMONGERY,
  profileCode: 'open_in_doors',
  assumptions: [
    ...OPEN_IN_DOOR_ASSUMPTIONS,
    'A single door leaf is a plain doorLeafPart in the frame opening, with its OWN clearances — 2 / 3 / 3 / 3 opening out, 3 / 14 / 4 / 4 opening in',
  ],
}

// ── SO1: ST1 opening out (drawing 26) ──────────────────────────────────────
// 1099 x 2207 with the 37 cill, so the container is 997 x 2116 and the BOTTOM
// half takes all 13 of the extra: 1061 against 1048, panel 777 x 799. Its
// rail is the stepped 163 / 170. Production 3,405 and fitting 900 are ST1's.

export const BENCHMARK_SO1 = {
  name: 'Benchmark SO1 — stable door opening OUT (L31115 Item 10 Drawing 26)',
  tree: stableDoorTree({
    direction: OPEN_OUT,
    cells: {
      top:    [doorPanel('so1_panel_top')],
      bottom: [doorPanel('so1_panel_bottom')],
    },
    ironmongeryLines: STABLE_DOOR_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkSO1_stable_door_open_out },
  // The two halves’ timber, as ST1 — recomputed for the taller bottom half
  // and the OPEN-OUT section offset (-6 a leaf, not the open-in -20):
  //   Utile63x120  7211 mm at 17.30/m = 124.75
  //        = (2 x 1055 + 997 - 6) + (2 x 1061 + 997 - 6) + the top half’s
  //          99 meeting rail at 997
  //   Utile63x200  2096 against Integrate’s 1099 = +28.91 (the bottom
  //          half’s 163 / 170 rail at 997)
  //                                              = 153.66, ST1’s + 0.93
  deliberateDifference: {
    cost: 153.66,
    reason: 'the two halves\u2019 timber, which Integrate allocates nothing for: 7211 mm of Utile63x120 (their stiles, top rails and the top half\u2019s 99 meeting rail, at the open-OUT -6 offset) = 124.75, and 997 mm more Utile63x200 than its cill alone (the bottom half\u2019s stepped 163 / 170 rail) = 28.91. ST1\u2019s 152.73 plus 0.93, and PROVISIONAL in the same way',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: STABLE_DOOR_IRONMONGERY,
  profileCode: 'open_out_doors',
  assumptions: [
    ...STABLE_DOOR_ASSUMPTIONS,
    'Opening OUT, the 13 mm the lower cill gives all go to the BOTTOM half: the split 1055 is the TOP half\u2019s stored height, so the bottom half is 1061 and the top half is untouched',
  ],
}

// ── OI3: FD3 opening in, AS STORED after the switch (drawing 27) ───────────
// 1350 x 2591 — Integrate's own range switch SHRANK the frame by 8 mm and
// took the same 8 off the fanlight's bottom rail (86 -> 78). Neither is
// copied (a surveyor's measured frame must not move when the direction
// changes); the fixture is the drawing Integrate SAVED, so the benchmark
// prices what Integrate priced.
//
// Interior 1256 x 2494 = 391 + 41 + 2062. The fanlight is 1250 x 385 and
// STILL OPENS OUT, which is what fires rule 245 (300 min): 4,270 against
// FD3's 3,970.

export const BENCHMARK_OI3 = {
  name: 'Benchmark OI3 — French doors with a fanlight, opening IN (L31115 Item 10 Drawing 27)',
  tree: doorTree({
    width: 1350, height: 2591,
    dividers: [transom('oi3_trans', 391)],
    openings: [
      doorFanlight('oi3_fan', {
        bottomHeight: 78, bottomHeightExternal: 93,
        clearances: {
          mechanicalClearanceTop: 3, mechanicalClearanceLeft: 3,
          mechanicalClearanceRight: 3, mechanicalClearanceBottom: 3,
        },
      }),
      frenchDoorPair('oi3', { direction: OPEN_IN }),
    ],
    frameBottomHeight: 50, cillHeight: 50, cillStopSize: 0,
    ironmongeryLines: [...DOOR_IRONMONGERY, ...FANLIGHT_IRONMONGERY],
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkOI3_french_doors_fanlight_open_in },
  deliberateDifference: {
    cost: 17.08,
    reason: 'the transom, charged at Utile67x96 for the internal frame width (1256 mm) \u2014 Integrate allocates nothing for it, as on FD3 (difference 7, PROVISIONAL)',
  },
  parkedResidual: {
    cost: -0.14,
    reason: 'Integrate\u2019s 63x63 fanlight length is 2050 and GlazePro\u2019s is 2034 (1250 + 2 x 385 + 14). The 16 mm are the 8 its own range switch took off the fanlight rail, counted twice \u2014 the frame and the rail shrank but the ALLOCATED length did not. GlazePro charges the sash it draws, which is 14p less',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: OPEN_IN_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: [...DOOR_IRONMONGERY, ...FANLIGHT_IRONMONGERY],
  profileCode: 'open_in_doors',
  assumptions: [
    ...OPEN_IN_DOOR_ASSUMPTIONS,
    'The frame is 2591 and the fanlight rail 78 because that is what Integrate STORED after its own range switch; GlazePro\u2019s switch changes neither, so a GlazePro drawing of the same doors would be 2599 with an 86 rail',
  ],
}

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// Step BP \u2014 grids INSIDE casement sashes and door leaves: DG1, DG2, DM1
// docs/integrate-drawing-gaps.txt sections 1 and 2 (G1, G2, M1), read 16 Oct
// 2026 by the reviewer from Integrate's saved trees and its Price File Editor.
// Open OUT, Solid Utile, single finish, stored ironmongery where the facts
// give it.
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

/**
 * A fixed doorset casement with a MID RAIL: glass above, a flat panel below
 * (G1's A1 / D1, G3's, G4's with a 200 rail and a bolection bead). The same
 * thing Step BE's side light is, at the doorset casement's own rails and
 * clearances (62 / 62 / 62, 163 bottom, 1 / 1 / 1 / 2).
 */
function panelledDoorsetCasement(key, {
  bottomHeight = 163, midRailOffset, midRailThickness = 170, bead = 'ovolo', operation = 'fix',
} = {}) {
  const sash = doorsetCasementSash(key, { bottomHeight, bottomHeightExternal: bottomHeight })
  return {
    ...sash,
    values: { ...sash.values, operation },
    children: [
      leafMidRail(`${key}_midrail`, { offset: midRailOffset, thickness: midRailThickness }),
      glassChild(key),
      doorPanel(`${key}_panel`, { bead }),
    ],
  }
}

/** A fixed doorset casement that is ALL panel (G2's A2 / B2): one flat panel, no glass. */
function panelOnlyDoorsetCasement(key, { bottomHeight = 163 } = {}) {
  const sash = doorsetCasementSash(key, { bottomHeight, bottomHeightExternal: bottomHeight })
  return { ...sash, children: [doorPanel(`${key}_panel`)] }
}

/** An opening doorset casement (G2's A1 / B1): 86 rail, hung left or right. */
function hungDoorsetCasement(key, operation) {
  const sash = doorsetCasementSash(key, { bottomHeight: 86, bottomHeightExternal: 93 })
  return { ...sash, values: { ...sash.values, operation } }
}

// \u2500\u2500 DG1 = G1: L34242 Q2 item 8 \u2014 French doors with side casements \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 3100 x 2230. Mullions 41 at 690 and 2275 (columns 690 / 1544 / 690). A1 and
// D1 fixed casements, 163 bottom rail, glass over a 170 mid rail at 1298 over
// a flat panel (450 deep). The pair: 198 mid rail, gap 5, overlap 27,
// 3 / 1 / 1 / 3; each leaf glass over a 170 mid rail at 1247 over a flat
// panel (450). Surround architrave and bullnose. Four 0.25 m2 Tricoya panels,
// Door Muntin 4 x 60 (two leaf rails + two side casement rails).
const DG1_IRONMONGERY = [
  { product_short_name: '102mm_hinges',              finish_code: 'Blk', qty: 4, source: 'survey' },
  { product_short_name: 'double_euro_cylinder',      finish_code: 'Blk', qty: 1, source: 'survey' },
  { product_short_name: 'monkeytail_door_handle_rh', finish_code: 'Blk', qty: 1, source: 'survey' },
  { product_short_name: 'trickle',                   finish_code: 'Wht', qty: 1, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',         finish_code: 'Wht', qty: 1, source: 'survey' },
]

const GRID_ASSUMPTIONS = [
  'Every frame, divider, opening, rail, mid rail, muntin, panel, glass and stored ironmongery value: Integrate\u2019s own saved trees (docs/integrate-drawing-gaps.txt, read 16 Oct 2026)',
  'A mid rail inside a casement sash or a leaf is a transomPart with isMidrail, a muntin a mullionPart with isMuntin \u2014 Integrate\u2019s own parts; a confined muntin names the rail it starts at (startDivider), as Integrate does',
  'Panel type 110 is FLAT and bead 120 ovolo (docs/step-bm-correction.md); the panel options are stored as Integrate\u2019s ids',
  'The frame mullions carry mullionStopSize 20 where Integrate stores 18; no rule reads it',
]

export const BENCHMARK_DG1 = {
  name: 'Benchmark DG1 \u2014 French doors with side casements over panels, 3100 x 2230 (L34242 Q2 item 8)',
  tree: doorTree({
    width: 3100, height: 2230,
    dividers: [mullion('dg1_mull_a', 690), mullion('dg1_mull_b', 2275)],
    openings: [
      panelledDoorsetCasement('dg1_a1', { midRailOffset: 1298 }),
      panelledFrenchDoorPair('dg1_pair', { midRailOffset: 1247 }),
      panelledDoorsetCasement('dg1_d1', { midRailOffset: 1298 }),
    ],
    ironmongeryLines: DG1_IRONMONGERY,
    paintExtra: { surroundArchitrave: true },
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkDG1_french_doors_side_casements_panels },
  // EXACT on glass, installation, production (100.92 h), fitting (18.50 h)
  // and labour. Manufacture materials carry two things:
  //   +58.37  the two frame MULLIONS, 2 x 2146 mm at Utile67x96 13.60/m —
  //           Integrate allocates nothing for a doorset's mullions
  //           (difference 11, decided);
  //   -5.57   the side casements' MID RAILS: Integrate's 9.13 m of 63x200 is
  //           190 mm more than the sash-width-less-10 rule gives for the two
  //           (2 x 678), plus 6p of its 2 dp metre rounding. One reading
  //           cannot say whether it cuts them at the door leaf's own 772 or
  //           at the opening plus its two mullions (both 772): OPEN.
  deliberateDifference: {
    cost: 58.37,
    reason: 'The two frame mullions (2 x 2146 mm at Utile67x96, 13.60/m): doorset mullion timber Integrate allocates nothing for — difference 11',
  },
  openQuestion: {
    cost: -5.57,
    reason: 'Integrate allocates 190 mm more 63x200 for the two side casements’ 170 mid rails than the sash width less 10 gives (772 each against 678), plus 6p of 2 dp rounding — one reading; which length Integrate cuts them at is not yet known',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: DG1_IRONMONGERY,
  profileCode: 'open_out_doors',
  assumptions: GRID_ASSUMPTIONS,
}

// \u2500\u2500 DG2 = G2: L34242 Q2 item 7 \u2014 a single door, two casements over two panelled ones
// 2750 x 2050. Mullions 41 at 837 and 1715; a SHORT transom 41 at 962.5 that
// ends at the second mullion, so the door (C) is full height \u2014 Integrate's
// endDivider, which the frame geometry honours (Step BH) and the board cannot
// yet draw (Step BQ). A1 / B1 hung casements with an 86 rail; C1 a single
// right-hand door, glass only; A2 / B2 fixed casements that are ALL panel.
const DG2_IRONMONGERY = [
  { product_short_name: '102mm_hinges',                        finish_code: 'Blk', qty: 2, source: 'survey' },
  { product_short_name: '76mm_hinges',                         finish_code: 'Blk', qty: 4, source: 'survey' },
  { product_short_name: 'double_euro_cylinder',                finish_code: 'Blk', qty: 1, source: 'survey' },
  { product_short_name: 'kenrick_extension_950mm',             finish_code: 'PC',  qty: 4, source: 'survey' },
  { product_short_name: 'kenrick_extension_gear_box',          finish_code: 'PC',  qty: 2, source: 'survey' },
  { product_short_name: 'monkeytail_door_handle_rh',           finish_code: 'Blk', qty: 1, source: 'survey' },
  { product_short_name: 'monkeytail_espag_casement_handle_lh', finish_code: 'Blk', qty: 1, source: 'survey' },
  { product_short_name: 'monkeytail_espag_casement_handle_rh', finish_code: 'Blk', qty: 1, source: 'survey' },
  { product_short_name: 'trickle',                             finish_code: 'Wht', qty: 1, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',                   finish_code: 'Wht', qty: 1, source: 'survey' },
]

const DG2_SHORT_TRANSOM = {
  ...transom('dg2_trans', 962.5),
  values: { ...transom('dg2_trans', 962.5).values, endDivider: 'dg2_mull_b' },
}

export const BENCHMARK_DG2 = {
  name: 'Benchmark DG2 \u2014 single door beside two casements over two panelled casements, 2750 x 2050 (L34242 Q2 item 7)',
  tree: doorTree({
    width: 2750, height: 2050,
    dividers: [mullion('dg2_mull_a', 837), mullion('dg2_mull_b', 1715), DG2_SHORT_TRANSOM],
    openings: [
      hungDoorsetCasement('dg2_a1', 'left_hand_hung'),
      hungDoorsetCasement('dg2_b1', 'right_hand_hung'),
      singleDoorLeaf('dg2_c1', { operation: 'right_hand_hung' }),
      panelOnlyDoorsetCasement('dg2_a2'),
      panelOnlyDoorsetCasement('dg2_b2'),
    ],
    product: 'door',
    ironmongeryLines: DG2_IRONMONGERY,
    paintExtra: { surroundArchitrave: true, isCasementMpls: true },
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkDG2_single_door_casements_over_panels },
  // EXACT on every group but manufacture materials, which carries the frame
  // DIVIDER timber Integrate allocates nothing for: two mullions (2 x 1966)
  // and the transom (2656) at Utile67x96 13.60/m = 6,588 mm, +89.60
  // (differences 7 and 11, decided). Its 63x63 is Integrate's 11.07 m to
  // the millimetre, the all-panel casements' stiles included.
  deliberateDifference: {
    cost: 89.60,
    reason: 'The two frame mullions (2 x 1966 mm) and the transom (2656 mm) at Utile67x96 13.60/m: doorset divider timber Integrate allocates nothing for — differences 7 and 11',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: DG2_IRONMONGERY,
  profileCode: 'open_out_doors',
  assumptions: [
    ...GRID_ASSUMPTIONS,
    'The short transom is stored with endDivider = the second mullion, as Integrate stores it; the board cannot draw a short divider until Step BQ, so this layout cannot yet be redrawn live',
  ],
}

// \u2500\u2500 FT5 = P1: L34355 Q4 item 7 \u2014 the front door set, with everything \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 1650 x 2900, open IN, Utile, custom colour outside (dual finish). Two
// mullions and a transom (Mullion/Transom 3 x 180): three FIXED fanlights
// over two side casements and the door. Facts: section 5 (P1), G4 (the side
// casements: glass over a 200 mid rail at 869.5 over a flat panel with a
// BOLECTION bead) and M2 (the leaf: a full-height 120 muntin at 263 and a
// 200 mid rail at 832.5 \u2014 two glass over two bolection panels). Every glass
// unit is SPECIAL (priced outside the price file: Glass group 0) and the
// Price part carries the 120-minute POA line.
//
// The facts give the frame size and the leaf's and sashes' own dividers,
// not the mullion / transom offsets or the leaf width. Those are DERIVED
// from what the facts do give, and the derivation is the fixture's
// assumption: the external bolection mouldings price (W + 75 + H + 75) m,
// and Integrate's four lines are 1.19 / 1.25 / 1.25 / 1.19 \u2014 so a side
// casement's panel is W + H = 1,040 and a leaf panel's 1,100. With the
// leaf's muntin at 263 its panels are 263 wide, so 837 deep; with the side
// casements' 170-wide interior (a 294 sash, 62 stiles) their panels are
// 870 deep. Working back through the 200 rails, the rails and the open-in
// clearances gives a 2,149.5 leaf, a 2,166.5 door opening, 300 side
// columns beside an 874 door column (mullions at 300 and 1,215) and a
// 595.5 fanlight row under a 41 transom in the 2,803 of interior a 47 head
// and a 50 bottom leave.
const FT5_POA = [{
  type: 'labour', category: 'installation',
  description: 'Skirting to be cut temporarily', amount: 120,
}]

/** A glass unit marked SPECIAL \u2014 priced outside the price file (Step BS). */
function specialGlass(key) {
  const g = glassChild(key)
  return { ...g, values: { ...g.values, specialGlassDetails: true } }
}

/** A FIXED fanlight in an open-in doorset: a casement sash with a 62 rail. */
function fixedOpenInFanlight(key) {
  const sash = doorsetCasementSash(key, { bottomHeight: 62, bottomHeightExternal: 62 })
  return {
    ...sash,
    values: {
      ...sash.values, casementTypeId: 'open_in',
      mechanicalClearanceTop: 3, mechanicalClearanceBottom: 3,
      mechanicalClearanceLeft: 3, mechanicalClearanceRight: 3,
    },
    children: [specialGlass(key)],
  }
}

/** G4's side casement: open in, 163 rail, special glass over a 200 rail over a bolection panel. */
function ft5SideCasement(key) {
  const sash = panelledDoorsetCasement(key, {
    bottomHeight: 163, midRailOffset: 869.5, midRailThickness: 200, bead: 126,
  })
  return {
    ...sash,
    values: {
      ...sash.values, casementTypeId: 'open_in',
      mechanicalClearanceTop: 3, mechanicalClearanceBottom: 3,
      mechanicalClearanceLeft: 3, mechanicalClearanceRight: 3,
    },
    children: sash.children.map(c => c.part_type === 'glassPart' ? specialGlass(key) : c),
  }
}

export const BENCHMARK_FT5 = {
  name: 'Benchmark FT5 \u2014 front door set: special glass, bolection panels, a full-height muntin and a POA line, 1650 x 2900 (L34355 Q4 item 7)',
  tree: doorTree({
    width: 1650, height: 2900,
    dividers: [mullion('ft5_mull_a', 300), mullion('ft5_mull_b', 1215), transom('ft5_trans', 595.5)],
    openings: [
      fixedOpenInFanlight('ft5_a1'),
      fixedOpenInFanlight('ft5_b1'),
      fixedOpenInFanlight('ft5_c1'),
      ft5SideCasement('ft5_a2'),
      frontDoorLeaf('ft5_leaf', {
        operation: 'right_hand_hung',
        bottomHeight: 170,
        dividers: [
          leafMuntin('ft5_muntin', { offset: 263 }),
          leafMidRail('ft5_midrail', { offset: 832.5, thickness: 200 }),
        ],
        cells: [
          specialGlass('ft5_leaf_g1'), specialGlass('ft5_leaf_g2'),
          doorPanel('ft5_panel_a2', { bead: 126 }), doorPanel('ft5_panel_b2', { bead: 126 }),
        ],
      }),
      ft5SideCasement('ft5_c2'),
    ],
    product: 'door',
    frameBottomHeight: 50, cillHeight: 50, cillStopSize: 0,
    isFrontDoor: true,
    internalFinish: 'clean_white',
    externalFinish: 'custom',
    ironmongeryLines: FRONT_DOOR_IRONMONGERY,
    priceExtra: { poaLines: FT5_POA },
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkFT5_front_door_set_special_glass_poa },
  // EXACT on glass (0 — every unit special) and on PRODUCTION, 108.58 h:
  // Mullion/Transom 3 x 180, Door Leaf 1035, Sidelights 2 x 780, Fanlights
  // 3 x 300, Door Muntin 4 x 60 (the leaf's muntin and rail, the two side
  // casements' rails), Flat Panel 4 x 60, Door Frame 855, Glazing 7 x 20,
  // Casement Dual Finish 5 x 90, Door Frame Dual Finish 240 + 3 x 45, Door
  // Leaf Dual Finish 180 — every line the facts list, to the minute. The
  // POA line adds its 120 to the fitting. What is declared:
  //   +142.26  BY DESIGN, three decided differences: the two frame mullions
  //            and the transom (7,162 mm at Utile67x96, +97.40, difference
  //            11 / 7); the leaf's full-height muntin (1,869.5 mm at
  //            Utile63x120, +32.34, difference 13); the three fanlights' 62
  //            rails at 63x63 (1,456 mm, +12.52, difference 7a);
  //   +11.47   OPEN, two questions: "Any Door Overweight" 45 minutes
  //            (+30.15) that Integrate does not charge on this leaf; and
  //            -18.68 of sections Integrate allocates beyond GlazePro's
  //            that P1's facts do not itemise (on G1 it cut the side
  //            casements' mid rails 94 mm longer each);
  //   -54.60   PENDING DATA: the facts give no stored ironmongery for this
  //            item, so the fixture carries the Balham list.
  deliberateDifference: {
    cost: 142.26,
    reason: 'Door timber Integrate allocates nothing for: the two frame mullions and the transom (7,162 mm at Utile67x96, +97.40 — differences 7 and 11), the leaf’s full-height muntin (1,869.5 mm at Utile63x120, +32.34 — difference 13) and the three fanlights’ 62 rails at 63x63 (1,456 mm, +12.52 — difference 7a)',
  },
  openQuestion: {
    cost: 11.47,
    reason: 'Two questions: +30.15 is "Any Door Overweight" 45 minutes on a leaf GlazePro weighs over 50 kg and Integrate does not charge; -18.68 is section timber Integrate allocates beyond GlazePro’s sash-width rules that P1’s facts do not itemise (on G1 it cuts a side casement’s mid rail 94 mm longer; its 2 dp metre roundings) — to be read from the Price File Editor',
  },
  pendingDecision: {
    cost: -54.60,
    reason: 'Installation materials: the facts record no stored ironmongery set for L34355 item 7, so the fixture carries the Balham front-door list. The reviewer reads the item’s ironmongerySet and the gap closes or is explained',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: OPEN_IN_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: FRONT_DOOR_IRONMONGERY,
  profileCode: 'open_in_doors',
  assumptions: [
    ...FRONT_DOOR_ASSUMPTIONS,
    ...GRID_ASSUMPTIONS,
    'The mullion and transom offsets and the leaf width are DERIVED from the bolection moulding lines (1.19 / 1.25 m) and the stored leaf and sash dividers, not read from the tree: columns 300 / 874 / 300, fanlight row 595.5',
    'Every glass unit is special (specialGlassDetails), as P1 stores every glazed opening; its Glass group is 0',
    'The facts give no stored ironmongery set for this item, so the fixture carries the Balham front-door list; installation materials are declared, not reproduced',
  ],
}

// \u2500\u2500 DM1 = M1: L34268 Q1 item 2 \u2014 a single door with a muntin below the mid rail
// 930 x 2100, Utile, right-hand. The leaf: a 170 mid rail at 835 and a 120
// muntin at 245 that starts at the rail \u2014 one glass above, two flat panels
// below. The facts give NO stored ironmongery for this item, so it carries
// the single-door list SD1-SD4 do and declares the difference.
const DM1_MUNTIN = {
  ...leafMuntin('dm1_muntin', { offset: 245 }),
  values: { ...leafMuntin('dm1_muntin', { offset: 245 }).values, startDivider: 'dm1_midrail' },
}

export const BENCHMARK_DM1 = {
  name: 'Benchmark DM1 \u2014 single door, glass over two panels under a muntin, 930 x 2100 (L34268 Q1 item 2)',
  tree: doorTree({
    width: 930, height: 2100,
    openings: [{
      ...singleDoorLeaf('dm1_leaf', { operation: 'right_hand_hung' }),
      children: [
        leafMidRail('dm1_midrail', { offset: 835 }),
        DM1_MUNTIN,
        glassChild('dm1_leaf'),
        doorPanel('dm1_panel_a'),
        doorPanel('dm1_panel_b'),
      ],
    }],
    product: 'door',
    ironmongeryLines: SINGLE_DOOR_IRONMONGERY,
    paintExtra: { surroundArchitrave: true },
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkDM1_single_door_muntin_below_rail },
  // EXACT on glass (0.54 m2) and production (40.33 h: Door Leaf 1035, Door
  // Muntin 2 x 60 for the rail and the confined muntin, Flat Panel 2 x 60,
  // Door Frame 855, Glazing 20, the two Single Finish lines). Three things
  // are declared, each a different kind:
  //   +12.68  BY DESIGN: the confined muntin's 733 mm at Utile63x120 17.30/m
  //           — door timber Integrate allocates nothing for (as FT1's);
  //   +30.16  OPEN: "Any Door Overweight" 45 minutes. The leaf weighs 51.9 kg
  //           on GlazePro's model and Integrate charges none; the panels
  //           cannot explain it (see PANEL_SKIN_THICKNESS_MM);
  //   -59.85  PENDING DATA: the facts give no stored ironmongery for this
  //           item, so the fixture carries SD1-SD4's single-door list.
  deliberateDifference: {
    cost: 12.68,
    reason: 'The confined muntin, 733 mm at Utile63x120 17.30/m: door timber Integrate allocates nothing for — Nathan’s standing rule (difference 13)',
  },
  openQuestion: {
    cost: 30.16,
    reason: '"Any Door Overweight" 45 minutes: the leaf is 51.9 kg on GlazePro’s weight model and Integrate charges none. Timber and glass alone are 49.7 kg, so the panel constant cannot reconcile it with FT2 — the 1.5 kg is somewhere in an open-out single door’s timber or glass, unmeasured',
  },
  pendingDecision: {
    cost: -59.85,
    reason: 'Installation materials: the facts record no stored ironmongery set for L34268 item 2, so the fixture carries SD1-SD4’s single-door list (102mm hinges x2, euro cylinder, Windsor handle, vent) and the allocated lock. The reviewer reads the item’s ironmongerySet and the gap closes or is explained',
  },
  partCostMap: DOOR_PART_COST_MAP,
  profileValues: DOOR_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: SINGLE_DOOR_IRONMONGERY,
  profileCode: 'open_out_doors',
  assumptions: [
    ...GRID_ASSUMPTIONS,
    'The facts give no stored ironmongery set for this item (docs/integrate-drawing-gaps.txt M1 lists isDoorMpls only), so the fixture carries SD1-SD4\u2019s single-door list; its installation materials are declared, not reproduced',
  ],
}
