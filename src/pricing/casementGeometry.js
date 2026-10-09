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
import { KG_PER_M2_PER_MM } from './sashWeight.js'
import { timberFamily, TIMBER_FAMILY_DENSITIES } from './optionVocabulary.js'

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
  // 2 dp before the rule, as Integrate does (12.25 / 16.76 / 21.90 readings)
  return round2dp(mm3 / 1e6)
}

/**
 * Integrate rounds a casement timber volume to 2 dp before the price rule
 * multiplies it (step-ao addendum). It is what makes the 1599 × 1599 frame
 * read 33.45 (26.7555 → 26.76 → × 1.25 = 33.45 exactly, where the unrounded
 * volume gives 33.4444), and it is consistent across every reading the
 * reviewer took: frames 20.90 / 23.47 / 26.76 / 28.78, sashes 12.25 / 16.76
 * / 21.90, cills 10.28 / 13.71.
 */
function round2dp(dm3) {
  return Math.round(dm3 * 100) / 100
}

/**
 * Casement FRAME timber volume in dm³ — Integrate's
 * `solid_redwood_frame_excl_cill_volume` for price rule 160, which
 * multiplies it by 1.25 (step-ao addendum §"Formula"):
 *
 *   head    = frame width      × frame depth × head overall    (47 + 20 stop)
 *   jambs   = 2 × internal height × frame depth × jamb overall (37 + 20 stop)
 *   mullion = mullion length   × frame depth × mullion overall (27 + 2 × 20)
 *
 * and no cill. The board shows those overall sizes as "Head 67",
 * "Left/Right Jamb 57" and "Mullion 67" on a 96-deep frame.
 *
 * Reproduces all four of the reviewer's readings exactly:
 *   1199 × 1299, no mullion  20.8995 → 20.90 → 26.125  (Integrate 26.13)
 *   1599 × 1299, no mullion  23.4723 → 23.47 → 29.3375 (Integrate 29.34)
 *   1599 × 1599, no mullion  26.7555 → 26.76 → 33.45   (Integrate 33.45)
 *   1199 × 1299, mullion     28.7787 → 28.78 → 35.975  (Integrate 35.98)
 *
 * MEASURED ON ONE FRAME ONLY: the mullion length, internal height + 20
 * (1225 on the 1299-high frame), comes from a single reading (K/N). Every
 * other term is confirmed by the four readings above.
 */
export function casementFrameTimberVolumeDm3(tree) {
  const frame = findFirst(tree, 'assemblyFramePart')
  if (!frame) return 0
  const fv = frame.values ?? {}
  const width = num(fv.width)
  const interior = frameInterior(tree)
  const depth = num(fv.frameDepth)
  if (!width || !depth || interior.height == null) return 0

  const headOverall = (num(fv.topHeight)  ?? 0) + (num(fv.frameHeadStopSize)  ?? 0)
  const jambOverall = (num(fv.leftWidth)  ?? 0) + (num(fv.frameStileStopSize) ?? 0)

  let mm3 = width * depth * headOverall
  mm3 += 2 * interior.height * depth * jambOverall

  for (const child of (frame.children ?? [])) {
    if (child.part_type !== 'mullionPart' && child.part_type !== 'transomPart') continue
    const thickness = num(child.values?.thicknessInFrame) ?? 0
    const stop = num(child.values?.mullionStopSize) ?? num(child.values?.transomStopSize) ?? 0
    const overall = thickness + 2 * stop
    // Mullion length = internal height + 20; transom length = internal
    // width + 20, by the same reading (one frame only).
    const length = child.part_type === 'mullionPart'
      ? (interior.height ?? 0) + 20
      : (interior.width  ?? 0) + 20
    mm3 += length * depth * overall
  }

  return round2dp(mm3 / 1e6)
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
  // 2 dp before the rule: 10.2826 → 10.28 → × 1.25 = 12.85 → × 1.085 = 13.94,
  // which is Integrate's figure (the unrounded volume gives 13.95)
  return round2dp(width * depth * (height + stop) / 1e6)
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

/**
 * Casement sash weight in kg, by the SAME method Step W measured for
 * sliding sashes (docs/step-w-sash-weight-brief.md): timber volume ×
 * the timber family's density, plus the glass at its CUT size ×
 * (inner + outer pane thickness) × 2.5 kg/m²/mm. No constant is
 * introduced here — both come from sashWeight.js / optionVocabulary.js.
 *
 * Needed by install labour rule 95 "Any Sash Overweight (Casement)",
 * which fires above 25 kg. What it gives (step-ao addendum):
 *   benchmark P's 1517 × 1497 sash  ≈ 50.4 kg  → the rule fires, as
 *                                                Integrate charges it
 *   K and N's  541 × 1197 sash      ≈ 15.8 kg  → it does not, as Integrate
 *
 * The glazing-bar and horn terms of the sliding-sash model do not apply:
 * these sashes have no bars and no horns.
 */
export function casementSashWeightKg(tree, sashNode, glassCatalogue = {}) {
  const v = sashNode?.values ?? {}
  const item = findFirst(tree, 'drawingItemPart')

  // Timber — the raw (unrounded) volume; the 2 dp rounding above is a
  // pricing convention, and it moves this by under a gram.
  const sash = casementSashSize(tree, sashNode)
  const thickness = num(v.sashThickness)
  if (sash.width == null || sash.height == null || !thickness) return 0
  const stile  = num(v.leftWidth)    ?? 0
  const head   = num(v.topHeight)    ?? 0
  const bottom = num(v.bottomHeight) ?? 0
  const timberMm3 =
    (2 * sash.height * stile + sash.width * head + sash.width * bottom) * thickness
  const family  = timberFamily(item?.values?.sashMaterialId)
  const density = TIMBER_FAMILY_DENSITIES[family] ?? TIMBER_FAMILY_DENSITIES.redwood
  const timberKg = (timberMm3 / 1e9) * density

  // Glass at the cut size, from the glass part's own rebate and tolerance
  const glass = (sashNode.children ?? []).find(c => c.part_type === 'glassPart')
  let glassKg = 0
  if (glass) {
    const gv = glass.values ?? {}
    const cover = (num(gv.glazingRebateWidth) ?? 0) - (num(gv.glazingTolerance) ?? 0)
    const sl = casementGlassSightline(tree, sashNode)
    if (sl.width != null && sl.height != null) {
      const areaM2 = (sl.width + 2 * cover) * (sl.height + 2 * cover) / 1e6
      const inner = glassCatalogue[gv.internalGlassPartNo]?.thickness_mm ?? 4
      const outer = glassCatalogue[gv.externalGlassPartNo]?.thickness_mm ?? 4
      glassKg = areaM2 * (inner + outer) * KG_PER_M2_PER_MM
    }
  }

  return timberKg + glassKg
}
