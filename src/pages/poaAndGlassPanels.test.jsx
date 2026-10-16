// poaAndGlassPanels.test.jsx — Step BS
//
// The two controls have to be REACHABLE and render (the Step BJ lesson:
// Bi-Glass shipped unreachable because only the module was tested). Static
// renders, as there is no DOM testing library here: the tick is on a glass
// unit and says what it does; the POA table shows its lines, its types and
// categories, and the totals it adds.

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SpecialGlassPanel, PoaLinesPanel } from './DrawingBoard.jsx'
import { partLabelWithFlags, partLabel } from '../drawingBoard/partLabels.js'

describe('Step BS — the special-glass tick', () => {
  it('renders unticked, and says what ticking does', () => {
    const markup = renderToStaticMarkup(createElement(SpecialGlassPanel, {
      node: { key: 'g1', part_type: 'glassPart', values: {} }, onChangeField: () => {},
    }))
    expect(markup).toContain('Special glass (priced separately)')
    expect(markup).toContain('data-testid="special-glass"')
    expect(markup).not.toContain('checked=""')
  })

  it('renders ticked, and says no glass is charged', () => {
    const markup = renderToStaticMarkup(createElement(SpecialGlassPanel, {
      node: { key: 'g1', part_type: 'glassPart', values: { specialGlassDetails: true } },
      onChangeField: () => {},
    }))
    expect(markup).toContain('checked=""')
    expect(markup).toContain('No glass is charged for this unit')
  })

  it('the parts list says so too, and every other label is unchanged', () => {
    const plain   = { key: 'g1', part_type: 'glassPart', values: {} }
    const special = { key: 'g1', part_type: 'glassPart', values: { specialGlassDetails: true } }
    expect(partLabelWithFlags(plain, null)).toBe(partLabel(plain, null))
    expect(partLabelWithFlags(special, null)).toBe('Glazing — special glass')
    const panel = { key: 'p1', part_type: 'panelPart', values: { specialGlassDetails: true } }
    expect(partLabelWithFlags(panel, null)).toBe(partLabel(panel, null))
  })
})

describe('Step BS — the POA lines panel', () => {
  const node = { key: 'price1', part_type: 'pricePart', values: { poaLines: [
    { type: 'labour', category: 'installation', description: 'Frame buried extra rip out time', amount: 180 },
    { type: 'cost', category: 'extra_services', description: 'Crane hire', amount: 250 },
  ] } }

  it('shows the lines with their type, category, description and amount', () => {
    const markup = renderToStaticMarkup(createElement(PoaLinesPanel, { node, onChangeField: () => {} }))
    expect(markup).toContain('Price-on-application lines')
    expect(markup).toContain('Frame buried extra rip out time')
    expect(markup).toContain('Crane hire')
    expect(markup).toContain('Labour (minutes)')
    expect(markup).toContain('Cost (£)')
    expect(markup).toContain('Installation')
    expect(markup).toContain('Extra services')
    expect((markup.match(/data-testid="poa-line"/g) ?? []).length).toBe(2)
  })

  it('totals what the lines add: minutes to fitting, pounds of POA cost', () => {
    const markup = renderToStaticMarkup(createElement(PoaLinesPanel, { node, onChangeField: () => {} }))
    expect(markup).toContain('+180 min fitting')
    expect(markup).toContain('£250.00 POA cost')
  })

  it('offers a labour line and a cost line, and renders with none', () => {
    const markup = renderToStaticMarkup(createElement(PoaLinesPanel, {
      node: { key: 'price1', part_type: 'pricePart', values: {} }, onChangeField: () => {},
    }))
    expect(markup).toContain('data-testid="poa-add-labour"')
    expect(markup).toContain('data-testid="poa-add-cost"')
    expect(markup).toContain('A labour line adds minutes to the fitting hours')
  })
})
