import { Parser } from 'expr-eval'

// Single shared parser instance.
// Supports: arithmetic (+/-/*//) , comparisons (> < >= <= == !=),
// logical operators (and / or / not), parentheses, and built-in
// constants (true, false, PI, E).
const parser = new Parser()

// round_up_to_nearest(x, n) — round x UP to the nearest multiple of n.
// Used in sash-window bead allocation rules (e.g. round_up_to_nearest(1234, 100) = 1300).
parser.functions.round_up_to_nearest = function(x, n) {
  if (!n) return x
  return Math.ceil(x / n) * n
}

// round_to(x, n) — round x to floor(n) decimal places.
// Integrate's round() treats the second argument as a number of decimal places (floored),
// so round(cost*qty, 0.1) rounds to floor(0.1) = 0 dp (nearest integer).
// Called as round_to() directly, or via the round( → round_to( preprocessor below.
// Examples:
//   round_to(35.30, 0.1) → floor(0.1)=0 dp → Math.round(35.30) = 35
//   round_to(3.25,  0.1) → 0 dp → 3
//   round_to(x, 2)       → 2 dp → Math.round(x * 100) / 100
parser.functions.round_to = function(x, n) {
  const dp = Math.floor(n ?? 0)
  const factor = Math.pow(10, dp)
  return Math.round(x * factor) / factor
}

// ── Expression pre-processor ──────────────────────────────────────────────────
//
// expr-eval reserves `round` as a unary operator and `length` as a built-in,
// so PF30 rules that contain these tokens must be rewritten before parsing.
//
//   round(  → round_to(   (word-boundary before 'round', guards against 'around(')
//   \blength\b → part_length  (whole-word; does not affect 'length_mm' etc.)
//
// The rewrite is applied to the expression string. Callers that supply a
// `length` variable also get an automatic `part_length` alias in evaluate().

function preprocessExpression(expr) {
  return expr
    .replace(/\bround\(/g, 'round_to(')
    .replace(/\blength\b/g, 'part_length')
}

/**
 * Evaluate an expression string against a variable context.
 * Returns the raw result — number, boolean, or string.
 * Throws with the expression included in the message if parsing or
 * evaluation fails, so rule authors can see exactly which expression broke.
 *
 * @param {string} expression
 * @param {Object} variables
 * @returns {*}
 */
export function evaluate(expression, variables = {}) {
  const expr = preprocessExpression(expression)
  // Auto-alias: if the caller passes `length`, also supply `part_length`
  // so that the rewritten expression can resolve it.
  const vars = 'length' in variables
    ? { ...variables, part_length: variables.length }
    : variables
  try {
    return parser.evaluate(expr, vars)
  } catch (err) {
    throw new Error(`Evaluator error in "${expression}": ${err.message}`)
  }
}

/**
 * Evaluate a condition expression and coerce the result to a boolean.
 * Used to test whether a price rule should fire.
 *
 * expr-eval returns 1 / 0 for comparison and logical operations rather
 * than true / false, so Boolean() coercion is applied to both.
 *
 * The default rule condition stored in the DB is the string "true", which
 * expr-eval treats as a built-in constant and evaluates to 1.
 *
 * @param {string} expression  e.g. "is_double_glazed and frame_height > 2000"
 * @param {Object} variables
 * @returns {boolean}
 */
export function evaluateCondition(expression, variables = {}) {
  return Boolean(evaluate(expression, variables))
}

/**
 * Evaluate a numeric expression and return a finite number.
 * Used for the quantity and value fields of pricing rules.
 * Throws if the result is not a finite number (catches Infinity / NaN
 * which would otherwise silently corrupt calculated_price).
 *
 * @param {string} expression  e.g. "frame_width * frame_height / 1000000"
 * @param {Object} variables
 * @returns {number}
 */
export function evaluateNumber(expression, variables = {}) {
  const result = evaluate(expression, variables)
  const n = Number(result)
  if (!Number.isFinite(n)) {
    throw new Error(
      `Evaluator error in "${expression}": expected a finite number, got ${result}`
    )
  }
  return n
}

/**
 * Return the list of variable names referenced in an expression.
 * Returns [] if the expression cannot be parsed (e.g. partially written rule).
 * Used to pre-fill unknown variables with 0 before evaluation.
 * Applies the same preprocessor as evaluate() so that rewritten names
 * (e.g. part_length) are reported instead of the originals.
 *
 * @param {string} expression
 * @returns {string[]}
 */
export function getExpressionVariables(expression) {
  try {
    return parser.parse(preprocessExpression(expression)).variables()
  } catch {
    return []
  }
}
