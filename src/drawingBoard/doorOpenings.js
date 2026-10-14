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
import { DOOR_LEAF_TYPES, leafInterior, leafCells, doorPanelSize } from '../pricing/doorGeometry.js'
import { itemFrames } from '../pricing/casementGeometry.js'

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

  const panel = () => ({
    key: makeKey('dgu'),
    part_type: 'glassPart',
    values: {
      ...DEFAULT_GLASS,
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
  })

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
    if (node.key === leafKey && DOOR_LEAF_TYPES.includes(node.part_type)) {
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
    if (DOOR_LEAF_TYPES.includes(node.part_type) &&
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
        btmRailShapeId: 'stepped',
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
  return {
    tree: replaceFrame(tree, frame.key, nextFrame),
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
