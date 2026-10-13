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
  frameInterior, openingNodes, frameOpenings, casementSashSize,
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

/** The cell a door opening (or a leaf's pair) sits in. */
function openingFor(tree, node) {
  const nodes = openingNodes(tree)
  const idx = nodes.findIndex(n => n.key === node?.key ||
    (n.children ?? []).some(c => c.key === node?.key))
  if (idx < 0) return null
  return frameOpenings(tree)[idx] ?? null
}

/** A door leaf's glass sightline: the leaf less its stiles and rails. */
export function doorGlassSightline(tree, leafNode) {
  const leaf = doorLeafSize(tree, leafNode)
  if (leaf.width == null || leaf.height == null) return { width: null, height: null }
  const v = leafNode.values ?? {}
  return {
    width: leaf.width - (num(v.leftWidth) ?? 0) - (num(v.rightWidth) ?? 0),
    height: leaf.height - (num(v.topHeight) ?? 0) - (num(v.bottomHeight) ?? 0),
  }
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
export const FANLIGHT_SECTION_OFFSET_MM = 14 // per fanlight, on W + 2 x H

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
  const frame = findFirst(tree, 'assemblyFramePart')
  if (!frame) return []
  const leaves = doorLeaves(tree)
  if (leaves.length === 0) return []

  const codes = DOOR_MATERIALS[String(material).toLowerCase()] ?? SECTION_PART_CODES
  const fv = frame.values ?? {}
  const overallW = num(fv.width) ?? 0
  const overallH = num(fv.height) ?? 0
  const interior = frameInterior(tree)

  const lengths = new Map()
  const add = (code, mm, label) => {
    if (!(mm > 0)) return
    const row = lengths.get(code) ?? { part_code: code, length_mm: 0, label }
    row.length_mm += mm
    lengths.set(code, row)
  }

  // Frame head + both jambs, at the OVERALL frame size
  add(codes.frame, overallW + 2 * overallH, 'Frame head and jambs')

  // The cill (overall width) and each leaf's bottom rail (its own width)
  add(codes.cillAndBottom, overallW, 'Cill')
  for (const leaf of leaves) {
    const z = doorLeafSize(tree, leaf)
    add(codes.cillAndBottom, z.width ?? 0, 'Door bottom rail')
    // Each leaf's two stiles and its top rail
    add(codes.leaf, 2 * (z.height ?? 0) + (z.width ?? 0) + LEAF_SECTION_OFFSET_MM,
      'Door stiles and top rail')
  }

  // A FANLIGHT over the pair: its top rail and stiles, and its bottom rail.
  for (const sash of findAll(tree, 'casementSashPart')) {
    const z = casementSashSize(tree, sash)
    if (z.width == null || z.height == null) continue
    add(codes.fanlight, (z.width) + 2 * (z.height) + FANLIGHT_SECTION_OFFSET_MM,
      'Fanlight top rail and stiles')
    // The bottom rail's own section depends on how deep the rail is.
    // Integrate charges the 86 mm rail at 63x96 and charges NOTHING for a
    // 62 mm one. Nathan (13 Oct): GlazePro charges the 62 at 63x63 for the
    // sash width, as the 86 is charged at 63x96 — a deliberate difference
    // (docs/integrate-differences.md 7a).
    const rail = num(sash.values?.bottomHeight) ?? 0
    add(rail >= 80 ? codes.fanlightRail : codes.fanlight, z.width,
      `Fanlight bottom rail ${rail}`)
  }

  // The TRANSOM under a fanlight. Integrate allocates nothing for it.
  // Nathan (13 Oct): GlazePro charges it at Utile67x96 for the internal
  // frame width — PROVISIONAL, because no listed section is big enough for
  // its 77 x 96 finished size and the workshop has to confirm the real
  // stock (docs/integrate-differences.md 7b).
  for (const _transom of (frame.children ?? []).filter(c => c.part_type === 'transomPart')) {
    add(codes.frame, interior.width ?? 0, 'Transom (provisional section)')
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
  const railWidth = doorGlassSightline(tree, leafNode).width ?? leaf.width
  const timberMm3 =
    (leaf.height * (stile + other) + railWidth * head + railWidth * bottom) * thickness
  const family  = timberFamily(item?.values?.sashMaterialId)
  const density = TIMBER_FAMILY_DENSITIES[family] ?? TIMBER_FAMILY_DENSITIES.redwood
  const timberKg = (timberMm3 / 1e9) * density

  const glass = (leafNode.children ?? []).find(c => c.part_type === 'glassPart')
  let glassKg = 0
  if (glass) {
    const gv = glass.values ?? {}
    const cover = (num(gv.glazingRebateWidth) ?? 0) - (num(gv.glazingTolerance) ?? 0)
    const sl = doorGlassSightline(tree, leafNode)
    if (sl.width != null && sl.height != null) {
      const areaM2 = (sl.width + 2 * cover) * (sl.height + 2 * cover) / 1e6
      const inner = glassCatalogue[gv.internalGlassPartNo]?.thickness_mm ?? 4
      const outer = glassCatalogue[gv.externalGlassPartNo]?.thickness_mm ?? 4
      glassKg = areaM2 * (inner + outer) * KG_PER_M2_PER_MM
    }
  }
  return timberKg + glassKg
}
