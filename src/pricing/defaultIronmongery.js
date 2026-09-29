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
import { evaluateCondition, evaluateNumber, getExpressionVariables } from './evaluator.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'

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

function computePartVars(partNode, tree, derived, baseVars, glassCatalogue) {
  if (!partNode) return {}
  const pt = partNode.part_type
  const v  = partNode.values ?? {}

  if (pt === 'topSashPart' || pt === 'bottomSashPart') {
    const isTop           = pt === 'topSashPart'
    const op              = (v.operation ?? '').toLowerCase()
    const is_complete_new = baseVars.is_complete_new ?? false
    const to_be_replaced  = is_complete_new || v.toBeReplaced === true

    const weightData = computeSashWeight(partNode, tree, glassCatalogue)

    const pair        = findFirst(tree, 'sashPairPart')
    const pairDerived = pair ? (derived[pair.key] ?? {}) : {}
    const gross_sash_height_in_mm = isTop
      ? (pairDerived.topSashHeight    ?? weightData.gross_sash_height_in_mm)
      : (pairDerived.bottomSashHeight ?? weightData.gross_sash_height_in_mm)
    const gross_sash_width_in_mm = pairDerived.sashWidth ?? weightData.gross_sash_width_in_mm ?? 0

    return {
      is_top_sash:    isTop,
      is_bottom_sash: !isTop,
      to_be_replaced,
      is_cord_hung:    op.includes('cord'),
      is_chain_hung:   op.includes('chain'),
      is_spiral_hung:  op.includes('spiral'),
      is_fixed_sash:   op === 'fix' || op.includes('fix'),
      gross_sash_height_in_mm,
      gross_sash_width_in_mm,
      weight_in_kg:   weightData.weight_in_kg,
      weight_in_lb:   weightData.weight_in_lb,
    }
  }

  if (pt === 'casementSashPart') {
    const casementDerived = derived[partNode.key] ?? {}
    const is_complete_new = baseVars.is_complete_new ?? false
    const to_be_replaced  = is_complete_new || v.toBeReplaced === true
    return {
      to_be_replaced,
      is_opening:  v.operation !== 'fix',
      is_side_hung: v.hangType === 'side',
      is_top_hung:  v.hangType === 'top',
      is_left_hand_hung_viewed_internally:  v.handedness === 'left',
      is_right_hand_hung_viewed_internally: v.handedness === 'right',
      is_french_casement_sash: v.isFrench   ?? false,
      is_casement_mpls:        v.isMpls     ?? false,
      gross_sash_width_in_mm:  casementDerived.sashWidth  ?? v.width  ?? 0,
      gross_sash_height_in_mm: casementDerived.sashHeight ?? v.height ?? 0,
      weight_in_kg: 0,  // casement weight not yet computed here
    }
  }

  if (pt === 'assemblyFramePart') {
    const outerW = v.outerWidth  ?? v.width  ?? 0
    const outerH = v.outerHeight ?? v.height ?? 0
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
export function defaultIronmonger(tree, variables, rules, glassCatalogue = {}) {
  const derived  = computeDerived(tree)
  const baseVars = { ...variables }
  const lines    = []

  const activeRules = rules.filter(r => r.is_active !== false)

  for (const rule of activeRules) {
    const loopParts = getLoopParts(tree, rule.loop_target ?? null)

    for (const partNode of loopParts) {
      const partVars = partNode
        ? computePartVars(partNode, tree, derived, baseVars, glassCatalogue)
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

      // Override the rule's default finish with the item's ironmongery_finish unless
      // the rule's finish is a fixed non-metal code (e.g. 'Wht' for trickle vents).
      const FIXED_FINISHES = ['Wht', 'PN']
      const itemFinish = baseVars.ironmongery_finish
      const finish_code = (itemFinish && !FIXED_FINISHES.includes(rule.finish_code))
        ? itemFinish
        : rule.finish_code

      lines.push({
        product_short_name: rule.product_short_name,
        finish_code,
        qty,
        rule_id:       rule.id   ?? null,
        scope_part_id: partNode?.key ?? null,
      })
    }
  }

  // Merge lines for the same product (same short_name + finish_code), summing qty.
  const merged = new Map()
  for (const line of lines) {
    const key = `${line.product_short_name}:${line.finish_code}`
    if (merged.has(key)) {
      merged.get(key).qty += line.qty
    } else {
      merged.set(key, { ...line })
    }
  }

  return [...merged.values()]
}
