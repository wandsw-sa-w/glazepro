/**
 * quoteTotals.js — pure, tested
 *
 * computeQuoteTotals(settings, items) → totals object.
 * No I/O. Safe to call in tests, pricing engine, and UI render paths.
 *
 * settings: {
 *   discountPct   number  quote-level discount % (default 0)
 *   depositPct    number  deposit stage % (default 40)
 *   interimPct    number  interim stage % (default 50)
 *   // balancePct is derived: 100 - deposit - interim, but balance is computed
 *   // as total - deposit - interim to avoid rounding drift
 * }
 *
 * items[]: {
 *   calculated      number  drawing's engine sales price + apportioned quote-level rules
 *   priceOverride   number|null  optional override (net £, replaces calculated)
 *   itemDiscountPct number  item-level discount % applied before quote discount (default 0)
 *   vatRate         number  20 | 5 | 0 (default 20)
 *   poa             boolean if true, excluded from all totals
 * }
 *
 * Returns: {
 *   items: [{net, netAfterQuoteDiscount, vat, vatRate, poa}]
 *   subtotalBeforeDiscount
 *   discountAmount
 *   subtotalAfterDiscount
 *   vatByRate: { '20': amount, '5': amount, '0': amount }  // only rates that appear
 *   totalVat
 *   totalInclVat
 *   stages: { deposit, interim, balance }
 *   poaItems: number[]  // indices into items[] that are POA
 * }
 *
 * Rounding: each displayed money value is rounded to 2 dp.
 * Balance = total − deposit − interim (no extra rounding) so stages always sum to total.
 * VAT is computed on the group total for each rate (not summed per-item) to match Integrate.
 */

function r2(x) {
  return Math.round(x * 100) / 100
}

/**
 * Compute quote totals.
 *
 * @param {{ discountPct?: number, depositPct?: number, interimPct?: number }} settings
 * @param {Array<{calculated?: number, priceOverride?: number|null, itemDiscountPct?: number, vatRate?: number, poa?: boolean}>} items
 */
export function computeQuoteTotals(settings, items) {
  const discountPct = settings.discountPct ?? 0
  const depositPct  = settings.depositPct  ?? 40
  const interimPct  = settings.interimPct  ?? 50

  const poaItems = []

  // ── Per-item calculations ─────────────────────────────────────────────────

  const itemResults = (items ?? []).map((item, idx) => {
    if (item.poa) {
      poaItems.push(idx)
      return { net: null, netAfterQuoteDiscount: null, vat: null, vatRate: null, poa: true }
    }

    const vatRate   = item.vatRate ?? 20
    const calculated = item.calculated ?? 0

    // Item-level net (before quote discount)
    let net
    if (item.priceOverride != null && item.priceOverride !== '') {
      net = r2(parseFloat(item.priceOverride) || 0)
    } else {
      const idp = item.itemDiscountPct ?? 0
      net = r2(calculated * (1 - idp / 100))
    }

    const netAfterQuoteDiscount = r2(net * (1 - discountPct / 100))

    // Per-item VAT is for display only; authoritative VAT is by rate group below.
    const vat = r2(netAfterQuoteDiscount * vatRate / 100)

    return { net, netAfterQuoteDiscount, vat, vatRate, poa: false }
  })

  const priceItems = itemResults.filter(it => !it.poa)

  // ── Quote-level aggregation ───────────────────────────────────────────────

  const subtotalBeforeDiscount = r2(priceItems.reduce((s, it) => s + it.net, 0))
  const subtotalAfterDiscount  = r2(priceItems.reduce((s, it) => s + it.netAfterQuoteDiscount, 0))
  const discountAmount         = r2(subtotalBeforeDiscount - subtotalAfterDiscount)

  // ── VAT by rate (computed on group totals, not summed per-item) ───────────

  const vatGroups = {}
  for (const it of priceItems) {
    const key = String(it.vatRate)
    vatGroups[key] = (vatGroups[key] ?? 0) + it.netAfterQuoteDiscount
  }

  const vatByRate = {}
  for (const [rateStr, groupNet] of Object.entries(vatGroups)) {
    vatByRate[rateStr] = r2(groupNet * Number(rateStr) / 100)
  }

  const totalVat    = r2(Object.values(vatByRate).reduce((s, v) => s + v, 0))
  const totalInclVat = r2(subtotalAfterDiscount + totalVat)

  // ── Payment stages ────────────────────────────────────────────────────────

  const deposit = r2(totalInclVat * depositPct / 100)
  const interim  = r2(totalInclVat * interimPct / 100)
  const balance  = r2(totalInclVat - deposit - interim)

  return {
    items: itemResults,
    subtotalBeforeDiscount,
    discountAmount,
    subtotalAfterDiscount,
    vatByRate,
    totalVat,
    totalInclVat,
    stages: { deposit, interim, balance },
    poaItems,
  }
}
