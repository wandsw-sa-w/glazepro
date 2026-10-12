// casementOpenings.js — building and changing the openings of a casement or
// direct glazed frame, as gridActions.js does for box sash grids.
//
// Pure functions, so the drawing board, the template builder and the tests
// all produce the SAME tree — the tree Step AO's fixtures pin
// (src/pricing/benchmarks/fixtureCasement.js) and the engine prices.
//
// What an opening is (docs/integrate-L31115-direct-glazed.txt): the frame's
// children are a flat list of openings in left-to-right order (Integrate's
// matrixIndex A1, B1, …), each either
//   - a casementSashPart with its own glassPart child, or
//   - a glassPart that is a DIRECT CHILD OF THE FRAME, which is what makes
//     it a direct glazed unit,
// followed by the cill. A FIXED casement is the same sash with operation
// `fix` — still a sash, still priced as one (Step AO proved it from
// Integrate's minutes).
//
// Every size comes from the drawing's profile values; nothing here is
// hard-coded. The casement profile (default_profiles.code 'casement') holds
// them all, imported from Integrate.

import { makeKey } from './gridActions.js'

// ── Profile value helpers ────────────────────────────────────────────────────

/**
 * Profile values arrive either as the board's raw rows
 * ({ field_key, default_value }) or as the short map the pricing side uses
 * ({ sashThickness: 54 }). Both are accepted so the board, the template
 * builder and the tests can pass whichever they hold.
 */
export function profileValue(profileValues, fieldKey) {
  if (!profileValues) return null
  if (Array.isArray(profileValues)) {
    const row = profileValues.find(r => r.field_key === fieldKey)
    if (row?.default_value == null || row.default_value === '') return null
    const n = Number(row.default_value)
    return isFinite(n) ? n : row.default_value
  }
  const short = fieldKey.includes('.') ? fieldKey.split('.').pop() : fieldKey
  const v = profileValues[fieldKey] ?? profileValues[short]
  if (v == null || v === '') return null
  const n = Number(v)
  return isFinite(n) ? n : v
}

/**
 * The first of several candidate field keys that the profile actually holds.
 *
 * The casement profile's values were imported from Integrate and the
 * reviewer listed them with wildcards (`defaultDirGuStopSize*`,
 * `default*GlazingRebateWidthForDirGU`), so the exact live spellings are NOT
 * in the repo. Each value below is therefore looked up through a list of
 * candidates, and anything NOT found is returned in `missing` so the board
 * can show it rather than silently building a 0 into a drawing.
 */
function firstOf(profileValues, candidates) {
  for (const key of candidates) {
    const v = profileValue(profileValues, key)
    if (v != null) return { value: v, key }
  }
  return { value: null, key: null }
}

const CANDIDATES = {
  frameJambLeft:   ['assemblyFramePart.leftWidth'],
  frameJambRight:  ['assemblyFramePart.rightWidth', 'assemblyFramePart.leftWidth'],
  frameHead:       ['assemblyFramePart.topHeight'],
  frameBottom:     ['assemblyFramePart.bottomHeight'],
  frameDepth:      ['assemblyFramePart.frameDepth'],
  headStop:        ['assemblyFramePart.frameHeadStopSize'],
  stileStop:       ['assemblyFramePart.frameStileStopSize'],
  cillStop:        ['assemblyFramePart.cillStopSize'],
  cillAngle:       ['assemblyFramePart.cillAngle'],
  jambType:        ['assemblyFramePart.jambType'],
  cillHeight:      ['cillPart.height'],
  cillDepth:       ['cillPart.depth'],
  mullionThickness: ['mullionPart.thicknessInFrameSolid', 'mullionPart.thicknessInFrame'],
  mullionStop:     ['mullionPart.mullionStopSize', 'assemblyFramePart.frameStileStopSize'],
  sashThickness:   ['casementSashPart.thickness', 'casementSashPart.sashThickness'],
  sashHead:        ['casementSashPart.topHeight'],
  sashStileLeft:   ['casementSashPart.leftWidth'],
  sashStileRight:  ['casementSashPart.rightWidth', 'casementSashPart.leftWidth'],
  // Integrate's casement bottom rail is its fanlight bottom height (83)
  sashBottom:      ['casementSashPart.bottomHeight', 'casementSashPart.defaultFanlightBottomHeight',
                    'casementSashPart.defaultFanlightBtmRailHeight'],
  sashClearance:   ['casementSashPart.mechanicalClearance', 'casementSashPart.mechanicalClearanceLeft'],
  btmRailShape:    ['casementSashPart.btmRailShapeId'],
  sashRebate:      ['glassPart.defaultDoubleGlazingRebateWidthForSash'],
  sashTolerance:   ['glassPart.defaultDoubleGlazingTolerance'],
  dirGuStop:       ['glassPart.defaultDirGuStopSize', 'glassPart.defaultDirGuStopSizeLeft',
                    'glassPart.defaultDirGuStopSizeForSash'],
  dirGuRebate:     ['glassPart.defaultDoubleGlazingRebateWidthForDirGU',
                    'glassPart.defaultGlazingRebateWidthForDirGU'],
  dirGuTolerance:  ['glassPart.defaultDoubleGlazingToleranceForDirGU',
                    'glassPart.defaultGlazingToleranceForDirGU'],
}

/** Values a casement drawing cannot be built correctly without. */
const REQUIRED = [
  'frameJambLeft', 'frameHead', 'frameDepth', 'cillHeight', 'cillDepth',
  'sashThickness', 'sashHead', 'sashStileLeft', 'sashBottom', 'sashClearance',
  'sashRebate', 'sashTolerance', 'dirGuStop', 'dirGuRebate', 'dirGuTolerance',
  'mullionThickness',
]

/**
 * Resolve everything a casement drawing needs from the drawing's profile.
 *
 * @returns {{values: Object, missing: string[], keysUsed: Object}}
 *   `missing` names the REQUIRED values the profile does not hold, under
 *   the candidate keys that were tried — a visible warning, never a 0.
 */
export function casementProfileDefaults(profileValues) {
  const values = {}
  const keysUsed = {}
  const missing = []
  for (const [name, candidates] of Object.entries(CANDIDATES)) {
    const { value, key } = firstOf(profileValues, candidates)
    values[name] = value
    if (key) keysUsed[name] = key
    if (value == null && REQUIRED.includes(name)) {
      missing.push(`${name} (tried ${candidates.join(', ')})`)
    }
  }
  return { values, missing, keysUsed }
}

function num(profileValues, fieldKey, fallbackKey = null) {
  const v = profileValue(profileValues, fieldKey)
  if (v != null && typeof v === 'number') return v
  if (fallbackKey) {
    const f = profileValue(profileValues, fallbackKey)
    if (f != null && typeof f === 'number') return f
  }
  return null
}

// ── Opening kinds ────────────────────────────────────────────────────────────

export const OPENING_KINDS = ['opening_casement', 'fixed_casement', 'direct_glazed']

export const OPENING_KIND_LABELS = {
  opening_casement: 'Opening casement',
  fixed_casement:   'Fixed casement',
  direct_glazed:    'Direct glazed unit',
}

/** The sash operations Integrate offers on a casement, in its own order. */
export const CASEMENT_OPERATIONS = [
  'fix', 'top_hung', 'bottom_hung', 'left_hand_hung', 'right_hand_hung',
]

export const DEFAULT_CASEMENT_OPERATION = 'left_hand_hung'

/** What kind of opening is this node? */
export function openingKindOf(node) {
  if (!node) return null
  if (node.part_type === 'glassPart') return 'direct_glazed'
  if (node.part_type !== 'casementSashPart') return null
  return node.values?.operation === 'fix' ? 'fixed_casement' : 'opening_casement'
}

// ── Builders ─────────────────────────────────────────────────────────────────

/**
 * The glass values a new unit starts with: the glass CODES carry over from
 * the opening being replaced (a surveyor's choice, not a default), and the
 * rebate and tolerance come from the profile — the sash set for a casement
 * sash's glass, the DirGU set for a direct glazed unit.
 */
function glassCodesOf(node) {
  const v = node?.values ?? {}
  const codes = {}
  for (const k of ['glazingId', 'isIndividualPanes', 'internalGlassPartNo',
                   'externalGlassPartNo', 'singleGlassPartNo',
                   'spacerDimId', 'spacerColourId', 'gasFillId']) {
    if (v[k] != null) codes[k] = v[k]
  }
  return codes
}

const DEFAULT_GLASS = {
  glazingId: 'double_glazing',
  isIndividualPanes: false,
  internalGlassPartNo: 'GL100010',
  externalGlassPartNo: 'GL100080',
}

/** A casement sash opening (with its glass child) from the profile. */
export function buildCasementSash(profileValues, {
  operation = DEFAULT_CASEMENT_OPERATION,
  glass = null,
  sashType = 'open_out',
  defaults = null,
} = {}) {
  const d = (defaults ?? casementProfileDefaults(profileValues)).values
  const key = makeKey('cas')
  const clearance = d.sashClearance ?? 0
  return {
    key,
    part_type: 'casementSashPart',
    values: {
      operation,
      casementTypeId: sashType,
      sashThickness: d.sashThickness,
      topHeight:     d.sashHead,
      leftWidth:     d.sashStileLeft,
      rightWidth:    d.sashStileRight,
      bottomHeight:  d.sashBottom,
      mechanicalClearanceLeft:   clearance,
      mechanicalClearanceRight:  clearance,
      mechanicalClearanceTop:    clearance,
      mechanicalClearanceBottom: clearance,
      btmRailShapeId: d.btmRailShape,
      toBeReplaced: true,
    },
    children: [{
      key: `${key}_glass`,
      part_type: 'glassPart',
      values: {
        ...DEFAULT_GLASS,
        ...(glass ?? {}),
        // A casement sash's glass takes the SASH rebate and tolerance
        glazingRebateWidth: d.sashRebate,
        glazingTolerance:   d.sashTolerance,
      },
      children: [],
    }],
  }
}

/**
 * A direct glazed unit: a glassPart for the frame's own children, carrying
 * the opening-level fields Integrate stores on it — the mechanical
 * clearance each side (the DirGU stop size), the DirGU rebate and
 * tolerance, and the glass HIDDEN IN THE REBATE each side, which is
 * rebate − tolerance (20 − 2 = 18) and is stored, not derived, so pricing
 * never has to assume it.
 */
export function buildDirectGlazedUnit(profileValues, { glass = null, defaults = null } = {}) {
  const d = (defaults ?? casementProfileDefaults(profileValues)).values
  const rebate = d.dirGuRebate
  const tolerance = d.dirGuTolerance
  // Stored, not derived, so pricing never has to assume it
  const hidden = (rebate != null && tolerance != null) ? rebate - tolerance : null
  const clearance = d.dirGuStop ?? 0
  return {
    key: makeKey('dgu'),
    part_type: 'glassPart',
    values: {
      ...DEFAULT_GLASS,
      ...(glass ?? {}),
      toBeReplaced: true,
      mechanicalClearanceLeft:   clearance,
      mechanicalClearanceRight:  clearance,
      mechanicalClearanceTop:    clearance,
      mechanicalClearanceBottom: clearance,
      hiddenInRebateLeft:   hidden,
      hiddenInRebateRight:  hidden,
      hiddenInRebateTop:    hidden,
      hiddenInRebateBottom: hidden,
      glazingRebateWidth: rebate,
      glazingTolerance:   tolerance,
    },
    children: [],
  }
}

/** Build one opening of the given kind, carrying `glass` codes over. */
export function buildOpening(kind, profileValues, { glass = null, sashType = 'open_out', defaults = null } = {}) {
  const d = defaults ?? casementProfileDefaults(profileValues)
  if (kind === 'direct_glazed') return buildDirectGlazedUnit(profileValues, { glass, defaults: d })
  return buildCasementSash(profileValues, {
    operation: kind === 'fixed_casement' ? 'fix' : DEFAULT_CASEMENT_OPERATION,
    glass,
    sashType,
    defaults: d,
  })
}

// ── Tree helpers ─────────────────────────────────────────────────────────────

const OPENING_TYPES = ['casementSashPart', 'glassPart']

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

/** The frame's opening nodes, left to right (A1, B1, …). */
export function openingNodes(tree) {
  const frame = findFirst(tree, 'assemblyFramePart')
  return (frame?.children ?? []).filter(c => OPENING_TYPES.includes(c.part_type))
}

/** Integrate's matrix label for an opening by index: A1, B1, C1 … */
export function matrixIndexOf(index) {
  return `${String.fromCharCode(65 + index)}1`
}

/** Is this a casement/direct-glazed frame (as opposed to a box sash one)? */
export function isCasementFrameTree(tree) {
  const frame = findFirst(tree, 'assemblyFramePart')
  if (!frame) return false
  const children = frame.children ?? []
  if (children.some(c => c.part_type === 'sashPairPart')) return false
  return children.some(c => OPENING_TYPES.includes(c.part_type))
}

// ── Changing an opening ──────────────────────────────────────────────────────

/**
 * Change one opening to another kind, in place: it keeps its POSITION in the
 * frame's children (so A1 stays A1) and its glass codes. The frame, the
 * mullions, the cill and every other opening are untouched.
 *
 * @returns {{tree: Object, changed: boolean}}
 */
export function changeOpening(tree, openingKey, kind, profileValues) {
  if (!OPENING_KINDS.includes(kind)) return { tree, changed: false }
  const frame = findFirst(tree, 'assemblyFramePart')
  if (!frame) return { tree, changed: false }
  const idx = (frame.children ?? []).findIndex(c => c.key === openingKey)
  if (idx < 0) return { tree, changed: false }

  const current = frame.children[idx]
  if (!OPENING_TYPES.includes(current.part_type)) return { tree, changed: false }
  if (openingKindOf(current) === kind) return { tree, changed: false }

  // Step AQ: a sash that is ALREADY a sash only changes its OPERATION.
  //
  // This used to fall through to buildOpening, which built a brand new sash
  // from the profile and threw away the sections the sash actually had. On
  // the reviewer's live test (12 Oct) B1 was an opening casement copied from
  // A1 — 62/62/62/83, 54 thick, clearance 4 — and "Change to: Fixed
  // casement" saved it as 94/94/94/47, 58 thick, clearance 2, which priced
  // 0.42 m² of glass instead of 0.48 and 17.55 dm³ of sash timber instead of
  // 12.25. Integrate's Fix changes nothing but the operation (2/18 kept
  // 62/62/62/83, 54, 4).
  //
  // This is also the only correct behaviour: the surveyor may have changed
  // the sash's sections by hand, and a fixed casement is still the same sash
  // (Step AO proved it from Integrate's own minutes). Building a new one is
  // right only when there is no sash yet — a direct glazed unit becoming a
  // casement, below.
  if (current.part_type === 'casementSashPart' &&
      (kind === 'fixed_casement' || kind === 'opening_casement')) {
    const operation = kind === 'fixed_casement' ? 'fix' : DEFAULT_CASEMENT_OPERATION
    return setCasementOperation(tree, openingKey, operation)
  }

  // Carry the glass codes over: on a casement sash they live on its glass
  // child, on a direct glazed unit on the unit itself.
  const glassSource = current.part_type === 'casementSashPart'
    ? (current.children ?? []).find(c => c.part_type === 'glassPart')
    : current
  const replacement = buildOpening(kind, profileValues, {
    glass: glassCodesOf(glassSource),
    sashType: current.values?.casementTypeId ?? 'open_out',
  })

  const children = [...frame.children]
  children[idx] = replacement
  return {
    tree: replaceNode(tree, frame.key, { ...frame, children }),
    changed: true,
  }
}

/** Set a casement sash's operation (Integrate's operation buttons). */
export function setCasementOperation(tree, sashKey, operation) {
  if (!CASEMENT_OPERATIONS.includes(operation)) return { tree, changed: false }
  const sash = findByKey(tree, sashKey)
  if (!sash || sash.part_type !== 'casementSashPart') return { tree, changed: false }
  if (sash.values?.operation === operation) return { tree, changed: false }
  return {
    tree: replaceNode(tree, sashKey, { ...sash, values: { ...sash.values, operation } }),
    changed: true,
  }
}

function findByKey(node, key) {
  if (!node) return null
  if (node.key === key) return node
  for (const child of (node.children ?? [])) {
    const found = findByKey(child, key)
    if (found) return found
  }
  return null
}

function replaceNode(tree, key, replacement) {
  if (!tree) return tree
  if (tree.key === key) return replacement
  return { ...tree, children: (tree.children ?? []).map(c => replaceNode(c, key, replacement)) }
}

// ── A whole casement frame (templates and new drawings) ─────────────────────

/**
 * Build a complete casement drawing tree — the same code the templates are
 * generated with, so a template is exactly what the board would make.
 *
 * @param {Object|Array} profileValues  the CASEMENT profile's values
 * @param {{width, height, openings: string[], mullionThickness?}} opts
 *        `openings` is a list of OPENING_KINDS, left to right.
 */
export function buildCasementFrame(profileValues, {
  width = 1200,
  height = 1300,
  openings = ['opening_casement'],
  materials = { frame: 'softwood', sash: 'softwood', cill: 'utile' },
  sashType = 'open_out',
} = {}) {
  const resolved = casementProfileDefaults(profileValues)
  const d = resolved.values

  const mullionCount = Math.max(0, openings.length - 1)
  const mullionT = d.mullionThickness ?? 0
  const jambL = d.frameJambLeft ?? 0
  const jambR = d.frameJambRight ?? jambL
  const interiorWidth = width - jambL - jambR
  const openingWidth = (interiorWidth - mullionCount * mullionT) / (mullionCount + 1)

  const mullions = Array.from({ length: mullionCount }, (_, i) => ({
    key: makeKey('mull'),
    part_type: 'mullionPart',
    // Left-face offsets giving equal openings (Step AE's convention),
    // rounded to 0.1 mm as Integrate stores offsets (Step AE 3b)
    values: {
      offset: Math.round(((i + 1) * openingWidth + i * mullionT) * 10) / 10,
      thicknessInFrame: mullionT,
      mullionStopSize: d.mullionStop ?? 0,
    },
    children: [],
  }))

  const tree = {
    key: makeKey('item'),
    part_type: 'drawingItemPart',
    values: {
      // A casement drawing is Complete New (or No Work) only — every other
      // type of work is a sash-window service.
      typeOfWork: 'complete_new',
      frameMaterialId: materials.frame,
      sashMaterialId:  materials.sash,
      cillMaterialId:  materials.cill,
    },
    children: [
      {
        key: makeKey('paint'),
        part_type: 'paintAndIronmongeryPart',
        values: {
          internalFinish: 'clean_white',
          externalFinish: 'clean_white',
          cillFinish:     'clean_white',
          cutOutBrickReveal: false,
          ironmongeryFinish: 'PB',
          // Casements are multipoint by default (Nathan, 9 Oct); the
          // surveyor can untick it. NO stored ironmongery list: Integrate's
          // own default_ironmongery rules price it and follow the openings.
          isCasementMpls: true,
        },
        children: [],
      },
      { key: makeKey('notes'), part_type: 'notesPart', values: {}, children: [] },
      { key: makeKey('price'), part_type: 'pricePart', values: {}, children: [] },
      {
        key: makeKey('frame'),
        part_type: 'assemblyFramePart',
        values: {
          width,
          height,
          leftWidth:  jambL,
          rightWidth: jambR,
          topHeight:  d.frameHead,
          bottomHeight: d.frameBottom,
          frameDepth: d.frameDepth,
          jambType: d.jambType ?? 'solid_profiled',
          frameHeadStopSize:  d.headStop,
          frameStileStopSize: d.stileStop,
          cillStopSize:       d.cillStop,
          cillAngle:          d.cillAngle,
          rakeFrame: false,
          archHead: false,
        },
        children: [
          ...mullions,
          ...openings.map(kind => buildOpening(kind, profileValues, { sashType, defaults: resolved })),
          {
            key: makeKey('cill'),
            part_type: 'cillPart',
            // ONE cill per frame; its priced volume is the full frame width
            values: { height: d.cillHeight, depth: d.cillDepth },
            children: [],
          },
        ],
      },
    ],
  }
  return { tree, missing: resolved.missing }
}
