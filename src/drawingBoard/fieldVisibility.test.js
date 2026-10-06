import { describe, it, expect } from 'vitest'
import { isFieldHidden, hiddenTag } from './fieldVisibility'

describe('isFieldHidden', () => {
  // ── shown ────────────────────────────────────────────────────────────────
  it('returns false for "shown" in sales mode', () => {
    expect(isFieldHidden('shown', 'sales', false)).toBe(false)
  })
  it('returns false for "shown" in survey mode', () => {
    expect(isFieldHidden('shown', 'survey', false)).toBe(false)
  })
  it('returns false for undefined visibility', () => {
    expect(isFieldHidden(undefined, 'sales', false)).toBe(false)
  })
  it('returns false for null visibility', () => {
    expect(isFieldHidden(null, 'survey', false)).toBe(false)
  })

  // ── hidden_always ────────────────────────────────────────────────────────
  it('returns true for "hidden_always" in sales mode', () => {
    expect(isFieldHidden('hidden_always', 'sales', false)).toBe(true)
  })
  it('returns true for "hidden_always" in survey mode', () => {
    expect(isFieldHidden('hidden_always', 'survey', false)).toBe(true)
  })

  // ── hidden_sales ─────────────────────────────────────────────────────────
  it('returns true for "hidden_sales" in sales mode', () => {
    expect(isFieldHidden('hidden_sales', 'sales', false)).toBe(true)
  })
  it('returns false for "hidden_sales" in survey mode', () => {
    expect(isFieldHidden('hidden_sales', 'survey', false)).toBe(false)
  })

  // ── hidden_survey ────────────────────────────────────────────────────────
  it('returns true for "hidden_survey" in survey mode', () => {
    expect(isFieldHidden('hidden_survey', 'survey', false)).toBe(true)
  })
  it('returns false for "hidden_survey" in sales mode', () => {
    expect(isFieldHidden('hidden_survey', 'sales', false)).toBe(false)
  })

  // ── showHidden override ──────────────────────────────────────────────────
  it('returns false for "hidden_always" when showHidden is true', () => {
    expect(isFieldHidden('hidden_always', 'sales', true)).toBe(false)
  })
  it('returns false for "hidden_sales" when showHidden is true', () => {
    expect(isFieldHidden('hidden_sales', 'sales', true)).toBe(false)
  })
  it('returns false for "hidden_survey" when showHidden is true', () => {
    expect(isFieldHidden('hidden_survey', 'survey', true)).toBe(false)
  })
})

describe('hiddenTag', () => {
  it('returns null for "shown"', () => {
    expect(hiddenTag('shown', 'sales')).toBe(null)
  })
  it('returns null for null/undefined visibility', () => {
    expect(hiddenTag(null, 'sales')).toBe(null)
    expect(hiddenTag(undefined, 'survey')).toBe(null)
  })
  it('returns "hidden" for "hidden_always"', () => {
    expect(hiddenTag('hidden_always', 'sales')).toBe('hidden')
  })
  it('returns "hidden in Sales" for "hidden_sales"', () => {
    expect(hiddenTag('hidden_sales', 'sales')).toBe('hidden in Sales')
  })
  it('returns "hidden in Survey" for "hidden_survey"', () => {
    expect(hiddenTag('hidden_survey', 'survey')).toBe('hidden in Survey')
  })
})
