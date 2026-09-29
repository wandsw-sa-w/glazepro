import { describe, it, expect } from 'vitest'
import {
  isDrawingStale,
  validatePublish,
  nextQuoteNumber,
  isLocked,
} from './publishValidation.js'

// ── isDrawingStale ────────────────────────────────────────────────────────────

describe('isDrawingStale', () => {
  it('is stale when no run exists', () => {
    expect(isDrawingStale({ price_file_id: 'pf1' }, 'dwg1', {})).toBe(true)
  })

  it('is not stale when run exists with same price file', () => {
    const runs = { dwg1: { price_file_id: 'pf1', status: 'complete' } }
    expect(isDrawingStale({ price_file_id: 'pf1' }, 'dwg1', runs)).toBe(false)
  })

  it('is stale when run used a different price file', () => {
    const runs = { dwg1: { price_file_id: 'pf_old', status: 'complete' } }
    expect(isDrawingStale({ price_file_id: 'pf_new' }, 'dwg1', runs)).toBe(true)
  })

  it('is not stale when quote has no price file set', () => {
    const runs = { dwg1: { price_file_id: 'pf1', status: 'complete' } }
    expect(isDrawingStale({ price_file_id: null }, 'dwg1', runs)).toBe(false)
  })
})

// ── validatePublish ───────────────────────────────────────────────────────────

describe('validatePublish — refuses stale drawings', () => {
  it('returns ok:false with staleDwgIds when drawing is stale', () => {
    const quote    = { id: 'q1', price_file_id: 'pf1' }
    const jobItems = [{ id: 'ji1', item_number: 1 }]
    const drawings = [{ id: 'dwg1', poa: false, calculated_price: 1000 }]
    const sels     = { 'q1_ji1': 'dwg1' }
    const runs     = {}  // no runs → stale

    const result = validatePublish(quote, jobItems, drawings, sels, runs)
    expect(result.ok).toBe(false)
    expect(result.staleDwgIds).toEqual(['dwg1'])
    expect(result.reason).toMatch(/need pricing/)
  })

  it('returns ok:true when drawing has a valid run', () => {
    const quote    = { id: 'q1', price_file_id: 'pf1' }
    const jobItems = [{ id: 'ji1', item_number: 1 }]
    const drawings = [{ id: 'dwg1', poa: false, calculated_price: 1000 }]
    const sels     = { 'q1_ji1': 'dwg1' }
    const runs     = { dwg1: { price_file_id: 'pf1', status: 'complete' } }

    const result = validatePublish(quote, jobItems, drawings, sels, runs)
    expect(result.ok).toBe(true)
    expect(result.staleDwgIds).toHaveLength(0)
  })

  it('ignores items with no drawing selection', () => {
    const quote    = { id: 'q1', price_file_id: 'pf1' }
    const jobItems = [{ id: 'ji1', item_number: 1 }, { id: 'ji2', item_number: 2 }]
    const drawings = [{ id: 'dwg1', poa: false, calculated_price: 1000 }]
    const sels     = { 'q1_ji1': 'dwg1' }  // ji2 has no selection
    const runs     = { dwg1: { price_file_id: 'pf1', status: 'complete' } }

    const result = validatePublish(quote, jobItems, drawings, sels, runs)
    expect(result.ok).toBe(true)
  })
})

describe('validatePublish — POA confirmation required', () => {
  it('returns poaItemIndices when a POA drawing is selected (but ok:true)', () => {
    const quote    = { id: 'q1', price_file_id: 'pf1' }
    const jobItems = [{ id: 'ji1', item_number: 1 }, { id: 'ji2', item_number: 2 }]
    const drawings = [
      { id: 'dwg1', poa: false, calculated_price: 1000 },
      { id: 'dwg2', poa: true,  calculated_price: null },
    ]
    const sels = { 'q1_ji1': 'dwg1', 'q1_ji2': 'dwg2' }
    const runs = {
      dwg1: { price_file_id: 'pf1', status: 'complete' },
      dwg2: { price_file_id: 'pf1', status: 'complete' },
    }

    const result = validatePublish(quote, jobItems, drawings, sels, runs)
    expect(result.ok).toBe(true)
    expect(result.poaItemIndices).toEqual([1])
  })
})

// ── nextQuoteNumber ───────────────────────────────────────────────────────────

describe('nextQuoteNumber', () => {
  it('returns Q1 for empty list', () => {
    expect(nextQuoteNumber([])).toBe('Q1')
  })

  it('returns Q(n+1) for existing quotes', () => {
    expect(nextQuoteNumber([{}, {}, {}])).toBe('Q4')
  })
})

// ── isLocked ──────────────────────────────────────────────────────────────────

describe('isLocked', () => {
  it('Open is not locked', () => expect(isLocked({ status: 'Open' })).toBe(false))
  it('Published is locked', () => expect(isLocked({ status: 'Published' })).toBe(true))
  it('Accepted is locked', () => expect(isLocked({ status: 'Accepted' })).toBe(true))
})
