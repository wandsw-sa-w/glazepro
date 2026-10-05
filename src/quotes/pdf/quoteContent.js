/**
 * quoteContent.js — static wording, lead times, bank details, footer and
 * section configuration for quote PDFs.
 *
 * Everything here is plain data with [merge_field] placeholders. H4 will
 * move this into the database; until then, changes are made here.
 *
 * Source: docs/integrate-quote-settings.txt (extracted 29 Sep 2026).
 */

// ── Front cover letter ──────────────────────────────────────────────────────

export const FRONT_COVER_LETTER = `Dear [customer_forename],

I would like to thank you for your enquiry, and I have included below our quotation for the proposed works at [installation_full_address_one_line].

Wandsworth Sash Windows and Parsons Joinery are part of Branford Group Limited, a family-run business specialising in high-quality timber joinery. Our products are handmade in our workshops across the UK, and we'd be happy to arrange a visit if you'd like to see them in person.

We also have a showroom on Fulham Road, London, near Chelsea Football Club. If you'd like to visit, let us know, and we can set up an appointment.

Our company is certified by the British Woodworking Federation and Fensa. As Fensa-registered installers, we are able to provide Building Control certification for all products that comply with Document L of the Building Regulations. Should you need further information regarding regulations or our certifications, please do not hesitate to reach out. We offer a full ten-year insurance-backed guarantee on all new joinery.

Every order is bespoke, which gives us full control over the manufacturing process. If you have specific requirements, such as a particular paint brand like Farrow and Ball or a unique design, we are fully equipped to accommodate your needs. Please feel free to get in touch to discuss the wide range of options available.

At present, our lead time for the manufacture of new joinery is [nj_lead_time] weeks, though this may vary throughout the year. For larger or more complex orders, lead times may be extended accordingly.

If this quote is of interest, please ask about our multi-item discounts that can be applied. Please continue to view your quotation.

[sales_person_full_name]

Branford Group Limited
Wandsworth Sash Windows & Parsons Joinery`

// ── Back cover letter ───────────────────────────────────────────────────────
// Each entry is { heading, body }. Headings are rendered bold on the PDF.

export const BACK_COVER_LETTER = [
  {
    heading: 'Price Matching',
    body: `We are dedicated to providing the best value for our customers. If you receive a competitor's quote with the same specifications at a lower price, simply show us the quote, and we will make every effort to match or beat it. Your satisfaction is our top priority, and we are committed to ensuring you get the most competitive pricing available.`,
  },
  {
    heading: 'Item Specifications',
    body: `Unless otherwise stated, all products quoted for will be manufactured according to our standard section dimensions. These can be found on the Technical Information section of our website. We strongly advise that all customers check these drawings.`,
  },
  {
    heading: 'Payment Terms',
    body: `A 40% deposit is required to place your order. A further 50% is due 8 weeks after the order is placed, prior to installation and the 10% balance is due upon completion of the installation.`,
  },
  {
    heading: 'Lead Time',
    body: `Our lead time for manufacture is currently [nj_lead_time] weeks. The lead time starts on the same day the final survey takes place. Once the joinery is ready, we will contact you to arrange the next steps.

Please note that lead times can be subject to change.`,
  },
  {
    heading: 'Document F Regulations',
    body: `Recent updates to Building Regulations, specifically Document F (Ventilation) have made new requirements in most circumstances for trickle ventilation in replacement windows and doors. We strongly advise customers to read the documentation relating to this on our website. If you need any advice or assistance with this, please ask us.`,
  },
  {
    heading: 'Listed Buildings',
    body: `If you are in a Listed Building our quote will not be suitable. It is absolutely imperative that you make us aware as if we embark on unpermitted works both the property owner and the contractor will be committing a criminal offence.`,
  },
  {
    heading: 'Terms and Conditions',
    body: `Full Terms and Conditions are available on our website.`,
  },
]

// ── Lead times (weeks) ──────────────────────────────────────────────────────

export const LEAD_TIMES = {
  ds_lead_time: '4-6',
  bg_lead_time: '10-12',
  nj_lead_time: '10-12',
}

// ── Bank details ────────────────────────────────────────────────────────────

export const BANK_DETAILS = {
  name: 'Branford Group Limited',
  sort_code: '30-54-66',
  account_no: '1989 9460',
}

// ── Footer ──────────────────────────────────────────────────────────────────

export const FOOTER = {
  company: 'Wandsworth Sash Windows & Parsons Joinery',
  address: '461 Fulham Road, London, SW6 1HL',
  contact: 'Tel: 0207 924 7303, Email: info@sashwindows.london, Web: sashwindows.london',
  continue_text: '- Please Continue -',
  left: 'Page [page] of [pages]',
  right: 'E&OE',
  background: '#faebce',
}

// ── Spec section order ──────────────────────────────────────────────────────

export const SPEC_SECTION_ORDER = [
  'repair',
  'moulding',
  'sash_horn',
  'double_glazing',
  'panel',
  'paint_finish',
  'ironmongery',
  'surrounds',
  'health_safety',
  'notes',
]

// ── H&S / Access opt-in values (shown on PDF) ──────────────────────────────

export const HS_OPTIN_VALUES = [
  { group: 'Landing Access', value: 'Internal Scaffold by Customer' },
  { group: 'External Access', value: 'Scaffold by Customer' },
]

// ── Item heading wording by Type of Work ────────────────────────────────────

export const ITEM_HEADING_WORDING = {
  complete_new:        'Supply & Install a complete new Doc L',
  new_pair_of_sashes:  'Supply & Install a new pair of sashes for',
  draught_seal:        'Including Draught Proofing',
  bi_glass:            'Supply & Install Bi-Glass secondary glazing for',
}

// ── Preview watermark ───────────────────────────────────────────────────────

export const PREVIEW_WATERMARK = 'PREVIEW'

// ── Combined export for snapshot archival ────────────────────────────────────

export const QUOTE_CONTENT = {
  front_cover_letter: FRONT_COVER_LETTER,
  back_cover_letter: BACK_COVER_LETTER,
  lead_times: LEAD_TIMES,
  bank_details: BANK_DETAILS,
  footer: FOOTER,
  spec_section_order: SPEC_SECTION_ORDER,
  hs_optin_values: HS_OPTIN_VALUES,
  item_heading_wording: ITEM_HEADING_WORDING,
}
