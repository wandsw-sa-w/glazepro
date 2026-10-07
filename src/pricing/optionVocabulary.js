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
export function glassSpacerMm(glassValues = {}) {
  const fromCode = spacerDimensionMm(glassValues.spacerDimId)
  if (typeof fromCode === 'number') return fromCode
  if (glassValues.spacerHeight != null) return Number(glassValues.spacerHeight) || 0
  return 0
}

// glazing_spacer_colour codes: 'white_warm_edge' etc. The warm-edge flag
// reads the COLOUR code — the dimension code never contains 'warm_edge'.
export function isWarmEdgeSpacerColour(spacerColourId) {
  return String(spacerColourId ?? '').toLowerCase().includes('warm_edge')
}

// ── Moulding ──────────────────────────────────────────────────────────────────
// moulding_profile lives on drawingItemPart.mouldingTypeId (real tree:
// 'ovolo'). The old read of a mouldingPart node matched nothing on real trees.
export function isLambsTongueMoulding(code) {
  return String(code ?? '').toLowerCase() === 'lambs_tongue'
}

// ── Known full code sets for warning checks ──────────────────────────────────
const TYPE_OF_WORK_CODES = ['complete_new', 'new_pair_of_sashes', 'draught_seal', 'bi_glass', 'no_work']
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
