/**
 * copyQuote.js — shared copy logic for both Overview and Matrix.
 *
 * Creates a new Open quote with the same settings and drawing selections
 * as the source quote. Records the copy in lead_history.
 *
 * @throws {Error} on insert failures so the caller can show the message.
 */

import { nextQuoteNumber } from './publishValidation.js'

/**
 * @param {{
 *   sourceQuote: object,
 *   quotes: Array,
 *   leadId: string,
 *   leadNumber: string,
 *   jobItems: Array,
 *   selections: object,
 *   userId: string|null,
 *   userEmail: string|null,
 *   supabase: object,
 *   priceFileId?: string|null,
 * }} opts
 * @returns {Promise<{ newQuote: object, selRows: Array }>}
 */
export async function copyQuote({
  sourceQuote, quotes, leadId, leadNumber,
  jobItems, selections, userId, userEmail,
  supabase, priceFileId,
}) {
  const newNum = nextQuoteNumber(quotes)

  const { data: newQuote, error: qErr } = await supabase
    .from('quotes')
    .insert({
      lead_id: leadId,
      quote_number: newNum,
      status: 'Open',
      salesperson_id: sourceQuote.salesperson_id ?? null,
      valid_days: sourceQuote.valid_days ?? 30,
      discount_pct: sourceQuote.discount_pct ?? 0,
      deposit_pct: sourceQuote.deposit_pct ?? 40,
      interim_pct: sourceQuote.interim_pct ?? 50,
      price_file_id: sourceQuote.price_file_id ?? priceFileId ?? null,
      copied_from_quote_id: sourceQuote.id,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (qErr) throw new Error(`Copy failed: ${qErr.message}`)
  if (!newQuote) throw new Error('Copy failed: no quote returned')

  // Copy drawing selections
  // selections may be keyed as `jobItemId` (Overview) or `${quoteId}_${jobItemId}` (Matrix)
  const selRows = jobItems.map(item => {
    const dwgId = selections[item.id] || selections[`${sourceQuote.id}_${item.id}`]
    return dwgId ? { quote_id: newQuote.id, job_item_id: item.id, drawing_id: dwgId } : null
  }).filter(Boolean)

  if (selRows.length > 0) {
    const { error: selErr } = await supabase.from('quote_drawings').insert(selRows)
    if (selErr) throw new Error(`Copy failed (drawings): ${selErr.message}`)
  }

  // Lead history (best-effort)
  try {
    await supabase.from('lead_history').insert({
      lead_id: leadId,
      user_id: userId ?? null,
      user_email: userEmail ?? null,
      event: 'Quote copied',
      old_value: `${leadNumber} / ${sourceQuote.quote_number}`,
      new_value: `${leadNumber} / ${newNum}`,
      created_at: new Date().toISOString(),
    })
  } catch { /* ignore */ }

  return { newQuote, selRows }
}
