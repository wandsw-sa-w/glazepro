// biGlassCasement.js — the ONE path that switches a CASEMENT to bi-glass and
// back.
//
// Step BJ item 2. Bi-glass keeps the customer's frame AND sashes: the single
// glass comes out, a new single pane goes in, the window is draught sealed and
// any glazing bars are taken off. Integrate does it with one tick on the item,
// and that tick changes six things at once
// (docs/integrate-L31115-casement-biglass.txt, read 15 Oct 2026):
//
//   1. the sashes are KEPT              every CasementSashPart toBeReplaced false
//   2. "Include Clearance" appears and defaults OFF, so each sash grows to
//      fill its opening — P's 1517 x 1497 sash becomes 1525 x 1505 — and the
//      glass grows with it
//   3. every glass is SINGLE 4 mm Clear Toughened (glazingId 1,
//      singleGlassPartNo GL100080) and toBeReplaced TRUE — the glass is the
//      only thing being replaced, and it is what the 240-minute BiGlass
//      labour counts
//   4. draught sealing goes on, automatically
//   5. the stored surround list is CLEARED (Integrate's Configuration 4 copy
//      lost its nosing and both architraves)
//   6. isCasementMpls goes false
//
// and the ironmongery is left exactly as it was. Nathan (15 Oct): no NEW
// ironmongery by default, because the sashes are kept — the surveyor adds
// whatever is actually replaced.
//
// SWITCHING BACK restores a complete-new casement: clearance 4 all round,
// double glazing, the sashes replaced again and MPLS on. It does NOT put a
// surround list back, because a GlazePro casement template carries none
// anyway (sql/step-ax3) and the allocator prices the architrave.
//
// GLAZING BARS ARE LEFT ALONE, on purpose. They are taken off and charged as
// such — "BiGlass GBs to Take Off", 60 minutes each — so the surveyor needs
// to be able to say how many there were. Deleting them would lose the charge.
//
// WHAT IS NOT STORED: draught sealing. GlazePro's typeOfWork is
// single-valued, so an item cannot be both bi_glass and draught_seal the way
// Integrate's separate flags can. `needs_draughtsealing` is derived from
// bi-glass for a casement in computeVariables instead (Step BJ item 1d), so
// there is nothing for this module to write.
//
// SLIDING SASHES ARE UNTOUCHED. Bi-glass on a box sash is a separate step
// (Step BJ item 3); every function here returns the tree unchanged unless it
// is a casement.

import {
  CASEMENT_SASH_TYPES, DOOR_LEAF_LIKE, FRENCH_PAIR_PART,
} from '../pricing/casementGeometry.js'

/** Integrate's glazingId 1, and the pane it puts in. */
export const BI_GLASS_GLAZING_ID    = 'single_glazing'
export const BI_GLASS_SINGLE_PART   = 'GL100080'   // 4mm Clear Toughened
export const BI_GLASS_TYPE_OF_WORK  = 'bi_glass'

/** What a complete-new casement goes back to. */
export const DOUBLE_GLAZING_ID = 'double_glazing'

export const BI_GLASS_NOTE =
  'Bi-glass — the frame and sashes are kept; only the glass is replaced'

/**
 * The mechanical clearance a bi-glass sash has (Integrate's "Include
 * Clearance" off) and the one a complete-new casement has.
 */
export const BI_GLASS_CLEARANCE_MM = 0
export const CASEMENT_CLEARANCE_MM = 4

const CLEARANCE_FIELDS = [
  'mechanicalClearanceLeft', 'mechanicalClearanceRight',
  'mechanicalClearanceTop', 'mechanicalClearanceBottom',
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

function findAllOf(node, partTypes, acc = []) {
  if (!node) return acc
  if (partTypes.includes(node.part_type)) acc.push(node)
  for (const child of (node.children ?? [])) findAllOf(child, partTypes, acc)
  return acc
}

function updateNodeValues(tree, key, patch) {
  if (!tree) return tree
  if (tree.key === key) return { ...tree, values: { ...tree.values, ...patch } }
  return { ...tree, children: (tree.children ?? []).map(c => updateNodeValues(c, key, patch)) }
}

/** Drop a key from a node's values entirely (not set to null — gone). */
function deleteNodeValue(tree, key, field) {
  if (!tree) return tree
  if (tree.key === key) {
    if (!(field in (tree.values ?? {}))) return tree
    const values = { ...tree.values }
    delete values[field]
    return { ...tree, values }
  }
  return { ...tree, children: (tree.children ?? []).map(c => deleteNodeValue(c, key, field)) }
}

/**
 * A CASEMENT window — the same test the pricing engine's is_casement_window
 * uses: at least one casement sash and no door leaf.
 */
export function isCasementTree(tree) {
  return findAllOf(tree, CASEMENT_SASH_TYPES).length > 0 &&
         findAllOf(tree, ['doorLeafPart']).length === 0
}

/** The item's type of work, or null. */
export function typeOfWorkOf(tree) {
  return findFirst(tree, 'drawingItemPart')?.values?.typeOfWork ?? null
}

/**
 * Can this drawing be switched to bi-glass AT ALL?
 *
 * Step BJ follow-up. The board offers Bi-Glass exactly where this is true,
 * and `applyBiGlassCasement` refuses anything else, so the control and the
 * rule cannot drift apart.
 *
 * IN: a casement window — at least one plain `casementSashPart` and no door
 * leaf. That is the engine's `is_casement_window` for every tree this
 * returns true for, so what the board offers is what prices.
 *
 * OUT, and each for a reason:
 *
 *  - a DOOR, a French door, a stable door or a flag-frame set. Any door leaf
 *    makes `is_casement_window` false, so the casement rules do not fire and
 *    the bi-glass figures in this step do not apply. Nathan asked for
 *    casement windows.
 *
 *  - a FRENCH CASEMENT pair. This one is a judgement and it is deliberate.
 *    Its leaves ARE in CASEMENT_SASH_TYPES, so `is_casement_window` is true
 *    and the step's scope would have taken it — but a French pair stores its
 *    mechanical clearances on the PAIR, not on the leaves
 *    (`casementSashSize` reads `frenchPairFor(...)` first and the leaf only
 *    as a fallback). So setting the leaves' clearances to 0 would NOT make
 *    them fill the opening: the sashes would keep their 4 mm inset, the
 *    glass would be sized as though clearance still applied, and the price
 *    would be quietly wrong. Integrate has no reading for a bi-glass French
 *    pair either — the facts list it under "Not read". Offering a control
 *    that half-applies is worse than not offering it, so a tree holding a
 *    `frenchCasementPart` is out until there is a reading and the pair's
 *    clearances are handled.
 *
 *  - a DIRECT-GLAZED-ONLY frame. It has no sash at all, so there is nothing
 *    to keep: "the sashes are kept and the glass is replaced" has no meaning,
 *    `is_casement_window` is false (no casement sash), and the 240-minute
 *    BiGlass labour per glass unit has never been read against one. Out.
 *
 *  - a box sash. Bi-glass on a sliding sash is a separate step (Step BJ
 *    item 3) and this must not reach it.
 */
export function canBeBiGlass(tree) {
  if (!tree) return false
  // A plain casement sash, not a French leaf: the French pair is out, above.
  if (findAllOf(tree, ['casementSashPart']).length === 0) return false
  // DOOR_LEAF_LIKE is the engine's own list: a plain leaf and both French
  // door leaves, which is what makes `is_door` true and is_casement_window
  // false. A stable door's halves and a flag frame's door are leaves too.
  if (findAllOf(tree, DOOR_LEAF_LIKE).length > 0) return false
  if (findAllOf(tree, [FRENCH_PAIR_PART]).length > 0) return false
  return true
}

/** Is this item bi-glass? The type of work, or Integrate's own flag. */
export function isBiGlassItem(tree) {
  const v = findFirst(tree, 'drawingItemPart')?.values ?? {}
  return v.typeOfWork === BI_GLASS_TYPE_OF_WORK || v.isBiGlass === true
}

// ── The rule ────────────────────────────────────────────────────────────────

/**
 * Bring a CASEMENT drawing into line with its type of work, for bi-glass and
 * for the switch back.
 *
 * Returns the new tree and what it changed, so the board can report it and
 * the change reaches the drawing history through the ordinary save diff.
 * Called only when the type of work changes, when a drawing is created from a
 * template, or from the board's own button — never on load, so no saved
 * drawing is edited silently.
 *
 * @param {Object} tree
 * @returns {{tree: Object, changed: string[], applied: 'bi_glass'|'casement'|null}}
 */
export function applyBiGlassCasement(tree) {
  // Step BJ follow-up: the SAME predicate the board offers Bi-Glass on, so a
  // tree the control is hidden for can never be half-switched by this rule
  // either — a French casement most of all, whose clearances live on the
  // pair (see canBeBiGlass).
  if (!canBeBiGlass(tree)) return { tree, changed: [], applied: null }

  const tow = typeOfWorkOf(tree)
  const toBiGlass = isBiGlassItem(tree)
  // Only COMPLETE NEW is restored. A casement has no other type of work that
  // makes sashes and glass (draught seal and cill-only are sash-window
  // services), so anything else is left exactly as the surveyor has it.
  if (!toBiGlass && tow !== 'complete_new') return { tree, changed: [], applied: null }

  const changed = []
  let out = tree

  const item = findFirst(out, 'drawingItemPart')
  const paint = findFirst(out, 'paintAndIronmongeryPart')

  if (toBiGlass) {
    // 5. the stored surround list goes, as the tick clears it in Integrate
    if (item && item.values?.surroundLines !== undefined) {
      out = deleteNodeValue(out, item.key, 'surroundLines')
      changed.push(`${item.key}.surroundLines`)
    }
    // 6. multipoint locking off — the sashes keep their own gear
    if (paint && paint.values?.isCasementMpls !== false) {
      out = updateNodeValues(out, paint.key, { isCasementMpls: false })
      changed.push(`${paint.key}.isCasementMpls`)
    }
  } else if (paint && paint.values?.isCasementMpls !== true) {
    // back to a complete-new casement: multipoint by default (Nathan, 9 Oct)
    out = updateNodeValues(out, paint.key, { isCasementMpls: true })
    changed.push(`${paint.key}.isCasementMpls`)
  }

  const clearance = toBiGlass ? BI_GLASS_CLEARANCE_MM : CASEMENT_CLEARANCE_MM

  for (const sash of findAllOf(out, CASEMENT_SASH_TYPES)) {
    // 1. the sash is kept on bi-glass, made on complete new
    const wantReplaced = !toBiGlass
    if (sash.values?.toBeReplaced !== wantReplaced) {
      out = updateNodeValues(out, sash.key, { toBeReplaced: wantReplaced })
      changed.push(`${sash.key}.toBeReplaced`)
    }
    // 2. the sash IS its opening on bi-glass ("Include Clearance" off)
    const patch = {}
    for (const f of CLEARANCE_FIELDS) {
      if (Number(sash.values?.[f]) !== clearance) patch[f] = clearance
    }
    if (Object.keys(patch).length > 0) {
      out = updateNodeValues(out, sash.key, patch)
      changed.push(`${sash.key}.mechanicalClearance`)
    }

    // 3. the glass: single 4 mm Clear Toughened and replaced, or back to
    //    double and not replaced on its own account
    for (const glass of (sash.children ?? []).filter(c => c.part_type === 'glassPart')) {
      const gv = glass.values ?? {}
      const gPatch = {}
      if (toBiGlass) {
        if (gv.glazingId !== BI_GLASS_GLAZING_ID) gPatch.glazingId = BI_GLASS_GLAZING_ID
        // The double-glazing codes are LEFT ON the part, as Integrate leaves
        // them, so switching back finds them again.
        if (gv.singleGlassPartNo !== BI_GLASS_SINGLE_PART) {
          gPatch.singleGlassPartNo = BI_GLASS_SINGLE_PART
        }
        if (gv.toBeReplaced !== true) gPatch.toBeReplaced = true
      } else {
        if (gv.glazingId !== DOUBLE_GLAZING_ID) gPatch.glazingId = DOUBLE_GLAZING_ID
        // On complete new the SASH carries the replace flag and the glass
        // does not need one; clearing it keeps the data honest and stops a
        // kept-sash drawing claiming its glass is new.
        if (gv.toBeReplaced !== undefined) gPatch.toBeReplaced = undefined
      }
      if (Object.keys(gPatch).length > 0) {
        if (gPatch.toBeReplaced === undefined && 'toBeReplaced' in gPatch) {
          delete gPatch.toBeReplaced
          out = deleteNodeValue(out, glass.key, 'toBeReplaced')
        }
        if (Object.keys(gPatch).length > 0) {
          out = updateNodeValues(out, glass.key, gPatch)
        }
        changed.push(`${glass.key}.glazing`)
      }
    }
  }

  return { tree: out, changed, applied: toBiGlass ? 'bi_glass' : 'casement' }
}

/**
 * What disagrees with the type of work on a casement right now — for the
 * board's "Set glass and sashes to match type of work" button, the same
 * shape Step AJ's sashesDisagreeing has.
 */
export function biGlassDisagreeing(tree) {
  return applyBiGlassCasement(tree).changed
}
