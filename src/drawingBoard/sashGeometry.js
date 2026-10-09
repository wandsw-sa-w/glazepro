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

// Given a frame's mullion children (unsorted) and the frame's interior width,
// return an array of { x, width } for each opening, left to right.
// This is the single source for opening layout — renderElevation.jsx and
// computeDerived.js both call this so an opening's on-screen width and its
// geometry can never drift apart.
//
// Step AD decision 3 (Integrate's model): a mullion's `offset` is the
// distance from the interior's LEFT edge to the mullion's LEFT FACE, and
// the mullion's THICKNESS is subtracted — the next opening starts at
// offset + thickness. D: interior 1630, hollow mullion 144 at offset 743 →
// openings 743 and 1630 − 743 − 144 = 743.
// `thicknessFor(mullionNode)` supplies each mullion's thickness in mm;
// omitted (legacy callers) it is 0.
export function computeOpeningLayout(mullions, iW, thicknessFor = null) {
  function offsetOrZero(m) {
    const x = Number(m?.values?.offset)
    return isFinite(x) && x > 0 ? x : 0
  }
  const sorted = [...(mullions ?? [])].sort((a, b) => offsetOrZero(a) - offsetOrZero(b))
  const result = []
  let left = 0
  for (const m of sorted) {
    const face = offsetOrZero(m)
    const t    = thicknessFor ? (Number(thicknessFor(m)) || 0) : 0
    result.push({ x: left, width: face - left })
    left = face + t
  }
  result.push({ x: left, width: (safe(iW) ?? 0) - left })
  return result
}

// A box-sash mullion is HOLLOW (it houses the weights): its thickness comes
// from the profile value `thicknessInFrameHollow` (144 on the snapshot's
// profile), not from the template's stored thicknessInFrame. A missing
// profile value is an error, as elsewhere (step-ad brief §3). When no
// profileValues are available (legacy display paths) the stored
// thicknessInFrame is the fallback so the board can still draw.
// Step AO: `hollow` is false for a CASEMENT frame's mullion, which is solid
// and carries its own thickness (27 on Integrate's flush casement
// template) — it must not take the hollow box-sash profile value.
export function mullionThicknessMm(mullion, profileValues = null, { hollow = true } = {}) {
  if (hollow && profileValues != null) {
    const t = safe(profileValues.thicknessInFrameHollow)
    if (t == null) {
      throw new Error('Missing profile value thicknessInFrameHollow for the box-sash mullion — check the drawing’s profile values.')
    }
    return t
  }
  return safe(mullion?.values?.thicknessInFrame) ?? 0
}

// Glass sightline width for a sash of the given width, minus its stile width
// on each side. Mirrors renderElevation.jsx's glW calculation exactly
// (stileWidth falls back to 47mm when absent, zero, or negative — same rule
// renderElevation.jsx's `n()` helper applies).
export function computeGlassWidth(sashWidth, stileWidth) {
  const sw = safe(sashWidth)
  if (sw == null) return null
  const stRaw = Number(stileWidth)
  const st = isFinite(stRaw) && stRaw > 0 ? stRaw : 47
  return Math.max(sw - 2 * st, 0)
}

// Chamfered bottom rail allowance — the internal/external measurement
// difference Integrate labels on its drawings — in WHOLE millimetres:
// round(thickness × tan(angle)). Read from Integrate's stored drawings
// (docs/integrate-benchmarks-thickness.txt, second visit, 8 Oct 2026):
// 35/40 mm → 6, 45 → 7, 50 → 8, and (bottom rail + allowance) is held at
// 95. The 35 mm/1701 Test Quote (Laminated bottom 11.68) needs at least
// 5.8 mm, so the allowance cannot be the unrounded 5.54 (step-ab brief).
// No chamfer (angle missing/0) → 0.
export function chamferAllowanceMm(thicknessMm, angleDeg) {
  const t = safe(thicknessMm)
  const a = safe(angleDeg)
  if (t == null || a == null || a <= 0) return 0
  return Math.round(t * Math.tan(a * Math.PI / 180))
}

// Step AD decision 3: geometry is PER PAIR — pass the sashPairPart whose
// geometry is wanted (its internalWidth in `derived` is its own opening's
// width on a multi-pair frame). Omitted → the first pair, as before.
export function computeSashGeometry(tree, derived, pairNode = null) {
  derived = derived ?? {}

  const pair      = pairNode ?? findFirst(tree, 'sashPairPart')
  const topSash   = findFirst(pair, 'topSashPart')
  const botSash   = findFirst(pair, 'bottomSashPart')

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

  // Sash split mode (default 'half_half') — accept both Integrate name (sashSplitId) and legacy name
  const sashSplit = pv.sashSplitId ?? pv.sashSplit ?? 'half_half'

  // Fixed sash height (only relevant for set_top / set_bottom)
  const fixedSashHeight = safe(pv.fixedSashHeight)   // null if not set

  // Rail heights from sash nodes — fall back to profile defaults when null
  const topRail    = safe(topSash?.values?.topHeight)    ?? 49
  const bottomRail = safe(botSash?.values?.bottomHeight) ?? 88

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
