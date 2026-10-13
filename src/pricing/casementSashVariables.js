/**
 * casementSashVariables.js
 * THE per-sash variables for a casement sash — one function, used by BOTH
 * the default-ironmongery rules and the validation rules, so the two can
 * never disagree about the same sash.
 *
 * Step AS: these variables were built inside `computePartVars` in
 * defaultIronmongery.js, where only the ironmongery rules could reach them.
 * Validation looped a casement-sash rule over the right parts but had no
 * casement variables at all: `width` and `height` came out undefined (a
 * casement sash stores neither — its size comes from its opening), and
 * `is_fanlight`, `gross_bottom_rail_height_in_mm` and the rest did not
 * exist. Every casement-sash rule was therefore imported switched off.
 *
 * Integrate's conventions, from docs/integrate-validation-active-flags.txt:
 *  - `width` / `height` are in METRES (rule 46 reads `width <= 0.31`), while
 *    the `gross_*_in_mm` variables are in millimetres (rules 123/124/125);
 *  - `gross_bottom_rail_height_in_mm` is the DRAWN bottom rail. Proved live
 *    on Q: the fanlight warning fires at 83 and clears at exactly 62, and
 *    the price moves £1.20 with it.
 */

import { casementSashSize, casementSashWeightKg } from './casementGeometry.js'
import { casementIsFixed } from './optionVocabulary.js'
import { openingTypeLabel, isStormproofSash } from '../drawingBoard/casementOpenings.js'

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

function num(v, def = 0) {
  const n = Number(v)
  return isFinite(n) ? n : def
}

/**
 * Is this sash a FANLIGHT? The board's own rule — the top row of a frame
 * with more than one row — so the Explorer's label and the validation check
 * can never disagree about the same sash.
 */
export function isFanlightSash(tree, sashNode) {
  return openingTypeLabel(tree, sashNode) === 'Fanlight'
}

/**
 * Every variable a casement sash contributes, for ironmongery AND validation.
 *
 * @param {Object} tree
 * @param {Object} sashNode        a casementSashPart
 * @param {Object} [baseVars]      the item-level variables (for is_complete_new)
 * @param {Object} [glassCatalogue] needed by weight_in_kg; see `weightKnown`
 * @returns {Object} the variables, plus a non-enumerable-free `weightKnown`
 *                   flag callers can use to refuse to evaluate a weight rule
 */
export function casementSashVariables(tree, sashNode, baseVars = {}, glassCatalogue = null) {
  const v = sashNode?.values ?? {}
  const size = casementSashSize(tree, sashNode)
  const op = String(v.operation ?? '').toLowerCase()
  const paint = findFirst(tree, 'paintAndIronmongeryPart')
  const item  = findFirst(tree, 'drawingItemPart')

  const is_complete_new = baseVars.is_complete_new ?? false
  const to_be_replaced  = is_complete_new || v.toBeReplaced === true

  // weight_in_kg needs the glass catalogue to weigh the glass. A caller
  // without one must NOT get a quiet 0 — rule 120 ("over 45 kg") would then
  // pass on every sash. `weightKnown` lets validation mark such a rule
  // unevaluable instead.
  const weightKnown = glassCatalogue != null
  const weight_in_kg = weightKnown
    ? casementSashWeightKg(tree, sashNode, glassCatalogue)
    : undefined

  const gross_sash_width_in_mm  = size.width  ?? 0
  const gross_sash_height_in_mm = size.height ?? 0

  return {
    weightKnown,

    // ── What the ironmongery rules read (unchanged from Step AP) ──────────
    to_be_replaced,
    is_opening:   !casementIsFixed(sashNode),
    // A side-hung casement is left or right hand hung; top/bottom hung are
    // their own operations (Integrate 15 / 16).
    is_side_hung: op.includes('left_hand') || op.includes('right_hand'),
    is_top_hung:    op.includes('top_hung'),
    is_bottom_hung: op.includes('bottom_hung'),
    is_left_hand_hung_viewed_internally:  op.includes('left_hand'),
    is_right_hand_hung_viewed_internally: op.includes('right_hand'),
    is_french_casement_sash: v.isFrenchCasement === true,
    // Casements are multipoint by default (Nathan, 9 Oct); the surveyor
    // unticks "Casement MPLS" on Finish & Ironmongery. An older drawing with
    // neither field stored is treated as multipoint, which is the default.
    is_casement_mpls: (paint?.values?.isCasementMpls ?? v.isMpls ?? true) === true,
    gross_sash_width_in_mm,
    gross_sash_height_in_mm,
    ...(weightKnown ? { weight_in_kg } : {}),

    // ── What the validation rules add ────────────────────────────────────
    // Integrate's width/height on a casement sash are its GROSS size in
    // METRES (rule 46: `width <= 0.31`). These must override validate.js's
    // generic `part.values.width / 1000` alias, which is undefined here
    // because a casement sash stores no width or height of its own.
    width:  gross_sash_width_in_mm  / 1000,
    height: gross_sash_height_in_mm / 1000,

    is_fanlight: isFanlightSash(tree, sashNode),

    // The DRAWN sections. Rule 75 reads the bottom rail and Integrate's
    // warning clears at exactly 62, so it is the drawn rail, not a default.
    gross_bottom_rail_height_in_mm: num(v.bottomHeight),
    gross_sash_head_height_in_mm:   num(v.topHeight),
    gross_left_sash_stile_width_in_mm:  num(v.leftWidth),
    gross_right_sash_stile_width_in_mm: num(v.rightWidth),

    // Step AU: a sash is stormproof when its stored SASH TYPE says so —
    // casementTypeId 'stormproof' (Integrate typeId 9), which is what the
    // whole-window conversion writes. Step AS read an `isStormProof` flag
    // that nothing ever set, so rule 43 could never fire; the flag is still
    // honoured for any drawing that happens to carry it.
    is_storm_proof: isStormproofSash(sashNode) ||
      (v.isStormProof ?? item?.values?.isStormProof ?? false) === true,

    // Not offered / not modelled, so false rather than missing:
    //  - the heritage range is not a product we sell;
    //  - there are no tilt & turn operations (Integrate's rule 45).
    is_heritage_range: false,
    is_bottom_and_left_hand_hung_viewed_internally:  false,
    is_bottom_and_right_hand_hung_viewed_internally: false,

    is_complete_new,
  }
}
