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
import { resolveJambTypeCode } from './applyOperationDefaults.js'
import {
  frameCells, OPENING_TYPES, FRENCH_PAIR_PART, FRENCH_SASH_TYPES, CASEMENT_SASH_TYPES,
  FRENCH_DOOR_PAIR_PART, SINGLE_DOOR_LEAF_PART, PAIR_PART_TYPES, PAIR_LEAF_TYPES, isPairPart, isLeftLeaf,
  DOOR_LEAF_LIKE,
  frameOwning, itemFrames,
} from '../pricing/casementGeometry.js'

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
  // Step AR item 3: the FULL field key only. This used to fall back to the
  // short property name (`fieldKey.split('.').pop()`), which is how the
  // board built a sash with the wrong sections.
  //
  // DrawingBoard's `profileValueMap` is keyed by the short name alone
  // (pv.field_key.split('.').pop()), so EVERY part type's values share one
  // namespace and the last row read wins. Asking for
  // `casementSashPart.bottomHeight` on a profile that has no such key then
  // returned `assemblyFramePart.bottomHeight` — 47 — instead of falling
  // through to `casementSashPart.defaultFanlightBottomHeight` (83). The
  // same collision explains the rest of 94 / 47 / 58 / 2.
  //
  // With the short fallback gone, a short-keyed map resolves NOTHING and
  // every value lands in `missing` where it is visible, instead of being
  // quietly wrong. The board passes the raw default_profile_values rows.
  const v = profileValues[fieldKey]
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
export function firstOf(profileValues, candidates) {
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
  // Step AS: an ORDINARY casement sash takes casementSashPart.bottomHeight
  // (83) and a sash in a FANLIGHT position takes
  // casementSashPart.defaultFanlightBottomHeight, which Nathan set to 62 on
  // 12 Oct. Each falls back to the other, so nothing changes before
  // sql/step-as0 runs: until it adds the bottomHeight key, both resolve to
  // the old fanlight value (83), exactly as Step AR did.
  sashBottom:         ['casementSashPart.bottomHeight', 'casementSashPart.defaultFanlightBottomHeight',
                       'casementSashPart.defaultFanlightBtmRailHeight'],
  sashBottomFanlight: ['casementSashPart.defaultFanlightBottomHeight',
                       'casementSashPart.defaultFanlightBtmRailHeight',
                       'casementSashPart.bottomHeight'],
  // Step AR item 3: Integrate stores a clearance PER EDGE. Profile 2 has no
  // generic casementSashPart.mechanicalClearance key at all, so each edge is
  // read from its own, with the generic key kept as a fallback for a profile
  // that does have one.
  sashClearanceLeft:   ['casementSashPart.mechanicalClearanceLeft',   'casementSashPart.mechanicalClearance'],
  sashClearanceRight:  ['casementSashPart.mechanicalClearanceRight',  'casementSashPart.mechanicalClearance', 'casementSashPart.mechanicalClearanceLeft'],
  sashClearanceTop:    ['casementSashPart.mechanicalClearanceTop',    'casementSashPart.mechanicalClearance', 'casementSashPart.mechanicalClearanceLeft'],
  sashClearanceBottom: ['casementSashPart.mechanicalClearanceBottom', 'casementSashPart.mechanicalClearance', 'casementSashPart.mechanicalClearanceLeft'],
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

/**
 * The STORMPROOF sections, by the same candidate-list method.
 *
 * Step AU FIXES: these are the keys Integrate's import ALREADY created, read
 * live on 13 Oct. Every one is on the casementSashPart prefix and follows
 * Integrate's own `default<Variant><Thing>` convention — the same shape as
 * the box sash profile's sashPairPart.defaultCordFrameJamb /
 * defaultSpiralFrameHead that applyOperationDefaults reads:
 *
 *   casementSashPart.defaultStormProofFrameJamb          41
 *   casementSashPart.defaultStormProofFrameHead          41
 *   casementSashPart.defaultStormProofFrameDepth         69
 *   casementSashPart.defaultStormProofFrameJambType      'Solid Profiled'
 *   casementSashPart.defaultStormProofCillHeight         56
 *   casementSashPart.defaultStormProofCillDepth          69
 *   casementSashPart.defaultStormProofFrameHeadStopSize  15
 *   casementSashPart.defaultStormProofFrameStileStopSize 15
 *   casementSashPart.defaultStormProofCillStopSize       15
 *   casementSashPart.stormProofOverlap                    7
 *
 * My Step AU guesses (assemblyFramePart.stormProof*, cillPart.stormProof*)
 * are DROPPED rather than kept as fallbacks: nothing in the live database
 * uses them, and leaving them in would let a stray key resolve a section the
 * live profile does not actually hold — which is the failure mode this fix
 * exists to remove. A test asserts the board resolves nothing from them.
 *
 * TWO things Integrate has no key for:
 *  - the FRAME's bottomHeight. The flush build reads its own
 *    assemblyFramePart.bottomHeight (47 on the casement profile, which
 *    happens to equal cillPart.height). Stormproof has no equivalent, and
 *    Integrate's own drawings store frame bottomHeight 56 = the stormproof
 *    CILL HEIGHT on every one, so it is taken from there and a
 *    defaultStormProofFrameBottomHeight key is preferred if one ever
 *    appears. Reported in docs/reports/step-au-fixes.md.
 *  - the sash BOTTOM RAIL. Nathan's 76 is added by the reviewer's rewrite of
 *    sql/step-au1 section 2 as defaultStormProofBottomHeight, which was
 *    already first in this list.
 */
const STORMPROOF_CANDIDATES = {
  frameJambLeft:  ['casementSashPart.defaultStormProofFrameJamb'],
  // Integrate stores ONE jamb value for both sides
  frameJambRight: ['casementSashPart.defaultStormProofFrameJamb'],
  frameHead:      ['casementSashPart.defaultStormProofFrameHead'],
  // No stormproof frame-bottom key: Integrate's drawings have it equal to
  // the cill height (56) on every stormproof window.
  frameBottom:    ['casementSashPart.defaultStormProofFrameBottomHeight',
                   'casementSashPart.defaultStormProofCillHeight'],
  frameDepth:     ['casementSashPart.defaultStormProofFrameDepth'],
  headStop:       ['casementSashPart.defaultStormProofFrameHeadStopSize'],
  stileStop:      ['casementSashPart.defaultStormProofFrameStileStopSize'],
  cillStop:       ['casementSashPart.defaultStormProofCillStopSize'],
  cillHeight:     ['casementSashPart.defaultStormProofCillHeight'],
  cillDepth:      ['casementSashPart.defaultStormProofCillDepth'],
  sashBottom:     ['casementSashPart.defaultStormProofBottomHeight'],
  sashOverlap:    ['casementSashPart.stormProofOverlap'],
  // The LABEL Integrate stores ('Solid Profiled'); resolved to a jamb_type
  // code by the caller, which has the reference options.
  jambTypeRaw:    ['casementSashPart.defaultStormProofFrameJambType'],
}

/**
 * The jamb-type code for a stormproof frame.
 *
 * Integrate stores the LABEL, so it goes through the same
 * resolveJambTypeCode applyOperationDefaults uses for
 * sashPairPart.defaultCordFrameJambType. 'solid_profiled' is the FALLBACK
 * only — for a caller with no reference options, and for a profile with no
 * jamb-type key at all.
 */
export function stormproofJambType(profileValues, refOptions = {}) {
  const raw = profileValue(profileValues, 'casementSashPart.defaultStormProofFrameJambType')
  const options = refOptions?.jamb_type ?? []
  if (raw == null || raw === '') return 'solid_profiled'
  const code = resolveJambTypeCode(String(raw), options)
  // With no options to match, resolveJambTypeCode hands the raw label back.
  // A label is not a code, so fall back rather than store 'Solid Profiled'.
  if (!code || code === String(raw)) {
    return options.length === 0 ? 'solid_profiled' : code
  }
  return code
}

/**
 * Resolve the stormproof sections from the drawing's profile.
 *
 * @returns {{values, missing, keysUsed}} `missing` names what the profile
 *   does not hold, under the keys tried. Until sql/step-au1 has run,
 *   everything is missing and the board says so rather than converting a
 *   window to a frame of nulls.
 */
export function stormproofProfileDefaults(profileValues) {
  const values = {}
  const keysUsed = {}
  const missing = []
  for (const [name, candidates] of Object.entries(STORMPROOF_CANDIDATES)) {
    const { value, key } = firstOf(profileValues, candidates)
    values[name] = value
    if (key) keysUsed[name] = key
    // jambTypeRaw has a fallback ('solid_profiled'), so its absence must not
    // block a conversion the way a missing SIZE would.
    if (value == null && name !== 'jambTypeRaw') {
      missing.push(`${name} (tried ${candidates.join(', ')})`)
    }
  }
  return { values, missing, keysUsed }
}

/**
 * The stormproof sections if the profile holds them ALL, else null.
 *
 * All-or-nothing on purpose: half a set of sections would build a sash with
 * a null bottom rail, which prices as zero timber.
 */
export function stormproofSectionsFor(profileValues) {
  const resolved = stormproofProfileDefaults(profileValues)
  return resolved.missing.length === 0 ? resolved.values : null
}

/** Values a casement drawing cannot be built correctly without. */
const REQUIRED = [
  'frameJambLeft', 'frameHead', 'frameDepth', 'cillHeight', 'cillDepth',
  'sashThickness', 'sashHead', 'sashStileLeft', 'sashBottom', 'sashClearanceLeft',
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

export const OPENING_KINDS = ['opening_casement', 'fixed_casement', 'direct_glazed', 'french_casement']

// Step BB: a DOOR frame can also hold a single door leaf. It is not offered
// on a window — nothing else in GlazePro builds a door — so the choices are
// filtered per tree rather than listed everywhere and refused later.
export const DOOR_OPENING_KINDS = [...OPENING_KINDS, 'single_door']

/**
 * The frame a board action means: the frame itself, its key, or any node
 * inside it — and, given nothing, the FIRST frame, which is what every
 * one-frame drawing means by "the frame".
 */
export function resolveFrameArg(tree, frameOrKey = null) {
  if (!frameOrKey) return findFirst(tree, 'assemblyFramePart')
  const node = typeof frameOrKey === 'string'
    ? findByKey(tree, frameOrKey)
    : frameOrKey
  return frameOwning(tree, node) ?? findFirst(tree, 'assemblyFramePart')
}

/**
 * THE KEY OF THE FRAME A BOARD ACTION ACTS ON — the frame that owns the
 * selected node.
 *
 * Every handler on the board takes its frame from here, so there is one
 * answer to "which frame" rather than a dozen `findFirst` calls that each
 * said "the first one". A one-frame drawing always resolves to its only
 * frame, so nothing about it changes.
 */
export function actionFrameKey(tree, selectedKey = null) {
  return resolveFrameArg(tree, selectedKey)?.key ?? null
}

/** The opening kinds this drawing can offer. */
export function openingKindsFor(tree) {
  const frame = findFirst(tree, 'assemblyFramePart')
  const hasDoor = (frame?.children ?? []).some(
    c => c.part_type === SINGLE_DOOR_LEAF_PART || c.part_type === FRENCH_DOOR_PAIR_PART)
  return hasDoor ? DOOR_OPENING_KINDS : OPENING_KINDS
}

export const OPENING_KIND_LABELS = {
  opening_casement: 'Opening casement',
  fixed_casement:   'Fixed casement',
  direct_glazed:    'Direct glazed unit',
  single_door:      'Single door',
  french_casement:  'French casement',
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
  if (node.part_type === FRENCH_PAIR_PART) return 'french_casement'
  if (node.part_type === FRENCH_DOOR_PAIR_PART) return 'french_doors'
  if (node.part_type === SINGLE_DOOR_LEAF_PART) return 'single_door'
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
  // Step AS: a sash built IN A FANLIGHT POSITION starts with the fanlight
  // bottom rail (62 once sql/step-as0 has run) instead of the ordinary 83.
  // Integrate warns on any fanlight whose rail is over 62.
  isFanlight = false,
  // Step AU: a sash built into a STORMPROOF window is stormproof — its own
  // sash type, the 76 mm bottom rail on every sash INCLUDING a fanlight
  // (Nathan, 13 Oct), and the 7 mm overlap. `stormproof` is the resolved
  // stormproofProfileDefaults().values, or null for a flush sash.
  stormproof = null,
} = {}) {
  const d = (defaults ?? casementProfileDefaults(profileValues)).values
  const key = makeKey('cas')
  const clearL = d.sashClearanceLeft   ?? 0
  const clearR = d.sashClearanceRight  ?? clearL
  const clearT = d.sashClearanceTop    ?? clearL
  const clearB = d.sashClearanceBottom ?? clearL
  return {
    key,
    part_type: 'casementSashPart',
    values: {
      operation,
      casementTypeId: stormproof ? SASH_TYPE_STORMPROOF : sashType,
      // Step AQ item 3: `thickness` is the key the field definition, the
      // property panel, validation and Integrate all use.
      thickness:     d.sashThickness,
      topHeight:     d.sashHead,
      leftWidth:     d.sashStileLeft,
      rightWidth:    d.sashStileRight,
      // Step AU: a stormproof sash is 76 throughout — the flush fanlight
      // rule does not apply to it.
      bottomHeight: stormproof
        ? stormproof.sashBottom
        : (isFanlight ? (d.sashBottomFanlight ?? d.sashBottom) : d.sashBottom),
      ...(stormproof ? { stormProofOverlap: stormproof.sashOverlap } : {}),
      mechanicalClearanceLeft:   clearL,
      mechanicalClearanceRight:  clearR,
      mechanicalClearanceTop:    clearT,
      mechanicalClearanceBottom: clearB,
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
export function buildOpening(kind, profileValues, { glass = null, sashType = 'open_out', defaults = null, isFanlight = false, stormproof = null } = {}) {
  const d = defaults ?? casementProfileDefaults(profileValues)
  // A direct glazed unit is UNCHANGED by stormproof (clearance 20, rebate
  // 20, hidden 18 — Integrate's SF stores exactly the flush values).
  if (kind === 'direct_glazed') return buildDirectGlazedUnit(profileValues, { glass, defaults: d })
  return buildCasementSash(profileValues, {
    operation: kind === 'fixed_casement' ? 'fix' : DEFAULT_CASEMENT_OPERATION,
    glass,
    sashType,
    defaults: d,
    isFanlight,
    stormproof,
  })
}


// ── The French pair (Step AX) ────────────────────────────────────────────────

/**
 * The profile values a French pair needs, on top of the casement set.
 *
 * Integrate's live profile 2 already holds every one of these, so nothing is
 * hard-coded: the thickness (57, NOT a casement's 54), the "Overall Meeting
 * Stile" and the gap between the two meeting stiles. The clearances and the
 * sash sections fall back to the casement ones, which is what Integrate's
 * stored FR1 tree shows them to be (clearance 4, head 62, outer stile 62,
 * bottom rail 83).
 */
const FRENCH_CANDIDATES = {
  frenchThickness: ['frenchCasementPart.thickness'],
  frenchMidRail:   ['frenchCasementPart.midRail', 'frenchCasementPart.overallMeetingStile'],
  frenchGap:       ['frenchCasementPart.gapBetweenMeetingStiles'],
  frenchClearanceLeft:   ['frenchCasementPart.mechanicalClearanceLeft',   'frenchCasementPart.mechanicalClearance',
                          'casementSashPart.mechanicalClearanceLeft'],
  frenchClearanceRight:  ['frenchCasementPart.mechanicalClearanceRight',  'frenchCasementPart.mechanicalClearance',
                          'casementSashPart.mechanicalClearanceRight', 'casementSashPart.mechanicalClearanceLeft'],
  frenchClearanceTop:    ['frenchCasementPart.mechanicalClearanceTop',    'frenchCasementPart.mechanicalClearance',
                          'casementSashPart.mechanicalClearanceTop', 'casementSashPart.mechanicalClearanceLeft'],
  frenchClearanceBottom: ['frenchCasementPart.mechanicalClearanceBottom', 'frenchCasementPart.mechanicalClearance',
                          'casementSashPart.mechanicalClearanceBottom', 'casementSashPart.mechanicalClearanceLeft'],
}

/**
 * Resolve the French values, reporting any key the profile does not hold.
 * Every one is required: a pair with a guessed thickness or a guessed meeting
 * stile would price wrongly and look as if it had worked.
 */
export function frenchProfileDefaults(profileValues) {
  const values = {}
  const keysUsed = {}
  const missing = []
  for (const [name, candidates] of Object.entries(FRENCH_CANDIDATES)) {
    const { value, key } = firstOf(profileValues, candidates)
    values[name] = value
    if (key) keysUsed[name] = key
    if (value == null) missing.push(`${name} (tried ${candidates.join(', ')})`)
  }
  return { values, missing, keysUsed }
}

/** Which leaf carries the lock. Integrate's default is the RIGHT one. */
export const FRENCH_MASTER_LEAVES = ['right', 'left']
export const DEFAULT_FRENCH_MASTER_LEAF = 'right'

/**
 * The meeting stile each leaf carries, in mm.
 *
 * DERIVED, not read: Integrate's profile holds the "Overall Meeting Stile"
 * (midRail 130) and the gap between the two leaves (4), and stores the
 * resulting 63 on each sash — left rightWidth 63, right leftWidth 63. So the
 * profile is the source and 63 is the arithmetic, which is why this is a
 * function and not a candidate key.
 */
export function frenchMeetingStileMm(midRail, gap) {
  const m = Number(midRail)
  const g = Number(gap) || 0
  if (!isFinite(m) || m <= 0) return null
  return (m - g) / 2
}

/**
 * Build a French pair: ONE opening holding a left and a right sash, no
 * mullion. Each leaf has an OUTER stile (the casement stile) and a MEETING
 * stile on its inner edge, so its two stiles differ.
 *
 * A pair built into a STORMPROOF window is stormproof throughout — the
 * stormproof sash type, the 76 mm bottom rail and the 7 mm overlap — but it
 * keeps the French THICKNESS of 57 (Nathan, 13 Oct): the stormproof sections
 * are the rails, not the pair's own thickness.
 *
 * @returns {{node: Object|null, missing: string[]}}
 */
export function buildFrenchPair(profileValues, {
  glass = null,
  sashType = 'open_out',
  defaults = null,
  masterLeaf = DEFAULT_FRENCH_MASTER_LEAF,
  stormproof = null,
} = {}) {
  const casement = (defaults ?? casementProfileDefaults(profileValues))
  const french = frenchProfileDefaults(profileValues)
  if (french.missing.length > 0) return { node: null, missing: french.missing }

  const d = casement.values
  const f = french.values
  const meeting = frenchMeetingStileMm(f.frenchMidRail, f.frenchGap)
  if (meeting == null) {
    return { node: null, missing: ['frenchCasementPart.midRail (not a usable number)'] }
  }

  const key = makeKey('french')
  const outer = d.sashStileLeft ?? 0
  const sash = side => {
    const sashKey = `${key}_${side}`
    return {
      key: sashKey,
      part_type: side === 'left' ? 'leftFrenchCasementSashPart' : 'rightFrenchCasementSashPart',
      values: {
        // Integrate hangs the left leaf LH and the right leaf RH
        operation: side === 'left' ? 'left_hand_hung' : 'right_hand_hung',
        casementTypeId: stormproof ? SASH_TYPE_STORMPROOF : sashType,
        // The PAIR's thickness, which stays 57 even stormproof
        thickness:  f.frenchThickness,
        topHeight:  d.sashHead,
        leftWidth:  side === 'left' ? outer : meeting,
        rightWidth: side === 'left' ? meeting : outer,
        bottomHeight: stormproof ? stormproof.sashBottom : d.sashBottom,
        ...(stormproof ? { stormProofOverlap: stormproof.sashOverlap } : {}),
        isMasterLeaf: masterLeaf === side,
        toBeReplaced: true,
      },
      children: [{
        key: `${sashKey}_glass`,
        part_type: 'glassPart',
        values: {
          ...DEFAULT_GLASS,
          ...(glass ?? {}),
          glazingRebateWidth: d.sashRebate,
          glazingTolerance:   d.sashTolerance,
        },
        children: [],
      }],
    }
  }

  return {
    node: {
      key,
      part_type: 'frenchCasementPart',
      values: {
        casementTypeId: stormproof ? SASH_TYPE_STORMPROOF : sashType,
        thickness: f.frenchThickness,
        midRail:   f.frenchMidRail,
        gapBetweenMeetingStiles: f.frenchGap,
        // The clearances live on the PAIR, as Integrate stores them
        mechanicalClearanceLeft:   f.frenchClearanceLeft,
        mechanicalClearanceRight:  f.frenchClearanceRight,
        mechanicalClearanceTop:    f.frenchClearanceTop,
        mechanicalClearanceBottom: f.frenchClearanceBottom,
        ...(stormproof ? { stormProofOverlap: stormproof.sashOverlap } : {}),
        masterLeaf,
      },
      children: [sash('left'), sash('right')],
    },
    missing: [],
  }
}

/**
 * Set which leaf of a French pair carries the lock.
 *
 * @returns {{tree: Object, changed: boolean}}
 */
export function setFrenchMasterLeaf(tree, pairKey, masterLeaf) {
  if (!FRENCH_MASTER_LEAVES.includes(masterLeaf)) return { tree, changed: false }
  const pair = findNodeByKeyIn(tree, pairKey)
  // Step AZ: either kind of pair — a French casement or a French door.
  if (!isPairPart(pair)) return { tree, changed: false }
  if (pair.values?.masterLeaf === masterLeaf) return { tree, changed: false }
  return {
    tree: replaceNode(tree, pairKey, {
      ...pair,
      values: { ...pair.values, masterLeaf },
      children: (pair.children ?? []).map(c => (
        PAIR_LEAF_TYPES.includes(c.part_type)
          ? { ...c, values: { ...c.values, isMasterLeaf: masterLeaf === (isLeftLeaf(c) ? 'left' : 'right') } }
          : c
      )),
    }),
    changed: true,
  }
}


function findNodeByKeyIn(node, key) {
  if (!node) return null
  if (node.key === key) return node
  for (const c of (node.children ?? [])) { const f = findNodeByKeyIn(c, key); if (f) return f }
  return null
}

// ── Tree helpers ─────────────────────────────────────────────────────────────

// Step AX: OPENING_TYPES now comes from casementGeometry.js. There were two
// copies of this list and they drifted the moment a French pair became an
// opening — the board's copy still said two types while the geometry's said
// three, so the board could not see a pair at all.

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
  for (const child of (node.children ?? [])) findAll(child, partType, acc)
  return acc
}

/**
 * The frame's opening nodes in Integrate's matrix order — across the top row
 * first (A1, B1, …) then down (A2, B2, …), which is the order the frame
 * stores them in and the order frameOpenings returns their cells.
 */
// Step BC: an optional frame, as casementGeometry's helpers take. A
// one-frame drawing resolves to the only frame; on a container the caller
// passes the frame (or a node inside it) whose openings it means.
export function openingNodes(tree, frameOrNode = null) {
  const frame = frameOrNode
    ? frameOwning(tree, frameOrNode)
    : findFirst(tree, 'assemblyFramePart')
  return (frame?.children ?? []).filter(c => OPENING_TYPES.includes(c.part_type))
}

/** How many columns the frame is divided into (mullions + 1). */
export function columnCount(tree, frameOrNode = null) {
  const frame = frameOrNode
    ? frameOwning(tree, frameOrNode)
    : findFirst(tree, 'assemblyFramePart')
  return (frame?.children ?? []).filter(c => c.part_type === 'mullionPart').length + 1
}

/** How many rows the frame is divided into (transoms + 1). */
export function rowCount(tree, frameOrNode = null) {
  const frame = frameOrNode
    ? frameOwning(tree, frameOrNode)
    : findFirst(tree, 'assemblyFramePart')
  return (frame?.children ?? []).filter(c => c.part_type === 'transomPart').length + 1
}

/**
 * Integrate's matrix label for an opening: the COLUMN letter and the ROW
 * number — A1, B1 across the top row, then A2, B2 below it.
 *
 * Step AR: this used to return `${letter}1` for every opening, which was
 * right only while a casement frame had one row.
 */
export function matrixIndexOf(index, cols = 1) {
  const n = Math.max(1, cols)
  const col = index % n
  const row = Math.floor(index / n) + 1
  return matrixLabel(col, row - 1)
}

/** Integrate's label for a slot: column letter + row number, both 0-based in. */
export function matrixLabel(col, row) {
  return `${String.fromCharCode(65 + col)}${row + 1}`
}

/**
 * The matrix label of an OPENING, from the cell it occupies.
 *
 * Step AV: a spanning opening takes its TOP-LEFT slot, so the label cannot
 * come from the opening's position in the list any more — TC1's second
 * opening is A2, not B1, because the fanlight above it covers both of row 1.
 */
export function openingMatrixIndex(tree, node) {
  // Step BC: within the node's own frame, with the COLUMN LETTERS running
  // on across the frames of a container — CD1 reads A1 | B1 | C1 and CD4
  // A1 / A2 | B1 / B2 | C1 / C2, which is how Integrate labels them.
  const frame = frameOwning(tree, node)
  const frames = itemFrames(tree)
  const frameShift = frames.length > 1
    ? frames.slice(0, Math.max(0, frames.indexOf(frame)))
      .reduce((t, f) => t + columnCount(tree, f), 0)
    : 0
  const nodes = openingNodes(tree, frame)
  // Step AX: a French SASH is not an opening — the PAIR is. Integrate still
  // gives each leaf its own label, taking the pair's cell and the column
  // after it: FR1's leaves are A1 and B1 although there is no mullion, and
  // FR2's are A2 and B2 under the fanlight at A1.
  const idx = nodes.findIndex(n => n.key === node?.key ||
    (isPairPart(n) && (n.children ?? []).some(c => c.key === node?.key)))
  if (idx < 0) return null
  const cells = frameCells(tree, frame)
  const cell = cells[idx]
  if (!cell) return matrixIndexOf(idx + frameShift, columnCount(tree, frame))
  const isRightLeaf = PAIR_LEAF_TYPES.includes(node?.part_type) && !isLeftLeaf(node)
  // Step BB: A PAIR TAKES TWO COLUMN LETTERS, so every column to its right
  // moves on one. Integrate labels FD5's pair B2 / C2 and the column after
  // it D2 — in EVERY row, not just the pair's own: its top row reads
  // A1, B1, D1. Step BA gave that column C, which collided with the right
  // leaf's own label.
  //
  // The shift is per COLUMN (a pair's two letters belong to the whole
  // column), so it counts the columns left of this one that hold a pair.
  const pairColumns = new Set(
    nodes.map((n, i) => (isPairPart(n) ? cells[i]?.col : null))
      .filter(c => c != null))
  const shift = [...pairColumns].filter(c => c < cell.col).length
  return matrixLabel(cell.col + frameShift + shift + (isRightLeaf ? 1 : 0), cell.row)
}

/**
 * What Integrate calls an opening in the parts list: a casement sash in the
 * TOP row of a frame that has more than one row is a "Fanlight".
 */
export function openingTypeLabel(tree, node) {
  if (node?.part_type === 'glassPart') {
    // Step AS: only a glassPart that is a DIRECT CHILD OF THE FRAME is a
    // direct glazed unit. This used to say "Direct Glazed Unit" for ANY
    // glassPart, which mislabelled a box sash's own glass as soon as a
    // caller stopped guarding with isDirectGlazedUnit for itself.
    const frame = findFirst(tree, 'assemblyFramePart')
    const isUnit = !!frame && (frame.children ?? []).some(c => c.key === node.key)
    return isUnit ? 'Direct Glazed Unit' : null
  }
  if (node?.part_type === FRENCH_PAIR_PART) return 'French Casement'
  if (FRENCH_SASH_TYPES.includes(node?.part_type)) return 'French Casement Sash'
  if (node?.part_type === FRENCH_DOOR_PAIR_PART) return 'French Door'
  // Step BB: a SINGLE door leaf is an opening of its own — a plain
  // doorLeafPart in the frame, with no pair part.
  if (node?.part_type === SINGLE_DOOR_LEAF_PART) return 'Single Door'
  if (node?.part_type === 'leftFrenchDoorLeafPart') return 'French Door Leaf Left'
  if (node?.part_type === 'rightFrenchDoorLeafPart') return 'French Door Leaf Right'
  if (node?.part_type !== 'casementSashPart') return null
  // Step BC: within ITS OWN frame. A flag frame's top-hung sash is a
  // fanlight of that frame (300 min), and the fixed light below it a side
  // light (780) — judged by its own frame's rows, not the first frame's.
  const frame = frameOwning(tree, node)
  const nodes = openingNodes(tree, frame)
  const idx = nodes.findIndex(n => n.key === node.key)
  if (idx < 0) return 'Casement Sash'
  // Step AV: from the CELL, so a spanning opening is judged by where it
  // starts. TC1's wide fanlight is in row 0 and IS a fanlight; TC3's
  // full-height opener also starts in row 0 but spans both rows, so it is
  // NOT a fanlight — a fanlight is a light over something, and this one is
  // the whole column.
  const cell = frameCells(tree, frame)[idx]
  if (!cell) {
    const isTopRow = idx < columnCount(tree, frame)
    return (isTopRow && rowCount(tree, frame) > 1) ? 'Fanlight' : 'Casement Sash'
  }
  const isTopRow = cell.row === 0
  const spansAllRows = cell.rowSpan >= rowCount(tree, frame)
  return (isTopRow && rowCount(tree, frame) > 1 && !spansAllRows) ? 'Fanlight' : 'Casement Sash'
}

/** "Fanlight A1", "Casement Sash A2", "Direct Glazed Unit B1". */
export function openingLabel(tree, node) {
  const type = openingTypeLabel(tree, node)
  if (!type) return null
  // Step BC: the index comes from openingMatrixIndex, which knows which FRAME
  // the node is in. This used to look the node up in the first frame's
  // openings and return the bare type when it was not there — so on a
  // container every opening outside the first frame lost its label.
  const matrix = openingMatrixIndex(tree, node)
  if (matrix) return `${type} ${matrix}`
  const frame = frameOwning(tree, node)
  const idx = openingNodes(tree, frame).findIndex(n => n.key === node?.key)
  if (idx < 0) return type
  return `${type} ${matrixIndexOf(idx, columnCount(tree, frame))}`
}

// ── Stormproof (Step AU) ─────────────────────────────────────────────────────
// The predicates live here, not in stormproof.js, because changeOpening and
// applyFanlightBottomRails below need them and stormproof.js imports THIS
// module. stormproof.js re-exports them, so there is one definition.

/** The live `sash_type` option codes (reference_options category sash_type). */
export const SASH_TYPE_STORMPROOF = 'stormproof'
export const SASH_TYPE_FLUSH      = 'open_out'

/** Is THIS casement sash stormproof? Its stored sash type says so. */
export function isStormproofSash(sashNode) {
  // Step AX: a French leaf is a casement sash here too, so a window whose
  // only openers are a French pair reads as stormproof and rule 43's quote
  // note fires per leaf.
  if (!CASEMENT_SASH_TYPES.includes(sashNode?.part_type)) return false
  return String(sashNode.values?.casementTypeId ?? '') === SASH_TYPE_STORMPROOF
}

/**
 * Is this WINDOW stormproof? At least one stormproof casement sash.
 *
 * "At least one" rather than "all": a stormproof window is stormproof
 * throughout (Nathan, 13 Oct), so one stormproof sash means the window is —
 * and reading it this way means a tree that somehow held a mix would still
 * count as stormproof rather than quietly counting as flush.
 */
export function isStormproofWindow(tree) {
  return CASEMENT_SASH_TYPES.flatMap(t => findAll(tree, t)).some(isStormproofSash)
}

/** Is this a casement/direct-glazed frame (as opposed to a box sash one)? */
export function isCasementFrameTree(tree) {
  // Step BC board: ANY frame of the item. On a coupled set this read the
  // first frame alone, so a set whose first frame happened to hold nothing
  // but the door would have been treated as a box sash — and the parts
  // list, the elevation and the divider picker all key off it.
  const frames = itemFrames(tree)
  if (frames.length === 0) return false
  if (frames.some(f => (f.children ?? []).some(c => c.part_type === 'sashPairPart'))) {
    return false
  }
  return frames.some(f => (f.children ?? []).some(
    c => OPENING_TYPES.includes(c.part_type)))
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
  // Step BC board: the frame that HOLDS this opening. Looking in the first
  // frame returned "unchanged" for every opening of every other frame, so
  // the Change-to buttons did nothing at all on a coupled set.
  const frame = frameOwning(tree, findByKey(tree, openingKey)) ??
    findFirst(tree, 'assemblyFramePart')
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
  // Step AX: a PAIR keeps its glass codes on each leaf, so a pair being
  // changed to something else carries the LEFT leaf's codes over.
  const glassSource = current.part_type === 'casementSashPart'
    ? (current.children ?? []).find(c => c.part_type === 'glassPart')
    : isPairPart(current)
      ? (current.children?.[0]?.children ?? []).find(c => c.part_type === 'glassPart')
      : current
  // Step AS: building INTO a fanlight position (the top row of a frame with
  // more than one row) starts the sash at the fanlight bottom rail.
  // Step AX: from the CELL, like openingTypeLabel and
  // applyFanlightBottomRails since Step AV. The index test left here would
  // call TC1's A2 a fanlight and TC3's full-height opener one.
  // Step BC board 3: in THIS frame. Asking the first frame meant an
  // opening built into the top row of frame B or C did not start at the
  // fanlight bottom rail.
  const openingIdx = openingNodes(tree, frame).findIndex(n => n.key === openingKey)
  const cell = openingIdx >= 0 ? frameCells(tree, frame)[openingIdx] : null
  const rows = rowCount(tree, frame)
  const intoFanlight = rows > 1 && cell != null &&
    cell.row === 0 && cell.rowSpan < rows
  // Step AU: any opening added to a STORMPROOF window is stormproof — the
  // window is stormproof throughout, so a direct glazed unit changed into a
  // casement must come out stormproof, not flush.
  const stormproofSections = isStormproofWindow(tree)
    ? stormproofSectionsFor(profileValues)
    : null
  // Step AX: a FRENCH pair fills the opening — two leaves, no mullion. It
  // reports the profile keys it could not resolve rather than building a
  // pair with a guessed thickness or meeting stile.
  if (kind === 'french_casement') {
    const { node, missing } = buildFrenchPair(profileValues, {
      glass: glassCodesOf(glassSource),
      sashType: current.values?.casementTypeId ?? 'open_out',
      stormproof: stormproofSections,
    })
    if (!node) return { tree, changed: false, missing }
    const next = [...frame.children]
    next[idx] = node
    return {
      tree: replaceNode(tree, frame.key, { ...frame, children: next }),
      changed: true,
    }
  }

  const replacement = buildOpening(kind, profileValues, {
    glass: glassCodesOf(glassSource),
    sashType: current.values?.casementTypeId ?? 'open_out',
    isFanlight: intoFanlight,
    stormproof: stormproofSections,
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
  const sash = findByKey(tree, sashKey)
  // Step AZ: the operation buttons work on a casement sash AND on a leaf
  // of either pair — a French casement sash or a French door leaf. Integrate
  // offers Fix / Right Hand Hung on a door leaf's own panel.
  //
  // Step BC board 3: and on a SINGLE door leaf, which was in neither list —
  // so on a single garden door every one of the five buttons the bar drew
  // did nothing at all. What each part may be set to is operationsFor, the
  // one list the bar now draws, so a door can only ever take a hand and a
  // casement keeps Integrate’s five.
  const allowed = operationsFor(sash)
  if (!allowed.includes(operation)) return { tree, changed: false }
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
  // Step AQ item 6/8: Product and Quantity are both is_required, and a
  // drawing started from a casement template opened with two "Required
  // fields empty" errors because neither was set. Quantity is always 1 here;
  // the product CODE lives only in the live reference_options table (the
  // `product` list came from Integrate), so the caller supplies it and
  // sql/step-aq2 sets it on the stored templates by looking the label up.
  product = null,
  quantity = 1,
  // Step AU: build the whole window STORMPROOF — the frame and cill take the
  // stormproof sections and every casement sash is a stormproof sash. This
  // is what the "Single Stormproof Casement" template is generated with.
  stormproof = false,
  // Step AU fixes: the reference options, so a stormproof frame's jamb type
  // resolves from the LABEL Integrate stores ('Solid Profiled') the same way
  // applyOperationDefaults resolves a box sash's. Without them the fallback
  // 'solid_profiled' applies, which is what Integrate's own value means.
  refOptions = {},
} = {}) {
  const resolved = casementProfileDefaults(profileValues)
  const flush = resolved.values
  const storm = stormproof ? stormproofSectionsFor(profileValues) : null
  // A stormproof build with an incomplete profile must not fall back to
  // flush sections and look like it worked.
  if (stormproof && !storm) {
    return {
      tree: null,
      missing: stormproofProfileDefaults(profileValues).missing,
    }
  }
  // Frame and cill sections come from whichever set is in force; the sash
  // sizes, clearances, rebates and the mullion are the same either way.
  const d = storm
    ? {
      ...flush,
      frameJambLeft: storm.frameJambLeft,
      frameJambRight: storm.frameJambRight ?? storm.frameJambLeft,
      frameHead: storm.frameHead,
      frameBottom: storm.frameBottom,
      frameDepth: storm.frameDepth,
      headStop: storm.headStop,
      stileStop: storm.stileStop,
      cillStop: storm.cillStop,
      cillHeight: storm.cillHeight,
      cillDepth: storm.cillDepth,
      jambType: stormproofJambType(profileValues, refOptions),
    }
    : flush

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
      quantity,
      ...(product != null ? { product } : {}),
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
          ...openings.map(kind => buildOpening(kind, profileValues, {
            sashType, defaults: resolved, stormproof: storm,
          })),
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

// ── Resizing a casement frame (Step AR item 2) ───────────────────────────────

/**
 * Re-space a casement frame's dividers after its SIZE changes, as Integrate
 * does (docs/integrate-L31115-fanlights.txt, read 12 Oct 2026).
 *
 *  - WIDTH: mullions re-space, keeping the columns' existing proportions.
 *    Integrate's own reading: benchmark N (1199 wide, openings 549 / 549)
 *    widened to 1599 gave 749 / 749 — equal stays equal, and a surveyor who
 *    set an uneven split keeps that split's proportions.
 *  - HEIGHT: transoms DO NOT move, so the fanlight row keeps its height and
 *    the whole change goes to the bottom row. Integrate's reading: drawing 23
 *    taken from 980 to 1499 kept the top opening at 356 while the lower one
 *    went 503 → 1022. A transom's offset IS the height above it, so keeping
 *    the offset is exactly that behaviour.
 *
 * This replaces Step AP's "a resize leaves mullions where they are". A
 * hand-typed offset therefore survives until the next resize, and then its
 * proportion survives.
 *
 * @param {Object} tree
 * @param {{width?: number, height?: number}} size  the NEW frame size
 * @returns {{tree: Object, changed: string[]}}  the keys that moved
 */
/**
 * Step BC board: WHICH frame. A coupled set has several, and this resized
 * the first one whatever frame the surveyor had selected — the reviewer
 * typed 720 on frame C and frame A became 720, while the panel went on
 * showing C's own unchanged 650.
 *
 * `frameOrKey` is the frame, its key, or any node inside it. Omitted, it is
 * the first frame — which is what a one-frame drawing has always meant.
 */
export function resizeCasementFrame(tree, { width = null, height = null } = {}, frameOrKey = null) {
  const frame = resolveFrameArg(tree, frameOrKey)
  if (!frame) return { tree, changed: [] }
  const fv = frame.values ?? {}

  const oldWidth = Number(fv.width)
  const newWidth = width == null ? oldWidth : Number(width)
  const newHeight = height == null ? Number(fv.height) : Number(height)

  const mullions = (frame.children ?? []).filter(c => c.part_type === 'mullionPart')
    .sort((a, b) => (Number(a.values?.offset) || 0) - (Number(b.values?.offset) || 0))

  // The frame always takes the new size; only the MULLIONS re-space, and
  // only when the width actually changed and there is a proportion to keep.
  const nextValues = { ...fv, width: newWidth, height: newHeight }
  const changed = []
  let nextChildren = frame.children ?? []

  if (mullions.length > 0 && isFinite(oldWidth) && isFinite(newWidth) && oldWidth !== newWidth) {
    const jambs = (Number(fv.leftWidth) || 0) + (Number(fv.rightWidth) || 0)
    const oldInterior = oldWidth - jambs
    const newInterior = newWidth - jambs
    const totalT = mullions.reduce((s, m) => s + (Number(m.values?.thicknessInFrame) || 0), 0)
    const oldOpenings = oldInterior - totalT
    const newOpenings = newInterior - totalT
    if (oldOpenings > 0 && newOpenings > 0) {
      // Each column's share of the opening width, kept exactly
      const widths = []
      let left = 0
      for (const m of mullions) {
        const face = Number(m.values?.offset) || 0
        widths.push(face - left)
        left = face + (Number(m.values?.thicknessInFrame) || 0)
      }
      widths.push(oldInterior - left)

      const moved = new Map()
      let acc = 0
      for (let i = 0; i < mullions.length; i++) {
        acc += widths[i] / oldOpenings * newOpenings
        const face = acc + mullions.slice(0, i).reduce(
          (s, m) => s + (Number(m.values?.thicknessInFrame) || 0), 0)
        // Stored to 1 dp, as Integrate stores offsets (Step AH 3b)
        moved.set(mullions[i].key, Math.round(face * 10) / 10)
      }
      nextChildren = nextChildren.map(c => {
        if (!moved.has(c.key)) return c
        const offset = moved.get(c.key)
        if (offset === c.values?.offset) return c
        changed.push(c.key)
        return { ...c, values: { ...c.values, offset } }
      })
    }
  }

  return {
    tree: replaceNode(tree, frame.key, { ...frame, values: nextValues, children: nextChildren }),
    changed,
  }
}

/**
 * Give every casement sash the bottom rail its POSITION calls for: the
 * fanlight default in the top row of a multi-row frame, the ordinary default
 * anywhere else (Step AS item 3, Nathan 12 Oct).
 *
 * Run after the transom/mullion picker, because the picker MOVES sashes
 * between positions rather than building new ones: adding a top row makes
 * the frame's existing sash a fanlight, and removing the transom makes the
 * old fanlight an ordinary sash again.
 *
 * A rail the SURVEYOR typed is never touched. Only a rail still sitting on
 * exactly one of the two profile defaults is changed, so a hand-set value
 * survives every later picker use.
 *
 * @returns {{tree: Object, changed: string[]}} the sash keys that moved
 */
export function applyFanlightBottomRails(tree, profileValues) {
  // Step AU: a STORMPROOF window uses 76 on every sash, fanlights included
  // (Nathan, 13 Oct), so the flush 62 fanlight default does not apply to it.
  // Integrate's "reduce to 62mm" warning then fires on a stormproof
  // fanlight, on its drawings and on ours, and that is correct.
  if (isStormproofWindow(tree)) return { tree, changed: [] }
  const d = casementProfileDefaults(profileValues).values
  const ordinary = d.sashBottom
  const fanlight = d.sashBottomFanlight ?? ordinary
  // Nothing to do when the profile gives both positions the same rail —
  // which is the case until sql/step-as0 adds casementSashPart.bottomHeight.
  if (ordinary == null || fanlight == null || ordinary === fanlight) {
    return { tree, changed: [] }
  }

  // Step BC board 3: EVERY FRAME, each judged against its own rows. This
  // read the first frame alone, and it runs after every split and every
  // picker pick — so a fanlight made in frame B or C kept the ordinary
  // casement rail instead of Nathan's 62.
  const nodes = itemFrames(tree).flatMap(f => openingNodes(tree, f))
  // Step AV: which sashes are fanlights comes from the CELLS, not from the
  // first few places in the list. Where an opening SPANS, the two differ:
  // TC1's list is [A1 spanning, A2, B2] and TC3's is [A1 full height, B1,
  // B2], so an index test made A2 a fanlight on TC1 and the full-height
  // opener one on TC3. A fanlight is a top-row opening that does NOT run the
  // full height — the same test openingTypeLabel uses.
  // The cells and the row count of the frame each opening is in.
  const cellOf = node => {
    const frame = frameOwning(tree, node)
    const idx = openingNodes(tree, frame).findIndex(n => n.key === node.key)
    return { cell: idx >= 0 ? frameCells(tree, frame)[idx] : null, rows: rowCount(tree, frame) }
  }
  const changed = []
  let next = tree

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.part_type !== 'casementSashPart') continue
    const { cell, rows } = cellOf(node)
    const wantFanlight = rows > 1 && cell != null && cell.row === 0 && cell.rowSpan < rows
    const want = wantFanlight ? fanlight : ordinary
    const has = Number(node.values?.bottomHeight)
    if (has === want) continue
    // Only a value still on the OTHER default is ours to change
    const other = wantFanlight ? ordinary : fanlight
    if (has !== other) continue
    changed.push(node.key)
    next = replaceNode(next, node.key, {
      ...node, values: { ...node.values, bottomHeight: want },
    })
  }
  return { tree: next, changed }
}

// ── Step BC board 2: the opening a panel is about ────────────────────────────

/**
 * The OPENING a node is, or belongs to, within its own frame.
 *
 * Three panels resolved this themselves against `openingNodes(tree)` — the
 * first frame's openings — so on a coupled set they went blank for everything
 * outside frame A: the "change to:" and operation bar (selecting Fanlight B1
 * showed nothing at all), the split-one-opening target for the divider
 * picker, and Divider Spacing.
 *
 * A French pair's leaf and a casement sash's glass both resolve to the
 * opening that holds them, which is what the panels mean by "the opening".
 */
export function openingOf(tree, node) {
  if (!node) return null
  const frame = frameOwning(tree, node)
  if (!frame) return null
  const openings = openingNodes(tree, frame)
  return openings.find(n => n.key === node.key)
    ?? openings.find(n => (n.children ?? []).some(c => c.key === node.key))
    ?? openings.find(n => isPairPart(n) &&
      (n.children ?? []).some(leaf => (leaf.children ?? []).some(c => c.key === node.key)))
    ?? null
}

/**
 * What Integrate's "Divider Spacing" can do on this node's opening: make the
 * WIDTHS equal (needs a mullion) or the HEIGHTS (needs a transom) — counted
 * in the opening's OWN frame.
 *
 * It counted `findAll(tree, 'mullionPart')` over the whole drawing, so on a
 * coupled set one frame's mullion offered the buttons on every frame, and
 * pressing them re-spaced dividers the surveyor was not looking at.
 *
 * @returns {{canWidths: boolean, canHeights: boolean}|null} null when the node
 *          is not in an opening at all.
 */
export function dividerSpacingFor(tree, node) {
  const opening = openingOf(tree, node)
  if (!opening) return null
  const frame = frameOwning(tree, opening)
  const own = type => (frame?.children ?? []).filter(c => c.part_type === type).length
  return {
    canWidths:  own('mullionPart') > 0,
    canHeights: own('transomPart') > 0,
  }
}

/**
 * The operations a part can be set to, for the board's operation buttons.
 *
 * Step BC board 3: a SINGLE DOOR leaf was offered the casement five — fix,
 * top hung, bottom hung, left and right hand hung. A door leaf has a HAND,
 * not a casement operation: Integrate offers Left Hand Hung (17), Right Hand
 * Hung (18) and Fix (11) on one, and "top hung" on a door is meaningless.
 *
 * A fixed door leaf is a real thing — a leaf that does not open, which is how
 * FD5's and FD6's doorsets are made — so Fix stays. What goes is top hung and
 * bottom hung, which only a casement sash can be.
 *
 * A FRENCH CASEMENT leaf keeps the casement five: it is a casement sash, and
 * this step is about doors.
 */
export const DOOR_OPERATIONS = ['fix', 'left_hand_hung', 'right_hand_hung']

export function operationsFor(node) {
  const pt = node?.part_type
  if (!pt) return []
  if (DOOR_LEAF_LIKE.includes(pt)) return DOOR_OPERATIONS
  if (pt === 'casementSashPart' || PAIR_LEAF_TYPES.includes(pt)) return CASEMENT_OPERATIONS
  return []
}
