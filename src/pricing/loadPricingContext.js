/**
 * loadPricingContext.js
 * Single source of truth for loading all data the pricing engine needs.
 * Both priceDrawing() and PricingBenchmark.jsx use these functions,
 * ensuring a single pricing path.
 */

import { computeDerived } from '../drawingBoard/computeDerived.js'
import { computeVariables } from './computeVariables.js'
import { defaultIronmonger } from './defaultIronmongery.js'

// parts_catalogue, ironmongery_variants and ironmongery_variant_parts all
// hold more than 1,000 rows (the PostgREST response cap), so every
// full-table read goes through the shared paginated reader.
import { fetchAllRows } from '../lib/fetchAllRows.js'

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

  // ── Parts catalogue (single paginated read; feeds glass, costs and names) ─
  const partRows = await fetchAllRows(
    () => supabase
      .from('parts_catalogue')
      .select('part_code, part_name, unit_cost, thickness_mm, category')
      .order('part_code'),
    'parts_catalogue'
  )

  const glassCatalogue = Object.fromEntries(
    partRows
      .filter(r => r.category === 'Glass')
      .map(r => [r.part_code, { cost_per_m2: r.unit_cost, thickness_mm: r.thickness_mm }])
  )

  // ── Part allocation rules ──────────────────────────────────────────────────
  const { data: allocRules, error: allocErr } = await supabase
    .from('part_allocation_rules')
    .select('id, rule_family, sort_order, group_name, loop_target, label, condition, qty_expr, part_code, measure_expr, is_active')
    .eq('rule_family', 'part_allocator')
    .order('sort_order')

  if (allocErr) throw new Error(`Failed to fetch part_allocation_rules: ${allocErr.message}`)

  const partAllocationRules = allocRules || []

  // ── Part cost map (from the parts catalogue read above) ───────────────────
  const partCostMap = Object.fromEntries(
    partRows.map(r => [r.part_code, r.unit_cost])
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
  // ironmongery_variant_parts has no FK to parts_catalogue, so we join in JS
  // using the parts catalogue already loaded above. Both tables exceed the
  // 1,000-row response cap, so they are read page by page.
  const ironVariants = await fetchAllRows(
    () => supabase
      .from('ironmongery_variants')
      .select('id, finish_code, cost, ironmongery_products!inner(short_name)')
      .eq('ironmongery_products.is_active', true)
      .order('id'),
    'ironmongery_variants'
  )

  const ironKitLines = await fetchAllRows(
    () => supabase
      .from('ironmongery_variant_parts')
      .select('id, variant_id, part_code, quantity')
      .order('id'),
    'ironmongery_variant_parts'
  )

  const partNameMap = Object.fromEntries(
    partRows.map(r => [r.part_code, { part_name: r.part_name, unit_cost: r.unit_cost }])
  )

  const kitLinesByVariant = {}
  for (const kl of (ironKitLines ?? [])) {
    if (!kitLinesByVariant[kl.variant_id]) kitLinesByVariant[kl.variant_id] = []
    const partInfo = partNameMap[kl.part_code] ?? {}
    kitLinesByVariant[kl.variant_id].push({
      part_code: kl.part_code,
      part_name: partInfo.part_name ?? kl.part_code,
      qty:       kl.quantity ?? 1,
      unit_cost: partInfo.unit_cost ?? null,
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

// ── loadGlassCatalogue ───────────────────────────────────────────────────────

/**
 * Just the glass catalogue, for callers that need to WEIGH glass but not to
 * price anything — the validation path (Step AS).
 *
 * Validating a casement sash needs weight_in_kg (rule 120, "over 45 kg side
 * hung"), and weighing a sash needs the glass. This reads the one table the
 * full context builds it from, so a validation caller does not have to pull
 * the ironmongery variants, the allocation rules or a price file.
 *
 * Errors are surfaced, never swallowed into an empty catalogue: an empty one
 * would make every weight rule unevaluable, which looks like a missing
 * feature rather than a failed load.
 */
export async function loadGlassCatalogue(supabase) {
  const rows = await fetchAllRows(
    () => supabase
      .from('parts_catalogue')
      .select('part_code, unit_cost, thickness_mm, category')
      .eq('category', 'Glass')
      .order('part_code'),
    'parts_catalogue (glass)'
  )
  return Object.fromEntries(
    (rows ?? []).map(r => [r.part_code, { cost_per_m2: r.unit_cost, thickness_mm: r.thickness_mm }])
  )
}

// ── resolveIronmongeryFinish ─────────────────────────────────────────────────

/**
 * Step Z: a line whose finish is empty means "use the item's ironmongery
 * finish". Resolution order: the line's own explicit finish → the item's
 * ironmongery finish (paintAndIronmongeryPart.ironmongeryFinish) → the
 * profile default → null. A null result must surface as a visible warning
 * naming the line, never a £0 line (the engine enforces that).
 *
 * This is THE resolution — the board panel, the quote PDF and the grid
 * resolve the same way.
 */
export function resolveIronmongeryFinish(lineFinish, itemFinish, profileValues = {}, opts = {}) {
  if (lineFinish != null && lineFinish !== '') {
    return withSource(lineFinish, 'line', opts)
  }

  // Step AQ item 5: follow the item's finish WHERE THE PRODUCT EXISTS IN IT,
  // otherwise use the rule's own finish. Integrate's casement rules give the
  // hinges, gearbox and extensions PC (they exist only in PC) and handles PB
  // — exactly the mix on every Integrate casement list the reviewer read.
  // Without this, three casement lines resolved to the item's PB, found no
  // PB product and priced 0.00.
  const { productShortName = null, ruleFinish = null, catalogue = null } = opts
  const exists = (finish) => {
    if (!catalogue || !productShortName || finish == null || finish === '') return null
    return Object.prototype.hasOwnProperty.call(catalogue, `${productShortName}:${finish}`)
  }

  const itemCandidate = (itemFinish != null && itemFinish !== '')
    ? itemFinish
    : (profileValues?.ironmongeryFinish ?? null)
  const itemSource = (itemFinish != null && itemFinish !== '') ? 'item' : 'profile'

  // Only override the item's finish when we can SHOW the product is missing
  // in it and present in the rule's — `exists` returns null when there is no
  // catalogue to check against, and an unchecked guess must not move a price.
  if (itemCandidate != null && itemCandidate !== '') {
    if (exists(itemCandidate) === false && exists(ruleFinish) === true) {
      return withSource(ruleFinish, 'rule', opts)
    }
    return withSource(itemCandidate, itemSource, opts)
  }

  // NO item or profile finish at all. This is Step Z's territory and it is
  // deliberately unchanged, because the brief's rule has nothing to follow
  // here — and Step Z proved a rule's own METAL finish must not be guessed:
  // the claw fastener rule says PB, the real drawing needed ABs, and the
  // silent PB cost £26.25 against Integrate's £36.75. So a missing item
  // finish still warns and prices nothing.
  //
  // The non-metal fixed finishes stay as Step Z had them: a trickle vent is
  // white because it is a white plastic vent, not because anyone chose it.
  // Replacing THIS list with the existence rule would stop the vent pricing
  // on any drawing with no item finish — see docs/step-aq-findings.md.
  if (STEP_Z_FIXED_FINISHES.includes(ruleFinish)) {
    return withSource(ruleFinish, 'rule', opts)
  }
  return withSource(null, 'none', opts)
}

/**
 * Rule finishes that are a property of the product, not a customer choice.
 * Used ONLY when the item has no ironmongery finish at all (see above); when
 * the item HAS one, the catalogue decides.
 */
const STEP_Z_FIXED_FINISHES = ['Wht', 'PN']

/**
 * The resolution returns a plain finish code, as every existing caller
 * expects. `opts.onSource` lets a caller that wants to SHOW why a line used
 * a finish (the price breakdown, brief §5) record it without changing the
 * return type.
 */
function withSource(finish, source, opts) {
  opts?.onSource?.(source, finish)
  return finish
}

// ── resolveIronmongeryLines ──────────────────────────────────────────────────

/**
 * Determine which ironmongery lines to use for pricing.
 * Tree-saved lines (from paintAndIronmongeryPart.values.ironmongeryLines) win;
 * defaultIronmonger() applies only when the tree has none.
 *
 * @param {Object} tree - Root parts tree node
 * @param {Object} pricingContext - The object returned by loadPricingContext
 * @param {Object} [profileValues] - Profile rebate/tolerance values; needed by
 *        the sash-weight model when default rules evaluate per-sash variables
 * @param {Object} [opts]
 * @param {string|null} [opts.profileCode] - The drawing's profile CODE. The
 *        range variables (is_single_and_french_doors_range,
 *        is_open_in_doors_range, is_replacement_sashes_range) come from this
 *        and nothing else, so a default-ironmongery rule written on one is
 *        dead without it. Step AZ hotfix: the same omission in priceDrawing
 *        cost a live door every one of its timber lines.
 * @returns {Array<{ product_short_name: string, finish_code: string, qty: number }>}
 */
export function resolveIronmongeryLines(tree, pricingContext, profileValues = {}, opts = {}) {
  const { pfVariables, ironmongeryRules, glassCatalogue, ironmongeryCatalogue } = pricingContext

  // Check for tree-saved ironmongery lines
  const paintNode = (tree.children ?? []).find(c => c.part_type === 'paintAndIronmongeryPart')
  const treeSavedLines = paintNode?.values?.ironmongeryLines ?? []
  const itemFinish = paintNode?.values?.ironmongeryFinish ?? null

  // Empty line finish = "use the item's ironmongery finish" (Step Z) —
  // resolved here for both tree-saved and default lines. Step AQ item 5: the
  // catalogue comes too, so a line whose product does not exist in the
  // item's finish falls back to the rule's own, and `finish_source` records
  // which one was used for the price breakdown.
  const withResolvedFinish = lines => lines.map(line => {
    let finish_source = 'none'
    const finish_code = resolveIronmongeryFinish(line.finish_code, itemFinish, profileValues, {
      productShortName: line.product_short_name,
      ruleFinish:       line.rule_finish_code ?? null,
      catalogue:        ironmongeryCatalogue ?? null,
      onSource:         (source) => { finish_source = source },
    })
    return { ...line, finish_code, finish_source }
  })

  // Step BO item 2: a line's ORIGIN travels with it, so the price breakdown
  // can say which lines came from the STORED SET the surveyor chose and
  // which the rules produced — the stored set replaces the default lines,
  // but the allocator's own parts (a door's MPLS keep and slave hardware)
  // still come from the rules on top of it, exactly as Integrate prices
  // `ironmongerySet`.
  if (treeSavedLines.length > 0) {
    return withResolvedFinish(treeSavedLines).map(l => ({ ...l, origin: 'stored' }))
  }

  // No tree-saved lines — compute defaults
  if (ironmongeryRules.length === 0) {
    return []
  }

  const derived  = computeDerived(tree, profileValues)
  const itemVars = computeVariables(tree, derived, pfVariables,
    { profileCode: opts.profileCode ?? null }) ?? {}

  // Step BJ item 2: a BI-GLASS CASEMENT gets NO default ironmongery.
  //
  // Nathan (15 Oct): "none by default — the sashes keep theirs. The surveyor
  // may add any that is replaced." A stored list is still priced as stored,
  // which is the branch above; this is only about what a drawing nobody has
  // touched starts with.
  //
  // Two sets of rules made it otherwise. The hinge rules fire on any big
  // side-hung casement, so a bi-glass one was given EIGHT 76 mm hinges —
  // £40.95 to re-hinge sashes nobody is taking off, and two MORE than the
  // same window complete new, because a bi-glass sash fills its opening and
  // so is bigger and heavier. And the Brighton fastener kit, a SASH WINDOW
  // part, is gated on `needs_draughtsealing and not nj_involved`, which a
  // bi-glass casement now satisfies (item 1d).
  //
  // Said here rather than in thirteen rule conditions: it is one business
  // rule about one type of work, and spreading it over the allocator rules
  // would need SQL for every hinge band and still miss the next one. The
  // rules themselves are Integrate's own and are left alone.
  //
  // Scoped to a CASEMENT: bi-glass on a sliding sash is a separate step
  // (item 3) and keeps whatever defaults it has today.
  if (itemVars.is_bi_glass === true && itemVars.is_casement_window === true) {
    return []
  }

  return withResolvedFinish(
    defaultIronmonger(tree, { ...pfVariables, ...itemVars }, ironmongeryRules, glassCatalogue, profileValues)
  ).map(l => ({ ...l, origin: 'default' }))
}
