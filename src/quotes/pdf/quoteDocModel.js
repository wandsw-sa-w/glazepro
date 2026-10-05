/**
 * quoteDocModel.js — snapshot in, plain page model out.
 *
 * Pure functions, fully tested, no PDF library dependency.
 * The PDF renderer (QuotePdf.jsx) consumes the model this produces.
 */

// ── Tree helpers ────────────────────────────────────────────────────────────

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

// ── Money formatting ────────────────────────────────────────────────────────

function r2(x) { return Math.round(x * 100) / 100 }

export function fmtMoney(n) {
  if (n == null) return '—'
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Date formatting ("15 Sep 2026") ─────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function formatDate(isoOrDate) {
  if (!isoOrDate) return ''
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// ── Merge fields ────────────────────────────────────────────────────────────

/**
 * Replace [merge_field] placeholders in text.
 * In tests (strict=true), throws on unknown/empty fields.
 * In production (strict=false), unknown fields print nothing.
 */
export function mergeFields(text, fields, { strict = false } = {}) {
  if (!text) return ''
  return text.replace(/\[([^\]]+)\]/g, (match, key) => {
    const value = fields[key]
    if (strict && (value === undefined || value === null || value === '')) {
      throw new Error(`Merge field [${key}] is unknown or empty`)
    }
    if (value === undefined || value === null || value === '') return ''
    return value
  })
}

/**
 * Build the merge-field map from a snapshot.
 */
export function snapshotMergeFields(snapshot) {
  const content = snapshot.content || {}
  const leadTimes = content.lead_times || {}
  return {
    customer_forename: snapshot.lead?.customer_forename || '',
    installation_full_address_one_line: snapshot.lead?.installation_address_one_line || '',
    nj_lead_time: leadTimes.nj_lead_time || '10-12',
    ds_lead_time: leadTimes.ds_lead_time || '4-6',
    bg_lead_time: leadTimes.bg_lead_time || '10-12',
    sales_person_full_name: snapshot.salesperson?.full_name || '',
  }
}

// ── Label resolution ────────────────────────────────────────────────────────

/**
 * Resolve a raw code to its human label using the ref_labels map.
 * Falls back to title-casing the code if not found.
 */
function resolveLabel(code, refLabels) {
  if (!code) return ''
  if (refLabels && refLabels[code]) return refLabels[code]
  // Fallback: title-case, replace underscores with spaces
  return code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── Item heading ────────────────────────────────────────────────────────────

const WINDOW_TYPE_MAP = {
  'Box Sash':   'sash window',
  'Casement':   'casement window',
  'Door':       'door',
}

/**
 * Build the item heading and description_of_work.
 *
 * @param {object} item  snapshot item entry
 * @param {string|null} rangeDisplayName  profile label (e.g. "Standard Sash")
 * @param {object} [refLabels]  code→label map from snapshot.ref_labels
 * @returns {{ heading: string, descriptionOfWork: string }}
 */
export function itemHeading(item, rangeDisplayName, refLabels) {
  const tree = item.parts_tree
  const drawingItem = findFirst(tree, 'drawingItemPart')
  const typeOfWork = drawingItem?.values?.typeOfWork || 'complete_new'
  const windowType = item.drawing?.window_type || 'Box Sash'
  const itemTypeName = WINDOW_TYPE_MAP[windowType] || windowType.toLowerCase()

  // Range display name in brackets
  const rangeStr = rangeDisplayName ? ` (${rangeDisplayName} range)` : ''

  // Timber description
  const timberStr = buildTimberString(tree, refLabels)

  // Type of Work prefix
  let prefix
  switch (typeOfWork) {
    case 'complete_new':
      prefix = `Supply & Install a complete new Doc L ${itemTypeName}${rangeStr}`
      break
    case 'new_pair_of_sashes':
      prefix = `Supply & Install a new pair of sashes for ${itemTypeName}${rangeStr}`
      break
    case 'draught_seal':
      return {
        heading: `Including Draught Proofing${rangeStr}${timberStr ? ' ' + timberStr : ''}`,
        descriptionOfWork: `Including Draught Proofing`,
      }
    case 'bi_glass':
      prefix = `Supply & Install Bi-Glass secondary glazing for ${itemTypeName}${rangeStr}`
      break
    default:
      prefix = `Supply & Install a complete new Doc L ${itemTypeName}${rangeStr}`
  }

  // description_of_work = the prefix WITHOUT range or timber, e.g.
  // "Supply & Install a complete new Doc L sash window"
  const descPrefix = typeOfWork === 'complete_new'
    ? `Supply & Install a complete new Doc L ${itemTypeName}`
    : typeOfWork === 'new_pair_of_sashes'
      ? `Supply & Install a new pair of sashes for ${itemTypeName}`
      : typeOfWork === 'bi_glass'
        ? `Supply & Install Bi-Glass secondary glazing for ${itemTypeName}`
        : `Supply & Install a complete new Doc L ${itemTypeName}`

  return {
    heading: `${prefix}${timberStr ? ' ' + timberStr : ''}`,
    descriptionOfWork: descPrefix,
  }
}

function buildTimberString(tree, refLabels) {
  const frameMat = findFirst(tree, 'frameMaterialPart')
  const sashMat = findFirst(tree, 'sashMaterialPart')
  const cill = findFirst(tree, 'cillPart')
  const drawingItem = findFirst(tree, 'drawingItemPart')

  const frameCode = frameMat?.values?.timberType || drawingItem?.values?.frameMaterialId || null
  const sashCode = sashMat?.values?.timberType || drawingItem?.values?.sashMaterialId || null
  const cillCode = cill?.values?.timberType || drawingItem?.values?.cillMaterialId || null

  if (!frameCode && !sashCode && !cillCode) return ''

  const frameTimber = resolveLabel(frameCode, refLabels)
  const sashTimber = resolveLabel(sashCode, refLabels)
  const cillTimber = resolveLabel(cillCode, refLabels)

  // All match → "in Accoya"
  if (frameCode && sashCode && cillCode && frameCode === sashCode && sashCode === cillCode) {
    return `in ${frameTimber}`
  }

  // Frame and sash match, cill differs
  if (frameCode && sashCode && frameCode === sashCode && cillCode && cillCode !== frameCode) {
    return `in ${frameTimber} with ${cillTimber} cill`
  }

  // Frame and sash differ
  const parts = []
  if (frameCode) parts.push(frameTimber)
  if (sashCode && sashCode !== frameCode) parts.push(`${sashTimber} sash`)
  if (cillCode && cillCode !== frameCode && cillCode !== sashCode) parts.push(`${cillTimber} cill`)
  if (parts.length === 0) return ''
  return `in ${parts.join(' with ')}`
}

// ── Spec sections ───────────────────────────────────────────────────────────

/**
 * Build spec sections from a snapshot item's parts_tree and ironmongery.
 * Returns [{ title, content }], omitting empty sections.
 */
export function specSections(item, hsOptinValues, refLabels) {
  const tree = item.parts_tree
  const pd = item.profile_defaults || {}
  const sections = []

  // Helper: read a tree value, falling back to profile default
  function tv(partType, property) {
    const part = findFirst(tree, partType)
    const v = part?.values?.[property]
    if (v !== undefined && v !== null) return v
    return pd[`${partType}.${property}`] ?? null
  }

  // Repair — no tree data for this yet; omitted when empty

  // Moulding
  const mouldProfile = tv('mouldingPart', 'profile') || tv('mouldingPart', 'mouldingProfile')
  const barWidth = tv('mouldingPart', 'glazingBarWidth')
  if (mouldProfile || barWidth) {
    const parts = []
    if (mouldProfile) parts.push(resolveLabel(mouldProfile, refLabels))
    if (barWidth) parts.push(`${barWidth} mm Glazing Bar`)
    sections.push({ title: 'Moulding and Glazing Bar', content: parts.join(', ') })
  }

  // Sash Horn — resolve codes to labels
  const horn = findFirst(tree, 'hornPart')
  const pair = findFirst(tree, 'sashPairPart')
  const topHorn = horn?.values?.topHorn || pair?.values?.topHornTypeShortName
  const botHorn = horn?.values?.bottomHorn || pair?.values?.bottomHornTypeShortName
  if (topHorn || botHorn) {
    const fmtH = v => v ? resolveLabel(v, refLabels) : 'No horn'
    sections.push({ title: 'Sash Horn', content: `Top: ${fmtH(topHorn)}, Bottom: ${fmtH(botHorn)}` })
  }

  // Double Glazing
  const glassParts = findAll(tree, 'glassPart')
  if (glassParts.length > 0) {
    const glassSpecs = glassParts.map((g, idx) => ({
      index: idx,
      line: formatGlassLine(g, refLabels),
      location: glassLocation(tree, g, idx, glassParts.length),
    }))

    // Merge identical specs into one block
    if (glassSpecs.length === 2 && glassSpecs[0].line === glassSpecs[1].line) {
      if (glassSpecs[0].line) {
        sections.push({ title: 'Double Glazing', content: glassSpecs[0].line })
      }
    } else {
      for (const gs of glassSpecs) {
        if (!gs.line) continue
        const title = glassSpecs.length > 1 ? `Double Glazing - ${gs.location}` : 'Double Glazing'
        sections.push({ title, content: gs.line })
      }
    }
  }

  // Panel — from panelPart (if it exists)
  const panel = findFirst(tree, 'panelPart')
  if (panel && Object.keys(panel.values || {}).length > 0) {
    const desc = panel.values?.panelType || panel.values?.description
    if (desc) sections.push({ title: 'Panel', content: desc })
  }

  // Paint / Finish — resolve codes to labels, with profile default fallback
  const intFinish = tv('paintAndIronmongeryPart', 'internalFinish')
  const extFinish = tv('paintAndIronmongeryPart', 'externalFinish')
  const cillFinish = tv('paintAndIronmongeryPart', 'cillFinish')
  if (intFinish || extFinish || cillFinish) {
    const parts = []
    if (intFinish) parts.push(`Internal: ${resolveLabel(intFinish, refLabels)}`)
    if (extFinish) parts.push(`External: ${resolveLabel(extFinish, refLabels)}`)
    if (cillFinish) parts.push(`Cill: ${resolveLabel(cillFinish, refLabels)}`)
    sections.push({ title: 'Paint / Finish', content: parts.join(', ') })
  }

  // Ironmongery
  const ironSentence = ironmongerySentence(item.ironmongery || [])
  if (ironSentence) sections.push({ title: 'Ironmongery', content: ironSentence })

  // Surrounds — from allocated_parts or tree (when available)
  const surroundParts = (item.allocated_parts || []).filter(p =>
    /lining|architrave|window.board|nosing/i.test(p.part_name || '')
  )
  if (surroundParts.length > 0) {
    sections.push({ title: 'Surrounds', content: surroundParts.map(p => p.part_name).join(', ') })
  }

  // Health & Safety / Access — only the opted-in values from quoteContent.js
  const notesPart = findFirst(tree, 'notesPart')
  if (notesPart && hsOptinValues && hsOptinValues.length > 0) {
    const fieldMap = {
      'Landing Access': 'landingAccess',
      'External Access': 'externalAccessId',
    }
    const hsLines = []
    for (const opt of hsOptinValues) {
      const field = fieldMap[opt.group]
      if (!field) continue
      const val = notesPart.values?.[field]
      if (!val) continue
      // Resolve the code to a label and check it matches the opt-in value
      const label = resolveLabel(val, refLabels)
      if (label === opt.value) {
        hsLines.push(`${label}.`)
      }
    }
    if (hsLines.length > 0) {
      sections.push({ title: 'Health & Safety / Access', content: hsLines.join(' ') })
    }
  }

  // Notes
  const quoteNotes = notesPart?.values?.quoteNotes
  if (quoteNotes) sections.push({ title: 'Notes', content: quoteNotes })

  return sections
}

function glassLocation(tree, glassPart, index, total) {
  if (total <= 1) return ''
  // Find which sash this glass is in
  const topSash = findFirst(tree, 'topSashPart')
  const botSash = findFirst(tree, 'bottomSashPart')
  if (topSash && findFirst(topSash, 'glassPart') === glassPart) return 'Top'
  if (botSash && findFirst(botSash, 'glassPart') === glassPart) return 'Bottom'
  return index === 0 ? 'Top' : 'Bottom'
}

function formatGlassLine(glassPart, refLabels) {
  const v = glassPart?.values ?? {}
  const glassType = v.glassType || v.glazingId
  if (!glassType || glassType === 'single_glazed') return null

  // Inner pane
  let inner = v.innerPane || v.internalGlassPartNo || '4mm Clear'
  if (v.lowE) inner += ` ${v.lowE}`
  if (v.toughened_inner) inner += ' Toughened'

  // Gas + spacer — resolve codes to labels
  const gasCode = v.gasType || v.gasFillId || ''
  const gasStr = gasCode ? `${resolveLabel(gasCode, refLabels)} Filled` : ''
  const spacerCode = v.spacerColour || v.spacerColourId || ''
  const spacerStr = spacerCode ? `${resolveLabel(spacerCode, refLabels)} Warm Edge spacer` : ''

  // Outer pane
  let outer = v.outerPane || v.externalGlassPartNo || '4mm Clear'
  if (v.toughened_outer) outer += ' Toughened'

  const mid = [gasStr, spacerStr].filter(Boolean).join(', ')
  return [inner, mid, outer].filter(Boolean).join(' - ')
}

// ── Ironmongery sentence ────────────────────────────────────────────────────

/**
 * Build the ironmongery sentence from snapshot item.ironmongery array.
 * Groups by finish, keeps catalogue order inside a group.
 * Lines with no finish go first with no "in …".
 */
export function ironmongerySentence(ironmongery) {
  if (!ironmongery || ironmongery.length === 0) return ''

  // Group by finish_label (null/empty = no-finish group)
  const groups = new Map()
  let hasMultipoint = false

  for (const line of ironmongery) {
    const finish = line.finish_label || ''
    if (!groups.has(finish)) groups.set(finish, [])
    groups.get(finish).push(line)
    if (line.has_multipoint) hasMultipoint = true
  }

  // No-finish group first, then the rest in insertion order
  const parts = []
  const noFinish = groups.get('')
  if (noFinish) {
    parts.push(noFinish.map(l => `${l.qty} x ${l.name}`).join(', '))
    groups.delete('')
  }

  for (const [finish, lines] of groups) {
    const items = lines.map(l => `${l.qty} x ${l.name}`).join(', ')
    parts.push(`${items} in ${finish}`)
  }

  let sentence = parts.join(' and ')
  if (hasMultipoint) sentence += ' with multi-point locking system'
  return sentence
}

// ── Ironmongery tiles ───────────────────────────────────────────────────────

/**
 * One tile per distinct product that has a photo.
 * Returns [{ name, photo_url, finish_label }], five per row.
 */
export function ironmongeryTiles(ironmongery) {
  if (!ironmongery) return []
  const seen = new Set()
  const tiles = []
  for (const line of ironmongery) {
    if (!line.photo_url) continue
    const key = line.name + '|' + (line.finish_label || '')
    if (seen.has(key)) continue
    seen.add(key)
    tiles.push({ name: line.name, photo_url: line.photo_url, finish_label: line.finish_label || null })
  }
  return tiles
}

// ── Item price label ────────────────────────────────────────────────────────

export function itemPriceLabel(item, discountPct) {
  if (item.poa) return 'POA'
  const net = item.net_after_quote_discount ?? item.net
  if (net == null) return ''
  if (discountPct > 0) return `Price after discount excl. VAT: ${fmtMoney(net)}`
  return `Price excl. VAT: ${fmtMoney(net)}`
}

// ── Summary page model ──────────────────────────────────────────────────────

/**
 * Build the summary page model from a snapshot.
 */
export function summaryModel(snapshot) {
  const totals = snapshot.totals || {}
  const settings = snapshot.quote_settings || {}
  const discountPct = settings.discount_pct || 0
  const content = snapshot.content || {}
  const bankDetails = content.bank_details || {}

  // Item rows
  const rows = (snapshot.items || []).map((item, idx) => ({
    itemNumber: item.job_item?.item_number ?? (idx + 1),
    location: item.location_text || '',
    descriptionOfWork: itemHeading(item, null, snapshot.ref_labels).descriptionOfWork,
    netPrice: item.poa ? 'POA' : fmtMoney(item.net_after_quote_discount ?? item.net),
    poa: item.poa || false,
  }))

  // Totals lines
  const totalsLines = []
  if (discountPct > 0) {
    totalsLines.push({ label: 'Sub Total Before Discount', value: fmtMoney(totals.subtotal_before_discount), bold: false })
    totalsLines.push({ label: `${discountPct}% Discount`, value: `−${fmtMoney(totals.discount_amount)}`, bold: false })
    totalsLines.push({ label: 'Sub Total After Discount', value: fmtMoney(totals.subtotal_after_discount), bold: false })
  } else {
    totalsLines.push({ label: 'Sub Total', value: fmtMoney(totals.subtotal_after_discount ?? totals.subtotal_before_discount), bold: false })
  }

  // VAT lines
  const vatByRate = totals.vat_by_rate || {}
  const vatRates = Object.keys(vatByRate)
  if (vatRates.length > 1) {
    for (const rate of vatRates) {
      totalsLines.push({ label: `VAT @ ${rate}%`, value: fmtMoney(vatByRate[rate]), bold: false })
    }
  } else {
    totalsLines.push({ label: 'VAT', value: fmtMoney(totals.total_vat), bold: false })
  }

  totalsLines.push({ label: 'Total Order Value incl. VAT', value: fmtMoney(totals.total_incl_vat), bold: true })
  totalsLines.push({ label: 'Deposit With Order', value: fmtMoney(totals.stages?.deposit), bold: false })
  totalsLines.push({ label: 'Interim', value: fmtMoney(totals.stages?.interim), bold: false })
  totalsLines.push({ label: 'Balance on Completion', value: fmtMoney(totals.stages?.balance), bold: false })

  // Left box
  const publishedDate = formatDate(snapshot.published_at)
  const validDays = settings.valid_days || 30

  const leftBox = {
    quoteRef: `${snapshot.lead_number || ''} / ${snapshot.quote_number || ''}`,
    bankDetails: bankDetails.name
      ? `${bankDetails.name}, Sort code ${bankDetails.sort_code}, Account no: ${bankDetails.account_no}`
      : '',
    vatNote: 'VAT will be charged at the prevailing rate',
    validLine: `This quote is valid for ${validDays} days from ${publishedDate}`,
    generatedLine: `Generated by ${snapshot.generated_by || '—'} on ${publishedDate}`,
  }

  return { rows, totalsLines, leftBox, columns: SUMMARY_COLUMNS }
}

export const SUMMARY_COLUMNS = [
  { label: 'Item', width: 9 },
  { label: 'Location', width: 55 },
  { label: 'Description of Work', width: 82 },
  { label: 'Net Price excl. VAT', width: 22, align: 'right' },
]

// ── Full document model ─────────────────────────────────────────────────────

/**
 * Build the full document model from a snapshot.
 * Returns { frontLetter, summary, items[], backLetter, mergeFieldMap }.
 */
export function buildDocModel(snapshot) {
  const content = snapshot.content || {}
  const fields = snapshotMergeFields(snapshot)
  const hsOptinValues = content.hs_optin_values || []
  const discountPct = snapshot.quote_settings?.discount_pct || 0
  const refLabels = snapshot.ref_labels || {}

  const frontLetter = mergeFields(content.front_cover_letter || '', fields)

  const backLetterSections = (content.back_cover_letter || []).map(section => ({
    heading: section.heading,
    body: mergeFields(section.body || '', fields),
  }))

  const summary = summaryModel(snapshot)

  const items = (snapshot.items || []).map(item => {
    const rangeDisplayName = item.profile_label || null
    const { heading, descriptionOfWork } = itemHeading(item, rangeDisplayName, refLabels)
    const specs = specSections(item, hsOptinValues, refLabels)
    const tiles = ironmongeryTiles(item.ironmongery || [])
    const priceLabel = itemPriceLabel(item, discountPct)

    return {
      itemNumber: item.job_item?.item_number,
      location: item.location_text || '',
      heading,
      descriptionOfWork,
      specSections: specs,
      ironmongeryTiles: tiles,
      priceLabel,
      poa: item.poa || false,
      drawing: item.drawing,
      partsTree: item.parts_tree,
      derived: item.derived,
      geometry: item.geometry,
    }
  })

  return {
    quoteRef: `${snapshot.lead_number || ''} / ${snapshot.quote_number || ''}`,
    frontLetter,
    backLetterSections,
    summary,
    items,
    lead: snapshot.lead || {},
    salesperson: snapshot.salesperson || {},
    mergeFieldMap: fields,
  }
}
