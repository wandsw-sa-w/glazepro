// doorElevation.test.jsx — Step BH follow-up item 3
//
// A FRENCH LEAF'S OWN GRID, drawn.
//
// Live drawing 54 (Pair Of Front Doors) saved and priced correctly — each leaf
// a 170 mid rail with a flat panel above and below — and the board drew each
// leaf as one pane of glass. The pair branch drew a leaf as a casement sash
// and never asked whether it had a grid, which is the same thing Step BE fixed
// for a side light and Step BF for a stable half: `gridRectsFor` is the gate.
//
// It matters for a French door with PANELS too (FD4: glass over a mid rail
// with a panel below), which the same branch draws.

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { SashElevation } from './renderElevation.jsx'
import { computeDerived } from './computeDerived.js'
import {
  buildFrontDoorPairFrame, buildFrenchDoorFrame, buildPanelledFrenchDoorFrame,
  buildFrontDoorFrame,
} from './doorOpenings.js'
import { prepareTemplateTree } from './templates.js'
import { OPEN_IN_PROFILE_VALUES as PV, DOOR_PROFILE_VALUES as OUT_PV } from '../pricing/benchmarks/fixtureDoor.js'

const PANEL_FILL = '#e8d9bd'
const GLASS_FILL = '#d0eaf5'

/** The markup, as the board renders it. */
function svgOf(tree) {
  return renderToStaticMarkup(createElement(SashElevation, {
    tree,
    derived: computeDerived(tree),
    geometry: null,
    settings: { showGlassLabels: true },
  }))
}
const countFill = (svg, fill) => svg.split(`fill="${fill}"`).length - 1

describe('Step BH follow-up — a French leaf is drawn with its grid', () => {
  it('a PAIR OF FRONT DOORS draws four panels, not two panes of glass', () => {
    const { tree } = prepareTemplateTree(buildFrontDoorPairFrame(PV, {}).tree)
    const svg = svgOf(tree)
    // two leaves x (one panel above the mid rail, one below)
    expect(countFill(svg, PANEL_FILL)).toBe(4)
    // and no glass at all: both leaves are panelled throughout
    expect(countFill(svg, GLASS_FILL)).toBe(0)
  })

  it('a FRENCH DOOR WITH PANELS draws glass over a panel on each leaf', () => {
    const built = buildPanelledFrenchDoorFrame(OUT_PV, {})
    expect(built.missing ?? []).toEqual([])
    const { tree } = prepareTemplateTree(built.tree)
    const svg = svgOf(tree)
    // FD4: one panel under the mid rail of each leaf, glass above it
    expect(countFill(svg, PANEL_FILL)).toBe(2)
    expect(countFill(svg, GLASS_FILL)).toBe(2)
  })

  it('a plain French pair is unchanged — one pane each, no panel', () => {
    const { tree } = prepareTemplateTree(buildFrenchDoorFrame(OUT_PV, {}).tree)
    const svg = svgOf(tree)
    expect(countFill(svg, PANEL_FILL)).toBe(0)
    expect(countFill(svg, GLASS_FILL)).toBe(2)
  })

  it('a single front door still draws its four panels', () => {
    // the Step BD path, so the two branches cannot drift apart
    const { tree } = prepareTemplateTree(buildFrontDoorFrame(PV, {}).tree)
    expect(countFill(svgOf(tree), PANEL_FILL)).toBe(4)
  })

  it('every cell is clickable, and the MASTER is still marked', () => {
    const { tree } = prepareTemplateTree(buildFrontDoorPairFrame(PV, {}).tree)
    const svg = svgOf(tree)
    expect(svg).toContain('MASTER')
    // a panel cell carries the panel stroke, which is what makes it visible
    // as a panel rather than a hole in the leaf
    expect(svg).toContain('#8b6840')
  })

  it('the cells stay inside the leaf they belong to', () => {
    // The drawn leaf of a PAIR is half the opening less the gap, while the
    // real leaf is wider by the meeting-stile overlap — so the grid is laid
    // out in PROPORTION inside the leaf that is drawn. Whatever the
    // convention, no cell may stick out of its leaf.
    const { tree } = prepareTemplateTree(buildFrontDoorPairFrame(PV, {}).tree)
    const svg = svgOf(tree)
    const rects = [...svg.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/g)]
      .map(m => ({ x: +m[1], y: +m[2], width: +m[3], height: +m[4] }))
    const panels = [...svg.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"[^>]*fill="#e8d9bd"/g)]
      .map(m => ({ x: +m[1], y: +m[2], width: +m[3], height: +m[4] }))
    expect(panels.length).toBe(4)
    // the widest rect is the frame; every panel sits within it
    const frame = rects.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b))
    for (const p of panels) {
      expect(p.width).toBeGreaterThan(0)
      expect(p.height).toBeGreaterThan(0)
      expect(p.x).toBeGreaterThanOrEqual(frame.x - 0.01)
      expect(p.y).toBeGreaterThanOrEqual(frame.y - 0.01)
      expect(p.x + p.width).toBeLessThanOrEqual(frame.x + frame.width + 0.01)
      expect(p.y + p.height).toBeLessThanOrEqual(frame.y + frame.height + 0.01)
    }
  })
})
