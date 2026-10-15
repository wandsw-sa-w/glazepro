-- Step BH-5: re-point the divider references that died on SAVE.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run — it only touches
-- a reference that resolves to NOTHING, so a second run finds none.
-- Independent of every other file in Step BH.
--
-- WHAT WENT WRONG (docs/reports/step-bh-followup-2.md). A SHORT divider names
-- the dividers it starts and ends at — Integrate's `startDivider` /
-- `endDivider`, by KEY, with '0' for the frame itself. `drawing_parts` has no
-- key column: the client sends `key` / `parent_key`, the rows get DATABASE
-- ids, and the board keys the tree it loads by `id`. Nothing rewrote the two
-- references, so they kept pointing at keys that exist nowhere.
--
-- Read as frame-to-frame, a lost reference re-cuts the whole frame: a
-- four-opening doorset was read as a 3 x 2 grid of six cells, the side lights
-- were charged as fanlights, and the door's panels came out at NEGATIVE area.
-- Drawing 56 priced £7,095.53 against £8,936.47.
--
-- THE CODE IS FIXED: every save now re-points the references by POSITION (the
-- nth mullion or transom of the nth frame), whatever ids the database hands
-- out — so any drawing saved from now on is right, and so is any drawing
-- re-made from a template. This file is for the two that already exist.
--
-- THE TWO: drawings 56 and 60 on L507712 item 9 (both the reviewer's test
-- drawings of the "Front Door With Side Lights And Fanlight Over Door"
-- template). Each has one transom whose two references are dead, and two
-- mullions in the same frame:
--
--     mullion  offset 365    <- what startDivider should name
--     mullion  offset 1306   <- what endDivider should name
--     transom  offset 431    startDivider / endDivider: dead keys
--
-- The re-pointing is the same rule the code now uses: in OFFSET order, the
-- FIRST mullion of the frame starts the transom and the SECOND ends it.
--
-- AFTER THIS: drawing 56 and drawing 60 both read four cells and price
-- £8,936.47 (they read £7,095.53 and £7,517.43 now — the second because the
-- negative panels are refused since Step BH follow-up item 2). Re-price them
-- through a quote to see it.
--
-- SECTION 0 ALSO ANSWERS THE OTHER QUESTION the brief asks: whether any OTHER
-- drawing in the database holds a dead reference. Read 0b before and after.
--
-- RUN SECTION 0 FIRST.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. Every SHORT divider in the database: a divider that names another
--     divider rather than the frame. Expect a handful, and the two drawings
--     below among them.
SELECT p.drawing_id, p.id, p.part_type,
       p.values->>'offset'        AS offset,
       p.values->>'startDivider'  AS start_divider,
       p.values->>'endDivider'    AS end_divider
FROM   public.drawing_parts p
WHERE  (p.values->>'startDivider' IS NOT NULL AND p.values->>'startDivider' <> '0')
   OR  (p.values->>'endDivider'   IS NOT NULL AND p.values->>'endDivider'   <> '0')
ORDER  BY p.drawing_id, p.id;

-- 0b. THE DEAD ONES: a reference that resolves to no row in the same drawing.
--     This is the query to keep — it is the answer to "has this happened
--     anywhere else", before and after this file. Expect the reviewer's two
--     drawings (56 and 60) before, and NOTHING after.
WITH refs AS (
  SELECT p.drawing_id, p.id, p.part_type, p.parent_part_id,
         p.values->>'offset' AS offset,
         f.field, p.values->>f.field AS ref
  FROM   public.drawing_parts p
  CROSS  JOIN (VALUES ('startDivider'), ('endDivider')) AS f(field)
  WHERE  p.values->>f.field IS NOT NULL
    AND  p.values->>f.field <> '0'
)
SELECT r.*
FROM   refs r
WHERE  NOT EXISTS (
  SELECT 1 FROM public.drawing_parts q
  WHERE  q.drawing_id = r.drawing_id AND q.id::text = r.ref
)
ORDER  BY r.drawing_id, r.id, r.field;

-- 0c. The two drawings this file repairs, in full: the frame, its mullions
--     and its transom. Expect two mullions at 365 and 1306 and one transom
--     at 431 in each.
SELECT p.drawing_id, p.id, p.parent_part_id, p.part_type,
       p.values->>'offset' AS offset,
       p.values->>'startDivider' AS start_divider,
       p.values->>'endDivider' AS end_divider
FROM   public.drawing_parts p
WHERE  p.drawing_id IN (56, 60)
  AND  p.part_type IN ('mullionPart', 'transomPart', 'assemblyFramePart')
ORDER  BY p.drawing_id, p.id;

-- 0d. And what they are: both from the same template, on L507712 item 9.
SELECT id, drawing_number, window_type, job_item_id, default_profile_id
FROM   public.drawings
WHERE  id IN (56, 60);


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — re-point every dead reference
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _row     record;
  _start   bigint;
  _end     bigint;
  _n       int;
  _fixed   int := 0;
  _skipped int := 0;
BEGIN
  -- Every divider with a dead reference, anywhere in the database. The two
  -- the reviewer found are the expected ones; if there are others, they are
  -- repaired by the same rule and the NOTICE says how many.
  FOR _row IN
    SELECT p.id, p.drawing_id, p.parent_part_id, p.part_type,
           p.values->>'startDivider' AS start_ref,
           p.values->>'endDivider'   AS end_ref
    FROM   public.drawing_parts p
    WHERE  p.part_type IN ('mullionPart', 'transomPart')
      AND  (
        (p.values->>'startDivider' IS NOT NULL AND p.values->>'startDivider' <> '0'
          AND NOT EXISTS (SELECT 1 FROM public.drawing_parts q
                          WHERE q.drawing_id = p.drawing_id
                            AND q.id::text = p.values->>'startDivider'))
        OR
        (p.values->>'endDivider' IS NOT NULL AND p.values->>'endDivider' <> '0'
          AND NOT EXISTS (SELECT 1 FROM public.drawing_parts q
                          WHERE q.drawing_id = p.drawing_id
                            AND q.id::text = p.values->>'endDivider'))
      )
    ORDER  BY p.drawing_id, p.id
  LOOP
    -- The CROSSING dividers of the same frame, in offset order: for a transom
    -- the mullions, for a mullion the transoms. Exactly what the code's
    -- positional re-pointing uses.
    SELECT count(*) INTO _n
    FROM   public.drawing_parts c
    WHERE  c.parent_part_id = _row.parent_part_id
      AND  c.part_type = CASE WHEN _row.part_type = 'transomPart'
                              THEN 'mullionPart' ELSE 'transomPart' END;

    -- This file knows one shape: a divider bounded by TWO crossing dividers,
    -- which is the doorset's transom between two mullions. Anything else is
    -- left alone and counted, for a human to look at.
    IF _n <> 2 THEN
      _skipped := _skipped + 1;
      RAISE NOTICE 'Step BH-5: part % of drawing % has % crossing divider(s), not 2 — left alone',
        _row.id, _row.drawing_id, _n;
      CONTINUE;
    END IF;

    SELECT id INTO _start
    FROM   public.drawing_parts c
    WHERE  c.parent_part_id = _row.parent_part_id
      AND  c.part_type = CASE WHEN _row.part_type = 'transomPart'
                              THEN 'mullionPart' ELSE 'transomPart' END
    ORDER  BY (c.values->>'offset')::numeric NULLS LAST, c.id
    LIMIT  1;

    SELECT id INTO _end
    FROM   public.drawing_parts c
    WHERE  c.parent_part_id = _row.parent_part_id
      AND  c.part_type = CASE WHEN _row.part_type = 'transomPart'
                              THEN 'mullionPart' ELSE 'transomPart' END
    ORDER  BY (c.values->>'offset')::numeric DESC NULLS LAST, c.id DESC
    LIMIT  1;

    IF _start IS NULL OR _end IS NULL OR _start = _end THEN
      _skipped := _skipped + 1;
      RAISE NOTICE 'Step BH-5: part % of drawing % — could not resolve both bounds, left alone',
        _row.id, _row.drawing_id;
      CONTINUE;
    END IF;

    UPDATE public.drawing_parts
    SET    values = jsonb_set(
             jsonb_set(values, '{startDivider}', to_jsonb(_start::text), true),
             '{endDivider}', to_jsonb(_end::text), true),
           updated_at = now()
    WHERE  id = _row.id;

    _fixed := _fixed + 1;
    RAISE NOTICE 'Step BH-5: drawing % part % re-pointed: start % -> %, end % -> %',
      _row.drawing_id, _row.id, _row.start_ref, _start, _row.end_ref, _end;
  END LOOP;

  RAISE NOTICE 'Step BH-5: % divider(s) re-pointed, % left alone', _fixed, _skipped;
END $$;

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. NOTHING dead is left. Run 0b again: expect zero rows.
WITH refs AS (
  SELECT p.drawing_id, p.id, f.field, p.values->>f.field AS ref
  FROM   public.drawing_parts p
  CROSS  JOIN (VALUES ('startDivider'), ('endDivider')) AS f(field)
  WHERE  p.values->>f.field IS NOT NULL AND p.values->>f.field <> '0'
)
SELECT r.*
FROM   refs r
WHERE  NOT EXISTS (
  SELECT 1 FROM public.drawing_parts q
  WHERE  q.drawing_id = r.drawing_id AND q.id::text = r.ref
)
ORDER  BY r.drawing_id, r.id, r.field;

-- 2. The two drawings, with their references now naming their own mullions.
SELECT p.drawing_id, p.id, p.part_type,
       p.values->>'offset' AS offset,
       p.values->>'startDivider' AS start_divider,
       p.values->>'endDivider' AS end_divider
FROM   public.drawing_parts p
WHERE  p.drawing_id IN (56, 60)
  AND  p.part_type IN ('mullionPart', 'transomPart')
ORDER  BY p.drawing_id, p.id;

-- 3. On the board: open drawing 56 (and 60). Each should read Side light A1,
--    Fanlight B1, Side light C1 and Single Door B2 — four openings, the door
--    in its own column with the fanlight over it — with no validation error.
--    Re-price it: £8,936.47.


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- There is nothing to go back to: the old values were keys that pointed
-- nowhere, which is what made the two drawings wrong. If a repaired drawing
-- still looks wrong, the honest step is to re-make it from its template —
-- which gives the same tree, by the same positional rule.
