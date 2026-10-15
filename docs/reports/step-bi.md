# Step BI — casement combinations, Configurations 4–7

Done 15 Oct 2026. Brief: `docs/step-bi-brief.md`.
Facts: `docs/integrate-L31115-configurations-4-7.txt` (L31115 item 10, drawings
29–32, read 15 Oct by the reviewer). Targets: `benchmarkTC4` / `TC5` / `TC6` /
`TC7` in `integrate-targets.json`, the reviewer's insertions.

Commits: `4f4a301` (item 0 — the facts, targets and brief) and the ones after it.

**SQL waiting, not run:**

- **`sql/step-bi1-combination-casement-templates-4-7.sql`** — the four
  templates, group "Combination Flush Casements", sort order 72–78. Needs
  `sql/step-as0` (the 83 / 62 bottom-rail profile values), which has run; the
  script checks and refuses rather than writing templates on the wrong rails.

Offline suite: **1,963 passing, 8 failing** — the standing eight (six Step W
sash-weight rows, benchmarks A50 and D), exactly as before this step. 55 new
tests. `npm run e2e`: at the end.

**All four benchmarks are exact — every group, to the penny, with nothing
declared.** That is the headline: Integrate's own trees for Configurations 4–7
price in GlazePro with no new rule, no new model and no allowance, once the
rounding of item 2 is put right.

---

# 1. TC4–TC7, group by group

`src/pricing/benchmarks/fixtureCasement.js`, run on the captured PF30 snapshot
(`benchmarks.test.js` → "Step BI — Configurations 4-7 benchmarks").
Integrate's figures in brackets where they differ — they never do.

| group | TC4 1299×1307 | TC5 1699×1307 | TC6 1499×1199 | TC7 1499×1199 |
|---|---|---|---|---|
| glass_done | 57.57 | 75.52 | 80.48 | 111.42 |
| installation_materials | 105.96 | 108.20 | 129.61 | 150.61 |
| manufacture | 628.83 | 834.25 | 834.25 | 1,048.05 |
| labour | 502.63 | 583.05 | 603.15 | 703.68 |
| manufacture_materials | 84.12 | 102.02 | 89.04 | 97.05 |
| **total cost** | **1,379.11** | **1,703.04** | **1,736.53** | **2,110.81** |
| **total price** | **2,758.24** | **3,406.08** | **3,473.05** | **4,221.63** |
| difference | 0.00 | 0.00 | 0.00 | 0.00 |

`extra_profits` comes out at 0.00 on all four and Integrate shows no such
group, so it changes nothing.

## Production, rule by rule

| | TC4 | TC5 | TC6 | TC7 |
|---|---|---|---|---|
| 1000 Machining & Joining a Casement Sash | 3 × 180 | 4 × 180 | 4 × 180 | 6 × 180 |
| 1100 Casement Frame | 180 | 180 | 180 | 180 |
| 1105 Mullion / Transom | 2 × 180 | 3 × 180 | **3 × 180** | 3 × 180 |
| 30 Glazing a Sash | 3 × 20 | 4 × 20 | 4 × 20 | 6 × 20 |
| 200 Casement Sash Single Finish | 3 × 60 | 4 × 60 | 4 × 60 | 6 × 60 |
| 210 Casement Frame Single Finish | 90 | 90 | 90 | 90 |
| 211 per divider | 2 × 60 | 3 × 60 | 3 × 60 | 3 × 60 |
| **total** | **1,530 = 25.50 h** | **2,030 = 33.83 h** | **2,030 = 33.83 h** | **2,550 = 42.50 h** |

TC6's bold row is the point of interest: rules 1105 and 211 count **every**
divider, and the SHORT transom counts once exactly as a full one does — which
is why TC6 and TC7, four sashes against six, still have the same three
dividers and TC6 comes to the same 2,030 minutes as TC5.

## Fitting, rule by rule

| | TC4 | TC5 | TC6 | TC7 |
|---|---|---|---|---|
| 13 Base Casement Frame | 480 | 480 | 480 | 480 |
| 14 Opening Casement Sash | 2 × 90 | 2 × 90 | **3 × 90** | 4 × 90 |
| 15 Fixed Casement Sash | 60 | 2 × 60 | 60 | 2 × 60 |
| 110 1500 Wide Casement Frame | — | 60 | **60** | **60** |
| 251 Windowboard | 30 | 30 | 30 | 30 |
| **total** | **750 = 12.50 h** | **870 = 14.50 h** | **900 = 15.00 h** | **1,050 = 17.50 h** |

Every figure is Integrate's own, rule for rule. Two readings are worth
naming: TC6's **top-hung fanlight counts as an opener** under rule 14, not as
a fixed sash; and rule 110 fires on TC6 and TC7 at 1,499 mm, which is item 2.

## Nothing is declared

The brief asked which of the declared combination-casement differences apply.
**None of them do, on these four.** The two that exist —
`docs/integrate-differences.md` difference 4 (no stored ironmongery list) and
difference 5 (the 62 fanlight rail and no template nosing) — are about what a
NEW GlazePro drawing does. These fixtures are Integrate's drawings as READ:
unsaved, so each carries Integrate's own stored ironmongery list, its stored
surround list including the nosing, and 83 bottom rails on the fanlights too.
Priced that way they match, so the differences do not arise. They arise on the
templates of item 4, and section 4 prices them.

---

# 2. The rounding: `overall_frame_width` to the nearest 10 mm

`src/pricing/computeVariables.js`, GROUP 12. One line changed:

```js
const overall_frame_width = frame_width != null
  ? Math.round(frame_width / 10) * 10 / 1000
  : null
```

## What forced it

Rule 110 "1500 Wide Casement Frame" is `overall_frame_width >= 1.5`. Integrate
fires it on Configuration 6 and Configuration 7, both **1,499 mm**, and does
not fire it on Configuration 4 at 1,299. GlazePro's figure was
`frame_width_m` unrounded — 1.499, which is below 1.5 — so it missed 60
minutes, **£40.21 of cost and £80.42 of price, on each of the two.**

## Why 2 dp and not 1 dp

The brief allowed either. Four readings constrain it, and **both fit all
four**:

| reading | width | Integrate | unrounded | 2 dp (10 mm) | 1 dp (100 mm) |
|---|---|---|---|---|---|
| C4 | 1,299 | does not fire | no | no | no |
| C6, C7 | 1,499 | **fires** | **no — the bug** | yes | yes |
| P, FD2 | 1,599 | fires | yes | yes | yes |
| C5, SD3 | 1,699 | fires | yes | yes | yes |

So the readings do not separate them, and the choice is made on three other
grounds, all of which point at 2 dp:

1. **Integrate is already known to round a metre-scale figure to 2 dp here.**
   `frame_area` sits four lines below this one and is rounded to 2 dp for
   exactly that reason, matched on the draught-seal rate.
2. **The nearest 10 mm is Integrate's house rounding for a length.** The
   surround lengths round the same way — half up to 10 mm — which FR1 settled
   when a ceiling read 1,413 as 1,420 and Integrate stored 1,410
   (`surroundLines`, Step AV / AX).
3. **1 dp claims more than the readings support.** It would also fire rule 110
   on anything from 1,450 up, and nothing read says it should. 2 dp is the
   smallest rounding that explains all four readings.

**The two differ only for a frame 1,450–1,494 wide (and 2,450–2,494 on rule
111).** A reading in that band would settle it outright, and there is none yet
— worth asking for if the reviewer passes a 1,475-wide casement in Integrate.
A test now names that band and fails if a benchmark ever lands in it, so the
question cannot be answered silently
(`benchmarks.test.js`, "no OTHER benchmark width lies where the rounding
changes a threshold").

## What it moves: nothing but TC6 and TC7

Every benchmark frame in the repository was checked — **68 frames across 61
benchmarks** — for whether the rounding changes rule 110 or rule 111:

- **Moved: TC6 and TC7 only**, both 1,499, both to **agree** with Integrate.
- **In the 1 dp / 2 dp disagreement band: none.** Widths jump straight from
  1,400 (FT4) to 1,599 (P, FD2), so nothing sits in 1,401–1,598 at all.
- Every other benchmark is bit-for-bit where Step BH left it. The full suite
  shows the same 8 failures as before the change and 1,963 passing against
  1,908, the difference being this step's own new tests.

## The siblings, checked

The brief asked about any other rule reading `overall_frame_width` or a
`*_in_m` sibling. There are four readers in all and the rounding is right for
each:

| reader | reads | affected? |
|---|---|---|
| rule 110 "1500 Wide Casement Frame" | `overall_frame_width >= 1.5` | **yes — the fix** |
| rule 111 "2500 Wide Casement Frame" | `overall_frame_width >= 2.5` | same rounding; no benchmark in 2,450–2,499 (FD5/FD6 2,814, FD7 2,820) |
| validation "French Casement Min Size" | `overall_frame_width < 0.86` | same rounding. **Inactive** — `sql/step-p3` carries `blocked_reason` "missing variable: new_french_casement_pair_qty". It would change only a frame 855–859 wide; FR1 1,199 and FR2 899 are nowhere near |
| rule 252 "Utile Section Part" | `length_in_m` | **NOT rounded, deliberately.** It is a QUANTITY multiplied by a rate, not a threshold, and `doorGeometry.js` records it as mm / 1000 unrounded, matched on the door benchmarks |

`frame_width_m` and `frame_width_in_mm` are left exactly as they were. The
timber rules multiply the mm figures (`Softwood Casement Frame & Sashes` and
the rest), and rounding those would move money on every benchmark; only the
threshold variable is rounded. A test asserts that
(`computeVariables.test.js` — "frame_width_m is left UNROUNDED").

`overall_frame_width_in_mm`, which the bi-fold ironmongery rules and one
validation rule name, **is not defined in `computeVariables` at all** — those
rules cannot fire today, and nothing was added for them in this step.

---

# 3. Configuration 6's short transom through the database

C6's transom is the **first divider in GlazePro bounded at BOTH ends**:
`startDivider` is the left mullion and `endDivider` the right one, so the
fanlight sits over the middle column alone and the two side openers run the
full 1,105. TC1's mullion and TC3's transom each ran to the frame at one end.

`drawing_parts` has no key column, so both references have to be re-pointed to
the row ids after every save (`src/drawingBoard/dividerRefs.js`, Step BH
follow-up 2). That fix was built and tested on a DOORSET. The C6 template now
goes through the same round trip — create → save → reload → price — in
`src/drawingBoard/saveRoundTrip.test.js`, against the same faithful fake of
`drawing_parts` (client keys in, row ids out, renumbering on every save).

Eight tests. What they show:

- the keys really do change: every reloaded key is a row id;
- **both** references resolve afterwards, and point at the two mullions by
  their NEW keys;
- the cells are the same **four** — `[0,0,1,2] 459×1105`, `[1,0,1,1] 451×356`,
  `[2,0,1,2] 461×1105`, `[1,1,1,1] 451×722` — not six;
- no cell is negative, and the fanlight keeps its 62 rail;
- it prices identically before and after, to the penny, with no errored line;
- **without** the re-pointing, both references die, the frame reads as a 3 × 2
  grid of **six** cells and the price changes — the Step BH follow-up 2 failure,
  reproduced on a casement;
- it survives three saves in a row with every id moving;
- a dead reference is an **error** on the board naming the divider, not a
  silently re-cut frame;
- Configurations 4, 5 and 7 hold only frame-to-frame dividers, so the fix has
  nothing to write on them — asserted, because "nothing to do" is the path
  that must not touch them.

---

# 4. The four templates

`sql/step-bi1-combination-casement-templates-4-7.sql`, generated by
`scripts/build-step-bi-sql.mjs` from `COMBINATION_CASEMENT_TEMPLATES` in the
new `src/drawingBoard/combinationCasement.js` — one definition for the SQL,
the board and the tests, as `DOORSET_TEMPLATES` is. No tree is written out by
hand.

| sort | name | size | layout |
|---|---|---|---|
| 72 | Opener, Fixed, Opener (Configuration 4) | 1299 × 1307 | 393 \| 385 \| 393 |
| 74 | Opener, Two Fixed, Opener (Configuration 5) | 1699 × 1307 | 389 \| 383 \| 383 \| 389 |
| 76 | Openers Either Side Of A Fanlight Over Fixed (Configuration 6) | 1499 × 1199 | 459 \| 451 \| 461, short transom at 356 |
| 78 | Three Casements With A Light Over Each (Configuration 7) | 1499 × 1199 | 3 × 2 grid, transom at 356 |

**The names are the brief's own.** They fit the existing convention — describe
the window, keep Integrate's name in brackets — and they are kept. One
alternative is worth the reviewer's eye and nothing else: 72 and 74 use a
comma list where the existing four use a phrase, so **"Opener Either Side Of A
Fixed (Configuration 4)"** and **"Openers Either Side Of Two Fixed
(Configuration 5)"** would read in step with 76's "Openers Either Side Of…".
Against that, the comma list says the layout in four words and cannot be
misread. Changing them is one string each in the spec and one in the SQL.

**Sort order 72–78, not 100–130.** It keeps the seven Configurations together
and in order after Configuration 3 at 70, and renumbers nothing: 80 and 90 are
the two French casements and they stay. If the reviewer prefers decades after
the French pair, it is four numbers in the spec and nothing else depends on
them.

## Geometry: Integrate's, cell for cell

The board's pickers lay out EQUAL columns, and Integrate's templates do not —
C4's are 393 | 385 | 393, not three of 390.3. So each spec carries Integrate's
stored offsets and the builder writes them onto the dividers the picker made,
which is what a surveyor does when they type an offset after picking a grid.
`combinationCasement.test.js` asserts the cells and every sash value against
the TC4–TC7 fixtures, cell for cell and sash for sash.

## The one difference from Integrate's templates: the bottom rail

| | rails |
|---|---|
| 72 Configuration 4 | 83, 83, 83 |
| 74 Configuration 5 | 83, 83, 83, 83 |
| 76 Configuration 6 | 83, **62**, 83, 83 |
| 78 Configuration 7 | **62, 62, 62**, 83, 83, 83 |

Nathan's 12 Oct decision, as Configurations 1–3. A fanlight is a top-row sash
that does not run the full height, read from the CELLS — so C6 has exactly one
62, its middle light, and its two spanning openers keep 83; C7's whole top row
is 62, the fixed sash in it included, as Configuration 1 already does. C4 and
C5 are single rows, so nothing in them is a fanlight and every rail is 83.
Integrate's own templates hold 83 everywhere.

No stored surround list (so no nosing, `sql/step-ax3`'s decision carried
forward), no stored ironmongery list, Casement MPLS on, Solid Redwood frame
and sashes, utile cill, complete new, Clean White both sides. All asserted.

## What each prices offline, with its default ironmongery and 62 rails

On the captured snapshot, each built from its template with no stored lists —
**not targets**, a record of where a new GlazePro drawing starts:

| | 72 Config 4 | 74 Config 5 | 76 Config 6 | 78 Config 7 |
|---|---|---|---|---|
| glass_done | 57.57 | 75.52 | 80.48 | 111.42 |
| installation_materials | 103.92 | 105.06 | 125.97 | 145.92 |
| manufacture | 628.83 | 834.25 | 834.25 | 1,048.05 |
| labour | 482.52 | 562.94 | 583.05 | 683.57 |
| manufacture_materials | 84.12 | 102.02 | 88.77 | 96.22 |
| **cost** | **1,356.96** | **1,679.79** | **1,712.52** | **2,085.18** |
| **price** | **2,713.95** | **3,359.58** | **3,425.01** | **4,170.36** |
| production | 25.50 h | 33.83 h | 33.83 h | 42.50 h |
| fitting | 12.00 h | 14.00 h | 14.50 h | 17.00 h |

Each is **less** than the Integrate drawing it came from, and every penny of
the difference is accounted for:

| | 72 | 74 | 76 | 78 |
|---|---|---|---|---|
| Integrate, as read | 1,379.11 | 1,703.04 | 1,736.53 | 2,110.81 |
| no nosing (TP61) | −4.14 | −5.24 | −4.69 | −4.69 |
| no rule 251 Windowboard, 30 min | −20.11 | −20.11 | −20.10 | −20.11 |
| ironmongery, default v stored | +2.10 | +2.10 | +1.05 | 0.00 |
| 62 rail: less sash timber | 0.00 | 0.00 | −0.27 | −0.83 |
| **template** | **1,356.96** | **1,679.79** | **1,712.52** | **2,085.18** |

(30 minutes is £20.105, so the group total rounds to 20.11 on three of them
and 20.10 on 76. Every column adds up to the penny.)

The nosing and the Windowboard are `sql/step-ax3`'s decision: Integrate drops
the nosing on the first save and never recalculates one, so carrying it would
make every GlazePro drawing dearer than the same drawing in Integrate.
Production is identical on all four — the rail changes timber, not minutes.

## The default ironmongery, product by product

The rules follow the openings and get the counts right on all four. Three
products differ from Integrate's stored list, and all three are already on
record:

| | GlazePro default | Integrate stored | effect |
|---|---|---|---|
| the vent grille | `trickle` Wht ×1, RHZ771 | not on the list | **+2.10 on all four** — difference 6, intended: a casement is sold with both the slot vent and the grille |
| the centre strike | `defender_209mm`, RFH205 4.20 | `defender_310mm`, RFH207 5.25 | −1.05 each: C6 one, C7 two. Already reported in `docs/reports/step-av.md` §1 for TC2 / TC3 |
| C6's short extension | `kenrick_extension_370mm`, RJZ1702 | `kenrick_extension_300mm`, RJZ1701 | **0.00** — both 2.10. A length band on a 348-high fanlight; no money in it |

Net: **+2.10, +2.10, +1.05 and 0.00**. Configuration 7's two lists differ in
composition and come to the same 103.95 by coincidence — the grille's +2.10
exactly offsets two strikes at −1.05 — so a reader should not take that row as
agreement.

Counts, for the record: C4 and C5 both get handle_lh 1, handle_rh 1, friction
hinge 2, 950 mm extension 4, gear box 2; C6 gets handle_lh 2, handle_rh 1,
gear box 3, 370 mm 2, 950 mm 4; C7 gets handle_lh 3, handle_rh 1, gear box 4,
370 mm 4, 690 mm 4. Each matches Integrate's stored counts exactly.

---

# 5. Every existing benchmark unchanged

Asserted three ways:

1. the full suite shows the **same 8 failures** as before this step, and the
   casement benchmarks — J, K, L, M, N, P, Q, R, S, SA–SF, TC1–TC3, FR1, FR2 —
   all pass as they did;
2. the 68-frame sweep in section 2 found **no** benchmark the rounding moves
   except TC6 and TC7, and that sweep is now a test rather than a one-off
   check;
3. nothing outside `overall_frame_width` was touched in the engine. The other
   files changed are fixtures, tests, a new module and the SQL.

**No benchmark moved, so the brief's "list every benchmark that moves" is an
empty list** — other than TC4–TC7, which are new and exact.

---

# Drawings to make live

On L31115 or L507712, once `sql/step-bi1` has run — each from its template,
then priced through a quote. These are the OFFLINE figures above; the live
rules should give the same, and the gap to Integrate's own drawing is the
nosing and the Windowboard in every case.

| from template | expect | what it proves |
|---|---|---|
| **Opener, Fixed, Opener** (72) | £1,356.96 / £2,713.95, fitting 12.00 h | three columns, no transom; rule 110 must NOT fire at 1,299 |
| **Opener, Two Fixed, Opener** (74) | £1,679.79 / £3,359.58, fitting 14.00 h | four columns; rule 110 fires at 1,699 |
| **Openers Either Side Of A Fanlight Over Fixed** (76) | £1,712.52 / £3,425.01, fitting 14.50 h | **the short transom, and rule 110 at 1,499** |
| **Three Casements With A Light Over Each** (78) | £2,085.18 / £4,170.36, fitting 17.00 h | a 3 × 2 grid; three 62 rails |

**Drawing 76 is the one to look at.** Two things to check by eye once it is
saved and re-opened:

1. the elevation still shows **four** openings — a full-height opener each
   side and the light over the fixed sash in the middle. Six panels means a
   reference was lost;
2. the fitting time is **14.50 h**. 13.50 h means rule 110 did not fire and the
   rounding has not reached the live site.

And the fastest check of the rounding on its own, on any casement drawing: set
the frame width to **1,499** and then **1,494**. The fitting time should drop
by exactly one hour between them, and nothing else should change but the
right-hand sash.

---

# What a reader should be wary of

- **The rounding is a conclusion, not a reading.** Integrate was not observed
  rounding; it was observed FIRING at 1,499 and not at 1,299, and 2 dp is the
  smallest rule that explains every reading we hold. 1 dp explains them too.
  Section 2 names the band that would separate them (1,450–1,494) and the test
  that will notice if a benchmark lands in it. If the reviewer can read one
  1,475-wide casement in Integrate, the question closes.
- **The facts file's TC6 ironmongery subtotal does not add up.** It records
  "Ironmongery 74.55" and then lists eleven figures that sum to **82.95**,
  which is what the group total of 129.61 requires. The bracket list is right
  and the 74.55 is a slip; the benchmark matches on the group, so nothing
  depends on it, but the reviewer may want to correct the file.
- **Nothing here needed a new rule or a new model.** TC4, TC5 and TC7 are more
  of what Step AV built; only TC6's both-ends transom was new, and the
  existing `shortDivider` model carried it unchanged. If a reader expects to
  find new geometry code in this step, there is none — the only engine change
  is the one rounded line.
- **The templates' node keys are random**, so re-running
  `scripts/build-step-bi-sql.mjs` produces a different `sql/step-bi1` with the
  same geometry. The committed SQL is one generated snapshot, as `step-av1`
  and `step-bh2` are. Do not re-generate it to "check" it — compare the SQL's
  SECTION 2 output instead.
- **The 62 rail depends on `sql/step-as0` having run.** If it has not, the
  casement profile has no `casementSashPart.bottomHeight` key and every rail
  resolves to the fanlight value, so the templates would come out 62
  throughout. `sql/step-bi1` checks both values and raises rather than writing
  them; that guard is the reason for section 0b.
- **Sort order 72–78 splits nothing but it is a choice**, and so are the two
  comma-list names. Both are one-line changes and both are flagged above
  rather than decided quietly.
- **The offline prices are the captured snapshot, not the live database.** The
  live rules are the same import, but nothing here was run against the live
  site; the four figures in "Drawings to make live" are predictions to check,
  not observations.
- `public/version.json` is left uncommitted, as CLAUDE.md says.

---

# e2e after the deploy

Deploy confirmed by decoding `/version.json`: **`mv9e17hg` = 10:20:29Z**,
nineteen seconds after the last commit (10:20:10Z).

`npm run e2e` — **5 passed** (22.9s): logs in; every benchmark passes except
the parked residuals; the fanlight drawing shows Fanlight A1 and Casement
Sash A2; the validation panel loads; every drawing card on the L507712 quote
matrix shows a price.

The benchmark test is the one that matters here, and it matters as a
**negative**: this step changed `overall_frame_width`, which every casement
and every door frame reads, and all of the live benchmark rows are where Step
BH follow-up 2 left them. The one engine line this step touched moved nothing
on the live site.

**What the smoke suite cannot see yet**: the four templates, because
`sql/step-bi1` has not run. Once it has, the four drawings listed under
"Drawings to make live" are worth pinning in the suite the way the benchmark
rows are — and the fastest check of the rounding is Configuration 6 at 14.50 h
of fitting rather than 13.50 h.

**Not verified against the live database:** everything in section 4's price
tables is the captured snapshot, not the live rules; no template exists live
until `sql/step-bi1` is run; and the live `default_profile_values` for the
83 / 62 bottom rails were not read (the anon key returns nothing under RLS) —
`sql/step-bi1` section 0b is there for the reviewer to read them, and the
script refuses to write the templates if they are not 83 and 62.
