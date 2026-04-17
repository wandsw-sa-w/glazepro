import { describe, it, expect } from 'vitest'
import { evaluate, evaluateCondition, evaluateNumber } from './evaluator'

// ── Boolean variables ─────────────────────────────────────────────────────────

describe('evaluateCondition — boolean variables', () => {
  it('returns true when a boolean variable is true', () => {
    expect(evaluateCondition('is_double_glazed', { is_double_glazed: true })).toBe(true)
  })

  it('returns false when a boolean variable is false', () => {
    expect(evaluateCondition('is_double_glazed', { is_double_glazed: false })).toBe(false)
  })

  it('evaluates the default condition "true" with no variables', () => {
    expect(evaluateCondition('true', {})).toBe(true)
  })

  it('evaluates the literal "false" with no variables', () => {
    expect(evaluateCondition('false', {})).toBe(false)
  })

  it('negates a true boolean variable with not', () => {
    expect(evaluateCondition('not is_double_glazed', { is_double_glazed: true })).toBe(false)
  })

  it('negates a false boolean variable with not', () => {
    expect(evaluateCondition('not is_double_glazed', { is_double_glazed: false })).toBe(true)
  })
})

// ── Numeric comparisons ───────────────────────────────────────────────────────

describe('evaluateCondition — numeric comparisons', () => {
  it('> returns true when value exceeds threshold', () => {
    expect(evaluateCondition('frame_height > 2000', { frame_height: 2500 })).toBe(true)
  })

  it('> returns false when value is below threshold', () => {
    expect(evaluateCondition('frame_height > 2000', { frame_height: 1800 })).toBe(false)
  })

  it('>= returns true at the boundary', () => {
    expect(evaluateCondition('frame_height >= 2000', { frame_height: 2000 })).toBe(true)
  })

  it('< returns true when value is below threshold', () => {
    expect(evaluateCondition('frame_width < 600', { frame_width: 500 })).toBe(true)
  })

  it('<= returns true at the boundary', () => {
    expect(evaluateCondition('frame_width <= 600', { frame_width: 600 })).toBe(true)
  })

  it('== returns true for equal values', () => {
    expect(evaluateCondition('sash_count == 2', { sash_count: 2 })).toBe(true)
  })

  it('== returns false for unequal values', () => {
    expect(evaluateCondition('sash_count == 2', { sash_count: 3 })).toBe(false)
  })

  it('!= returns true for unequal values', () => {
    expect(evaluateCondition('service_type_code != 0', { service_type_code: 1 })).toBe(true)
  })
})

// ── Compound conditions ───────────────────────────────────────────────────────

describe('evaluateCondition — compound conditions', () => {
  it('and: true when both sides are true', () => {
    expect(evaluateCondition(
      'is_double_glazed and frame_height > 2000',
      { is_double_glazed: true, frame_height: 2500 }
    )).toBe(true)
  })

  it('and: false when left side is false', () => {
    expect(evaluateCondition(
      'is_double_glazed and frame_height > 2000',
      { is_double_glazed: false, frame_height: 2500 }
    )).toBe(false)
  })

  it('and: false when right side is false', () => {
    expect(evaluateCondition(
      'is_double_glazed and frame_height > 2000',
      { is_double_glazed: true, frame_height: 1500 }
    )).toBe(false)
  })

  it('or: true when only left side is true', () => {
    expect(evaluateCondition(
      'is_double_glazed or frame_height > 2000',
      { is_double_glazed: true, frame_height: 1500 }
    )).toBe(true)
  })

  it('or: true when only right side is true', () => {
    expect(evaluateCondition(
      'is_double_glazed or frame_height > 2000',
      { is_double_glazed: false, frame_height: 2500 }
    )).toBe(true)
  })

  it('or: false when both sides are false', () => {
    expect(evaluateCondition(
      'is_double_glazed or frame_height > 2000',
      { is_double_glazed: false, frame_height: 1500 }
    )).toBe(false)
  })

  it('parentheses group correctly', () => {
    expect(evaluateCondition(
      '(is_box_sash or is_spiral_sash) and frame_height > 1000',
      { is_box_sash: true, is_spiral_sash: false, frame_height: 1200 }
    )).toBe(true)
  })

  it('parentheses: false when outer and fails', () => {
    expect(evaluateCondition(
      '(is_box_sash or is_spiral_sash) and frame_height > 1000',
      { is_box_sash: false, is_spiral_sash: false, frame_height: 1200 }
    )).toBe(false)
  })

  it('three-part and is true when all parts are true', () => {
    expect(evaluateCondition(
      'is_double_glazed and frame_width > 500 and frame_height > 1000',
      { is_double_glazed: true, frame_width: 600, frame_height: 1200 }
    )).toBe(true)
  })

  it('three-part and is false when one part is false', () => {
    expect(evaluateCondition(
      'is_double_glazed and frame_width > 500 and frame_height > 1000',
      { is_double_glazed: true, frame_width: 400, frame_height: 1200 }
    )).toBe(false)
  })
})

// ── Arithmetic formulas ───────────────────────────────────────────────────────

describe('evaluateNumber — arithmetic formulas', () => {
  it('evaluates a plain numeric literal', () => {
    expect(evaluateNumber('50.33', {})).toBe(50.33)
  })

  it('adds two cost variables', () => {
    expect(evaluateNumber(
      'inner_pane_cost + outer_pane_cost',
      { inner_pane_cost: 40.00, outer_pane_cost: 35.50 }
    )).toBeCloseTo(75.50)
  })

  it('evaluates the glass unit cost expression from the architecture doc', () => {
    expect(evaluateNumber(
      '(inner_pane_cost + outer_pane_cost) + 50.33',
      { inner_pane_cost: 40.00, outer_pane_cost: 35.50 }
    )).toBeCloseTo(125.83)
  })

  it('computes frame area in m² from mm dimensions', () => {
    // 900 × 1200 mm → 1.08 m²
    expect(evaluateNumber(
      'frame_width * frame_height / 1000000',
      { frame_width: 900, frame_height: 1200 }
    )).toBeCloseTo(1.08)
  })

  it('handles subtraction', () => {
    expect(evaluateNumber(
      'base_price - discount_amount',
      { base_price: 500, discount_amount: 75 }
    )).toBe(425)
  })

  it('handles division', () => {
    expect(evaluateNumber('total_cost / 4', { total_cost: 300 })).toBe(75)
  })

  it('multiplies a variable by a literal', () => {
    expect(evaluateNumber('sash_count * 12.50', { sash_count: 4 })).toBeCloseTo(50.00)
  })

  it('handles nested parentheses', () => {
    // (900 + 100) × (1200 + 100) / 1,000,000 = 1000 × 1300 / 1,000,000 = 1.3
    expect(evaluateNumber(
      '((frame_width + 100) * (frame_height + 100)) / 1000000',
      { frame_width: 900, frame_height: 1200 }
    )).toBeCloseTo(1.3)
  })

  it('handles a variable used more than once in the expression', () => {
    // perimeter: 2 * (w + h)
    expect(evaluateNumber(
      '2 * (frame_width + frame_height)',
      { frame_width: 900, frame_height: 1200 }
    )).toBe(4200)
  })
})

// ── Raw evaluate ──────────────────────────────────────────────────────────────

describe('evaluate — raw return values', () => {
  it('returns a number for a numeric expression', () => {
    expect(evaluate('2 + 2', {})).toBe(4)
  })

  it('returns the value of a single variable', () => {
    expect(evaluate('unit_cost', { unit_cost: 12.99 })).toBe(12.99)
  })
})

// ── Error handling ────────────────────────────────────────────────────────────

describe('error handling', () => {
  it('throws a descriptive error including the variable name for undefined variables', () => {
    expect(() => evaluateCondition('undefined_var > 0', {}))
      .toThrow(/undefined_var/)
  })

  it('throws a descriptive error including the expression for a syntax error', () => {
    expect(() => evaluateCondition('and and and', {}))
      .toThrow(/and and and/)
  })

  it('evaluateNumber throws for division by zero (Infinity)', () => {
    expect(() => evaluateNumber('1 / 0', {}))
      .toThrow(/finite number/)
  })

  it('evaluateNumber throws for an expression returning NaN', () => {
    expect(() => evaluateNumber('0 / 0', {}))
      .toThrow(/finite number/)
  })

  it('evaluate error message includes the offending expression', () => {
    expect(() => evaluate('totally ^ invalid *** syntax !!!', {}))
      .toThrow()
  })
})
