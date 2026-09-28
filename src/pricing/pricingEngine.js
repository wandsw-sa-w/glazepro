/**
 * pricingEngine.js
 * Three-pass (manufacture_labour → install_labour → price) pricing engine.
 *
 * ── DB schema (confirmed against migrations) ────────────────────────────────
 *
 * price_files          id, name, status
 * price_rules          id, price_file_id, rule_family, level, name,
 *                      condition, quantity, value, markup, part_code,
 *                      loop_target, group_name, is_active, sort_order
 *                      rule_family ∈ { 'install_labour', 'manufacture_labour',
 *                                      'parts', 'price' }
 *                      level ∈ { 'item', 'quote' }  (on price rules only)
 * price_file_parts     price_file_id, part_code, part_name, unit_cost
 * price_file_variables price_file_id, variable_name, value
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
import { evaluateCondition, evaluateNumber, getExpressionVariables } from './evaluator.js'
import { loadDrawingParts } from '../drawingBoard/api.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'

// ── Tree helpers (local copies, same logic as computeDerived.js) ──────────────

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

function findAll(node, partType, acc = []) {
  if (!node) return acc
  if (node.part_type === partType) acc.push(node)
  for (const child of (node.children ?? [])) findAll(child, partType, acc)
  return acc
}

function findParentSash(tree, childKey) {
  function walk(node, parent) {
    if (!node) return null
    if (node.key === childKey) return parent
    for (const child of (node.children ?? [])) {
      const found = walk(child, node)
      if (found !== null) return found
    }
    return null
  }
  return walk(tree, null)
}

// ── Loop target helper ────────────────────────────────────────────────────────

const LOOP_PART_TYPES = {
  sliding_sash:  ['topSashPart', 'bottomSashPart'],
  frame:         ['assemblyFramePart'],
  glass_unit:    ['glassPart'],
  casement_sash: ['casementSashPart'],
  door_leaf:     ['doorLeafPart'],
  panel:         ['panelPart'],
}

function getLoopParts(tree, loopTarget) {
  if (!loopTarget) return [null]
  const partTypes = LOOP_PART_TYPES[loopTarget]
  if (!partTypes) return []  // unknown loop_target → skip entirely
  const parts = []
  for (const pt of partTypes) {
    parts.push(...findAll(tree, pt))
  }
  return parts  // empty array = no matching parts in tree → skip entirely
}

// ── Missing-variable defaulting ───────────────────────────────────────────────

/**
 * Pre-scan the variable names referenced by one or more expressions.
 * Any name not present in `vars` is injected as 0 so rule evaluation never
 * throws "undefined variable" — unknown names just default silently to 0.
 *
 * @param {string[]} exprs  - Array of expression strings (may be null/undefined)
 * @param {Object}   vars   - Current variable context
 * @returns {{ vars: Object, defaulted: string[] }}
 */
function defaultMissingVars(exprs, vars) {
  const missing = new Set()
  for (const expr of exprs) {
    if (!expr) continue
    for (const name of getExpressionVariables(expr)) {
      if (!(name in vars)) missing.add(name)
    }
  }
  if (missing.size === 0) return { vars, defaulted: [] }
  const augmented = { ...vars }
  for (const name of missing) augmented[name] = 0
  return { vars: augmented, defaulted: [...missing] }
}

// ── Part-level variable computation ──────────────────────────────────────────

function computePartVariables(partNode, tree, derived, baseVars) {
  if (!partNode) return {}
  const pt = partNode.part_type
  const v  = partNode.values ?? {}

  const isCordHung   = op => (op ?? '').toLowerCase().includes('cord')
  const isSpiralHung = op => (op ?? '').toLowerCase().includes('spiral')
  const isFixed      = op => { const s = (op ?? '').toLowerCase(); return s === 'fix' || s.includes('fix') }

  if (pt === 'topSashPart' || pt === 'bottomSashPart') {
    const isTop          = pt === 'topSashPart'
    const op             = v.operation ?? ''
    const is_complete_new = baseVars.is_complete_new ?? false
    const to_be_replaced  = is_complete_new || v.toBeReplaced === true

    // Sash geometry from pair derived
    const pair       = findFirst(tree, 'sashPairPart')
    const pairDerived = pair ? (derived[pair.key] ?? {}) : {}
    const gross_sash_width_in_mm  = pairDerived.sashWidth        ?? null
    const gross_sash_height_in_mm = isTop
      ? (pairDerived.topSashHeight    ?? null)
      : (pairDerived.bottomSashHeight ?? null)

    const stileWidth = v.leftWidth ?? 47
    const sash_sightline_width_in_mm = gross_sash_width_in_mm != null
      ? gross_sash_width_in_mm - 2 * stileWidth : null

    const headRail   = isTop ? (v.topHeight   ?? 49) : 0
    const botRail    = !isTop ? (v.bottomHeight ?? 88) : 0
    const midrail    = pair?.values?.midrailHeight ?? 40
    const sash_sightline_height_in_mm = gross_sash_height_in_mm != null
      ? gross_sash_height_in_mm - (isTop ? headRail : botRail) - midrail : null

    return {
      is_top_sash:    isTop,
      is_bottom_sash: !isTop,
      to_be_replaced,
      is_cord_hung:    isCordHung(op),
      is_spiral_hung:  isSpiralHung(op),
      is_fixed_sash:   isFixed(op),
      is_sash_arched:  v.archHead === true,
      gross_sash_width_in_mm,
      gross_sash_height_in_mm,
      sash_sightline_width_in_mm,
      sash_sightline_height_in_mm,
      unit_gb_qty:   0,  // NEEDS-DATA: glazing bars per sash not yet captured
    }
  }

  if (pt === 'assemblyFramePart') {
    return {
      to_be_replaced:     baseVars.is_complete_new ?? false,
      width:              (v.width  ?? 0) / 1000,  // metres (Integrate convention)
      height:             (v.height ?? 0) / 1000,  // metres
      frame_width_in_mm:  v.width  ?? 0,           // mm (kept for rules that use _in_mm)
      frame_height_in_mm: v.height ?? 0,
    }
  }

  if (pt === 'glassPart') {
    // Glass area from sash geometry
    const parentSash  = findParentSash(tree, partNode.key)
    const pair        = findFirst(tree, 'sashPairPart')
    const pairDerived = pair ? (derived[pair.key] ?? {}) : {}
    const glassWidth  = pairDerived.sashWidth ?? 0

    let glassHeight = 0
    if (parentSash?.part_type === 'topSashPart') {
      // topGlassHeight = topSashHeight - topRail - midrail
      const tsh      = pairDerived.topSashHeight ?? 0
      const topRail  = parentSash.values?.topHeight ?? 49
      const midrail  = pair?.values?.midrailHeight ?? 40
      glassHeight    = tsh - topRail - midrail
    } else if (parentSash?.part_type === 'bottomSashPart') {
      // bottomGlassHeight = bottomSashHeight - bottomRail - midrail
      const bsh      = pairDerived.bottomSashHeight ?? 0
      const botRail  = parentSash.values?.bottomHeight ?? 88
      const midrail  = pair?.values?.midrailHeight ?? 40
      glassHeight    = bsh - botRail - midrail
    }

    const actual_area  = (glassWidth > 0 && glassHeight > 0) ? (glassWidth * glassHeight) / 1e6 : 0
    const rounded_area = Math.ceil(actual_area * 2) / 2  // round up to nearest 0.5
    const glazingId    = v.glazingId ?? ''

    // to_be_replaced: glass is new if the job is complete_new OR the parent sash is replaced
    const to_be_replaced = (baseVars.is_complete_new === true) || (parentSash?.values?.toBeReplaced === true)

    // Glazing bars: barsWide = vertical dividers, barsHigh = horizontal dividers
    const barsWide = v.barsWide ?? 0
    const barsHigh = v.barsHigh ?? 0
    const unit_gb_qty = barsWide + barsHigh

    // internal_spacer_length (metres): sum of bar run lengths inside the pane opening
    const internal_spacer_length = (barsWide * glassHeight + barsHigh * glassWidth) / 1000

    return {
      actual_area,
      rounded_area,
      is_single_glazed: glazingId === 'single_glazed',
      is_double_glazed: glazingId === 'double_glazed',
      is_triple_glazed: glazingId === 'triple_glazed',
      glass_unit_thickness: 0,  // NEEDS-DATA: spacer-based thickness not yet mapped
      to_be_replaced,
      unit_gb_qty,
      internal_spacer_length,
    }
  }

  return {}
}

// ── Rule evaluation helpers ───────────────────────────────────────────────────

/**
 * Evaluate a labour (manufacture or install) rule line.
 * total_minutes = evaluateNumber(quantity) × evaluateNumber(value)
 */
function evalRuleLine(rule, vars, partNode) {
  // Pre-fill any unknown variable names with 0 to avoid "undefined variable" errors.
  const { vars: safeVars, defaulted: defaulted_vars } = defaultMissingVars(
    [rule.condition, rule.quantity, rule.value], vars
  )

  const line = {
    rule_id:        rule.id,
    rule_family:    rule.rule_family,
    group_name:     rule.group_name ?? null,
    name:           rule.name,
    loop_target:    rule.loop_target ?? null,
    part_key:       partNode?.key       ?? null,
    part_type:      partNode?.part_type ?? null,
    fires:          false,
    quantity:       0,
    value:          0,
    minutes:        0,
    error:          null,
    defaulted_vars,
    condition:      rule.condition,
    quantity_expr:  rule.quantity,
    value_expr:     rule.value,
  }

  try {
    line.fires = evaluateCondition(rule.condition || 'true', safeVars)
  } catch (e) {
    line.error = `condition: ${e.message}`
    return line
  }
  if (!line.fires) return line

  try {
    line.quantity = evaluateNumber(rule.quantity || '0', safeVars)
  } catch (e) {
    line.error = `quantity: ${e.message}`
    return line
  }
  try {
    line.value   = evaluateNumber(rule.value || '0', safeVars)
  } catch (e) {
    line.error = `value: ${e.message}`
    return line
  }
  line.minutes = line.quantity * line.value
  return line
}

/**
 * Evaluate a price rule line.
 * line_total = quantity × value × markup
 */
function evalPriceRuleLine(rule, vars, partNode) {
  // Pre-fill any unknown variable names with 0 to avoid "undefined variable" errors.
  const { vars: safeVars, defaulted: defaulted_vars } = defaultMissingVars(
    [rule.condition, rule.quantity, rule.value], vars
  )

  const line = {
    rule_id:        rule.id,
    rule_family:    rule.rule_family,
    group_name:     rule.group_name ?? null,
    name:           rule.name,
    loop_target:    rule.loop_target ?? null,
    part_key:       partNode?.key       ?? null,
    part_type:      partNode?.part_type ?? null,
    fires:          false,
    quantity:       0,
    value:          0,
    markup:         rule.markup ?? 1,
    line_total:     0,
    error:          null,
    defaulted_vars,
    condition:      rule.condition,
  }

  try {
    line.fires = evaluateCondition(rule.condition || 'true', safeVars)
  } catch (e) {
    line.error = `condition: ${e.message}`
    return line
  }
  if (!line.fires) return line

  try {
    line.quantity = evaluateNumber(rule.quantity || '0', safeVars)
    line.value    = evaluateNumber(rule.value    || '0', safeVars)
    line.line_total = line.quantity * line.value * (rule.markup ?? 1)
  } catch (e) {
    line.error = `calc: ${e.message}`
  }
  return line
}

// ── runPricingOnTree ──────────────────────────────────────────────────────────

/**
 * Pure function — takes a pre-built tree and list of rules and returns results.
 * Does NOT touch the database. Used directly by the benchmark page and tests.
 *
 * @param {Object}   tree         - Root parts tree node
 * @param {Array}    rules        - All price_rules rows for the price file
 * @param {Object}   pfVariables  - Price-file variables (scalars)
 * @param {Object}   options
 * @param {boolean}  options.testMode  - If true, include inactive rules
 * @returns {{ manufacture_labour, install_labour, price, error? }}
 */
export function runPricingOnTree(tree, rules, pfVariables = {}, { testMode = false } = {}) {
  const derived  = computeDerived(tree)
  const itemVars = computeVariables(tree, derived, pfVariables)
  if (!itemVars) return { error: 'computeVariables returned null', lines: [] }

  // Price-file variables are available in all expressions
  const baseVars = { ...pfVariables, ...itemVars }

  const results = {
    manufacture_labour: { total_minutes: 0, lines: [] },
    install_labour:     { total_minutes: 0, lines: [] },
    price:              { total: 0, lines: [] },
  }

  // ── Pass 1 — manufacture_labour ───────────────────────────────────────────
  const mfgRules = rules.filter(
    r => r.rule_family === 'manufacture_labour' && (testMode || r.is_active)
  )
  let mfgMinutes = 0
  for (const rule of mfgRules) {
    const loopParts = getLoopParts(tree, rule.loop_target)
    for (const partNode of loopParts) {
      const vars = partNode
        ? { ...baseVars, ...computePartVariables(partNode, tree, derived, baseVars) }
        : baseVars
      const line = evalRuleLine(rule, vars, partNode)
      if (!line.error && line.fires) mfgMinutes += line.minutes
      results.manufacture_labour.lines.push(line)
    }
  }
  results.manufacture_labour.total_minutes = mfgMinutes

  // Make std_labour_time (hours) available for subsequent passes
  const mfgVars = { ...baseVars, std_labour_time: mfgMinutes / 60 }

  // ── Pass 2 — install_labour ───────────────────────────────────────────────
  const instRules = rules.filter(
    r => r.rule_family === 'install_labour' && (testMode || r.is_active)
  )
  let instMinutes = 0
  for (const rule of instRules) {
    const loopParts = getLoopParts(tree, rule.loop_target)
    for (const partNode of loopParts) {
      const vars = partNode
        ? { ...mfgVars, ...computePartVariables(partNode, tree, derived, mfgVars) }
        : mfgVars
      const line = evalRuleLine(rule, vars, partNode)
      if (!line.error && line.fires) instMinutes += line.minutes
      results.install_labour.lines.push(line)
    }
  }
  results.install_labour.total_minutes = instMinutes

  // Make installation_labour_time (hours) available for price pass
  const priceVars = { ...mfgVars, installation_labour_time: instMinutes / 60 }

  // ── Pass 3 — price rules (item-level) ─────────────────────────────────────
  const priceRules = rules.filter(
    r => r.rule_family === 'price' && r.level !== 'quote' && (testMode || r.is_active)
  )
  let totalPrice = 0
  for (const rule of priceRules) {
    const loopParts = getLoopParts(tree, rule.loop_target)
    for (const partNode of loopParts) {
      const vars = partNode
        ? { ...priceVars, ...computePartVariables(partNode, tree, derived, priceVars) }
        : priceVars
      const line = evalPriceRuleLine(rule, vars, partNode)
      if (!line.error && line.fires) totalPrice += line.line_total
      results.price.lines.push(line)
    }
  }
  results.price.total = totalPrice

  return results
}

// ── priceDrawing ──────────────────────────────────────────────────────────────

/**
 * Run all passes for a single drawing and persist the results.
 *
 * @param {string} drawingId
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ success: boolean, calculatedPrice?: number, pricingRunId?: string, error?: string }>}
 */
export async function priceDrawing(drawingId, supabase) {
  let pricingRunId = null

  try {
    // ── 1. Load parts tree ────────────────────────────────────────────────────
    const tree = await loadDrawingParts(drawingId)
    if (!tree) throw new Error(`No drawing parts found for drawing ${drawingId}`)

    // ── 2. Fetch published price file ─────────────────────────────────────────
    const { data: priceFile, error: pfErr } = await supabase
      .from('price_files')
      .select('id')
      .eq('status', 'published')
      .single()

    if (pfErr || !priceFile) {
      throw new Error(`No published price file found: ${pfErr?.message ?? 'not found'}`)
    }

    // ── 3. Fetch price-file variables (scalars) ────────────────────────────────
    const { data: pfVarRows, error: pfvErr } = await supabase
      .from('price_file_variables')
      .select('name, value_numeric, value_text')
      .eq('price_file_id', priceFile.id)

    if (pfvErr) throw new Error(`Failed to fetch price_file_variables: ${pfvErr.message}`)

    const pfVariables = Object.fromEntries(
      (pfVarRows || []).map(r => [r.name, r.value_numeric ?? r.value_text])
    )

    // ── 4. Fetch ALL rules in one query ────────────────────────────────────────
    const { data: allRules, error: rulesErr } = await supabase
      .from('price_rules')
      .select('id, name, rule_family, level, condition, quantity, value, markup, part_code, loop_target, group_name, is_active, sort_order')
      .eq('price_file_id', priceFile.id)
      .order('sort_order')

    if (rulesErr) throw new Error(`Failed to fetch price rules: ${rulesErr.message}`)

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

    // ── 6. Run pricing engine ─────────────────────────────────────────────────
    const engineResults = runPricingOnTree(tree, allRules, pfVariables)

    if (engineResults.error) {
      throw new Error(engineResults.error)
    }

    // ── 7. Collect variables snapshot from the engine run ─────────────────────
    const derived  = computeDerived(tree)
    const variables = computeVariables(tree, derived, pfVariables) ?? {}
    variables.std_labour_time          = engineResults.manufacture_labour.total_minutes / 60
    variables.installation_labour_time = engineResults.install_labour.total_minutes / 60
    variables.total_manufacture_minutes = engineResults.manufacture_labour.total_minutes
    variables.total_install_minutes     = engineResults.install_labour.total_minutes

    // ── 8. Write manufacture_labour results ────────────────────────────────────
    const mfgResultRows = engineResults.manufacture_labour.lines
      .filter(l => l.fires && !l.error)
      .map(l => ({
        drawing_id:       drawingId,
        price_file_id:    priceFile.id,
        pricing_run_id:   pricingRunId,
        price_rule_id:    l.rule_id,
        loop_target_type: l.loop_target,
        loop_index:       null,
        cost:             l.minutes,
        sales:            null,
        markup_applied:   null,
      }))

    if (mfgResultRows.length > 0) {
      const { error: mfgInsErr } = await supabase
        .from('drawing_rule_results')
        .insert(mfgResultRows)
      if (mfgInsErr) throw new Error(`Failed to write manufacture_labour results: ${mfgInsErr.message}`)
    }

    // ── 9. Write install_labour results ───────────────────────────────────────
    const instResultRows = engineResults.install_labour.lines
      .filter(l => l.fires && !l.error)
      .map(l => ({
        drawing_id:       drawingId,
        price_file_id:    priceFile.id,
        pricing_run_id:   pricingRunId,
        price_rule_id:    l.rule_id,
        loop_target_type: l.loop_target,
        loop_index:       null,
        cost:             l.minutes,
        sales:            null,
        markup_applied:   null,
      }))

    if (instResultRows.length > 0) {
      const { error: instInsErr } = await supabase
        .from('drawing_rule_results')
        .insert(instResultRows)
      if (instInsErr) throw new Error(`Failed to write install_labour results: ${instInsErr.message}`)
    }

    // ── 10. Handle parts rules (pass 0c) ──────────────────────────────────────
    const partsRules = (allRules || []).filter(r => r.rule_family === 'parts' && r.is_active)

    if (partsRules.length > 0) {
      const { data: pfParts, error: pfPartsErr } = await supabase
        .from('price_file_parts')
        .select('part_code, part_name, unit_cost')
        .eq('price_file_id', priceFile.id)

      if (pfPartsErr) throw new Error(`Failed to fetch price_file_parts: ${pfPartsErr.message}`)

      const partsMap = Object.fromEntries((pfParts || []).map(p => [p.part_code, p]))
      const allVarsForParts = { ...pfVariables, ...variables }

      let totalPartsCost   = 0
      const allocatedRows  = []

      for (const rule of partsRules) {
        let fires
        try { fires = evaluateCondition(rule.condition || 'true', allVarsForParts) }
        catch (e) { console.warn(`[priceDrawing] parts rule "${rule.name}" condition error:`, e.message); continue }
        if (!fires) continue

        let qty
        try { qty = evaluateNumber(rule.quantity || '0', allVarsForParts) }
        catch (e) { console.warn(`[priceDrawing] parts rule "${rule.name}" quantity error:`, e.message); continue }

        const part = partsMap[rule.part_code]
        if (!part) { console.warn(`[priceDrawing] part not found: ${rule.part_code}`); continue }

        const totalCost = qty * part.unit_cost
        totalPartsCost += totalCost

        allocatedRows.push({
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

      if (allocatedRows.length > 0) {
        const { error: partsInsErr } = await supabase
          .from('drawing_allocated_parts')
          .insert(allocatedRows)
        if (partsInsErr) throw new Error(`Failed to write allocated parts: ${partsInsErr.message}`)
      }
    }

    // ── 11. Write price results ────────────────────────────────────────────────
    let calculatedPrice = engineResults.price.total
    const priceResultRows = engineResults.price.lines
      .filter(l => l.fires && !l.error)
      .map(l => ({
        drawing_id:       drawingId,
        price_file_id:    priceFile.id,
        pricing_run_id:   pricingRunId,
        price_rule_id:    l.rule_id,
        loop_target_type: l.loop_target,
        loop_index:       null,
        cost:             l.quantity * l.value,
        sales:            l.line_total,
        markup_applied:   l.markup,
      }))

    if (priceResultRows.length > 0) {
      const { error: priceInsErr } = await supabase
        .from('drawing_rule_results')
        .insert(priceResultRows)
      if (priceInsErr) throw new Error(`Failed to write price results: ${priceInsErr.message}`)
    }

    // ── 12. Write calculated_price to drawings ────────────────────────────────
    const { error: calcErr } = await supabase
      .from('drawings')
      .update({ calculated_price: calculatedPrice })
      .eq('id', drawingId)

    if (calcErr) throw new Error(`Failed to update drawings.calculated_price: ${calcErr.message}`)

    // ── 13. Write full variable snapshot ──────────────────────────────────────
    const { error: varErr } = await supabase
      .from('drawing_pricing_variables')
      .insert({
        pricing_run_id: pricingRunId,
        drawing_id:     drawingId,
        price_file_id:  priceFile.id,
        variables,
      })

    if (varErr) throw new Error(`Failed to write drawing_pricing_variables: ${varErr.message}`)

    // ── 14. Mark pricing_run complete ─────────────────────────────────────────
    await supabase
      .from('pricing_runs')
      .update({ status: 'complete' })
      .eq('id', pricingRunId)

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
    const drawingPriceDeltas = {}

    // ── 6. Evaluate each rule, write quote_rule_results, then apportion ───────
    for (const rule of (quoteRules || [])) {
      let fires
      try { fires = evaluateCondition(rule.condition || 'true', quoteVariables) }
      catch (e) {
        console.warn(`[priceQuote] rule "${rule.name}" condition error:`, e.message)
        continue
      }

      if (!fires) continue

      let quantityResult, valueResult
      try { quantityResult = evaluateNumber(rule.quantity || '0', quoteVariables) }
      catch (e) { throw new Error(`Rule "${rule.name}" quantity error: ${e.message}`) }

      try { valueResult = evaluateNumber(rule.value || '0', quoteVariables) }
      catch (e) { throw new Error(`Rule "${rule.name}" value error: ${e.message}`) }

      const cost      = quantityResult * valueResult
      const markup    = rule.markup ?? 1
      const ruleSales = cost * markup

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

      if (apportionmentRows.length > 0) {
        const { error: apErr } = await supabase
          .from('quote_item_apportionment')
          .insert(apportionmentRows)
        if (apErr) throw new Error(`Failed to write quote_item_apportionment for rule ${rule.id}: ${apErr.message}`)
      }
    }

    // ── 7. Update each drawing's calculated_price with its apportioned share ──
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

    // ── 8. Mark quote_pricing_run complete ────────────────────────────────────
    await supabase
      .from('quote_pricing_runs')
      .update({ status: 'complete' })
      .eq('id', quotePricingRunId)

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
