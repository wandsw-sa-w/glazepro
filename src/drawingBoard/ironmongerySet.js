/**
 * ironmongerySet.js — Step BO
 *
 * The STORED ironmongery set: what the product picker may offer, what each
 * edit does to the set, and whether an item's set is the surveyor's own or
 * the rules'.
 *
 * Integrate keeps a set on every drawing item (`ironmongerySet`: id, finish,
 * qty per line) and prices exactly what is stored. GlazePro already PRICES a
 * stored set that way — `resolveIronmongeryLines` lets tree-saved lines win
 * over the default rules — but until this step the board had no way to put a
 * product INTO one: "+ Add manual line" made a line with an empty product,
 * which prices nothing. So a surveyor could not enter the set Integrate
 * holds, and GlazePro priced its own defaults instead (L34242 items 1-8 and
 * L34265 item 9, docs/step-bo-brief.md).
 *
 * Everything here is pure, so the picker's rules and the edit rules are
 * testable without the board: the panel in DrawingBoard.jsx is a view over
 * these functions.
 */

// ── A line's origin ──────────────────────────────────────────────────────────

/**
 * Where a stored line came from. A line the default rules made carries
 * `source: 'default'`; one a surveyor picked carries 'picked'. 'manual' is
 * the Step Z line the old "+ Add manual line" button made — kept so a
 * drawing saved before this step reads correctly.
 */
export const LINE_SOURCE_LABELS = {
  default: 'rule default',
  picked:  'chosen',
  manual:  'chosen',
}

export function lineSourceLabel(line) {
  return LINE_SOURCE_LABELS[line?.source] ?? 'chosen'
}

/** A line the SURVEYOR put there, rather than a default rule. */
export function isChosenLine(line) {
  return (line?.source ?? 'picked') !== 'default'
}

/**
 * Is this item's set the surveyor's own?
 *
 * Two readings, because a drawing saved before this step has no flag:
 *   - the stored flag `ironmongerySetEdited`, which every edit below sets;
 *   - any line that is not a rule default.
 *
 * It matters for two things: an edited set is never silently re-defaulted
 * (the panel's auto-apply is skipped, so a size change, a reload or any
 * other remount cannot overwrite it), and "Apply Defaults" asks first.
 */
export function isEditedSet(paintValues) {
  if (!paintValues) return false
  if (paintValues.ironmongerySetEdited === true) return true
  const lines = paintValues.ironmongeryLines
  return Array.isArray(lines) && lines.some(isChosenLine)
}

/** The lines a surveyor chose — what "Apply Defaults" would throw away. */
export function chosenLines(lines) {
  return (lines ?? []).filter(isChosenLine)
}

// ── The picker ───────────────────────────────────────────────────────────────

export const UNCATEGORISED = 'Uncategorised'

/**
 * The finish a picked line should start in.
 *
 * The item finish where the product EXISTS in it (the brief: "the finish
 * defaults to the item finish"), stored as an empty finish so the line keeps
 * following the item the way a default line does. Otherwise the product's
 * own single finish, stored explicitly — a product that exists only in PC
 * (the friction hinges, the Kenrick gearbox and extensions) must not be
 * stored as "follow the item", because the item finish is PB and the line
 * would resolve to PB, find nothing and price 0.00 (Step AQ item 5 fixed
 * exactly that for the RULE lines, using the rule's own finish as the
 * fallback; a picked line has no rule).
 *
 * Where neither applies — a trickle vent is Wht or Blk and the item is PB —
 * nothing is guessed: the picker asks. Step Z's finding stands, that a
 * guessed metal finish is a wrong price nobody sees (PB £26.25 against the
 * ABs £36.75 the drawing needed).
 *
 * @returns {{ finish: string|null, stored: string|null, reason: string }}
 *   `finish` is what the line will price in, `stored` is what goes on the
 *   line (null = follow the item), `reason` is one of 'item', 'only', 'ask'.
 */
export function pickerFinishFor(product, itemFinish) {
  const finishes = (product?.finishes ?? []).map(f => f.code)
  if (itemFinish && finishes.includes(itemFinish)) {
    return { finish: itemFinish, stored: null, reason: 'item' }
  }
  if (finishes.length === 1) {
    return { finish: finishes[0], stored: finishes[0], reason: 'only' }
  }
  return { finish: null, stored: null, reason: 'ask' }
}

/**
 * One product's unit cost in a finish, for the picker's cost column.
 * Integrate's own "Ironmongery Cost" line is round(cost × qty, 0.1) × 1.05,
 * so this is the catalogue cost the line is built from, not the line total.
 */
export function finishCost(product, finish) {
  const row = (product?.finishes ?? []).find(f => f.code === finish)
  return row ? row.cost : null
}

/**
 * The catalogue rows the picker may offer, grouped by category.
 *
 * Left out, with a reason the caller can show:
 *   - a product with no `short_name`: a stored line is keyed by short_name
 *     and nothing else, so a product without one could never price (193 of
 *     the 630 live products, read 16 Oct);
 *   - a product with no costed, available variant: there is nothing to cost.
 *
 * `query` matches the name or the code, case-insensitively. Groups are
 * alphabetical with Uncategorised last — 388 of the live products have no
 * category at all, and they are the Integrate-imported ones every stored set
 * is made of, so they must not be hidden away.
 *
 * @param {Array}  products  [{ short_name, name, category, finishes: [{ code, cost, available }] }]
 * @param {Object} [opts]
 * @param {string} [opts.query]
 * @param {string} [opts.itemFinish]  the item's ironmongery finish
 */
export function pickerGroups(products, { query = '', itemFinish = null } = {}) {
  const needle = String(query ?? '').trim().toLowerCase()
  const usable = (products ?? [])
    .filter(p => p && p.short_name)
    .map(p => ({
      ...p,
      finishes: (p.finishes ?? [])
        .filter(f => f && f.code && f.cost != null && f.available !== false)
        .map(f => ({ code: f.code, cost: Number(f.cost) }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    }))
    .filter(p => p.finishes.length > 0)
    .filter(p => !needle ||
      String(p.name ?? '').toLowerCase().includes(needle) ||
      String(p.short_name).toLowerCase().includes(needle))
    .map(p => {
      const pick = pickerFinishFor(p, itemFinish)
      return {
        short_name: p.short_name,
        name:       p.name ?? p.short_name,
        category:   p.category || UNCATEGORISED,
        finishes:   p.finishes,
        finish:     pick.finish,
        storedFinish: pick.stored,
        finishReason: pick.reason,
        cost:       pick.finish ? finishCost(p, pick.finish) : null,
      }
    })

  const byCategory = new Map()
  for (const p of usable) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, [])
    byCategory.get(p.category).push(p)
  }
  return [...byCategory.entries()]
    .map(([category, items]) => ({
      category,
      products: items.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => {
      if (a.category === UNCATEGORISED) return 1
      if (b.category === UNCATEGORISED) return -1
      return a.category.localeCompare(b.category)
    })
}

/** How many products the picker is offering, across the groups. */
export function pickerCount(groups) {
  return (groups ?? []).reduce((n, g) => n + g.products.length, 0)
}

// ── Editing the set ──────────────────────────────────────────────────────────

/**
 * Add a picked product to the set.
 *
 * The same product in the same finish is MERGED by qty rather than stored
 * twice: the money is identical either way, and Integrate's own sets hold
 * one line per product with a qty (`kenrick_extension_950mm:PC x4`).
 *
 * @param {Array} lines
 * @param {{ product_short_name: string, finish_code?: string|null, qty?: number }} pick
 */
export function addPickedLine(lines, pick) {
  const short = pick?.product_short_name
  if (!short) return lines ?? []
  const finish = pick.finish_code ?? null
  const qty    = Number(pick.qty) > 0 ? Number(pick.qty) : 1
  const existing = (lines ?? []).findIndex(l =>
    l.product_short_name === short && (l.finish_code ?? null) === finish)
  if (existing >= 0) {
    return lines.map((l, i) => i === existing ? { ...l, qty: (Number(l.qty) || 0) + qty } : l)
  }
  return [...(lines ?? []), {
    product_short_name: short,
    finish_code:   finish,
    qty,
    source:        'picked',
    rule_id:       null,
    scope_part_id: null,
  }]
}

export function removeLineAt(lines, idx) {
  return (lines ?? []).filter((_, i) => i !== idx)
}

export function setLineQty(lines, idx, qty) {
  const parsed = Number(qty)
  if (!Number.isFinite(parsed) || parsed <= 0) return lines ?? []
  return (lines ?? []).map((l, i) => i === idx ? { ...l, qty: parsed } : l)
}

export function setLineFinish(lines, idx, finish) {
  return (lines ?? []).map((l, i) => i === idx ? { ...l, finish_code: finish || null } : l)
}

/**
 * "Apply Defaults": the rule defaults, and nothing else.
 *
 * Step BO item 2 — the button "puts the rule defaults back", so it REPLACES
 * the set rather than keeping the chosen lines alongside the defaults as it
 * did before this step. That is what the confirm is for: `chosenLines`
 * counts what will go, and the panel names the number before asking.
 */
export function defaultsBack(defaultLines) {
  return (defaultLines ?? []).map(l => ({ ...l, source: 'default' }))
}

/**
 * The patch the board writes for a set edit: the lines, plus the flag that
 * stops anything re-defaulting them. One patch, so the drawing's history
 * shows one change (and `handleChangeIronmongerySet` commits it as one).
 */
export function setPatch(lines, { edited = true } = {}) {
  return { ironmongeryLines: lines, ironmongerySetEdited: edited === true }
}
