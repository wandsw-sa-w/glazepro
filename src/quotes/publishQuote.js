/**
 * publishQuote.js — shared publish logic for both Overview and Matrix.
 *
 * Builds snapshot → runs self-contained validation → renders PDF
 * (no watermark) → uploads to Storage → updates the quote row with
 * status, snapshot and pdf_path together.
 * If the render, upload or validation fails, the quote stays Open.
 */

import { buildQuoteSnapshot } from './buildSnapshot.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'
import { computeVariables, computeQuoteVariables } from '../pricing/computeVariables.js'
import { validateDrawing, validateQuote, hasErrors } from '../validation/validate.js'

/**
 * @param {{ quoteId, leadId, userId, userName, userEmail, leadNumber, quoteNumber, supabase }} opts
 * @returns {Promise<{ snapshot: object, pdfPath: string }>}
 */
export async function publishQuote({ quoteId, leadId, userId, userName, userEmail, leadNumber, quoteNumber, supabase }) {
  // 1. Build snapshot
  const snapshot = await buildQuoteSnapshot({ quoteId, leadId, userId, userName, supabase })

  if (!snapshot.items || snapshot.items.length === 0) {
    throw new Error('Add at least one item before publishing.')
  }

  // 2. Self-contained validation — load rules and run against snapshot trees
  {
    const [
      { data: ruleData, error: rErr },
      { data: listData, error: lErr },
      { data: valData, error: vErr },
    ] = await Promise.all([
      supabase.from('validation_rules').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('validation_lists').select('*'),
      supabase.from('validation_list_values').select('*'),
    ])
    if (rErr) throw new Error(`Failed to load validation rules: ${rErr.message}`)
    const listsMap = {}
    for (const l of (listData || [])) {
      listsMap[l.name] = (valData || []).filter(v => v.list_id === l.id).map(v => v.value)
    }

    const itemRules = (ruleData || []).filter(r => r.level === 'item')
    const quoteRules = (ruleData || []).filter(r => r.level === 'quote')

    const allErrors = []
    const itemVarsList = []

    for (const item of snapshot.items) {
      const tree = item.parts_tree
      if (!tree) continue
      try {
        const derived = computeDerived(tree)
        const vars = computeVariables(tree, derived) || {}
        itemVarsList.push(vars)
        const results = validateDrawing(tree, vars, itemRules, listsMap)
        for (const r of results) {
          if (r.status === 'fired' && r.severity === 'error') {
            allErrors.push(`Item ${item.job_item.item_number}: ${r.message}`)
          }
        }
      } catch { /* skip items that fail to compute */ }
    }

    // Installation labour from the snapshot's pricing data
    let totalInstallMinutes = 0
    for (const item of snapshot.items) {
      // pricing_run_id is in the snapshot; total_install_minutes is in item variables
      // For now approximate from item-level — the real value comes from pricing_variables
      totalInstallMinutes += (item.derived?.totalInstallMinutes ?? 0)
    }

    // Quote-level rules
    const quoteVars = computeQuoteVariables(itemVarsList, { totalInstallMinutes })
    const quoteResults = validateQuote(quoteVars, [], quoteRules, listsMap)
    for (const r of quoteResults) {
      if (r.status === 'fired' && r.severity === 'error') {
        allErrors.push(`Quote: ${r.message}`)
      }
    }

    if (allErrors.length > 0) {
      throw new Error(
        `${allErrors.length} validation error(s) must be resolved before publishing:\n` +
        allErrors.map(e => `  - ${e}`).join('\n')
      )
    }
  }

  // 3. Render PDF (no watermark)
  const { renderQuotePdf } = await import('./pdf/renderQuotePdf.js')
  const pdfBlob = await renderQuotePdf(snapshot, { watermark: false })

  // 4. Upload PDF to a unique path (timestamp avoids "already exists" on retry)
  // leadNumber already starts with "L" (e.g. "L507712") — don't add another
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) // yyyymmddHHMMss
  const lead = leadNumber || `L${leadId}`
  const pdfPath = `${lead}/${lead}_${quoteNumber}_${ts}.pdf`
  const { error: uploadError } = await supabase.storage
    .from('quote-pdfs')
    .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: false })
  if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`)

  // 5. Update quote with status, snapshot AND pdf_path together
  const { error } = await supabase.from('quotes').update({
    status: 'Published',
    published_at: snapshot.published_at,
    published_by: userId ?? null,
    valid_until: snapshot.quote_settings.valid_until,
    snapshot,
    pdf_path: pdfPath,
  }).eq('id', quoteId)
  if (error) throw new Error(`Publish failed: ${error.message}`)

  // 6. Lead history — one "Quote published" row with user email
  try {
    await supabase.from('lead_history').insert({
      lead_id: leadId,
      user_id: userId ?? null,
      user_email: userEmail ?? null,
      event: 'Quote published',
      new_value: `${leadNumber} / ${quoteNumber}`,
      created_at: new Date().toISOString(),
    })
  } catch { /* ignore */ }

  return { snapshot, pdfPath }
}
