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
import { computeSashWeight, SASH_REPLACEMENT_ITEM_WEIGHT_FACTOR } from './sashWeight.js'
import { allocateParts } from './partAllocator.js'
import { treeHash } from './treeHash.js'
import { loadPricingContext, resolveIronmongeryLines } from './loadPricingContext.js'
import { PRICING_ENGINE_VERSION } from './engineVersion.js'
import {
  glazingType, hornLengthMm, operationKind, glassSpacerMm,
  isWarmEdgeSpacerColour, collectVocabularyWarnings,
} from './optionVocabulary.js'
import { fetchAllRows } from '../lib/fetchAllRows.js'
import { sashSizes } from './derivedGeometry.js'

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

function computePartVariables(partNode, tree, derived, baseVars, glassCatalogue = {}, profileValues = {}) {
  if (!partNode) return {}
  const pt = partNode.part_type
  const v  = partNode.values ?? {}

  const isCordHung   = op => operationKind(op) === 'cord'
  const isSpiralHung = op => operationKind(op) === 'spiral'
  const isFixed      = op => operationKind(op) === 'fix'

  if (pt === 'topSashPart' || pt === 'bottomSashPart') {
    const isTop          = pt === 'topSashPart'
    const op             = v.operation ?? ''
    const is_complete_new = baseVars.is_complete_new ?? false
    const to_be_replaced  = is_complete_new || v.toBeReplaced === true

    const pair = findFirst(tree, 'sashPairPart')

    // Sash geometry from the drawing board's own derivation — ONE source
    // (Step V: assemblyFramePart.width/height are the OVERALL frame; the
    // drawn sash sizes come from computeDerived / computeSashGeometry).
    const sz = sashSizes(tree, derived)

    // Horn length from the drawing (stored length, else the length that
    // belongs to the horn type — optionVocabulary.js, step-y brief §1).
    // The old 70 mm Victorian constant and the invented sashLip are gone.
    const hornCode   = isTop
      ? pair?.values?.topHornTypeShortName
      : pair?.values?.bottomHornTypeShortName
    const storedHornLength = isTop
      ? pair?.values?.topHornLength
      : pair?.values?.bottomHornLength
    const hornLength = hornLengthMm(hornCode, storedHornLength)

    // Bottom sash: a chamfered bottom rail adds the internal/external
    // measurement difference — sash thickness × tan(chamfer angle), the
    // "7" Integrate labels on its drawings (45 mm × tan 9° = 7.13; only
    // 9° / 45 mm is measured — step-y brief §1). Not chamfered → 0.
    const sashThicknessForGross = pair?.values?.sashThickness ?? 45
    const chamferAngle = !isTop ? Number(v.chamferedBottomRailAngle ?? 0) : 0
    const chamferAllowance = chamferAngle > 0
      ? sashThicknessForGross * Math.tan(chamferAngle * Math.PI / 180) : 0

    // Gross sash height = drawn sash height (glass + own rail + meeting
    // rail — Integrate's drawn label) + horn + bottom chamfer allowance
    const drawnHeight = isTop ? sz.topSashHeight : sz.bottomSashHeight
    const gross_sash_height_in_mm = drawnHeight != null
      ? drawnHeight + hornLength + chamferAllowance : null

    // Gross sash width = the drawn sash width (Integrate's "Sash width")
    const gross_sash_width_in_mm = sz.sashWidth

    const stileWidth = v.leftWidth ?? 47
    const sash_sightline_width_in_mm = sz.sashWidth != null
      ? sz.sashWidth - 2 * stileWidth : null
    const sash_sightline_height_in_mm = isTop ? sz.topGlassHeight : sz.bottomGlassHeight

    // Sash weight — measured model (sashWeight.js); needs the profile
    // rebate/tolerance for the glass cut, like the glass price does
    const weightData = computeSashWeight(partNode, tree, glassCatalogue, profileValues)
    const sash_thickness = pair?.values?.sashThickness ?? 45

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
      // Sash weight variables (outer-frame-geometry based)
      // weight_in_kg rounded to 1 dp before rule evaluation (Integrate behaviour)
      weight_in_kg:            Math.round(weightData.weight_in_kg * 10) / 10,
      weight_in_lb:            weightData.weight_in_lb,
      weight_incl_panel_in_kg: weightData.weight_incl_panel_in_kg,
      weight_incl_panel_in_lb: weightData.weight_incl_panel_in_lb,
      sash_thickness,
      sibling_weight: 0,  // TODO: requires two-pass to set top ↔ bottom
    }
  }

  if (pt === 'assemblyFramePart') {
    // assemblyFramePart.width/height ARE the overall frame (Step V decision)
    const outerW = v.width  ?? 0
    const outerH = v.height ?? 0

    // Cill child part (assemblyFramePart > cillPart)
    const cillNode = (partNode.children ?? []).find(c => c.part_type === 'cillPart')
    const cv = cillNode?.values ?? {}

    // cill_profiled_height_in_mm: height excluding frame stop (store as profiledHeight in fixture)
    const cill_profiled_height_in_mm = cv.profiledHeight ?? cv.height ?? 0
    // cill_length_in_mm: outer frame width + left horn + right horn
    const cill_length_in_mm = outerW + (v.leftCillHorn ?? 0) + (v.rightCillHorn ?? 0)

    return {
      to_be_replaced:          baseVars.is_complete_new ?? false,
      width:                   outerW / 1000,   // metres (OUTER — Integrate convention)
      height:                  outerH / 1000,   // metres (OUTER)
      frame_width_in_mm:       outerW,          // mm (OUTER)
      frame_height_in_mm:      outerH,          // mm (OUTER)
      frame_depth_in_mm:       cv.depth ?? v.frameDepth ?? 0,
      cill_profiled_height_in_mm,
      cill_length_in_mm,
    }
  }

  if (pt === 'glassPart') {
    // Glass area from sash geometry
    const parentSash  = findParentSash(tree, partNode.key)

    // Glass sightline from the same drawn sash sizes as everything else
    // (Step V): sightlineWidth = sash width − 2 × stileWidth, sightline
    // height = the parent sash's glass height from computeDerived.
    const gsz         = sashSizes(tree, derived)
    const gStileWidth = parentSash?.values?.leftWidth ?? 47
    const sightlineWidth = gsz.sashWidth != null
      ? gsz.sashWidth - 2 * gStileWidth : 0
    const sightlineHeight = (parentSash?.part_type === 'bottomSashPart'
      ? gsz.bottomGlassHeight
      : gsz.topGlassHeight) ?? 0

    // Glass CUT SIZE: extends beyond the sightline by (rebateWidth - tolerance) per edge.
    // The rebate and tolerance come from profile values keyed by glazing type.
    // Real glazing_type codes ('double_glazing', …) via optionVocabulary.js.
    const gType = glazingType(v.glazingId)
    const rebateKey = gType === 'single' ? 'defaultSingleGlazingRebateWidthForSash'
      : gType === 'triple' ? 'defaultTripleGlazingRebateWidthForSash'
      : gType === 'heritage' ? 'defaultHeritageGlazingRebateWidthForSash'
      : 'defaultDoubleGlazingRebateWidthForSash'
    const toleranceKey = gType === 'single' ? 'defaultSingleGlazingTolerance'
      : gType === 'triple' ? 'defaultTripleGlazingTolerance'
      : gType === 'heritage' ? 'defaultHeritageGlazingTolerance'
      : 'defaultDoubleGlazingTolerance'
    const rebateWidth = profileValues[rebateKey]
    const tolerance   = profileValues[toleranceKey]
    if (rebateWidth == null || tolerance == null) {
      throw new Error(`Missing profile values for glass cut size: ${rebateKey}=${rebateWidth}, ${toleranceKey}=${tolerance}. Check the drawing's profile has glassPart rebate and tolerance values.`)
    }
    const cover       = rebateWidth - tolerance   // mm beyond sightline per edge

    const glassWidth  = sightlineWidth  + 2 * cover
    const glassHeight = sightlineHeight + 2 * cover

    // actual_area: m² rounded to 2dp (from glass CUT SIZE, not sightline)
    const actual_area  = (glassWidth > 0 && glassHeight > 0)
      ? Math.round((glassWidth * glassHeight / 1e6) * 100) / 100
      : 0
    // rounded_area: actual_area (already 2dp) with 0.30 m² minimum.
    // Integrate definition (line 2168): "rounded up to 0.3 m2 if smaller".
    const rounded_area = Math.max(0.30, actual_area)

    // to_be_replaced
    const to_be_replaced = (baseVars.is_complete_new === true) || (parentSash?.values?.toBeReplaced === true)

    // Glazing bars: prefer actual verticalGlazingBarPart/horizontalGlazingBarPart children
    // when present; fall back to legacy barsWide/barsHigh counts for unmigrated trees.
    const vBarParts = (partNode.children ?? []).filter(c => c.part_type === 'verticalGlazingBarPart')
    const hBarParts = (partNode.children ?? []).filter(c => c.part_type === 'horizontalGlazingBarPart')
    const hasActualBars = vBarParts.length > 0 || hBarParts.length > 0
    const barsWide = hasActualBars ? vBarParts.length : (v.barsWide ?? 0)
    const barsHigh = hasActualBars ? hBarParts.length : (v.barsHigh ?? 0)
    const unit_gb_qty = barsWide + barsHigh

    // internal_spacer_length: total run of glazing bar material in this unit (metres).
    // Uses sightline dimensions (bars run within the visible area).
    // Ceiled to 0.1 m precision to match Integrate's behaviour (ceil(mm/100)/10).
    const internal_spacer_length = Math.ceil((barsWide * sightlineHeight + barsHigh * sightlineWidth) / 100) / 10

    // Glass costs — look up from parts catalogue using part codes; fall back to fixture values
    const innerEntry  = glassCatalogue[v.internalGlassPartNo] ?? null
    const outerEntry  = glassCatalogue[v.externalGlassPartNo] ?? null
    const singleEntry = glassCatalogue[v.singleGlassPartNo]   ?? null

    const inner_pane_cost  = innerEntry  ? innerEntry.cost_per_m2  : (v.innerPaneCost  ?? 0)
    const outer_pane_cost  = outerEntry  ? outerEntry.cost_per_m2  : (v.outerPaneCost  ?? 0)
    const single_pane_cost = singleEntry ? singleEntry.cost_per_m2 : (v.singlePaneCost ?? 0)

    // Glass pane thicknesses (mm) — from catalogue when available, else fixture
    const inner_pane_thickness  = innerEntry  ? innerEntry.thickness_mm  : (v.innerPaneThickness  ?? 0)
    const outer_pane_thickness  = outerEntry  ? outerEntry.thickness_mm  : (v.outerPaneThickness  ?? 0)
    const middle_pane_thickness = v.middlePaneThickness ?? 0
    const single_pane_thickness = v.singlePaneThickness ?? 0

    // glass_unit_thickness: inner + spacer + outer (mm).
    // Spacer thickness comes from the stored spacerDimId code ('spacer_16'
    // → 16); saved drawings never store a spacerHeight number.
    const spacerMm             = glassSpacerMm(v)
    const glass_unit_thickness = inner_pane_thickness + spacerMm + outer_pane_thickness

    // Spacer type flags — the warm-edge flag reads the COLOUR code
    // (spacerColourId 'white_warm_edge'); the dimension code never says it.
    const has_white_warm_edge_spacer = isWarmEdgeSpacerColour(v.spacerColourId)

    return {
      actual_area,
      rounded_area,
      is_single_glazed: gType === 'single',
      is_double_glazed: gType === 'double',
      is_triple_glazed: gType === 'triple',
      glass_unit_thickness,
      to_be_replaced,
      unit_gb_qty,
      internal_spacer_length,
      inner_pane_cost,
      outer_pane_cost,
      single_pane_cost,
      inner_pane_thickness,
      outer_pane_thickness,
      middle_pane_thickness,
      single_pane_thickness,
      has_white_warm_edge_spacer,
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
    line.quantity   = evaluateNumber(rule.quantity || '0', safeVars)
    line.value      = evaluateNumber(rule.value    || '0', safeVars)
    // Integrate rounds each line independently (no float accumulation error).
    // line_cost  = round(qty × value, 2 dp)  — integer pence
    // line_total = round(qty × value × markup, 2 dp)  — uses raw cost, not rounded cost
    const raw_cost  = line.quantity * line.value
    const markup    = rule.markup ?? 1
    line.line_cost  = Math.round(raw_cost * 100) / 100
    line.line_total = Math.round(raw_cost * markup * 100) / 100
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
 * @param {Object}   tree              - Root parts tree node
 * @param {Array}    rules             - All price_rules rows for the price file
 * @param {Object}   pfVariables       - Price-file variables (scalars)
 * @param {Object}   options
 * @param {boolean}  options.testMode          - If true, include inactive rules
 * @param {Object}   options.glassCatalogue    - { partCode: { cost_per_m2, thickness_mm } }
 * @param {Array}    options.partAllocationRules - Rows from part_allocation_rules (for component loop)
 * @param {Object}   options.partCostMap        - { partCode: costPerUnitOfMeasure } fixture map
 * @param {Array}    options.ironmongeryLines   - Pre-computed default ironmongery lines
 *                                               [{ product_short_name, finish_code, qty }]
 * @param {Object}   options.ironmongeryCatalogue - Variant kit expansion map:
 *                   { 'short_name:finish_code': { cost: kitCost, parts: [{ part_code, part_name, qty, unit_cost }] } }
 * @returns {{ manufacture_labour, install_labour, price, allocated_parts?, error? }}
 */
export function runPricingOnTree(tree, rules, pfVariables = {}, {
  testMode = false,
  glassCatalogue = {},
  partAllocationRules = [],
  partCostMap = {},
  ironmongeryLines = [],
  ironmongeryCatalogue = {},
  profileValues = {},
} = {}) {
  const derived  = computeDerived(tree)
  const itemVars = computeVariables(tree, derived, pfVariables)
  if (!itemVars) return { error: 'computeVariables returned null', lines: [] }

  // ── Pre-compute item-level sash weight aggregates ─────────────────────────
  // These are computed here (not in computeVariables) because they need glassCatalogue.
  const allTopSashes = findAll(tree, 'topSashPart')
  const allBotSashes = findAll(tree, 'bottomSashPart')
  const allSashes    = [...allTopSashes, ...allBotSashes]

  let weight_of_heaviest_sash_to_be_replaced = 0  // lb
  let sumReplacedSashKg = 0
  let item_nj_weight_in_kg = 0
  const isCordHungItem = itemVars.is_cord_hung ?? false

  for (const sash of allSashes) {
    const sv = sash.values ?? {}
    const toBeReplaced = (itemVars.is_complete_new === true) || (sv.toBeReplaced === true)
    if (!toBeReplaced) continue
    const wt = computeSashWeight(sash, tree, glassCatalogue, profileValues)
    if (wt.weight_in_lb > weight_of_heaviest_sash_to_be_replaced) {
      weight_of_heaviest_sash_to_be_replaced = wt.weight_in_lb
    }
    sumReplacedSashKg += wt.weight_in_kg
  }

  if (itemVars.is_sash_replacement === true) {
    // MEASURED (step-w brief §5, every row within 0.2 lb): sash-replacement
    // item weight = 1.1 × (top + bottom sash weight) — counterweights are
    // NOT in Integrate's item weight.
    item_nj_weight_in_kg = SASH_REPLACEMENT_ITEM_WEIGHT_FACTOR * sumReplacedSashKg
  } else {
    // UNMEASURED for other types of work — the previous behaviour is kept:
    // sashes plus, when cord hung, counterweights equal to each sash weight.
    item_nj_weight_in_kg = isCordHungItem ? 2 * sumReplacedSashKg : sumReplacedSashKg
  }

  const item_nj_weight_in_lb = item_nj_weight_in_kg * 2.20462

  // Price-file variables are available in all expressions
  const baseVars = {
    ...pfVariables,
    ...itemVars,
    weight_of_heaviest_sash_to_be_replaced,
    item_nj_weight_in_kg,
    item_nj_weight_in_lb,
  }

  // ── Run part allocator (if rules supplied) ────────────────────────────────
  // Must run before price pass so the component loop has parts to iterate over.
  let allocatedParts = []
  if (partAllocationRules.length > 0) {
    allocatedParts = allocateParts(tree, baseVars, partAllocationRules, glassCatalogue, false, profileValues)
  }

  // Component parts (non-weight groups) for the pricing component loop.
  // Weights are priced via the steel/lead sliding_sash price rules, not the component loop.
  //
  // Merge lines with the same (part_code, label): sum their measures,
  // keep the highest qty.  The label encodes the dimension — e.g.
  // "Parting bead for height" vs "Parting bead for width" — so width
  // and height lines for the same part stay separate.
  //
  // Integrate merges identical lines before costing so one longer length
  // is costed once (avoids per-line rounding differences).
  const rawComponentParts = allocatedParts.filter(a => a.group !== 'sash_weights')
  const mergedMap = new Map()
  for (const p of rawComponentParts) {
    const key = `${p.part_code}\x00${p.label}`
    const existing = mergedMap.get(key)
    if (existing) {
      existing.measure += p.measure
      if (p.qty > existing.qty) existing.qty = p.qty
    } else {
      mergedMap.set(key, { ...p })
    }
  }
  const componentParts = [...mergedMap.values()]

  const pricingWarnings = []

  // Option codes the engine depends on but does not recognise must surface
  // as warnings naming the field and the code — never a silent false.
  pricingWarnings.push(...collectVocabularyWarnings(tree))

  const results = {
    manufacture_labour: { total_minutes: 0, lines: [] },
    install_labour:     { total_minutes: 0, lines: [] },
    price:              { total: 0, lines: [] },
    allocated_parts:    allocatedParts,
    warnings:           pricingWarnings,
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
        ? { ...baseVars, ...computePartVariables(partNode, tree, derived, baseVars, glassCatalogue, profileValues) }
        : baseVars
      const line = evalRuleLine(rule, vars, partNode)
      if (!line.error && line.fires) mfgMinutes += line.minutes
      results.manufacture_labour.lines.push(line)
    }
  }
  results.manufacture_labour.total_minutes = mfgMinutes

  // Integrate rounds total hours to 2dp before multiplying by hourly rate
  const mfgHours = Math.round((mfgMinutes / 60) * 100) / 100
  const mfgVars = { ...baseVars, std_labour_time: mfgHours }

  // ── Pass 2 — install_labour ───────────────────────────────────────────────
  const instRules = rules.filter(
    r => r.rule_family === 'install_labour' && (testMode || r.is_active)
  )
  let instMinutes = 0
  for (const rule of instRules) {
    const loopParts = getLoopParts(tree, rule.loop_target)
    for (const partNode of loopParts) {
      const vars = partNode
        ? { ...mfgVars, ...computePartVariables(partNode, tree, derived, mfgVars, glassCatalogue, profileValues) }
        : mfgVars
      const line = evalRuleLine(rule, vars, partNode)
      if (!line.error && line.fires) instMinutes += line.minutes
      results.install_labour.lines.push(line)
    }
  }
  results.install_labour.total_minutes = instMinutes

  const instHours = Math.round((instMinutes / 60) * 100) / 100
  const priceVars = { ...mfgVars, installation_labour_time: instHours }

  // ── Pass 3 — price rules (item-level) ─────────────────────────────────────
  const priceRules = rules.filter(
    r => r.rule_family === 'price' && r.level !== 'quote' && (testMode || r.is_active)
  )
  let totalCost  = 0
  let totalPrice = 0
  for (const rule of priceRules) {
    // Component loop: iterate over allocated non-sash-weight parts
    // Variables: cost (unit cost per measure unit), length (measure), qty (allocated qty), part_no
    if (rule.loop_target === 'component') {
      for (const allocPart of componentParts) {
        const unitCost = partCostMap[allocPart.part_code] ?? 0
        // Component measure is in mm. PF30 price rules use `length * qty` where
        // length is metres rounded UP to the next 0.1 m (Integrate convention).
        // e.g. 1875 mm → ceil(1875/100)/10 = 1.9 m; 1355 mm → 1.4 m.
        const lengthMetres = Math.ceil(allocPart.measure / 100) / 10
        const compVars = {
          ...priceVars,
          cost:      unitCost,
          length:    lengthMetres,
          qty:       allocPart.qty,
          part_no:   allocPart.part_code,
          part_name: allocPart.label,
        }
        const line = evalPriceRuleLine(rule, compVars, null)
        line.alloc_part_code = allocPart.part_code
        line.alloc_label     = allocPart.label
        if (!line.error && line.fires) { totalCost += line.line_cost; totalPrice += line.line_total }
        results.price.lines.push(line)
      }
      continue
    }

    // Ironmongery loop: expand each ironmongery line to its variant kit lines.
    // Variables: cost (part unit_cost), qty (effective = kit_line.qty × iron_line.qty),
    //            part_name (part description), part_no (part_code).
    // If the variant has no kit lines (unknown cost), use the kit cost directly (qty=1).
    // loop_target may be stored as 'ironmongery_part' or 'ironmongery part' (rules export uses spaces).
    if (rule.loop_target === 'ironmongery_part' || rule.loop_target === 'ironmongery part') {
      for (const ironLine of ironmongeryLines) {
        const variantKey  = `${ironLine.product_short_name}:${ironLine.finish_code}`
        const variant     = ironmongeryCatalogue[variantKey] ?? null
        const kitParts    = variant?.parts ?? []

        if (kitParts.length === 0) {
          // No kit line data — use the kit cost as a single lump line
          const kitCost = variant?.cost ?? 0
          const ironVars = {
            ...priceVars,
            cost:      kitCost,
            qty:       ironLine.qty,
            part_name: ironLine.product_short_name,
            part_no:   '',
          }
          const line = evalPriceRuleLine(rule, ironVars, null)
          line.alloc_iron_short_name = ironLine.product_short_name
          line.alloc_iron_finish     = ironLine.finish_code
          line.alloc_iron_kit_cost   = kitCost
          if (!line.error && line.fires) { totalCost += line.line_cost; totalPrice += line.line_total }
          results.price.lines.push(line)
        } else {
          for (const kitLine of kitParts) {
            const effectiveQty = (kitLine.qty ?? 1) * (ironLine.qty ?? 1)
            const partUnitCost = kitLine.unit_cost ?? 0
            const ironVars = {
              ...priceVars,
              cost:      partUnitCost,
              qty:       effectiveQty,
              part_name: kitLine.part_name ?? kitLine.part_code,
              part_no:   kitLine.part_code,
            }
            const line = evalPriceRuleLine(rule, ironVars, null)
            line.alloc_iron_short_name = ironLine.product_short_name
            line.alloc_iron_finish     = ironLine.finish_code
            line.alloc_iron_part_code  = kitLine.part_code
            if (!line.error && line.fires) { totalCost += line.line_cost; totalPrice += line.line_total }
            results.price.lines.push(line)
          }
        }
      }
      continue
    }

    // Normal tree-based loop
    const loopParts = getLoopParts(tree, rule.loop_target)
    for (const partNode of loopParts) {
      const vars = partNode
        ? { ...priceVars, ...computePartVariables(partNode, tree, derived, priceVars, glassCatalogue, profileValues) }
        : priceVars
      const line = evalPriceRuleLine(rule, vars, partNode)
      if (!line.error && line.fires) { totalCost += line.line_cost; totalPrice += line.line_total }
      results.price.lines.push(line)
    }
  }
  results.price.total_cost = totalCost
  results.price.total      = totalPrice

  // ── Warnings for missing catalogue codes ──────────────────────────────────
  // Glass: check every glassPart's part numbers against the catalogue
  const allGlassParts = findAll(tree, 'glassPart')
  for (const gp of allGlassParts) {
    const gv = gp.values ?? {}
    if (gv.internalGlassPartNo && !glassCatalogue[gv.internalGlassPartNo]) {
      pricingWarnings.push(`Glass code not found in catalogue: ${gv.internalGlassPartNo} (internal pane)`)
    }
    if (gv.externalGlassPartNo && !glassCatalogue[gv.externalGlassPartNo]) {
      pricingWarnings.push(`Glass code not found in catalogue: ${gv.externalGlassPartNo} (external pane)`)
    }
    if (gv.singleGlassPartNo && !glassCatalogue[gv.singleGlassPartNo]) {
      pricingWarnings.push(`Glass code not found in catalogue: ${gv.singleGlassPartNo} (single pane)`)
    }
  }
  // Components: check allocated part codes against the cost map
  for (const ap of componentParts) {
    if (ap.part_code && !(ap.part_code in partCostMap)) {
      pricingWarnings.push(`Part code not found in cost map: ${ap.part_code} (${ap.label || 'unknown'})`)
    }
  }
  // Ironmongery: check each line's variant key against the catalogue
  for (const il of ironmongeryLines) {
    const key = `${il.product_short_name}:${il.finish_code}`
    const variant = ironmongeryCatalogue[key]
    if (!variant) {
      pricingWarnings.push(`Ironmongery product not found: ${il.product_short_name} (${il.finish_code})`)
      continue
    }
    // A kit line whose part has no catalogue cost prices at 0 — that must
    // surface as a warning, never as a silent zero.
    for (const kl of (variant.parts ?? [])) {
      if (kl.unit_cost == null) {
        pricingWarnings.push(`Ironmongery part cost not found: ${kl.part_code} (${il.product_short_name})`)
      }
    }
  }

  return results
}

// ── priceDrawing ──────────────────────────────────────────────────────────────

/**
 * Run all passes for a single drawing and persist the results.
 *
 * @param {string} drawingId
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ priceFileId?: string }} [options]
 * @returns {Promise<{ success: boolean, calculatedPrice?: number, pricingRunId?: string, error?: string }>}
 */
export async function priceDrawing(drawingId, supabase, { priceFileId } = {}) {
  let pricingRunId = null

  try {
    // ── 1. Load parts tree ────────────────────────────────────────────────────
    const tree = await loadDrawingParts(drawingId)
    if (!tree) throw new Error(`No drawing parts found for drawing ${drawingId}`)

    // ── 2. Resolve price file ─────────────────────────────────────────────────
    // Use the provided priceFileId if given; otherwise the current (is_current = true);
    // finally fall back to the published (status = 'published').
    let resolvedPriceFileId = priceFileId
    if (!resolvedPriceFileId) {
      const { data: pfCurrent } = await supabase
        .from('price_files').select('id').eq('is_current', true).maybeSingle()
      resolvedPriceFileId = pfCurrent?.id
    }
    if (!resolvedPriceFileId) {
      const { data: pfPublished } = await supabase
        .from('price_files').select('id').eq('status', 'published').maybeSingle()
      resolvedPriceFileId = pfPublished?.id
    }
    if (!resolvedPriceFileId) throw new Error('No price file found (is_current or published)')

    // ── 3. Load full pricing context via shared loader ───────────────────────
    const ctx = await loadPricingContext(supabase, resolvedPriceFileId)
    const { rules: allRules, pfVariables, glassCatalogue, partAllocationRules,
            partCostMap, ironmongeryCatalogue } = ctx

    // ── 4. Load profile values for glass cut size (rebate width + tolerance) ─
    // Loaded BEFORE the ironmongery resolution: the measured sash-weight
    // model needs the profile rebate/tolerance, and default-ironmongery
    // rules evaluate per-sash weight variables.
    const { data: drawingRow } = await supabase
      .from('drawings')
      .select('default_profile_id')
      .eq('id', drawingId)
      .maybeSingle()
    let profileValues = {}
    if (drawingRow?.default_profile_id) {
      const { data: pvRows, error: pvErr } = await supabase
        .from('default_profile_values')
        .select('field_key, default_value')
        .eq('profile_id', drawingRow.default_profile_id)
      if (pvErr) throw new Error(`Failed to load profile values: ${pvErr.message}`)
      for (const pv of (pvRows || [])) {
        // Profile values are stored as strings; convert numeric ones
        const n = Number(pv.default_value)
        profileValues[pv.field_key?.split('.')?.pop() ?? pv.field_key] = isNaN(n) ? pv.default_value : n
      }
    }

    // ── 4b. Resolve ironmongery lines ────────────────────────────────────────
    const ironmongeryLines = resolveIronmongeryLines(tree, ctx, profileValues)

    // ── 5. Create pricing_runs row ────────────────────────────────────────────
    const currentTreeHash = treeHash(tree)

    // Who ran it — shown in the Price breakdown view. public.users rows are
    // matched by EMAIL throughout the app (useCurrentUser, templates.js,
    // QuoteMatrixPage): public.users.id is NOT the auth uid, which is why a
    // created_by recorded as the auth uid resolved to no users row and the
    // breakdown showed "Run by: —". Store the public.users id; when there is
    // no matching row, record null — never invent one.
    let runUserId = null
    {
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr) console.warn('[priceDrawing] auth.getUser failed:', authErr.message)
      const authEmail = authData?.user?.email ?? null
      if (authEmail) {
        const { data: userRow, error: userErr } = await supabase
          .from('users').select('id').eq('email', authEmail).maybeSingle()
        if (userErr) console.warn('[priceDrawing] users lookup failed:', userErr.message)
        runUserId = userRow?.id ?? null
      }
    }

    const { data: pricingRun, error: runErr } = await supabase
      .from('pricing_runs')
      .insert({
        drawing_id:     drawingId,
        price_file_id:  resolvedPriceFileId,
        status:         'in_progress',
        tree_hash:      currentTreeHash,
        created_at:     new Date().toISOString(),
        created_by:     runUserId,
        engine_version: PRICING_ENGINE_VERSION,
      })
      .select('id')
      .single()

    if (runErr || !pricingRun) {
      throw new Error(`Failed to create pricing_run: ${runErr?.message ?? 'unknown'}`)
    }

    pricingRunId = pricingRun.id

    // ── 6. Run pricing engine ─────────────────────────────────────────────────
    const engineResults = runPricingOnTree(tree, allRules, pfVariables, {
      glassCatalogue,
      partAllocationRules,
      partCostMap,
      ironmongeryLines,
      ironmongeryCatalogue,
      profileValues,
    })

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
        price_file_id:    resolvedPriceFileId,
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
        price_file_id:    resolvedPriceFileId,
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
        .eq('price_file_id', resolvedPriceFileId)

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
          price_file_id:  resolvedPriceFileId,
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
        price_file_id:    resolvedPriceFileId,
        pricing_run_id:   pricingRunId,
        price_rule_id:    l.rule_id,
        loop_target_type: l.loop_target,
        loop_index:       null,
        // line_cost is round(qty × value, 2) per line — the same per-line
        // rounding pricing_runs.total_cost is summed from. Storing the raw
        // product here made the breakdown table's TOTAL drift pennies from
        // the run header (e.g. £920.64 vs £920.66): the header figure
        // (pricing_runs.total_cost) is the one stored on the run, and rows
        // now sum to it exactly.
        cost:             l.line_cost,
        sales:            l.line_total,
        markup_applied:   l.markup,
        // Detail for the Price breakdown view (sql/step-t1-price-breakdown.sql).
        // Same values the benchmark table displays: quantity, value, the
        // per-line label (component alloc label) and the loop part reference.
        quantity:         l.quantity,
        value:            l.value,
        part_label:       l.alloc_label ?? null,
        part_code:        l.alloc_part_code ?? l.alloc_iron_part_code ?? l.part_type ?? null,
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
        price_file_id:  resolvedPriceFileId,
        variables,
      })

    if (varErr) throw new Error(`Failed to write drawing_pricing_variables: ${varErr.message}`)

    // ── 14. Mark pricing_run complete ─────────────────────────────────────────
    // total_cost/total_sales are the price-rule-only totals the engine
    // already computed (engineResults.price never includes labour-minutes
    // rows — see runPricingOnTree passes 1-2 vs pass 3) — persisted here so
    // readers never need to re-derive them by summing drawing_rule_results
    // themselves (which, without filtering, double-counts labour minutes
    // as cost). See src/quotes/drawingRunPrice.js.
    await supabase
      .from('pricing_runs')
      .update({
        status:      'complete',
        total_cost:  engineResults.price.total_cost,
        total_sales: engineResults.price.total,
        // Warnings are stored with the run so the Price breakdown view can
        // show exactly what this run reported, not a fresh calculation.
        warnings:    engineResults.warnings ?? [],
      })
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
 * across drawings proportionally by each drawing's latest-run price.
 *
 * IMPORTANT: priceQuote never reads or writes drawings.calculated_price.
 * The source of truth for a drawing's price is its latest completed
 * pricing run (sum of drawing_rule_results.sales for that run).
 * Quote-level apportionment is stored in quote_item_apportionment and
 * read by the UI separately.
 *
 * @param {string} quoteId
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ priceFileId?: string }} [options]
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function priceQuote(quoteId, supabase, { priceFileId } = {}) {
  let quotePricingRunId = null

  try {
    // ── 1. Fetch drawing ids on this quote ──────────────────────────────────
    const { data: qdRows, error: qdErr } = await supabase
      .from('quote_drawings')
      .select('drawing_id')
      .eq('quote_id', quoteId)

    if (qdErr) throw new Error(`Failed to fetch quote_drawings: ${qdErr.message}`)

    const drawingIds = (qdRows || []).map(row => row.drawing_id)

    // ── 2. Drawing-level prices from latest completed runs ──────────────────
    // Read from drawing_rule_results so we never depend on
    // drawings.calculated_price (which may have been corrupted by an older
    // version of priceQuote that wrote back to it).
    const NJ_TYPES_OF_WORK = ['complete_new', 'new_pair_of_sashes']
    let nj_item_qty = 0
    const drawingLevelPrice = {} // String(drawingId) → sales total

    if (drawingIds.length > 0) {
      // Paginated: run history grows without bound, and a newest-1,000 cap
      // could hide a drawing's latest run (src/lib/fetchAllRows.js)
      const runRows = await fetchAllRows(
        () => supabase
          .from('pricing_runs')
          .select('id, drawing_id')
          .in('drawing_id', drawingIds)
          .eq('status', 'complete')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false }),
        'pricing_runs'
      )

      const latestRunId = {}
      for (const r of (runRows || [])) {
        const key = String(r.drawing_id)
        if (!latestRunId[key]) latestRunId[key] = r.id
      }
      const runIds = Object.values(latestRunId)

      if (runIds.length > 0) {
        // nj_item_qty from drawing_pricing_variables
        const { data: varRows } = await supabase
          .from('drawing_pricing_variables')
          .select('drawing_id, variables')
          .in('pricing_run_id', runIds)

        for (const v of (varRows || [])) {
          if (NJ_TYPES_OF_WORK.includes(v.variables?.typeOfWork)) nj_item_qty++
        }

        // Drawing-level sales from drawing_rule_results
        const { data: ruleRows } = await supabase
          .from('drawing_rule_results')
          .select('drawing_id, sales')
          .in('pricing_run_id', runIds)

        for (const r of (ruleRows || [])) {
          const key = String(r.drawing_id)
          drawingLevelPrice[key] = (drawingLevelPrice[key] || 0) + (Number(r.sales) || 0)
        }
      }
    }

    const drawings = drawingIds.map(id => ({
      drawing_id:          id,
      drawing_level_price: drawingLevelPrice[String(id)] || 0,
    }))

    const quoteTotal = drawings.reduce((sum, d) => sum + d.drawing_level_price, 0)
    // items_net_value = sum of included items' net sales, ex VAT, before
    // quote-level rules and before the quote discount — equals quoteTotal here.
    const items_net_value = quoteTotal

    // ── 3. Resolve price file ───────────────────────────────────────────────
    let resolvedPriceFileId = priceFileId
    if (!resolvedPriceFileId) {
      const { data: pfCurrent } = await supabase
        .from('price_files').select('id').eq('is_current', true).maybeSingle()
      resolvedPriceFileId = pfCurrent?.id
    }
    if (!resolvedPriceFileId) {
      const { data: pfPublished } = await supabase
        .from('price_files').select('id').eq('status', 'published').maybeSingle()
      resolvedPriceFileId = pfPublished?.id
    }
    if (!resolvedPriceFileId) throw new Error('No price file found (is_current or published)')

    const priceFile = { id: resolvedPriceFileId }

    // ── 4. Create quote_pricing_runs row ────────────────────────────────────
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

    // ── 5. Fetch active quote-level rules ───────────────────────────────────
    const { data: quoteRules, error: qrulesErr } = await supabase
      .from('price_rules')
      .select('id, name, condition, quantity, value, markup')
      .eq('price_file_id', priceFile.id)
      .eq('rule_family', 'price')
      .eq('level', 'quote')
      .eq('is_active', true)
      .order('sort_order')

    if (qrulesErr) throw new Error(`Failed to fetch quote rules: ${qrulesErr.message}`)

    const quoteVariables = { quote_total: quoteTotal, items_net_value, nj_item_qty }

    // ── 6. Evaluate each rule, write quote_rule_results, then apportion ─────
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
        const weight     = quoteTotal > 0 ? drawing.drawing_level_price / quoteTotal : 0
        const costShare  = weight * cost
        const salesShare = weight * ruleSales

        apportionmentRows.push({
          quote_rule_result_id: quoteRuleResultId,
          quote_pricing_run_id: quotePricingRunId,
          drawing_id:           drawing.drawing_id,
          cost:                 costShare,
          sales:                salesShare,
        })
      }

      if (apportionmentRows.length > 0) {
        const { error: apErr } = await supabase
          .from('quote_item_apportionment')
          .insert(apportionmentRows)
        if (apErr) throw new Error(`Failed to write quote_item_apportionment for rule ${rule.id}: ${apErr.message}`)
      }
    }

    // ── 7. Mark quote_pricing_run complete ──────────────────────────────────
    // NOTE: priceQuote does NOT update drawings.calculated_price.
    // The apportionment is stored in quote_item_apportionment and the UI
    // reads it separately to compute the item net for a quote.
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
