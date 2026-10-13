/**
 * fixtureCasement.js
 * Benchmarks J, K, L, M and N — casement and direct glazed frames.
 *
 * Step AO: every value comes from Integrate's own saved drawings
 * (docs/integrate-L31115-direct-glazed.txt — fact, read 9 Oct 2026):
 *   J  L31115 item 1 drawing 12 — two opening casements, mullion, UTILE
 *   K  item 2 drawing 15 — opening casement + direct glazed unit
 *   L  item 2 drawing 16 — two direct glazed units + mullion
 *   M  item 2 drawing 17 — one direct glazed unit, no mullion
 *   N  item 2 drawing 18 — opening casement + FIXED casement sash
 *
 * GlazePro's board cannot draw these yet (Step AP), so these trees also fix
 * the shape the board will build. They stay in GlazePro's existing
 * conventions: an opening is either a `casementSashPart` (with its own
 * `glassPart` child) or a `glassPart` that is a DIRECT CHILD OF THE FRAME,
 * which is what makes it a direct glazed unit; the mullion is a
 * `mullionPart` child of the frame, as GlazePro's box sash mullions are,
 * with its own stored thickness (a casement mullion is SOLID — it must not
 * take the hollow box-sash profile value).
 *
 * Integrate stores some of this differently; those differences are recorded
 * here rather than copied:
 *  - its mullions/transoms live in the frame's `dividers` array, not as
 *    child parts (GlazePro: `mullionPart` children, as Step AE built);
 *  - it stores ONE CillPart per bottom-row opening (two 549-wide cills on
 *    J/K/L/N), but its cill VOLUME is the full frame width, so one GlazePro
 *    cill is the faithful model for pricing (facts "Sizes" + step-ao §3);
 *  - `itemTypeId` follows the content (3 with any casement sash, 25 when
 *    every opening is direct glazed); GlazePro has no such field and needs
 *    none — `is_casement_window` is "has a casement sash".
 *
 * NOT VERIFIED (as fixture E's spiral code): the live `sash_operation`
 * codes for casements. The repo records only the three sliding-sash labels
 * (sql/step-b2c-applies-to.sql; docs/pricing-vocabulary-audit.md says the
 * rest are live-only), so these fixtures use Integrate's own names in
 * GlazePro's code style — 'left_hand_hung' (Integrate 17),
 * 'right_hand_hung' (18) and 'fix' (11) — and the casement type code
 * 'open_out', which Step AP confirmed IS a live sash_type option (the live
 * list is open_out / open_in / stormproof — there is no 'open_out_flush',
 * which is what this fixture first guessed). Only `fix` is read by a priced rule
 * (fixed_casement_sash_qty), through the same substring test
 * optionVocabulary.operationKind uses, so the other spellings change no
 * figure.
 */

import INTEGRATE_TARGETS from './integrate-targets.json'

// ── Part cost map ────────────────────────────────────────────────────────────
const PART_COST_MAP = {
  TP68: 2.85,   // Ogee Architrave 20x70 MDF £2.85/m — Integrate's surround
}

// ── Ironmongery: the surveyor's explicit list, stored on all five ───────────
// Integrate never changes this list when openings change, so all four of its
// drawings carry the same set and price it identically (facts). GlazePro
// prices whatever is stored (fixture A's mechanism), and a stored list stops
// the complete-new defaults from running at all (resolveIronmongeryLines
// returns tree-saved lines when there are any) — asserted in the tests.
const IRONMONGERY_LINES = [
  { product_short_name: 'connoisseur_handle_lh',                    finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'connoisseur_handle_rh',                    finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'defender_friction_hinge_-_side_hung_412mm', finish_code: 'PC', qty: 2, source: 'survey' },
  { product_short_name: 'kenrick_extension_690mm',                   finish_code: 'PC', qty: 4, source: 'survey' },
  { product_short_name: 'kenrick_extension_gear_box',                finish_code: 'PC', qty: 2, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',                         finish_code: 'Wht', qty: 1, source: 'survey' },
]

// Profile values: the glass rebate/tolerance for casement and direct glazed
// glass are stored ON THE GLASS PART by Integrate (16/2 for a casement sash,
// 20/2 for a direct glazed unit), so these profile defaults are only the
// sliding-sash fallback and are not read by J–N.
const PROFILE_VALUES = {
  defaultDoubleGlazingRebateWidthForSash: 14,
  defaultDoubleGlazingTolerance: 2,
}

const GLASS_CODES = {
  glazingId:           'double_glazing',   // Integrate glazingId 2
  isIndividualPanes:   false,
  internalGlassPartNo: 'GL100010',
  externalGlassPartNo: 'GL100080',
}

// ── Openings ─────────────────────────────────────────────────────────────────

/** A casement sash opening with its own glass (Integrate's CasementSashPart). */
function casementSash(key, operation) {
  return {
    key,
    part_type: 'casementSashPart',
    values: {
      operation,                      // Integrate operationId 17 / 18 / 11
      casementTypeId: 'open_out',  // Integrate typeId 7
      thickness: 54,
      topHeight:     62,              // head
      leftWidth:     62,              // stiles
      rightWidth:    62,
      bottomHeight:  83,              // bottom rail
      mechanicalClearanceLeft:   4,
      mechanicalClearanceRight:  4,
      mechanicalClearanceTop:    4,
      mechanicalClearanceBottom: 4,
      toBeReplaced:  true,
    },
    children: [
      {
        key: `${key}_glass`,
        part_type: 'glassPart',
        // Integrate stores the rebate and tolerance on the glass part
        values: { ...GLASS_CODES, glazingRebateWidth: 16, glazingTolerance: 2 },
        children: [],
      },
    ],
  }
}

/**
 * A direct glazed unit: a glassPart that is a DIRECT CHILD OF THE FRAME.
 * It carries the opening-level fields itself, as Integrate's does.
 */
function directGlazedUnit(key) {
  return {
    key,
    part_type: 'glassPart',
    values: {
      ...GLASS_CODES,
      toBeReplaced: true,
      mechanicalClearanceLeft:   20,
      mechanicalClearanceRight:  20,
      mechanicalClearanceTop:    20,
      mechanicalClearanceBottom: 20,
      hiddenInRebateLeft:   18,
      hiddenInRebateRight:  18,
      hiddenInRebateTop:    18,
      hiddenInRebateBottom: 18,
      glazingRebateWidth: 20,
      glazingTolerance:   2,
    },
    children: [],
  }
}

/** The solid casement mullion: offset = LEFT face, as Step AE established. */
function mullion() {
  return {
    key: 'mull1',
    part_type: 'mullionPart',
    // internal width 1125 → (1125 − 27) / 2 = 549 (Integrate's own offset)
    values: { offset: 549, thicknessInFrame: 27, mullionStopSize: 20 },
    children: [],
  }
}

// ── The tree ─────────────────────────────────────────────────────────────────

function casementTree({ utile = false, thirdFloor = false, openings, withMullion = true, width = 1199, height = 1299 }) {
  const timber = utile ? 'utile' : 'softwood'
  return {
    key: 'item1',
    part_type: 'drawingItemPart',
    values: {
      typeOfWork:      'complete_new',
      // Integrate J: 44/44/44 (utile throughout). K–N: "Softwood with
      // Hardwood Cill" = 38/38/44.
      frameMaterialId: timber,
      sashMaterialId:  timber,
      cillMaterialId:  'utile',
      // J is L31115 item 1 (third floor, as fixture A — its labour includes
      // the 60-minute third-floor rule); K–N are item 2 (first floor, as B)
      floorLevel:      thirdFloor ? 'third_floor' : 'first_floor',
    },
    children: [
      {
        key: 'paint1',
        part_type: 'paintAndIronmongeryPart',
        values: {
          internalFinish:    'clean_white',   // Teknos Clean White int/ext/cill
          externalFinish:    'clean_white',
          cillFinish:        'clean_white',
          cutOutBrickReveal: false,
          ironmongeryFinish: 'PB',
          ironmongeryLines:  IRONMONGERY_LINES.map(l => ({ ...l })),
        },
        children: [],
      },
      {
        key: 'notes1',
        part_type: 'notesPart',
        values: { installationMethod: 'internally' },   // ASSUMPTION, as the other fixtures
        children: [],
      },
      {
        key: 'frame1',
        part_type: 'assemblyFramePart',
        values: {
          width,
          height,
          leftWidth:  37,
          rightWidth: 37,
          topHeight:  47,
          bottomHeight: 47,
          frameDepth: 96,
          // Integrate jambType 'solid_profiled' — GlazePro's reference list
          // already has this exact code (optionVocabulary JAMB_TYPE_CODES),
          // and no pricing rule reads it.
          jambType: 'solid_profiled',
          frameHeadStopSize:  20,
          frameStileStopSize: 20,
          cillStopSize:       20,
          rakeFrame: false,
          archHead:  false,
        },
        children: [
          ...(withMullion ? [mullion()] : []),
          // Openings left to right, in tree order (Integrate matrixIndex A1, B1)
          ...openings,
          {
            key: 'cill1',
            part_type: 'cillPart',
            // ONE cill per GlazePro frame, height 47, depth 128. Integrate
            // stores one per bottom opening but prices the full frame width.
            values: { height: 47, depth: 128 },
            children: [],
          },
        ],
      },
    ],
  }
}

const COMMON = {
  partCostMap: PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  ironmongeryLines: IRONMONGERY_LINES,
  glassCatalogue: {},
}

const SHARED_ASSUMPTIONS = [
  'Frame, openings, mullion, cill, glass and ironmongery: Integrate’s saved drawings (docs/integrate-L31115-direct-glazed.txt)',
  'Casement operation and type CODES not verified — the live sash_operation list holds only the three sliding-sash labels in the repo; only "fix" is read by a priced rule',
  'One cillPart per frame (Integrate stores one per bottom opening, prices the full frame width — step-ao §3)',
  'installationMethod internally: ASSUMPTION, not in the Integrate read (as the other fixtures); the engine does not read it',
  'Nathan (9 Oct): a frame with only direct glazed units gets NO frame timber, cill or LTW consumables lines — matching Integrate, not a GlazePro difference',
]

export const BENCHMARK_J = {
  name: 'Benchmark J — Two opening casements, utile (L31115 Item 1 Drawing 12)',
  tree: casementTree({
    utile: true, thirdFloor: true,
    openings: [casementSash('cas_a1', 'left_hand_hung'), casementSash('cas_b1', 'right_hand_hung')],
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkJ_casement_two_opening_utile },
  ...COMMON,
  assumptions: [
    ...SHARED_ASSUMPTIONS,
    'Utile throughout (Integrate 44/44/44): priced by the length rules (Casement Frame Jambs & Cills, Head, Transoms & Mullions), with no sash timber line — Integrate has no hardwood casement sash rule',
  ],
}

export const BENCHMARK_K = {
  name: 'Benchmark K — Casement + direct glazed unit (L31115 Item 2 Drawing 15)',
  tree: casementTree({
    openings: [casementSash('cas_a1', 'left_hand_hung'), directGlazedUnit('dg_b1')],
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkK_casement_plus_direct_glazed },
  ...COMMON,
  assumptions: SHARED_ASSUMPTIONS,
}

export const BENCHMARK_L = {
  name: 'Benchmark L — Two direct glazed units + mullion (L31115 Item 2 Drawing 16)',
  tree: casementTree({
    openings: [directGlazedUnit('dg_a1'), directGlazedUnit('dg_b1')],
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkL_two_direct_glazed_mullion },
  ...COMMON,
  assumptions: SHARED_ASSUMPTIONS,
}

export const BENCHMARK_M = {
  name: 'Benchmark M — Single direct glazed unit, no mullion (L31115 Item 2 Drawing 17)',
  tree: casementTree({
    withMullion: false,
    openings: [directGlazedUnit('dg_a1')],
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkM_single_direct_glazed },
  ...COMMON,
  assumptions: SHARED_ASSUMPTIONS,
}

// Benchmark P (step-ao addendum): the same drawing resized — 1599 x 1599,
// the mullion removed and ONE opening casement, so its sash is 1517 x 1497.
// It is the reading that proves the frame timber formula's rounding (33.45)
// and the only benchmark whose casement sash is over the 25 kg "Any Sash
// Overweight" threshold.
export const BENCHMARK_P = {
  name: 'Benchmark P — Single opening casement 1599 x 1599 (L31115 Item 2 Drawing 19)',
  tree: casementTree({
    width: 1599, height: 1599, withMullion: false,
    openings: [casementSash('cas_a1', 'left_hand_hung')],
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkP_single_casement_1599 },
  ...COMMON,
  assumptions: [
    ...SHARED_ASSUMPTIONS,
    'Resized from the Drawing 19 state the reviewer read: 1599 x 1599, no mullion, one opening casement (sash 1517 x 1497, glass 1421 x 1380 = 1.96 m²)',
    'Its sash is the only benchmark sash over 25 kg, so install rule 95 "Any Sash Overweight (Casement)" fires — the weight comes from Step W’s measured method, not a constant',
  ],
}

export const BENCHMARK_N = {
  name: 'Benchmark N — Casement + fixed casement sash (L31115 Item 2 Drawing 18)',
  tree: casementTree({
    openings: [casementSash('cas_a1', 'left_hand_hung'), casementSash('cas_b1', 'fix')],
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkN_casement_plus_fixed_casement },
  ...COMMON,
  assumptions: [
    ...SHARED_ASSUMPTIONS,
    'A FIXED casement sash (Integrate operationId 11) is still a sash: it counts in casement_sash_qty and new_casement_sash_qty, and takes sash timber, machining and finishing — the minute reconciliations prove it (facts "Production minutes")',
  ],
}

// ── Step AR — fanlights (transoms): benchmarks Q, R and S ───────────────────
//
// Integrate's own drawings, read 12 Oct 2026
// (docs/integrate-L31115-fanlights.txt):
//   Q  L31115 item 2 drawing 21 — 1040 x 980, top-hung fanlight A1 over a
//      left-hand-hung casement A2
//   R  drawing 22 — as Q but A1 is a FIXED casement sash
//   S  drawing 23 — 1199 x 1499, the same layout on a taller frame
//
// A transom is stored exactly as a mullion is, turned through 90°: a
// `transomPart` child of the frame whose `offset` is the height of the
// opening ABOVE it. Integrate's own values: thickness 27 (solid, 67 overall
// with its two 20 stops), offset 356, and on the 980-high frame the internal
// height 886 = 356 + 27 + 503.
//
// Openings are in matrix order A1 then A2 — the top row first, as Integrate
// tags them, which is the order frameOpenings returns.

/** The solid casement transom: offset = the opening ABOVE it. */
function transom(offset) {
  return {
    key: 'trans1',
    part_type: 'transomPart',
    values: { offset, thicknessInFrame: 27, transomStopSize: 20 },
    children: [],
  }
}

// The stored ironmongery list on all three (copied from drawing 1/10 by
// Integrate, and priced as stored). It reconciles to Integrate's 27.30 over
// eight printed lines, each part rounded to whole pounds then x 1.05:
//   Connoisseur Handle LH PB 1        7.55 -> 8    -> 8.40
//   Defender 310mm PC 1 (top hung)    5.10 -> 5    -> 5.25
//   Kenrick gearbox set PC 1          four parts   -> 4.20 + 2.10 + 1.05 + 1.05
//   Kenrick Extension 490mm PC 2      2 x 1.10 -> 2 -> 2.10
//   Trickle Vent XR16 Wht 1           3.25 -> 3    -> 3.15
// = 27.30 exactly, in 8 lines, as the facts file records.
const FANLIGHT_IRONMONGERY_LINES = [
  { product_short_name: 'connoisseur_handle_lh',     finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'defender_310mm',            finish_code: 'PC',  qty: 1, source: 'survey' },
  { product_short_name: 'kenrick_extension_gear_box', finish_code: 'PC', qty: 1, source: 'survey' },
  { product_short_name: 'kenrick_extension_490mm',   finish_code: 'PC',  qty: 2, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',         finish_code: 'Wht', qty: 1, source: 'survey' },
]

/** A fanlight tree: one column, two rows, the fanlight on top. */
function fanlightTree({ width, height, transomOffset, fanlightOperation }) {
  const tree = casementTree({
    width, height,
    withMullion: false,
    openings: [
      casementSash('cas_a1', fanlightOperation),   // the FANLIGHT, above
      casementSash('cas_a2', 'left_hand_hung'),    // the casement below
    ],
  })
  const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
  // The transom goes first, as the mullion does
  frame.children.unshift(transom(transomOffset))
  // These three carry their own ironmongery list, not J-N's
  const paint = tree.children.find(c => c.part_type === 'paintAndIronmongeryPart')
  paint.values.ironmongeryLines = FANLIGHT_IRONMONGERY_LINES.map(l => ({ ...l }))
  return tree
}

const FANLIGHT_COMMON = {
  partCostMap: PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  ironmongeryLines: FANLIGHT_IRONMONGERY_LINES,
  glassCatalogue: {},
}

const FANLIGHT_ASSUMPTIONS = [
  'Frame, transom, openings, cill, glass and ironmongery: Integrate’s saved drawings (docs/integrate-L31115-fanlights.txt, read 12 Oct 2026)',
  'A transom is a transomPart child of the frame with offset = the opening ABOVE it, as GlazePro stores mullions (Integrate keeps both in the frame’s dividers array)',
  'Transom thickness 27 and stops 20/20 are Integrate’s stored values. The casement profile has NO transom thickness key — the solid MULLION value is 27, which matches, and is what the board uses (reported in docs/step-ar-findings.md)',
  'Casement operation codes not verified: top_hung is Integrate operationId 15, fix is 11. Only "fix" is read by a priced rule',
  'Rule 121 (Casement Transoms & Mullions length) uses internal WIDTH + 25 for a transom, by analogy with the mullion’s internal height + 25 — NOT VERIFIED, there is no transom reading for it (these three are softwood, so rule 121 does not fire on them)',
  'installationMethod internally: ASSUMPTION, as the other fixtures; the engine does not read it',
]

export const BENCHMARK_Q = {
  name: 'Benchmark Q — Top-hung fanlight over a casement (L31115 Item 2 Drawing 21)',
  tree: fanlightTree({ width: 1040, height: 980, transomOffset: 356, fanlightOperation: 'top_hung' }),
  targets: { ...INTEGRATE_TARGETS.benchmarkQ_fanlight_tophung_over_side },
  ...FANLIGHT_COMMON,
  assumptions: FANLIGHT_ASSUMPTIONS,
}

export const BENCHMARK_R = {
  name: 'Benchmark R — FIXED fanlight over a casement (L31115 Item 2 Drawing 22)',
  tree: fanlightTree({ width: 1040, height: 980, transomOffset: 356, fanlightOperation: 'fix' }),
  targets: { ...INTEGRATE_TARGETS.benchmarkR_fixed_fanlight_over_side },
  ...FANLIGHT_COMMON,
  assumptions: [
    ...FANLIGHT_ASSUMPTIONS,
    'R differs from Q only in the fanlight’s operation: a fixed casement sash takes 60 install minutes instead of an opener’s 90, so labour is 10.50 h against 11.00 h and nothing else moves',
  ],
}

export const BENCHMARK_S = {
  name: 'Benchmark S — Fanlight over a casement, 1199 x 1499 (L31115 Item 2 Drawing 23)',
  tree: fanlightTree({ width: 1199, height: 1499, transomOffset: 356, fanlightOperation: 'top_hung' }),
  targets: { ...INTEGRATE_TARGETS.benchmarkS_fanlight_1199x1499 },
  ...FANLIGHT_COMMON,
  assumptions: [
    ...FANLIGHT_ASSUMPTIONS,
    'S’s lower sash (1117 x 1014, a 0.92 m² unit) is over 25 kg, so install rule 95 "Any Sash Overweight" adds 45 minutes — labour 11.75 h',
  ],
}

// ── Step AU — stormproof casements: SA, SB, SC, SD, SE, SF ──────────────────
//
// Integrate's own test drawings, read 13 Oct 2026
// (docs/integrate-L31115-stormproof.txt), created with Nathan's approval as
// L31115 items 5-7:
//   SA  5/1 — single stormproof LH opener, 599 x 1199
//   SB  6/1 — stormproof TOP HUNG fanlight over an LH casement (price only)
//   SC  6/1 — stormproof FIXED fanlight over an LH casement
//   SD  7/1 — stormproof LH + RH on a mullion (price only)
//   SE  7/1 — stormproof LH + a FIXED casement sash (price only)
//   SF  7/1 — stormproof LH casement + a direct glazed unit
//
// THE HEADLINE FINDING: Integrate has no stormproof pricing, labour,
// production or allocator rule. Every figure comes out of the ordinary
// casement formulas once the TREE carries the stormproof sections, which is
// what these fixtures are for.
//
// The 7 mm stormProofOverlap is stored because Integrate stores it and the
// board draws it, but NOTHING prices it: a sash is still its opening minus
// its clearances.

const STORMPROOF_FRAME = {
  leftWidth:  41,
  rightWidth: 41,
  topHeight:  41,
  bottomHeight: 56,
  frameDepth: 69,
  jambType: 'solid_profiled',
  frameHeadStopSize:  15,
  frameStileStopSize: 15,
  cillStopSize:       15,
  rakeFrame: false,
  archHead:  false,
}
const STORMPROOF_CILL = { height: 56, depth: 69 }

/**
 * A stormproof casement sash. `bottomRail` is a parameter because Integrate
 * is inconsistent: 83 on its stormproof TEMPLATE (SA) and 76 when it
 * converts a flush window (SB-SF). Both are recorded as read. GlazePro's own
 * decision is 76 everywhere (Nathan, 13 Oct) — see the Step AU report.
 */
function stormproofSash(key, operation, bottomRail) {
  return {
    key,
    part_type: 'casementSashPart',
    values: {
      operation,
      casementTypeId: 'stormproof',      // Integrate typeId 9
      thickness: 54,
      topHeight:     62,
      leftWidth:     62,
      rightWidth:    62,
      bottomHeight:  bottomRail,
      mechanicalClearanceLeft:   4,
      mechanicalClearanceRight:  4,
      mechanicalClearanceTop:    4,
      mechanicalClearanceBottom: 4,
      // DRAWN ONLY: the sash laps 7 mm over the frame each side. No volume,
      // glass size or weight reads it.
      stormProofOverlap: 7,
      toBeReplaced:  true,
    },
    children: [
      {
        key: `${key}_glass`,
        part_type: 'glassPart',
        values: { ...GLASS_CODES, glazingRebateWidth: 16, glazingTolerance: 2 },
        children: [],
      },
    ],
  }
}

/** SA's stored list (facts file, "5/1 SA extras"). */
const SA_IRONMONGERY = [
  { product_short_name: 'connoisseur_handle_lh',                     finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'defender_friction_hinge_-_side_hung_310mm', finish_code: 'PC',  qty: 1, source: 'survey' },
  { product_short_name: 'kenrick_extension_690mm',                   finish_code: 'PC',  qty: 2, source: 'survey' },
  { product_short_name: 'kenrick_extension_gear_box',                finish_code: 'PC',  qty: 1, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',                         finish_code: 'Wht', qty: 1, source: 'survey' },
]

/**
 * SC's stored list — left over from the FLUSH fanlight template and NOT
 * recomputed when A1 became fixed. Integrate never recomputes a stored list,
 * so this is Q/R's list, copied as recorded.
 */
const SC_IRONMONGERY = [
  { product_short_name: 'connoisseur_handle_lh',      finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'defender_310mm',             finish_code: 'PC',  qty: 1, source: 'survey' },
  { product_short_name: 'kenrick_extension_490mm',    finish_code: 'PC',  qty: 2, source: 'survey' },
  { product_short_name: 'kenrick_extension_gear_box', finish_code: 'PC',  qty: 1, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',          finish_code: 'Wht', qty: 1, source: 'survey' },
]

// SF's stored list is J-N's exactly — left over from SD, so SF still prices
// TWO handles and TWO hinges for a window with one opener. That is
// Integrate's own behaviour and the reason its ironmongery reads 66.15.
const SF_IRONMONGERY = IRONMONGERY_LINES

/** A stormproof tree. `dividers` are transoms/mullions, `openings` the cells. */
function stormproofTree({ width, height, openings, dividers = [], ironmongeryLines }) {
  return {
    key: 'item1',
    part_type: 'drawingItemPart',
    values: {
      typeOfWork:      'complete_new',
      frameMaterialId: 'softwood',     // Solid Redwood
      sashMaterialId:  'softwood',
      cillMaterialId:  'utile',
      floorLevel:      'first_floor',
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
          ironmongeryLines:  ironmongeryLines.map(l => ({ ...l })),
        },
        children: [],
      },
      {
        key: 'notes1',
        part_type: 'notesPart',
        values: { installationMethod: 'internally' },
        children: [],
      },
      {
        key: 'frame1',
        part_type: 'assemblyFramePart',
        values: { width, height, ...STORMPROOF_FRAME },
        children: [
          ...dividers,
          ...openings,
          {
            key: 'cill1',
            part_type: 'cillPart',
            // Integrate stores one cill per bottom opening (two 545s on SF);
            // its cill VOLUME is the full frame width, so one GlazePro cill
            // is the faithful model, as J-N.
            values: { ...STORMPROOF_CILL },
            children: [],
          },
        ],
      },
    ],
  }
}

const STORMPROOF_ASSUMPTIONS = [
  'Frame, cill, sashes, dividers, glass and the STORED ironmongery lists: Integrate’s own drawings (docs/integrate-L31115-stormproof.txt, read 13 Oct 2026)',
  'The 7 mm stormProofOverlap is stored because Integrate stores it and the board draws it; NO volume, glass size or weight reads it — a sash is its opening minus its clearances',
  'Integrate has NO stormproof pricing, labour, production or allocator rule: every figure here comes out of the ordinary casement formulas fed the stormproof sections',
  'SA keeps Integrate’s TEMPLATE bottom rail of 83; SB-SF carry the 76 Integrate writes when it converts a flush window. GlazePro’s own rule is 76 everywhere (Nathan, 13 Oct), so a GlazePro-built single differs from SA in sash timber and glass only',
  'One cillPart per frame (Integrate stores one per bottom opening and prices the full frame width — step-ao §3)',
  'installationMethod internally: ASSUMPTION, as the other fixtures; the engine does not read it',
  'Casement operation and sash-type codes not verified: typeId 9 is the live sash_type option ‘stormproof’ per the brief; only ‘fix’ is read by a priced rule',
]

const STORMPROOF_COMMON = {
  partCostMap: PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  glassCatalogue: {},
}

// ── SA: single stormproof LH opener, 599 x 1199 ─────────────────────────────
export const BENCHMARK_SA = {
  name: 'Benchmark SA — Stormproof single LH opener 599 x 1199 (L31115 Item 5 Drawing 1)',
  tree: stormproofTree({
    width: 599, height: 1199,
    // Integrate's template rail, 83
    openings: [stormproofSash('cas_a1', 'left_hand_hung', 83)],
    ironmongeryLines: SA_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkSA_stormproof_single_599x1199 },
  ...STORMPROOF_COMMON,
  ironmongeryLines: SA_IRONMONGERY,
  assumptions: STORMPROOF_ASSUMPTIONS,
}

// ── SC: stormproof FIXED fanlight over an LH casement, 1040 x 980 ──────────
const SC_TRANSOM = {
  key: 'trans1',
  part_type: 'transomPart',
  // The transom is UNCHANGED by stormproof: 27 solid with 20 / 20 stops.
  // offset = the opening ABOVE it; internal 883 = 349 + 27 + 507.
  values: { offset: 349, thicknessInFrame: 27, transomStopSize: 20 },
  children: [],
}

export const BENCHMARK_SC = {
  name: 'Benchmark SC — Stormproof fixed fanlight over a casement (L31115 Item 6 Drawing 1)',
  tree: stormproofTree({
    width: 1040, height: 980,
    dividers: [SC_TRANSOM],
    openings: [
      stormproofSash('cas_a1', 'fix', 76),              // the fanlight
      stormproofSash('cas_a2', 'left_hand_hung', 76),
    ],
    ironmongeryLines: SC_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkSC_stormproof_fixed_fanlight_over_side },
  ...STORMPROOF_COMMON,
  ironmongeryLines: SC_IRONMONGERY,
  assumptions: STORMPROOF_ASSUMPTIONS,
}

// ── SB: SC with A1 TOP HUNG. Integrate gives the price only ─────────────────
export const BENCHMARK_SB = {
  name: 'Benchmark SB — Stormproof top-hung fanlight over a casement (L31115 Item 6 Drawing 1)',
  tree: stormproofTree({
    width: 1040, height: 980,
    dividers: [SC_TRANSOM],
    openings: [
      stormproofSash('cas_a1', 'top_hung', 76),
      stormproofSash('cas_a2', 'left_hand_hung', 76),
    ],
    ironmongeryLines: SC_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkSB_stormproof_tophung_fanlight_over_side },
  ...STORMPROOF_COMMON,
  ironmongeryLines: SC_IRONMONGERY,
  assumptions: [
    ...STORMPROOF_ASSUMPTIONS,
    'PRICE ONLY: Integrate gave the drawing-card PF30 price, not the cost breakdown. SB - SC = 40.21 = 30 install minutes x 2, an opener against a fixed sash',
  ],
}

// ── SF: stormproof LH casement + direct glazed unit, 1199 x 1299 ───────────
const SF_MULLION = {
  key: 'mull1',
  part_type: 'mullionPart',
  // Unchanged by stormproof. Internal width 1117 = 545 + 27 + 545.
  values: { offset: 545, thicknessInFrame: 27, mullionStopSize: 20 },
  children: [],
}

/** SF's direct glazed unit — UNCHANGED by stormproof (clearance 20, rebate 20, hidden 18). */
function stormproofDirectGlazed(key) {
  return {
    key,
    part_type: 'glassPart',
    values: {
      ...GLASS_CODES,
      toBeReplaced: true,
      mechanicalClearanceLeft:   20,
      mechanicalClearanceRight:  20,
      mechanicalClearanceTop:    20,
      mechanicalClearanceBottom: 20,
      hiddenInRebateLeft:   18,
      hiddenInRebateRight:  18,
      hiddenInRebateTop:    18,
      hiddenInRebateBottom: 18,
      glazingRebateWidth: 20,
      glazingTolerance:   2,
    },
    children: [],
  }
}

export const BENCHMARK_SF = {
  name: 'Benchmark SF — Stormproof casement + direct glazed unit (L31115 Item 7 Drawing 1)',
  tree: stormproofTree({
    width: 1199, height: 1299,
    dividers: [SF_MULLION],
    openings: [
      stormproofSash('cas_a1', 'left_hand_hung', 76),
      stormproofDirectGlazed('dg_b1'),
    ],
    ironmongeryLines: SF_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkSF_stormproof_casement_plus_direct_glazed },
  ...STORMPROOF_COMMON,
  ironmongeryLines: SF_IRONMONGERY,
  assumptions: [
    ...STORMPROOF_ASSUMPTIONS,
    'The stored ironmongery is J-N’s list exactly, left over from SD: Integrate does not recompute it, so SF prices TWO handles and TWO hinges for a window with ONE opener. Copied as recorded — it is why its ironmongery reads 66.15',
  ],
}

// ── SD and SE: SF's frame with two sashes. Price only ──────────────────────
export const BENCHMARK_SD = {
  name: 'Benchmark SD — Stormproof LH + RH on a mullion (L31115 Item 7 Drawing 1)',
  tree: stormproofTree({
    width: 1199, height: 1299,
    dividers: [SF_MULLION],
    openings: [
      stormproofSash('cas_a1', 'left_hand_hung', 76),
      stormproofSash('cas_b1', 'right_hand_hung', 76),
    ],
    ironmongeryLines: SF_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkSD_stormproof_double },
  ...STORMPROOF_COMMON,
  ironmongeryLines: SF_IRONMONGERY,
  assumptions: [
    ...STORMPROOF_ASSUMPTIONS,
    'PRICE ONLY: Integrate gave the drawing-card PF30 price, not the cost breakdown',
  ],
}

export const BENCHMARK_SE = {
  name: 'Benchmark SE — Stormproof LH + fixed casement sash (L31115 Item 7 Drawing 1)',
  tree: stormproofTree({
    width: 1199, height: 1299,
    dividers: [SF_MULLION],
    openings: [
      stormproofSash('cas_a1', 'left_hand_hung', 76),
      stormproofSash('cas_b1', 'fix', 76),
    ],
    ironmongeryLines: SF_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkSE_stormproof_opener_plus_fixed },
  ...STORMPROOF_COMMON,
  ironmongeryLines: SF_IRONMONGERY,
  assumptions: [
    ...STORMPROOF_ASSUMPTIONS,
    'PRICE ONLY: Integrate gave the drawing-card PF30 price. SD - SE = 40.21 = 30 install minutes x 2, an opener against a fixed sash',
  ],
}

// ── Step AV — two-column fanlight casements: TC1, TC2, TC3 ──────────────────
//
// Integrate's own combination templates, drawn as L31115 item 8 and read on
// 13 Oct (docs/integrate-L31115-two-column-fanlights.txt):
//   TC1  8/1 — template 7  "Double Casement With Fanlight": ONE wide
//              top-hung fanlight over an LH + RH pair
//   TC2  8/2 — template 12 "Configuration 1": a fanlight over EACH casement
//   TC3  8/3 — template 13 "Configuration 2": a full-height LH opener beside
//              a top-hung fanlight over a FIXED sash
//
// WHAT IS NEW HERE is only the frame's divider geometry: a mullion or transom
// can STOP AT ANOTHER DIVIDER, so an opening spans two columns (TC1) or two
// rows (TC3). Everything else — labour, production, sash timber, glass, cill,
// surrounds — comes out of the existing casement rules, which TC2 proved
// before any change was made (docs/reports/step-av-tc2-proof.md).
//
// Each tree also carries a STORED SURROUND LIST, as Integrate's templates do:
// the Ogee architrave it would have allocated anyway, plus a "Nosing in Solid
// Redwood" (TP61) that no GlazePro rule allocates, and which is what fires
// install rule 251 "Windowboard".

/** A divider that runs frame to frame, as every pre-Step-AV one does. */
function fullDivider(key, partType, offset, stopKey) {
  return {
    key,
    part_type: partType,
    values: {
      offset, thicknessInFrame: 27, [stopKey]: 20,
      // '0' is Integrate's "runs to the frame"; stored explicitly so a tree
      // says what it means rather than relying on the field being absent.
      startDivider: '0', endDivider: '0',
    },
    children: [],
  }
}

/**
 * A divider that STOPS AT ANOTHER DIVIDER. `startDivider` / `endDivider`
 * hold the other divider's KEY — a stable reference, not an array index,
 * which would point at a different divider as soon as one was added.
 */
function shortDivider(key, partType, offset, stopKey, { startDivider = '0', endDivider = '0' } = {}) {
  return {
    key,
    part_type: partType,
    values: { offset, thicknessInFrame: 27, [stopKey]: 20, startDivider, endDivider },
    children: [],
  }
}

/** The Ogee architrave GlazePro would allocate, plus Integrate's nosing. */
function surroundLines({ width, height, nosing }) {
  // Integrate stores each surround's length to the next 10 mm: the nosing at
  // frame width + 150 (TC1 1105 + 150 = 1255 -> 1260) and the architrave at
  // frame size + 100 (1405 + 100 = 1505 -> 1510, 1105 + 100 = 1205 -> 1210).
  // The three recorded lists come out exactly
  // (docs/integrate-L31115-two-column-fanlights.txt): 1260 / 2 x 1510 /
  // 1210, 1450 / 2 x 1600 / 1400, 1360 / 2 x 1400 / 1310.
  const to10 = mm => Math.ceil(mm / 10) * 10
  return [
    // Nosing in Solid Redwood — the deep window board: it is what makes
    // has_deep_window_board true.
    { part_code: 'TP61', qty: 1, length_mm: nosing, label: 'Nosing in Solid Redwood' },
    // Ogee Architrave in MDF — the same lengths rule 4000 / 4001 give
    { part_code: 'TP68', qty: 2, length_mm: to10(height + 100), label: 'Ogee Architrave – height' },
    { part_code: 'TP68', qty: 1, length_mm: to10(width + 100),  label: 'Ogee Architrave – width' },
  ]
}

/** TC's part costs: the architrave, and the nosing at 2.76/m. */
const TC_PART_COST_MAP = {
  TP68: 2.85,   // Ogee Architrave 20x70 MDF
  TP61: 2.76,   // Nosing 25x50 Redwood — the same part L34046's rule 4010 names
}

function tcTree({ width, height, dividers, openings, ironmongeryLines, nosing }) {
  return {
    key: 'item1',
    part_type: 'drawingItemPart',
    values: {
      typeOfWork:      'complete_new',
      frameMaterialId: 'softwood',       // Solid Redwood
      sashMaterialId:  'softwood',
      cillMaterialId:  'utile',
      floorLevel:      'first_floor',
      surroundLines:   surroundLines({ width, height, nosing }),
    },
    children: [
      {
        key: 'paint1',
        part_type: 'paintAndIronmongeryPart',
        values: {
          internalFinish: 'clean_white', externalFinish: 'clean_white',
          cillFinish: 'clean_white', cutOutBrickReveal: false,
          ironmongeryFinish: 'PB',
          ironmongeryLines: ironmongeryLines.map(l => ({ ...l })),
        },
        children: [],
      },
      {
        key: 'notes1',
        part_type: 'notesPart',
        values: { installationMethod: 'internally' },
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
          rakeFrame: false, archHead: false,
        },
        children: [
          ...dividers,
          ...openings,
          {
            key: 'cill1',
            part_type: 'cillPart',
            // Integrate stores one cill per BOTTOM-ROW opening (TC1 493 +
            // 511); its cill VOLUME is the full frame width, so one GlazePro
            // cill is the faithful model, as J–N.
            values: { height: 47, depth: 128 },
            children: [],
          },
        ],
      },
    ],
  }
}

const TC_ASSUMPTIONS = [
  'Frame, dividers, openings, cill, glass and the STORED ironmongery and surround lists: Integrate’s own drawings (docs/integrate-L31115-two-column-fanlights.txt, read 13 Oct 2026)',
  'A divider that stops at another names it by KEY in startDivider / endDivider (Integrate uses its id, and ‘0’ for the frame) — a stable reference, not an array index',
  'The short-divider frame-timber allowances are ONE READING EACH and no single constant fits both: +2 on TC1’s short mullion (exact — 984 gives 43.18, 986 gives 43.20) and +3 or +4 on TC3’s short transom (both give 40.48). UNVERIFIED; worth under 1p either way',
  'The stored surround list carries the Ogee architrave AND the "Nosing in Solid Redwood" (TP61); TP61 is taken to be the deep window board that fires install rule 251, which is an ASSUMPTION reported in docs/reports/step-av.md',
  'One cillPart per frame (Integrate stores one per bottom-row opening and prices the full frame width — step-ao §3)',
  'installationMethod internally: ASSUMPTION, as the other fixtures; the engine does not read it',
]

// ── TC1: one wide fanlight over a double, 1105 x 1405 ──────────────────────
// internal 1031 x 1311 = 493 + 27 + 511 and 301 + 27 + 983.
// The transom runs jamb to jamb; the MULLION starts at the transom and runs
// down to the cill, so it exists in the bottom row only and the fanlight
// spans both columns: 493 + 27 + 511 = 1031 wide.
const TC1_TRANSOM = fullDivider('trans1', 'transomPart', 301, 'transomStopSize')
const TC1_MULLION = shortDivider('mull1', 'mullionPart', 493, 'mullionStopSize',
  { startDivider: 'trans1' })

const TC1_IRONMONGERY = [
  { product_short_name: 'connoisseur_handle_lh', finish_code: 'PB', qty: 2, source: 'survey' },
  { product_short_name: 'connoisseur_handle_rh', finish_code: 'PB', qty: 1, source: 'survey' },
  { product_short_name: 'defender_209mm', finish_code: 'PC', qty: 1, source: 'survey' },
  { product_short_name: 'defender_friction_hinge_-_side_hung_310mm', finish_code: 'PC', qty: 2, source: 'survey' },
  { product_short_name: 'kenrick_extension_950mm', finish_code: 'PC', qty: 6, source: 'survey' },
  { product_short_name: 'kenrick_extension_gear_box', finish_code: 'PC', qty: 3, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16', finish_code: 'Wht', qty: 1, source: 'survey' },
]

export const BENCHMARK_TC1 = {
  name: 'Benchmark TC1 — Wide fanlight over a double casement (L31115 Item 8 Drawing 1)',
  tree: tcTree({
    width: 1105, height: 1405, nosing: 1260,
    dividers: [TC1_TRANSOM, TC1_MULLION],
    openings: [
      casementSash('cas_a1', 'top_hung'),         // spans both columns
      casementSash('cas_a2', 'left_hand_hung'),
      casementSash('cas_b2', 'right_hand_hung'),
    ],
    ironmongeryLines: TC1_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkTC1_wide_fanlight_over_double },
  partCostMap: TC_PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: TC1_IRONMONGERY,
  assumptions: TC_ASSUMPTIONS,
}

// ── TC2: a fanlight over each casement, 1299 x 1499 ───────────────────────
// Both dividers run frame to frame, so this is the plain 2 x 2 grid that
// needed no new model — the proof run before any change was made.
const TC2_IRONMONGERY = [
  { product_short_name: 'connoisseur_handle_lh', finish_code: 'PB', qty: 1, source: 'survey' },
  { product_short_name: 'connoisseur_handle_rh', finish_code: 'PB', qty: 1, source: 'survey' },
  { product_short_name: 'defender_310mm', finish_code: 'PC', qty: 1, source: 'survey' },
  { product_short_name: 'defender_friction_hinge_-_side_hung_310mm', finish_code: 'PC', qty: 1, source: 'survey' },
  { product_short_name: 'kenrick_extension_490mm', finish_code: 'PC', qty: 2, source: 'survey' },
  { product_short_name: 'kenrick_extension_950mm', finish_code: 'PC', qty: 2, source: 'survey' },
  { product_short_name: 'kenrick_extension_gear_box', finish_code: 'PC', qty: 2, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16', finish_code: 'Wht', qty: 1, source: 'survey' },
]

export const BENCHMARK_TC2 = {
  name: 'Benchmark TC2 — A fanlight over each of two casements (L31115 Item 8 Drawing 2)',
  tree: tcTree({
    width: 1299, height: 1499, nosing: 1450,
    dividers: [
      fullDivider('mull1', 'mullionPart', 590, 'mullionStopSize'),
      fullDivider('trans1', 'transomPart', 356, 'transomStopSize'),
    ],
    openings: [
      casementSash('cas_a1', 'top_hung'), casementSash('cas_b1', 'fix'),
      casementSash('cas_a2', 'fix'),      casementSash('cas_b2', 'right_hand_hung'),
    ],
    ironmongeryLines: TC2_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkTC2_fanlight_over_each },
  partCostMap: TC_PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: TC2_IRONMONGERY,
  assumptions: TC_ASSUMPTIONS,
}

// ── TC3: a full-height opener beside a fanlight over a fixed sash ─────────
// internal 1131 x 1201 = 543 + 27 + 561 and 354 + 27 + 820.
// The mullion runs head to cill; the TRANSOM starts at the mullion and runs
// to the right jamb, so it exists in column B only and the left opener spans
// both rows: 1201 tall.
const TC3_MULLION = fullDivider('mull1', 'mullionPart', 543, 'mullionStopSize')
const TC3_TRANSOM = shortDivider('trans1', 'transomPart', 354, 'transomStopSize',
  { startDivider: 'mull1' })

const TC3_IRONMONGERY = [
  { product_short_name: 'connoisseur_handle_lh', finish_code: 'PB', qty: 2, source: 'survey' },
  { product_short_name: 'defender_310mm', finish_code: 'PC', qty: 1, source: 'survey' },
  { product_short_name: 'defender_friction_hinge_-_side_hung_310mm', finish_code: 'PC', qty: 1, source: 'survey' },
  { product_short_name: 'kenrick_extension_490mm', finish_code: 'PC', qty: 2, source: 'survey' },
  { product_short_name: 'kenrick_extension_950mm', finish_code: 'PC', qty: 2, source: 'survey' },
  { product_short_name: 'kenrick_extension_gear_box', finish_code: 'PC', qty: 2, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16', finish_code: 'Wht', qty: 1, source: 'survey' },
]

export const BENCHMARK_TC3 = {
  name: 'Benchmark TC3 — Full-height opener beside a fanlight over a fixed sash (L31115 Item 8 Drawing 3)',
  tree: tcTree({
    width: 1205, height: 1295, nosing: 1360,
    dividers: [TC3_MULLION, TC3_TRANSOM],
    openings: [
      casementSash('cas_a1', 'left_hand_hung'),   // spans both rows
      casementSash('cas_b1', 'top_hung'),
      casementSash('cas_b2', 'fix'),
    ],
    ironmongeryLines: TC3_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkTC3_fanlight_over_one_side },
  partCostMap: TC_PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: TC3_IRONMONGERY,
  assumptions: TC_ASSUMPTIONS,
}
