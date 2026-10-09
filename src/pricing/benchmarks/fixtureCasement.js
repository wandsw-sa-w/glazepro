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
 * 'open_out_flush' (Integrate typeId 7 "Open Out / Flush with Stops
 * Internally"). Only `fix` is read by a priced rule
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
      casementTypeId: 'open_out_flush',  // Integrate typeId 7
      sashThickness: 54,
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
