-- Step BP — drawing 117 (lead 14, PRICING TEST copy of L32520 item 16): remove the picked line the
-- Step BP deploy's e2e run left behind, and clear the ironmongery "edited" flag.
--
-- The e2e save step adds kenrick_extension_490mm through the picker, saves, reloads and finds it,
-- then puts the drawing back. On the deploy of 213a3e2 its cleanup clicked a selector that matched
-- BOTH "Apply Defaults" (the panel) and "Apply defaults" (the confirm dialog) and stopped there, so
-- the line it had just saved stayed: paintAndIronmongeryPart.values.ironmongeryLines now holds
-- trickle_vent_xr16 x1 (default), trickle x1 (default), kenrick_extension_490mm x1 (picked), and
-- ironmongerySetEdited = true. The selector is fixed (exact dialog label); the test cannot tell its
-- own residue from a surveyor's choice, so this puts the drawing back by hand.
--
-- Test data only; one jsonb value on one row. Supersedes sql/step-bs2-drawing117-set-flag.sql.
--
-- RUN SECTION 0 FIRST.

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read before changing
-- ════════════════════════════════════════════════════════════════════════════
-- Expect ONE row: edited = true, three lines, the third kenrick_extension_490mm x1 (picked).
SELECT id, drawing_id,
       values->'ironmongerySetEdited' AS edited,
       (SELECT string_agg(l->>'product_short_name' || ' x' || (l->>'qty') || ' (' || coalesce(l->>'source','?') || ')', ', ')
          FROM jsonb_array_elements(coalesce(values->'ironmongeryLines','[]'::jsonb)) l) AS lines
FROM   public.drawing_parts
WHERE  drawing_id = 117 AND part_type = 'paintAndIronmongeryPart';

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — drop the picked test line, clear the flag
-- ════════════════════════════════════════════════════════════════════════════
UPDATE public.drawing_parts
SET    values = (values - 'ironmongerySetEdited')
                || jsonb_build_object('ironmongeryLines',
                     (SELECT coalesce(jsonb_agg(l), '[]'::jsonb)
                        FROM jsonb_array_elements(coalesce(values->'ironmongeryLines','[]'::jsonb)) l
                       WHERE NOT (l->>'product_short_name' = 'kenrick_extension_490mm'
                                  AND coalesce(l->>'source','') = 'picked')))
WHERE  drawing_id = 117
  AND  part_type  = 'paintAndIronmongeryPart'
  AND  EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(values->'ironmongeryLines','[]'::jsonb)) l
               WHERE l->>'product_short_name' = 'kenrick_extension_490mm' AND coalesce(l->>'source','') = 'picked');

-- After: expect edited = NULL and the two default lines only.
SELECT id, values->'ironmongerySetEdited' AS edited,
       (SELECT string_agg(l->>'product_short_name' || ' x' || (l->>'qty') || ' (' || coalesce(l->>'source','?') || ')', ', ')
          FROM jsonb_array_elements(coalesce(values->'ironmongeryLines','[]'::jsonb)) l) AS lines
FROM   public.drawing_parts
WHERE  drawing_id = 117 AND part_type = 'paintAndIronmongeryPart';

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — DO NOT RUN unless reverting this file
-- ════════════════════════════════════════════════════════════════════════════
-- UPDATE public.drawing_parts
-- SET    values = values
--                 || '{"ironmongerySetEdited": true}'::jsonb
--                 || jsonb_build_object('ironmongeryLines',
--                      coalesce(values->'ironmongeryLines','[]'::jsonb)
--                      || '[{"product_short_name":"kenrick_extension_490mm","finish_code":"PC","qty":1,"source":"picked","rule_id":null,"scope_part_id":null}]'::jsonb)
-- WHERE  drawing_id = 117 AND part_type = 'paintAndIronmongeryPart';
