-- Step BS follow-up 2 — drawing 117 (lead 14, PRICING TEST copy of L32520 item 16): clear the
-- ironmongery "edited" flag the first e2e run left behind.
--
-- The first run of the e2e save step reloaded mid-save (the test waited for the Unsaved marker,
-- which hides the moment Save is clicked), so its picked line was never written — and its cleanup
-- then removed that line from the in-memory set and saved, which stored
-- paintAndIronmongeryPart.values.ironmongerySetEdited = true over the two unchanged default
-- lines. The lines ARE the rule defaults (trickle_vent_xr16 x1, trickle x1); only the flag is
-- wrong, and it stops the panel re-deriving the defaults on 117 if the rules ever change.
--
-- Test data only; one jsonb key on one row. The e2e cleanup now restores the defaults through
-- "Apply Defaults", which clears the flag, so this cannot recur from the suite.
--
-- RUN SECTION 0 FIRST.

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ════════════════════════════════════════════════════════════════════════════
-- Expect ONE row: edited = true, two lines, both source 'default'.
SELECT id, drawing_id,
       values->'ironmongerySetEdited' AS edited,
       (SELECT string_agg(l->>'product_short_name' || ' x' || (l->>'qty') || ' (' || coalesce(l->>'source','?') || ')', ', ')
          FROM jsonb_array_elements(coalesce(values->'ironmongeryLines','[]'::jsonb)) l) AS lines
FROM   public.drawing_parts
WHERE  drawing_id = 117 AND part_type = 'paintAndIronmongeryPart';

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — clear the flag (only where every line is a rule default)
-- ════════════════════════════════════════════════════════════════════════════
UPDATE public.drawing_parts
SET    values = values - 'ironmongerySetEdited'
WHERE  drawing_id = 117
  AND  part_type  = 'paintAndIronmongeryPart'
  AND  values->'ironmongerySetEdited' = 'true'::jsonb
  AND  NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(coalesce(values->'ironmongeryLines','[]'::jsonb)) l
         WHERE  coalesce(l->>'source','') <> 'default');

-- After: expect edited = NULL, the same two lines.
SELECT id, values->'ironmongerySetEdited' AS edited,
       jsonb_array_length(coalesce(values->'ironmongeryLines','[]'::jsonb)) AS n_lines
FROM   public.drawing_parts
WHERE  drawing_id = 117 AND part_type = 'paintAndIronmongeryPart';

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — DO NOT RUN unless reverting this file
-- ════════════════════════════════════════════════════════════════════════════
-- UPDATE public.drawing_parts
-- SET    values = values || '{"ironmongerySetEdited": true}'::jsonb
-- WHERE  drawing_id = 117 AND part_type = 'paintAndIronmongeryPart';
