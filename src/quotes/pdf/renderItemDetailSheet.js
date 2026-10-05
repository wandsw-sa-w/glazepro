/**
 * renderItemDetailSheet.js — render an Item Detail Sheet PDF from a snapshot.
 *
 * 1 item per page, no prices, shows overall frame dimensions.
 * Opens in a new tab; not stored.
 */

import { createElement } from 'react'
import { buildItemDetailModel } from './itemDetailModel.js'
import { rasteriseElevation } from './rasteriseElevation.js'

// ── Main render ────────────────────────────────────────────────────────────

/**
 * Render an Item Detail Sheet PDF and return a blob.
 *
 * @param {object} snapshot  v2 snapshot
 * @param {{ onProgress?: (msg: string) => void }} opts
 * @returns {Promise<Blob>}
 */
export async function renderItemDetailSheet(snapshot, opts = {}) {
  const { onProgress } = opts

  if (snapshot.version !== 2) {
    throw new Error('Published before PDFs were available')
  }

  onProgress?.('Building item detail model...')
  const model = buildItemDetailModel(snapshot)

  const elevRefOptions = snapshot.ref_options || {}

  onProgress?.('Rendering elevations...')
  const elevationImages = []
  for (let i = 0; i < (snapshot.items || []).length; i++) {
    const item = snapshot.items[i]
    onProgress?.(`Rendering elevation ${i + 1} of ${snapshot.items.length}...`)
    // Item Detail Sheet shows overall frame dimensions on the elevation
    const dimSettings = { showOverallSL: true }
    const [internal, external] = await Promise.all([
      rasteriseElevation(item.parts_tree, item.geometry, item.derived, 'internal', elevRefOptions, dimSettings),
      rasteriseElevation(item.parts_tree, item.geometry, item.derived, 'external', elevRefOptions, dimSettings),
    ])
    elevationImages.push({ internal, external })
  }

  onProgress?.('Generating PDF...')
  const { pdf } = await import('@react-pdf/renderer')
  const { default: ItemDetailSheetPdf } = await import('./ItemDetailSheetPdf.jsx')

  const logoUrl = '/quote-assets/logo-wsw.png'

  const doc = createElement(ItemDetailSheetPdf, {
    model,
    logoUrl,
    elevationImages,
  })

  const blob = await pdf(doc).toBlob()
  return blob
}
