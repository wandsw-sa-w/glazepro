/**
 * scheduleOfWorkModel.js — build the document model for the
 * internal Schedule of Work output.
 *
 * 3 items per page, no prices anywhere, no letters, no cover,
 * no financial summary. Title "Schedule of Work".
 *
 * Reuses specSections, itemHeading, ironmongeryTiles from quoteDocModel.
 */

import {
  itemHeading,
  specSections,
  groupItemPages,
  LAYOUT_3_NO_IMAGES,
} from './quoteDocModel.js'

/**
 * Build the SOW model from a snapshot.
 *
 * @param {object} snapshot  v2 snapshot
 * @param {{ headerMode?: 'customer'|'company' }} opts
 * @returns {object}  { title, quoteRef, header, itemPages, items }
 */
export function buildSowModel(snapshot, opts = {}) {
  const headerMode = opts.headerMode || 'customer'
  const content = snapshot.content || {}
  const hsOptinValues = content.hs_optin_values || []
  const refLabels = snapshot.ref_labels || {}

  const items = (snapshot.items || []).map(item => {
    const rangeDisplayName = item.profile_label || null
    const { heading } = itemHeading(item, rangeDisplayName, refLabels)
    const specs = specSections(item, hsOptinValues, refLabels)

    return {
      itemNumber: item.job_item?.item_number,
      location: item.location_text || '',
      heading,
      specSections: specs,
      drawing: item.drawing,
      partsTree: item.parts_tree,
      derived: item.derived,
      geometry: item.geometry,
    }
  })

  const itemPages = groupItemPages(items, LAYOUT_3_NO_IMAGES)

  const quoteRef = `${snapshot.lead_number || ''} / ${snapshot.quote_number || ''}`

  let header
  if (headerMode === 'company') {
    const footer = content.footer || {}
    header = {
      mode: 'company',
      line1: footer.company || 'Wandsworth Sash Windows & Parsons Joinery',
      line2: footer.address || '',
      line3: footer.contact || '',
    }
  } else {
    header = {
      mode: 'customer',
      contactName: snapshot.lead?.contact_name || '',
      address: snapshot.lead?.installation_address_one_line || '',
      phone: snapshot.lead?.phone || '',
      email: snapshot.lead?.email || '',
    }
  }

  return {
    title: 'Schedule of Work',
    quoteRef,
    header,
    items,
    itemPages,
  }
}
