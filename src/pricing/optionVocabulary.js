/**
 * optionVocabulary.js
 * THE mapping from the option codes a saved drawing really stores to the
 * flags and quantities the pricing engine and validation work with.
 *
 * The drawing board's stored codes are the truth: option codes are permanent,
 * labels are editable. Every comparison against a tree value's CODE belongs
 * here, used by pricing and validation alike — never inline in a consumer.
 *
 * Real code sets and their sources are documented field by field in
 * docs/pricing-vocabulary-audit.md. Codes marked "inferred" there are mapped
 * on best evidence; a live code outside the mapped set is never a silent
 * false — collectVocabularyWarnings() turns it into a run warning naming the
 * field and the code.
 */

// ── Timber ────────────────────────────────────────────────────────────────────
// timber_species codes → engine family. 'softwood' is Integrate's "Solid
// Redwood" (docs/step-k-fixes-brief.md §3); 'utile' is "Solid Utile Hardwood"
// (docs/step-h3-fixes-brief.md). The full species list mirrors the PF30
// price-file variables (softwood/utile/accoya/oak/idigbo/douglas_fir/meranti).
export const TIMBER_FAMILIES = {
  softwood:    'redwood',
  accoya:      'accoya',
  utile:       'utile_hardwood',
  oak:         'oak',
  idigbo:      'idigbo',
  douglas_fir: 'douglas_fir',
  meranti:     'meranti',
}

/**
 * @returns {'redwood'|'accoya'|'utile_hardwood'|'oak'|'idigbo'|'douglas_fir'|'meranti'|null|undefined}
 *          null for empty/unset; undefined for an unrecognised code.
 */
export function timberFamily(code) {
  if (code == null || code === '') return null
  return TIMBER_FAMILIES[code]
}

// Timber density (kg/m³) by family — figures from the Integrate Weight Calc
// page (sashWeight.js). Families with no Integrate figure are deliberately
// absent: computeSashWeight falls back to the softwood density and
// collectVocabularyWarnings() reports it rather than inventing a constant.
export const TIMBER_FAMILY_DENSITIES = {
  redwood:        508.3,
  accoya:         508.3,
  utile_hardwood: 780.1,
  idigbo:         780.1,
}

// ── Glazing ───────────────────────────────────────────────────────────────────
// glazing_type codes → engine glazing kind. 'double_glazing' is in the real
// tree; 'single_glazing' was seeded by 20260924_step_b1b_fixes.sql.
// 'triple_glazing' / 'heritage_glazing' follow the same naming and are
// inferred (audit) — an unexpected live code warns instead of pricing wrong.
export const GLAZING_TYPES = {
  single_glazing:   'single',
  double_glazing:   'double',
  triple_glazing:   'triple',
  heritage_glazing: 'heritage',
}

/**
 * @returns {'single'|'double'|'triple'|'heritage'|null|undefined}
 *          null for empty/unset; undefined for an unrecognised code.
 */
export function glazingType(code) {
  if (code == null || code === '') return null
  return GLAZING_TYPES[code]
}

// ── Horns ─────────────────────────────────────────────────────────────────────
// horn_type option codes are 'no_horn', 'victorian', 'custom'
// (sql/step-j1-parts.sql), but saved trees also hold 'none' (the real
// L507712 tree). Both 'none' and 'no_horn' mean no horn — recorded in the
// audit as a two-codes-one-meaning case; the "No Horn" label leaves no
// ambiguity, so both map to 'none'.
export const HORN_KINDS = {
  none:      'none',
  no_horn:   'none',
  victorian: 'victorian',
  custom:    'custom',
}

/** @returns {'none'|'victorian'|'custom'|null|undefined} */
export function hornKind(code) {
  if (code == null || code === '') return null
  return HORN_KINDS[String(code).toLowerCase()]
}

// Horn length by type, in mm — step-y brief §1: in Integrate the length
// follows the type. Both Integrate drawings with "Victorian Style Horn"
// store 75 (L34046 Item 7 and L31115 Item 1 Dwg 4), "No horn" stores 0,
// and "Custom Horn" requires a typed length. This lives HERE rather than
// on the horn_type reference data because reference_options.attributes
// could hold it but (a) writing it needs SQL, which these sessions never
// run, and (b) nothing loads option attributes into the pricing context —
// the named mapping is the structure the code currently supports.
export const HORN_TYPE_DEFAULT_LENGTH_MM = {
  victorian: 75,
  none:      0,
}

/**
 * The horn length for pricing: the STORED length when the drawing has one,
 * else the length that belongs to the horn type. A custom horn with no
 * stored length is an ERROR, not 0. An unknown horn type contributes 0 —
 * collectVocabularyWarnings() already reports the code.
 */
export function hornLengthMm(code, storedLength) {
  if (storedLength != null && storedLength !== '') {
    const n = Number(storedLength)
    if (isFinite(n)) return n
  }
  const kind = hornKind(code)
  if (kind === 'custom') {
    throw new Error('Custom horn with no horn length set on the drawing — enter the horn length')
  }
  return HORN_TYPE_DEFAULT_LENGTH_MM[kind] ?? 0
}

// ── Sash operation ────────────────────────────────────────────────────────────
// sash_operation has three live options (sql/step-b2c-applies-to.sql):
// "Cord Hung", a spiral option and a fix option. Real code seen: 'cord_hung'.
/** @returns {'cord'|'chain'|'spiral'|'fix'|null|undefined} */
export function operationKind(code) {
  if (code == null || code === '') return null
  const s = String(code).toLowerCase()
  if (s.includes('cord'))   return 'cord'
  if (s.includes('chain'))  return 'chain'
  if (s.includes('spiral')) return 'spiral'
  if (s.includes('fix'))    return 'fix'
  return undefined
}

// ── Casement operations and types (Step AO) ──────────────────────────────────
// Integrate's casement operationIds are 11 Fix, 15 Top Hung, 16 Bottom Hung,
// 17 Left Hand Hung, 18 Right Hand Hung, and typeId 7 is "Open Out / Flush
// with Stops Internally" (docs/integrate-L31115-direct-glazed.txt). The live
// reference codes for these are not in the repo — only the three
// sliding-sash labels are (docs/pricing-vocabulary-audit.md) — so these
// helpers test by substring, the same way operationKind() does, and so are
// insensitive to the exact spelling the board ends up storing.

/** Is this casement sash FIXED? (Integrate operationId 11.) */
export function casementIsFixed(sashNode) {
  const code = String(sashNode?.values?.operation ?? '').toLowerCase()
  return code.includes('fix')
}

/**
 * Does it open OUT? Integrate's casement typeId 7 is an open-out type; a
 * type code that says neither out nor in counts as open-out, because every
 * casement Integrate priced on these benchmarks is an open-out flush unit
 * and that is the only type GlazePro sells today. An explicit "in" code
 * (open-in) is honoured.
 */
export function casementOpensOut(sashNode) {
  return !casementOpensIn(sashNode)
}

/** Does it open IN? Only an explicit open-in type code says so. */
export function casementOpensIn(sashNode) {
  const t = String(sashNode?.values?.casementTypeId ?? '').toLowerCase()
  return t.includes('_in') || t.includes('open_in') || t.includes('opening_in')
}

// ── Spacers ───────────────────────────────────────────────────────────────────
// glazing_spacer_dimension codes are 'spacer_<mm>' (real tree: 'spacer_16';
// heritage variants 'spacer_4'/'spacer_6' seeded by step-b1b). Saved drawings
// do NOT store a spacerHeight number.
/** @returns {number|null|undefined} mm; null for empty; undefined if unparseable. */
export function spacerDimensionMm(spacerDimId) {
  if (spacerDimId == null || spacerDimId === '') return null
  const m = /^spacer_(\d+)$/.exec(String(spacerDimId))
  return m ? Number(m[1]) : undefined
}

/**
 * Spacer thickness in mm for a glassPart's values: the spacerDimId code is
 * the stored truth; a numeric spacerHeight only ever existed in hand-typed
 * fixtures and is kept as a last-resort fallback for unmigrated trees.
 */
export function glassSpacerMm(glassValues = {}, profileSpacerValue = null) {
  const fromCode = spacerDimensionMm(glassValues.spacerDimId)
  if (typeof fromCode === 'number') return fromCode
  if (glassValues.spacerHeight != null) return Number(glassValues.spacerHeight) || 0
  // Step BL item 1: the DRAWING'S PROFILE, when the glass part stores no
  // spacer of its own. A sliding sash's glass carries `spacer_16` because
  // buildNewBoxSash resolves every reference field from the profile; a
  // CASEMENT or DOOR glass part is built from a fixed DEFAULT_GLASS that has
  // never carried one, so its unit thickness came out 4 + 0 + 4 = 8 and the
  // three glazing-bar glass rules — all gated on `glass_unit_thickness >= 24`
  // — could not fire on any casement sash, fanlight or door leaf.
  //
  // The same fallback the rebate and the tolerance already use, and for the
  // same reason: the profile is the single statement of what the glass is,
  // and duplicating it onto every glass part would be a second source of
  // truth. Profile values arrive as LABELS ('16mm'), not codes, so both
  // forms are read.
  const fromProfile = spacerMmFromAnyForm(profileSpacerValue)
  if (typeof fromProfile === 'number') return fromProfile
  return 0
}

/**
 * A spacer dimension in mm from any form it is stored or configured in: the
 * option CODE ('spacer_16'), the profile LABEL ('16mm') or a bare number.
 * Returns undefined for anything else, so an unrecognised value is never
 * silently read as a size.
 */
export function spacerMmFromAnyForm(value) {
  if (value == null || value === '') return undefined
  if (typeof value === 'number') return isFinite(value) ? value : undefined
  const s = String(value).trim()
  const code = spacerDimensionMm(s)
  if (typeof code === 'number') return code
  const label = /^(\d+(?:\.\d+)?)\s*mm$/i.exec(s)
  if (label) return Number(label[1])
  if (/^\d+(?:\.\d+)?$/.test(s)) return Number(s)
  return undefined
}

// glazing_spacer_colour codes: 'white_warm_edge' etc. The warm-edge flag
// reads the COLOUR code — the dimension code never contains 'warm_edge'.
export function isWarmEdgeSpacerColour(spacerColourId) {
  return String(spacerColourId ?? '').toLowerCase().includes('warm_edge')
}

// ── Panels (Step BA) ──────────────────────────────────────────────────────────
//
// A panelled door leaf stores a panel TYPE and a panel BEAD, each side.
// Integrate stores them as numeric ids and GlazePro as codes, so both are
// mapped here: a tree imported from Integrate must price exactly as one the
// board drew. The ids are Integrate's own defaults, from
// docs/integrate-drawingboard-schema.txt (internalPanelTypeId default 110,
// internalPanelBeadId default 120) and confirmed on FD4's real panels.
//
// NOT VERIFIED: that the live `reference_options` hold the two categories
// under these codes — SECTION 0 of sql/step-ba2 asks for the rows. A code
// outside this set is never a silent false; collectVocabularyWarnings names
// it, as it does every other option.
//
// STEP BF, 14 Oct 2026 — THE IDS, READ IN INTEGRATE’S OWN DIALOG:
//
//     110 = FLAT   112 = RAISED & FIELDED   114 = VERTICAL T&G
//                                           116 = HORIZONTAL T&G
//
// 110 was mapped to raised_and_fielded. The id came from the French-door
// facts of Step BA, which label it "Raised & Fielded", and Steps BD and BE
// repeated it — so EVERY Integrate door read so far (the Balham, the
// Bedford, the Arched, drawing 20, the stable doors) was priced as
// raised-and-fielded when its panels are flat.
//
// That means Integrate’s rule 1240 "Additional for Flat Panel" 60 was RIGHT
// on all of them, and GlazePro’s R&F 120 was the error — the opposite way
// round from what Step BE concluded from the same figures. The other half of
// Nathan’s decision d stands: "Door Muntin" is 60 per REAL muntin, and a mid
// rail is not one.
export const PANEL_TYPES = {
  110:                 'flat',
  112:                 'raised_and_fielded',
  114:                 'vertical_tongue_and_groove',
  116:                 'horizontal_tongue_and_groove',
  raised_and_fielded:  'raised_and_fielded',
  flat:                'flat',
  vertical_tongue_and_groove:   'vertical_tongue_and_groove',
  horizontal_tongue_and_groove: 'horizontal_tongue_and_groove',
}

export const PANEL_BEADS = {
  120:   'ovolo',
  // Step BP: Integrate's other two beads (docs/integrate-drawing-gaps.txt
  // option lists). 126 had no entry at all, so a bolection bead stored by
  // its Integrate id priced NO moulding — G4's and FT5's panels.
  126:   'bolection',
  320:   'bespoke',
  ovolo: 'ovolo',
  lambs_tongue: 'lambs_tongue',
  square:       'square',
  bolection:    'bolection',
  bespoke:      'bespoke',
}

/**
 * Step BP item 0 (extra): the lists the board offers for a panel's type and
 * bead — Integrate's own, by id, so a dropdown replaces the number box that
 * let drawing 105's panel be blanked to null.
 */
export const PANEL_TYPE_OPTIONS = [
  { code: 'flat',                         label: 'Flat',                       integrate: 110 },
  { code: 'raised_and_fielded',           label: 'Raised & fielded',           integrate: 112 },
  { code: 'vertical_tongue_and_groove',   label: 'Vertical tongue & groove',   integrate: 114 },
  { code: 'horizontal_tongue_and_groove', label: 'Horizontal tongue & groove', integrate: 116 },
]
export const PANEL_BEAD_OPTIONS = [
  { code: 'ovolo',     label: 'Ovolo',     integrate: 120 },
  { code: 'bolection', label: 'Bolection', integrate: 126 },
  { code: 'bespoke',   label: 'Bespoke',   integrate: 320 },
]

/**
 * The option a stored value selects — an Integrate id (110) or a GlazePro
 * code ('flat') both land on the same entry; null, '' or an unknown value
 * select nothing, which the board shows as "— select —".
 */
export function panelOptionCode(kind, value) {
  const code = kind === 'bead' ? panelBead(value) : panelType(value)
  const list = kind === 'bead' ? PANEL_BEAD_OPTIONS : PANEL_TYPE_OPTIONS
  return list.some(o => o.code === code) ? code : null
}

/** @returns the panel type code, or undefined for an unrecognised value. */
export function panelType(code) {
  if (code == null || code === '') return null
  return PANEL_TYPES[String(code).toLowerCase()] ?? PANEL_TYPES[Number(code)]
}

/** @returns the panel bead code, or undefined for an unrecognised value. */
export function panelBead(code) {
  if (code == null || code === '') return null
  return PANEL_BEADS[String(code).toLowerCase()] ?? PANEL_BEADS[Number(code)]
}

// ── Moulding ──────────────────────────────────────────────────────────────────
// moulding_profile lives on drawingItemPart.mouldingTypeId (real tree:
// 'ovolo'). The old read of a mouldingPart node matched nothing on real trees.
export function isLambsTongueMoulding(code) {
  return String(code ?? '').toLowerCase() === 'lambs_tongue'
}

// ── Known full code sets for warning checks ──────────────────────────────────
// 'cill_only' is GlazePro's named type of work for a stand-alone cill
// replacement (sql/step-am1-cill-replacement-fields.sql). Integrate has no
// such option: it stores every item flag false plus New Cill and calls the
// result "Other" (docs/integrate-L31115-cill.txt), which is what this code
// produces — every service flag false.
const TYPE_OF_WORK_CODES = ['complete_new', 'new_pair_of_sashes', 'draught_seal', 'bi_glass', 'no_work', 'cill_only']
const JAMB_TYPE_CODES    = ['solid_profiled', 'solid_with_plant_on_stop', 'solid_spiral_for_sash', 'hollow_box_for_sash']
const STAFF_BEAD_CODES   = ['small', 'large', 'custom']

// ── Vocabulary warnings ───────────────────────────────────────────────────────

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
 * Step AD (docs/step-ad-arch-and-pairs-brief.md §1): the arch belongs to
 * the TOP SASH, measured at the glass — Integrate stores archHeight as the
 * rise of the glass sightline arc, shoulderHeight as the glass height at
 * the sides, isFrameLevelArch (frame head follows the arch) and
 * archedOuterJamb. GlazePro now stores the same four fields on the top
 * sash. LEGACY drawings/templates stored archHead/archHeight on the FRAME:
 * those are read as a top-sash arch with the stored rise taken as the
 * glass rise, and collectVocabularyWarnings() flags the reinterpretation —
 * a frame rise is not necessarily a glass rise, so the drawing should be
 * re-saved with the arch on the top sash.
 *
 * @param {Object} tree     - root parts tree node
 * @param {Object} [sashNode] - a specific topSashPart; the legacy frame
 *   fallback only applies to the FIRST top sash (legacy drawings are
 *   single-pair). Omitted → the first top sash.
 */
export function resolveTopSashArch(tree, sashNode = null) {
  const topSash = sashNode ?? findFirst(tree, 'topSashPart')
  const sv = topSash?.values ?? {}
  if (sv.archHead === true) {
    return {
      archHead:         true,
      archHeight:       Number(sv.archHeight) || 0,
      isFrameLevelArch: sv.isFrameLevelArch === true,
      archedOuterJamb:  sv.archedOuterJamb === true,
      legacyFrameArch:  false,
    }
  }
  const frame   = findFirst(tree, 'assemblyFramePart')
  const fv      = frame?.values ?? {}
  const isFirstTop = topSash != null && topSash === findFirst(tree, 'topSashPart')
  if (fv.archHead === true && isFirstTop) {
    return {
      archHead:         true,
      archHeight:       Number(fv.archHeight) || 0,
      isFrameLevelArch: true,   // a frame-level arch, by definition
      archedOuterJamb:  fv.archedOuterJamb === true,
      legacyFrameArch:  true,
    }
  }
  return { archHead: false, archHeight: 0, isFrameLevelArch: false, archedOuterJamb: false, legacyFrameArch: false }
}

/**
 * Scan a parts tree for option codes the engine depends on but does not
 * recognise or cannot price. Returns human-readable warnings, each naming
 * the field and the code — never a silent false.
 */
export function collectVocabularyWarnings(tree) {
  const warnings = []
  const warn = (field, code, extra) =>
    warnings.push(`Unrecognised ${field} code: "${code}"${extra ? ` — ${extra}` : ''}`)

  const item  = findFirst(tree, 'drawingItemPart')
  const frame = findFirst(tree, 'assemblyFramePart')
  const pair  = findFirst(tree, 'sashPairPart')
  const iv    = item?.values ?? {}

  // Timber
  for (const field of ['frameMaterialId', 'sashMaterialId', 'cillMaterialId']) {
    const code = iv[field]
    const fam  = timberFamily(code)
    if (code && fam === undefined) warn(field, code)
    else if (fam && !(fam in TIMBER_FAMILY_DENSITIES) && field === 'sashMaterialId') {
      warnings.push(`No timber density for ${field} "${code}" — sash weight uses the softwood density`)
    }
  }

  // Type of work
  const tow = iv.typeOfWork
  if (tow && !TYPE_OF_WORK_CODES.includes(tow)) warn('typeOfWork', tow)
  else if (tow === 'no_work') warnings.push('typeOfWork "no_work" has no pricing branch — item priced as if no service type were set')

  // Staff bead
  const sb = iv.staffBeadTypeId
  if (sb && !STAFF_BEAD_CODES.includes(String(sb).toLowerCase())) warn('staffBeadTypeId', sb)
  else if (String(sb ?? '').toLowerCase() === 'custom') {
    warnings.push('staffBeadTypeId "custom": no staff bead allocation rule handles custom beads — none allocated')
  }

  // Jamb type
  const jt = frame?.values?.jambType
  if (jt && !JAMB_TYPE_CODES.includes(jt)) warn('jambType', jt)

  // Legacy arch location (Step AD): the arch belongs to the top sash,
  // measured at the glass. A frame-level archHead is read as a top-sash
  // arch with the stored rise taken as the GLASS rise — not a silent
  // reinterpretation.
  if (frame?.values?.archHead === true && findFirst(tree, 'topSashPart')?.values?.archHead !== true) {
    warnings.push(
      `Arch stored on the FRAME (legacy drawing): read as a top-sash arch with rise ${frame.values.archHeight ?? '?'} mm at the glass. ` +
      `Integrate measures the arch at the top sash glass — re-save the drawing with the arch on the top sash to confirm the rise.`)
  }

  // Horns
  for (const field of ['topHornTypeShortName', 'bottomHornTypeShortName']) {
    const code = pair?.values?.[field]
    if (code && hornKind(code) === undefined) warn(field, code)
  }

  // Sash operations
  for (const sash of [...findAll(tree, 'topSashPart'), ...findAll(tree, 'bottomSashPart')]) {
    const op = sash.values?.operation
    if (op && operationKind(op) === undefined) warn('operation', op)
  }

  // Glazing + spacers per glass unit
  for (const g of findAll(tree, 'glassPart')) {
    const gz = g.values?.glazingId
    if (gz && glazingType(gz) === undefined) warn('glazingId', gz)
    const sd = g.values?.spacerDimId
    if (sd && spacerDimensionMm(sd) === undefined) warn('spacerDimId', sd)
  }

  return warnings
}
