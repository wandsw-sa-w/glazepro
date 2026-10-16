# Step BS follow-up — the POA labour line could not be priced live

Done 16 Oct 2026. Brief: `docs/step-bs-followup.md` (reviewer, 19:35).

Commits: `5a5a264` (item 0, the brief), `f5013d4` (items 1–5), and this report.

**SQL: none.** The stuck run is tidied by the engine (item 4 below).

Offline suite: **2,171 passing, 8 failing** — the standing eight and nothing
else. 5 new tests, all at the persistence layer, against a fake client shaped
like the real one. `npm run e2e` against the deploy of `f5013d4`: **8 passed,
2 skipped** — the new POA pricing step and Step BO's save half, both gated on
`E2E_WRITE_DRAWING_ID`. Lint: nothing new (the e2e folder's `process` warnings
are the same on every spec). `npm run build` clean.

---

# What went wrong, exactly

Two faults, one visible and one hiding behind it:

1. **The line had no rule.** Step BS pushed the labour POA line into the
   install breakdown as its own line with `rule_id: null`. Offline that is a
   number in a total; live, `drawing_rule_results.price_rule_id` is NOT NULL
   and the insert failed. The offline suite never persists a run, and the e2e
   never priced a drawing with a POA line, so neither saw it.
2. **The failure path could not fail.** It called `.catch()` on a PostgREST
   builder — thenable, but not a Promise and with no `.catch` — so the
   TypeError escaped before the run was marked, and run `f44f3e8a` on drawing
   117 sat `in_progress` with 25 of its lines written.

The new test file reproduces both against a fake client with **no `.catch`**:
on the old engine the first test fails with the live NOT NULL message and the
fourth with the live TypeError.

---

# Item 1 — the line hangs off "Labour"

The minutes ARE installation labour, and the "Labour" price rule
(`quantity: installation_labour_time`) is what prices them. So the POA line
is written as a result of that rule: `price_rule_id` = the Labour rule's id,
`loop_target_type 'drawing_poa'`, `part_label "POA — <description>"`,
`quantity` = `cost` = the minutes — the way cost lines already hang off
"Drawing POA". **No new rule.** The rule is found by what it reads
(`/\binstallation_labour_time\b/` in a price rule's quantity), not by its
name, so a renamed rule still works and a price file with no such rule gives
a null that the writer refuses (item 3) rather than a silent orphan row.

**The hours arithmetic is untouched**: through `priceDrawing` itself, LQ4
stores `installation_labour_time` 25.25, its Labour row is 1,015.30 and the
run's `total_cost` is 2,464.13. P1's 31.50 h path is the same code.

# Item 2 — a run is never left in_progress

The catch now awaits the update, reads `error`, and marks the run `failed`
with `warnings: ['Pricing failed: <message>']` so the breakdown can say why;
a second failure inside the catch is logged, not thrown. Tested: an insert
that fails with the live message leaves the run `failed` carrying that
message, no `complete` update is sent, and `priceDrawing` returns
`{ success: false, error }`.

# Item 3 — the persistence layer refuses a line with no rule

`installResultRows(lines, { drawingId, priceFileId, pricingRunId })` is
exported from `pricingEngine.js` and builds the install rows. A fired line
with `rule_id == null` throws, by name, before anything is sent:
`install_labour line "POA — x" has no price rule behind it (price_rule_id
would be null)`. That is the "cannot produce" the brief asked for: a
programming error shows in a test, and if one ever reached live it would now
fail the run cleanly (item 2) instead of half-writing it.

# Item 4 — the stuck run: tidied by the engine, no SQL

Before a new run is inserted, `priceDrawing` marks every `in_progress` run on
that drawing `failed` with `warnings: ['Superseded: this run was left
in_progress and never finished; a later run replaced it']`. Readers only take
`complete` runs (`drawingRunPrice.js`), so a stuck run was never priced from;
this is so one cannot sit there for ever, whatever left it — a crash, a
closed tab, or the old failure path. Tested that the sweep is issued, with
`drawing_id` and `status = in_progress` filters, before the run insert.

So **run `f44f3e8a` is marked failed the moment the reviewer re-prices lead
14**, and its 25 orphan lines stay attached to a failed run, which is what a
failed run looks like. I chose this over `sql/step-bs1` because the brief
offered it and it fixes the class, not the instance; if the reviewer would
rather the 25 rows were gone, that is a one-line delete they can write
against `pricing_run_id = 'f44f3e8a-…'`, and I will add the file on request.

# Item 5 — the e2e

`e2e/poa-pricing.spec.js`: opens `E2E_WRITE_DRAWING_ID`, selects **Price**,
adds a labour line only if the drawing has none (and saves), follows the
board's own lead button to `/leads/<id>/quotes`, clicks **Re-price all**
("Price quote" skips a drawing whose run looks current), waits for pricing to
finish, and asserts no error under the button (the live failure showed
exactly there) and a £ price on every card. **Pricing writes a run, so the
step is skipped without `E2E_WRITE_DRAWING_ID`** — set it to **117** and both
write-gated steps run; drawing 117 already carries the reviewer's own line,
so the step adds nothing to it.

---

# What the reviewer should do live

1. Re-price lead 14 ("Price quote" or "Re-price all"). Expect drawing 117
   **labour 1,015.30, cost 2,464.13**, no error, and `pricing_runs
   f44f3e8a` now `failed` with the "Superseded" warning. The breakdown's
   install lines should show `POA — Frame buried extra rip out time` at 180.
2. Put `E2E_WRITE_DRAWING_ID=117` in `.env.e2e` and `npm run e2e` runs the
   POA pricing step and Step BO's save half.

Nothing is waiting on Nathan.
