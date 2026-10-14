-- Step BE-2: the side light — containment, and the fourth front-door template.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run.
-- SECTION 1 first, then SECTION 2: save_drawing_parts refuses a sash that
-- holds a mid rail, so the template would be unusable without it.
--
-- NATHAN, 14 Oct 2026 (decision g): a front door's SIDE LIGHT is a FIXED
-- CASEMENT SASH in the door frame — not the fixed door leaf decision c had
-- guessed — and it carries the same grid a leaf does: a mid rail, glass above
-- it and a raised-and-fielded panel below, with the rail LINING UP with the
-- door's. His own drawing 20 is the reading (docs/integrate-L31115-front-doors.txt).
--
-- SECTION 1 — three containment pairs, so a sash can hold a grid:
--     casementSashPart -> transomPart    (its mid rail)
--     casementSashPart -> panelPart      (the panel below it)
--     casementSashPart -> mullionPart    (a muntin, for the same reason a
--                                         leaf can have one)
--
-- SECTION 2 — the template "Front Door With Side Light", sort_order 230,
-- group "Open In Doors", after the arched one. One 1400 x 2182 frame with a
-- 41 mullion at 900: Integrate's Balham leaf in the 900 column (983 / 635,
-- muntin centred — decision f) and a fixed sash in the 365 one.
--
-- WHERE ITS MID RAIL SITS, and why the number is 1031: a divider's offset is
-- the span BEFORE it, so what is stored is the GLASS above the rail. The
-- door's rail stands 14 + 170 + 635 = 819 above the bottom of the opening
-- (its leaf drops 14 into the frame, its bottom rail is 170, its bottom panel
-- 635). The sash drops 3 and has a 175 rail, so its panel must be 641 for its
-- rail to reach the same 819 — and its 1842 interior less the 170 rail less
-- that 641 leaves 1031 of glass. Integrate's own drawing 20 instead makes the
-- two PANELS equal (834 both sides) and leaves the rails 6 mm apart; the
-- reviewer asked for the rails to meet, so that is what the template does.
--
-- The tree was GENERATED from the board's own builders by
-- scripts/build-step-bd-sql.mjs (FRONT_DOOR_TEMPLATES in
-- src/drawingBoard/doorOpenings.js), as the other three were.
--
-- RE-ISSUED 14 Oct 2026, SECTION 2 only. The template as first issued (id
-- 32, the reviewer's drawing 47) stored the door's MUNTIN at 479 — centred
-- for the 1298-wide leaf the door had BEFORE the side light took 465 mm of
-- the frame — so its panels read 479 / 73 of a 672 interior. The grid was
-- built first and the leaf narrowed afterwards, and nothing re-read it.
--
-- The muntin is now CENTRED IN ITS OWN LEAF at 276 (276 / 276), and the
-- board re-centres an EVEN grid whenever the leaf is resized. The MID RAILS
-- do not move: a lock rail’s height is a decision (983 on the door,
-- Integrate’s Balham; 1031 on the sash so the two meet), not a proportion.
--
-- SECTION 1 is unchanged and may already be live; it is safe to re-run.
-- A drawing already made from the template keeps its own tree, so drawing
-- 47 has to be re-made from it to pick the muntin up.
--
-- RUN SECTION 0 FIRST.

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ════════════════════════════════════════════════════════════════════════════

-- 0a. What a casement sash may hold today. Expect glassPart only.
SELECT parent_code, child_code, min_count, max_count, sort_order
FROM   part_type_children
WHERE  parent_code = 'casementSashPart'
ORDER  BY sort_order, child_code;

-- 0b. The same three pairs on a DOOR LEAF, which is what this copies
--     (sql/step-bd2 added the muntin there). Expect all four at 0..NULL.
SELECT parent_code, child_code, min_count, max_count
FROM   part_type_children
WHERE  parent_code = 'doorLeafPart'
ORDER  BY child_code;

-- 0c. The three front-door templates, and that 230 is free. Expect 200 / 210
--     / 220 and no 230.
SELECT name, group_name, window_type, sort_order, is_active
FROM   public.drawing_templates
WHERE  group_name = 'Open In Doors'
ORDER  BY sort_order;

-- 0d. The profile and the product option the template needs.
SELECT id, code, is_active FROM public.default_profiles WHERE code = 'open_in_doors';
SELECT category, code, label, is_active FROM public.reference_options
WHERE  category = 'product' AND lower(label) = 'door' ORDER BY sort_order;

-- 0e. Anything SAVED that already has a sash holding a panel or a mid rail —
--     there should be none, because it could not have saved.
SELECT p.drawing_id, s.id AS sash_part_id, p.part_type, count(*)
FROM   public.drawing_parts p
JOIN   public.drawing_parts s ON s.id = p.parent_part_id
WHERE  s.part_type = 'casementSashPart'
  AND  p.part_type IN ('panelPart', 'transomPart', 'mullionPart')
GROUP  BY p.drawing_id, s.id, p.part_type
ORDER  BY p.drawing_id;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — a sash can hold a grid
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

INSERT INTO part_type_children (parent_code, child_code, min_count, max_count, sort_order)
VALUES
  ('casementSashPart', 'transomPart', 0, NULL, 15),
  ('casementSashPart', 'panelPart',   0, NULL, 30),
  ('casementSashPart', 'mullionPart', 0, NULL, 16)
ON CONFLICT (parent_code, child_code) DO NOTHING;

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — the template
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _profile_id bigint;
  _product    text;
  _templates  jsonb := '[{"name":"Front Door With Side Light","sort_order":230,"tree":{"key":"item_i8qeekz","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_aekzr7s","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"custom","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":true,"isFrontDoor":true},"children":[]},{"key":"notes_q5lzv9g","part_type":"notesPart","values":{},"children":[]},{"key":"price_21oip80","part_type":"pricePart","values":{},"children":[]},{"key":"frame_xpb3zw8","part_type":"assemblyFramePart","values":{"width":1400,"height":2182,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":26,"rakeFrame":false,"archHead":false,"toBeReplaced":true},"children":[{"key":"mull_45jxfyg","part_type":"mullionPart","values":{"offset":900,"thicknessInFrame":41,"mullionStopSize":20},"children":[]},{"key":"doorleaf_zy9pshe","part_type":"doorLeafPart","values":{"operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"stepped","mechanicalClearanceTop":3,"mechanicalClearanceLeft":4,"mechanicalClearanceRight":4,"mechanicalClearanceBottom":14,"defaultMuntinThickness":120,"archHead":false,"toBeReplaced":true},"children":[{"key":"doorleaf_zy9pshe_muntin1","part_type":"mullionPart","values":{"isMuntin":true,"offset":276,"thicknessInFrame":120,"muntinThickness":120,"mullionStopSize":0,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"doorleaf_zy9pshe_midrail1","part_type":"transomPart","values":{"isMidrail":true,"offset":983,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"doorleaf_zy9pshe_panel1","part_type":"panelPart","values":{"internalPanelTypeId":"raised_and_fielded","externalPanelTypeId":"raised_and_fielded","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_zy9pshe_panel2","part_type":"panelPart","values":{"internalPanelTypeId":"raised_and_fielded","externalPanelTypeId":"raised_and_fielded","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_zy9pshe_panel3","part_type":"panelPart","values":{"internalPanelTypeId":"raised_and_fielded","externalPanelTypeId":"raised_and_fielded","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_zy9pshe_panel4","part_type":"panelPart","values":{"internalPanelTypeId":"raised_and_fielded","externalPanelTypeId":"raised_and_fielded","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"sidelight_st9dje9","part_type":"casementSashPart","values":{"operation":"fix","casementTypeId":"open_in","thickness":54,"topHeight":62,"leftWidth":62,"rightWidth":62,"bottomHeight":175,"bottomHeightExternal":175,"btmRailShapeId":"stepped","mechanicalClearanceTop":3,"mechanicalClearanceBottom":3,"mechanicalClearanceLeft":3,"mechanicalClearanceRight":3,"toBeReplaced":true},"children":[{"key":"sidelight_st9dje9_midrail","part_type":"transomPart","values":{"isMidrail":true,"offset":1031,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"sidelight_st9dje9_glass","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3},"children":[]},{"key":"sidelight_st9dje9_panel","part_type":"panelPart","values":{"internalPanelTypeId":"raised_and_fielded","externalPanelTypeId":"raised_and_fielded","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"cill_jdidgan","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}}]'::jsonb;
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

  -- SECTION 1 has to be in, or a drawing made from this template cannot save.
  IF NOT EXISTS (
    SELECT 1 FROM part_type_children
    WHERE parent_code = 'casementSashPart' AND child_code = 'panelPart'
  ) THEN
    RAISE EXCEPTION 'casementSashPart -> panelPart is not allowed yet — run SECTION 1 of this file first';
  END IF;

  FOR _row IN
    SELECT * FROM jsonb_to_recordset(_templates) AS x(name text, sort_order int, tree jsonb)
  LOOP
    _tree := jsonb_set(_row.tree, '{values,product}', to_jsonb(_product), true);

    -- It must BE a front door with a FIXED SASH beside the leaf, or it is not
    -- the drawing Nathan asked for.
    IF NOT jsonb_path_exists(_tree, '$.**.values ? (@.isFrontDoor == true)') THEN
      RAISE EXCEPTION 'Template "%" is not marked isFrontDoor — do not run this file', _row.name;
    END IF;
    IF NOT jsonb_path_exists(_tree, '$.**.values ? (@.operation == "fix" && @.bottomHeight == 175)') THEN
      RAISE EXCEPTION 'Template "%" has no fixed side light — do not run this file', _row.name;
    END IF;

    IF EXISTS (SELECT 1 FROM public.drawing_templates WHERE name = _row.name) THEN
      UPDATE public.drawing_templates
      SET tree = _tree, default_profile_id = _profile_id, window_type = 'Door',
          family = 'door', group_name = 'Open In Doors',
          sort_order = _row.sort_order, is_active = TRUE, updated_at = now()
      WHERE name = _row.name;
      RAISE NOTICE 'Step BE-2: % updated in place', _row.name;
    ELSE
      INSERT INTO public.drawing_templates
        (name, family, group_name, window_type, default_profile_id, tree, sort_order, is_active)
      VALUES (_row.name, 'door', 'Open In Doors', 'Door',
              _profile_id, _tree, _row.sort_order, TRUE);
      RAISE NOTICE 'Step BE-2: % created', _row.name;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ── Checks ──────────────────────────────────────────────────────────────

-- 1. The three pairs. Expect three rows, max_count NULL.
SELECT parent_code, child_code, min_count, max_count
FROM   part_type_children
WHERE  parent_code = 'casementSashPart'
ORDER  BY child_code;

-- 2. The four front-door templates. Expect 200 / 210 / 220 / 230.
SELECT name, group_name, window_type, sort_order, is_active
FROM   public.drawing_templates
WHERE  group_name = 'Open In Doors'
ORDER  BY sort_order;

-- 3. What the new one holds: one door leaf, one FIXED sash, five panels
--    (four in the door, one in the sash), two mullions (the frame's 41 and
--    the leaf's 120 muntin) and two mid rails.
SELECT name,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "doorLeafPart")'))     AS leaves,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "casementSashPart")')) AS sashes,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "panelPart")'))        AS panels,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "mullionPart")'))      AS mullions,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "transomPart")'))      AS mid_rails,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.part_type ? (@ == "cillPart")'))         AS cills
FROM   public.drawing_templates
WHERE  name = 'Front Door With Side Light';

-- 3b. The muntin, centred in the LEAF and not in the frame. Expect [276]
--     — NOT 479, which is what the first issue stored.
SELECT name,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values ? (@.isMuntin == true).offset') v) AS muntin_offset
FROM   public.drawing_templates
WHERE  name = 'Front Door With Side Light';

-- 4. The figures that matter: the frame mullion at 900, the door's mid rail
--    at 983 (Integrate's Balham) and the sash's at 1031 (so the two rails
--    meet), the muntin centred at 329, and the sash fixed with a 175 rail.
SELECT name,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values ? (@.mullionStopSize == 20).offset') v)   AS frame_mullion,
       (SELECT jsonb_agg(v ORDER BY v::text) FROM jsonb_path_query(tree, '$.**.values ? (@.isMidrail == true).offset') v) AS mid_rails,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values ? (@.isMuntin == true).offset') v)        AS muntin,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values ? (@.bottomHeight == 175).operation') v)  AS side_light
FROM   public.drawing_templates
WHERE  name = 'Front Door With Side Light';

-- 5. And on the board: a drawing made from it should price 3,3xx (the FT4
--    benchmark's own GlazePro figure plus the ironmongery a NEW door
--    carries), with five Tricoya panels and one glass unit.


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- The template first: deleting it does not touch a drawing made from it.
--
-- BEGIN;
-- DELETE FROM public.drawing_templates WHERE name = 'Front Door With Side Light';
-- COMMIT;
--
-- The containment second, and ONLY if no drawing has saved a sash with a
-- grid (SECTION 0e is the query): taking the pairs away makes every such
-- drawing unsaveable.
--
-- BEGIN;
-- DELETE FROM part_type_children
-- WHERE  parent_code = 'casementSashPart'
--   AND  child_code IN ('transomPart', 'panelPart', 'mullionPart');
-- COMMIT;
