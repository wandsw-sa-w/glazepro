/**
 * loadPricingContext.js
 * Single source of truth for loading all data the pricing engine needs.
 * Both priceDrawing() and PricingBenchmark.jsx use these functions,
 * ensuring a single pricing path.
 */

import { computeDerived } from '../drawingBoard/computeDerived.js'
import { computeVariables } from './computeVariables.js'
import { defaultIronmonger } from './defaultIronmongery.js'

// ── loadPricingContext ───────────────────────────────────────────────────────

/**
 * Load everything the pricing engine needs from Supabase for a given price file.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} priceFileId
 * @returns {Promise<{
 *   priceFileId: string,
 *   rules: Array,
 *   pfVariables: Object,
 *   glassCatalogue: Object,
 *   partAllocationRules: Array,
 *   partCostMap: Object,
 *   ironmongeryRules: Array,
 *   ironmongeryCatalogue: Object,
 * }>}
 */
export async function loadPricingContext(supabase, priceFileId) {
  // ── Price rules ────────────────────────────────────────────────────────────
  const { data: rules, error: rulesErr } = await supabase
    .from('price_rules')
    .select('id, name, rule_family, level, condition, quantity, value, markup, part_code, loop_target, group_name, is_active, sort_order')
    .eq('price_file_id', priceFileId)
    .order('sort_order')

  if (rulesErr) throw new Error(`Failed to fetch price_rules: ${rulesErr.message}`)

  // ── Price-file variables (scalars) ─────────────────────────────────────────
  const { data: pfVarRows, error: pfvErr } = await supabase
    .from('price_file_variables')
    .select('name, value_numeric, value_text')
    .eq('price_file_id', priceFileId)

  if (pfvErr) throw new Error(`Failed to fetch price_file_variables: ${pfvErr.message}`)

  const pfVariables = Object.fromEntries(
    (pfVarRows || []).map(r => [r.name, r.value_numeric ?? r.value_text])
  )

  // ── Glass catalogue (from parts_catalogue where category = 'Glass') ────────
  const { data: glassRows, error: glassErr } = await supabase
    .from('parts_catalogue')
    .select('part_code, unit_cost, thickness_mm')
    .eq('category', 'Glass')

  if (glassErr) throw new Error(`Failed to fetch glass catalogue: ${glassErr.message}`)

  const glassCatalogue = Object.fromEntries(
    (glassRows || []).map(r => [r.part_code, { cost_per_m2: r.unit_cost, thickness_mm: r.thickness_mm }])
  )

  // ── Part allocation rules ──────────────────────────────────────────────────
  const { data: allocRules, error: allocErr } = await supabase
    .from('part_allocation_rules')
    .select('id, rule_family, sort_order, group_name, loop_target, label, condition, qty_expr, part_code, measure_expr, is_active')
    .eq('rule_family', 'part_allocator')
    .order('sort_order')

  if (allocErr) throw new Error(`Failed to fetch part_allocation_rules: ${allocErr.message}`)

  const partAllocationRules = allocRules || []

  // ── Part cost map (from parts_catalogue) ───────────────────────────────────
  const { data: partRows, error: partErr } = await supabase
    .from('parts_catalogue')
    .select('part_code, unit_cost')

  if (partErr) throw new Error(`Failed to fetch parts_catalogue: ${partErr.message}`)

  const partCostMap = Object.fromEntries(
    (partRows || []).map(r => [r.part_code, r.unit_cost])
  )

  // ── Ironmongery rules (default_ironmongery from part_allocation_rules) ─────
  const { data: ironRulesData, error: ironRulesErr } = await supabase
    .from('part_allocation_rules')
    .select('id, sort_order, group_name, loop_target, label, condition, qty_expr, product_short_name, finish_code, is_active')
    .eq('rule_family', 'default_ironmongery')
    .order('sort_order')

  if (ironRulesErr) throw new Error(`Failed to fetch ironmongery rules: ${ironRulesErr.message}`)

  const ironmongeryRules = ironRulesData || []

  // ── Ironmongery catalogue (variants with kit parts) ────────────────────────
  const [
    { data: ironVariants, error: ivErr },
    { data: ironKitLines, error: ikErr },
  ] = await Promise.all([
    supabase
      .from('ironmongery_variants')
      .select('id, finish_code, cost, ironmongery_products!inner(short_name)')
      .eq('ironmongery_products.is_active', true),
    supabase
      .from('ironmongery_variant_parts')
      .select('variant_id, part_code, quantity, parts_catalogue(part_name, unit_cost)'),
  ])

  if (ivErr) throw new Error(`Failed to fetch ironmongery_variants: ${ivErr.message}`)
  if (ikErr) throw new Error(`Failed to fetch ironmongery_variant_parts: ${ikErr.message}`)

  const kitLinesByVariant = {}
  for (const kl of (ironKitLines ?? [])) {
    if (!kitLinesByVariant[kl.variant_id]) kitLinesByVariant[kl.variant_id] = []
    kitLinesByVariant[kl.variant_id].push({
      part_code: kl.part_code,
      part_name: kl.parts_catalogue?.part_name ?? kl.part_code,
      qty:       kl.quantity ?? 1,
      unit_cost: kl.parts_catalogue?.unit_cost ?? null,
    })
  }

  const ironmongeryCatalogue = {}
  for (const v of (ironVariants ?? [])) {
    const shortName = v.ironmongery_products?.short_name
    if (!shortName) continue
    ironmongeryCatalogue[`${shortName}:${v.finish_code}`] = {
      cost:  v.cost ?? 0,
      parts: kitLinesByVariant[v.id] ?? [],
    }
  }

  return {
    priceFileId,
    rules:               rules || [],
    pfVariables,
    glassCatalogue,
    partAllocationRules,
    partCostMap,
    ironmongeryRules,
    ironmongeryCatalogue,
  }
}

// ── resolveIronmongeryLines ──────────────────────────────────────────────────

/**
 * Determine which ironmongery lines to use for pricing.
 * Tree-saved lines (from paintAndIronmongeryPart.values.ironmongeryLines) win;
 * defaultIronmonger() applies only when the tree has none.
 *
 * @param {Object} tree - Root parts tree node
 * @param {Object} pricingContext - The object returned by loadPricingContext
 * @returns {Array<{ product_short_name: string, finish_code: string, qty: number }>}
 */
export function resolveIronmongeryLines(tree, pricingContext) {
  const { pfVariables, ironmongeryRules, glassCatalogue } = pricingContext

  // Check for tree-saved ironmongery lines
  const paintNode = (tree.children ?? []).find(c => c.part_type === 'paintAndIronmongeryPart')
  const treeSavedLines = paintNode?.values?.ironmongeryLines ?? []

  if (treeSavedLines.length > 0) {
    return treeSavedLines
  }

  // No tree-saved lines — compute defaults
  if (ironmongeryRules.length === 0) {
    return []
  }

  const derived  = computeDerived(tree)
  const itemVars = computeVariables(tree, derived, pfVariables) ?? {}
  return defaultIronmonger(tree, { ...pfVariables, ...itemVars }, ironmongeryRules, glassCatalogue)
}
