import { describe, it, expect } from 'vitest'
import {
  itemHeading, specSections, ironmongerySentence, ironmongeryTiles,
  summaryModel, itemPriceLabel, mergeFields, formatDate, fmtMoney,
  buildDocModel, snapshotMergeFields, SUMMARY_COLUMNS,
} from './quoteDocModel.js'
import { computeQuoteTotals } from '../quoteTotals.js'
import { QUOTE_CONTENT } from './quoteContent.js'

// ── Fixture helpers ──────────────────────────────────────────────────────────

function makeTree(overrides = {}) {
  return {
    part_type: 'drawingItemPart',
    values: { typeOfWork: 'complete_new', ...overrides.drawingItem },
    children: [
      {
        part_type: 'assemblyFramePart',
        values: { width: 1075, height: 1630, ...overrides.frame },
        children: [
          {
            part_type: 'sashPairPart',
            values: { topHornTypeShortName: 'custom_horn', bottomHornTypeShortName: 'no_horn', ...overrides.pair },
            children: [
              { part_type: 'topSashPart', values: { topHeight: 49, stileWidth: 47, ...overrides.topSash }, children: [
                { part_type: 'glassPart', values: {
                  glassType: 'double_glazed', innerPane: '4mm Clear', outerPane: '4mm Clear',
                  gasType: 'argon', spacerColour: 'White', toughened_inner: false, toughened_outer: true, lowE: 'Pilkington K',
                  ...overrides.topGlass,
                }, children: [] },
              ] },
              { part_type: 'bottomSashPart', values: { bottomHeight: 88, ...overrides.botSash }, children: [
                { part_type: 'glassPart', values: {
                  glassType: 'double_glazed', innerPane: '4mm Clear', outerPane: '4mm Clear',
                  gasType: 'argon', spacerColour: 'White', toughened_inner: false, toughened_outer: true, lowE: 'Pilkington K',
                  ...overrides.botGlass,
                }, children: [] },
              ] },
            ],
          },
          { part_type: 'frameMaterialPart', values: { timberType: overrides.frameTimber ?? 'Accoya' }, children: [] },
          { part_type: 'sashMaterialPart', values: { timberType: overrides.sashTimber ?? 'Accoya' }, children: [] },
          { part_type: 'cillPart', values: { timberType: overrides.cillTimber ?? 'Accoya', height: 67 }, children: [] },
          { part_type: 'mouldingPart', values: { profile: 'ovolo', glazingBarWidth: 22, ...overrides.moulding }, children: [] },
        ],
      },
      {
        part_type: 'paintAndIronmongeryPart',
        values: { internalFinish: 'clean_white', externalFinish: 'clean_white', cillFinish: 'clean_white', ...overrides.paint },
        children: [],
      },
      {
        part_type: 'notesPart',
        values: { quoteNotes: overrides.quoteNotes ?? null, ...overrides.notes },
        children: [],
      },
    ],
  }
}

function makeItem(overrides = {}) {
  return {
    job_item: { id: 'ji1', item_number: 1, floor_level: 'Ground Floor', elevation: 'Rear Elevation', room_name: 'Kitchen' },
    drawing: { id: 'dwg1', drawing_number: 1, window_type: 'Box Sash' },
    parts_tree: makeTree(overrides),
    net: 1691.24,
    net_after_quote_discount: 1691.24,
    vat: 338.25,
    vat_rate: 20,
    poa: false,
    location_text: 'Ground Floor Rear Elevation Kitchen',
    ironmongery: overrides.ironmongery ?? [],
    allocated_parts: overrides.allocated_parts ?? [],
    ...overrides.itemOverrides,
  }
}

function makeSnapshot(overrides = {}) {
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
    salesperson: { full_name: 'Jane Doe', initials: 'JD', phone: '020 7924 7303', email: 'jane@wsw.co.uk' },
    generated_by: 'NS',
    generated_on: '2026-09-15T10:00:00.000Z',
    quote_settings: { discount_pct: 0, deposit_pct: 40, interim_pct: 50, valid_days: 30 },
    content: QUOTE_CONTENT,
    totals: {
      subtotal_before_discount: 1691.24,
      discount_amount: 0,
      subtotal_after_discount: 1691.24,
      vat_by_rate: { '20': 338.25 },
      total_vat: 338.25,
      total_incl_vat: 2029.49,
      stages: { deposit: 811.80, interim: 1014.75, balance: 202.94 },
    },
    ref_labels: {
      softwood: 'Solid Redwood', utile: 'Solid Utile Hardwood', accoya: 'Accoya',
      argon: 'Argon', white: 'White', clean_white: 'Clean White',
      custom_horn: 'Custom Horn', no_horn: 'No Horn', victorian: 'Victorian',
    },
    items: [makeItem()],
    ...overrides,
  }
}

// ── Tests: Totals (Integrate's 15-item case) ─────────────────────────────────

describe('quoteDocModel — Integrate 15-item totals', () => {
  const prices = [2746.33, 4070.46, 2895.45, 3201.35, 3201.35, 3201.35, 3201.35, 3201.35, 3147.34, 2894.81, 2894.81, 2894.81, 7193.76, 1976.83, 1977.04]
  const settings = { discountPct: 0, depositPct: 40, interimPct: 50 }
  const items = prices.map(p => ({ calculated: p, vatRate: 20 }))
  const totals = computeQuoteTotals(settings, items)

  it('Sub Total = 48,698.39', () => expect(totals.subtotalBeforeDiscount).toBe(48698.39))
  it('VAT = 9,739.68', () => expect(totals.totalVat).toBe(9739.68))
  it('Total = 58,438.07', () => expect(totals.totalInclVat).toBe(58438.07))
  it('Deposit (40%) = 23,375.23', () => expect(totals.stages.deposit).toBe(23375.23))
  it('Interim (50%) = 29,219.04', () => expect(totals.stages.interim).toBe(29219.04))
  it('Balance = 5,843.80', () => expect(totals.stages.balance).toBe(5843.80))
  it('stages sum to total', () => {
    const { deposit, interim, balance } = totals.stages
    expect(Math.round((deposit + interim + balance) * 100) / 100).toBe(totals.totalInclVat)
  })
})

// ── Tests: Item heading ──────────────────────────────────────────────────────

describe('itemHeading', () => {
  it('single timber — all match', () => {
    const item = makeItem()
    const { heading } = itemHeading(item, 'Standard Sash')
    expect(heading).toContain('Supply & Install a complete new Doc L sash window')
    expect(heading).toContain('(Standard Sash range)')
    expect(heading).toContain('in Accoya')
    expect(heading).not.toContain('with')
  })

  it('split timber — frame/sash differ from cill', () => {
    const item = makeItem({ frameTimber: 'Solid Redwood', sashTimber: 'Solid Redwood', cillTimber: 'Solid Utile Hardwood' })
    const { heading } = itemHeading(item, null)
    expect(heading).toContain('in Solid Redwood with Solid Utile Hardwood cill')
  })

  it('descriptionOfWork is the same sentence up to the item type', () => {
    const item = makeItem()
    const { descriptionOfWork } = itemHeading(item, 'Standard Sash')
    expect(descriptionOfWork).toContain('Supply & Install a complete new Doc L')
    expect(descriptionOfWork).toContain('sash window')
    expect(descriptionOfWork).not.toContain('Accoya') // no timber in description
    expect(descriptionOfWork).not.toContain('range') // no range in description
  })

  it('draught seal uses "Including Draught Proofing"', () => {
    const item = makeItem({ drawingItem: { typeOfWork: 'draught_seal' } })
    const { heading, descriptionOfWork } = itemHeading(item, null)
    expect(heading).toContain('Including Draught Proofing')
    expect(descriptionOfWork).toContain('Including Draught Proofing')
  })
})

// ── Tests: Ironmongery sentence ──────────────────────────────────────────────

describe('ironmongerySentence', () => {
  it('three-finish example', () => {
    const lines = [
      { name: 'A', qty: 2, finish_label: 'Polished Chrome', has_multipoint: false },
      { name: 'B', qty: 4, finish_label: 'Polished Chrome', has_multipoint: false },
      { name: 'C', qty: 1, finish_label: 'Polished Brass', has_multipoint: false },
      { name: 'D', qty: 1, finish_label: 'White', has_multipoint: false },
      { name: 'E', qty: 1, finish_label: 'White', has_multipoint: false },
    ]
    const s = ironmongerySentence(lines)
    expect(s).toBe('2 x A, 4 x B in Polished Chrome and 1 x C in Polished Brass and 1 x D, 1 x E in White')
  })

  it('appends multi-point suffix', () => {
    const lines = [
      { name: 'Lock', qty: 1, finish_label: 'Chrome', has_multipoint: true },
    ]
    const s = ironmongerySentence(lines)
    expect(s).toBe('1 x Lock in Chrome with multi-point locking system')
  })

  it('no-finish items go first without "in …"', () => {
    const lines = [
      { name: 'Cord', qty: 4, finish_label: null, has_multipoint: false },
      { name: 'Fastener', qty: 1, finish_label: 'Polished Brass', has_multipoint: false },
    ]
    const s = ironmongerySentence(lines)
    expect(s).toBe('4 x Cord and 1 x Fastener in Polished Brass')
  })

  it('empty array returns empty string', () => {
    expect(ironmongerySentence([])).toBe('')
  })
})

// ── Tests: Spec sections ─────────────────────────────────────────────────────

describe('specSections', () => {
  it('empty sections are dropped', () => {
    const item = makeItem({ moulding: { profile: null, glazingBarWidth: null }, paint: { internalFinish: null, externalFinish: null, cillFinish: null }, quoteNotes: null })
    // Clear the pair horn values too
    item.parts_tree.children[0].children[0].values = {}
    const sections = specSections(item, [])
    const titles = sections.map(s => s.title)
    // Should not contain sections whose source data was empty
    expect(titles).not.toContain('Moulding and Glazing Bar')
    expect(titles).not.toContain('Sash Horn')
    expect(titles).not.toContain('Paint / Finish')
    expect(titles).not.toContain('Notes')
  })

  it('identical top and bottom glass merges into one block', () => {
    const item = makeItem() // both glasses are identical by default
    const sections = specSections(item, [])
    const glassSections = sections.filter(s => s.title.startsWith('Double Glazing'))
    expect(glassSections).toHaveLength(1)
    expect(glassSections[0].title).toBe('Double Glazing')
  })

  it('different top and bottom glass produces two blocks', () => {
    const item = makeItem({ topGlass: { innerPane: '6mm Clear' } })
    const sections = specSections(item, [])
    const glassSections = sections.filter(s => s.title.startsWith('Double Glazing'))
    expect(glassSections).toHaveLength(2)
    expect(glassSections[0].title).toBe('Double Glazing - Top')
    expect(glassSections[1].title).toBe('Double Glazing - Bottom')
  })

  it('glass line does not duplicate "Warm Edge" when the label already contains it', () => {
    const snap = makeSnapshot()
    // Simulate a ref_labels where the spacer label already includes "Warm Edge"
    snap.ref_labels.white = 'White Warm Edge'
    const model = buildDocModel(snap)
    const item = model.items[0]
    const glass = item.specSections.find(s => s.title.startsWith('Double Glazing'))
    expect(glass).toBeDefined()
    expect(glass.content).toContain('White Warm Edge spacer')
    expect(glass.content).not.toContain('Warm Edge Warm Edge')
  })

  it('glass line format matches expected pattern', () => {
    const item = makeItem()
    const sections = specSections(item, [])
    const glass = sections.find(s => s.title.startsWith('Double Glazing'))
    expect(glass).toBeDefined()
    expect(glass.content).toContain('4mm Clear Pilkington K')
    expect(glass.content).toContain('Argon Filled')
    expect(glass.content).toContain('White Warm Edge spacer')
    expect(glass.content).toContain('4mm Clear Toughened')
  })

  it('includes moulding section', () => {
    const item = makeItem()
    const sections = specSections(item, [])
    const moulding = sections.find(s => s.title === 'Moulding and Glazing Bar')
    expect(moulding).toBeDefined()
    expect(moulding.content).toBe('Ovolo, 22 mm Glazing Bar')
  })

  it('includes sash horn section', () => {
    const item = makeItem()
    const sections = specSections(item, [])
    const horn = sections.find(s => s.title === 'Sash Horn')
    expect(horn).toBeDefined()
    expect(horn.content).toContain('Top:')
    expect(horn.content).toContain('Bottom:')
  })

  it('includes paint/finish section', () => {
    const item = makeItem()
    const sections = specSections(item, [])
    const paint = sections.find(s => s.title === 'Paint / Finish')
    expect(paint).toBeDefined()
    expect(paint.content).toContain('Internal:')
  })
})

// ── Tests: Summary model ─────────────────────────────────────────────────────

describe('summaryModel', () => {
  it('no-discount: shows Sub Total, VAT, Total', () => {
    const snap = makeSnapshot()
    const model = summaryModel(snap)
    const labels = model.totalsLines.map(l => l.label)
    expect(labels).toContain('Sub Total')
    expect(labels).toContain('VAT')
    expect(labels).toContain('Total Order Value incl. VAT')
    expect(labels).not.toContain('Sub Total Before Discount')
  })

  it('with discount: shows discount lines', () => {
    const snap = makeSnapshot({
      quote_settings: { discount_pct: 5, deposit_pct: 40, interim_pct: 50, valid_days: 30 },
      totals: {
        subtotal_before_discount: 1691.24,
        discount_amount: 84.56,
        subtotal_after_discount: 1606.68,
        vat_by_rate: { '20': 321.34 },
        total_vat: 321.34,
        total_incl_vat: 1928.02,
        stages: { deposit: 771.21, interim: 964.01, balance: 192.80 },
      },
    })
    const model = summaryModel(snap)
    const labels = model.totalsLines.map(l => l.label)
    expect(labels).toContain('Sub Total Before Discount')
    expect(labels).toContain('5% Discount')
    expect(labels).toContain('Sub Total After Discount')
  })

  it('mixed VAT rates: one line per rate', () => {
    const snap = makeSnapshot({
      totals: {
        subtotal_before_discount: 3000,
        discount_amount: 0,
        subtotal_after_discount: 3000,
        vat_by_rate: { '20': 200, '5': 100 },
        total_vat: 300,
        total_incl_vat: 3300,
        stages: { deposit: 1320, interim: 1650, balance: 330 },
      },
    })
    const model = summaryModel(snap)
    const labels = model.totalsLines.map(l => l.label)
    expect(labels).toContain('VAT @ 20%')
    expect(labels).toContain('VAT @ 5%')
    expect(labels).not.toContain('VAT')
  })

  it('left box has quoteRef, bankDetails, validLine, generatedLine', () => {
    const snap = makeSnapshot()
    const model = summaryModel(snap)
    expect(model.leftBox.quoteRef).toBe('L507712 / Q1')
    expect(model.leftBox.bankDetails).toContain('30-54-66')
    expect(model.leftBox.validLine).toContain('30 days')
    expect(model.leftBox.generatedLine).toContain('NS')
  })

  it('POA items print "POA" in the price column', () => {
    const snap = makeSnapshot({
      items: [makeItem({ itemOverrides: { poa: true, net: null, net_after_quote_discount: null } })],
    })
    const model = summaryModel(snap)
    expect(model.rows[0].netPrice).toBe('POA')
  })
})

// ── Tests: Item price label ──────────────────────────────────────────────────

describe('itemPriceLabel', () => {
  it('no discount: "Price excl. VAT: £x"', () => {
    const item = makeItem()
    expect(itemPriceLabel(item, 0)).toBe('Price excl. VAT: £1,691.24')
  })

  it('with discount: "Price after discount excl. VAT: £x"', () => {
    const item = makeItem({ itemOverrides: { net_after_quote_discount: 1606.68 } })
    expect(itemPriceLabel(item, 5)).toBe('Price after discount excl. VAT: £1,606.68')
  })

  it('POA item', () => {
    const item = makeItem({ itemOverrides: { poa: true } })
    expect(itemPriceLabel(item, 0)).toBe('POA')
  })
})

// ── Tests: Merge fields ──────────────────────────────────────────────────────

describe('mergeFields', () => {
  it('replaces known fields', () => {
    const result = mergeFields('Hello [customer_forename]!', { customer_forename: 'John' })
    expect(result).toBe('Hello John!')
  })

  it('unknown field prints nothing in production mode', () => {
    const result = mergeFields('Hello [unknown]!', {})
    expect(result).toBe('Hello !')
  })

  it('unknown field throws in strict mode', () => {
    expect(() => mergeFields('Hello [unknown]!', {}, { strict: true })).toThrow('unknown')
  })

  it('empty field throws in strict mode', () => {
    expect(() => mergeFields('Hello [name]!', { name: '' }, { strict: true })).toThrow('name')
  })
})

// ── Tests: formatDate ────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats ISO string as "15 Sep 2026"', () => {
    expect(formatDate('2026-09-15T10:00:00.000Z')).toBe('15 Sep 2026')
  })

  it('returns empty for null', () => {
    expect(formatDate(null)).toBe('')
  })
})

// ── Tests: fmtMoney ──────────────────────────────────────────────────────────

describe('fmtMoney', () => {
  it('formats as £x,xxx.xx', () => {
    expect(fmtMoney(48698.39)).toBe('£48,698.39')
  })

  it('returns — for null', () => {
    expect(fmtMoney(null)).toBe('—')
  })
})

// ── Tests: buildDocModel ─────────────────────────────────────────────────────

describe('buildDocModel', () => {
  it('builds a complete model from a snapshot', () => {
    const snap = makeSnapshot()
    const model = buildDocModel(snap)
    expect(model.quoteRef).toBe('L507712 / Q1')
    expect(model.frontLetter).toContain('John')
    expect(model.frontLetter).not.toContain('[customer_forename]')
    expect(model.backLetterSections.length).toBeGreaterThan(0)
    expect(model.summary.rows).toHaveLength(1)
    expect(model.items).toHaveLength(1)
    expect(model.items[0].heading).toContain('Supply & Install')
    expect(model.items[0].specSections.length).toBeGreaterThan(0)
  })

  it('front letter has no raw [field] placeholders', () => {
    const snap = makeSnapshot()
    const model = buildDocModel(snap)
    expect(model.frontLetter).not.toMatch(/\[[a-z_]+\]/)
  })
})

// ── Tests: no raw codes in printed output ────────────────────────────────────

describe('buildDocModel — no raw codes in headings or spec sections', () => {
  it('heading and spec sections contain labels, not underscore codes', () => {
    const snap = makeSnapshot({
      items: [makeItem({ frameTimber: 'softwood', sashTimber: 'softwood', cillTimber: 'utile' })],
    })
    const model = buildDocModel(snap)
    const item = model.items[0]

    // Heading must have resolved labels
    expect(item.heading).not.toMatch(/_/)
    expect(item.heading).toContain('Solid Redwood')
    expect(item.heading).toContain('Solid Utile Hardwood')

    // Spec sections must have resolved labels
    for (const sec of item.specSections) {
      expect(sec.content).not.toMatch(/[a-z]+_[a-z]+/)
    }
  })
})

// ── Tests: ironmongeryTiles ──────────────────────────────────────────────────

describe('ironmongeryTiles', () => {
  it('returns one tile per distinct product with a photo', () => {
    const iron = [
      { name: 'Fastener', qty: 1, finish_label: 'PB', photo_url: 'https://example.com/a.jpg' },
      { name: 'Fastener', qty: 1, finish_label: 'PB', photo_url: 'https://example.com/a.jpg' }, // duplicate
      { name: 'Vent', qty: 1, finish_label: 'White', photo_url: null }, // no photo
    ]
    const tiles = ironmongeryTiles(iron)
    expect(tiles).toHaveLength(1)
    expect(tiles[0].name).toBe('Fastener')
  })
})
