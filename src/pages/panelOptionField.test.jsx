// panelOptionField.test.jsx — Step BP item 0 (extra)
//
// A panel's type and bead were NUMBER boxes (the field definition says
// number), which is how drawing 105's panel 5379 was blanked to null. On
// every panelPart they are now dropdowns of Integrate's own lists, a stored
// id or a code selects the same entry, and null reads "— select —" with a
// note that it prices as flat / ovolo until set. Static renders, as the
// other control tests are.

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PropertyField } from './DrawingBoard.jsx'

const field = (key, label) => ({
  field_key: key, property_name: key.split('.').pop(), label, data_type: 'number', role: 'input',
})
const render = (f, value) => renderToStaticMarkup(createElement(PropertyField, {
  field: f, value, onChange: () => {}, refOptions: {}, partType: 'panelPart',
}))
/** The value of the option React marked selected (attribute order varies). */
const selectedValue = markup => {
  const tag = markup.match(/<option[^>]*\bselected=""[^>]*>/)?.[0] ?? ''
  return tag.match(/value="([^"]*)"/)?.[1] ?? null
}

describe('Step BP — panel type and bead are dropdowns on every panelPart', () => {
  it('the type is a list of Integrate’s four, not a number box', () => {
    const markup = render(field('panelPart.internalPanelTypeId', 'Internal panel type'), 110)
    expect(markup).toContain('data-testid="panel-type"')
    expect(markup).not.toContain('type="number"')
    for (const label of ['Flat (110)', 'Raised &amp; fielded (112)',
      'Vertical tongue &amp; groove (114)', 'Horizontal tongue &amp; groove (116)']) {
      expect(markup).toContain(label)
    }
    // a stored Integrate id selects its entry
    expect(selectedValue(markup)).toBe('flat')
  })

  it('a code selects the same entry as the id', () => {
    const markup = render(field('panelPart.externalPanelTypeId', 'External panel type'), 'raised_and_fielded')
    expect(selectedValue(markup)).toBe('raised_and_fielded')
  })

  it('the bead is a list of ovolo / bolection / bespoke', () => {
    const markup = render(field('panelPart.externalPanelBeadId', 'External bead'), 126)
    expect(markup).toContain('data-testid="panel-bead"')
    expect(markup).toContain('Ovolo (120)')
    expect(markup).toContain('Bolection (126)')
    expect(markup).toContain('Bespoke (320)')
    expect(selectedValue(markup)).toBe('bolection')
  })

  it('null shows "— select —" and says it prices as flat until set', () => {
    const markup = render(field('panelPart.internalPanelTypeId', 'Internal panel type'), null)
    expect(markup).toContain('— select —')
    expect(markup).toContain('priced as flat until it is')
    expect(selectedValue(markup)).toBe('')
    const bead = render(field('panelPart.internalPanelBeadId', 'Internal bead'), null)
    expect(bead).toContain('priced as ovolo until it is')
  })

  it('an ordinary number field is still a number box', () => {
    const markup = render(field('panelPart.insulationThickness', 'Insulation'), 15)
    expect(markup).toContain('type="number"')
    expect(markup).not.toContain('— select —')
  })
})
