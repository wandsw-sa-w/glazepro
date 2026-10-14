// openingDirection.js — a door drawing opens IN or OUT (Step BG).
//
// Nathan (14 Oct 2026): French doors and single garden doors are sold opening
// in as well as out, stable doors either way, front doors in. So direction is
// a whole-drawing choice on every door drawing — and, as with stormproof, a
// mixed drawing is not a thing a surveyor can sell.
//
// HOW INTEGRATE DOES IT (docs/integrate-L31115-door-direction.txt): direction
// is the item's RANGE, not a property of a leaf. "Standard Open Out Doors"
// (range single_and_french_doors, GlazePro profile code `open_out_doors`) and
// "Standard Open In Doors" (`open_in_doors`) are two ranges, and switching
// re-applies the range's values through a "Range Defaults" dialog. What it
// writes:
//
//   the frame     bottom 37 (out) <-> 50 (in), cill stop 26 <-> 0
//   the cill      height 37 <-> 50
//   the doors     typeId 7 "Open Out / Flush with Stops Internally"
//                 <-> 8 "Open In / Flush with Stops Externally", on a leaf,
//                 on a French pair part and on a stable-door container
//   clearances    a single leaf 2 / 3 / 3 / 3 <-> 3 / 14 / 4 / 4
//                 a French pair 3 / 3 / 1 / 1 <-> 3 / 14 / 3 / 3
//                 a stable-door container 4 / 4 / 4 / 3 — the SAME both ways
//   bottom rail   out stepped (btmRailShapeId 101) 163 internal / 170
//                 external <-> in square (99) 170 both sides
//
// and what it must NOT touch: the layout, the frame SIZE, the panels, the
// glass, the finish or the stored ironmongery list. Integrate's own switch
// also shrank a fanlight door's frame by 8 mm and took the same 8 off the
// fanlight's bottom rail; both are quirks and neither is copied — a
// surveyor's measured frame does not move because the door now opens the
// other way.
//
// A FANLIGHT OR CASEMENT LIGHT IN THE SAME FRAME STILL OPENS OUT (Nathan,
// 14 Oct), as Integrate leaves it. Only its clearances follow the range, and
// only when the profile holds them — see `setOpeningDirection`.
//
// Nothing here prices anything. The engine reads direction from the TREE
// (typeId per leaf, the -20 / -6 section offset, the multipoint-lock rules'
// is_opening_in / is_opening_out, and rule 245 "Frame with inward opening and
// outward opening"), which is why switching a drawing is enough to reprice it
// — proved by OI1 / OI2 / OI3 / SO1 in src/pricing/benchmarks/fixtureDoor.js.

import { firstOf } from './casementOpenings.js'
import { STABLE_DOOR_PART } from '../pricing/casementGeometry.js'
import { DOOR_LEAF_TYPES, FRENCH_DOOR_PART, STABLE_HALVES } from '../pricing/doorGeometry.js'

/** Integrate typeId 7 and 8, in GlazePro's own vocabulary. */
export const OPEN_OUT = 'open_out'
export const OPEN_IN  = 'open_in'
export const OPENING_DIRECTIONS = [OPEN_OUT, OPEN_IN]

/** The drawing's profile — the range itself, which is where direction lives. */
export const DIRECTION_PROFILE_CODES = {
  [OPEN_OUT]: 'open_out_doors',
  [OPEN_IN]:  'open_in_doors',
}

/** The profile code a direction belongs to, and the other way round. */
export function profileCodeForDirection(direction) {
  return DIRECTION_PROFILE_CODES[direction] ?? null
}
export function directionForProfileCode(code) {
  return OPENING_DIRECTIONS.find(d => DIRECTION_PROFILE_CODES[d] === code) ?? null
}

/**
 * Integrate's own TEMPLATE bottom rails, by direction.
 *
 * The leaf bottom rail is the one value the two profiles do not hold — it
 * comes from the template, which is why `doorOpenings.js` already names
 * Integrate's 163 / 170 (DEFAULT_LEAF_BOTTOM_RAIL_MM). The profile still
 * wins if it holds one.
 */
export const DIRECTION_BOTTOM_RAIL = {
  [OPEN_OUT]: { bottomHeight: 163, bottomHeightExternal: 170, btmRailShapeId: 'stepped' },
  [OPEN_IN]:  { bottomHeight: 170, bottomHeightExternal: 170, btmRailShapeId: 'square' },
}

/** Every rail either direction's defaults name — the set a switch may move. */
const PROFILE_RAILS = [163, 170]

const CANDIDATES = {
  frameBottom: ['assemblyFramePart.bottomHeight'],
  cillStop:    ['assemblyFramePart.cillStopSize'],
  cillHeight:  ['cillPart.height'],

  pairClearTop:    ['frenchDoorPart.mechanicalClearanceTop'],
  pairClearBottom: ['frenchDoorPart.mechanicalClearanceBottom'],
  pairClearLeft:   ['frenchDoorPart.mechanicalClearanceLeft'],
  pairClearRight:  ['frenchDoorPart.mechanicalClearanceRight'],

  leafClearTop:    ['doorLeafPart.mechanicalClearanceTop'],
  leafClearBottom: ['doorLeafPart.mechanicalClearanceBottom'],
  leafClearLeft:   ['doorLeafPart.mechanicalClearanceLeft'],
  leafClearRight:  ['doorLeafPart.mechanicalClearanceRight'],
}

/** The leaf bottom rail, if the profile happens to hold one. */
const RAIL_CANDIDATES = {
  leafBottomRail:         ['doorLeafPart.bottomHeight', 'leftFrenchDoorLeafPart.bottomHeight'],
  leafBottomRailExternal: ['doorLeafPart.bottomHeightExternal', 'leftFrenchDoorLeafPart.bottomHeightExternal'],
  leafBottomRailShape:    ['doorLeafPart.btmRailShapeId', 'leftFrenchDoorLeafPart.btmRailShapeId'],
}

/** A casement light's clearances — OPTIONAL, see `setOpeningDirection`. */
const SASH_CANDIDATES = {
  sashClearTop:    ['casementSashPart.mechanicalClearanceTop', 'casementSashPart.mechanicalClearance'],
  sashClearBottom: ['casementSashPart.mechanicalClearanceBottom', 'casementSashPart.mechanicalClearance'],
  sashClearLeft:   ['casementSashPart.mechanicalClearanceLeft', 'casementSashPart.mechanicalClearance'],
  sashClearRight:  ['casementSashPart.mechanicalClearanceRight', 'casementSashPart.mechanicalClearance'],
}

/**
 * The values a direction switch needs, from the TARGET range's profile.
 *
 * `missing` names every required key the profile does not hold, in the same
 * words `doorProfileDefaults` uses — a switch that cannot read the range it
 * is switching to must change nothing rather than write nulls into a drawing.
 */
export function directionDefaults(profileValues) {
  const values = {}
  const missing = []
  for (const [name, candidates] of Object.entries(CANDIDATES)) {
    const { value } = firstOf(profileValues, candidates)
    values[name] = value
    if (value == null) missing.push(`${name} (tried ${candidates.join(', ')})`)
  }
  // optional: the rail and the sash clearances
  for (const [name, candidates] of Object.entries({ ...RAIL_CANDIDATES, ...SASH_CANDIDATES })) {
    values[name] = firstOf(profileValues, candidates).value
  }
  const hasSashClearances = Object.keys(SASH_CANDIDATES).every(k => values[k] != null)
  return { values, missing, hasSashClearances }
}

function num(v) {
  const n = Number(v)
  return isFinite(n) ? n : null
}

const DOOR_PART_TYPES = [...DOOR_LEAF_TYPES, FRENCH_DOOR_PART, STABLE_DOOR_PART]

function walk(node, fn) {
  if (!node) return
  fn(node)
  for (const child of (node.children ?? [])) walk(child, fn)
}

/**
 * Which way this drawing's doors open, or null if it has none.
 *
 * The PARTS are asked, not the profile: a drawing saved before this step
 * carries its direction on its own nodes, and the profile is only how a new
 * one is built. A drawing whose doors disagree (which the board cannot make)
 * answers with the first one, so the switch can still put it right.
 */
export function drawingDirection(tree) {
  let found = null
  walk(tree, node => {
    if (found || !DOOR_PART_TYPES.includes(node.part_type)) return
    const t = String(node.values?.casementTypeId ?? '').toLowerCase()
    if (t.includes('open_in')) found = OPEN_IN
    else if (t.includes('open_out')) found = OPEN_OUT
  })
  return found
}

/** Is this leaf one half of a stable door? (Its container holds it.) */
function stableHalfOf(node) {
  const h = node?.values?.stableHalf
  return h === STABLE_HALVES.TOP || h === STABLE_HALVES.BOTTOM ? h : null
}

/**
 * One leaf's bottom rail, moved only if it is still on a value a PROFILE or a
 * template chose.
 *
 * A rail the surveyor typed survives the switch, exactly as it survives a
 * stormproof conversion (`stormproofSashValues`) and the divider picker.
 */
function railValues(values, rail) {
  const current = num(values?.bottomHeight)
  if (current != null && !PROFILE_RAILS.includes(current)) return {}
  return { ...rail }
}

/**
 * Turn a whole door drawing round.
 *
 * `profileValues` are the TARGET range's — the caller loads the other
 * profile, because that is what the drawing's `default_profile_id` becomes.
 *
 * What changes: the frame bottom and its cill stop, the cill height, every
 * door part's type, a leaf's and a pair's clearances, and the leaf bottom
 * rails. A STABLE-DOOR container keeps its 4 / 4 / 4 / 3 (Integrate's switch
 * leaves them), and only its BOTTOM half's rail moves.
 *
 * What does NOT change: the frame's width or height, the layout, any
 * fanlight's or casement light's DIRECTION or its rails, panels, glass, the
 * finish, the stored ironmongery list — and a rail a surveyor typed.
 *
 * A casement light's CLEARANCES follow the range when the profile holds them
 * (Integrate re-applies "Sectional Details" to the whole item). The two door
 * profiles are not known to hold them, so when they do not, every sash is
 * left exactly as it is and `sashClearancesLeft` says so rather than the
 * switch guessing at a number.
 *
 * Grids are NOT re-centred here: the board's `commit` already passes every
 * tree through `recentreGridsAfterResize`, which is the one place that knows
 * a muntin a surveyor moved must stay put. A caller outside the board does
 * the same if it wants it.
 *
 * @returns {{tree: Object, changed: string[], missing: string[], sashClearancesLeft: boolean}}
 */
export function setOpeningDirection(tree, direction, profileValues) {
  if (!OPENING_DIRECTIONS.includes(direction)) {
    return { tree, changed: [], missing: [], sashClearancesLeft: false }
  }
  const { values: d, missing, hasSashClearances } = directionDefaults(profileValues)
  if (missing.length > 0) {
    return { tree, changed: [], missing, sashClearancesLeft: false }
  }

  const rail = {
    bottomHeight: d.leafBottomRail ?? DIRECTION_BOTTOM_RAIL[direction].bottomHeight,
    bottomHeightExternal: d.leafBottomRailExternal ??
      DIRECTION_BOTTOM_RAIL[direction].bottomHeightExternal,
    btmRailShapeId: d.leafBottomRailShape ??
      DIRECTION_BOTTOM_RAIL[direction].btmRailShapeId,
  }
  const changed = []

  const convert = (node, inPair = false) => {
    const pt = node.part_type
    let values = node.values

    if (pt === 'assemblyFramePart') {
      // the SIZE is the surveyor's and is never touched — only the bottom
      // section and the cill stop, which is what the range writes
      values = { ...values, bottomHeight: d.frameBottom, cillStopSize: d.cillStop }
      changed.push(node.key)
    } else if (pt === 'cillPart') {
      values = { ...values, height: d.cillHeight }
      changed.push(node.key)
    } else if (pt === FRENCH_DOOR_PART) {
      values = {
        ...values,
        casementTypeId: direction,
        mechanicalClearanceTop:    d.pairClearTop,
        mechanicalClearanceBottom: d.pairClearBottom,
        mechanicalClearanceLeft:   d.pairClearLeft,
        mechanicalClearanceRight:  d.pairClearRight,
      }
      changed.push(node.key)
    } else if (pt === STABLE_DOOR_PART) {
      // the container's clearances are 4 / 4 / 4 / 3 BOTH WAYS: the 13 mm the
      // lower cill gives go to the bottom HALF, which is why a stable door
      // opening out is 1061 / 1055 and not 1048 / 1055
      values = { ...values, casementTypeId: direction }
      changed.push(node.key)
    } else if (DOOR_LEAF_TYPES.includes(pt)) {
      const half = stableHalfOf(node)
      values = { ...values, casementTypeId: direction }
      if (half === null) {
        // a single leaf or a front-door leaf: its own clearances. A FRENCH
        // leaf's clearances live on the PAIR, and doorLeafSize reads them
        // there, so a leaf inside a pair keeps whatever it has.
        if (!inPair) {
          values = {
            ...values,
            mechanicalClearanceTop:    d.leafClearTop,
            mechanicalClearanceBottom: d.leafClearBottom,
            mechanicalClearanceLeft:   d.leafClearLeft,
            mechanicalClearanceRight:  d.leafClearRight,
          }
        }
        values = { ...values, ...railValues(node.values, rail) }
      } else if (half === STABLE_HALVES.BOTTOM) {
        // only the bottom half meets the cill
        values = { ...values, ...railValues(node.values, rail) }
      }
      changed.push(node.key)
    } else if (pt === 'casementSashPart' && hasSashClearances) {
      // its DIRECTION and its rails are its own — only the clearances follow
      values = {
        ...values,
        mechanicalClearanceTop:    d.sashClearTop,
        mechanicalClearanceBottom: d.sashClearBottom,
        mechanicalClearanceLeft:   d.sashClearLeft,
        mechanicalClearanceRight:  d.sashClearRight,
      }
      changed.push(node.key)
    }

    const children = (node.children ?? []).map(
      child => convert(child, pt === FRENCH_DOOR_PART))
    return { ...node, values, children }
  }

  return { tree: convert(tree), changed, missing: [], sashClearancesLeft: !hasSashClearances }
}
