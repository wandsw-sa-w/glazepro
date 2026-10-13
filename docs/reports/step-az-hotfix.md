# Step AZ hotfix — a live door prices no timber

Done 13 Oct 2026. Brief: `docs/step-az-hotfix-brief.md` (committed first, `4142c78`).
Commits: `4142c78` the brief, `d1d538f` the work.

**No SQL. This step wrote no SQL files** — there is nothing for Nathan to run.
No pricing rule, no profile value, no benchmark target and no
default-ironmongery rule was changed. **No pricing engine version bump** — the
engine is still 16; see the open question at the end.

**A test was written to fail first for every item**, and each is named below
with what it reported before the fix.

---

## 1. The bug: `priceDrawing` never passed the drawing's profile code

**Files:** `src/pricing/pricingEngine.js`, `src/pricing/loadPricingContext.js`,
`src/quotes/buildSnapshot.js`, `src/pages/dev/PricingBenchmark.jsx`,
`src/pricing/priceDrawingProfile.test.js` (new),
`src/pricing/profileCodeCallers.test.js` (new),
`src/pricing/loadPricingContext.test.js`.

`priceDrawing` loaded `drawings.default_profile_id` for the profile **values**
and never resolved the profile **code**. `computeVariables` derives
`is_single_and_french_doors_range`, `is_open_in_doors_range` and
`is_replacement_sashes_range` from `opts.profileCode` **and from nothing
else**, so on every drawing priced through `priceDrawing` all three were
`false` — and the live rule "Utile Section Part" is conditioned on the first
two. A French door therefore priced **no timber at all**:
`manufacture_materials` 25.00, which is LTW on its own.

Three places needed it, not one:

| | What it feeds |
|---|---|
| `runPricingOnTree(...)` | the price, labour and production rules — the missing timber |
| `resolveIronmongeryLines(...)` | the default-ironmongery rules, which take the same variables |
| `computeVariables(...)` at step 7 | the **stored** snapshot — the row the reviewer read `false` off |

The code is read with the **injected** Supabase client (this function takes
its client as an argument) rather than through `api.js`'s
`loadDrawingProfileCode`, and it returns `null` rather than throwing, exactly
as that helper does: a drawing whose profile row cannot be read must still
price, with the flags false.

### Every caller, audited

The brief asked for each one, fixed or already right:

| Caller | What it does | State |
|---|---|---|
| `pricingEngine.js` — `runPricingOnTree` | the engine itself | already right (takes `profileCode` as an option) |
| `pricingEngine.js` — `priceDrawing` | **the board's price, the matrix, every re-price** | **FIXED** (three call sites) |
| `loadPricingContext.js` — `resolveIronmongeryLines` | default ironmongery for pricing | **FIXED** (new `opts.profileCode`) |
| `quotes/buildSnapshot.js` | the quote snapshot's default-ironmongery fallback | **FIXED** |
| `pages/dev/PricingBenchmark.jsx` | the variables panel, and its own ironmongery call | **FIXED** |
| `pages/DrawingBoard.jsx` (×2) | the board's live variables | already right |
| `pages/QuoteMatrixPage.jsx` | the matrix cards | already right |
| `pages/QuoteOverview.jsx` | the overview | already right |
| `pages/ValidationRules.jsx` | validation against a drawing | already right |
| `quotes/publishQuote.js` | the publish gate | already right (uses the snapshot's `profile_code`) |

The four that were wrong are all **computed** paths — a stored list or an
explicit option hid the omission everywhere else.

### What the tests show

`src/pricing/priceDrawingProfile.test.js` prices a door **through
`priceDrawing` itself**, against a mock Supabase client, and reads back what
it wrote. Before the fix:

```
× a door priced through priceDrawing gets its Utile Section Part lines
    Utile Section Part lines written: expected +0 to be 3
× the stored variable snapshot carries the range flags, not false
    expected false to be true
× a sashes_only drawing gets is_replacement_sashes_range
    expected false to be true
```

After: the three Utile lines appear and sum to **370.95**, the snapshot reads
`is_single_and_french_doors_range: true`, and a `sashes_only` drawing gets
Step AY's variable. A fourth test pins the null case: a drawing whose profile
cannot be read still prices, with the flags false.

`src/pricing/profileCodeCallers.test.js` is the guard that matters most. It
parses **every** `computeVariables(...)` call in the nine files above — counting
parentheses, so an inline `computeDerived(tree)` does not cut the argument
list short — and fails if one has no profile code. Before the fix it named the
two remaining callers:

```
× quotes/buildSnapshot.js      — expected 'computeVariables(tree, computeDerived…' to match /profileCode/
× pages/dev/PricingBenchmark.jsx — expected 'computeVariables(tree, derived)' to match /profileCode/
```

It is deliberately source-level: the omission produces no error and no wrong
number anywhere a human looks — it produces a **silent false**. What is worth
testing is that no call site forgets.

One existing source-level assertion in `loadPricingContext.test.js` pinned the
old call shape (`resolveIronmongeryLines(tree, ctx, profileValues)`) and was
updated to the new one, with a second test asserting the benchmark page passes
the benchmark's own code.

## 2. A new drawing from a template kept the template's materials nowhere

**Files:** `src/drawingBoard/templates.js`, `src/drawingBoard/templates.test.js`.

`createDrawingFromTemplate` never wrote the material columns at all, so a
drawing from the live "French Doors" template carried `material_frame` /
`material_sash` 'Solid Redwood' and `material_cill` 'Solid Utile Hardwood' —
the table's own defaults — while its tree, the board and the pricing all said
**utile**. The quote matrix card read "Door · Solid Redwood".

`drawingRowFieldsFromTemplate(template)` is a pure function, so it is tested
rather than inspected. The **tree is the truth**: it holds option CODES
(`frameMaterialId: 'utile'`), the drawings row holds the LABELS the drawer and
the card display, and this is the only place the two meet — so the mapping
lives there and nowhere else:

| Code | Column value |
|---|---|
| `softwood` | Solid Redwood |
| `utile` | Solid Utile Hardwood |
| `accoya` | Accoya |

Each material is read as the quote doc model reads it: the material **part's**
`timberType` first (older trees), then the item's own code (every tree this
board saves). Casement and sash templates are covered by the same helper and
the same tests.

Two decisions inside it, both deliberate:

- **A code with no label is LEFT OUT, never guessed.** `oak` and `meranti` are
  real price-file species with no option in the drawer's list; a wrong label
  on a card is worse than none, and a reader falls back to its own default.
- **`window_type` comes from the template, then from the tree**, and only then
  from the old `'Box Sash'` fallback. That fallback was
  `template.window_type ?? 'Box Sash'`, which would have labelled a door
  template a box sash.

**Tests:** nine, all failing before the helper existed
(`drawingRowFieldsFromTemplate is not a function`), covering the door, box
sash and Accoya casement cases, the older `timberType` trees, the unmapped
code, the door template with no `window_type`, the unreadable tree, and a
source check that the insert spreads the helper's fields.

## 3. Default ironmongery on a door — Nathan's decisions

**Files:** `docs/integrate-differences.md`,
`src/pricing/benchmarks/benchmarks.test.js`.

**No rule was changed.** Recorded as **deliberate differences 9 and 10**:

- **9.** A new French door starts with the **Hardwick Lyndon espag set**
  (GlazePro's default rule), not Integrate's template choice of the
  **Windsor inline handle**. The Windsor on L31115 is a surveyor's choice on
  that job, not the default GlazePro should ship.
- **10.** A door gets **both trickle vents** — the slot vent (XR16) and the
  grille — as a casement does (difference 6). Step AY decided it for a
  casement; Step AZ only *reported* it for a door. This is the decision.

Together, in money — FD1 from the live template against Integrate's stored
list:

| | |
|---|---|
| the espag set | +74.55 |
| less the Windsor inline handle | −16.80 |
| the vent grille | +2.10 |
| | **+59.85**, all of it in `installation_materials` |

| FD1 | `installation_materials` | total cost | price |
|---|---|---|---|
| Integrate's stored list (benchmark FD1) | 309.21 | 2,819.53 | 5,639.01 |
| GlazePro's default list (a live door) | **369.06** | **2,879.38** | **5,758.71** |

`manufacture_materials` stays **395.95** either way: the ironmongery list does
not touch the timber.

**These are the brief's own expected figures for drawing 25** (§5: cost
2,879.38, `installation_materials` 369.06, `manufacture_materials` 395.95,
price 5,758.71) — reproduced exactly, offline, by the fixed engine. The new
test in `benchmarks.test.js` pins all four, and the default list itself, so
the figure cannot drift unnoticed the way differences 7 and 8 are pinned.

## 4. The benchmark page must not hide a missing live part

**Files:** `src/pricing/benchmarks/livePartCosts.js` (new),
`src/pricing/benchmarks/livePartCosts.test.js` (new),
`src/pages/dev/PricingBenchmark.jsx`.

The page built `{ ...livePartCostMap, ...(benchmark.partCostMap ?? {}) }` — the
**fixture** winning. That is how fourteen missing `mpls_doors` lock parts
stayed invisible through a whole step: the page priced a door with the
fixture's costs, the row read PASS, and the live catalogue had no such part.

`mergeBenchmarkPartCosts(live, fixture)` inverts it: **the live catalogue
wins**, a fixture cost fills a gap only — a code the live catalogue does not
have at all — and every gap is returned in `missingLive`. The row then reads

> **PART MISSING** — part missing live: RJZ2382, … Priced from the fixture, so
> this row proves nothing about the live site until the part is in the
> catalogue.

with `data-status="PART MISSING"` and `data-missing-live="<codes>"`. It is a
status of its own, never PASS, so the live smoke test lands it in `unexpected`
and names it.

**A live cost of 0 is a live ANSWER, not a gap.** The four Kenrick gearbox
parts really do carry `unit_cost 0` today (`sql/step-ap0-gearbox-part-costs.sql`
is the pending data fix), and the page must show what the site charges rather
than paper over it. No fixture overrides them, so nothing moved there.

### The brief's check: does any benchmark depend on an override?

**No.** Asserted in `livePartCosts.test.js`, over every exported benchmark
against the captured catalogue:

- **No fixture cost disagrees with a cost the catalogue holds.** A
  disagreement would be a benchmark passing on a number the live site does not
  use; there is none.
- The only overrides anywhere are the **nine door codes** — the five Utile
  sections and the four locks. They are absent from the captured snapshot only
  because it pre-dates `sql/step-az1`, and az1 inserted them live at exactly
  these figures (8.60 / 12.20 / 17.30 / 29.00 / 13.60 and 50.83 / 89.47 /
  34.92 / 5.61).
- Every other benchmark has **no `partCostMap` at all** and was already
  reading live costs.

**And the live run now proves az1's data.** With the live catalogue winning,
the four FD rows could only come out right if `parts_catalogue` really holds
those nine parts at those costs — a missing one would read PART MISSING and
fail the smoke test. It passed. That is the live verification the Step AZ
report said the page could not give.

---

## SQL files this step wrote, in run order

**None.** This step wrote no SQL.

## What the tests show

**Offline: 1,570 passing, 8 failing — the standing eight, unchanged.**
`npx vitest run`, 72 files, **33 new tests**. No benchmark moved: FD1–FD3b
still match Integrate to the penny (FD3 / FD3b bar the two deliberate
charges), and the eight are the same ones every step since AY has carried —
six `sashWeight.test.js` Step W measurement rows, and **A50** +£0.28 and **D**
+£0.54, the two parked residuals. Vitest also reports `e2e/smoke.spec.js` as a
failed *file*: a Playwright spec it collects and cannot run, pre-existing since
Step AT.

**Live: 5 of 5 passed (49.0s)**, against the deploy of `d1d538f` —
`/version.json` reads `mv6x5k2r`, built 2026-10-13 17:52:26 BST:

```
ok 1 logs in (4.5s)
ok 2 every benchmark passes except the parked residuals (35.1s)
ok 3 the fanlight drawing shows Fanlight A1 and Casement Sash A2 (2.8s)
ok 4 the validation panel loads without an error (2.9s)
ok 5 every drawing card on the L507712 quote matrix shows a price (3.1s)
```

Test 2 is doing more work than it was: it now also proves no benchmark row is
PART MISSING, which is to say the live catalogue holds every part the
benchmarks price.

## Not verified against the live database

- **Drawing 25 has not been re-priced.** The brief says the reviewer will. The
  offline figures reproduce §5 exactly, but nothing here has run against the
  live row.
- **The material columns of drawings that already exist are untouched.** The
  fix is in `createDrawingFromTemplate`, so it applies to drawings created from
  now on. Drawing 25's row still says 'Solid Redwood', and so does every other
  drawing made from a template before this deploy. **If those cards should
  read right, the rows need a data fix** — one I have not written, because it
  is a judgement about which existing rows to touch.
- **The mocked-Supabase tests mock Supabase.** They prove `priceDrawing`
  resolves and passes the code, and what it writes; they do not prove the live
  `default_profiles` row for profile 4 reads `open_out_doors`. The reviewer's
  live check does — the drawing's `default_profile_id` is 4 and the stored
  variables were false, which is the symptom this fixes.
- **`buildSnapshot`'s fix is not covered behaviourally.** Its default-
  ironmongery fallback needs ~15 mocked tables; it is covered by the call-site
  guard. No live default-ironmongery rule reads a range variable today, so the
  change is correctness for the next rule that does, not a figure that moves.

## Anything that did not behave as the brief describes

- **An open question for the reviewer: should `PRICING_ENGINE_VERSION` be
  bumped?** Stored runs made before this deploy priced doors with no timber,
  and the staleness check (`src/pricing/runStaleness.js`) uses the engine
  version to mark a run stale. I have **not** bumped it: only *door* drawings
  priced wrong — the range variables change nothing on a sash or casement — and
  doors are days old, so the only stale runs are test drawings, while a bump
  would mark **every** drawing in every open quote stale and invite a
  re-price-all that changes nothing. If Nathan would rather be certain than
  tidy, the bump is a one-line change and the right call; it is his, not mine.
- **Three pre-existing eslint `no-unused-vars` errors** were left alone, and
  are not mine: `PricingBenchmark.jsx`'s dead `ironmongeryLines` prop on
  `BenchmarkSection` (verified present at `HEAD` before this work) and two
  `target` bindings in `benchmarks.test.js`.
- **`npm run e2e`, not `npm run test:e2e`** — the brief has this right; noting
  it only because three earlier briefs did not.
- `public/version.json` is left uncommitted on purpose, as in Step AZ: it is a
  build-time stamp and the deploy writes its own.
