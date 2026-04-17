/**
 * computeVariables.js
 * Derives all pricing engine input variables from a drawing row,
 * its floor level, and its ironmongery line items.
 */

/**
 * @param {Object} drawing            - Full drawings table row
 * @param {string} floorLevel         - floor_level value from job_items
 * @param {Array}  ironmongeryItems   - [{ quantity, unit_cost, category_name }]
 * @returns {Object|null}             - Flat object of all computed variables, or null on error
 */
export function computeVariables(drawing, floorLevel, ironmongeryItems) {
  try {
    const {
      window_type,
      service_type,
      material_frame,
      material_sash,
      material_cill,
      frame_width,
      frame_height,
      sash_width,
      sash_height,
      top_sash_height,
      bottom_sash_height,
      finish_internal,
      finish_external,
      finish_cill,
      top_sash_operation,
      bottom_sash_operation,
      top_sash_glazing_bars_wide,
      top_sash_glazing_bars_high,
      bottom_sash_glazing_bars_wide,
      bottom_sash_glazing_bars_high,
      top_sash_glass,
      bottom_sash_glass,
      top_sash_horn,
      bottom_sash_horn,
      trickle_vent,
      needs_draughtsealing,
      doc_l,
      frame_jamb_external_width,
      frame_jamb_internal_width,
      frame_head_external_height,
      frame_head_internal_height,
      cill_depth,
      cill_height,
      cill_width,
      sash_thickness,
      bottom_rail_width,
      top_rail_width,
    } = drawing

    // ── GROUP 1 — Window Type Flags ──────────────────────────────────────────
    const is_box_sash              = window_type === 'Box Sash'
    const is_spiral_sash           = window_type === 'Spiral Sash'
    const is_flush_casement        = window_type === 'Flush Casement'
    const is_stormproof_casement   = window_type === 'Stormproof Casement'
    const is_front_door            = window_type === 'Front Door'
    const is_single_door           = window_type === 'Single Door'
    const is_french_door           = window_type === 'French Door'
    const is_bifolding_door        = window_type === 'Bifolding Door'
    const is_sash_window           = is_box_sash || is_spiral_sash
    const is_casement_window       = is_flush_casement || is_stormproof_casement
    const is_door                  = is_front_door || is_single_door || is_french_door || is_bifolding_door

    // ── GROUP 2 — Service Type Flags ─────────────────────────────────────────
    const is_complete_new          = service_type === 'Complete New'
    const is_sash_replacement      = service_type?.startsWith('Sash Replacement') ?? false
    const is_sash_replacement_35   = service_type === 'Sash Replacement 35mm'
    const is_sash_replacement_40   = service_type === 'Sash Replacement 40mm'
    const is_sash_replacement_45   = service_type === 'Sash Replacement 45mm'
    const is_sash_replacement_50   = service_type === 'Sash Replacement 50mm'
    const sash_replacement_thickness =
      is_sash_replacement_35 ? 35 :
      is_sash_replacement_40 ? 40 :
      is_sash_replacement_45 ? 45 :
      is_sash_replacement_50 ? 50 : 0

    // ── GROUP 3 — Material Flags ─────────────────────────────────────────────
    const is_frame_redwood         = material_frame === 'Solid Redwood'
    const is_frame_accoya          = material_frame === 'Accoya'
    const is_sash_redwood          = material_sash === 'Solid Redwood'
    const is_sash_accoya           = material_sash === 'Accoya'
    const is_cill_hardwood         = material_cill === 'Solid Utile Hardwood'
    const is_cill_accoya           = material_cill === 'Accoya'

    // ── GROUP 4 — Normalised Dimensions ──────────────────────────────────────
    const working_width            = is_sash_replacement ? (sash_width ?? 0) : (frame_width ?? 0)
    const working_height           = is_sash_replacement ? (sash_height ?? 0) : (frame_height ?? 0)

    // ── GROUP 5 — Finish Flags ───────────────────────────────────────────────
    const is_internal_clean_white        = finish_internal === 'Clean White'
    const is_internal_white_gloss        = finish_internal === 'White Gloss'
    const is_internal_white_satin        = finish_internal === 'White Satin'
    const is_internal_colour_match_satin = finish_internal === 'Colour Match Satin'
    const is_internal_colour_match_gloss = finish_internal === 'Colour Match Gloss'
    const is_internal_custom             = finish_internal === 'Custom'
    const is_external_clean_white        = finish_external === 'Clean White'
    const is_external_white_gloss        = finish_external === 'White Gloss'
    const is_external_white_satin        = finish_external === 'White Satin'
    const is_external_colour_match_satin = finish_external === 'Colour Match Satin'
    const is_external_colour_match_gloss = finish_external === 'Colour Match Gloss'
    const is_external_custom             = finish_external === 'Custom'
    const is_cill_clean_white            = finish_cill === 'Clean White'
    const is_cill_white_gloss            = finish_cill === 'White Gloss'
    const is_cill_white_satin            = finish_cill === 'White Satin'
    const is_cill_colour_match_satin     = finish_cill === 'Colour Match Satin'
    const is_cill_colour_match_gloss     = finish_cill === 'Colour Match Gloss'
    const is_cill_custom                 = finish_cill === 'Custom'
    const is_painted                     = finish_internal !== 'Clean White' || finish_external !== 'Clean White'
    const is_colour_match                = is_internal_colour_match_satin || is_internal_colour_match_gloss ||
                                           is_external_colour_match_satin || is_external_colour_match_gloss

    // ── GROUP 6 — Sash Operation Flags ───────────────────────────────────────
    const is_top_sash_cord_hung      = top_sash_operation === 'Cord Hung'
    const is_top_sash_spiral_hung    = top_sash_operation === 'Spiral Hung'
    const is_top_sash_fixed          = top_sash_operation === 'Fix'
    const is_bottom_sash_cord_hung   = bottom_sash_operation === 'Cord Hung'
    const is_bottom_sash_spiral_hung = bottom_sash_operation === 'Spiral Hung'
    const is_bottom_sash_fixed       = bottom_sash_operation === 'Fix'
    const has_cord_hung_sash         = is_top_sash_cord_hung || is_bottom_sash_cord_hung
    const has_spiral_hung_sash       = is_top_sash_spiral_hung || is_bottom_sash_spiral_hung
    const opening_sash_count         = (!is_top_sash_fixed ? 1 : 0) + (!is_bottom_sash_fixed ? 1 : 0)
    const fixed_sash_count           = (is_top_sash_fixed ? 1 : 0) + (is_bottom_sash_fixed ? 1 : 0)
    const total_sash_count           = 2

    // ── GROUP 7 — Glazing Bar Variables ──────────────────────────────────────
    const _top_bars_wide    = top_sash_glazing_bars_wide ?? 0
    const _top_bars_high    = top_sash_glazing_bars_high ?? 0
    const _bottom_bars_wide = bottom_sash_glazing_bars_wide ?? 0
    const _bottom_bars_high = bottom_sash_glazing_bars_high ?? 0

    const top_sash_glazing_bar_count    = _top_bars_wide + _top_bars_high
    const bottom_sash_glazing_bar_count = _bottom_bars_wide + _bottom_bars_high
    const total_glazing_bar_count       = top_sash_glazing_bar_count + bottom_sash_glazing_bar_count
    const has_glazing_bars              = total_glazing_bar_count > 0
    const top_sash_pane_count           = (_top_bars_wide + 1) * (_top_bars_high + 1)
    const bottom_sash_pane_count        = (_bottom_bars_wide + 1) * (_bottom_bars_high + 1)
    const total_pane_count              = top_sash_pane_count + bottom_sash_pane_count

    // ── GROUP 8 — Glass Type Flags ───────────────────────────────────────────
    const is_top_sash_clear_toughened      = top_sash_glass === 'Clear Toughened'
    const is_top_sash_sandblasted          = top_sash_glass === 'Sandblasted Toughened'
    const is_top_sash_antique_cathedral    = top_sash_glass === 'Antique Cathedral'
    const is_top_sash_pilkington_k         = top_sash_glass === 'Pilkington K'
    const is_bottom_sash_clear_toughened   = bottom_sash_glass === 'Clear Toughened'
    const is_bottom_sash_sandblasted       = bottom_sash_glass === 'Sandblasted Toughened'
    const is_bottom_sash_antique_cathedral = bottom_sash_glass === 'Antique Cathedral'
    const is_bottom_sash_pilkington_k      = bottom_sash_glass === 'Pilkington K'
    const has_sandblasted_glass            = is_top_sash_sandblasted || is_bottom_sash_sandblasted
    const has_antique_cathedral_glass      = is_top_sash_antique_cathedral || is_bottom_sash_antique_cathedral
    const has_pilkington_k_glass           = is_top_sash_pilkington_k || is_bottom_sash_pilkington_k
    const has_special_glass                = has_sandblasted_glass || has_antique_cathedral_glass || has_pilkington_k_glass

    // ── GROUP 9 — Horn Flags ─────────────────────────────────────────────────
    const is_top_sash_victorian_horn    = top_sash_horn === 'Victorian'
    const is_bottom_sash_victorian_horn = bottom_sash_horn === 'Victorian'
    const has_victorian_horn            = is_top_sash_victorian_horn || is_bottom_sash_victorian_horn
    const horn_count                    = (is_top_sash_victorian_horn ? 1 : 0) + (is_bottom_sash_victorian_horn ? 1 : 0)

    // ── GROUP 10 — Floor Level Flags ─────────────────────────────────────────
    const is_ground_floor  = floorLevel === 'Ground Floor'
    const is_first_floor   = floorLevel === 'First Floor'
    const is_second_floor  = floorLevel === 'Second Floor'
    const is_third_floor   = floorLevel === 'Third Floor'
    const is_basement      = floorLevel === 'Basement'
    const is_loft          = floorLevel === 'Loft'
    const is_other_floor   = floorLevel === 'Other'
    const is_upper_floor   = is_first_floor || is_second_floor || is_third_floor || is_loft

    // ── GROUP 11 — Miscellaneous Flags ───────────────────────────────────────
    const has_trickle_vent      = trickle_vent === true
    const needs_draughtproofing = needs_draughtsealing === true
    const is_doc_l              = doc_l === true

    // ── GROUP 12 — Geometric Variables ───────────────────────────────────────
    const frame_area_m2       = (frame_width != null && frame_height != null) ? (frame_width * frame_height) / 1000000 : null
    const frame_perimeter_mm  = (frame_width != null && frame_height != null) ? 2 * (frame_width + frame_height) : null
    const frame_width_m       = frame_width != null ? frame_width / 1000 : null
    const frame_height_m      = frame_height != null ? frame_height / 1000 : null
    const sash_area_m2        = (sash_width != null && sash_height != null) ? (sash_width * sash_height) / 1000000 : null
    const top_sash_area_m2    = (sash_width != null && top_sash_height != null) ? (sash_width * top_sash_height) / 1000000 : null
    const bottom_sash_area_m2 = (sash_width != null && bottom_sash_height != null) ? (sash_width * bottom_sash_height) / 1000000 : null
    const sash_width_m        = sash_width != null ? sash_width / 1000 : null
    const working_area_m2     = (working_width * working_height) / 1000000

    // ── GROUP 13 — Timber Volume Variables ───────────────────────────────────
    let frame_excl_cill_volume_mm3, frame_excl_cill_volume_m3
    if (is_complete_new && frame_width != null && frame_height != null) {
      const _external_jamb_vol  = 2 * 16 * frame_jamb_external_width * frame_height
      const _internal_jamb_vol  = 2 * 16 * frame_jamb_internal_width * frame_height
      const _fixed_jamb_vol     = 2 * 108 * 22 * frame_height
      const _external_head_vol  = 16 * frame_head_external_height * frame_width
      const _internal_head_vol  = 16 * frame_head_internal_height * frame_width
      const _fixed_head_vol     = 120 * 22 * frame_width
      frame_excl_cill_volume_mm3 = _external_jamb_vol + _internal_jamb_vol + _fixed_jamb_vol +
                                   _external_head_vol + _internal_head_vol + _fixed_head_vol
      frame_excl_cill_volume_m3  = frame_excl_cill_volume_mm3 / 1000000000
    } else {
      frame_excl_cill_volume_mm3 = 0
      frame_excl_cill_volume_m3  = 0
    }

    let cill_volume_mm3, cill_volume_m3
    if (is_complete_new && cill_depth != null && cill_height != null && cill_width != null) {
      cill_volume_mm3 = cill_depth * cill_height * cill_width
      cill_volume_m3  = cill_volume_mm3 / 1000000000
    } else {
      cill_volume_mm3 = 0
      cill_volume_m3  = 0
    }

    let bottom_sash_volume_mm3, top_sash_volume_mm3, total_sash_volume_mm3, total_sash_volume_m3
    if (sash_width != null && top_sash_height != null && bottom_sash_height != null) {
      const _bottom_rail_vol    = sash_thickness * bottom_rail_width * sash_width
      const _bottom_stiles_vol  = 2 * sash_thickness * 49 * bottom_sash_height
      const _bottom_midrail_vol = sash_thickness * 40 * sash_width
      bottom_sash_volume_mm3    = _bottom_rail_vol + _bottom_stiles_vol + _bottom_midrail_vol

      const _top_stiles_vol     = 2 * sash_thickness * 49 * top_sash_height
      const _top_midrail_vol    = sash_thickness * 40 * sash_width
      const _top_rail_vol       = sash_thickness * top_rail_width * sash_width
      top_sash_volume_mm3       = _top_stiles_vol + _top_midrail_vol + _top_rail_vol

      total_sash_volume_mm3     = bottom_sash_volume_mm3 + top_sash_volume_mm3
      total_sash_volume_m3      = total_sash_volume_mm3 / 1000000000
    } else {
      bottom_sash_volume_mm3 = 0
      top_sash_volume_mm3    = 0
      total_sash_volume_mm3  = 0
      total_sash_volume_m3   = 0
    }

    const accoya_frame_volume_m3  = is_frame_accoya  ? frame_excl_cill_volume_m3 : 0
    const redwood_frame_volume_m3 = is_frame_redwood ? frame_excl_cill_volume_m3 : 0
    const accoya_cill_volume_m3   = is_cill_accoya   ? cill_volume_m3 : 0
    const hardwood_cill_volume_m3 = is_cill_hardwood ? cill_volume_m3 : 0
    const accoya_sash_volume_m3   = is_sash_accoya   ? total_sash_volume_m3 : 0
    const redwood_sash_volume_m3  = is_sash_redwood  ? total_sash_volume_m3 : 0

    // ── GROUP 14 — Ironmongery-Derived Variables ─────────────────────────────
    const pulley_qty       = ironmongeryItems.reduce((sum, item) => item.category_name === 'Sash Pulleys' ? sum + item.quantity : sum, 0)
    const trickle_vent_qty = ironmongeryItems.reduce((sum, item) => item.category_name === 'Trickle Vent' ? sum + item.quantity : sum, 0)
    const ironmongery_cost = ironmongeryItems.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0)

    // ── GROUP 15 — Labour Pass Outputs (populated by engine after passes 0a/0b/0c) ──
    const total_install_minutes     = 0
    const total_manufacture_minutes = 0
    const total_parts_cost          = 0

    return {
      // Group 1 — Window Type Flags
      is_box_sash, is_spiral_sash, is_flush_casement, is_stormproof_casement,
      is_front_door, is_single_door, is_french_door, is_bifolding_door,
      is_sash_window, is_casement_window, is_door,

      // Group 2 — Service Type Flags
      is_complete_new, is_sash_replacement,
      is_sash_replacement_35, is_sash_replacement_40, is_sash_replacement_45, is_sash_replacement_50,
      sash_replacement_thickness,

      // Group 3 — Material Flags
      is_frame_redwood, is_frame_accoya,
      is_sash_redwood, is_sash_accoya,
      is_cill_hardwood, is_cill_accoya,

      // Group 4 — Normalised Dimensions
      working_width, working_height,

      // Group 5 — Finish Flags
      is_internal_clean_white, is_internal_white_gloss, is_internal_white_satin,
      is_internal_colour_match_satin, is_internal_colour_match_gloss, is_internal_custom,
      is_external_clean_white, is_external_white_gloss, is_external_white_satin,
      is_external_colour_match_satin, is_external_colour_match_gloss, is_external_custom,
      is_cill_clean_white, is_cill_white_gloss, is_cill_white_satin,
      is_cill_colour_match_satin, is_cill_colour_match_gloss, is_cill_custom,
      is_painted, is_colour_match,

      // Group 6 — Sash Operation Flags
      is_top_sash_cord_hung, is_top_sash_spiral_hung, is_top_sash_fixed,
      is_bottom_sash_cord_hung, is_bottom_sash_spiral_hung, is_bottom_sash_fixed,
      has_cord_hung_sash, has_spiral_hung_sash,
      opening_sash_count, fixed_sash_count, total_sash_count,

      // Group 7 — Glazing Bar Variables
      top_sash_glazing_bar_count, bottom_sash_glazing_bar_count, total_glazing_bar_count,
      has_glazing_bars,
      top_sash_pane_count, bottom_sash_pane_count, total_pane_count,

      // Group 8 — Glass Type Flags
      is_top_sash_clear_toughened, is_top_sash_sandblasted, is_top_sash_antique_cathedral, is_top_sash_pilkington_k,
      is_bottom_sash_clear_toughened, is_bottom_sash_sandblasted, is_bottom_sash_antique_cathedral, is_bottom_sash_pilkington_k,
      has_sandblasted_glass, has_antique_cathedral_glass, has_pilkington_k_glass, has_special_glass,

      // Group 9 — Horn Flags
      is_top_sash_victorian_horn, is_bottom_sash_victorian_horn,
      has_victorian_horn, horn_count,

      // Group 10 — Floor Level Flags
      is_ground_floor, is_first_floor, is_second_floor, is_third_floor,
      is_basement, is_loft, is_other_floor, is_upper_floor,

      // Group 11 — Miscellaneous Flags
      has_trickle_vent, needs_draughtproofing, is_doc_l,

      // Group 12 — Geometric Variables
      frame_area_m2, frame_perimeter_mm, frame_width_m, frame_height_m,
      sash_area_m2, top_sash_area_m2, bottom_sash_area_m2, sash_width_m,
      working_area_m2,

      // Group 13 — Timber Volume Variables
      frame_excl_cill_volume_mm3, frame_excl_cill_volume_m3,
      cill_volume_mm3, cill_volume_m3,
      bottom_sash_volume_mm3, top_sash_volume_mm3, total_sash_volume_mm3, total_sash_volume_m3,
      accoya_frame_volume_m3, redwood_frame_volume_m3,
      accoya_cill_volume_m3, hardwood_cill_volume_m3,
      accoya_sash_volume_m3, redwood_sash_volume_m3,

      // Group 14 — Ironmongery-Derived Variables
      pulley_qty, trickle_vent_qty, ironmongery_cost,

      // Group 15 — Labour Pass Outputs
      total_install_minutes, total_manufacture_minutes, total_parts_cost,
    }
  } catch (err) {
    console.error('[computeVariables] unexpected error:', err)
    return null
  }
}
