-- Step BD-3: the three FRONT DOOR templates.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run.
-- Run AFTER sql/step-bd2 (the leaf-grid containment) — without it
-- save_drawing_parts refuses a leaf that holds a muntin, so a drawing made
-- from these templates could not be saved.
--
-- RE-ISSUED AGAIN 14 Oct 2026 (templates fix): the leaf MID RAILS are
-- Integrate's, not centred. A front door's lock rail sits LOW — long panels
-- or glass above, a short panel below — and the first trees put every rail
-- in the middle of the leaf:
--
--     Front Door (Balham)        983 / 635   was 809 / 809
--     Front Door With Fanlight   941 / 618   was 780 / 779
--     Arched Front Door         1103 / 582   was 843 / 842
--
-- The MUNTIN stays centred (329 / 328): Integrate's 373 / 284 is its own
-- template’s accident, which is what the brief asked for and is unchanged.
-- The positions now live in FRONT_DOOR_TEMPLATES as `rowOffsets`, and a
-- divider's offset is the span BEFORE it — so the number stored is the
-- height of the cells ABOVE the rail (983 / 941 / 1103).
--
-- This file is UPDATE-if-exists, so re-running it over the templates that
-- are already live simply corrects their trees. A drawing already made from
-- one keeps its own tree (drawings 41-43 on L507712 item 9), and would have
-- to be re-made from the template to pick the rail up.
--
-- RE-ISSUED 14 Oct 2026 after the reviewer read it. Three things were wrong
-- in the first version and are fixed here:
--
--   * drawing_templates has NO unique index on `name`, so ON CONFLICT (name)
--     fails outright. It now UPDATEs where the name exists and INSERTs where
--     it does not, which is sql/step-bc2's pattern.
--   * 0a read default_profiles.name — there is no such column (code and
--     is_active only).
--   * the finishes are reference_options category 'paint_finish', and the
--     code for Integrate's "Custom Colour TBC" is 'custom'. The trees said
--     'custom_colour_tbc', which is not an option at all. FRONT_DOOR_TEMPLATES
--     now writes 'custom' and these trees were regenerated from it.
--
-- Group "Open In Doors", product "Door", range open_in_doors — Integrate's
-- own group 1 (docs/integrate-L31115-front-doors.txt). The three templates,
-- with Integrate's template numbers:
--
--   Front Door               128168  "Balham", 1099 x 2182, four raised-and-
--                                    fielded panels, no glass
--   Front Door With Fanlight  22253  "Bedford Front Door w Fanlight",
--                                    1099 x 2595, a DIRECT GLAZED fanlight
--                                    over a 41 transom at 431, the leaf glass
--                                    over a 170 mid rail and one panel
--   Arched Front Door          6619  "Arched Door", 1099 x 2199, a segmental
--                                    arch at frame level and an arched leaf,
--                                    shaped glass over a 120 mid rail and one
--                                    panel
--
-- TWO CHOICES THE BRIEF ASKED TO BE SAID OUT LOUD:
--
--  1. THE MUNTIN IS CENTRED. Integrate's Balham splits its leaf 373 / 284,
--     which the brief calls its template's accident; GlazePro's template
--     centres it (329 / 328 of a 777 interior, the odd millimetre to the
--     left, as the board splits every other span). FT1 is benchmarked on
--     INTEGRATE'S OWN 373 / 284, so the fixture and the template differ on
--     purpose: the fixture's job is Integrate's figures, the template's is
--     the door Nathan sells.
--
--  2. THE ARCHED DOOR IS INTEGRATE'S, UNCHANGED — shaped glass over a 120
--     mid rail and ONE panel. A four-panel arched door would need SHAPED top
--     panels, and nothing prices one: the Tricoya rule reads a visible width
--     x height, and a cell crossing the springing line is not a rectangle.
--     If Nathan wants an arched four-panel door, that is a step of its own.
--
-- The finish is DUAL as Integrate's templates are — Clean White inside,
-- Custom Colour TBC outside — which is what fires the three "- Dual Finish"
-- door rules (240 + 180 + 45) instead of the single-finish ones. SECTION 0
-- checks that both option codes exist before anything is written.
--
-- NO stored ironmongery and NO stored surround list: the live rules allocate
-- both (sql/step-bd4 is where Nathan's own default set is set).
--
-- The trees below were GENERATED from the board's own builders by
-- scripts/build-step-bd-sql.mjs, from the specs in
-- src/drawingBoard/doorOpenings.js (FRONT_DOOR_TEMPLATES) — so the template,
-- the tests and the board read one definition, which is the lesson of
-- sql/step-bc3.
--
-- RUN SECTION 0 FIRST.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. The profile this needs. Expect ONE active row, code 'open_in_doors'.
--     If there is none, STOP: a front door's leaf clearances (3/4/4/14), its
--     170 bottom rail and its 50 cill all come from it, and no other profile
--     has them.
SELECT id, code, is_active
FROM   public.default_profiles
WHERE  code = 'open_in_doors';

-- 0b. The two finish option CODES the dual finish names. Expect 'clean_white'
--     and 'custom', both active, in category 'paint_finish'.
SELECT category, code, label, sort_order, is_active
FROM   public.reference_options
WHERE  category = 'paint_finish'
ORDER  BY sort_order;

-- 0c. The product option. Expect one active row labelled "Door".
SELECT category, code, label, sort_order, is_active
FROM   public.reference_options
WHERE  category = 'product' AND lower(label) = 'door'
ORDER  BY sort_order;

-- 0d. The templates as they stand. Expect 0 rows the first time; if the first
--     version of this file was run and failed, expect 0 rows too — it is one
--     transaction and nothing was written.
SELECT id, name, family, group_name, window_type, sort_order, is_active
FROM   public.drawing_templates
WHERE  name IN ('Front Door', 'Front Door With Fanlight', 'Arched Front Door')
ORDER  BY sort_order;

-- 0e. What sort_order is free, and whether any name is duplicated — there is
--     no unique index on name, which is why this file matches on it by hand.
--     Expect every count to be 1.
SELECT name, count(*) AS rows_with_this_name, min(sort_order) AS sort_order
FROM   public.drawing_templates
GROUP  BY name
ORDER  BY min(sort_order);

-- 0f. The leaf-grid containment, which sql/step-bd2 adds. Expect a
--     doorLeafPart -> mullionPart row with max_count NULL. If it is not
--     there, STOP and run sql/step-bd2 first: a drawing made from the
--     four-panel template would not save.
SELECT parent_code, child_code, min_count, max_count
FROM   part_type_children
WHERE  parent_code = 'doorLeafPart'
ORDER  BY child_code;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the three templates
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _profile_id bigint;
  _product    text;
  _templates  jsonb := '[{"name":"Front Door","sort_order":200,"tree":{"key":"item_zrxf4w3","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_7cckwfb","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"custom","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":true,"isFrontDoor":true},"children":[]},{"key":"notes_kpnqtkj","part_type":"notesPart","values":{},"children":[]},{"key":"price_2temroi","part_type":"pricePart","values":{},"children":[]},{"key":"frame_k7y1nym","part_type":"assemblyFramePart","values":{"width":1099,"height":2182,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":26,"rakeFrame":false,"archHead":false,"toBeReplaced":true},"children":[{"key":"doorleaf_00an4qx","part_type":"doorLeafPart","values":{"operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"stepped","mechanicalClearanceTop":3,"mechanicalClearanceLeft":4,"mechanicalClearanceRight":4,"mechanicalClearanceBottom":14,"defaultMuntinThickness":120,"archHead":false,"toBeReplaced":true},"children":[{"key":"doorleaf_00an4qx_muntin1","part_type":"mullionPart","values":{"isMuntin":true,"offset":329,"thicknessInFrame":120,"muntinThickness":120,"mullionStopSize":0,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"doorleaf_00an4qx_midrail1","part_type":"transomPart","values":{"isMidrail":true,"offset":983,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"doorleaf_00an4qx_panel1","part_type":"panelPart","values":{"internalPanelTypeId":"raised_and_fielded","externalPanelTypeId":"raised_and_fielded","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_00an4qx_panel2","part_type":"panelPart","values":{"internalPanelTypeId":"raised_and_fielded","externalPanelTypeId":"raised_and_fielded","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_00an4qx_panel3","part_type":"panelPart","values":{"internalPanelTypeId":"raised_and_fielded","externalPanelTypeId":"raised_and_fielded","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_00an4qx_panel4","part_type":"panelPart","values":{"internalPanelTypeId":"raised_and_fielded","externalPanelTypeId":"raised_and_fielded","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"cill_xtc8wkr","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}},{"name":"Front Door With Fanlight","sort_order":210,"tree":{"key":"item_rgxsex8","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_3owjjhn","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"custom","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":true,"isFrontDoor":true},"children":[]},{"key":"notes_gmhxdma","part_type":"notesPart","values":{},"children":[]},{"key":"price_y0sg8f4","part_type":"pricePart","values":{},"children":[]},{"key":"frame_pwtxe8u","part_type":"assemblyFramePart","values":{"width":1099,"height":2595,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":26,"rakeFrame":false,"archHead":false,"toBeReplaced":true},"children":[{"key":"trans_xphgpck","part_type":"transomPart","values":{"offset":431,"thicknessInFrame":41,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"dgu_j30nkx7","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3,"mechanicalClearanceTop":15,"mechanicalClearanceBottom":15,"mechanicalClearanceLeft":15,"mechanicalClearanceRight":15,"hiddenInRebateTop":15,"hiddenInRebateBottom":15,"hiddenInRebateLeft":15,"hiddenInRebateRight":15,"toBeReplaced":true},"children":[]},{"key":"doorleaf_tv8mgi6","part_type":"doorLeafPart","values":{"operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"stepped","mechanicalClearanceTop":3,"mechanicalClearanceLeft":4,"mechanicalClearanceRight":4,"mechanicalClearanceBottom":14,"defaultMuntinThickness":120,"archHead":false,"toBeReplaced":true},"children":[{"key":"doorleaf_tv8mgi6_midrail1","part_type":"transomPart","values":{"isMidrail":true,"offset":941,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"doorleaf_tv8mgi6_glass1","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3},"children":[]},{"key":"doorleaf_tv8mgi6_panel2","part_type":"panelPart","values":{"internalPanelTypeId":"raised_and_fielded","externalPanelTypeId":"raised_and_fielded","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"cill_o965inp","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}},{"name":"Arched Front Door","sort_order":220,"tree":{"key":"item_9j2e6c5","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_g3jptwl","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"custom","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":true,"isFrontDoor":true},"children":[]},{"key":"notes_ble2sg8","part_type":"notesPart","values":{},"children":[]},{"key":"price_1glai9r","part_type":"pricePart","values":{},"children":[]},{"key":"frame_ya6zsh9","part_type":"assemblyFramePart","values":{"width":1099,"height":2199,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":26,"rakeFrame":false,"archHead":false,"toBeReplaced":true,"curvedFrameHead":true,"frameLevelArchHead":true,"frameLevelArchHeight":508.891,"frameLevelArchRadius":551.121,"archShoulderLeft":1690,"archShoulderRight":1690},"children":[{"key":"doorleaf_0vs5rss","part_type":"doorLeafPart","values":{"operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"stepped","mechanicalClearanceTop":3,"mechanicalClearanceLeft":4,"mechanicalClearanceRight":4,"mechanicalClearanceBottom":14,"defaultMuntinThickness":120,"archHead":true,"archHeight":345.92,"archRadius":391.12,"curvedSashHead":true,"shoulderHeight":1459.08,"toBeReplaced":true},"children":[{"key":"doorleaf_0vs5rss_midrail1","part_type":"transomPart","values":{"isMidrail":true,"offset":1103,"thicknessInFrame":120,"midrailThickness":120,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"doorleaf_0vs5rss_glass1","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3},"children":[]},{"key":"doorleaf_0vs5rss_panel2","part_type":"panelPart","values":{"internalPanelTypeId":"raised_and_fielded","externalPanelTypeId":"raised_and_fielded","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"cill_eh8pfsb","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}}]'::jsonb;
  _row        record;
  _tree       jsonb;
BEGIN
  SELECT id INTO _profile_id FROM public.default_profiles
  WHERE code = 'open_in_doors' AND is_active = TRUE;
  IF _profile_id IS NULL THEN
    RAISE EXCEPTION 'No active default_profiles row with code ''open_in_doors'' — a front door cannot be built from another profile';
  END IF;

  SELECT code INTO _product FROM public.reference_options
  WHERE category = 'product' AND lower(label) = 'door' AND is_active
  ORDER BY sort_order LIMIT 1;
  IF _product IS NULL THEN
    RAISE EXCEPTION 'No active reference_options row with category ''product'' and label ''Door''';
  END IF;

  -- The two finish codes the trees carry must BE options, or a surveyor opens
  -- the drawing on a finish the board cannot show.
  IF NOT EXISTS (
    SELECT 1 FROM public.reference_options
    WHERE category = 'paint_finish' AND code = 'clean_white' AND is_active
  ) THEN
    RAISE EXCEPTION 'No active paint_finish option ''clean_white''';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.reference_options
    WHERE category = 'paint_finish' AND code = 'custom' AND is_active
  ) THEN
    RAISE EXCEPTION 'No active paint_finish option ''custom'' — SECTION 0b lists what there is';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM part_type_children
    WHERE parent_code = 'doorLeafPart' AND child_code = 'mullionPart'
  ) THEN
    RAISE EXCEPTION 'doorLeafPart -> mullionPart is not allowed yet — run sql/step-bd2-front-door-containment.sql first';
  END IF;

  IF jsonb_array_length(_templates) <> 3 THEN
    RAISE EXCEPTION 'Expected 3 templates in this script, found %', jsonb_array_length(_templates);
  END IF;

  FOR _row IN
    SELECT * FROM jsonb_to_recordset(_templates) AS x(name text, sort_order int, tree jsonb)
  LOOP
    _tree := jsonb_set(_row.tree, '{values,product}', to_jsonb(_product), true);

    -- Every one of these trees must BE a front door, or the templates would
    -- quietly start every new drawing as a garden door: 660 install minutes
    -- instead of 840, a Thunderbolt instead of the AV4 Heritage lock, and
    -- single-finish production instead of dual.
    IF NOT jsonb_path_exists(_tree, '$.**.values ? (@.isFrontDoor == true)') THEN
      RAISE EXCEPTION 'Template "%" is not marked isFrontDoor — do not run this file', _row.name;
    END IF;
    IF NOT jsonb_path_exists(_tree, '$.**.values ? (@.casementTypeId == "open_in")') THEN
      RAISE EXCEPTION 'Template "%" has no OPEN IN leaf — do not run this file', _row.name;
    END IF;

    -- drawing_templates has NO unique index on name, so this matches by hand
    -- rather than with ON CONFLICT (sql/step-bc2's pattern). If a name were
    -- somehow duplicated, the UPDATE would write both rows the same tree,
    -- which is why SECTION 0e counts them first.
    IF EXISTS (SELECT 1 FROM public.drawing_templates WHERE name = _row.name) THEN
      UPDATE public.drawing_templates
      SET tree = _tree, default_profile_id = _profile_id, window_type = 'Door',
          family = 'door', group_name = 'Open In Doors',
          sort_order = _row.sort_order, is_active = TRUE, updated_at = now()
      WHERE name = _row.name;
      RAISE NOTICE 'Step BD-3: % updated in place', _row.name;
    ELSE
      INSERT INTO public.drawing_templates
        (name, family, group_name, window_type, default_profile_id, tree, sort_order, is_active)
      VALUES (_row.name, 'door', 'Open In Doors', 'Door',
              _profile_id, _tree, _row.sort_order, TRUE);
      RAISE NOTICE 'Step BD-3: % created', _row.name;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. The three rows. Expect sort_order 200 / 210 / 220, group "Open In
--    Doors", window_type "Door", and the open_in_doors profile on each.
SELECT t.name, t.group_name, t.window_type, t.sort_order, t.is_active,
       p.code AS profile_code
FROM   public.drawing_templates t
LEFT   JOIN public.default_profiles p ON p.id = t.default_profile_id
WHERE  t.name IN ('Front Door', 'Front Door With Fanlight', 'Arched Front Door')
ORDER  BY t.sort_order;

-- 2. What each tree holds. Expect, in sort_order:
--      Front Door                1 leaf, 4 panels, 0 glass, 1 muntin, 1 rail
--      Front Door With Fanlight  1 leaf, 1 panel,  2 glass, 0 muntins, 2 dividers
--                                (one frame transom at 431, one leaf mid rail)
--      Arched Front Door         1 leaf, 1 panel,  1 glass, 0 muntins, 1 rail
--    and NO casement sash anywhere: a front door's fanlight is a DIRECT
--    GLAZED unit, which is what fires Integrate's 70-minute 1.75 m2 rule.
SELECT name, sort_order,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "doorLeafPart")'))     AS leaves,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "panelPart")'))        AS panels,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "glassPart")'))        AS glass,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "mullionPart")'))      AS muntins,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "transomPart")'))      AS dividers,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "casementSashPart")')) AS sashes
FROM   public.drawing_templates
WHERE  name IN ('Front Door', 'Front Door With Fanlight', 'Arched Front Door')
ORDER  BY sort_order;

-- 3. The things that drive the price: the front-door flag, the open-in leaf,
--    the dual finish (expect "custom" on the outside, not the old
--    custom_colour_tbc), the 50 cill, and the arch on the arched one only.
SELECT name,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values.isFrontDoor') v)       AS is_front_door,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values.casementTypeId') v)    AS leaf_type,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values.internalFinish') v)    AS internal_finish,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values.externalFinish') v)    AS external_finish,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values ? (@.depth == 145).height') v) AS cill_height,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values.curvedFrameHead') v)   AS curved_frame_head,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values.curvedSashHead') v)    AS curved_leaf_head
FROM   public.drawing_templates
WHERE  name IN ('Front Door', 'Front Door With Fanlight', 'Arched Front Door')
ORDER  BY sort_order;

-- 3b. The leaf's own dividers. Expect the mid rail offsets 983 / 941 / 1103
--     (the cells ABOVE the rail) and the Balham muntin at 329 — NOT 809 /
--     780 / 843, which is what a centred rail reads.
SELECT name, sort_order,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values ? (@.isMidrail == true).offset') v) AS mid_rail_offset,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values ? (@.isMidrail == true).midrailThickness') v) AS mid_rail_thickness,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values ? (@.isMuntin == true).offset') v) AS muntin_offset
FROM   public.drawing_templates
WHERE  name IN ('Front Door', 'Front Door With Fanlight', 'Arched Front Door')
ORDER  BY sort_order;

-- 4. And the sizes, to compare with Integrate: 1099 x 2182, 1099 x 2595,
--    1099 x 2199.
SELECT name,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values ? (@.frameDepth == 96).width') v)  AS frame_width,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values ? (@.frameDepth == 96).height') v) AS frame_height
FROM   public.drawing_templates
WHERE  name IN ('Front Door', 'Front Door With Fanlight', 'Arched Front Door')
ORDER  BY sort_order;

-- 5. Every finish code any template carries IS an option. Expect 0 rows.
SELECT t.name, f.finish_code
FROM   public.drawing_templates t
CROSS  JOIN LATERAL (
  SELECT jsonb_array_elements_text(
    coalesce((SELECT jsonb_agg(v) FROM jsonb_path_query(t.tree, '$.**.values.internalFinish') v), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(v) FROM jsonb_path_query(t.tree, '$.**.values.externalFinish') v), '[]'::jsonb)
  ) AS finish_code
) f
WHERE  NOT EXISTS (
  SELECT 1 FROM public.reference_options o
  WHERE o.category = 'paint_finish' AND o.code = f.finish_code AND o.is_active
)
ORDER  BY t.name, f.finish_code;


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- Deleting a template does NOT touch a drawing made from it: a drawing holds
-- its own tree. So this is safe at any time, and the only cost is that a
-- surveyor can no longer start a front door from the gallery.
--
-- BEGIN;
-- DELETE FROM public.drawing_templates
-- WHERE name IN ('Front Door', 'Front Door With Fanlight', 'Arched Front Door');
-- COMMIT;
--
-- To keep them but hide them instead:
-- UPDATE public.drawing_templates SET is_active = FALSE, updated_at = now()
-- WHERE name IN ('Front Door', 'Front Door With Fanlight', 'Arched Front Door');
