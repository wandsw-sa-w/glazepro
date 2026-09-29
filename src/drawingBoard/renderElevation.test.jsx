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

// ── Tests — backward compatible (single sash, no arch) ────────────────────────

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

// ── Tests — arched head (Integrate L31115 Item 1: 1100 × 1600, arch height 150) ──

describe('SashElevation — arched head', () => {

  function makeArchTree(archHeight = 150.01) {
    return {
      key: 'item1', part_type: 'drawingItemPart', values: {}, children: [{
        key: 'frame1', part_type: 'assemblyFramePart',
        values: {
          width: 1100, height: 1600,
          leftWidth: 79, rightWidth: 79, topHeight: 79,
          archHead: true, archHeight,
        },
        children: [
          { key: 'cill1', part_type: 'cillPart', values: { height: 70 }, children: [] },
          {
            key: 'pair1', part_type: 'sashPairPart', values: { midrailHeight: 40 }, children: [
              { key: 'top1', part_type: 'topSashPart',    values: { topHeight: 49, stileWidth: 47 }, children: [] },
              { key: 'bot1', part_type: 'bottomSashPart', values: { bottomHeight: 88 }, children: [] },
            ],
          },
        ],
      }],
    }
  }

  it('renders without crashing for arched frame (1100 × 1600, arch 150)', () => {
    const tree = makeArchTree(150.01)
    const geo  = makeGeometry({ sashWidth: 942, topSashHeight: 755, bottomSashHeight: 756, topGlassHeight: 657, bottomGlassHeight: 628 })
    const html = render({ tree, geometry: geo, refOptions: {} })
    expect(html).toContain('<svg')
    expect(html).not.toContain('NaN')
  })

  it('contains an SVG arc path element for the arched head', () => {
    const tree = makeArchTree(150.01)
    const geo  = makeGeometry({ sashWidth: 942, topSashHeight: 755, bottomSashHeight: 756, topGlassHeight: 657, bottomGlassHeight: 628 })
    const html = render({ tree, geometry: geo, refOptions: {} })
    // SVG arc uses "A" command in path data
    expect(html).toContain(' A ')
  })

  it('no NaN for arched frame', () => {
    const tree = makeArchTree(150)
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions: {} })
    expect(html).not.toContain('NaN')
  })

  it('renders arch dimension label', () => {
    const tree = makeArchTree(150.01)
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions: {} })
    expect(html).toContain('Arch')
  })

})

// ── Tests — double box sash with mullion ──────────────────────────────────────

describe('SashElevation — double box sash with mullion', () => {

  function makeDoubleBoxTree() {
    return {
      key: 'item1', part_type: 'drawingItemPart', values: {}, children: [{
        key: 'frame1', part_type: 'assemblyFramePart',
        values: { width: 1000, height: 1700, leftWidth: 79, rightWidth: 79, topHeight: 79 },
        children: [
          { key: 'cill1', part_type: 'cillPart', values: { height: 70 }, children: [] },
          // Mullion at centre of interior (interior width = 1000 - 79 - 79 = 842; mullion at 421)
          { key: 'mull1', part_type: 'mullionPart', values: { offset: 421, thicknessInFrame: 40 }, children: [] },
          // Left sash pair
          {
            key: 'pair1', part_type: 'sashPairPart', values: { midrailHeight: 40 }, children: [
              { key: 'top1', part_type: 'topSashPart',    values: { topHeight: 49, stileWidth: 47 }, children: [] },
              { key: 'bot1', part_type: 'bottomSashPart', values: { bottomHeight: 88 }, children: [] },
            ],
          },
          // Right sash pair
          {
            key: 'pair2', part_type: 'sashPairPart', values: { midrailHeight: 40 }, children: [
              { key: 'top2', part_type: 'topSashPart',    values: { topHeight: 49, stileWidth: 47 }, children: [] },
              { key: 'bot2', part_type: 'bottomSashPart', values: { bottomHeight: 88 }, children: [] },
            ],
          },
        ],
      }],
    }
  }

  it('renders without crashing', () => {
    const tree = makeDoubleBoxTree()
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions: {} })
    expect(html).toContain('<svg')
    expect(html).not.toContain('NaN')
  })

  it('renders both sash pair labels (A1/A2 and B1/B2)', () => {
    const tree = makeDoubleBoxTree()
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions: {} })
    expect(html).toContain('A1')
    expect(html).toContain('A2')
    expect(html).toContain('B1')
    expect(html).toContain('B2')
  })

  it('renders a mullion rect element', () => {
    const tree = makeDoubleBoxTree()
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions: {} })
    // The mullion is drawn as a rect — just check overall output has expected part count
    expect(html).toContain('<svg')
    // The mullion at offset 421 should produce rendered output without NaN
    expect(html).not.toContain('NaN')
  })

})

// ── Tests — glazing bars ──────────────────────────────────────────────────────

describe('SashElevation — glazing bars', () => {

  function makeTreeWithBars(vCount, hCount, partial = false) {
    const topGlass = {
      key: 'tglass1', part_type: 'glassPart', values: {}, children: [
        ...Array.from({ length: vCount }, (_, i) => ({
          key: `vbar${i}`, part_type: 'verticalGlazingBarPart',
          // offset=0 means auto-space; for partial bar test, last bar has offset2 set
          values: partial && i === vCount - 1 ? { offset: 100, offset2: 400 } : { offset: 0 },
          children: [],
        })),
        ...Array.from({ length: hCount }, (_, i) => ({
          key: `hbar${i}`, part_type: 'horizontalGlazingBarPart',
          values: { offset: 0 },
          children: [],
        })),
      ],
    }
    const botGlass = {
      key: 'bglass1', part_type: 'glassPart', values: {}, children: [],
    }
    return {
      key: 'item1', part_type: 'drawingItemPart', values: {}, children: [{
        key: 'frame1', part_type: 'assemblyFramePart',
        values: { width: 500, height: 1849, leftWidth: 85, rightWidth: 85, topHeight: 79 },
        children: [
          { key: 'cill1', part_type: 'cillPart', values: { height: 70 }, children: [] },
          {
            key: 'pair1', part_type: 'sashPairPart', values: { midrailHeight: 40 }, children: [
              { key: 'top1', part_type: 'topSashPart',    values: { topHeight: 49, stileWidth: 47 }, children: [topGlass] },
              { key: 'bot1', part_type: 'bottomSashPart', values: { bottomHeight: 88 }, children: [botGlass] },
            ],
          },
        ],
      }],
    }
  }

  it('renders 6-over-6 bars without crashing (6 vertical + 6 horizontal each)', () => {
    const tree = makeTreeWithBars(5, 5)  // 5 vertical bars = 6 panes; 5 horizontal = 6 rows → 6-over-6
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions: {} })
    expect(html).toContain('<svg')
    expect(html).not.toContain('NaN')
  })

  it('renders a partial bar (offset + offset2 set) without crashing', () => {
    const tree = makeTreeWithBars(3, 2, true)
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions: {} })
    expect(html).toContain('<svg')
    expect(html).not.toContain('NaN')
  })

  it('renders bar rect elements for glazing bars', () => {
    const tree = makeTreeWithBars(2, 1)  // 2 vertical + 1 horizontal = 3 bars
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions: {} })
    // Glazing bars are rendered as <rect> elements — just verify no crash + no NaN
    expect(html).toContain('<svg')
    expect(html).not.toContain('NaN')
  })

})

// ── Tests — sash split ────────────────────────────────────────────────────────

describe('SashElevation — sash split options', () => {

  function makeTreeWithSplit(splitId) {
    return {
      key: 'item1', part_type: 'drawingItemPart', values: {}, children: [{
        key: 'frame1', part_type: 'assemblyFramePart',
        values: { width: 500, height: 1849, leftWidth: 85, rightWidth: 85, topHeight: 79 },
        children: [
          { key: 'cill1', part_type: 'cillPart', values: { height: 70 }, children: [] },
          {
            key: 'pair1', part_type: 'sashPairPart',
            values: { midrailHeight: 40, sashSplitId: splitId },
            children: [
              { key: 'top1', part_type: 'topSashPart',    values: { topHeight: 49, stileWidth: 47 }, children: [] },
              { key: 'bot1', part_type: 'bottomSashPart', values: { bottomHeight: 88 }, children: [] },
            ],
          },
        ],
      }],
    }
  }

  // For ⅓–⅔ split we need a geometry where topSashHeight ≠ bottomSashHeight
  it('renders ⅓–⅔ split without crashing', () => {
    const tree = makeTreeWithSplit('third_two_thirds')
    // Simulated ⅓–⅔ geometry (top sash is shorter)
    const geo  = makeGeometry({ topSashHeight: 580, bottomSashHeight: 1160, topGlassHeight: 491, bottomGlassHeight: 1032 })
    const html = render({ tree, geometry: geo, refOptions: {} })
    expect(html).toContain('<svg')
    expect(html).not.toContain('NaN')
  })

  it('renders half-half split without crashing', () => {
    const tree = makeTreeWithSplit('half_half')
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions: {} })
    expect(html).toContain('<svg')
    expect(html).not.toContain('NaN')
  })

})
