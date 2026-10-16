/**
 * fixtureLiveQuotes.js
 * Benchmarks LQ1–LQ9 — six real Integrate quotes, redrawn and compared.
 *
 * Step BL. The reviewer redrew six real Integrate quotes on the live board,
 * priced them in GlazePro and compared every group and every line with
 * Integrate's Price File Editor (docs/integrate-live-quotes.txt, read 16 Oct
 * 2026). Where a difference came from an input the reviewer had missed — a
 * horn type, a frame-level arch, one tower access — it was corrected and
 * re-priced. What was left is in the brief, and each one is a GlazePro rule
 * INPUT rather than a rule:
 *
 *   LQ1  L34268 item 4   casement 2000 x 1300, fixed | top-hung | fixed,
 *                        1 V + 2 H bars on every sash          (drawing 82)
 *   LQ2  L33022 item 10  UTILE casement 1000 x 1200, a barred
 *                        top-hung fanlight over a fixed sash   (drawing 100)
 *   LQ3  L33022 item 12  UTILE French doors 1600 x 2150, barred
 *                        glass over a raised-and-fielded panel (drawing 105)
 *   LQ4  L32520 item 16  casement config 7, 1529 x 2600, six fixed
 *                        sashes, 75 mm dividers, one barred    (drawing 117)
 *   LQ5  L34265 item 3   box sash 780 x 1769, FRAME-level arch,
 *                        custom 75 mm top horn                 (drawing 121)
 *   LQ6  L34265 item 1   double box 1620 x 1779, each top sash
 *                        arched at SASH level in a square frame (drawing 122)
 *   LQ7  L33022 item 1   UTILE box sash 1000 x 1400, barred top sash
 *                                                              (drawing 94)
 *   LQ8  L32520 item 9   casement 1060 x 1230 top-hung, WSW mobile
 *                        tower, 60 mm cill horns               (drawing 111)
 *   LQ9  L34265 item 4   box sash 1090 x 1829, one barred top sash,
 *                        custom 75 mm top horn                 (drawing 118)
 *
 * EVERY VALUE HERE IS INTEGRATE'S OWN, from its saved trees. Where Integrate
 * stores a field GlazePro has no home for, it is listed in the fixture's
 * assumptions rather than invented — as Step X established.
 *
 * KNOWN GAPS. Each target may carry a `known_gaps` object: a difference that
 * belongs to a later step, with its reason. A benchmark passes when every
 * group equals the target plus its known gap, which is what
 * `expectMatchesIntegrate(result, target, gaps)` checks. The gaps in this
 * step are all one of:
 *   - surround labour ("Linings" 180, "Windowboard" 30): Integrate keeps the
 *     surround on PaintAndIronmongeryPart as `autoCalcSurroundComponents`
 *     and GlazePro has no input for it yet;
 *   - the shutters note on LQ5: 75 minutes from a scope-of-works note;
 *   - surround TIMBER on LQ3, where Integrate has no surround at all;
 *   - 3 hours LQ4's Integrate labour holds beyond its own fitting-units page.
 */

import INTEGRATE_TARGETS from './integrate-targets.json'
import { DOOR_PART_COST_MAP } from './fixtureDoor.js'

// ── Shared values ───────────────────────────────────────────────────────────

/** The Ogee architrave, the one surround component these items price. */
const LQ_PART_COST_MAP = {
  TP68: 2.85,   // Ogee Architrave 20x70 MDF
  TP61: 2.76,   // Nosing 25x50 Redwood (no LQ item carries one)
}

/**
 * The sliding-sash profile values, as the Sash profile holds them. A
 * casement's glass carries its own rebate and tolerance; a box sash's comes
 * from here (Step AO).
 *
 * `spacerDimId` is the figure Step BL item 1 turns on: the drawing's profile
 * says the unit has a 16 mm spacer, which makes a double-glazed unit 24 mm
 * thick and so lets the three glazing-bar glass rules fire.
 */
const LQ_PROFILE_VALUES = {
  defaultDoubleGlazingRebateWidthForSash: 14,
  defaultDoubleGlazingTolerance: 2,
  spacerDimId: '16mm',
  // LQ6's 220 mm HOLLOW box mullion: the stored thickness wins, but the
  // box-sash mullion path asks the profile for its hollow section first.
  thicknessInFrameHollow: 144,
}

/** Integrate's standard double-glazed unit: 4 / 16 / 4, argon, warm edge. */
const GLASS_16 = {
  glazingId:           'double_glazing',
  isIndividualPanes:   false,
  internalGlassPartNo: 'GL100010',
  externalGlassPartNo: 'GL100080',
  spacerDimId:         'spacer_16',
  spacerColourId:      'white_warm_edge',
}

/**
 * A casement sash's or door leaf's glass, which Integrate stores WITHOUT a
 * spacer dimension of its own — the board's DEFAULT_GLASS has never carried
 * one. That is deliberate here: it is the shape of the real saved trees, and
 * it is what item 1's profile fallback exists for. Giving these fixtures a
 * spacer would hide the very thing being fixed.
 */
const CASEMENT_GLASS = {
  glazingId:           'double_glazing',
  isIndividualPanes:   false,
  internalGlassPartNo: 'GL100010',
  externalGlassPartNo: 'GL100080',
}

/** Vertical and horizontal glazing bars, as Integrate stores them. */
function bars({ v = 0, h = 0, keyPrefix, removedSegments = null }) {
  const out = []
  for (let i = 0; i < v; i++) {
    out.push({
      key: `${keyPrefix}_vb${i}`,
      part_type: 'verticalGlazingBarPart',
      values: { thickness: 22, nib: 4, ...(removedSegments ? { removedSegments } : {}) },
      children: [],
    })
  }
  for (let i = 0; i < h; i++) {
    out.push({
      key: `${keyPrefix}_hb${i}`,
      part_type: 'horizontalGlazingBarPart',
      values: { thickness: 22, nib: 4 },
      children: [],
    })
  }
  return out
}

// ── Casement items: LQ1, LQ2, LQ4, LQ8 ──────────────────────────────────────

/** A casement sash with its glass, and optionally its bars. */
function casementSash(key, operation, {
  bottomHeight = 83, barsV = 0, barsH = 0, removedSegments = null,
} = {}) {
  return {
    key,
    part_type: 'casementSashPart',
    values: {
      operation,
      casementTypeId: 'open_out',          // Integrate typeId 7
      thickness: 54,
      topHeight: 62, leftWidth: 62, rightWidth: 62, bottomHeight,
      mechanicalClearanceLeft: 4, mechanicalClearanceRight: 4,
      mechanicalClearanceTop: 4, mechanicalClearanceBottom: 4,
      btmRailShapeId: 'square',
      toBeReplaced: true,
    },
    children: [
      {
        key: `${key}_glass`,
        part_type: 'glassPart',
        values: { ...CASEMENT_GLASS, glazingRebateWidth: 16, glazingTolerance: 2 },
        children: bars({ v: barsV, h: barsH, keyPrefix: key, removedSegments }),
      },
    ],
  }
}

function divider(key, partType, offset, thickness, stopKey) {
  return {
    key,
    part_type: partType,
    values: {
      offset, thicknessInFrame: thickness, [stopKey]: 20,
      startDivider: '0', endDivider: '0',
    },
    children: [],
  }
}

/** A casement item, as Integrate saves one. */
function casementItem({
  width, height, frameMaterial = 'softwood', sashMaterial = 'softwood',
  cillDepth = 128, cillHorns = 0, dividers = [], openings,
  ironmongeryLines, surroundLines = null, floorLevel = 'ground_floor',
  externalAccess = 'easily_accessible', fitToPreparedOpening = false,
  isCasementMpls = true,
  // Step BN: the surround ticks and the existing-SDG dropdowns, set from the
  // facts' per-item surround and SDG fields.
  surround = {}, sdg = {},
}) {
  return {
    key: 'item1',
    part_type: 'drawingItemPart',
    values: {
      typeOfWork: 'complete_new',
      frameMaterialId: frameMaterial,
      sashMaterialId:  sashMaterial,
      cillMaterialId:  'utile',            // Integrate 44 on every LQ item
      floorLevel,
      ...(fitToPreparedOpening ? { fitToPreparedOpening: true } : {}),
      ...(surroundLines ? { surroundLines } : {}),
    },
    children: [
      {
        key: 'paint1',
        part_type: 'paintAndIronmongeryPart',
        values: {
          internalFinish: 'clean_white', externalFinish: 'clean_white',
          cillFinish: 'clean_white', cutOutBrickReveal: false,
          ironmongeryFinish: 'PB',
          isCasementMpls,
          ...surround, ...sdg,
          ironmongeryLines: ironmongeryLines.map(l => ({ ...l })),
        },
        children: [],
      },
      {
        key: 'notes1',
        part_type: 'notesPart',
        values: { installationMethod: 'externally', externalAccessId: externalAccess },
        children: [],
      },
      {
        key: 'frame1',
        part_type: 'assemblyFramePart',
        values: {
          width, height,
          leftWidth: 37, rightWidth: 37, topHeight: 47, bottomHeight: 47,
          frameDepth: 96, jambType: 'solid_profiled',
          frameHeadStopSize: 20, frameStileStopSize: 20, cillStopSize: 20,
          ...(cillHorns ? { leftCillHorn: cillHorns, rightCillHorn: cillHorns } : {}),
          rakeFrame: false, archHead: false,
          toBeReplaced: true,
        },
        children: [
          ...dividers,
          ...openings,
          {
            key: 'cill1',
            part_type: 'cillPart',
            values: { height: 47, depth: cillDepth },
            children: [],
          },
        ],
      },
    ],
  }
}

const LQ_CASEMENT_ASSUMPTIONS = [
  'Every frame, divider, opening, cill, glass, bar and stored ironmongery value: Integrate’s own saved drawings (docs/integrate-live-quotes.txt, read 16 Oct 2026)',
  'A casement sash’s glass carries NO spacer dimension, which is what Integrate’s saved trees hold — the 16 mm comes from the drawing’s profile (Step BL item 1)',
  'One cillPart per frame, as every casement fixture since Step AO: Integrate stores one per bottom-row opening and prices the full frame width',
  'Integrate fields with no GlazePro home, left out rather than invented: frameStopId / cillStopId 40, btmRailShapeId 99, shoulderHeight, offset2 on every divider and bar, tailLinkType, nib, isDocL, pricefileNo, itemTypeId, installationLevel, surveyByUs / deliveryByUs / installByUs',
  'installationMethod externally is Integrate’s installationMethodId 1; the engine does not read it',
]

// ── LQ1 — L34268 item 4: three sashes, 1 V + 2 H bars on each ──────────────
// Interior 1926 x 1206, mullions 27 at 624 and 1275, so three 624 columns.
// Each sash 616 x 1198, glass sightline 492 x 1053 -> cut 520 x 1081 = 0.56 m².
// The bars make each unit "Multiple" (3 bars), so Integrate charges
// 0.56 x 29.20 = 16.35 three times — the £49.05 GlazePro was missing.
const LQ1_IRONMONGERY = [
  { product_short_name: 'connoisseur_handle_lh',       finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'defender_615mm',              finish_code: 'PC',  qty: 1, source: 'survey' },
  { product_short_name: 'kenrick_extension_490mm',     finish_code: 'PC',  qty: 2, source: 'survey' },
  { product_short_name: 'kenrick_extension_gear_box',  finish_code: 'PC',  qty: 1, source: 'survey' },
  { product_short_name: 'trickle',                     finish_code: 'Wht', qty: 1, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',           finish_code: 'Wht', qty: 1, source: 'survey' },
]

export const BENCHMARK_LQ1 = {
  name: 'Benchmark LQ1 — Casement 2000x1300, bars on every sash (L34268 item 4)',
  tree: casementItem({
    surround: { surroundArchitrave: true, surroundWindowBoard: true },
    width: 2000, height: 1300,
    dividers: [
      divider('mull1', 'mullionPart', 624,  27, 'mullionStopSize'),
      divider('mull2', 'mullionPart', 1275, 27, 'mullionStopSize'),
    ],
    openings: [
      casementSash('cas_a1', 'fix',      { barsV: 1, barsH: 2 }),
      casementSash('cas_b1', 'top_hung', { barsV: 1, barsH: 2 }),
      casementSash('cas_c1', 'fix',      { barsV: 1, barsH: 2 }),
    ],
    ironmongeryLines: LQ1_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkLQ1_casement_fixed_tophung_fixed_bars },
  partCostMap: LQ_PART_COST_MAP,
  profileValues: LQ_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: LQ1_IRONMONGERY,
  assumptions: [
    ...LQ_CASEMENT_ASSUMPTIONS,
    'The stored surround list holds the two Ogee architrave lines Integrate charges as Component Cost (2.80 m and 2.10 m); its "Window board in MDF" has no component line and no GlazePro input, and the Windowboard LABOUR is the declared known gap',
  ],
}

// ── LQ2 — L33022 item 10: a barred UTILE fanlight over a fixed sash ─────────
// Interior 926 x 1106, transom 27 at 356, so rows of 356 and 723.
// The fanlight's one vertical bar makes it "Single": 1.00 x 9.21.
// Everything is Solid Utile — frame, sashes and cill.
const LQ2_IRONMONGERY = [
  { product_short_name: 'connoisseur_handle_lh',       finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'defender_209mm',              finish_code: 'PC',  qty: 1, source: 'survey' },
  { product_short_name: 'kenrick_extension_690mm',     finish_code: 'PC',  qty: 2, source: 'survey' },
  { product_short_name: 'kenrick_extension_gear_box',  finish_code: 'PC',  qty: 1, source: 'survey' },
  { product_short_name: 'trickle',                     finish_code: 'Wht', qty: 1, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',           finish_code: 'Wht', qty: 1, source: 'survey' },
]

export const BENCHMARK_LQ2 = {
  name: 'Benchmark LQ2 — Utile casement, barred fanlight over fixed (L33022 item 10)',
  tree: casementItem({
    surround: { surroundArchitrave: true, surroundLinings: true, surroundWindowBoard: true },
    width: 1000, height: 1200,
    frameMaterial: 'utile', sashMaterial: 'utile',
    cillDepth: 159,
    fitToPreparedOpening: true,
    dividers: [divider('trans1', 'transomPart', 356, 27, 'transomStopSize')],
    openings: [
      // the fanlight: a 62 bottom rail and ONE vertical bar
      casementSash('cas_a1', 'top_hung', { bottomHeight: 62, barsV: 1 }),
      casementSash('cas_a2', 'fix'),
    ],
    ironmongeryLines: LQ2_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkLQ2_utile_fanlight_bar_over_fixed },
  partCostMap: LQ_PART_COST_MAP,
  profileValues: LQ_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: LQ2_IRONMONGERY,
  assumptions: [
    ...LQ_CASEMENT_ASSUMPTIONS,
    'Fit to prepared opening is Integrate’s fitToPreparedOpening, which takes 60 minutes off the fitting ("Prepared Opening" -60)',
    'Integrate also stores an `ironmongery` allocation row (Utile63x63 qty 0 amt 4880) with no GlazePro equivalent; it carries no price line',
    'The Linings and Windowboard labour (180 + 30) is the declared known gap: the surround input is a later step',
  ],
}

// ── LQ4 — L32520 item 16: config 7, tall, 75 mm dividers, one bar ──────────
// 1529 x 2600 — the frame that proves item 4: 2.6 m tall, so Integrate
// charges BOTH "1500 Height Casement Frame Replacement" (60) and "2500
// Height..." (300), and GlazePro charged neither because
// tallest_external_frame_height was never computed.
//
// Interior 1455 x 2506. Mullions 75 at 275 and 1105; transom 75 at 555.
// Columns 275 | 755 | 275; rows 555 | 1876.
const LQ4_IRONMONGERY = [
  { product_short_name: 'trickle',           finish_code: 'Wht', qty: 1, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16', finish_code: 'Wht', qty: 1, source: 'survey' },
]

export const BENCHMARK_LQ4 = {
  name: 'Benchmark LQ4 — Config 7 casement 1529x2600, one barred sash (L32520 item 16)',
  tree: casementItem({
    surround: { surroundArchitrave: true, surroundWindowBoard: true },
    width: 1529, height: 2600,
    isCasementMpls: false,
    dividers: [
      divider('mull1',  'mullionPart', 275,  75, 'mullionStopSize'),
      divider('mull2',  'mullionPart', 1105, 75, 'mullionStopSize'),
      divider('trans1', 'transomPart', 555,  75, 'transomStopSize'),
    ],
    openings: [
      // top row: 62 bottom rails; B1 alone carries one vertical bar
      casementSash('cas_a1', 'fix', { bottomHeight: 62 }),
      casementSash('cas_b1', 'fix', { bottomHeight: 62, barsV: 1 }),
      casementSash('cas_c1', 'fix', { bottomHeight: 62 }),
      // bottom row: 83 bottom rails
      casementSash('cas_a2', 'fix'),
      casementSash('cas_b2', 'fix'),
      casementSash('cas_c2', 'fix'),
    ],
    ironmongeryLines: LQ4_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkLQ4_config7_tall_one_bar },
  partCostMap: LQ_PART_COST_MAP,
  profileValues: LQ_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: LQ4_IRONMONGERY,
  assumptions: [
    ...LQ_CASEMENT_ASSUMPTIONS,
    'The dividers are 75 mm, not the casement profile’s 27: Integrate stores the thickness per divider and this item uses 75',
    'Only B1 has a bar, which is what makes this the reading for item 2: "Additional for Glazing Bars" must fire ONCE, not six times',
    'Integrate’s labour for this item is 25.25 h where its own fitting-units page lists 22.25 h; the 3 h difference is unexplained and declared as a known gap rather than reproduced',
  ],
}

// ── LQ8 — L32520 item 9: one top-hung sash, a TOWER, and cill horns ────────
// 1060 x 1230, interior 986 x 1136, so the sash is 978 x 1128.
// External access is Integrate's "WSW Mobile Tower" (id 2), which is what
// item 5 maps to GlazePro's `tower_by_wsw` — 180 minutes GlazePro never
// charged because `is_our_mobile_tower_required` was never set.
//
// The cill carries 60 mm horns each side, which the reviewer's live drawing
// left out: the cill length is 1060 + 60 + 60, and that is the 1.40 of
// manufacture_materials between the live figure and Integrate's.
const LQ8_IRONMONGERY = [
  { product_short_name: 'defender_412mm',                        finish_code: 'PC',  qty: 1, source: 'survey' },
  { product_short_name: 'hardwick_lyndon_rh_locking_espag_handle', finish_code: 'PB', qty: 1, source: 'survey' },
  { product_short_name: 'kenrick_extension_690mm',               finish_code: 'PC',  qty: 2, source: 'survey' },
  { product_short_name: 'kenrick_extension_gear_box',            finish_code: 'PC',  qty: 1, source: 'survey' },
  { product_short_name: 'trickle',                               finish_code: 'Wht', qty: 1, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',                     finish_code: 'Wht', qty: 1, source: 'survey' },
]

export const BENCHMARK_LQ8 = {
  name: 'Benchmark LQ8 — Casement 1060x1230 top-hung, mobile tower (L32520 item 9)',
  tree: casementItem({
    width: 1060, height: 1230,
    cillHorns: 60,
    floorLevel: 'first_floor',
    externalAccess: 'tower_by_wsw',
    openings: [casementSash('cas_a1', 'top_hung')],
    ironmongeryLines: LQ8_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkLQ8_casement_tophung_tower },
  partCostMap: LQ_PART_COST_MAP,
  profileValues: LQ_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: LQ8_IRONMONGERY,
  assumptions: [
    ...LQ_CASEMENT_ASSUMPTIONS,
    'External access `tower_by_wsw` is Integrate’s externalAccessId 2 "WSW Mobile Tower", which fires "Scaffold Tower" for 180 minutes (Step BL item 5)',
    'The cill horns are Integrate’s cillHornLengthLeft / Right 60, stored here as leftCillHorn / rightCillHorn: the reviewer’s live drawing left them out, which is why its manufacture_materials read 58.93 against Integrate’s 60.33',
  ],
}

// ── Box sash items: LQ5, LQ6, LQ7, LQ9 ──────────────────────────────────────
//
// All four are Integrate's "Standard" range — a hollow box frame, cord-hung
// sashes, a chamfered bottom rail at 9°. Three of them carry a CUSTOM 75 mm
// top horn and a plain bottom, which is the reading for item 3: Integrate
// charges "Non-Std Horn 75mm" once per pair, for the sash that has the horn.

/** A box sash's glass: Integrate's 4 / 16 / 4, with the stored spacer. */
const BOX_GLASS = { ...GLASS_16 }

/**
 * One cord-hung pair, as Integrate stores one: the horn types and the
 * clearances live on the PAIR, the sections on each sash.
 *
 * `arch` is the TOP sash's own arch — Integrate's archHeight (the glass
 * rise) and archRadius, with isFrameLevelArch where the arch is cut in the
 * frame head as well (LQ5) rather than in a square frame (LQ6).
 */
function boxPair(key, {
  topHorn = 'custom', topHornLength = 75, arch = null,
} = {}) {
  return {
    key,
    part_type: 'sashPairPart',
    values: {
      sashThickness: 45,
      midrailHeight: 40,                 // Integrate midRail 40
      mechanicalClearanceLeft:  2.5,
      mechanicalClearanceRight: 2.5,
      mechanicalClearanceTop:   0,
      mechanicalClearanceBottom: 0,
      topHornTypeShortName: topHorn,
      topHornLength,
      bottomHornTypeShortName: 'no_horn',
      bottomHornLength: 0,
      sashSplit: 'half_half',            // Integrate sashSplitId 12
    },
    children: [
      {
        key: `${key}_top`,
        part_type: 'topSashPart',
        values: {
          topHeight: 49, bottomHeight: 40, leftWidth: 49, rightWidth: 49,
          operation: 'cord_hung',
          toBeReplaced: true,
          ...(arch
            ? {
              archHead: true,
              archHeight: arch.rise,
              archRadius: arch.radius,
              ...(arch.frameLevel ? { isFrameLevelArch: true } : {}),
            }
            : { archHead: false }),
        },
        children: [
          {
            key: `${key}_top_glass`,
            part_type: 'glassPart',
            values: { ...BOX_GLASS },
            children: [],   // bars go on through withTopBars
          },
        ],
      },
      {
        key: `${key}_bot`,
        part_type: 'bottomSashPart',
        values: {
          topHeight: 40, bottomHeight: 88, leftWidth: 49, rightWidth: 49,
          operation: 'cord_hung',
          toBeReplaced: true,
          btmRailShapeId: 'chamfered',
          chamferedBottomRailAngle: 9,
        },
        children: [
          {
            key: `${key}_bot_glass`,
            part_type: 'glassPart',
            values: { ...BOX_GLASS },
            children: [],
          },
        ],
      },
    ],
  }
}

/** Put bars on a pair's TOP sash glass, as Integrate stores them. */
function withTopBars(pair, { v = 0, h = 0, removedSegments = null }) {
  const top = pair.children[0]
  const glass = top.children[0]
  return {
    ...pair,
    children: [
      {
        ...top,
        children: [{
          ...glass,
          children: bars({ v, h, keyPrefix: glass.key, removedSegments }),
        }],
      },
      pair.children[1],
    ],
  }
}

/** A box sash item, as Integrate saves one. */
function boxSashItem({
  width, height, frameMaterial = 'softwood', sashMaterial = 'softwood',
  pairs, mullion = null, cills = 1, ironmongeryLines,
  floorLevel = 'second_floor', fitToPreparedOpening = false,
  surround = {}, sdg = {},   // Step BN
}) {
  const cillNodes = Array.from({ length: cills }, (_, i) => ({
    key: `cill${i + 1}`,
    part_type: 'cillPart',
    values: { height: 70, depth: 140 },
    children: [],
  }))
  return {
    key: 'item1',
    part_type: 'drawingItemPart',
    values: {
      typeOfWork: 'complete_new',
      frameMaterialId: frameMaterial,
      sashMaterialId:  sashMaterial,
      cillMaterialId:  'utile',
      floorLevel,
      ...(fitToPreparedOpening ? { fitToPreparedOpening: true } : {}),
    },
    children: [
      {
        key: 'paint1',
        part_type: 'paintAndIronmongeryPart',
        values: {
          internalFinish: 'clean_white', externalFinish: 'clean_white',
          cillFinish: 'clean_white', cutOutBrickReveal: false,
          ironmongeryFinish: 'PB',
          ...surround, ...sdg,
          ironmongeryLines: ironmongeryLines.map(l => ({ ...l })),
        },
        children: [],
      },
      {
        key: 'notes1',
        part_type: 'notesPart',
        values: { externalAccessId: 'easily_accessible' },
        children: [],
      },
      {
        key: 'frame1',
        part_type: 'assemblyFramePart',
        values: {
          width, height,
          // Integrate's hollow box frame: 85 jambs, 79 head, 70 cill, depth
          // 140, every stop 16
          leftWidth: 85, rightWidth: 85, topHeight: 79, bottomHeight: 70,
          frameDepth: 140, jambType: 'hollow_box',
          frameHeadStopSize: 16, frameStileStopSize: 16, cillStopSize: 16,
          rakeFrame: false, archHead: false,
          toBeReplaced: true,
        },
        children: [
          ...(mullion ? [mullion] : []),
          ...cillNodes,
          ...pairs,
        ],
      },
    ],
  }
}

const LQ_BOX_ASSUMPTIONS = [
  'Every frame, pair, sash, cill, glass, bar, horn and stored ironmongery value: Integrate’s own saved drawings (docs/integrate-live-quotes.txt, read 16 Oct 2026)',
  'The horn types and the 2.5 mm side clearances live on the PAIR, as Integrate stores them; each sash carries its own sections',
  'Integrate fields with no GlazePro home, left out rather than invented: partingBeadTypeId 280, midRailTypeId 91, sashSplitId / meetingStileSplitId 12, btmRailShapeId 100, shoulderHeight, offset2, tailLinkType, existingSurroundTypeId / ActionId, isSashWindow, itemTypeId',
  'The STEEL WEIGHT lines follow the sash weight model, which is 0.1 kg heavier than Integrate on these drawings — a parked residual under £1 with a named cause (Step W’s six failing measurement rows)',
]

// ── LQ5 — L34265 item 3: a FRAME-LEVEL arch and a custom 75 mm horn ────────
// 780 x 1769. Interior 610 x 1620; the sash is 605 wide (610 less the two
// 2.5 clearances). The top sash is arched at FRAME level — rise 363,
// radius 270 — which is benchmark C's model, so the glass should price as
// C's does: Shaped Glass Cost on the shaped area.
//
// The horn: a custom 75 on the TOP sash and "no horn" on the bottom, so
// Integrate charges "Non-Std Horn 75mm" ONCE (30 minutes).
const LQ5_IRONMONGERY = [
  { product_short_name: 'z-claw_fastener_kit_wpulleys', finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',            finish_code: 'Wht', qty: 1, source: 'survey' },
]

export const BENCHMARK_LQ5 = {
  name: 'Benchmark LQ5 — Box sash 780x1769, frame-level arch, custom horn (L34265 item 3)',
  tree: boxSashItem({
    sdg: { existingSurroundTypeId: 5, existingSurroundActionId: 1 },
    width: 780, height: 1769,
    pairs: [boxPair('pair1', { arch: { rise: 363, radius: 270, frameLevel: true } })],
    ironmongeryLines: LQ5_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkLQ5_box_sash_frame_arch_custom_horn },
  partCostMap: LQ_PART_COST_MAP,
  profileValues: LQ_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: LQ5_IRONMONGERY,
  assumptions: [
    ...LQ_BOX_ASSUMPTIONS,
    'The arch is FRAME level (Integrate isFrameLevelArch true), which is benchmark C’s model',
    'The 75 minutes of "Remove and Refit Shutters" come from a scope-of-works note on the item, which GlazePro has no input for — the declared known gap',
  ],
}

// ── LQ6 — L34265 item 1: a double box, each top sash arched at SASH level ──
// 1620 x 1779 with a 220 mm HOLLOW mullion at 615, so two bays of 615.
// Each top sash is arched — rise 256, radius 256 — in a SQUARE frame, which
// is new to GlazePro: C and LQ5 are both frame-level.
//
// Two pairs, each with a custom 75 mm top horn, so Integrate charges the
// horn rule TWICE (2 x 30) — once per pair, not once per sash.
const LQ6_IRONMONGERY = [
  { product_short_name: 'z-claw_fastener_kit_wpulleys', finish_code: 'PB',  qty: 2, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',            finish_code: 'Wht', qty: 1, source: 'survey' },
]

export const BENCHMARK_LQ6 = {
  name: 'Benchmark LQ6 — Double box 1620x1779, sash-level arches (L34265 item 1)',
  tree: boxSashItem({
    width: 1620, height: 1779,
    mullion: {
      key: 'mull1',
      part_type: 'mullionPart',
      // Integrate: 220 thick, hollow, offset 615
      values: {
        offset: 615, thicknessInFrame: 220, mullionStopSize: 16,
        isHollowMullion: true, startDivider: '0', endDivider: '0',
      },
      children: [],
    },
    cills: 2,
    pairs: [
      boxPair('pairA', { arch: { rise: 256, radius: 256 } }),
      boxPair('pairB', { arch: { rise: 256, radius: 256 } }),
    ],
    ironmongeryLines: LQ6_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkLQ6_double_box_sash_level_arch },
  partCostMap: LQ_PART_COST_MAP,
  profileValues: LQ_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: LQ6_IRONMONGERY,
  assumptions: [
    ...LQ_BOX_ASSUMPTIONS,
    'Each top sash is arched at SASH level in a SQUARE frame (no isFrameLevelArch), which no earlier benchmark covers — C and LQ5 are frame-level',
    'The mullion is 220 mm and HOLLOW (Integrate isHollowMullion true), which is why the two bays are 615 each',
  ],
}

// ── LQ7 — L33022 item 1: a UTILE box sash with a barred top sash ───────────
// 1000 x 1400, everything Solid Utile. This is the reading for item 7:
// "Hardwood Box Frame" (22.27 -> £38.98) and "Hardwood Sashes" (7.27 /
// 9.22 -> £12.73 / £16.13), neither of which GlazePro charged.
//
// The top sash has one vertical bar with its middle segment removed and one
// horizontal bar, so its glass is "Multiple" (2 bars): 0.42 x 29.20 = 12.26.
// A VICTORIAN horn, not a custom one, so no Non-Std Horn charge.
const LQ7_IRONMONGERY = [
  { product_short_name: 'z-claw_fastener_kit_wpulleys', finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',            finish_code: 'Wht', qty: 1, source: 'survey' },
]

export const BENCHMARK_LQ7 = {
  name: 'Benchmark LQ7 — Utile box sash 1000x1400, barred top sash (L33022 item 1)',
  tree: boxSashItem({
    surround: { surroundArchitrave: true, surroundLinings: true, surroundWindowBoard: true },
    width: 1000, height: 1400,
    frameMaterial: 'utile', sashMaterial: 'utile',
    floorLevel: 'ground_floor',
    fitToPreparedOpening: true,
    pairs: [
      withTopBars(
        boxPair('pair1', { topHorn: 'victorian', topHornLength: 75 }),
        { v: 1, h: 1, removedSegments: 2 },
      ),
    ],
    ironmongeryLines: LQ7_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkLQ7_utile_box_sash },
  partCostMap: LQ_PART_COST_MAP,
  profileValues: LQ_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: LQ7_IRONMONGERY,
  assumptions: [
    ...LQ_BOX_ASSUMPTIONS,
    'Solid Utile throughout (Integrate material 44) — frame, sashes and cill',
    'The vertical bar has removedSegments 2, which is Integrate’s "segment removed"; GlazePro stores the flag and no rule reads it',
    'The Linings and Windowboard labour (180 + 30) is the declared known gap: the surround input is a later step',
  ],
}

// ── LQ9 — L34265 item 4: one barred top sash and a custom 75 mm horn ───────
// 1090 x 1829. One vertical bar on the top sash, so its glass is "Single":
// 1.00 x 9.21. The horn rule fires ONCE.
const LQ9_IRONMONGERY = [
  { product_short_name: 'z-claw_fastener_kit_wpulleys', finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',            finish_code: 'Wht', qty: 1, source: 'survey' },
]

export const BENCHMARK_LQ9 = {
  name: 'Benchmark LQ9 — Box sash 1090x1829, barred top sash, custom horn (L34265 item 4)',
  tree: boxSashItem({
    width: 1090, height: 1829,
    pairs: [withTopBars(boxPair('pair1'), { v: 1 })],
    ironmongeryLines: LQ9_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkLQ9_box_sash_bar_custom_horn },
  partCostMap: LQ_PART_COST_MAP,
  profileValues: LQ_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: LQ9_IRONMONGERY,
  assumptions: [
    ...LQ_BOX_ASSUMPTIONS,
    'One vertical bar on the top sash: Integrate charges "Square Glass Single Glazing Bar" 1.00 x 9.21 and the production bar rules once',
  ],
}

// ── LQ3 — L33022 item 12: UTILE French doors, barred glass over a panel ────
//
// 1600 x 2150, everything Solid Utile, opening OUT. Each leaf is glass over
// a RAISED AND FIELDED panel with an ovolo bead, split by a 170 mm mid rail,
// and the glass carries one vertical bar (its middle segment removed) and one
// horizontal bar — so each unit is "Multiple" and Integrate charges
// 0.70 x 29.20 = 20.44 twice. That is £40.88 of the £40.88 GlazePro was
// missing on this drawing (item 1), and the per-leaf bar count is item 2.
//
// The item has NO SURROUND at all (Integrate autoCalcSurroundComponents 0
// and no component list), which is why GlazePro's £17.96 of surround timber
// is the declared known gap rather than a difference to chase here.
const LQ3_IRONMONGERY = [
  { product_short_name: '102mm_hinges',                   finish_code: 'PB',  qty: 4, source: 'survey' },
  { product_short_name: 'double_euro_cylinder',           finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'hardwick_lyndon_door_espag_set', finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'trickle',                        finish_code: 'Wht', qty: 1, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',              finish_code: 'Wht', qty: 1, source: 'survey' },
]

/** One leaf: glass with its bars, a raised-and-fielded panel, a mid rail. */
function lq3Leaf(side, operation, isMaster) {
  const key = `fr_${side}`
  return {
    key,
    part_type: side === 'left' ? 'leftFrenchDoorLeafPart' : 'rightFrenchDoorLeafPart',
    values: {
      operation,
      casementTypeId: 'open_out',       // Integrate typeId 7
      thickness: 54,
      topHeight: 110, leftWidth: 110, rightWidth: 110,
      bottomHeight: 163,
      btmRailShapeId: 'stepped',        // Integrate btmRailShapeId 101
      steppedBottomRailOverlap: 7,
      isMasterLeaf: isMaster,
      toBeReplaced: true,
    },
    children: [
      {
        key: `${key}_midrail`,
        part_type: 'transomPart',
        values: {
          isMidrail: true,
          offset: 1217,
          thicknessInFrame: 170,
          midrailThickness: 170,
          transomStopSize: 18,
          startDivider: '0', endDivider: '0',
        },
        children: [],
      },
      {
        key: `${key}_glass`,
        part_type: 'glassPart',
        values: {
          ...CASEMENT_GLASS,
          glazingRebateWidth: 15,
          glazingTolerance: 3,
        },
        children: bars({ v: 1, h: 1, keyPrefix: `${key}_glass`, removedSegments: 2 }),
      },
      {
        key: `${key}_panel`,
        part_type: 'panelPart',
        values: {
          // Integrate panel type 110 = FLAT (112 is raised and fielded), bead
          // 120 = ovolo. CORRECTED in the Step BM follow-up: this read
          // 'raised_and_fielded' because the facts file called 110 that, and
          // R&F 2 x 120 happens to equal flat 2 x 60 plus Door Muntin 2 x 60,
          // so the wrong panel with an uncounted mid rail still landed on
          // Integrate's 61.22 h. Integrate's labour editor on this very item
          // (L33022 Q5 item 12, read 16 Oct 17:00) fires "Additional for Flat
          // Panel" 2 x 60 and "Door Muntin" 2 x 60.
          internalPanelTypeId: 'flat',
          externalPanelTypeId: 'flat',
          internalPanelBeadId: 'ovolo',
          externalPanelBeadId: 'ovolo',
          insulationThickness: 15,
          toBeReplaced: true,
        },
        children: [],
      },
    ],
  }
}

export const BENCHMARK_LQ3 = {
  name: 'Benchmark LQ3 — Utile French doors 1600x2150, bars over panels (L33022 item 12)',
  tree: {
    key: 'item1',
    part_type: 'drawingItemPart',
    values: {
      typeOfWork: 'complete_new',
      frameMaterialId: 'utile',
      sashMaterialId:  'utile',
      cillMaterialId:  'utile',
      floorLevel: 'ground_floor',
    },
    children: [
      {
        key: 'paint1',
        part_type: 'paintAndIronmongeryPart',
        values: {
          internalFinish: 'clean_white', externalFinish: 'clean_white',
          cillFinish: 'clean_white', cutOutBrickReveal: false,
          ironmongeryFinish: 'PB',
          isDoorMpls: true,
          // Step BN: Integrate has NO surround on this item
          // (autoCalcSurroundComponents 0, no component list), so nothing is
          // ticked -- not even the architrave, which GlazePro allocated
          // regardless and which was LQ3's +17.96 of installation_materials.
          surroundArchitrave: false, surroundLinings: false,
          surroundWindowBoard: false, surroundExternalLining: false,
          ironmongeryLines: LQ3_IRONMONGERY.map(l => ({ ...l })),
        },
        children: [],
      },
      {
        key: 'notes1',
        part_type: 'notesPart',
        values: { externalAccessId: 'easily_accessible' },
        children: [],
      },
      {
        key: 'frame1',
        part_type: 'assemblyFramePart',
        values: {
          width: 1600, height: 2150,
          leftWidth: 47, rightWidth: 47, topHeight: 47, bottomHeight: 37,
          frameDepth: 96, jambType: 'solid_profiled',
          frameHeadStopSize: 20, frameStileStopSize: 20, cillStopSize: 26,
          rakeFrame: false, archHead: false,
          toBeReplaced: true,
        },
        children: [
          {
            key: 'fr1',
            part_type: 'frenchDoorPart',
            values: {
              casementTypeId: 'open_out',
              thickness: 54,
              midRail: 198,
              gapBetweenMeetingStiles: 5,
              meetingStileOverlap: 27,
              mechanicalClearanceTop: 3,
              mechanicalClearanceBottom: 3,
              mechanicalClearanceLeft: 1,
              mechanicalClearanceRight: 1,
              masterLeaf: 'right',
            },
            children: [
              lq3Leaf('left',  'left_hand_hung',  false),
              lq3Leaf('right', 'right_hand_hung', true),
            ],
          },
          {
            key: 'cill1',
            part_type: 'cillPart',
            values: { height: 37, depth: 145 },
            children: [],
          },
        ],
      },
    ],
  },
  targets: { ...INTEGRATE_TARGETS.benchmarkLQ3_utile_french_doors_bars_panels },
  // A door's UTILE SECTIONS are priced per metre, so this one needs the
  // section rates as well as the architrave (the same map the FD benchmarks
  // use, which is where those rates were read).
  partCostMap: { ...LQ_PART_COST_MAP, ...DOOR_PART_COST_MAP },
  profileValues: LQ_PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: LQ3_IRONMONGERY,
  profileCode: 'open_out_doors',
  assumptions: [
    'Every frame, pair, leaf, panel, mid rail, cill, glass, bar and stored ironmongery value: Integrate’s own saved drawing (docs/integrate-live-quotes.txt, read 16 Oct 2026)',
    'Solid Utile throughout (Integrate material 44), range single_and_french_doors, which is GlazePro’s profileCode open_out_doors',
    'The panel is Integrate’s type 110 raised and fielded with bead 120 ovolo, both sides — difference 19 records that type 110 is FLAT in GlazePro’s earlier reading; this drawing is the first raised-and-fielded panel in a benchmark',
    'GlazePro charges £17.96 of surround timber although this item has NO surround (Integrate autoCalcSurroundComponents 0 and no component list) — the declared known gap, for the surround step',
    'Integrate fields with no GlazePro home, left out rather than invented: meetingStileSplitId / sashSplitId 12, btmRailShapeId 101, shoulderHeight, offset2, tailLinkType, the three `ironmongery` section allocation rows',
  ],
}
