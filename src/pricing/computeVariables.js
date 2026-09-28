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
    const fmat = item?.values?.frameMaterialId ?? ''
    const smat = item?.values?.sashMaterialId  ?? ''
    const cmat = item?.values?.cillMaterialId  ?? ''

    const is_frame_redwood               = fmat === 'solid_redwood'
    const is_frame_accoya                = fmat === 'accoya'
    const is_solid_redwood_frame         = is_frame_redwood
    const is_solid_utile_hardwood_frame  = fmat === 'solid_utile_hardwood'
    const is_frame_engineered_accoya     = fmat === 'engineered_accoya'

    const is_sash_redwood                = smat === 'solid_redwood'
    const is_sash_accoya                 = smat === 'accoya'
    const is_solid_redwood_sash          = is_sash_redwood
    const is_solid_utile_hardwood_sash   = smat === 'solid_utile_hardwood'
    const is_sash_engineered_accoya      = smat === 'engineered_accoya'

    const is_cill_hardwood               = cmat === 'solid_utile_hardwood'
    const is_cill_accoya                 = cmat === 'accoya'
    const is_cill_redwood                = cmat === 'solid_redwood'
    const is_solid_utile_hardwood_cill   = is_cill_hardwood

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

    // ── GROUP 5 — Sash operations ─────────────────────────────────────────────
    const topOp = (topSash?.values?.operation ?? '').toLowerCase()
    const botOp = (botSash?.values?.operation ?? '').toLowerCase()

    const is_top_sash_cord_hung      = topOp.includes('cord')
    const is_top_sash_spiral_hung    = topOp.includes('spiral')
    const is_top_sash_fixed          = topOp === 'fix' || topOp.includes('fix')

    const is_bottom_sash_cord_hung   = botOp.includes('cord')
    const is_bottom_sash_spiral_hung = botOp.includes('spiral')
    const is_bottom_sash_fixed       = botOp === 'fix' || botOp.includes('fix')

    const has_cord_hung_sash         = is_top_sash_cord_hung   || is_bottom_sash_cord_hung
    const has_spiral_hung_sash       = is_top_sash_spiral_hung || is_bottom_sash_spiral_hung
    const is_cord_hung               = has_cord_hung_sash      // Integrate item-level alias
    const is_spiral_hung             = has_spiral_hung_sash    // Integrate item-level alias

    const opening_sash_count  = (!is_top_sash_fixed ? 1 : 0) + (!is_bottom_sash_fixed ? 1 : 0)
    const fixed_sash_count    = (is_top_sash_fixed ? 1 : 0)  + (is_bottom_sash_fixed ? 1 : 0)
    const total_sash_count    = allTopSashes.length + allBotSashes.length

    // ── GROUP 6 — Horn type ───────────────────────────────────────────────────
    const topHorn = (pair?.values?.topHornTypeShortName    ?? '').toLowerCase()
    const botHorn = (pair?.values?.bottomHornTypeShortName ?? '').toLowerCase()

    const is_top_sash_victorian_horn    = topHorn.includes('victorian')
    const is_bottom_sash_victorian_horn = botHorn.includes('victorian')
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
    const is_sash_arched                   = allTopSashes.some(s => s.values?.archHead === true) ||
                                             allBotSashes.some(s => s.values?.archHead === true)
    const cut_back_plaster                 = false  // NEEDS-DATA: notesPart.cutBackPlaster not yet mapped
    const has_trickle_vent                 = false  // NEEDS-DATA: not yet in parts tree
    const is_doc_l                         = false  // NEEDS-DATA
    const is_casement_window_bay           = false  // NEEDS-DATA
    const is_varnished_or_stained          = false  // NEEDS-DATA: finish codes not defined yet
    const sash_muntin_to_be_replaced_qty   = 0     // NEEDS-DATA: muntin data not yet captured

    const is_individually_glazed = allGlassParts.some(g => g.values?.isIndividualPanes === true)
    // Backwards compat alias
    const is_individual_panes = is_individually_glazed

    // gb_to_be_replaced_qty: total applied glazing bars being replaced.
    // Each glassPart stores barsWide (vertical dividers) and barsHigh (horizontal dividers).
    // A bar is included if its parent sash is being replaced (complete_new or toBeReplaced=true).
    const gb_to_be_replaced_qty = allGlassParts.reduce((sum, g) => {
      const parentSash = findParent(tree, g.key)
      const included   = is_complete_new || parentSash?.values?.toBeReplaced === true
      return sum + (included ? (g.values?.barsWide ?? 0) + (g.values?.barsHigh ?? 0) : 0)
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

    const is_painted         = internalFinish !== 'clean_white' || externalFinish !== 'clean_white'
    const is_colour_match    = is_internal_colour_match_satin || is_internal_colour_match_gloss ||
                               is_external_colour_match_satin || is_external_colour_match_gloss

    const is_same_finish_internally_and_externally      = internalFinish === externalFinish
    const is_standard_finish_internally_and_externally  = is_internal_clean_white && is_external_clean_white

    // ── GROUP 10 — Glazing type ───────────────────────────────────────────────
    const is_double_glazed = allGlassParts.some(g => g.values?.glazingId === 'double_glazed')
    const is_single_glazed = allGlassParts.some(g => g.values?.glazingId === 'single_glazed')
    const is_triple_glazed = allGlassParts.some(g => g.values?.glazingId === 'triple_glazed')

    // Glazing bar counts — read barsWide + barsHigh from each glassPart per sash.
    const top_sash_glazing_bar_count = allTopSashes.reduce((s, sash) =>
      s + (sash.children ?? []).filter(c => c.part_type === 'glassPart').reduce((cs, g) =>
        cs + (g.values?.barsWide ?? 0) + (g.values?.barsHigh ?? 0), 0), 0)
    const bottom_sash_glazing_bar_count = allBotSashes.reduce((s, sash) =>
      s + (sash.children ?? []).filter(c => c.part_type === 'glassPart').reduce((cs, g) =>
        cs + (g.values?.barsWide ?? 0) + (g.values?.barsHigh ?? 0), 0), 0)
    const total_glazing_bar_count = top_sash_glazing_bar_count + bottom_sash_glazing_bar_count
    const has_glazing_bars        = total_glazing_bar_count > 0
    // Pane count: (barsWide+1) × (barsHigh+1) per glass part, summed per sash
    const top_sash_pane_count = allTopSashes.reduce((s, sash) =>
      s + (sash.children ?? []).filter(c => c.part_type === 'glassPart').reduce((cs, g) =>
        cs + ((g.values?.barsWide ?? 0) + 1) * ((g.values?.barsHigh ?? 0) + 1), 0), 0) || 1
    const bottom_sash_pane_count = allBotSashes.reduce((s, sash) =>
      s + (sash.children ?? []).filter(c => c.part_type === 'glassPart').reduce((cs, g) =>
        cs + ((g.values?.barsWide ?? 0) + 1) * ((g.values?.barsHigh ?? 0) + 1), 0), 0) || 1
    const total_pane_count = top_sash_pane_count + bottom_sash_pane_count

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
    const frame_mullion_qty     = 0  // simple single-frame box sash
    const frame_transom_qty     = 0
    const new_casement_sash_qty = 0
    const new_door_leaf_qty     = 0
    const door_leaf_qty         = 0
    const casement_sash_qty     = 0
    const direct_glazed_unit_qty    = 0
    const full_length_frame_mullion_qty = 0
    const panel_qty             = 0

    // ── GROUP 12 — Frame geometry (mm) ────────────────────────────────────────
    // OUTER frame dimensions (Integrate: frame_width/height_in_mm = OUTER mm; width/height = OUTER metres)
    const frame_width    = (frame?.values?.outerWidth  ?? frame?.values?.width)  ?? null
    const frame_height   = (frame?.values?.outerHeight ?? frame?.values?.height) ?? null
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
      ? (frame_width * frame_height) / 1e6 : null
    const frame_perimeter_mm = (frame_width != null && frame_height != null)
      ? 2 * (frame_width + frame_height) : null

    // Cill length = frame width + horns
    const cill_length_in_mm = frame_width != null
      ? frame_width + (frame?.values?.leftCillHorn ?? 0) + (frame?.values?.rightCillHorn ?? 0)
      : null

    // cill_profiled_height_in_mm: cill height excluding the frame stop
    const cill_profiled_height_in_mm = cill?.values?.profiledHeight ?? cill?.values?.height ?? null

    // ── GROUP 13 — Sash geometry from derived ─────────────────────────────────
    const pairDerived    = derived[pair?.key] ?? {}
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
      const outerJamb  = frame?.values?.leftOuterJamb    ?? 0
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
      is_accoya_frame, is_accoya_sash,  // Integrate aliases

      // Group 4 — Jamb type
      is_solid_profiled_jamb, is_solid_with_plant_on_stop,
      is_solid_spiral_jamb, is_hollow_box_jamb,
      is_solid_redwood_frame_with_cord_jamb,

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
      cut_back_plaster, cut_out_brick_reveal,
      has_trickle_vent, is_doc_l,
      is_casement_window_bay, is_varnished_or_stained,
      gb_to_be_replaced_qty, sash_muntin_to_be_replaced_qty,
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

      // Group 10 — Glazing
      is_double_glazed, is_single_glazed, is_triple_glazed,
      top_sash_glazing_bar_count, bottom_sash_glazing_bar_count,
      total_glazing_bar_count, has_glazing_bars,
      top_sash_pane_count, bottom_sash_pane_count, total_pane_count,

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
      frame_area_m2, frame_perimeter_mm,
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
