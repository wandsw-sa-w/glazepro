/**
 * doorOpenings.js — building a French door on the drawing board (Step AZ).
 *
 * A French door has the same SHAPE as a French casement — one opening holding
 * a pair with a left and a right leaf and no mullion — so the board's labels,
 * its drawing and its master-leaf choice are shared code
 * (PAIR_PART_TYPES in casementGeometry.js). What differs is the sections, the
 * clearances, the meeting-stile OVERLAP and the fact that a door's timber is
 * priced as stock sections rather than as volume.
 *
 * Nathan (13 Oct 2026): doors are sold in UTILE and ACCOYA only — never
 * softwood.
 */

import { makeKey } from './gridActions.js'
import { firstOf } from './casementOpenings.js'

/** The materials a door may be made of. Integrate's material 44 is utile. */
export const DOOR_MATERIALS = ['utile', 'accoya']
export const DEFAULT_DOOR_MATERIAL = 'utile'

/** Which leaf carries the lock. Integrate's default is the RIGHT one. */
export const DOOR_MASTER_LEAVES = ['right', 'left']
export const DEFAULT_DOOR_MASTER_LEAF = 'right'

/**
 * The profile values a French door needs, on the open_out_doors profile.
 *
 * Integrate's import already holds every one of these. The leaf BOTTOM RAIL
 * is the exception: 163 internal / 170 external come from the TEMPLATE, not
 * the profile (docs/integrate-L31115-french-doors.txt), so they are supplied
 * by the caller and default to Integrate's own template values.
 */
const DOOR_CANDIDATES = {
  frameJambLeft:  ['assemblyFramePart.leftWidth'],
  frameJambRight: ['assemblyFramePart.rightWidth', 'assemblyFramePart.leftWidth'],
  frameHead:      ['assemblyFramePart.topHeight'],
  frameBottom:    ['assemblyFramePart.bottomHeight'],
  frameDepth:     ['assemblyFramePart.frameDepth'],
  headStop:       ['assemblyFramePart.frameHeadStopSize'],
  stileStop:      ['assemblyFramePart.frameStileStopSize'],
  cillStop:       ['assemblyFramePart.cillStopSize'],
  cillHeight:     ['cillPart.height'],
  cillDepth:      ['cillPart.depth'],

  doorThickness:  ['frenchDoorPart.thickness'],
  doorMidRail:    ['frenchDoorPart.midRail'],
  doorGap:        ['frenchDoorPart.gapBetweenMeetingStiles'],
  doorOverlap:    ['frenchDoorPart.meetingStileOverlap'],
  clearTop:       ['frenchDoorPart.mechanicalClearanceTop'],
  clearBottom:    ['frenchDoorPart.mechanicalClearanceBottom'],
  clearLeft:      ['frenchDoorPart.mechanicalClearanceLeft'],
  clearRight:     ['frenchDoorPart.mechanicalClearanceRight'],

  leafHead:       ['leftFrenchDoorLeafPart.topHeight', 'rightFrenchDoorLeafPart.topHeight'],
  leafStileLeft:  ['leftFrenchDoorLeafPart.leftWidth', 'rightFrenchDoorLeafPart.leftWidth'],
  leafStileRight: ['leftFrenchDoorLeafPart.rightWidth', 'rightFrenchDoorLeafPart.rightWidth'],

  glassRebate:    ['glassPart.defaultDoubleGlazingRebateWidthForSash'],
  glassTolerance: ['glassPart.defaultDoubleGlazingTolerance'],

  transomThickness: ['transomPart.thicknessInFrame', 'mullionPart.thicknessInFrameSolid'],
  fanlightHead:   ['casementSashPart.topHeight'],
  fanlightStile:  ['casementSashPart.leftWidth'],
  fanlightThickness: ['casementSashPart.thickness'],
}

/** Resolve the door values, naming every key the profile does not hold. */
export function doorProfileDefaults(profileValues) {
  const values = {}
  const keysUsed = {}
  const missing = []
  for (const [name, candidates] of Object.entries(DOOR_CANDIDATES)) {
    const { value, key } = firstOf(profileValues, candidates)
    values[name] = value
    if (key) keysUsed[name] = key
    if (value == null) missing.push(`${name} (tried ${candidates.join(', ')})`)
  }
  return { values, missing, keysUsed }
}

const DEFAULT_GLASS = {
  glazingId: 'double_glazing',
  isIndividualPanes: false,
  internalGlassPartNo: 'GL100010',
  externalGlassPartNo: 'GL100080',
}

/** Integrate's own template bottom rail for a French door leaf. */
export const DEFAULT_LEAF_BOTTOM_RAIL_MM = 163
export const DEFAULT_LEAF_BOTTOM_RAIL_EXTERNAL_MM = 170

/**
 * Build a French door pair: one opening, two leaves, no mullion.
 *
 * @returns {{node: Object|null, missing: string[]}}
 */
export function buildFrenchDoorPair(profileValues, {
  glass = null,
  defaults = null,
  masterLeaf = DEFAULT_DOOR_MASTER_LEAF,
  bottomHeight = DEFAULT_LEAF_BOTTOM_RAIL_MM,
  bottomHeightExternal = DEFAULT_LEAF_BOTTOM_RAIL_EXTERNAL_MM,
} = {}) {
  const resolved = defaults ?? doorProfileDefaults(profileValues)
  if (resolved.missing.length > 0) return { node: null, missing: resolved.missing }
  const d = resolved.values
  const key = makeKey('frenchdoor')

  const leaf = side => {
    const leafKey = `${key}_${side}`
    return {
      key: leafKey,
      part_type: side === 'left' ? 'leftFrenchDoorLeafPart' : 'rightFrenchDoorLeafPart',
      values: {
        operation: side === 'left' ? 'left_hand_hung' : 'right_hand_hung',
        casementTypeId: 'open_out',       // Integrate typeId 7
        thickness:  d.doorThickness,
        topHeight:  d.leafHead,
        leftWidth:  d.leafStileLeft,
        rightWidth: d.leafStileRight,
        bottomHeight,
        bottomHeightExternal,
        btmRailShapeId: 'stepped',
        isMasterLeaf: masterLeaf === side,
        toBeReplaced: true,
      },
      children: [{
        key: `${leafKey}_glass`,
        part_type: 'glassPart',
        values: {
          ...DEFAULT_GLASS,
          ...(glass ?? {}),
          glazingRebateWidth: d.glassRebate,
          glazingTolerance:   d.glassTolerance,
        },
        children: [],
      }],
    }
  }

  return {
    node: {
      key,
      part_type: 'frenchDoorPart',
      values: {
        casementTypeId: 'open_out',
        thickness: d.doorThickness,
        midRail:   d.doorMidRail,
        gapBetweenMeetingStiles: d.doorGap,
        // The OVERLAP is what makes a door's leaves wider than half the
        // opening — a French casement has a gap and no overlap.
        meetingStileOverlap: d.doorOverlap,
        mechanicalClearanceTop:    d.clearTop,
        mechanicalClearanceBottom: d.clearBottom,
        mechanicalClearanceLeft:   d.clearLeft,
        mechanicalClearanceRight:  d.clearRight,
        masterLeaf,
      },
      children: [leaf('left'), leaf('right')],
    },
    missing: [],
  }
}

/**
 * Build a whole French door drawing: the frame, the pair, the cill, and —
 * when `fanlight` is given — a transom with a top-hung fanlight over the
 * pair.
 *
 * `fanlightBottomRail` defaults to 62, which is NATHAN'S rule for a new
 * fanlight, not the profile's. Integrate's open_out_doors profile holds 58
 * and its own template drew 86; Nathan decided on 12 Oct that a new GlazePro
 * fanlight is 62 so that Integrate's own "reduce to 62mm" warning never
 * fires. It is applied HERE, at the point the fanlight is created, rather
 * than through applyFanlightBottomRails: that function moves a rail only
 * when it is still on one of the two casement-profile defaults, and a door
 * profile's 58 is neither of them.
 *
 * @returns {{tree: Object|null, missing: string[]}}
 */
export function buildFrenchDoorFrame(profileValues, {
  width = 1899,
  height = 2199,
  material = DEFAULT_DOOR_MATERIAL,
  product = null,
  quantity = 1,
  masterLeaf = DEFAULT_DOOR_MASTER_LEAF,
  fanlight = null,                 // { offset } or null
  fanlightBottomRail = 62,
  fanlightBottomRailExternal = 69,
} = {}) {
  const resolved = doorProfileDefaults(profileValues)
  if (resolved.missing.length > 0) return { tree: null, missing: resolved.missing }
  const d = resolved.values

  const pair = buildFrenchDoorPair(profileValues, { defaults: resolved, masterLeaf })
  if (!pair.node) return { tree: null, missing: pair.missing }

  const dividers = []
  const openings = []
  if (fanlight != null) {
    const transomKey = makeKey('trans')
    dividers.push({
      key: transomKey,
      part_type: 'transomPart',
      values: {
        offset: fanlight.offset,
        thicknessInFrame: d.transomThickness,
        transomStopSize: 18,
        startDivider: '0', endDivider: '0',
      },
      children: [],
    })
    const sashKey = makeKey('cas')
    openings.push({
      key: sashKey,
      part_type: 'casementSashPart',
      values: {
        operation: 'top_hung',
        casementTypeId: 'open_out',
        thickness: d.fanlightThickness,
        topHeight: d.fanlightHead,
        leftWidth: d.fanlightStile,
        rightWidth: d.fanlightStile,
        bottomHeight: fanlightBottomRail,
        bottomHeightExternal: fanlightBottomRailExternal,
        btmRailShapeId: 'stepped',
        mechanicalClearanceTop: 1,
        mechanicalClearanceLeft: 1,
        mechanicalClearanceRight: 1,
        mechanicalClearanceBottom: 2,
        toBeReplaced: true,
      },
      children: [{
        key: `${sashKey}_glass`,
        part_type: 'glassPart',
        values: {
          ...DEFAULT_GLASS,
          glazingRebateWidth: d.glassRebate,
          glazingTolerance:   d.glassTolerance,
        },
        children: [],
      }],
    })
  }
  openings.push(pair.node)

  const tree = {
    key: makeKey('item'),
    part_type: 'drawingItemPart',
    values: {
      typeOfWork: 'complete_new',
      // Doors are utile or Accoya only — never softwood.
      frameMaterialId: material,
      sashMaterialId:  material,
      cillMaterialId:  material,
      ...(product != null ? { product } : {}),
      quantity,
    },
    children: [
      {
        key: makeKey('paint'),
        part_type: 'paintAndIronmongeryPart',
        values: {
          internalFinish: 'clean_white',
          externalFinish: 'clean_white',
          cillFinish: 'clean_white',
          cutOutBrickReveal: false,
          ironmongeryFinish: 'PB',
          // Nathan sells French doors multipoint-locked, which is what makes
          // the allocator add the lock set on save.
          isDoorMpls: true,
        },
        children: [],
      },
      { key: makeKey('notes'), part_type: 'notesPart', values: {}, children: [] },
      { key: makeKey('price'), part_type: 'pricePart', values: {}, children: [] },
      {
        key: makeKey('frame'),
        part_type: 'assemblyFramePart',
        values: {
          width, height,
          leftWidth:  d.frameJambLeft,
          rightWidth: d.frameJambRight ?? d.frameJambLeft,
          topHeight:  d.frameHead,
          bottomHeight: d.frameBottom,
          frameDepth: d.frameDepth,
          jambType: 'solid_profiled',
          frameHeadStopSize:  d.headStop,
          frameStileStopSize: d.stileStop,
          cillStopSize:       d.cillStop,
          rakeFrame: false,
          archHead: false,
          toBeReplaced: true,
        },
        children: [
          ...dividers,
          ...openings,
          {
            key: makeKey('cill'),
            part_type: 'cillPart',
            values: { height: d.cillHeight, depth: d.cillDepth },
            children: [],
          },
        ],
      },
    ],
  }
  return { tree, missing: [] }
}

/** Is this drawing a French door? */
export function isFrenchDoorTree(tree) {
  function walk(node) {
    if (!node) return false
    if (node.part_type === 'frenchDoorPart') return true
    return (node.children ?? []).some(walk)
  }
  return walk(tree)
}
