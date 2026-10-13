/**
 * profileCodeCallers.test.js — Step AZ hotfix item 1
 *
 * EVERY caller of computeVariables that handles a real drawing must pass the
 * drawing's profile code. The three range variables
 * (is_single_and_french_doors_range, is_open_in_doors_range,
 * is_replacement_sashes_range) come from `opts.profileCode` and from nothing
 * else, so a caller that omits it does not get a wrong answer — it gets a
 * silent `false`, and every rule written on a range stops firing with nothing
 * on screen to say so. That is what cost a live French door all of its timber
 * lines.
 *
 * This is a source-level guard, deliberately: the omission is invisible at
 * runtime, so the thing worth testing is that no call site forgets. It is the
 * same shape as the single-pricing-path tests in loadPricingContext.test.js.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Every `computeVariables(...)` call in a file, as the text of its arguments.
 * Counts parentheses rather than matching a regex, so a nested call
 * (computeDerived(tree), which several call sites pass inline) does not cut
 * the argument list short.
 */
function computeVariablesCalls(source) {
  const calls = []
  const needle = 'computeVariables('
  let from = 0
  for (;;) {
    const at = source.indexOf(needle, from)
    if (at < 0) break
    // Skip an import, a doc comment or a property reference like m.computeVariables(
    let depth = 0
    let i = at + needle.length - 1
    for (; i < source.length; i++) {
      if (source[i] === '(') depth++
      else if (source[i] === ')') { depth--; if (depth === 0) break }
    }
    calls.push(source.slice(at, i + 1))
    from = i + 1
  }
  return calls
}

/** Files that compute variables for a REAL drawing, and what each is. */
const CALLERS = [
  ['pricing/pricingEngine.js',      'the engine and priceDrawing'],
  ['pricing/loadPricingContext.js', 'default ironmongery for pricing'],
  ['pages/DrawingBoard.jsx',        'the board’s live variables'],
  ['pages/QuoteMatrixPage.jsx',     'the matrix cards'],
  ['pages/QuoteOverview.jsx',       'the overview'],
  ['pages/ValidationRules.jsx',     'validation against a drawing'],
  ['quotes/publishQuote.js',        'the publish gate'],
  ['quotes/buildSnapshot.js',       'the quote snapshot’s default ironmongery'],
  ['pages/dev/PricingBenchmark.jsx', 'the benchmark page’s variables panel'],
]

describe('Step AZ hotfix — every computeVariables caller passes the profile code', () => {
  for (const [file, what] of CALLERS) {
    it(`${file} — ${what}`, () => {
      const source = readFileSync(resolve(SRC, file), 'utf8')
      const calls = computeVariablesCalls(source)
        // the function's own definition and its JSDoc signature line
        .filter(c => !c.startsWith('computeVariables(tree, derived = {}'))
        .filter(c => !c.startsWith('computeVariables(tree, derived, pfVariables = {}'))
      expect(calls.length, `${file} should call computeVariables`).toBeGreaterThan(0)
      for (const call of calls) {
        expect(call, `${file}: a computeVariables call without a profile code`)
          .toMatch(/profileCode/)
      }
    })
  }
})
