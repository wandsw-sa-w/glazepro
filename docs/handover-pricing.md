# Handover — GlazePro pricing parity work (written 7 Oct 2026 for a fresh Claude Code session)

Read this whole file before touching anything. It replaces the earlier conversation.

## What GlazePro is

A React + Vite (JSX) app on Supabase and Vercel that will replace "Integrate", the system
Wandsworth Sash Windows uses today. Nathan (Operations Director, not a developer) runs the
project. He pastes prompts to you, runs SQL himself in Supabase, and passes your report to a
reviewer who checks everything you say against the repository and the live site
(glazepro.vercel.app). Assume every claim you make will be checked.

## Rules that are not negotiable

1. **Integrate's figures are facts.** `src/pricing/benchmarks/integrate-targets.json` and
   `docs/integrate-benchmarks-stage4.txt` hold numbers read from Integrate. Never edit them to
   agree with GlazePro. On 7 Oct the previous session changed targets to match its own output so
   its tests would pass. Do not repeat that. A failing test that tells the truth is the right
   outcome when GlazePro disagrees with Integrate.
2. **No tuned constants and no tuned fixture values.** If a number will not match, report the
   size of the gap and what you believe causes it. Do not adjust anything to close it.
3. **Say "not verified" when you have not run it.** You cannot reach the live database (the anon
   key returns empty results because of row level security; an empty result is not evidence that
   data is missing). Never write "matches", "passes" or "unchanged" about the live site. State
   what your tests show and what you could not check.
4. **Never run SQL.** Write SQL files in `sql/` with a rollback section headed "DO NOT RUN", and
   list them in run order. Nathan runs them. List only the files **that step wrote** — do not
   carry a running "SQL to run" list forward from earlier steps. Everything up to and including
   `sql/step-ai1-complete-new-45mm-rule.sql` has been run (checked 9 Oct 2026: step-t1/t2 and
   step-u1/u1b long since, step-ah1 templates at 45 mm, step-ai1 rule id 159 active).
5. **Git:** stage only files you changed, by name (never `git add -A`); one commit per numbered
   item; push at the end. The working tree has unrelated modified files with line-ending noise
   (several `sql/step-*.sql`, `src/drawingBoard/renderElevation.jsx`, `src/pages/LeadDetail.jsx`,
   `src/quotes/gridColumns.js`, `src/supabase.js`, `vercel.json`, `public/version.json`): leave
   them alone. Keep each file's existing line endings.
6. **Supabase calls** always destructure `error` and surface it. A failed load must never be
   shown as an empty or zero result.
7. No browser `alert` / `confirm`; use in-page dialogs.
8. If an instruction here does not match the code you find, stop and say so.

## Where pricing stands (checked on the live site, 7 Oct 11:30)

`/dev/pricing-benchmark` prices three fixture drawings with the live PF30 rules and catalogues:

| Benchmark | GlazePro cost / price | Integrate cost / price | State |
|---|---|---|---|
| L34046 Item 7, complete new box sash | 1,238.43 / 2,449.95 | 1,241.56 / 2,456.24 | 3.15 cost short |
| A, sash replacement (L31115 item 1) | 730.46 / 1,411.99 | 728.26 / 1,408.66 | 2.20 cost over |
| B, draught seal, corrected | 208.33 / 522.65 | 208.33 / 522.65 | exact |

Known causes:
- **L34046:** the second ironmongery line, "Trickle Vent XR16 Recessed Slot Vent White", prices
  at 0.00. Target 3.15 cost / 6.30 price. It priced correctly before commit ef0bb62 moved
  ironmongery loading into `loadPricingContext`; this is a regression in that loader or in
  `resolveIronmongeryLines`. With it fixed GlazePro should show 1,241.58 / 2,456.25, which is
  2p / 1p above Integrate: Manufacture Materials comes to 115.47 against Integrate's 115.45.
  That 2p is a real, unexplained gap. Find which line carries it by comparing with the line
  list in `docs/integrate-benchmarks-stage4.txt`; report it; do not hide it.
- **A:** lead weights. GlazePro 17.4 kg top / 17.9 kg bottom; Integrate 17.2 / 17.3 (before the
  15% wastage in the Lead Weight rule). Everything else on A matches. `sashWeight.js` was
  calibrated to L34046 (19.4 / 20.4, which it reproduces) and contains constants that were
  tuned, including a Victorian horn of 50 mm where `pricingEngine.js` uses 70 mm. Leave the
  weights alone in this session: the reviewer is getting Integrate's own weight calculation.

Decided facts you must not revisit:
- Glass price uses the cut size: each edge extends past the sightline by (rebate width −
  tolerance), read from the drawing's profile values
  (`glassPart.defaultDoubleGlazingRebateWidthForSash`, `glassPart.defaultDoubleGlazingTolerance`;
  14 and 2 on the Sash profile). `rounded_area = max(round(actual_area, 2), 0.30)`.
- Sash weight uses the sightline size, not the cut size (using the cut size made every weight
  about 0.9 kg too heavy and moved manufacture time up a band).
- Overall frame = opening + left jamb + right jamb by opening + head + cill; `frame_area` for
  the draught seal rate is that overall area.
- Benchmark B's correction is deliberate and recorded in `docs/integrate-differences.md`:
  the three sash material rules only fire when the sash is being made.
  `sql/step-s4-sash-material-rules.sql` has been run.
- Yorkshire sashes are no longer sold. Never build them.

## The problem that matters most

Until 7 Oct, real quotes were priced by `priceDrawing()` with no glass catalogue, no component
allocation, no part costs and no ironmongery, while the benchmark page supplied all of them. The
"matches Integrate" result was only ever true of the benchmark page. `loadPricingContext` now
feeds both. Two things remain:

- Nobody can see what a real quote's price is made of, so nobody can confirm the real path is
  complete. Test lead L507712 drawing 2 priced at 1,912.10 through "Price quote" this morning
  with no way to inspect it.
- "Price quote" does not re-price a drawing whose tree has not changed. Drawing 1 on L507712 is
  still 1,622.44, a figure produced by the old incomplete path.

## Work for this session

Do these in order. One commit each.

### 1. Trickle vent regression
Make the L34046 fixture's second ironmongery line price at 3.15 / 6.30 through the shared
loader. Find the cause; say what it was. If the fixture's product name does not resolve against
the catalogue shape the loader builds, the page must show its "Product not found" warning rather
than a silent zero — check that warning actually appears for an unresolved line.

### 2. Price breakdown on a real drawing
Add a "Price breakdown" view reachable from the drawing board's Price part and from each drawing
card on the Quote Matrix. It shows, for the drawing's latest pricing run: price file, date, who
ran it, then every rule that fired grouped as the benchmark page groups them (rule name, part,
quantity, value, cost, markup, price), group totals, item cost and price, and all warnings from
the run. It must show exactly what was stored for that run, not a fresh calculation. If
`drawing_rule_results` does not hold quantity, value and the part label, add the columns (SQL
file for Nathan) and write them at pricing time; older runs then show "detail not recorded".
Reuse the benchmark page's table component so the two cannot drift.

### 3. Re-pricing
- Add `PRICING_ENGINE_VERSION` (an integer in one module, bumped by hand whenever pricing logic
  changes; start at 2) and store it on `pricing_runs` (SQL file). A drawing is re-priced when
  its tree hash, its price file, or the engine version differs from its latest successful run.
- Show "Priced with an older version" on drawing cards and in the Quote Overview strip for open
  quotes where that is the case, and add "Re-price all" to an open quote. Published quotes are
  never re-priced; they keep their snapshot.
- Say which stored totals change when a drawing is re-priced and confirm quote totals, payment
  stages and the PDF preview read the new figures.

### 4. Tests that tell the truth
- `benchmarks.test.js` reads targets only from `integrate-targets.json`.
- A "Download snapshot" button exists on the benchmark page. Make sure the snapshot contains
  everything `loadPricingContext` returns plus the profile values used, and that with
  `src/pricing/benchmarks/pf30-snapshot.json` present the tests price all three benchmarks from
  it with no other hand-typed catalogue data. Without the file those tests are skipped and
  labelled as skipped.
- Expected after item 1, with a snapshot: B passes; A fails on installation materials by the
  lead weight amount only; L34046 fails by 2p / 1p in Manufacture Materials only. Any other
  failure is new information: report it.

## Report format

For each item: files changed; any SQL files **this step wrote**, in run order (nothing if the
step wrote none — never repeat files from earlier steps); what the tests show; what is not
verified against the live database; anything that did not behave as this note describes.
