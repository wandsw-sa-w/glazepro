// sashesReplaced.js — the ONE path that sets a sash's "To Be Replaced".
//
// The gap this closes (reviewer's live test, 9 Oct 2026): a Box Sash drawing
// set to Type of Work "New Pair of Sashes" stored toBeReplaced: null on both
// sashes, because nothing on the board ever set it. Every sash-replacement
// price line depends on it — the engine's `to_be_replaced` is "complete new
// OR this sash's toBeReplaced === true" — so laminated timber, glazing bead,
// Lead Weight, new_sliding_sash_qty (production and install labour), glazing
// bars and, since engine v10, the glass itself all dropped out: a sash
// replacement drawn on the board priced with no sashes at all. Benchmark A
// passed only because its FIXTURE sets toBeReplaced by hand.
//
// Integrate links the two (docs/integrate-L31115-A-top-only.txt §3): ticking
// New Sashes marks both sashes To Be Replaced, and unticking one sash clears
// New Sashes. Nathan's business rule (9 Oct 2026): a sash replacement ALWAYS
// replaces both sashes.
//
// So the type of work owns the value, for BOX SASH WINDOWS only. Casements,
// doors and every other part type are untouched.

export const SASHES_REPLACED_NOTE =
  'Set by the type of work — a sash replacement always replaces both sashes'

/**
 * What each type of work means for a sliding sash's toBeReplaced.
 * An unknown or absent code is deliberately NOT in this map: the rule
 * cannot be derived, so nothing is changed (never invent a value).
 */
export const SASHES_REPLACED_BY_TYPE_OF_WORK = {
  complete_new:       true,   // the engine already treats complete new as
                              // replaced; storing true keeps the data honest
                              // and matches Integrate's A-style trees
  new_pair_of_sashes: true,
  draught_seal:       false,
  bi_glass:           false,
  no_work:            false,
  // Step AM: a stand-alone cill replacement replaces no sashes
  cill_only:          false,
}

const SLIDING_SASH_TYPES = ['topSashPart', 'bottomSashPart']

// ── Tree helpers (local copies — this module stays pure) ─────────────────────

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

// ── The rule ─────────────────────────────────────────────────────────────────

/**
 * Is this a BOX SASH window? Mirrors the pricing engine's is_box_sash /
 * is_sw (computeVariables.js): a sash pair, no casement sash, no door leaf.
 */
export function isSashWindow(tree) {
  return findAll(tree, 'sashPairPart').length > 0 &&
         findAll(tree, 'casementSashPart').length === 0 &&
         findAll(tree, 'doorLeafPart').length === 0
}

/** The item's type of work, or null. */
export function typeOfWorkOf(tree) {
  return findFirst(tree, 'drawingItemPart')?.values?.typeOfWork ?? null
}

/**
 * What the sashes' toBeReplaced should be for this tree, or null when the
 * rule does not apply (not a box sash window, or no/unknown type of work).
 */
export function sashesReplacedTarget(tree) {
  if (!isSashWindow(tree)) return null
  const tow = typeOfWorkOf(tree)
  if (tow == null || !(tow in SASHES_REPLACED_BY_TYPE_OF_WORK)) return null
  return SASHES_REPLACED_BY_TYPE_OF_WORK[tow]
}

/** Sliding sashes whose stored value disagrees with the type of work. */
export function sashesDisagreeing(tree) {
  const target = sashesReplacedTarget(tree)
  if (target == null) return []
  const sashes = []
  for (const pt of SLIDING_SASH_TYPES) sashes.push(...findAll(tree, pt))
  return sashes.filter(s => s.values?.toBeReplaced !== target)
}

/**
 * Set toBeReplaced from the type of work on every sliding sash of a box
 * sash window — every sash in every pair, so a double box is handled too.
 *
 * Does nothing when the rule does not apply or every sash already agrees.
 * Never called on load: only when the type of work changes, when a drawing
 * is created from a template, or from the board's "Set sashes to match type
 * of work" button — so the change reaches the drawing history through the
 * normal save diff and no saved drawing is edited silently.
 *
 * @returns {{tree: Object, sashesChanged: string[], target: boolean|null}}
 */
export function applySashesReplaced(tree) {
  const target = sashesReplacedTarget(tree)
  if (target == null) return { tree, sashesChanged: [], target: null }
  const disagreeing = sashesDisagreeing(tree)
  let out = tree
  for (const sash of disagreeing) {
    out = updateNodeValues(out, sash.key, { toBeReplaced: target })
  }
  return { tree: out, sashesChanged: disagreeing.map(s => s.key), target }
}
