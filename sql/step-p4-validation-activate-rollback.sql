-- ============================================================================
-- step-p4-validation-activate-rollback.sql
-- Reverts step-p4: re-blocks the rules that were activated.
-- Apply through Supabase SQL Editor to undo.
-- ============================================================================

-- Quote-level rules
UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: quote_margin'
WHERE name = 'Reminder to Increase R Rumber in busy periods' AND is_active = true AND condition LIKE '%quote_margin%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: item_qty, item_with_onsite_decoration_by_us_qty_excl_free_items, item_qty_with_solid_utile_hardwood_cill'
WHERE name = 'Single item fee' AND is_active = true AND condition LIKE '%item_qty%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: item_qty_with_black_warm_edge_spacer, item_qty_with_white_warm_edge_spacer, item_qty_with_brown_warm_edge_spacer, item_qty_with_bronze_aluminium_spacer'
WHERE name = 'Mixed Spacer Colour' AND is_active = true AND condition LIKE '%item_qty_with_black_warm_edge_spacer%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: item_qty_with_4mm_spacer, item_qty_with_6mm_spacer, item_qty_with_8mm_spacer, item_qty_with_10mm_spacer, item_qty_with_12mm_spacer, item_qty_with_14mm_spacer, item_qty_with_16mm_spacer'
WHERE name = 'Mixed Spacer Dimension' AND is_active = true AND condition LIKE '%item_qty_with_4mm_spacer%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: item_qty_with_accoya_cill, item_qty_with_oak_cill, item_qty_with_douglas_fir_cill, item_qty_with_solid_redwood_cill, item_qty_with_idigbo_cill, item_qty_with_solid_utile_hardwood_cill'
WHERE name = 'Cill Timber Not matching' AND is_active = true AND condition LIKE '%item_qty_with_accoya_cill%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: item_installed_by_us_qty'
WHERE name = 'Installation labour hours' AND is_active = true AND condition LIKE '%item_installed_by_us_qty%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: user_can_access_all_quotes, is_open_quote, is_pricefile_retired, quote_pricefile_no, latest_pricefile_no'
WHERE name = 'Quote PF not latest - HQ' AND is_active = true AND condition LIKE '%quote_pricefile_no%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: user_can_access_all_quotes, is_open_quote, is_pricefile_retired'
WHERE name = 'Quote PF retired - HQ' AND is_active = true AND condition LIKE '%is_pricefile_retired%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: user_can_access_all_quotes, is_open_quote, is_pricefile_retired, quote_pricefile_no, latest_pricefile_no'
WHERE name = 'Quote PF not latest - restricted' AND is_active = true AND condition LIKE '%quote_pricefile_no%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: user_can_access_all_quotes, is_open_quote, is_pricefile_retired'
WHERE name = 'Quote PF retired - restricted' AND is_active = true AND condition LIKE '%is_pricefile_retired%';

-- Glass group
UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: new_sash_with_curved_head_qty'
WHERE name = 'No Curved Head Sash Replacements' AND is_active = true AND condition LIKE '%new_sash_with_curved_head_qty%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: encapsulated_leaded_light_qty'
WHERE name = 'Encapsulated Leaded Lights' AND is_active = true AND condition LIKE '%encapsulated_leaded_light_qty%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: glass_unit_thickness'
WHERE name = 'Fineo Toughened Evacuation Port' AND is_active = true AND condition LIKE '%glass_unit_thickness%';

-- Sash Windows group
UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: glass_unit_thickness'
WHERE name = '35mm Sashes DGU' AND is_active = true AND condition LIKE '%glass_unit_thickness%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: glass_unit_thickness'
WHERE name = '50mm Sashes DGU' AND is_active = true AND condition LIKE '%glass_unit_thickness%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: frame_depth'
WHERE name = 'Box Frame Depth' AND is_active = true AND condition LIKE '%frame_depth%';

-- Stormproof Casements group
UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: frame_depth'
WHERE name = 'Casement Frame Thickness' AND is_active = true AND condition LIKE '%frame_depth%';

-- Missing Detail group
UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: frame_depth'
WHERE name = 'Frame depth 0' AND is_active = true AND condition LIKE '%frame_depth%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: cill_depth'
WHERE name = 'Cill depth 0' AND is_active = true AND condition LIKE '%cill_depth%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: is_survey_drawing, is_surveyor_specified'
WHERE name = 'No surveyor' AND is_active = true AND condition LIKE '%is_survey_drawing%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: surround_row_qty'
WHERE name IN ('No surrounds', 'Sash Replacement Surrounds') AND is_active = true AND condition LIKE '%surround_row_qty%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: has_unmodified_default_measurement'
WHERE name = 'Unmodified default' AND is_active = true AND condition LIKE '%has_unmodified_default_measurement%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: internal_finish, external_finish'
WHERE name = 'Paint empty' AND is_active = true AND condition LIKE '%internal_finish%';

-- Dimension group
UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: eq_glazing_is_out'
WHERE name = 'Equal glazing is out' AND is_active = true AND condition LIKE '%eq_glazing_is_out%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: sliding_sash_with_restricted_travel_qty'
WHERE name = 'Restricted sash travel' AND is_active = true AND condition LIKE '%sliding_sash_with_restricted_travel_qty%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: cill_height, cill_depth, frame_depth'
WHERE name = 'Frame deeper than cill' AND is_active = true AND condition LIKE '%cill_height%';

-- Suspicious Detail group
UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: is_oak_cill, is_oak_sash'
WHERE name = 'Oak' AND is_active = true AND condition LIKE '%is_oak_cill%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: is_solid_redwood_cill'
WHERE name = 'Softwood Cill' AND is_active = true AND condition LIKE '%is_solid_redwood_cill%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: glass_unit_thickness'
WHERE name = 'Single Glazed Item' AND is_active = true AND condition LIKE '%glass_unit_thickness%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: glass_unit_thickness, glass_unit_qty'
WHERE name = 'DOCL Heritage' AND is_active = true AND condition LIKE '%glass_unit_qty%';

UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: glass_unit_qty, glass_unit_thickness'
WHERE name = 'DOCL Single' AND is_active = true AND condition LIKE '%glass_unit_qty%';

-- Recommendation group
UPDATE public.validation_rules SET is_active = false, blocked_reason = 'missing variable: is_idigbo_frame, is_idigbo_sash'
WHERE name = 'Idigbo Warning' AND is_active = true AND condition LIKE '%is_idigbo_frame%';
