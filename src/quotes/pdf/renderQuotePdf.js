/**
 * renderQuotePdf.js — render a quote PDF from a snapshot.
 *
 * Dynamic-imports @react-pdf/renderer so it stays out of the main bundle.
 * Rasterises SashElevation SVGs off-screen for embedding as PNGs.
 */

import React, { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { buildDocModel } from './quoteDocModel.js'
import { PREVIEW_WATERMARK } from './quoteContent.js'

// ── SVG rasterisation ───────────────────────────────────────────────────────

/**
 * Render SashElevation to an off-screen SVG, then rasterise to a data-URI PNG
 * at roughly 300 dpi for a ~70 mm printed width.
 */
async function rasteriseElevation(tree, geometry, derived, viewMode, refOptions) {
  if (!tree || !geometry) return null

  // Lazy-import so we don't pull the drawing board into the main chunk
  const { SashElevation } = await import('../../drawingBoard/renderElevation.jsx')

  const TARGET_PX = 900 // ~75 mm at 300 dpi
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:830px;height:1200px;overflow:hidden'
  document.body.appendChild(container)

  const settings = {
    showOverallSL: false,
    showIndividualSL: false,
    showGlazingRebate: false,
    showTextOnDwg: true,
    showGlassLabels: true,   // operation labels ("A1 Cord Hung") live inside the glass-labels block
    showActiveRulers: false,
    showSashCentricDims: false,
  }

  return new Promise((resolve) => {
    const root = createRoot(container)
    root.render(createElement(SashElevation, {
      tree, geometry, derived, refOptions: refOptions || {}, viewMode, settings,
      fontFamily: 'Helvetica, Arial, sans-serif',
    }))

    // Wait for paint, then grab the SVG
    requestAnimationFrame(() => requestAnimationFrame(async () => {
      try {
        const svg = container.querySelector('svg')
        if (!svg) { resolve(null); return }

        const svgData = new XMLSerializer().serializeToString(svg)
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(blob)

        const img = new window.Image()
        img.onload = () => {
          const aspect = img.naturalHeight / img.naturalWidth
          const canvas = document.createElement('canvas')
          canvas.width = TARGET_PX
          canvas.height = Math.round(TARGET_PX * aspect)
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          URL.revokeObjectURL(url)
          resolve(canvas.toDataURL('image/png'))
        }
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
        img.src = url
      } catch {
        resolve(null)
      } finally {
        root.unmount()
        document.body.removeChild(container)
      }
    }))
  })
}

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
