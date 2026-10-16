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
import {
  DOOR_LEAF_TYPES, leafInterior, leafCells, doorPanelSize, doorLeaves,
  canHoldGrid, leafCellParts, leafMidRails,
} from '../pricing/doorGeometry.js'
import { itemFrames } from '../pricing/casementGeometry.js'
// Step BH: a PAIR OF FRONT DOORS is the open-in French pair with front-door
// leaves, so it is built by turning a pair round with Step BG's own switch
// rather than by a second description of what "open in" means.
import { setOpeningDirection, OPEN_IN } from './openingDirection.js'

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

/**
 * Is this drawing a DOOR at all — a French pair or a single leaf, in any of
 * its frames? (Step BC board: what the flag-frame buttons are offered on.)
 */
export function isDoorTree(tree) {
  const walk = node => DOOR_LEAF_TYPES.includes(node?.part_type) ||
    node?.part_type === 'frenchDoorPart' ||
    (node?.children ?? []).some(walk)
  return walk(tree)
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

// ── Step BA: panelled leaves, and the mid rail the board can move ────────────

/** Integrate's own mid rail on template 79, and the panel it leaves. */
export const DEFAULT_LEAF_MID_RAIL_MM = 170
export const DEFAULT_LEAF_PANEL_HEIGHT_MM = 425

/**
 * The panel options a new panelled leaf starts with.
 *
 * Step BF (Nathan, decision k): FLAT, as every Integrate door template is.
 * Its id 110 had been mapped to raised_and_fielded, so GlazePro’s templates
 * were built R&F and charged 120 a panel where Integrate charges 60.
 * sql/step-bf3 re-issues templates 29-32 with flat panels.
 */
export const DEFAULT_PANEL_VALUES = {
  internalPanelTypeId: 'flat',
  externalPanelTypeId: 'flat',
  internalPanelBeadId: 'ovolo',
  externalPanelBeadId: 'ovolo',
  insulationThickness: 15,
  createVisionPanel: true,
  panelThickness: 0,
  toBeReplaced: true,
}

/**
 * A leaf's mid rail node. A divider INSIDE the leaf, stored exactly as a
 * frame transom is: `offset` is the opening above it — the glass — and what
 * is left below it is the panel. `isMidrail` is Integrate's own flag and is
 * what tells a frame divider from a leaf one.
 */
function midRailNode(key, { offset, thickness = DEFAULT_LEAF_MID_RAIL_MM }) {
  return {
    key,
    part_type: 'transomPart',
    values: {
      isMidrail: true,
      offset,
      thicknessInFrame: thickness,
      midrailThickness: thickness,
      transomStopSize: 18,
      startDivider: '0', endDivider: '0',
    },
    children: [],
  }
}

/**
 * Where a leaf's mid rail goes so the PANEL is `panelHeight` deep.
 *
 * Integrate stores the glass height (offset 1241 on template 79) and lets
 * the panel absorb a resize. GlazePro chooses the position from the PANEL
 * instead — a panel is a made thing at a sensible size, and 425 is
 * Integrate's own — so a template built at any size starts with the same
 * panel. At template 79's size the two agree exactly: a 2109 leaf with a 110
 * head, a 170 rail and a 163 bottom rail leaves 1241 of glass above a 425
 * panel. A later RESIZE keeps the stored offset, as Integrate does, so the
 * glass takes the change and the panel stays as made.
 */
export function leafMidRailOffsetFor(leafHeight, {
  head, bottomRail, railThickness = DEFAULT_LEAF_MID_RAIL_MM,
  panelHeight = DEFAULT_LEAF_PANEL_HEIGHT_MM,
}) {
  const n = v => (isFinite(Number(v)) ? Number(v) : 0)
  return n(leafHeight) - n(head) - n(railThickness) - n(bottomRail) - n(panelHeight)
}

/** The mid rail inside a leaf, or null. */
export function leafMidRailOf(leafNode) {
  return (leafNode?.children ?? []).find(
    c => c.part_type === 'transomPart') ?? null
}

/**
 * Give a door leaf a mid rail and a panel below it, or move the rail it has.
 *
 * The leaf's GLASS stays where it is in the children list; the rail goes
 * first and the panel last, which is the order Integrate stores and the
 * order the elevation draws top to bottom.
 */
export function withLeafMidRail(leafNode, { offset, thickness = DEFAULT_LEAF_MID_RAIL_MM, panel = true } = {}) {
  if (!leafNode) return leafNode
  const existing = leafMidRailOf(leafNode)
  const others = (leafNode.children ?? []).filter(
    c => c.part_type !== 'transomPart' && c.part_type !== 'panelPart')
  const rail = midRailNode(existing?.key ?? `${leafNode.key}_midrail`, { offset, thickness })
  const keptPanel = (leafNode.children ?? []).find(c => c.part_type === 'panelPart')
  // Step BM, corrected 16 Oct: the added panel stays FLAT with an ovolo bead.
  //
  // The brief asked for raised and fielded, on the reading that Integrate's
  // panel type 110 means that. The reviewer's correction re-read Integrate's
  // own options — 110 Flat, 112 Raised & fielded — so 110 is FLAT, which is
  // what difference 19 and Nathan's decision k already said. What drawing 103
  // was really missing is the mid rail's "Door Muntin" 60, not a dearer
  // panel: see sash_muntin_to_be_replaced_qty in computeVariables.js.
  const panelNode = panel
    ? (keptPanel ?? {
      key: `${leafNode.key}_panel`,
      part_type: 'panelPart',
      values: { ...DEFAULT_PANEL_VALUES },
      children: [],
    })
    : null
  return {
    ...leafNode,
    children: [rail, ...others, ...(panelNode ? [panelNode] : [])],
  }
}

/** Take a leaf's mid rail and its panel away: the glass runs the whole leaf. */
export function withoutLeafMidRail(leafNode) {
  if (!leafNode) return leafNode
  return {
    ...leafNode,
    children: (leafNode.children ?? []).filter(
      c => c.part_type !== 'transomPart' && c.part_type !== 'panelPart'),
  }
}

/**
 * Add, move or remove a leaf's mid rail anywhere in a tree, by the leaf's key.
 *
 * `offset` null removes the rail and its panel. This is the board's action:
 * one function for the three things a surveyor does to a panelled leaf.
 */
export function setLeafMidRail(tree, leafKey, { offset = null, thickness = DEFAULT_LEAF_MID_RAIL_MM } = {}) {
  function walk(node) {
    if (!node) return node
    // Step BP item 1: a CASEMENT SASH takes a mid rail and a panel the same
    // way a leaf does — G1's side casements, G4's with a 200 rail.
    if (node.key === leafKey && canHoldGrid(node)) {
      return offset == null
        ? withoutLeafMidRail(node)
        : withLeafMidRail(node, { offset, thickness })
    }
    const children = (node.children ?? []).map(walk)
    return children.length ? { ...node, children } : node
  }
  return walk(tree)
}

// ── Step BA: the doorsets (Integrate templates 29 and 46) ────────────────────

/** The top row of a doorset: three direct glazed units, or three fanlights. */
export const DOORSET_TOP_ROWS = ['direct_glazed', 'casement']
export const DEFAULT_DOORSET_TOP_ROW = 'direct_glazed'

/** Integrate's own template sizes for the two doorsets. */
export const DOORSET_DEFAULTS = {
  width: 2814,
  height: 2710,
  transomOffset: 448,
  middleColumn: 1339,
  sideLightBottomRail: 86,
  sideLightBottomRailExternal: 93,
  directGlazedClearance: 15,
  directGlazedHidden: 12,
}

/**
 * A doorset DIRECT GLAZED UNIT — Integrate’s own: 15 mm of mechanical
 * clearance each side, 12 hidden in the rebate, and the rebate and
 * tolerance from the drawing’s profile.
 *
 * Step BH pulled this out of the two doorset builders that had it inline,
 * so the light the BOARD adds beside a door is the same light a template
 * carries. `glass` carries another unit’s glass CODES over.
 */
export function doorsetDirectGlazedUnit(profileValues, { glass = null, defaults = null } = {}) {
  const d = (defaults ?? doorProfileDefaults(profileValues)).values
  return {
    key: makeKey('dgu'),
    part_type: 'glassPart',
    values: {
      ...DEFAULT_GLASS,
      ...(glass ?? {}),
      glazingRebateWidth: d.glassRebate,
      glazingTolerance:   d.glassTolerance,
      mechanicalClearanceTop: DOORSET_DEFAULTS.directGlazedClearance,
      mechanicalClearanceBottom: DOORSET_DEFAULTS.directGlazedClearance,
      mechanicalClearanceLeft: DOORSET_DEFAULTS.directGlazedClearance,
      mechanicalClearanceRight: DOORSET_DEFAULTS.directGlazedClearance,
      hiddenInRebateTop: DOORSET_DEFAULTS.directGlazedHidden,
      hiddenInRebateBottom: DOORSET_DEFAULTS.directGlazedHidden,
      hiddenInRebateLeft: DOORSET_DEFAULTS.directGlazedHidden,
      hiddenInRebateRight: DOORSET_DEFAULTS.directGlazedHidden,
      toBeReplaced: true,
    },
    children: [],
  }
}

/** A door part: the thing a new cell must NOT be a copy of. */
export const DOOR_OPENING_TYPES = [...DOOR_LEAF_TYPES, 'frenchDoorPart', 'stableDoorPart']

export function isDoorOpening(node) {
  return DOOR_OPENING_TYPES.includes(node?.part_type)
}

/**
 * What a new cell gets when a DOOR opening is divided (Step BH).
 *
 * Nathan: every doorset can have side lights, top lights and flag windows.
 * So dividing a door frame has to give the new cell a LIGHT — a direct
 * glazed unit, which the surveyor then changes to a fixed or an opening
 * casement if that is what it is. Copying the door (which is what the
 * divider actions do for every other opening, on purpose, so a surveyor’s
 * own sections survive) would give a drawing two doors.
 *
 * The door’s own GLASS CODES carry over, as they do on every other change
 * of opening: the glazing a surveyor has chosen is a choice, not a default.
 *
 * Returns null for anything that is not a door, which the divider actions
 * read as "copy it as you always have".
 */
export function newDoorsetOpeningFor(profileValues) {
  const defaults = doorProfileDefaults(profileValues)
  return source => {
    if (!isDoorOpening(source)) return null
    return doorsetDirectGlazedUnit(profileValues, {
      glass: glassCodesOfDoor(source), defaults,
    })
  }
}

/** The glass CODES on a door, wherever it keeps its glass. */
function glassCodesOfDoor(node) {
  const findGlass = n => (n?.part_type === 'glassPart' ? n
    : (n?.children ?? []).map(findGlass).find(Boolean) ?? null)
  const g = findGlass(node)
  if (!g) return null
  const v = g.values ?? {}
  return {
    ...(v.glazingId != null ? { glazingId: v.glazingId } : {}),
    ...(v.isIndividualPanes != null ? { isIndividualPanes: v.isIndividualPanes } : {}),
    ...(v.internalGlassPartNo != null ? { internalGlassPartNo: v.internalGlassPartNo } : {}),
    ...(v.externalGlassPartNo != null ? { externalGlassPartNo: v.externalGlassPartNo } : {}),
  }
}

/**
 * Where the two full-height mullions go, so the side lights MATCH.
 *
 * Integrate's template 29 has 648 and 651 — a 3 mm difference nobody drew on
 * purpose. Nathan's drawings are symmetrical, so GlazePro splits what is left
 * after the middle column equally and puts any odd millimetre in the MIDDLE,
 * where it cannot be seen: 2720 internal with two 41 mullions leaves 2638 for
 * the lights, so each side light is 650 and the pair's opening 1338 (one
 * millimetre narrower than Integrate's 1339). Said out loud in
 * docs/reports/step-ba.md, because it is a deliberate departure from the
 * template that was read.
 */
export function doorsetColumns(interiorWidth, { mullionThickness, middleColumn }) {
  const n = v => (isFinite(Number(v)) ? Number(v) : 0)
  const spare = n(interiorWidth) - 2 * n(mullionThickness)
  const side = Math.floor((spare - n(middleColumn)) / 2)
  const middle = spare - 2 * side
  return { side, middle }
}

/**
 * Build a whole French DOORSET: a frame with two full-height mullions and a
 * full-width transom, the pair in the middle bottom opening, a fixed casement
 * side light each side of it, and a top row of either three direct glazed
 * units (Integrate template 29) or three fixed casement fanlights (46).
 *
 * The top row's fanlights take Nathan's 62 bottom rail, as every new GlazePro
 * fanlight does (difference 5); the SIDE lights keep Integrate's 86, which is
 * what its own templates draw and what the facts price.
 *
 * @returns {{tree: Object|null, missing: string[]}}
 */
export function buildFrenchDoorSetFrame(profileValues, {
  width = DOORSET_DEFAULTS.width,
  height = DOORSET_DEFAULTS.height,
  material = DEFAULT_DOOR_MATERIAL,
  product = null,
  quantity = 1,
  masterLeaf = DEFAULT_DOOR_MASTER_LEAF,
  topRow = DEFAULT_DOORSET_TOP_ROW,
  transomOffset = DOORSET_DEFAULTS.transomOffset,
  middleColumn = DOORSET_DEFAULTS.middleColumn,
  fanlightBottomRail = 62,
  fanlightBottomRailExternal = 69,
} = {}) {
  const resolved = doorProfileDefaults(profileValues)
  if (resolved.missing.length > 0) return { tree: null, missing: resolved.missing }
  const d = resolved.values

  const base = buildFrenchDoorFrame(profileValues, {
    width, height, material, product, quantity, masterLeaf,
  })
  if (!base.tree) return base

  const frame = base.tree.children.find(c => c.part_type === 'assemblyFramePart')
  const interiorWidth = width - d.frameJambLeft - (d.frameJambRight ?? d.frameJambLeft)
  const interiorHeight = height - d.frameHead - d.frameBottom
  const { side, middle } = doorsetColumns(interiorWidth, {
    mullionThickness: d.transomThickness, middleColumn,
  })

  const glass = extra => ({
    key: makeKey('glass'),
    part_type: 'glassPart',
    values: {
      ...DEFAULT_GLASS,
      glazingRebateWidth: d.glassRebate,
      glazingTolerance:   d.glassTolerance,
      ...extra,
    },
    children: [],
  })

  const sash = ({ bottomHeight, bottomHeightExternal }) => {
    const key = makeKey('cas')
    return {
      key,
      part_type: 'casementSashPart',
      values: {
        operation: 'fix',                 // a side light and a top light are FIXED
        casementTypeId: 'open_out',
        thickness: d.fanlightThickness,
        topHeight: d.fanlightHead,
        leftWidth: d.fanlightStile,
        rightWidth: d.fanlightStile,
        bottomHeight, bottomHeightExternal,
        btmRailShapeId: 'stepped',
        mechanicalClearanceTop: 1,
        mechanicalClearanceLeft: 1,
        mechanicalClearanceRight: 1,
        mechanicalClearanceBottom: 2,
        toBeReplaced: true,
      },
      children: [{ ...glass({}), key: `${key}_glass` }],
    }
  }

  // Step BH: one definition, shared with the light the board adds
  const directGlazed = () => doorsetDirectGlazedUnit(profileValues, { defaults: resolved })

  const topLight = () => topRow === 'casement'
    ? sash({ bottomHeight: fanlightBottomRail, bottomHeightExternal: fanlightBottomRailExternal })
    : directGlazed()

  const sideLight = () => sash({
    bottomHeight: DOORSET_DEFAULTS.sideLightBottomRail,
    bottomHeightExternal: DOORSET_DEFAULTS.sideLightBottomRailExternal,
  })

  const pair = buildFrenchDoorPair(profileValues, { defaults: resolved, masterLeaf })
  if (!pair.node) return { tree: null, missing: pair.missing }

  const divider = (key, offset) => ({
    key,
    part_type: 'mullionPart',
    values: { offset, thicknessInFrame: d.transomThickness, mullionStopSize: d.stileStop },
    children: [],
  })

  const dividers = [
    divider(makeKey('mull'), side),
    divider(makeKey('mull'), side + d.transomThickness + middle),
    {
      key: makeKey('trans'),
      part_type: 'transomPart',
      values: {
        offset: transomOffset,
        thicknessInFrame: d.transomThickness,
        transomStopSize: 18,
        startDivider: '0', endDivider: '0',
      },
      children: [],
    },
  ]

  // Openings in reading order: the top row left to right, then the bottom.
  const openings = [
    topLight(), topLight(), topLight(),
    sideLight(), pair.node, sideLight(),
  ]

  const cill = (frame.children ?? []).filter(c => c.part_type === 'cillPart')
  return {
    tree: {
      ...base.tree,
      children: base.tree.children.map(c => c.part_type !== 'assemblyFramePart' ? c : {
        ...c,
        children: [...dividers, ...openings, ...cill],
      }),
    },
    missing: [],
    layout: { side, middle, interiorWidth, interiorHeight },
  }
}

/**
 * Build the panelled French door drawing (Integrate template 79): FD1's
 * drawing with a mid rail and a raised-and-fielded panel in each leaf.
 */
export function buildPanelledFrenchDoorFrame(profileValues, {
  width = 1399,
  height = 2199,
  panelHeight = DEFAULT_LEAF_PANEL_HEIGHT_MM,
  midRailThickness = DEFAULT_LEAF_MID_RAIL_MM,
  ...rest
} = {}) {
  const built = buildFrenchDoorFrame(profileValues, { width, height, ...rest })
  if (!built.tree) return built
  const resolved = doorProfileDefaults(profileValues)
  const d = resolved.values

  // The leaf height is the opening less the pair's top and bottom clearances,
  // and the opening is the frame interior when there is no transom.
  const interiorHeight = height - d.frameHead - d.frameBottom
  const leafHeight = interiorHeight - d.clearTop - d.clearBottom
  const bottomRail = rest.bottomHeight ?? DEFAULT_LEAF_BOTTOM_RAIL_MM
  const offset = leafMidRailOffsetFor(leafHeight, {
    head: d.leafHead, bottomRail, railThickness: midRailThickness, panelHeight,
  })

  function walk(node) {
    if (DOOR_LEAF_TYPES.includes(node.part_type)) {
      return withLeafMidRail(node, { offset, thickness: midRailThickness })
    }
    const children = (node.children ?? []).map(walk)
    return children.length ? { ...node, children } : node
  }
  return { tree: walk(built.tree), missing: [], midRailOffset: offset }
}

// ── Step BB: a SINGLE door in an opening ─────────────────────────────────────

/** The operations Integrate offers on a single door leaf: LH / RH / Fix. */
export const SINGLE_DOOR_OPERATIONS = ['left_hand_hung', 'right_hand_hung', 'fix']
export const DEFAULT_SINGLE_DOOR_OPERATION = 'left_hand_hung'

/** A single door leaf's own clearances — NOT a French pair's 3 / 1 / 1 / 3. */
export const SINGLE_DOOR_CLEARANCES = { top: 2, left: 3, right: 3, bottom: 3 }

/**
 * Build a single door leaf for a frame opening: a plain `doorLeafPart`, as
 * Integrate stores it, with no pair part around it.
 *
 * Its sections are a French leaf's (110 head and stiles, 163 bottom rail,
 * 170 external) because that is what Integrate's own single door carries;
 * its CLEARANCES are its own.
 *
 * It is NEVER arched. Integrate's board hands a dropped-in door leaf Arch
 * Head and Half Circle switched on (archHeight 389.5), which priced SD2 as
 * 1.14 m2 of shaped glass and 240 minutes of swept-head work until the
 * reviewer unticked it (docs/integrate-L31115-single-doors.txt, the SD2
 * quirk). GlazePro does not copy that.
 *
 * @returns {{node: Object|null, missing: string[]}}
 */
export function buildSingleDoorLeaf(profileValues, {
  glass = null,
  defaults = null,
  operation = DEFAULT_SINGLE_DOOR_OPERATION,
  bottomHeight = DEFAULT_LEAF_BOTTOM_RAIL_MM,
  bottomHeightExternal = DEFAULT_LEAF_BOTTOM_RAIL_EXTERNAL_MM,
} = {}) {
  const resolved = defaults ?? doorProfileDefaults(profileValues)
  if (resolved.missing.length > 0) return { node: null, missing: resolved.missing }
  const d = resolved.values
  const key = makeKey('doorleaf')
  return {
    node: {
      key,
      part_type: 'doorLeafPart',
      values: {
        operation,
        casementTypeId: 'open_out',          // Integrate typeId 7
        thickness:  d.doorThickness,
        topHeight:  d.leafHead,
        leftWidth:  d.leafStileLeft,
        rightWidth: d.leafStileRight,
        bottomHeight,
        bottomHeightExternal,
        btmRailShapeId: 'stepped',
        mechanicalClearanceTop:    SINGLE_DOOR_CLEARANCES.top,
        mechanicalClearanceLeft:   SINGLE_DOOR_CLEARANCES.left,
        mechanicalClearanceRight:  SINGLE_DOOR_CLEARANCES.right,
        mechanicalClearanceBottom: SINGLE_DOOR_CLEARANCES.bottom,
        archHead: false,
        toBeReplaced: true,
      },
      children: [{
        key: `${key}_glass`,
        part_type: 'glassPart',
        values: {
          ...DEFAULT_GLASS,
          ...(glass ?? {}),
          glazingRebateWidth: d.glassRebate,
          glazingTolerance:   d.glassTolerance,
        },
        children: [],
      }],
    },
    missing: [],
  }
}

/**
 * Turn an opening of a DOOR frame into a single door.
 *
 * This lives here rather than in `changeOpening` to keep the module
 * direction one-way: casementOpenings.js knows nothing about doors, and the
 * board dispatches on the kind.
 *
 * @returns {{tree: Object, changed: boolean, missing?: string[]}}
 */
export function changeOpeningToSingleDoor(tree, openingKey, profileValues) {
  const frame = (tree?.children ?? []).find(c => c.part_type === 'assemblyFramePart')
  if (!frame) return { tree, changed: false }
  const idx = (frame.children ?? []).findIndex(c => c.key === openingKey)
  if (idx < 0) return { tree, changed: false }
  const current = frame.children[idx]
  if (current.part_type === 'doorLeafPart') return { tree, changed: false }

  // Carry the glass CODES over, as every other opening change does: on a
  // casement sash they live on its glass child, on a direct glazed unit on
  // the unit itself, and on a pair on its left leaf's glass.
  const glassSource = current.part_type === 'glassPart'
    ? current
    : (current.children ?? []).find(c => c.part_type === 'glassPart')
      ?? (current.children?.[0]?.children ?? []).find(c => c.part_type === 'glassPart')
  const codes = {}
  for (const k of ['glazingId', 'isIndividualPanes', 'internalGlassPartNo',
    'externalGlassPartNo']) {
    if (glassSource?.values?.[k] !== undefined) codes[k] = glassSource.values[k]
  }

  const { node, missing } = buildSingleDoorLeaf(profileValues, { glass: codes })
  if (!node) return { tree, changed: false, missing }

  const children = [...frame.children]
  children[idx] = node
  return {
    tree: {
      ...tree,
      children: tree.children.map(c => c.key === frame.key ? { ...frame, children } : c),
    },
    changed: true,
  }
}

// ── Step BB: the single-door frames, and FD7's side panels ───────────────────

/** Integrate's own template sizes for the single garden doors. */
export const SINGLE_DOOR_DEFAULTS = {
  width: 1099,
  height: 2199,
  doorColumn: 1005,            // the door's own opening, template 15's internal width
  sideLight: 534,              // SD4's side columns, which are already symmetrical
  transomOffset: 399,
  sideLightBottomRail: 86,     // Integrate's own; a FANLIGHT takes Nathan's 62
  sideLightBottomRailExternal: 93,
}

/**
 * Build a single garden door drawing: the frame, one `doorLeafPart` in its
 * opening, and — as asked for — a transom with a fixed fanlight over the
 * whole frame and a fixed side light on either side of the door.
 *
 * The door's own column is `doorColumn` wide; the side lights share what is
 * left, equally. A fanlight spans the whole frame (one transom, full
 * length), so a drawing with both reads as a 3 x 2 grid, which is SD4.
 *
 * @returns {{tree: Object|null, missing: string[]}}
 */
export function buildSingleDoorFrame(profileValues, {
  width = SINGLE_DOOR_DEFAULTS.width,
  height = SINGLE_DOOR_DEFAULTS.height,
  material = DEFAULT_DOOR_MATERIAL,
  product = null,
  quantity = 1,
  operation = DEFAULT_SINGLE_DOOR_OPERATION,
  fanlight = null,                   // { offset } or null
  sideLights = 0,                    // 0, 1 (right) or 2
  doorColumn = SINGLE_DOOR_DEFAULTS.doorColumn,
  fanlightBottomRail = 62,
  fanlightBottomRailExternal = 69,
} = {}) {
  const resolved = doorProfileDefaults(profileValues)
  if (resolved.missing.length > 0) return { tree: null, missing: resolved.missing }
  const d = resolved.values

  const base = buildFrenchDoorFrame(profileValues, {
    width, height, material, product, quantity,
  })
  if (!base.tree) return base
  const frame = base.tree.children.find(c => c.part_type === 'assemblyFramePart')

  const leaf = buildSingleDoorLeaf(profileValues, { defaults: resolved, operation })
  if (!leaf.node) return { tree: null, missing: leaf.missing }

  const interiorWidth = width - d.frameJambLeft - (d.frameJambRight ?? d.frameJambLeft)
  const mullionT = d.transomThickness

  // The door column, and the side lights' share of what is left.
  const spare = interiorWidth - doorColumn - sideLights * mullionT
  const sideWidth = sideLights > 0 ? Math.floor(spare / sideLights) : 0

  const dividers = []
  if (sideLights === 1) {
    // The door on the LEFT, one side light on the right (Integrate's SD3).
    dividers.push(mullionNode(makeKey('mull'), doorColumn, d))
  } else if (sideLights === 2) {
    dividers.push(mullionNode(makeKey('mull'), sideWidth, d))
    dividers.push(mullionNode(makeKey('mull'), sideWidth + mullionT + doorColumn, d))
  }
  if (fanlight != null) {
    dividers.push({
      key: makeKey('trans'),
      part_type: 'transomPart',
      values: {
        offset: fanlight.offset ?? SINGLE_DOOR_DEFAULTS.transomOffset,
        thicknessInFrame: mullionT,
        transomStopSize: 18,
        startDivider: '0', endDivider: '0',
      },
      children: [],
    })
  }

  const fixedSash = ({ bottomHeight, bottomHeightExternal }) => {
    const key = makeKey('cas')
    return {
      key,
      part_type: 'casementSashPart',
      values: {
        operation: 'fix',
        casementTypeId: 'open_out',
        thickness: d.fanlightThickness,
        topHeight: d.fanlightHead,
        leftWidth: d.fanlightStile,
        rightWidth: d.fanlightStile,
        bottomHeight, bottomHeightExternal,
        btmRailShapeId: 'stepped',
        mechanicalClearanceTop: 1,
        mechanicalClearanceLeft: 1,
        mechanicalClearanceRight: 1,
        mechanicalClearanceBottom: 2,
        toBeReplaced: true,
      },
      children: [{
        key: `${key}_glass`,
        part_type: 'glassPart',
        values: {
          ...DEFAULT_GLASS,
          glazingRebateWidth: d.glassRebate,
          glazingTolerance:   d.glassTolerance,
        },
        children: [],
      }],
    }
  }
  const topLight  = () => fixedSash({
    bottomHeight: fanlightBottomRail, bottomHeightExternal: fanlightBottomRailExternal,
  })
  const sideLight = () => fixedSash({
    bottomHeight: SINGLE_DOOR_DEFAULTS.sideLightBottomRail,
    bottomHeightExternal: SINGLE_DOOR_DEFAULTS.sideLightBottomRailExternal,
  })

  // Reading order: the whole top row first, then the bottom row left to right.
  const columns = 1 + (sideLights === 2 ? 2 : sideLights)
  const openings = []
  if (fanlight != null) for (let i = 0; i < columns; i++) openings.push(topLight())
  if (sideLights === 2) openings.push(sideLight())
  openings.push(leaf.node)
  if (sideLights >= 1) openings.push(sideLight())

  const cill = (frame.children ?? []).filter(c => c.part_type === 'cillPart')
  return {
    tree: {
      ...base.tree,
      children: base.tree.children.map(c => c.part_type !== 'assemblyFramePart' ? c : {
        ...c,
        children: [...dividers, ...openings, ...cill],
      }),
    },
    missing: [],
  }
}

function mullionNode(key, offset, d) {
  return {
    key,
    part_type: 'mullionPart',
    values: { offset, thicknessInFrame: d.transomThickness, mullionStopSize: d.stileStop },
    children: [],
  }
}

/**
 * Build Integrate's template 28 (FD7): a French pair between two DIRECT
 * GLAZED side panels, one row, two full-height mullions.
 *
 * The side columns are EQUAL, as every GlazePro doorset is — Integrate's own
 * template has 618 and 621 — and the panels take 12 mm hidden in the rebate
 * on both sides, not the hidden-0 quirk its A1 carries.
 *
 * @returns {{tree: Object|null, missing: string[]}}
 */
export function buildFrenchDoorSidePanelFrame(profileValues, {
  width = 2820,
  height = 2199,
  material = DEFAULT_DOOR_MATERIAL,
  product = null,
  quantity = 1,
  masterLeaf = DEFAULT_DOOR_MASTER_LEAF,
  middleColumn = 1405,
} = {}) {
  const resolved = doorProfileDefaults(profileValues)
  if (resolved.missing.length > 0) return { tree: null, missing: resolved.missing }
  const d = resolved.values

  const base = buildFrenchDoorFrame(profileValues, {
    width, height, material, product, quantity, masterLeaf,
  })
  if (!base.tree) return base
  const frame = base.tree.children.find(c => c.part_type === 'assemblyFramePart')
  const pair = (frame.children ?? []).find(c => c.part_type === 'frenchDoorPart')

  const interiorWidth = width - d.frameJambLeft - (d.frameJambRight ?? d.frameJambLeft)
  const { side, middle } = doorsetColumns(interiorWidth, {
    mullionThickness: d.transomThickness, middleColumn,
  })

  // Step BH: one definition (it is a direct glazed PANEL beside the pair)
  const panel = () => doorsetDirectGlazedUnit(profileValues, { defaults: resolved })

  const dividers = [
    mullionNode(makeKey('mull'), side, d),
    mullionNode(makeKey('mull'), side + d.transomThickness + middle, d),
  ]
  const cill = (frame.children ?? []).filter(c => c.part_type === 'cillPart')
  return {
    tree: {
      ...base.tree,
      children: base.tree.children.map(c => c.part_type !== 'assemblyFramePart' ? c : {
        ...c,
        children: [...dividers, panel(), pair, panel(), ...cill],
      }),
    },
    missing: [],
    layout: { side, middle },
  }
}

// ── Step BC: flag frames — more than one frame in a drawing ──────────────────

/** Integrate's own flag frame on templates 70-72, and its light. */
export const FLAG_FRAME_DEFAULTS = {
  width: 693,
  height: 1136,
  bottomRail: 86,
  bottomRailExternal: 93,
}

/**
 * The container that holds a drawing's frames, as Integrate stores it:
 * `partSpacing -47` is the coupling — each frame starts one jamb before the
 * previous one ends, so a 693 | 995 | 693 set is 2287 wide and not 2381.
 */
export const CONTAINER_FRAME_SPACING_MM = -47

function containerNode(key, frames) {
  return {
    key,
    part_type: 'containerPart',
    values: {
      bayTypeId: 176,
      partSpacing: CONTAINER_FRAME_SPACING_MM,
      isCoupledInTheFactory: false,
      isBayPoleRequired: false,
      hasContinousSubCill: false,
      isCornerpostRequired: false,
    },
    children: frames,
  }
}

/** A flag frame: its own jambs, head and cill, and one FIXED light. */
export function buildFlagFrame(profileValues, {
  width = FLAG_FRAME_DEFAULTS.width,
  height = FLAG_FRAME_DEFAULTS.height,
  defaults = null,
} = {}) {
  const resolved = defaults ?? doorProfileDefaults(profileValues)
  if (resolved.missing.length > 0) return { node: null, missing: resolved.missing }
  const d = resolved.values
  const key = makeKey('flagframe')
  const sashKey = `${key}_light`
  return {
    node: {
      key,
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
        {
          key: sashKey,
          part_type: 'casementSashPart',
          values: {
            operation: 'fix',
            casementTypeId: 'open_out',
            thickness: d.fanlightThickness,
            topHeight: d.fanlightHead,
            leftWidth: d.fanlightStile,
            rightWidth: d.fanlightStile,
            bottomHeight: FLAG_FRAME_DEFAULTS.bottomRail,
            bottomHeightExternal: FLAG_FRAME_DEFAULTS.bottomRailExternal,
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
        },
        // Every frame is a WHOLE frame and carries its own cill — which is
        // what Nathan charges for (decision a) and Integrate does not.
        {
          key: `${key}_cill`,
          part_type: 'cillPart',
          values: { height: d.cillHeight, depth: d.cillDepth },
          children: [],
        },
      ],
    },
    missing: [],
  }
}

/**
 * Add a flag frame to the left or right of a frame (Integrate's "Copy
 * selected frame to left / right", but a flag rather than a copy — a flag
 * light is what Nathan sells beside a door).
 *
 * A ONE-frame drawing becomes a container drawing: the frame moves into a new
 * containerPart beside the flag. An existing container gains one frame. No
 * existing drawing or template is migrated — this happens only when somebody
 * adds a flag.
 *
 * @returns {{tree: Object, changed: boolean, missing?: string[]}}
 */
export function addFlagFrame(tree, frameKey, side, profileValues, opts = {}) {
  if (side !== 'left' && side !== 'right') return { tree, changed: false }
  const frames = itemFrames(tree)
  const target = frames.find(f => f.key === frameKey) ?? frames[0]
  if (!target) return { tree, changed: false }

  const { node, missing } = buildFlagFrame(profileValues, opts)
  if (!node) return { tree, changed: false, missing }

  const at = frames.indexOf(target) + (side === 'right' ? 1 : 0)
  const next = [...frames]
  next.splice(at, 0, node)

  const container = (tree.children ?? []).find(c => c.part_type === 'containerPart')
  if (container) {
    return {
      tree: {
        ...tree,
        children: tree.children.map(
          c => c.key === container.key ? { ...container, children: next } : c),
      },
      changed: true,
    }
  }
  // One frame until now: wrap both in a container, in place of the frame.
  return {
    tree: {
      ...tree,
      children: (tree.children ?? []).flatMap(
        c => c.part_type === 'assemblyFramePart'
          ? [containerNode(makeKey('frames'), next)]
          : [c]),
    },
    changed: true,
  }
}

/**
 * Remove a frame from a coupled set.
 *
 * Taking a set back down to ONE frame unwraps the container, so the drawing
 * is exactly the shape a one-frame drawing has always been — nothing is left
 * carrying a container with a single frame in it. The last frame cannot be
 * removed, and neither can the frame holding the door.
 *
 * @returns {{tree: Object, changed: boolean, reason?: string}}
 */
export function removeFrame(tree, frameKey) {
  const frames = itemFrames(tree)
  if (frames.length <= 1) return { tree, changed: false, reason: 'the only frame' }
  const target = frames.find(f => f.key === frameKey)
  if (!target) return { tree, changed: false }

  const hasLeaf = node => DOOR_LEAF_TYPES.includes(node.part_type) ||
    (node.children ?? []).some(hasLeaf)
  if ((target.children ?? []).some(hasLeaf)) {
    return { tree, changed: false, reason: 'the frame with the door in it' }
  }

  const kept = frames.filter(f => f.key !== frameKey)
  const container = (tree.children ?? []).find(c => c.part_type === 'containerPart')
  if (!container) return { tree, changed: false }

  if (kept.length === 1) {
    return {
      tree: {
        ...tree,
        children: tree.children.map(c => c.key === container.key ? kept[0] : c),
      },
      changed: true,
    }
  }
  return {
    tree: {
      ...tree,
      children: tree.children.map(
        c => c.key === container.key ? { ...container, children: kept } : c),
    },
    changed: true,
  }
}

/**
 * Build a whole coupled single-door drawing: flag frames and the door frame,
 * left to right, for the Step BC templates.
 *
 * `flags` is an array of 'left' / 'right' — Integrate's templates 70 (both),
 * 71 (right) and 72 (left) — and `fanlights` gives every frame a transom
 * with a light over it, which is template 69.
 *
 * @returns {{tree: Object|null, missing: string[]}}
 */
export function buildCoupledSingleDoorFrame(profileValues, {
  doorWidth = 995,
  doorHeight = 2101,
  flagWidth = FLAG_FRAME_DEFAULTS.width,
  flagHeight = FLAG_FRAME_DEFAULTS.height,
  flags = ['left', 'right'],
  material = DEFAULT_DOOR_MATERIAL,
  product = null,
  quantity = 1,
  operation = DEFAULT_SINGLE_DOOR_OPERATION,
  fanlights = null,          // { doorOffset, flagOffset } or null
  fanlightBottomRail = 62,
  fanlightBottomRailExternal = 69,
} = {}) {
  const resolved = doorProfileDefaults(profileValues)
  if (resolved.missing.length > 0) return { tree: null, missing: resolved.missing }
  const d = resolved.values

  // The door frame, with or without a fanlight over the leaf.
  const base = buildSingleDoorFrame(profileValues, {
    width: doorWidth, height: doorHeight, material, product, quantity, operation,
    fanlight: fanlights ? { offset: fanlights.doorOffset } : null,
    fanlightBottomRail, fanlightBottomRailExternal,
  })
  if (!base.tree) return base
  const doorFrame = base.tree.children.find(c => c.part_type === 'assemblyFramePart')

  const flagFrames = flags.map(() => {
    const built = buildFlagFrame(profileValues, {
      width: flagWidth, height: flagHeight, defaults: resolved,
    })
    if (!built.node) return null
    if (!fanlights) return built.node
    // Template 69: a TOP-HUNG fanlight over the fixed light, in the flag's
    // own frame — which is what makes it a fanlight of that frame (300 min)
    // and the light below it a side light (780).
    const key = built.node.key
    const fan = {
      ...built.node.children[0],
      key: `${key}_fan`,
      values: {
        ...built.node.children[0].values,
        operation: 'top_hung',
        bottomHeight: fanlightBottomRail,
        bottomHeightExternal: fanlightBottomRailExternal,
      },
      children: [{
        ...built.node.children[0].children[0],
        key: `${key}_fan_glass`,
      }],
    }
    return {
      ...built.node,
      children: [
        {
          key: `${key}_trans`,
          part_type: 'transomPart',
          values: {
            offset: fanlights.flagOffset,
            thicknessInFrame: d.transomThickness,
            transomStopSize: 18,
            startDivider: '0', endDivider: '0',
          },
          children: [],
        },
        fan,
        ...built.node.children,
      ],
    }
  })
  if (flagFrames.some(f => f == null)) return { tree: null, missing: ['flag frame'] }

  const ordered = [
    ...flagFrames.filter((_, i) => flags[i] === 'left'),
    doorFrame,
    ...flagFrames.filter((_, i) => flags[i] === 'right'),
  ]

  return {
    tree: {
      ...base.tree,
      children: base.tree.children.flatMap(
        c => c.part_type === 'assemblyFramePart'
          ? [containerNode(makeKey('frames'), ordered)]
          : [c]),
    },
    missing: [],
  }
}

/**
 * The four coupled flag-frame templates, as CODE rather than as a line in a
 * generator script (Step BC follow-up item 3).
 *
 * `sql/step-bc2` built its trees from a scratch script, and the one thing
 * that script got wrong was invisible until the reviewer compared the live
 * template with Integrate's drawing: template 69's door is RIGHT hand
 * (Integrate operation 18) and the board's default is left. With the specs
 * here, the SQL generator and the tests read the same definitions, so a hand
 * or a size can be checked without running SQL.
 */
export const FLAG_FRAME_TEMPLATES = [
  {
    name: 'Single Door With Flag Lights',
    sort_order: 100,
    integrate: 70,
    options: { doorWidth: 995, doorHeight: 2101, flags: ['left', 'right'] },
  },
  {
    name: 'Single Door With Flag Light Right',
    sort_order: 110,
    integrate: 71,
    options: { doorWidth: 998, doorHeight: 2101, flags: ['right'] },
  },
  {
    // Integrate's own 72 is 1001 / 696; GlazePro mirrors 71 instead, so the
    // left- and right-flag templates are the same drawing either way round.
    name: 'Single Door With Flag Light Left',
    sort_order: 120,
    integrate: 72,
    options: { doorWidth: 998, doorHeight: 2101, flags: ['left'] },
  },
  {
    name: 'Single Door With Flag And Fan Lights',
    sort_order: 130,
    integrate: 69,
    options: {
      doorWidth: 1082, doorHeight: 2496,
      flagWidth: 650, flagHeight: 1632,
      flags: ['left', 'right'],
      fanlights: { doorOffset: 348, flagOffset: 348 },
      // Integrate's CD4 leaf is operation 18, RIGHT hand hung. The other
      // three templates are left hand, which is the board's default and what
      // Integrate's own 70 / 71 / 72 have.
      operation: 'right_hand_hung',
    },
  },
]

// ═════════════════════════════════════════════════════════════════════════════
// Step BD — FRONT DOORS (open in, panelled)
// docs/integrate-L31115-front-doors.txt, docs/step-bd-front-doors-brief.md
//
// A front door is an OPEN IN door with its own clearances and a leaf divided
// like a little frame: a 120 muntin and a mid rail, with a Tricoya panel or a
// glass unit in each cell. The surveyor sets that layout on the board, which
// is what setLeafGrid below is for.
// ═════════════════════════════════════════════════════════════════════════════

/** Integrate's open-in leaf, as the three front-door templates store it. */
export const FRONT_DOOR_CLEARANCES = { top: 3, left: 4, right: 4, bottom: 14 }
export const FRONT_DOOR_LEAF_BOTTOM_RAIL_MM = 170
export const FRONT_DOOR_MUNTIN_MM = 120
export const FRONT_DOOR_MID_RAIL_MM = 170
export const DEFAULT_FRONT_DOOR_OPERATION = 'left_hand_hung'

/** Integrate's own template sizes (facts file, drawings 16-18). */
export const FRONT_DOOR_DEFAULTS = {
  width: 1099,
  height: 2182,
  frameBottom: 50,            // NOT the garden door's 37
  fanlightHeight: 2595,
  fanlightTransomOffset: 431,
  archedHeight: 2199,
  archedMidRail: 120,
}

/** A muntin inside a leaf. */
function leafMuntinNode(key, { offset, thickness = FRONT_DOOR_MUNTIN_MM }) {
  return {
    key,
    part_type: 'mullionPart',
    values: {
      isMuntin: true,
      offset,
      thicknessInFrame: thickness,
      muntinThickness: thickness,
      mullionStopSize: 0,
      startDivider: '0', endDivider: '0',
    },
    children: [],
  }
}

function leafPanelNode(key) {
  return { key, part_type: 'panelPart', values: { ...DEFAULT_PANEL_VALUES }, children: [] }
}

function leafGlassNode(key, d) {
  return {
    key,
    part_type: 'glassPart',
    values: {
      ...DEFAULT_GLASS,
      glazingRebateWidth: d.glassRebate,
      glazingTolerance:   d.glassTolerance,
    },
    children: [],
  }
}

/**
 * Set a LEAF's panel layout: how many columns and rows its own grid has, and
 * what sits in each cell.
 *
 * `cells` is 'panel' or 'glass' per cell in ROW-MAJOR order (top row left to
 * right). Anything not named is a panel, except that a single-cell leaf keeps
 * its glass — a leaf with no grid is a glazed door, which is what every
 * garden door is.
 *
 * The dividers are spaced EVENLY unless the caller gives their positions.
 * That is what a surveyor wants from a layout button — and it is what the
 * MUNTIN gets, because Integrate’s 373 / 284 split on the Balham template is
 * its template’s accident, not a design.
 *
 * A MID RAIL is not an accident. A front door’s lock rail sits LOW — long
 * panels or glass above, a short panel below (Balham 983 / 635, Bedford
 * 941 / 618, the arched door 1103 / 582) — and the first templates centred
 * it, which is a door nobody sells. `rowOffsets` and `columnOffsets` carry
 * those positions, in the board’s own convention: a divider’s OFFSET is the
 * span BEFORE it, so a mid rail’s offset is the height of the cells ABOVE
 * it. Anything not given is still spaced evenly.
 */
export function setLeafGrid(tree, leafKey, {
  columns = 1,
  rows = 1,
  cells = null,
  muntinThickness = FRONT_DOOR_MUNTIN_MM,
  midRailThickness = FRONT_DOOR_MID_RAIL_MM,
  columnOffsets = null,
  rowOffsets = null,
} = {}, profileValues = {}) {
  const resolved = doorProfileDefaults(profileValues)
  const d = resolved.values
  const cols = Math.max(1, Math.round(columns))
  const rws  = Math.max(1, Math.round(rows))

  function walk(node) {
    if (!node) return node
    if (node.key === leafKey && canHoldGrid(node)) {
      const interior = leafInterior(tree, node)
      if (interior.width == null || interior.height == null) return node
      const dividers = []
      // Evenly spaced unless the caller says where. Each offset is the span
      // BEFORE that divider, which is how every divider on the board works.
      const colSpan = (interior.width - (cols - 1) * muntinThickness) / cols
      for (let i = 1; i < cols; i++) {
        dividers.push(leafMuntinNode(`${node.key}_muntin${i}`, {
          offset: columnOffsets?.[i - 1] ??
            Math.round((colSpan + muntinThickness) * (i - 1) + colSpan),
          thickness: muntinThickness,
        }))
      }
      const rowSpan = (interior.height - (rws - 1) * midRailThickness) / rws
      for (let i = 1; i < rws; i++) {
        dividers.push(midRailNode(`${node.key}_midrail${i}`, {
          offset: rowOffsets?.[i - 1] ??
            Math.round((rowSpan + midRailThickness) * (i - 1) + rowSpan),
          thickness: midRailThickness,
        }))
      }
      const want = cols * rws
      const existing = (node.children ?? []).filter(
        c => c.part_type === 'panelPart' || c.part_type === 'glassPart')
      const kinds = []
      for (let i = 0; i < want; i++) {
        kinds.push(cells?.[i] ?? (want === 1
          ? (existing[0]?.part_type === 'panelPart' ? 'panel' : 'glass')
          : 'panel'))
      }
      const cellNodes = kinds.map((kind, i) => {
        // Keep a cell that is already the right kind, so its glass codes and
        // panel options survive a layout change.
        const keep = existing[i]
        if (keep && ((kind === 'panel') === (keep.part_type === 'panelPart'))) return keep
        return kind === 'panel'
          ? leafPanelNode(`${node.key}_panel${i + 1}`)
          : leafGlassNode(`${node.key}_glass${i + 1}`, d)
      })
      return { ...node, children: [...dividers, ...cellNodes] }
    }
    const children = (node.children ?? []).map(walk)
    return children.length ? { ...node, children } : node
  }
  return walk(tree)
}

/** Turn ONE cell of a leaf's grid into a panel, or into a glass unit. */
export function setLeafCellKind(tree, cellKey, kind, profileValues = {}) {
  const d = doorProfileDefaults(profileValues).values
  function walk(node) {
    if (!node) return node
    // Step BP item 2: "Panel" on a casement sash's glass — G2's A2 / B2 are
    // fixed sashes that are all panel — and back to glass.
    if (canHoldGrid(node) &&
        (node.children ?? []).some(c => c.key === cellKey)) {
      return {
        ...node,
        children: node.children.map(c => {
          if (c.key !== cellKey) return c
          if (kind === 'panel' && c.part_type === 'panelPart') return c
          if (kind === 'glass' && c.part_type === 'glassPart') return c
          return kind === 'panel'
            ? leafPanelNode(`${c.key}_panel`)
            : leafGlassNode(`${c.key}_glass`, d)
        }),
      }
    }
    const children = (node.children ?? []).map(walk)
    return children.length ? { ...node, children } : node
  }
  return walk(tree)
}

// ── Step BP item 3: a muntin in a leaf, full height or confined ──────────────

/** Where a leaf's one muntin runs: nowhere, the full height, or one row. */
export const LEAF_MUNTIN_SPANS = ['none', 'full', 'below', 'above']

/**
 * Give a leaf (or a casement sash) ONE muntin, or take it away.
 *
 *   full   — the whole interior height, through the mid rail (M2: two glass
 *            over two panels);
 *   below  — the row under the mid rail only (M1: one glass over two
 *            panels), stored as Integrate stores it, `startDivider` = the
 *            mid rail's key;
 *   above  — the row over the mid rail only, `endDivider` = the rail's key;
 *   none   — no muntin.
 *
 * 120 thick as both readings, centred in the interior unless `offset` is
 * given. Each cell the muntin makes takes the KIND of the cell it split —
 * glass stays glass and a panel stays a panel — and a cell that survives
 * keeps its node, so glass codes and panel options are not lost. Without a
 * mid rail, below and above mean full.
 */
export function setLeafMuntin(tree, holderKey, {
  span = 'full', thickness = FRONT_DOOR_MUNTIN_MM, offset = null,
} = {}, profileValues = {}) {
  const d = doorProfileDefaults(profileValues).values
  function walk(node) {
    if (!node) return node
    if (node.key === holderKey && canHoldGrid(node)) {
      const interior = leafInterior(tree, node)
      if (interior.width == null || interior.height == null) return node
      const before = leafCells(tree, node)
      const parts  = leafCellParts(node)
      const rails  = leafMidRails(node)
      const rail   = rails[0] ?? null
      const muntins = []
      if (span !== 'none') {
        const muntin = leafMuntinNode(`${node.key}_muntin1`, {
          offset: offset ?? Math.round((interior.width - thickness) / 2),
          thickness,
        })
        if (span === 'below' && rail) muntin.values.startDivider = String(rail.key)
        if (span === 'above' && rail) muntin.values.endDivider   = String(rail.key)
        muntins.push(muntin)
      }
      const others = (node.children ?? []).filter(c =>
        c.part_type !== 'mullionPart' && c.part_type !== 'panelPart' && c.part_type !== 'glassPart')
      const shell = { ...node, children: [...others, ...muntins] }
      const after = leafCells(tree, shell)

      // the old cells by row, in order, so a new cell can take over from
      // the one it split
      const oldRows = {}
      before.forEach((c, i) => { (oldRows[c.row] ??= []).push(i) })
      const used = new Set()
      const cellNodes = after.map((c, i) => {
        const row = oldRows[c.row] ?? []
        const src = parts[row[Math.min(c.col, row.length - 1)]] ?? parts[parts.length - 1] ?? null
        if (src && !used.has(src.key)) { used.add(src.key); return src }
        return src?.part_type === 'panelPart' || !src
          ? leafPanelNode(`${node.key}_cell${i + 1}_panel`)
          : leafGlassNode(`${node.key}_cell${i + 1}_glass`, d)
      })
      return { ...shell, children: [...others, ...muntins, ...cellNodes] }
    }
    const children = (node.children ?? []).map(walk)
    return children.length ? { ...node, children } : node
  }
  return walk(tree)
}

/**
 * An OPEN IN door leaf: a front door's leaf, with its own clearances, its
 * 170 bottom rail and no glass of its own until the grid says so.
 */
export function buildFrontDoorLeaf(profileValues, {
  defaults = null,
  operation = DEFAULT_FRONT_DOOR_OPERATION,
  bottomHeight = FRONT_DOOR_LEAF_BOTTOM_RAIL_MM,
  arch = null,
} = {}) {
  const resolved = defaults ?? doorProfileDefaults(profileValues)
  if (resolved.missing.length > 0) return { node: null, missing: resolved.missing }
  const d = resolved.values
  const key = makeKey('doorleaf')
  return {
    node: {
      key,
      part_type: 'doorLeafPart',
      values: {
        operation,
        casementTypeId: 'open_in',          // Integrate typeId 8
        thickness:  d.doorThickness,
        topHeight:  d.leafHead,
        leftWidth:  d.leafStileLeft,
        rightWidth: d.leafStileRight,
        bottomHeight,
        bottomHeightExternal: bottomHeight,
        // Step BG: an OPEN-IN leaf takes the square rail (Integrate 99);
        // 101 stepped is the open-out one. Nothing prices it, and the
        // direction switch writes whichever the direction calls for.
        btmRailShapeId: 'square',
        mechanicalClearanceTop:    FRONT_DOOR_CLEARANCES.top,
        mechanicalClearanceLeft:   FRONT_DOOR_CLEARANCES.left,
        mechanicalClearanceRight:  FRONT_DOOR_CLEARANCES.right,
        mechanicalClearanceBottom: FRONT_DOOR_CLEARANCES.bottom,
        defaultMuntinThickness: FRONT_DOOR_MUNTIN_MM,
        archHead: false,
        ...(arch ?? {}),
        toBeReplaced: true,
      },
      children: [],
    },
    missing: [],
  }
}

/**
 * A FRONT DOOR: frame, open-in leaf, and the leaf's panel grid.
 *
 * `fanlight` puts a DIRECT GLAZED unit over a frame transom, which is what
 * Integrate's "Bedford Front Door w Fanlight" has — not a casement sash.
 * `arch` gives the frame and the leaf a curved head.
 */
export function buildFrontDoorFrame(profileValues, {
  width = FRONT_DOOR_DEFAULTS.width,
  height = FRONT_DOOR_DEFAULTS.height,
  material = DEFAULT_DOOR_MATERIAL,
  product = null,
  quantity = 1,
  operation = DEFAULT_FRONT_DOOR_OPERATION,
  columns = 2,
  rows = 2,
  cells = null,
  midRailThickness = FRONT_DOOR_MID_RAIL_MM,
  columnOffsets = null,
  rowOffsets = null,
  fanlight = null,                 // { offset } — a direct glazed unit over a transom
  arch = null,                     // { frame: {...}, leaf: {...} }
  sideLight = null,                // { side: 'left' | 'right' } — a fixed sash beside it
} = {}) {
  const resolved = doorProfileDefaults(profileValues)
  if (resolved.missing.length > 0) return { tree: null, missing: resolved.missing }
  const d = resolved.values

  const base = buildFrenchDoorFrame(profileValues, { width, height, material, product, quantity })
  if (!base.tree) return base

  const leaf = buildFrontDoorLeaf(profileValues, {
    defaults: resolved, operation, arch: arch?.leaf ?? null,
  })
  if (!leaf.node) return { tree: null, missing: leaf.missing }

  const dividers = []
  const openings = []
  if (fanlight != null) {
    dividers.push({
      key: makeKey('trans'),
      part_type: 'transomPart',
      values: {
        offset: fanlight.offset ?? FRONT_DOOR_DEFAULTS.fanlightTransomOffset,
        thicknessInFrame: d.transomThickness,
        transomStopSize: 18,
        startDivider: '0', endDivider: '0',
      },
      children: [],
    })
    // The fanlight itself: a glass unit straight in the frame.
    const key = makeKey('dgu')
    openings.push({
      key,
      part_type: 'glassPart',
      values: {
        ...DEFAULT_GLASS,
        glazingRebateWidth: d.glassRebate,
        glazingTolerance:   d.glassTolerance,
        mechanicalClearanceTop: 15, mechanicalClearanceBottom: 15,
        mechanicalClearanceLeft: 15, mechanicalClearanceRight: 15,
        hiddenInRebateTop: 15, hiddenInRebateBottom: 15,
        hiddenInRebateLeft: 15, hiddenInRebateRight: 15,
        toBeReplaced: true,
      },
      children: [],
    })
  }
  openings.push(leaf.node)

  // A front door's frame bottom and cill are 50, not the garden door's 37,
  // and the finish is DUAL — Clean White inside, Custom Colour TBC outside.
  const tree = {
    ...base.tree,
    children: base.tree.children.map(c => {
      if (c.part_type === 'paintAndIronmongeryPart') {
        return {
          ...c,
          values: {
            ...c.values,
            isFrontDoor: true,
            // The DUAL finish Integrate’s front-door templates carry. The
            // option CODES are reference_options category ‘paint_finish’:
            // 'clean_white' and 'custom' (reviewer, 14 Oct). Only whether
            // the two differ reaches a price — the three "- Dual Finish"
            // door rules — but a code the board cannot show is a code a
            // surveyor cannot correct.
            internalFinish: 'clean_white',
            externalFinish: 'custom',
          },
        }
      }
      if (c.part_type !== 'assemblyFramePart') return c
      return {
        ...c,
        values: {
          ...c.values,
          bottomHeight: FRONT_DOOR_DEFAULTS.frameBottom,
          ...(arch?.frame ?? {}),
        },
        children: [
          ...dividers,
          ...openings,
          ...(c.children ?? []).filter(x => x.part_type === 'cillPart')
            .map(x => ({
              ...x,
              values: { ...x.values, height: FRONT_DOOR_DEFAULTS.frameBottom },
            })),
        ],
      }
    }),
  }

  const withGrid = setLeafGrid(tree, leaf.node.key, {
    columns, rows, cells, midRailThickness, columnOffsets, rowOffsets,
  }, profileValues)
  if (!sideLight) return { tree: withGrid, missing: [] }

  // Step BE: the side light goes on AFTER the grid, because where its own
  // mid rail sits is worked out from the door’s bottom panel.
  const frameKey = (withGrid.children ?? []).find(c => c.part_type === 'assemblyFramePart')?.key
  const added = addSideLight(withGrid, frameKey, sideLight.side ?? 'right', profileValues)
  return { tree: added.tree, missing: added.missing ?? [] }
}

/**
 * Step BE (Nathan, decision g): a SIDE LIGHT.
 *
 * A fixed CASEMENT SASH beside the door — not a fixed door leaf, which is
 * what decision c had guessed before Nathan drew one. It carries the same
 * grid a leaf does, glass over a raised-and-fielded panel, and its mid rail
 * LINES UP with the door’s.
 *
 * Lining up is arithmetic, not a stored figure. Measured from the bottom of
 * the opening, the door’s mid rail sits at
 *     leaf bottom clearance + bottom rail + panel
 * and the sash’s at
 *     sash bottom clearance + bottom rail + panel.
 * The door’s bottom rail is 170 and its leaf drops 14 into the frame; the
 * sash’s rail is 175 and it drops 3. So for the two rails to meet, the
 * sash’s own offset (the GLASS above it, which is what a divider offset
 * stores) is its interior height less the door’s panel less the 6 mm by
 * which the two bottoms differ. On Nathan’s drawing 20 that is 888 above a
 * 834 panel, against the door’s 834 — the same panel height both sides.
 */
/** A finite number, or null — the same helper the geometry modules use. */
function num(v) {
  const n = Number(v)
  return isFinite(n) ? n : null
}

export const SIDE_LIGHT_DEFAULTS = {
  width: 365,                 // the opening; the sash is 359 in it
  rails: { top: 62, left: 62, right: 62, bottom: 175 },
  clearance: 3,
  midRailThickness: 170,
}

/** Where a side light’s mid rail goes so that it meets the door’s. */
export function sideLightMidRailOffset({
  sashInteriorHeight,
  doorPanelHeight,
  midRailThickness = SIDE_LIGHT_DEFAULTS.midRailThickness,
  doorBottomDrop = FRONT_DOOR_CLEARANCES.bottom,
  sashBottomDrop = SIDE_LIGHT_DEFAULTS.clearance,
  doorBottomRail = FRONT_DOOR_LEAF_BOTTOM_RAIL_MM,
  sashBottomRail = SIDE_LIGHT_DEFAULTS.rails.bottom,
} = {}) {
  if (!(sashInteriorHeight > 0) || !(doorPanelHeight > 0)) return null
  // the height of the door’s mid rail above the bottom of the opening
  const doorRailUp = doorBottomDrop + doorBottomRail + doorPanelHeight
  // the sash’s panel, so that its rail reaches the same height
  const sashPanel = doorRailUp - sashBottomDrop - sashBottomRail
  // and the offset is the GLASS above the rail — the interior less the
  // panel AND the rail itself, which is what a divider offset means
  const offset = sashInteriorHeight - midRailThickness - sashPanel
  return offset > 0 ? Math.round(offset) : null
}

/**
 * A fixed side light: the sash, its mid rail, its glass and its panel.
 */
export function buildSideLight(profileValues, {
  defaults = null,
  bottomHeight = SIDE_LIGHT_DEFAULTS.rails.bottom,
  midRailOffset = null,
  midRailThickness = SIDE_LIGHT_DEFAULTS.midRailThickness,
} = {}) {
  const resolved = defaults ?? doorProfileDefaults(profileValues)
  if (resolved.missing.length > 0) return { node: null, missing: resolved.missing }
  const d = resolved.values
  const key = makeKey('sidelight')
  const dividers = midRailOffset == null ? [] : [midRailNode(`${key}_midrail`, {
    offset: midRailOffset, thickness: midRailThickness,
  })]
  return {
    node: {
      key,
      part_type: 'casementSashPart',
      values: {
        operation: 'fix',
        casementTypeId: 'open_in',
        thickness: d.doorThickness,
        topHeight:  SIDE_LIGHT_DEFAULTS.rails.top,
        leftWidth:  SIDE_LIGHT_DEFAULTS.rails.left,
        rightWidth: SIDE_LIGHT_DEFAULTS.rails.right,
        bottomHeight,
        bottomHeightExternal: bottomHeight,
        btmRailShapeId: 'stepped',
        mechanicalClearanceTop:    SIDE_LIGHT_DEFAULTS.clearance,
        mechanicalClearanceBottom: SIDE_LIGHT_DEFAULTS.clearance,
        mechanicalClearanceLeft:   SIDE_LIGHT_DEFAULTS.clearance,
        mechanicalClearanceRight:  SIDE_LIGHT_DEFAULTS.clearance,
        toBeReplaced: true,
      },
      children: [
        ...dividers,
        leafGlassNode(`${key}_glass`, d),
        leafPanelNode(`${key}_panel`),
      ],
    },
    missing: [],
  }
}

/**
 * Step BE follow-up: re-centre the grids of every leaf and sash whose SIZE
 * has just changed.
 *
 * THE LIVE BUG (template 32, drawing 47): the side-light template stored
 * the door’s muntin at 479 — centred for the 1298-wide leaf the door had
 * before the side light took 465 mm of the frame — so its panels came out
 * 479 / 73 of a 672 interior. The grid was built first and the leaf was
 * narrowed afterwards, and nothing re-read it.
 *
 * Only an EVEN run of dividers is re-evened. A grid a surveyor has moved on
 * purpose is a decision and stays; so does a MID RAIL at a chosen height —
 * a lock rail does not move because the door got narrower, which is why
 * Integrate’s 983 on the Balham survives this and the muntin does not.
 */
export function recentreGridsAfterResize(before, after, profileValues = {}) {
  const holders = tree => {
    const out = []
    const walk = n => {
      if (DOOR_LEAF_TYPES.includes(n?.part_type) || n?.part_type === 'casementSashPart') out.push(n)
      for (const c of (n?.children ?? [])) walk(c)
    }
    walk(tree)
    return out
  }
  const old = new Map(holders(before).map(h => [h.key, h]))
  let tree = after

  for (const holder of holders(after)) {
    const was = old.get(holder.key)
    if (!was) continue
    const oldInterior = leafInterior(before, was)
    const newInterior = leafInterior(tree, holder)
    if (oldInterior.width == null || newInterior.width == null) continue

    const dividers = kind => (holder.children ?? []).filter(c => c.part_type === kind)
    const muntins = dividers('mullionPart')
    const rails = dividers('transomPart')
    const widthChanged  = oldInterior.width  !== newInterior.width
    const heightChanged = oldInterior.height !== newInterior.height

    const columnOffsets = widthChanged && wasEven(muntins, oldInterior.width)
      ? evenOffsets(newInterior.width, muntins)
      : null
    const rowOffsets = heightChanged && wasEven(rails, oldInterior.height)
      ? evenOffsets(newInterior.height, rails)
      : null
    if (!columnOffsets && !rowOffsets) continue

    tree = setLeafGrid(tree, holder.key, {
      columns: muntins.length + 1,
      rows: rails.length + 1,
      cells: leafCellKinds(holder),
      muntinThickness: dividerThicknessOf(muntins[0]) ?? FRONT_DOOR_MUNTIN_MM,
      midRailThickness: dividerThicknessOf(rails[0]) ?? FRONT_DOOR_MID_RAIL_MM,
      columnOffsets: columnOffsets ?? muntins.map(m => num(m.values?.offset) ?? 0),
      rowOffsets: rowOffsets ?? rails.map(r => num(r.values?.offset) ?? 0),
    }, profileValues)
  }
  return tree
}

/** What sits in each cell now, so a re-centred grid keeps it. */
function leafCellKinds(holder) {
  return (holder.children ?? [])
    .filter(c => c.part_type === 'panelPart' || c.part_type === 'glassPart')
    .map(c => (c.part_type === 'panelPart' ? 'panel' : 'glass'))
}

function dividerThicknessOf(node) {
  const v = node?.values ?? {}
  return num(v.thicknessInFrame) ?? num(v.midrailThickness) ?? num(v.muntinThickness)
}

/** Were these dividers evenly spaced across that total? (within 1 mm) */
function wasEven(dividers, total) {
  if (!dividers.length || !(total > 0)) return false
  const thickness = dividerThicknessOf(dividers[0]) ?? 0
  const want = evenOffsets(total, dividers, thickness)
  return dividers.every((d, i) => Math.abs((num(d.values?.offset) ?? 0) - want[i]) <= 1)
}

/** Evenly spaced offsets for this many dividers across a total. */
function evenOffsets(total, dividers, thickness = null) {
  const t = thickness ?? dividerThicknessOf(dividers[0]) ?? 0
  const n = dividers.length + 1
  const span = (total - (n - 1) * t) / n
  return dividers.map((_, i) => Math.round((span + t) * i + span))
}

/**
 * Add a SIDE LIGHT to a front door: a mullion in the frame and a fixed sash
 * in the new column, with its mid rail meeting the door’s.
 *
 * This is the board’s action — one call for what a surveyor does.
 */
export function addSideLight(tree, frameKey, side = 'right', profileValues = {}) {
  const resolved = doorProfileDefaults(profileValues)
  if (resolved.missing.length > 0) return { tree, changed: false, missing: resolved.missing }
  const d = resolved.values
  const frame = itemFrames(tree).find(f => f.key === frameKey) ?? itemFrames(tree)[0]
  if (!frame) return { tree, changed: false, missing: [] }
  const leaf = (frame.children ?? []).find(c => DOOR_LEAF_TYPES.includes(c.part_type))
  if (!leaf) return { tree, changed: false, missing: [] }

  const fv = frame.values ?? {}
  const width = num(fv.width) ?? 0
  const interiorWidth = width - d.frameJambLeft - (d.frameJambRight ?? d.frameJambLeft)
  const mullionT = d.transomThickness
  const doorColumn = interiorWidth - SIDE_LIGHT_DEFAULTS.width - mullionT
  if (!(doorColumn > 0)) return { tree, changed: false, missing: [] }

  // The sash’s interior, worked out from the opening it will sit in.
  const openingHeight = (num(fv.height) ?? 0) - d.frameHead - d.cillHeight
  const sashHeight = openingHeight - 2 * SIDE_LIGHT_DEFAULTS.clearance
  const sashInterior = sashHeight - SIDE_LIGHT_DEFAULTS.rails.top -
    SIDE_LIGHT_DEFAULTS.rails.bottom
  // The door’s BOTTOM row, which is the panel the side light lines up
  // with. doorPanelSize is the first panel in the children, and on a
  // four-panel door that is a TOP one.
  const doorCells = leafCells(tree, leaf)
  const bottomRow = doorCells.length
    ? doorCells[doorCells.length - 1].height
    : (doorPanelSize(tree, leaf).height ?? 0)
  const midRailOffset = sideLightMidRailOffset({
    sashInteriorHeight: sashInterior,
    doorPanelHeight: bottomRow,
  })

  const sash = buildSideLight(profileValues, { defaults: resolved, midRailOffset })
  if (!sash.node) return { tree, changed: false, missing: sash.missing }

  // The mullion's offset is the span BEFORE it, so the DOOR keeps its
  // column and the side light takes what is left — on the left, the sash
  // comes first and the door after.
  const mullionOffset = side === 'left' ? SIDE_LIGHT_DEFAULTS.width : doorColumn
  const mull = mullionNode(makeKey('mull'), mullionOffset, d)
  const others = (frame.children ?? []).filter(
    c => c.part_type !== 'cillPart' && !DOOR_LEAF_TYPES.includes(c.part_type))
  const cills = (frame.children ?? []).filter(c => c.part_type === 'cillPart')
  const openings = side === 'left' ? [sash.node, leaf] : [leaf, sash.node]

  const nextFrame = {
    ...frame,
    children: [...others, mull, ...openings, ...cills],
  }
  // Step BE follow-up: the door leaf has just lost 465 mm to the side
  // light, so its own grid is re-centred against the leaf it is now.
  const withSash = replaceFrame(tree, frame.key, nextFrame)
  return {
    tree: recentreGridsAfterResize(tree, withSash, profileValues),
    changed: true,
    missing: [],
  }
}

/** Put a rebuilt frame back in the tree, wherever it sits. */
function replaceFrame(tree, frameKey, nextFrame) {
  const walk = node => {
    if (!node) return node
    if (node.key === frameKey) return nextFrame
    const children = (node.children ?? []).map(walk)
    return children.length ? { ...node, children } : node
  }
  return walk(tree)
}

/** Is this drawing a FRONT door? The flag the paint part carries. */
export function isFrontDoorTree(tree) {
  const paint = (tree?.children ?? []).find(c => c.part_type === 'paintAndIronmongeryPart')
  return paint?.values?.isFrontDoor === true
}

/**
 * The three front-door templates (brief item 8), as code — the same pattern
 * as FLAG_FRAME_TEMPLATES, so the SQL, the tests and the board read one
 * definition.
 */
export const FRONT_DOOR_TEMPLATES = [
  {
    name: 'Front Door',
    sort_order: 200,
    integrate: 128168,          // "Balham"
    options: {
      width: 1099, height: 2182,
      columns: 2, rows: 2,
      // The MUNTIN is centred (329 / 328 of a 777 interior): Integrate’s
      // 373 / 284 is its own template’s accident.
      //
      // The MID RAIL is Integrate’s, at 983 — a front door’s lock rail sits
      // LOW, two long panels over two short ones (983 / 635 of the 1788
      // interior, with the 170 rail between). Centring it gave 809 / 809,
      // which is a door nobody sells.
      rowOffsets: [983],
    },
  },
  {
    name: 'Front Door With Fanlight',
    sort_order: 210,
    integrate: 22253,           // "Bedford Front Door w Fanlight"
    options: {
      width: 1099, height: 2595,
      columns: 1, rows: 2,
      cells: ['glass', 'panel'],
      // Integrate’s Bedford: glass 941 over a 618 panel, of a 1729 interior.
      rowOffsets: [941],
      fanlight: { offset: 431 },
    },
  },
  {
    name: 'Arched Front Door',
    sort_order: 220,
    integrate: 6619,            // "Arched Door"
    options: {
      width: 1099, height: 2199,
      columns: 1, rows: 2,
      cells: ['glass', 'panel'],
      midRailThickness: 120,
      // Integrate’s Arched Door: shaped glass 1103 over a 582 panel, of a
      // 1805 interior, with its own 120 rail.
      rowOffsets: [1103],
      // Integrate's own arched door is glass over a 120 mid rail and ONE
      // panel, and it is kept that way: a four-panel arched door would need
      // shaped top panels, which no rule prices and no drawing holds.
      arch: {
        frame: {
          curvedFrameHead: true,
          frameLevelArchHead: true,
          frameLevelArchHeight: 508.891,
          frameLevelArchRadius: 551.121,
          archShoulderLeft: 1690,
          archShoulderRight: 1690,
        },
        leaf: {
          archHead: true,
          archHeight: 345.92,
          archRadius: 391.12,
          curvedSashHead: true,
          shoulderHeight: 1459.08,
        },
      },
    },
  },
  {
    // Step BE, Nathan’s decision g: the side light is a FIXED CASEMENT
    // SASH. The DOOR keeps Integrate’s Balham layout (983 / 635, muntin
    // centred — decision f), and the sash’s own mid rail is placed so that
    // it MEETS the door’s: 1031 of glass over a 641 panel, both rails 819
    // above the bottom of the opening.
    name: 'Front Door With Side Light',
    sort_order: 230,
    integrate: 310688,          // drawing 20, Nathan’s own
    options: {
      width: 1400, height: 2182,
      columns: 2, rows: 2,
      rowOffsets: [983],
      sideLight: { side: 'right' },
    },
  },
]

// ═════════════════════════════════════════════════════════════════════════════
// Step BF — STABLE DOORS (Nathan's decisions h-k, 14 Oct 2026)
// docs/integrate-L31115-stable-doors.txt
//
// A stable door is ONE container in the frame holding a TOP and a BOTTOM
// half, each an ordinary door leaf with its own grid. Integrate calls them
// Top / Bottom StableDoorLeafParts; GlazePro stores doorLeafParts marked
// `stableHalf`, so door_leaf_qty is 2 and every rule, loop, label and count
// that knows a door leaf already sees both halves — "Door Leaf" 1035 fires
// per half, which is what Integrate's own editor does.
// ═════════════════════════════════════════════════════════════════════════════

/** Integrate's own figures, from drawings 21-23. */
export const STABLE_DOOR_DEFAULTS = {
  width: 1099,
  height: 2207,
  frameBottom: 50,
  clearances: { top: 4, left: 4, right: 4, bottom: 3, between: 3 },
  /** The TOP half's height of the container: Integrate's 1055 of 2103. */
  splitOffset: 1055,
  top:    { rails: { top: 110, bottom: 99 } },
  bottom: { rails: { top: 99, bottom: 170 } },
  thickness: 58,
  visionPanel: { width: 200, height: 350 },
}

export const STABLE_HALF = { TOP: 'top', BOTTOM: 'bottom' }

/** A vision panel: a small glass unit inside a panel (Integrate's ST2). */
function visionPanelNode(key, d, { width, height }) {
  return {
    key,
    part_type: 'glassPart',
    values: {
      ...DEFAULT_GLASS,
      glazingRebateWidth: d.glassRebate,
      glazingTolerance:   d.glassTolerance,
      visionPanelWidth: width,
      visionPanelHeight: height,
      isVisionPanel: true,
      toBeReplaced: true,
    },
    children: [],
  }
}

/** One half of a stable door. */
function stableHalfNode(key, half, d, { rails, cell = 'panel', visionPanel = null }) {
  const cellNode = cell === 'glass'
    ? leafGlassNode(`${key}_glass`, d)
    : {
      ...leafPanelNode(`${key}_panel`),
      children: visionPanel
        ? [visionPanelNode(`${key}_vision`, d, visionPanel)]
        : [],
    }
  return {
    key,
    part_type: 'doorLeafPart',
    values: {
      stableHalf: half,
      operation: DEFAULT_FRONT_DOOR_OPERATION,
      casementTypeId: 'open_in',
      thickness: d.doorThickness,
      topHeight:  rails.top,
      leftWidth:  d.leafStileLeft,
      rightWidth: d.leafStileRight,
      bottomHeight: rails.bottom,
      bottomHeightExternal: rails.bottom,
      btmRailShapeId: 'stepped',
      archHead: false,
      toBeReplaced: true,
    },
    children: [cellNode],
  }
}

/**
 * Build a STABLE DOOR: the frame, the container and its two halves.
 *
 * `top` and `bottom` are 'panel' or 'glass'; `visionPanel` puts Integrate's
 * 200 x 350 light in the TOP half's panel.
 */
export function buildStableDoorFrame(profileValues, {
  width = STABLE_DOOR_DEFAULTS.width,
  height = STABLE_DOOR_DEFAULTS.height,
  material = DEFAULT_DOOR_MATERIAL,
  product = null,
  quantity = 1,
  top = 'panel',
  bottom = 'panel',
  visionPanel = null,
  splitOffset = STABLE_DOOR_DEFAULTS.splitOffset,
} = {}) {
  const resolved = doorProfileDefaults(profileValues)
  if (resolved.missing.length > 0) return { tree: null, missing: resolved.missing }
  const d = resolved.values

  const base = buildFrenchDoorFrame(profileValues, { width, height, material, product, quantity })
  if (!base.tree) return base

  const key = makeKey('stable')
  const container = {
    key,
    part_type: 'stableDoorPart',
    values: {
      thickness: STABLE_DOOR_DEFAULTS.thickness,
      splitOffset,
      mechanicalClearanceTop:    STABLE_DOOR_DEFAULTS.clearances.top,
      mechanicalClearanceLeft:   STABLE_DOOR_DEFAULTS.clearances.left,
      mechanicalClearanceRight:  STABLE_DOOR_DEFAULTS.clearances.right,
      mechanicalClearanceBottom: STABLE_DOOR_DEFAULTS.clearances.bottom,
      clearanceBetweenHalves:    STABLE_DOOR_DEFAULTS.clearances.between,
      toBeReplaced: true,
    },
    children: [
      stableHalfNode(`${key}_top`, STABLE_HALF.TOP, d, {
        rails: STABLE_DOOR_DEFAULTS.top.rails,
        cell: top,
        visionPanel: top === 'panel' ? visionPanel : null,
      }),
      stableHalfNode(`${key}_bottom`, STABLE_HALF.BOTTOM, d, {
        rails: STABLE_DOOR_DEFAULTS.bottom.rails,
        cell: bottom,
      }),
    ],
  }

  // A stable door's frame bottom and cill are 50, its finish is SINGLE
  // (Clean White both sides — Nathan's decision i, as Integrate's template),
  // it is not a front door and it has NO multipoint lock.
  const tree = {
    ...base.tree,
    children: base.tree.children.map(c => {
      if (c.part_type === 'paintAndIronmongeryPart') {
        return {
          ...c,
          values: {
            ...c.values,
            isFrontDoor: false,
            isDoorMpls: false,
            internalFinish: 'clean_white',
            externalFinish: 'clean_white',
          },
        }
      }
      if (c.part_type !== 'assemblyFramePart') return c
      return {
        ...c,
        values: { ...c.values, bottomHeight: STABLE_DOOR_DEFAULTS.frameBottom },
        children: [
          container,
          ...(c.children ?? []).filter(x => x.part_type === 'cillPart')
            .map(x => ({
              ...x,
              values: { ...x.values, height: STABLE_DOOR_DEFAULTS.frameBottom },
            })),
        ],
      }
    }),
  }

  return { tree, missing: [] }
}

/** Is this drawing a STABLE door? */
export function isStableDoorTree(tree) {
  const has = node => node?.part_type === 'stableDoorPart' ||
    (node?.children ?? []).some(has)
  return has(tree)
}

/**
 * The three stable-door templates (Nathan's decision h), group "Cottage
 * Doors" as Integrate's are — all at its own 1099 x 2207.
 */
export const STABLE_DOOR_TEMPLATES = [
  {
    name: 'Stable Door',
    sort_order: 300,
    integrate: 4553,
    options: { top: 'panel', bottom: 'panel' },
  },
  {
    // Integrate has no glazed-top template; Nathan sells one (decision h).
    name: 'Stable Door Glazed Top',
    sort_order: 310,
    integrate: null,
    options: { top: 'glass', bottom: 'panel' },
  },
  {
    name: 'Stable Door With Vision Panel',
    sort_order: 320,
    integrate: 6618,
    options: {
      top: 'panel',
      bottom: 'panel',
      visionPanel: { ...STABLE_DOOR_DEFAULTS.visionPanel },
    },
  },
]

// ═════════════════════════════════════════════════════════════════════════════
// Step BH — DOORSETS WITH LIGHTS, and a PAIR OF FRONT DOORS
// Nathan, 14 Oct 2026. docs/step-bh-brief.md.
//
// EVERY doorset can have side lights, top lights and flag windows, and the
// board builds any of them from any door (see doorsetLights.test.js). These
// are the five Nathan sells as TEMPLATES, so a surveyor starts from the
// drawing rather than assembling it:
//
//   Pair Of Front Doors                             1500 x 2182
//   Front Door With Side Lights And Fanlight        1806 x 2654
//   Front Door With Side Lights And Fanlight Over Door   1806 x 2654
//   Stable Door With Fanlight                       1099 x 2679
//   Stable Door With Side Light                     1505 x 2207
//
// Integrate has no template for any of them and building them by hand on its
// board is impractical, so NONE of these is a reading: each is a composition
// of parts already matched penny for penny (the open-in pair OI1, the
// panelled leaves FD4, the front door and its fanlight FT1 / FT2, the side
// light FT4, the doorset FD5, the stable doors ST1-ST3 and SO1), and
// Integrate’s rules for them are general. Every fired rule is listed in
// docs/reports/step-bh.md for the reviewer to check by hand.
// ═════════════════════════════════════════════════════════════════════════════

/** Integrate’s own front-door lock rail, which every front door here uses. */
export const FRONT_DOOR_PAIR_DEFAULTS = {
  width: 1500,
  height: 2182,
  /** The glass or panel ABOVE the mid rail — Integrate’s Balham 983. */
  midRailOffset: 983,
  midRailThickness: FRONT_DOOR_MID_RAIL_MM,
}

/**
 * A PAIR OF FRONT DOORS (Nathan 2): two open-in leaves, each with a 170 mid
 * rail and ONE FLAT PANEL above and below it. No muntin.
 *
 * It is a FRONT door, not a French door: `isFrontDoor` true and the dual
 * finish, which is what makes fitting rule "Front Door and Frame (Base)" 840
 * fire and "French Doors" 780 not fire (both band on `is_front_door`), and
 * what fires the three "- Dual Finish" rules.
 *
 * Built by turning an ordinary French pair IN with Step BG’s switch, so
 * there is one definition of the open-in cill, clearances and square rail.
 */
export function buildFrontDoorPairFrame(profileValues, {
  width = FRONT_DOOR_PAIR_DEFAULTS.width,
  height = FRONT_DOOR_PAIR_DEFAULTS.height,
  material = DEFAULT_DOOR_MATERIAL,
  product = null,
  quantity = 1,
  masterLeaf = DEFAULT_DOOR_MASTER_LEAF,
  midRailOffset = FRONT_DOOR_PAIR_DEFAULTS.midRailOffset,
  midRailThickness = FRONT_DOOR_PAIR_DEFAULTS.midRailThickness,
} = {}) {
  const base = buildFrenchDoorFrame(profileValues, {
    width, height, material, product, quantity, masterLeaf,
  })
  if (!base.tree) return base

  // open IN: the 50 cill and stop 0, the pair’s 3 / 14 / 3 / 3 and the
  // square 170 rail, all from the open_in_doors profile (Step BG)
  const turned = setOpeningDirection(base.tree, OPEN_IN, profileValues)
  if (turned.missing.length > 0) return { tree: null, missing: turned.missing }

  // a FRONT door: the flag and the dual finish
  let tree = {
    ...turned.tree,
    children: turned.tree.children.map(c => (c.part_type !== 'paintAndIronmongeryPart'
      ? c
      : {
        ...c,
        values: {
          ...c.values,
          isFrontDoor: true,
          internalFinish: 'clean_white',
          externalFinish: 'custom',
        },
      })),
  }

  // each leaf: the mid rail, a flat panel above and a flat panel below
  for (const leaf of doorLeaves(tree)) {
    tree = setLeafGrid(tree, leaf.key, {
      columns: 1, rows: 2, cells: ['panel', 'panel'],
      midRailThickness, rowOffsets: [midRailOffset],
    }, profileValues)
  }
  return { tree, missing: [] }
}

/** The openings of Nathan’s doorsets: a 365 side light each side of the door. */
export const FRONT_DOOR_SET_DEFAULTS = {
  width: 1806,                 // 94 + 365 + 41 + 900 + 41 + 365
  height: 2654,                // 2182 + 431 + 41
  sideLightWidth: SIDE_LIGHT_DEFAULTS.width,
  doorColumn: 900,
  fanlightHeight: 431,
  midRailOffset: FRONT_DOOR_PAIR_DEFAULTS.midRailOffset,
}

/**
 * A FRONT DOOR WITH SIDE LIGHTS AND A FANLIGHT — both constructions Nathan
 * sells (brief item 3):
 *
 *   fanlight: 'full_width'  the transom runs the whole width and the two
 *                           mullions run through it, so there are THREE
 *                           direct glazed fanlights over (as FD5);
 *   fanlight: 'over_door'   the side lights run FULL HEIGHT and the transom
 *                           is bounded by the mullions, so there is ONE
 *                           fanlight, over the door.
 *
 * Either way the side lights’ own mid rails line up with the door’s, which
 * is `sideLightMidRailOffset` doing the arithmetic from the door’s bottom
 * panel — the same call `addSideLight` makes, so a template and a
 * hand-built drawing cannot drift.
 */
export function buildFrontDoorSetFrame(profileValues, {
  width = FRONT_DOOR_SET_DEFAULTS.width,
  height = FRONT_DOOR_SET_DEFAULTS.height,
  material = DEFAULT_DOOR_MATERIAL,
  product = null,
  quantity = 1,
  operation = DEFAULT_FRONT_DOOR_OPERATION,
  fanlight = 'full_width',     // 'full_width' | 'over_door'
  sideLightWidth = FRONT_DOOR_SET_DEFAULTS.sideLightWidth,
  doorColumn = FRONT_DOOR_SET_DEFAULTS.doorColumn,
  fanlightHeight = FRONT_DOOR_SET_DEFAULTS.fanlightHeight,
  midRailOffset = FRONT_DOOR_SET_DEFAULTS.midRailOffset,
} = {}) {
  const resolved = doorProfileDefaults(profileValues)
  if (resolved.missing.length > 0) return { tree: null, missing: resolved.missing }
  const d = resolved.values

  // the door itself, with Integrate’s Balham grid, in its own column
  const base = buildFrontDoorFrame(profileValues, {
    width, height, material, product, quantity, operation,
    columns: 2, rows: 2, rowOffsets: [midRailOffset],
  })
  if (!base.tree) return base

  const frame = itemFrames(base.tree)[0]
  // the fanlight row and its transom come off the interior; the door and the
  // side lights share what is left (pass two reads the actual cells)

  const overDoor = fanlight === 'over_door'
  const mullA = mullionNode(makeKey('mull'), sideLightWidth, d)
  const mullB = mullionNode(makeKey('mull'),
    sideLightWidth + d.transomThickness + doorColumn, d)
  const transom = {
    key: makeKey('trans'),
    part_type: 'transomPart',
    values: {
      offset: fanlightHeight,
      thicknessInFrame: d.transomThickness,
      transomStopSize: 18,
      // 'over_door': the transom STOPS at the two mullions, which is what
      // leaves the side lights full height (Step AV’s short dividers)
      startDivider: overDoor ? mullA.key : '0',
      endDivider:   overDoor ? mullB.key : '0',
    },
    children: [],
  }

  const leaf = doorLeaves(base.tree)[0]
  const fanlightUnit = () => doorsetDirectGlazedUnit(profileValues, { defaults: resolved })

  // TWO PASSES, and the reason is worth stating: where a side light’s mid
  // rail goes depends on the DOOR’s bottom panel, and the door’s bottom
  // panel is not known until the frame has been divided — the leaf in the
  // undivided frame is 2540 tall with a 1107 bottom panel, and in its own
  // cell it is 2068 with a 635 one. Reading it too early put both rails 472
  // mm out, which is the fanlight and its transom.
  //
  // So: the lights go in WITHOUT their mid rails, the door is measured in
  // the frame it is actually in, and then each sash gets its rail.
  const bare = () => buildSideLight(profileValues, {
    defaults: resolved, midRailOffset: null,
  }).node
  const left = bare()
  const right = bare()
  if (!left || !right) return { tree: null, missing: ['side light'] }

  // ROW-MAJOR order, which is what frameCells and every label read
  const openings = overDoor
    ? [left, fanlightUnit(), right, leaf]
    : [fanlightUnit(), fanlightUnit(), fanlightUnit(), left, leaf, right]

  const staged = replaceFrame(base.tree, frame.key, {
    ...frame,
    children: [
      mullA, mullB, transom,
      ...openings,
      ...(frame.children ?? []).filter(c => c.part_type === 'cillPart'),
    ],
  })
  // the leaf has just lost the two side lights’ columns and the fanlight’s
  // row, so its own grid is re-centred against the leaf it is now (Step BE
  // follow-up); its MID RAIL stays at Integrate’s 983.
  const sized = recentreGridsAfterResize(base.tree, staged, profileValues)

  // pass two: the door’s bottom panel, and the rail that meets it
  const placedLeaf = doorLeaves(sized).find(l => l.key === leaf.key) ?? leaf
  const doorCells = leafCells(sized, placedLeaf)
  const bottomRow = doorCells.length
    ? doorCells[doorCells.length - 1].height
    : (doorPanelSize(sized, placedLeaf).height ?? 0)

  const withRails = (node) => {
    if (node.key !== left.key && node.key !== right.key) {
      return { ...node, children: (node.children ?? []).map(withRails) }
    }
    const interior = leafInterior(sized, node)
    const offset = sideLightMidRailOffset({
      sashInteriorHeight: interior.height ?? 0,
      doorPanelHeight: bottomRow,
    })
    if (offset == null) return node
    return {
      ...node,
      children: [
        midRailNode(`${node.key}_midrail`, {
          offset, thickness: SIDE_LIGHT_DEFAULTS.midRailThickness,
        }),
        ...(node.children ?? []),
      ],
    }
  }
  return { tree: withRails(sized), missing: [] }
}

/**
 * Where a STABLE DOOR’s side light carries its mid rail, so that the rail is
 * LEVEL with the stable door’s meeting rails.
 *
 * NATHAN, 15 Oct: the TOP EDGES line up — the top of the side light’s 170
 * mid rail with the top of the stable door’s meeting rail (the top half’s
 * 99 bottom rail). Step BH aligned the CENTRES of the two bands and said so;
 * this is the decision, and it moves the rail 16 mm up (911 -> 895).
 *
 * A stable door’s join is three bands, not one rail: the top half’s 99
 * bottom rail, the 3 mm between the halves and the bottom half’s 99 top
 * rail — 201 mm in all, against the side light’s 170. Two rails of
 * different depths cannot align on both edges, so the TOP is the one that
 * matters: it is the line the eye follows across the doorset.
 *
 * Measured from the top of the frame’s interior:
 *   the meeting rail’s top = container top clearance + split - 99
 *   the mid rail’s top     = sash top clearance + sash head + offset
 * and the offset is the GLASS above the rail, which is what a divider offset
 * means everywhere on this board. 4 + 1055 - 99 - 3 - 62 = 895.
 */
export function stableSideLightMidRailOffset({
  splitOffset = STABLE_DOOR_DEFAULTS.splitOffset,
  containerTopClearance = STABLE_DOOR_DEFAULTS.clearances.top,
  meetingRail = STABLE_DOOR_DEFAULTS.top.rails.bottom,
  sashTopClearance = SIDE_LIGHT_DEFAULTS.clearance,
  sashHead = SIDE_LIGHT_DEFAULTS.rails.top,
} = {}) {
  const meetingRailTop = containerTopClearance + splitOffset - meetingRail
  const offset = meetingRailTop - sashTopClearance - sashHead
  return offset > 0 ? Math.round(offset) : null
}

/** A stable door with a fanlight over it, or a side light beside it. */
export const STABLE_DOOR_SET_DEFAULTS = {
  fanlightHeight: 431,
  /** 2207 + 431 + 41 */
  fanlightFrameHeight: 2679,
  sideLightWidth: SIDE_LIGHT_DEFAULTS.width,
  /** 1099 + 41 + 365 */
  sideLightFrameWidth: 1505,
}

/**
 * A STABLE DOOR with a top light or a side light (brief item 3d / 3e).
 *
 * The stable door itself is untouched: with the frame made taller by the
 * fanlight and its transom, the door’s own cell is the 2110 it always was,
 * so the container is 2103 and the halves 1055 / 1048 — the ST1 figures. A
 * side light takes a column of its own and the door keeps its 1005 opening.
 */
export function buildStableDoorSetFrame(profileValues, {
  fanlight = false,
  sideLight = null,            // { side: 'left' | 'right' }
  width = null,
  height = null,
  fanlightHeight = STABLE_DOOR_SET_DEFAULTS.fanlightHeight,
  sideLightWidth = STABLE_DOOR_SET_DEFAULTS.sideLightWidth,
  ...rest
} = {}) {
  const resolved = doorProfileDefaults(profileValues)
  if (resolved.missing.length > 0) return { tree: null, missing: resolved.missing }
  const d = resolved.values

  const base = buildStableDoorFrame(profileValues, {
    ...rest,
    width: width ?? (sideLight
      ? STABLE_DOOR_SET_DEFAULTS.sideLightFrameWidth
      : STABLE_DOOR_DEFAULTS.width),
    height: height ?? (fanlight
      ? STABLE_DOOR_SET_DEFAULTS.fanlightFrameHeight
      : STABLE_DOOR_DEFAULTS.height),
  })
  if (!base.tree) return base

  const frame = itemFrames(base.tree)[0]
  const container = (frame.children ?? []).find(c => c.part_type === 'stableDoorPart')
  const cills = (frame.children ?? []).filter(c => c.part_type === 'cillPart')
  const dividers = []
  let openings = [container]

  if (fanlight) {
    dividers.push({
      key: makeKey('trans'),
      part_type: 'transomPart',
      values: {
        offset: fanlightHeight,
        thicknessInFrame: d.transomThickness,
        transomStopSize: 18,
        startDivider: '0', endDivider: '0',
      },
      children: [],
    })
    // the light goes ABOVE the door, which is the only way round a doorset
    // is built — row-major order puts it first
    openings = [doorsetDirectGlazedUnit(profileValues, { defaults: resolved }), container]
  }

  if (sideLight) {
    const side = sideLight.side ?? 'right'
    const doorColumn = STABLE_DOOR_DEFAULTS.width - d.frameJambLeft -
      (d.frameJambRight ?? d.frameJambLeft)
    dividers.push(mullionNode(makeKey('mull'),
      side === 'left' ? sideLightWidth : doorColumn, d))
    const sash = buildSideLight(profileValues, {
      defaults: resolved,
      midRailOffset: stableSideLightMidRailOffset({
        splitOffset: num(container.values?.splitOffset) ??
          STABLE_DOOR_DEFAULTS.splitOffset,
      }),
    })
    if (!sash.node) return { tree: null, missing: sash.missing }
    openings = side === 'left'
      ? [sash.node, ...openings]
      : [...openings, sash.node]
  }

  return {
    tree: replaceFrame(base.tree, frame.key, {
      ...frame,
      children: [...dividers, ...openings, ...cills],
    }),
    missing: [],
  }
}

/**
 * The five Step BH templates, as code — one definition for the SQL, the
 * tests and the board, as every template list here is.
 */
export const DOORSET_TEMPLATES = [
  {
    name: 'Pair Of Front Doors',
    sort_order: 240,
    group_name: 'Open In Doors',
    builder: 'frontDoorPair',
    integrate: null,
    options: { width: 1500, height: 2182 },
  },
  {
    name: 'Front Door With Side Lights And Fanlight',
    sort_order: 250,
    group_name: 'Open In Doors',
    builder: 'frontDoorSet',
    integrate: null,
    options: { fanlight: 'full_width' },
  },
  {
    name: 'Front Door With Side Lights And Fanlight Over Door',
    sort_order: 260,
    group_name: 'Open In Doors',
    builder: 'frontDoorSet',
    integrate: null,
    options: { fanlight: 'over_door' },
  },
  {
    name: 'Stable Door With Fanlight',
    sort_order: 330,
    group_name: 'Cottage Doors',
    builder: 'stableDoorSet',
    integrate: null,
    options: { fanlight: true },
  },
  {
    name: 'Stable Door With Side Light',
    sort_order: 340,
    group_name: 'Cottage Doors',
    builder: 'stableDoorSet',
    integrate: null,
    options: { sideLight: { side: 'right' } },
  },
]

/** Build one of the five by name — what the SQL generator and the tests use. */
export function buildDoorsetTemplate(template, profileValues) {
  const opts = template.options ?? {}
  if (template.builder === 'frontDoorPair') return buildFrontDoorPairFrame(profileValues, opts)
  if (template.builder === 'frontDoorSet')  return buildFrontDoorSetFrame(profileValues, opts)
  if (template.builder === 'stableDoorSet') return buildStableDoorSetFrame(profileValues, opts)
  return { tree: null, missing: [`unknown builder ${template.builder}`] }
}
