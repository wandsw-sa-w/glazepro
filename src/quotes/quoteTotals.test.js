import { describe, it, expect } from 'vitest'
import { computeQuoteTotals } from './quoteTotals.js'

// ── L34355 Q4 — the canonical benchmark ──────────────────────────────────────

describe('computeQuoteTotals — L34355 Q4', () => {
  const settings = { discountPct: 5, depositPct: 40, interimPct: 50 }
  const items = [
    { calculated: 3543.40, vatRate: 20 },
    { calculated: 3157.50, vatRate: 20 },
    { calculated: 9724.53, vatRate: 20 },
    { calculated: 3001.17, vatRate: 20 },
    { calculated: 2706.05, vatRate: 20 },
    { calculated: 10239.66, vatRate: 20 },
    { calculated: 10291.15, vatRate: 20 },
  ]

  let result
  it('computes without error', () => {
    result = computeQuoteTotals(settings, items)
    expect(result).toBeDefined()
  })

  it('subtotalBeforeDiscount = 42,663.46', () => {
    result = computeQuoteTotals(settings, items)
    expect(result.subtotalBeforeDiscount).toBe(42663.46)
  })

  it('discountAmount = 2,133.17 (5% of 42,663.46)', () => {
    result = computeQuoteTotals(settings, items)
    expect(result.discountAmount).toBe(2133.17)
  })

  it('subtotalAfterDiscount = 40,530.29', () => {
    result = computeQuoteTotals(settings, items)
    expect(result.subtotalAfterDiscount).toBe(40530.29)
  })

  it('VAT @ 20% = 8,106.06', () => {
    result = computeQuoteTotals(settings, items)
    expect(result.vatByRate['20']).toBe(8106.06)
  })

  it('totalInclVat = 48,636.35', () => {
    result = computeQuoteTotals(settings, items)
    expect(result.totalInclVat).toBe(48636.35)
  })

  it('deposit (40%) = 19,454.54', () => {
    result = computeQuoteTotals(settings, items)
    expect(result.stages.deposit).toBe(19454.54)
  })

  it('interim (50%) = 24,318.18', () => {
    result = computeQuoteTotals(settings, items)
    expect(result.stages.interim).toBe(24318.18)
  })

  it('balance = 4,863.63 (total - deposit - interim)', () => {
    result = computeQuoteTotals(settings, items)
    const { deposit, interim, balance } = result.stages
    expect(balance).toBe(4863.63)
    // Balance is computed as remainder so stages always add to total
    expect(Math.round((deposit + interim + balance) * 100) / 100).toBe(result.totalInclVat)
  })

  it('item 1 net = 3,543.40 (no item discount)', () => {
    result = computeQuoteTotals(settings, items)
    expect(result.items[0].net).toBe(3543.40)
  })

  it('item 1 netAfterQuoteDiscount = 3,366.23 (5% off 3,543.40)', () => {
    result = computeQuoteTotals(settings, items)
    expect(result.items[0].netAfterQuoteDiscount).toBe(3366.23)
  })
})

// ── Mixed VAT rates ───────────────────────────────────────────────────────────

describe('computeQuoteTotals — mixed VAT', () => {
  it('splits VAT by rate and totals correctly', () => {
    const settings = { discountPct: 0, depositPct: 40, interimPct: 50 }
    const items = [
      { calculated: 1000, vatRate: 20 },
      { calculated: 2000, vatRate: 5 },
    ]
    const r = computeQuoteTotals(settings, items)
    expect(r.subtotalBeforeDiscount).toBe(3000)
    expect(r.vatByRate['20']).toBe(200)    // 1000 × 20%
    expect(r.vatByRate['5']).toBe(100)     // 2000 × 5%
    expect(r.totalVat).toBe(300)
    expect(r.totalInclVat).toBe(3300)
    // Only two VAT lines
    expect(Object.keys(r.vatByRate)).toHaveLength(2)
  })
})

// ── 0% VAT ───────────────────────────────────────────────────────────────────

describe('computeQuoteTotals — zero VAT', () => {
  it('produces no VAT charge and correct total', () => {
    const r = computeQuoteTotals({ discountPct: 0 }, [
      { calculated: 500, vatRate: 0 },
    ])
    expect(r.vatByRate['0']).toBe(0)
    expect(r.totalVat).toBe(0)
    expect(r.totalInclVat).toBe(500)
  })
})

// ── 0% discount ──────────────────────────────────────────────────────────────

describe('computeQuoteTotals — zero discount', () => {
  it('discountAmount = 0 and subtotals match', () => {
    const r = computeQuoteTotals({ discountPct: 0 }, [
      { calculated: 1200, vatRate: 20 },
    ])
    expect(r.discountAmount).toBe(0)
    expect(r.subtotalBeforeDiscount).toBe(r.subtotalAfterDiscount)
  })
})

// ── priceOverride ─────────────────────────────────────────────────────────────

describe('computeQuoteTotals — priceOverride', () => {
  it('uses priceOverride instead of calculated', () => {
    const r = computeQuoteTotals({ discountPct: 0 }, [
      { calculated: 2000, priceOverride: 1500, vatRate: 20 },
    ])
    expect(r.items[0].net).toBe(1500)
    expect(r.subtotalBeforeDiscount).toBe(1500)
  })
})

// ── itemDiscountPct ───────────────────────────────────────────────────────────

describe('computeQuoteTotals — itemDiscountPct', () => {
  it('applies item-level discount before quote discount', () => {
    // item net = 1000 × (1 - 0.10) = 900
    // netAfterQuote = 900 × (1 - 0.05) = 855
    const r = computeQuoteTotals({ discountPct: 5 }, [
      { calculated: 1000, itemDiscountPct: 10, vatRate: 20 },
    ])
    expect(r.items[0].net).toBe(900)
    expect(r.items[0].netAfterQuoteDiscount).toBe(855)
  })
})

// ── POA ───────────────────────────────────────────────────────────────────────

describe('computeQuoteTotals — POA', () => {
  it('excludes POA items from all totals', () => {
    const r = computeQuoteTotals({ discountPct: 0 }, [
      { calculated: 1000, vatRate: 20 },
      { poa: true },
      { calculated: 500, vatRate: 20 },
    ])
    expect(r.poaItems).toEqual([1])
    expect(r.items[1].poa).toBe(true)
    expect(r.items[1].net).toBeNull()
    expect(r.subtotalBeforeDiscount).toBe(1500)  // POA excluded
    expect(r.totalInclVat).toBe(1800)            // 1500 + 300 VAT
  })

  it('returns empty totals when all items are POA', () => {
    const r = computeQuoteTotals({ discountPct: 5 }, [
      { poa: true },
      { poa: true },
    ])
    expect(r.subtotalBeforeDiscount).toBe(0)
    expect(r.totalInclVat).toBe(0)
    expect(r.poaItems).toEqual([0, 1])
  })
})

// ── Stages add up ─────────────────────────────────────────────────────────────

describe('computeQuoteTotals — stage rounding', () => {
  it('deposit + interim + balance always equals total (no penny gap)', () => {
    // 48636.35 × 50% = 24318.175 — rounds to 24318.18 not 24318.17
    const r = computeQuoteTotals(
      { discountPct: 5, depositPct: 40, interimPct: 50 },
      Array.from({ length: 7 }, (_, i) => ({
        calculated: [3543.40, 3157.50, 9724.53, 3001.17, 2706.05, 10239.66, 10291.15][i],
        vatRate: 20,
      }))
    )
    const { deposit, interim, balance } = r.stages
    expect(
      Math.round((deposit + interim + balance) * 100) / 100
    ).toBe(r.totalInclVat)
  })
})

// ── Default settings ──────────────────────────────────────────────────────────

describe('computeQuoteTotals — defaults', () => {
  it('defaults to 0% discount, 40/50 stages, 20% VAT', () => {
    const r = computeQuoteTotals({}, [{ calculated: 1000 }])
    expect(r.discountAmount).toBe(0)
    expect(r.vatByRate['20']).toBe(200)
    expect(r.stages.deposit).toBe(480)
    expect(r.stages.interim).toBe(600)
    expect(r.stages.balance).toBe(120)
    expect(r.totalInclVat).toBe(1200)
  })
})
