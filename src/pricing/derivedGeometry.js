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
 * Sash and interior sizes for the (first) sash pair, from computeDerived.
 * Pass the derived map when the caller already has one; otherwise it is
 * computed here — never re-derived with different formulas.
 *
 * @returns {{
 *   internalWidth, internalHeight,
 *   sashWidth, topSashHeight, bottomSashHeight,
 *   topGlassHeight, bottomGlassHeight,
 *   topRail, bottomRail, midrail
 * }} — every field null when the tree has no sash pair / geometry fails
 */
export function sashSizes(tree, derived = null) {
  const d = derived && Object.keys(derived).length > 0 ? derived : computeDerived(tree)
  const pair    = findFirst(tree, 'sashPairPart')
  const topSash = findFirst(tree, 'topSashPart')
  const botSash = findFirst(tree, 'bottomSashPart')
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
