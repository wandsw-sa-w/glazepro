/**
 * renderItemDetailSheet.js — render an Item Detail Sheet PDF from a snapshot.
 *
 * 1 item per page, no prices, shows overall frame dimensions.
 * Opens in a new tab; not stored.
 */

import React, { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { buildItemDetailModel } from './itemDetailModel.js'

// ── SVG rasterisation (shared pattern) ─────────────────────────────────────

async function rasteriseElevation(tree, geometry, derived, viewMode, refOptions) {
  if (!tree || !geometry) return null

  const { SashElevation } = await import('../../drawingBoard/renderElevation.jsx')

  const TARGET_PX = 900
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:830px;height:1200px;overflow:hidden'
  document.body.appendChild(container)

  const settings = {
    showOverallSL: false, showIndividualSL: false, showGlazingRebate: false,
    showTextOnDwg: true, showGlassLabels: true, showActiveRulers: false,
    showSashCentricDims: false,
  }

  return new Promise((resolve) => {
    const root = createRoot(container)
    root.render(createElement(SashElevation, {
      tree, geometry, derived, refOptions: refOptions || {}, viewMode, settings,
      fontFamily: 'Helvetica, Arial, sans-serif',
    }))

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
      } catch { resolve(null) }
      finally { root.unmount(); document.body.removeChild(container) }
    }))
  })
}

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
    const [internal, external] = await Promise.all([
      rasteriseElevation(item.parts_tree, item.geometry, item.derived, 'internal', elevRefOptions),
      rasteriseElevation(item.parts_tree, item.geometry, item.derived, 'external', elevRefOptions),
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
