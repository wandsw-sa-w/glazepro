// ironmongeryPanel.test.jsx — Step BO
//
// The picker has to be REACHABLE and has to render. Step BJ's Bi-Glass
// shipped unreachable because the offline tests drove the module and never
// the control: "+ Add manual line" was exactly the same kind of gap — the
// module could hold a set and the board could not put a product in one.
//
// These are static renders (there is no DOM testing library in this repo),
// so what they prove is that the control is there, that the panel says which
// lines come from where, and that the picker lists the catalogue with its
// costs and refuses to add a line whose finish nobody has chosen. The
// clicking is covered live in e2e/ironmongery-picker.spec.js.

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { IronmongeryPanel, IronmongeryPicker } from './DrawingBoard.jsx'

const PRODUCTS = [
  { short_name: 'connoisseur_handle_lh', name: 'Connoisseur Handle LH', category: 'Casement Handle',
    finishes: [{ code: 'PB', cost: 7.55 }, { code: 'PC', cost: 7.55 }] },
  { short_name: 'kenrick_extension_gear_box', name: 'Kenrick Extension Gear Box', category: null,
    finishes: [{ code: 'PC', cost: 7.35 }] },
  { short_name: 'trickle_vent_xr16', name: 'Trickle Vent XR16', category: null,
    finishes: [{ code: 'Blk', cost: 3.25 }, { code: 'Wht', cost: 3.25 }] },
]

function treeWith(lines, extra = {}) {
  return {
    key: 'root', part_type: 'drawingItemPart', values: { typeOfWork: 'complete_new' },
    children: [{
      key: 'paint', part_type: 'paintAndIronmongeryPart',
      values: { ironmongeryFinish: 'PB', ironmongeryLines: lines, ...extra },
      children: [],
    }],
  }
}

function renderPanel(lines, extra = {}) {
  const tree = treeWith(lines, extra)
  return renderToStaticMarkup(createElement(IronmongeryPanel, {
    node: tree.children[0], tree, derived: {}, refOptions: {},
    onChangeField: () => {}, onAutoApplyDefaults: () => {},
    onChangeIronmongerySet: () => {},
    ironmongeryRules: [], ironmongeryProducts: PRODUCTS,
    profileValueMap: {}, profileCode: 'casement',
  }))
}

describe('Step BO — the panel', () => {
  it('offers "+ Add line", not a line with no product', () => {
    const markup = renderPanel([])
    expect(markup).toContain('+ Add line')
    expect(markup).not.toContain('Add manual line')
    expect(markup).toContain('data-testid="ironmongery-add-line"')
  })

  it('says a set with chosen lines is the STORED set, line by line', () => {
    const markup = renderPanel([
      { product_short_name: 'connoisseur_handle_lh', finish_code: null, qty: 1, source: 'picked' },
      { product_short_name: 'trickle_vent_xr16', finish_code: 'Wht', qty: 1, source: 'default' },
    ])
    expect(markup).toContain('Stored set')
    expect(markup).toContain('data-edited="true"')
    // and the rules still allocate on top of it
    expect(markup).toContain('MPLS keep')
    expect(markup).toContain('chosen')
    expect(markup).toContain('rule default')
  })

  it('says a set the surveyor has not touched is the rule defaults', () => {
    const markup = renderPanel([
      { product_short_name: 'trickle_vent_xr16', finish_code: '', qty: 1, source: 'default' },
    ])
    expect(markup).toContain('Rule defaults')
    expect(markup).toContain('data-edited="false"')
  })

  it('reads a set emptied by hand as edited, so nothing re-defaults it', () => {
    const markup = renderPanel([], { ironmongerySetEdited: true })
    expect(markup).toContain('data-edited="true"')
  })

  it('still renders without the new handler (any caller that has not been given it)', () => {
    const tree = treeWith([])
    expect(() => renderToStaticMarkup(createElement(IronmongeryPanel, {
      node: tree.children[0], tree, derived: {}, refOptions: {},
      onChangeField: () => {}, onAutoApplyDefaults: () => {},
      ironmongeryRules: [], ironmongeryProducts: null,
      profileValueMap: {}, profileCode: 'casement',
    }))).not.toThrow()
  })
})

describe('Step BO — the picker', () => {
  const markup = renderToStaticMarkup(createElement(IronmongeryPicker, {
    products: PRODUCTS, itemFinish: 'PB', onAdd: () => {}, onClose: () => {},
  }))

  it('lists the catalogue by category, with each product’s unit cost', () => {
    expect(markup).toContain('Casement Handle')
    expect(markup).toContain('Uncategorised')
    expect(markup).toContain('Connoisseur Handle LH')
    expect(markup).toContain('connoisseur_handle_lh')          // searchable by code
    expect(markup).toContain('PB — £7.55')
    expect(markup).toContain('PC — £7.35')
  })

  it('searches, and says which finish each line will price in', () => {
    expect(markup).toContain('Search by name or code')
    expect(markup).toContain('Item finish PB')
    // the one product the picker has to ASK about: Wht or Blk on a PB item
    expect(markup).toContain('Choose a finish…')
  })

  it('will not add a line until that finish is chosen', () => {
    // The disabled Add button on the trickle vent's row — a guessed finish
    // is a wrong price nobody sees (Step Z).
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>Add<\/button>/)
  })
})
