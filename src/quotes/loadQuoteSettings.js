/**
 * loadQuoteSettings.js — load quote settings from the `settings` table,
 * falling back to quoteContent.js defaults when a key is missing.
 *
 * Settings keys:
 *   quote_letters        — { front_cover_letter, back_cover_letter }
 *   quote_lead_times     — { ds_lead_time, bg_lead_time, nj_lead_time }
 *   quote_bank_details   — { name, sort_code, account_no }
 *   quote_footer         — { company, address, contact, continue_text, left, right, background }
 *   quote_sections       — [ ordered list of section IDs ]
 *   quote_output_config  — { summary_rows, stage_labels, salesperson_label, default_layout, ... }
 *   quote_hs_optin       — [{ group, value }]
 *   quote_item_wording   — { complete_new, new_pair_of_sashes, draught_seal, bi_glass }
 *
 * Each key is stored as JSON in settings.value.
 *
 * mergeQuoteContent(dbSettings) is the pure function; loadQuoteSettings(supabase) is the async wrapper.
 */

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

/**
 * Given a map of setting_key → parsed JSON value from the database,
 * merge with the quoteContent.js defaults and return the full content object.
 *
 * @param {object} dbSettings  { quote_letters: {...}, quote_lead_times: {...}, ... }
 * @returns {object}  Same shape as QUOTE_CONTENT
 */
export function mergeQuoteContent(dbSettings = {}) {
  const letters = dbSettings.quote_letters || {}
  const leadTimes = dbSettings.quote_lead_times || {}
  const bank = dbSettings.quote_bank_details || {}
  const footer = dbSettings.quote_footer || {}
  const sections = dbSettings.quote_sections || null
  const hsOptin = dbSettings.quote_hs_optin || null
  const itemWording = dbSettings.quote_item_wording || {}

  return {
    front_cover_letter: letters.front_cover_letter ?? FRONT_COVER_LETTER,
    back_cover_letter: letters.back_cover_letter ?? BACK_COVER_LETTER,
    lead_times: {
      ds_lead_time: leadTimes.ds_lead_time ?? LEAD_TIMES.ds_lead_time,
      bg_lead_time: leadTimes.bg_lead_time ?? LEAD_TIMES.bg_lead_time,
      nj_lead_time: leadTimes.nj_lead_time ?? LEAD_TIMES.nj_lead_time,
    },
    bank_details: {
      name: bank.name ?? BANK_DETAILS.name,
      sort_code: bank.sort_code ?? BANK_DETAILS.sort_code,
      account_no: bank.account_no ?? BANK_DETAILS.account_no,
    },
    footer: {
      company: footer.company ?? FOOTER.company,
      address: footer.address ?? FOOTER.address,
      contact: footer.contact ?? FOOTER.contact,
      continue_text: footer.continue_text ?? FOOTER.continue_text,
      left: footer.left ?? FOOTER.left,
      right: footer.right ?? FOOTER.right,
      background: footer.background ?? FOOTER.background,
    },
    spec_section_order: sections ?? SPEC_SECTION_ORDER,
    hs_optin_values: hsOptin ?? HS_OPTIN_VALUES,
    item_heading_wording: {
      ...ITEM_HEADING_WORDING,
      ...itemWording,
    },
  }
}

/**
 * Validate that a letter text does not contain unknown merge fields.
 *
 * @param {string} text  The letter text to validate
 * @returns {{ valid: boolean, unknownFields: string[] }}
 */
export function validateMergeFields(text) {
  if (!text) return { valid: true, unknownFields: [] }
  const KNOWN_FIELDS = new Set([
    'customer_forename',
    'installation_full_address_one_line',
    'nj_lead_time',
    'ds_lead_time',
    'bg_lead_time',
    'sales_person_full_name',
  ])
  const found = [...text.matchAll(/\[([^\]]+)\]/g)].map(m => m[1])
  const unknownFields = found.filter(f => !KNOWN_FIELDS.has(f))
  return { valid: unknownFields.length === 0, unknownFields }
}

/**
 * Parse back cover letter text into the structured [{heading, body}] format.
 * Convention: a line on its own followed by a blank line is a heading.
 */
export function parseBackCoverLetter(text) {
  if (!text || typeof text !== 'string') return []
  const sections = []
  const blocks = text.split(/\n\n+/)
  let currentHeading = null

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    // A single-line block that isn't too long is a heading
    if (!trimmed.includes('\n') && trimmed.length < 120 && currentHeading === null) {
      currentHeading = trimmed
    } else if (currentHeading !== null) {
      sections.push({ heading: currentHeading, body: trimmed })
      currentHeading = null
    } else {
      // Standalone body paragraph without heading
      sections.push({ heading: '', body: trimmed })
    }
  }
  // Trailing heading with no body
  if (currentHeading !== null) {
    sections.push({ heading: currentHeading, body: '' })
  }
  return sections
}

/**
 * Flatten structured back cover letter to text.
 */
export function flattenBackCoverLetter(sections) {
  if (typeof sections === 'string') return sections
  return (sections || []).map(s => `${s.heading}\n\n${s.body}`).join('\n\n')
}

// ── Quote settings keys ────────────────────────────────────────────────────

export const QUOTE_SETTINGS_KEYS = [
  'quote_letters',
  'quote_lead_times',
  'quote_bank_details',
  'quote_footer',
  'quote_sections',
  'quote_output_config',
  'quote_hs_optin',
  'quote_item_wording',
]

/**
 * Load quote settings from the database. Returns { key: parsedJSON } map.
 *
 * @param {object} supabaseClient  The supabase client
 * @returns {Promise<object>}  Map of settings key → parsed value
 */
export async function loadQuoteSettings(supabaseClient) {
  const { data, error } = await supabaseClient
    .from('settings')
    .select('key, value')
    .in('key', QUOTE_SETTINGS_KEYS)

  if (error) {
    console.warn('loadQuoteSettings: failed to load settings:', error.message)
    return {}
  }

  const result = {}
  for (const row of (data || [])) {
    try {
      result[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
    } catch {
      console.warn(`loadQuoteSettings: failed to parse ${row.key}`)
    }
  }
  return result
}

/**
 * Save a single quote setting and log to settings_history.
 *
 * @param {object} supabaseClient  Supabase client
 * @param {string} key  Setting key (e.g. 'quote_letters')
 * @param {object} value  The JSON value to save
 * @param {string} userEmail  Who saved it
 * @param {string} description  Human-readable description of the change
 * @returns {Promise<{ error: object|null }>}
 */
export async function saveQuoteSetting(supabaseClient, key, value, userEmail, description) {
  const { error: upsertError } = await supabaseClient.from('settings').upsert({
    key,
    value: JSON.stringify(value),
    updated_at: new Date().toISOString(),
    updated_by: userEmail,
  })

  if (upsertError) return { error: upsertError }

  // Log to settings_history
  const { error: historyError } = await supabaseClient.from('settings_history').insert({
    setting_key: key,
    description: description || `Updated ${key}`,
    changed_by: userEmail,
  })

  if (historyError) {
    console.warn('saveQuoteSetting: failed to log history:', historyError.message)
  }

  return { error: null }
}
