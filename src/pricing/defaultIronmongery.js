/**
 * defaultIronmongery.js
 * Pure function: given the parts tree, item-level variables, and the set of
 * default-ironmongery rules (from part_allocation_rules where rule_family =
 * 'default_ironmongery'), returns a merged list of ironmongery lines.
 *
 * Mirrors the allocator's loop structure exactly.  Each rule has a
 * loop_target (or null for item scope), a condition, a qty_expr, a
 * product_short_name and a finish_code.  Lines for the same product
 * (same short_name) are merged by summing qty.
 */

import { computeSashWeight } from './sashWeight.js'
import { owningSashPair } from './derivedGeometry.js'
import { casementSashSize, casementSashWeightKg } from './casementGeometry.js'
import { evaluateCondition, evaluateNumber, getExpressionVariables } from './evaluator.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'
import { operationKind, casementIsFixed } from './optionVocabulary.js'

// ── Tree helpers ──────────────────────────────────────────────────────────────

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

// ── Loop part helper ──────────────────────────────────────────────────────────

const LOOP_PART_TYPES = {
  sliding_sash:  ['topSashPart', 'bottomSashPart'],
  frame:         ['assemblyFramePart'],
  glass_unit:    ['glassPart'],
  casement_sash: ['casementSashPart'],
  door_leaf:     ['doorLeafPart'],
  panel:         ['panelPart'],
}

function getLoopParts(tree, loopTarget) {
  if (!loopTarget) return [null]
  const partTypes = LOOP_PART_TYPES[loopTarget]
  if (!partTypes) return []
  const parts = []
  for (const pt of partTypes) parts.push(...findAll(tree, pt))
  return parts
}

// ── Missing-variable defaulting ───────────────────────────────────────────────

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

// ── Per-part contextual variables ─────────────────────────────────────────────

function computePartVars(partNode, tree, derived, baseVars, glassCatalogue, profileValues) {
  if (!partNode) return {}
  const pt = partNode.part_type
  const v  = partNode.values ?? {}

  if (pt === 'topSashPart' || pt === 'bottomSashPart') {
    const isTop           = pt === 'topSashPart'
    const op              = operationKind(v.operation)
    const is_complete_new = baseVars.is_complete_new ?? false
    const to_be_replaced  = is_complete_new || v.toBeReplaced === true

    const weightData = computeSashWeight(partNode, tree, glassCatalogue, profileValues)

    // Step AD decision 3: the sash's OWN pair on a multi-pair frame
    const pair        = owningSashPair(tree, partNode)
    const pairDerived = pair ? (derived[pair.key] ?? {}) : {}
    const gross_sash_height_in_mm = isTop
      ? (pairDerived.topSashHeight    ?? weightData.gross_sash_height_in_mm)
      : (pairDerived.bottomSashHeight ?? weightData.gross_sash_height_in_mm)
    const gross_sash_width_in_mm = pairDerived.sashWidth ?? weightData.gross_sash_width_in_mm ?? 0

    return {
      is_top_sash:    isTop,
      is_bottom_sash: !isTop,
      to_be_replaced,
      is_cord_hung:    op === 'cord',
      is_chain_hung:   op === 'chain',
      is_spiral_hung:  op === 'spiral',
      is_fixed_sash:   op === 'fix',
      gross_sash_height_in_mm,
      gross_sash_width_in_mm,
      weight_in_kg:   weightData.weight_in_kg,
      weight_in_lb:   weightData.weight_in_lb,
    }
  }

  if (pt === 'casementSashPart') {
    // Step AP: Integrate's own casement default_ironmongery rules pick
    // hinges, handles, gearboxes and extensions by the sash's OPERATION,
    // its overall size and its weight, so all three have to be real here —
    // the old stubs (hangType/handedness/isMpls fields no drawing stores,
    // sizes from a sash-pair derived entry, weight 0) left every one of
    // those rules either silent or wrong.
    const is_complete_new = baseVars.is_complete_new ?? false
    const to_be_replaced  = is_complete_new || v.toBeReplaced === true
    const size = casementSashSize(tree, partNode)
    const op = String(v.operation ?? '').toLowerCase()
    const paint = findFirst(tree, 'paintAndIronmongeryPart')
    return {
      to_be_replaced,
      is_opening:   !casementIsFixed(partNode),
      // A side-hung casement is left or right hand hung; top/bottom hung
      // are their own operations (Integrate 15 / 16).
      is_side_hung: op.includes('left_hand') || op.includes('right_hand'),
      is_top_hung:    op.includes('top_hung'),
      is_bottom_hung: op.includes('bottom_hung'),
      is_left_hand_hung_viewed_internally:  op.includes('left_hand'),
      is_right_hand_hung_viewed_internally: op.includes('right_hand'),
      is_french_casement_sash: v.isFrenchCasement === true,
      // Casements are multipoint by default (Nathan, 9 Oct); the surveyor
      // unticks "Casement MPLS" on Finish & Ironmongery. An older drawing
      // with neither field stored is treated as multipoint, which is what
      // the default is.
      is_casement_mpls: (paint?.values?.isCasementMpls ?? v.isMpls ?? true) === true,
      gross_sash_width_in_mm:  size.width  ?? 0,
      gross_sash_height_in_mm: size.height ?? 0,
      weight_in_kg: casementSashWeightKg(tree, partNode, glassCatalogue),
    }
  }

  if (pt === 'assemblyFramePart') {
    // assemblyFramePart.width/height ARE the overall frame (Step V decision)
    const outerW = v.width  ?? 0
    const outerH = v.height ?? 0
    return {
      to_be_replaced: baseVars.is_complete_new ?? false,
      width:          outerW / 1000,
      height:         outerH / 1000,
    }
  }

  if (pt === 'doorLeafPart') {
    const is_complete_new = baseVars.is_complete_new ?? false
    const to_be_replaced  = is_complete_new || v.toBeReplaced === true
    return {
      to_be_replaced,
      is_door_mpls:            v.isDoorMpls    ?? false,
      is_front_door:           v.isFrontDoor   ?? false,
      is_french_door_leaf:     v.isFrenchDoor  ?? false,
      is_slave_leaf_in_french_pair:  v.isSlaveFrenchLeaf  ?? false,
      is_master_leaf_in_french_pair: v.isMasterFrenchLeaf ?? false,
      is_left_hand_hung_viewed_internally:  v.handedness === 'left',
      is_right_hand_hung_viewed_internally: v.handedness === 'right',
      is_opening_in:  v.openingDirection === 'in',
      is_opening_out: v.openingDirection === 'out',
    }
  }

  return {}
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compute the default ironmongery lines for a drawing item.
 *
 * @param {Object}  tree          - Root parts tree node
 * @param {Object}  variables     - Item-level variables (from computeVariables or BASE_VARS)
 * @param {Array}   rules         - part_allocation_rules rows with rule_family = 'default_ironmongery'
 * @param {Object}  [glassCatalogue] - { partCode: { cost_per_m2, thickness_mm } } (for weight calcs)
 * @returns {Array<{
 *   product_short_name: string,
 *   finish_code:        string,
 *   qty:                number,
 *   rule_id:            string|null,
 *   scope_part_id:      string|null,
 * }>}
 */
export function defaultIronmonger(tree, variables, rules, glassCatalogue = {}, profileValues = {}) {
  const derived  = computeDerived(tree, profileValues)
  const baseVars = { ...variables }
  const lines    = []

  const activeRules = rules.filter(r => r.is_active !== false)

  for (const rule of activeRules) {
    const loopParts = getLoopParts(tree, rule.loop_target ?? null)

    for (const partNode of loopParts) {
      const partVars = partNode
        ? computePartVars(partNode, tree, derived, baseVars, glassCatalogue, profileValues)
        : {}
      const iterVars = { ...baseVars, ...partVars }

      const exprs = [rule.condition, rule.qty_expr].filter(Boolean)
      const { vars: safeVars } = defaultMissingVars(exprs, iterVars)

      let fires = false
      try {
        fires = evaluateCondition(rule.condition || 'true', safeVars)
      } catch {
        continue
      }
      if (!fires) continue

      let qty = 1
      try {
        qty = evaluateNumber(rule.qty_expr || '1', safeVars)
      } catch {
        continue
      }

      // Step Z: default lines are created with an EMPTY finish, meaning
      // "follow the item's ironmongery finish" — resolved at pricing/display
      // time (resolveIronmongeryLines).
      //
      // Step AQ item 5: the rule's OWN finish comes along as a fallback for
      // when the product does not exist in the item's finish. It used to be
      // dropped unless it was one of a hard-coded FIXED_FINISHES ['Wht',
      // 'PN'], which happened to cover trickle vents but not the casement
      // hardware: the friction hinges, the Kenrick gearbox and the
      // extensions exist only in PC, the casement item finish is PB, so
      // three lines resolved to PB, found nothing and priced 0.00.
      //
      // The general rule subsumes the special case — a trickle vent exists
      // only in Wht and Blk, so an item finish of PB still falls back to the
      // rule's Wht — and it matches every Integrate casement list the
      // reviewer read: PB handles with PC hinges, gearbox and extensions.
      lines.push({
        product_short_name: rule.product_short_name,
        finish_code:      '',
        rule_finish_code: rule.finish_code ?? null,
        qty,
        rule_id:       rule.id   ?? null,
        scope_part_id: partNode?.key ?? null,
      })
    }
  }

  // Merge lines for the same product (same short_name + finish_code), summing
  // qty. Step AQ: the rule's finish is part of the key too, so two rules that
  // sell the same product in different finishes stay two lines instead of
  // merging into one and losing a finish.
  const merged = new Map()
  for (const line of lines) {
    const key = `${line.product_short_name}:${line.finish_code}:${line.rule_finish_code ?? ''}`
    if (merged.has(key)) {
      merged.get(key).qty += line.qty
    } else {
      merged.set(key, { ...line })
    }
  }

  return [...merged.values()]
}
