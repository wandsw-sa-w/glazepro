# Pricing Variables — Integrate PF30 Import

Extracted 28 Sep 2026 from 266 rules across three families:
`manufacture_labour` (114), `install_labour` (85), `price` (67).

**Status key:**
- `EXISTS` — already in GlazePro's variable catalogue (`RuleEditor.jsx` / `computeVariables.js`)
- `NEW-derivable` — not yet in catalogue but computable from existing drawing tree data
- `NEEDS-DATA` — requires a new input field or external data source
- `UNKNOWN` — purpose unclear; needs domain review before implementing

---

## Price File Constants (from PF30 `price_file_variables`)

These are stored in `price_file_variables` and resolved at rule evaluation time.

| Variable | Value | Used in (rules) | Notes |
|---|---|---|---|
| `accoya_cubic_meter` | 4.65 | manufacture_materials ×2 | £/m³ for accoya timber |
| `decoration_labour_hourly` | 42.50 | — | Declared but not referenced in export |
| `douglas_fir_cubic_meter` | 2.05 | — | Declared but not referenced in export |
| `idigbo_cubic_meter` | 3.50 | — | Declared but not referenced in export |
| `installation_labour_hourly` | 40.21 | labour ×1 | £/hr for installation |
| `meranti_cubic_meter` | 3.54 | — | Declared but not referenced in export |
| `oak_cubic_meter` | 7.00 | — | Declared but not referenced in export |
| `softwood_cubic_meter` | 1.25 | — | Declared but not referenced in export |
| `special_glass` | 'GL100045' | — | Part code reference |
| `utile` | 'utile' | manufacture_materials ×1 | String used in `contains()` rule (flagged) |
| `utile_cubic_meter` | 3.54 | manufacture_materials ×2 | £/m³ for utile hardwood |
| `workshop_hourly_additional` | 24.66 | manufacture ×1 | £/hr additional workshop rate |
| `workshop_hourly_rate` | 15.00 | — | Labour editor base rate |

---

## Drawing-Level Variables (by-item scope)

### Boolean flags — Window / item type

| Variable | Rules using it | Families | Status | Definition |
|---|---|---|---|---|
| `is_sw` | 30 | ML, IL | EXISTS (`is_box_sash`) | Box sash window |
| `is_door` | 20 | ML, IL, price | EXISTS | Item is a door |
| `is_casement_window` | 12 | ML, IL | EXISTS (`is_flush_casement` / `is_stormproof_casement`) | Item is a casement window |
| `is_casement_window_bay` | 8 | ML, IL | NEW-derivable | Casement window bay configuration |
| `is_front_door` | 6 | IL | EXISTS | Front door type |
| `is_individual_panes` | 4 | ML | UNKNOWN | Heritage / single-pane glazing mode |
| `is_single_glazed` | 4 | ML, price | NEW-derivable | Single-glazed unit |
| `is_double_glazed` | 3 | price | NEW-derivable | Double-glazed unit |
| `is_item_a_door` | 3 | ML | UNKNOWN | Loop-level flag on casement_sash |
| `is_fanlight` | 2 | ML | UNKNOWN | Sash or casement is a fanlight |
| `is_bi_glass` | 6 | ML, IL, price | UNKNOWN | BiGlass product type |
| `is_direct_glazed_unit` | 4 | IL | UNKNOWN | Direct-glazed (no sash) unit |
| `is_venetian_sash_window` | 1 | IL | UNKNOWN | Venetian-style DSO |
| `is_yorkshire_sash_window` | 1 | ML | UNKNOWN | Yorkshire sash (⚠ likely excluded product) |
| `is_door_mpls` | 1 | IL | UNKNOWN | Door MPLS type |
| `is_raked` | 4 | ML, IL | UNKNOWN | Raked (non-rectangular) frame |
| `is_bi_fold_door_set` | 2 | price | UNKNOWN | ⚠ Bifold door set (likely excluded product) |

### Boolean flags — Service type

| Variable | Rules | Families | Status | Definition |
|---|---|---|---|---|
| `nj_involved` | 14 | ML, IL, price | UNKNOWN | New jamb involved (box sash frame replacement) |
| `frame_to_be_replaced` | 14 | ML, IL, price | EXISTS (`is_complete_new`) | Frame is being replaced |
| `to_be_replaced` | 30+ | ML, IL | NEW-derivable | This loop part is to be replaced |
| `is_complete_new` | 10 | IL | EXISTS | Complete new installation |
| `is_installation_included` | 12 | IL | NEEDS-DATA | Installation is included in the quote |
| `needs_draughtsealing` | 5 | IL, price | NEEDS-DATA | Draught sealing service included |
| `is_decoration_included` | 4 | IL | NEEDS-DATA | Decoration/painting is included |
| `is_heritage_range` | 1 | ML | UNKNOWN | Heritage range product |

### Boolean flags — Material / construction

| Variable | Rules | Families | Status | Definition |
|---|---|---|---|---|
| `is_solid_redwood_sash` | 2 | price | NEW-derivable | Sash is laminated redwood |
| `is_solid_redwood_frame` | 5 | price | NEW-derivable | Frame is solid redwood |
| `is_solid_spiral_jamb` | 3 | price | NEW-derivable | Frame uses spiral balance jamb (negated: sort 20/25 linings; positive: sort 30/35 spiral) |
| `is_solid_utile_hardwood_frame` | 8 | price | NEW-derivable | Frame is solid utile hardwood |
| `is_solid_utile_hardwood_sash` | 4 | price | NEW-derivable | Sash is solid utile hardwood |
| `is_solid_utile_hardwood_cill` | 1 | price | NEW-derivable | Cill is solid utile hardwood |
| `is_accoya_frame` | 5 | ML, price | EXISTS (`is_frame_accoya`) | Frame is accoya |
| `is_accoya_sash` | 5 | ML, price | EXISTS (`is_sash_accoya`) | Sash is accoya |
| `is_cord_hung` | 2 | price | NEW-derivable | Sash is cord-hung (box sash) |
| `is_spiral_hung` | 1 | price | NEW-derivable | Sash is spiral-hung |
| `is_accoya_range` | 1 | ML | NEW-derivable | Accoya product range flag |
| `is_casement_range` | 1 | price | UNKNOWN | Casement range flag |
| `is_bay_with_fully_coupled_frames` | 3 | IL, price | UNKNOWN | Bay with fully coupled frame construction |
| `is_frame_in_kit_form` | 3 | ML, IL | UNKNOWN | Frame supplied disassembled |
| `is_bay_pole_required` | 1 | ML | UNKNOWN | Bay pole required |
| `is_single_and_french_doors_range` | 1 | price | UNKNOWN | ⚠ Flagged — door range check (sort 400) |
| `is_open_in_doors_range` | 1 | price | UNKNOWN | ⚠ Flagged — door range check (sort 400) |

### Boolean flags — Finish

| Variable | Rules | Families | Status | Definition |
|---|---|---|---|---|
| `is_same_finish_internally_and_externally` | 14 | ML | NEEDS-DATA | Same colour/finish both sides |
| `is_varnished_or_stained` | 6 | ML, price | NEEDS-DATA | Varnish or stain finish |
| `is_varnished_or_stained_internally` | 5 | ML | NEEDS-DATA | Stain on internal face |
| `is_varnished_or_stained_externally` | 5 | ML | NEEDS-DATA | Stain on external face |
| `is_varnished_cill` | 1 | ML | NEEDS-DATA | Cill is stained/varnished |
| `is_standard_finish_internally_and_externally` | 1 | price | NEEDS-DATA | Standard (white) finish both sides |

### Boolean flags — Shape / geometry

| Variable | Rules | Families | Status | Definition |
|---|---|---|---|---|
| `is_square_top_with_arched_sightline` | 5 | ML | NEEDS-DATA | Swept head (arch behind square frame) |
| `is_curved_head_sash` | 4 | ML | NEEDS-DATA | Fully curved head sash |
| `has_curved_outer_head` | 3 | ML | NEEDS-DATA | Curved outer lining head |
| `has_curved_inner_head` | 3 | ML | NEEDS-DATA | Curved inner head |
| `has_arched_outer_jamb` | 1 | ML | UNKNOWN | Arched outer jamb |
| `is_sash_arched` | 7 | ML, price | NEW-derivable | Arched glass unit (positive: sort 30/31 glass_done; negated: sort 20/21/22/30/315 price) |
| `is_top_sash` | 1 | price | NEW-derivable | Loop part is the top sash |
| `is_bottom_sash` | 1 | price | NEW-derivable | Loop part is the bottom sash |

### Boolean flags — Panel

| Variable | Rules | Families | Status | Definition |
|---|---|---|---|---|
| `is_flat_panel_internally` | 1 | ML | NEEDS-DATA | Flat panel internally |
| `is_raised_and_fielded_panel_internally` | 1 | ML | NEEDS-DATA | R&F panel |
| `is_vertical_tongue_and_groove_panel_internally` | 1 | ML | NEEDS-DATA | VTG panel |
| `is_horizontal_tongue_and_groove_panel_internally` | 1 | ML | NEEDS-DATA | HTG panel |
| `internal_panel_type` | 1 | ML | NEEDS-DATA | Panel type code (internal) |
| `external_panel_type` | 1 | ML | NEEDS-DATA | Panel type code (external) |
| `is_glass_fix_bespoke_bead` | 1 | price | NEEDS-DATA | Bespoke glazing bead (sort 315 Glazing Bar) |
| `is_bolection_moulding_around_panel_internally` | 1 | price | NEEDS-DATA | Internal bolection moulding |
| `is_bolection_moulding_around_panel_externally` | 1 | price | NEEDS-DATA | External bolection moulding |

### Boolean flags — Other install

| Variable | Rules | Families | Status | Definition |
|---|---|---|---|---|
| `is_installation_level_test_1` | 1 | IL | UNKNOWN | ⚠ Building site install level flag |
| `is_our_mobile_tower_required` | 1 | IL | NEEDS-DATA | Scaffold tower required |
| `has_lining` | 1 | IL | NEEDS-DATA | Window has linings |
| `has_deep_window_board` | 1 | IL | NEEDS-DATA | Deep window board present |
| `has_panelling` | 1 | IL | NEEDS-DATA | Panelling present |
| `has_shutter_boxes` | 1 | IL | NEEDS-DATA | Shutter boxes present |
| `has_vertical_sliding_secondary_glazing` | 2 | IL | NEEDS-DATA | Vertical SDG |
| `has_horizontal_sliding_secondary_glazing` | 2 | IL | NEEDS-DATA | Horizontal SDG |
| `has_fixed_secondary_glazing` | 2 | IL | NEEDS-DATA | Fixed SDG |
| `has_plantation_shutters` | 1 | IL | NEEDS-DATA | Plantation shutters present |
| `remove_and_refit_existing_sdg_or_panel` | 6 | IL | NEEDS-DATA | Remove and refit flag |
| `remove_and_dispose_existing_sdg_or_panel` | 3 | IL | NEEDS-DATA | Remove and dispose flag |
| `fit_to_prepared_opening` | 1 | IL | NEEDS-DATA | Frame fits to prepared opening |
| `cut_back_plaster` | 1 | IL | NEEDS-DATA | Plaster cut-back required |
| `cut_out_brick_reveal` | 1 | IL | NEEDS-DATA | Brick reveal cut-out required |
| `is_floor_set_as_first_floor` | 1 | IL | EXISTS (`is_first_floor`) | First floor |
| `is_floor_set_as_second_floor` | 1 | IL | EXISTS (`is_second_floor`) | Second floor |
| `is_floor_set_as_third_floor` | 2 | IL | EXISTS (`is_third_floor`) | Third floor |
| `is_floor_set_as_fourth_floor` | 2 | IL | NEEDS-DATA | Fourth floor |
| `is_floor_set_as_fifth_floor` | 3 | IL | NEEDS-DATA | Fifth floor |
| `is_floor_set_as_half_landing` | 1 | IL | NEEDS-DATA | Half-landing floor |

### Count variables

| Variable | Rules | Families | Status | Definition |
|---|---|---|---|---|
| `new_sliding_sash_qty` | 18 | ML, IL | NEW-derivable | Count of new sliding sashes |
| `new_casement_sash_qty` | 8 | ML, IL | NEW-derivable | Count of new casement sashes |
| `new_door_leaf_qty` | 7 | ML, IL | NEW-derivable | Count of new door leaves |
| `new_frame_qty` | 14 | ML, IL | NEW-derivable | Count of new frames |
| `frame_mullion_qty` | 11 | ML, IL | NEW-derivable | Count of frame mullions |
| `frame_transom_qty` | 6 | ML, IL | NEW-derivable | New frame transoms |
| `frame_qty` | 8 | ML, IL | NEW-derivable | Total frames |
| `door_leaf_qty` | 15 | ML, IL | NEW-derivable | Total door leaves |
| `casement_sash_qty` | 7 | ML, IL | NEW-derivable | Total casement sashes |
| `sliding_sash_qty` | 7 | IL, price | NEW-derivable | Total sliding sashes |
| `sliding_pair_qty` | 1 | IL | NEW-derivable | Pairs of sliding sashes |
| `fixed_sliding_sash_qty` | 3 | IL, price | NEW-derivable | Fixed (non-opening) sliding sashes |
| `new_sash_qty` | 2 | ML | NEW-derivable | All new sashes (any type) |
| `new_cill_qty` | 2 | IL, price | NEEDS-DATA | New cills ordered |
| `gb_to_be_replaced_qty` | 12 | ML, IL | NEW-derivable | Glazing bars to replace |
| `gb_cruciform_joint_to_be_replaced_qty` | 1 | ML | UNKNOWN | Cruciform glazing bar joints |
| `sash_muntin_to_be_replaced_qty` | 7 | ML | NEW-derivable | Real glazing bar muntins |
| `unit_gb_qty` | 3 | ML, price | NEW-derivable | Glazing bars per glass unit |
| `gb_qty` | 2 | IL | NEW-derivable | Total glazing bars |
| `fill_repair_qty` | 1 | IL | NEEDS-DATA | Fill repair count |
| `splice_repair_qty` | 1 | IL | NEEDS-DATA | Splice repair count |
| `resin_repair_qty` | 1 | IL | NEEDS-DATA | Resin repair count |
| `replace_pocket_cover_qty` | 1 | IL | NEEDS-DATA | Pocket cover replacements |
| `hoarg_qty` | 1 | IL | NEEDS-DATA | HOARG count |
| `big_hoarg_qty` | 1 | IL | NEEDS-DATA | Big HOARG count |
| `direct_glazed_unit_qty` | 7 | ML, IL | NEW-derivable | Direct-glazed units |
| `opening_in_casement_sash_qty` | 1 | ML | NEW-derivable | Inward-opening casement sashes |
| `opening_in_door_leaf_qty` | 1 | ML | NEW-derivable | Inward-opening door leaves |
| `opening_out_casement_sash_qty` | 1 | ML | NEW-derivable | Outward-opening casement sashes |
| `opening_out_door_leaf_qty` | 1 | ML | NEW-derivable | Outward-opening door leaves |
| `new_opening_casement_sash_qty` | 3 | IL | NEW-derivable | New opening casement sashes |
| `fixed_casement_sash_qty` | 3 | IL | NEW-derivable | Fixed casement sashes |
| `new_french_door_pair_qty` | 1 | IL | NEW-derivable | French door pairs |
| `fixed_door_leaf_qty` | 1 | IL | NEW-derivable | Fixed door leaves |
| `new_stable_door_pair_qty` | 1 | IL | NEEDS-DATA | New stable door pairs |
| `nj_item_qty` | 9 | price | UNKNOWN | NJ items at quote level |
| `bi_fold_door_leaf_qty` | 4 | ML, IL | UNKNOWN | ⚠ Bifold door leaves (likely excluded) |
| `full_length_frame_mullion_qty` | 5 | price | NEW-derivable | Full-height frame mullions |
| `panel_qty` | 1 | price | NEW-derivable | Panels in item |
| `panel_in_frame_qty` | 1 | ML | NEW-derivable | Panels in frame loop |
| `poa_cost` | 1 | price | NEEDS-DATA | POA drawing cost value |

### Dimension / measurement variables

| Variable | Rules | Families | Status | Definition |
|---|---|---|---|---|
| `horn_length_in_mm` | 2 | ML | NEEDS-DATA | Custom horn length (mm) |
| `frame_height_in_mm` | 6 | price | EXISTS (`frame_height` × 1000) | Frame height in mm |
| `frame_width_in_mm` | 6 | price | EXISTS (`frame_width` × 1000) | Frame width in mm |
| `frame_depth_in_mm` | 3 | price | NEEDS-DATA | Frame depth (timber section depth) |
| `gross_sash_height_in_mm` | 2 | price | NEW-derivable | Overall sash height inc. rails |
| `gross_sash_width_in_mm` | 2 | price | EXISTS (`sash_width`) | Sash width in mm |
| `cill_length_in_mm` | 1 | price | NEW-derivable | Cill length in mm |
| `cill_profiled_height_in_mm` | 1 | price | NEEDS-DATA | Cill profile height |
| `tallest_external_frame_height` | 6 | IL | NEEDS-DATA | Tallest frame height in the item (m) |
| `overall_frame_width` | 2 | IL | NEW-derivable | Overall frame width (m) |
| `weight_in_kg` | 4 | IL | NEW-derivable | Part weight (kg) |
| `internal_frame_head_plant_on_in_mm` | 1 | ML | NEEDS-DATA | Internal frame head plant-on depth |
| `external_frame_head_plant_on_in_mm` | 2 | ML, price | NEEDS-DATA | External frame head plant-on depth |
| `left_jamb_plant_on_in_mm` | 1 | price | NEEDS-DATA | Left jamb plant-on depth |
| `right_jamb_plant_on_in_mm` | 1 | price | NEEDS-DATA | Right jamb plant-on depth |
| `sash_sightline_width_in_mm` | 1 | price | NEW-derivable | Glass sightline width |
| `sash_sightline_height_in_mm` | 1 | price | NEW-derivable | Glass sightline height |
| `frame_area` | 1 | price | EXISTS (`frame_area_m2`) | Frame area (m²) |
| `visible_width_in_mm_old` | 2 | price | NEEDS-DATA | Panel visible width (old system field) |
| `visible_height_in_mm_old` | 2 | price | NEEDS-DATA | Panel visible height (old system field) |
| `width` | 1 | price | EXISTS (`frame_width`) | Frame/part width |
| `height` | 1 | price | EXISTS (`frame_height`) | Frame/part height |
| `glass_to_be_replaced_actual_area` | 2 | IL | NEW-derivable | Area of glass being replaced |
| `rounded_area` | 6 | price | NEW-derivable | Glass unit area, rounded |
| `actual_area` | 5 | IL, price | NEW-derivable | Glass unit actual area (m²) |
| `internal_spacer_length` | 1 | price | NEW-derivable | Glazing bar spacer total length |

### Volume variables

| Variable | Rules | Families | Status | Definition |
|---|---|---|---|---|
| `volume` | 2 | ML, price | NEW-derivable | Part timber volume (m³) |
| `frame_excl_cill_volume` | 2 | price | EXISTS (`frame_excl_cill_volume_m3`) | Frame volume excl. cill |
| `cill_volume` | 1 | price | EXISTS (`cill_volume_m3`) | Cill volume |
| `accoya_volume` | 1 | price | NEW-derivable | Accoya timber volume |
| `solid_redwood_volume` | 1 | price | NEW-derivable | Solid redwood volume |
| `solid_redwood_frame_excl_cill_volume` | 1 | price | NEW-derivable | Redwood frame volume excl. cill |
| `solid_utile_hardwood_cill_volume` | 1 | price | NEW-derivable | Utile cill volume |

### Labour time variables

| Variable | Rules | Families | Status | Definition |
|---|---|---|---|---|
| `std_labour_time` | 1 | price | NEW-derivable | Total manufacture minutes from ML pass |
| `installation_labour_time` | 1 | price | NEW-derivable | Total install minutes from IL pass |

### Glass cost variables

| Variable | Rules | Families | Status | Definition |
|---|---|---|---|---|
| `single_pane_cost` | 3 | price | NEEDS-DATA | Cost per m² for single-pane glass |
| `inner_pane_cost` | 2 | price | NEEDS-DATA | Cost per m² for inner pane |
| `outer_pane_cost` | 2 | price | NEEDS-DATA | Cost per m² for outer pane |
| `inner_pane_thickness` | 3 | price | NEEDS-DATA | Inner pane thickness (mm) |
| `outer_pane_thickness` | 1 | price | NEEDS-DATA | Outer pane thickness (mm) |
| `single_pane_thickness` | 1 | ML | NEEDS-DATA | Single pane thickness (mm) |
| `glass_unit_thickness` | 3 | price | NEW-derivable | Overall IGU thickness |
| `is_single_pane_special` | 1 | ML | NEEDS-DATA | Single pane is special glass |
| `is_inner_pane_special` | 1 | ML | NEEDS-DATA | Inner pane is special glass |
| `is_outer_pane_special` | 1 | ML | NEEDS-DATA | Outer pane is special glass |

### Component / ironmongery variables (loop-level)

| Variable | Rules | Families | Status | Definition |
|---|---|---|---|---|
| `cost` | 2 | price | NEEDS-DATA | Component unit cost |
| `length` | 1 | price | NEEDS-DATA | Component length |
| `qty` | 1 | price | EXISTS | Component quantity |
| `part_no` | 1 | IL | NEEDS-DATA | Component part number |
| `part_name` | 1 | price | NEEDS-DATA | Part name (used in `contains()` rule) |
| `purchase_cost` | 1 | price | NEEDS-DATA | Part purchase cost |
| `length_in_m` | 1 | price | NEEDS-DATA | Part length in metres |
| `frame_muntin_to_be_replaced_length` | 1 | price | UNKNOWN | Frame muntin total length |

### Misc / quote-level variables

| Variable | Rules | Families | Status | Definition |
|---|---|---|---|---|
| `items_net_value` | 9 | price | NEW-derivable | Total net value of all items in quote |
| `new_sash_qty` | 2 | ML | NEW-derivable | All new sashes (any type) |
| `external_lining` | 1 | IL | NEEDS-DATA | External lining part code (= AA03 per export) |
| `frame_muntin_qty` | 1 | IL | UNKNOWN | Possibly same as `frame_mullion_qty` |
| `frame_excl_cill_volume` | — | — | — | (see Volume above) |

---

## Variable Summary Counts

| Status | Count |
|---|---|
| `EXISTS` (direct or close rename) | ~25 |
| `NEW-derivable` (computable from tree) | ~55 |
| `NEEDS-DATA` (requires new input / external source) | ~45 |
| `UNKNOWN` (needs domain clarification) | ~20 |
| **Total distinct variables** | **~145** |

---

## Notes

1. **Integrate vs GlazePro naming**: Many Integrate variables use abbreviated names (`is_sw` vs `is_box_sash`, `frame_area` vs `frame_area_m2`). A translation map will be needed in `computeVariables.js`.

2. **Quote-level variables** (`items_net_value`, `nj_item_qty`): These are only available after all drawing-level pricing passes complete. They live in `quote_pricing_runs`, not `pricing_runs`.

3. **`contains()` function** (sort 400, manufacture_materials): Integrate-specific. Cannot be translated to a simple expression. The rule must be rewritten manually once the GlazePro part catalogue is established.

4. **Negative minutes** (install sort 0 "Prepared Opening" and sort 200 "Building Site Install"): Both have value `1 - 61` or `1-61` suggesting −60 minutes (a time saving). The evaluator must handle negative results from the minutes column.

5. **Sapele references** (manufacture_materials sorts 100, 105, 110, 115, 121): Comments reference Sapele as the material but the rule logic uses `is_solid_utile_hardwood_*`. These rules are flagged `needs_review` — verify whether the pricing should use utile rates or be removed.
