/**
 * partAllocator.js
 * Pure function: takes a tree + variables + allocation rules and returns
 * a list of allocated parts (part codes, quantities, measures).
 *
 * The rule shape mirrors price_rules; loop_target values reuse the same
 * set ('sliding_sash', 'frame', 'door_leaf', etc.) plus null for item scope.
 *
 * Variables needed per-sash (weight_in_kg, gross_sash_height_in_mm, etc.)
 * are computed here using sashWeight.js rather than requiring the caller to
 * pre-compute them.
 */

import { computeSashWeight } from './sashWeight.js'
import { evaluateCondition, evaluateNumber, getExpressionVariables } from './evaluator.js'
import { operationKind } from './optionVocabulary.js'
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

// ── Loop part helper (mirrors pricingEngine LOOP_PART_TYPES) ──────────────────

const LOOP_PART_TYPES = {
  sliding_sash:  ['topSashPart', 'bottomSashPart'],
  frame:         ['assemblyFramePart'],
  glass_unit:    ['glassPart'],
  casement_sash: ['casementSashPart'],
  door_leaf:     ['doorLeafPart'],
  panel:         ['panelPart'],
}

function getLoopParts(tree, loopTarget) {
  if (!loopTarget) return [null]        // item scope: run once with no part
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

/**
 * Compute extra variables for a specific part node within a loop.
 * Only supplies what the part allocator rules actually need — a lightweight
 * subset of computePartVariables from pricingEngine.js.
 */
function computePartVarsForAllocator(partNode, tree, derived, baseVars, glassCatalogue, profileValues) {
  if (!partNode) return {}
  const pt = partNode.part_type
  const v  = partNode.values ?? {}

  if (pt === 'topSashPart' || pt === 'bottomSashPart') {
    const isTop           = pt === 'topSashPart'
    const op              = operationKind(v.operation)
    const is_complete_new = baseVars.is_complete_new ?? false
    const to_be_replaced  = is_complete_new || v.toBeReplaced === true

    // Sash weight — measured model; needs the profile rebate/tolerance
    const weightData = computeSashWeight(partNode, tree, glassCatalogue, profileValues)

    // Inner-geometry height (from derived) — used for height band tests (> 630, etc.)
    // These bands are all >> 630mm so both inner and outer geometry work; keeping
    // inner geometry for consistency with the pricing engine.
    const pair        = findFirst(tree, 'sashPairPart')
    const pairDerived = pair ? (derived[pair.key] ?? {}) : {}
    const gross_sash_height_in_mm = isTop
      ? (pairDerived.topSashHeight    ?? weightData.gross_sash_height_in_mm)
      : (pairDerived.bottomSashHeight ?? weightData.gross_sash_height_in_mm)

    // Weight is CUT to 1 dp before band tests, not rounded — inferred from
    // four values (step-y brief §3), same as the pricing engine.
    const weight_in_kg = Math.floor(weightData.weight_in_kg * 10 + 1e-9) / 10

    return {
      is_top_sash:              isTop,
      is_bottom_sash:           !isTop,
      to_be_replaced,
      is_cord_hung:             op === 'cord',
      is_chain_hung:            op === 'chain',
      is_spiral_hung:           op === 'spiral',
      is_fixed_sash:            op === 'fix',
      gross_sash_height_in_mm,                // inner-geometry height (kept for back-compat)
      sash_height_in_mm:        gross_sash_height_in_mm,  // DB rule variable name alias
      // Weight vars (weight_in_kg rounded to 1 dp; others unrounded)
      weight_in_kg,
      weight_in_lb:             weightData.weight_in_lb,
      weight_incl_panel_in_kg:  weightData.weight_incl_panel_in_kg,
      weight_incl_panel_in_lb:  weightData.weight_incl_panel_in_lb,
      sash_thickness:           weightData.sash_thickness,
    }
  }

  if (pt === 'assemblyFramePart') {
    // assemblyFramePart.width/height ARE the overall frame (Step V decision)
    const outerW = v.width  ?? 0
    const outerH = v.height ?? 0
    return {
      to_be_replaced: baseVars.is_complete_new ?? false,
      width:          outerW / 1000,   // metres (Integrate convention)
      height:         outerH / 1000,
    }
  }

  if (pt === 'doorLeafPart') {
    const is_complete_new = baseVars.is_complete_new ?? false
    const to_be_replaced  = is_complete_new || v.toBeReplaced === true
    return {
      to_be_replaced,
      gross_sash_height_in_mm: v.grossHeight ?? v.height ?? 0,
      height:                  (v.grossHeight ?? v.height ?? 0) / 1000,
      is_door_mpls:            v.isDoorMpls    ?? false,
      is_front_door:           v.isFrontDoor   ?? false,
      is_french_door_leaf:     v.isFrenchDoor  ?? false,
      is_slave_leaf_in_french_pair:  v.isSlaveFrenchLeaf  ?? false,
      is_master_leaf_in_french_pair: v.isMasterFrenchLeaf ?? false,
      is_left_hand_hung_viewed_internally:  v.handedness === 'left',
      is_right_hand_hung_viewed_internally: v.handedness === 'right',
      is_opening_in:   v.openingDirection === 'in',
      is_opening_out:  v.openingDirection === 'out',
      is_folding_leaf: v.isFolding   ?? false,
      is_stable_door_leaf: v.isStable ?? false,
    }
  }

  return {}
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Allocate parts for a drawing by evaluating all active allocation rules
 * against the supplied variable context.
 *
 * @param {Object}   tree          - Root parts tree node
 * @param {Object}   variables     - Flat map of all item-level variables (from computeVariables)
 * @param {Array}    rules         - Rows from part_allocation_rules (all, active + inactive)
 * @param {Object}   glassCatalogue - { partCode: { cost_per_m2, thickness_mm } }
 * @param {boolean}  includeInactive - If true, include inactive rules (for testing / debug)
 * @returns {Array<{
 *   rule_id: string|null,
 *   group:   string,
 *   label:   string,
 *   part_code: string,
 *   qty:     number,
 *   measure: number,      // mm for timber, kg for weights, 1 for each
 *   scope_part_id:   string|null,
 *   scope_part_type: string|null,
 *   defaulted_vars:  string[],
 * }>}
 */
export function allocateParts(tree, variables, rules, glassCatalogue = {}, includeInactive = false, profileValues = {}) {
  const derived   = computeDerived(tree, profileValues)
  const baseVars  = { ...variables }
  const allocated = []

  // Only process part_allocator rules. If rule_family is set to something else
  // (e.g. 'default_ironmongery') the rule is for a different subsystem and must
  // be excluded regardless of includeInactive.
  const activeRules = rules.filter(r => {
    if (r.rule_family != null && r.rule_family !== 'part_allocator') return false
    return includeInactive || r.is_active !== false
  })

  for (const rule of activeRules) {
    const loopParts = getLoopParts(tree, rule.loop_target ?? null)

    for (const partNode of loopParts) {
      // Build variable context for this loop iteration
      const partVars = partNode
        ? computePartVarsForAllocator(partNode, tree, derived, baseVars, glassCatalogue, profileValues)
        : {}
      const iterVars = { ...baseVars, ...partVars }

      // Pre-fill unknown variables with 0
      const exprs = [rule.condition, rule.qty_expr, rule.measure_expr].filter(Boolean)
      const { vars: safeVars, defaulted: defaulted_vars } = defaultMissingVars(exprs, iterVars)

      // Evaluate condition
      let fires = false
      try {
        fires = evaluateCondition(rule.condition || 'true', safeVars)
      } catch (e) {
        console.warn(`[allocateParts] rule "${rule.label}" condition error:`, e.message)
        continue
      }
      if (!fires) continue

      // Evaluate qty
      let qty = 1
      try {
        qty = evaluateNumber(rule.qty_expr || '1', safeVars)
      } catch (e) {
        console.warn(`[allocateParts] rule "${rule.label}" qty error:`, e.message)
        continue
      }

      // Evaluate measure (may be blank → 0)
      let measure = 0
      if (rule.measure_expr) {
        try {
          measure = evaluateNumber(rule.measure_expr, safeVars)
        } catch (e) {
          console.warn(`[allocateParts] rule "${rule.label}" measure error:`, e.message)
          measure = 0
        }
      }

      allocated.push({
        rule_id:         rule.id ?? null,
        group:           rule.group_name,
        label:           rule.label ?? '',
        part_code:       rule.part_code ?? '',
        qty,
        measure,
        scope_part_id:   partNode?.key  ?? null,
        scope_part_type: partNode?.part_type ?? null,
        defaulted_vars,
      })
    }
  }

  return allocated
}
