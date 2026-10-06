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

        const evalResult = tryEvaluateCondition(rule.condition, partVars, lists)

        if (evalResult.error) {
          results.push({
            rule_id: rule.id,
            severity: rule.severity,
            message: rule.message,
            part_key: part.key,
            part_label: part.part_type,
            status: 'unevaluable',
            missing: evalResult.missing,
          })
        } else if (evalResult.fired) {
          results.push({
            rule_id: rule.id,
            severity: rule.severity,
            message: interpolateMessage(rule.message, partVars),
            part_key: part.key,
            part_label: part.part_type,
            status: 'fired',
            missing: [],
          })
        } else {
          results.push({
            rule_id: rule.id,
            severity: rule.severity,
            message: rule.message,
            part_key: part.key,
            part_label: part.part_type,
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
