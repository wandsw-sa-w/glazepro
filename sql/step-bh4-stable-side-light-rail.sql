-- Step BH-4: "Stable Door With Side Light" — the side light's mid rail, TOP
-- EDGES LEVEL.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run.
-- Independent of sql/step-bh3. It re-issues ONE template (340, live id 40);
-- the other four Step BH templates are unchanged and this file does not
-- touch them.
--
-- NATHAN, 15 Oct: the TOP of the side light's 170 mid rail lines up with the
-- TOP of the stable door's meeting rail (the top half's 99 bottom rail).
-- Step BH aligned the CENTRES of the two bands — the door's join is 99 + 3 +
-- 99 = 201 deep against the side light's 170, so they cannot align on both
-- edges — and said so in its report. This is the decision.
--
-- The rail moves 16 mm UP:
--
--                        offset (glass above)   panel below
--     Step BH   centres          911                786
--     now       top edges        895                802
--
-- measured from the top of the frame's interior:
--     the meeting rail's top = 4 (container clearance) + 1055 (the stored
--                              split) - 99 = 960
--     the mid rail's top     = 3 (sash clearance) + 62 (sash head) + offset
--   so offset = 960 - 65 = 895, of the sash's 1867 interior.
--
-- WHAT IT IS WORTH: the side light's panel grows 16 mm, so its Tricoya line
-- goes 0.18471 m2 (£34.88) -> 0.18847 (£35.59) and the glass above it stays
-- at the 0.30 m2 minimum (£17.55). Drawing 58 reads 6,785.57 today and
-- 6,787.00 after this — +£1.43 of price.
--
-- A DRAWING ALREADY MADE from template 40 is not touched (drawing 58 is the
-- reviewer's). Either re-make it from the template, or type 895 into the side
-- light's mid rail Offset on the board — both give the same tree.
--
-- The tree was GENERATED from the board's own builders by
-- scripts/build-step-bh-sql.mjs (DOORSET_TEMPLATES in
-- src/drawingBoard/doorOpenings.js), so the template and the board cannot
-- disagree about where the rail goes.
--
-- RUN SECTION 0 FIRST.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. The template as it stands. Expect ONE row, "Stable Door With Side
--     Light", group Cottage Doors, sort_order 340.
SELECT t.id, t.name, t.group_name, t.window_type, t.sort_order, t.is_active,
       p.code AS profile_code
FROM   public.drawing_templates t
LEFT   JOIN public.default_profiles p ON p.id = t.default_profile_id
WHERE  t.name = 'Stable Door With Side Light';

-- 0b. Its side light's mid rail TODAY. Expect one transomPart inside the
--     casement sash, offset 911 (the centres); after this file, 895.
SELECT name,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree,
          'strict $.**.values ? (@.isMidrail == true).offset') v) AS mid_rail_offsets
FROM   public.drawing_templates
WHERE  name = 'Stable Door With Side Light';

-- 0c. The profile, as sql/step-bh2 read it.
SELECT id, code, is_active FROM public.default_profiles WHERE code = 'open_in_doors';

-- 0d. The product option.
SELECT category, code, label, is_active FROM public.reference_options
WHERE  category = 'product' AND lower(label) = 'door' ORDER BY sort_order;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the template
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _profile_id bigint;   -- default_profiles.id is bigint (reviewer, 14 Oct)
  _product    text;
  _templates  jsonb := '[{"name":"Stable Door With Side Light","sort_order":340,"group_name":"Cottage Doors","tree":{"key":"item_gtmybci","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_8w12w7d","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"clean_white","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":false,"isFrontDoor":false},"children":[]},{"key":"notes_4xm43vr","part_type":"notesPart","values":{},"children":[]},{"key":"price_05h6mng","part_type":"pricePart","values":{},"children":[]},{"key":"frame_ryhne6u","part_type":"assemblyFramePart","values":{"width":1505,"height":2207,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":0,"rakeFrame":false,"archHead":false,"toBeReplaced":true},"children":[{"key":"mull_bv6wa8k","part_type":"mullionPart","values":{"offset":1005,"thicknessInFrame":41,"mullionStopSize":20},"children":[]},{"key":"stable_7tyih9v","part_type":"stableDoorPart","values":{"thickness":58,"splitOffset":1055,"mechanicalClearanceTop":4,"mechanicalClearanceLeft":4,"mechanicalClearanceRight":4,"mechanicalClearanceBottom":3,"clearanceBetweenHalves":3,"toBeReplaced":true},"children":[{"key":"stable_7tyih9v_top","part_type":"doorLeafPart","values":{"stableHalf":"top","operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":99,"bottomHeightExternal":99,"btmRailShapeId":"stepped","archHead":false,"toBeReplaced":true},"children":[{"key":"stable_7tyih9v_top_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"stable_7tyih9v_bottom","part_type":"doorLeafPart","values":{"stableHalf":"bottom","operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":99,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"stepped","archHead":false,"toBeReplaced":true},"children":[{"key":"stable_7tyih9v_bottom_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]}]},{"key":"sidelight_fbhsy3j","part_type":"casementSashPart","values":{"operation":"fix","casementTypeId":"open_in","thickness":54,"topHeight":62,"leftWidth":62,"rightWidth":62,"bottomHeight":175,"bottomHeightExternal":175,"btmRailShapeId":"stepped","mechanicalClearanceTop":3,"mechanicalClearanceBottom":3,"mechanicalClearanceLeft":3,"mechanicalClearanceRight":3,"toBeReplaced":true},"children":[{"key":"sidelight_fbhsy3j_midrail","part_type":"transomPart","values":{"isMidrail":true,"offset":895,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"sidelight_fbhsy3j_glass","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3},"children":[]},{"key":"sidelight_fbhsy3j_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"cill_cgldnac","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}}]'::jsonb;
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

  IF jsonb_array_length(_templates) <> 1 THEN
    RAISE EXCEPTION 'Expected 1 template, found %', jsonb_array_length(_templates);
  END IF;

  FOR _row IN
    SELECT * FROM jsonb_to_recordset(_templates)
      AS x(name text, sort_order int, group_name text, tree jsonb)
  LOOP
    _tree := jsonb_set(_row.tree, '{values,product}', to_jsonb(_product), true);

    -- It must be the stable door with a side light, and the rail must be the
    -- 895 this file is for.
    IF NOT jsonb_path_exists(_tree, '$.**.part_type ? (@ == "stableDoorPart")') THEN
      RAISE EXCEPTION 'Template "%" has no stable-door container', _row.name;
    END IF;
    IF NOT jsonb_path_exists(_tree, '$.**.part_type ? (@ == "casementSashPart")') THEN
      RAISE EXCEPTION 'Template "%" has no side light', _row.name;
    END IF;
    IF NOT jsonb_path_exists(_tree, '$.**.values ? (@.isMidrail == true && @.offset == 895)') THEN
      RAISE EXCEPTION 'Template "%" does not carry the 895 mid rail this file is for', _row.name;
    END IF;

    IF EXISTS (SELECT 1 FROM public.drawing_templates WHERE name = _row.name) THEN
      UPDATE public.drawing_templates
      SET tree = _tree, default_profile_id = _profile_id, window_type = 'Door',
          family = 'door', group_name = _row.group_name,
          sort_order = _row.sort_order, is_active = TRUE, updated_at = now()
      WHERE name = _row.name;
      RAISE NOTICE 'Step BH-4: % updated in place', _row.name;
    ELSE
      INSERT INTO public.drawing_templates
        (name, family, group_name, window_type, default_profile_id, tree, sort_order, is_active)
      VALUES (_row.name, 'door', _row.group_name, 'Door',
              _profile_id, _tree, _row.sort_order, TRUE);
      RAISE NOTICE 'Step BH-4: % created', _row.name;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. The template, and its mid rail at 895.
SELECT name, sort_order, group_name, is_active,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree,
          'strict $.**.values ? (@.isMidrail == true).offset') v) AS mid_rail_offsets
FROM   public.drawing_templates
WHERE  name = 'Stable Door With Side Light';

-- 2. Nothing else moved: the other four Step BH templates are as bh2 left
--    them (250 / 260 carry their side lights' own 1031 / 1503 rails).
SELECT name, sort_order,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree,
          'strict $.**.values ? (@.isMidrail == true).offset') v) AS mid_rail_offsets
FROM   public.drawing_templates
WHERE  sort_order IN (240, 250, 260, 330, 340)
ORDER  BY sort_order;

-- 3. On a drawing made from it: the side light reads 895 of glass over an 802
--    panel, and the price is 6,787.00 (6,785.57 before this file).


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- The rollback is sql/step-bh2, which writes all five templates including
-- this one with the 911 rail. Running it again restores the lot.
