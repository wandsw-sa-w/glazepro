-- DO NOT RUN DIRECTLY — paste into Supabase SQL editor and review before executing.
--
-- Migration: 20260928_pricing_import_integrate.sql
-- Purpose:   Import Integrate PF30 pricing rules into price_rules table
--
-- Rule counts:
--   manufacture_labour : 114 rules
--   install_labour     :  85 rules
--   price              :  67 rules
--   TOTAL              : 266 rules
--
-- Variables inserted  :  13
-- needs_review count  :  15
--

BEGIN;

-- ============================================================
-- SCHEMA ADDITIONS
-- ============================================================

ALTER TABLE price_files ADD COLUMN IF NOT EXISTS name text;

ALTER TABLE price_rules
  ADD COLUMN IF NOT EXISTS category      text,
  ADD COLUMN IF NOT EXISTS imported_from text,
  ADD COLUMN IF NOT EXISTS needs_review  boolean not null default false,
  ADD COLUMN IF NOT EXISTS raw_condition text,
  ADD COLUMN IF NOT EXISTS raw_qty       text;

-- Item-level rules have no part scope (Integrate: blank loop = once per item)
ALTER TABLE price_rules ALTER COLUMN loop_target DROP NOT NULL;
ALTER TABLE price_rules ALTER COLUMN loop_target DROP DEFAULT;

-- Allow Integrate's allocated_section_part scope (NULL = item level)
ALTER TABLE price_rules DROP CONSTRAINT IF EXISTS price_rules_loop_target_check;
ALTER TABLE price_rules ADD CONSTRAINT price_rules_loop_target_check CHECK (
  loop_target IS NULL OR loop_target IN (
    'frame','sash','sliding_sash','casement_sash','door_leaf','direct_glazed_unit',
    'panel','ironmongery_part','component','glass_unit','drawing_poa','allocated_section_part'
  )
);

CREATE TABLE IF NOT EXISTS price_file_variables (
  id            bigint generated always as identity primary key,
  price_file_id uuid   not null references price_files(id) on delete cascade,
  name          text not null,
  value_numeric numeric,
  value_text    text,
  comment       text,
  unique (price_file_id, name)
);

-- ============================================================
-- DO BLOCK: price file, variables, and all 266 rules
-- ============================================================

DO $$
DECLARE
  _pf_id uuid;
BEGIN

  INSERT INTO price_files (name, status)
  VALUES ('Integrate PF30 (Draft Import)', 'draft')
  RETURNING id INTO _pf_id;

  -- 13 price file variables
  INSERT INTO price_file_variables (price_file_id, name, value_numeric, value_text, comment) VALUES
    (_pf_id, 'accoya_cubic_meter',         4.65,   null,       'PF30 variable'),
    (_pf_id, 'decoration_labour_hourly',   42.50,  null,       'PF30 variable'),
    (_pf_id, 'douglas_fir_cubic_meter',    2.05,   null,       'PF30 variable'),
    (_pf_id, 'idigbo_cubic_meter',         3.50,   null,       'PF30 variable'),
    (_pf_id, 'installation_labour_hourly', 40.21,  null,       'PF30 variable'),
    (_pf_id, 'meranti_cubic_meter',        3.54,   null,       'PF30 variable'),
    (_pf_id, 'oak_cubic_meter',            7.00,   null,       'PF30 variable'),
    (_pf_id, 'softwood_cubic_meter',       1.25,   null,       'PF30 variable'),
    (_pf_id, 'special_glass',              null,   'GL100045', 'PF30 variable'),
    (_pf_id, 'utile',                      null,   'utile',    'PF30 variable'),
    (_pf_id, 'utile_cubic_meter',          3.54,   null,       'PF30 variable'),
    (_pf_id, 'workshop_hourly_additional', 24.66,  null,       'PF30 variable'),
    (_pf_id, 'workshop_hourly_rate',       15.00,  null,       'Labour editor variable');


  -- ============================================================
  -- MANUFACTURE LABOUR rules (114 rules)
  -- ============================================================
  INSERT INTO price_rules (
    price_file_id, rule_family, is_active, imported_from, output_unit, level,
    sort_order, group_name, category, loop_target, name,
    condition, quantity, value, markup, comment, needs_review, raw_condition, raw_qty
  ) VALUES
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',10,'Machine Shop','Sliding Sash',null,'Pair of Sashes','new_sliding_sash_qty >= 2','new_sliding_sash_qty','110',null,'240 minutes to machine a pair of sashes',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',10,'Machine Shop',null,null,'Sash Window with Fanlight','nj_involved and new_sliding_sash_qty >= 1 and new_casement_sash_qty >= 1 and frame_to_be_replaced','900','1',null,'15 hours for a fanlight above a sash window',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',15,'Machine Shop','Sliding Sash',null,'Single Sash','new_sliding_sash_qty == 1','new_sliding_sash_qty','160',null,'160 minutes to machine a single sash',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',20,'Machine Shop',null,null,'1st Applied glazing bar','gb_to_be_replaced_qty > 0 and not is_individual_panes and not is_door and not is_casement_window and not is_casement_window_bay','1','40',null,'40 minutes for the first applied glazing bar',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',25,'Machine Shop',null,null,'Subsequent Applied glazing bars','gb_to_be_replaced_qty > 1 and not is_individual_panes and not is_door and not is_casement_window and not is_casement_window_bay','gb_to_be_replaced_qty - 2','25',null,'25 minutes for subsequent glazing bars',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',30,'Machine Shop',null,null,'1st Real glazing bar','sash_muntin_to_be_replaced_qty > 0 and is_sw','1','60',null,'60 minutes for the first real dividing bar',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',30,'Machine Shop',null,null,'Subsequent Real glazing bars','sash_muntin_to_be_replaced_qty >= 2 and is_sw','sash_muntin_to_be_replaced_qty - 1','60',null,'60 minutes for subsequent real dividing bars',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',40,'Machine Shop','Sliding Sash','sliding_sash','Sash Swept Head','to_be_replaced and is_square_top_with_arched_sightline','1','600',null,'600 minutes for a swept head',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',50,'Machine Shop','Sliding Sash','sliding_sash','Sash Curved Top Rail','is_curved_head_sash','1','860',null,'860 minutes for a curved head',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',60,'Machine Shop','Sliding Sash','sliding_sash','Non-Std Horn 75mm','has_custom_horn_horn and horn_length_in_mm == 75','1','30',null,'30 minutes for a 75mm non-standard horn',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',70,'Machine Shop','Sliding Sash','sliding_sash','Non-Std Horn Non-75mm','has_custom_horn_horn and not (horn_length_in_mm == 75)','1','90',null,'90 minutes for a non-75mm non-standard horn',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',80,'Machine Shop','Sliding Sash',null,'Box Frame','is_sw and nj_involved','new_frame_qty + frame_mullion_qty','240',null,'240 minutes per box frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',82,'Machine Shop','Sliding Sash',null,'Box Frame','frame_to_be_replaced and new_sliding_sash_qty >= 1 and new_casement_sash_qty >= 1','new_frame_qty + frame_mullion_qty','360',null,'360 minutes per box frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',90,'Machine Shop','Sliding Sash','frame','Curved outside lining','is_sw and has_curved_outer_head','1','300',null,'180 minutes per arched outer jamb',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',100,'Machine Shop','Sliding Sash','frame','Curved sash head','is_sw and has_curved_inner_head','1','300',null,'180 minutes per arched inner jamb',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',105,'Machine Shop',null,null,'Heritage Units Glazing Bars','is_individual_panes','gb_to_be_replaced_qty','25',null,'25 minutes to machine each glazing bar for single or heritage units',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',240,'Machine Shop','Frame',null,'Frame with Doors/Casements and Direct Glazed','(direct_glazed_unit_qty >= 1 and new_casement_sash_qty >= 1) or (direct_glazed_unit_qty >= 1 and new_door_leaf_qty >= 1)','1','75',null,'75 minutes additional machining if both direct glazed and openers',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',245,'Machine Shop','Frame',null,'Frame with inward opening and outward opening','(opening_in_casement_sash_qty + opening_in_door_leaf_qty) >= 1 and (opening_out_casement_sash_qty + opening_out_door_leaf_qty) >= 1','1','300',null,'300 minutes additional if both inward and outward opening items in a frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',500,'Machine Shop',null,'frame','Raked Frame','is_raked and to_be_replaced','1','360',null,'3 hours for a raked frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1000,'Machine Shop','Casement Sash','casement_sash','Machining & Joining a Casement Sash','to_be_replaced and not is_item_a_door','1','180',null,'2.5 hours to manufacture a casement sash',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1005,'Machine Shop','Casement Sash','casement_sash','Additional for Glazing Bars','gb_to_be_replaced_qty >= 1','1','30',null,'0.5 hours additional for any glazing bars in a casement sash',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1010,'Machine Shop','Casement Sash','casement_sash','Additional for Swept Head','to_be_replaced and is_square_top_with_arched_sightline','1','240',null,'4 hours for a swept head casement sash',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1015,'Machine Shop','Casement Sash','casement_sash','Additional for Curved Head','to_be_replaced and is_curved_head_sash','1','360',null,'6 hours for a curved head casement sash',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1025,'Machine Shop','Casement Sash',null,'Additional for Bespoke Beads to Casement Bay','is_all_glass_fix_bespoke_bead and is_casement_window_bay','1','90',null,'1.5 hours to machine bespoke beads for a casement bay',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1035,'Machine Shop','Casement Sash',null,'Additional for Bespoke Bars to Casement Bay','is_all_glass_fix_bespoke_bead and is_casement_window_bay','1','90',null,'1.5 hours to machine bespoke bars for a casement window',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1040,'Machine Shop','Casement Sash','casement_sash','Additional for Raked Casement Sash','is_raked','1','360',null,'6 hours additional for a raked casement sash',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1100,'Machine Shop','Frame','frame','Machining & Joining a Casement Frame','to_be_replaced and door_leaf_qty < 1 and not is_sw','1','180',null,'2.5 hours to manufacture a casement frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1103,'Machine Shop','Frame','frame','Extra over for direct glazed','to_be_replaced and door_leaf_qty < 1 and casement_sash_qty < 1 and not is_sw','1','180',null,'2.5 hours additional to manufacture a direct glazed frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1105,'Machine Shop','Frame','frame','Additional for Frame Mullion or Transom','to_be_replaced and not is_sw','frame_mullion_qty + frame_transom_qty','180',null,'2.5 hours for each casement frame transom or mullion',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1110,'Machine Shop','Frame','frame','Additional Frame Swept Head','has_curved_inner_head and door_leaf_qty < 1 and not is_sw','1','240',null,'4 hours for a swept head on a casement frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1115,'Machine Shop','Frame','frame','Additional Frame Curved Head','has_curved_outer_head and door_leaf_qty < 1 and not is_sw','1','240',null,'4 hours for a swept head on a casement frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1120,'Machine Shop','Frame',null,'Additional for Frame in Kit Form for Casement Windows','is_casement_window and is_frame_in_kit_form and frame_to_be_replaced','1','240',null,'4 hours to disassemble a casement frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1125,'Machine Shop','Frame','frame','Additional for Frame in Kit Form for Casement Windows (Raked)','to_be_replaced and is_raked and door_leaf_qty < 1 and not is_sw','1','360',null,'6 hours for a raked casement frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1130,'Machine Shop','Frame','frame','Additional for Frame Head Plant On','internal_frame_head_plant_on_in_mm >= 1 or external_frame_head_plant_on_in_mm >= 1','1','60',null,'1 hour to prepare a frame head plant on',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1135,'Machine Shop','Frame',null,'Additional for Bay Poles','is_bay_pole_required and is_casement_window_bay','new_frame_qty','90',null,'1.5 hours to machine each bay pole',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1140,'Machine Shop','Frame',null,'Additional for Coupled in Workshop','is_casement_window_bay and is_bay_with_fully_coupled_frames','1','480',null,'8 hours extra for a fully coupled frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1200,'Machine Shop','Door Leaf','door_leaf','Door Leaf','to_be_replaced','1','1035',null,'17.25 hours to machine a door leaf',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1201,'Machine Shop','Casement Sash','casement_sash','Sidelights in Doorsets','to_be_replaced and is_item_a_door and not is_fanlight','1','780',null,'13 hours to machine a sidelight',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1202,'Machine Shop','Casement Sash','casement_sash','Fanlights in Doorsets','to_be_replaced and is_item_a_door and is_fanlight','1','300',null,'5 hours to machine a fanlight',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1205,'Machine Shop','Door Leaf','door_leaf','Additional for Swept Head (Door)','to_be_replaced and is_square_top_with_arched_sightline','1','240',null,'4 hours additional for swept head',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1210,'Machine Shop','Door Leaf','door_leaf','Additional for Curved Head (Door)','to_be_replaced and is_curved_head_sash','1','360',null,'6 hours additional for swept head',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1215,'Machine Shop','Door Leaf','door_leaf','Additional for Glazing Bars (Door)','gb_to_be_replaced_qty >= 1','1','30',null,'0.5 hours additional for any glazing bars in a door leaf',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1220,'Machine Shop','Door Leaf',null,'Additional for Bespoke Beads to Door Leaf','is_all_glass_fix_bespoke_bead and door_leaf_qty >= 1','1','90',null,'1.5 hours to machine bespoke beads for a doorset',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1225,'Machine Shop','Door Leaf',null,'Additional for Bespoke Bars to Door Leaf','is_all_glass_fix_bespoke_bead and door_leaf_qty >= 1','1','90',null,'1.5 hours to machine bespoke bars for a door leaf',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1230,'Machine Shop','Door Leaf','door_leaf','Additional for Raked Door Leaf','is_raked','1','360',null,'6 hours additional for a raked door leaf',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1235,'Machine Shop','Door Leaf',null,'Door Muntin','new_door_leaf_qty >= 1','sash_muntin_to_be_replaced_qty','60',null,'60 minutes per door muntin',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1240,'Machine Shop','Door Leaf','panel','Additional for Flat Panel','to_be_replaced and is_flat_panel_internally','1','60',null,'1 hour per flat panel',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1245,'Machine Shop','Door Leaf','panel','Additional for R&F Panel','to_be_replaced and is_raised_and_fielded_panel_internally','1','120',null,'2 hours per R&F panel',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1250,'Machine Shop','Door Leaf','panel','Additional VTG Panel','to_be_replaced and is_vertical_tongue_and_groove_panel_internally','1','180',null,'3 hours per VTG panel',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1255,'Machine Shop','Door Leaf','panel','Additional HTG Panel','to_be_replaced and is_horizontal_tongue_and_groove_panel_internally','1','180',null,'3 hours per HTG panel',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1260,'Machine Shop','Door Leaf','panel','Additional for Dual Panel','to_be_replaced and not (internal_panel_type == external_panel_type)','1','180',null,'180 minutes per dual panel',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1300,'Machine Shop','Frame','frame','Machining & Joining a Door Frame','to_be_replaced and door_leaf_qty >= 1 and not is_sw','1','855',null,'14.25 hours to manufacture a door frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1303,'Machine Shop','Frame','frame','Machining & Joining a Bifolding Frame Additional','to_be_replaced and bi_fold_door_leaf_qty >= 1 and not is_sw','1','600',null,'10 additional hours to manufacture a bifolding doorset. REVIEW: bifold likely excluded product.',true,'[to_be_replaced] && [bi_fold_door_leaf_qty] >= 1 && ![is_sw]',null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1305,'Machine Shop','Frame','frame','Additional Frame Swept Head (Door)','has_curved_inner_head and door_leaf_qty >= 1 and not is_sw','1','240',null,'4 hours for a swept head on a door frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1310,'Machine Shop','Frame','frame','Additional Frame Curved Head (Door)','has_curved_outer_head and door_leaf_qty >= 1 and not is_sw','1','240',null,'4 hours for a swept head on a door frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',1315,'Machine Shop','Frame',null,'Additional for Frame in Kit Form for Doors','is_frame_in_kit_form and frame_to_be_replaced and is_door','1','240',null,'4 hours to disassemble a door frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',30,'Joinery Shop','Sliding Sash','sliding_sash','Pair of Sashes (Joinery)','to_be_replaced','1','70',null,'70 minutes to join a sash',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',31,'Joinery Shop','Sliding Sash','sliding_sash','Pair of Sashes (Single Glazed)','to_be_replaced and is_single_glazed','1','40',null,'40 additional minutes for a single glazed sash',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',35,'Joinery Shop','Sliding Sash',null,'First Glazing Bar (Joinery)','gb_to_be_replaced_qty > 0 and not is_individual_panes and not is_door and not is_casement_window and not is_casement_window_bay','1','25',null,'25 minutes for the first glazing bar',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',40,'Joinery Shop','Sliding Sash',null,'Subsequent Glazing Bar (Joinery)','gb_to_be_replaced_qty > 1 and not is_individual_panes and not is_door and not is_casement_window and not is_casement_window_bay','gb_to_be_replaced_qty - 1','20',null,'20 minutes for subsequent glazing bars',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',41,'Joinery Shop','Sliding Sash',null,'Additional for Cruciform','gb_to_be_replaced_qty > 1','gb_cruciform_joint_to_be_replaced_qty','15',null,'15 minutes per cruciform. NOTE: inactive in Integrate source.',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',45,'Joinery Shop','Sliding Sash',null,'First Real Glazing Bar (Joinery)','sash_muntin_to_be_replaced_qty > 0 and not is_door','1','90',null,'90 minutes for first real dividing bars',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',50,'Joinery Shop','Sliding Sash',null,'Subsequent Rear Glazing Bar','sash_muntin_to_be_replaced_qty > 1 and not is_door','sash_muntin_to_be_replaced_qty - 1','60',null,'60 minutes for subsequent real dividing bars',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',55,'Joinery Shop','Sliding Sash',null,'Heritage Units Glazing Bars (Joinery)','is_individual_panes','gb_to_be_replaced_qty','25',null,'25 minutes to join each glazing bar for single or heritage units',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',60,'Joinery Shop','Sliding Sash','sliding_sash','Swept Head (Joinery)','is_square_top_with_arched_sightline and to_be_replaced','1','120',null,'120 minutes in joinery shop for swept head',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',65,'Joinery Shop','Sliding Sash','sliding_sash','Curved Head (Joinery) — 1680 min','is_curved_head_sash','1','1680',null,'REVIEW: DUPLICATE sort=65 Curved Head — two rules exist with minutes=1680 and minutes=3360. Verify which is correct.',true,'[is_curved_head_sash]',null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',65,'Joinery Shop','Sliding Sash','sliding_sash','Curved Head (Joinery) — 3360 min','is_curved_head_sash','1','3360',null,'REVIEW: DUPLICATE sort=65 Curved Head — two rules exist with minutes=1680 and minutes=3360. Likely 3360 for curved head box frame (7 days).',true,'[is_curved_head_sash]',null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',70,'Joinery Shop','Sliding Sash','frame','Box Frame Joining','new_sliding_sash_qty >= 1 and to_be_replaced','frame_mullion_qty + 1','150',null,'150 minutes to join a box frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',75,'Joinery Shop','Sliding Sash','frame','Box Frame Joining with Swept Head','is_sw and to_be_replaced and has_curved_inner_head','frame_mullion_qty + 1','30',null,'30 minutes additional for each curved head',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',80,'Joinery Shop','Sliding Sash','frame','Box Frame Joining with Swept Head (Outer)','is_sw and to_be_replaced and has_arched_outer_jamb','frame_mullion_qty + 1','50',null,'50 minutes additional for each swept head',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',81,'Joinery Shop','Sliding Sash',null,'Yorkshire Sash Frame','is_yorkshire_sash_window','1','360',null,'REVIEW: Yorkshire sash likely excluded product.',true,'[is_yorkshire_sash_window]',null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',90,'Joinery Shop','Sliding Sash','sliding_sash','Accoya Sash (Joinery)','to_be_replaced and is_accoya_sash','1','20',null,'20 minutes for each accoya sash',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',95,'Joinery Shop','Sliding Sash','sliding_sash','Accoya Sash Bar (Joinery)','to_be_replaced and is_accoya_sash','gb_to_be_replaced_qty','10',null,'10 minutes for each accoya bar',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',600,'Joinery Shop',null,null,'Sash and Casement Frame','new_sliding_sash_qty >= 1 and frame_to_be_replaced and new_casement_sash_qty >= 1','1','400',null,'400 minutes for a combination window',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',20,'Glass Manufacture',null,'glass_unit','Special Glass','(not (single_pane_thickness == 7.7) and is_single_pane_special) or is_inner_pane_special or is_outer_pane_special','10','1',null,'10 minutes for special glass',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',30,'Glass Manufacture',null,'glass_unit','Glazing a Sash','to_be_replaced and not is_heritage_range and not is_bi_glass','20','1',null,'20 minutes per unit to be glazed',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',35,'Glass Manufacture',null,'glass_unit','Glazing with Bar','to_be_replaced','unit_gb_qty','12',null,'12 minutes per glazing bar',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',10,'Finishing','Sliding Sash',null,'PoS - White Standard','is_same_finish_internally_and_externally and is_sw and nj_involved','1','90',null,'90 minutes for single finish on the first pair',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',11,'Finishing','Sliding Sash',null,'PoS - White Standard Subs','is_same_finish_internally_and_externally and is_sw and nj_involved','new_sliding_sash_qty - 2','20',null,'20 minutes for single finish',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',20,'Finishing','Sliding Sash',null,'PoS - Dual Special Finish','is_sw and not is_same_finish_internally_and_externally','1','135',null,'135 minutes for a dual special finish on the first pair',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',21,'Finishing','Sliding Sash',null,'PoS - Dual Special Finish Subs','is_sw and not is_same_finish_internally_and_externally','new_sliding_sash_qty - 2','40',null,'30 minutes for a dual special finish per sash subs',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',30,'Finishing','Sliding Sash',null,'Box - White Standard','is_same_finish_internally_and_externally and is_sw and frame_to_be_replaced','1','120',null,'120 minutes for single finish per box frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',31,'Finishing','Sliding Sash',null,'Box - White Standard Subs','is_same_finish_internally_and_externally and is_sw and frame_to_be_replaced','new_frame_qty + frame_mullion_qty - 1','50',null,'50 minutes for subs box frames',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',40,'Finishing','Sliding Sash',null,'Box - Dual Special Finish','is_sw and frame_to_be_replaced and not is_same_finish_internally_and_externally','1','270',null,'270 minutes for a dual special finish per box frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',41,'Finishing','Sliding Sash',null,'Box - Dual Special Finish Subs','is_sw and frame_to_be_replaced and not is_same_finish_internally_and_externally','(new_frame_qty + frame_mullion_qty) - 1','120',null,'120 minutes for subsequent box frames',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',60,'Finishing','Frame','frame','Box - Stain (Internal Only)','is_varnished_or_stained_internally and not is_varnished_or_stained_externally','1','1200',null,'1200 minutes for one side stain',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',70,'Finishing','Frame','frame','Box - Stain (Both Sides)','is_varnished_or_stained_internally and is_varnished_or_stained_externally and is_sw','1','600',null,'600 minutes for both side stain',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',80,'Finishing','Frame','frame','Box - Stained Cill','is_varnished_cill and is_sw','1','90',null,'90 minutes for a stained cill',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',200,'Finishing','Casement Sash',null,'Casement Sash - Single Finish','is_same_finish_internally_and_externally and not is_varnished_or_stained','new_casement_sash_qty','60',null,'60 minutes per casement sash',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',205,'Finishing','Casement Sash',null,'Casement Sash - Dual Finish','not is_same_finish_internally_and_externally','new_casement_sash_qty','90',null,'90 minutes per casement sash',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',210,'Finishing','Frame',null,'Casement Frame - Single Finish','is_same_finish_internally_and_externally and not is_sw and not is_door and not is_varnished_or_stained','new_frame_qty','90',null,'90 minutes per casement frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',211,'Finishing','Frame',null,'Casement Frame - Single Finish (Mullions)','is_same_finish_internally_and_externally and not is_sw and not is_door','frame_mullion_qty + frame_transom_qty','60',null,'60 minutes per casement transom or mullion',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',215,'Finishing','Frame',null,'Casement or Door Frame - Dual Finish','not is_same_finish_internally_and_externally and not is_sw and not is_door','new_frame_qty','180',null,'180 minutes per casement frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',216,'Finishing','Frame',null,'Casement or Door Frame - Dual Finish (Mullions)','not is_same_finish_internally_and_externally and not is_sw and not is_door','frame_transom_qty + frame_mullion_qty','120',null,'120 minutes per casement transom or mullion',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',225,'Finishing','Frame',null,'Casement Frame - Staining External Only','frame_to_be_replaced and not is_sw and not is_door and is_varnished_or_stained_externally and not is_varnished_or_stained_internally','new_frame_qty','600',null,'600 minutes to stain one side',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',226,'Finishing','Frame',null,'Casement Frame - Staining Internal Only','frame_to_be_replaced and not is_sw and not is_door and not is_varnished_or_stained_externally and is_varnished_or_stained_internally','new_frame_qty','600',null,'600 minutes to stain one side',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',227,'Finishing','Frame',null,'Casement Frame - Staining Both Sides','frame_to_be_replaced and not is_sw and not is_door and is_varnished_or_stained_externally and is_varnished_or_stained_internally','new_frame_qty','600',null,'600 minutes to stain both sides',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',230,'Finishing','Casement Sash',null,'Casement Sash - Staining External Only','is_varnished_or_stained_externally and not is_varnished_or_stained_internally','casement_sash_qty','300',null,'300 minutes to stain a casement sash',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',231,'Finishing','Casement Sash',null,'Casement Sash - Staining Internal Only','not is_varnished_or_stained_externally and is_varnished_or_stained_internally','casement_sash_qty','300',null,'300 minutes to stain a casement sash',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',232,'Finishing','Casement Sash',null,'Casement Sash - Staining Both Sides','is_varnished_or_stained_externally and is_varnished_or_stained_internally','casement_sash_qty','150',null,'150 minutes to stain a casement sash',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',300,'Finishing','Frame',null,'Accoya Frame (Finishing)','is_accoya_frame','new_frame_qty','90',null,'90 minutes additional per frame in accoya',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',305,'Finishing',null,null,'Accoya Sash (Finishing)','is_accoya_sash','new_sash_qty','45',null,'45 minutes additional per sash in accoya',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',310,'Finishing','Frame',null,'Utile Frame (Finishing)','is_solid_utile_hardwood_frame and not is_door','new_frame_qty','60',null,'60 minutes additional per frame in hardwood',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',315,'Finishing',null,null,'Utile Sash (Finishing)','is_solid_utile_hardwood_sash and not is_door','new_sash_qty','20',null,'20 minutes additional per sash in hardwood',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',400,'Finishing',null,'frame','Panel to Frame','true','panel_in_frame_qty','80',null,'80 minutes per panel to frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',500,'Finishing','Frame',null,'Door Frame - Single Finish','is_door and is_same_finish_internally_and_externally and not is_varnished_or_stained','frame_qty','180',null,'180 minutes to paint a door frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',501,'Finishing','Frame',null,'Door Frame - Single Finish (Mullions)','is_door and is_same_finish_internally_and_externally and not is_varnished_or_stained','frame_mullion_qty + frame_transom_qty','85',null,'85 minutes per frame mullion or transom',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',505,'Finishing','Frame',null,'Door Frame - Dual Finish','is_door and not is_same_finish_internally_and_externally','frame_qty','240',null,'240 minutes to paint a door frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',506,'Finishing','Frame',null,'Door Frame - Dual Finish (Mullions)','is_door and not is_same_finish_internally_and_externally','frame_mullion_qty + frame_transom_qty','45',null,'45 minutes per frame mullion or transom',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',510,'Finishing','Frame',null,'Door Frame - Stain Finish','(is_door and is_varnished_or_stained_externally) or (is_door and is_varnished_or_stained_internally)','frame_qty','600',null,'180 minutes to stain a frame',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',511,'Finishing','Frame',null,'Door Frame - Stain Finish (Mullions)','(is_door and is_varnished_or_stained_externally) or is_varnished_or_stained_internally','frame_mullion_qty + frame_transom_qty','60',null,'45 minutes per frame mullion or transom',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',520,'Finishing','Frame',null,'Door Leaf - Single Finish','is_door and is_same_finish_internally_and_externally and not is_varnished_or_stained','door_leaf_qty','90',null,'90 minutes to paint a door leaf',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',520,'Finishing','Frame',null,'Door Leaf - Dual Finish','is_door and not is_same_finish_internally_and_externally','door_leaf_qty','180',null,'180 minutes to paint a door leaf',false,null,null),
  (_pf_id,'manufacture_labour',false,'integrate_pf30','minutes','item',520,'Finishing','Frame',null,'Door Leaf - Stain Finish','is_door and is_varnished_or_stained','door_leaf_qty','300',null,'30 minutes to stain a door leaf',false,null,null);

  -- ============================================================
  -- INSTALL LABOUR rules (85 rules)
  -- ============================================================
  INSERT INTO price_rules (
    price_file_id, rule_family, is_active, imported_from, output_unit, level,
    sort_order, group_name, category, loop_target, name,
    condition, quantity, value, markup, comment, needs_review, raw_condition, raw_qty
  ) VALUES
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',5,'Sash Windows',null,null,'Sash Window with Fanlight (Install)','nj_involved and new_sliding_sash_qty >= 1 and new_casement_sash_qty >= 1 and frame_to_be_replaced','300','1',null,'5 hours for a box frame with fanlight',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',10,'Sash Windows',null,null,'Sash Windows (New Complete)','is_complete_new and is_installation_included and fixed_sliding_sash_qty >= 0','sliding_pair_qty','450',null,'7.5hrs per single box (scales up linearly)',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',20,'Sash Windows',null,null,'New To Existing','not is_complete_new and is_installation_included and new_sash_qty > 1','new_sliding_sash_qty','112.50',null,'1.875hrs per sliding sash (3.75hrs per pair)',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',21,'Sash Windows',null,null,'Single Sash Only','not is_complete_new and is_installation_included and new_sliding_sash_qty == 1','new_sliding_sash_qty','187.50',null,'3.125 hours for a single sash installation',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',30,'Sash Windows',null,null,'Draught Seal','needs_draughtsealing and not is_bi_glass and is_installation_included and new_sliding_sash_qty < sliding_sash_qty','sliding_sash_qty - fixed_sliding_sash_qty','120',null,'2hrs per single sash dso',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',35,'Sash Windows',null,null,'Venetian DSO','is_venetian_sash_window and not nj_involved','1','360',null,'6 hours for a venetian DSO',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',50,'Sash Windows',null,null,'Hardwood Cill Replacement','new_cill_qty >= 1','new_cill_qty','150',null,'2.5 hours for cill replacement',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',13,'Casements',null,null,'Base Casement Frame Replacement','is_complete_new and is_casement_window and is_installation_included','new_frame_qty','480',null,'8hrs per casement frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',14,'Casements',null,null,'Opening Casement Sash with Frame','is_complete_new and (is_casement_window or is_casement_window_bay) and is_installation_included','new_opening_casement_sash_qty','90',null,'1.5hrs per opening casement sash',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',15,'Casements',null,null,'Fixed Casement Sash with Frame','(is_casement_window or is_casement_window_bay) and is_installation_included and frame_to_be_replaced','fixed_casement_sash_qty','60',null,'1hrs per fixed casement sash',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',18,'Casements',null,null,'Casement Window Bay Frame Replacement','is_complete_new and is_casement_window_bay and is_installation_included','new_frame_qty','210',null,'3.5hrs per casement frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',100,'Casements',null,null,'1500 Height Casement Frame Replacement','tallest_external_frame_height > 1.8 and is_complete_new and is_installation_included and is_casement_window','new_frame_qty','60',null,'1hrs additional per large casement frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',101,'Casements',null,null,'2500 Height Casement Frame Replacement','tallest_external_frame_height >= 2.0 and tallest_external_frame_height < 3.0 and is_complete_new and is_installation_included and is_casement_window','new_frame_qty','300',null,'5hrs additional per large casement frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',102,'Casements',null,null,'3000 Height Casement Frame Replacement','tallest_external_frame_height > 3 and is_complete_new and is_installation_included and is_casement_window','new_frame_qty','360',null,'6hrs additional per large casement frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',103,'Casements',null,null,'1500 Height Casement Bay Replacement','tallest_external_frame_height > 1.8 and is_complete_new and is_installation_included and is_casement_window_bay','1','120',null,'2hrs additional per large casement bay',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',104,'Casements',null,null,'2500 Height Casement Bay Replacement','tallest_external_frame_height >= 2.0 and tallest_external_frame_height < 3.0 and is_complete_new and is_installation_included and is_casement_window_bay','1','360',null,'6hrs additional per large casement bay',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',105,'Casements',null,null,'3000 Height Casement Bay Replacement','tallest_external_frame_height > 3 and is_complete_new and is_installation_included and is_casement_window_bay','1','360',null,'6hrs additional per large casement frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',110,'Casements',null,null,'1500 Wide Casement Frame','overall_frame_width >= 1.5 and (is_casement_window or is_casement_window_bay) and is_installation_included and frame_to_be_replaced','new_frame_qty','60',null,'1hrs per oversize frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',111,'Casements',null,null,'2500 Wide Casement Frame','is_casement_window and is_installation_included and frame_to_be_replaced and overall_frame_width >= 2.5','new_frame_qty','180',null,'3hrs per oversize frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',0,'Doors',null,null,'Front Door and Frame (Base)','is_front_door and is_complete_new and is_installation_included','new_frame_qty','840',null,'14hrs for a new front door and frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',1,'Doors',null,null,'Front Door and Frame (Mullion)','is_front_door and is_complete_new and is_installation_included','frame_mullion_qty','120',null,'2 hours for each additional frame mullion',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',2,'Doors',null,null,'Front Door and Frame (Transom)','is_front_door and is_complete_new and is_installation_included','frame_transom_qty','90',null,'1.5 hours for each additional frame transom',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',10,'Doors',null,null,'Single Door Only','not is_front_door and is_complete_new and is_installation_included and door_leaf_qty == 1','door_leaf_qty','660',null,'11hrs for a single door on its own',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',11,'Doors',null,null,'French Doors','not is_front_door and is_complete_new and is_door and door_leaf_qty >= 2 and is_installation_included','new_french_door_pair_qty','780',null,'13hrs per French doorset',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',14,'Doors',null,null,'French Doors (Winglight Frame)','not is_front_door and is_complete_new and is_door and door_leaf_qty >= 2 and is_installation_included and new_frame_qty > 1','new_frame_qty - 1','240',null,'4 hours per winglight frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',50,'Doors',null,null,'Door Direct Glazed Unit','is_complete_new and is_door and is_installation_included','direct_glazed_unit_qty','45',null,'0.75hrs per direct glazed unit',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',51,'Doors',null,null,'Door Opening Casement Sash','is_complete_new and is_door and is_installation_included','new_opening_casement_sash_qty','90',null,'1.5hrs per opening fanlight',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',52,'Doors',null,null,'Fixed Fanlight','is_complete_new and is_door and fixed_casement_sash_qty > 0 and is_installation_included','fixed_casement_sash_qty','120',null,'2hrs per fixed casement sash',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',60,'Doors',null,null,'French Doors Additional Door','is_door and not is_front_door and door_leaf_qty > 2 and is_installation_included','door_leaf_qty - 2','120',null,'2 hours for each additional door',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',100,'Doors',null,null,'Combination Frame','is_door and frame_to_be_replaced and door_leaf_qty > 1 and fixed_door_leaf_qty > 0','1','660',null,'',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',105,'Doors',null,null,'Door Sash Frames','not is_front_door and is_complete_new and new_door_leaf_qty >= 1','new_sliding_sash_qty','450',null,'7.5 hours for a sash frame with door',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',140,'Doors',null,null,'Winglight Frame','is_door_mpls and door_leaf_qty == 1 and frame_qty > 1','1','1',null,'',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',200,'Doors',null,null,'Stable Door','new_stable_door_pair_qty >= 1','new_stable_door_pair_qty','900',null,'',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',0,'Other',null,null,'Frame in kit form','is_frame_in_kit_form','frame_qty','300',null,'Extra 5 hours for frame in kit form',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',0,'Other',null,null,'Cut Back Plaster','cut_back_plaster','new_frame_qty','90',null,'1.5hrs for cut back plaster',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',0,'Other',null,null,'Prepared Opening','fit_to_prepared_opening','fit_to_prepared_opening','1 - 61',null,'REVIEW: value==''1 - 61'' — likely -60 minutes (one hour saving). Verify formula interpretation.',true,null,'1 - 61'),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',10,'Other',null,null,'Cut Out Brick Reveal','cut_out_brick_reveal','new_frame_qty','240',null,'4hrs for cut brick reveal',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',30,'Other',null,null,'HOARG','true','hoarg_qty','90',null,'1.5hrs for a HOARG',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',31,'Other',null,null,'BIG HOARG','true','big_hoarg_qty','30',null,'30 additional minutes for a HOARG',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',40,'Other',null,null,'Remove and Refit Panelling','(has_panelling or has_shutter_boxes) and remove_and_refit_existing_sdg_or_panel','frame_qty','900',null,'15 hours for a fitter to remove and refit panelling and decorate',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',41,'Other',null,null,'Remove and Refit Vertical SDG','remove_and_refit_existing_sdg_or_panel and has_vertical_sliding_secondary_glazing','frame_qty','75',null,'75 minutes to remove and refit SDG',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',42,'Other',null,null,'Remove and Refit Horizontal SDG','remove_and_refit_existing_sdg_or_panel and has_horizontal_sliding_secondary_glazing','frame_qty','75',null,'75 minutes to remove and refit SDG',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',43,'Other',null,null,'Remove and Dispose Horizontal SDG','remove_and_dispose_existing_sdg_or_panel and has_horizontal_sliding_secondary_glazing','frame_qty','35',null,'35 minutes to remove and dispose SDG',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',44,'Other',null,null,'Remove and Dispose Vertical SDG','remove_and_dispose_existing_sdg_or_panel and has_vertical_sliding_secondary_glazing','frame_qty','35',null,'35 minutes to remove and dispose SDG',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',45,'Other',null,null,'Remove and Dispose Fixed SDG','remove_and_dispose_existing_sdg_or_panel and has_fixed_secondary_glazing','frame_qty','35',null,'35 minutes to remove and dispose SDG',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',46,'Other',null,null,'Remove and Refit Fixed SDG','remove_and_refit_existing_sdg_or_panel and has_fixed_secondary_glazing','frame_qty','75',null,'75 minutes to remove and refit SDG',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',47,'Other',null,null,'Remove and Refit Shutters','remove_and_refit_existing_sdg_or_panel and has_plantation_shutters','frame_qty','75',null,'75 minutes to remove and refit shutters',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',60,'Other',null,null,'Fill Repair','true','fill_repair_qty','30',null,'Half hour for a fill repair',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',65,'Other',null,null,'Splice Repair','true','splice_repair_qty','90',null,'1.5 hour for a splice repair',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',70,'Other',null,null,'Resin Repair','true','resin_repair_qty','90',null,'1.5 hour for a resin repair',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',75,'Other',null,null,'Pocket Replacement','true','replace_pocket_cover_qty','90',null,'1.5 hour for a pocket repair',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',90,'Other',null,'sliding_sash','Any Sash Overweight (Sliding)','weight_in_kg > 25 and not is_bi_glass','1','45',null,'For any sash weighing over 25kg, allow an additional 45 minutes',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',95,'Other',null,'casement_sash','Any Sash Overweight (Casement)','weight_in_kg > 25','1','45',null,'For any sash weighing over 25kg, allow an additional 45 minutes',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',100,'Other',null,'door_leaf','Any Door Overweight','weight_in_kg > 50','1','45',null,'For any door weighing over 50kg, allow an additional 45 minutes',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',105,'Other',null,'door_leaf','Any Door Overweight +','weight_in_kg > 75','1','240',null,'For any door weighing over 75kg, allow an additional 240 minutes',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',200,'Other',null,null,'Building Site Install','is_installation_level_test_1','1','1-61',null,'REVIEW: value==''1-61'' — likely -60 minutes (60 minute reduction). Verify formula interpretation.',true,null,'1-61'),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',210,'Other',null,null,'Scaffold Tower','is_our_mobile_tower_required','1','180',null,'',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',220,'Other',null,null,'Third Floor 30 minutes','is_floor_set_as_third_floor','1','60',null,'60 minutes extra for third floor',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',230,'Other',null,null,'Fourth Floor 45 minutes','is_floor_set_as_fourth_floor','1','75',null,'75 minutes extra for fourth floor',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',250,'Other',null,null,'Linings','has_lining','1','180',null,'3 hours to fit linings',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',250,'Other',null,null,'Fifth Floor 60 Minutes','is_floor_set_as_fifth_floor','1','120',null,'120 minutes extra for fifth floor',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',251,'Other',null,null,'Windowboard','has_deep_window_board','1','30',null,'30 mins additional for a window board',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',252,'Other',null,'component','External Lining','part_no == external_lining','1','180',null,'3 hours for external linings',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',260,'Other',null,'frame','Raked Frames (Install)','is_raked','1','240',null,'Additional 4 hours to install a raked frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',270,'Other',null,null,'Fully Coupled Frames','is_bay_with_fully_coupled_frames and frame_to_be_replaced','1','240',null,'Additional 4 hours on site for fully coupled frames',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',280,'Other',null,null,'Fully Coupled Frames above Ground Floor','is_bay_with_fully_coupled_frames and (is_floor_set_as_first_floor or is_floor_set_as_second_floor or is_floor_set_as_third_floor or is_floor_set_as_fourth_floor or is_floor_set_as_fifth_floor or is_floor_set_as_half_landing)','1','240',null,'Additional 4 hours for any fully coupled frames above the ground floor',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',0,'Biglass',null,'glass_unit','BiGlass Labour Base Price','is_bi_glass and to_be_replaced','240','1',null,'4 hours for a single pane biglass',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',1,'Biglass',null,null,'BiGlass GBs to Take Off','is_bi_glass and is_installation_included','gb_qty','60',null,'60 mins for each glazing bar to be removed',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',1,'Direct Glazed',null,null,'Direct Glazed Into Existing','direct_glazed_unit_qty > 0 and not frame_to_be_replaced','120','direct_glazed_unit_qty',null,'2 hours to replace a direct glazed unit into existing frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',2,'Direct Glazed',null,null,'1.75sqm Direct Glazed Into Existing','direct_glazed_unit_qty > 0 and not frame_to_be_replaced and glass_to_be_replaced_actual_area > 1.75','60','direct_glazed_unit_qty',null,'Additional 1 hour for large double glazed unit',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',3,'Direct Glazed',null,null,'2.5sqm Direct Glazed Into Existing','direct_glazed_unit_qty > 0 and not frame_to_be_replaced and glass_to_be_replaced_actual_area > 2.5','120','direct_glazed_unit_qty',null,'2 hours for a large unit replacement',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',10,'Direct Glazed',null,null,'Base Direct Glazed Unit in Frame','frame_to_be_replaced and bi_fold_door_leaf_qty >= 1 and door_leaf_qty >= 1 and casement_sash_qty >= 1','direct_glazed_unit_qty','120',null,'2 hours for a standard double glazed unit in frame with other work',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',11,'Direct Glazed',null,'glass_unit','1.75sqm Direct Glazed Unit in Frame','frame_to_be_replaced and actual_area > 1.75 and is_direct_glazed_unit','1','60',null,'Additional 1 hour for an over 1.75sqm double glazed unit in frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',12,'Direct Glazed',null,'glass_unit','2.5sqm Direct Glazed Unit in Frame','frame_to_be_replaced and actual_area > 2.5 and is_direct_glazed_unit','1','120',null,'Additional 2 hours for a 2.5sqm double glazed unit in frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',13,'Direct Glazed',null,'glass_unit','4 sqm Direct Glazed Unit in Frame','frame_to_be_replaced and actual_area > 4.0 and is_direct_glazed_unit','1','240',null,'4 hours for a 4sqm double glazed unit in frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',13,'Direct Glazed',null,'glass_unit','3.25 sqm Direct Glazed Unit in Frame','frame_to_be_replaced and actual_area > 3.25 and is_direct_glazed_unit','1','240',null,'4 hours for a 3.25sqm double glazed unit in frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',15,'Direct Glazed',null,null,'Base Direct Glazed Unit in Frame (No Other)','frame_to_be_replaced and bi_fold_door_leaf_qty <= 0 and door_leaf_qty <= 0 and casement_sash_qty <= 0','direct_glazed_unit_qty','360',null,'6 hours for a standard double glazed unit in frame without other work',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',16,'Direct Glazed',null,'glass_unit','1.75sqm Direct Glazed Unit in Frame (Small)','frame_to_be_replaced and actual_area < 1.75 and is_direct_glazed_unit','1','70',null,'70 mins for a 1.75sqm double glazed unit in frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',50,'Direct Glazed',null,null,'Direct Glazed Units Glazing Bars','direct_glazed_unit_qty > 0','gb_to_be_replaced_qty / 2','45',null,'45 minutes per glazing bar on a direct glazed window',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',40,'Decoration Group',null,null,'Door Sash Replacement Decoration','is_decoration_included and nj_involved and is_installation_included','door_leaf_qty','120',null,'2hrs to paint the frame around a door',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',40,'Decoration Group',null,null,'Casement Sash Replacement Decoration','is_decoration_included and nj_involved and is_installation_included','casement_sash_qty','90',null,'1.5hrs to paint the frame around a casement window',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',40,'Decoration Group',null,null,'Sash Replacement Decoration','is_decoration_included and nj_involved and is_installation_included','sliding_sash_qty','90',null,'1.5hrs to paint half a box frame only',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',41,'Decoration Group',null,null,'Door DSO Replacement Decoration','is_decoration_included and not (nj_involved)','door_leaf_qty','180',null,'3hrs to paint the frame around a door',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',41,'Decoration Group',null,null,'Casement DSO Decoration','is_decoration_included and not (nj_involved)','casement_sash_qty','150',null,'2.5hrs to paint a casement window and frame',false,null,null),
  (_pf_id,'install_labour',false,'integrate_pf30','minutes','item',41,'Decoration Group',null,null,'Draught Seal Decoration','is_decoration_included and not nj_involved and is_installation_included','sliding_sash_qty','200',null,'3.33hrs to paint half a box frame and sashes',false,null,null);

  -- ============================================================
  -- PRICE rules (67 rules)
  -- ============================================================
  INSERT INTO price_rules (
    price_file_id, rule_family, is_active, imported_from, output_unit, level,
    sort_order, group_name, category, loop_target, name,
    condition, quantity, value, markup, comment, needs_review, raw_condition, raw_qty
  ) VALUES
  (_pf_id,'price',false,'integrate_pf30','gbp','item',20,'extra_services',null,'drawing_poa','Drawing POA','true','poa_cost','1',2,'Drawing POA Checked for PF30',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',31,'extra_services',null,null,'DSO SqM Rate','needs_draughtsealing and not nj_involved','frame_area','10',2,'Rough pricing differentiation for draught sealing',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',250,'extra_services',null,null,'Fully Coupled Frame Transport','is_bay_with_fully_coupled_frames','1','150',2,'£150 to allow for transporting fully coupled frames to site',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',1,'glass_done',null,'glass_unit','Single Glazed (Error Price)','is_single_glazed and not is_bi_glass and single_pane_cost < 250','rounded_area','single_pane_cost',1000,'Made the system produce a ridiculous price to show that it is an error',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',9,'glass_done',null,'glass_unit','BiGlass Cost','is_single_glazed and is_bi_glass','rounded_area','single_pane_cost',2,'BiGlass Cost Checked for PF30',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',20,'glass_done',null,'glass_unit','Square Glass Cost','is_double_glazed and inner_pane_thickness > 1 and not is_sash_arched','rounded_area','(inner_pane_cost + outer_pane_cost) + 1',2,'Tudor price',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',21,'glass_done',null,'glass_unit','Square Glass Single Glazing Bar','unit_gb_qty == 1 and glass_unit_thickness >= 24 and not is_sash_arched','1','9.21',2,'£9.21 for a single bar. Tudor Price',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',22,'glass_done',null,'glass_unit','Square Glass Multiple Glazing Bar','unit_gb_qty > 1 and glass_unit_thickness >= 24 and not is_sash_arched','rounded_area','29.20',2,'£29.20 for multiple bars. Tudor price',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',30,'glass_done',null,'glass_unit','Shaped Glass Cost','is_double_glazed and inner_pane_thickness > 1 and is_sash_arched','rounded_area','(inner_pane_cost + outer_pane_cost) * 1.25',2,'25% cost on top of glass. Tudor price',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',31,'glass_done',null,'glass_unit','Shaped Glass Multiple Glazing Bar','unit_gb_qty >= 1 and glass_unit_thickness >= 24 and is_sash_arched','rounded_area','44',2,'£44 for multiple bars. Tudor price',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',50,'glass_done',null,'glass_unit','All Glass Energy Surcharge','is_double_glazed and inner_pane_thickness >= 1','(rounded_area * (inner_pane_thickness + outer_pane_thickness)) * 2.5','0.17',2,'Energy surcharge on glass. Tudor price',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',60,'glass_done',null,'glass_unit','LandVac','is_single_glazed and glass_unit_thickness == 8.3 and not is_bi_glass','rounded_area','single_pane_cost',2,'LandVac Checked for PF30',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',0,'installation_materials',null,'ironmongery_part','Ironmongery Cost','true','(round(cost * qty, 0.1)) * 1.05','1',2,'Cost of Ironmongery',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',1,'installation_materials',null,'component','Component Cost','true','cost','length * qty',2,'Cost of Components',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',5,'installation_materials',null,null,'Installation Consumables','frame_to_be_replaced','30','1',2,'£30 worth of consumables per item',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',10,'installation_materials',null,'sliding_sash','Lead Weight','is_cord_hung and ((to_be_replaced and not is_complete_new) or is_bi_glass)','(weight_in_kg) * 1.15','2.41',1.5,'15% wastage. £2.29 per KG',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',15,'installation_materials',null,'sliding_sash','Steel Weight','is_cord_hung and to_be_replaced and is_complete_new','weight_in_kg','1.35',1.5,'£1.35 per kg for steel weights',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',0,'manufacture',null,null,'Production Time','true','std_labour_time','workshop_hourly_additional',2,'Production Time Checked for PF30',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',0,'labour',null,null,'Labour','is_installation_included','installation_labour_time','installation_labour_hourly',2,'Installation Hours @ £40 per hour cost',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',1,'manufacture_materials',null,null,'Stain £75 per frame','is_varnished_or_stained','new_frame_qty + new_sliding_sash_qty','100',2,'REVIEW: label says £75 per frame but value==100. Verify correct amount.',true,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',2,'manufacture_materials',null,null,'Stained Panels','is_varnished_or_stained','panel_qty','100',2,'£100 per frame or sash/door leaf for the cost of stain materials',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',10,'manufacture_materials',null,'sliding_sash','Laminated Softwood for Sashes (Bottom)','is_solid_redwood_sash and is_bottom_sash','((gross_sash_height_in_mm + (gross_sash_width_in_mm * 1.5)) / 1000) * 1.05','4.95',2,'£4.95 per linear meter of laminated redwood. 48x120 lam redwood',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',15,'manufacture_materials',null,'sliding_sash','Laminated Softwood for Sashes (Top)','is_solid_redwood_sash and is_top_sash','((gross_sash_height_in_mm + (gross_sash_width_in_mm * 1)) / 1000) * 1.05','4.95',2,'£4.95 per linear meter of laminated redwood',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',20,'manufacture_materials',null,'frame','Softwood Box Frame Linings','is_sw and is_solid_redwood_frame and not is_solid_spiral_jamb and to_be_replaced','((((frame_height_in_mm * 2) + frame_width_in_mm) / 1000) * 2) * 1.1 + (((full_length_frame_mullion_qty * (frame_height_in_mm / 1000)) * 2) * 1.1)','1.35',2,'Softwood inside and outside linings cost £1.35 per meter. 10% wastage',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',25,'manufacture_materials',null,'frame','Softwood Pulley Stiles and Head','is_sw and is_solid_redwood_frame and not is_solid_spiral_jamb and to_be_replaced','((((frame_height_in_mm * 2) + (frame_width_in_mm)) / 1000) * 1.1) + (((full_length_frame_mullion_qty * (frame_height_in_mm / 1000)) * 2) * 1.1)','1.69',2,'£1.69 per meter. 10% wastage',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',30,'manufacture_materials',null,'frame','Softwood Spiral Frame','is_sw and is_solid_redwood_frame and is_solid_spiral_jamb and to_be_replaced','(((frame_height_in_mm * 2) + frame_width_in_mm) / 1000) * 1.1 + (((full_length_frame_mullion_qty * (frame_height_in_mm / 1000)) * 2) * 1.1)','2.60',2,'150x32 timber costing £2.60. 10% wastage',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',35,'manufacture_materials',null,'frame','Softwood Spiral Frame Linings','is_sw and is_solid_redwood_frame and is_solid_spiral_jamb and to_be_replaced','(((frame_height_in_mm * 2) + frame_width_in_mm) / 1000) * 1.1 + ((((full_length_frame_mullion_qty * frame_height_in_mm) / 1000) * 2) * 1.1)','9',2,'100x25 timber costing £1.35. 10% wastage',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',40,'manufacture_materials',null,'frame','Box Frame Utile Cill','is_sw and is_solid_utile_hardwood_cill and to_be_replaced','(cill_length_in_mm * cill_profiled_height_in_mm * frame_depth_in_mm) / 1000000000','1600',2,'Utile cill. 10% wastage',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',50,'manufacture_materials',null,null,'Hardwood Box Frame','is_sw and is_solid_utile_hardwood_frame and frame_to_be_replaced','(frame_excl_cill_volume) * 1.2','1.75',2,'Hardwood box frame',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',55,'manufacture_materials',null,'sliding_sash','Hardwood Sashes','is_solid_utile_hardwood_sash','volume * 1.2','1.75',2,'Hardwood sashes',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',100,'manufacture_materials',null,'door_leaf','Door Stiles & Top Rail','is_solid_utile_hardwood_sash','(((gross_sash_height_in_mm * 2) + gross_sash_width_in_mm) * 1.1) / 1000','18.7',2,'REVIEW: comment references 63.5mm Sapele — excluded product. Value==18.7, £18.70 per meter. Verify material.',true,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',105,'manufacture_materials',null,'door_leaf','Door Bottom Rail','is_solid_utile_hardwood_sash','(gross_sash_width_in_mm * 1.1) / 1000','17.24',2,'REVIEW: comment references 63.5mm Sapele — excluded product. £17.24 per meter. Verify material.',true,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',110,'manufacture_materials',null,'frame','Casement Frame Jambs & Cills','is_solid_utile_hardwood_frame and not is_sw and not is_bi_fold_door_set and not is_door','(((frame_height_in_mm) + frame_width_in_mm) / 1000) * 1.1','17.24',2,'REVIEW: comment references 63.5mm Sapele — excluded product. Two jambs out of one board. Verify material.',true,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',115,'manufacture_materials',null,'frame','Casement Frame Head','is_solid_utile_hardwood_frame and not is_sw and not is_bi_fold_door_set and not is_door','(frame_width_in_mm / 1000) * 1.1','12.40',2,'REVIEW: comment references 76.2mm Sapele — excluded product. Verify material.',true,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',121,'manufacture_materials',null,null,'Casement Transoms & Mullions','is_solid_utile_hardwood_frame and not is_sw and is_casement_range','frame_muntin_to_be_replaced_length * 1.1','12.4',2,'REVIEW: comment references 76mm Sapele — excluded product. Verify material.',true,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',125,'manufacture_materials',null,'frame','Frame Plant On (Jambs)','is_solid_utile_hardwood_frame','((frame_height_in_mm * left_jamb_plant_on_in_mm * frame_depth_in_mm) / 1000000000) + ((frame_height_in_mm * right_jamb_plant_on_in_mm * frame_depth_in_mm) / 1000000000)','1085 * 1.35',2,'£1,085 per cubic meter for any plant on, 35% wastage',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',130,'manufacture_materials',null,'frame','Frame Plant On (Head)','is_solid_utile_hardwood_frame','((frame_width_in_mm * external_frame_head_plant_on_in_mm * frame_depth_in_mm) / 1000000000)','1085 * 1.35',2,'£1,085 per cubic meter for any plant on, allowing 35% for wastage',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',160,'manufacture_materials',null,null,'Softwood Casement Frame & Sashes','is_casement_window or is_casement_window_bay','(solid_redwood_frame_excl_cill_volume) * 1.25','0.55',2,'25% wastage. £550 cubic meter cost',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',165,'manufacture_materials',null,'casement_sash','Softwood Casement Sashes','true','solid_redwood_volume','0.55',2,'25% wastage. £550 cubic meter cost',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',166,'manufacture_materials',null,null,'Hardwood Casement Cill','is_casement_window or is_casement_window_bay','(solid_utile_hardwood_cill_volume) * 1.25','1.085',2,'25% wastage. £1,085 cubic meter cost',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',225,'manufacture_materials',null,'panel','Tricoya Panel','not is_varnished_or_stained','(visible_width_in_mm_old * visible_height_in_mm_old) / 1000000','(62.95 * 1.5) * 2',2,'£62.95 in cost per panel for tricoya',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',226,'manufacture_materials',null,null,'Custom Paint Delivery','not is_standard_finish_internally_and_externally','1','20',2,'£20 delivery fee for custom paint',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',227,'manufacture_materials',null,'panel','Internal Bolection Moulding','is_bolection_moulding_around_panel_internally','1','13.5',2,'Standard bolection moulding ~£10 per linear meter',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',228,'manufacture_materials',null,'panel','External Bolection Moulding','is_bolection_moulding_around_panel_externally','(((visible_width_in_mm_old + 75) + (visible_height_in_mm_old + 75)) / 1000)','13.5',2,'Standard bolection moulding ~£10 per linear meter',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',300,'manufacture_materials',null,'frame','Box Frame Staff Bead','is_sw and to_be_replaced','(width + height) * 2','3.28',2,'£9.85 per 3m length for staff bead (£3.28/lm). 15% wastage',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',305,'manufacture_materials',null,'frame','Box Frame Parting Bead','is_sw and to_be_replaced','(width + height) * 2','1.85',2,'£5.55 per 3m length for parting bead (£1.85/lm). 15% wastage',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',310,'manufacture_materials',null,'sliding_sash','Glazing Bead for Sashes','not is_square_top_with_arched_sightline and not is_curved_head_sash','((sash_sightline_width_in_mm + sash_sightline_height_in_mm) / 1000) * 2','1.39',2,'£3.48 per 3m length of glazing bead (£1.16/lm). 20% wastage',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',315,'manufacture_materials',null,'glass_unit','Glazing Bar','not is_glass_fix_bespoke_bead and not is_sash_arched','internal_spacer_length','1.84',2,'£5.52 per 3m length of glazing bead (LTW) (£1.84/lm). 20% wastage',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',320,'manufacture_materials',null,'sliding_sash','Spiral Balances','is_spiral_hung and to_be_replaced','1','25',2,'£25 per sash for spiral balances',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',325,'manufacture_materials',null,'frame','LTW General Consumables','casement_sash_qty >= 1 or door_leaf_qty >= 1','1','25',2,'£25 per frame for consumables',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',340,'manufacture_materials',null,null,'Accoya Pricing','is_accoya_frame or is_accoya_sash','(frame_excl_cill_volume + cill_volume) * 2.34','2.5',2,'£2,500m3 price',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',345,'manufacture_materials',null,'sliding_sash','Accoya Sash Pricing','is_accoya_frame or is_accoya_sash','(accoya_volume) * 2.34','2.5',2,'£2,500m3 price',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',400,'manufacture_materials',null,'allocated_section_part','Utile Section Part','(is_single_and_french_doors_range or is_open_in_doors_range) and contains(part_name, utile)','length_in_m','purchase_cost',2,'REVIEW: contains() is Integrate-specific syntax — untranslatable. Needs manual rewrite.',true,'(is_single_and_french_doors_range or is_open_in_doors_range) and contains(part_name, utile)',null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',1,'extra_profits',null,null,'DSO Extra Profits','needs_draughtsealing and not nj_involved and not is_bi_glass','sliding_sash_qty - fixed_sliding_sash_qty','1',55,'£55 extra profit on a draught seal per sash',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',5,'extra_profits',null,null,'Sashes Only Painting Profits','needs_draughtsealing and not nj_involved and is_decoration_included','sliding_sash_qty','1',35000,'REVIEW: markup==35000 — almost certainly should be 35. £35 extra profit on a draught seal decoration.',true,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',10,'extra_profits',null,null,'Cill Replacement Profit','true','new_cill_qty','1',200,'Profit on cill replacement',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',200,'extra_profits',null,'frame','Box Frames with Fanlights','new_sliding_sash_qty >= 1 and new_casement_sash_qty >= 1','1','750',2,'£750 Job S price for box frames with fanlights',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','item',210,'extra_profits',null,null,'Doors and Sashes','new_sliding_sash_qty >= 1 and new_door_leaf_qty >= 1','1','1500',2,'£1500 Job S price for sashes and doors',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','quote',10,'_quote_level_',null,null,'InstallSure Up to £5,000','(items_net_value * 1.2) <= 5000 and nj_item_qty >= 1','1','34.40',2,'',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','quote',11,'_quote_level_',null,null,'InstallSure Up to £10,000','(items_net_value * 1.2) >= 5000.01 and (items_net_value * 1.2) <= 10000 and nj_item_qty >= 1','1','36.12',2,'',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','quote',12,'_quote_level_',null,null,'InstallSure Up to £15,000','(items_net_value * 1.2) >= 10000.01 and (items_net_value * 1.2) <= 15000 and nj_item_qty >= 1','1','37.84',2,'',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','quote',13,'_quote_level_',null,null,'InstallSure Up to £20,000','(items_net_value * 1.2) >= 15000.01 and (items_net_value * 1.2) <= 20000 and nj_item_qty >= 1','1','39.56',2,'',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','quote',14,'_quote_level_',null,null,'InstallSure Up to £25,000','(items_net_value * 1.2) >= 20000.01 and (items_net_value * 1.2) <= 25000 and nj_item_qty >= 1','1','41.28',2,'',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','quote',15,'_quote_level_',null,null,'InstallSure Up to £30,000','(items_net_value * 1.2) >= 25000.01 and (items_net_value * 1.2) <= 30000 and nj_item_qty >= 1','1','43',2,'REVIEW: label says £41.28 but value=43. Previous tier is 41.28. Verify correct amount.',true,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','quote',16,'_quote_level_',null,null,'InstallSure Up to £40,000','(items_net_value * 1.2) >= 30000.01 and (items_net_value * 1.2) <= 40000 and nj_item_qty >= 1','1','136',2,'',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','quote',17,'_quote_level_',null,null,'InstallSure Up to £50,000','(items_net_value * 1.2) >= 40000.01 and (items_net_value * 1.2) <= 50000 and nj_item_qty >= 1','1','196',2,'',false,null,null),
  (_pf_id,'price',false,'integrate_pf30','gbp','quote',18,'_quote_level_',null,null,'InstallSure Over £50,000','(items_net_value * 1.2) >= 50000.01 and nj_item_qty >= 1','1','350',2,'',false,null,null);

  -- ============================================================
  -- POST-IMPORT SYNTAX CHECK
  -- Scan condition / quantity / value of every imported rule and
  -- RAISE NOTICE for any token that looks like un-translated
  -- Integrate syntax: bare =, &&, ||, bare !, [ or ]
  --
  -- raw_condition and raw_qty are intentionally excluded — they
  -- store the original Integrate text for reference.
  -- Uses a PL/pgSQL sub-block to declare the loop variables.
  -- ============================================================

  <<check_syntax>>
  DECLARE
    _r   RECORD;
    _bad text;
  BEGIN
    FOR _r IN
      SELECT id, name, condition, quantity, value
      FROM   price_rules
      WHERE  price_file_id = _pf_id
    LOOP
      _bad := '';

      -- bare = : preceded by a non-operator char (or start), followed by non-= char (or end)
      IF _r.condition ~ '(^|[^!<>=])=([^=]|$)' THEN
        _bad := _bad || ' bare= in condition;';
      END IF;
      IF _r.quantity  ~ '(^|[^!<>=])=([^=]|$)' THEN
        _bad := _bad || ' bare= in quantity;';
      END IF;
      IF _r.value     ~ '(^|[^!<>=])=([^=]|$)' THEN
        _bad := _bad || ' bare= in value;';
      END IF;

      -- Integrate boolean operators
      IF _r.condition ~ '&&|\|\|' THEN _bad := _bad || ' &&/|| in condition;'; END IF;
      IF _r.quantity  ~ '&&|\|\|' THEN _bad := _bad || ' &&/|| in quantity;';  END IF;
      IF _r.value     ~ '&&|\|\|' THEN _bad := _bad || ' &&/|| in value;';     END IF;

      -- bare ! (not followed by =, i.e. not !=)
      IF _r.condition ~ '![^=]' OR _r.condition ~ '!$'
        THEN _bad := _bad || ' bare ! in condition;'; END IF;
      IF _r.quantity  ~ '![^=]' OR _r.quantity  ~ '!$'
        THEN _bad := _bad || ' bare ! in quantity;';  END IF;
      IF _r.value     ~ '![^=]' OR _r.value     ~ '!$'
        THEN _bad := _bad || ' bare ! in value;';     END IF;

      -- bracket variables [var]
      IF _r.condition ~ '\[|\]' THEN _bad := _bad || ' brackets in condition;'; END IF;
      IF _r.quantity  ~ '\[|\]' THEN _bad := _bad || ' brackets in quantity;';  END IF;
      IF _r.value     ~ '\[|\]' THEN _bad := _bad || ' brackets in value;';     END IF;

      IF _bad <> '' THEN
        RAISE NOTICE 'Rule id=% (%): %', _r.id, _r.name, _bad;
      END IF;
    END LOOP;
  END check_syntax;

END $$;

COMMIT;
