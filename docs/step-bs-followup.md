# Step BS follow-up — the POA labour line cannot be saved live (reviewer, 16 Oct 2026, 19:35)

Commit this file as item 0.

## What happened live
Drawing 117 (LQ4, lead 14): the reviewer added the labour line "Frame buried extra rip out time", 180 minutes,
through the new panel. The panel showed "+180 min fitting", the save wrote
`pricePart.values.poaLines = [{type: labour, category: installation, description: ..., amount: 180}]` (confirmed in
drawing_parts), and "Price quote" on /leads/14/quotes then FAILED:

    [priceDrawing] error: Error: Failed to write install_labour results: null value in column "price_rule_id"
    of relation "drawing_rule_results" violates not-null constraint
    Uncaught (in promise) TypeError: t.from(...).update(...).eq(...).catch is not a function

pricing_runs f44f3e8a-3166-4c69-a714-756ae36255c6 (drawing 117, 18:33:08 UTC) is left with status in_progress,
total_cost null and 25 of ~77 lines written. It is the only non-complete run in the table.

## Why
1. The report's own design: the labour POA line is "pushed as its own breakdown line, `POA — <description>`,
   loop_target drawing_poa, group POA". It has no price rule behind it, so `price_rule_id` is null, and
   drawing_rule_results.price_rule_id is NOT NULL. The offline suite never persists a run, so it could not see this,
   and the e2e did not price a drawing that has a POA line.
2. The error path then calls `.catch()` on a PostgREST builder (not a Promise), so the run is never marked failed.

## The work
1. Give the labour POA line a real rule to hang off. The minutes ARE installation labour, which is the "Labour"
   price rule (quantity installation_labour_time). Write the line as a result of that rule (price_rule_id = the
   Labour rule's id, loop_target 'drawing_poa', part_label "POA — <description>", quantity = the minutes), the way
   cost lines already hang off "Drawing POA". Do NOT add a new price rule for this. Keep the hours arithmetic exactly
   as it is (P1 31.50 h, P2 25.25 h); LQ4 stays exact offline.
2. Fix the failure path: await the update, check `error`, mark the run status 'failed' with the message in
   warnings. A run must never be left in_progress after an exception.
3. Write a test at the persistence layer (the function that writes drawing_rule_results) that rejects — or, better,
   cannot produce — a line with no price_rule_id, and one that proves a thrown error marks the run failed.
4. sql/step-bs1-stuck-run.sql for the reviewer: SECTION 0 shows the stuck run and its 25 lines; then deletes those
   lines and the run f44f3e8a (it is a broken run on a test drawing, not customer data); rollback section DO NOT RUN.
   Or, if the engine should instead overwrite/clean stale in_progress runs itself on the next price, do that and
   say so — then no SQL.
5. Add to the e2e: price a drawing that carries a POA line and assert the run completes (the suite's existing
   read-only pattern — if that needs a nominated drawing, use E2E_WRITE_DRAWING_ID and say so).
6. Deploy, npm run e2e. Report docs/reports/step-bs-followup.md. After it the reviewer re-prices lead 14 and expects
   drawing 117 labour 1,015.30, cost 2,464.13.
