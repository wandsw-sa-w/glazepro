// renderElevation.test.jsx
// Verifies that SashElevation renders without throwing for valid and missing inputs.
// Uses react-dom/server renderToStaticMarkup (no DOM/jsdom needed).

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SashElevation } from './renderElevation.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTree(frameValues = {}, cillValues = {}, pairValues = {}, topValues = {}, botValues = {}) {
  return {
    key: 'item1', part_type: 'drawingItemPart', values: {}, children: [{
      key: 'frame1', part_type: 'assemblyFramePart', values: frameValues, children: [
        { key: 'cill1', part_type: 'cillPart', values: cillValues, children: [] },
        {
          key: 'pair1', part_type: 'sashPairPart', values: pairValues, children: [
            { key: 'top1', part_type: 'topSashPart',    values: topValues, children: [] },
            { key: 'bot1', part_type: 'bottomSashPart', values: botValues, children: [] },
          ],
        },
      ],
    }],
  }
}

function makeGeometry(overrides = {}) {
  return {
    sashWidth:          325,
    topSashHeight:      850.5,
    bottomSashHeight:   889.5,
    topGlassHeight:     761.5,
    bottomGlassHeight:  761.5,
    ...overrides,
  }
}

function render(props) {
  return renderToStaticMarkup(createElement(SashElevation, props))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SashElevation — no crash', () => {

  it('renders an SVG for a complete tree + geometry', () => {
    const tree = makeTree(
      { width: 500, height: 1849, leftWidth: 85, rightWidth: 85, topHeight: 79, leftOuterJamb: 101 },
      { height: 70 },
      { mechanicalClearanceLeft: 2.5, mechanicalClearanceRight: 2.5, mechanicalClearanceTop: 0, mechanicalClearanceBottom: 0, midrailHeight: 40, sashSplit: 'half_half' },
      { topHeight: 49, stileWidth: 47 },
      { bottomHeight: 88 },
    )
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions: {}, viewMode: 'internal' })
    expect(html).toContain('<svg')
    expect(html).not.toContain('NaN')
  })

  it('renders an SVG for internal and external view modes', () => {
    const tree = makeTree({ width: 500, height: 1849, leftWidth: 85, rightWidth: 85, topHeight: 79 }, { height: 70 })
    const geo  = makeGeometry()
    const int  = render({ tree, geometry: geo, refOptions: {}, viewMode: 'internal' })
    const ext  = render({ tree, geometry: geo, refOptions: {}, viewMode: 'external' })
    expect(int).toContain('<svg')
    expect(ext).toContain('<svg')
  })

  it('renders placeholder div when geometry is null (missing inputs)', () => {
    const tree = makeTree()
    const html = render({ tree, geometry: null, refOptions: {} })
    expect(html).not.toContain('<svg')
    expect(html).toContain('Enter frame')
  })

  it('renders when frame has no inner-jamb/cill values (all zero offsets)', () => {
    // OY = 0, iH = fH, so r3cyBase ≈ r4cyBase — label-spacing code must not crash
    const tree = makeTree({ width: 330, height: 1700 }, {})
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions: {} })
    expect(html).toContain('<svg')
    expect(html).not.toContain('NaN')
  })

  it('renders when topSash stileWidth is absent (falls back to default)', () => {
    const tree = makeTree(
      { width: 500, height: 1849, leftWidth: 85, rightWidth: 85, topHeight: 79 },
      { height: 70 },
      {},
      {},   // no stileWidth
      {},
    )
    const geo  = makeGeometry()
    expect(() => render({ tree, geometry: geo, refOptions: {} })).not.toThrow()
  })

  it('no NaN in the rendered SVG markup', () => {
    const tree = makeTree(
      { width: 500, height: 1849, leftWidth: 85, rightWidth: 85, topHeight: 79 },
      { height: 70 },
      { midrailHeight: 40 },
      { topHeight: 49 },
      { bottomHeight: 88 },
    )
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions: {} })
    expect(html).not.toContain('NaN')
  })

})
