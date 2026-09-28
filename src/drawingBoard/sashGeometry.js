// sashGeometry.js — pure geometry calculation for a box sash window.
//
// computeSashGeometry(tree, derived) → geometry object or null
//
// Returns null (never partial) if any required input is missing or any
// computed dimension would be NaN, non-finite, or ≤ 0.

// Safely convert to finite number; returns null for null/undefined/NaN/Infinity.
function safe(v) {
  if (v == null) return null
  const n = Number(v)
  return isFinite(n) ? n : null
}

// BFS search: first node with matching part_type.
function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

// Return null if value is null, NaN, non-finite, or ≤ 0.
function positiveOrNull(v) {
  if (v == null) return null
  const n = Number(v)
  if (!isFinite(n) || n <= 0) return null
  return n
}

export function computeSashGeometry(tree, derived) {
  derived = derived ?? {}

  const pair      = findFirst(tree, 'sashPairPart')
  const topSash   = findFirst(tree, 'topSashPart')
  const botSash   = findFirst(tree, 'bottomSashPart')

  if (!pair) return null

  // Derived internal dimensions
  const pairDerived = derived[pair.key] ?? {}
  const internalWidth  = safe(pairDerived.internalWidth)
  const internalHeight = safe(pairDerived.internalHeight)
  if (internalWidth == null || internalHeight == null) return null

  // Clearances (default 0)
  const pv = pair.values ?? {}
  const clearLeft   = safe(pv.mechanicalClearanceLeft)  ?? 0
  const clearRight  = safe(pv.mechanicalClearanceRight) ?? 0
  const clearTop    = safe(pv.mechanicalClearanceTop)   ?? 0
  const clearBottom = safe(pv.mechanicalClearanceBottom)?? 0

  // Meeting rail height (default 40)
  const M = safe(pv.midrailHeight) ?? 40

  // Sash split mode (default 'half_half')
  const sashSplit = pv.sashSplit ?? 'half_half'

  // Fixed sash height (only relevant for set_top / set_bottom)
  const fixedSashHeight = safe(pv.fixedSashHeight)   // null if not set

  // Rail heights from sash nodes
  const topRail    = safe(topSash?.values?.topHeight)
  const bottomRail = safe(botSash?.values?.bottomHeight)

  if (topRail == null || bottomRail == null) return null

  // Core geometry
  const sashWidth = internalWidth - clearLeft - clearRight
  const H         = internalHeight - clearTop - clearBottom
  const totalGlass = H - M - topRail - bottomRail

  // Resolve topGlass according to sashSplit
  let topGlass
  switch (sashSplit) {
    case 'half_half':
      topGlass = totalGlass / 2
      break

    case 'third_two_thirds':
      topGlass = totalGlass / 3
      break

    case 'set_top': {
      if (fixedSashHeight == null) return null
      topGlass = fixedSashHeight - topRail - M
      break
    }

    case 'set_bottom': {
      if (fixedSashHeight == null) return null
      const botGlass = fixedSashHeight - bottomRail - M
      topGlass = totalGlass - botGlass
      break
    }

    default:
      topGlass = totalGlass / 2
  }

  const bottomGlass = totalGlass - topGlass

  // Reject degenerate geometry
  if (topGlass >= totalGlass) return null

  const topSashHeight    = topGlass + topRail + M
  const bottomSashHeight = bottomGlass + bottomRail + M
  const topGlassHeight   = topGlass
  const bottomGlassHeight = bottomGlass

  // Validate all outputs are positive and finite
  const results = { sashWidth, topSashHeight, bottomSashHeight, topGlassHeight, bottomGlassHeight }
  for (const v of Object.values(results)) {
    if (positiveOrNull(v) == null) return null
  }

  return results
}
