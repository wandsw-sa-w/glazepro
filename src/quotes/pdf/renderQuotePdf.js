/**
 * renderQuotePdf.js — render a quote PDF from a snapshot.
 *
 * Dynamic-imports @react-pdf/renderer so it stays out of the main bundle.
 * Elevation SVGs are rendered synchronously (renderToStaticMarkup) then
 * rasterised to PNG, so the pipeline works even with a hidden browser tab.
 */

import { createElement } from 'react'
import { buildDocModel } from './quoteDocModel.js'
import { PREVIEW_WATERMARK } from './quoteContent.js'
import { rasteriseElevation } from './rasteriseElevation.js'

// ── Main render function ────────────────────────────────────────────────────

/**
 * Render a quote PDF from a snapshot.
 *
 * @param {object} snapshot  v2 snapshot from buildQuoteSnapshot
 * @param {{ watermark?: boolean, onProgress?: (msg: string) => void }} opts
 * @returns {Promise<Blob>}
 */
export async function renderQuotePdf(snapshot, opts = {}) {
  const { watermark: showWatermark = false, onProgress } = opts

  if (snapshot.version !== 2) {
    throw new Error('Published before PDFs were available — copy to a new quote and publish that')
  }

  onProgress?.('Building document model…')
  const model = buildDocModel(snapshot)

  // Use reference options from the snapshot (resolved at build time with the
  // authenticated client — the anon key returns empty from RLS-protected tables)
  const elevRefOptions = snapshot.ref_options || {}

  // Rasterise elevations
  onProgress?.('Rendering elevations…')
  const elevationImages = []
  for (let i = 0; i < (snapshot.items || []).length; i++) {
    const item = snapshot.items[i]
    onProgress?.(`Rendering elevation ${i + 1} of ${snapshot.items.length}…`)
    const [internal, external] = await Promise.all([
      rasteriseElevation(item.parts_tree, item.geometry, item.derived, 'internal', elevRefOptions),
      rasteriseElevation(item.parts_tree, item.geometry, item.derived, 'external', elevRefOptions),
    ])
    elevationImages.push({ internal, external })
  }

  // Validate required assets (cover + logo must be real images, not HTML fallbacks)
  onProgress?.('Checking assets…')
  const logoUrl = '/quote-assets/logo-wsw.png'
  const coverUrl = '/quote-assets/front-cover.jpg'
  for (const [label, url] of [['Cover image', coverUrl], ['Logo', logoUrl]]) {
    const res = await fetch(url, { method: 'HEAD' })
    const ct = res.headers.get('content-type') || ''
    if (!res.ok || !ct.startsWith('image/')) {
      throw new Error(`${label} is not available (${url} returned ${ct || res.status}). Deploy the file to public/quote-assets/.`)
    }
  }

  // Dynamic import of @react-pdf/renderer
  onProgress?.('Generating PDF…')
  const { pdf } = await import('@react-pdf/renderer')
  const { default: QuotePdf } = await import('./QuotePdf.jsx')

  const doc = createElement(QuotePdf, {
    model,
    watermark: showWatermark ? PREVIEW_WATERMARK : null,
    logoUrl,
    coverUrl,
    elevationImages,
  })

  const blob = await pdf(doc).toBlob()
  return blob
}
