import { describe, it, expect } from 'vitest'
import { drawingNetPrice, drawingPfName, drawingCardLabel, drawingPickerLabel } from './drawingPrice.js'

const runPrices = { d1: { sales: 1622.44 } }
const priceFiles = [{ id: 'pf1', name: 'PF 30' }]
const latestRuns = { d1: { price_file_id: 'pf1' } }

describe('drawingNetPrice', () => {
  it('reads the latest-run price, not drawings.calculated_price', () => {
    // calculated_price deliberately wrong/stale here — must be ignored.
    const drawing = { id: 'd1', poa: false, calculated_price: 68.8, price_override: null }
    expect(drawingNetPrice(drawing, runPrices)).toBeCloseTo(1622.44, 2)
  })

  it('returns null for a POA drawing', () => {
    const drawing = { id: 'd1', poa: true, price_override: null }
    expect(drawingNetPrice(drawing, runPrices)).toBeNull()
  })

  it('price_override still wins', () => {
    const drawing = { id: 'd1', poa: false, price_override: 2000 }
    expect(drawingNetPrice(drawing, runPrices)).toBe(2000)
  })

  it('returns null when there is no price and no override', () => {
    const drawing = { id: 'd2', poa: false, price_override: null }
    expect(drawingNetPrice(drawing, runPrices)).toBeNull()
  })
})

describe('drawingCardLabel', () => {
  it('formats "PF 30 £1,622.44 Qty 1" from the run price', () => {
    const drawing = { id: 'd1', poa: false, calculated_price: 68.8, price_override: null }
    expect(drawingCardLabel(drawing, priceFiles, latestRuns, runPrices)).toBe('PF 30 £1,622.44 Qty 1')
  })

  it('shows POA instead of a price', () => {
    const drawing = { id: 'd1', poa: true }
    expect(drawingCardLabel(drawing, priceFiles, latestRuns, runPrices)).toBe('PF 30 POA Qty 1')
  })

  it('shows "—" when there is no run yet', () => {
    const drawing = { id: 'd9', poa: false, price_override: null }
    expect(drawingCardLabel(drawing, priceFiles, latestRuns, runPrices)).toBe('— — Qty 1')
  })

  it('respects a custom qty', () => {
    const drawing = { id: 'd1', poa: false, price_override: null }
    expect(drawingCardLabel(drawing, priceFiles, latestRuns, runPrices, 3)).toBe('PF 30 £1,622.44 Qty 3')
  })
})

describe('drawingPickerLabel', () => {
  it('prefixes the card label with the drawing number', () => {
    const drawing = { id: 'd1', poa: false, price_override: null }
    expect(drawingPickerLabel(drawing, 2, priceFiles, latestRuns, runPrices)).toBe('Drawing 2 · PF 30 £1,622.44 Qty 1')
  })
})

describe('drawingPfName', () => {
  it('looks up the price file name from the latest run', () => {
    const drawing = { id: 'd1' }
    expect(drawingPfName(drawing, priceFiles, latestRuns)).toBe('PF 30')
  })

  it('returns "—" when there is no run', () => {
    const drawing = { id: 'd9' }
    expect(drawingPfName(drawing, priceFiles, latestRuns)).toBe('—')
  })
})
