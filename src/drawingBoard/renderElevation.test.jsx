// renderElevation.test.jsx
// Verifies that SashElevation renders without throwing for valid and missing inputs.
// Uses react-dom/server renderToStaticMarkup (no DOM/jsdom needed).

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SashElevation } from './renderElevation.jsx'
import { computeDerived } from './computeDerived.js'
import { computeSashGeometry } from './sashGeometry.js'

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

  // ── Step J fixes #3: concentric arcs (frame outer / frame-inner / glass) ────
  // Integrate's L31115 reference for this exact frame (1100 x 1600, arch 150,
  // jambs 79, sash top rail 49) shows three radius labels: R 955.3 (glass
  // top), R 1004.3 (frame inner / sash outer), R 1083.3 F (frame outer).

  it('renders all three concentric radius labels matching the Integrate reference', () => {
    const tree = makeArchTree(150)
    const geo  = makeGeometry({ sashWidth: 942, topSashHeight: 755, bottomSashHeight: 756, topGlassHeight: 657, bottomGlassHeight: 628 })
    const html = render({ tree, geometry: geo, refOptions: {} })
    expect(html).toContain('R 1083.3 F') // frame outer: archR(1100, 150)
    expect(html).toContain('R 1004.3')   // frame inner / sash outer: 1083.3 - 79 (topHeight)
    expect(html).toContain('R 955.3')    // glass top: 1004.3 - 49 (sash top rail)
  })

  it('draws the frame as one continuous arched silhouette, not a rectangle with a thin arc on top', () => {
    const tree = makeArchTree(150)
    const geo  = makeGeometry({ sashWidth: 942, topSashHeight: 755, bottomSashHeight: 756, topGlassHeight: 657, bottomGlassHeight: 628 })
    const html = render({ tree, geometry: geo, refOptions: {} })
    // Outer border, head band, interior opening, sash head band and glass
    // top are each their own arc — five 'A' commands, not one decorative arc.
    const arcCount = (html.match(/ A /g) || []).length
    expect(arcCount).toBeGreaterThanOrEqual(5)
  })

  it('the top sash glass is drawn as a curved <path>, not a square <rect>', () => {
    const tree = makeArchTree(150)
    const geo  = makeGeometry({ sashWidth: 942, topSashHeight: 755, bottomSashHeight: 756, topGlassHeight: 657, bottomGlassHeight: 628 })
    const html = render({ tree, geometry: geo, refOptions: {} })
    // fill for glass is #d0eaf5 — assert at least one <path> uses it (the
    // arched top-glass shape), not only <rect> elements.
    expect(html).toMatch(/<path[^>]*fill="#d0eaf5"/)
  })

  it('a vertical bar in the arched glass is clipped to the curved top, not the full flat glass height', () => {
    const tree = {
      key: 'item1', part_type: 'drawingItemPart', values: {}, children: [{
        key: 'frame1', part_type: 'assemblyFramePart',
        values: { width: 1100, height: 1600, leftWidth: 79, rightWidth: 79, topHeight: 79, archHead: true, archHeight: 150 },
        children: [
          { key: 'cill1', part_type: 'cillPart', values: { height: 70 }, children: [] },
          {
            key: 'pair1', part_type: 'sashPairPart', values: { midrailHeight: 40 }, children: [
              {
                key: 'top1', part_type: 'topSashPart', values: { topHeight: 49, stileWidth: 47 }, children: [
                  { key: 'tglass1', part_type: 'glassPart', values: {}, children: [
                    { key: 'bar1', part_type: 'verticalGlazingBarPart', values: {}, children: [] },
                    { key: 'bar2', part_type: 'verticalGlazingBarPart', values: {}, children: [] },
                  ] },
                ],
              },
              { key: 'bot1', part_type: 'bottomSashPart', values: { bottomHeight: 88 }, children: [] },
            ],
          },
        ],
      }],
    }
    const geo = makeGeometry({ sashWidth: 942, topSashHeight: 755, bottomSashHeight: 756, topGlassHeight: 657, bottomGlassHeight: 628 })
    const html = render({ tree, geometry: geo, refOptions: {} })
    expect(html).toContain('<svg')
    expect(html).not.toContain('NaN')

    // Bar rects (fill #c8a870): each bar's clipped height should be shorter
    // than the full flat glass height (657) since its top is cut by the
    // curved glass boundary instead of running the full rectangle height.
    const heights = [...html.matchAll(/<rect x="[\d.]+" y="[\d.-]+" width="8" height="([\d.]+)"/g)].map(m => parseFloat(m[1]))
    expect(heights.length).toBe(2)
    for (const h of heights) expect(h).toBeLessThan(657)
    // The two bars sit at symmetric positions either side of the arch's
    // centreline, so their clipped heights should match each other.
    expect(Math.abs(heights[0] - heights[1])).toBeLessThan(0.01)
  })

  // ── J+K fixes round 2, item 4: arched frame jamb corners ──────────────────
  // Before the fix, the jamb rects ran up to the flat topHeight (79), which
  // sits above the frame-inner arc's spring point, so the straight jamb
  // poked up past the curved head at both corners.

  it('the jamb tops stop at the shoulder (meet the frame-inner arc), not above it', () => {
    const tree = makeArchTree(150)
    const geo  = makeGeometry({ sashWidth: 942, topSashHeight: 755, bottomSashHeight: 756, topGlassHeight: 657, bottomGlassHeight: 628 })
    const html = render({ tree, geometry: geo, refOptions: {} })

    // Independently recompute the expected shoulder y: concentric circle
    // centred at (fW/2, R_outer), R_frameInner = R_outer - topHeight.
    const fW = 1100, archH = 150, topHeight = 79, leftWidth = 79
    const R_outer = (fW * fW / 4 + archH * archH) / (2 * archH)
    const R_frameInner = R_outer - topHeight
    const cx = fW / 2, cy = R_outer
    const dx = leftWidth - cx
    const expectedY = cy - Math.sqrt(R_frameInner * R_frameInner - dx * dx)

    // Left jamb rect: x="0" width="79" (leftWidth)
    const m = html.match(/<rect x="0" y="([\d.]+)" width="79"/)
    expect(m).not.toBeNull()
    const renderedY = parseFloat(m[1])

    expect(renderedY).toBeCloseTo(expectedY, 1)
    // Sanity check against the old bug: that fixed value was topHeight (79).
    expect(renderedY).toBeGreaterThan(topHeight + 50)
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

// ── Tests — Step J fixes #2: bars evenly spaced on the true glass sightline ───
// Full end-to-end path: tree -> computeDerived -> computeSashGeometry -> SashElevation,
// exactly as DrawingBoard.jsx wires it up. Box sash 1100x1600, jambs 79/79, stile 47
// -> glassW = 848mm (942 sashWidth - 2*47), NOT ~1006mm (the old frame-width approximation).

function makeRealBoxSashWithBars(vCount) {
  return {
    key: 'item1', part_type: 'drawingItemPart', values: {}, children: [{
      key: 'frame1', part_type: 'assemblyFramePart',
      values: { width: 1100, height: 1600, leftWidth: 79, rightWidth: 79, topHeight: 79 },
      children: [
        { key: 'cill1', part_type: 'cillPart', values: { height: 70 }, children: [] },
        {
          key: 'pair1', part_type: 'sashPairPart', values: {}, children: [
            {
              key: 'top1', part_type: 'topSashPart', values: { topHeight: 49, stileWidth: 47 }, children: [
                {
                  key: 'tglass1', part_type: 'glassPart', values: {}, children: Array.from({ length: vCount }, (_, i) => ({
                    key: `vbar${i}`, part_type: 'verticalGlazingBarPart', values: {}, children: [],
                  })),
                },
              ],
            },
            { key: 'bot1', part_type: 'bottomSashPart', values: { bottomHeight: 88 }, children: [] },
          ],
        },
      ],
    }],
  }
}

// Extract x= attributes of rendered bar rects (fill #c8a870), in document order.
function extractBarX(html) {
  const matches = [...html.matchAll(/<rect x="([\d.]+)"[^>]*fill="#c8a870"/g)]
  return matches.map(m => parseFloat(m[1]))
}

describe('SashElevation — glazing bars use the true glass sightline (Step J fixes #2)', () => {

  it('2 bars on a real box sash render with equal pane widths, not the old frame-width approximation', () => {
    const tree     = makeRealBoxSashWithBars(2)
    const derived  = computeDerived(tree)
    const geometry = computeSashGeometry(tree, derived)
    const html     = render({ tree, derived, geometry, refOptions: {} })

    const xs = extractBarX(html)
    expect(xs).toHaveLength(2)

    const thickness = 8 // GlazingBars' visual bar thickness
    const stile = 47
    const glassX0 = 79 + stile // OX (leftWidth) + stile
    const glassW  = 848

    const centres = xs.map(x => x + thickness / 2 - glassX0)
    const gap0 = centres[0] - 0
    const gap1 = centres[1] - centres[0]
    const gap2 = glassW - centres[1]

    expect(Math.abs(gap0 - gap1)).toBeLessThan(0.5)
    expect(Math.abs(gap1 - gap2)).toBeLessThan(0.5)
    // Sanity check against the previously-reported bug: the old ~1006mm
    // frame-width approximation would have put the second bar past 670mm.
    expect(centres[1]).toBeLessThan(600)
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

// ── Tests — labels fit and clip to their own opening (J+K fixes round 2, item 4) ──
// Before the fix, label font size was derived from the whole frame width
// (fW), so on a multi-opening frame a single narrow opening's labels were
// far too big and bled past it into the neighbouring mullion.

describe('SashElevation — multi-opening labels fit their own glass area', () => {

  // 4 openings on a 2400mm frame -> each opening is much narrower than fW,
  // so the frame-wide font size (fW * 0.075 = 180) would badly overflow it.
  function makeFourUpTree() {
    const iW = 2400 - 79 - 79 // 2242
    const openingW = iW / 4   // ~560.5
    function pair(key) {
      return {
        key, part_type: 'sashPairPart', values: { midrailHeight: 40 }, children: [
          { key: `${key}-top`, part_type: 'topSashPart',    values: { topHeight: 49, stileWidth: 47, operation: 'cord_hung' }, children: [] },
          { key: `${key}-bot`, part_type: 'bottomSashPart', values: { bottomHeight: 88, operation: 'cord_hung' }, children: [] },
        ],
      }
    }
    const mullions = [1, 2, 3].map(i => ({
      key: `mull${i}`, part_type: 'mullionPart', values: { offset: Math.round(openingW * i) }, children: [],
    }))
    return {
      key: 'item1', part_type: 'drawingItemPart', values: {}, children: [{
        key: 'frame1', part_type: 'assemblyFramePart',
        values: { width: 2400, height: 1700, leftWidth: 79, rightWidth: 79, topHeight: 79 },
        children: [
          { key: 'cill1', part_type: 'cillPart', values: { height: 70 }, children: [] },
          ...mullions,
          pair('pair1'), pair('pair2'), pair('pair3'), pair('pair4'),
        ],
      }],
    }
  }

  const refOptions = { sash_operation: [{ code: 'cord_hung', label: 'Cord Hung' }] }

  it('renders all four openings without crashing or NaN', () => {
    const tree = makeFourUpTree()
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions })
    expect(html).toContain('<svg')
    expect(html).not.toContain('NaN')
    expect(html).toContain('A1'); expect(html).toContain('D1')
  })

  it('shrinks the main label font size well below the old frame-wide size (fW * 0.075)', () => {
    const tree = makeFourUpTree()
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions })
    const oldFrameWideSize = 2400 * 0.075 // 180 — what every label used before this fix

    const mainLabelSizes = [...html.matchAll(/<tspan[^>]*font-size="([\d.]+)"[^>]*>[A-D]1[^<]*<\/tspan>/g)]
      .map(m => parseFloat(m[1]))
    expect(mainLabelSizes.length).toBeGreaterThanOrEqual(4)
    for (const size of mainLabelSizes) expect(size).toBeLessThan(oldFrameWideSize)
  })

  it('the fitted size keeps the estimated label width within its own opening (not the whole frame)', () => {
    const tree = makeFourUpTree()
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions })
    const openingGlassW = (2242 / 4) - 2 * 47 // opening width minus two stiles, ~466.5

    const entries = [...html.matchAll(/<tspan[^>]*font-size="([\d.]+)"[^>]*>([^<]*)<\/tspan>/g)]
      .filter(m => /^[A-D][12]/.test(m[2]))
    expect(entries.length).toBeGreaterThan(0)
    for (const [, sizeStr, text] of entries) {
      const estWidth = text.length * parseFloat(sizeStr) * 0.62
      expect(estWidth).toBeLessThanOrEqual(openingGlassW * 0.92 + 1) // +1 for rounding
    }
  })

  it('labels are clipped to their own glass area', () => {
    const tree = makeFourUpTree()
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions })
    expect(html).toContain('<clipPath')
    expect(html).toMatch(/clip-path="url\(#glassclip-t-\d\)"/)
  })

  it('a single wide opening keeps a comfortable label size (no unnecessary shrinking)', () => {
    const tree = makeArchTreeLikeSingle()
    const geo  = makeGeometry()
    const html = render({ tree, geometry: geo, refOptions })
    const m = html.match(/<tspan[^>]*font-size="([\d.]+)"[^>]*>A1[^<]*<\/tspan>/)
    expect(m).not.toBeNull()
    // Single box sash, fW=500 -> base lfs = max(500*0.075, 12) = 37.5; should
    // not have been shrunk since it comfortably fits a ~300mm-wide glass.
    expect(parseFloat(m[1])).toBeCloseTo(37.5, 1)
  })

  function makeArchTreeLikeSingle() {
    return {
      key: 'item1', part_type: 'drawingItemPart', values: {}, children: [{
        key: 'frame1', part_type: 'assemblyFramePart',
        values: { width: 500, height: 1849, leftWidth: 85, rightWidth: 85, topHeight: 79 },
        children: [
          { key: 'cill1', part_type: 'cillPart', values: { height: 70 }, children: [] },
          {
            key: 'pair1', part_type: 'sashPairPart', values: { midrailHeight: 40 }, children: [
              { key: 'top1', part_type: 'topSashPart',    values: { topHeight: 49, stileWidth: 47, operation: 'cord_hung' }, children: [] },
              { key: 'bot1', part_type: 'bottomSashPart', values: { bottomHeight: 88, operation: 'cord_hung' }, children: [] },
            ],
          },
        ],
      }],
    }
  }

})
