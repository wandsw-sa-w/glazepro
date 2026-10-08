/**
 * derivedGeometry.js
 * ONE source of frame/sash geometry for pricing, weights and allocation.
 *
 * Decision (docs/step-v-geometry-brief.md, with Integrate evidence):
 * `assemblyFramePart.width` / `height` are the OVERALL frame. Interior and
 * sash sizes come from the drawing board's own derivation (computeDerived /
 * computeSashGeometry — the sizes actually drawn):
 *   interior width  = width − leftWidth − rightWidth
 *   interior height = height − topHeight − cill.height
 *   sash width      = interior width − mechanical clearances
 *   sash heights    = glass + own rail + meeting rail (per sashSplit)
 * Verified against Integrate's drawn labels: B 1120×1181 → 950 / 516.5 /
 * 555.5, A 1070×1849 → 900 / 850.5 / 889.5.
 *
 * outerWidth / outerHeight are never stored by real drawings and are no
 * longer read anywhere.
 */

import { computeDerived } from '../drawingBoard/computeDerived.js'

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

/** Overall frame size in mm, straight from the stored values. */
export function frameOverallSize(tree) {
  const frame = findFirst(tree, 'assemblyFramePart')
  const fv = frame?.values ?? {}
  return {
    width:  fv.width  ?? null,
    height: fv.height ?? null,
  }
}

/**
 * The sashPairPart that owns a node (a sash, a glass unit, or the pair
 * itself). Step AD decision 3: on a multi-pair frame every engine loop
 * uses the geometry of the sash's OWN pair, never the first pair's.
 */
export function owningSashPair(tree, node) {
  if (!node) return findFirst(tree, 'sashPairPart')
  if (node.part_type === 'sashPairPart') return node
  function contains(root, key) {
    if (!root) return false
    if (root.key === key) return true
    return (root.children ?? []).some(c => contains(c, key))
  }
  function search(n) {
    if (!n) return null
    if (n.part_type === 'sashPairPart' && contains(n, node.key)) return n
    for (const c of (n.children ?? [])) {
      const found = search(c)
      if (found) return found
    }
    return null
  }
  return search(tree) ?? findFirst(tree, 'sashPairPart')
}

/**
 * Sash and interior sizes for ONE sash pair, from computeDerived.
 * Pass the derived map when the caller already has one; otherwise it is
 * computed here — never re-derived with different formulas.
 *
 * @param {Object} [refNode] - a sash / glass / pair node: sizes come from
 *   ITS pair (Step AD decision 3). Omitted → the first pair, as before.
 * @param {Object} [profileValues] - only used when `derived` must be
 *   computed here: a multi-pair frame's openings need the mullion
 *   thickness profile value.
 * @returns {{
 *   internalWidth, internalHeight,
 *   sashWidth, topSashHeight, bottomSashHeight,
 *   topGlassHeight, bottomGlassHeight,
 *   topRail, bottomRail, midrail
 * }} — every field null when the tree has no sash pair / geometry fails
 */
export function sashSizes(tree, derived = null, refNode = null, profileValues = null) {
  const d = derived && Object.keys(derived).length > 0 ? derived : computeDerived(tree, profileValues)
  const pair    = refNode ? owningSashPair(tree, refNode) : findFirst(tree, 'sashPairPart')
  const topSash = findFirst(pair ?? tree, 'topSashPart')
  const botSash = findFirst(pair ?? tree, 'bottomSashPart')
  const pd = pair ? (d[pair.key] ?? {}) : {}

  const midrail    = pair?.values?.midrailHeight     ?? 40
  const topRail    = topSash?.values?.topHeight      ?? 49
  const bottomRail = botSash?.values?.bottomHeight   ?? 88

  const sashWidth        = pd.sashWidth        ?? null
  const topSashHeight    = pd.topSashHeight    ?? null
  const bottomSashHeight = pd.bottomSashHeight ?? null

  return {
    internalWidth:     pd.internalWidth  ?? null,
    internalHeight:    pd.internalHeight ?? null,
    sashWidth,
    topSashHeight,
    bottomSashHeight,
    // Glass sightline heights (= computeSashGeometry's topGlass/bottomGlass:
    // sash height minus its own rail and the meeting rail)
    topGlassHeight:    topSashHeight    != null ? topSashHeight    - topRail    - midrail : null,
    bottomGlassHeight: bottomSashHeight != null ? bottomSashHeight - bottomRail - midrail : null,
    topRail,
    bottomRail,
    midrail,
  }
}
