/**
 * poaLines.js — Step BS
 *
 * Two things Integrate keeps on a drawing that GlazePro had no home for:
 *
 *   1. SPECIAL GLASS. A glass unit marked `specialGlassDetails` is priced
 *      outside the price file: the Glass group is empty for that unit and
 *      everything else (glazing labour, beads, bars) prices as normal
 *      (docs/integrate-drawing-gaps.txt P1 — "the price file then has NO
 *      glass line at all").
 *
 *   2. PRICE-ON-APPLICATION LINES on the item's Price part: a list of manual
 *      lines, each with a type, a category, a description and an amount.
 *      A labour / installation line's amount is MINUTES, added to the
 *      installation hours (P1: 120 min, P2 / LQ4: 180 min). A cost line's
 *      amount is pounds, priced through PF30's "Drawing POA" rule
 *      (quantity poa_cost x value 1, markup 2, loop_target drawing_poa).
 *
 * Both live in `values` on parts every drawing already has — `glassPart`
 * and `pricePart` — so nothing in the database changes.
 */

// ── Special glass ────────────────────────────────────────────────────────────

/** Integrate's own key, so a tree read from Integrate's dump means the same. */
export const SPECIAL_GLASS_KEY = 'specialGlassDetails'

export function isSpecialGlassUnit(node) {
  return node?.part_type === 'glassPart' && node.values?.[SPECIAL_GLASS_KEY] === true
}

/**
 * The price-rule group that a special glass unit contributes NOTHING to.
 * P1's price file has an empty Glass group and every other group intact:
 * the Glazing Bar (manufacture materials), the glazing labour and the beads
 * all still price. So the gate is the one group, not the glass_unit loop.
 */
export const SPECIAL_GLASS_SKIPPED_GROUP = 'glass_done'

// ── POA lines ────────────────────────────────────────────────────────────────

/**
 * What the PF30 snapshot's rules can read, and nothing more:
 *   - `labour` / `installation`: minutes into the installation hours. This
 *     is the only labour kind the facts show (P1, P2), and the only one
 *     with a rule behind it — the "Labour" price rule prices
 *     installation_labour_time.
 *   - `cost` / `extra_services`: pounds, through "Drawing POA" — the one
 *     rule that loops drawing_poa, and it is in group extra_services.
 * No snapshot rule reads any other type or category, so none is offered.
 */
export const POA_TYPES = [
  { code: 'labour', label: 'Labour (minutes)' },
  { code: 'cost',   label: 'Cost (£)' },
]
export const POA_CATEGORIES = {
  labour: [{ code: 'installation', label: 'Installation' }],
  cost:   [{ code: 'extra_services', label: 'Extra services' }],
}

export function defaultCategoryFor(type) {
  return POA_CATEGORIES[type]?.[0]?.code ?? null
}

export function newPoaLine(type = 'labour') {
  return { type, category: defaultCategoryFor(type), description: '', amount: null }
}

/** A line as stored, with the amount as a number (null when not entered). */
export function normalisePoaLine(line) {
  const type = String(line?.type ?? 'labour').toLowerCase()
  const amount = line?.amount == null || line.amount === '' ? null : Number(line.amount)
  return {
    type,
    category:    String(line?.category ?? defaultCategoryFor(type) ?? '').toLowerCase(),
    description: String(line?.description ?? ''),
    amount:      Number.isFinite(amount) ? amount : null,
  }
}

/** The item's POA lines, from its Price part. */
export function poaLinesOf(tree) {
  const price = findPricePart(tree)
  const lines = price?.values?.poaLines
  if (!Array.isArray(lines)) return []
  return lines.map(normalisePoaLine)
}

function findPricePart(node) {
  if (!node) return null
  if (node.part_type === 'pricePart') return node
  for (const c of (node.children ?? [])) {
    const f = findPricePart(c)
    if (f) return f
  }
  return null
}

/** The labour / installation lines: each one's amount is minutes. */
export function poaInstallLines(tree) {
  return poaLinesOf(tree).filter(l =>
    l.type === 'labour' && l.category === 'installation' && l.amount != null && l.amount > 0)
}

export function poaInstallMinutes(tree) {
  return poaInstallLines(tree).reduce((n, l) => n + l.amount, 0)
}

/**
 * The cost lines — what loop_target `drawing_poa` ITERATES: one iteration
 * per cost line, with `poa_cost` = that line's amount, so the rule prices
 * each line on its own and the sum over the loop is the item's POA cost.
 */
export function poaCostLines(tree) {
  return poaLinesOf(tree).filter(l =>
    l.type === 'cost' && l.amount != null && l.amount !== 0)
}

// ── Editing (the board's panel is a view over these) ─────────────────────────

export function addPoaLine(lines, type = 'labour') {
  return [...(lines ?? []), newPoaLine(type)]
}

export function removePoaLineAt(lines, idx) {
  return (lines ?? []).filter((_, i) => i !== idx)
}

export function setPoaLineField(lines, idx, field, value) {
  return (lines ?? []).map((l, i) => {
    if (i !== idx) return l
    const next = { ...l, [field]: value }
    // a type change re-homes the category, since each type has its own list
    if (field === 'type' && !(POA_CATEGORIES[value] ?? []).some(c => c.code === l.category)) {
      next.category = defaultCategoryFor(value)
    }
    return next
  })
}
