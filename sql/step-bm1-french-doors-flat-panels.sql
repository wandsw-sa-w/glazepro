-- Step BM-1: template "French Doors With Panels" — FLAT panels.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- WHY. Integrate's panel type ids, read in its own panel-type dialog on
-- 14 Oct 2026:
--
--     110 = FLAT    112 = RAISED & FIELDED    114 = VTG    116 = HTG
--
-- GlazePro mapped 110 to raised_and_fielded. sql/step-bf1 (RUN LIVE 14 Oct)
-- fixed the four FRONT DOOR templates on that reading. This is the one
-- template it did not reach: "French Doors With Panels" (sql/step-ba2), whose
-- group_name is "Open Out Doors" and not the "Open In Doors" that bf1's WHERE
-- clause selects on, so bf1 never saw it.
--
-- It is FD4's own source template, and the reviewer re-read FD4's drawing
-- 10/4 (310627) on 14 Oct: both panels are internalPanelTypeId 110 /
-- externalPanelTypeId 110 — FLAT. So the template disagrees with the drawing
-- it was built from, and every NEW "French Doors With Panels" drawing starts
-- with "Additional for R&F Panel" 120 a panel where Integrate charges
-- "Additional for Flat Panel" 60.
--
--     French Doors With Panels (2 panels)   -120 min   -49.32
--
-- NOTE this is NOT the whole of FD4's old -49.32 benchmark gap. That gap was
-- the two leaves' MID RAILS, which the Step BM follow-up made count as
-- muntins in sash_muntin_to_be_replaced_qty. The two changes are separate and
-- they cancel on this layout:
--
--     before   R&F 2 x 120 = 240, mid rails uncounted            = 240
--     after    flat 2 x 60 = 120, "Door Muntin" 2 x 60 = 120     = 240
--
-- which is exactly why FD4 looked penny-exact while BOTH halves were wrong,
-- and why this file changes no benchmark: the fixture already reads flat.
-- What it changes is what a surveyor's NEW drawing starts with.
--
-- A drawing already made from this template keeps its own tree and its own
-- panels: a saved drawing with R&F panels goes on pricing R&F, which is
-- correct — it is what somebody drew.
--
-- RUN SECTION 0 FIRST.
--
-- REVIEWER EDIT 16 Oct: every COUNT over $.** now uses 'strict' (lax mode returns each match twice, so the
-- 2-panel guard read 4 and would have aborted). Existence checks are unaffected.

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ════════════════════════════════════════════════════════════════════════════

-- 0a. The template and the panel types it carries. Expect
--     ["raised_and_fielded"] before this runs and ["flat"] after, with 2
--     panelParts. If it already reads ["flat"], this file has been run and
--     there is nothing to do.
SELECT name, group_name, sort_order,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, '$.**.values.internalPanelTypeId') v) AS internal_panel,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, '$.**.values.externalPanelTypeId') v) AS external_panel,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, '$.**.values.internalPanelBeadId') v)  AS internal_bead,
       (SELECT count(*) FROM jsonb_path_query(tree, 'strict $.**.part_type ? (@ == "panelPart")'))             AS panels
FROM   public.drawing_templates
WHERE  name = 'French Doors With Panels';

-- 0b. EVERY template that still carries a raised-and-fielded panel, so the
--     reviewer can see this is the last one. Expect exactly the one row
--     before this runs, and no rows after.
SELECT name, group_name, sort_order,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.values ? (@.internalPanelTypeId == "raised_and_fielded")')) AS rf_internal,
       (SELECT count(*) FROM jsonb_path_query(tree, '$.**.values ? (@.externalPanelTypeId == "raised_and_fielded")')) AS rf_external
FROM   public.drawing_templates
WHERE  jsonb_path_exists(tree, '$.**.values ? (@.internalPanelTypeId == "raised_and_fielded")')
   OR  jsonb_path_exists(tree, '$.**.values ? (@.externalPanelTypeId == "raised_and_fielded")')
ORDER  BY group_name, sort_order;

-- 0c. What is SAVED with raised-and-fielded panels, so the reviewer knows
--     which drawings keep them. This file does not touch a drawing.
SELECT p.drawing_id, count(*) AS rf_panels
FROM   public.drawing_parts p
WHERE  p.part_type = 'panelPart'
  AND  (p.values ->> 'internalPanelTypeId' IN ('raised_and_fielded', '112')
    OR  p.values ->> 'externalPanelTypeId' IN ('raised_and_fielded', '112'))
GROUP  BY p.drawing_id
ORDER  BY p.drawing_id;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — flip the panel faces to flat
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- A recursive rewrite, because the panels sit inside
-- frame > frenchDoor > leaf > panelPart and nothing should depend on that
-- shape staying put. It touches ONLY the two panel-type keys, and only where
-- they read 'raised_and_fielded' — every other value, key and key order in
-- the tree is carried through untouched.
--
-- pg_temp, so it disappears with the session rather than being left behind in
-- the schema.
CREATE OR REPLACE FUNCTION pg_temp.flatten_panel_types(_node jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE
  _values   jsonb := _node -> 'values';
  _children jsonb := _node -> 'children';
  _out      jsonb := _node;
  _child    jsonb;
  _new      jsonb := '[]'::jsonb;
BEGIN
  IF _values IS NOT NULL THEN
    IF _values ->> 'internalPanelTypeId' = 'raised_and_fielded' THEN
      _values := jsonb_set(_values, '{internalPanelTypeId}', '"flat"');
    END IF;
    IF _values ->> 'externalPanelTypeId' = 'raised_and_fielded' THEN
      _values := jsonb_set(_values, '{externalPanelTypeId}', '"flat"');
    END IF;
    _out := jsonb_set(_out, '{values}', _values);
  END IF;

  IF _children IS NOT NULL AND jsonb_typeof(_children) = 'array' THEN
    FOR _child IN SELECT * FROM jsonb_array_elements(_children) LOOP
      _new := _new || jsonb_build_array(pg_temp.flatten_panel_types(_child));
    END LOOP;
    _out := jsonb_set(_out, '{children}', _new);
  END IF;

  RETURN _out;
END;
$fn$;

DO $$
DECLARE
  _tree   jsonb;
  _panels int;
  _rf     int;
BEGIN
  SELECT tree INTO _tree
  FROM   public.drawing_templates
  WHERE  name = 'French Doors With Panels';

  IF _tree IS NULL THEN
    RAISE EXCEPTION 'Template "French Doors With Panels" does not exist — do not run this file';
  END IF;

  -- It must have exactly the two panels sql/step-ba2 built it with. If the
  -- template has been re-issued with a different layout, stop: this file was
  -- written against two panels and the reviewer should re-read it first.
  SELECT count(*) INTO _panels
  FROM   jsonb_path_query(_tree, 'strict $.**.part_type ? (@ == "panelPart")');
  IF _panels <> 2 THEN
    RAISE EXCEPTION 'Expected 2 panelParts in "French Doors With Panels", found % — do not run this file', _panels;
  END IF;

  _tree := pg_temp.flatten_panel_types(_tree);

  -- Belt and braces: nothing raised-and-fielded may survive the rewrite.
  IF jsonb_path_exists(_tree, '$.**.values ? (@.internalPanelTypeId == "raised_and_fielded")')
  OR jsonb_path_exists(_tree, '$.**.values ? (@.externalPanelTypeId == "raised_and_fielded")') THEN
    RAISE EXCEPTION 'The rewrite left a raised-and-fielded panel behind — do not commit';
  END IF;

  -- And both faces of both panels must now be flat: 4 faces.
  SELECT count(*) INTO _rf
  FROM   jsonb_path_query(_tree, 'strict $.**.values ? (@.internalPanelTypeId == "flat")');
  IF _rf <> 2 THEN
    RAISE EXCEPTION 'Expected 2 flat internal faces after the rewrite, found %', _rf;
  END IF;

  -- The beads are Integrate's 120 = ovolo already and are NOT touched.
  IF NOT jsonb_path_exists(_tree, '$.**.values ? (@.internalPanelBeadId == "ovolo")') THEN
    RAISE EXCEPTION 'The ovolo bead has gone missing — do not commit';
  END IF;

  UPDATE public.drawing_templates
  SET    tree = _tree, updated_at = now()
  WHERE  name = 'French Doors With Panels';

  RAISE NOTICE 'French Doors With Panels: 2 panels, 4 faces, now FLAT with ovolo beads.';
END;
$$;

COMMIT;

-- ── Checks ──────────────────────────────────────────────────────────────

-- 1. Section 0a again. Expect internal_panel and external_panel both
--    ["flat"], internal_bead ["ovolo"], panels 2.
SELECT name, group_name, sort_order,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, '$.**.values.internalPanelTypeId') v) AS internal_panel,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, '$.**.values.externalPanelTypeId') v) AS external_panel,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, '$.**.values.internalPanelBeadId') v)  AS internal_bead,
       (SELECT count(*) FROM jsonb_path_query(tree, 'strict $.**.part_type ? (@ == "panelPart")'))             AS panels
FROM   public.drawing_templates
WHERE  name = 'French Doors With Panels';

-- 2. Section 0b again: NO template anywhere still has an R&F panel. Expect
--    zero rows.
SELECT name, group_name
FROM   public.drawing_templates
WHERE  jsonb_path_exists(tree, '$.**.values ? (@.internalPanelTypeId == "raised_and_fielded")')
   OR  jsonb_path_exists(tree, '$.**.values ? (@.externalPanelTypeId == "raised_and_fielded")');

-- 3. Nothing else about the template moved: the two leaves' mid rails at
--    offset 1241, the frame 1399 x 2199, and the two panelParts still
--    carrying insulationThickness 15.
SELECT name,
       (SELECT jsonb_agg(v ORDER BY v::text) FROM jsonb_path_query(tree, '$.**.values ? (@.isMidrail == true).offset') v) AS mid_rails,
       tree #> '{children}' IS NOT NULL                                                                    AS has_children,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, '$.**.values.insulationThickness') v)     AS insulation,
       (SELECT jsonb_agg(DISTINCT v) FROM jsonb_path_query(tree, '$.**.values ? (@.width == 1399).height') v) AS frame
FROM   public.drawing_templates
WHERE  name = 'French Doors With Panels';

-- 4. On /dev/pricing-benchmark nothing moves — FD4's fixture already reads
--    flat, and the benchmarks do not come from templates. What changes is a
--    NEW drawing: make one from "French Doors With Panels" and its production
--    should read 120 minutes (£49.32) less than the same drawing made before
--    this ran, while its two mid rails go on firing "Door Muntin" 2 x 60.


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- UPDATE public.drawing_templates
-- SET    tree = replace(tree::text, '"flat"', '"raised_and_fielded"')::jsonb,
--        updated_at = now()
-- WHERE  name = 'French Doors With Panels';
--
-- Note that rollback is BLUNTER than the change: it would flip every "flat"
-- in the tree, and the only ones there are the two panels' four faces, so on
-- today's template it is exact — but check 0a first, because if anything else
-- in the tree has gained a "flat" value since, this would hit that too.
--
-- There is no reason to want it. Integrate's type 110 is flat, read in its own
-- dialog, and FD4's own drawing reads 110. If a particular French door really
-- does have raised-and-fielded panels, that is a choice to make ON THE
-- DRAWING, where it belongs, not in the template.
