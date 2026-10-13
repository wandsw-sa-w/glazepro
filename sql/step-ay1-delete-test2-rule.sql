-- =============================================================================
-- Step AY-1: delete the stray "TEST2" price rule.
-- REVIEWER REWRITE (13 Oct) of Claude Code's version, from the LIVE row (read with /dev/sql):
--   * the only rule named TEST2 is id 097070f8-61d9-41ef-9f11-c596d9843e72, created 17 Apr 2026,
--     with nonsense text in its fields ("tris_box_sashue", "0is_frame_redwood", group "123");
--   * its price_file_id c7af3ab7-… points at NO existing price file (the file was deleted), so the
--     original "its price file is not PF30" check would have stopped on a NULL name;
--   * the original also checked a pricing_run_lines table that does not exist (runs are in
--     pricing_runs, whose rows do not mention this id anywhere — counted 0).
-- The full row is in the rollback below, so it can be put back exactly.
-- =============================================================================

BEGIN;
DELETE FROM public.price_rules
WHERE  id   = '097070f8-61d9-41ef-9f11-c596d9843e72'
  AND  name = 'TEST2';
COMMIT;

-- Check: expect no rows.
SELECT id, name FROM public.price_rules WHERE name ILIKE '%TEST2%';

-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback (restores the row exactly, id included)
-- ---------------------------------------------------------------------------
-- INSERT INTO public.price_rules
-- SELECT * FROM jsonb_populate_record(NULL::public.price_rules, '{
--   "id": "097070f8-61d9-41ef-9f11-c596d9843e72", "name": "TEST2", "level": "item",
--   "value": "0is_frame_redwood", "markup": 0, "comment": "", "raw_qty": null, "category": null,
--   "quantity": "0sash_replacement_thickness", "condition": "tris_box_sashue", "is_active": true,
--   "part_code": null, "created_at": "2026-04-17T07:50:33.896216+00:00", "group_name": "123",
--   "sort_order": 10, "loop_target": "frame", "output_unit": "gbp", "rule_family": "price",
--   "needs_review": false, "imported_from": null,
--   "price_file_id": "c7af3ab7-820e-4ad4-8849-195061942dad", "raw_condition": null }'::jsonb);
