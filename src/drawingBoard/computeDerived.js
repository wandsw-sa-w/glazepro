// computeDerived(tree) → map of partKey → { propertyName: value }
//
// Pure function. Never returns NaN — missing inputs yield null.
// Derived fields computed:
//   sashPairPart.internalWidth   = frame.width − frame.leftWidth − frame.rightWidth
//   sashPairPart.internalHeight  = frame.height − frame.topHeight − cill.height
//   assemblyFramePart.jambDifference = frame.leftOuterJamb − frame.leftWidth
//   assemblyFramePart.archRadius     = (w²/4 + h²) / (2h)  when archHead=true
//   assemblyFramePart.shoulderHeight = height − archHeight  when archHead=true
//   topSashPart/bottomSashPart.archRadius/shoulderHeight    (same formula, sash dimensions)
//   glassPart.archRadius/shoulderHeight                     (same formula)
//   verticalGlazingBarPart.position   = evenly spaced centre-line (mm from left glass edge)
//   horizontalGlazingBarPart.position = evenly spaced centre-line (mm from top glass edge)
//   drawingItemPart.newFrame     = (typeOfWork === 'complete_new')
//   drawingItemPart.isBiGlass    = (typeOfWork === 'bi_glass')
//   drawingItemPart.itemWeight   = null (formula pending)
//   topSashPart.weight/travel    = null (formula pending)
//   bottomSashPart.weight/travel = null (formula pending)
//   sashPairPart.sashWidth/topSashHeight/bottomSashHeight (from computeSashGeometry)
//   topSashPart.sashHeight / bottomSashPart.sashHeight    (from computeSashGeometry)

import { computeSashGeometry, computeOpeningLayout, computeGlassWidth, mullionThicknessMm } from './sashGeometry.js'
import { resolveTopSashArch } from '../pricing/optionVocabulary.js'

// Safely convert to number; null/undefined/NaN → null
function num(v) {
  if (v == null) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

// Arch geometry: given chord width w (mm) and arch height h (mm),
// returns { archRadius, shoulderHeight } rounded to 2 dp.
// Formula: R = (w²/4 + h²) / (2h); shoulder = partHeight − h.
// Returns null when inputs are invalid.
function archGeometry(w, h, partHeight) {
  if (w == null || h == null || w <= 0 || h <= 0) return null
  const R        = (w * w / 4 + h * h) / (2 * h)
  const shoulder = partHeight != null ? partHeight - h : null
  return {
    archRadius:     Math.round(R        * 100) / 100,
    shoulderHeight: shoulder != null ? Math.round(shoulder * 100) / 100 : null,
  }
}

// Evenly-spaced bar positions (centre-lines, mm from edge of sightline).
// Returns an array of n positions spaced across span.
// e.g. span=600, n=2 → [200, 400]
function evenBarPositions(span, n) {
  if (n <= 0 || span <= 0) return []
  const step = span / (n + 1)
  return Array.from({ length: n }, (_, i) => Math.round(step * (i + 1) * 100) / 100)
}

// Subtract rest from first; return null if any operand is null
function sub(a, ...rest) {
  const na = num(a)
  if (na === null) return null
  let result = na
  for (const v of rest) {
    const n = num(v)
    if (n === null) return null
    result -= n
  }
  return result
}

// Return the first node in the tree matching part_type (BFS order)
function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

// Return all nodes in the tree matching part_type
function findAll(node, partType, acc = []) {
  if (!node) return acc
  if (node.part_type === partType) acc.push(node)
  for (const child of (node.children ?? [])) findAll(child, partType, acc)
  return acc
}

// profileValues (optional, Step AD decision 3): needed to size the openings
// of a multi-pair frame — a box-sash mullion's thickness is the profile
// value thicknessInFrameHollow (missing = error). Display paths that have
// no profile values fall back to the mullion's stored thicknessInFrame.
export function computeDerived(tree, profileValues = null) {
  const out = {}

  function entry(key) {
    if (!out[key]) out[key] = {}
    return out[key]
  }

  const item        = findFirst(tree, 'drawingItemPart')
  const frame       = findFirst(tree, 'assemblyFramePart')
  const cill        = findFirst(tree, 'cillPart')
  const allPairs    = (frame?.children ?? []).filter(c => c.part_type === 'sashPairPart')
  const pair        = allPairs[0] ?? findFirst(tree, 'sashPairPart')
  const topSashes   = findAll(tree, 'topSashPart')
  const botSashes   = findAll(tree, 'bottomSashPart')
  const allGlass    = findAll(tree, 'glassPart')

  // drawingItemPart: newFrame, isBiGlass, itemWeight
  if (item) {
    const tow = item.values?.typeOfWork ?? null
    entry(item.key).newFrame   = tow !== null ? tow === 'complete_new' : null
    entry(item.key).isBiGlass  = tow !== null ? tow === 'bi_glass'     : null
    entry(item.key).itemWeight = null  // formula pending
  }

  // assemblyFramePart: jambDifference = leftOuterJamb − leftWidth
  // archRadius and shoulderHeight when archHead=true
  if (frame) {
    const fv = frame.values ?? {}
    entry(frame.key).jambDifference = sub(fv.leftOuterJamb, fv.leftWidth)
    if (fv.archHead === true) {
      const w  = num(fv.width)
      const h  = num(fv.archHeight)
      const pH = num(fv.height)
      const ag = archGeometry(w, h, pH)
      if (ag) {
        entry(frame.key).archRadius     = ag.archRadius
        entry(frame.key).shoulderHeight = ag.shoulderHeight
      }
    }
  }

  // sashPairPart: internalWidth, internalHeight — PER PAIR (Step AD
  // decision 3). Each frame-level sashPairPart takes its opening in
  // document order; openings subtract the mullion thickness (offset =
  // the mullion's LEFT face, thickness from the profile value
  // thicknessInFrameHollow — mullionThicknessMm). The internal height is
  // common to every pair. D: interior 1630, mullion 144 at 743 →
  // openings 743 / 743 → each pair 738 wide, as Integrate draws it.
  const frameMullions = (frame?.children ?? []).filter(c => c.part_type === 'mullionPart')
  const interiorW = sub(
    frame?.values?.width,
    frame?.values?.leftWidth  ?? 0,
    frame?.values?.rightWidth ?? 0,
  )
  const interiorH = sub(
    frame?.values?.height,
    frame?.values?.topHeight  ?? 0,
    cill?.values?.height      ?? 0,
  )
  const openings = computeOpeningLayout(frameMullions, interiorW ?? 0,
    m => mullionThicknessMm(m, profileValues))

  const pairsInOrder = allPairs.length > 0 ? allPairs : (pair ? [pair] : [])
  for (let i = 0; i < pairsInOrder.length; i++) {
    const p = pairsInOrder[i]
    entry(p.key).internalWidth  = frameMullions.length > 0
      ? (openings[i]?.width ?? null)
      : interiorW
    entry(p.key).internalHeight = interiorH
  }

  // topSashPart / bottomSashPart: weight and travel (formula pending)
  for (const sash of [...topSashes, ...botSashes]) {
    entry(sash.key).weight = null  // formula pending
    entry(sash.key).travel = null  // formula pending
  }

  // Sash geometry: sashWidth, sash heights — per pair, from that pair's
  // own opening and rails.
  const geoByPair = new Map()
  for (const p of pairsInOrder) {
    const g = computeSashGeometry(tree, out, p)
    geoByPair.set(p.key, g)
    if (!g) continue
    entry(p.key).sashWidth        = g.sashWidth
    entry(p.key).topSashHeight    = g.topSashHeight
    entry(p.key).bottomSashHeight = g.bottomSashHeight
    const pTop = findFirst(p, 'topSashPart')
    const pBot = findFirst(p, 'bottomSashPart')
    if (pTop) entry(pTop.key).sashHeight = g.topSashHeight
    if (pBot) entry(pBot.key).sashHeight = g.bottomSashHeight
  }
  // Post-geometry arch pass (Step AD): the arch belongs to the TOP SASH,
  // measured at the GLASS — archHeight is the rise of the glass sightline
  // arc, so the radius comes from the glass CHORD (glass width) and the
  // shoulder is the glass height at the sides (glass height − rise).
  // Integrate labels C's glass "R 708.8": chord 726, rise 100 →
  // (363² + 100²) / 200 = 708.85. A legacy frame-level archHead resolves
  // to the same model via resolveTopSashArch (flagged in the vocabulary
  // warnings).
  for (const p of pairsInOrder) {
    const g = geoByPair.get(p.key)
    if (!g) continue
    const sash = findFirst(p, 'topSashPart')
    if (!sash) continue
    const arch = resolveTopSashArch(tree, sash)
    if (!arch.archHead || !(arch.archHeight > 0)) continue
    const stile = num(sash.values?.leftWidth) ?? 47
    const chord = g.sashWidth != null ? g.sashWidth - 2 * stile : null
    const ag = archGeometry(chord, arch.archHeight, g.topGlassHeight)
    if (ag) {
      entry(sash.key).archRadius     = ag.archRadius
      entry(sash.key).shoulderHeight = ag.shoulderHeight
      const glassChild = (sash.children ?? []).find(c => c.part_type === 'glassPart')
      if (glassChild) {
        entry(glassChild.key).archRadius     = ag.archRadius
        entry(glassChild.key).shoulderHeight = ag.shoulderHeight
      }
    }
  }

  // Glazing bar positions — computed on the same glass sightline rectangle
  // renderElevation.jsx actually draws, per sash pair, so a bar's derived
  // position always agrees with what's on screen. Each pair uses its own
  // geometry (Step AD).
  {
    const framePairs = pairsInOrder

    framePairs.forEach((p) => {
      const pGeo        = geoByPair.get(p.key) ?? null
      const tSashOfPair = findFirst(p, 'topSashPart')
      const stileW      = num(tSashOfPair?.values?.stileWidth)
      const sashW       = pGeo?.sashWidth ?? null
      const glassW      = sashW != null ? computeGlassWidth(sashW, stileW) : null

      const sashesOfPair = [
        [findFirst(p, 'topSashPart'),    pGeo?.topGlassHeight    ?? null],
        [findFirst(p, 'bottomSashPart'), pGeo?.bottomGlassHeight ?? null],
      ]

      for (const [sash, glassH] of sashesOfPair) {
        if (!sash) continue
        const glass = (sash.children ?? []).find(c => c.part_type === 'glassPart')
        if (!glass) continue

        const vBars = (glass.children ?? []).filter(c => c.part_type === 'verticalGlazingBarPart')
        const hBars = (glass.children ?? []).filter(c => c.part_type === 'horizontalGlazingBarPart')

        if (vBars.length > 0 && glassW != null) {
          const autoPos = vBars.every(b => !(b.values?.offset > 0))
          if (autoPos) {
            const positions = evenBarPositions(glassW, vBars.length)
            vBars.forEach((b, i) => { entry(b.key).position = positions[i] ?? null })
          }
        }

        if (hBars.length > 0 && glassH != null) {
          const autoPos = hBars.every(b => !(b.values?.offset > 0))
          if (autoPos) {
            const positions = evenBarPositions(glassH, hBars.length)
            hBars.forEach((b, i) => { entry(b.key).position = positions[i] ?? null })
          }
        }
      }
    })
  }

  return out
}
