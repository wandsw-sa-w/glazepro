/**
 * computeVariables.js
 * Derives all pricing engine input variables from a parts tree and its derived
 * map (produced by computeDerived). Also accepts pfVariables (price-file
 * variables) which are merged in by the engine but passed here for completeness.
 *
 * New signature: computeVariables(tree, derived, pfVariables = {})
 *
 * Returns a flat object containing both GlazePro variable names and all
 * Integrate aliases needed for rule evaluation, or null on error.
 */

import {
  timberFamily, glazingType, hornKind, operationKind,
  glassSpacerMm, isLambsTongueMoulding,
} from './optionVocabulary.js'

// ── Tree helpers (mirrored from computeDerived.js) ───────────────────────────

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

// Walk the tree and return the parent node of the given child key
function findParent(node, childKey, parent = null) {
  if (!node) return null
  if (node.key === childKey) return parent
  for (const child of (node.children ?? [])) {
    const found = findParent(child, childKey, node)
    if (found !== null) return found
  }
  return null
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * @param {Object}  tree         - Root node of the parts tree
 * @param {Object}  derived      - Map of partKey → { propertyName: value }
 * @param {Object}  pfVariables  - Price-file variable values (scalars)
 * @returns {Object|null}
 */
export function computeVariables(tree, derived = {}, pfVariables = {}) {
  try {
    if (!tree) return null

    // ── Part node lookups ─────────────────────────────────────────────────────
    const item             = findFirst(tree, 'drawingItemPart')
    const frame            = findFirst(tree, 'assemblyFramePart')
    const cill             = findFirst(tree, 'cillPart')
    const pair             = findFirst(tree, 'sashPairPart')
    const topSash          = findFirst(tree, 'topSashPart')
    const botSash          = findFirst(tree, 'bottomSashPart')
    const paintNode        = findFirst(tree, 'paintAndIronmongeryPart')
    const notesNode        = findFirst(tree, 'notesPart')

    const allTopSashes     = findAll(tree, 'topSashPart')
    const allBotSashes     = findAll(tree, 'bottomSashPart')
    const allSashPairs     = findAll(tree, 'sashPairPart')
    const allFrames        = findAll(tree, 'assemblyFramePart')
    const allGlassParts    = findAll(tree, 'glassPart')
    const allMullions      = findAll(tree, 'mullionPart')
    const allTransoms      = findAll(tree, 'transomPart')

    // ── GROUP 1 — Item type detection ─────────────────────────────────────────
    const hasSashPair      = !!pair
    const hasCasementSash  = !!findFirst(tree, 'casementSashPart')
    const hasDoorLeaf      = !!findFirst(tree, 'doorLeafPart')
    const hasSpiral        = !!findFirst(tree, 'spiralSashPairPart')

    const is_box_sash              = hasSashPair && !hasCasementSash && !hasDoorLeaf
    const is_casement_window       = hasCasementSash
    const is_door                  = hasDoorLeaf
    const is_sash_window           = is_box_sash || hasSpiral
    const is_spiral_sash           = hasSpiral && !hasCasementSash && !hasDoorLeaf
    const is_flush_casement        = false  // NEEDS-DATA: sub-type not yet captured
    const is_stormproof_casement   = false  // NEEDS-DATA
    const is_front_door            = false  // NEEDS-DATA
    const is_single_door           = hasDoorLeaf
    const is_french_door           = false  // NEEDS-DATA
    const is_bifolding_door        = false  // NEEDS-DATA

    // Integrate alias
    const is_sw = is_box_sash

    // ── GROUP 2 — Service type (typeOfWork) ───────────────────────────────────
    const typeOfWork = item?.values?.typeOfWork ?? null

    const is_complete_new      = typeOfWork === 'complete_new'
    const nj_involved          = typeOfWork === 'complete_new' || typeOfWork === 'new_pair_of_sashes'
    const frame_to_be_replaced = is_complete_new
    const needs_draughtsealing = typeOfWork === 'draught_seal'
    const needs_draughtproofing = needs_draughtsealing
    const is_bi_glass           = item?.values?.isBiGlass === true || typeOfWork === 'bi_glass'
    const is_sash_replacement   = typeOfWork === 'new_pair_of_sashes'

    // Old service_type aliases for backward compat
    const is_sash_replacement_35 = false  // NEEDS-DATA: thickness variant not captured in new parts
    const is_sash_replacement_40 = false
    const is_sash_replacement_45 = is_sash_replacement && (pair?.values?.sashThickness === 45)
    const is_sash_replacement_50 = is_sash_replacement && (pair?.values?.sashThickness === 50)
    const sash_replacement_thickness = pair?.values?.sashThickness ?? 0

    // ── GROUP 3 — Material codes ──────────────────────────────────────────────
    // Real timber_species codes ('softwood', 'utile', …) map to engine
    // families in optionVocabulary.js — the single source for these
    // comparisons. An unrecognised code maps to no family and is reported
    // by collectVocabularyWarnings() in the engine run.
    const fmat = item?.values?.frameMaterialId ?? ''
    const smat = item?.values?.sashMaterialId  ?? ''
    const cmat = item?.values?.cillMaterialId  ?? ''

    const fFam = timberFamily(fmat) ?? null
    const sFam = timberFamily(smat) ?? null
    const cFam = timberFamily(cmat) ?? null

    const is_frame_redwood               = fFam === 'redwood'
    const is_frame_accoya                = fFam === 'accoya'
    const is_solid_redwood_frame         = is_frame_redwood
    const is_solid_utile_hardwood_frame  = fFam === 'utile_hardwood'
    const is_frame_engineered_accoya     = false  // no live timber_species code for this (audit)

    const is_sash_redwood                = sFam === 'redwood'
    const is_sash_accoya                 = sFam === 'accoya'
    const is_solid_redwood_sash          = is_sash_redwood
    const is_solid_utile_hardwood_sash   = sFam === 'utile_hardwood'
    const is_sash_engineered_accoya      = false  // no live timber_species code for this (audit)

    const is_cill_hardwood               = cFam === 'utile_hardwood'
    const is_cill_accoya                 = cFam === 'accoya'
    const is_cill_redwood                = cFam === 'redwood'
    const is_solid_utile_hardwood_cill   = is_cill_hardwood

    // Additional material flags needed by validation rules
    const is_solid_redwood_cill   = is_cill_redwood
    const is_oak_cill             = cFam === 'oak'
    const is_oak_sash             = sFam === 'oak'
    const is_oak_frame            = fFam === 'oak'
    const is_idigbo_frame         = fFam === 'idigbo'
    const is_idigbo_sash          = sFam === 'idigbo'
    const is_douglas_fir_frame    = fFam === 'douglas_fir'
    const is_douglas_fir_sash     = sFam === 'douglas_fir'
    const is_douglas_fir_cill     = cFam === 'douglas_fir'
    const is_meranti_frame        = fFam === 'meranti'
    const is_meranti_sash         = sFam === 'meranti'
    const is_meranti_cill         = cFam === 'meranti'
    const is_idigbo_cill          = cFam === 'idigbo'

    // Integrate aliases
    const is_accoya_frame = is_frame_accoya
    const is_accoya_sash  = is_sash_accoya

    // ── GROUP 4 — Jamb type ───────────────────────────────────────────────────
    const jambType = frame?.values?.jambType ?? ''

    const is_solid_profiled_jamb        = jambType === 'solid_profiled'
    const is_solid_with_plant_on_stop   = jambType === 'solid_with_plant_on_stop'
    const is_solid_spiral_jamb          = jambType === 'solid_spiral_for_sash'
    const is_hollow_box_jamb            = jambType === 'hollow_box_for_sash'
    const is_solid_redwood_frame_with_cord_jamb = is_solid_redwood_frame && !is_solid_spiral_jamb

    // ── GROUP 4b — Staff bead type ────────────────────────────────────────────
    const staffBeadTypeId = (item?.values?.staffBeadTypeId ?? 'small').toLowerCase()
    const is_small_staff_bead = staffBeadTypeId === 'small'
    const is_large_staff_bead = staffBeadTypeId === 'large'

    // ── GROUP 4c — Profiled frame interior dimensions ─────────────────────────
    // Interior = overall frame minus jambs / head / cill, taken from
    // computeDerived (the drawing board's own derivation) — never
    // recalculated here. Step V: assemblyFramePart.width/height are the
    // OVERALL frame (docs/step-v-geometry-brief.md).
    const pairDerived = derived[pair?.key] ?? {}
    const profiled_frame_interior_width_in_mm  = pairDerived.internalWidth  ?? null
    const profiled_frame_interior_height_in_mm = pairDerived.internalHeight ?? null

    // interior_qty: always 1 (the part allocation rules loop per sliding_sash
    // and multiply by interior_qty to control how many bead lengths per sash)
    const interior_qty = 1

    // ── GROUP 5 — Sash operations ─────────────────────────────────────────────
    const topOp = operationKind(topSash?.values?.operation)
    const botOp = operationKind(botSash?.values?.operation)

    const is_top_sash_cord_hung      = topOp === 'cord'
    const is_top_sash_spiral_hung    = topOp === 'spiral'
    const is_top_sash_fixed          = topOp === 'fix'

    const is_bottom_sash_cord_hung   = botOp === 'cord'
    const is_bottom_sash_spiral_hung = botOp === 'spiral'
    const is_bottom_sash_fixed       = botOp === 'fix'

    const has_cord_hung_sash         = is_top_sash_cord_hung   || is_bottom_sash_cord_hung
    const has_spiral_hung_sash       = is_top_sash_spiral_hung || is_bottom_sash_spiral_hung
    const is_cord_hung               = has_cord_hung_sash      // Integrate item-level alias
    const is_spiral_hung             = has_spiral_hung_sash    // Integrate item-level alias

    const opening_sash_count  = (!is_top_sash_fixed ? 1 : 0) + (!is_bottom_sash_fixed ? 1 : 0)
    const fixed_sash_count    = (is_top_sash_fixed ? 1 : 0)  + (is_bottom_sash_fixed ? 1 : 0)
    const total_sash_count    = allTopSashes.length + allBotSashes.length

    // ── GROUP 6 — Horn type ───────────────────────────────────────────────────
    const topHorn = hornKind(pair?.values?.topHornTypeShortName)
    const botHorn = hornKind(pair?.values?.bottomHornTypeShortName)

    const is_top_sash_victorian_horn    = topHorn === 'victorian'
    const is_bottom_sash_victorian_horn = botHorn === 'victorian'
    const has_victorian_horn            = is_top_sash_victorian_horn || is_bottom_sash_victorian_horn
    const horn_count                    = (is_top_sash_victorian_horn ? 1 : 0) + (is_bottom_sash_victorian_horn ? 1 : 0)

    // ── GROUP 7 — Floor level ─────────────────────────────────────────────────
    const floorLevel = item?.values?.floorLevel ?? null

    const is_floor_set_as_ground_floor  = floorLevel === 'ground_floor'
    const is_floor_set_as_first_floor   = floorLevel === 'first_floor'
    const is_floor_set_as_second_floor  = floorLevel === 'second_floor'
    const is_floor_set_as_third_floor   = floorLevel === 'third_floor'
    const is_floor_set_as_fourth_floor  = floorLevel === 'fourth_floor'
    const is_floor_set_as_fifth_floor   = floorLevel === 'fifth_floor'
    const is_floor_set_as_half_landing  = floorLevel === 'half_landing'

    // Convenience aliases
    const is_ground_floor = is_floor_set_as_ground_floor
    const is_first_floor  = is_floor_set_as_first_floor
    const is_second_floor = is_floor_set_as_second_floor
    const is_third_floor  = is_floor_set_as_third_floor
    const is_fourth_floor = is_floor_set_as_fourth_floor
    const is_fifth_floor  = is_floor_set_as_fifth_floor
    const is_half_landing = is_floor_set_as_half_landing
    const is_basement     = false  // NEEDS-DATA: not in reference_options yet
    const is_loft         = false  // NEEDS-DATA
    const is_other_floor  = false  // NEEDS-DATA
    const is_upper_floor  = is_first_floor || is_second_floor || is_third_floor ||
                            is_fourth_floor || is_fifth_floor

    // ── GROUP 8 — Installation / special flags ────────────────────────────────
    const installMethod   = notesNode?.values?.installationMethod ?? null
    const fit_to_prepared_opening          = item?.values?.fitToPreparedOpening === true
    const is_bay_with_fully_coupled_frames = item?.values?.bayFullyCoupledFrames === true
    const is_frame_in_kit_form             = item?.values?.frameInKitForm === true
    const is_bay_pole_required             = item?.values?.bayPoleRequired === true
    const is_decoration_included           = item?.values?.decoration === true
    const is_installation_included         = true  // always true for GlazePro items
    const is_raked                         = frame?.values?.rakeFrame === true
    // Step AD: the arch lives on the TOP SASH (archHead, archHeight = glass
    // rise, isFrameLevelArch, archedOuterJamb); a frame-level archHead is a
    // legacy drawing, read as a top-sash arch (collectVocabularyWarnings
    // flags it). These item-level flags aggregate across sashes; the
    // sliding_sash / glass_unit loop variables override them per part.
    const legacyFrameArch = frame?.values?.archHead === true
    const is_sash_arched                   = allTopSashes.some(s => s.values?.archHead === true) ||
                                             allBotSashes.some(s => s.values?.archHead === true) ||
                                             legacyFrameArch
    const is_curved_head_sash              = allTopSashes.some(s => s.values?.curvedSashHead === true) ||
                                             allBotSashes.some(s => s.values?.curvedSashHead === true)
    const has_curved_inner_head            = frame?.values?.curvedFrameHead === true || is_curved_head_sash
    const has_curved_outer_head            = frame?.values?.curvedFrameHead === true
    const has_arched_outer_jamb            = frame?.values?.archedOuterJamb === true ||
                                             allTopSashes.some(s => s.values?.archedOuterJamb === true)
    const is_square_top_with_arched_sightline = allGlassParts.some(
      g => g.values?.isSquareTopWithArchedSightline === true) ||
      (is_sash_arched && !is_curved_head_sash)

    // Horn lengths and custom horn flag
    const topHornLen      = pair?.values?.topHornLength    ?? 0
    const botHornLen      = pair?.values?.bottomHornLength ?? 0
    const horn_length_in_mm = Math.max(Number(topHornLen) || 0, Number(botHornLen) || 0)
    const has_custom_horn_horn =
      hornKind(pair?.values?.topHornTypeShortName)    === 'custom' ||
      hornKind(pair?.values?.bottomHornTypeShortName) === 'custom'

    // Multi-frame sash variants
    // Only count mullions that are direct children of assemblyFramePart
    const frameLevelMullions  = allMullions.filter(m => findParent(tree, m.key)?.part_type === 'assemblyFramePart')
    const hasHollowMullion    = frameLevelMullions.some(m => m.values?.isHollowMullion === true)
    const is_double_box_sash_window  = allSashPairs.length === 2 && frameLevelMullions.length === 1
    const is_triple_box_sash_window  = allSashPairs.length >= 3 && frameLevelMullions.length >= 2 && !hasHollowMullion
    const is_venetian_sash_window    = allSashPairs.length >= 3 && hasHollowMullion

    const cut_back_plaster                 = false  // NEEDS-DATA: notesPart.cutBackPlaster not yet mapped
    const has_trickle_vent                 = false  // NEEDS-DATA: not yet in parts tree
    // The board stores isDocL (real tree) — the old read of `doc_l` matched
    // nothing a drawing ever held (docs/pricing-vocabulary-audit.md).
    const is_doc_l                         = item?.values?.isDocL === true
    const is_docl                          = is_doc_l  // Integrate alias (rules use is_docl)
    const is_casement_window_bay           = false  // NEEDS-DATA
    const is_varnished_or_stained          = false  // NEEDS-DATA: finish codes not defined yet
    const sash_muntin_to_be_replaced_qty   = 0     // NEEDS-DATA: muntin data not yet captured

    const is_individually_glazed = allGlassParts.some(g => g.values?.isIndividualPanes === true)
    // Backwards compat alias
    const is_individual_panes = is_individually_glazed

    // gb_to_be_replaced_qty: total applied glazing bars being replaced.
    // Prefers actual verticalGlazingBarPart/horizontalGlazingBarPart children when present;
    // falls back to legacy barsWide/barsHigh counts for trees not yet migrated.
    // A bar is included if its parent sash is being replaced (complete_new or toBeReplaced=true).
    const gb_to_be_replaced_qty = allGlassParts.reduce((sum, g) => {
      const parentSash = findParent(tree, g.key)
      const included   = is_complete_new || parentSash?.values?.toBeReplaced === true
      if (!included) return sum
      const vBars = (g.children ?? []).filter(c => c.part_type === 'verticalGlazingBarPart').length
      const hBars = (g.children ?? []).filter(c => c.part_type === 'horizontalGlazingBarPart').length
      const hasActualBars = vBars > 0 || hBars > 0
      return sum + (hasActualBars ? vBars + hBars : (g.values?.barsWide ?? 0) + (g.values?.barsHigh ?? 0))
    }, 0)

    // gb_cruciform_joint_to_be_replaced_qty: crossings where a vertical and horizontal bar meet.
    // cruciform joints = vBars × hBars per glass unit.
    const gb_cruciform_joint_to_be_replaced_qty = allGlassParts.reduce((sum, g) => {
      const parentSash = findParent(tree, g.key)
      const included   = is_complete_new || parentSash?.values?.toBeReplaced === true
      if (!included) return sum
      const vBars = (g.children ?? []).filter(c => c.part_type === 'verticalGlazingBarPart').length
      const hBars = (g.children ?? []).filter(c => c.part_type === 'horizontalGlazingBarPart').length
      const hasActualBars = vBars > 0 || hBars > 0
      const bW = hasActualBars ? vBars : (g.values?.barsWide ?? 0)
      const bH = hasActualBars ? hBars : (g.values?.barsHigh ?? 0)
      return sum + bW * bH
    }, 0)

    // ── GROUP 9 — Finish flags ────────────────────────────────────────────────
    const internalFinish = paintNode?.values?.internalFinish ?? 'clean_white'
    const externalFinish = paintNode?.values?.externalFinish ?? 'clean_white'
    const cillFinish     = paintNode?.values?.cillFinish     ?? 'clean_white'
    const cut_out_brick_reveal = paintNode?.values?.cutOutBrickReveal === true

    const is_internal_clean_white        = internalFinish === 'clean_white'
    const is_internal_white_gloss        = internalFinish === 'white_gloss'
    const is_internal_white_satin        = internalFinish === 'white_satin'
    const is_internal_colour_match_satin = internalFinish === 'colour_match_satin'
    const is_internal_colour_match_gloss = internalFinish === 'colour_match_gloss'
    const is_internal_custom             = internalFinish === 'custom'

    const is_external_clean_white        = externalFinish === 'clean_white'
    const is_external_white_gloss        = externalFinish === 'white_gloss'
    const is_external_white_satin        = externalFinish === 'white_satin'
    const is_external_colour_match_satin = externalFinish === 'colour_match_satin'
    const is_external_colour_match_gloss = externalFinish === 'colour_match_gloss'
    const is_external_custom             = externalFinish === 'custom'

    const is_cill_clean_white            = cillFinish === 'clean_white'
    const is_cill_white_gloss            = cillFinish === 'white_gloss'
    const is_cill_white_satin            = cillFinish === 'white_satin'
    const is_cill_colour_match_satin     = cillFinish === 'colour_match_satin'
    const is_cill_colour_match_gloss     = cillFinish === 'colour_match_gloss'
    const is_cill_custom                 = cillFinish === 'custom'

    // ironmongery_finish: metal finish code for ironmongery selection (default PB)
    const ironmongery_finish = paintNode?.values?.ironmongeryFinish ?? 'PB'

    const is_painted         = internalFinish !== 'clean_white' || externalFinish !== 'clean_white'
    const is_colour_match    = is_internal_colour_match_satin || is_internal_colour_match_gloss ||
                               is_external_colour_match_satin || is_external_colour_match_gloss

    const is_same_finish_internally_and_externally      = internalFinish === externalFinish
    const is_standard_finish_internally_and_externally  = is_internal_clean_white && is_external_clean_white

    // ── GROUP 10 — Glazing type ───────────────────────────────────────────────
    // Real glazing_type codes ('double_glazing', …) via optionVocabulary.js.
    const is_double_glazed = allGlassParts.some(g => glazingType(g.values?.glazingId) === 'double')
    const is_single_glazed = allGlassParts.some(g => glazingType(g.values?.glazingId) === 'single')
    const is_triple_glazed = allGlassParts.some(g => glazingType(g.values?.glazingId) === 'triple')

    // Helper: resolve bar counts for a glassPart — prefer actual bar parts, fall back to barsWide/barsHigh
    function glassBarCounts(g) {
      const vBars = (g.children ?? []).filter(c => c.part_type === 'verticalGlazingBarPart').length
      const hBars = (g.children ?? []).filter(c => c.part_type === 'horizontalGlazingBarPart').length
      const hasActual = vBars > 0 || hBars > 0
      return {
        bW: hasActual ? vBars : (g.values?.barsWide ?? 0),
        bH: hasActual ? hBars : (g.values?.barsHigh ?? 0),
      }
    }

    // Glazing bar counts — prefer actual bar parts; fall back to barsWide + barsHigh
    const top_sash_glazing_bar_count = allTopSashes.reduce((s, sash) =>
      s + (sash.children ?? []).filter(c => c.part_type === 'glassPart').reduce((cs, g) => {
        const { bW, bH } = glassBarCounts(g)
        return cs + bW + bH
      }, 0), 0)
    const bottom_sash_glazing_bar_count = allBotSashes.reduce((s, sash) =>
      s + (sash.children ?? []).filter(c => c.part_type === 'glassPart').reduce((cs, g) => {
        const { bW, bH } = glassBarCounts(g)
        return cs + bW + bH
      }, 0), 0)
    const total_glazing_bar_count = top_sash_glazing_bar_count + bottom_sash_glazing_bar_count
    const has_glazing_bars        = total_glazing_bar_count > 0
    // Pane count: (barsWide+1) × (barsHigh+1) per glass part, summed per sash
    const top_sash_pane_count = allTopSashes.reduce((s, sash) =>
      s + (sash.children ?? []).filter(c => c.part_type === 'glassPart').reduce((cs, g) => {
        const { bW, bH } = glassBarCounts(g)
        return cs + (bW + 1) * (bH + 1)
      }, 0), 0) || 1
    const bottom_sash_pane_count = allBotSashes.reduce((s, sash) =>
      s + (sash.children ?? []).filter(c => c.part_type === 'glassPart').reduce((cs, g) => {
        const { bW, bH } = glassBarCounts(g)
        return cs + (bW + 1) * (bH + 1)
      }, 0), 0) || 1
    const total_pane_count = top_sash_pane_count + bottom_sash_pane_count

    // ── GROUP 10b — Glass unit aggregates ───────────────────────────────────────
    // glass_unit_qty: count of glassPart nodes in the tree
    const glass_unit_qty = allGlassParts.length

    // glass_unit_thickness (item-level): sum of layers for the first double-glazed unit.
    // Per-unit values are computed in validate.js per-part loops.
    // Item-level: use spacerHeight + pane thicknesses from glassPart values.
    const _firstDGlass = allGlassParts.find(g => glazingType(g.values?.glazingId) === 'double')
    const glass_unit_thickness = _firstDGlass
      ? (Number(_firstDGlass.values?.innerPaneThickness ?? 0) +
         glassSpacerMm(_firstDGlass.values ?? {}) +
         Number(_firstDGlass.values?.outerPaneThickness ?? 0))
      : 0

    // ── GROUP 10c — Frame / cill dimensions in metres ─────────────────────────
    // frame_depth: from assemblyFramePart.values.frameDepth, in metres
    const frame_depth = frame?.values?.frameDepth != null
      ? frame.values.frameDepth / 1000 : null

    // cill_depth: from cillPart.values.depth, in metres
    const cill_depth = cill?.values?.depth != null
      ? cill.values.depth / 1000 : null

    // cill_height: from cillPart.values.height, in metres
    const cill_height = cill?.values?.height != null
      ? cill.values.height / 1000 : null

    // ── GROUP 10d — Moulding / glazing bar ────────────────────────────────────
    // The board stores the moulding profile on drawingItemPart.mouldingTypeId
    // (real tree: 'ovolo'). The legacy mouldingPart node is kept as a
    // fallback for part types that may still carry one.
    const mouldingNode = findFirst(tree, 'mouldingPart')
    const is_lambs_tongue_moulding =
      isLambsTongueMoulding(item?.values?.mouldingTypeId) ||
      isLambsTongueMoulding(mouldingNode?.values?.profile)

    // gb_qty: total glazing bar count (alias for total_glazing_bar_count)
    const gb_qty = total_glazing_bar_count

    // gb_width: glazing bar width from mouldingPart or first bar node
    const _firstBar = allGlassParts.reduce((found, g) => {
      if (found) return found
      return (g.children ?? []).find(c =>
        c.part_type === 'verticalGlazingBarPart' || c.part_type === 'horizontalGlazingBarPart')
    }, null)
    const gb_width = mouldingNode?.values?.glazingBarWidth ?? _firstBar?.values?.barWidth ?? 0

    // ── GROUP 10e — Sash geometry aliases ─────────────────────────────────────
    // sash_thickness: from sashPairPart.values.sashThickness (also sash_replacement_thickness)
    const sash_thickness = pair?.values?.sashThickness ?? 0

    // ── GROUP 10f — Curved head / special counts ──────────────────────────────
    const new_sash_with_curved_head_qty = [...allTopSashes, ...allBotSashes].filter(
      s => s.values?.curvedSashHead === true &&
        (is_complete_new || s.values?.toBeReplaced === true)
    ).length

    // ── GROUP 10g — Finish raw codes ──────────────────────────────────────────
    // internal_finish / external_finish: raw codes for validation
    const internal_finish = internalFinish
    const external_finish = externalFinish

    // ── GROUP 10h — Stubs for features not yet built ──────────────────────────
    const surround_row_qty = 0                      // surround allocation not built
    const encapsulated_leaded_light_qty = 0          // leaded lights not built
    const sliding_sash_with_restricted_travel_qty = 0 // travel calculation not built
    const has_unmodified_default_measurement = false  // default measurement tracking not built
    const unmodified_default_measurement_text = ''    // same
    const eq_glazing_is_out = false                   // feature not built
    const is_survey_drawing = false                   // survey mode not built
    const is_surveyor_specified = false                // survey mode not built

    // ── GROUP 11 — Counts ─────────────────────────────────────────────────────
    const sliding_sash_qty  = allTopSashes.length + allBotSashes.length
    const sliding_pair_qty  = allSashPairs.length
    const frame_qty         = allFrames.length
    const new_frame_qty     = is_complete_new ? frame_qty : 0

    // new_sliding_sash_qty: sashes with toBeReplaced=true OR is_complete_new
    const new_sliding_sash_qty = is_complete_new
      ? sliding_sash_qty
      : [...allTopSashes, ...allBotSashes].filter(s => s.values?.toBeReplaced === true).length

    // fixed_sliding_sash_qty: sashes with operation='fix'
    const fixed_sliding_sash_qty = [...allTopSashes, ...allBotSashes].filter(s => {
      const op = (s.values?.operation ?? '').toLowerCase()
      return op === 'fix' || op.includes('fix')
    }).length

    const new_sash_qty          = new_sliding_sash_qty
    // new_cill_qty: 1 only when the cill is being replaced but NOT as part of a
    // complete-new job (complete_new includes the cill implicitly via frame_to_be_replaced).
    // A cill-only replacement sets cillPart.toBeReplaced = true on a non-complete_new job.
    const new_cill_qty          = !is_complete_new && cill?.values?.toBeReplaced === true ? 1 : 0

    // Mullion / transom counts from actual parts in the tree
    const frame_mullion_qty     = allMullions.length
    const frame_transom_qty     = allTransoms.length
    // Full-length mullions: those without a non-zero offset2 (offset2>0 means partial/stub)
    const full_length_frame_mullion_qty = allMullions.filter(m => !(m.values?.offset2 > 0)).length

    const new_casement_sash_qty = 0
    const new_door_leaf_qty     = 0
    const door_leaf_qty         = 0
    const casement_sash_qty     = 0
    const direct_glazed_unit_qty    = 0
    const panel_qty             = 0

    // ── GROUP 12 — Frame geometry (mm) ────────────────────────────────────────
    // assemblyFramePart.width/height ARE the overall frame (Step V decision,
    // matching Integrate's drawn labels and computeDerived). outerWidth /
    // outerHeight were never stored by real drawings and are not read.
    const _fv = frame?.values ?? {}
    const frame_width    = _fv.width  ?? null
    const frame_height   = _fv.height ?? null
    const frame_depth_in_mm = frame?.values?.frameDepth ?? null

    // Integrate names — OUTER dimensions
    const frame_width_in_mm  = frame_width
    const frame_height_in_mm = frame_height

    // Metres
    const frame_width_m  = frame_width  != null ? frame_width  / 1000 : null
    const frame_height_m = frame_height != null ? frame_height / 1000 : null

    // overall_frame_width in metres (used in install_labour rules)
    const overall_frame_width = frame_width_m

    const frame_area_m2 = (frame_width != null && frame_height != null)
      ? Math.round((frame_width * frame_height) / 1e6 * 100) / 100 : null
    // Integrate alias: frame_area = sum of frame m2 (used by DSO SqM Rate rule)
    // Rounded to 2dp to match Integrate's internal rounding.
    const frame_area = frame_area_m2
    const frame_perimeter_mm = (frame_width != null && frame_height != null)
      ? 2 * (frame_width + frame_height) : null

    // Cill length = frame width + horns
    const cill_length_in_mm = frame_width != null
      ? frame_width + (frame?.values?.leftCillHorn ?? 0) + (frame?.values?.rightCillHorn ?? 0)
      : null

    // cill_profiled_height_in_mm: cill height excluding the frame stop
    const cill_profiled_height_in_mm = cill?.values?.profiledHeight ?? cill?.values?.height ?? null

    // ── GROUP 13 — Sash geometry from derived (pairDerived set in GROUP 4c) ──
    const sashWidth      = pairDerived.sashWidth       ?? null
    const topSashHeight  = pairDerived.topSashHeight   ?? null
    const bottomSashHeight = pairDerived.bottomSashHeight ?? null

    const gross_sash_width_in_mm    = sashWidth
    const sash_width                = sashWidth         // backward compat
    const top_sash_height           = topSashHeight     // backward compat
    const bottom_sash_height        = bottomSashHeight  // backward compat

    const sash_area_m2        = (sashWidth != null && topSashHeight != null && bottomSashHeight != null)
      ? (sashWidth * (topSashHeight + bottomSashHeight)) / 1e6 : null
    const top_sash_area_m2    = (sashWidth != null && topSashHeight != null)
      ? (sashWidth * topSashHeight) / 1e6 : null
    const bottom_sash_area_m2 = (sashWidth != null && bottomSashHeight != null)
      ? (sashWidth * bottomSashHeight) / 1e6 : null
    const sash_width_m        = sashWidth != null ? sashWidth / 1000 : null

    // working_width / working_height (backward compat; used in some rules)
    const working_width  = is_sash_replacement ? (sashWidth ?? 0) : (frame_width ?? 0)
    const working_height = is_sash_replacement ? ((topSashHeight ?? 0) + (bottomSashHeight ?? 0)) : (frame_height ?? 0)
    const working_area_m2 = (working_width && working_height) ? working_width * working_height / 1e6 : 0

    // ── GROUP 14 — Timber volume calculations ─────────────────────────────────
    let frame_excl_cill_volume_mm3 = 0
    let frame_excl_cill_volume_m3  = 0

    if (is_complete_new && frame_width != null && frame_height != null) {
      const innerJamb  = frame?.values?.leftWidth        ?? 0
      // A null outer jamb means NO EXTENSION (outer = inner), as Integrate
      // stores on its real drawing — not outer = 0, which made this
      // difference −85 and the frame volume negative on every real drawing
      // (step-y brief §5).
      const outerJamb  = frame?.values?.leftOuterJamb    ?? innerJamb
      const jambDiff   = outerJamb - innerJamb  // = jambDifference (derived)

      const innerHead  = frame?.values?.topHeight         ?? 0
      // outer head: assemblyFramePart doesn't currently have outerHead; default to innerHead
      const outerHead  = frame?.values?.outerHead          ?? innerHead

      const _external_jamb_vol  = 2 * 16 * jambDiff   * frame_height
      const _internal_jamb_vol  = 2 * 16 * innerJamb  * frame_height
      const _fixed_jamb_vol     = 2 * 108 * 22         * frame_height
      const _external_head_vol  = 16 * outerHead        * frame_width
      const _internal_head_vol  = 16 * innerHead        * frame_width
      const _fixed_head_vol     = 120 * 22              * frame_width

      frame_excl_cill_volume_mm3 = _external_jamb_vol + _internal_jamb_vol + _fixed_jamb_vol +
                                   _external_head_vol  + _internal_head_vol  + _fixed_head_vol
      frame_excl_cill_volume_m3  = frame_excl_cill_volume_mm3 / 1e9
    }

    let cill_volume_mm3 = 0
    let cill_volume_m3  = 0

    if (is_complete_new) {
      const cillH    = cill?.values?.height ?? 0
      const cillD    = cill?.values?.depth  ?? 0
      const cillW    = cill_length_in_mm    ?? (frame_width ?? 0)
      if (cillH && cillD && cillW) {
        cill_volume_mm3 = cillD * cillH * cillW
        cill_volume_m3  = cill_volume_mm3 / 1e9
      }
    }

    let bottom_sash_volume_mm3 = 0
    let top_sash_volume_mm3    = 0
    let total_sash_volume_mm3  = 0
    let total_sash_volume_m3   = 0

    const sashThickness  = pair?.values?.sashThickness ?? 0
    const stileWidth     = topSash?.values?.leftWidth  ?? 47  // default profile stile width
    const topRailWidth   = topSash?.values?.topHeight  ?? 49  // top rail
    const botRailWidth   = botSash?.values?.bottomHeight ?? 88 // bottom rail
    const midrailHeight  = pair?.values?.midrailHeight ?? 40

    if (sashWidth != null && topSashHeight != null && bottomSashHeight != null && sashThickness > 0) {
      const _bottom_rail_vol    = sashThickness * botRailWidth * sashWidth
      const _bottom_stiles_vol  = 2 * sashThickness * stileWidth * bottomSashHeight
      const _bottom_midrail_vol = sashThickness * midrailHeight  * sashWidth
      bottom_sash_volume_mm3    = _bottom_rail_vol + _bottom_stiles_vol + _bottom_midrail_vol

      const _top_stiles_vol     = 2 * sashThickness * stileWidth * topSashHeight
      const _top_midrail_vol    = sashThickness * midrailHeight   * sashWidth
      const _top_rail_vol       = sashThickness * topRailWidth    * sashWidth
      top_sash_volume_mm3       = _top_stiles_vol + _top_midrail_vol + _top_rail_vol

      total_sash_volume_mm3 = bottom_sash_volume_mm3 + top_sash_volume_mm3
      total_sash_volume_m3  = total_sash_volume_mm3 / 1e9
    }

    const accoya_frame_volume_m3  = is_frame_accoya  ? frame_excl_cill_volume_m3 : 0
    const redwood_frame_volume_m3 = is_frame_redwood ? frame_excl_cill_volume_m3 : 0
    const accoya_cill_volume_m3   = is_cill_accoya   ? cill_volume_m3 : 0
    const hardwood_cill_volume_m3 = is_cill_hardwood ? cill_volume_m3 : 0
    const accoya_sash_volume_m3   = is_sash_accoya   ? total_sash_volume_m3 : 0
    const redwood_sash_volume_m3  = is_sash_redwood  ? total_sash_volume_m3 : 0

    // Integrate volume aliases
    const frame_excl_cill_volume              = frame_excl_cill_volume_m3
    const cill_volume                         = cill_volume_m3
    const accoya_volume                       = accoya_frame_volume_m3 + accoya_sash_volume_m3
    const solid_redwood_volume                = redwood_frame_volume_m3 + redwood_sash_volume_m3
    const solid_redwood_frame_excl_cill_volume = redwood_frame_volume_m3
    const solid_utile_hardwood_cill_volume    = hardwood_cill_volume_m3
    const volume = is_frame_accoya ? accoya_volume
                 : is_solid_redwood_frame ? solid_redwood_volume
                 : 0

    // ── GROUP 15 — Ironmongery (NEEDS-DATA: not yet in parts tree) ────────────
    const pulley_qty       = 0  // NEEDS-DATA
    const trickle_vent_qty = 0  // NEEDS-DATA
    const ironmongery_cost = 0  // NEEDS-DATA

    // ── GROUP 16 — Labour pass outputs (set by engine after passes) ───────────
    const std_labour_time          = 0  // hours; set by engine after manufacture_labour pass
    const installation_labour_time = 0  // hours; set by engine after install_labour pass
    const total_install_minutes    = 0  // backward compat
    const total_manufacture_minutes = 0 // backward compat
    const total_parts_cost         = 0  // backward compat

    // ── Return flat object with all variables and aliases ─────────────────────
    return {
      // Group 1 — Item type flags
      is_box_sash, is_spiral_sash, is_flush_casement, is_stormproof_casement,
      is_front_door, is_single_door, is_french_door, is_bifolding_door,
      is_sash_window, is_casement_window, is_door,
      hasSashPair, hasCasementSash, hasDoorLeaf,
      is_sw,  // Integrate alias

      // Group 2 — Service type
      typeOfWork,
      is_complete_new, nj_involved, frame_to_be_replaced,
      needs_draughtsealing, needs_draughtproofing,
      is_bi_glass, is_sash_replacement,
      is_sash_replacement_35, is_sash_replacement_40,
      is_sash_replacement_45, is_sash_replacement_50,
      sash_replacement_thickness,

      // Group 3 — Material flags
      is_frame_redwood, is_frame_accoya, is_solid_redwood_frame,
      is_solid_utile_hardwood_frame, is_frame_engineered_accoya,
      is_sash_redwood, is_sash_accoya, is_solid_redwood_sash,
      is_solid_utile_hardwood_sash, is_sash_engineered_accoya,
      is_cill_hardwood, is_cill_accoya, is_cill_redwood, is_solid_utile_hardwood_cill,
      is_solid_redwood_cill, is_oak_cill, is_oak_sash, is_oak_frame,
      is_idigbo_frame, is_idigbo_sash, is_idigbo_cill,
      is_douglas_fir_frame, is_douglas_fir_sash, is_douglas_fir_cill,
      is_meranti_frame, is_meranti_sash, is_meranti_cill,
      is_accoya_frame, is_accoya_sash,  // Integrate aliases

      // Group 4 — Jamb type
      is_solid_profiled_jamb, is_solid_with_plant_on_stop,
      is_solid_spiral_jamb, is_hollow_box_jamb,
      is_solid_redwood_frame_with_cord_jamb,

      // Group 4b — Staff bead type
      is_small_staff_bead, is_large_staff_bead,

      // Group 4c — Profiled frame interior dimensions
      profiled_frame_interior_width_in_mm,
      profiled_frame_interior_height_in_mm,
      interior_qty,

      // Group 5 — Sash operations
      is_top_sash_cord_hung, is_top_sash_spiral_hung, is_top_sash_fixed,
      is_bottom_sash_cord_hung, is_bottom_sash_spiral_hung, is_bottom_sash_fixed,
      has_cord_hung_sash, has_spiral_hung_sash,
      is_cord_hung, is_spiral_hung,  // Integrate item-level aliases
      opening_sash_count, fixed_sash_count, total_sash_count,

      // Group 6 — Horn type
      is_top_sash_victorian_horn, is_bottom_sash_victorian_horn,
      has_victorian_horn, horn_count,

      // Group 7 — Floor level
      is_floor_set_as_ground_floor, is_floor_set_as_first_floor,
      is_floor_set_as_second_floor, is_floor_set_as_third_floor,
      is_floor_set_as_fourth_floor, is_floor_set_as_fifth_floor,
      is_floor_set_as_half_landing,
      is_ground_floor, is_first_floor, is_second_floor, is_third_floor,
      is_fourth_floor, is_fifth_floor, is_half_landing,
      is_basement, is_loft, is_other_floor, is_upper_floor,

      // Group 8 — Installation / special flags
      fit_to_prepared_opening,
      is_bay_with_fully_coupled_frames, is_frame_in_kit_form, is_bay_pole_required,
      is_decoration_included, is_installation_included,
      is_raked, is_sash_arched,
      is_curved_head_sash, has_curved_inner_head, has_curved_outer_head,
      has_arched_outer_jamb, is_square_top_with_arched_sightline,
      horn_length_in_mm, has_custom_horn_horn,
      is_double_box_sash_window, is_triple_box_sash_window, is_venetian_sash_window,
      cut_back_plaster, cut_out_brick_reveal,
      has_trickle_vent, is_doc_l, is_docl,
      is_casement_window_bay, is_varnished_or_stained,
      gb_to_be_replaced_qty, gb_cruciform_joint_to_be_replaced_qty,
      sash_muntin_to_be_replaced_qty,
      is_individual_panes, is_individually_glazed,

      // Group 9 — Finish flags
      internalFinish, externalFinish, cillFinish,
      is_internal_clean_white, is_internal_white_gloss, is_internal_white_satin,
      is_internal_colour_match_satin, is_internal_colour_match_gloss, is_internal_custom,
      is_external_clean_white, is_external_white_gloss, is_external_white_satin,
      is_external_colour_match_satin, is_external_colour_match_gloss, is_external_custom,
      is_cill_clean_white, is_cill_white_gloss, is_cill_white_satin,
      is_cill_colour_match_satin, is_cill_colour_match_gloss, is_cill_custom,
      is_painted, is_colour_match,
      is_same_finish_internally_and_externally,
      is_standard_finish_internally_and_externally,
      ironmongery_finish,

      // Group 10 — Glazing
      is_double_glazed, is_single_glazed, is_triple_glazed,
      top_sash_glazing_bar_count, bottom_sash_glazing_bar_count,
      total_glazing_bar_count, has_glazing_bars,
      top_sash_pane_count, bottom_sash_pane_count, total_pane_count,

      // Group 10b — Glass unit aggregates
      glass_unit_qty, glass_unit_thickness,

      // Group 10c — Frame / cill dimensions (metres)
      frame_depth, cill_depth, cill_height,

      // Group 10d — Moulding / glazing bar
      is_lambs_tongue_moulding, gb_qty, gb_width,

      // Group 10e — Sash geometry aliases
      sash_thickness,

      // Group 10f — Curved head / special counts
      new_sash_with_curved_head_qty,

      // Group 10g — Finish raw codes (also in Group 9 as internalFinish/externalFinish)
      internal_finish, external_finish,

      // Group 10h — Stubs for unbuilt features
      surround_row_qty, encapsulated_leaded_light_qty,
      sliding_sash_with_restricted_travel_qty,
      has_unmodified_default_measurement, unmodified_default_measurement_text,
      eq_glazing_is_out, is_survey_drawing, is_surveyor_specified,

      // Group 11 — Counts
      sliding_sash_qty, new_sliding_sash_qty, fixed_sliding_sash_qty,
      sliding_pair_qty, frame_qty, new_frame_qty,
      frame_mullion_qty, frame_transom_qty,
      new_sash_qty, new_cill_qty,
      new_casement_sash_qty, new_door_leaf_qty,
      door_leaf_qty, casement_sash_qty,
      direct_glazed_unit_qty, full_length_frame_mullion_qty, panel_qty,

      // Group 12 — Frame geometry
      frame_width, frame_height,
      frame_width_in_mm, frame_height_in_mm, frame_depth_in_mm,
      frame_width_m, frame_height_m,
      overall_frame_width,
      frame_area_m2, frame_area, frame_perimeter_mm,
      cill_length_in_mm,
      cill_profiled_height_in_mm,

      // Group 13 — Sash geometry
      sash_width, top_sash_height, bottom_sash_height,
      gross_sash_width_in_mm,
      sash_area_m2, top_sash_area_m2, bottom_sash_area_m2, sash_width_m,
      working_width, working_height, working_area_m2,

      // Group 14 — Timber volumes
      frame_excl_cill_volume_mm3, frame_excl_cill_volume_m3,
      cill_volume_mm3, cill_volume_m3,
      bottom_sash_volume_mm3, top_sash_volume_mm3,
      total_sash_volume_mm3, total_sash_volume_m3,
      accoya_frame_volume_m3, redwood_frame_volume_m3,
      accoya_cill_volume_m3, hardwood_cill_volume_m3,
      accoya_sash_volume_m3, redwood_sash_volume_m3,
      // Integrate volume aliases
      frame_excl_cill_volume, cill_volume, accoya_volume,
      solid_redwood_volume, solid_redwood_frame_excl_cill_volume,
      solid_utile_hardwood_cill_volume, volume,

      // Group 15 — Ironmongery
      pulley_qty, trickle_vent_qty, ironmongery_cost,

      // Group 16 — Labour pass outputs
      std_labour_time, installation_labour_time,
      total_install_minutes, total_manufacture_minutes, total_parts_cost,
    }
  } catch (err) {
    console.error('[computeVariables] unexpected error:', err)
    return null
  }
}

// ── Quote-level variables ───────────────────────────────────────────────────

/**
 * Compute quote-level variables from an array of item-level variable objects.
 *
 * @param {Object[]}  itemVarsList  - Array of per-item variable objects (from computeVariables)
 * @param {Object}    quoteContext  - Optional quote-level context
 *   { status, pricefileNo, latestPricefileNo, isPricefileRetired, totalInstallMinutes }
 * @returns {Object} Quote-level variables for validation
 */
export function computeQuoteVariables(itemVarsList = [], quoteContext = {}) {
  const items = itemVarsList.filter(Boolean)

  const item_qty = items.length

  // Count items with installation included
  const item_installed_by_us_qty = items.filter(v => v.is_installation_included).length

  // Count items with specific cill materials
  const item_qty_with_solid_utile_hardwood_cill = items.filter(v => v.is_solid_utile_hardwood_cill).length
  const item_qty_with_solid_redwood_cill = items.filter(v => v.is_solid_redwood_cill).length
  const item_qty_with_accoya_cill = items.filter(v => v.is_cill_accoya).length
  const item_qty_with_oak_cill = items.filter(v => v.is_oak_cill).length
  const item_qty_with_idigbo_cill = items.filter(v => v.is_idigbo_cill).length
  const item_qty_with_douglas_fir_cill = 0  // douglas fir cill not offered

  // Spacer colour counts — derive from first glass part's spacerDimId per item
  // The spacerDimId encodes both dimension and colour, e.g. '16mm_white_warm_edge'
  let item_qty_with_white_warm_edge_spacer = 0
  let item_qty_with_black_warm_edge_spacer = 0
  let item_qty_with_brown_warm_edge_spacer = 0
  let item_qty_with_bronze_aluminium_spacer = 0

  // Spacer dimension counts
  let item_qty_with_4mm_spacer = 0
  let item_qty_with_6mm_spacer = 0
  let item_qty_with_8mm_spacer = 0
  let item_qty_with_10mm_spacer = 0
  let item_qty_with_12mm_spacer = 0
  let item_qty_with_14mm_spacer = 0
  let item_qty_with_16mm_spacer = 0

  // These counts are passed at quote level from item data; we use quoteContext.spacerCounts if provided
  // Otherwise we default to 0 (the data is on the tree, not on itemVars)
  if (quoteContext.spacerCounts) {
    const sc = quoteContext.spacerCounts
    item_qty_with_white_warm_edge_spacer  = sc.white_warm_edge  ?? 0
    item_qty_with_black_warm_edge_spacer  = sc.black_warm_edge  ?? 0
    item_qty_with_brown_warm_edge_spacer  = sc.brown_warm_edge  ?? 0
    item_qty_with_bronze_aluminium_spacer = sc.bronze_aluminium ?? 0
    item_qty_with_4mm_spacer  = sc.dim_4  ?? 0
    item_qty_with_6mm_spacer  = sc.dim_6  ?? 0
    item_qty_with_8mm_spacer  = sc.dim_8  ?? 0
    item_qty_with_10mm_spacer = sc.dim_10 ?? 0
    item_qty_with_12mm_spacer = sc.dim_12 ?? 0
    item_qty_with_14mm_spacer = sc.dim_14 ?? 0
    item_qty_with_16mm_spacer = sc.dim_16 ?? 0
  }

  // Installation labour time from pricing runs (install minutes / 60, summed).
  // Item-level installation_labour_time is always 0 (set by engine after pass),
  // so use the pricing data passed by the caller.
  const installation_labour_time = quoteContext.totalInstallMinutes != null
    ? quoteContext.totalInstallMinutes / 60
    : items.reduce((sum, v) => sum + (v.installation_labour_time ?? 0), 0)

  // Quote margin: default R number (configurable in Integrate, default 1000)
  const quote_margin = quoteContext.quoteMargin ?? 1000

  // Quote status flags
  const is_open_quote = (quoteContext.status ?? 'open') === 'open'

  // Price file tracking
  const quote_pricefile_no = quoteContext.pricefileNo ?? null
  const latest_pricefile_no = quoteContext.latestPricefileNo ?? null
  const is_pricefile_retired = quoteContext.isPricefileRetired ?? false

  // Access control (single org, no restrictions)
  const user_can_access_all_quotes = true

  // Sum new_frame_qty across items
  const new_frame_qty = items.reduce((sum, v) => sum + (v.new_frame_qty ?? 0), 0)

  // Count items with onsite decoration (excluding free items)
  const item_with_onsite_decoration_by_us_qty_excl_free_items = items.filter(v => v.is_decoration_included).length

  return {
    item_qty,
    item_installed_by_us_qty,
    item_qty_with_solid_utile_hardwood_cill,
    item_qty_with_solid_redwood_cill,
    item_qty_with_accoya_cill,
    item_qty_with_oak_cill,
    item_qty_with_idigbo_cill,
    item_qty_with_douglas_fir_cill,
    item_qty_with_white_warm_edge_spacer,
    item_qty_with_black_warm_edge_spacer,
    item_qty_with_brown_warm_edge_spacer,
    item_qty_with_bronze_aluminium_spacer,
    item_qty_with_4mm_spacer,
    item_qty_with_6mm_spacer,
    item_qty_with_8mm_spacer,
    item_qty_with_10mm_spacer,
    item_qty_with_12mm_spacer,
    item_qty_with_14mm_spacer,
    item_qty_with_16mm_spacer,
    installation_labour_time,
    quote_margin,
    is_open_quote,
    quote_pricefile_no,
    latest_pricefile_no,
    is_pricefile_retired,
    user_can_access_all_quotes,
    new_frame_qty,
    new_sliding_sash_qty: items.reduce((sum, v) => sum + (v.new_sliding_sash_qty ?? 0), 0),
    item_with_onsite_decoration_by_us_qty_excl_free_items,
  }
}
