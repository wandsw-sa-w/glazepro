import { describe, it, expect } from 'vitest'
import { buildItemDetailModel, frameDimensions } from './itemDetailModel.js'
import { QUOTE_CONTENT } from './quoteContent.js'

// ── Fixture helpers ──────────────────────────────────────────────────────────

function makeTree(overrides = {}) {
  return {
    part_type: 'drawingItemPart',
    values: { typeOfWork: 'complete_new' },
    children: [
      {
        part_type: 'assemblyFramePart',
        values: { width: overrides.width ?? 1075, height: overrides.height ?? 1630 },
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
      { part_type: 'notesPart', values: { installationNotes: 'Install from inside', productionNotes: 'Check cill depth' }, children: [] },
    ],
  }
}

function makeItem(n, treeOverrides = {}) {
  return {
    job_item: { id: `ji${n}`, item_number: n, floor_level: 'Ground Floor', elevation: 'Rear', room_name: `Room ${n}` },
    drawing: { id: `dwg${n}`, drawing_number: n, window_type: 'Box Sash' },
    parts_tree: makeTree(treeOverrides),
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
    },
    salesperson: { full_name: 'Jane Doe', initials: 'JD' },
    generated_by: 'NS',
    quote_settings: { discount_pct: 0, valid_days: 30 },
    content: QUOTE_CONTENT,
    totals: {},
    ref_labels: { argon: 'Argon', white: 'White', clean_white: 'Clean White', custom_horn: 'Custom Horn', no_horn: 'No Horn' },
    items,
    ...overrides,
  }
}

// ── frameDimensions ──────────────────────────────────────────────────────────

describe('frameDimensions', () => {
  it('extracts width and height from the tree', () => {
    const dims = frameDimensions(makeTree({ width: 1075, height: 1630 }))
    expect(dims.width).toBe(1075)
    expect(dims.height).toBe(1630)
  })

  it('returns nulls for null tree', () => {
    const dims = frameDimensions(null)
    expect(dims.width).toBeNull()
    expect(dims.height).toBeNull()
  })

  it('returns nulls when no assemblyFramePart', () => {
    const tree = { part_type: 'drawingItemPart', values: {}, children: [] }
    const dims = frameDimensions(tree)
    expect(dims.width).toBeNull()
    expect(dims.height).toBeNull()
  })
})

// ── buildItemDetailModel ─────────────────────────────────────────────────────

describe('buildItemDetailModel — basics', () => {
  it('title is "Item Detail Sheet"', () => {
    const model = buildItemDetailModel(makeSnapshot())
    expect(model.title).toBe('Item Detail Sheet')
  })

  it('has quoteRef and leadRef', () => {
    const model = buildItemDetailModel(makeSnapshot())
    expect(model.quoteRef).toBe('L507712 / Q1')
    expect(model.leadRef).toBe('L507712')
  })

  it('items have no price fields', () => {
    const model = buildItemDetailModel(makeSnapshot(3))
    for (const item of model.items) {
      expect(item.priceLabel).toBeUndefined()
      expect(item.net).toBeUndefined()
      expect(item.poa).toBeUndefined()
    }
  })

  it('the rendered model contains no pound sign anywhere', () => {
    const model = buildItemDetailModel(makeSnapshot(3))
    const json = JSON.stringify(model)
    expect(json).not.toContain('\u00a3')
    expect(json).not.toMatch(/£/)
  })
})

describe('buildItemDetailModel — frame dimensions', () => {
  it('overall frame width and height appear on the sheet', () => {
    const model = buildItemDetailModel(makeSnapshot(1))
    expect(model.items[0].frameWidth).toBe(1075)
    expect(model.items[0].frameHeight).toBe(1630)
  })

  it('different items can have different dimensions', () => {
    const items = [
      makeItem(1, { width: 900, height: 1200 }),
      makeItem(2, { width: 1100, height: 1800 }),
    ]
    const snap = makeSnapshot(2, { items })
    const model = buildItemDetailModel(snap)
    expect(model.items[0].frameWidth).toBe(900)
    expect(model.items[0].frameHeight).toBe(1200)
    expect(model.items[1].frameWidth).toBe(1100)
    expect(model.items[1].frameHeight).toBe(1800)
  })
})

describe('buildItemDetailModel — 1 item per page', () => {
  it('each item is its own entry (no grouping)', () => {
    const model = buildItemDetailModel(makeSnapshot(5))
    expect(model.items).toHaveLength(5)
  })
})

describe('buildItemDetailModel — notes', () => {
  it('includes installation notes from notesPart', () => {
    const model = buildItemDetailModel(makeSnapshot(1))
    expect(model.items[0].installationNotes).toBe('Install from inside')
  })

  it('includes production notes from notesPart', () => {
    const model = buildItemDetailModel(makeSnapshot(1))
    expect(model.items[0].productionNotes).toBe('Check cill depth')
  })
})

describe('buildItemDetailModel — spec sections', () => {
  it('each item has heading and specSections', () => {
    const model = buildItemDetailModel(makeSnapshot(2))
    for (const item of model.items) {
      expect(item.heading).toBeDefined()
      expect(item.heading).toContain('Supply & Install')
      expect(item.specSections.length).toBeGreaterThan(0)
    }
  })
})
