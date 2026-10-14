-- Step BH-2: the five DOORSET templates — a pair of front doors, a front
-- door with side lights and a fanlight (both constructions), and a stable
-- door with a fanlight or a side light.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run.
-- Run AFTER sql/step-bf2 (the stable-door containment); sql/step-bh1 (the
-- master lock) is independent and can run before or after.
--
-- Nathan, 14 Oct: EVERY doorset can have side lights, top lights and flag
-- windows. These are the five he sells as TEMPLATES, so a surveyor starts
-- from the drawing; anything else is built on the board from any door, which
-- Step BH also made possible (a divider beside or above a door used to throw).
--
--   240  Pair Of Front Doors                                  1500 x 2182
--   250  Front Door With Side Lights And Fanlight             1806 x 2654
--   260  Front Door With Side Lights And Fanlight Over Door   1806 x 2654
--   330  Stable Door With Fanlight                            1099 x 2679
--   340  Stable Door With Side Light                          1505 x 2207
--
-- Groups: 240-260 "Open In Doors" (as the front doors), 330-340 "Cottage
-- Doors" (as the stable doors). All five are range open_in_doors, product
-- "Door", window_type "Door".
--
-- INTEGRATE HAS NO TEMPLATE FOR ANY OF THEM, and building one by hand on its
-- board is impractical. So none of these sizes or layouts is a reading: each
-- is a composition of parts already matched penny for penny — the open-in
-- pair (OI1), the panelled leaves (FD4), the front door and its direct-glazed
-- fanlight (FT1 / FT2), the fixed casement side light (FT4, Nathan's drawing
-- 20), the doorset's three units over (FD5) and the stable doors (ST1-ST3,
-- SO1). Integrate's rules for them are general, and
-- docs/reports/step-bh.md lists every rule each one fires, with its
-- quantity, for checking by hand.
--
-- WHAT EACH ONE IS:
--
--  240  two open-in leaves in one frenchDoorPart, master RIGHT; each leaf a
--       170 mid rail with ONE FLAT PANEL above and below (983 / 635 of the
--       1788 interior, Integrate's Balham lock-rail height) and no muntin.
--       isFrontDoor TRUE and the DUAL finish, so fitting rule 0 "Front Door
--       and Frame" 840 fires and rule 11 "French Doors" 780 does not.
--  250  the door in a 900 column with a 365 side light each side (two 41
--       mullions), and a 41 transom across the FULL width with the mullions
--       running through it — THREE direct glazed fanlights over, as FD5.
--  260  the same, but the transom STOPS at the two mullions: the side lights
--       run full height and there is ONE fanlight, over the door.
--  330  the stable door with a 41 transom and a direct glazed fanlight over;
--       the door's own cell is the 2110 it always was, so the container is
--       2103 and the halves 1055 / 1048 — ST1's figures exactly.
--  340  the stable door with a 41 mullion and a fixed casement side light
--       (glass over a FLAT panel) in a 365 column; its 170 mid rail is level
--       with the stable door's meeting rails (centre to centre: offset 911).
--
-- NO stored ironmongery on any of them: the live default rules give the set —
-- the front-door set on 240-260 (and sql/step-bh1 stops the French master
-- lock joining it) and the stable-door set of sql/step-bf3 on 330-340.
--
-- The trees were GENERATED from the board's own builders by
-- scripts/build-step-bh-sql.mjs (DOORSET_TEMPLATES in
-- src/drawingBoard/doorOpenings.js).
--
-- RUN SECTION 0 FIRST.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. The profile. Expect ONE active row, code 'open_in_doors'.
SELECT id, code, is_active FROM public.default_profiles WHERE code = 'open_in_doors';

-- 0b. The containment every one of these needs. Expect rows for
--     assemblyFramePart -> casementSashPart / glassPart / mullionPart /
--     transomPart, stableDoorPart -> doorLeafPart, casementSashPart ->
--     transomPart / panelPart, and the French leaf -> transomPart / panelPart.
--     If the stable-door ones are missing, STOP and run sql/step-bf2 first.
SELECT parent_code, child_code, min_count, max_count
FROM   part_type_children
WHERE  (parent_code = 'assemblyFramePart' AND child_code IN
          ('casementSashPart', 'glassPart', 'mullionPart', 'transomPart',
           'stableDoorPart', 'doorLeafPart', 'frenchDoorPart'))
   OR  (parent_code = 'stableDoorPart')
   OR  (parent_code = 'casementSashPart' AND child_code IN ('transomPart', 'panelPart', 'glassPart'))
   OR  (parent_code IN ('leftFrenchDoorLeafPart', 'rightFrenchDoorLeafPart'))
ORDER  BY parent_code, child_code;

-- 0c. What is in the two groups today, and that 240-260 / 330-340 are free.
--     Expect the four front doors (200-230) and the three stable doors
--     (300-320), and nothing at the new numbers.
SELECT name, group_name, window_type, sort_order, is_active
FROM   public.drawing_templates
WHERE  group_name IN ('Open In Doors', 'Cottage Doors')
    OR sort_order BETWEEN 240 AND 340
ORDER  BY sort_order;

-- 0d. The product option, and that each new name is free (there is no unique
--     index on drawing_templates.name, so this file matches by hand).
SELECT category, code, label, is_active FROM public.reference_options
WHERE  category = 'product' AND lower(label) = 'door' ORDER BY sort_order;

SELECT name, count(*) AS rows_with_this_name
FROM   public.drawing_templates
WHERE  name IN ('Pair Of Front Doors',
                'Front Door With Side Lights And Fanlight',
                'Front Door With Side Lights And Fanlight Over Door',
                'Stable Door With Fanlight',
                'Stable Door With Side Light')
GROUP  BY name;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the five templates
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _profile_id bigint;   -- default_profiles.id is bigint (reviewer, 14 Oct)
  _product    text;
  _templates  jsonb := '[{"name":"Pair Of Front Doors","sort_order":240,"group_name":"Open In Doors","tree":{"key":"item_m0lvacd","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_e7omxun","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"custom","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":true,"isFrontDoor":true},"children":[]},{"key":"notes_12x132o","part_type":"notesPart","values":{},"children":[]},{"key":"price_fqr21p9","part_type":"pricePart","values":{},"children":[]},{"key":"frame_ontnwva","part_type":"assemblyFramePart","values":{"width":1500,"height":2182,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":0,"rakeFrame":false,"archHead":false,"toBeReplaced":true},"children":[{"key":"frenchdoor_0bv126i","part_type":"frenchDoorPart","values":{"casementTypeId":"open_in","thickness":54,"midRail":198,"gapBetweenMeetingStiles":5,"meetingStileOverlap":27,"mechanicalClearanceTop":3,"mechanicalClearanceBottom":14,"mechanicalClearanceLeft":3,"mechanicalClearanceRight":3,"masterLeaf":"right"},"children":[{"key":"frenchdoor_0bv126i_left","part_type":"leftFrenchDoorLeafPart","values":{"operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"square","isMasterLeaf":false,"toBeReplaced":true},"children":[{"key":"frenchdoor_0bv126i_left_midrail1","part_type":"transomPart","values":{"isMidrail":true,"offset":983,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"frenchdoor_0bv126i_left_panel1","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"frenchdoor_0bv126i_left_panel2","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"frenchdoor_0bv126i_right","part_type":"rightFrenchDoorLeafPart","values":{"operation":"right_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"square","isMasterLeaf":true,"toBeReplaced":true},"children":[{"key":"frenchdoor_0bv126i_right_midrail1","part_type":"transomPart","values":{"isMidrail":true,"offset":983,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"frenchdoor_0bv126i_right_panel1","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"frenchdoor_0bv126i_right_panel2","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]}]},{"key":"cill_smfe0hw","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}},{"name":"Front Door With Side Lights And Fanlight","sort_order":250,"group_name":"Open In Doors","tree":{"key":"item_egckmfb","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_12v2kvz","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"custom","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":true,"isFrontDoor":true},"children":[]},{"key":"notes_lk0xbz7","part_type":"notesPart","values":{},"children":[]},{"key":"price_um7z7cv","part_type":"pricePart","values":{},"children":[]},{"key":"frame_wsjzzfi","part_type":"assemblyFramePart","values":{"width":1806,"height":2654,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":0,"rakeFrame":false,"archHead":false,"toBeReplaced":true},"children":[{"key":"mull_37veagy","part_type":"mullionPart","values":{"offset":365,"thicknessInFrame":41,"mullionStopSize":20},"children":[]},{"key":"mull_suxwj7o","part_type":"mullionPart","values":{"offset":1306,"thicknessInFrame":41,"mullionStopSize":20},"children":[]},{"key":"trans_52quxaq","part_type":"transomPart","values":{"offset":431,"thicknessInFrame":41,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"dgu_l1h4p37","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3,"mechanicalClearanceTop":15,"mechanicalClearanceBottom":15,"mechanicalClearanceLeft":15,"mechanicalClearanceRight":15,"hiddenInRebateTop":12,"hiddenInRebateBottom":12,"hiddenInRebateLeft":12,"hiddenInRebateRight":12,"toBeReplaced":true},"children":[]},{"key":"dgu_yjaes34","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3,"mechanicalClearanceTop":15,"mechanicalClearanceBottom":15,"mechanicalClearanceLeft":15,"mechanicalClearanceRight":15,"hiddenInRebateTop":12,"hiddenInRebateBottom":12,"hiddenInRebateLeft":12,"hiddenInRebateRight":12,"toBeReplaced":true},"children":[]},{"key":"dgu_061wx9l","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3,"mechanicalClearanceTop":15,"mechanicalClearanceBottom":15,"mechanicalClearanceLeft":15,"mechanicalClearanceRight":15,"hiddenInRebateTop":12,"hiddenInRebateBottom":12,"hiddenInRebateLeft":12,"hiddenInRebateRight":12,"toBeReplaced":true},"children":[]},{"key":"sidelight_jxrl9au","part_type":"casementSashPart","values":{"operation":"fix","casementTypeId":"open_in","thickness":54,"topHeight":62,"leftWidth":62,"rightWidth":62,"bottomHeight":175,"bottomHeightExternal":175,"btmRailShapeId":"stepped","mechanicalClearanceTop":3,"mechanicalClearanceBottom":3,"mechanicalClearanceLeft":3,"mechanicalClearanceRight":3,"toBeReplaced":true},"children":[{"key":"sidelight_jxrl9au_midrail","part_type":"transomPart","values":{"isMidrail":true,"offset":1031,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"sidelight_jxrl9au_glass","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3},"children":[]},{"key":"sidelight_jxrl9au_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"doorleaf_oz4jreh","part_type":"doorLeafPart","values":{"operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"square","mechanicalClearanceTop":3,"mechanicalClearanceLeft":4,"mechanicalClearanceRight":4,"mechanicalClearanceBottom":14,"defaultMuntinThickness":120,"archHead":false,"toBeReplaced":true},"children":[{"key":"doorleaf_oz4jreh_muntin1","part_type":"mullionPart","values":{"isMuntin":true,"offset":276,"thicknessInFrame":120,"muntinThickness":120,"mullionStopSize":0,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"doorleaf_oz4jreh_midrail1","part_type":"transomPart","values":{"isMidrail":true,"offset":983,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"doorleaf_oz4jreh_panel1","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_oz4jreh_panel2","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_oz4jreh_panel3","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_oz4jreh_panel4","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"sidelight_9q9k6ez","part_type":"casementSashPart","values":{"operation":"fix","casementTypeId":"open_in","thickness":54,"topHeight":62,"leftWidth":62,"rightWidth":62,"bottomHeight":175,"bottomHeightExternal":175,"btmRailShapeId":"stepped","mechanicalClearanceTop":3,"mechanicalClearanceBottom":3,"mechanicalClearanceLeft":3,"mechanicalClearanceRight":3,"toBeReplaced":true},"children":[{"key":"sidelight_9q9k6ez_midrail","part_type":"transomPart","values":{"isMidrail":true,"offset":1031,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"sidelight_9q9k6ez_glass","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3},"children":[]},{"key":"sidelight_9q9k6ez_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"cill_6xzlf0m","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}},{"name":"Front Door With Side Lights And Fanlight Over Door","sort_order":260,"group_name":"Open In Doors","tree":{"key":"item_8qdo3bd","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_skk93a8","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"custom","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":true,"isFrontDoor":true},"children":[]},{"key":"notes_bopywrn","part_type":"notesPart","values":{},"children":[]},{"key":"price_k0l8xad","part_type":"pricePart","values":{},"children":[]},{"key":"frame_t1kcqxh","part_type":"assemblyFramePart","values":{"width":1806,"height":2654,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":0,"rakeFrame":false,"archHead":false,"toBeReplaced":true},"children":[{"key":"mull_wike8s5","part_type":"mullionPart","values":{"offset":365,"thicknessInFrame":41,"mullionStopSize":20},"children":[]},{"key":"mull_m8sj862","part_type":"mullionPart","values":{"offset":1306,"thicknessInFrame":41,"mullionStopSize":20},"children":[]},{"key":"trans_6q4e6n2","part_type":"transomPart","values":{"offset":431,"thicknessInFrame":41,"transomStopSize":18,"startDivider":"mull_wike8s5","endDivider":"mull_m8sj862"},"children":[]},{"key":"sidelight_0ymgcq9","part_type":"casementSashPart","values":{"operation":"fix","casementTypeId":"open_in","thickness":54,"topHeight":62,"leftWidth":62,"rightWidth":62,"bottomHeight":175,"bottomHeightExternal":175,"btmRailShapeId":"stepped","mechanicalClearanceTop":3,"mechanicalClearanceBottom":3,"mechanicalClearanceLeft":3,"mechanicalClearanceRight":3,"toBeReplaced":true},"children":[{"key":"sidelight_0ymgcq9_midrail","part_type":"transomPart","values":{"isMidrail":true,"offset":1503,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"sidelight_0ymgcq9_glass","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3},"children":[]},{"key":"sidelight_0ymgcq9_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"dgu_2abo17a","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3,"mechanicalClearanceTop":15,"mechanicalClearanceBottom":15,"mechanicalClearanceLeft":15,"mechanicalClearanceRight":15,"hiddenInRebateTop":12,"hiddenInRebateBottom":12,"hiddenInRebateLeft":12,"hiddenInRebateRight":12,"toBeReplaced":true},"children":[]},{"key":"sidelight_f5sg1rp","part_type":"casementSashPart","values":{"operation":"fix","casementTypeId":"open_in","thickness":54,"topHeight":62,"leftWidth":62,"rightWidth":62,"bottomHeight":175,"bottomHeightExternal":175,"btmRailShapeId":"stepped","mechanicalClearanceTop":3,"mechanicalClearanceBottom":3,"mechanicalClearanceLeft":3,"mechanicalClearanceRight":3,"toBeReplaced":true},"children":[{"key":"sidelight_f5sg1rp_midrail","part_type":"transomPart","values":{"isMidrail":true,"offset":1503,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"sidelight_f5sg1rp_glass","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3},"children":[]},{"key":"sidelight_f5sg1rp_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"doorleaf_2vx2h30","part_type":"doorLeafPart","values":{"operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"square","mechanicalClearanceTop":3,"mechanicalClearanceLeft":4,"mechanicalClearanceRight":4,"mechanicalClearanceBottom":14,"defaultMuntinThickness":120,"archHead":false,"toBeReplaced":true},"children":[{"key":"doorleaf_2vx2h30_muntin1","part_type":"mullionPart","values":{"isMuntin":true,"offset":276,"thicknessInFrame":120,"muntinThickness":120,"mullionStopSize":0,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"doorleaf_2vx2h30_midrail1","part_type":"transomPart","values":{"isMidrail":true,"offset":983,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"doorleaf_2vx2h30_panel1","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_2vx2h30_panel2","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_2vx2h30_panel3","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]},{"key":"doorleaf_2vx2h30_panel4","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"cill_0mlnovm","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}},{"name":"Stable Door With Fanlight","sort_order":330,"group_name":"Cottage Doors","tree":{"key":"item_38hmyqo","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_ut6enur","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"clean_white","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":false,"isFrontDoor":false},"children":[]},{"key":"notes_gxhdu7y","part_type":"notesPart","values":{},"children":[]},{"key":"price_cp0tmyv","part_type":"pricePart","values":{},"children":[]},{"key":"frame_zagjfp4","part_type":"assemblyFramePart","values":{"width":1099,"height":2679,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":0,"rakeFrame":false,"archHead":false,"toBeReplaced":true},"children":[{"key":"trans_u4lprgk","part_type":"transomPart","values":{"offset":431,"thicknessInFrame":41,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"dgu_cga0um5","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3,"mechanicalClearanceTop":15,"mechanicalClearanceBottom":15,"mechanicalClearanceLeft":15,"mechanicalClearanceRight":15,"hiddenInRebateTop":12,"hiddenInRebateBottom":12,"hiddenInRebateLeft":12,"hiddenInRebateRight":12,"toBeReplaced":true},"children":[]},{"key":"stable_hiykhks","part_type":"stableDoorPart","values":{"thickness":58,"splitOffset":1055,"mechanicalClearanceTop":4,"mechanicalClearanceLeft":4,"mechanicalClearanceRight":4,"mechanicalClearanceBottom":3,"clearanceBetweenHalves":3,"toBeReplaced":true},"children":[{"key":"stable_hiykhks_top","part_type":"doorLeafPart","values":{"stableHalf":"top","operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":99,"bottomHeightExternal":99,"btmRailShapeId":"stepped","archHead":false,"toBeReplaced":true},"children":[{"key":"stable_hiykhks_top_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"stable_hiykhks_bottom","part_type":"doorLeafPart","values":{"stableHalf":"bottom","operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":99,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"stepped","archHead":false,"toBeReplaced":true},"children":[{"key":"stable_hiykhks_bottom_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]}]},{"key":"cill_hjotj3p","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}},{"name":"Stable Door With Side Light","sort_order":340,"group_name":"Cottage Doors","tree":{"key":"item_szv9o21","part_type":"drawingItemPart","values":{"typeOfWork":"complete_new","frameMaterialId":"utile","sashMaterialId":"utile","cillMaterialId":"utile","quantity":1},"children":[{"key":"paint_sybx3t3","part_type":"paintAndIronmongeryPart","values":{"internalFinish":"clean_white","externalFinish":"clean_white","cillFinish":"clean_white","cutOutBrickReveal":false,"ironmongeryFinish":"PB","isDoorMpls":false,"isFrontDoor":false},"children":[]},{"key":"notes_21lwely","part_type":"notesPart","values":{},"children":[]},{"key":"price_cebaplb","part_type":"pricePart","values":{},"children":[]},{"key":"frame_v5vds3l","part_type":"assemblyFramePart","values":{"width":1505,"height":2207,"leftWidth":47,"rightWidth":47,"topHeight":47,"bottomHeight":50,"frameDepth":96,"jambType":"solid_profiled","frameHeadStopSize":20,"frameStileStopSize":20,"cillStopSize":0,"rakeFrame":false,"archHead":false,"toBeReplaced":true},"children":[{"key":"mull_nni03la","part_type":"mullionPart","values":{"offset":1005,"thicknessInFrame":41,"mullionStopSize":20},"children":[]},{"key":"stable_yptj5gw","part_type":"stableDoorPart","values":{"thickness":58,"splitOffset":1055,"mechanicalClearanceTop":4,"mechanicalClearanceLeft":4,"mechanicalClearanceRight":4,"mechanicalClearanceBottom":3,"clearanceBetweenHalves":3,"toBeReplaced":true},"children":[{"key":"stable_yptj5gw_top","part_type":"doorLeafPart","values":{"stableHalf":"top","operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":110,"leftWidth":110,"rightWidth":110,"bottomHeight":99,"bottomHeightExternal":99,"btmRailShapeId":"stepped","archHead":false,"toBeReplaced":true},"children":[{"key":"stable_yptj5gw_top_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"stable_yptj5gw_bottom","part_type":"doorLeafPart","values":{"stableHalf":"bottom","operation":"left_hand_hung","casementTypeId":"open_in","thickness":54,"topHeight":99,"leftWidth":110,"rightWidth":110,"bottomHeight":170,"bottomHeightExternal":170,"btmRailShapeId":"stepped","archHead":false,"toBeReplaced":true},"children":[{"key":"stable_yptj5gw_bottom_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]}]},{"key":"sidelight_u41ow0g","part_type":"casementSashPart","values":{"operation":"fix","casementTypeId":"open_in","thickness":54,"topHeight":62,"leftWidth":62,"rightWidth":62,"bottomHeight":175,"bottomHeightExternal":175,"btmRailShapeId":"stepped","mechanicalClearanceTop":3,"mechanicalClearanceBottom":3,"mechanicalClearanceLeft":3,"mechanicalClearanceRight":3,"toBeReplaced":true},"children":[{"key":"sidelight_u41ow0g_midrail","part_type":"transomPart","values":{"isMidrail":true,"offset":911,"thicknessInFrame":170,"midrailThickness":170,"transomStopSize":18,"startDivider":"0","endDivider":"0"},"children":[]},{"key":"sidelight_u41ow0g_glass","part_type":"glassPart","values":{"glazingId":"double_glazing","isIndividualPanes":false,"internalGlassPartNo":"GL100010","externalGlassPartNo":"GL100080","glazingRebateWidth":15,"glazingTolerance":3},"children":[]},{"key":"sidelight_u41ow0g_panel","part_type":"panelPart","values":{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo","insulationThickness":15,"createVisionPanel":true,"panelThickness":0,"toBeReplaced":true},"children":[]}]},{"key":"cill_fikp2hj","part_type":"cillPart","values":{"height":50,"depth":145},"children":[]}]}]}}]'::jsonb;
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

  IF jsonb_array_length(_templates) <> 5 THEN
    RAISE EXCEPTION 'Expected 5 templates, found %', jsonb_array_length(_templates);
  END IF;

  FOR _row IN
    SELECT * FROM jsonb_to_recordset(_templates)
      AS x(name text, sort_order int, group_name text, tree jsonb)
  LOOP
    _tree := jsonb_set(_row.tree, '{values,product}', to_jsonb(_product), true);

    -- Every one of them is a DOOR with a divider and a light in it.
    IF NOT jsonb_path_exists(_tree, '$.**.part_type ? (@ == "doorLeafPart" || @ == "leftFrenchDoorLeafPart")') THEN
      RAISE EXCEPTION 'Template "%" has no door leaf', _row.name;
    END IF;
    IF NOT jsonb_path_exists(_tree, '$.**.part_type ? (@ == "mullionPart" || @ == "transomPart")') THEN
      RAISE EXCEPTION 'Template "%" has no frame divider', _row.name;
    END IF;
    -- strict, always, for a COUNT: lax $.** returns every match twice
    -- (reviewer, 14 Oct)
    IF (SELECT count(*) FROM jsonb_path_query(_tree, 'strict $.**.part_type ? (@ == "cillPart")')) <> 1 THEN
      RAISE EXCEPTION 'Template "%" does not have exactly one cill', _row.name;
    END IF;
    -- a FRONT door is a front door, and a stable door is not
    IF _row.group_name = 'Open In Doors'
       AND NOT jsonb_path_exists(_tree, '$.**.values ? (@.isFrontDoor == true)') THEN
      RAISE EXCEPTION 'Template "%" is in Open In Doors but is not marked isFrontDoor', _row.name;
    END IF;
    IF _row.group_name = 'Cottage Doors'
       AND jsonb_path_exists(_tree, '$.**.values ? (@.isDoorMpls == true)') THEN
      RAISE EXCEPTION 'Template "%" is marked isDoorMpls — a stable door has no multipoint lock', _row.name;
    END IF;
    -- the panels are FLAT (Step BF: Integrate's type 110)
    IF jsonb_path_exists(_tree, '$.**.values ? (@.internalPanelTypeId == "raised_and_fielded")') THEN
      RAISE EXCEPTION 'Template "%" has a raised-and-fielded panel; these are FLAT', _row.name;
    END IF;

    IF EXISTS (SELECT 1 FROM public.drawing_templates WHERE name = _row.name) THEN
      UPDATE public.drawing_templates
      SET tree = _tree, default_profile_id = _profile_id, window_type = 'Door',
          family = 'door', group_name = _row.group_name,
          sort_order = _row.sort_order, is_active = TRUE, updated_at = now()
      WHERE name = _row.name;
      RAISE NOTICE 'Step BH-2: % updated in place', _row.name;
    ELSE
      INSERT INTO public.drawing_templates
        (name, family, group_name, window_type, default_profile_id, tree, sort_order, is_active)
      VALUES (_row.name, 'door', _row.group_name, 'Door',
              _profile_id, _tree, _row.sort_order, TRUE);
      RAISE NOTICE 'Step BH-2: % created', _row.name;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. The five rows, in their groups at 240-260 and 330-340.
SELECT t.name, t.group_name, t.window_type, t.sort_order, t.is_active,
       p.code AS profile_code
FROM   public.drawing_templates t
LEFT   JOIN public.default_profiles p ON p.id = t.default_profile_id
WHERE  t.sort_order IN (240, 250, 260, 330, 340)
ORDER  BY t.sort_order;

-- 2. What each tree holds. Expect, in sort order:
--      240  leaves 2, panels 4, glass 0, dividers 0 (the mid rails are INSIDE
--           the leaves), sashes 0
--      250  leaves 1, panels 6, glass 3 + 2 (the fanlights and the side
--           lights' own), dividers 3, sashes 2
--      260  leaves 1, panels 6, glass 1 + 2, dividers 3, sashes 2
--      330  halves 2, panels 2, glass 1, dividers 1, sashes 0
--      340  halves 2, panels 3, glass 1, dividers 1, sashes 1
SELECT name, sort_order,
       (SELECT count(*) FROM jsonb_path_query(tree, 'strict $.**.part_type ? (@ == "doorLeafPart" || @ == "leftFrenchDoorLeafPart" || @ == "rightFrenchDoorLeafPart")')) AS leaves,
       (SELECT count(*) FROM jsonb_path_query(tree, 'strict $.**.part_type ? (@ == "panelPart")'))        AS panels,
       (SELECT count(*) FROM jsonb_path_query(tree, 'strict $.**.part_type ? (@ == "glassPart")'))        AS glass,
       (SELECT count(*) FROM jsonb_path_query(tree, 'strict $.**.part_type ? (@ == "casementSashPart")')) AS sashes,
       (SELECT count(*) FROM jsonb_path_query(tree, 'strict $.**.part_type ? (@ == "mullionPart" || @ == "transomPart")')) AS dividers_and_rails
FROM   public.drawing_templates
WHERE  sort_order IN (240, 250, 260, 330, 340)
ORDER  BY sort_order;

-- 3. The figures that drive the price: the frame sizes, the cill, the finish
--    and the flags. Expect 1500x2182 / 1806x2654 / 1806x2654 / 1099x2679 /
--    1505x2207, a 50 cill on all five, cill stop 0 (the open-in range),
--    dual finish on 240-260 and single on 330-340.
SELECT name, sort_order,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, 'strict $.**.values ? (@.frameDepth != null).width') v)  AS frame_width,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, 'strict $.**.values ? (@.frameDepth != null).height') v) AS frame_height,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, 'strict $.**.values ? (@.depth == 145).height') v)        AS cill_height,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, 'strict $.**.values.cillStopSize') v)                    AS cill_stop,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, 'strict $.**.values.internalFinish') v)         AS internal_finish,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, 'strict $.**.values.externalFinish') v)         AS external_finish,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, 'strict $.**.values.isFrontDoor') v)                     AS is_front_door
FROM   public.drawing_templates
WHERE  sort_order IN (240, 250, 260, 330, 340)
ORDER  BY sort_order;

-- 4. And on a drawing made from each, the figures to expect are in
--    docs/reports/step-bh.md, rule by rule. In short, priced offline on the
--    live rules (with sql/step-bh1 applied for 240):
--      240  Pair Of Front Doors                                 see report
--      250  Front Door With Side Lights And Fanlight            see report
--      260  Front Door With Side Lights And Fanlight Over Door  see report
--      330  Stable Door With Fanlight                           see report
--      340  Stable Door With Side Light                         see report


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- Deleting a template does not touch a drawing made from it.
--
-- BEGIN;
-- DELETE FROM public.drawing_templates
-- WHERE name IN ('Pair Of Front Doors',
--                'Front Door With Side Lights And Fanlight',
--                'Front Door With Side Lights And Fanlight Over Door',
--                'Stable Door With Fanlight',
--                'Stable Door With Side Light');
-- COMMIT;
