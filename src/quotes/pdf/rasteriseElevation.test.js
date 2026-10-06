import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

describe('rasteriseElevation — synchronous rendering', () => {

  it('renderToStaticMarkup produces the SVG synchronously (no rAF needed)', () => {
    const Comp = () => createElement('svg', { width: 100 }, createElement('text', null, 'hello'))
    const html = renderToStaticMarkup(createElement(Comp))
    expect(html).toContain('<svg')
    expect(html).toContain('hello')
  })

  it('SashElevation markup contains xmlns and numeric width/height after post-processing', async () => {
    const { SashElevation } = await import('../../drawingBoard/renderElevation.jsx')
    const tree = {
      key: 'item1', part_type: 'drawingItemPart', values: {}, children: [{
        key: 'frame1', part_type: 'assemblyFramePart',
        values: { width: 500, height: 1849, leftWidth: 85, rightWidth: 85, topHeight: 79 },
        children: [
          { key: 'cill1', part_type: 'cillPart', values: { height: 70 }, children: [] },
          {
            key: 'pair1', part_type: 'sashPairPart', values: { midrailHeight: 40 }, children: [
              { key: 'top1', part_type: 'topSashPart', values: { topHeight: 49, stileWidth: 47, operation: 'cord_hung' }, children: [] },
              { key: 'bot1', part_type: 'bottomSashPart', values: { bottomHeight: 88, operation: 'cord_hung' }, children: [] },
            ],
          },
        ],
      }],
    }
    const geometry = { sashWidth: 325, topSashHeight: 850.5, bottomSashHeight: 889.5, topGlassHeight: 761.5, bottomGlassHeight: 761.5 }
    const refOptions = { sash_operation: [{ code: 'cord_hung', label: 'Cord Hung' }] }

    let html = renderToStaticMarkup(createElement(SashElevation, {
      tree, geometry, refOptions, viewMode: 'internal',
      settings: { showGlassLabels: true, showOverallSL: false, showIndividualSL: false },
      fontFamily: 'Helvetica, Arial, sans-serif',
    }))

    // renderToStaticMarkup omits xmlns — the same post-processing rasteriseElevation does:
    expect(html).not.toContain('xmlns=') // raw output lacks it
    html = html.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    expect(html).toContain('xmlns="http://www.w3.org/2000/svg"')

    // width="100%" has no intrinsic size — must be replaced with pixel values
    expect(html).toContain('width="100%"')
    const vbMatch = html.match(/viewBox="([^"]+)"/)
    expect(vbMatch).not.toBeNull()
    const vbW = Number(vbMatch[1].split(/\s+/)[2])
    expect(vbW).toBeGreaterThan(0)
    html = html.replace(/width="100%"/, `width="${Math.round(vbW)}"`)
    expect(html).toMatch(/width="\d+"/)
    expect(html).not.toContain('width="100%"')

    // Labels are present
    expect(html).toContain('Cord Hung')
  })

  it('rasteriseElevation.js injects xmlns and replaces percentage dimensions', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('src/quotes/pdf/rasteriseElevation.js', 'utf-8')
    expect(source).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(source).toContain('viewBox')
    expect(source).toMatch(/width="\$\{Math\.round\(vbW\)\}"/)
  })

  it('rasteriseElevation.js rejects on image load failure (never resolves null)', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('src/quotes/pdf/rasteriseElevation.js', 'utf-8')
    // onerror handler must call reject
    expect(source).toContain('img.onerror')
    // The onerror block (between img.onerror and the next img.) must contain reject
    const onerrorBlock = source.slice(source.indexOf('img.onerror'), source.indexOf('img.src'))
    expect(onerrorBlock).toContain('reject')
    // No resolve(null) anywhere in the file
    expect(source).not.toContain('resolve(null)')
  })

  it('no renderer file uses requestAnimationFrame or createRoot', async () => {
    const fs = await import('fs')
    for (const file of [
      'src/quotes/pdf/renderQuotePdf.js',
      'src/quotes/pdf/renderScheduleOfWork.js',
      'src/quotes/pdf/renderItemDetailSheet.js',
    ]) {
      const source = fs.readFileSync(file, 'utf-8')
      expect(source).not.toContain('requestAnimationFrame')
      expect(source).not.toContain('createRoot')
    }
  })

  it('no "Elevation not available" fallback in the customer quote PDF', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('src/quotes/pdf/QuotePdf.jsx', 'utf-8')
    expect(source).not.toContain('Elevation not available')
  })
})
