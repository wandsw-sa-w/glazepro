/**
 * pricingEngine.js
 * Five-pass drawing-level and quote-level pricing engine.
 *
 * ── DB schema (confirmed against migrations) ────────────────────────────────
 *
 * price_files          id, name, status
 * price_rules          id, price_file_id, rule_family, level, name,
 *                      condition, quantity, value, markup, part_code,
 *                      is_active, sort_order
 *                      rule_family ∈ { 'install_labour', 'manufacture_labour',
 *                                      'parts', 'price' }
 *                      level ∈ { 'item', 'quote' }  (on price rules only)
 * price_file_parts     price_file_id, part_code, part_name, unit_cost
 * pricing_runs         id, drawing_id, price_file_id, status, created_at
 * drawing_rule_results id, drawing_id, price_file_id, pricing_run_id,
 *                      price_rule_id, loop_target_type, loop_index,
 *                      cost, sales, markup_applied
 * drawing_allocated_parts
 *                      id, drawing_id, price_file_id, pricing_run_id,
 *                      price_rule_id, part_code, part_name,
 *                      unit_cost, quantity, total_cost
 * drawing_pricing_variables
 *                      id, pricing_run_id, drawing_id, variables (jsonb)
 * quote_pricing_runs   id, quote_id, price_file_id, status, created_at
 * quote_rule_results   id, quote_id, price_file_id, quote_pricing_run_id,
 *                      price_rule_id, cost, sales, markup_applied
 * quote_item_apportionment
 *                      id, quote_rule_result_id, quote_pricing_run_id,
 *                      drawing_id, cost, sales
 */

import { computeVariables } from './computeVariables.js'
import { evaluateCondition, evaluateNumber } from './evaluator.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Throw a structured error that includes the rule name so that failures in
 * production are easy to trace back to the offending rule.
 */
function ruleError(rule, field, cause) {
  throw new Error(
    `Rule "${rule.name}" [${rule.id}] — error in ${field}: ${cause.message}`
  )
}

// ── priceDrawing ──────────────────────────────────────────────────────────────

/**
 * Run all five passes for a single drawing and persist the results.
 *
 * @param {string} drawingId
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ success: boolean, calculatedPrice?: number, pricingRunId?: string, error?: string }>}
 */
export async function priceDrawing(drawingId, supabase) {
  let pricingRunId = null

  try {
    // ── 1. Fetch drawing row joined with job_items for floor_level ────────────
    const { data: drawingRow, error: drawingErr } = await supabase
      .from('drawings')
      .select('*, job_items(floor_level)')
      .eq('id', drawingId)
      .single()

    if (drawingErr || !drawingRow) {
      throw new Error(`Failed to fetch drawing ${drawingId}: ${drawingErr?.message ?? 'not found'}`)
    }

    const floorLevel = drawingRow.job_items?.floor_level ?? null

    // ── 2. Fetch ironmongery items ────────────────────────────────────────────
    const { data: ironRows, error: ironErr } = await supabase
      .from('drawing_ironmongery')
      .select('quantity, ironmongery_variants(cost), ironmongery_products(category)')
      .eq('drawing_id', drawingId)

    if (ironErr) {
      throw new Error(`Failed to fetch ironmongery for drawing ${drawingId}: ${ironErr.message}`)
    }

    const ironmongeryItems = (ironRows || []).map(row => ({
      quantity:      row.quantity ?? 0,
      unit_cost:     row.ironmongery_variants?.cost ?? 0,
      category_name: row.ironmongery_products?.category ?? '',
    }))

    // ── 3. Fetch published price file ─────────────────────────────────────────
    const { data: priceFile, error: pfErr } = await supabase
      .from('price_files')
      .select('id')
      .eq('status', 'published')
      .single()

    if (pfErr || !priceFile) {
      throw new Error(`No published price file found: ${pfErr?.message ?? 'not found'}`)
    }

    // ── 4. Compute initial variable context ───────────────────────────────────
    let variables = computeVariables(drawingRow, floorLevel, ironmongeryItems)

    if (!variables) {
      throw new Error(`computeVariables returned null for drawing ${drawingId}`)
    }

    // ── 5. Create pricing_runs row ────────────────────────────────────────────
    const { data: pricingRun, error: runErr } = await supabase
      .from('pricing_runs')
      .insert({
        drawing_id:    drawingId,
        price_file_id: priceFile.id,
        status:        'in_progress',
        created_at:    new Date().toISOString(),
      })
      .select('id')
      .single()

    if (runErr || !pricingRun) {
      throw new Error(`Failed to create pricing_run: ${runErr?.message ?? 'unknown'}`)
    }

    pricingRunId = pricingRun.id

    // ── 6. Pass 0a — install_labour ───────────────────────────────────────────
    const { data: installRules, error: irErr } = await supabase
      .from('price_rules')
      .select('id, name, condition, quantity')
      .eq('price_file_id', priceFile.id)
      .eq('rule_family', 'install_labour')
      .eq('is_active', true)
      .order('sort_order')

    if (irErr) throw new Error(`Failed to fetch install_labour rules: ${irErr.message}`)

    let totalInstallMinutes = 0
    const installResultRows = []

    for (const rule of (installRules || [])) {
      let fires
      try { fires = evaluateCondition(rule.condition, variables) }
      catch (e) { ruleError(rule, 'condition', e) }

      if (!fires) continue

      let minutes
      try { minutes = evaluateNumber(rule.quantity, variables) }
      catch (e) { ruleError(rule, 'quantity', e) }

      totalInstallMinutes += minutes
      installResultRows.push({
        drawing_id:       drawingId,
        price_file_id:    priceFile.id,
        pricing_run_id:   pricingRunId,
        price_rule_id:    rule.id,
        loop_target_type: null,
        loop_index:       null,
        cost:             minutes,
        sales:            null,
        markup_applied:   null,
      })
    }

    variables.total_install_minutes = totalInstallMinutes

    if (installResultRows.length > 0) {
      const { error: ir0aErr } = await supabase
        .from('drawing_rule_results')
        .insert(installResultRows)
      if (ir0aErr) throw new Error(`Failed to write Pass 0a results: ${ir0aErr.message}`)
    }

    // ── 7. Pass 0b — manufacture_labour ──────────────────────────────────────
    const { data: mfgRules, error: mrErr } = await supabase
      .from('price_rules')
      .select('id, name, condition, quantity')
      .eq('price_file_id', priceFile.id)
      .eq('rule_family', 'manufacture_labour')
      .eq('is_active', true)
      .order('sort_order')

    if (mrErr) throw new Error(`Failed to fetch manufacture_labour rules: ${mrErr.message}`)

    let totalMfgMinutes = 0
    const mfgResultRows = []

    for (const rule of (mfgRules || [])) {
      let fires
      try { fires = evaluateCondition(rule.condition, variables) }
      catch (e) { ruleError(rule, 'condition', e) }

      if (!fires) continue

      let minutes
      try { minutes = evaluateNumber(rule.quantity, variables) }
      catch (e) { ruleError(rule, 'quantity', e) }

      totalMfgMinutes += minutes
      mfgResultRows.push({
        drawing_id:       drawingId,
        price_file_id:    priceFile.id,
        pricing_run_id:   pricingRunId,
        price_rule_id:    rule.id,
        loop_target_type: null,
        loop_index:       null,
        cost:             minutes,
        sales:            null,
        markup_applied:   null,
      })
    }

    variables.total_manufacture_minutes = totalMfgMinutes

    if (mfgResultRows.length > 0) {
      const { error: ir0bErr } = await supabase
        .from('drawing_rule_results')
        .insert(mfgResultRows)
      if (ir0bErr) throw new Error(`Failed to write Pass 0b results: ${ir0bErr.message}`)
    }

    // ── 8. Pass 0c — parts ────────────────────────────────────────────────────
    const { data: partsRules, error: prErr } = await supabase
      .from('price_rules')
      .select('id, name, condition, quantity, part_code')
      .eq('price_file_id', priceFile.id)
      .eq('rule_family', 'parts')
      .eq('is_active', true)
      .order('sort_order')

    if (prErr) throw new Error(`Failed to fetch parts rules: ${prErr.message}`)

    const { data: pfParts, error: pfPartsErr } = await supabase
      .from('price_file_parts')
      .select('part_code, part_name, unit_cost')
      .eq('price_file_id', priceFile.id)

    if (pfPartsErr) throw new Error(`Failed to fetch price_file_parts: ${pfPartsErr.message}`)

    const partsMap = Object.fromEntries((pfParts || []).map(p => [p.part_code, p]))

    let totalPartsCost = 0
    const allocatedPartsRows = []

    for (const rule of (partsRules || [])) {
      let fires
      try { fires = evaluateCondition(rule.condition, variables) }
      catch (e) { ruleError(rule, 'condition', e) }

      if (!fires) continue

      let qty
      try { qty = evaluateNumber(rule.quantity, variables) }
      catch (e) { ruleError(rule, 'quantity', e) }

      const part = partsMap[rule.part_code]
      if (!part) throw new Error(`Part not found in price file snapshot: ${rule.part_code}`)

      const unitCost  = part.unit_cost
      const totalCost = qty * unitCost
      totalPartsCost += totalCost

      allocatedPartsRows.push({
        drawing_id:     drawingId,
        price_file_id:  priceFile.id,
        pricing_run_id: pricingRunId,
        price_rule_id:  rule.id,
        part_code:      part.part_code,
        part_name:      part.part_name,
        unit_cost:      part.unit_cost,
        quantity:       qty,
        total_cost:     totalCost,
      })
    }

    variables.total_parts_cost = totalPartsCost

    if (allocatedPartsRows.length > 0) {
      const { error: ir0cErr } = await supabase
        .from('drawing_allocated_parts')
        .insert(allocatedPartsRows)
      if (ir0cErr) throw new Error(`Failed to write Pass 0c allocated parts: ${ir0cErr.message}`)
    }

    // ── 9. Pass 1 — price item-level rules ───────────────────────────────────
    const { data: priceRules, error: price1Err } = await supabase
      .from('price_rules')
      .select('id, name, condition, quantity, value, markup')
      .eq('price_file_id', priceFile.id)
      .eq('rule_family', 'price')
      .eq('level', 'item')
      .eq('is_active', true)
      .order('sort_order')

    if (price1Err) throw new Error(`Failed to fetch price rules: ${price1Err.message}`)

    let calculatedPrice = 0
    const priceResultRows = []

    for (const rule of (priceRules || [])) {
      let fires
      try { fires = evaluateCondition(rule.condition, variables) }
      catch (e) { ruleError(rule, 'condition', e) }

      if (!fires) continue

      let quantityResult, valueResult
      try { quantityResult = evaluateNumber(rule.quantity, variables) }
      catch (e) { ruleError(rule, 'quantity', e) }

      try { valueResult = evaluateNumber(rule.value, variables) }
      catch (e) { ruleError(rule, 'value', e) }

      const cost   = quantityResult * valueResult
      const markup = rule.markup ?? 1
      const sales  = cost * markup

      calculatedPrice += sales

      priceResultRows.push({
        drawing_id:       drawingId,
        price_file_id:    priceFile.id,
        pricing_run_id:   pricingRunId,
        price_rule_id:    rule.id,
        loop_target_type: null,
        loop_index:       null,
        cost,
        sales,
        markup_applied:   markup,
      })
    }

    if (priceResultRows.length > 0) {
      const { error: ir1Err } = await supabase
        .from('drawing_rule_results')
        .insert(priceResultRows)
      if (ir1Err) throw new Error(`Failed to write Pass 1 results: ${ir1Err.message}`)
    }

    // ── 10. Write calculated_price to drawings ────────────────────────────────
    const { error: calcErr } = await supabase
      .from('drawings')
      .update({ calculated_price: calculatedPrice })
      .eq('id', drawingId)

    if (calcErr) throw new Error(`Failed to update drawings.calculated_price: ${calcErr.message}`)

    // ── 11. Write full variable snapshot ─────────────────────────────────────
    const { error: varErr } = await supabase
      .from('drawing_pricing_variables')
      .insert({
        pricing_run_id: pricingRunId,
        drawing_id:     drawingId,
        price_file_id:  priceFile.id,
        variables,
      })

    if (varErr) throw new Error(`Failed to write drawing_pricing_variables: ${varErr.message}`)

    // ── 12. Mark pricing_run complete ─────────────────────────────────────────
    await supabase
      .from('pricing_runs')
      .update({ status: 'complete' })
      .eq('id', pricingRunId)

    // ── 13. Return ────────────────────────────────────────────────────────────
    return { success: true, calculatedPrice, pricingRunId }

  } catch (err) {
    console.error('[priceDrawing] error:', err)

    if (pricingRunId) {
      await supabase
        .from('pricing_runs')
        .update({ status: 'failed' })
        .eq('id', pricingRunId)
        .catch(e => console.error('[priceDrawing] failed to mark run as failed:', e))
    }

    return { success: false, error: err.message }
  }
}

// ── priceQuote ────────────────────────────────────────────────────────────────

/**
 * Evaluate quote-level rules and apportion their cost and sales values
 * across drawings proportionally by calculated_price.
 *
 * @param {string} quoteId
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function priceQuote(quoteId, supabase) {
  let quotePricingRunId = null

  try {
    // ── 1. Fetch all drawings on this quote ───────────────────────────────────
    const { data: qdRows, error: qdErr } = await supabase
      .from('quote_drawings')
      .select('drawing_id, drawings(calculated_price)')
      .eq('quote_id', quoteId)

    if (qdErr) throw new Error(`Failed to fetch quote_drawings: ${qdErr.message}`)

    const drawings = (qdRows || []).map(row => ({
      drawing_id:       row.drawing_id,
      calculated_price: parseFloat(row.drawings?.calculated_price ?? 0) || 0,
    }))

    // ── 2. Sum quote_total ────────────────────────────────────────────────────
    const quoteTotal = drawings.reduce((sum, d) => sum + d.calculated_price, 0)

    // ── 3. Fetch published price file ─────────────────────────────────────────
    const { data: priceFile, error: pfErr } = await supabase
      .from('price_files')
      .select('id')
      .eq('status', 'published')
      .single()

    if (pfErr || !priceFile) {
      throw new Error(`No published price file found: ${pfErr?.message ?? 'not found'}`)
    }

    // ── 4. Create quote_pricing_runs row ──────────────────────────────────────
    const { data: qRun, error: qrErr } = await supabase
      .from('quote_pricing_runs')
      .insert({
        quote_id:      quoteId,
        price_file_id: priceFile.id,
        status:        'in_progress',
        created_at:    new Date().toISOString(),
      })
      .select('id')
      .single()

    if (qrErr || !qRun) {
      throw new Error(`Failed to create quote_pricing_run: ${qrErr?.message ?? 'unknown'}`)
    }

    quotePricingRunId = qRun.id

    // ── 5. Fetch active quote-level rules ─────────────────────────────────────
    const { data: quoteRules, error: qrulesErr } = await supabase
      .from('price_rules')
      .select('id, name, condition, quantity, value, markup')
      .eq('price_file_id', priceFile.id)
      .eq('rule_family', 'price')
      .eq('level', 'quote')
      .eq('is_active', true)
      .order('sort_order')

    if (qrulesErr) throw new Error(`Failed to fetch quote rules: ${qrulesErr.message}`)

    const quoteVariables     = { quote_total: quoteTotal }
    const drawingPriceDeltas = {}   // drawing_id → accumulated sales share

    // ── 6. Evaluate each rule, write quote_rule_results, then apportion ───────
    for (const rule of (quoteRules || [])) {
      let fires
      try { fires = evaluateCondition(rule.condition, quoteVariables) }
      catch (e) { ruleError(rule, 'condition', e) }

      if (!fires) continue

      let quantityResult, valueResult
      try { quantityResult = evaluateNumber(rule.quantity, quoteVariables) }
      catch (e) { ruleError(rule, 'quantity', e) }

      try { valueResult = evaluateNumber(rule.value, quoteVariables) }
      catch (e) { ruleError(rule, 'value', e) }

      const cost      = quantityResult * valueResult
      const markup    = rule.markup ?? 1
      const ruleSales = cost * markup

      // Insert one at a time to capture the returned id for apportionment
      const { data: qrResult, error: qrInsErr } = await supabase
        .from('quote_rule_results')
        .insert({
          quote_id:             quoteId,
          price_file_id:        priceFile.id,
          quote_pricing_run_id: quotePricingRunId,
          price_rule_id:        rule.id,
          cost,
          sales:                ruleSales,
          markup_applied:       markup,
        })
        .select('id')
        .single()

      if (qrInsErr || !qrResult) {
        throw new Error(`Failed to write quote_rule_result for rule ${rule.id}: ${qrInsErr?.message ?? 'unknown'}`)
      }

      const quoteRuleResultId = qrResult.id

      // ── 7. Apportion both cost and sales value-weighted across drawings ────
      const apportionmentRows = []

      for (const drawing of drawings) {
        const weight     = quoteTotal > 0 ? drawing.calculated_price / quoteTotal : 0
        const costShare  = weight * cost
        const salesShare = weight * ruleSales

        apportionmentRows.push({
          quote_rule_result_id: quoteRuleResultId,
          quote_pricing_run_id: quotePricingRunId,
          drawing_id:           drawing.drawing_id,
          cost:                 costShare,
          sales:                salesShare,
        })

        drawingPriceDeltas[drawing.drawing_id] =
          (drawingPriceDeltas[drawing.drawing_id] ?? 0) + salesShare
      }

      // ── 8. Write quote_item_apportionment rows for this rule ─────────────
      if (apportionmentRows.length > 0) {
        const { error: apErr } = await supabase
          .from('quote_item_apportionment')
          .insert(apportionmentRows)
        if (apErr) throw new Error(`Failed to write quote_item_apportionment for rule ${rule.id}: ${apErr.message}`)
      }
    }

    // ── 9. Update each drawing's calculated_price with its apportioned share ──
    await Promise.all(
      Object.entries(drawingPriceDeltas).map(async ([dId, delta]) => {
        const original = drawings.find(d => d.drawing_id === dId)?.calculated_price ?? 0
        const { error: updErr } = await supabase
          .from('drawings')
          .update({ calculated_price: original + delta })
          .eq('id', dId)
        if (updErr) {
          throw new Error(`Failed to update calculated_price for drawing ${dId}: ${updErr.message}`)
        }
      })
    )

    // ── 10. Mark quote_pricing_run complete ───────────────────────────────────
    await supabase
      .from('quote_pricing_runs')
      .update({ status: 'complete' })
      .eq('id', quotePricingRunId)

    // ── 11. Return ────────────────────────────────────────────────────────────
    return { success: true }

  } catch (err) {
    console.error('[priceQuote] error:', err)

    if (quotePricingRunId) {
      await supabase
        .from('quote_pricing_runs')
        .update({ status: 'failed' })
        .eq('id', quotePricingRunId)
        .catch(e => console.error('[priceQuote] failed to mark run as failed:', e))
    }

    return { success: false, error: err.message }
  }
}
