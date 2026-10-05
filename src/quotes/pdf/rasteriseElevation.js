/**
 * rasteriseElevation.js — render a SashElevation SVG to a PNG data-URI.
 *
 * Uses renderToStaticMarkup (synchronous, no DOM, no requestAnimationFrame)
 * so it works even when the browser tab is hidden. A 20-second timeout
 * prevents hanging on image decode failures.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const TARGET_PX = 900 // ~75 mm at 300 dpi
const TIMEOUT_MS = 20_000

/**
 * Rasterise a SashElevation to a PNG data-URI.
 *
 * @param {object} tree       parts tree
 * @param {object} geometry   from computeSashGeometry
 * @param {object} derived    from computeDerived
 * @param {string} viewMode   'internal' | 'external'
 * @param {object} refOptions e.g. { sash_operation: [{code,label}] }
 * @returns {Promise<string|null>} data:image/png;base64,… or null
 */
export async function rasteriseElevation(tree, geometry, derived, viewMode, refOptions, settingsOverride) {
  if (!tree) return null

  const { SashElevation } = await import('../../drawingBoard/renderElevation.jsx')

  // Compute geometry/derived on the fly when the snapshot doesn't carry them
  // (older published snapshots, or computeSashGeometry threw during build)
  if (!geometry || !derived) {
    try {
      const { computeDerived } = await import('../../drawingBoard/computeDerived.js')
      const { computeSashGeometry } = await import('../../drawingBoard/sashGeometry.js')
      derived = derived || computeDerived(tree)
      geometry = geometry || computeSashGeometry(tree, derived)
    } catch { /* leave null — placeholder will show */ }
    if (!geometry) return null
  }

  const settings = {
    showOverallSL: false,
    showIndividualSL: false,
    showGlazingRebate: false,
    showTextOnDwg: true,
    showGlassLabels: true,
    showActiveRulers: false,
    showSashCentricDims: false,
    ...settingsOverride,
  }

  // Render SVG markup synchronously — no DOM, no animation frame
  const svgMarkup = renderToStaticMarkup(createElement(SashElevation, {
    tree, geometry, derived,
    refOptions: refOptions || {},
    viewMode,
    settings,
    fontFamily: 'Helvetica, Arial, sans-serif',
  }))

  if (!svgMarkup || !svgMarkup.includes('<svg')) return null

  // Rasterise SVG → PNG via an off-screen Image + Canvas, with a timeout
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url)
      reject(new Error(`Elevation rasterisation timed out after ${TIMEOUT_MS / 1000}s — is the browser tab hidden?`))
    }, TIMEOUT_MS)

    const img = new Image()
    img.onload = () => {
      clearTimeout(timer)
      try {
        const aspect = img.naturalHeight / img.naturalWidth
        const canvas = document.createElement('canvas')
        canvas.width = TARGET_PX
        canvas.height = Math.round(TARGET_PX * aspect)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        URL.revokeObjectURL(url)
        resolve(null)
      }
    }
    img.onerror = () => {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}
