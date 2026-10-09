// cillReplacement.js — the ONE path that sets a cill replacement.
//
// Nathan's rule (9 Oct 2026): a new cill is sold with a sash replacement,
// with a draught seal and overhaul, or — rarely — on its own. Sash windows
// only, never casements, doors or anything else.
//
// Integrate (docs/integrate-L31115-cill.txt):
//  - Cill > "Repair" is N/A or "New Cill" (CillPart.cillRepairId 2); PF30
//    offers only those two.
//  - Choosing New Cill reveals "Full Cill Replacement"
//    (CillPart.isBrickToBrickCill). Ticked, the cill width became the full
//    frame width (900 → 1070 on benchmark G) and the PRICE DID NOT CHANGE.
//    GlazePro already derives cill_length_in_mm from the frame width, so the
//    tick changes nothing here either — it is stored for the workshop.
//  - "No Work" on the item DISABLES the cill repair (greyed; saving cleared
//    it), so GlazePro does not offer it there either.
//  - A stand-alone cill is every item flag false plus New Cill, which
//    Integrate's summary calls "Other"; GlazePro has a named type of work
//    for it, `cill_only` (sql/step-am1-cill-replacement-fields.sql).
//  - Integrate prices NO cill timber for a repair: the Box Frame Utile Cill
//    rule only fires when the frame is replaced.
//
// What it costs, identically on all three benchmarks: a Cill Replacement
// line (1.00 × markup 200 = 200.00, extra_profits) and 2.50 h of install
// labour ("Hardwood Cill Replacement", 150 min). Both rules are already in
// PF30 and both key on `new_cill_qty`.

export const NEW_CILL_REPAIR_CODE   = 'new_cill'
export const CILL_ONLY_TYPE_OF_WORK = 'cill_only'

export const CILL_ONLY_NOTE =
  'Cill replacement only — the sashes are not replaced'

/**
 * The types of work a cill repair is offered on: every sash-window service
 * EXCEPT complete new (the whole frame including the cill is new there, and
 * Integrate's new_cill_qty excludes it) and no_work (Integrate greys the
 * field out).
 */
export const CILL_REPAIR_TYPES_OF_WORK = [
  'new_pair_of_sashes',
  'draught_seal',
  'bi_glass',
  CILL_ONLY_TYPE_OF_WORK,
]

// ── Tree helpers (local copies — this module stays pure) ────────────────────

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

function findAll(node, partType, acc = []) {
  if (!node) return acc
  if (node.part_type === partType) acc.push(node)
  for (const child of (node.children ?? [])) findAll(child, partType, acc)
  return acc
}

function updateNodeValues(tree, key, patch) {
  if (!tree) return tree
  if (tree.key === key) return { ...tree, values: { ...tree.values, ...patch } }
  return { ...tree, children: (tree.children ?? []).map(c => updateNodeValues(c, key, patch)) }
}

/** Box sash window — the same test Step AJ uses (is_box_sash). */
function isSashWindowTree(tree) {
  return findAll(tree, 'sashPairPart').length > 0 &&
         findAll(tree, 'casementSashPart').length === 0 &&
         findAll(tree, 'doorLeafPart').length === 0
}

// ── The rule ─────────────────────────────────────────────────────────────────

/** Is a cill repair offered on this drawing at all? */
export function cillRepairApplies(tree) {
  if (!isSashWindowTree(tree)) return false
  const typeOfWork = findFirst(tree, 'drawingItemPart')?.values?.typeOfWork ?? null
  return CILL_REPAIR_TYPES_OF_WORK.includes(typeOfWork)
}

/**
 * Is this drawing selling a new cill? The engine's `new_cill_qty` asks the
 * same question (`cillPart.repair === 'new_cill'` or the older
 * `cillPart.toBeReplaced === true`, and never on a complete new).
 */
export function isNewCill(tree) {
  const cill = findFirst(tree, 'cillPart')
  return cill?.values?.repair === NEW_CILL_REPAIR_CODE ||
         cill?.values?.toBeReplaced === true
}

/** Should "Full Cill Replacement" be shown? Only when Repair = New Cill. */
export function showsFullCillReplacement(tree) {
  return cillRepairApplies(tree) &&
         findFirst(tree, 'cillPart')?.values?.repair === NEW_CILL_REPAIR_CODE
}

/**
 * Apply the cill rules after a type-of-work change:
 *  - "Cill Replacement Only" IS a new cill, so the Repair is set to New Cill;
 *  - where a cill repair is not offered (complete new, no work, casements,
 *    doors, no type of work yet), any stored repair is cleared, along with
 *    Full Cill Replacement — a cleared field must not leave a priced cill
 *    behind it.
 *
 * Never called on load: only on an actual board action, so the change
 * reaches the drawing's history through the normal save diff.
 *
 * @returns {{tree: Object, changed: string[]}} changed = what it set/cleared
 */
export function applyCillRules(tree) {
  const cill = findFirst(tree, 'cillPart')
  if (!cill) return { tree, changed: [] }
  const v = cill.values ?? {}
  const applies = cillRepairApplies(tree)
  const typeOfWork = findFirst(tree, 'drawingItemPart')?.values?.typeOfWork ?? null

  if (!applies) {
    const patch = {}
    if (v.repair != null) patch.repair = null
    if (v.isBrickToBrickCill != null) patch.isBrickToBrickCill = null
    if (Object.keys(patch).length === 0) return { tree, changed: [] }
    return { tree: updateNodeValues(tree, cill.key, patch), changed: Object.keys(patch) }
  }

  if (typeOfWork === CILL_ONLY_TYPE_OF_WORK && v.repair !== NEW_CILL_REPAIR_CODE) {
    return {
      tree: updateNodeValues(tree, cill.key, { repair: NEW_CILL_REPAIR_CODE }),
      changed: ['repair'],
    }
  }

  return { tree, changed: [] }
}
