# Step BS follow-up 2 — the POA row stored minutes as pounds

Done 16 Oct 2026. Brief: `docs/step-bs-followup-2.md` (reviewer, 19:50).

Commits: `b68073f` (item 0), `7ab83a5` (items 1–2), and the commit carrying this
report with the e2e fix and `sql/step-bs2-drawing117-set-flag.sql` (below).

**SQL: one small optional file**, `sql/step-bs2-drawing117-set-flag.sql` — not
for the rows the brief names (those are superseded by a re-price, see item 3)
but to clear a flag the first e2e run left on drawing 117. Details under "The
e2e".

Offline suite: **2,255 passing, 8 failing** — the standing eight and nothing
else; 89 tests in `priceDrawingPersistence.test.js`, 80 of them new. `npm run
e2e` against the deploy of `7ab83a5`: **10 passed, 0 skipped** — the reviewer
has set `E2E_WRITE_DRAWING_ID`, so both write-gated steps now run. Lint:
nothing new. `npm run build` clean.

**Verified on the live database**, not just offline: the POA e2e step
re-priced lead 14 during the run, and the newest run on drawing 117,
`8e4152e8` (18:55 UTC), holds exactly the split the brief asked for:

| Labour rule row | quantity | value | cost | sales | markup | loop |
|---|---|---|---|---|---|---|
| (fitting units) | 22.25 | 40.21 | 894.67 | 1,789.35 | 2 | — |
| `POA — Frame buried extra rip out time (180 min)` | 3.00 | 40.21 | 120.63 | 241.26 | 2 | drawing_poa |

Sum 1,015.30 / 2,030.61; run total 2,464.13 / 4,928.27; `f44f3e8a` failed
(Superseded); no run in_progress.

---

# Item 1 — the rows are hours and pounds, and they add up

**What was wrong.** Follow-up 1 gave the POA minutes line the Labour price
rule's id so it could be written at all, and so a Labour-rule row carried
`quantity 180, cost 180, sales null`. The run total was right because the
engine sums its own breakdown; the rows were £180 wrong on this drawing and
by the minutes on any drawing with a labour POA line.

**What it is now** (`pricingEngine.js`, pass 3): when the item has labour POA
lines, the Labour price rule is **split** the way Integrate's labour editor
shows it — the fitting units on one line and each POA line on its own:

* main line: `installation_labour_time` = the fitting-units hours
  (`instHours − Σ POA hours`), 22.25 × 40.21 = 894.67;
* one line per POA line: its own hours (`round(minutes / 60, 2)`), 3.00 ×
  40.21 = 120.63, `alloc_label "POA — <description> (180 min)"`,
  `loop_target 'drawing_poa'`, the rule's own value and markup.

`installation_labour_time` itself is untouched (25.25; the stored variable
snapshot shows it, and `total_install_minutes` 1,515 is what the quote page
reads for quote-level labour). The engine's own breakdown — the board's
Price part and the benchmark page — shows the same two lines.

**Penny-safe.** Integrate prices this as ONE line (25.25 × 40.21 =
1,015.30), and two independently rounded lines can differ from it by a penny
on another drawing. So the **last POA line takes the remainder**: `whole −
main − earlier POA lines`, in cost and in sales. The rows therefore always sum
to exactly the single-line figure, the run total is the same to the penny as
before the split, and **no benchmark can move** — the offline suite is the
standing eight, and the live benchmark page passed.

**The minutes line** from pass 2 (`POA — <description>`, 180 minutes, family
install_labour) stays in the engine's breakdown so the hours are traceable,
but is **not persisted** (`persisted: false`, filtered in
`installResultRows`): its pounds now live in the Labour price row, and a
minutes row as well would count them twice. `installResultRows` still refuses
any other line with no rule, by name.

# Item 2 — the tests

`src/pricing/priceDrawingPersistence.test.js`, through `priceDrawing` against
the fake client (thenable, no `.catch`, the fixture's own profile values):

* LQ4: the Labour rule's two rows exactly as the table above, summing to
  1,015.30 / 2,030.61; every price-rule row numeric in cost **and** sales;
  the minutes rows belong to labour-family rules only and never to a price
  rule; no persisted row with `loop_target_type drawing_poa` outside the
  Labour price rows; `installation_labour_time` 25.25 and the run total
  2,464.13 / 4,928.27; the engine's own breakdown shows the same two lines.
* **Every benchmark fixture** (71 of them, from `benchmarks/index.js` and
  `fixtureLiveQuotes.js`): priced through `priceDrawing`, the persisted
  price rows grouped by rule group sum to the group totals the engine
  reports for the same inputs, every price row is numeric in cost and sales,
  every minutes row is a labour-family rule's, and the run header equals
  the rows. `BENCHMARK_B_UNCORRECTED` carries no profile values and the
  engine itself throws on it; the test proves the same inputs throw the same
  way outside `priceDrawing` and that the run was marked failed, which is
  what a fixture limitation should look like. This is the test that would
  have caught the 180 — a minutes row under a price rule fails the "numeric
  sales" check on the first fixture with a POA line — and it will catch the
  next one.

# Item 3 — run cc245859: no correction in place

Its two rows are a correct run of the *previous* engine. Readers take the
latest complete run, and the POA e2e step has already re-priced lead 14, so
`8e4152e8` is the latest and holds the split. Correcting `cc245859` in place
would be rewriting history for no reader; not done, and no SQL for it.

# Item 4 — deploy; e2e; and the e2e that found a second thing

Deployed `7ab83a5`; `npm run e2e` 10 passed (after the fix below).

**The e2e save step was racing its own save.** With `E2E_WRITE_DRAWING_ID`
now set, Step BO's "saves the picked line, reloads and finds it" ran for the
first time and failed: the line was not there after the reload. The board's
Unsaved marker is `dirty && saveStatus !== 'saving'`, so it hides the moment
Save is clicked — the step "waited" for nothing, reloaded mid-save, and the
write was aborted. Confirmed on the database: 117's paint part had no picked
line. Both write-gated specs now wait for the save to **finish** (the Save
button reads "Saving..." in flight and is disabled once clean; a failed save
leaves it enabled and the wait times out loudly). The step then passed, and
its reload proves the picker set really round-trips live.

**The residue, and the SQL.** That first failed run's cleanup removed the
unsaved line from the in-memory set and saved — which stored
`ironmongerySetEdited: true` on drawing 117 over its two unchanged default
lines (trickle_vent_xr16 ×1, trickle ×1). The lines are right; the flag
means the panel will not re-derive 117's defaults if the rules change.
`sql/step-bs2-drawing117-set-flag.sql` clears it (SECTION 0 shows the row;
the update only touches a row whose every line is a rule default; rollback
DO NOT RUN). The cleanup itself now puts the defaults back through "Apply
Defaults" — flag and all — whenever the set was the defaults before the
test, and only ever removes its own line otherwise, so this cannot recur.

---

# What the reviewer should see

1. Drawing 117's latest run already shows the split (table above). Any
   re-price of lead 14 gives the same: Labour **894.67 + 120.63 =
   1,015.30**, total **2,464.13**.
2. Run `sql/step-bs2-drawing117-set-flag.sql` if 117 should go back to a
   plain rule-default set (it only matters if the default rules change).

Nothing is waiting on Nathan.
