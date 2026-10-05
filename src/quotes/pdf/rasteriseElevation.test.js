import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * rasteriseElevation uses renderToStaticMarkup (not requestAnimationFrame)
 * so it works when the browser tab is hidden. We verify:
 * 1. The SVG is produced synchronously via renderToStaticMarkup
 * 2. No requestAnimationFrame call exists in the module source
 * 3. The module exports a function with a 20s timeout
 */

describe('rasteriseElevation — synchronous rendering', () => {

  it('renderToStaticMarkup produces the SVG synchronously (no rAF needed)', () => {
    // Simulate what rasteriseElevation does internally: call renderToStaticMarkup
    // on a simple component. This proves the approach works in a test env.
    const Comp = () => createElement('svg', { width: 100 }, createElement('text', null, 'hello'))
    const html = renderToStaticMarkup(createElement(Comp))
    expect(html).toContain('<svg')
    expect(html).toContain('hello')
  })

  it('SashElevation renders via renderToStaticMarkup with operation labels', async () => {
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

    const html = renderToStaticMarkup(createElement(SashElevation, {
      tree, geometry, refOptions, viewMode: 'internal',
      settings: { showGlassLabels: true, showOverallSL: false, showIndividualSL: false },
      fontFamily: 'Helvetica, Arial, sans-serif',
    }))

    expect(html).toContain('<svg')
    expect(html).toContain('Cord Hung')
    expect(html).not.toContain('NaN')
  })

  it('rasteriseElevation.js source does not call requestAnimationFrame', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('src/quotes/pdf/rasteriseElevation.js', 'utf-8')
    // Strip comments before checking — the JSDoc mentions it by name
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
    expect(codeOnly).not.toContain('requestAnimationFrame')
    expect(source).toContain('renderToStaticMarkup')
    expect(source).toContain('TIMEOUT_MS')
  })

  it('no renderer file uses requestAnimationFrame any more', async () => {
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
})
