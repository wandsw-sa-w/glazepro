/**
 * fixtureBiGlass.js
 * Benchmarks BG1–BG4 — BI-GLASS on casement windows (Step BJ).
 *
 * Bi-glass keeps the customer's casement frame AND sashes. The existing
 * single glass comes out, a new single pane goes in, the window is draught
 * sealed and any glazing bars are taken off. Integrate calls it "BiGlass";
 * GlazePro has had `typeOfWork 'bi_glass'` and the imported bi-glass rules
 * since the PF30 import, but no benchmark had ever exercised them on any
 * product.
 *
 * Integrate's own drawings, read 15 Oct 2026
 * (docs/integrate-L31115-casement-biglass.txt) as L31115 item 10 drawings
 * 33–36 — each a COPY of a drawing already matched penny for penny, with the
 * item's "Bi-Glass" box ticked, every glass set to Single, and then SAVED
 * (Integrate only finalises bi-glass on save):
 *
 *   BG1  10/33 — a copy of P  (1599 x 1599, one LH opener)
 *   BG2  10/34 — BG1 with 2 x 3 glazing bars (gb_qty 3)
 *   BG3  10/35 — a copy of C4 (1299 x 1307, opener | fixed | opener)
 *   BG4  10/36 — a copy of S  (1199 x 1499, top-hung fanlight over an opener)
 *
 * WHAT TICKING BI-GLASS DOES, and so what these trees hold:
 *
 *  - the item is `bi_glass`: the frame is NOT replaced and the sashes are NOT
 *    replaced, so no frame, sash, cill, finishing or consumable rule fires;
 *  - DRAUGHT SEALING is on. Integrate sets its own `draughtseal` flag when
 *    the box is ticked, and Nathan (15 Oct) confirms it is always part of the
 *    job. GlazePro's `typeOfWork` is single-valued — it cannot hold both
 *    bi_glass and draught_seal — so `needs_draughtsealing` is derived from
 *    bi-glass for a CASEMENT. That is what fires "DSO SqM Rate" on all four;
 *  - every sash EQUALS ITS OPENING. Integrate shows an "Include Clearance"
 *    box when bi-glass is ticked and it defaults OFF, so the 4 mm mechanical
 *    clearance goes to 0 and the sash grows into the opening, the glass with
 *    it: P's sash 1517 x 1497 becomes BG1's 1525 x 1505;
 *  - every glass unit is SINGLE 4 mm Clear Toughened (GL100080, £25.50/m²)
 *    and carries `toBeReplaced: true` ON THE GLASS PART, which is where
 *    Integrate stores it. The glass is the only thing being replaced, and it
 *    is what "BiGlass Labour Base Price" (240 minutes a unit) counts;
 *  - the STORED SURROUND LIST is cleared by the tick (the C4 copy lost its
 *    nosing and architraves), so no component line and no Windowboard;
 *  - `isCasementMpls` goes false;
 *  - the STORED IRONMONGERY LIST is untouched and priced as stored. Nathan:
 *    no NEW ironmongery by default, because the sashes are kept — the
 *    surveyor adds whatever is actually replaced. These four keep the list
 *    their source drawings carried so they compare like for like.
 *
 * Glass sizes are the ordinary casement model: sightline = sash − 62 − 62
 * wide and sash − 62 − 83 high, cut = sightline + 2 x (rebate 16 − tolerance
 * 2). Nothing about that changes; only the sash grew.
 */

import INTEGRATE_TARGETS from './integrate-targets.json'

// ── The single pane ─────────────────────────────────────────────────────────
// 4mm Clear Toughened. The snapshot catalogue already holds GL100080 at
// 25.50/m², which is the £25.50 the facts record, so nothing in the data
// changes for this step.
const BG_GLASS = {
  glazingId:           'single_glazing',   // Integrate glazingId 1
  isIndividualPanes:   false,
  singleGlassPartNo:   'GL100080',         // 4mm Clear Toughened
  // The double-glazing codes stay on the part, as Integrate's do: the
  // surveyor only changed the GLAZING, and switching back must find them.
  internalGlassPartNo: 'GL100010',
  externalGlassPartNo: 'GL100080',
  glazingRebateWidth:  16,
  glazingTolerance:    2,
  // Integrate stores the replace flag on the GlassPart, not the sash — the
  // glass is the only thing coming out.
  toBeReplaced:        true,
}

const PROFILE_VALUES = {
  defaultDoubleGlazingRebateWidthForSash: 14,
  defaultDoubleGlazingTolerance: 2,
}

/** The architrave rate, as the casement fixtures carry it. */
const BG_PART_COST_MAP = {
  TP68: 2.85,
  TP61: 2.76,
}

/**
 * A KEPT casement sash with its new single pane.
 *
 * `toBeReplaced` false and every mechanical clearance 0 — the two things the
 * Bi-Glass tick does to a sash.
 */
function keptSash(key, operation, { barsWide = 0, barsHigh = 0 } = {}) {
  const bars = []
  for (let i = 0; i < barsWide; i++) {
    bars.push({ key: `${key}_vb${i}`, part_type: 'verticalGlazingBarPart', values: {}, children: [] })
  }
  for (let i = 0; i < barsHigh; i++) {
    bars.push({ key: `${key}_hb${i}`, part_type: 'horizontalGlazingBarPart', values: {}, children: [] })
  }
  return {
    key,
    part_type: 'casementSashPart',
    values: {
      operation,
      casementTypeId: 'open_out',
      thickness: 54,
      topHeight:     62,
      leftWidth:     62,
      rightWidth:    62,
      bottomHeight:  83,
      // Integrate's "Include Clearance" is OFF, so the sash IS the opening
      mechanicalClearanceLeft:   0,
      mechanicalClearanceRight:  0,
      mechanicalClearanceTop:    0,
      mechanicalClearanceBottom: 0,
      // the sash is KEPT
      toBeReplaced: false,
    },
    children: [
      {
        key: `${key}_glass`,
        part_type: 'glassPart',
        values: { ...BG_GLASS },
        children: bars,
      },
    ],
  }
}

function divider(key, partType, offset, stopKey) {
  return {
    key,
    part_type: partType,
    values: {
      offset, thicknessInFrame: 27, [stopKey]: 20,
      startDivider: '0', endDivider: '0',
    },
    children: [],
  }
}

/**
 * A bi-glass casement item. No surround list (the tick clears it) and
 * `isCasementMpls` false, both as Integrate's saved trees hold them.
 */
function biGlassTree({ width, height, dividers = [], openings, ironmongeryLines }) {
  return {
    key: 'item1',
    part_type: 'drawingItemPart',
    values: {
      typeOfWork:      'bi_glass',
      frameMaterialId: 'softwood',       // Solid Redwood
      sashMaterialId:  'softwood',
      cillMaterialId:  'utile',
      floorLevel:      'first_floor',
    },
    children: [
      {
        key: 'paint1',
        part_type: 'paintAndIronmongeryPart',
        values: {
          internalFinish: 'clean_white', externalFinish: 'clean_white',
          cillFinish: 'clean_white', cutOutBrickReveal: false,
          ironmongeryFinish: 'PB',
          isCasementMpls: false,
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
          // the frame is KEPT
          toBeReplaced: false,
        },
        children: [
          ...dividers,
          ...openings,
          {
            key: 'cill1',
            part_type: 'cillPart',
            values: { height: 47, depth: 128, toBeReplaced: false },
            children: [],
          },
        ],
      },
    ],
  }
}

const BG_ASSUMPTIONS = [
  'Frame, openings, dividers, cill, glass and the STORED ironmongery list: Integrate’s own saved drawings (docs/integrate-L31115-casement-biglass.txt, read 15 Oct 2026)',
  'Every sash EQUALS its opening because Integrate’s "Include Clearance" defaults OFF on a bi-glass item; the clearances are stored as 0 rather than removed, so switching back restores 4',
  'The glass part carries toBeReplaced TRUE and the sash carries FALSE, which is where Integrate stores each — the glass is the only thing replaced',
  'needs_draughtsealing is DERIVED from bi-glass on a casement: GlazePro’s typeOfWork is single-valued and cannot hold both, where Integrate has a separate draughtseal flag it ticks automatically (Nathan, 15 Oct: draught sealing is always part of the job)',
  'The double-glazing part codes stay stored alongside the single code, as Integrate’s do — only the glazingId changed',
  'No stored surround list: the Bi-Glass tick CLEARED it on Integrate’s C4 copy, so no component line and no Windowboard',
  'Casement operation and type CODES not verified, as every casement fixture — only "fix" is read by a priced rule',
  'installationMethod internally: ASSUMPTION, as the other fixtures; the engine does not read it',
]

// ── BG1: a copy of P — one LH opener, 1599 x 1599 ───────────────────────────
// Interior 1525 x 1505, and with no clearance the sash IS that: 1525 x 1505.
// Glass sightline 1401 x 1360, cut 1429 x 1388 = 1.98 m².
// The sash is over 25 kg even on single glass, so rule 95 fires.
const BG1_IRONMONGERY = [
  { product_short_name: 'connoisseur_handle_lh',                     finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'connoisseur_handle_rh',                     finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'defender_friction_hinge_-_side_hung_412mm', finish_code: 'PC',  qty: 2, source: 'survey' },
  { product_short_name: 'kenrick_extension_690mm',                   finish_code: 'PC',  qty: 4, source: 'survey' },
  { product_short_name: 'kenrick_extension_gear_box',                finish_code: 'PC',  qty: 2, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',                         finish_code: 'Wht', qty: 1, source: 'survey' },
]

export const BENCHMARK_BG1 = {
  name: 'Benchmark BG1 — Bi-glass single casement (L31115 Item 10 Drawing 33)',
  tree: biGlassTree({
    width: 1599, height: 1599,
    openings: [keptSash('cas_a1', 'left_hand_hung')],
    ironmongeryLines: BG1_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkBG1_biglass_single_casement },
  partCostMap: BG_PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: BG1_IRONMONGERY,
  assumptions: BG_ASSUMPTIONS,
}

// ── BG2: BG1 with glazing bars, "2 x 3" = 1 vertical + 2 horizontal ─────────
// gb_qty 3, so "BiGlass GBs to Take Off" adds 3 x 60 = 180 minutes. The bars
// add NO glass line: rules 21 and 22 need glass_unit_thickness >= 24 and a
// single 4 mm pane is nowhere near.
export const BENCHMARK_BG2 = {
  name: 'Benchmark BG2 — Bi-glass casement with glazing bars (L31115 Item 10 Drawing 34)',
  tree: biGlassTree({
    width: 1599, height: 1599,
    openings: [keptSash('cas_a1', 'left_hand_hung', { barsWide: 1, barsHigh: 2 })],
    ironmongeryLines: BG1_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkBG2_biglass_casement_glazing_bars },
  partCostMap: BG_PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: BG1_IRONMONGERY,
  assumptions: [
    ...BG_ASSUMPTIONS,
    'A "2 x 3" pane layout is 1 vertical and 2 horizontal bars, so gb_qty is 3 — Integrate’s own count on this drawing',
  ],
}

// ── BG3: a copy of C4 — opener | fixed | opener, 1299 x 1307 ────────────────
// Interior 1225 x 1213, columns 393 | 385 | 393, and with no clearance each
// sash IS its column: 393 / 385 / 393 x 1213. Glass cut 297 / 289 / 297 x
// 1096 = 0.33 / 0.32 / 0.33 m².
//
// This is the one that needs rule 15: the FIXED sash takes 60 fitting
// minutes even though the frame is kept, which is what Integrate charges.
// It is also the only one with production — rule 211, 60 minutes a mullion.
const BG3_IRONMONGERY = [
  { product_short_name: 'connoisseur_handle_lh',                     finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'connoisseur_handle_rh',                     finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'defender_friction_hinge_-_side_hung_310mm', finish_code: 'PC',  qty: 2, source: 'survey' },
  { product_short_name: 'kenrick_extension_950mm',                   finish_code: 'PC',  qty: 4, source: 'survey' },
  { product_short_name: 'kenrick_extension_gear_box',                finish_code: 'PC',  qty: 2, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',                         finish_code: 'Wht', qty: 1, source: 'survey' },
]

export const BENCHMARK_BG3 = {
  name: 'Benchmark BG3 — Bi-glass opener, fixed, opener (L31115 Item 10 Drawing 35)',
  tree: biGlassTree({
    width: 1299, height: 1307,
    dividers: [
      divider('mull1', 'mullionPart', 393, 'mullionStopSize'),
      divider('mull2', 'mullionPart', 805, 'mullionStopSize'),
    ],
    openings: [
      keptSash('cas_a1', 'left_hand_hung'),
      keptSash('cas_b1', 'fix'),
      keptSash('cas_c1', 'right_hand_hung'),
    ],
    ironmongeryLines: BG3_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkBG3_biglass_opener_fixed_opener },
  partCostMap: BG_PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: BG3_IRONMONGERY,
  assumptions: [
    ...BG_ASSUMPTIONS,
    'Rule 15 "Fixed Casement Sash with Frame" fires on a bi-glass casement, where the frame is KEPT: Integrate’s own condition reads is_casement_window OR (… and frame_to_be_replaced) and it fired on this drawing. Nathan (15 Oct): copy Integrate, but bracket it so it reaches bi-glass only — sql/step-bj1',
  ],
}

// ── BG4: a copy of S — top-hung fanlight over an opener, 1199 x 1499 ────────
// Interior 1125 x 1405, rows 356 and 1022, so the sashes are 1125 x 356 and
// 1125 x 1022. Glass cut 1029 x 239 = 0.25 -> the 0.30 m² minimum, and
// 1029 x 905 = 0.93.
//
// NEITHER sash is over 25 kg, where S's lower sash IS: the single 4 mm pane
// is half the weight of S's double unit. That is the reading that fixes the
// weight model (item 1e).
const BG4_IRONMONGERY = [
  { product_short_name: 'connoisseur_handle_lh',      finish_code: 'PB',  qty: 1, source: 'survey' },
  { product_short_name: 'defender_310mm',             finish_code: 'PC',  qty: 1, source: 'survey' },
  { product_short_name: 'kenrick_extension_gear_box', finish_code: 'PC',  qty: 1, source: 'survey' },
  { product_short_name: 'kenrick_extension_490mm',    finish_code: 'PC',  qty: 2, source: 'survey' },
  { product_short_name: 'trickle_vent_xr16',          finish_code: 'Wht', qty: 1, source: 'survey' },
]

export const BENCHMARK_BG4 = {
  name: 'Benchmark BG4 — Bi-glass casement with a fanlight (L31115 Item 10 Drawing 36)',
  tree: biGlassTree({
    width: 1199, height: 1499,
    dividers: [divider('trans1', 'transomPart', 356, 'transomStopSize')],
    openings: [
      keptSash('cas_a1', 'top_hung'),        // the fanlight
      keptSash('cas_a2', 'left_hand_hung'),
    ],
    ironmongeryLines: BG4_IRONMONGERY,
  }),
  targets: { ...INTEGRATE_TARGETS.benchmarkBG4_biglass_casement_with_fanlight },
  partCostMap: BG_PART_COST_MAP,
  profileValues: PROFILE_VALUES,
  glassCatalogue: {},
  ironmongeryLines: BG4_IRONMONGERY,
  assumptions: [
    ...BG_ASSUMPTIONS,
    'Neither sash reaches 25 kg, where S’s lower sash does: a single 4 mm pane weighs half what S’s double unit does. The weight model must read the SINGLE pane on single glazing, which is Step BJ item 1e',
  ],
}
