-- Step AX-3: take the stored surround list OFF the combination templates.
-- Run by Nathan in the Supabase SQL editor. Safe to re-run.
--
-- Nathan (13 Oct 2026): GlazePro leaves the nosing off.
--
-- Why. Integrate's templates 1, 2, 7, 10, 11, 12 and 13 all carry a "Nosing
-- in Solid Redwood" surround, and sql/step-av1 copied that faithfully onto
-- the four Step AV templates. But Integrate RECALCULATES the surround the
-- first time a drawing is saved — autoCalcSurroundComponents
-- 'architrave_and_bullnose' — and that calculation does not produce a
-- nosing. Every SAVED Integrate drawing the reviewer has read has architrave
-- only: J 1/12, Q 2/21, SA 5/1 and FR3 9/3, which lost its nosing and rule
-- 251's 30 minutes of install labour on the save
-- (docs/integrate-L31115-french-casements.txt).
--
-- So the nosing on a template is something Integrate never actually quotes.
-- Carrying it would make every GlazePro drawing 30 minutes of install labour
-- and one component line dearer than the same drawing in Integrate.
--
-- What this does NOT change. The stored-surround MODEL stays exactly as Step
-- AV built it: `storedSurroundParts` still reads values.surroundLines and
-- still replaces the allocator's surrounds when a list is present, and
-- `has_deep_window_board` still fires rule 251 for 30 minutes. A surveyor who
-- adds a nosing to a drawing gets it priced. Only the TEMPLATES stop
-- supplying one, so a new drawing prices its surround through the allocator
-- like every other GlazePro drawing — architrave only, which is how J, Q, R
-- and S are exact.
--
-- The benchmark fixtures are untouched: TC1-TC3 and FR1/FR2 were read from
-- Integrate drawings that were never saved, so their recorded prices DO
-- include the nosing, and the fixtures keep it. They stay exact.
--
-- The four templates below are the ones sql/step-av1 created. The French
-- templates (sql/step-ax2) never carried a list.

BEGIN;

DO $$
DECLARE
  _names text[] := ARRAY[
    'Double Casement With Fanlight',
    'Fanlight Over Each Casement (Configuration 1)',
    'Full-Height Opener With Fanlight Over Fixed (Configuration 2)',
    'Fanlight Over Fixed With Full-Height Opener (Configuration 3)'
  ];
  _with_list int;
  _changed   int;
BEGIN
  SELECT count(*) INTO _with_list
  FROM   public.drawing_templates
  WHERE  name = ANY(_names)
    AND  tree #> '{values,surroundLines}' IS NOT NULL;

  RAISE NOTICE 'Step AX-3: % of % templates carry a stored surround list',
    _with_list, array_length(_names, 1);

  UPDATE public.drawing_templates
  SET    tree = tree #- '{values,surroundLines}',
         updated_at = now()
  WHERE  name = ANY(_names)
    AND  tree #> '{values,surroundLines}' IS NOT NULL;

  GET DIAGNOSTICS _changed = ROW_COUNT;
  RAISE NOTICE 'Step AX-3: surround list removed from % template(s)', _changed;

  -- Any OTHER template carrying a list is reported, not changed: a list a
  -- surveyor saved on purpose through "Save as template" is theirs.
  FOR _with_list IN
    SELECT 1 FROM public.drawing_templates
    WHERE  tree #> '{values,surroundLines}' IS NOT NULL
      AND  NOT (name = ANY(_names))
    LIMIT  1
  LOOP
    RAISE NOTICE 'Step AX-3: other templates still carry a stored surround list — see check 2';
  END LOOP;
END $$;

COMMIT;

-- ── Checks ─────────────────────────────────────────────────────────────────

-- 1. The four templates, with no surround list. Expect NULL in every row.
SELECT name, sort_order,
       tree #> '{values,surroundLines}' AS surrounds
FROM   public.drawing_templates
WHERE  group_name = 'Combination Flush Casements'
ORDER  BY sort_order;

-- 2. Any template anywhere that still carries one. Expect no rows; if a
--    surveyor has saved one deliberately it shows here and is left alone.
SELECT name, family, group_name,
       tree #> '{values,surroundLines}' AS surrounds
FROM   public.drawing_templates
WHERE  tree #> '{values,surroundLines}' IS NOT NULL
ORDER  BY family, sort_order;

-- 3. Nothing else about the four templates moved — the dividers, the
--    operations and the bottom rails are as sql/step-av1 left them.
SELECT name,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values.offset') v)       AS divider_offsets,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values.operation') v)    AS operations,
       (SELECT jsonb_agg(v) FROM jsonb_path_query(tree, '$.**.values.bottomHeight') v) AS bottom_rails
FROM   public.drawing_templates
WHERE  group_name = 'Combination Flush Casements'
ORDER  BY sort_order;


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- Re-running sql/step-av1-combination-casement-templates.sql puts the four
-- templates back EXACTLY as they were, surround list included, because it
-- updates each one in place from its own stored tree. That is the rollback:
--
--   \i sql/step-av1-combination-casement-templates.sql
--
-- There is no need to patch the JSON by hand, and no DELETE is wanted here —
-- deleting these templates would lose them rather than restore their nosing.
