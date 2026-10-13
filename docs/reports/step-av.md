# Step AV — two-column fanlight casements

Done 13 Oct 2026. Brief: `docs/step-av-two-column-fanlights-brief.md`.
Facts: `docs/integrate-L31115-two-column-fanlights.txt`.
**No pricing engine version bump** — the engine is still 16. Nothing about how
an existing drawing prices changed, and no benchmark total moved.

---

## 0. The reviewer's work, committed as recorded

Committed in `7018b6d`, unchanged and attributed:

- `docs/integrate-L31115-two-column-fanlights.txt` — the facts file.
- `src/pricing/benchmarks/integrate-targets.json` — `benchmarkTC1_wide_fanlight_over_double`,
  `benchmarkTC2_fanlight_over_each`, `benchmarkTC3_fanlight_over_one_side`.
- `sql/step-au1-stormproof.sql` — the reviewer's uncommitted edit. **Nathan runs
  that file; it has not been run.**

## 1. TC2 first, before touching anything

`docs/reports/step-av-tc2-proof.md` (`cc1a4e1`). TC2 is a plain 2 × 2 grid, so
it was already drawable and already priced exactly. That was the proof the brief
asked for: the money on these layouts comes out of the casement rules GlazePro
already had, and what was missing was only the **geometry** of a divider that
stops at another divider. Everything after this is about the tree, not the
pricing.

## 2. A mullion or transom that stops at another divider

**Files:** `src/pricing/casementGeometry.js`

Integrate holds `startDivider` / `endDivider` on each divider: `'0'` means it
runs to the frame, otherwise it is the id of the divider it starts or ends at.
GlazePro now stores the same two values, holding the other divider's **key** —
a stable reference, never an index into an array that re-sorts.

`frameOpenings` is now a view of a new `frameCells(tree)`, which walks the
column/row slots and MERGES a slot into its neighbour wherever the divider
between them does not reach:

| | openings | cells (col, row, colSpan, rowSpan) |
|---|---|---|
| TC1 | 3 | A1 (0,0,**2**,1), A2 (0,1,1,1), B2 (1,1,1,1) |
| TC2 | 4 | A1, B1, A2, B2 — every span 1 |
| TC3 | 3 | A1 (0,0,1,**2**), B1 (1,0,1,1), B2 (1,1,1,1) |

TC1's fanlight is **one** opening 1031 × 301 across both columns; TC3's opener
is **one** opening 543 × 1201 down both rows. The slot the span covers (TC1's
B1, TC3's A2) simply has no part, exactly as Integrate stores it. Sash sizes
follow from the cell with the 4 mm clearance all round, and they equal
Integrate's drawn labels: TC1 1023 × 293, 485 × 975, 503 × 975.

## 3. Short dividers and the frame timber — **two readings not verified**

A divider that stops at another is shorter, so its timber is measured by its own
span rather than by the frame interior:

| | length used |
|---|---|
| full mullion | interior height + 20 |
| full transom | interior width + 20 |
| **short mullion** | its span + **2** |
| **short transom** | its span + **3** |

TC1's mullion spans 983 (the bottom row) and TC3's transom spans 561 (column B).
With those two allowances all three frame-timber volumes come out exact —
34.55, 40.90 and 32.38 dm³.

**Each allowance rests on one reading.** They are `SHORT_MULLION_ALLOWANCE_MM`
and `SHORT_TRANSOM_ALLOWANCE_MM`, named and commented as such in
`casementGeometry.js`. A transom allowance of 4 fits TC3's recorded volume just
as well at 2 dp, so **3 is a choice, not a measurement.** A fourth drawing with
a short transom would settle it. Nothing is tuned to make a total agree: these
are the only two numbers in the step that a second reading could move, and they
are flagged rather than buried.

Production labour is unaffected — rules 1105 and 211 count every divider, short
or full, so TC1 and TC3 are both 1530 minutes on two dividers and three sashes.

## 4. How L34046 reached exact labour without the windowboard rule

This was the step's real puzzle, and the answer is that **the rule never fired.**

Rule 251 "Windowboard" adds 30 minutes of install labour when
`has_deep_window_board` is true. L34046 (Step Y, exact) has a window board in
real life, and GlazePro had no such variable at all — so either the variable was
not needed, or L34046 should have been 30 minutes short and was not.

What the snapshot says:

- `TP61` (Nosing 25 × 50 Redwood, unit cost 2.76) is the part a deep window
  board is made of.
- Part-allocator rule **4010 "Surround head board"** measures
  `(1000 * width) + 150`, which matches L34046's recorded 1395 exactly
  (1245 + 150).
- **Rule 4010 is `is_active = false`.**

So no drawing priced through the allocator has ever had a nosing, nothing could
have had a deep window board, and L34046 was exact *because* rule 251 never
fired. Both readings were wrong: the variable IS needed, and L34046 was never
short.

I nearly concluded the opposite. My first harness called
`allocateParts(tree, vars, rules, derived, glassCatalogue, profileValues)` when
the real signature is `(tree, variables, rules, glassCatalogue, includeInactive,
profileValues)` — so `derived` landed on `includeInactive`, inactive rule 4010
allocated TP61, and the nosing appeared to come out of the allocator. Reading
the signature and re-running with the test file's own harness is what exposed
the `is_active` flag.

## 5. The stored surround list

**Files:** `src/pricing/pricingEngine.js`, `src/pricing/computeVariables.js`

Integrate's combination templates carry a **per-drawing surround list**, the way
they carry a stored ironmongery list. `storedSurroundParts(tree)` reads
`drawingItemPart.values.surroundLines` → `[{part_code, qty, length_mm, label}]`
and those lines **replace** the allocator's `surrounds` group — but only when a
list is present. A drawing with no stored list is priced by the rules exactly as
before, which is why no existing benchmark moved.

`has_deep_window_board` is then derived from the list: true when it holds a part
code in `DEEP_WINDOW_BOARD_PART_CODES` (`['TP61']`). It fires rule 251 on all
three TC drawings, and taking the nosing out of TC1's list takes exactly 30
minutes off its install labour.

**That TP61 is the deep window board is an assumption** — a well-supported one
(it is the part rule 4010 names, and rule 251's 30 minutes land correctly on all
three) but the rule's own condition is a boolean, and nothing in the data says
which part codes set it.

Integrate stores each surround length to the next 10 mm: the nosing at frame
width + 150 and the architrave at frame size + 100. That reproduces all three
recorded lists figure for figure (1260 / 2 × 1510 / 1210; 1450 / 2 × 1600 /
1400; 1360 / 2 × 1400 / 1310), and the fixtures now hold those figures rather
than my unrounded ones (`9852ca3`). No total moved — the component length is
itself ceiled to 10 mm before the two-stage rounding from the Step AR addendum.

## 6. The board

**Files:** `src/drawingBoard/gridActions.js`, `casementOpenings.js`,
`renderElevation.jsx`, `src/pages/DrawingBoard.jsx`

**The picker's second mode.** The Transom / Mullion dialog now offers, on a
casement frame:

- **Across the whole frame** — today's grid, dividers that run frame to frame.
- **In one column / one row only** — a transom in one column (TC3) or a mullion
  in one row (TC1), choosing which.

`addDividerInCell` adds one divider bounded by the crossing dividers that
already bound that column or row, and stores `startDivider` / `endDivider`
accordingly. It goes in **halfway** and the surveyor types the exact Offset on
the part, which is what the grid picker already does (equal spacing, then
moved). Asking for a divider in one column when there is no crossing divider to
stop at adds nothing and says so; so does a profile with no
`thicknessInFrameSolid`.

`removeDivider` takes a divider away and **merges** the openings it separated,
and re-points any divider that stopped at it to the frame — so removing TC1's
transom leaves its mullion running head to cill rather than pointing at a
divider that has gone.

A grid divider now stores `startDivider: '0'`, `endDivider: '0'` too, so both
modes write the same shape of data.

**Labels.** Every opening label is read from its **cell**, not from its place in
the flat list: TC1 is A1, A2, B2 and TC3 is A1, B1, B2, with the empty slot
skipped. "Fanlight" is judged from the cell as well (top row, and not running
the full height), so TC3's full-height opener is a **Casement Sash**, not a
fanlight. Q and N are unchanged.

Three things were wrong before and are fixed at the source:

1. The toolbar's "change to:" label called `matrixIndexOf(index)` with no column
   count, so a two-column frame read A1, A2, A3 down the list.
2. `applyFanlightBottomRails` treated the first few openings in the list as the
   top row. Once an opening spans, that is wrong both ways: on TC1 it made A2 a
   fanlight, on TC3 the full-height opener. It now reads the cell. (The rule is
   still a no-op until `sql/step-as0` gives the profile its own
   `casementSashPart.bottomHeight`.)
3. `renderElevation.jsx` had the same object key twice in one literal.

**The drawing.** A spanning opening is drawn across the cells it spans — the
geometry came through `frameOpenings` — with the matrix labels above and the
selection highlight as before. Resizing re-spaces the columns and gives the
extra height to the bottom row; the cells are read from the offsets, so a
spanning opening follows them.

**The templates.** `sql/step-av1-combination-casement-templates.sql` holds
Integrate's four combination templates. Every tree was **generated by the
board's own code** — `buildCasementFrame` at Integrate's size, the picker, the
second mode, the operation buttons — so each template is exactly what the board
would build, and the geometry matches Integrate cell for cell.

| Integrate | name chosen | size |
|---|---|---|
| 7 "Double Casement With Fanlight" | *Double Casement With Fanlight* | 1105 × 1405 |
| 12 "Configuration 1" | *Fanlight Over Each Casement (Configuration 1)* | 1299 × 1499 |
| 13 "Configuration 2" | *Full-Height Opener With Fanlight Over Fixed (Configuration 2)* | 1205 × 1295 |
| 14 "Configuration 3" | *Fanlight Over Fixed With Full-Height Opener (Configuration 3)* | 1205 × 1295 |

"Configuration 1 / 2 / 3" says nothing about the layout in a template list, so
each name describes the window and keeps Integrate's name in brackets; 7 keeps
Integrate's own name, which already describes it. The group is Integrate's own
without its leading number: **Combination Flush Casements**. Template 14 is the
mirror of 13 (the fanlight column on the LEFT), which Integrate has but has not
drawn.

Each template carries its surround list including the nosing, and **no stored
ironmongery** (difference 4). Bottom rails are **83 on every sash, the fanlight
included**, because that is what Integrate's templates hold — Integrate's own
validation then says "Fanlight bottom rail should be reduced to 62mm
externally" when the drawing is opened, on its drawings and on ours. That is
recorded behaviour, not a defect, and the SQL says so.

## The three prices

Every line matches Integrate but the Kenrick gear box, whose four parts carry
`unit_cost 0` in the captured snapshot (already fixed live by
`sql/step-ap0-gearbox-part-costs.sql`). The gap is not flat per set, because
the set is four parts at differing quantities: one set −8.40, two −14.70, three
−23.10 on cost, and twice that on price.

| | production | install | cost | Integrate | price | Integrate |
|---|---|---|---|---|---|---|
| TC1 | **25.50 h** | **13.00 h** | 1397.22 | 1420.32 | 2794.43 | 2840.63 |
| TC2 | **29.83 h** | **13.50 h** | 1546.29 | 1560.99 | 3092.55 | 3121.95 |
| TC3 | **25.50 h** | **12.50 h** | 1360.34 | 1375.04 | 2720.67 | 2750.07 |

Production and install labour are **exact** on all three. The cost and price
gaps are the gearbox gap and nothing else: three sets on TC1 (−23.10 / −46.20),
two on TC2 and TC3 (−14.70 / −29.40). Subtract it and every figure is
Integrate's.

## SQL files this step wrote

1. `sql/step-av1-combination-casement-templates.sql` — the four combination
   flush casement templates. **Not run.**

Also committed, **not mine and not run**: the reviewer's edit to
`sql/step-au1-stormproof.sql`.

## What the tests show

**1,455 passing, 8 failing** — the standing eight only (A50's top lead weight
+0.28, D's two double-box steel weights +0.54, six Step W counterweight-display
rows). Up from 1,421 before item 3.

- `src/pricing/benchmarks/benchmarks.test.js` — 15 Step AV tests: the three
  prices, the cells, the sash sizes, the short-divider spans, the divider count
  for production, the nosing and rule 251, a drawing with no stored list priced
  by the rules as before, and the architrave lengths.
- `src/drawingBoard/gridActions.test.js` — 19 → 31. Twelve new: TC1's and TC3's
  geometry built through the real board code, both error messages, the mirror
  (index 0), removing a divider and merging, re-pointing a divider that stopped
  at the removed one, resizing with a span, and three for the cell-based
  fanlight rail.
- `src/drawingBoard/combinationCasement.test.js` — **new, 20 tests.** Each
  layout built the way a surveyor builds it, through `assertSaveable` and the
  required-field check, then through the pricing engine: equal to the fixtures
  cell for cell, sash value for sash value, and priced to the same labour
  minutes, the same total and the same lines, **line for line**.
- `src/drawingBoard/renderElevation.test.jsx` — 64 → 66: the spanning fanlight
  drawn as one opening 1023 wide across both columns, labelled A1, A2, B2 with
  no B1.

### The default ironmongery list, with no stored list (difference 4)

The handles, hinges, extensions and gear boxes come out **exactly** as
Integrate's stored lists have them — TC1 three gear boxes and six 950 mm
extensions, TC2 and TC3 two and two. Two differences, recorded in the test as
they stand so a later change is noticed:

1. **The centre strike.** Integrate charges `defender_209mm` on TC1 and
   `defender_310mm` on TC2 and TC3. The rules charge 209 on all three.
2. **A bare `trickle` line** comes out beside `trickle_vent_xr16` on every
   layout, so the vent is listed twice under two names. This looks like a defect
   in the default ironmongery rules rather than anything to do with this step.

Neither touches a benchmark: those price Integrate's stored list.

## Not verified

- **The two short-divider allowances** (+2 mullion, +3 transom) rest on one
  reading each; +4 fits the transom just as well. See item 3.
- **That TP61 is the deep window board.** Rule 251's condition is a boolean and
  nothing in the data names the part codes that set it. See item 5.
- **Nothing in the live database.** `sql/step-av1` has not been run, and I
  cannot read live rows — the anon key returns empty under RLS, and empty is not
  the same as missing. Everything here about templates 7 / 12 / 13 / 14 as they
  exist in Integrate is the reviewer's reading.
- **The picker dialog, the drawing and the templates on screen.** The build
  passes and the board code is tested, but nothing in this step was clicked in a
  browser.
- **TC1's transom `outerThickness 32`.** Recorded in the facts (TC2's and TC3's
  transoms do not carry it). GlazePro has no such field and the TC1 price is
  exact without one, so nothing was invented for it.
- **Template 14.** Integrate has it; Integrate has not drawn it, so there is no
  recorded price to check it against. Its geometry is the mirror of 13's, which
  is checked.
- **`is_replacement_sashes_range`** is still wired to no caller (Step AU fixes,
  left for a later step as the brief says).
