/**
 * publishQuote.js — shared publish logic for both Overview and Matrix.
 *
 * Builds snapshot → renders PDF (no watermark) → uploads to Storage →
 * updates the quote row with status, snapshot and pdf_path together.
 * If the render or upload fails, the quote stays Open.
 */

import { buildQuoteSnapshot } from './buildSnapshot.js'

/**
 * @param {{ quoteId, leadId, userId, leadNumber, quoteNumber, supabase }} opts
 * @returns {Promise<{ snapshot: object, pdfPath: string }>}
 */
export async function publishQuote({ quoteId, leadId, userId, leadNumber, quoteNumber, supabase }) {
  // 1. Build snapshot
  const snapshot = await buildQuoteSnapshot({ quoteId, leadId, userId, supabase })

  // 2. Render PDF (no watermark)
  const { renderQuotePdf } = await import('./pdf/renderQuotePdf.js')
  const pdfBlob = await renderQuotePdf(snapshot, { watermark: false })

  // 3. Upload PDF to a unique path (timestamp avoids "already exists" on retry)
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) // yyyymmddHHMMss
  const pdfPath = `L${leadNumber || leadId}/L${leadNumber || ''}_${quoteNumber}_${ts}.pdf`
  const { error: uploadError } = await supabase.storage
    .from('quote-pdfs')
    .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: false })
  if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`)

  // 4. Update quote with status, snapshot AND pdf_path together
  const { error } = await supabase.from('quotes').update({
    status: 'Published',
    published_at: snapshot.published_at,
    published_by: userId ?? null,
    valid_until: snapshot.quote_settings.valid_until,
    snapshot,
    pdf_path: pdfPath,
  }).eq('id', quoteId)
  if (error) throw new Error(`Publish failed: ${error.message}`)

  // 5. Lead history
  try {
    await supabase.from('lead_history').insert({
      lead_id: leadId,
      user_id: userId ?? null,
      event: 'Quote PDF generated',
      new_value: `${leadNumber} / ${quoteNumber}`,
      created_at: new Date().toISOString(),
    })
  } catch { /* ignore */ }

  return { snapshot, pdfPath }
}
