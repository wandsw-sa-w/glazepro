/**
 * pricingEngine.js
 * Three-pass (manufacture_labour → install_labour → price) pricing engine.
 *
 * ── DB schema (confirmed against migrations) ────────────────────────────────
 *
 * price_files          id, name, status
 * price_rules          id, price_file_id, rule_family, level, name,
 *                      condition, quantity, value, markup, part_code,
 *                      loop_target, group_name, is_active, sort_order
 *                      rule_family ∈ { 'install_labour', 'manufacture_labour',
 *                                      'parts', 'price' }
 *                      level ∈ { 'item', 'quote' }  (on price rules only)
 * price_file_parts     price_file_id, part_code, part_name, unit_cost
 * price_file_variables price_file_id, variable_name, value
 * pricing_runs         id, drawing_id, price_file_id, status, created_at
 * drawing_rule_results id, drawing_id, price_file_id, pricing_run_id,
 *                      price_rule_id, loop_target_type, loop_index,
 *                      cost, sales, markup_applied
 * drawing_allocated_parts
 *                      id, drawing_id, price_file_id, pricing_run_id,
 *                      price_rule_id, part_code, part_name,
 *                      unit_cost, quantity, total_cost
 * drawing_pricing_variables
 *                      id, pricing_run_id, drawing_id, variables (jsonb)
 * quote_pricing_runs   id, quote_id, price_file_id, status, created_at
 * quote_rule_results   id, quote_id, price_file_id, quote_pricing_run_id,
 *                      price_rule_id, cost, sales, markup_applied
 * quote_item_apportionment
 *                      id, quote_rule_result_id, quote_pricing_run_id,
 *                      drawing_id, cost, sales
 */

import { computeVariables } from './computeVariables.js'
import { evaluateCondition, evaluateNumber, getExpressionVariables } from './evaluator.js'
import { loadDrawingParts } from '../drawingBoard/api.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'
import { chamferAllowanceMm } from '../drawingBoard/sashGeometry.js'
import { computeSashWeight, SASH_REPLACEMENT_ITEM_WEIGHT_FACTOR } from './sashWeight.js'
import { allocateParts } from './partAllocator.js'
import { treeHash } from './treeHash.js'
import { loadPricingContext, resolveIronmongeryLines } from './loadPricingContext.js'
import { PRICING_ENGINE_VERSION } from './engineVersion.js'

/**
 * An ironmongery line's label for the price breakdown: the product, the
 * finish it actually priced in, and where that finish came from.
 *
 * Step AQ item 5: a default line follows the ITEM finish where the product
 * exists in it and the RULE finish otherwise, so "PB" alone no longer says
 * which decision was made. The breakdown stores alloc_label, so putting it
 * here shows it without a new column:
 *   connoisseur_handle_lh (PB, item finish)
 *   defender_friction_hinge_-_side_hung_310mm (PC, rule finish)
 */
const FINISH_SOURCE_LABELS = {
  line:    'line finish',
  item:    'item finish',
  rule:    'rule finish',
  profile: 'profile finish',
}

/**
 * A component's length in metres, for the price rules' `length * qty`.
 *
 * SURROUNDS (architrave height and width, head board, bullnose & packer) go
 * through Integrate's TWO roundings, which the reviewer read from the stored
 * surround lists on five drawings (docs/step-ar-addendum-surround-rounding.md):
 *   1. the board snaps the rule's length UP to the next 10 mm (1345 → 1350);
 *   2. the price uses that to the NEAREST 0.1 m, halves up (1350 → 1.4).
 * That fits every reading, including the three that a single rounding mode
 * cannot fit together: L34046's 1345 → 1.4, benchmark S's 1349 → 1.4 and
 * benchmark Q's 1140 → 1.1.
 *
 * EVERY OTHER component keeps the plain ceiling to the next 0.1 m. There is
 * no Integrate reading for those, and changing them unasked would risk
 * benchmarks that are exact today.
 *
 * Worked in whole millimetres so no float error can land a value on the
 * wrong side of a 50 mm boundary.
 */
/**
 * A drawing's STORED surround list, as allocated-part rows.
 *
 * Shape on the tree (drawingItemPart.values.surroundLines), mirroring
 * Integrate's own `surround` array and GlazePro's ironmongeryLines:
 *   [{ part_code, qty, length_mm, label? }]
 *
 * `group: 'surrounds'` so these go through the same length rounding as the
 * allocator's — ceil to 10 mm then the nearest 0.1 m
 * (docs/step-ar-addendum-surround-rounding.md).
 */
export function storedSurroundParts(tree) {
  const item = findFirst(tree, 'drawingItemPart')
  const lines = item?.values?.surroundLines
  if (!Array.isArray(lines) || lines.length === 0) return []
  return lines
    .filter(l => l && l.part_code)
    .map((l, i) => ({
      rule_id: null,
      group: 'surrounds',
      label: l.label ?? `Surround ${i + 1}`,
      part_code: l.part_code,
      qty: Number(l.qty) || 1,
      measure: Number(l.length_mm) || 0,
      scope_part_id: null,
      scope_part_type: null,
      defaulted_vars: [],
    }))
}

export function componentLengthMetres(measure, group = null) {
  const mm = Number(measure) || 0
  if (group === 'surrounds') {
    const snapped = Math.ceil(mm / 10 - 1e-9) * 10
    return Math.floor((snapped + 50) / 100) / 10
  }
  return Math.ceil(mm / 100) / 10
}

export function ironmongeryLineLabel(ironLine) {
  const name = ironLine?.product_short_name ?? null
  if (!name) return null
  const finish = ironLine.finish_code
  if (finish == null || finish === '') return name
  const source = FINISH_SOURCE_LABELS[ironLine.finish_source]
  return source ? `${name} (${finish}, ${source})` : `${name} (${finish})`
}

import {
  glazingType, hornLengthMm, hornKind, operationKind, glassSpacerMm,
  isWarmEdgeSpacerColour, collectVocabularyWarnings, resolveTopSashArch,
  casementIsFixed, casementOpensOut, timberFamily, panelType, panelBead,
} from './optionVocabulary.js'
import { fetchAllRows } from '../lib/fetchAllRows.js'
import { sashSizes, owningSashPair } from './derivedGeometry.js'
import {
  isDirectGlazedUnit, directGlazedVisibleSize, directGlazedGlassSize,
  casementGlassSightline, casementSashSize, casementSashTimberVolumeDm3,
  casementSashWeightKg, directGlazedWarnings,
  CASEMENT_SASH_TYPES,
} from './casementGeometry.js'
import {
  DOOR_LEAF_TYPES, FRENCH_DOOR_LEAF_TYPES, doorLeafSize, doorGlassSightline,
  frenchDoorPairFor, doorLeafWeightKg, allocatedSectionParts,
  doorPanelSize, leafForPanel, panelSizeFor, leafCellOf,
} from './doorGeometry.js'
import { isFanlightSash } from './casementSashVariables.js'
// Step BH follow-up item 2: the label a degenerate part is reported under
import { openingLabel } from '../drawingBoard/casementOpenings.js'

// ── Tree helpers (local copies, same logic as computeDerived.js) ──────────────

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

function findAll(node, partType, acc = []) {
  if (!node) return acc
  if (node.part_type === partType) acc.push(node)
  for (const child of (node.children ?? [])) findAll(child, partType, acc)
  return acc
}

function findParentSash(tree, childKey) {
  function walk(node, parent) {
    if (!node) return null
    if (node.key === childKey) return parent
    for (const child of (node.children ?? [])) {
      const found = walk(child, node)
      if (found !== null) return found
    }
    return null
  }
  return walk(tree, null)
}

// ── Loop target helper ────────────────────────────────────────────────────────

const LOOP_PART_TYPES = {
  sliding_sash:  ['topSashPart', 'bottomSashPart'],
  frame:         ['assemblyFramePart'],
  glass_unit:    ['glassPart'],
  // Step AX: a French pair's two sashes are casement sashes in this loop —
  // each is machined, glazed, finished and (if it opens) hung exactly as a
  // single casement sash is, and the pair itself adds nothing of its own.
  casement_sash: CASEMENT_SASH_TYPES,
  // Step AZ: a French door's two leaves are left/rightFrenchDoorLeafPart.
  // Only 'doorLeafPart' was listed, so no live door rule could see a French
  // door leaf — "Door Leaf" (1035 min each) and "Any Door Overweight" both
  // loop door_leaf.
  door_leaf:     DOOR_LEAF_TYPES,
  panel:         ['panelPart'],
}

// Step AH: Integrate's glass_unit loop only VISITS glass that is being
// supplied — the gate is per SASH and lives in the loop, not in the rule
// conditions (docs/integrate-L31115-A-top-only.txt §2–3: Integrate's glass
// conditions have no replaced-gate, yet with only A's top sash replaced it
// priced ONE Square Glass / Multiple GB / Energy line). A glassPart under
// a sliding sash is visited only when the item is complete new, THAT
// sash's toBeReplaced is true, or the item is bi-glass (new glass into
// existing sashes — not yet benchmarked). Glass NOT under a sliding sash
// (direct glazed into the frame, casements, doors) is unchanged and
// unverified.
function glassUnitIsSupplied(glassNode, tree, baseVars) {
  const parent = findParentSash(tree, glassNode.key)
  if (!parent || (parent.part_type !== 'topSashPart' && parent.part_type !== 'bottomSashPart')) return true
  if (baseVars?.is_complete_new === true) return true
  if (baseVars?.is_bi_glass === true) return true
  return parent.values?.toBeReplaced === true
}

function getLoopParts(tree, loopTarget, baseVars = null) {
  if (!loopTarget) return [null]
  const partTypes = LOOP_PART_TYPES[loopTarget]
  if (!partTypes) return []  // unknown loop_target → skip entirely
  const parts = []
  for (const pt of partTypes) {
    parts.push(...findAll(tree, pt))
  }
  if (loopTarget === 'glass_unit' && baseVars) {
    return parts.filter(g => glassUnitIsSupplied(g, tree, baseVars))
  }
  // NOTE (Step AN): there is deliberately NO "no sash work" gate on this
  // loop. Step AM put one here as well as in the component allocator, but
  // the evidence is against it: on the stand-alone cill, and on the same
  // drawing with "No Work", Integrate still priced the sliding-sash PRICE
  // rules Laminated Softwood ×2 and Glazing Bead ×2 — £50.90 was No Work's
  // entire price (docs/integrate-L31115-cill.txt, last section). So
  // Integrate's price-rule loop DOES visit sashes nothing is being done to;
  // what it skips is the COMPONENT staff/parting bead lines, and that gate
  // lives in partAllocator.js. Those two price rules are gated here by
  // GlazePro's own deliberate S4 difference (to_be_replaced), not by the
  // loop, and a gate here would silently drop any OTHER ungated
  // sliding_sash price rule (for instance "Hardwood Sashes":
  // is_solid_utile_hardwood_sash, no gate).
  return parts  // empty array = no matching parts in tree → skip entirely
}

// ── Missing-variable defaulting ───────────────────────────────────────────────

/**
 * Pre-scan the variable names referenced by one or more expressions.
 * Any name not present in `vars` is injected as 0 so rule evaluation never
 * throws "undefined variable" — unknown names just default silently to 0.
 *
 * @param {string[]} exprs  - Array of expression strings (may be null/undefined)
 * @param {Object}   vars   - Current variable context
 * @returns {{ vars: Object, defaulted: string[] }}
 */
function defaultMissingVars(exprs, vars) {
  const missing = new Set()
  for (const expr of exprs) {
    if (!expr) continue
    for (const name of getExpressionVariables(expr)) {
      if (!(name in vars)) missing.add(name)
    }
  }
  if (missing.size === 0) return { vars, defaulted: [] }
  const augmented = { ...vars }
  for (const name of missing) augmented[name] = 0
  return { vars: augmented, defaulted: [...missing] }
}

// ── Shaped (arched) glass cut area ───────────────────────────────────────────
// Step AD decision 2: the cut shape is the sightline shape grown outward by
// `cover` (= rebate − tolerance) on every edge — the sides and bottom move
// out by `cover`, the arc stays CONCENTRIC at radius + cover. Exact area =
// the rectangle up to where the arc meets the grown sides, plus the
// circular segment above it. Reviewer's check for C (chord 726, rise 100,
// cover 12): R = 708.845 + 12 = 720.845, W = 750, rectangle 0.2665 m² +
// segment 0.0533 m² = 0.3199 → rounded 0.32, Integrate's figure; energy
// qty 0.32 × 20 = 6.40 follows from the same area.
/**
 * What a SHAPED unit is BILLED on (Step BE, Nathan’s decision e, 14 Oct).
 *
 * The glass supplier charges for the sheet it has to cut the shape out of,
 * plus a quarter for the cutting: the LARGEST RECTANGLE of the cut glass
 * (its bounding box) x 1.25, at the SQUARE glass rate. FT3: 801 x 1127 =
 * 0.902727 m2 -> 1.128409, which rounds to the 1.13 the rule prices.
 *
 * Integrate instead prices the EXACT shaped area at a shaped rate (the
 * square rate x 1.25 — the same quarter, moved from the area to the rate),
 * and on FT3 its area is 0.62 where the shape is 0.79. Both figures are
 * Integrate's; neither is what the supplier charges.
 */
export function shapedGlassBillableAreaM2(cutWidthMm, cutHeightMm) {
  const w = Number(cutWidthMm), h = Number(cutHeightMm)
  if (!(w > 0) || !(h > 0)) return null
  return (w * h * SHAPED_GLASS_WASTE) / 1e6
}

/** The supplier’s quarter on a shaped unit (Nathan, 14 Oct). */
export const SHAPED_GLASS_WASTE = 1.25

/**
 * The EXACT area of a shaped cut, kept for the record.
 *
 * Step BE: this is no longer what a shaped unit is PRICED on — see
 * shapedGlassBillableAreaM2. It reproduced Integrate’s own figure on
 * benchmark C to the penny (0.32 on a 726 chord with a 100 rise), which is
 * why it is still here: it is the measurement of the glass, and the
 * difference between it and the bill is the supplier’s charge.
 */
export function shapedGlassCutAreaM2(sightlineWidth, sightlineHeight, riseMm, coverMm) {
  const chord = Number(sightlineWidth)
  const h     = Number(riseMm)
  const Hs    = Number(sightlineHeight)
  const g     = Number(coverMm) || 0
  if (!(chord > 0) || !(h > 0) || !(Hs > h)) return null
  const r    = (chord * chord / 4 + h * h) / (2 * h)  // sightline arc radius
  const R    = r + g                                   // cut arc, concentric
  const W    = chord + 2 * g                           // cut width
  const half = W / 2
  if (R <= half) return null                           // flatter than the cut is wide
  const Hc    = Hs + 2 * g                             // cut height at the centre
  const yc    = Hc - R                                 // arc centre above the cut bottom
  const ySide = yc + Math.sqrt(R * R - half * half)    // arc meets the grown sides
  if (!(ySide > 0)) return null
  const alpha   = 2 * Math.asin(half / R)
  const segment = (R * R / 2) * (alpha - Math.sin(alpha))
  return (W * ySide + segment) / 1e6
}

// ── Part-level variable computation ──────────────────────────────────────────

function computePartVariables(partNode, tree, derived, baseVars, glassCatalogue = {}, profileValues = {}) {
  if (!partNode) return {}
  const pt = partNode.part_type
  const v  = partNode.values ?? {}

  const isCordHung   = op => operationKind(op) === 'cord'
  const isSpiralHung = op => operationKind(op) === 'spiral'
  const isFixed      = op => operationKind(op) === 'fix'

  /**
   * Step BL item 2: the glazing bars on THIS sash or leaf's own glass.
   *
   * The same count the item-level `gb_to_be_replaced_qty` makes, restricted
   * to one opening: a bar counts when the opening it belongs to is being
   * replaced, and the actual bar parts are preferred over the legacy
   * barsWide / barsHigh numbers, exactly as computeVariables does.
   */
  function ownBarCount(node, isCompleteNew) {
    const included = isCompleteNew || node?.values?.toBeReplaced === true
    if (!included) return 0
    return (node?.children ?? [])
      .filter(c => c.part_type === 'glassPart')
      .reduce((sum, g) => {
        const vBars = (g.children ?? []).filter(c => c.part_type === 'verticalGlazingBarPart').length
        const hBars = (g.children ?? []).filter(c => c.part_type === 'horizontalGlazingBarPart').length
        if (vBars > 0 || hBars > 0) return sum + vBars + hBars
        return sum + (Number(g.values?.barsWide) || 0) + (Number(g.values?.barsHigh) || 0)
      }, 0)
  }

  if (pt === 'topSashPart' || pt === 'bottomSashPart') {
    const isTop          = pt === 'topSashPart'
    const op             = v.operation ?? ''
    const is_complete_new = baseVars.is_complete_new ?? false
    const to_be_replaced  = is_complete_new || v.toBeReplaced === true

    // Step AD decision 3: the sash's OWN pair — on a double box each pair
    // has its own opening and every sash prices from its pair's geometry.
    const pair = owningSashPair(tree, partNode)

    // Sash geometry from the drawing board's own derivation — ONE source
    // (Step V: assemblyFramePart.width/height are the OVERALL frame; the
    // drawn sash sizes come from computeDerived / computeSashGeometry).
    const sz = sashSizes(tree, derived, partNode)

    // Horn length from the drawing (stored length, else the length that
    // belongs to the horn type — optionVocabulary.js, step-y brief §1).
    // The old 70 mm Victorian constant and the invented sashLip are gone.
    const hornCode   = isTop
      ? pair?.values?.topHornTypeShortName
      : pair?.values?.bottomHornTypeShortName
    const storedHornLength = isTop
      ? pair?.values?.topHornLength
      : pair?.values?.bottomHornLength
    const hornLength = hornLengthMm(hornCode, storedHornLength)

    // Bottom sash: a chamfered bottom rail adds the internal/external
    // measurement difference — round(thickness × tan(angle)) in WHOLE mm,
    // the "7" Integrate labels on its drawings (35/40 → 6, 45 → 7, 50 → 8;
    // docs/integrate-benchmarks-thickness.txt, step-ab brief §1). Not
    // chamfered → 0.
    const sashThicknessForGross = pair?.values?.sashThickness ?? 45
    const chamferAngle = !isTop ? Number(v.chamferedBottomRailAngle ?? 0) : 0
    const chamferAllowance = chamferAllowanceMm(sashThicknessForGross, chamferAngle)

    // Arch (Step AD): top sash from its stored fields (or the legacy
    // frame-level archHead, flagged by collectVocabularyWarnings); a
    // bottom sash is arched only by its own archHead.
    const sashArch = isTop
      ? resolveTopSashArch(tree, partNode)
      : { archHead: v.archHead === true, archHeight: Number(v.archHeight) || 0 }

    // Gross sash height = drawn sash height (glass + own rail + meeting
    // rail — Integrate's drawn label) + horn + bottom chamfer allowance
    const drawnHeight = isTop ? sz.topSashHeight : sz.bottomSashHeight
    const gross_sash_height_in_mm = drawnHeight != null
      ? drawnHeight + hornLength + chamferAllowance : null

    // Gross sash width = the drawn sash width (Integrate's "Sash width")
    const gross_sash_width_in_mm = sz.sashWidth

    const stileWidth = v.leftWidth ?? 47
    const sash_sightline_width_in_mm = sz.sashWidth != null
      ? sz.sashWidth - 2 * stileWidth : null
    const sash_sightline_height_in_mm = isTop ? sz.topGlassHeight : sz.bottomGlassHeight

    // Sash weight — measured model (sashWeight.js); needs the profile
    // rebate/tolerance for the glass cut, like the glass price does
    const weightData = computeSashWeight(partNode, tree, glassCatalogue, profileValues)
    const sash_thickness = pair?.values?.sashThickness ?? 45

    return {
      is_top_sash:    isTop,
      is_bottom_sash: !isTop,
      to_be_replaced,
      is_cord_hung:    isCordHung(op),
      is_spiral_hung:  isSpiralHung(op),
      is_fixed_sash:   isFixed(op),
      // Step AD: the arch lives on the TOP SASH, measured at the glass
      // (legacy frame archHead is read as a top-sash arch —
      // resolveTopSashArch). Integrate's own rules distinguish a SWEPT
      // head (arched glass sightline — "Sash Swept Head" etc.) from a
      // fully CURVED head sash (its own curvedSashHead field): C's 770
      // missing minutes are exactly the swept-head rules (step-ad).
      is_sash_arched:  sashArch.archHead,
      is_curved_head_sash: v.curvedSashHead === true,
      is_square_top_with_arched_sightline:
        sashArch.archHead && v.curvedSashHead !== true,
      gross_sash_width_in_mm,
      gross_sash_height_in_mm,
      sash_sightline_width_in_mm,
      sash_sightline_height_in_mm,
      unit_gb_qty:   0,  // NEEDS-DATA: glazing bars per sash not yet captured
      // weight_in_kg is CUT to 1 dp before rule evaluation, not rounded —
      // INFERRED FROM FOUR VALUES (step-y brief §3): 17.218→17.2,
      // 17.318→17.3, 19.489→19.4, 20.444→20.4 (rounding fits only three).
      weight_in_kg:            Math.floor(weightData.weight_in_kg * 10 + 1e-9) / 10,
      weight_in_lb:            weightData.weight_in_lb,
      weight_incl_panel_in_kg: weightData.weight_incl_panel_in_kg,
      weight_incl_panel_in_lb: weightData.weight_incl_panel_in_lb,
      sash_thickness,
      // Step BL item 3: THIS SASH'S OWN HORN.
      //
      // `has_custom_horn_horn` and `horn_length_in_mm` are item-level
      // variables, computed from the pair as "either end has a custom horn"
      // and "the longer of the two lengths". The two rules that read them —
      // "Non-Std Horn 75mm" (30) and "Non-Std Horn Non-75mm" (90) — loop
      // SLIDING SASH, so both sashes of a pair saw the item's answer and the
      // charge was made twice where Integrate makes it once.
      //
      // Integrate charges the sash that HAS the horn: on L34265 items 1, 3
      // and 4 the top sash is a custom 75 and the bottom is "no horn", and
      // its labour editor shows the rule once per pair (and twice on the
      // double box, which is two pairs). The loop already works out this
      // sash's own horn for the gross height, so these just report it.
      //
      // The item-level pair is untouched: a rule written at item level still
      // means "this window has a custom horn".
      has_custom_horn_horn: hornKind(hornCode) === 'custom',
      horn_length_in_mm: hornLength,
      // Step BL item 7: THIS SASH'S TIMBER VOLUME, in dm³.
      //
      // "Hardwood Sashes" (`volume * 1.2` at £1.75, loop sliding_sash,
      // condition is_solid_utile_hardwood_sash) never charged anything. The
      // item-level `volume` is a FRAME volume with branches for accoya and
      // redwood only — for a UTILE item it is 0 — so the rule fired on a
      // quantity of nothing. Integrate charges each sash its own: 7.27 and
      // 9.22 on the 1000 x 1400 of live drawing 94, which are two different
      // figures and so cannot be an item-level anything.
      //
      // The volume is the one the weight is already built on (sashWeight.js:
      // thickness x [2 stiles x drawn height + (rail + meeting rail) x
      // sightline width]), in litres.
      volume: (weightData._debug?.timber_vol_mm3 ?? 0) / 1e6,
      sibling_weight: 0,  // TODO: requires two-pass to set top ↔ bottom
    }
  }

  if (pt === 'assemblyFramePart') {
    // assemblyFramePart.width/height ARE the overall frame (Step V decision)
    const outerW = v.width  ?? 0
    const outerH = v.height ?? 0

    // Frame width/height in METRES are rounded HALF UP to 2 dp, decimal-safe
    // (1245 mm → 1.25 m, never 1.24 via binary float). INFERRED FROM ONE
    // BENCHMARK (step-y brief §2): Integrate's Box Frame Staff Bead cost
    // 19.88 = (1.25 + 1.78) × 2 × 3.28. Applied ONLY to these frame-level
    // metre variables.
    const metres2dp = mm => Math.floor(mm / 10 + 0.5) / 100

    // Cill child part (assemblyFramePart > cillPart)
    const cillNode = (partNode.children ?? []).find(c => c.part_type === 'cillPart')
    const cv = cillNode?.values ?? {}

    // cill_profiled_height_in_mm: height excluding frame stop (store as profiledHeight in fixture)
    const cill_profiled_height_in_mm = cv.profiledHeight ?? cv.height ?? 0
    // cill_length_in_mm: outer frame width + left horn + right horn
    const cill_length_in_mm = outerW + (v.leftCillHorn ?? 0) + (v.rightCillHorn ?? 0)

    // ── Step BC: THIS frame's own counts ────────────────────────────────────
    //
    // A drawing can hold several frames (a single door with flag lights), and
    // a frame-LOOP rule asks about the frame it is visiting — not the item.
    // These came from the item-level variables, so on a container every frame
    // answered with the whole item's counts:
    //
    //   "Machining & Joining a Door Frame" 855 (door_leaf_qty >= 1) fired on
    //   all three of CD1's frames instead of the door frame alone;
    //   "Additional for Frame Mullion or Transom" charged CD4's three transoms
    //   on each of its three frames; and "Machining & Joining a Casement
    //   Frame" (door_leaf_qty < 1) could never fire on a flag frame, which is
    //   Nathan's decision d.
    //
    // "LTW General Consumables" is what proves the scoping: its condition is
    // per frame (a sash or a leaf in THIS frame) and Integrate charges it once
    // per frame — 25 x 3 on CD1.
    //
    // On a ONE-frame drawing each of these equals the item-level value it
    // replaces, so no existing benchmark moves.
    const own     = type  => (partNode.children ?? []).filter(c => c.part_type === type)
    const ownDeep = types => {
      const acc = []
      const walk = n => {
        if (types.includes(n.part_type)) acc.push(n)
        for (const c of (n.children ?? [])) walk(c)
      }
      for (const c of (partNode.children ?? [])) walk(c)
      return acc
    }
    const frameLeaves   = ownDeep(DOOR_LEAF_TYPES)
    const frameSashes   = ownDeep(CASEMENT_SASH_TYPES)
    const frameMullions = own('mullionPart')
    const frameTransoms = own('transomPart')
    const isNew = baseVars.is_complete_new ?? false

    return {
      to_be_replaced:          isNew,
      width:                   metres2dp(outerW),   // metres, 2 dp half-up (see above)
      height:                  metres2dp(outerH),   // metres, 2 dp half-up
      frame_width_in_mm:       outerW,          // mm (OUTER)
      frame_height_in_mm:      outerH,          // mm (OUTER)
      frame_depth_in_mm:       cv.depth ?? v.frameDepth ?? 0,
      cill_profiled_height_in_mm,
      cill_length_in_mm,
      // ── this frame's own contents ──
      door_leaf_qty:           frameLeaves.length,
      new_door_leaf_qty:       isNew ? frameLeaves.length : 0,
      casement_sash_qty:       frameSashes.length,
      new_casement_sash_qty:   isNew ? frameSashes.length : 0,
      fixed_casement_sash_qty: frameSashes.filter(casementIsFixed).length,
      frame_mullion_qty:       frameMullions.length,
      frame_transom_qty:       frameTransoms.length,
      full_length_frame_mullion_qty:
        frameMullions.filter(m => !(m.values?.offset2 > 0)).length,
      panel_in_frame_qty:      own('panelPart').length,
    }
  }

  // ── Casement sash (Step AO) ───────────────────────────────────────────────
  // The casement_sash loop needs these: rule 1000 "Machining & Joining a
  // Casement Sash" keys on to_be_replaced, rule 165 "Softwood Casement
  // Sashes" on solid_redwood_volume (dm³, per sash) and rule 95 "Any Sash
  // Overweight (Casement)" on weight_in_kg.
  if (CASEMENT_SASH_TYPES.includes(pt)) {
    const is_complete_new = baseVars.is_complete_new ?? false
    const size = casementSashSize(tree, partNode)
    const sightline = casementGlassSightline(tree, partNode)
    // Only REDWOOD sashes have a timber volume: rule 165's condition is
    // literally "true", so a utile casement must give 0 or it would be
    // charged at the redwood rate. Integrate has no hardwood casement sash
    // rule, which is why benchmark J shows no sash timber line at all.
    const itemNode = findFirst(tree, 'drawingItemPart')
    const casementWeight = casementSashWeightKg(tree, partNode, glassCatalogue)
    // Step BJ item 1f: a BI-GLASS sash is KEPT, so there is no sash timber to
    // charge. Rule 165's condition is literally "true", so the volume is the
    // only place this can be said.
    const sashIsMade = baseVars.is_bi_glass !== true
    const sashTimber = (sashIsMade && timberFamily(itemNode?.values?.sashMaterialId) === 'redwood')
      ? casementSashTimberVolumeDm3(tree, partNode)
      : 0
    return {
      to_be_replaced:  is_complete_new || v.toBeReplaced === true,
      is_item_a_door:  baseVars.is_door ?? false,
      is_raked:        v.rakeFrame === true,
      is_fixed_casement_sash: casementIsFixed(partNode),
      is_opening:      !casementIsFixed(partNode),
      // Step AZ: "Fanlights in Doorsets" (300 min) reads is_item_a_door AND
      // is_fanlight on this loop. is_fanlight was only ever computed in
      // casementSashVariables, for validation and ironmongery, so the PRICE
      // loop could not see it and the rule never fired.
      is_fanlight:     isFanlightSash(tree, partNode),
      gross_sash_width_in_mm:  size.width  ?? 0,
      gross_sash_height_in_mm: size.height ?? 0,
      sash_sightline_width_in_mm:  sightline.width  ?? 0,
      sash_sightline_height_in_mm: sightline.height ?? 0,
      solid_redwood_volume: sashTimber,
      // Step BL item 2: THIS SASH'S OWN BARS.
      //
      // "Additional for Glazing Bars" (30 minutes, loop casement_sash) is
      // written on `gb_to_be_replaced_qty`, which is an ITEM-level total —
      // every bar in the drawing. So one barred sash made the rule fire on
      // every sash in the item: live drawing 100 charged it twice for one
      // barred fanlight, and drawing 117 six times for one barred sash,
      // 150 minutes GlazePro charged and Integrate did not.
      //
      // Integrate counts the sash whose own glass has bars. In a per-sash
      // loop the count has to be this sash's, which is what this is; the
      // item-level variable is untouched for the item-level rules that
      // legitimately read the drawing's total.
      gb_to_be_replaced_qty: ownBarCount(partNode, is_complete_new),
      // Casement sash weight by Step W's measured method (timber volume ×
      // the family density + glass at its cut size): install rule 95 "Any
      // Sash Overweight (Casement)" fires above 25 kg, which benchmark P's
      // 1517 × 1497 sash is and K and N's 541 × 1197 sashes are not —
      // matching what Integrate charges on each.
      weight_in_kg: casementWeight,
      weight_in_lb: casementWeight * 2.20462,
    }
  }

  // Step AZ: a DOOR LEAF. Its drawn size is not half the opening — the two
  // leaves lap at the meeting stile — and its weight decides "Any Door
  // Overweight" (45 min a leaf over 50 kg), which is 90 of FD1's 870
  // install minutes.
  if (DOOR_LEAF_TYPES.includes(pt)) {
    const is_complete_new = baseVars.is_complete_new ?? false
    const size = doorLeafSize(tree, partNode)
    const sightline = doorGlassSightline(tree, partNode)
    const pair = frenchDoorPairFor(tree, partNode)
    const weight = doorLeafWeightKg(tree, partNode, glassCatalogue)
    const isMaster = v.isMasterLeaf === true
    return {
      to_be_replaced:  is_complete_new || v.toBeReplaced === true,
      is_item_a_door:  true,
      is_raked:        v.rakeFrame === true,
      // Step BD item 6: the leaf’s OWN head. "Additional for Curved Head
      // (Door)" (360) and "Additional for Swept Head (Door)" (240) are
      // door_leaf rules, and neither could fire on an arched front door.
      is_curved_head_sash: v.curvedSashHead === true,
      is_square_top_with_arched_sightline:
        v.archHead === true && v.curvedSashHead !== true,
      is_fixed_casement_sash: casementIsFixed(partNode),
      is_opening:      !casementIsFixed(partNode),
      is_opening_out:  casementOpensOut(partNode),
      gross_sash_width_in_mm:  size.width  ?? 0,
      gross_sash_height_in_mm: size.height ?? 0,
      sash_sightline_width_in_mm:  sightline.width  ?? 0,
      sash_sightline_height_in_mm: sightline.height ?? 0,
      // A door carries NO timber volume: Integrate prices its sections per
      // metre instead (the allocated_section_part loop below). Reporting 0
      // here is what keeps "Hardwood Sashes" and the two inactive door
      // volume rules from charging a door twice.
      solid_redwood_volume: 0,
      // Step BL item 2: THIS LEAF'S OWN BARS, as the casement loop above —
      // "Additional for Glazing Bars (Door)" (30 minutes, loop door_leaf) is
      // written on the item-level total, so one barred leaf charged every
      // leaf of the doorset.
      gb_to_be_replaced_qty: ownBarCount(partNode, is_complete_new),
      weight_in_kg: weight,
      weight_in_lb: weight * 2.20462,
      is_french_door_leaf: FRENCH_DOOR_LEAF_TYPES.includes(pt),
      is_master_leaf_in_french_pair: pair != null && isMaster,
      is_slave_leaf_in_french_pair:  pair != null && !isMaster,
      hand: pt === 'leftFrenchDoorLeafPart' ? 'left'
        : pt === 'rightFrenchDoorLeafPart' ? 'right'
          : (String(v.operation ?? '').includes('left') ? 'left' : 'right'),
    }
  }

  // Step BA: a PANEL. FD4 carries a raised-and-fielded Tricoya panel under
  // each leaf's mid rail, and the live `panel` loop had no variables at all —
  // "Tricoya Panel" prices the panel's VISIBLE size and the five "Additional
  // for ... Panel" rules each read a panel-type flag, so without these the
  // loop visited the part and every rule read undefined.
  //
  // `visible_width_in_mm_old` is Integrate's name for the panel's visible
  // size (the "_old" suffix is Integrate's, not a stale copy — the rule
  // calls it that). The size comes from the leaf's geometry, never from a
  // stored value: a panel is what is left of the leaf below its mid rail.
  if (pt === 'panelPart') {
    const is_complete_new = baseVars.is_complete_new ?? false
    // Step BD: this panel’s OWN cell in its holder’s grid. doorPanelSize is
    // one size for the whole leaf, so FT1’s four panels each priced
    // 777 x 635 (0.49 m2) instead of Integrate’s 0.37 / 0.28 / 0.24 / 0.18.
    //
    // Step BE: the holder can be a CASEMENT SASH — Nathan’s side light is a
    // fixed sash with glass over a panel, and leafForPanel only knew leaves,
    // so its panel had no size at all.
    const cellSize = panelSizeFor(tree, partNode)
    const leaf = cellSize.width != null ? null : leafForPanel(tree, partNode)
    const size = cellSize.width != null
      ? cellSize
      : (leaf ? doorPanelSize(tree, leaf) : { width: null, height: null })
    const internal = panelType(v.internalPanelTypeId)
    const external = panelType(v.externalPanelTypeId)
    const beadIn   = panelBead(v.internalPanelBeadId)
    const beadOut  = panelBead(v.externalPanelBeadId)
    const typeIs = (code, side) => (side === 'internal' ? internal : external) === code
    return {
      // Step BH follow-up item 2: the size this part was WORKED OUT to be,
      // for the degenerate-size guard. Underscored because it is not a
      // rule variable — no condition names it, and it is an object.
      _size: { width: size.width, height: size.height },
      to_be_replaced: is_complete_new || v.toBeReplaced === true,
      visible_width_in_mm_old:  size.width  ?? 0,
      visible_height_in_mm_old: size.height ?? 0,
      internal_panel_type: internal ?? '',
      external_panel_type: external ?? '',
      is_flat_panel_internally: typeIs('flat', 'internal'),
      is_flat_panel_externally: typeIs('flat', 'external'),
      is_raised_and_fielded_panel_internally: typeIs('raised_and_fielded', 'internal'),
      is_raised_and_fielded_panel_externally: typeIs('raised_and_fielded', 'external'),
      is_vertical_tongue_and_groove_panel_internally: typeIs('vertical_tongue_and_groove', 'internal'),
      is_vertical_tongue_and_groove_panel_externally: typeIs('vertical_tongue_and_groove', 'external'),
      is_horizontal_tongue_and_groove_panel_internally: typeIs('horizontal_tongue_and_groove', 'internal'),
      is_horizontal_tongue_and_groove_panel_externally: typeIs('horizontal_tongue_and_groove', 'external'),
      is_tongue_and_groove_panel_internally:
        typeIs('vertical_tongue_and_groove', 'internal') || typeIs('horizontal_tongue_and_groove', 'internal'),
      is_tongue_and_groove_panel_externally:
        typeIs('vertical_tongue_and_groove', 'external') || typeIs('horizontal_tongue_and_groove', 'external'),
      is_bolection_moulding_around_panel_internally: beadIn === 'bolection',
      is_bolection_moulding_around_panel_externally: beadOut === 'bolection',
    }
  }

  if (pt === 'glassPart') {
    // Glass area from sash geometry
    const parentSash  = findParentSash(tree, partNode.key)

    // Step AD: the Square/Shaped glass rules switch PER UNIT on the
    // parent sash's arch ("not is_sash_arched" / "is_sash_arched" at
    // glass_unit loop level) — an arched top sash prices Shaped while
    // the square bottom sash of the same item prices Square.
    const parentArch = parentSash?.part_type === 'topSashPart'
      ? resolveTopSashArch(tree, parentSash)
      : { archHead: parentSash?.values?.archHead === true, archHeight: Number(parentSash?.values?.archHeight) || 0 }

    // Step AO: three kinds of glass unit, each with its own geometry —
    //  - a DIRECT GLAZED unit (a glassPart that is a direct child of the
    //    frame): its opening minus the mechanical clearance each side is
    //    the visible size, and the glass is that plus the glass hidden in
    //    the rebate;
    //  - a CASEMENT sash's glass: the sash minus its stiles and rails;
    //  - a sliding sash's glass: the drawn sash sizes, as before.
    const isDirectGlazed = isDirectGlazedUnit(tree, partNode)
    const isCasementGlass = CASEMENT_SASH_TYPES.includes(parentSash?.part_type)
    // Step AZ: a DOOR LEAF's glass. Without this the glass fell through to
    // the sliding-sash branch, which found no sash pair and gave 0 — so
    // FD1's two 1.33 m2 units priced at the 0.30 m2 minimum, £17.55 each
    // instead of £38.90.
    const isDoorGlass = DOOR_LEAF_TYPES.includes(parentSash?.part_type)

    let sightlineWidth = 0
    let sightlineHeight = 0
    if (isDoorGlass) {
      // Step BD: the glass unit’s own cell (a leaf can hold more than one).
      const sl = doorGlassSightline(tree, parentSash, partNode)
      sightlineWidth  = sl.width  ?? 0
      sightlineHeight = sl.height ?? 0
    } else if (isDirectGlazed) {
      const vis = directGlazedVisibleSize(tree, partNode)
      sightlineWidth  = vis.width  ?? 0
      sightlineHeight = vis.height ?? 0
    } else if (isCasementGlass) {
      // Step BE: a sash with a GRID of its own — Nathan’s side light, glass
      // over a panel — glazes only its own cell. Without this the side
      // light’s glass ran the full 1842 interior instead of the 888 above
      // its mid rail.
      const cell = leafCellOf(tree, partNode)
      const sl = cell ?? casementGlassSightline(tree, parentSash)
      sightlineWidth  = sl.width  ?? 0
      sightlineHeight = sl.height ?? 0
    } else {
      // Glass sightline from the same drawn sash sizes as everything else
      // (Step V): sightlineWidth = sash width − 2 × stileWidth, sightline
      // height = the parent sash's glass height from computeDerived — the
      // PARENT SASH's own pair on a multi-pair frame (Step AD decision 3).
      const gsz         = sashSizes(tree, derived, parentSash ?? partNode)
      const gStileWidth = parentSash?.values?.leftWidth ?? 47
      sightlineWidth = gsz.sashWidth != null
        ? gsz.sashWidth - 2 * gStileWidth : 0
      sightlineHeight = (parentSash?.part_type === 'bottomSashPart'
        ? gsz.bottomGlassHeight
        : gsz.topGlassHeight) ?? 0
    }

    // Glass CUT SIZE: extends beyond the sightline by (rebateWidth - tolerance) per edge.
    // The rebate and tolerance come from profile values keyed by glazing type.
    // Real glazing_type codes ('double_glazing', …) via optionVocabulary.js.
    const gType = glazingType(v.glazingId)
    const rebateKey = gType === 'single' ? 'defaultSingleGlazingRebateWidthForSash'
      : gType === 'triple' ? 'defaultTripleGlazingRebateWidthForSash'
      : gType === 'heritage' ? 'defaultHeritageGlazingRebateWidthForSash'
      : 'defaultDoubleGlazingRebateWidthForSash'
    const toleranceKey = gType === 'single' ? 'defaultSingleGlazingTolerance'
      : gType === 'triple' ? 'defaultTripleGlazingTolerance'
      : gType === 'heritage' ? 'defaultHeritageGlazingTolerance'
      : 'defaultDoubleGlazingTolerance'
    // Step AO: a casement sash's glass and a direct glazed unit carry their
    // OWN rebate and tolerance, as Integrate stores them per glass part
    // (casement sash glass 16/2, direct glazed 20/2) — only sliding sashes
    // take them from the profile.
    const storedRebate    = Number(v.glazingRebateWidth)
    const storedTolerance = Number(v.glazingTolerance)
    const hasStoredRebate = isFinite(storedRebate) && isFinite(storedTolerance)
    const rebateWidth = hasStoredRebate ? storedRebate : profileValues[rebateKey]
    const tolerance   = hasStoredRebate ? storedTolerance : profileValues[toleranceKey]
    if (rebateWidth == null || tolerance == null) {
      throw new Error(`Missing profile values for glass cut size: ${rebateKey}=${rebateWidth}, ${toleranceKey}=${tolerance}. Check the drawing's profile has glassPart rebate and tolerance values.`)
    }
    const cover       = rebateWidth - tolerance   // mm beyond sightline per edge

    // A direct glazed unit's glass is its visible size plus the glass
    // HIDDEN IN THE REBATE, which Integrate stores per edge on the unit
    // (18 — the same figure its rebate minus tolerance gives).
    const dgGlass = isDirectGlazed ? directGlazedGlassSize(tree, partNode) : null
    const glassWidth  = dgGlass ? (dgGlass.width  ?? 0) : sightlineWidth  + 2 * cover
    const glassHeight = dgGlass ? (dgGlass.height ?? 0) : sightlineHeight + 2 * cover

    // actual_area: m² rounded to 2dp (from glass CUT SIZE, not sightline).
    // An arched unit (Step AD decision 2) uses the EXACT area of the cut
    // shape instead of the bounding rectangle; the weight keeps the
    // rectangular envelope (sashWeight.js is untouched — C's steel
    // weights 10.0/10.2 already equal Integrate's on that envelope).
    // Step BE (Nathan, decision e): a SHAPED unit is billed on the largest
    // rectangle of its cut glass + 25%, at the square rate — on EVERY
    // product, a door or an arched sash alike. The exact shaped area is
    // what the glass measures, not what the supplier charges for it.
    const shapedArea = parentArch.archHead && parentArch.archHeight > 0
      ? shapedGlassBillableAreaM2(glassWidth, glassHeight)
      : null
    const rawAreaM2 = shapedArea != null
      ? shapedArea
      : (glassWidth > 0 && glassHeight > 0 ? glassWidth * glassHeight / 1e6 : 0)
    const actual_area = rawAreaM2 > 0 ? Math.round(rawAreaM2 * 100) / 100 : 0
    // rounded_area: actual_area (already 2dp) with 0.30 m² minimum.
    // Integrate definition (line 2168): "rounded up to 0.3 m2 if smaller".
    const rounded_area = Math.max(0.30, actual_area)

    // to_be_replaced
    //
    // Step BJ item 1a: the GLASS PART'S OWN FLAG comes first, because that is
    // where Integrate stores it. On a BI-GLASS job the glass is the only
    // thing being replaced — the frame and the sashes are kept — so
    // is_complete_new is false and the parent sash's flag is false, and this
    // read false. "BiGlass Labour Base Price" (240 minutes a glass unit, and
    // the whole of BG1's fitting) could not fire at all.
    //
    // The sash's flag is kept as a fallback, which is what makes every
    // existing benchmark stand still: a complete-new or sash-replacement
    // drawing stores the flag on the SASH and nothing on the glass.
    const to_be_replaced = (baseVars.is_complete_new === true) ||
      (v.toBeReplaced === true) ||
      (parentSash?.values?.toBeReplaced === true)

    // Glazing bars: prefer actual verticalGlazingBarPart/horizontalGlazingBarPart children
    // when present; fall back to legacy barsWide/barsHigh counts for unmigrated trees.
    const vBarParts = (partNode.children ?? []).filter(c => c.part_type === 'verticalGlazingBarPart')
    const hBarParts = (partNode.children ?? []).filter(c => c.part_type === 'horizontalGlazingBarPart')
    const hasActualBars = vBarParts.length > 0 || hBarParts.length > 0
    const barsWide = hasActualBars ? vBarParts.length : (v.barsWide ?? 0)
    const barsHigh = hasActualBars ? hBarParts.length : (v.barsHigh ?? 0)
    const rawUnitGbQty = barsWide + barsHigh

    // internal_spacer_length: total run of glazing bar material in this unit
    // (metres), at the glass CUT size — the same cut the glass price uses —
    // rounded half-up to 2 dp.
    //
    // Step AK: three Integrate readings fix this, and only this rule fits
    // all three. Bar run in mm at sightline / at cut (+2 × cover per axis),
    // against Integrate's printed quantity:
    //   A       2 × 761.5 + 802 = 2325 | cut 2397 → 2.40  = Integrate 2.40
    //   L34046  2 × 726.5 + 972 = 2425 | cut 2497 → 2.50  = Integrate 2.50
    //   F       2 × 787.0 + 916 = 2490 | cut 2562 → 2.56  = Integrate 2.56
    // The previous rule (ceil(sightline/100)/10) matched A and L34046 by
    // coincidence — both round up to the same 0.1 — but gives F 2.50
    // against Integrate's 2.56 (11p cost / 22p price short). Cut size with
    // ceil-to-0.1 gives F 2.60, and sightline with 2 dp gives A 2.33, so
    // neither fits. No constant was tuned: the cut size is the existing
    // glassWidth/glassHeight and the rounding is the engine's own
    // decimal-safe half-up.
    //
    // Step BJ item 1f: on a BI-GLASS CASEMENT the bars are taken OFF, not
    // made. Integrate charges their removal as fitting labour ("BiGlass GBs
    // to Take Off", 60 minutes each) and no bar material at all, so the run
    // of NEW bar is zero. BG2 was £7.82 of manufacture_materials over.
    //
    // Scoped to a casement on purpose: bi-glass on a SLIDING sash is a
    // separate step (Step BJ item 3) and must price exactly as it does today.
    const isBiGlassCasementUnit = baseVars.is_bi_glass === true &&
      baseVars.is_casement_window === true
    const internal_spacer_length = isBiGlassCasementUnit ? 0 : round2dpHalfUp(
      (barsWide * glassHeight + barsHigh * glassWidth) / 1000)

    // Step BJ item 1f, the same reading from the other side: THIS UNIT'S bars
    // are the ones being taken off, so the NEW pane has none.
    //
    // The item-level `gb_qty` still counts all three — that is what "BiGlass
    // GBs to Take Off" charges 60 minutes each to remove — but the glazing
    // that goes in is one plain sheet. Without this, "Glazing with Bar"
    // (production, unit_gb_qty x 12) charged BG2 36 minutes against
    // Integrate's nil, which is how the reading settles it: BG2's production
    // is 0 and only its FITTING differs from BG1.
    //
    // "Glazing a Sash" needs no such care — Integrate wrote `not is_bi_glass`
    // into that one itself.
    const unit_gb_qty = isBiGlassCasementUnit ? 0 : rawUnitGbQty

    // Glass costs — look up from parts catalogue using part codes; fall back to fixture values
    const innerEntry  = glassCatalogue[v.internalGlassPartNo] ?? null
    const outerEntry  = glassCatalogue[v.externalGlassPartNo] ?? null
    const singleEntry = glassCatalogue[v.singleGlassPartNo]   ?? null

    const inner_pane_cost  = innerEntry  ? innerEntry.cost_per_m2  : (v.innerPaneCost  ?? 0)
    const outer_pane_cost  = outerEntry  ? outerEntry.cost_per_m2  : (v.outerPaneCost  ?? 0)
    const single_pane_cost = singleEntry ? singleEntry.cost_per_m2 : (v.singlePaneCost ?? 0)

    // Glass pane thicknesses (mm) — from catalogue when available, else fixture
    const inner_pane_thickness  = innerEntry  ? innerEntry.thickness_mm  : (v.innerPaneThickness  ?? 0)
    const outer_pane_thickness  = outerEntry  ? outerEntry.thickness_mm  : (v.outerPaneThickness  ?? 0)
    const middle_pane_thickness = v.middlePaneThickness ?? 0
    const single_pane_thickness = v.singlePaneThickness ?? 0

    // glass_unit_thickness: inner + spacer + outer (mm).
    // Spacer thickness comes from the stored spacerDimId code ('spacer_16'
    // → 16); saved drawings never store a spacerHeight number.
    // Step BL item 1: a casement sash's, fanlight's or door leaf's glass
    // stores NO spacer, so its unit thickness came out 8 and the three
    // glazing-bar glass rules (all `glass_unit_thickness >= 24`) could not
    // fire on any of them — £9.21 to £29.20/m² missing on seven live
    // drawings. The drawing's profile holds it (`spacerDimId` "16mm"), and
    // the stored value still wins where there is one.
    //
    // A SINGLE glazed unit is left exactly as it was: it has one pane and no
    // spacer, so there is nothing to fall back to, and giving it 16 would
    // make a bi-glass casement's bars charge glass they do not have.
    const storedSpacerMm = glassSpacerMm(v)
    const spacerMm = (storedSpacerMm > 0 || gType === 'single')
      ? storedSpacerMm
      : glassSpacerMm(v, profileValues?.spacerDimId)
    const glass_unit_thickness = inner_pane_thickness + spacerMm + outer_pane_thickness

    // Spacer type flags — the warm-edge flag reads the COLOUR code
    // (spacerColourId 'white_warm_edge'); the dimension code never says it.
    const has_white_warm_edge_spacer = isWarmEdgeSpacerColour(v.spacerColourId)

    return {
      // Step BH follow-up item 2, as the panel branch: the SIGHTLINE this
      // unit was worked out to have. actual_area is clamped at 0 and
      // rounded_area carries a 0.30 m2 minimum, so a unit with no real
      // size would otherwise price at the minimum rather than not at all.
      //
      // A VISION PANEL is the exception, and it is a real one: its size is
      // STORED (Integrate’s 200 x 350 — a hole cut in a panel), not worked
      // out from a cell, so the sightline above comes out 0 and its price is
      // the 0.30 m2 minimum, £17.55, which is Integrate’s own figure on ST2.
      // The guard measures it by what it IS; nothing about the way it prices
      // is touched, and that it prices off a sightline of 0 is a question of
      // its own for whoever reads ST2 next.
      _size: visionPanelSize(v) ?? { width: sightlineWidth, height: sightlineHeight },
      actual_area,
      rounded_area,
      is_sash_arched: parentArch.archHead,
      // Step AO: the Direct Glazed labour bands key on this per unit
      is_direct_glazed_unit: isDirectGlazed,
      is_single_glazed: gType === 'single',
      is_double_glazed: gType === 'double',
      is_triple_glazed: gType === 'triple',
      glass_unit_thickness,
      to_be_replaced,
      unit_gb_qty,
      internal_spacer_length,
      inner_pane_cost,
      outer_pane_cost,
      single_pane_cost,
      inner_pane_thickness,
      outer_pane_thickness,
      middle_pane_thickness,
      single_pane_thickness,
      has_white_warm_edge_spacer,
    }
  }

  return {}
}

// ── Step BH follow-up item 2: a size that cannot be real ────────────────────
//
// Live drawing 56 priced four Tricoya panels at NEGATIVE area — £211 off the
// cost of a door — because a broken layout (a template’s short transom
// losing its divider references on creation) had squeezed the leaf into a
// 365 mm cell and turned its grid inside out. The layout bug is fixed; this
// is the backstop, because a drawing that takes money off is a failure mode
// of its own.

/**
 * A VISION PANEL’s own stored size, or null if this is not one.
 *
 * Integrate stores `visionPanelWidth` / `visionPanelHeight` on the glass
 * unit inside the panel (ST2: 200 x 350), and `visionPanelRect` draws it
 * from the same two values.
 */
function visionPanelSize(v) {
  const w = Number(v?.visionPanelWidth)
  const h = Number(v?.visionPanelHeight)
  if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return null
  return { width: w, height: h }
}

/** A width or a height that cannot be made. */
export function isDegenerateSize(size) {
  if (!size) return false
  const w = Number(size.width)
  const h = Number(size.height)
  // a size that is not known at all is a different thing, and not this
  // guard’s business: plenty of parts have no size until they are placed
  if (!isFinite(w) || !isFinite(h)) return false
  return w <= 0 || h <= 0
}

const DEGENERATE_TYPES = ['panelPart', 'glassPart']

function fmtMm(v) {
  const n = Number(v)
  return isFinite(n) ? Math.round(n * 10) / 10 : '?'
}

function partTypeLabel(node) {
  return node?.part_type === 'panelPart' ? 'Panel' : 'Glass'
}

/**
 * A label a surveyor can find. The OPENING's own name and matrix position
 * where there is one ("Casement Sash A2"), else the holder it sits in, else
 * the key — which always works and is what the board selects by.
 */
function partLabelFor(tree, node) {
  try {
    const own = openingLabel(tree, node)
    if (own) return own
    const holder = findParentSash(tree, node.key)
    if (holder && holder.part_type !== 'drawingItemPart') {
      const holderLabel = openingLabel(tree, holder)
      if (holderLabel) return `${holderLabel} > ${partTypeLabel(node)}`
    }
  } catch { /* a label is a nicety; the key always works */ }
  return node?.key ?? '?'
}

/**
 * Every panel and glass unit in the tree whose COMPUTED size is <= 0.
 *
 * The same numbers the price lines would have used: it asks
 * `computePartVariables` for the part’s own `_size`, so the guard and the
 * price can never disagree about what a part measures.
 *
 * The board shows these as validation ERRORS (src/validation/validate.js)
 * and the engine prices none of them.
 */
export function degenerateParts(tree, derived = {}, profileValues = {}, glassCatalogue = {}) {
  if (!tree) return []
  const out = []
  for (const type of DEGENERATE_TYPES) {
    for (const node of findAll(tree, type)) {
      let size = null
      try {
        size = computePartVariables(node, tree, derived, {}, glassCatalogue, profileValues)?._size ?? null
      } catch { continue }
      if (!isDegenerateSize(size)) continue
      out.push({
        key: node.key,
        part_type: node.part_type,
        label: partLabelFor(tree, node),
        width: Number(size.width),
        height: Number(size.height),
      })
    }
  }
  return out
}

// ── Line money rounding (Step AD decision 4) ─────────────────────────────────
// Decimal-safe HALF-UP to 2 dp: 0.35 × 58.50 = 20.475 must give Integrate's
// 20.48, but the float product is 20.474999999999998 and a plain
// Math.round lands on 20.47. Snapping the ×100 value to 12 significant
// digits removes the float artefact before the half-up round — the same
// treatment Step Y gave the frame metre rounding.
function round2dpHalfUp(x) {
  if (!isFinite(x)) return 0
  return Math.round(Number((x * 100).toPrecision(12))) / 100
}

// ── Rule evaluation helpers ───────────────────────────────────────────────────

/**
 * Evaluate a labour (manufacture or install) rule line.
 * total_minutes = evaluateNumber(quantity) × evaluateNumber(value)
 */
function evalRuleLine(rule, vars, partNode) {
  // Pre-fill any unknown variable names with 0 to avoid "undefined variable" errors.
  const { vars: safeVars, defaulted: defaulted_vars } = defaultMissingVars(
    [rule.condition, rule.quantity, rule.value], vars
  )

  const line = {
    rule_id:        rule.id,
    rule_family:    rule.rule_family,
    group_name:     rule.group_name ?? null,
    name:           rule.name,
    loop_target:    rule.loop_target ?? null,
    part_key:       partNode?.key       ?? null,
    part_type:      partNode?.part_type ?? null,
    fires:          false,
    quantity:       0,
    value:          0,
    minutes:        0,
    error:          null,
    defaulted_vars,
    condition:      rule.condition,
    quantity_expr:  rule.quantity,
    value_expr:     rule.value,
  }

  try {
    line.fires = evaluateCondition(rule.condition || 'true', safeVars)
  } catch (e) {
    line.error = `condition: ${e.message}`
    return line
  }
  if (!line.fires) return line

  try {
    line.quantity = evaluateNumber(rule.quantity || '0', safeVars)
  } catch (e) {
    line.error = `quantity: ${e.message}`
    return line
  }
  try {
    line.value   = evaluateNumber(rule.value || '0', safeVars)
  } catch (e) {
    line.error = `value: ${e.message}`
    return line
  }
  line.minutes = line.quantity * line.value
  return line
}

/**
 * Evaluate a price rule line.
 * line_total = quantity × value × markup
 */
function evalPriceRuleLine(rule, vars, partNode) {
  // Pre-fill any unknown variable names with 0 to avoid "undefined variable" errors.
  const { vars: safeVars, defaulted: defaulted_vars } = defaultMissingVars(
    [rule.condition, rule.quantity, rule.value], vars
  )

  const line = {
    rule_id:        rule.id,
    rule_family:    rule.rule_family,
    group_name:     rule.group_name ?? null,
    name:           rule.name,
    loop_target:    rule.loop_target ?? null,
    part_key:       partNode?.key       ?? null,
    part_type:      partNode?.part_type ?? null,
    fires:          false,
    quantity:       0,
    value:          0,
    markup:         rule.markup ?? 1,
    line_total:     0,
    error:          null,
    defaulted_vars,
    condition:      rule.condition,
  }

  try {
    line.fires = evaluateCondition(rule.condition || 'true', safeVars)
  } catch (e) {
    line.error = `condition: ${e.message}`
    return line
  }
  if (!line.fires) return line

  try {
    line.quantity   = evaluateNumber(rule.quantity || '0', safeVars)
    line.value      = evaluateNumber(rule.value    || '0', safeVars)
    // Integrate rounds each line independently (no float accumulation error).
    // line_cost  = round(qty × value, 2 dp)  — integer pence
    // line_total = round(qty × value × markup, 2 dp)  — uses raw cost, not rounded cost
    const raw_cost  = line.quantity * line.value
    const markup    = rule.markup ?? 1
    line.line_cost  = round2dpHalfUp(raw_cost)
    line.line_total = round2dpHalfUp(raw_cost * markup)
  } catch (e) {
    line.error = `calc: ${e.message}`
  }
  return line
}

// ── runPricingOnTree ──────────────────────────────────────────────────────────

/**
 * Pure function — takes a pre-built tree and list of rules and returns results.
 * Does NOT touch the database. Used directly by the benchmark page and tests.
 *
 * @param {Object}   tree              - Root parts tree node
 * @param {Array}    rules             - All price_rules rows for the price file
 * @param {Object}   pfVariables       - Price-file variables (scalars)
 * @param {Object}   options
 * @param {boolean}  options.testMode          - If true, include inactive rules
 * @param {Object}   options.glassCatalogue    - { partCode: { cost_per_m2, thickness_mm } }
 * @param {Array}    options.partAllocationRules - Rows from part_allocation_rules (for component loop)
 * @param {Object}   options.partCostMap        - { partCode: costPerUnitOfMeasure } fixture map
 * @param {Array}    options.ironmongeryLines   - Pre-computed default ironmongery lines
 *                                               [{ product_short_name, finish_code, qty }]
 * @param {Object}   options.ironmongeryCatalogue - Variant kit expansion map:
 *                   { 'short_name:finish_code': { cost: kitCost, parts: [{ part_code, part_name, qty, unit_cost }] } }
 * @returns {{ manufacture_labour, install_labour, price, allocated_parts?, error? }}
 */
export function runPricingOnTree(tree, rules, pfVariables = {}, {
  testMode = false,
  glassCatalogue = {},
  partAllocationRules = [],
  partCostMap = {},
  // Step AZ: the drawing's PROFILE CODE. "Utile Section Part" fires only on
  // is_single_and_french_doors_range or is_open_in_doors_range, so without
  // it a door prices no timber at all.
  profileCode = null,
  ironmongeryLines = [],
  ironmongeryCatalogue = {},
  profileValues = {},
} = {}) {
  // profileValues feed the opening layout: a multi-pair frame's mullion
  // thickness is the profile value thicknessInFrameHollow (Step AD).
  const derived  = computeDerived(tree, profileValues)
  const itemVars = computeVariables(tree, derived, pfVariables, { profileCode })
  if (!itemVars) return { error: 'computeVariables returned null', lines: [] }

  // ── Pre-compute item-level sash weight aggregates ─────────────────────────
  // These are computed here (not in computeVariables) because they need glassCatalogue.
  const allTopSashes = findAll(tree, 'topSashPart')
  const allBotSashes = findAll(tree, 'bottomSashPart')
  const allSashes    = [...allTopSashes, ...allBotSashes]

  let weight_of_heaviest_sash_to_be_replaced = 0  // lb
  let sumReplacedSashKg = 0
  let item_nj_weight_in_kg = 0
  const isCordHungItem = itemVars.is_cord_hung ?? false

  for (const sash of allSashes) {
    const sv = sash.values ?? {}
    const toBeReplaced = (itemVars.is_complete_new === true) || (sv.toBeReplaced === true)
    if (!toBeReplaced) continue
    const wt = computeSashWeight(sash, tree, glassCatalogue, profileValues)
    if (wt.weight_in_lb > weight_of_heaviest_sash_to_be_replaced) {
      weight_of_heaviest_sash_to_be_replaced = wt.weight_in_lb
    }
    sumReplacedSashKg += wt.weight_in_kg
  }

  if (itemVars.is_sash_replacement === true) {
    // MEASURED (step-w brief §5, every row within 0.2 lb): sash-replacement
    // item weight = 1.1 × (top + bottom sash weight) — counterweights are
    // NOT in Integrate's item weight.
    item_nj_weight_in_kg = SASH_REPLACEMENT_ITEM_WEIGHT_FACTOR * sumReplacedSashKg
  } else {
    // UNMEASURED for other types of work — the previous behaviour is kept:
    // sashes plus, when cord hung, counterweights equal to each sash weight.
    item_nj_weight_in_kg = isCordHungItem ? 2 * sumReplacedSashKg : sumReplacedSashKg
  }

  const item_nj_weight_in_lb = item_nj_weight_in_kg * 2.20462

  // Price-file variables are available in all expressions
  const baseVars = {
    ...pfVariables,
    ...itemVars,
    weight_of_heaviest_sash_to_be_replaced,
    item_nj_weight_in_kg,
    item_nj_weight_in_lb,
  }

  // ── Run part allocator (if rules supplied) ────────────────────────────────
  // Must run before price pass so the component loop has parts to iterate over.
  let allocatedParts = []
  if (partAllocationRules.length > 0) {
    allocatedParts = allocateParts(tree, baseVars, partAllocationRules, glassCatalogue, false, profileValues)
  }

  // Step AZ: the stock sections a DOOR needs, for the allocated_section_part
  // loop. The material comes from the drawing — doors are utile or Accoya,
  // and Nathan prices Accoya on the utile sections until he supplies Accoya
  // ones. Empty for anything that is not a door.
  // Step AZ: allocated MULTIPOINT-LOCK parts are priced as IRONMONGERY, not
  // as components. Integrate's own lines show it: each is whole pounds x 1.05,
  // which is the "Ironmongery Cost" rule's formula, and a component line
  // would price cost x length x qty with no length at all (a silent zero).
  const ALLOCATED_IRONMONGERY_GROUPS = ['mpls_doors']
  const allocatedIronLines = allocatedParts
    .filter(a => ALLOCATED_IRONMONGERY_GROUPS.includes(a.group))
    .map(a => ({
      product_short_name: a.part_code,
      finish_code: 'n/a',          // a lock part has no finish choice
      qty: a.qty ?? 1,
      source: 'allocated',
      label: a.label ?? a.part_code,
      _allocatedPartCode: a.part_code,
    }))

  const sectionParts = allocatedSectionParts(tree, {
    material: findFirst(tree, 'drawingItemPart')?.values?.sashMaterialId ?? 'utile',
  })

  // Component parts (non-weight groups) for the pricing component loop.
  // Weights are priced via the steel/lead sliding_sash price rules, not the component loop.
  //
  // Merge lines with the same (part_code, label): sum their measures,
  // keep the highest qty.  The label encodes the dimension — e.g.
  // "Parting bead for height" vs "Parting bead for width" — so width
  // and height lines for the same part stay separate.
  //
  // Integrate merges identical lines before costing so one longer length
  // is costed once (avoids per-line rounding differences).
  // Step AV: a drawing may carry a STORED SURROUND LIST, exactly as it may
  // carry a stored ironmongery list (Step Z). Integrate keeps one on every
  // drawing item — its templates fill it, and its price lines use the stored
  // lengths — so a combination casement template brings a "Nosing in Solid
  // Redwood" with it that no rule would have allocated.
  //
  // A stored list REPLACES the allocator's own surrounds, the same way a
  // stored ironmongery list replaces the default lines; everything else the
  // allocator produced is kept. A drawing with no stored list is priced
  // exactly as before, which is why no existing benchmark moves.
  const storedSurrounds = storedSurroundParts(tree)
  const rawComponentParts = (storedSurrounds.length > 0
    ? allocatedParts.filter(a => a.group !== 'surrounds')
    : allocatedParts
  ).filter(a => a.group !== 'sash_weights')
    // Step AZ: the multipoint-lock parts are priced as ironmongery below, so
    // they must not also price as components.
    .filter(a => !ALLOCATED_IRONMONGERY_GROUPS.includes(a.group))
    .concat(storedSurrounds)
  const mergedMap = new Map()
  for (const p of rawComponentParts) {
    const key = `${p.part_code}\x00${p.label}`
    const existing = mergedMap.get(key)
    if (existing) {
      existing.measure += p.measure
      if (p.qty > existing.qty) existing.qty = p.qty
    } else {
      mergedMap.set(key, { ...p })
    }
  }
  const componentParts = [...mergedMap.values()]

  const pricingWarnings = []
  // Step BH follow-up item 2: parts the loop refused to price, by key
  const degenerate = new Map()

  // Option codes the engine depends on but does not recognise must surface
  // as warnings naming the field and the code — never a silent false.
  pricingWarnings.push(...collectVocabularyWarnings(tree))

  // Step AP: a direct glazed unit missing its hidden-in-rebate would price
  // at its visible size, which is quietly too small.
  pricingWarnings.push(...directGlazedWarnings(tree))

  const results = {
    manufacture_labour: { total_minutes: 0, lines: [] },
    install_labour:     { total_minutes: 0, lines: [] },
    price:              { total: 0, lines: [] },
    allocated_parts:    allocatedParts,
    warnings:           pricingWarnings,
  }

  // ── Pass 1 — manufacture_labour ───────────────────────────────────────────
  const mfgRules = rules.filter(
    r => r.rule_family === 'manufacture_labour' && (testMode || r.is_active)
  )
  let mfgMinutes = 0
  for (const rule of mfgRules) {
    const loopParts = getLoopParts(tree, rule.loop_target, baseVars)
    for (const partNode of loopParts) {
      const vars = partNode
        ? { ...baseVars, ...computePartVariables(partNode, tree, derived, baseVars, glassCatalogue, profileValues) }
        : baseVars
      const line = evalRuleLine(rule, vars, partNode)
      if (!line.error && line.fires) mfgMinutes += line.minutes
      results.manufacture_labour.lines.push(line)
    }
  }
  results.manufacture_labour.total_minutes = mfgMinutes

  // Integrate rounds total hours to 2dp before multiplying by hourly rate
  const mfgHours = Math.round((mfgMinutes / 60) * 100) / 100
  const mfgVars = { ...baseVars, std_labour_time: mfgHours }

  // ── Pass 2 — install_labour ───────────────────────────────────────────────
  const instRules = rules.filter(
    r => r.rule_family === 'install_labour' && (testMode || r.is_active)
  )
  let instMinutes = 0
  for (const rule of instRules) {
    const loopParts = getLoopParts(tree, rule.loop_target, mfgVars)
    for (const partNode of loopParts) {
      const vars = partNode
        ? { ...mfgVars, ...computePartVariables(partNode, tree, derived, mfgVars, glassCatalogue, profileValues) }
        : mfgVars
      const line = evalRuleLine(rule, vars, partNode)
      if (!line.error && line.fires) instMinutes += line.minutes
      results.install_labour.lines.push(line)
    }
  }
  results.install_labour.total_minutes = instMinutes

  const instHours = Math.round((instMinutes / 60) * 100) / 100
  const priceVars = { ...mfgVars, installation_labour_time: instHours }

  // ── Pass 3 — price rules (item-level) ─────────────────────────────────────
  const priceRules = rules.filter(
    r => r.rule_family === 'price' && r.level !== 'quote' && (testMode || r.is_active)
  )
  let totalCost  = 0
  let totalPrice = 0
  for (const rule of priceRules) {
    // Component loop: iterate over allocated non-sash-weight parts
    // Variables: cost (unit cost per measure unit), length (measure), qty (allocated qty), part_no
    if (rule.loop_target === 'component') {
      for (const allocPart of componentParts) {
        const unitCost = partCostMap[allocPart.part_code] ?? 0
        // Component measure is in mm; price rules use `length * qty` in metres.
        // See docs/step-ar-addendum-surround-rounding.md for how Integrate
        // rounds a SURROUND length, and why every other component still
        // ceils to the next 0.1 m.
        const lengthMetres = componentLengthMetres(allocPart.measure, allocPart.group)
        const compVars = {
          ...priceVars,
          cost:      unitCost,
          length:    lengthMetres,
          qty:       allocPart.qty,
          part_no:   allocPart.part_code,
          part_name: allocPart.label,
        }
        const line = evalPriceRuleLine(rule, compVars, null)
        line.alloc_part_code = allocPart.part_code
        line.alloc_label     = allocPart.label
        if (!line.error && line.fires) { totalCost += line.line_cost; totalPrice += line.line_total }
        results.price.lines.push(line)
      }
      continue
    }

    // Ironmongery loop: expand each ironmongery line to its variant kit lines.
    // Variables: cost (part unit_cost), qty (effective = kit_line.qty × iron_line.qty),
    //            part_name (part description), part_no (part_code).
    // If the variant has no kit lines (unknown cost), use the kit cost directly (qty=1).
    // loop_target may be stored as 'ironmongery_part' or 'ironmongery part' (rules export uses spaces).
    if (rule.loop_target === 'ironmongery_part' || rule.loop_target === 'ironmongery part') {
      for (const ironLine of [...ironmongeryLines, ...allocatedIronLines]) {
        // Step Z: a line whose finish could not be resolved (no line finish,
        // no item finish, no profile default) is NEVER priced as a £0 line —
        // it is skipped here and warned about by name in the warnings pass.
        if (ironLine.finish_code == null || ironLine.finish_code === '') continue
        // An ALLOCATED part is a single part with a single cost — it has no
        // finish variant and no kit, so its cost comes from the part cost
        // map the way a component's does.
        if (ironLine._allocatedPartCode) {
          const cost = partCostMap[ironLine._allocatedPartCode] ?? 0
          const ironVars = {
            ...priceVars,
            cost,
            qty:       ironLine.qty,
            part_name: ironLine.label,
            part_no:   ironLine._allocatedPartCode,
          }
          const line = evalPriceRuleLine(rule, ironVars, null)
          line.alloc_iron_part_code  = ironLine._allocatedPartCode
          line.alloc_iron_short_name = ironLine._allocatedPartCode
          line.alloc_label           = ironLine.label
          if (!line.error && line.fires) { totalCost += line.line_cost; totalPrice += line.line_total }
          results.price.lines.push(line)
          continue
        }
        const variantKey  = `${ironLine.product_short_name}:${ironLine.finish_code}`
        const variant     = ironmongeryCatalogue[variantKey] ?? null
        const kitParts    = variant?.parts ?? []

        if (kitParts.length === 0) {
          // No kit line data — use the kit cost as a single lump line
          const kitCost = variant?.cost ?? 0
          const ironVars = {
            ...priceVars,
            cost:      kitCost,
            qty:       ironLine.qty,
            part_name: ironLine.product_short_name,
            part_no:   '',
          }
          const line = evalPriceRuleLine(rule, ironVars, null)
          line.alloc_iron_short_name = ironLine.product_short_name
          line.alloc_iron_finish     = ironLine.finish_code
          line.alloc_iron_finish_source = ironLine.finish_source ?? null
          line.alloc_label           = ironmongeryLineLabel(ironLine)
          line.alloc_iron_kit_cost   = kitCost
          if (!line.error && line.fires) { totalCost += line.line_cost; totalPrice += line.line_total }
          results.price.lines.push(line)
        } else {
          for (const kitLine of kitParts) {
            const effectiveQty = (kitLine.qty ?? 1) * (ironLine.qty ?? 1)
            const partUnitCost = kitLine.unit_cost ?? 0
            const ironVars = {
              ...priceVars,
              cost:      partUnitCost,
              qty:       effectiveQty,
              part_name: kitLine.part_name ?? kitLine.part_code,
              part_no:   kitLine.part_code,
            }
            const line = evalPriceRuleLine(rule, ironVars, null)
            line.alloc_iron_short_name = ironLine.product_short_name
            line.alloc_iron_finish     = ironLine.finish_code
            line.alloc_iron_finish_source = ironLine.finish_source ?? null
            line.alloc_label           = ironmongeryLineLabel(ironLine)
            line.alloc_iron_part_code  = kitLine.part_code
            if (!line.error && line.fires) { totalCost += line.line_cost; totalPrice += line.line_total }
            results.price.lines.push(line)
          }
        }
      }
      continue
    }

    // Step AZ: the ALLOCATED SECTION loop. A door carries no timber volume;
    // Integrate allocates lengths of utile stock section and prices them per
    // metre through the live rule "Utile Section Part" (qty length_in_m,
    // value purchase_cost). Nothing fed this loop before, so a door priced
    // no timber at all.
    //
    // length_in_m is mm / 1000 UNROUNDED — the line itself rounds to 2 dp,
    // which is what makes FD1's 6.297 m of 67x96 come to 85.64 and not
    // 85.68 (6.30 x 13.60).
    if (rule.loop_target === 'allocated_section_part' ||
        rule.loop_target === 'allocated section part') {
      for (const section of sectionParts) {
        const sectionVars = {
          ...priceVars,
          part_name:     section.part_name,
          part_no:       section.part_code,
          length_in_m:   section.length_in_m,
          length_in_mm:  section.length_mm,
          purchase_cost: partCostMap[section.part_code] ?? 0,
          // Integrate writes the MATERIAL as a bare token in the rule's
          // condition — contains(part_name, utile) — which expr-eval reads
          // as a variable, so each material word is supplied as a string
          // holding itself. Doors are utile or Accoya only.
          utile:   'utile',
          accoya:  'accoya',
          cost:          partCostMap[section.part_code] ?? 0,
          qty:           1,
        }
        const line = evalPriceRuleLine(rule, sectionVars, null)
        line.alloc_part_code = section.part_code
        line.alloc_label     = `${section.part_name} — ${section.label}`
        if (!line.error && line.fires) { totalCost += line.line_cost; totalPrice += line.line_total }
        results.price.lines.push(line)
      }
      continue
    }

    // Normal tree-based loop (glass_unit gated per sash — Step AH)
    const loopParts = getLoopParts(tree, rule.loop_target, priceVars)
    for (const partNode of loopParts) {
      const vars = partNode
        ? { ...priceVars, ...computePartVariables(partNode, tree, derived, priceVars, glassCatalogue, profileValues) }
        : priceVars
      // Step BH follow-up item 2: a part whose computed size is not a real
      // size does not price AT ALL. Live drawing 56 took £211 OFF a door
      // in negative Tricoya panels, because a broken layout had turned its
      // grid inside out. The layout bug is fixed; this is the backstop, and
      // it is a skip WITH A WARNING, never a silent drop.
      if (isDegenerateSize(vars._size)) {
        degenerate.set(partNode.key, { node: partNode, size: vars._size })
        continue
      }
      const line = evalPriceRuleLine(rule, vars, partNode)
      if (!line.error && line.fires) { totalCost += line.line_cost; totalPrice += line.line_total }
      results.price.lines.push(line)
    }
  }
  results.price.total_cost = totalCost
  results.price.total      = totalPrice

  // ── Warnings for missing catalogue codes ──────────────────────────────────
  // Glass: check every glassPart's part numbers against the catalogue
  const allGlassParts = findAll(tree, 'glassPart')
  for (const gp of allGlassParts) {
    const gv = gp.values ?? {}
    if (gv.internalGlassPartNo && !glassCatalogue[gv.internalGlassPartNo]) {
      pricingWarnings.push(`Glass code not found in catalogue: ${gv.internalGlassPartNo} (internal pane)`)
    }
    if (gv.externalGlassPartNo && !glassCatalogue[gv.externalGlassPartNo]) {
      pricingWarnings.push(`Glass code not found in catalogue: ${gv.externalGlassPartNo} (external pane)`)
    }
    if (gv.singleGlassPartNo && !glassCatalogue[gv.singleGlassPartNo]) {
      pricingWarnings.push(`Glass code not found in catalogue: ${gv.singleGlassPartNo} (single pane)`)
    }
  }
  // Step BH follow-up item 2: say which parts were left out, and why.
  for (const { node, size } of degenerate.values()) {
    pricingWarnings.push(
      `${partTypeLabel(node)} ${partLabelFor(tree, node)} has no usable size ` +
      `(${fmtMm(size?.width)} x ${fmtMm(size?.height)} mm) and cannot be priced ` +
      '— check the layout')
  }

  // Components: check allocated part codes against the cost map
  for (const ap of componentParts) {
    if (ap.part_code && !(ap.part_code in partCostMap)) {
      pricingWarnings.push(`Part code not found in cost map: ${ap.part_code} (${ap.label || 'unknown'})`)
    }
  }
  // Ironmongery: check each line's variant key against the catalogue
  for (const il of ironmongeryLines) {
    // A line with no resolvable finish was skipped by the pricing loop —
    // name it here so it is a visible warning, never a silent omission
    if (il.finish_code == null || il.finish_code === '') {
      pricingWarnings.push(`Ironmongery line has no finish: ${il.product_short_name} — set the item's Ironmongery Finish (or a finish on the line); the line is NOT priced`)
      continue
    }
    const key = `${il.product_short_name}:${il.finish_code}`
    const variant = ironmongeryCatalogue[key]
    if (!variant) {
      pricingWarnings.push(`Ironmongery product not found: ${il.product_short_name} (${il.finish_code})`)
      continue
    }
    // A kit line whose part has no catalogue cost prices at 0 — that must
    // surface as a warning, never as a silent zero. Step AO: a unit_cost of
    // exactly 0 is the same silent zero, and the snapshot has real examples
    // (every part of kenrick_extension_gear_box:PC is 0 while the SET costs
    // 7.35), so it warns too and names the set's own cost.
    for (const kl of (variant.parts ?? [])) {
      if (kl.unit_cost == null || Number(kl.unit_cost) === 0) {
        pricingWarnings.push(
          `Ironmongery part cost not found: ${kl.part_code} (${il.product_short_name})` +
          ` — the line prices at 0` +
          (variant.cost ? `, though the set itself costs ${variant.cost}` : ''))
      }
    }
  }

  return results
}

// ── priceDrawing ──────────────────────────────────────────────────────────────

/**
 * Run all passes for a single drawing and persist the results.
 *
 * @param {string} drawingId
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ priceFileId?: string }} [options]
 * @returns {Promise<{ success: boolean, calculatedPrice?: number, pricingRunId?: string, error?: string }>}
 */
export async function priceDrawing(drawingId, supabase, { priceFileId } = {}) {
  let pricingRunId = null

  try {
    // ── 1. Load parts tree ────────────────────────────────────────────────────
    const tree = await loadDrawingParts(drawingId)
    if (!tree) throw new Error(`No drawing parts found for drawing ${drawingId}`)

    // ── 2. Resolve price file ─────────────────────────────────────────────────
    // Use the provided priceFileId if given; otherwise the current (is_current = true);
    // finally fall back to the published (status = 'published').
    let resolvedPriceFileId = priceFileId
    if (!resolvedPriceFileId) {
      const { data: pfCurrent } = await supabase
        .from('price_files').select('id').eq('is_current', true).maybeSingle()
      resolvedPriceFileId = pfCurrent?.id
    }
    if (!resolvedPriceFileId) {
      const { data: pfPublished } = await supabase
        .from('price_files').select('id').eq('status', 'published').maybeSingle()
      resolvedPriceFileId = pfPublished?.id
    }
    if (!resolvedPriceFileId) throw new Error('No price file found (is_current or published)')

    // ── 3. Load full pricing context via shared loader ───────────────────────
    const ctx = await loadPricingContext(supabase, resolvedPriceFileId)
    const { rules: allRules, pfVariables, glassCatalogue, partAllocationRules,
            partCostMap, ironmongeryCatalogue } = ctx

    // ── 4. Load profile values for glass cut size (rebate width + tolerance) ─
    // Loaded BEFORE the ironmongery resolution: the measured sash-weight
    // model needs the profile rebate/tolerance, and default-ironmongery
    // rules evaluate per-sash weight variables.
    const { data: drawingRow } = await supabase
      .from('drawings')
      .select('default_profile_id')
      .eq('id', drawingId)
      .maybeSingle()
    // ── 4a. The profile CODE, not just its values ────────────────────────────
    // Step AZ hotfix: this was missing, and it cost a live French door every
    // one of its timber lines. computeVariables derives
    // is_single_and_french_doors_range, is_open_in_doors_range and
    // is_replacement_sashes_range from the code ALONE, so without it all
    // three were false on every drawing priced here — and the live rule
    // "Utile Section Part" is conditioned on the first two. Every test and
    // the benchmark page passed the code explicitly, which is why nothing
    // caught it; the stored variable snapshot said `false` on a drawing whose
    // profile is open_out_doors.
    //
    // Read with the INJECTED client rather than api.js's loadDrawingProfileCode,
    // because this function takes its Supabase client as an argument — and it
    // returns null rather than throwing, as that helper does: a drawing whose
    // profile row cannot be read must still price, with the flags false.
    let profileCode = null
    if (drawingRow?.default_profile_id) {
      const { data: profRow, error: profErr } = await supabase
        .from('default_profiles')
        .select('code')
        .eq('id', drawingRow.default_profile_id)
        .maybeSingle()
      if (profErr) console.warn('[priceDrawing] profile code lookup failed:', profErr.message)
      profileCode = profRow?.code ?? null
    }

    let profileValues = {}
    if (drawingRow?.default_profile_id) {
      const { data: pvRows, error: pvErr } = await supabase
        .from('default_profile_values')
        .select('field_key, default_value')
        .eq('profile_id', drawingRow.default_profile_id)
      if (pvErr) throw new Error(`Failed to load profile values: ${pvErr.message}`)
      for (const pv of (pvRows || [])) {
        // Profile values are stored as strings; convert numeric ones
        const n = Number(pv.default_value)
        profileValues[pv.field_key?.split('.')?.pop() ?? pv.field_key] = isNaN(n) ? pv.default_value : n
      }
    }

    // ── 4b. Resolve ironmongery lines ────────────────────────────────────────
    const ironmongeryLines = resolveIronmongeryLines(tree, ctx, profileValues, { profileCode })

    // ── 5. Create pricing_runs row ────────────────────────────────────────────
    const currentTreeHash = treeHash(tree)

    // Who ran it — shown in the Price breakdown view. public.users rows are
    // matched by EMAIL throughout the app (useCurrentUser, templates.js,
    // QuoteMatrixPage): public.users.id is NOT the auth uid, which is why a
    // created_by recorded as the auth uid resolved to no users row and the
    // breakdown showed "Run by: —". Store the public.users id; when there is
    // no matching row, record null — never invent one.
    let runUserId = null
    {
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr) console.warn('[priceDrawing] auth.getUser failed:', authErr.message)
      const authEmail = authData?.user?.email ?? null
      if (authEmail) {
        const { data: userRow, error: userErr } = await supabase
          .from('users').select('id').eq('email', authEmail).maybeSingle()
        if (userErr) console.warn('[priceDrawing] users lookup failed:', userErr.message)
        runUserId = userRow?.id ?? null
      }
    }

    const { data: pricingRun, error: runErr } = await supabase
      .from('pricing_runs')
      .insert({
        drawing_id:     drawingId,
        price_file_id:  resolvedPriceFileId,
        status:         'in_progress',
        tree_hash:      currentTreeHash,
        created_at:     new Date().toISOString(),
        created_by:     runUserId,
        engine_version: PRICING_ENGINE_VERSION,
      })
      .select('id')
      .single()

    if (runErr || !pricingRun) {
      throw new Error(`Failed to create pricing_run: ${runErr?.message ?? 'unknown'}`)
    }

    pricingRunId = pricingRun.id

    // ── 6. Run pricing engine ─────────────────────────────────────────────────
    const engineResults = runPricingOnTree(tree, allRules, pfVariables, {
      glassCatalogue,
      partAllocationRules,
      partCostMap,
      ironmongeryLines,
      ironmongeryCatalogue,
      profileValues,
      profileCode,
    })

    if (engineResults.error) {
      throw new Error(engineResults.error)
    }

    // ── 7. Collect variables snapshot from the engine run ─────────────────────
    const derived  = computeDerived(tree, profileValues)
    // The snapshot takes the profile code too: this is the row the reviewer
    // read `is_single_and_french_doors_range: false` off, and a snapshot that
    // disagrees with the run it belongs to is worse than no snapshot.
    const variables = computeVariables(tree, derived, pfVariables, { profileCode }) ?? {}
    variables.std_labour_time          = engineResults.manufacture_labour.total_minutes / 60
    variables.installation_labour_time = engineResults.install_labour.total_minutes / 60
    variables.total_manufacture_minutes = engineResults.manufacture_labour.total_minutes
    variables.total_install_minutes     = engineResults.install_labour.total_minutes

    // ── 8. Write manufacture_labour results ────────────────────────────────────
    const mfgResultRows = engineResults.manufacture_labour.lines
      .filter(l => l.fires && !l.error)
      .map(l => ({
        drawing_id:       drawingId,
        price_file_id:    resolvedPriceFileId,
        pricing_run_id:   pricingRunId,
        price_rule_id:    l.rule_id,
        loop_target_type: l.loop_target,
        loop_index:       null,
        cost:             l.minutes,
        sales:            null,
        markup_applied:   null,
      }))

    if (mfgResultRows.length > 0) {
      const { error: mfgInsErr } = await supabase
        .from('drawing_rule_results')
        .insert(mfgResultRows)
      if (mfgInsErr) throw new Error(`Failed to write manufacture_labour results: ${mfgInsErr.message}`)
    }

    // ── 9. Write install_labour results ───────────────────────────────────────
    const instResultRows = engineResults.install_labour.lines
      .filter(l => l.fires && !l.error)
      .map(l => ({
        drawing_id:       drawingId,
        price_file_id:    resolvedPriceFileId,
        pricing_run_id:   pricingRunId,
        price_rule_id:    l.rule_id,
        loop_target_type: l.loop_target,
        loop_index:       null,
        cost:             l.minutes,
        sales:            null,
        markup_applied:   null,
      }))

    if (instResultRows.length > 0) {
      const { error: instInsErr } = await supabase
        .from('drawing_rule_results')
        .insert(instResultRows)
      if (instInsErr) throw new Error(`Failed to write install_labour results: ${instInsErr.message}`)
    }

    // ── 10. Handle parts rules (pass 0c) ──────────────────────────────────────
    const partsRules = (allRules || []).filter(r => r.rule_family === 'parts' && r.is_active)

    if (partsRules.length > 0) {
      const { data: pfParts, error: pfPartsErr } = await supabase
        .from('price_file_parts')
        .select('part_code, part_name, unit_cost')
        .eq('price_file_id', resolvedPriceFileId)

      if (pfPartsErr) throw new Error(`Failed to fetch price_file_parts: ${pfPartsErr.message}`)

      const partsMap = Object.fromEntries((pfParts || []).map(p => [p.part_code, p]))
      const allVarsForParts = { ...pfVariables, ...variables }

      let totalPartsCost   = 0
      const allocatedRows  = []

      for (const rule of partsRules) {
        let fires
        try { fires = evaluateCondition(rule.condition || 'true', allVarsForParts) }
        catch (e) { console.warn(`[priceDrawing] parts rule "${rule.name}" condition error:`, e.message); continue }
        if (!fires) continue

        let qty
        try { qty = evaluateNumber(rule.quantity || '0', allVarsForParts) }
        catch (e) { console.warn(`[priceDrawing] parts rule "${rule.name}" quantity error:`, e.message); continue }

        const part = partsMap[rule.part_code]
        if (!part) { console.warn(`[priceDrawing] part not found: ${rule.part_code}`); continue }

        const totalCost = qty * part.unit_cost
        totalPartsCost += totalCost

        allocatedRows.push({
          drawing_id:     drawingId,
          price_file_id:  resolvedPriceFileId,
          pricing_run_id: pricingRunId,
          price_rule_id:  rule.id,
          part_code:      part.part_code,
          part_name:      part.part_name,
          unit_cost:      part.unit_cost,
          quantity:       qty,
          total_cost:     totalCost,
        })
      }

      variables.total_parts_cost = totalPartsCost

      if (allocatedRows.length > 0) {
        const { error: partsInsErr } = await supabase
          .from('drawing_allocated_parts')
          .insert(allocatedRows)
        if (partsInsErr) throw new Error(`Failed to write allocated parts: ${partsInsErr.message}`)
      }
    }

    // ── 11. Write price results ────────────────────────────────────────────────
    let calculatedPrice = engineResults.price.total
    const priceResultRows = engineResults.price.lines
      .filter(l => l.fires && !l.error)
      .map(l => ({
        drawing_id:       drawingId,
        price_file_id:    resolvedPriceFileId,
        pricing_run_id:   pricingRunId,
        price_rule_id:    l.rule_id,
        loop_target_type: l.loop_target,
        loop_index:       null,
        // line_cost is round(qty × value, 2) per line — the same per-line
        // rounding pricing_runs.total_cost is summed from. Storing the raw
        // product here made the breakdown table's TOTAL drift pennies from
        // the run header (e.g. £920.64 vs £920.66): the header figure
        // (pricing_runs.total_cost) is the one stored on the run, and rows
        // now sum to it exactly.
        cost:             l.line_cost,
        sales:            l.line_total,
        markup_applied:   l.markup,
        // Detail for the Price breakdown view (sql/step-t1-price-breakdown.sql).
        // Same values the benchmark table displays: quantity, value, the
        // per-line label (component alloc label) and the loop part reference.
        quantity:         l.quantity,
        value:            l.value,
        part_label:       l.alloc_label ?? null,
        part_code:        l.alloc_part_code ?? l.alloc_iron_part_code ?? l.part_type ?? null,
      }))

    if (priceResultRows.length > 0) {
      const { error: priceInsErr } = await supabase
        .from('drawing_rule_results')
        .insert(priceResultRows)
      if (priceInsErr) throw new Error(`Failed to write price results: ${priceInsErr.message}`)
    }

    // ── 12. Write calculated_price to drawings ────────────────────────────────
    const { error: calcErr } = await supabase
      .from('drawings')
      .update({ calculated_price: calculatedPrice })
      .eq('id', drawingId)

    if (calcErr) throw new Error(`Failed to update drawings.calculated_price: ${calcErr.message}`)

    // ── 13. Write full variable snapshot ──────────────────────────────────────
    const { error: varErr } = await supabase
      .from('drawing_pricing_variables')
      .insert({
        pricing_run_id: pricingRunId,
        drawing_id:     drawingId,
        price_file_id:  resolvedPriceFileId,
        variables,
      })

    if (varErr) throw new Error(`Failed to write drawing_pricing_variables: ${varErr.message}`)

    // ── 14. Mark pricing_run complete ─────────────────────────────────────────
    // total_cost/total_sales are the price-rule-only totals the engine
    // already computed (engineResults.price never includes labour-minutes
    // rows — see runPricingOnTree passes 1-2 vs pass 3) — persisted here so
    // readers never need to re-derive them by summing drawing_rule_results
    // themselves (which, without filtering, double-counts labour minutes
    // as cost). See src/quotes/drawingRunPrice.js.
    await supabase
      .from('pricing_runs')
      .update({
        status:      'complete',
        total_cost:  engineResults.price.total_cost,
        total_sales: engineResults.price.total,
        // Warnings are stored with the run so the Price breakdown view can
        // show exactly what this run reported, not a fresh calculation.
        warnings:    engineResults.warnings ?? [],
      })
      .eq('id', pricingRunId)

    return { success: true, calculatedPrice, pricingRunId }

  } catch (err) {
    console.error('[priceDrawing] error:', err)

    if (pricingRunId) {
      await supabase
        .from('pricing_runs')
        .update({ status: 'failed' })
        .eq('id', pricingRunId)
        .catch(e => console.error('[priceDrawing] failed to mark run as failed:', e))
    }

    return { success: false, error: err.message }
  }
}

// ── priceQuote ────────────────────────────────────────────────────────────────

/**
 * Evaluate quote-level rules and apportion their cost and sales values
 * across drawings proportionally by each drawing's latest-run price.
 *
 * IMPORTANT: priceQuote never reads or writes drawings.calculated_price.
 * The source of truth for a drawing's price is its latest completed
 * pricing run (sum of drawing_rule_results.sales for that run).
 * Quote-level apportionment is stored in quote_item_apportionment and
 * read by the UI separately.
 *
 * @param {string} quoteId
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ priceFileId?: string }} [options]
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function priceQuote(quoteId, supabase, { priceFileId } = {}) {
  let quotePricingRunId = null

  try {
    // ── 1. Fetch drawing ids on this quote ──────────────────────────────────
    const { data: qdRows, error: qdErr } = await supabase
      .from('quote_drawings')
      .select('drawing_id')
      .eq('quote_id', quoteId)

    if (qdErr) throw new Error(`Failed to fetch quote_drawings: ${qdErr.message}`)

    const drawingIds = (qdRows || []).map(row => row.drawing_id)

    // ── 2. Drawing-level prices from latest completed runs ──────────────────
    // Read from drawing_rule_results so we never depend on
    // drawings.calculated_price (which may have been corrupted by an older
    // version of priceQuote that wrote back to it).
    const NJ_TYPES_OF_WORK = ['complete_new', 'new_pair_of_sashes']
    let nj_item_qty = 0
    const drawingLevelPrice = {} // String(drawingId) → sales total

    if (drawingIds.length > 0) {
      // Paginated: run history grows without bound, and a newest-1,000 cap
      // could hide a drawing's latest run (src/lib/fetchAllRows.js)
      const runRows = await fetchAllRows(
        () => supabase
          .from('pricing_runs')
          .select('id, drawing_id')
          .in('drawing_id', drawingIds)
          .eq('status', 'complete')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false }),
        'pricing_runs'
      )

      const latestRunId = {}
      for (const r of (runRows || [])) {
        const key = String(r.drawing_id)
        if (!latestRunId[key]) latestRunId[key] = r.id
      }
      const runIds = Object.values(latestRunId)

      if (runIds.length > 0) {
        // nj_item_qty from drawing_pricing_variables
        const { data: varRows } = await supabase
          .from('drawing_pricing_variables')
          .select('drawing_id, variables')
          .in('pricing_run_id', runIds)

        for (const v of (varRows || [])) {
          if (NJ_TYPES_OF_WORK.includes(v.variables?.typeOfWork)) nj_item_qty++
        }

        // Drawing-level sales from drawing_rule_results
        const { data: ruleRows } = await supabase
          .from('drawing_rule_results')
          .select('drawing_id, sales')
          .in('pricing_run_id', runIds)

        for (const r of (ruleRows || [])) {
          const key = String(r.drawing_id)
          drawingLevelPrice[key] = (drawingLevelPrice[key] || 0) + (Number(r.sales) || 0)
        }
      }
    }

    const drawings = drawingIds.map(id => ({
      drawing_id:          id,
      drawing_level_price: drawingLevelPrice[String(id)] || 0,
    }))

    const quoteTotal = drawings.reduce((sum, d) => sum + d.drawing_level_price, 0)
    // items_net_value = sum of included items' net sales, ex VAT, before
    // quote-level rules and before the quote discount — equals quoteTotal here.
    const items_net_value = quoteTotal

    // ── 3. Resolve price file ───────────────────────────────────────────────
    let resolvedPriceFileId = priceFileId
    if (!resolvedPriceFileId) {
      const { data: pfCurrent } = await supabase
        .from('price_files').select('id').eq('is_current', true).maybeSingle()
      resolvedPriceFileId = pfCurrent?.id
    }
    if (!resolvedPriceFileId) {
      const { data: pfPublished } = await supabase
        .from('price_files').select('id').eq('status', 'published').maybeSingle()
      resolvedPriceFileId = pfPublished?.id
    }
    if (!resolvedPriceFileId) throw new Error('No price file found (is_current or published)')

    const priceFile = { id: resolvedPriceFileId }

    // ── 4. Create quote_pricing_runs row ────────────────────────────────────
    const { data: qRun, error: qrErr } = await supabase
      .from('quote_pricing_runs')
      .insert({
        quote_id:      quoteId,
        price_file_id: priceFile.id,
        status:        'in_progress',
        created_at:    new Date().toISOString(),
      })
      .select('id')
      .single()

    if (qrErr || !qRun) {
      throw new Error(`Failed to create quote_pricing_run: ${qrErr?.message ?? 'unknown'}`)
    }

    quotePricingRunId = qRun.id

    // ── 5. Fetch active quote-level rules ───────────────────────────────────
    const { data: quoteRules, error: qrulesErr } = await supabase
      .from('price_rules')
      .select('id, name, condition, quantity, value, markup')
      .eq('price_file_id', priceFile.id)
      .eq('rule_family', 'price')
      .eq('level', 'quote')
      .eq('is_active', true)
      .order('sort_order')

    if (qrulesErr) throw new Error(`Failed to fetch quote rules: ${qrulesErr.message}`)

    const quoteVariables = { quote_total: quoteTotal, items_net_value, nj_item_qty }

    // ── 6. Evaluate each rule, write quote_rule_results, then apportion ─────
    for (const rule of (quoteRules || [])) {
      let fires
      try { fires = evaluateCondition(rule.condition || 'true', quoteVariables) }
      catch (e) {
        console.warn(`[priceQuote] rule "${rule.name}" condition error:`, e.message)
        continue
      }

      if (!fires) continue

      let quantityResult, valueResult
      try { quantityResult = evaluateNumber(rule.quantity || '0', quoteVariables) }
      catch (e) { throw new Error(`Rule "${rule.name}" quantity error: ${e.message}`) }

      try { valueResult = evaluateNumber(rule.value || '0', quoteVariables) }
      catch (e) { throw new Error(`Rule "${rule.name}" value error: ${e.message}`) }

      const cost      = quantityResult * valueResult
      const markup    = rule.markup ?? 1
      const ruleSales = cost * markup

      const { data: qrResult, error: qrInsErr } = await supabase
        .from('quote_rule_results')
        .insert({
          quote_id:             quoteId,
          price_file_id:        priceFile.id,
          quote_pricing_run_id: quotePricingRunId,
          price_rule_id:        rule.id,
          cost,
          sales:                ruleSales,
          markup_applied:       markup,
        })
        .select('id')
        .single()

      if (qrInsErr || !qrResult) {
        throw new Error(`Failed to write quote_rule_result for rule ${rule.id}: ${qrInsErr?.message ?? 'unknown'}`)
      }

      const quoteRuleResultId = qrResult.id
      const apportionmentRows = []

      for (const drawing of drawings) {
        const weight     = quoteTotal > 0 ? drawing.drawing_level_price / quoteTotal : 0
        const costShare  = weight * cost
        const salesShare = weight * ruleSales

        apportionmentRows.push({
          quote_rule_result_id: quoteRuleResultId,
          quote_pricing_run_id: quotePricingRunId,
          drawing_id:           drawing.drawing_id,
          cost:                 costShare,
          sales:                salesShare,
        })
      }

      if (apportionmentRows.length > 0) {
        const { error: apErr } = await supabase
          .from('quote_item_apportionment')
          .insert(apportionmentRows)
        if (apErr) throw new Error(`Failed to write quote_item_apportionment for rule ${rule.id}: ${apErr.message}`)
      }
    }

    // ── 7. Mark quote_pricing_run complete ──────────────────────────────────
    // NOTE: priceQuote does NOT update drawings.calculated_price.
    // The apportionment is stored in quote_item_apportionment and the UI
    // reads it separately to compute the item net for a quote.
    await supabase
      .from('quote_pricing_runs')
      .update({ status: 'complete' })
      .eq('id', quotePricingRunId)

    return { success: true }

  } catch (err) {
    console.error('[priceQuote] error:', err)

    if (quotePricingRunId) {
      await supabase
        .from('quote_pricing_runs')
        .update({ status: 'failed' })
        .eq('id', quotePricingRunId)
        .catch(e => console.error('[priceQuote] failed to mark run as failed:', e))
    }

    return { success: false, error: err.message }
  }
}
