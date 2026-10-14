-- Step BF-1: the four FRONT DOOR templates, with FLAT panels.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run.
-- UPDATE-if-exists, as sql/step-bd3 and sql/step-be2 are. It REPLACES the
-- template half of both of those, so running this alone is enough.
--
-- WHY. Integrate's panel type ids, read in its own panel-type dialog on
-- 14 Oct 2026 (docs/integrate-L31115-stable-doors.txt):
--
--     110 = FLAT    112 = RAISED & FIELDED    114 = VTG    116 = HTG
--
-- GlazePro mapped 110 to raised_and_fielded. The id came from the
-- French-door facts of Step BA, which label it "Raised & Fielded", and Steps
-- BD and BE repeated it — so every GlazePro front-door template was built
-- with RAISED AND FIELDED panels, and every front door it priced carried
-- "Additional for R&F Panel" 120 a panel where Integrate charges
-- "Additional for Flat Panel" 60.
--
-- NATHAN, 14 Oct (decision k): the door templates have FLAT panels, as
-- Integrate's do. So each template loses 60 minutes a panel:
--
--     Front Door (4 panels)              -240 min   -98.64
--     Front Door With Fanlight (1)        -60        -24.66
--     Arched Front Door (1)               -60        -24.66
--     Front Door With Side Light (5)     -300       -123.30
--
-- A drawing already made from one of these templates keeps its own tree and
-- its own panels: this changes what a NEW drawing starts with. A saved
-- drawing with R&F panels goes on pricing R&F, which is correct — it is what
-- somebody drew.
--
-- The trees were GENERATED from the board's own builders by
-- scripts/build-step-bd-sql.mjs (FRONT_DOOR_TEMPLATES in
-- src/drawingBoard/doorOpenings.js, whose DEFAULT_PANEL_VALUES is now flat).
--
-- RUN SECTION 0 FIRST.

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ════════════════════════════════════════════════════════════════════════════

-- 0a. The four templates and the panel type each one carries. Expect
--     "raised_and_fielded" on all four before this runs, "flat" after.
SELECT name, sort_order,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, '$.**.values.internalPanelTypeId') v) AS internal_panel,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, '$.**.values.externalPanelTypeId') v) AS external_panel,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "panelPart")'))             AS panels
FROM   public.drawing_templates
WHERE  group_name = 'Open In Doors'
ORDER  BY sort_order;

-- 0b. The panel option codes the trees will carry. Expect 'flat' to be an
--     active option in whatever category holds the panel types; if it is not,
--     STOP — a drawing would open on a panel the board cannot show.
SELECT category, code, label, sort_order, is_active
FROM   public.reference_options
WHERE  lower(label) IN ('flat', 'raised & fielded', 'raised and fielded')
   OR  code IN ('flat', 'raised_and_fielded')
ORDER  BY category, sort_order;

-- 0c. What is SAVED with raised-and-fielded panels, so the reviewer knows
--     which drawings keep them (this file does not touch a drawing).
SELECT p.drawing_id, count(*) AS rf_panels
FROM   public.drawing_parts p
WHERE  p.part_type = 'panelPart'
  AND  p.values ->> 'internalPanelTypeId' IN ('raised_and_fielded', '112')
GROUP  BY p.drawing_id
ORDER  BY p.drawing_id;

-- 0d. And what is saved FLAT, for the same reason.
SELECT p.drawing_id, count(*) AS flat_panels
FROM   public.drawing_parts p
WHERE  p.part_type = 'panelPart'
  AND  p.values ->> 'internalPanelTypeId' IN ('flat', '110')
GROUP  BY p.drawing_id
ORDER  BY p.drawing_id;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the four templates
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _profile_id uuid;
  _product    text;
  _templates  jsonb := '[{"name":"Front Door","sort_order":200,"tree":{"key":"item_som7az8","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_ksrth1j","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"custom","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":true,"isFrontDoor":true},"children":[]},{"key":"notes_mpmsr3n","part_type":"notesPart","values":{},"children":[]},{"key":"price_xtde7vr","part_type":"pricePart","values":{},"children":[]},{"key":"frame_34jn60s","part_type":"assemblyFramePart","values":{"width":1099,"height":2182,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":26,"rakeFrame":false,"archHead":false,"toBeReplaced":true},"children":[{"key":"doorleaf_rlbengw","part_type":"doorLeafPart","values":{"operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"stepped","mechanicalClearanceTop":3,"mechanicalClearanceLeft":4,"mechanicalClearanceRight":4,"mechanicalClearanceBottom":14,"defaultMuntinThickness":120,"archHead":false,"toBeReplaced":true},"children":[{"key":"doorleaf_rlbengw_muntin1","part_type":"mullionPart","values":{"isMuntin":true,"offset":329,"thicknessInFrame":120,"muntinThickness":120,"mullionStopSize":0,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"doorleaf_rlbengw_midrail1","part_type":"transomPart","values":{"isMidrail":true,"offset":983,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"doorleaf_rlbengw_panel1","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_rlbengw_panel2","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_rlbengw_panel3","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_rlbengw_panel4","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"cill_n3y1qal","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}},{"name":"Front Door With Fanlight","sort_order":210,"tree":{"key":"item_d7nuzev","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_ck4ro9j","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"custom","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":true,"isFrontDoor":true},"children":[]},{"key":"notes_9ekiyak","part_type":"notesPart","values":{},"children":[]},{"key":"price_2jm4x94","part_type":"pricePart","values":{},"children":[]},{"key":"frame_3ynf6co","part_type":"assemblyFramePart","values":{"width":1099,"height":2595,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":26,"rakeFrame":false,"archHead":false,"toBeReplaced":true},"children":[{"key":"trans_41dpdny","part_type":"transomPart","values":{"offset":431,"thicknessInFrame":41,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"dgu_0xegcxp","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3,"mechanicalClearanceTop":15,"mechanicalClearanceBottom":15,"mechanicalClearanceLeft":15,"mechanicalClearanceRight":15,"hiddenInRebateTop":15,"hiddenInRebateBottom":15,"hiddenInRebateLeft":15,"hiddenInRebateRight":15,"toBeReplaced":true},"children":[]},{"key":"doorleaf_psut7gg","part_type":"doorLeafPart","values":{"operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"stepped","mechanicalClearanceTop":3,"mechanicalClearanceLeft":4,"mechanicalClearanceRight":4,"mechanicalClearanceBottom":14,"defaultMuntinThickness":120,"archHead":false,"toBeReplaced":true},"children":[{"key":"doorleaf_psut7gg_midrail1","part_type":"transomPart","values":{"isMidrail":true,"offset":941,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"doorleaf_psut7gg_glass1","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3},"children":[]},{"key":"doorleaf_psut7gg_panel2","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"cill_yqgimj3","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}},{"name":"Arched Front Door","sort_order":220,"tree":{"key":"item_g3w7e33","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_iitk5gq","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"custom","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":true,"isFrontDoor":true},"children":[]},{"key":"notes_o4jvuwl","part_type":"notesPart","values":{},"children":[]},{"key":"price_19jq7cz","part_type":"pricePart","values":{},"children":[]},{"key":"frame_pdnk4rw","part_type":"assemblyFramePart","values":{"width":1099,"height":2199,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":26,"rakeFrame":false,"archHead":false,"toBeReplaced":true,"curvedFrameHead":true,"frameLevelArchHead":true,"frameLevelArchHeight":508.891,"frameLevelArchRadius":551.121,"archShoulderLeft":1690,"archShoulderRight":1690},"children":[{"key":"doorleaf_n6x8uht","part_type":"doorLeafPart","values":{"operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"stepped","mechanicalClearanceTop":3,"mechanicalClearanceLeft":4,"mechanicalClearanceRight":4,"mechanicalClearanceBottom":14,"defaultMuntinThickness":120,"archHead":true,"archHeight":345.92,"archRadius":391.12,"curvedSashHead":true,"shoulderHeight":1459.08,"toBeReplaced":true},"children":[{"key":"doorleaf_n6x8uht_midrail1","part_type":"transomPart","values":{"isMidrail":true,"offset":1103,"thicknessInFrame":120,"midrailThickness":120,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"doorleaf_n6x8uht_glass1","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3},"children":[]},{"key":"doorleaf_n6x8uht_panel2","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"cill_0n0pzqq","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}},{"name":"Front Door With Side Light","sort_order":230,"tree":{"key":"item_fqf1grw","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_r1tn94w","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"custom","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":true,"isFrontDoor":true},"children":[]},{"key":"notes_ibdzokp","part_type":"notesPart","values":{},"children":[]},{"key":"price_0h3ifxu","part_type":"pricePart","values":{},"children":[]},{"key":"frame_oyccdcq","part_type":"assemblyFramePart","values":{"width":1400,"height":2182,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":26,"rakeFrame":false,"archHead":false,"toBeReplaced":true},"children":[{"key":"mull_ljnfagc","part_type":"mullionPart","values":{"offset":900,"thicknessInFrame":41,"mullionStopSize":20},"children":[]},{"key":"doorleaf_9ydoidg","part_type":"doorLeafPart","values":{"operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"stepped","mechanicalClearanceTop":3,"mechanicalClearanceLeft":4,"mechanicalClearanceRight":4,"mechanicalClearanceBottom":14,"defaultMuntinThickness":120,"archHead":false,"toBeReplaced":true},"children":[{"key":"doorleaf_9ydoidg_muntin1","part_type":"mullionPart","values":{"isMuntin":true,"offset":276,"thicknessInFrame":120,"muntinThickness":120,"mullionStopSize":0,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"doorleaf_9ydoidg_midrail1","part_type":"transomPart","values":{"isMidrail":true,"offset":983,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"doorleaf_9ydoidg_panel1","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_9ydoidg_panel2","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_9ydoidg_panel3","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_9ydoidg_panel4","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"sidelight_mjich31","part_type":"casementSashPart","values":{"operation":"fix","casementTypeId":"open_in","thickness":54,"topHeight":62,"leftWidth":62,"rightWidth":62,"bottomHeight":175,"bottomHeightExternal":175,"btmRailShapeId":"stepped","mechanicalClearanceTop":3,"mechanicalClearanceBottom":3,"mechanicalClearanceLeft":3,"mechanicalClearanceRight":3,"toBeReplaced":true},"children":[{"key":"sidelight_mjich31_midrail","part_type":"transomPart","values":{"isMidrail":true,"offset":1031,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"sidelight_mjich31_glass","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3},"children":[]},{"key":"sidelight_mjich31_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"cill_ot6ueip","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}}]'::jsonb;
  _row        record;
  _tree       jsonb;
BEGIN
  SELECT id INTO _profile_id FROM public.default_profiles
  WHERE code = 'open_in_doors' AND is_active = TRUE;
  IF _profile_id IS NULL THEN
    RAISE EXCEPTION 'No active default_profiles row with code ''open_in_doors''';
  END IF;

  SELECT code INTO _product FROM public.reference_options
  WHERE category = 'product' AND lower(label) = 'door' AND is_active
  ORDER BY sort_order LIMIT 1;
  IF _product IS NULL THEN
    RAISE EXCEPTION 'No active reference_options row with category ''product'' and label ''Door''';
  END IF;

  IF jsonb_array_length(_templates) <> 4 THEN
    RAISE EXCEPTION 'Expected 4 templates in this script, found %', jsonb_array_length(_templates);
  END IF;

  FOR _row IN
    SELECT * FROM jsonb_to_recordset(_templates) AS x(name text, sort_order int, tree jsonb)
  LOOP
    _tree := jsonb_set(_row.tree, '{values,product}', to_jsonb(_product), true);

    -- The whole point of this file: every panel in it must be FLAT.
    IF jsonb_path_exists(_tree, '$.**.values ? (@.internalPanelTypeId == "raised_and_fielded")') THEN
      RAISE EXCEPTION 'Template "%" still has a raised-and-fielded panel — do not run this file', _row.name;
    END IF;
    IF NOT jsonb_path_exists(_tree, '$.**.values ? (@.internalPanelTypeId == "flat")') THEN
      RAISE EXCEPTION 'Template "%" has no flat panel at all — do not run this file', _row.name;
    END IF;
    IF NOT jsonb_path_exists(_tree, '$.**.values ? (@.isFrontDoor == true)') THEN
      RAISE EXCEPTION 'Template "%" is not marked isFrontDoor', _row.name;
    END IF;

    IF EXISTS (SELECT 1 FROM public.drawing_templates WHERE name = _row.name) THEN
      UPDATE public.drawing_templates
      SET tree = _tree, default_profile_id = _profile_id, window_type = 'Door',
          family = 'door', group_name = 'Open In Doors',
          sort_order = _row.sort_order, is_active = TRUE, updated_at = now()
      WHERE name = _row.name;
      RAISE NOTICE 'Step BF-1: % updated in place', _row.name;
    ELSE
      INSERT INTO public.drawing_templates
        (name, family, group_name, window_type, default_profile_id, tree, sort_order, is_active)
      VALUES (_row.name, 'door', 'Open In Doors', 'Door',
              _profile_id, _tree, _row.sort_order, TRUE);
      RAISE NOTICE 'Step BF-1: % created', _row.name;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ── Checks ──────────────────────────────────────────────────────────────

-- 1. Every panel in every front-door template is FLAT. Expect ["flat"] on
--    all four rows, and the panel counts 4 / 1 / 1 / 5.
SELECT name, sort_order,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, '$.**.values.internalPanelTypeId') v) AS internal_panel,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, '$.**.values.externalPanelTypeId') v) AS external_panel,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "panelPart")'))             AS panels
FROM   public.drawing_templates
WHERE  group_name = 'Open In Doors'
ORDER  BY sort_order;

-- 2. Nothing else about them moved: the mid rails (983 / 941 / 1103, and the
--    side light's 983 + 1031), the centred muntins (329 and 276), the frame
--    mullion at 900 and the fixed side light.
SELECT name, sort_order,
       (SELECT jsonb_agg(v ORDER BY v::text) FROM jsonb_path_query(tree, '$.**.values ? (@.isMidrail == true).offset') v) AS mid_rails,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values ? (@.isMuntin == true).offset') v)   AS muntins,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values ? (@.mullionStopSize == 20).offset') v) AS frame_mullion,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values ? (@.bottomHeight == 175).operation') v) AS side_light
FROM   public.drawing_templates
WHERE  group_name = 'Open In Doors'
ORDER  BY sort_order;

-- 3. And on /dev/pricing-benchmark, the four FT rows move to +6.28, -10.99,
--    +12.07 and +21.60, each the declared timber less the mid-rail minutes
--    Integrate charges and GlazePro does not. FD4 reads -49.32, PENDING a
--    reading of its panel ids. Nothing else on the page has a panel.


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- Re-running sql/step-be2 (and sql/step-bd3 before it) puts the
-- raised-and-fielded panels back, which is what GlazePro had while 110 was
-- mapped wrongly. There is no reason to want that; if a particular door
-- really does have R&F panels, it is a choice to make ON THE DRAWING, where
-- it belongs, not in the template.
