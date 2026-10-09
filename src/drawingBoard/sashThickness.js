// sashThickness.js — the ONE path a sash thickness change takes.
//
// Step AB (docs/integrate-benchmarks-thickness.txt, second visit): when the
// sash thickness or the chamfered bottom rail angle changes, Integrate
// re-stores the bottom rail and the sash height so that
// (bottom rail + whole-mm chamfer allowance) and the EXTERNAL sash height
// both stay constant. That logic used to live inline in DrawingBoard's
// field-change handler; Step AI moves it here so the board's hand edit, the
// complete-new 45 mm rule and template creation all go through it and shift
// the same fields in the same way.
//
// Step AI business rule (Nathan Smith, 9 Oct 2026 — sash windows only): a
// COMPLETE NEW sash window is always made 45 mm thick. Sash replacements may
// be 35 / 40 / 45 / 50 and always replace both sashes. Integrate does not
// enforce this, so it is a deliberate difference — recorded as difference 2
// in docs/integrate-differences.md.

import { chamferAllowanceMm } from './sashGeometry.js'

export const COMPLETE_NEW_SASH_THICKNESS_MM = 45

export const COMPLETE_NEW_THICKNESS_NOTE =
  'Complete new sash windows are always 45 mm'

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

function findByKey(node, key) {
  if (!node) return null
  if (node.key === key) return node
  for (const child of (node.children ?? [])) {
    const found = findByKey(child, key)
    if (found) return found
  }
  return null
}

function updateNodeValues(tree, key, patch) {
  if (!tree) return tree
  if (tree.key === key) return { ...tree, values: { ...tree.values, ...patch } }
  return { ...tree, children: (tree.children ?? []).map(c => updateNodeValues(c, key, patch)) }
}

/** The sashPairPart that owns `key` (a pair, a sash, or anything below one). */
export function owningPair(tree, key) {
  for (const pair of findAll(tree, 'sashPairPart')) {
    if (findByKey(pair, key)) return pair
  }
  return findFirst(tree, 'sashPairPart')
}

// ── The complete-new rule ────────────────────────────────────────────────────

/**
 * Is this a BOX SASH item being built complete new? Mirrors the pricing
 * engine's `is_sw and frame_to_be_replaced` exactly (computeVariables.js:
 * is_box_sash = a sash pair, no casement sash, no door leaf; typeOfWork
 * 'complete_new'), so the board and the validation rule agree.
 */
export function isCompleteNewSashWindow(tree) {
  const item = findFirst(tree, 'drawingItemPart')
  if (item?.values?.typeOfWork !== 'complete_new') return false
  const hasSashPair = findAll(tree, 'sashPairPart').length > 0
  const hasCasement = findAll(tree, 'casementSashPart').length > 0
  const hasDoorLeaf = findAll(tree, 'doorLeafPart').length > 0
  return hasSashPair && !hasCasement && !hasDoorLeaf
}

/** Pairs whose STORED thickness is not `mm` (empty = nothing to do). */
export function pairsOffThickness(tree, mm = COMPLETE_NEW_SASH_THICKNESS_MM) {
  return findAll(tree, 'sashPairPart')
    .filter(p => Number(p.values?.sashThickness) !== Number(mm))
}

// ── One thickness / chamfer-angle change ─────────────────────────────────────

/**
 * The value patches ONE thickness or chamfer-angle change makes, computed
 * from the tree as it is BEFORE the change: the pair's own thickness (when
 * `thickness` is given and differs), the pair's bottom sash rail, and the
 * frame height — the last two moving by the same whole millimetre so that
 * (rail + allowance) and the external sash height are unchanged.
 *
 * Returns [] when nothing needs to move. The caller applies the patches, so
 * the board can keep storing the raw edited value exactly as the user typed
 * it (a cleared angle box stays null, as it did before Step AI).
 *
 * @param {Object} tree
 * @param {string} pairKey - the sashPairPart being changed
 * @param {{thickness?: number|null, chamferAngle?: number|null}} change
 * @returns {Array<[string, Object]>} [[nodeKey, patch], ...]
 */
export function thicknessChangePatches(tree, pairKey, { thickness = null, chamferAngle = null } = {}) {
  const pairNode = findByKey(tree, pairKey)
  if (!pairNode || pairNode.part_type !== 'sashPairPart') return []

  const botNode   = findFirst(pairNode, 'bottomSashPart')
  const frameNode = findFirst(tree, 'assemblyFramePart')

  // The STORED thickness, and the one the geometry uses: a pair with no
  // thickness yet (a blank board build) prices at 45 because every engine
  // read defaults to 45, so the allowance difference below is measured from
  // 45 — but the VALUE still has to be written, or the drawing keeps an
  // empty field. Step AK's board-path proof found that: the old guard
  // compared the new value against the `?? 45` default and so stored
  // nothing. The comparison is now against what is really stored.
  const storedT = pairNode.values?.sashThickness
  const oldT = Number(storedT ?? COMPLETE_NEW_SASH_THICKNESS_MM)
  const oldA = Number(botNode?.values?.chamferedBottomRailAngle ?? 0)
  const newT = thickness    != null ? Number(thickness)    : oldT
  const newA = chamferAngle != null ? Number(chamferAngle) : oldA

  const patches = []
  if (thickness != null && isFinite(newT) && newT > 0 && Number(storedT) !== newT) {
    patches.push([pairNode.key, { sashThickness: newT }])
  }

  const valid = botNode && frameNode &&
    isFinite(newT) && newT > 0 && isFinite(newA) && newA >= 0
  const delta = valid
    ? chamferAllowanceMm(oldT, oldA) - chamferAllowanceMm(newT, newA)
    : 0
  if (delta !== 0) {
    const oldRail   = Number(botNode.values?.bottomHeight ?? 88)
    const oldFrameH = Number(frameNode.values?.height)
    patches.push([botNode.key, { bottomHeight: oldRail + delta }])
    if (isFinite(oldFrameH)) patches.push([frameNode.key, { height: oldFrameH + delta }])
  }
  return patches
}

/** Apply [[key, patch], ...] to a tree. */
export function applyPatches(tree, patches) {
  let out = tree
  for (const [key, patch] of (patches ?? [])) out = updateNodeValues(out, key, patch)
  return out
}

/**
 * Set every sash pair of a COMPLETE NEW sash window to 45 mm, each pair
 * through thicknessChangePatches, so the bottom rails and the frame height
 * shift exactly as they do on a hand edit (and show in the drawing's
 * history, because the values are really changed in the tree).
 *
 * Does nothing when the item is not a complete-new sash window or every
 * pair is already 45. Never called on load — only on an actual board action
 * (type of work changed, "Set to 45 mm", creation from a template).
 *
 * @returns {{tree: Object, pairsChanged: string[]}}
 */
export function applyCompleteNewThickness(tree, mm = COMPLETE_NEW_SASH_THICKNESS_MM) {
  if (!isCompleteNewSashWindow(tree)) return { tree, pairsChanged: [] }
  const frameKey = findFirst(tree, 'assemblyFramePart')?.key ?? null
  const pairsChanged = []
  let out = tree
  let frameMoved = false
  for (const pair of pairsOffThickness(tree, mm)) {
    let patches = thicknessChangePatches(out, pair.key, { thickness: mm })
    if (patches.length === 0) continue
    // The frame height is shared by every opening, so the external-height
    // shift happens ONCE for the item however many pairs change; each
    // pair's own bottom rail still moves.
    if (frameMoved) patches = patches.filter(([k]) => k !== frameKey)
    else if (patches.some(([k]) => k === frameKey)) frameMoved = true
    out = applyPatches(out, patches)
    pairsChanged.push(pair.key)
  }
  return { tree: out, pairsChanged }
}
