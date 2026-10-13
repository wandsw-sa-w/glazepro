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

function findAll(node, partType, acc = []) {
  if (!node) return acc
  if (node.part_type === partType) acc.push(node)
  for (const c of (node.children ?? [])) findAll(c, partType, acc)
  return acc
}

// ── Step BC: more than one frame in a drawing ────────────────────────────────
//
// Integrate stores a door with flag lights as ONE item holding a containerPart
// with several assemblyFrameParts side by side. Every question below used to
// start with findFirst(tree, 'assemblyFramePart') — "the" frame — which on a
// container answered for the FIRST frame whatever was being asked about.
//
// Each of these helpers now takes an OPTIONAL frame: either the frame node
// itself or any node inside it. A one-frame drawing resolves to the only
// frame, so every existing caller and every existing benchmark is unchanged;
// the node-based helpers (a sash's size, an opening's label) resolve the
// frame that OWNS the node, which is what makes a flag frame's own sash a
// fanlight of its own frame rather than of the first one.

/** Every assembly frame in the item, in tree order — left to right. */
export function itemFrames(tree) {
  return findAll(tree, 'assemblyFramePart')
}

/** Is this a multi-frame (container) drawing? */
export function isMultiFrame(tree) {
  return itemFrames(tree).length > 1
}

/** The frame that OWNS a node, or null. */
export function frameOwning(tree, node) {
  if (!node) return null
  if (node.part_type === 'assemblyFramePart') return node
  const holds = (n, key) => (n.children ?? []).some(
    c => c.key === key || holds(c, key))
  return itemFrames(tree).find(f => holds(f, node.key)) ?? null
}

/**
 * The frame a helper should answer for: the frame passed in, the frame that
 * owns the node passed in, or — asked nothing — the FIRST frame, which is
 * what every one-frame drawing means by "the frame".
 */
function theFrame(tree, frameOrNode = null) {
  if (frameOrNode) return frameOwning(tree, frameOrNode)
  return itemFrames(tree)[0] ?? null
}

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return isFinite(n) ? n : null
}

// Step AX: a FRENCH casement is one opening holding a PAIR — a
// frenchCasementPart with a left and a right sash and no mullion — which is
// how Integrate stores it (docs/integrate-L31115-french-casements.txt). So
// the pair is an opening, and its two sashes are casement sashes for every
// purpose that counts sashes: production, timber, glass, weight.
export const FRENCH_PAIR_PART = 'frenchCasementPart'
export const FRENCH_SASH_TYPES = ['leftFrenchCasementSashPart', 'rightFrenchCasementSashPart']
export const CASEMENT_SASH_TYPES = ['casementSashPart', ...FRENCH_SASH_TYPES]

// Step AZ: a FRENCH DOOR pair is an opening too — one frenchDoorPart in the
// frame holding a left and a right leaf, and no mullion, exactly as a French
// casement does.
export const FRENCH_DOOR_PAIR_PART = 'frenchDoorPart'

// Step BB: a SINGLE door leaf is an opening in its own right. Integrate
// stores it as a plain `doorLeafPart` DIRECTLY in the frame opening with no
// pair part at all (docs/integrate-L31115-single-doors.txt), which is the
// whole difference from a French door — so the frame's opening list has to
// include it, or the leaf has no cell, no size, no glass and no weight.
export const SINGLE_DOOR_LEAF_PART = 'doorLeafPart'
export const OPENING_TYPES = ['casementSashPart', 'glassPart', FRENCH_PAIR_PART,
  FRENCH_DOOR_PAIR_PART, SINGLE_DOOR_LEAF_PART]

// A French casement pair and a French door pair have the SAME shape — one
// opening, two leaves, no mullion, a master leaf — so the board treats them
// as one kind of thing (labels, the drawing, the master-leaf choice) and only
// the geometry and the sections differ. One list rather than two parallel
// code paths, which is what drifted when OPENING_TYPES had two copies.
export const PAIR_PART_TYPES = [FRENCH_PAIR_PART, FRENCH_DOOR_PAIR_PART]
export const PAIR_LEAF_TYPES = [
  'leftFrenchCasementSashPart', 'rightFrenchCasementSashPart',
  'leftFrenchDoorLeafPart', 'rightFrenchDoorLeafPart',
]
/** Is this node a pair (a French casement or a French door)? */
export function isPairPart(node) {
  return PAIR_PART_TYPES.includes(node?.part_type)
}
/** Is this node the LEFT leaf of a pair? */
export function isLeftLeaf(node) {
  return node?.part_type === 'leftFrenchCasementSashPart' ||
    node?.part_type === 'leftFrenchDoorLeafPart'
}

/** Is this glassPart a direct glazed unit — a direct child of the frame? */
export function isDirectGlazedUnit(tree, glassNode) {
  if (glassNode?.part_type !== 'glassPart') return false
  // Step BC: a unit is direct glazed when it is the child of ANY frame of
  // the item, not only the first.
  return itemFrames(tree).some(
    f => (f.children ?? []).some(c => c.key === glassNode.key))
}

/** The frame's interior, in mm: { width, height }. */
export function frameInterior(tree, frameOrNode = null) {
  const frame = theFrame(tree, frameOrNode)
  // Step BC: the frame's OWN cill. findFirst(tree) took the first frame's
  // cill for every frame of a container, so a flag frame's interior height
  // came out of the door frame's cill.
  const cill  = (frame?.children ?? []).find(c => c.part_type === 'cillPart')
    ?? findFirst(tree, 'cillPart')
  const fv = frame?.values ?? {}
  const w = num(fv.width)
  const h = num(fv.height)
  return {
    width:  w != null ? w - (num(fv.leftWidth) ?? 0) - (num(fv.rightWidth) ?? 0) : null,
    height: h != null ? h - (num(fv.topHeight) ?? 0) - (num(cill?.values?.height) ?? 0) : null,
  }
}

/** A divider's thickness in the frame, as the part itself stores it. */
function dividerThickness(d) {
  return num(d?.values?.thicknessInFrame) ?? 0
}

/**
 * The frame's COLUMN slots, left to right, from its mullions.
 *
 * A CASEMENT mullion is SOLID, so its thickness is the value stored on the
 * mullion itself (27 on these drawings) — never the hollow box-sash profile
 * value `thicknessInFrameHollow`, which is what Step AE's box sash mullions
 * use.
 */
export function frameColumns(tree, frameOrNode = null) {
  const frame = theFrame(tree, frameOrNode)
  const interior = frameInterior(tree, frame)
  if (!frame || interior.width == null) return []
  const mullions = (frame.children ?? []).filter(c => c.part_type === 'mullionPart')
  return computeOpeningLayout(mullions, interior.width, dividerThickness)
}

/**
 * The frame's ROW slots, TOP TO BOTTOM, from its transoms (Step AR).
 *
 * A transom is stored exactly as a mullion is, turned through 90°: its
 * `offset` is the height of the opening ABOVE it and its thickness is its
 * own `thicknessInFrame` (27, solid, 67 overall with its two 20 stops). On
 * Integrate's 980-high fanlight frame the transom sits at 356 and the
 * internal height 886 = 356 + 27 + 503, which is what makes the row above
 * it 356 and the one below 503.
 *
 * Row 1 is the TOP row, so the fanlight is A1 and the casement below it A2,
 * as Integrate tags them.
 */
export function frameRows(tree, frameOrNode = null) {
  const frame = theFrame(tree, frameOrNode)
  const interior = frameInterior(tree, frame)
  if (!frame || interior.height == null) return []
  const transoms = (frame.children ?? []).filter(c => c.part_type === 'transomPart')
  return computeOpeningLayout(transoms, interior.height, dividerThickness)
}

/** How many columns and rows the frame is divided into. */
export function frameGridSize(tree, frameOrNode = null) {
  return {
    cols: Math.max(frameColumns(tree, frameOrNode).length, 1),
    rows: Math.max(frameRows(tree, frameOrNode).length, 1),
  }
}

/**
 * The frame's openings as a flat list in Integrate's matrix order:
 * A1, B1, …, then A2, B2, … — across the top row first, then down.
 *
 * Step AV: a cell may SPAN columns or rows, because a mullion or transom can
 * stop at ANOTHER DIVIDER instead of running to the frame (Integrate's
 * startDivider / endDivider). TC1's fanlight is one opening across both
 * columns of the top row, because its mullion starts at the transom and only
 * exists below it; TC3's opener is one opening down both rows of the left
 * column, because its transom starts at the mullion and only exists to the
 * right of it.
 *
 * A spanning opening takes its TOP-LEFT slot and the slots it covers hold no
 * part, so the list reads A1, A2, B2 on TC1 and A1, B1, B2 on TC3 — the
 * empty slot is simply skipped, as Integrate skips it.
 *
 * Opening nodes take these cells in tree order, so the tree's order of
 * openings IS this order (see openingNodes).
 */
export function frameOpenings(tree, frameOrNode = null) {
  return frameCells(tree, frameOrNode).map(c => ({
    width: c.width, height: c.height, x: c.x, y: c.y,
    col: c.col, row: c.row, colSpan: c.colSpan, rowSpan: c.rowSpan,
  }))
}

/**
 * The frame's cells, merged where a divider does not separate them.
 *
 * Returns, in row-major order, only the OCCUPIED cells:
 *   { col, row, colSpan, rowSpan, x, y, width, height }
 * `x` / `y` are measured from the frame's interior top-left, and a spanning
 * cell's width or height INCLUDES the divider it crosses (TC1's fanlight is
 * 493 + 27 + 511 = 1031 wide).
 */
export function frameCells(tree, frameOrNode = null) {
  const frame = theFrame(tree, frameOrNode)
  const cols = frameColumns(tree, frame)
  const rows = frameRows(tree, frame)
  if (cols.length === 0 || rows.length === 0) return []

  const mullions = sortedDividers(frame, 'mullionPart')
  const transoms = sortedDividers(frame, 'transomPart')

  // Does the mullion BETWEEN column i and i+1 actually separate row r?
  // It does when that mullion exists in row r — i.e. when r is inside the
  // span the mullion's startDivider / endDivider give it.
  const mullionSeparates = (i, r) =>
    dividerCoversIndex(mullions[i], transoms, r)
  // ...and the transom between row j and j+1 separating column c.
  const transomSeparates = (j, c) =>
    dividerCoversIndex(transoms[j], mullions, c)

  const taken = new Set()
  const key = (c, r) => `${c},${r}`
  const out = []

  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      if (taken.has(key(c, r))) continue

      // Extend right while the mullion between c+span-1 and c+span does not
      // separate this row.
      let colSpan = 1
      while (c + colSpan < cols.length && !mullionSeparates(c + colSpan - 1, r)) colSpan++
      // Extend down while the transom below does not separate this column.
      let rowSpan = 1
      while (r + rowSpan < rows.length && !transomSeparates(r + rowSpan - 1, c)) rowSpan++

      for (let dc = 0; dc < colSpan; dc++) {
        for (let dr = 0; dr < rowSpan; dr++) taken.add(key(c + dc, r + dr))
      }

      const lastCol = cols[c + colSpan - 1]
      const lastRow = rows[r + rowSpan - 1]
      out.push({
        col: c, row: r, colSpan, rowSpan,
        x: cols[c].x, y: rows[r].x,
        // The span includes the dividers crossed, which is why this is the
        // far edge minus the near edge rather than a sum of the slots.
        width:  lastCol.x + lastCol.width - cols[c].x,
        height: lastRow.x + lastRow.width - rows[r].x,
      })
    }
  }
  return out
}

/** A frame's dividers of one type, in the order they appear across the frame. */
export function sortedDividers(frame, partType) {
  return (frame?.children ?? [])
    .filter(c => c.part_type === partType)
    .sort((a, b) => (num(a.values?.offset) ?? 0) - (num(b.values?.offset) ?? 0))
}

/**
 * Does `divider` exist at index `i` along the axis the CROSSING dividers
 * divide?
 *
 * A divider names what it starts and ends at (Integrate's startDivider /
 * endDivider; the frame when absent), so its extent is a range of the slots
 * the crossing dividers make. `crossing` is the sorted list of those — for a
 * mullion, the transoms; for a transom, the mullions — and index `i` counts
 * the slots between them, so crossing[k] separates slot k from slot k+1.
 *
 * A divider that runs frame to frame covers every slot, which is every
 * divider before Step AV and still the common case.
 */
function dividerCoversIndex(divider, crossing, i) {
  if (!divider) return false
  const startAt = dividerRefIndex(divider.values?.startDivider, crossing)
  const endAt   = dividerRefIndex(divider.values?.endDivider,   crossing)
  // startDivider names the crossing divider this one BEGINS at, so it covers
  // the slots AFTER it; endDivider names where it stops, so it covers the
  // slots BEFORE it.
  const from = startAt == null ? 0 : startAt + 1
  const to   = endAt   == null ? crossing.length : endAt
  return i >= from && i <= to
}

/**
 * The index of the crossing divider a reference names, or null for "the
 * frame".
 *
 * The reference is a divider's stable `key`, not an array index: an index
 * would silently point at a different divider as soon as one is added,
 * removed or re-spaced. Integrate's own '0' means the frame, and null,
 * undefined and '0' are all treated that way.
 */
function dividerRefIndex(ref, crossing) {
  if (ref == null || ref === '' || ref === '0' || ref === 0) return null
  const idx = crossing.findIndex(d => d.key === ref)
  return idx < 0 ? null : idx
}

/**
 * Is this divider SHORT — does it stop at another divider rather than run
 * frame to frame?
 *
 * The frame timber reads this: a full divider is measured as the internal
 * dimension + 20, a short one as its own opening span plus a small
 * allowance (casementFrameTimberVolumeDm3).
 */
export function isShortDivider(tree, divider) {
  const frame = theFrame(tree, divider)
  if (!frame || !divider) return false
  const crossing = divider.part_type === 'mullionPart'
    ? sortedDividers(frame, 'transomPart')
    : sortedDividers(frame, 'mullionPart')
  return dividerRefIndex(divider.values?.startDivider, crossing) != null ||
         dividerRefIndex(divider.values?.endDivider,   crossing) != null
}

/**
 * A SHORT divider's own length — the span of the opening it divides, which
 * is the extent of the slots it covers along its own axis.
 *
 * TC1's short mullion lies in the bottom row only, so its length comes from
 * that row's 983; TC3's short transom lies in column B only, so from that
 * column's 561.
 */
export function shortDividerSpanMm(tree, divider) {
  const frame = theFrame(tree, divider)
  if (!frame || !divider) return null
  const isMullion = divider.part_type === 'mullionPart'
  // A mullion runs vertically, so its length is measured down the ROWS; a
  // transom runs horizontally, so across the COLUMNS.
  const along = isMullion ? frameRows(tree) : frameColumns(tree)
  const crossing = isMullion
    ? sortedDividers(frame, 'transomPart')
    : sortedDividers(frame, 'mullionPart')
  if (along.length === 0) return null

  const startAt = dividerRefIndex(divider.values?.startDivider, crossing)
  const endAt   = dividerRefIndex(divider.values?.endDivider,   crossing)
  const from = startAt == null ? 0 : startAt + 1
  const to   = endAt   == null ? along.length - 1 : endAt
  if (from > to) return null
  const first = along[from]
  const last  = along[to]
  if (!first || !last) return null
  return last.x + last.width - first.x
}

/** The frame's opening NODES, in tree order (Integrate's matrixIndex order). */
export function openingNodes(tree, frameOrNode = null) {
  const frame = theFrame(tree, frameOrNode)
  return (frame?.children ?? []).filter(c => OPENING_TYPES.includes(c.part_type))
}

/** The opening a casement sash or direct glazed unit sits in, or null. */
export function openingFor(tree, node) {
  if (!node) return null
  // Step BC: the openings of the frame that OWNS this node. On a container
  // the first frame's openings answered for every frame, so a flag frame's
  // sash had no cell at all and therefore no size.
  const frame = frameOwning(tree, node)
  const nodes = openingNodes(tree, frame)
  // A French sash is not itself an opening — the PAIR it belongs to is, so
  // the sash takes its parent's cell.
  const idx = nodes.findIndex(n => n.key === node.key ||
    (n.children ?? []).some(c => c.key === node.key))
  if (idx < 0) return null
  return frameOpenings(tree, frame)[idx] ?? null
}

/** The French pair a French sash belongs to, or null. */
export function frenchPairFor(tree, sashNode) {
  if (!sashNode || !FRENCH_SASH_TYPES.includes(sashNode.part_type)) return null
  return openingNodes(tree).find(n => n.part_type === FRENCH_PAIR_PART &&
    (n.children ?? []).some(c => c.key === sashNode.key)) ?? null
}

/** A casement sash's own size: its opening minus its clearances. */
export function casementSashSize(tree, sashNode) {
  const opening = openingFor(tree, sashNode)
  if (!opening || opening.width == null || opening.height == null) {
    return { width: null, height: null }
  }
  const v = sashNode.values ?? {}
  // Step AX: a FRENCH sash is half the opening. Integrate stores the
  // clearances and the meeting-stile gap on the PAIR, not on the sashes, so
  // they are read from there first and from the sash only as a fallback:
  //   height = opening - 2 x clearance
  //   width  = (opening width - 2 x clearance - gap) / 2
  // FR1's 1125 x 1219 opening gives 556.5 x 1211 each, which is what
  // Integrate draws.
  const pair = frenchPairFor(tree, sashNode)
  const src = pair?.values ?? v
  const clear = edge => num(src[edge]) ?? num(v[edge]) ?? 0
  const width = opening.width - clear('mechanicalClearanceLeft') - clear('mechanicalClearanceRight')
  const height = opening.height - clear('mechanicalClearanceTop') - clear('mechanicalClearanceBottom')
  if (pair) {
    const gap = num(pair.values?.gapBetweenMeetingStiles) ?? 0
    return { width: (width - gap) / 2, height }
  }
  return { width, height }
}

/**
 * A casement sash's THICKNESS, in mm — the one place it is read.
 *
 * Step AQ item 3: the key is `thickness`, which is what the field
 * definition, the property panel, Integrate and validation all use. The
 * board and the templates used to store `sashThickness` instead, so the
 * panel showed Thickness blank and validation rule 59 read nothing. Any
 * drawing SAVED before the migration still holds the old key, so it is
 * read as a fallback and must stay readable — a stored drawing is data,
 * not something to rewrite under the surveyor.
 */
export function casementSashThicknessMm(sashNode) {
  const v = sashNode?.values ?? {}
  return num(v.thickness) ?? num(v.sashThickness) ?? null
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
 * Step AP: a direct glazed unit with NO hidden-in-rebate stored would price
 * its VISIBLE size — smaller glass, quietly cheaper. The board stores the
 * value (rebate − tolerance = 18), so a missing one means the unit was
 * built some other way and must be a visible warning, never a silent
 * under-measure.
 *
 * @returns {string[]} one warning per direct glazed unit that is missing it
 */
export function directGlazedWarnings(tree) {
  const warnings = []
  const frame = findFirst(tree, 'assemblyFramePart')
  for (const child of (frame?.children ?? [])) {
    if (child.part_type !== 'glassPart') continue
    const v = child.values ?? {}
    const sides = ['hiddenInRebateLeft', 'hiddenInRebateRight', 'hiddenInRebateTop', 'hiddenInRebateBottom']
    const missing = sides.filter(k => num(v[k]) == null)
    if (missing.length > 0) {
      warnings.push(
        `Direct glazed unit has no glass hidden in the rebate (${missing.join(', ')}) — ` +
        `it is priced at its VISIBLE size; set the unit's rebate and tolerance so the board can store it`)
    }
  }
  return warnings
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
  const thickness = casementSashThicknessMm(sashNode)
  if (sash.width == null || sash.height == null || !thickness) return 0
  // Step AX: the two stiles are read separately, because a FRENCH sash has
  // an outer stile and a MEETING stile of different widths (62 and 63 on
  // FR1). An ordinary casement sash has the same width both sides, so
  // height x (left + right) is the 2 x height x stile it was before; a sash
  // with no rightWidth stored falls back to the left, unchanged.
  const stile  = num(v.leftWidth)    ?? 0
  const other  = num(v.rightWidth)   ?? stile
  const head   = num(v.topHeight)    ?? 0
  const bottom = num(v.bottomHeight) ?? 0
  const mm3 = (sash.height * (stile + other) + sash.width * head + sash.width * bottom) * thickness
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
/**
 * The allowance on a SHORT divider's length — its opening span plus this.
 *
 * NOT VERIFIED beyond one reading each (Step AV). They differ because
 * Integrate's own figures differ: no single constant reproduces both TC1 and
 * TC3. See casementFrameTimberVolumeDm3 for the arithmetic.
 */
export const SHORT_MULLION_ALLOWANCE_MM = 2
export const SHORT_TRANSOM_ALLOWANCE_MM = 3

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
    // A divider that runs FRAME TO FRAME is the internal dimension + 20 (as
    // benchmarks J, Q and TC2, all exact).
    //
    // Step AV: a divider that STOPS AT ANOTHER DIVIDER is its own opening
    // span plus a small allowance. ONE READING EACH and no single constant
    // fits both, so they are two named constants, listed as unverified:
    //   TC1's short MULLION  983 -> 985 (+2) is exact: 984 gives 43.18 and
    //                        986 gives 43.20, against Integrate's 43.19.
    //   TC3's short TRANSOM  561 -> 564 or 565 (+3 or +4) — both give
    //                        Integrate's 40.48, so the reading does not
    //                        choose between them. +3 is used.
    // Worth well under 1p either way: 1 mm is 0.0064 dm3.
    const isMullion = child.part_type === 'mullionPart'
    let length
    if (isShortDivider(tree, child)) {
      const span = shortDividerSpanMm(tree, child) ?? 0
      length = span + (isMullion
        ? SHORT_MULLION_ALLOWANCE_MM
        : SHORT_TRANSOM_ALLOWANCE_MM)
    } else {
      length = isMullion
        ? (interior.height ?? 0) + 20
        : (interior.width  ?? 0) + 20
    }
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
 * Transoms & Mullions" line).
 *
 * A mullion is INTERNAL HEIGHT + 25 here (step-ap addendum). The reviewer
 * proved it by moving the head on a copy of J: with head 47 (internal
 * height 1205) the line read 1.35 → length ~1230, and with head 57
 * (internal height 1195) it read 1.3419 → length 1220. So the length
 * follows the head, not the overall frame.
 *
 * NOTE the +25 here against the +20 the FRAME TIMBER volume uses for the
 * same mullion (casementFrameTimberVolumeDm3, Step AO §5, measured at
 * 1225 on the same 1299-high frame). Integrate really does use two lengths
 * in two rules; both are kept, each with its own reading.
 */
export function frameMuntinLengthM(tree) {
  const frame = findFirst(tree, 'assemblyFramePart')
  if (!frame) return 0
  const interior = frameInterior(tree)
  let mm = 0
  for (const child of (frame.children ?? [])) {
    if (child.part_type === 'mullionPart') mm += (interior.height ?? 0) + 25
    if (child.part_type === 'transomPart') mm += (interior.width  ?? 0) + 25
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
  const thickness = casementSashThicknessMm(sashNode)
  if (sash.width == null || sash.height == null || !thickness) return 0
  const stile  = num(v.leftWidth)    ?? 0
  const other  = num(v.rightWidth)   ?? stile
  const head   = num(v.topHeight)    ?? 0
  const bottom = num(v.bottomHeight) ?? 0
  const timberMm3 =
    (sash.height * (stile + other) + sash.width * head + sash.width * bottom) * thickness
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
