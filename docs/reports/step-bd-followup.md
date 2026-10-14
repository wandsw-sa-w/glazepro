# Step BD follow-up — the SQL re-issued, and Nathan's ironmongery

Done 14 Oct 2026. Brief: the reviewer's follow-up of 14 Oct, after reading
`sql/step-bd2` and `sql/step-bd3` and running `sql/step-bd1` live.
Facts: `docs/integrate-L31115-front-doors.txt`, "Nathan's decisions, 14 Oct".

Commits: `6be95de` (the reviewer's facts file, unchanged), `0b1b0c0`, and this
report.

**SQL: `sql/step-bd1` is RUN (reviewer, 14 Oct).** Three files are waiting,
in this order: **`sql/step-bd2`** (the leaf-grid containment), then
**`sql/step-bd3`** (the three templates), and **`sql/step-bd4`** (Nathan's two
ironmongery decisions) any time.

---

## 1. `sql/step-bd2` — the parent column

SECTION 0d joined `drawing_parts` on **`parent_id`**. The column is
**`parent_part_id`**, so the query that is supposed to prove *no saved leaf
already holds more than one panel* — the one thing worth checking before
lifting the panel cap — returned nothing at all, which looks exactly like a
clean answer.

Corrected, and simplified while I was in it: it reads `p.drawing_id` straight
off the part rather than joining `drawings` for it, so there is one join to be
wrong about instead of two.

## 2. `sql/step-bd3` — three things, each fatal

**a. `ON CONFLICT (name)` cannot work.** `drawing_templates` has no unique
index on `name`, and Postgres needs one to infer a conflict target — the file
would have failed on its first statement. It now follows `sql/step-bc2`:
`UPDATE ... WHERE name = ...` if the row exists, `INSERT` if it does not. A new
SECTION 0e counts rows per name first, because matching by hand on a column
with no unique index is only safe while the names are unique.

**b. `default_profiles.name` does not exist.** 0a selected it; the table has
`code` and `is_active`. The read is now `id, code, is_active`.

**c. The finish code was not an option.** The finishes are
`reference_options` category **`paint_finish`**, and the code for Integrate's
"Custom Colour TBC" is **`custom`**. The trees carried `custom_colour_tbc`,
which is no option at all — a surveyor would have opened a front door on a
finish the board could not show.

`FRONT_DOOR_TEMPLATES` now writes `'custom'` and the trees were **regenerated**
by `scripts/build-step-bd-sql.mjs`, which is the point of generating them. Two
guards were added so it cannot happen quietly again:

- SECTION 1 **refuses to write** a template unless both `clean_white` and
  `custom` exist as active `paint_finish` options;
- a new check 5 lists any finish code in any template that is not an option —
  expect 0 rows.

**No price moves.** No rule reads the finish VALUE; the three "- Dual Finish"
door rules read only whether the two sides differ, and `clean_white` ≠
`custom` exactly as `clean_white` ≠ `custom_colour_tbc` did. The FT fixtures
carry the corrected code too, and FT1–FT3 are to the penny where they were.

## 3. `sql/step-bd4` — Nathan's two decisions

New file, both halves idempotent, each with its own SECTION 0, checks and
rollback.

**a. What a NEW front door gets.** One default-ironmongery rule changes
(`cb8eb0b9`, "Front Door Euro Cylinder Pull"): Integrate's **Croft** pull
(`euro_cylinder_pull`, CRO1774PB, £29.40) instead of the Hardwick
back-to-back one (HK4000PB, £25.20). So a new front door gets

```
102mm_hinges PB x 2                      HHD681      14.70
hardwick_classic_sleeved_letterbox PB    HK4350PB    94.50
euro_cylinder_pull PB                    CRO1774PB   29.40
av3_heritage_locking_system PC           the AV4 set 176.40
```

and no letter tidy, which is what Nathan asked for. **+£4.20** on a new door;
nothing on an existing drawing, which holds its own stored list. The file
refuses to run if there is no `euro_cylinder_pull:PB` variant, because a rule
pointing at a product with no variant loses the line in silence.

**b. The AV4 hand, corrected.** `av3_heritage_locking_system_lh` now holds the
**LH** Heritage lock (RHZ2481) and the **LH** centre keep w dayswitch
(RHZ3091); the `_rh` variant holds the RH ones. The pocket keep is handed
neither way and stays in both.

**It moves no money, and the file proves that twice.** `sql/step-bd1` gave
both hands the same cost, so SECTION 1b **raises and aborts** if the LH and RH
parts ever cost different money, and check 4 prints both set costs to compare
with SECTION 0e — £176.40 either side. Offline,
`src/pricing/frontDoorIronmongery.test.js` prices FT1 with the swap applied
and without it and asserts the same £263.55.

**Where the figures live.** `src/pricing/benchmarks/frontDoorIronmongery.js`
holds both decisions as data — the rule id and the two product names, the
part-code mapping per hand, and the three costs `sql/step-bd1` wrote. The SQL,
the tests and difference 15 read that one definition, which is the lesson of
`sql/step-bc3`. `withFrontDoorIronmongery(snapshot)` applies both to a
captured snapshot, which is how a test prices the result of a file nobody has
run; both patches are **idempotent**, so a refreshed snapshot leaves the tests
passing rather than breaking them.

## 4. The FT rows, now that `sql/step-bd1` is live

| | by design | pending / open | row |
|---|---|---|---|
| **FT1** | +£30.94 the leaf's 120 muntin | +£49.32 PENDING — the 120 production minutes | **+80.26** |
| **FT2** | +£13.67 the frame transom | — | **+13.67** |
| **FT3** | +£13.45 the leaf's 120 mid rail | +£15.81 OPEN — the arched leaf's shaped glass | **+29.26** |

All three read **BY DESIGN** on the page, and the live smoke test pins the
three amounts — it passed against this deploy, which is the check that
`sql/step-bd1` really is in and that nothing else moved with it.

**The open question is not a parked residual.** The parked table exists for
the **under-£1.00** small-differences policy; £15.81 is not small, and
borrowing the word would make an unexplained figure look like a decision. So:

- a new **`openQuestion`** slot on a fixture, which the page counts toward the
  expected difference (so the row is not red) and prints as
  **"OPEN QUESTION, £15.81 and nobody has explained it: …"**;
- a new **"Open questions"** section in `docs/integrate-differences.md`, above
  the parked table, with FT3's arithmetic and what reading would settle it;
- a smoke-test assertion that a row carrying an open question still reads BY
  DESIGN with the amount declared, so it cannot quietly become a FAIL or a
  PASS.

**Offline the capture still lags the live data.** `pf30-snapshot.json` was
taken before `sql/step-bd1` ran and holds the three AV4 parts at cost 0, so
the FT benchmarks price it through `withAv4Costs()` — named figures, applied
only where the snapshot has none. That is the same treatment the Kenrick
gearbox parts had in Step BB while the capture lagged, and it becomes a no-op
the moment the reviewer refreshes the snapshot. A new test asserts a front
door's ironmongery comes to **Integrate's own £263.55** on all three
benchmarks, which is the thing the 149.10 gap was hiding.

## What the tests show

**Tests first** — 6 new in `src/pricing/frontDoorIronmongery.test.js`, each
failing before its change:

- a new front door's default set is Nathan's four lines, with the Croft pull;
- the swap is **+£4.20 and nothing else**: every other line's cost is
  identical, and the pull changed by name;
- a front door still gets no trickle vent (both rules carry
  `not is_front_door`);
- the `_lh` system holds the LH lock and centre keep after the fix, the `_rh`
  the RH ones, and the pocket keep stays in both;
- the hand swap **costs nothing** — FT1 prices £263.55 before and after;
- FT1–FT3 keep **Integrate's** stored list, not the new default.

Plus, in `benchmarks.test.js`, that a front door's ironmongery is £263.55 on
all three rows; and the board test now pins the real option code
(`custom`) and that the two sides differ, which is the thing that reaches a
price.

**One of my own premises was wrong, and I corrected the test, not the code:**
I compared the before-and-after ironmongery lines by part CODE, but the same
patch renames the AV4 parts (RHZ2482 → RHZ2481), so the comparison is by cost
— which is what must not move.

**Offline: 1,731 passing, 8 failing — the standing eight, unchanged**
(`npx vitest run`, 77 files). No benchmark moved. Eslint unchanged.

**Live: 5 of 5 passed (26.6s)**, against the deploy of `0b1b0c0` —
`/version.json` reads `mv7swc5r`, built 2026-10-14 07:41:03Z, twelve seconds
after the commit:

```
ok 1 logs in (5.2s)
ok 2 every benchmark passes except the parked residuals (8.1s)
ok 3 the fanlight drawing shows Fanlight A1 and Casement Sash A2 (2.6s)
ok 4 the validation panel loads without an error (2.5s)
ok 5 every drawing card on the L507712 quote matrix shows a price (6.6s)
```

## Not verified against the live database

- **`sql/step-bd2`, `sql/step-bd3` and `sql/step-bd4` have not been run.**
  Until bd2 and bd3 are in there is no front-door template and a four-panel
  leaf cannot be saved; until bd4 is in, a new front door gets the Hardwick
  pull and the left-hand system still holds right-hand parts.
- **The corrected SQL has not been executed anywhere** — the four errors the
  reviewer found were in statements that failed or read the wrong column, and
  my fixes are read against the schema in `loadPricingContext.js` and
  `sql/step-bc2`, not against the database. SECTION 0 of each file is written
  to be run first for exactly that reason.
- **No front door has been drawn or saved on the live board.**
- **FT1's 120 production minutes** and **FT3's shaped glass** are both still
  open; neither has been tuned.
- **The panel weight (6.1 kg/m²)** is still the bracket of difference 14, with
  FT1 0.6 kg under the 50 kg line.

## Anything that did not behave as the brief describes

- **The brief says "no letter tidy" as a change; it was already the case.**
  The live rules never gave a front door a letter tidy — Integrate's stored
  TEMPLATE has one. So bd4 changes one product, not two, and the report says
  which.
- **bd3 gained two guards the brief did not ask for** (the finish options must
  exist, and check 5 looks for a template carrying a code that is not an
  option). The finish bug was invisible precisely because nothing checked it.
- **The `openQuestion` slot is new machinery**, where the brief asked only to
  "mark it open". Marking it in the fixture alone would have left the page
  calling it a parked residual, which is the word the reviewer objected to.
- `public/version.json` is left uncommitted on purpose, as CLAUDE.md says.
