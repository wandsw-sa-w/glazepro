-- Step BF-4: the three STABLE DOOR templates.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run.
-- Run AFTER sql/step-bf2 (the containment) — without it a drawing made from
-- one of these cannot be saved.
--
-- Group "Cottage Doors", product "Door", range open_in_doors, all three at
-- Integrate's own 1099 x 2207. Nathan's decision h — he sells all three:
--
--   Stable Door                   4553   panelled both halves
--   Stable Door Glazed Top        —      glass over the top half, panel below
--                                        (Integrate has NO such template)
--   Stable Door With Vision Panel 6618   a 200 x 350 light in the top panel
--
-- Each is one stableDoorPart in the frame holding a TOP and a BOTTOM half,
-- the split stored at 1055 (Integrate's own: the top half is 7 mm taller than
-- the bottom, and nothing says why). The halves' rails are 110 / 99 and
-- 99 / 170, so the cells are 777 x 846 and 777 x 779 — Integrate's own panel
-- sizes, 0.66 and 0.61 m2.
--
-- SINGLE finish (Clean White both sides and the cill — Nathan's decision i),
-- isFrontDoor false, isDoorMpls FALSE (a stable door has no multipoint lock;
-- with the flag true the allocator gives each half a Winkhaus Thunderbolt,
-- 107.10 on a door whose whole stored set is 88.20), and the panels are FLAT
-- (decision k — Integrate's type 110).
--
-- NO stored ironmongery: sql/step-bf3 is where a new stable door's set comes
-- from.
--
-- The trees were GENERATED from the board's own builders by
-- scripts/build-step-bf-sql.mjs (STABLE_DOOR_TEMPLATES in
-- src/drawingBoard/doorOpenings.js).
--
-- RUN SECTION 0 FIRST.

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ════════════════════════════════════════════════════════════════════════════

-- 0a. The profile. Expect ONE active row, code 'open_in_doors'.
SELECT id, code, is_active FROM public.default_profiles WHERE code = 'open_in_doors';

-- 0b. The containment sql/step-bf2 adds. Expect a stableDoorPart -> doorLeafPart
--     row; if it is not there, STOP and run sql/step-bf2 first.
SELECT parent_code, child_code, min_count, max_count
FROM   part_type_children
WHERE  parent_code IN ('stableDoorPart', 'panelPart')
   OR  (parent_code = 'assemblyFramePart' AND child_code = 'stableDoorPart')
ORDER  BY parent_code, child_code;

-- 0c. What is in the "Cottage Doors" group today. Expect 0 rows, and 300-320
--     free.
SELECT name, group_name, window_type, sort_order, is_active
FROM   public.drawing_templates
WHERE  group_name = 'Cottage Doors' OR sort_order BETWEEN 300 AND 320
ORDER  BY sort_order;

-- 0d. The product option, and that each name is unique (there is no unique
--     index on drawing_templates.name, so this file matches by hand).
SELECT category, code, label, is_active FROM public.reference_options
WHERE  category = 'product' AND lower(label) = 'door' ORDER BY sort_order;

SELECT name, count(*) AS rows_with_this_name
FROM   public.drawing_templates
WHERE  name IN ('Stable Door', 'Stable Door Glazed Top', 'Stable Door With Vision Panel')
GROUP  BY name;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the three templates
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _profile_id uuid;
  _product    text;
  _templates  jsonb := '[{"name":"Stable Door","sort_order":300,"tree":{"key":"item_ypyfhfv","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_id33avl","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"clean_white","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":false,"isFrontDoor":false},"children":[]},{"key":"notes_qdog4ve","part_type":"notesPart","values":{},"children":[]},{"key":"price_81uka3s","part_type":"pricePart","values":{},"children":[]},{"key":"frame_yv46bw1","part_type":"assemblyFramePart","values":{"width":1099,"height":2207,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":26,"rakeFrame":false,"archHead":false,"toBeReplaced":true},"children":[{"key":"stable_rkfb9bi","part_type":"stableDoorPart","values":{"thickness":58,"splitOffset":1055,"mechanicalClearanceTop":4,"mechanicalClearanceLeft":4,"mechanicalClearanceRight":4,"mechanicalClearanceBottom":3,"clearanceBetweenHalves":3,"toBeReplaced":true},"children":[{"key":"stable_rkfb9bi_top","part_type":"doorLeafPart","values":{"stableHalf":"top","operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":99,"bottomHeightExternal":99,"btmRailShapeId":"stepped","archHead":false,"toBeReplaced":true},"children":[{"key":"stable_rkfb9bi_top_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"stable_rkfb9bi_bottom","part_type":"doorLeafPart","values":{"stableHalf":"bottom","operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":99,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"stepped","archHead":false,"toBeReplaced":true},"children":[{"key":"stable_rkfb9bi_bottom_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]}]},{"key":"cill_6u6snqu","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}},{"name":"Stable Door Glazed Top","sort_order":310,"tree":{"key":"item_my9r0vk","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_5mpq2z0","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"clean_white","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":false,"isFrontDoor":false},"children":[]},{"key":"notes_q1w8l5z","part_type":"notesPart","values":{},"children":[]},{"key":"price_8byrsur","part_type":"pricePart","values":{},"children":[]},{"key":"frame_5fahe32","part_type":"assemblyFramePart","values":{"width":1099,"height":2207,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":26,"rakeFrame":false,"archHead":false,"toBeReplaced":true},"children":[{"key":"stable_gts5cup","part_type":"stableDoorPart","values":{"thickness":58,"splitOffset":1055,"mechanicalClearanceTop":4,"mechanicalClearanceLeft":4,"mechanicalClearanceRight":4,"mechanicalClearanceBottom":3,"clearanceBetweenHalves":3,"toBeReplaced":true},"children":[{"key":"stable_gts5cup_top","part_type":"doorLeafPart","values":{"stableHalf":"top","operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":99,"bottomHeightExternal":99,"btmRailShapeId":"stepped","archHead":false,"toBeReplaced":true},"children":[{"key":"stable_gts5cup_top_glass","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3},"children":[]}]},{"key":"stable_gts5cup_bottom","part_type":"doorLeafPart","values":{"stableHalf":"bottom","operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":99,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"stepped","archHead":false,"toBeReplaced":true},"children":[{"key":"stable_gts5cup_bottom_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]}]},{"key":"cill_0xz6oqh","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}},{"name":"Stable Door With Vision Panel","sort_order":320,"tree":{"key":"item_sley36z","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_3d3zki6","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"clean_white","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":false,"isFrontDoor":false},"children":[]},{"key":"notes_bqbq1cx","part_type":"notesPart","values":{},"children":[]},{"key":"price_kw2o39i","part_type":"pricePart","values":{},"children":[]},{"key":"frame_ynef76o","part_type":"assemblyFramePart","values":{"width":1099,"height":2207,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":26,"rakeFrame":false,"archHead":false,"toBeReplaced":true},"children":[{"key":"stable_siybwmk","part_type":"stableDoorPart","values":{"thickness":58,"splitOffset":1055,"mechanicalClearanceTop":4,"mechanicalClearanceLeft":4,"mechanicalClearanceRight":4,"mechanicalClearanceBottom":3,"clearanceBetweenHalves":3,"toBeReplaced":true},"children":[{"key":"stable_siybwmk_top","part_type":"doorLeafPart","values":{"stableHalf":"top","operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":99,"bottomHeightExternal":99,"btmRailShapeId":"stepped","archHead":false,"toBeReplaced":true},"children":[{"key":"stable_siybwmk_top_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[{"key":"stable_siybwmk_top_vision","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3,"visionPanelWidth":200,"visionPanelHeight":350,"isVisionPanel":true,"toBeReplaced":true},"children":[]}]}]},{"key":"stable_siybwmk_bottom","part_type":"doorLeafPart","values":{"stableHalf":"bottom","operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":99,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"stepped","archHead":false,"toBeReplaced":true},"children":[{"key":"stable_siybwmk_bottom_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]}]},{"key":"cill_ulpg54y","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}}]'::jsonb;
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

  IF NOT EXISTS (
    SELECT 1 FROM part_type_children
    WHERE parent_code = 'stableDoorPart' AND child_code = 'doorLeafPart'
  ) THEN
    RAISE EXCEPTION 'stableDoorPart -> doorLeafPart is not allowed yet — run sql/step-bf2 first';
  END IF;

  IF jsonb_array_length(_templates) <> 3 THEN
    RAISE EXCEPTION 'Expected 3 templates, found %', jsonb_array_length(_templates);
  END IF;

  FOR _row IN
    SELECT * FROM jsonb_to_recordset(_templates) AS x(name text, sort_order int, tree jsonb)
  LOOP
    _tree := jsonb_set(_row.tree, '{values,product}', to_jsonb(_product), true);

    -- It must BE a stable door, with two halves and no multipoint lock.
    IF NOT jsonb_path_exists(_tree, '$.**.part_type ? (@ == "stableDoorPart")') THEN
      RAISE EXCEPTION 'Template "%" has no stable-door container', _row.name;
    END IF;
    IF (SELECT count(*) FROM jsonb_path_query(_tree, '$.**.values.stableHalf')) <> 2 THEN
      RAISE EXCEPTION 'Template "%" does not have exactly two halves', _row.name;
    END IF;
    IF jsonb_path_exists(_tree, '$.**.values ? (@.isDoorMpls == true)') THEN
      RAISE EXCEPTION 'Template "%" is marked isDoorMpls — a stable door has no multipoint lock', _row.name;
    END IF;
    IF jsonb_path_exists(_tree, '$.**.values ? (@.internalPanelTypeId == "raised_and_fielded")') THEN
      RAISE EXCEPTION 'Template "%" has a raised-and-fielded panel; Integrate''s are FLAT', _row.name;
    END IF;

    IF EXISTS (SELECT 1 FROM public.drawing_templates WHERE name = _row.name) THEN
      UPDATE public.drawing_templates
      SET tree = _tree, default_profile_id = _profile_id, window_type = 'Door',
          family = 'door', group_name = 'Cottage Doors',
          sort_order = _row.sort_order, is_active = TRUE, updated_at = now()
      WHERE name = _row.name;
      RAISE NOTICE 'Step BF-4: % updated in place', _row.name;
    ELSE
      INSERT INTO public.drawing_templates
        (name, family, group_name, window_type, default_profile_id, tree, sort_order, is_active)
      VALUES (_row.name, 'door', 'Cottage Doors', 'Door',
              _profile_id, _tree, _row.sort_order, TRUE);
      RAISE NOTICE 'Step BF-4: % created', _row.name;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ── Checks ──────────────────────────────────────────────────────────────

-- 1. The three rows, in the Cottage Doors group at 300 / 310 / 320.
SELECT t.name, t.group_name, t.window_type, t.sort_order, t.is_active,
       p.code AS profile_code
FROM   public.drawing_templates t
LEFT   JOIN public.default_profiles p ON p.id = t.default_profile_id
WHERE  t.group_name = 'Cottage Doors'
ORDER  BY t.sort_order;

-- 2. What each tree holds. Expect two halves on all three; panels 2 / 1 / 2;
--    glass 0 / 1 / 1 (the glazed top, and the vision panel).
SELECT name, sort_order,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "stableDoorPart")')) AS containers,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.values.stableHalf'))                   AS halves,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "panelPart")'))       AS panels,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "glassPart")'))       AS glass,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.values ? (@.isVisionPanel == true)'))   AS vision_panels
FROM   public.drawing_templates
WHERE  group_name = 'Cottage Doors'
ORDER  BY sort_order;

-- 3. The figures that drive the price: the split at 1055, the halves' rails
--    (110 / 99 and 99 / 170), the single finish, the 50 cill, FLAT panels and
--    no multipoint lock.
SELECT name,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values.splitOffset') v)            AS split,
       (SELECT jsonb_agg(v ORDER BY v::text) FROM jsonb_path_query(tree, '$.**.values ? (@.stableHalf != null).topHeight') v)    AS half_top_rails,
       (SELECT jsonb_agg(v ORDER BY v::text) FROM jsonb_path_query(tree, '$.**.values ? (@.stableHalf != null).bottomHeight') v) AS half_bottom_rails,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, '$.**.values.internalFinish') v) AS internal_finish,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, '$.**.values.externalFinish') v) AS external_finish,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, '$.**.values.internalPanelTypeId') v) AS panel_type,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values.isDoorMpls') v)              AS mpls
FROM   public.drawing_templates
WHERE  group_name = 'Cottage Doors'
ORDER  BY sort_order;

-- 4. And a drawing made from one should price, offline, 2,660.37 (panelled),
--    2,598.87 (vision panel) or 2,563.03 (glazed top) with INTEGRATE's stored
--    ironmongery — and 14.70 more with the default set sql/step-bf3 gives a
--    new one (two hinge pairs instead of one).


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- Deleting a template does not touch a drawing made from it.
--
-- BEGIN;
-- DELETE FROM public.drawing_templates
-- WHERE name IN ('Stable Door', 'Stable Door Glazed Top', 'Stable Door With Vision Panel');
-- COMMIT;
