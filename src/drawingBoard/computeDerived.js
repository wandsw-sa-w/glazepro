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

import { computeSashGeometry } from './sashGeometry.js'

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

export function computeDerived(tree) {
  const out = {}

  function entry(key) {
    if (!out[key]) out[key] = {}
    return out[key]
  }

  const item        = findFirst(tree, 'drawingItemPart')
  const frame       = findFirst(tree, 'assemblyFramePart')
  const cill        = findFirst(tree, 'cillPart')
  const pair        = findFirst(tree, 'sashPairPart')
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
      const w  = num(fv.width ?? fv.outerWidth)
      const h  = num(fv.archHeight)
      const pH = num(fv.height ?? fv.outerHeight)
      const ag = archGeometry(w, h, pH)
      if (ag) {
        entry(frame.key).archRadius     = ag.archRadius
        entry(frame.key).shoulderHeight = ag.shoulderHeight
      }
    }
  }

  // sashPairPart: internalWidth, internalHeight
  // Optional sub-terms default to 0 so a partial frame still yields a value.
  if (pair) {
    entry(pair.key).internalWidth = sub(
      frame?.values?.width,
      frame?.values?.leftWidth  ?? 0,
      frame?.values?.rightWidth ?? 0,
    )
    entry(pair.key).internalHeight = sub(
      frame?.values?.height,
      frame?.values?.topHeight  ?? 0,
      cill?.values?.height      ?? 0,
    )
  }

  // topSashPart / bottomSashPart: weight and travel (formula pending)
  // archRadius and shoulderHeight when archHead=true
  for (const sash of [...topSashes, ...botSashes]) {
    entry(sash.key).weight = null  // formula pending
    entry(sash.key).travel = null  // formula pending
    const sv = sash.values ?? {}
    if (sv.archHead === true) {
      // Sash width from pair derived (computed later by computeSashGeometry).
      // We'll use the frame width minus stiles as a reasonable approximation;
      // the SVG renderer can refine after geometry is known.
      const fv = frame?.values ?? {}
      const sw = num(fv.width) != null
        ? num(fv.width) - 2 * (num(sash.values?.leftWidth) ?? 47)
        : null
      const h  = num(sv.archHeight)
      const pH = null  // sash height not yet derived at this pass
      const ag = archGeometry(sw, h, pH)
      if (ag) {
        entry(sash.key).archRadius     = ag.archRadius
        // shoulderHeight requires sash height — deferred to post-geometry pass below
      }
    }
  }

  // Sash geometry: sashWidth, sash heights (derived)
  const geo = computeSashGeometry(tree, out)
  if (geo) {
    if (pair) {
      entry(pair.key).sashWidth        = geo.sashWidth
      entry(pair.key).topSashHeight    = geo.topSashHeight
      entry(pair.key).bottomSashHeight = geo.bottomSashHeight
    }
    for (const sash of topSashes) entry(sash.key).sashHeight = geo.topSashHeight
    for (const sash of botSashes) entry(sash.key).sashHeight = geo.bottomSashHeight

    // Post-geometry arch pass: now that sash heights are known, compute shoulderHeight
    for (const sash of topSashes) {
      const sv = sash.values ?? {}
      if (sv.archHead === true) {
        const h   = num(sv.archHeight)
        const pH  = geo.topSashHeight
        if (h != null && pH != null) {
          entry(sash.key).shoulderHeight = Math.round((pH - h) * 100) / 100
        }
      }
    }
    for (const sash of botSashes) {
      const sv = sash.values ?? {}
      if (sv.archHead === true) {
        const h   = num(sv.archHeight)
        const pH  = geo.bottomSashHeight
        if (h != null && pH != null) {
          entry(sash.key).shoulderHeight = Math.round((pH - h) * 100) / 100
        }
      }
    }
  }

  // glassPart: arch geometry + bar positions
  for (const g of allGlass) {
    const gv = g.values ?? {}

    // Arch geometry on glass
    if (gv.archHead === true) {
      // Glass sightline width/height: approximate from parent sash values.
      // The SVG renderer will use the precise computed glass dimensions.
      const parentSash = (() => {
        function findP(node, key) {
          if (!node) return null
          if ((node.children ?? []).some(c => c.key === key)) return node
          for (const c of (node.children ?? [])) { const r = findP(c, key); if (r) return r }
          return null
        }
        return findP(tree, g.key)
      })()
      const fv = frame?.values ?? {}
      const stile = num(parentSash?.values?.leftWidth) ?? 47
      const gw = num(fv.width) != null ? num(fv.width) - 2 * stile : null
      const h  = num(gv.archHeight)
      const pH = null  // glass height not readily available here
      const ag = archGeometry(gw, h, pH)
      if (ag) entry(g.key).archRadius = ag.archRadius
    }

    // Bar positions: for each child glazing bar with offset === 0,
    // assign evenly-spaced positions once we know the glass sightline dimensions.
    // (Full geometry is not always available here; these are best-effort positions
    //  that the SVG renderer can override with precise computed dimensions.)
    const vBars = (g.children ?? []).filter(c => c.part_type === 'verticalGlazingBarPart')
    const hBars = (g.children ?? []).filter(c => c.part_type === 'horizontalGlazingBarPart')

    if (vBars.length > 0) {
      const fv  = frame?.values ?? {}
      const stile = num((findFirst(tree, 'topSashPart') ?? findFirst(tree, 'bottomSashPart'))?.values?.leftWidth) ?? 47
      const glassW = num(fv.width) != null ? num(fv.width) - 2 * stile : null
      const autoPos = vBars.every(b => !(b.values?.offset > 0))
      if (autoPos && glassW != null) {
        const positions = evenBarPositions(glassW, vBars.length)
        vBars.forEach((b, i) => { entry(b.key).position = positions[i] ?? null })
      }
    }

    if (hBars.length > 0) {
      const pairDer  = out[pair?.key] ?? {}
      const glassH   = (pairDer.topSashHeight ?? null)  // use top sash height as glass height approximation
      const autoPos  = hBars.every(b => !(b.values?.offset > 0))
      if (autoPos && glassH != null) {
        const positions = evenBarPositions(glassH, hBars.length)
        hBars.forEach((b, i) => { entry(b.key).position = positions[i] ?? null })
      }
    }
  }

  return out
}
