/**
 * itemDetailModel.js — build the document model for the Item Detail Sheet.
 *
 * 1 item per page, no prices, shows overall frame dimensions.
 * This is the sheet surveyors and the workshop use.
 *
 * Shows: lead/quote ref, item number + location, both elevations with
 * overall frame dimensions, full spec sections including H&S/access,
 * installation notes and notes for production.
 */

import {
  itemHeading,
  specSections,
} from './quoteDocModel.js'

// ── Tree helper ────────────────────────────────────────────────────────────

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

/**
 * Extract overall frame dimensions from the parts tree.
 *
 * @param {object} tree  The parts tree
 * @returns {{ width: number|null, height: number|null }}
 */
export function frameDimensions(tree) {
  if (!tree) return { width: null, height: null }
  const frame = findFirst(tree, 'assemblyFramePart')
  if (!frame?.values) return { width: null, height: null }
  return {
    width: frame.values.width ?? null,
    height: frame.values.height ?? null,
  }
}

/**
 * Build the Item Detail Sheet model from a snapshot.
 *
 * @param {object} snapshot  v2 snapshot
 * @returns {object}  { title, quoteRef, leadRef, items[] }
 */
export function buildItemDetailModel(snapshot) {
  const content = snapshot.content || {}
  const hsOptinValues = content.hs_optin_values || []
  const refLabels = snapshot.ref_labels || {}

  const items = (snapshot.items || []).map(item => {
    const rangeDisplayName = item.profile_label || null
    const { heading } = itemHeading(item, rangeDisplayName, refLabels)
    const specs = specSections(item, hsOptinValues, refLabels)
    const dims = frameDimensions(item.parts_tree)

    // Extract notes parts for the detail sheet
    const notesPart = findFirst(item.parts_tree, 'notesPart')
    const installNotes = notesPart?.values?.installationNotes || null
    const prodNotes = notesPart?.values?.productionNotes || null
    const quoteNotes = notesPart?.values?.quoteNotes || null

    return {
      itemNumber: item.job_item?.item_number,
      location: item.location_text || '',
      heading,
      specSections: specs,
      frameWidth: dims.width,
      frameHeight: dims.height,
      installationNotes: installNotes,
      productionNotes: prodNotes,
      quoteNotes,
      drawing: item.drawing,
      partsTree: item.parts_tree,
      derived: item.derived,
      geometry: item.geometry,
    }
  })

  return {
    title: 'Item Detail Sheet',
    quoteRef: `${snapshot.lead_number || ''} / ${snapshot.quote_number || ''}`,
    leadRef: snapshot.lead_number || '',
    lead: snapshot.lead || {},
    items,
  }
}
