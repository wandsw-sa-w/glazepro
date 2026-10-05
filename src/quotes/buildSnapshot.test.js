import { describe, it, expect } from 'vitest'
import { assembleSnapshot } from './buildSnapshot.js'
import { QUOTE_CONTENT } from './pdf/quoteContent.js'

// ── Fixture data — minimal box sash drawing ─────────────────────────────────

const FIXTURE_TREE = {
  part_type: 'drawingItemPart',
  values: { typeOfWork: 'complete_new' },
  children: [
    {
      part_type: 'assemblyFramePart',
      values: { width: 1075, height: 1630, archHead: false },
      children: [
        {
          part_type: 'sashPairPart',
          values: {},
          children: [
            { part_type: 'topSashPart', values: { operationType: 'cord_hung' }, children: [
              { part_type: 'glassPart', values: { glassType: 'double_glazed', innerPane: '4mm Clear', outerPane: '4mm Clear Toughened', gasType: 'argon', spacerColour: 'White', toughened_inner: false, toughened_outer: true, lowE: 'Pilkington K' }, children: [] },
            ] },
            { part_type: 'bottomSashPart', values: { operationType: 'cord_hung' }, children: [
              { part_type: 'glassPart', values: { glassType: 'double_glazed', innerPane: '4mm Clear', outerPane: '4mm Clear Toughened', gasType: 'argon', spacerColour: 'White', toughened_inner: false, toughened_outer: true, lowE: 'Pilkington K' }, children: [] },
            ] },
          ],
        },
        { part_type: 'frameMaterialPart', values: { timberType: 'Accoya' }, children: [] },
        { part_type: 'sashMaterialPart', values: { timberType: 'Accoya' }, children: [] },
        { part_type: 'cillPart', values: { timberType: 'Accoya', cillHeight: 67 }, children: [] },
        { part_type: 'mouldingPart', values: { profile: 'ovolo', glazingBarWidth: 22 }, children: [] },
        { part_type: 'hornPart', values: { topHorn: 'custom_horn', bottomHorn: 'no_horn' }, children: [] },
      ],
    },
  ],
}

function makeData(overrides = {}) {
  return {
    quote: {
      id: 'q1', quote_number: 'Q1', lead_id: 'lead1',
      discount_pct: 0, deposit_pct: 40, interim_pct: 50,
      valid_days: 30, price_file_id: 'pf1', salesperson_id: 'sp1',
      item_layout: null,
    },
    lead: {
      id: 'lead1', lead_number: 'L507712',
      property_name_number: '12', property_road: 'Test Road',
      property_town: 'London', property_county: null, property_postcode: 'SW1 1AA',
      phone: null, email: null,
    },
    mainContact: {
      title: 'Mr', first_name: 'John', last_name: 'Smith',
      phone: '07700 900123', email: 'john@example.com',
    },
    postalContact: {
      address_1: '12 Test Road', address_2: null,
      town: 'London', county: null, postcode: 'SW1 1AA',
    },
    salesperson: { full_name: 'Jane Doe', phone: '020 7924 7303', email: 'jane@wsw.co.uk' },
    publishingUser: { full_name: 'Nathan Smith' },
    jobItems: [
      { id: 'ji1', item_number: 1, floor_level: 'Ground Floor', elevation: 'Rear Elevation', room_name: 'Kitchen' },
    ],
    selections: { ji1: 'dwg1' },
    drawings: [
      { id: 'dwg1', job_item_id: 'ji1', drawing_number: 1, window_type: 'Box Sash', poa: false, price_override: null, item_discount_pct: 0, vat_rate: 20, default_profile_id: 'prof1' },
    ],
    trees: { dwg1: FIXTURE_TREE },
    drawingRunPrices: { dwg1: { sales: 1691.24, cost: 820, pricingRunId: 'run1', priceFileId: 'pf1' } },
    quoteApportionment: {},
    ironmongeryByDrawing: {
      dwg1: [
        { ironmongery_products: { name: 'Claw Fastener Ironmongery Set with Pulleys', category: 'Sash Fastener' }, quantity: 1, ironmongery_variants: { finish_name: 'Polished Brass', photo_url: 'https://example.com/claw.jpg' } },
        { ironmongery_products: { name: 'Trickle Vent XR16', category: 'Trickle Vent' }, quantity: 1, ironmongery_variants: { finish_name: 'White', photo_url: null } },
      ],
    },
    allocatedPartsByDrawing: {
      dwg1: [
        { part_code: 'SASH-CORD-8MM', part_name: 'Sash Cord 8mm', unit_cost: 1.20, quantity: 4, total_cost: 4.80 },
      ],
    },
    latestRunByDrawing: {
      dwg1: { id: 'run1', drawing_id: 'dwg1', price_file_id: 'pf1', tree_hash: 'abc123', status: 'complete' },
    },
    profilesByDrawing: {
      dwg1: { 'frameMaterialPart.timberType': 'Accoya', 'sashMaterialPart.timberType': 'Accoya' },
    },
    content: QUOTE_CONTENT,
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('assembleSnapshot — v2 keys', () => {
  it('returns version 2', () => {
    const snap = assembleSnapshot(makeData())
    expect(snap.version).toBe(2)
  })

  it('has top-level lead, salesperson, generated_by, generated_on', () => {
    const snap = assembleSnapshot(makeData())
    expect(snap.lead).toBeDefined()
    expect(snap.lead.lead_number).toBe('L507712')
    expect(snap.lead.customer_forename).toBe('John')
    expect(snap.lead.customer_surname).toBe('Smith')
    expect(snap.lead.contact_name).toBe('Mr John Smith')
    expect(snap.lead.installation_address_one_line).toBe('Test Road, London, SW1 1AA')
    expect(snap.lead.phone).toBe('07700 900123')
    expect(snap.lead.email).toBe('john@example.com')

    expect(snap.salesperson.full_name).toBe('Jane Doe')
    expect(snap.salesperson.initials).toBe('JD')
    expect(snap.salesperson.phone).toBe('020 7924 7303')

    expect(snap.generated_by).toBe('NS')
    expect(snap.generated_on).toBeTruthy()
  })

  it('generated_by uses publishingUser initials', () => {
    const snap = assembleSnapshot(makeData())
    expect(snap.generated_by).toBe('NS')
  })

  it('generated_by falls back when publishingUser is null', () => {
    const snap = assembleSnapshot(makeData({ publishingUser: null }))
    expect(snap.generated_by).toBe('')
  })

  it('has quote_settings with item_layout and valid_until', () => {
    const snap = assembleSnapshot(makeData())
    expect(snap.quote_settings.item_layout).toBe('1 item with int & ext view, ironmongery & cover')
    expect(snap.quote_settings.valid_until).toBeTruthy()
    expect(snap.quote_settings.discount_pct).toBe(0)
  })

  it('stores content (quoteContent.js archival)', () => {
    const snap = assembleSnapshot(makeData())
    expect(snap.content).toBeDefined()
    expect(snap.content.front_cover_letter).toContain('[customer_forename]')
    expect(snap.content.lead_times.nj_lead_time).toBe('10-12')
    expect(snap.content.bank_details.sort_code).toBe('30-54-66')
  })

  it('keeps existing v1 keys (totals, items, lead_number, quote_number)', () => {
    const snap = assembleSnapshot(makeData())
    expect(snap.lead_number).toBe('L507712')
    expect(snap.quote_number).toBe('Q1')
    expect(snap.totals).toBeDefined()
    expect(snap.totals.subtotal_before_discount).toBeDefined()
    expect(snap.totals.total_incl_vat).toBeDefined()
    expect(snap.totals.stages).toBeDefined()
    expect(snap.items).toHaveLength(1)
    expect(snap.items[0].job_item).toBeDefined()
    expect(snap.items[0].drawing).toBeDefined()
    expect(snap.items[0].parts_tree).toBeDefined()
    expect(snap.items[0].net).toBeDefined()
  })
})

describe('assembleSnapshot — per-item v2 fields', () => {
  it('has location_text', () => {
    const snap = assembleSnapshot(makeData())
    expect(snap.items[0].location_text).toBe('Ground Floor Rear Elevation Kitchen')
  })

  it('has ironmongery array with required shape', () => {
    const snap = assembleSnapshot(makeData())
    const iron = snap.items[0].ironmongery
    expect(iron).toHaveLength(2)
    expect(iron[0].name).toBe('Claw Fastener Ironmongery Set with Pulleys')
    expect(iron[0].qty).toBe(1)
    expect(iron[0].finish_label).toBe('Polished Brass')
    expect(iron[0].photo_url).toBe('https://example.com/claw.jpg')
    expect(iron[0].has_multipoint).toBe(false)
  })

  it('detects has_multipoint from product name', () => {
    const data = makeData({
      ironmongeryByDrawing: {
        dwg1: [
          { ironmongery_products: { name: 'Multipoint Locking System', category: 'Door Lock' }, quantity: 1, ironmongery_variants: { finish_name: 'Chrome', photo_url: null } },
        ],
      },
    })
    const snap = assembleSnapshot(data)
    expect(snap.items[0].ironmongery[0].has_multipoint).toBe(true)
  })

  it('has allocated_parts', () => {
    const snap = assembleSnapshot(makeData())
    expect(snap.items[0].allocated_parts).toHaveLength(1)
    expect(snap.items[0].allocated_parts[0].part_code).toBe('SASH-CORD-8MM')
  })

  it('has pricing_run_id', () => {
    const snap = assembleSnapshot(makeData())
    expect(snap.items[0].pricing_run_id).toBe('run1')
  })

  it('has derived and geometry from the tree', () => {
    const snap = assembleSnapshot(makeData())
    // derived and geometry are computed from the tree; they should be objects
    // (or null if computation fails; for a valid tree they should be present)
    expect(snap.items[0].derived).toBeDefined()
    expect(snap.items[0].geometry).toBeDefined()
  })

  it('has profile_defaults', () => {
    const snap = assembleSnapshot(makeData())
    expect(snap.items[0].profile_defaults).toBeDefined()
    expect(snap.items[0].profile_defaults['frameMaterialPart.timberType']).toBe('Accoya')
  })
})

describe('assembleSnapshot — deterministic', () => {
  it('building twice from the same inputs gives the same object apart from timestamps', () => {
    const data = makeData()
    const snap1 = assembleSnapshot(data)
    const snap2 = assembleSnapshot(data)
    // Zero out timestamps
    const strip = s => {
      const copy = JSON.parse(JSON.stringify(s))
      delete copy.published_at
      delete copy.generated_on
      return copy
    }
    expect(strip(snap1)).toEqual(strip(snap2))
  })
})

describe('assembleSnapshot — totals for L507712 Q1', () => {
  it('computes correct totals for single item at £1,691.24', () => {
    const snap = assembleSnapshot(makeData())
    expect(snap.totals.subtotal_before_discount).toBe(1691.24)
    expect(snap.totals.total_vat).toBe(338.25)
    expect(snap.totals.total_incl_vat).toBe(2029.49)
    // Stages: 40/50/10
    expect(snap.totals.stages.deposit).toBe(811.80)
    expect(snap.totals.stages.interim).toBe(1014.75)
    expect(snap.totals.stages.balance).toBe(202.94)
  })
})
