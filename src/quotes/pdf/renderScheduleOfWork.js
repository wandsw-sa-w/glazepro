/**
 * renderScheduleOfWork.js — render a Schedule of Work PDF from a snapshot.
 *
 * Opens in a new tab; not stored.
 */

import { createElement } from 'react'
import { buildSowModel } from './scheduleOfWorkModel.js'
import { rasteriseElevation } from './rasteriseElevation.js'

// ── Main render ────────────────────────────────────────────────────────────

/**
 * Render a Schedule of Work PDF and open it in a new tab.
 *
 * @param {object} snapshot  v2 snapshot
 * @param {{ headerMode?: 'customer'|'company', onProgress?: (msg: string) => void }} opts
 * @returns {Promise<Blob>}
 */
export async function renderScheduleOfWork(snapshot, opts = {}) {
  const { headerMode = 'customer', onProgress } = opts

  if (snapshot.version !== 2) {
    throw new Error('Published before PDFs were available')
  }

  onProgress?.('Building SOW model...')
  const model = buildSowModel(snapshot, { headerMode })

  const elevRefOptions = snapshot.ref_options || {}

  onProgress?.('Rendering elevations...')
  const elevationImages = []
  for (let i = 0; i < (snapshot.items || []).length; i++) {
    const item = snapshot.items[i]
    onProgress?.(`Rendering elevation ${i + 1} of ${snapshot.items.length}...`)
    const [internal, external] = await Promise.all([
      rasteriseElevation(item.parts_tree, item.geometry, item.derived, 'internal', elevRefOptions),
      rasteriseElevation(item.parts_tree, item.geometry, item.derived, 'external', elevRefOptions),
    ])
    elevationImages.push({ internal, external })
  }

  onProgress?.('Generating PDF...')
  const { pdf } = await import('@react-pdf/renderer')
  const { default: ScheduleOfWorkPdf } = await import('./ScheduleOfWorkPdf.jsx')

  const logoUrl = '/quote-assets/logo-wsw.png'

  const doc = createElement(ScheduleOfWorkPdf, {
    model,
    logoUrl,
    elevationImages,
  })

  const blob = await pdf(doc).toBlob()
  return blob
}
