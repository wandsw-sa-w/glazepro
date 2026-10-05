import { describe, it, expect } from 'vitest'
import { buildSowModel } from './scheduleOfWorkModel.js'
import { QUOTE_CONTENT } from './quoteContent.js'

// ── Fixture helpers ──────────────────────────────────────────────────────────

function makeTree(overrides = {}) {
  return {
    part_type: 'drawingItemPart',
    values: { typeOfWork: 'complete_new', ...overrides.drawingItem },
    children: [
      {
        part_type: 'assemblyFramePart',
        values: { width: 1075, height: 1630 },
        children: [
          {
            part_type: 'sashPairPart',
            values: { topHornTypeShortName: 'custom_horn', bottomHornTypeShortName: 'no_horn' },
            children: [
              { part_type: 'topSashPart', values: {}, children: [
                { part_type: 'glassPart', values: { glassType: 'double_glazed', innerPane: '4mm Clear', outerPane: '4mm Clear', gasType: 'argon', spacerColour: 'White', toughened_inner: false, toughened_outer: true, lowE: 'Pilkington K' }, children: [] },
              ] },
              { part_type: 'bottomSashPart', values: {}, children: [
                { part_type: 'glassPart', values: { glassType: 'double_glazed', innerPane: '4mm Clear', outerPane: '4mm Clear', gasType: 'argon', spacerColour: 'White', toughened_inner: false, toughened_outer: true, lowE: 'Pilkington K' }, children: [] },
              ] },
            ],
          },
          { part_type: 'frameMaterialPart', values: { timberType: 'Accoya' }, children: [] },
          { part_type: 'sashMaterialPart', values: { timberType: 'Accoya' }, children: [] },
          { part_type: 'cillPart', values: { timberType: 'Accoya' }, children: [] },
          { part_type: 'mouldingPart', values: { profile: 'ovolo', glazingBarWidth: 22 }, children: [] },
        ],
      },
      { part_type: 'paintAndIronmongeryPart', values: { internalFinish: 'clean_white', externalFinish: 'clean_white' }, children: [] },
      { part_type: 'notesPart', values: {}, children: [] },
    ],
  }
}

function makeItem(n) {
  return {
    job_item: { id: `ji${n}`, item_number: n, floor_level: 'Ground Floor', elevation: 'Rear', room_name: `Room ${n}` },
    drawing: { id: `dwg${n}`, drawing_number: n, window_type: 'Box Sash' },
    parts_tree: makeTree(),
    net: 1500,
    net_after_quote_discount: 1500,
    vat: 300,
    vat_rate: 20,
    poa: false,
    location_text: `Ground Floor Rear Room ${n}`,
    ironmongery: [],
    allocated_parts: [],
    profile_label: null,
  }
}

function makeSnapshot(itemCount = 1, overrides = {}) {
  const items = Array.from({ length: itemCount }, (_, i) => makeItem(i + 1))
  return {
    version: 2,
    published_at: '2026-09-15T10:00:00.000Z',
    lead_number: 'L507712',
    quote_number: 'Q1',
    lead: {
      customer_forename: 'John',
      customer_surname: 'Smith',
      contact_name: 'Mr John Smith',
      installation_address_one_line: '12 Test Road, London, SW1 1AA',
      postal_address_lines: ['12 Test Road', 'London', 'SW1 1AA'],
      phone: '07700 900123',
      email: 'john@example.com',
    },
    salesperson: { full_name: 'Jane Doe', initials: 'JD' },
    generated_by: 'NS',
    quote_settings: { discount_pct: 0, valid_days: 30 },
    content: QUOTE_CONTENT,
    totals: {
      subtotal_before_discount: 1500 * itemCount,
      total_incl_vat: 1800 * itemCount,
    },
    ref_labels: { argon: 'Argon', white: 'White', clean_white: 'Clean White', custom_horn: 'Custom Horn', no_horn: 'No Horn' },
    items,
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('buildSowModel — basics', () => {
  it('title is "Schedule of Work"', () => {
    const model = buildSowModel(makeSnapshot())
    expect(model.title).toBe('Schedule of Work')
  })

  it('has quoteRef', () => {
    const model = buildSowModel(makeSnapshot())
    expect(model.quoteRef).toBe('L507712 / Q1')
  })

  it('items have no price fields', () => {
    const model = buildSowModel(makeSnapshot(3))
    for (const item of model.items) {
      expect(item.priceLabel).toBeUndefined()
      expect(item.net).toBeUndefined()
      expect(item.poa).toBeUndefined()
    }
  })

  it('the rendered model contains no pound sign anywhere', () => {
    const model = buildSowModel(makeSnapshot(3))
    const json = JSON.stringify(model)
    expect(json).not.toContain('\u00a3') // £
    expect(json).not.toMatch(/£/)
  })
})

describe('buildSowModel — page grouping', () => {
  it('7 items produces 3 pages (3+3+1)', () => {
    const model = buildSowModel(makeSnapshot(7))
    expect(model.itemPages).toHaveLength(3)
    expect(model.itemPages[0]).toHaveLength(3)
    expect(model.itemPages[1]).toHaveLength(3)
    expect(model.itemPages[2]).toHaveLength(1)
  })

  it('3 items produces 1 page', () => {
    const model = buildSowModel(makeSnapshot(3))
    expect(model.itemPages).toHaveLength(1)
    expect(model.itemPages[0]).toHaveLength(3)
  })

  it('0 items produces 0 pages', () => {
    const model = buildSowModel(makeSnapshot(0))
    expect(model.itemPages).toHaveLength(0)
  })
})

describe('buildSowModel — header modes', () => {
  it('customer header mode shows customer details', () => {
    const model = buildSowModel(makeSnapshot(), { headerMode: 'customer' })
    expect(model.header.mode).toBe('customer')
    expect(model.header.contactName).toBe('Mr John Smith')
    expect(model.header.address).toContain('Test Road')
  })

  it('company header mode shows company details', () => {
    const model = buildSowModel(makeSnapshot(), { headerMode: 'company' })
    expect(model.header.mode).toBe('company')
    expect(model.header.line1).toContain('Wandsworth')
  })

  it('defaults to customer header', () => {
    const model = buildSowModel(makeSnapshot())
    expect(model.header.mode).toBe('customer')
  })
})

describe('buildSowModel — items have spec sections', () => {
  it('each item has heading and specSections', () => {
    const model = buildSowModel(makeSnapshot(2))
    for (const item of model.items) {
      expect(item.heading).toBeDefined()
      expect(item.heading).toContain('Supply & Install')
      expect(item.specSections.length).toBeGreaterThan(0)
    }
  })

  it('each item has itemNumber and location', () => {
    const model = buildSowModel(makeSnapshot(2))
    expect(model.items[0].itemNumber).toBe(1)
    expect(model.items[1].itemNumber).toBe(2)
    expect(model.items[0].location).toContain('Room 1')
  })
})
