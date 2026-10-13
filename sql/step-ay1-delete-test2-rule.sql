-- Step AY-1: delete the stray "TEST2" price rule.
-- Run by Nathan in the Supabase SQL editor.
--
-- docs/integrate-config-sweep-2026-10-12.md: TEST2 is a stray April test rule
-- in a price file that is NOT PF30, and it is never used. "Tidy up later" —
-- this is later. Nothing else is touched.
--
-- IMPORTANT, in this order:
--
--   1. Run SECTION 0 on its own and KEEP ITS OUTPUT. It prints the whole row
--      as JSON. That JSON is the rollback — without it the row cannot be put
--      back, because this repository does not hold it (TEST2 is in another
--      price file, so it is not in pf30-snapshot.json and I have never seen
--      its values).
--   2. Then run SECTION 1, which deletes it.
--
-- Section 1 refuses to run unless it finds EXACTLY ONE rule named TEST2 and
-- that rule's price file is not PF30. A stray test rule is a tidy-up; a
-- script that deleted two rows, or a live PF30 rule, would not be.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 0 — read it first, and keep this output
-- ═══════════════════════════════════════════════════════════════════════════

-- 0a. Which rules are called TEST2, and in which price file.
SELECT r.id, r.name, r.price_file_id, f.name AS price_file_name,
       r.is_active, r.sort_order, r.group_name
FROM   public.price_rules r
LEFT   JOIN public.price_files f ON f.id = r.price_file_id
WHERE  r.name ILIKE 'TEST2'
ORDER  BY r.sort_order;

-- 0b. THE ROLLBACK DATA. Copy the whole json column somewhere safe before
--     running section 1 — it is the only way back.
SELECT r.id, to_jsonb(r.*) AS json
FROM   public.price_rules r
WHERE  r.name ILIKE 'TEST2';

-- 0c. Proof it is unused: any pricing-run line that names this rule. Expect
--     no rows. If there ARE rows, do NOT run section 1 — a rule a stored
--     quote priced through is history, not clutter.
SELECT l.pricing_run_id, count(*) AS lines
FROM   public.pricing_run_lines l
WHERE  l.rule_id IN (SELECT id FROM public.price_rules WHERE name ILIKE 'TEST2')
GROUP  BY l.pricing_run_id;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — the delete
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  _id    uuid;
  _n     int;
  _pf    text;
  _lines int;
BEGIN
  SELECT count(*) INTO _n FROM public.price_rules WHERE name ILIKE 'TEST2';
  IF _n = 0 THEN
    RAISE EXCEPTION 'No price rule named TEST2 — nothing to do (already deleted?)';
  END IF;
  IF _n > 1 THEN
    RAISE EXCEPTION 'Found % rules named TEST2, expected 1 — stopping; see section 0a', _n;
  END IF;

  SELECT r.id, f.name INTO _id, _pf
  FROM   public.price_rules r
  LEFT   JOIN public.price_files f ON f.id = r.price_file_id
  WHERE  r.name ILIKE 'TEST2';

  IF _pf IS NULL OR upper(_pf) = 'PF30' THEN
    RAISE EXCEPTION 'TEST2 is in price file % — the sweep says it is NOT in PF30, so stopping rather than deleting a live rule', coalesce(_pf, '(none)');
  END IF;

  SELECT count(*) INTO _lines
  FROM   public.pricing_run_lines WHERE rule_id = _id;
  IF _lines > 0 THEN
    RAISE EXCEPTION 'TEST2 has % stored pricing-run line(s) — stopping; a rule a quote priced through is history, not clutter', _lines;
  END IF;

  RAISE NOTICE 'Step AY-1: deleting price rule TEST2, id % (price file %)', _id, _pf;
  DELETE FROM public.price_rules WHERE id = _id;
END $$;

COMMIT;

-- ── Check ──────────────────────────────────────────────────────────────────

-- Expect no rows.
SELECT id, name, price_file_id FROM public.price_rules WHERE name ILIKE 'TEST2';


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- Paste the json from SECTION 0b in place of <JSON FROM 0b> and run this. It
-- restores the row exactly, its id included, so anything that referenced it
-- still does.
--
-- INSERT INTO public.price_rules
-- SELECT * FROM jsonb_populate_record(
--   NULL::public.price_rules,
--   '<JSON FROM 0b>'::jsonb
-- );
--
-- Then check it is back:
-- SELECT id, name, price_file_id FROM public.price_rules WHERE name ILIKE 'TEST2';
--
-- If section 0b's output was not kept, the row CANNOT be restored from this
-- repository: TEST2 lives in a price file that is not PF30, so it is not in
-- src/pricing/benchmarks/pf30-snapshot.json and its values are not recorded
-- anywhere here.
