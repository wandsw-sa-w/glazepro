# Step B1 — inspection results (run by Nathan in the Supabase SQL editor, bypassing RLS)

Notes for Claude Code:
- Nathan's exports are not labelled with your query numbers, so each section below is labelled by its content. Match them to the queries in sql/step-b1-inspect.sql.
- Two of your queries (Nathan reports them as items 2 and 3) returned "Success. No rows returned" — i.e. an EMPTY result. If those were the RLS policy queries, that means NO policies exist on those tables; check what that implies (RLS enabled with no policies = authenticated users can neither read nor write).
- One query (item 8) FAILED: `ERROR: 42703: column dp.name does not exist` at `OR dp.name ILIKE '%sash%'`. drawing_parts has no name column (see its column list below — it has label_override). Rewrite that query if you still need it.
- IGNORE the two 'older exports' sections at the bottom: they are snapshots from before step a2/a3 were applied (a3 has since run successfully and its validation check passed — every active reference field now has a reference_category, supplyOption is inactive, newFrame/isBiGlass are derived, cutBack* are boolean). Do not base any changes on them.
- Key facts: drawings.id and drawing_parts.id/drawing_id/parent_part_id are all BIGINT. drawing_parts per-part values column is named `values` (jsonb, quote it in SQL). drawing_parts also has label_override (text) and overrides (text[], not null default '{}'). default_profile_values: profile_id, field_key, default_value (text), min_value, max_value, source_ref. reference_options has is_active, attributes (jsonb, not null), applies_to (text[]).

## drawings — column list

```csv
column_name,data_type,udt_name,is_nullable,column_default
id,bigint,int8,NO,nextval('drawings_id_seq'::regclass)
job_item_id,bigint,int8,YES,null
drawing_number,integer,int4,YES,1
window_type,text,text,YES,'Box Sash'::text
service_type,text,text,YES,'Complete New'::text
material_frame,text,text,YES,'Solid Redwood'::text
material_sash,text,text,YES,'Solid Redwood'::text
material_cill,text,text,YES,'Solid Utile Hardwood'::text
doc_l,boolean,bool,YES,true
frame_width,integer,int4,YES,null
frame_height,integer,int4,YES,null
sash_width,integer,int4,YES,null
sash_height,integer,int4,YES,null
equal_sash_division,boolean,bool,YES,true
top_sash_height,integer,int4,YES,null
bottom_sash_height,integer,int4,YES,null
top_sash_operation,text,text,YES,'Cord Hung'::text
bottom_sash_operation,text,text,YES,'Cord Hung'::text
top_sash_glazing_bars_wide,integer,int4,YES,1
top_sash_glazing_bars_high,integer,int4,YES,1
bottom_sash_glazing_bars_wide,integer,int4,YES,1
bottom_sash_glazing_bars_high,integer,int4,YES,1
top_sash_horn,text,text,YES,'Victorian'::text
bottom_sash_horn,text,text,YES,'None'::text
top_sash_glass,text,text,YES,'Clear Toughened'::text
bottom_sash_glass,text,text,YES,'Clear Toughened'::text
casement_openings,jsonb,jsonb,YES,null
finish_internal,text,text,YES,'Clean White'::text
finish_external,text,text,YES,'Clean White'::text
finish_cill,text,text,YES,'Clean White'::text
ironmongery_finish,text,text,YES,'PB'::text
trickle_vent,boolean,bool,YES,false
surrounds,text,text,YES,null
notes_quote,text,text,YES,null
notes_installation,text,text,YES,null
notes_hs,text,text,YES,null
manual_price,numeric,numeric,YES,null
calculated_price,numeric,numeric,YES,null
discount_type,text,text,YES,null
discount_value,numeric,numeric,YES,null
created_at,timestamp with time zone,timestamptz,YES,now()
updated_at,timestamp with time zone,timestamptz,YES,now()
frame_jamb_external_width,integer,int4,NO,101
frame_jamb_internal_width,integer,int4,NO,85
frame_head_external_height,integer,int4,NO,95
frame_head_internal_height,integer,int4,NO,79
cill_depth,integer,int4,YES,null
cill_height,integer,int4,YES,null
cill_width,integer,int4,YES,null
sash_thickness,integer,int4,NO,45
bottom_rail_width,integer,int4,NO,97
top_rail_width,integer,int4,NO,49
needs_draughtsealing,boolean,bool,NO,false
default_profile_id,bigint,int8,YES,null
default_values,jsonb,jsonb,NO,'{}'::jsonb
default_overrides,ARRAY,_text,NO,'{}'::text[]
```

## drawing_parts — column list

```csv
column_name,data_type,udt_name,is_nullable,column_default
id,bigint,int8,NO,nextval('drawing_parts_id_seq'::regclass)
drawing_id,bigint,int8,NO,null
parent_part_id,bigint,int8,YES,null
part_type,text,text,NO,null
sort_order,integer,int4,NO,0
label_override,text,text,YES,null
values,jsonb,jsonb,NO,'{}'::jsonb
overrides,ARRAY,_text,NO,'{}'::text[]
created_at,timestamp with time zone,timestamptz,NO,now()
updated_at,timestamp with time zone,timestamptz,NO,now()
```

## default_profiles — column list

```csv
column_name,data_type,udt_name,is_nullable,column_default
id,bigint,int8,NO,nextval('default_profiles_id_seq'::regclass)
code,text,text,NO,null
label,text,text,NO,null
condition,text,text,YES,null
is_fallback,boolean,bool,NO,false
sort_order,integer,int4,NO,0
is_active,boolean,bool,NO,true
created_at,timestamp with time zone,timestamptz,NO,now()
updated_at,timestamp with time zone,timestamptz,NO,now()
```

## default_profile_values — column list

```csv
column_name,data_type,udt_name,is_nullable,column_default
id,bigint,int8,NO,nextval('default_profile_values_id_seq'::regclass)
profile_id,bigint,int8,NO,null
field_key,text,text,NO,null
default_value,text,text,YES,null
min_value,numeric,numeric,YES,null
max_value,numeric,numeric,YES,null
updated_at,timestamp with time zone,timestamptz,NO,now()
source_ref,text,text,YES,null
```

## reference_options — column list

```csv
column_name,data_type,udt_name,is_nullable,column_default
id,bigint,int8,NO,nextval('reference_options_id_seq'::regclass)
category,text,text,NO,null
code,text,text,NO,null
label,text,text,NO,null
attributes,jsonb,jsonb,NO,'{}'::jsonb
applies_to,ARRAY,_text,NO,'{}'::text[]
sort_order,integer,int4,NO,0
is_active,boolean,bool,NO,true
created_at,timestamp with time zone,timestamptz,NO,now()
updated_at,timestamp with time zone,timestamptz,NO,now()
```

## part_type_children — column list

```csv
column_name,data_type,udt_name,is_nullable,column_default
parent_code,text,text,NO,null
child_code,text,text,NO,null
min_count,integer,int4,NO,0
max_count,integer,int4,YES,null
sort_order,integer,int4,NO,0
```

---

# Older exports — IGNORE (pre-a3 snapshots, included only because they were in the same batch)

## OLD: NOT NULL columns of default_field_definitions (from the step a2 fix)

```csv
column_name,data_type,column_default
id,bigint,nextval('default_field_definitions_id_seq'::regclass)
field_key,text,null
label,text,null
group_name,text,'General'::text
data_type,text,'number'::text
sort_order,integer,0
is_active,boolean,true
created_at,timestamp with time zone,now()
updated_at,timestamp with time zone,now()
visibility,text,'visible'::text
```

## OLD: reference fields lacking a category BEFORE step a3 (now all fixed)

```csv
field_key,reference_category,is_required,role,is_active
assemblyFramePart.jambType,null,false,input,true
bottomSashPart.constantSideOnHeightCalculation,null,false,config,true
drawingItemPart.installationLevel,null,false,input,true
drawingItemPart.isBiGlass,null,false,input,true
drawingItemPart.newFrame,null,false,input,true
drawingItemPart.partingBeadTypeId,null,false,input,true
drawingItemPart.staffBeadTypeId,null,false,input,true
drawingItemPart.supplyOption,null,false,input,true
drawingItemPart.typeOfWork,null,true,input,true
glassPart.gasFillId,null,false,input,true
glassPart.glazingBeadFixId,null,false,input,true
glassPart.innerGasFillId,null,false,input,true
notesPart.cutBackPlaster,null,false,input,true
notesPart.cutBackReveal,null,false,input,true
notesPart.fireEgress,null,false,input,true
notesPart.installationMethod,null,false,input,true
notesPart.internalHazard,null,false,input,true
notesPart.landingAccess,null,false,input,true
pricePart.poa,null,false,input,true
sashPairPart.midRailTypeId,null,false,input,true
sashPairPart.sashSplit,null,false,input,true
```
