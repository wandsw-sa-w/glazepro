# Step AY — small fixes after the casement work

Done 13 Oct 2026. Brief: `docs/step-ay-small-fixes-brief.md`.
**No pricing engine version bump** — the engine is still 16. No pricing rule,
no profile value and no benchmark target was changed.

---

## 0. The reviewer's SQL edit, committed as written

`sql/step-ax2-french-templates.sql` — committed unchanged and attributed
(`b53875d`). **Nathan ran `step-ax1`, this file and `step-ax3` on 13 Oct**, and
the reviewer checked the result live: both French templates exist with product
`french_casement` and no stored surround list, and none of the six combination
templates carries one.

Two fixes, both mine to own:

1. **Product is "French Casement", not "Casement".** I copied the lookup from
   `sql/step-av1` without asking what a French template's product should be, so
   both templates would have been saved with the casement code.
2. **The file did not run at all.** The two check queries' `IN` lists were
   commented out. My generator built one `names` string with `--` prefixes for
   the rollback section and then reused it inside two live `IN` lists — the
   rollback needed the comment markers, the checks needed them gone.

## 1. Both trickle vents are intended

Nathan (13 Oct): **a casement gets both.** Rule 50 is the slot vent (XR16) and
rule 52 the vent **grille** — two different products, and a casement is sold
with both. Rule 52's `not is_sw` is doing its job: keeping the grille off a box
sash, which does not get one.

Steps AV and AX both reported the second line as a probable defect, reading
`not is_sw` as half of an exclusive pair whose other half had been forgotten.
**They were wrong**, and the shared label "Trickle Vent" is what makes two
products look like one line twice.

Recorded as **deliberate difference 6** in `docs/integrate-differences.md`,
with the warning that the obvious "fix" — `and is_sw` on rule 50 — would
silently stop charging for the grille on every casement GlazePro quotes. The
Step AV and AX tests now assert the second line as **intended** instead of
calling it a defect. No rule data touched.

## 2. A fresh PF30 snapshot — twenty-two benchmarks are exact offline

The file **was** in place, so this item ran. Committed attributed to Nathan
(`625b425`).

**What changed in the data.** 264 rules (was 263), 125 part-allocation rules,
91 ironmongery rules, 1,174 part costs, 1,113 ironmongery entries and **no
zero-cost entry left**. Two differences matter:

- **`kenrick_extension_gear_box:PC` now carries its four parts' costs** —
  RJZ1700 Excalibur Gearbox 3.89, RJZ1708 Centre Strike 2.02, RJZ1709 LH
  Strike 0.72, RJZ1710 RH Strike 0.72, which is the 7.35 the set costs. The
  old snapshot had all four at 0. This is `sql/step-ap0`'s live fix arriving
  in the offline data.
- **the casement profile now holds `ironmongeryFinish` `'PB'`**, which the old
  one did not. See the end of this item.

**Every test changed, and why.** All were asserting Integrate's target *less
the gap*; they assert the raw target now:

| test | was |
|---|---|
| J, K, L, M, N, P — "but the gear box" → "exactly" | target − 14.70 / −29.40 |
| Q, R, S | target − 8.40 / −16.80 |
| SA, SC, SF | target − one or two sets |
| SB, SD, SE (price only) | target − 16.80 or −29.40 |
| TC1, TC2, TC3 | target − three, two and two sets |
| FR1, FR2 | the same, and their GROUP test no longer exempts installation materials — **all five groups match** |

One test asserted the **opposite** of what is now true:

- **"the gear box is the whole gap, and it warns rather than pricing a silent
  zero"** expected four £0 lines and four warnings. It now asserts the four
  parts price and sum to 14.70 for two sets, with no warning. **The engine's
  rule has not changed** — it still refuses to price a silent zero, and there
  is now nothing silent to refuse. The test also counted every `RJZ17xx` code
  as a gearbox part, which caught RJZ1705 (the 950 mm extension) as a fifth; it
  names the set's own four codes now.

### A question for the reviewer: the claw fastener prices PB again

Two real-tree tests changed because of the profile's new default finish, and
the second is **a question, not a pass**.

The real tree (L507712 drawing 1) stores **no item ironmongery finish**. The
old profile had no default either, so the default claw-fastener line could
resolve no finish, and **Step Z** made that a visible warning rather than a
silent guess at Polished Brass — the reviewer's live finding at the time was
**£26.25 where Integrate charged £36.75 ABs**.

The new snapshot's profile **does** carry a default, `ironmongeryFinish` `'PB'`.
So the line resolves, the warning cannot fire, and it prices:

| | | |
|---|---|---|
| GlazePro now | HKKS1075**PB** | **£26.25** |
| Integrate charged | HKKS1075**AB** | **£36.75** |

That is exactly the figure Step Z was written to stop GlazePro producing. It is
**not** the silent guess Step Z removed — the finish comes from a real profile
default now — but for this drawing the right answer is still ABs, and the same
will happen to any drawing that stores no item finish of its own.

Whether `'PB'` is the right profile default is a **data decision**, so no rule
and no profile value was touched. Both tests say what now happens and why, and
the second names Integrate's own figure for the record.

## 3. The French casement panels

**File:** `sql/step-ay2-french-panel-fields.sql` (**not run**), plus one code
change.

The live pair panel shows "Mid rail" and blank "Meeting stile overlap" and
"Has floating mullion" inputs. Integrate shows five fields on the pair
(Internal Frame Width, Internal Frame Height, Sash Type, Overall Meeting
Stile, Thickness) and eleven on a leaf (To Be Replaced, Special Joinery
Details, Special Glass Details, Operation, Sash Head, Left Stile, Right Stile,
Bottom Rail (int), Bottom Rail (ext), Master Leaf, and the Divider Spacing
buttons).

**"Mid rail" is Integrate's "Overall Meeting Stile"** — 130, from which each
leaf's 63 is derived — so the live label reads like a rail and is actively
misleading. Section 2 relabels it.

It works through `role = 'config'`, which the board already filters out, as
Step AQ-3 did for the casement parts. The list is an **allow-list** rather
than a list of fields to hide, because **the live rows are not in the
repository**: I know what the board's own trees store and what Integrate
shows, and I have not seen every row Integrate's import created. So anything I
have not seen is hidden rather than left on the panel, which is the brief's
"stored but hidden". Nothing is deleted and no value changes — a hidden field
stays stored and stays fully editable on Defaults & Parts.

**Section 0 must be run first and its output sent to the reviewer.** It prints
every live row for the three part types. If a field in the allow-list is
spelled differently live, section 0 is what shows it: that field would come out
**hidden rather than shown**, which is a visible mistake rather than a silent
one, and the fix is to add the live spelling to the allow-list.

**The one code change:** Integrate shows the Divider Spacing buttons on a
**leaf's** panel, and a leaf is not itself an opening — the pair it belongs to
is — so the board's panel test now looks through the pair.

## 4. `is_replacement_sashes_range` is wired

**Files:** `src/drawingBoard/api.js`, `computeVariables.js`,
`src/pages/DrawingBoard.jsx`, `QuoteMatrixPage.jsx`, `QuoteOverview.jsx`,
`ValidationRules.jsx`, `src/quotes/buildSnapshot.js`, `publishQuote.js`

Rule 12 ("No Curved Head Sash Replacements", an **error** that blocks
publishing) could never fire, however the drawing was drawn, because nothing
passed `computeVariables` the drawing's profile code. Every caller passes it
now, and they were done **together** on purpose: wiring only some would have
the board refusing what a publish allowed.

| caller | how |
|---|---|
| the drawing board (two calls) | it already had the drawing's profile — `profile?.code` |
| Quote Matrix, Quote Overview, Validation Rules | one new helper, `loadDrawingProfileCode(drawingId)` |
| the publish snapshot | `buildSnapshot` loads `default_profiles.code` beside the label it already loaded and carries `profile_code` per item; `publishQuote` passes it |

The three pages go through one helper rather than the same two-table lookup
written out three more times: a page that got it wrong would evaluate rule 12
against the wrong range with nothing on screen to say so. It destructures
`error` and returns `null`, so a page that cannot read the profile validates
with the variable unset instead of failing to render.

**The CODE, never a label.** `default_profiles.display_name` is something a
user can rename, and `'Sashes Only'` is not `'sashes_only'`.

Four tests: a sashes-only drawing with a curved head **fires** rule 12 as an
error; the same tree on `'sash'`, `'casement'`, `'open_out_doors'`, `null` or
`''` does **not**; a casement does not fire it on any range, because it has no
sliding sashes to curve; and the variable reads the code, so `'Sashes Only'` is
false where `'sashes_only'` is true.

## 5. TEST2

**File:** `sql/step-ay1-delete-test2-rule.sql` (**not run**). It deletes the
rule and nothing else.

TEST2 is a stray April test rule in a price file that is **not** PF30 and is
never used. Because it is not in PF30 it is not in `pf30-snapshot.json`
either, so **its values are recorded nowhere in this repository and I have
never seen them**. Section 0 therefore prints the whole row as JSON and says
plainly that keeping that output is the only way back; the rollback is an
`INSERT` through `jsonb_populate_record`, which restores the row with its id so
anything that referenced it still does.

Section 1 refuses to run unless **all three** hold: exactly one rule named
TEST2, its price file is not PF30, and no stored pricing-run line references
it. A rule a quote priced through is history, not clutter.

## SQL files this step wrote, in run order

1. `sql/step-ay1-delete-test2-rule.sql` — run **section 0 alone first and keep
   its output**, then section 1.
2. `sql/step-ay2-french-panel-fields.sql` — run **section 0 first and send the
   reviewer its output**, then sections 1–3.

**Neither has been run.** Both have a DO NOT RUN rollback section. Neither
depends on the other, so the order above is only the order I would run them in.

## What the tests show

**1,498 passing, 8 failing** — the standing eight only (A50's top lead weight
+0.28, D's two double-box steel weights +0.54, six Step W
counterweight-display rows). Up from 1,494, and **the new snapshot did not
move any of the eight**.

Twenty-two benchmarks that used to be short by the gearbox gap are now
**exact offline**: J, K, L, M, N, P, Q, R, S, SA, SB, SC, SD, SE, SF, TC1,
TC2, TC3, FR1, FR2 — and FR1 and FR2 match on all five of Integrate's groups,
not four.

`src/validation/casementValidation.test.js` goes from 77 to 81 tests (the four
rule-12 ones).

## Not verified

- **Nothing in the live database.** Neither of this step's SQL files has been
  run, and I cannot read live rows.
- **The French panels on screen.** `sql/step-ay2`'s allow-list is built from
  what the board's trees store and what Integrate shows, not from the live
  `default_field_definitions` rows, which are not in the repository. Section
  0's output is what settles it, and a field spelled differently live will be
  hidden rather than shown until the allow-list gains that spelling.
- **`internalWidth` / `internalHeight` on a French pair.** Integrate's panel
  shows "Internal Frame Width" and "Internal Frame Height"; GlazePro's pair
  node does not store either, and the geometry derives the pair's size from
  the frame's cell. The allow-list carries both spellings so that whichever
  key the live definition uses is shown, but if the field is meant to be
  TYPEABLE — a surveyor entering the pair's internal size the way Step AL
  allows for a sash pair — that is unimplemented and not in this brief.
- **`is_replacement_sashes_range` on a real sashes-only drawing.** The
  capability is tested against hand-built trees; no live drawing was opened,
  so what rule 12 now does to real data is unverified. It is an ERROR that
  blocks publishing, so it is worth the reviewer opening one sashes-only
  quote before the next publish.
- **Whether `ironmongeryFinish` `'PB'` is the right profile default.** See
  item 2 — recorded, not decided.
- **TEST2's own values**, and therefore that the rollback will work: it
  depends entirely on section 0b's output being kept.
