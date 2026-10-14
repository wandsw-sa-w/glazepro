/**
 * doorGeometry.js — French door geometry and the allocated Utile sections.
 *
 * Step AZ. Integrate stores a French door the way it stores a French
 * casement: ONE opening in the frame holding a `frenchDoorPart` (the pair)
 * with a left and a right leaf, and NO mullion
 * (docs/integrate-L31115-french-doors.txt).
 *
 * Two things make a door different from a window, and both live here:
 *
 *  1. THE LEAF IS NOT HALF THE OPENING. A French casement's two sashes split
 *     the opening less a gap; a door's two leaves OVERLAP at the meeting
 *     stile, so each leaf is half the opening plus half the overlap.
 *
 *  2. DOORS HAVE NO TIMBER VOLUME. Integrate prices no frame, sash or cill
 *     volume on a door at all. Instead it allocates LENGTHS of five utile
 *     stock sections and prices them per metre through the live rule "Utile
 *     Section Part" (loop allocated_section_part, qty length_in_m, value
 *     purchase_cost). `allocatedSectionParts` below is what feeds that loop.
 */

import {
  frameInterior, openingNodes, frameOpenings, casementSashSize, itemFrames, frameOwning,
  STABLE_DOOR_PART,
} from './casementGeometry.js'
import { KG_PER_M2_PER_MM } from './sashWeight.js'
import { timberFamily, TIMBER_FAMILY_DENSITIES } from './optionVocabulary.js'

// ── The part types ───────────────────────────────────────────────────────────

export const FRENCH_DOOR_PART = 'frenchDoorPart'
export const FRENCH_DOOR_LEAF_TYPES = ['leftFrenchDoorLeafPart', 'rightFrenchDoorLeafPart']
/** Every part type the `door_leaf` loop visits. */
export const DOOR_LEAF_TYPES = ['doorLeafPart', ...FRENCH_DOOR_LEAF_TYPES]

function num(v) {
  const n = Number(v)
  return isFinite(n) ? n : null
}

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const c of (node.children ?? [])) { const f = findFirst(c, partType); if (f) return f }
  return null
}

function findAll(node, partType, acc = []) {
  if (!node) return acc
  if (node.part_type === partType) acc.push(node)
  for (const c of (node.children ?? [])) findAll(c, partType, acc)
  return acc
}

/**
 * Step BF — THE STABLE DOOR.
 *
 * Integrate stores a StableDoorPart in the frame holding a TOP and a BOTTOM
 * stable leaf. GlazePro stores the container with two ordinary doorLeafParts
 * in it, each marked `stableHalf`, so door_leaf_qty is 2, the door_leaf loop
 * visits both, and every rule that knows a leaf needs no change: "Door Leaf"
 * 1035 fires per half, as Integrate’s own editor shows it does.
 *
 * The halves are NOT half the container each. Integrate’s drawing 21 splits
 * a 2103 container 1055 / 1048 — the top is 7 taller — so the split is
 * STORED, as a divider offset is: `splitOffset` is the TOP half’s height and
 * the bottom takes the rest. 1055 - 110 - 99 = 846 and 1048 - 99 - 170 = 779
 * are Integrate’s own cells, and the panels it prices.
 */
export const STABLE_HALVES = { TOP: 'top', BOTTOM: 'bottom' }

/** The stable-door container a leaf belongs to, or null. */
export function stableDoorPartFor(tree, leafNode) {
  return findAll(tree, STABLE_DOOR_PART)
    .find(c => (c.children ?? []).some(x => x.key === leafNode?.key)) ?? null
}

/** The two halves of a stable door, top first. */
export function stableHalves(container) {
  const halves = (container?.children ?? [])
    .filter(c => DOOR_LEAF_TYPES.includes(c.part_type))
  const top = halves.find(h => h.values?.stableHalf === STABLE_HALVES.TOP)
  const bottom = halves.find(h => h.values?.stableHalf === STABLE_HALVES.BOTTOM)
  return { top: top ?? halves[0] ?? null, bottom: bottom ?? halves[1] ?? null }
}

/** Every stable-door container in the tree. */
export function stableDoorParts(tree) {
  return findAll(tree, STABLE_DOOR_PART)
}

/** Is this leaf one half of a stable door? */
export function isStableHalf(leafNode) {
  const h = leafNode?.values?.stableHalf
  return h === STABLE_HALVES.TOP || h === STABLE_HALVES.BOTTOM
}

/**
 * A stable door CONTAINER's own size: the opening less its clearances, as a
 * single leaf is. Integrate: a 1005 x 2110 opening with 4 / 4 / 4 / 3 gives
 * 997 x 2103.
 */
export function stableDoorSize(tree, container) {
  const opening = openingFor(tree, container)
  if (!opening || opening.width == null || opening.height == null) {
    return { width: null, height: null }
  }
  const v = container?.values ?? {}
  return {
    width: opening.width - (num(v.mechanicalClearanceLeft) ?? 0) -
      (num(v.mechanicalClearanceRight) ?? 0),
    height: opening.height - (num(v.mechanicalClearanceTop) ?? 0) -
      (num(v.mechanicalClearanceBottom) ?? 0),
  }
}

/** An OPEN IN leaf — a front door. Integrate stores it as typeId 8. */
export function isOpenInLeaf(leafNode) {
  return String(leafNode?.values?.casementTypeId ?? '').toLowerCase() === 'open_in'
}

/** Every door leaf in the tree, in tree order. */
export function doorLeaves(tree) {
  return DOOR_LEAF_TYPES.flatMap(t => findAll(tree, t))
}

/** The French door pair a leaf belongs to, or null. */
export function frenchDoorPairFor(tree, leafNode) {
  if (!leafNode || !FRENCH_DOOR_LEAF_TYPES.includes(leafNode.part_type)) return null
  return findAll(tree, FRENCH_DOOR_PART)
    .find(p => (p.children ?? []).some(c => c.key === leafNode.key)) ?? null
}

// ── Leaf size ────────────────────────────────────────────────────────────────

/**
 * One door leaf's drawn size, in mm.
 *
 *   height = opening height - top clearance - bottom clearance
 *   width  = (opening width - left - right clearance - gap + MEETING STILE
 *             OVERLAP) / 2
 *
 * The overlap is what makes a door different from a French casement: the two
 * leaves lap over each other at the meeting stile, so each leaf is WIDER than
 * half the opening, not narrower. FD1's 1805 x 2115 opening gives
 * (1805 - 1 - 1 - 5 + 27) / 2 = 912.5 by 2115 - 3 - 3 = 2109, which is what
 * Integrate draws.
 *
 * Every value is read from the PAIR, where Integrate stores it, and from the
 * leaf only as a fallback.
 */
export function doorLeafSize(tree, leafNode) {
  // Step BF: a STABLE HALF is sized from its container and the stored
  // split, not from the frame opening — the container has already taken
  // the clearances off.
  const stable = isStableHalf(leafNode) ? stableDoorPartFor(tree, leafNode) : null
  if (stable) {
    const size = stableDoorSize(tree, stable)
    if (size.width == null || size.height == null) return { width: null, height: null }
    const split = num(stable.values?.splitOffset)
    const topHeight = split != null ? split : Math.round(size.height / 2)
    const isTop = leafNode.values?.stableHalf === STABLE_HALVES.TOP
    return {
      width: size.width,
      height: isTop ? topHeight : size.height - topHeight,
    }
  }
  const pair = frenchDoorPairFor(tree, leafNode)
  if (!pair) {
    // A single door leaf: the opening less its own clearances.
    const opening = openingFor(tree, leafNode)
    if (!opening) return { width: null, height: null }
    const v = leafNode?.values ?? {}
    return {
      width: opening.width - (num(v.mechanicalClearanceLeft) ?? 0) - (num(v.mechanicalClearanceRight) ?? 0),
      height: opening.height - (num(v.mechanicalClearanceTop) ?? 0) - (num(v.mechanicalClearanceBottom) ?? 0),
    }
  }

  const opening = openingFor(tree, pair)
  if (!opening || opening.width == null || opening.height == null) {
    return { width: null, height: null }
  }
  const pv = pair.values ?? {}
  const lv = leafNode?.values ?? {}
  const clear = edge => num(pv[edge]) ?? num(lv[edge]) ?? 0
  const gap = num(pv.gapBetweenMeetingStiles) ?? 0
  const overlap = num(pv.meetingStileOverlap) ?? 0

  const interiorW = opening.width -
    clear('mechanicalClearanceLeft') - clear('mechanicalClearanceRight')
  return {
    width: (interiorW - gap + overlap) / 2,
    height: opening.height -
      clear('mechanicalClearanceTop') - clear('mechanicalClearanceBottom'),
  }
}

/**
 * The cell a door opening (or a leaf's pair) sits in.
 *
 * Step BC: in the frame that OWNS it. A drawing can hold several frames, and
 * this asked the first frame about every one of them — so a door leaf in the
 * middle frame of CD1 had no cell, and therefore no size, no glass, no weight
 * and no sections.
 */
function openingFor(tree, node) {
  const frame = frameOwning(tree, node)
  const nodes = openingNodes(tree, frame)
  const idx = nodes.findIndex(n => n.key === node?.key ||
    (n.children ?? []).some(c => c.key === node?.key))
  if (idx < 0) return null
  return frameOpenings(tree, frame)[idx] ?? null
}

/**
 * A leaf's MID RAIL, or null.
 *
 * Step BA. Integrate splits a panelled leaf with a TransomPart inside the
 * leaf carrying `isMidrail` — a divider in the leaf, exactly as a frame
 * transom is a divider in the frame — and GlazePro stores it the same way.
 * Its `offset` is the opening ABOVE it (the glass) and the rest of the leaf
 * below it is the panel, which is how a frame transom's offset works too.
 */
export function leafMidRail(leafNode) {
  return leafMidRails(leafNode)[0] ?? null
}

// ── Step BD: the leaf’s OWN grid ─────────────────────────────────────────
//
// A front door leaf is divided like a little frame: Integrate stores a
// MullionPart (a 120 muntin) and a TransomPart (a mid rail) INSIDE the leaf,
// and a PanelPart or a GlassPart in each cell they make. FT1 is four
// raised-and-fielded panels: a muntin at 373 and a 170 mid rail at 983 over
// a 777 x 1788 interior.
//
// Step BA built the one case Integrate’s French doors need — ONE mid rail
// with the glass above and one panel below — by measuring "what is left of
// the leaf". That answer is a single size, so FT1’s four panels all priced
// 777 x 635 and all four Tricoya lines came out at 0.49 m2 instead of
// 0.37 / 0.28 / 0.24 / 0.18.

const byOffset = (a, b) => (num(a.values?.offset) ?? 0) - (num(b.values?.offset) ?? 0)

/** A leaf’s muntins (vertical dividers of its own grid), left to right. */
export function leafMuntins(leafNode) {
  return (leafNode?.children ?? []).filter(c => c.part_type === 'mullionPart').sort(byOffset)
}

/** A leaf’s mid rails (horizontal dividers), top to bottom. */
export function leafMidRails(leafNode) {
  return (leafNode?.children ?? []).filter(c => c.part_type === 'transomPart').sort(byOffset)
}

/** What a divider in a leaf takes out of it. */
/**
 * What a divider in a leaf takes out of it: its DRAWN thickness.
 *
 * Step BE: `thicknessInFrame` first. Integrate’s drawing 20 stores a mid
 * rail DRAWN at 120 with a midrailThickness PROPERTY of 170, and it is the
 * drawn 120 that divides the leaf (834 + 120 + 834 = the 1788 interior) and
 * the drawn 120 that decides the section — Integrate allocates nothing for
 * a 120 rail, exactly as on FT3. The FT1-FT3 fixtures carry the same value
 * in both fields, so nothing of theirs moves.
 */
function dividerThickness(node) {
  const v = node?.values ?? {}
  return num(v.thicknessInFrame) ?? num(v.midrailThickness) ?? num(v.muntinThickness) ?? 0
}

/**
 * A leaf’s INTERIOR: inside its stiles and rails, which is what its grid
 * divides. FT1: 997 - 110 - 110 = 777 by 2068 - 110 - 170 = 1788.
 */
export function leafInterior(tree, leafNode) {
  const leaf = gridHolderSize(tree, leafNode)
  if (leaf.width == null || leaf.height == null) return { width: null, height: null }
  const v = leafNode?.values ?? {}
  return {
    width:  leaf.width  - (num(v.leftWidth) ?? 0) - (num(v.rightWidth) ?? 0),
    height: leaf.height - (num(v.topHeight) ?? 0) - (num(v.bottomHeight) ?? 0),
  }
}

/**
 * Step BE: a grid is not only a DOOR LEAF’s.
 *
 * Nathan’s side light (decision g, drawing 20) is a FIXED CASEMENT SASH
 * beside the door, and it holds the same thing a leaf does: a mid rail with
 * glass above and a raised-and-fielded panel below, lining up with the
 * door’s. So everything about the grid — the cells, which part sits in
 * which, a panel’s visible size — asks the HOLDER for its own outer size
 * and works inwards from there.
 */
export function canHoldGrid(node) {
  return DOOR_LEAF_TYPES.includes(node?.part_type) ||
    node?.part_type === 'casementSashPart'
}

/** The outer size of whatever holds a grid. */
function gridHolderSize(tree, node) {
  if (node?.part_type === 'casementSashPart') return casementSashSize(tree, node)
  return doorLeafSize(tree, node)
}

/**
 * The spans a run of dividers makes across a total. A divider’s `offset` is
 * the span BEFORE it and its thickness comes out of what is left — the same
 * convention a frame transom’s offset follows.
 */
function spans(total, dividers) {
  if (total == null) return []
  const out = []
  let used = 0
  for (const d of dividers) {
    const offset = num(d.values?.offset) ?? 0
    out.push({ start: used, size: offset })
    used = offset + dividerThickness(d)
  }
  out.push({ start: used, size: total - used })
  return out
}

/**
 * The cells of a leaf’s own grid, ROW-MAJOR — the top row left to right,
 * then the next. That is the order Integrate stores the leaf’s panels and
 * glass in, so cell i belongs to the i-th panel or glass child.
 */
export function leafCells(tree, leafNode) {
  const interior = leafInterior(tree, leafNode)
  if (interior.width == null || interior.height == null) return []
  const cols = spans(interior.width,  leafMuntins(leafNode))
  const rows = spans(interior.height, leafMidRails(leafNode))
  const cells = []
  rows.forEach((r, row) => cols.forEach((c, col) => {
    cells.push({ x: c.start, y: r.start, width: c.size, height: r.size, col, row })
  }))
  return cells
}

/** The parts that sit IN a leaf’s cells, in cell order. */
export function leafCellParts(leafNode) {
  return (leafNode?.children ?? [])
    .filter(c => c.part_type === 'panelPart' || c.part_type === 'glassPart')
}

/**
 * The LEAF OR SASH a panel or a glass unit belongs to, or null.
 *
 * Step BE: a side light is a casement sash with a grid of its own, so this
 * looks for any holder rather than only a door leaf — without it the side
 * light's panel had no cell, and so no size and no Tricoya line at all.
 */
export function leafHolding(tree, node) {
  const holders = []
  const walk = n => {
    if (canHoldGrid(n)) holders.push(n)
    for (const c of (n?.children ?? [])) walk(c)
  }
  walk(tree)
  return holders.find(l => (l.children ?? []).some(c => c.key === node?.key)) ?? null
}

/** The cell a panel or a glass unit sits in, by its place among them. */
export function leafCellOf(tree, node) {
  const leaf = leafHolding(tree, node)
  if (!leaf) return null
  const idx = leafCellParts(leaf).findIndex(c => c.key === node?.key)
  if (idx < 0) return null
  return leafCells(tree, leaf)[idx] ?? null
}

/**
 * Where to DRAW a leaf’s cells: one rect per cell, offset from the
 * interior’s top-left corner, with the node that sits in it.
 *
 * The elevation drew a leaf as one timber rect with ONE glass rect cut out
 * of it, so a panelled leaf — Step BA’s French door as well as a front
 * door — was drawn as a fully glazed one. The geometry is here, where it
 * is testable; the SVG only maps over it.
 *
 * @param {number} gx  the interior’s left edge in drawing units
 * @param {number} gy  the interior’s top edge
 */
export function leafCellRects(tree, leafNode, gx = 0, gy = 0) {
  const cells = leafCells(tree, leafNode)
  const parts = leafCellParts(leafNode)
  return cells.map((c, i) => ({
    node: parts[i] ?? null,
    kind: parts[i]?.part_type === 'panelPart' ? 'panel' : 'glass',
    x: gx + c.x, y: gy + c.y, width: c.width, height: c.height,
    col: c.col, row: c.row,
  }))
}

/**
 * Step BE follow-up: the rects the BOARD draws for one opening, or none.
 *
 * The elevation asked leafCellRects only about a DOOR LEAF, so the side
 * light — a casement sash with a mid rail, glass and a panel in the tree,
 * all three priced — was drawn as one pane of full-height glass. The gate
 * belongs with the geometry, where it is testable, rather than in the SVG:
 * anything that CAN hold a grid answers with its cells, and anything else
 * with nothing.
 */
export function gridRectsFor(tree, node, gx = 0, gy = 0) {
  if (!canHoldGrid(node)) return []
  return leafCellRects(tree, node, gx, gy)
}

/**
 * Step BF follow-up: where a STABLE DOOR’s two halves are drawn.
 *
 * The board drew the container as one pane of glass — the parts list and
 * the tree were right, and the elevation showed a single blue opening. The
 * geometry is here, where it is testable, and the SVG maps over it.
 *
 * Given the OPENING’s rect (the frame cell the container sits in), each
 * half comes back with its own rect, its rails, its cells (panel / glass /
 * vision panel, through the same gridRectsFor) and its node, so a click
 * can select any of them.
 *
 * The container’s own clearances inset it from the opening (4 / 4 / 4 / 3
 * on Integrate’s), and the stored split puts the join where Integrate has
 * it — 1055 of a 2103 container, not half each.
 */
export function stableHalfRects(tree, container, x = 0, y = 0) {
  if (container?.part_type !== STABLE_DOOR_PART) return []
  const size = stableDoorSize(tree, container)
  if (size.width == null || size.height == null) return []
  const v = container.values ?? {}
  const left = num(v.mechanicalClearanceLeft) ?? 0
  const top  = num(v.mechanicalClearanceTop) ?? 0
  const { top: topHalf, bottom: bottomHalf } = stableHalves(container)

  const out = []
  let offsetY = y + top
  for (const half of [topHalf, bottomHalf]) {
    if (!half) continue
    const z = doorLeafSize(tree, half)
    if (z.width == null || z.height == null) continue
    const hv = half.values ?? {}
    const stileL = num(hv.leftWidth) ?? 0
    const railT   = num(hv.topHeight) ?? 0
    const interior = leafInterior(tree, half)
    out.push({
      node: half,
      half: hv.stableHalf ?? null,
      x: x + left, y: offsetY, width: z.width, height: z.height,
      // the glass / panel area inside its own rails
      interior: {
        x: x + left + stileL, y: offsetY + railT,
        width: interior.width ?? 0, height: interior.height ?? 0,
      },
      cells: gridRectsFor(tree, half, x + left + stileL, offsetY + railT),
    })
    offsetY += z.height
  }
  return out
}

/**
 * A VISION PANEL to draw: the small light inside a panel, centred in it.
 * Its size is its own (200 x 350 on Integrate’s), not the cell’s.
 */
export function visionPanelRect(panelNode, cellRect) {
  const glass = (panelNode?.children ?? []).find(c => c.part_type === 'glassPart')
  if (!glass || !cellRect) return null
  const w = num(glass.values?.visionPanelWidth)
  const h = num(glass.values?.visionPanelHeight)
  if (!(w > 0) || !(h > 0)) return null
  return {
    node: glass,
    x: cellRect.x + (cellRect.width - w) / 2,
    y: cellRect.y + (cellRect.height - h) / 2,
    width: w, height: h,
  }
}


/** A PANEL’s visible size: its own cell. */
export function panelSizeFor(tree, panelNode) {
  const cell = leafCellOf(tree, panelNode)
  if (!cell) return { width: null, height: null }
  return { width: cell.width, height: cell.height }
}


/**
 * A door leaf's glass sightline: the leaf less its stiles and rails.
 *
 * With a MID RAIL the glass stops at the rail: its height is the rail's own
 * offset, not the whole leaf less the top and bottom rails. FD4's leaf is
 * 2109 high and its glass 1241 — without this the glass ran the full 1836
 * and priced a third more glass than the door has.
 */
export function doorGlassSightline(tree, leafNode, glassNode = null) {
  // Step BD: the glass unit's OWN cell when the caller names it. A leaf can
  // hold several (a muntin between two lights), and every one of them used
  // to take the same “above the first mid rail” answer.
  if (glassNode) {
    const cell = leafCellOf(tree, glassNode)
    if (cell) return { width: cell.width, height: cell.height }
  }
  const cells = leafCells(tree, leafNode)
  if (cells.length) {
    // No node named: the leaf’s FIRST cell, which is the glass on every
    // door Integrate draws (glass above, panel below).
    const glassIdx = leafCellParts(leafNode)
      .findIndex(c => c.part_type === 'glassPart')
    const cell = cells[glassIdx >= 0 ? glassIdx : 0]
    if (cell) return { width: cell.width, height: cell.height }
  }
  const leaf = doorLeafSize(tree, leafNode)
  if (leaf.width == null || leaf.height == null) return { width: null, height: null }
  const v = leafNode.values ?? {}
  return {
    width: leaf.width - (num(v.leftWidth) ?? 0) - (num(v.rightWidth) ?? 0),
    height: leaf.height - (num(v.topHeight) ?? 0) - (num(v.bottomHeight) ?? 0),
  }
}

/**
 * The PANEL under a leaf's mid rail, in mm — its visible size, which is what
 * the live "Tricoya Panel" rule prices (visible W x H, unrounded).
 *
 * It is the leaf's sightline width by what is left below the rail:
 * leaf height - top rail - glass - mid rail - bottom rail. FD4:
 * 2109 - 110 - 1241 - 170 - 163 = 425, which is Integrate's own offset2.
 */
export function doorPanelSize(tree, leafNode) {
  const rail = leafMidRail(leafNode)
  if (!rail) return { width: null, height: null }
  // Step BD: the FIRST panel's own cell. On a one-mid-rail leaf that is
  // what the arithmetic here worked out (FD4: 442.5 x 425); on a leaf with
  // a muntin too it is the cell the panel actually occupies.
  const panel = leafCellParts(leafNode)
    .find(c => c.part_type === 'panelPart')
  if (panel) {
    const size = panelSizeFor(tree, panel)
    if (size.width != null) return size
  }
  const cells = leafCells(tree, leafNode)
  const last = cells[cells.length - 1]
  return last ? { width: last.width, height: last.height } : { width: null, height: null }
}

/** The leaf a panel belongs to, or null. */
export function leafForPanel(tree, panelNode) {
  return doorLeaves(tree)
    .find(l => (l.children ?? []).some(c => c.key === panelNode?.key)) ?? null
}

// ── The allocated Utile sections ─────────────────────────────────────────────

/**
 * Which stock section carries which part of the door, and the material it is
 * priced in.
 *
 * Nathan (13 Oct): doors are sold in UTILE and ACCOYA only, and an Accoya
 * door is priced on the utile sections until he supplies Accoya prices
 * (Integrate prices NO timber at all on an Accoya door, which is a gap in
 * Integrate, not a target). The table is keyed by material so an Accoya
 * column can be added as DATA later without touching this code.
 */
export const SECTION_PART_CODES = {
  frame:         'Utile67x96',    // head + both jambs
  cillAndBottom: 'Utile63x200',   // cill + each leaf's bottom rail
  leaf:          'Utile63x120',   // each leaf's two stiles + top rail
  fanlight:      'Utile63x63',    // fanlight top rail + stiles
  fanlightRail:  'Utile63x96',    // fanlight bottom rail, 86 mm
}

/** The materials a door is sold in, and the section set each one prices on. */
export const DOOR_MATERIALS = {
  utile:  SECTION_PART_CODES,
  accoya: SECTION_PART_CODES,   // Nathan: utile prices until Accoya ones exist
}

/**
 * The two fixed offsets in the section lengths.
 *
 * Read ONCE each, from FD1, and confirmed fixed by FD2: resizing the drawing
 * moved every allocated length by exactly the change in size, so neither
 * offset is a function of the sizes. They are recorded as single readings,
 * not derived — if a third drawing disagrees, these are the numbers to doubt.
 */
export const LEAF_SECTION_OFFSET_MM = -6     // per leaf, on 2 x H + W
/**
 * Step BD: an OPEN IN leaf takes -20 where an open-out one takes -6. Read
 * on all three front-door drawings (FT1 5113 on a 997 x 2068 leaf, FT2 4995,
 * FT3 5147) and consistent across them — still a reading, not a derivation.
 */
export const OPEN_IN_LEAF_SECTION_OFFSET_MM = -20
export const FANLIGHT_SECTION_OFFSET_MM = 14 // per fanlight, on W + 2 x H
/**
 * Step BE: how deep a rail has to be to be a DOOR’s rail rather than a
 * casement’s. A fanlight’s bottom rail is 62 (Nathan’s) or 86 (Integrate’s
 * template); a door’s is 163-175, and Nathan’s side light carries the door’s
 * 175 so the two line up. One reading, from drawing 20.
 */
export const DOOR_DEPTH_RAIL_MM = 150

/**
 * Step BF: which stock section a RAIL is cut from — the smallest one it
 * fits in. The stock is 63x63, 63x96, 63x120 and 63x200, so:
 *
 *     a 62 fanlight rail      -> 63x63    (Nathan, difference 7a)
 *     Integrate's 86 rail     -> 63x96
 *     a 99 stable MEETING rail-> 63x120   (new: 96 is too narrow for 99)
 *     a 163 / 170 door rail   -> 63x200
 *     a 175 side light's rail -> 63x200
 *
 * which is every reading taken so far, from one rule rather than a list of
 * thresholds that happened to fit.
 */
export function railSectionFor(depthMm, codes) {
  const d = num(depthMm) ?? 0
  if (d <= 63) return codes.fanlight
  if (d <= 96) return codes.fanlightRail
  if (d <= 120) return codes.leaf
  return codes.cillAndBottom
}
/**
 * A leaf MID RAIL is cut from the cill-and-bottom-rail section at the leaf
 * width LESS 10 (Step BA). FD4: 2 x 652.5 on leaves 662.5 wide, which with
 * the cill and the two bottom rails makes Integrate's 4029. A single
 * reading, like the two above — one drawing, not a derivation.
 */
export const MID_RAIL_SECTION_OFFSET_MM = -10

/**
 * A Tricoya panel’s weight, per m2 of panel.
 *
 * Step BD: a panelled leaf’s panels are part of what the installers lift,
 * and "Any Door Overweight" (45 install minutes a leaf over 50 kg) turns on
 * it. A panel is two TRICOYA SKINS over an insulation core, not a solid
 * board — a solid 56 would put FT1’s leaf at 65 kg, and Integrate charges
 * FT1 no overweight at all.
 *
 * The three front-door readings BRACKET the figure: FT1 (1.063 m2 of panel,
 * 42.93 kg of timber) must stay UNDER 50, so a panel is at most 6.65 kg/m2;
 * FT2 (0.48 m2, 48.81 kg) must go OVER, so it is at least 2.5. Two 6 mm
 * Tricoya skins at 510 kg/m3 — a standard sheet — give 6.1, inside the
 * bracket and physically what the workshop builds. The insulation core is
 * ignored (about 0.5 kg/m2).
 *
 * PROVISIONAL: a reading of Integrate’s own item weight on a panelled door,
 * or the workshop’s panel build-up, settles it. FT1 then sits at 49.4 kg,
 * 0.6 under the line, which is the figure to re-check first.
 */
export const TRICOYA_DENSITY_KG_M3 = 510
export const PANEL_SKIN_THICKNESS_MM = 6
export const PANEL_KG_PER_M2 = 2 * PANEL_SKIN_THICKNESS_MM * TRICOYA_DENSITY_KG_M3 / 1e6 * 1000

/**
 * The lengths of stock section a door drawing uses, for the
 * `allocated_section_part` loop.
 *
 * Each row is one stock part and the TOTAL length of it the drawing needs.
 * The live rule prices `length_in_m` (mm / 1000, UNROUNDED) x
 * `purchase_cost` and rounds the line to 2 dp.
 *
 * @returns {Array<{part_code, part_name, length_mm, length_in_m, label}>}
 */
export function allocatedSectionParts(tree, { material = 'utile' } = {}) {
  const frames = itemFrames(tree)
  if (frames.length === 0) return []
  const leaves = doorLeaves(tree)
  if (leaves.length === 0) return []

  const codes = DOOR_MATERIALS[String(material).toLowerCase()] ?? SECTION_PART_CODES

  const lengths = new Map()
  const add = (code, mm, label) => {
    if (!(mm > 0)) return
    const row = lengths.get(code) ?? { part_code: code, length_mm: 0, label }
    row.length_mm += mm
    lengths.set(code, row)
  }

  // ── Step BC: EVERY frame, not just the first ──────────────────────────
  //
  // A single door with flag lights is one item holding several frames, and
  // Nathan (13 Oct, decision a) charges each frame's timber IN FULL: its
  // own head and jambs, its own cill, its own dividers. Integrate charges
  // one frame — the sum of the widths with twice the DOOR frame's height —
  // and only the door frame's cill, so a flag frame's jambs and cill are
  // free in Integrate and charged here.
  //
  // On a one-frame drawing this loop runs once and the arithmetic is
  // exactly what it was.
  for (const frame of frames) {
    const fv = frame.values ?? {}
    const overallW = num(fv.width) ?? 0
    const overallH = num(fv.height) ?? 0
    const interior = frameInterior(tree, frame)

    // Frame head + both jambs, at the OVERALL frame size
    add(codes.frame, overallW + 2 * overallH, 'Frame head and jambs')
    // and its own cill
    add(codes.cillAndBottom, overallW, 'Cill')

    // The TRANSOM under a fanlight. Integrate allocates nothing for it.
    // Nathan (13 Oct): GlazePro charges it at Utile67x96 for the internal
    // frame width — PROVISIONAL, because no listed section is big enough
    // for its 77 x 96 finished size and the workshop has to confirm the
    // real stock (docs/integrate-differences.md 7b). Per frame: each of
    // CD4's three frames has one.
    for (const _t of (frame.children ?? []).filter(c => c.part_type === 'transomPart')) {
      add(codes.frame, interior.width ?? 0, 'Transom (provisional section)')
    }
    // A DOORSET's frame MULLIONS, the same way (Step BA, difference 11).
    for (const _m of (frame.children ?? []).filter(c => c.part_type === 'mullionPart')) {
      add(codes.frame, interior.height ?? 0, 'Mullion (provisional section)')
    }
  }

  for (const leaf of leaves) {
    const z = doorLeafSize(tree, leaf)
    // Step BF: the bottom rail from the smallest section it fits — a door's
    // 170 from 63x200, a stable half's 99 MEETING rail from 63x120.
    const bottomRail = num(leaf.values?.bottomHeight) ?? 0
    add(railSectionFor(bottomRail, codes), z.width ?? 0,
      `Door bottom rail ${bottomRail}`)
    // Each leaf's two stiles and its top rail. Step BD: an OPEN IN leaf
    // takes -20 (the three front-door drawings), an open-out one -6.
    const leafOffset = isOpenInLeaf(leaf)
      ? OPEN_IN_LEAF_SECTION_OFFSET_MM
      : LEAF_SECTION_OFFSET_MM
    add(codes.leaf, 2 * (z.height ?? 0) + (z.width ?? 0) + leafOffset,
      'Door stiles and top rail')
    const interior = leafInterior(tree, leaf)
    for (const rail of leafMidRails(leaf)) {
      const thickness = dividerThickness(rail)
      // A 170 MID RAIL comes from the same 63x200 section as the bottom
      // rail — the same deep rail, at the leaf width less 10 (Step BA,
      // read on FD4 and confirmed by FT1 and FT2).
      if (thickness >= 150) {
        add(codes.cillAndBottom, (z.width ?? 0) + MID_RAIL_SECTION_OFFSET_MM, 'Leaf mid rail')
        continue
      }
      // A 120 MID RAIL (the arched door’s) is not in Integrate’s 63x200
      // length at all and it allocates nothing else for it. Nathan’s
      // standing rule: GlazePro charges door timber Integrate omits — at
      // 63x120 for the leaf’s interior width. PROVISIONAL, workshop to
      // confirm the stock (docs/integrate-differences.md).
      add(codes.leaf, interior.width ?? 0, 'Leaf 120 mid rail (provisional section)')
    }
    // A leaf MUNTIN, the same way: a 120 section running the leaf’s
    // interior height between the rails (FT1 1788). Integrate allocates
    // nothing for it either. PROVISIONAL.
    for (const _m of leafMuntins(leaf)) {
      add(codes.leaf, interior.height ?? 0, 'Leaf muntin (provisional section)')
    }
  }

  // A FANLIGHT over the pair, or a SIDE LIGHT beside the door: its top rail
  // and stiles, and its bottom rail.
  for (const sash of findAll(tree, 'casementSashPart')) {
    const z = casementSashSize(tree, sash)
    if (z.width == null || z.height == null) continue
    const rail = num(sash.values?.bottomHeight) ?? 0
    // Step BE: a SIDE LIGHT is not a fanlight. Nathan’s drawing 20 has a
    // full-height fixed sash with a 175 bottom rail — a DOOR-depth rail —
    // and Integrate allocates it like a door’s: 63x200 for the rail, and the
    // stiles and top rail at 63x63 with NO offset (4517 = W + 2H exactly,
    // where a fanlight reads +14). The rail depth is what tells them apart:
    // a fanlight’s is 62 or 86, a side light’s is the door’s 170-odd.
    const isSideLight = rail >= DOOR_DEPTH_RAIL_MM
    add(codes.fanlight,
      z.width + 2 * z.height + (isSideLight ? 0 : FANLIGHT_SECTION_OFFSET_MM),
      isSideLight ? 'Side light stiles and top rail' : 'Fanlight top rail and stiles')
    // The bottom rail's own section depends on how deep the rail is.
    // Integrate charges the 86 mm rail at 63x96 and charges NOTHING for a
    // 62 mm one. Nathan (13 Oct): GlazePro charges the 62 at 63x63 for the
    // sash width, as the 86 is charged at 63x96 — a deliberate difference
    // (docs/integrate-differences.md 7a). Step BE: a 175 rail comes from the
    // same 63x200 as a door’s bottom rail, which is Integrate’s own
    // allocation on drawing 20.
    const railCode = railSectionFor(rail, codes)
    add(railCode, z.width,
      `${isSideLight ? 'Side light' : 'Fanlight'} bottom rail ${rail}`)
  }


  return [...lengths.values()].map(r => ({
    ...r,
    part_name: sectionPartName(r.part_code),
    length_in_m: r.length_mm / 1000,
  }))
}

/**
 * Integrate's own name for a stock section, e.g. "Utile 63mm x 120mm".
 *
 * The live rule's condition is `contains(part_name, utile)`, so the NAME is
 * what decides whether a section prices at all — not the code.
 */
export function sectionPartName(partCode) {
  const m = String(partCode).match(/^Utile(\d+)x(\d+)$/)
  if (!m) return String(partCode)
  return `Utile ${m[1]}mm x ${m[2]}mm`
}


// ── Leaf weight ──────────────────────────────────────────────────────────────

/**
 * One door leaf's weight in kg, by exactly the method GlazePro weighs a
 * casement sash: the timber at its DRAWN sizes times the material's density,
 * plus the glass at its CUT size.
 *
 * This decides Integrate's "Any Door Overweight" (45 install minutes a leaf
 * over 50 kg), which is 90 of FD1's 870 minutes and none of FD2's or FD3's.
 * The facts reconcile all three:
 *
 *   FD1  (2 x 2109 x 110 + 692.5 x 273) x 54 = 35.26 dm3 -> 27.5 kg
 *        + 26.7 kg glass = 54 kg   OVER 50
 *   FD2  24.9 + 19.9 = 45 kg       under
 *   FD3  24.0 + 16.1 = 40 kg       under
 *
 * A door is utile or Accoya, never softwood, so the density comes from the
 * drawing's own sash material — the same lookup a utile casement sash uses.
 */
export function doorLeafWeightKg(tree, leafNode, glassCatalogue = {}) {
  const v = leafNode?.values ?? {}
  const item = findFirst(tree, 'drawingItemPart')

  const leaf = doorLeafSize(tree, leafNode)
  const thickness = num(v.thickness) ?? num(v.sashThickness)
  if (leaf.width == null || leaf.height == null || !thickness) return 0

  const stile  = num(v.leftWidth)    ?? 0
  const other  = num(v.rightWidth)   ?? stile
  const head   = num(v.topHeight)    ?? 0
  const bottom = num(v.bottomHeight) ?? 0
  // A DOOR's rails run BETWEEN its stiles, so they are the SIGHTLINE width,
  // not the full leaf width. That is Integrate's own arithmetic in the facts:
  // FD1 is (2 x 2109 x 110 + 692.5 x 273) x 54 = 35.26 dm3, where 692.5 is
  // the glass sightline and 912.5 the leaf. Using the leaf width instead
  // gives 38.5 dm3 and a leaf 2.6 kg heavier — which happens not to change
  // any FD drawing's overweight minutes, but would on a leaf near the 50 kg
  // line. (A casement SASH's rails are measured across the full sash; the
  // two conventions differ and both are Integrate's.)
  // Step BD: the leaf’s INTERIOR width, which is what "the glass
  // sightline" meant here — a leaf with a grid has several glass cells and
  // the first of them is not the rail length. On FD1 the two are the same
  // 692.5 that Integrate’s own 35.26 dm3 is built from; on FT1 the first
  // cell is 373 wide and the rails are still 777.
  const railWidth = leafInterior(tree, leafNode).width ?? leaf.width
  // Step BD: a leaf’s OWN DIVIDERS are timber in the leaf — a 120 muntin
  // runs its interior height and a mid rail its interior width. Without
  // them FT1’s leaf weighed 14 kg less than its timber.
  const interior = leafInterior(tree, leafNode)
  let dividerMm3 = 0
  for (const m of leafMuntins(leafNode)) {
    dividerMm3 += (interior.height ?? 0) * dividerThickness(m) * thickness
  }
  for (const r of leafMidRails(leafNode)) {
    dividerMm3 += (interior.width ?? 0) * dividerThickness(r) * thickness
  }
  const timberMm3 =
    (leaf.height * (stile + other) + railWidth * head + railWidth * bottom) * thickness +
    dividerMm3
  const family  = timberFamily(item?.values?.sashMaterialId)
  const density = TIMBER_FAMILY_DENSITIES[family] ?? TIMBER_FAMILY_DENSITIES.redwood
  const timberKg = (timberMm3 / 1e9) * density

  // Step BD: EVERY glass unit in the leaf, each on its own cell.
  let glassKg = 0
  for (const glass of (leafNode.children ?? []).filter(c => c.part_type === 'glassPart')) {
    const gv = glass.values ?? {}
    const cover = (num(gv.glazingRebateWidth) ?? 0) - (num(gv.glazingTolerance) ?? 0)
    const sl = doorGlassSightline(tree, leafNode, glass)
    if (sl.width == null || sl.height == null) continue
    const areaM2 = (sl.width + 2 * cover) * (sl.height + 2 * cover) / 1e6
    const inner = glassCatalogue[gv.internalGlassPartNo]?.thickness_mm ?? 4
    const outer = glassCatalogue[gv.externalGlassPartNo]?.thickness_mm ?? 4
    glassKg += areaM2 * (inner + outer) * KG_PER_M2_PER_MM
  }
  // Step BD: and the PANELS, each on its own cell.
  let panelKg = 0
  for (const panel of (leafNode.children ?? []).filter(c => c.part_type === 'panelPart')) {
    const size = panelSizeFor(tree, panel)
    if (size.width == null || size.height == null) continue
    panelKg += (size.width * size.height / 1e6) * PANEL_KG_PER_M2
  }

  return timberKg + glassKg + panelKg
}
