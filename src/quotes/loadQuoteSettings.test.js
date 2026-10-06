import { describe, it, expect } from 'vitest'
import {
  mergeQuoteContent,
  validateMergeFields,
  parseBackCoverLetter,
  flattenBackCoverLetter,
} from './loadQuoteSettings.js'
import {
  FRONT_COVER_LETTER,
  BACK_COVER_LETTER,
  LEAD_TIMES,
  BANK_DETAILS,
  FOOTER,
  SPEC_SECTION_ORDER,
  HS_OPTIN_VALUES,
  ITEM_HEADING_WORDING,
  QUOTE_CONTENT,
} from './pdf/quoteContent.js'

// ── mergeQuoteContent ───────────────────────────────────────────────────────

describe('mergeQuoteContent', () => {
  it('returns full defaults when no DB settings exist', () => {
    const content = mergeQuoteContent({})
    expect(content.front_cover_letter).toBe(FRONT_COVER_LETTER)
    expect(content.back_cover_letter).toEqual(BACK_COVER_LETTER)
    expect(content.lead_times).toEqual(LEAD_TIMES)
    expect(content.bank_details).toEqual(BANK_DETAILS)
    expect(content.footer).toEqual(FOOTER)
    expect(content.spec_section_order).toEqual(SPEC_SECTION_ORDER)
    expect(content.hs_optin_values).toEqual(HS_OPTIN_VALUES)
    expect(content.item_heading_wording).toEqual(ITEM_HEADING_WORDING)
  })

  it('returns full defaults when called with no arguments', () => {
    const content = mergeQuoteContent()
    expect(content.front_cover_letter).toBe(FRONT_COVER_LETTER)
  })

  it('overrides only the provided lead times', () => {
    const content = mergeQuoteContent({
      quote_lead_times: { nj_lead_time: '14-16' },
    })
    expect(content.lead_times.nj_lead_time).toBe('14-16')
    // Others stay at default
    expect(content.lead_times.ds_lead_time).toBe('4-6')
    expect(content.lead_times.bg_lead_time).toBe('10-12')
  })

  it('overrides front cover letter', () => {
    const content = mergeQuoteContent({
      quote_letters: { front_cover_letter: 'Custom front letter' },
    })
    expect(content.front_cover_letter).toBe('Custom front letter')
    // Back letter stays default
    expect(content.back_cover_letter).toEqual(BACK_COVER_LETTER)
  })

  it('overrides back cover letter', () => {
    const custom = [{ heading: 'Custom', body: 'Custom body' }]
    const content = mergeQuoteContent({
      quote_letters: { back_cover_letter: custom },
    })
    expect(content.back_cover_letter).toEqual(custom)
    // Front letter stays default
    expect(content.front_cover_letter).toBe(FRONT_COVER_LETTER)
  })

  it('overrides bank details partially', () => {
    const content = mergeQuoteContent({
      quote_bank_details: { name: 'New Corp' },
    })
    expect(content.bank_details.name).toBe('New Corp')
    expect(content.bank_details.sort_code).toBe('30-54-66')
  })

  it('overrides footer partially', () => {
    const content = mergeQuoteContent({
      quote_footer: { company: 'New Windows Ltd' },
    })
    expect(content.footer.company).toBe('New Windows Ltd')
    expect(content.footer.address).toBe(FOOTER.address)
  })

  it('overrides spec section order', () => {
    const content = mergeQuoteContent({
      quote_sections: ['paint_finish', 'ironmongery'],
    })
    expect(content.spec_section_order).toEqual(['paint_finish', 'ironmongery'])
  })

  it('overrides H&S opt-in values', () => {
    const custom = [{ group: 'Landing Access', value: 'Scaffold by WSW' }]
    const content = mergeQuoteContent({
      quote_hs_optin: custom,
    })
    expect(content.hs_optin_values).toEqual(custom)
  })

  it('overrides item heading wording partially', () => {
    const content = mergeQuoteContent({
      quote_item_wording: { complete_new: 'Supply & Fit a brand new Doc L' },
    })
    expect(content.item_heading_wording.complete_new).toBe('Supply & Fit a brand new Doc L')
    expect(content.item_heading_wording.draught_seal).toBe(ITEM_HEADING_WORDING.draught_seal)
  })

  it('a saved lead time appears in the content used by merge fields', () => {
    const content = mergeQuoteContent({
      quote_lead_times: { nj_lead_time: '8-10' },
    })
    // The front letter template references [nj_lead_time]; verify the content
    // stores the updated lead time so mergeFields will resolve it correctly
    expect(content.lead_times.nj_lead_time).toBe('8-10')
    expect(content.front_cover_letter).toContain('[nj_lead_time]')
  })
})

// ── Published quote's content is unchanged ──────────────────────────────────

describe('mergeQuoteContent — published quote isolation', () => {
  it('a published snapshot with content baked in is not affected by new settings', () => {
    // Simulate: snapshot was published with QUOTE_CONTENT baked in
    const publishedContent = JSON.parse(JSON.stringify(QUOTE_CONTENT))

    // Now settings change
    const newContent = mergeQuoteContent({
      quote_lead_times: { nj_lead_time: '20-22' },
      quote_letters: { front_cover_letter: 'Completely new letter' },
    })

    // The published snapshot still has the original
    expect(publishedContent.lead_times.nj_lead_time).toBe('10-12')
    expect(publishedContent.front_cover_letter).toBe(FRONT_COVER_LETTER)

    // The new content reflects the changes
    expect(newContent.lead_times.nj_lead_time).toBe('20-22')
    expect(newContent.front_cover_letter).toBe('Completely new letter')
  })
})

// ── validateMergeFields ─────────────────────────────────────────────────────

describe('validateMergeFields', () => {
  it('accepts known fields', () => {
    const { valid, unknownFields } = validateMergeFields(
      'Dear [customer_forename], your address is [installation_full_address_one_line].'
    )
    expect(valid).toBe(true)
    expect(unknownFields).toHaveLength(0)
  })

  it('rejects unknown fields', () => {
    const { valid, unknownFields } = validateMergeFields(
      'Hello [customer_forename], [unknown_field] and [another_bad].'
    )
    expect(valid).toBe(false)
    expect(unknownFields).toContain('unknown_field')
    expect(unknownFields).toContain('another_bad')
    expect(unknownFields).toHaveLength(2)
  })

  it('accepts all known merge fields', () => {
    const text = [
      '[customer_forename]',
      '[installation_full_address_one_line]',
      '[nj_lead_time]',
      '[ds_lead_time]',
      '[bg_lead_time]',
      '[sales_person_full_name]',
    ].join(' ')
    const { valid } = validateMergeFields(text)
    expect(valid).toBe(true)
  })

  it('handles empty/null text', () => {
    expect(validateMergeFields(null).valid).toBe(true)
    expect(validateMergeFields('').valid).toBe(true)
  })

  it('handles text with no fields', () => {
    const { valid } = validateMergeFields('Plain text with no fields')
    expect(valid).toBe(true)
  })

  it('rejects a single unknown field and names it', () => {
    const { valid, unknownFields } = validateMergeFields(
      'Hello [customer_forename], your ref is [order_number].'
    )
    expect(valid).toBe(false)
    expect(unknownFields).toEqual(['order_number'])
  })

  it('rejects mixed known and unknown fields, returning only the unknown ones', () => {
    const { valid, unknownFields } = validateMergeFields(
      '[customer_forename] [bad_one] [nj_lead_time] [also_bad]'
    )
    expect(valid).toBe(false)
    expect(unknownFields).toEqual(['bad_one', 'also_bad'])
    expect(unknownFields).not.toContain('customer_forename')
    expect(unknownFields).not.toContain('nj_lead_time')
  })
})

// ── Section order persistence via mergeQuoteContent ────────────────────────

describe('mergeQuoteContent — section order changes', () => {
  it('persists a reordered spec section order from DB settings', () => {
    const customOrder = ['ironmongery', 'paint_finish', 'double_glazing']
    const content = mergeQuoteContent({
      quote_sections: customOrder,
    })
    expect(content.spec_section_order).toEqual(customOrder)
    // Verify it is not the default order
    expect(content.spec_section_order).not.toEqual(SPEC_SECTION_ORDER)
  })

  it('persists a section order with removed sections', () => {
    const trimmed = ['repair', 'moulding']
    const content = mergeQuoteContent({ quote_sections: trimmed })
    expect(content.spec_section_order).toEqual(trimmed)
    expect(content.spec_section_order).toHaveLength(2)
  })

  it('uses default spec section order when quote_sections is not set', () => {
    const content = mergeQuoteContent({})
    expect(content.spec_section_order).toEqual(SPEC_SECTION_ORDER)
  })

  it('section order change does not affect other content fields', () => {
    const content = mergeQuoteContent({
      quote_sections: ['notes'],
      quote_lead_times: { nj_lead_time: '6-8' },
    })
    expect(content.spec_section_order).toEqual(['notes'])
    expect(content.lead_times.nj_lead_time).toBe('6-8')
    expect(content.front_cover_letter).toBe(FRONT_COVER_LETTER)
  })
})

// ── parseBackCoverLetter ────────────────────────────────────────────────────

describe('parseBackCoverLetter', () => {
  it('parses heading + body pairs', () => {
    const text = 'Price Matching\n\nWe are dedicated to providing the best value.\n\nPayment Terms\n\nA 40% deposit is required.'
    const sections = parseBackCoverLetter(text)
    expect(sections).toHaveLength(2)
    expect(sections[0].heading).toBe('Price Matching')
    expect(sections[0].body).toBe('We are dedicated to providing the best value.')
    expect(sections[1].heading).toBe('Payment Terms')
    expect(sections[1].body).toBe('A 40% deposit is required.')
  })

  it('handles empty input', () => {
    expect(parseBackCoverLetter(null)).toEqual([])
    expect(parseBackCoverLetter('')).toEqual([])
  })

  it('round-trips with flattenBackCoverLetter', () => {
    const original = [
      { heading: 'Title 1', body: 'Body 1' },
      { heading: 'Title 2', body: 'Body 2' },
    ]
    const flat = flattenBackCoverLetter(original)
    const parsed = parseBackCoverLetter(flat)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].heading).toBe('Title 1')
    expect(parsed[0].body).toBe('Body 1')
  })
})

// ── flattenBackCoverLetter ──────────────────────────────────────────────────

describe('flattenBackCoverLetter', () => {
  it('flattens structured back cover letter to text', () => {
    const sections = [
      { heading: 'Title', body: 'Content' },
    ]
    const text = flattenBackCoverLetter(sections)
    expect(text).toContain('Title')
    expect(text).toContain('Content')
  })

  it('returns string input as-is', () => {
    expect(flattenBackCoverLetter('raw text')).toBe('raw text')
  })

  it('handles null', () => {
    expect(flattenBackCoverLetter(null)).toBe('')
  })
})

// ── H&S categories ──────────────────────────────────────────────────────────

describe('Settings Notes — all H&S categories', () => {
  it('Settings.jsx loads all 8 H&S/access categories, not just 2', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('src/pages/Settings.jsx', 'utf-8')
    const expected = [
      'fire_egress', 'internal_hazard', 'access_internal', 'landing_access',
      'access_external', 'access_hazard_below', 'access_cable_alarm', 'access_dormer',
    ]
    for (const cat of expected) {
      expect(source).toContain(cat)
    }
  })

  it('default ticks are "Internal Scaffold by Customer" and "Scaffold by Customer"', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('src/pages/Settings.jsx', 'utf-8')
    expect(source).toContain("'Internal Scaffold by Customer'")
    expect(source).toContain("'Scaffold by Customer'")
  })
})
