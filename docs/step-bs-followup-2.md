# Step BS follow-up 2 — the POA row stores minutes as pounds (reviewer, 16 Oct 2026, 19:50)

Commit this file as item 0.

## Seen live after the follow-up
Lead 14 re-priced: drawing 117 run cc245859 complete, total_cost 2,464.13 / 4,928.27 = Integrate, and the stuck run
f44f3e8a is now failed with the Superseded warning. Good. But the stored rows do not add up to that total:

    Labour rule rows in drawing_rule_results, run cc245859:
      part_label null                                   quantity 25.25  value 40.21  cost 1015.30  sales 2030.61  markup 2
      "POA — Frame buried extra rip out time"           quantity 180    value null   cost 180      sales null     markup null

The POA row's COST column holds the 180 MINUTES. Summing the labour group's rows gives 1,195.30, not 1,015.30; the
run's total is right only because the engine totals its own breakdown rather than these rows. Anything that reads
drawing_rule_results by cost (the reviewer's checks, reports, any future quote breakdown built from rows) is £180
wrong on this drawing, and would be wrong by whatever the minutes are on any drawing with a labour POA line.

## The work
1. Make the rows honest and additive, mirroring Integrate's labour editor (fitting units + the POA line):
   - the plain Labour row carries the fitting-units hours only: quantity 22.25, value 40.21, cost 894.67,
     sales 1,789.35, markup 2;
   - the POA row carries its own hours: quantity 3.00 (hours, not minutes), value 40.21, cost 120.63, sales 241.26,
     markup 2, part_label "POA — <description> (180 min)", loop_target_type drawing_poa.
   The two rows then sum to 1,015.30 / 2,030.61 and `installation_labour_time` stays 25.25. If the engine's own
   breakdown is what the board and benchmark page show, the same split must show there (two labour lines).
2. Test: for LQ4 through priceDrawing, the Labour rule's persisted rows sum to the labour group total, and every
   persisted row has numeric cost and sales. Generalise: assert for EVERY benchmark fixture that the persisted rows
   per group sum to the group total the engine reports — that would have caught this and will catch the next one.
3. No SQL unless you decide the run cc245859's two rows should be corrected in place; if so write
   sql/step-bs2 (SECTION 0 shows them) and the reviewer runs it. Otherwise the reviewer re-prices lead 14 again.
4. Deploy, npm run e2e. Report docs/reports/step-bs-followup-2.md.
