import { Parser } from 'expr-eval'

// Single shared parser instance.
// Supports: arithmetic (+/-/*//) , comparisons (> < >= <= == !=),
// logical operators (and / or / not), parentheses, and built-in
// constants (true, false, PI, E).
const parser = new Parser()

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
  try {
    return parser.evaluate(expression, variables)
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
