/**
 * casementGeometry.js
 * ONE source of geometry for casement frames and direct glazed units, as
 * derivedGeometry.js is for box sash windows.
 *
 * Step AO, from Integrate's saved drawings
 * (docs/integrate-L31115-direct-glazed.txt):
 *
 *   interior         = frame − jambs, frame − head − cill height
 *                      (1199 − 37 − 37 = 1125; 1299 − 47 − 47 = 1205)
 *   openings         = the interior split by the frame's mullions, each
 *                      mullion's offset being its LEFT face (Step AE):
 *                      (1125 − 27) / 2 = 549 and 549
 *   casement sash    = its opening − its mechanical clearance each side
 *                      (549 − 4 − 4 = 541; 1205 − 4 − 4 = 1197)
 *   casement glass   = sash − stiles, sash − head − bottom rail
 *                      (541 − 62 − 62 = 417; 1197 − 62 − 83 = 1052)
 *   direct glazed    = its opening − 2 × clearance 20 = the visible size the
 *                      board shows (509 × 1165), and the GLASS is that plus
 *                      2 × hidden-in-rebate 18 (545 × 1201 = 0.6545 → 0.65).
 *                      With no mullion: 1085 × 1165 visible, glass
 *                      1121 × 1201 = 1.3463 → 1.35.
 *
 * An opening is either a `casementSashPart` or a `glassPart` that is a DIRECT
 * CHILD OF THE FRAME (which is what makes it a direct glazed unit). Openings
 * take the layout's slots in tree order, which is Integrate's matrixIndex
 * order (A1, B1, …).
 */

import { computeOpeningLayout } from '../drawingBoard/sashGeometry.js'

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

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return isFinite(n) ? n : null
}

const OPENING_TYPES = ['casementSashPart', 'glassPart']

/** Is this glassPart a direct glazed unit — a direct child of the frame? */
export function isDirectGlazedUnit(tree, glassNode) {
  const frame = findFirst(tree, 'assemblyFramePart')
  if (!frame || glassNode?.part_type !== 'glassPart') return false
  return (frame.children ?? []).some(c => c.key === glassNode.key)
}

/** The frame's interior, in mm: { width, height }. */
export function frameInterior(tree) {
  const frame = findFirst(tree, 'assemblyFramePart')
  const cill  = findFirst(tree, 'cillPart')
  const fv = frame?.values ?? {}
  const w = num(fv.width)
  const h = num(fv.height)
  return {
    width:  w != null ? w - (num(fv.leftWidth) ?? 0) - (num(fv.rightWidth) ?? 0) : null,
    height: h != null ? h - (num(fv.topHeight) ?? 0) - (num(cill?.values?.height) ?? 0) : null,
  }
}

/**
 * The frame's openings, left to right: [{ width, height }].
 *
 * A CASEMENT mullion is SOLID, so its thickness is the value stored on the
 * mullion itself (27 on these drawings) — never the hollow box-sash profile
 * value `thicknessInFrameHollow`, which is what Step AE's box sash mullions
 * use.
 */
export function frameOpenings(tree) {
  const frame = findFirst(tree, 'assemblyFramePart')
  if (!frame) return []
  const interior = frameInterior(tree)
  if (interior.width == null) return []
  const mullions = (frame.children ?? []).filter(c => c.part_type === 'mullionPart')
  const slots = computeOpeningLayout(mullions, interior.width,
    m => num(m?.values?.thicknessInFrame) ?? 0)
  return slots.map(s => ({ width: s.width, height: interior.height }))
}

/** The frame's opening NODES, in tree order (Integrate's matrixIndex order). */
export function openingNodes(tree) {
  const frame = findFirst(tree, 'assemblyFramePart')
  return (frame?.children ?? []).filter(c => OPENING_TYPES.includes(c.part_type))
}

/** The opening a casement sash or direct glazed unit sits in, or null. */
export function openingFor(tree, node) {
  if (!node) return null
  const nodes = openingNodes(tree)
  const idx = nodes.findIndex(n => n.key === node.key)
  if (idx < 0) return null
  return frameOpenings(tree)[idx] ?? null
}

/** A casement sash's own size: its opening minus its clearances. */
export function casementSashSize(tree, sashNode) {
  const opening = openingFor(tree, sashNode)
  if (!opening || opening.width == null || opening.height == null) {
    return { width: null, height: null }
  }
  const v = sashNode.values ?? {}
  return {
    width:  opening.width  - (num(v.mechanicalClearanceLeft) ?? 0) - (num(v.mechanicalClearanceRight)  ?? 0),
    height: opening.height - (num(v.mechanicalClearanceTop)  ?? 0) - (num(v.mechanicalClearanceBottom) ?? 0),
  }
}

/** A casement sash's glass sightline: the sash minus its stiles and rails. */
export function casementGlassSightline(tree, sashNode) {
  const sash = casementSashSize(tree, sashNode)
  if (sash.width == null || sash.height == null) return { width: null, height: null }
  const v = sashNode.values ?? {}
  return {
    width:  sash.width  - (num(v.leftWidth) ?? 0) - (num(v.rightWidth)   ?? 0),
    height: sash.height - (num(v.topHeight) ?? 0) - (num(v.bottomHeight) ?? 0),
  }
}

/**
 * A direct glazed unit's VISIBLE size — its opening minus the mechanical
 * clearance each side. This is what Integrate's board shows (509 × 1165).
 */
export function directGlazedVisibleSize(tree, glassNode) {
  const opening = openingFor(tree, glassNode)
  if (!opening || opening.width == null || opening.height == null) {
    return { width: null, height: null }
  }
  const v = glassNode.values ?? {}
  return {
    width:  opening.width  - (num(v.mechanicalClearanceLeft) ?? 0) - (num(v.mechanicalClearanceRight)  ?? 0),
    height: opening.height - (num(v.mechanicalClearanceTop)  ?? 0) - (num(v.mechanicalClearanceBottom) ?? 0),
  }
}

/**
 * A direct glazed unit's GLASS size: the visible size plus the glass hidden
 * in the rebate on each edge (18 on these drawings). Integrate stores
 * hiddenInRebate per edge on the unit; it happens to equal
 * glazingRebateWidth − glazingTolerance (20 − 2) in its own data, so the
 * two readings agree, but the stored field is the one used here.
 */
export function directGlazedGlassSize(tree, glassNode) {
  const visible = directGlazedVisibleSize(tree, glassNode)
  if (visible.width == null || visible.height == null) return { width: null, height: null }
  const v = glassNode.values ?? {}
  return {
    width:  visible.width  + (num(v.hiddenInRebateLeft) ?? 0) + (num(v.hiddenInRebateRight)  ?? 0),
    height: visible.height + (num(v.hiddenInRebateTop)  ?? 0) + (num(v.hiddenInRebateBottom) ?? 0),
  }
}

/**
 * Casement sash timber volume in dm³ (litres) — Integrate's
 * `solid_redwood_volume` for price rule 165, one line per casement sash:
 *   (2 × sash height × stile + sash width × head + sash width × bottom rail)
 *   × thickness / 1e6
 * = (2 × 1197 × 62 + 541 × 62 + 541 × 83) × 54 / 1e6 = 12.25 exactly, which
 * is Integrate's printed quantity.
 *
 * NOTE the unit: these casement rules work in dm³, while the box sash volume
 * variables in computeVariables are in m³. No rule reads both.
 */
export function casementSashTimberVolumeDm3(tree, sashNode) {
  const sash = casementSashSize(tree, sashNode)
  const v = sashNode?.values ?? {}
  const thickness = num(v.sashThickness)
  if (sash.width == null || sash.height == null || !thickness) return 0
  const stile  = num(v.leftWidth)    ?? 0
  const head   = num(v.topHeight)    ?? 0
  const bottom = num(v.bottomHeight) ?? 0
  const mm3 = (2 * sash.height * stile + sash.width * head + sash.width * bottom) * thickness
  return mm3 / 1e6
}

/**
 * Casement cill timber volume in dm³ — Integrate's
 * `solid_utile_hardwood_cill_volume` for price rule 166:
 *   FULL FRAME WIDTH × cill depth × (cill height + cill stop)
 * = 1199 × 128 × (47 + 20) / 1e6 = 10.2826 dm³, and × 1.25 = 12.85, which is
 * Integrate's printed quantity.
 *
 * Not the two per-opening cill widths Integrate stores (549 each): its cill
 * VOLUME is the full frame width (step-ao §3). Box sash cills are unaffected
 * — their price rule has its own expression and does not read this variable.
 */
export function casementCillVolumeDm3(tree) {
  const frame = findFirst(tree, 'assemblyFramePart')
  const cill  = findFirst(tree, 'cillPart')
  const width = num(frame?.values?.width)
  const depth = num(cill?.values?.depth)
  const height = num(cill?.values?.height)
  const stop = num(frame?.values?.cillStopSize) ?? 0
  if (!width || !depth || !height) return 0
  return width * depth * (height + stop) / 1e6
}

/**
 * Total mullion and transom length in metres — Integrate's
 * `frame_muntin_to_be_replaced_length` (price rule 121, J's "Casement
 * Transoms & Mullions" line). Each divider runs the full interior height
 * (a mullion) or interior width (a transom).
 */
export function frameMuntinLengthM(tree) {
  const frame = findFirst(tree, 'assemblyFramePart')
  if (!frame) return 0
  const interior = frameInterior(tree)
  let mm = 0
  for (const child of (frame.children ?? [])) {
    if (child.part_type === 'mullionPart') mm += interior.height ?? 0
    if (child.part_type === 'transomPart') mm += interior.width  ?? 0
  }
  return mm / 1000
}
