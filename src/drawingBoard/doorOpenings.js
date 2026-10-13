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
import { DOOR_LEAF_TYPES } from '../pricing/doorGeometry.js'

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

// ── Step BA: panelled leaves, and the mid rail the board can move ────────────

/** Integrate's own mid rail on template 79, and the panel it leaves. */
export const DEFAULT_LEAF_MID_RAIL_MM = 170
export const DEFAULT_LEAF_PANEL_HEIGHT_MM = 425

/** The panel options a new panelled leaf starts with (Integrate's defaults). */
export const DEFAULT_PANEL_VALUES = {
  internalPanelTypeId: 'raised_and_fielded',
  externalPanelTypeId: 'raised_and_fielded',
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
    if (node.key === leafKey && DOOR_LEAF_TYPES.includes(node.part_type)) {
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

  const directGlazed = () => glass({
    mechanicalClearanceTop: DOORSET_DEFAULTS.directGlazedClearance,
    mechanicalClearanceBottom: DOORSET_DEFAULTS.directGlazedClearance,
    mechanicalClearanceLeft: DOORSET_DEFAULTS.directGlazedClearance,
    mechanicalClearanceRight: DOORSET_DEFAULTS.directGlazedClearance,
    hiddenInRebateTop: DOORSET_DEFAULTS.directGlazedHidden,
    hiddenInRebateBottom: DOORSET_DEFAULTS.directGlazedHidden,
    hiddenInRebateLeft: DOORSET_DEFAULTS.directGlazedHidden,
    hiddenInRebateRight: DOORSET_DEFAULTS.directGlazedHidden,
    toBeReplaced: true,
  })

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
