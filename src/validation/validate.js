/**
 * validate.js — Validation engine for GlazePro drawings and quotes.
 *
 * Evaluates validation rules against drawing variables and returns
 * structured results with severity, message, and status.
 *
 * Uses the same expr-eval based evaluator as the pricing engine, with
 * additional functions: in_list(), contains(), empty().
 */

import { Parser } from 'expr-eval'
import { glassSpacerMm } from '../pricing/optionVocabulary.js'

// ── Parser setup (mirrors evaluator.js but adds validation functions) ────────

const parser = new Parser()

parser.functions.round_up_to_nearest = function (x, n) {
  if (!n) return x
  return Math.ceil(x / n) * n
}

parser.functions.round_to = function (x, n) {
  const dp = Math.floor(n ?? 0)
  const factor = Math.pow(10, dp)
  return Math.round(x * factor) / factor
}

function preprocessExpression(expr) {
  return expr
    .replace(/\bround\(/g, 'round_to(')
    .replace(/\blength\b/g, 'part_length')
}

// ── Validation-specific functions ────────────────────────────────────────────

/**
 * Build validation-specific parser functions that are bound to the
 * provided lists map.  `in_list(value, list_name)` checks whether
 * `value` (coerced to string) is in the named list.
 * `contains(list_variable, list_name)` checks if the comma-separated
 * list_variable has any overlap with the named list.
 * `empty(x)` returns true if x is null, undefined, or empty string.
 */
function bindListFunctions(listsMap) {
  return {
    in_list(value, listName) {
      const list = listsMap[listName]
      if (!list) return false
      return list.includes(String(value))
    },
    contains(listVariable, listName) {
      const list = listsMap[listName]
      if (!list) return false
      if (listVariable == null || listVariable === '') return false
      const values = String(listVariable).split(',').map(s => s.trim())
      return values.some(v => list.includes(v))
    },
    empty(x) {
      return x == null || x === '' || x === 0
    },
  }
}

// ── Core evaluation ──────────────────────────────────────────────────────────

/**
 * Attempt to evaluate a condition expression.
 * Returns { fired: boolean } on success or { error, missing } on failure.
 */
function tryEvaluateCondition(condition, variables, listsMap) {
  const expr = preprocessExpression(condition)

  // Bind list functions into the parser for this evaluation
  const listFns = bindListFunctions(listsMap)
  parser.functions.in_list = listFns.in_list
  parser.functions.contains = listFns.contains
  parser.functions.empty = listFns.empty

  // Find referenced variables
  let referencedVars
  try {
    referencedVars = parser.parse(expr).variables()
  } catch {
    return { error: 'parse_error', missing: [] }
  }

  // Check for missing variables.
  // List names (keys in listsMap) are passed as bare identifiers to
  // in_list() and contains(), so expr-eval sees them as variables.
  // Inject them as string-valued variables holding the list name itself.
  const vars = {
    ...Object.fromEntries(Object.keys(listsMap).map(k => [k, k])),
    ...variables,
  }
  if ('length' in variables) {
    vars.part_length = variables.length
  }

  const missing = referencedVars.filter(v => !(v in vars))
  if (missing.length > 0) {
    return { error: 'missing_vars', missing }
  }

  try {
    const result = parser.evaluate(expr, vars)
    return { fired: Boolean(result) }
  } catch {
    return { error: 'eval_error', missing: [] }
  }
}

/**
 * Interpolate variable names in a message string with their values.
 * Scans for tokens that look like variable names and replaces them
 * if they exist in the variables map.
 */
function interpolateMessage(message, variables) {
  if (!message) return message
  return message.replace(/\b([a-z][a-z0-9_]*)\b/g, (match, name) => {
    if (name in variables) {
      const val = variables[name]
      if (val == null) return match
      return String(val)
    }
    return match
  })
}

// ── Display labels for part types ────────────────────────────────────────────

const PART_DISPLAY_LABELS = {
  drawingItemPart:         'Item',
  paintAndIronmongeryPart: 'Finish & Ironmongery',
  notesPart:               'Access & H&S',
  pricePart:               'Price',
  assemblyFramePart:       'Frame',
  cillPart:                'Cill',
  sashPairPart:            'Pair of Sashes',
  topSashPart:             'Top Sash',
  bottomSashPart:          'Bottom Sash',
  glassPart:               'Glazing',
  mullionPart:             'Mullion',
  transomPart:             'Transom',
  verticalGlazingBarPart:  'Vertical GB',
  horizontalGlazingBarPart:'Horizontal GB',
  casementSashPart:        'Casement Sash',
  doorLeafPart:            'Door Leaf',
  panelPart:               'Panel',
  componentPart:           'Component',
  surroundPart:            'Surround',
}

/**
 * Build a display label for a part, including its parent for context.
 * E.g. "Top Sash > Glazing" for a glassPart inside a topSashPart.
 */
function partDisplayLabel(tree, part) {
  const label = PART_DISPLAY_LABELS[part.part_type] || part.part_type
  const parent = findParent(tree, part.key)
  if (parent && parent.part_type !== 'drawingItemPart') {
    const parentLabel = PART_DISPLAY_LABELS[parent.part_type] || parent.part_type
    return `${parentLabel} > ${label}`
  }
  return label
}

function findParent(node, targetKey, parent = null) {
  if (!node) return null
  if (node.key === targetKey) return parent
  for (const child of (node.children ?? [])) {
    const found = findParent(child, targetKey, node)
    if (found) return found
  }
  return null
}

// ── Part type to loop target mapping ─────────────────────────────────────────

const LOOP_TARGET_PART_TYPES = {
  frame:               'assemblyFramePart',
  sash:                null,                 // matches topSashPart + bottomSashPart
  sliding_sash:        null,                 // matches topSashPart + bottomSashPart
  casement_sash:       'casementSashPart',
  door_leaf:           'doorLeafPart',
  direct_glazed_unit:  'directGlazedUnitPart',
  panel:               'panelPart',
  ironmongery_part:    'ironmongeryPartPart',
  ironmongery_set:     'ironmongerySetPart',
  surround:            'surroundPart',
  component:           'componentPart',
  glass_unit:          'glassPart',
}

function findAllParts(node, partType, acc = []) {
  if (!node) return acc
  if (node.part_type === partType) acc.push(node)
  for (const child of (node.children ?? [])) findAllParts(child, partType, acc)
  return acc
}

function findParentPartType(node, childKey, parent = null) {
  if (!node) return null
  if (node.key === childKey) return parent?.part_type ?? null
  for (const child of (node.children ?? [])) {
    const found = findParentPartType(child, childKey, node)
    if (found !== null) return found
  }
  return null
}

function findMatchingParts(tree, loopTarget) {
  if (!loopTarget || loopTarget === '-') return []

  if (loopTarget === 'sash' || loopTarget === 'sliding_sash') {
    return [
      ...findAllParts(tree, 'topSashPart'),
      ...findAllParts(tree, 'bottomSashPart'),
    ]
  }

  const partType = LOOP_TARGET_PART_TYPES[loopTarget]
  if (!partType) return []
  return findAllParts(tree, partType)
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluate item-level validation rules against a drawing tree.
 *
 * @param {Object}  tree       - Root node of the parts tree
 * @param {Object}  variables  - Item-level variable context (from computeVariables)
 * @param {Array}   rules      - Array of validation rule objects (item-level only)
 * @param {Object}  lists      - Map of list_name → string[] of values
 * @returns {Array} Array of result objects
 */
export function validateDrawing(tree, variables, rules, lists = {}) {
  const results = []
  const vars = variables || {}

  for (const rule of rules) {
    if (!rule.is_active) continue
    if (rule.level === 'quote') continue

    const loopTarget = rule.loop_target
    const hasLoop = loopTarget && loopTarget !== '-'

    if (hasLoop && tree) {
      // Loop rule: evaluate once per matching part
      const parts = findMatchingParts(tree, loopTarget)
      if (parts.length === 0) {
        // No parts to loop over -- rule is not applicable
        continue
      }
      for (const part of parts) {
        // Build part-level variables (merge item vars + part-specific vars)
        const partVars = {
          ...vars,
          ...(part.values || {}),
          // Standard part-level aliases
          width: part.values?.width != null ? part.values.width / 1000 : undefined,
          height: part.values?.height != null ? part.values.height / 1000 : undefined,
          to_be_replaced: part.values?.toBeReplaced ?? false,
          part_key: part.key,
          is_top_sash: part.part_type === 'topSashPart',
          is_bottom_sash: part.part_type === 'bottomSashPart',
        }

        // glass_unit per-part variables
        if (loopTarget === 'glass_unit') {
          const pv = part.values || {}
          const innerT = Number(pv.innerPaneThickness ?? 0)
          const outerT = Number(pv.outerPaneThickness ?? 0)
          // Spacer thickness from the stored spacerDimId code ('spacer_16' →
          // 16) — saved drawings never store a spacerHeight number.
          const spacerH = glassSpacerMm(pv)
          const singleT = Number(pv.singlePaneThickness ?? 0)
          partVars.glass_unit_thickness = innerT + spacerH + outerT
          partVars.spacer_dim = spacerH
          partVars.single_pane_thickness = singleT
          partVars.outer_pane_part_no = pv.externalGlassPartNo ?? ''
          partVars.inner_pane_part_no = pv.internalGlassPartNo ?? ''
          partVars.single_pane_part_no = pv.singleGlassPartNo ?? ''
          partVars.is_inner_pane_toughened = pv.toughened_inner === true
          partVars.is_outer_pane_toughened = pv.toughened_outer === true
          partVars.is_single_pane_toughened = pv.toughened_single === true
          partVars.is_filled_with_krypton = (pv.gasFillId ?? pv.gasType ?? '').toLowerCase() === 'krypton'
          // is_direct_glazed_unit: glass is in a frame, not a sash
          const parentType = findParentPartType(tree, part.key)
          partVars.is_direct_glazed_unit = parentType === 'assemblyFramePart'
          // unit_gb_qty: count of glazing bar children on this glass part
          const barChildren = (part.children ?? []).filter(c =>
            c.part_type === 'verticalGlazingBarPart' || c.part_type === 'horizontalGlazingBarPart')
          partVars.unit_gb_qty = barChildren.length || (Number(pv.barsWide ?? 0) + Number(pv.barsHigh ?? 0))
          // actual_width, actual_height: glass unit dimensions in mm
          partVars.actual_width = Number(pv.actualWidth ?? pv.width ?? 0)
          partVars.actual_height = Number(pv.actualHeight ?? pv.height ?? 0)
          partVars.actual_area = partVars.actual_width * partVars.actual_height / 1e6
        }

        // sliding_sash / sash per-part variables
        if (loopTarget === 'sliding_sash' || loopTarget === 'sash') {
          const pv = part.values || {}
          partVars.sash_thickness = Number(pv.sashThickness ?? vars.sash_thickness ?? 0)
          partVars.gross_sash_height_in_mm = Number(pv.grossHeight ?? pv.height ?? 0)
          partVars.gross_sash_head_height_in_mm = Number(pv.topHeight ?? 0)
          partVars.weight_in_kg = Number(pv.weight_in_kg ?? 0)
        }

        const evalResult = tryEvaluateCondition(rule.condition, partVars, lists)

        if (evalResult.error) {
          results.push({
            rule_id: rule.id,
            severity: rule.severity,
            message: rule.message,
            part_key: part.key,
            part_label: partDisplayLabel(tree, part),
            status: 'unevaluable',
            missing: evalResult.missing,
          })
        } else if (evalResult.fired) {
          results.push({
            rule_id: rule.id,
            severity: rule.severity,
            message: interpolateMessage(rule.message, partVars),
            part_key: part.key,
            part_label: partDisplayLabel(tree, part),
            status: 'fired',
            missing: [],
          })
        } else {
          results.push({
            rule_id: rule.id,
            severity: rule.severity,
            message: rule.message,
            part_key: part.key,
            part_label: partDisplayLabel(tree, part),
            status: 'passed',
            missing: [],
          })
        }
      }
    } else {
      // Non-loop rule: evaluate once with item variables
      const evalResult = tryEvaluateCondition(rule.condition, vars, lists)

      if (evalResult.error) {
        results.push({
          rule_id: rule.id,
          severity: rule.severity,
          message: rule.message,
          part_key: null,
          part_label: null,
          status: 'unevaluable',
          missing: evalResult.missing,
        })
      } else if (evalResult.fired) {
        results.push({
          rule_id: rule.id,
          severity: rule.severity,
          message: interpolateMessage(rule.message, vars),
          part_key: null,
          part_label: null,
          status: 'fired',
          missing: [],
        })
      } else {
        results.push({
          rule_id: rule.id,
          severity: rule.severity,
          message: rule.message,
          part_key: null,
          part_label: null,
          status: 'passed',
          missing: [],
        })
      }
    }
  }

  return results
}

/**
 * Evaluate quote-level validation rules.
 *
 * @param {Object}  quoteVariables - Quote-level variable context
 * @param {Array}   itemResults    - Array of per-item results (from validateDrawing calls)
 * @param {Array}   rules          - Array of validation rule objects (quote-level only)
 * @param {Object}  lists          - Map of list_name → string[] of values
 * @returns {Array} Array of result objects
 */
export function validateQuote(quoteVariables, itemResults, rules, lists = {}) {
  const results = []
  const vars = quoteVariables || {}

  for (const rule of rules) {
    if (!rule.is_active) continue
    if (rule.level !== 'quote') continue

    const evalResult = tryEvaluateCondition(rule.condition, vars, lists)

    if (evalResult.error) {
      results.push({
        rule_id: rule.id,
        severity: rule.severity,
        message: rule.message,
        part_key: null,
        part_label: null,
        status: 'unevaluable',
        missing: evalResult.missing,
      })
    } else if (evalResult.fired) {
      results.push({
        rule_id: rule.id,
        severity: rule.severity,
        message: interpolateMessage(rule.message, vars),
        part_key: null,
        part_label: null,
        status: 'fired',
        missing: [],
      })
    } else {
      results.push({
        rule_id: rule.id,
        severity: rule.severity,
        message: rule.message,
        part_key: null,
        part_label: null,
        status: 'passed',
        missing: [],
      })
    }
  }

  return results
}

/**
 * Convenience: count fired results by severity.
 * @param {Array} results
 * @returns {{ errors: number, warnings: number, info: number }}
 */
export function countBySeverity(results) {
  let errors = 0, warnings = 0, info = 0
  for (const r of results) {
    if (r.status !== 'fired') continue
    if (r.severity === 'error') errors++
    else if (r.severity === 'warning') warnings++
    else info++
  }
  return { errors, warnings, info }
}

/**
 * Check if any error-severity rules fired.
 * @param {Array} results
 * @returns {boolean}
 */
export function hasErrors(results) {
  return results.some(r => r.status === 'fired' && r.severity === 'error')
}
