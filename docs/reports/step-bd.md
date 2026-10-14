# Step BD — front doors (open in, panelled)

Done 13–14 Oct 2026. Brief: `docs/step-bd-front-doors-brief.md`.
Facts: `docs/integrate-L31115-front-doors.txt` (L31115 item 10, drawings 16–18,
read and priced by the reviewer on 13 Oct).

Commits: `a7063fa` (item 0, the reviewer's files unchanged), `1feb170`
(items 1–4 and 7's engine half), `3b5fc20` (items 5–8), and this report.

**SQL written, none of it run** — `sql/step-bd1`, `sql/step-bd2`, `sql/step-bd3`.
`step-bd1` is the one that changes a price; it is also the one with a figure
the reviewer should check first (below).

Side lights are not in this step, as the brief says.

---

## The reading the brief asked for first: FT1's production

Run before anything was changed, on the engine as it stood at `a7063fa`.
**Five rules fire, for 2,790 minutes (46.50 h)**, where Integrate charges
**2,670 (44.50 h)**:

| Rule | Loop | Qty | Minutes |
|---|---|---|---|
| Door Leaf | door_leaf | 1 | 1,035 |
| Machining & Joining a Door Frame | frame | 1 | 855 |
| Door Frame - Dual Finish | item | 1 | 240 |
| Door Leaf - Dual Finish | item | 1 | 180 |
| Additional for R&F Panel | panel | 4 | 480 |
| | | | **2,790** |

That is the reviewer's own "same reading" exactly, so the 120 minutes are a
disagreement with **Integrate**, not with GlazePro's rules. What did NOT fire,
and why:

- **Door Muntin** (60 per muntin, `new_door_leaf_qty >= 1`, qty
  `sash_muntin_to_be_replaced_qty`). That variable is a SASH GLAZING BAR
  count, held at 0 (NEEDS-DATA). The brief offered to give it a meaning for a
  leaf's muntins "if the FT1 reading needs it" — **it does not**: FT1 has one
  muntin, so wiring it would make 2,850 and move *away* from 2,670. It stays 0,
  and a test pins that it fires nothing.
- **Additional for Flat Panel** (60 per panel). Integrate stores all four
  panels as `internalPanelTypeId 110` = Raised & Fielded, so the R&F rule is
  the right one.

**Two decompositions reach 2,670, and both contradict the drawing:**

- **3 panels** × 120 = 360 (2,310 + 360) — but the drawing has four;
- **4 FLAT panels** (240) **+ 2 × Door Muntin** (120) — but the panels are R&F
  and there is one muntin, not two.

So **nothing has been tuned**. FT1 carries the +£49.32 as a declared pending
decision, on the row, with the reason; FT2 and FT3 reconcile to the minute
(below), which is itself evidence that the base model is right and FT1 is one
Integrate reading away from settled.

## Where the three benchmarks stand

| | production | fitting | glass | timber | ironmongery |
|---|---|---|---|---|---|
| **FT1** | +2 h, PENDING | **exact** | — | +£30.94 BY DESIGN | −£149.10 PENDING |
| **FT2** | **exact** (2,770) | **exact** (1,090) | **exact** | +£13.67 BY DESIGN | −£149.10 PENDING |
| **FT3** | **exact** (3,290) | **exact** (885) | +£15.81 PARKED | +£13.45 BY DESIGN | −£149.10 PENDING |

Every FT row reads **BY DESIGN** on `/dev/pricing-benchmark`, at
−68.84 / −135.43 / −119.84 cost, and the live smoke test pins those three
amounts so none of them can move unnoticed.

## 1. A front door is a front door

`is_front_door` was hard-coded `false` (NEEDS-DATA), and it reaches further
than the brief's one rule:

- **install**: "Front Door and Frame (Base)" 840 was silent and "Single Door
  Only" 660 fired instead — FT1's whole fitting figure was wrong, and the
  mullion (+120) and transom (+90) front-door rules could never fire.
- **allocator**: all three MPLS rules carry `not is_front_door`, so GlazePro
  allocated the **Winkhaus Thunderbolt** (RJZ2382, £53.55) to a door that has
  an AV4 Heritage lock. Integrate allocates no such part on any front door.
- **default ironmongery**: six rules read it (§7).
- **production**: none, directly — a front door's production comes out of
  `is_door` and the dual finish.

It now comes from the drawing: the `paintAndIronmongeryPart`'s `isFrontDoor`,
which is where Integrate stores it. **The item RANGE is deliberately not the
test** — `open_in_doors` holds back doors too, and a front door in another
range would still be one. A test proves a door with the flag off keeps Single
Door Only.

## 2. The leaf's own grid

Integrate divides a front door leaf like a little frame: a **120 muntin**
(`mullionPart`) and a **mid rail** (`transomPart`, isMidrail) INSIDE the leaf,
with a Tricoya panel or a glass unit in each cell they make.

Step BA built the one case a French door needs — one mid rail, glass above,
panel below — as *what is left of the leaf*. That answer is a single size, so
FT1's four panels all measured 777 × 635 and all four Tricoya lines priced
0.49 m².

`leafCells(tree, leaf)` now divides the leaf interior by its own dividers,
row-major, and each panel and glass unit takes the cell it sits in:

```
FT1 leaf 997 x 2068, interior 777 x 1788
  muntin 120 at 373, mid rail 170 at 983
  -> 373x983  284x983  373x635  284x635
```

which are Integrate's four panels, and the four Tricoya lines are Integrate's
own to the penny: **69.24 / 52.72 / 44.73 / 34.06 = 200.75**. (Integrate shows
2 dp and prices the UNROUNDED area — 373 × 983 = 0.366659 m² × 188.85 = 69.24.)

**On the board** (the brief's "a surveyor sets the panel layout of a leaf"):

```
setLeafGrid(tree, leafKey, { columns, rows, cells })   the layout
setLeafCellKind(tree, cellKey, 'panel' | 'glass')      one cell
```

with a **Panel layout** control (across × down, 1–6) and a **This cell**
control in the property editor. Dividers are spaced **evenly** — Integrate's
373 / 284 is its template's accident, as the brief says, and the odd
millimetre goes left as everywhere else the board splits a span.

**The elevation now DRAWS the grid.** It drew a leaf as one timber rect with
one glass rect cut out of it, so Step BA's panelled French door was drawn as a
fully glazed one as well; a Tricoya panel now has its own fill and its own
selection. The geometry is `leafCellRects` in `doorGeometry.js`, so it is
tested even though the SVG is not.

## 3. Pricing the leaf

- **Tricoya Panel** per panel at its own cell size — the four lines above.
- **Additional for R&F Panel** 120 per panel, which already fired per panel.
- **FT2 2,770 and FT3 3,290 are exact**, including Door Frame Dual Finish
  (mullions) 45, Additional for Frame Mullion or Transom 180, Frame with Doors
  and Direct Glazed 75, Glazing 20 a unit, and FT3's three arch rules.
- `sash_muntin_to_be_replaced_qty` stays 0, as above.

## 4. Timber

Integrate's three lengths, reproduced exactly:

| Section | What it is | FT1 | FT2 | FT3 |
|---|---|---|---|---|
| 67x96 | head + 2 × overall height | 5463 ✓ | 6289 ✓ | 5497 ✓ |
| 63x200 | cill + leaf bottom rail + a 170 mid rail at leaf W − 10 | 3083 ✓ | 3083 ✓ | 2096 ✓ |
| 63x120 | 2 × leaf H + leaf W **− 20** (open IN; open out is − 6) | 5113 ✓ | 4995 ✓ | 5147 ✓ |

and three charges Integrate does not make, all **PROVISIONAL** and all
declared (difference **13**):

- FT1's **120 muntin** at 63x120 × the leaf's interior height (1788) = **+£30.93**;
- FT3's **120 mid rail** at 63x120 × the leaf's interior width (777) = **+£13.44**;
- FT2's **frame transom** at 67x96 × the internal frame width (1005) = **+£13.67**
  (difference 7b, as on SD2).

The arch does **not** lengthen anything: FT3's 67x96 is W + 2H straight, as
Integrate's is.

## 5. The fanlight over a front door (FT2)

The fanlight is a **direct glazed unit** — a `glassPart` straight in the frame
above a 41 transom, not a casement sash. Fitting comes to Integrate's 1,090:

```
Front Door and Frame (Base)                     840
Front Door and Frame (Transom)                   90
Door Direct Glazed Unit                          45
1.75sqm Direct Glazed Unit in Frame (Small)      70
Any Door Overweight                              45
                                              = 1090  (18.17 h)
```

The 70-minute rule **fires without any change**: it is the `(Small)` rule
(`frame_to_be_replaced and actual_area < 1.75 and is_direct_glazed_unit`, glass_unit
loop), and the thing GlazePro had recorded as never firing is the **Base**
rule, which wants `bi_fold_door_leaf_qty >= 1`. They are different rules, and
no casement benchmark moves — every one of them is where it was.

Production is Integrate's 2,770, and the glass is exact: the fanlight's cut
glass is the opening itself (1005 × 431 = 0.43 m², 15 clearance and 15 hidden
in the rebate) and the leaf's is 801 × 965 = 0.77.

## 6. The arched front door (FT3)

Production is Integrate's **3,290 exactly**, which needed the leaf's own head:

```
Additional for Curved Head (Door)        360   (door_leaf, is_curved_head_sash)
Additional Frame Curved Head (Door)      240   (has_curved_outer_head)
Additional Frame Swept Head (Door)       240   (has_curved_inner_head)
```

`is_curved_head_sash` asked the box-sash parts only, so an arched door leaf
was not curved-headed at item level and had no head of its own in the
door_leaf loop. The frame's two rules fired already, from `curvedFrameHead`.
`archHead` is deliberately NOT set on the frame: on a frame that is GlazePro's
legacy spelling for a top-sash arch and it would fire the 240-minute swept-head
rule instead.

Architrave and 67x96 are at straight lengths, as Integrate has them.

**The shaped glass does not reconcile, and is PARKED at +£15.81.** GlazePro
prices **0.83 m²**, Integrate **0.62**, on the same 777 × 1103 sightline with a
345.92 rise. GlazePro's model — the sightline shape grown by the cover, arc
concentric — is the one that reproduces benchmark C exactly, so the
shallow-arch case is right. This head is **near-semicircular**: radius 391.12
against a 777 chord, so the head's inner edge spans only 2 × (391.12 − 110) =
562 mm, the glass is **narrower than the leaf interior**, and the rail's feet
take the top corners. A rectangle 562 × 822 plus a semicircular head, grown by
the cover, gives **0.624** — Integrate's figure. One reading of Integrate's
glass sightline on an arched door settles which model is right; I have not
built the second one on one reading, and nothing is tuned. It is in the parked
table with the arithmetic.

## 7. What a NEW front door gets — part by part

Read from the LIVE rules (the captured snapshot of them), not from a
description of them.

**The default-ironmongery rules a front door fires** (`part_allocation_rules`,
`rule_family = default_ironmongery`):

| Rule | Part | Code | Cost |
|---|---|---|---|
| door hinges (`c11aeeb4`) | 102mm_hinges PB × 2 | HHD681 | 14.70 |
| Letterplate (`e054f95c`) | hardwick_classic_sleeved_letterbox PB | HK4350PB | 94.50 |
| Front Door Euro Cylinder Pull (`cb8eb0b9`) | hardwick_classic_euro_pull_set_back_to_back PB | HK4000PB | 25.20 |
| Front Door Open In Left Hand Hung (`b5c2d45a`) | av3_heritage_locking_system_lh PC | LJZ5074040CP | 27.30 |
| | *(same set)* | RHZ3092 | **0.00** |
| | *(same set)* | RHZ2482 | **0.00** |
| | *(same set)* | RHZ2427 | **0.00** |
| | | | **161.70** |

**Nightlatch and Deadlock are INACTIVE** in the live rules, and **neither
Trickle Vent rule applies** — both carry `not is_front_door`. Against
Integrate's own stored set (102mm hinges, AV4 Heritage LH, euro cylinder pull,
premium letter tidy, small letterplate = £263.55), a GlazePro default differs
in **what** it gives, not only in what it costs: Integrate's template stores a
*Croft* euro cylinder pull (29.40), a *Premium* letter tidy (27.30) and a
*Small Victorian* letterplate (15.75); GlazePro's rules give a *Hardwick
sleeved letterbox* (94.50) and a *Hardwick back-to-back euro pull* (25.20) and
no letter tidy. **That is a product choice for Nathan, not a bug** — the rules
are his — but it is worth his eye, because the letterbox alone is £65 dearer
than Integrate's pair.

**Priced with Integrate's own stored list** (which is what FT1–FT3 use),
GlazePro gives **£114.45** against Integrate's **£263.55**. The whole £149.10
is three parts at **unit_cost 0** in the live catalogue:

| Code | Part | Integrate prices |
|---|---|---|
| RHZ2482 | Winkhaus AV4 Heritage Lock RH | 112.35 |
| RHZ2427 | Winkhaus AV4 Pocket Keep | 5.25 |
| RHZ3092 | Winkhaus AV4 RH Centre Keep w Dayswitch | 31.50 |

Everything else matches to the penny: hinges 14.70, thumbturn cylinder 27.30,
euro pull 29.40, letter tidy 27.30, letterplate 15.75.

`sql/step-bd1` writes those three costs **and their left-hand twins**
(RHZ2481, RHZ3091 — a left-hand lock is not a different price, and without
them a right-hand front door would be the one that prices short). **The costs
are derived backwards from Integrate's printed lines**, which is exactly how
Step AZ got three lock codes wrong, so SECTION 0 asks for Integrate's part
list and SECTION 1 only ever overwrites a zero.

**THE HAND.** Integrate prices RIGHT-hand AV4 parts on a LEFT-hand door, and
the live GlazePro data does the same thing — the variant
`av3_heritage_locking_system_lh` *holds* the RH lock, keep and dayswitch
(RHZ2482 / RHZ3092), and the `_rh` variant holds the LH ones. So GlazePro
reproduces Integrate exactly, including its error, and **I have not changed
it**: swapping the two would move a price on every front door without the
reviewer's say. `sql/step-bd1` SECTION 0b prints both variants side by side so
the decision can be made from the rows.

**One real hand bug WAS fixed**: a door leaf's `is_opening_in` /
`is_opening_out` were hard-coded open-out in `defaultIronmongery.js`, so an
open-IN front door matched Integrate's "Front Door Open **Out** Left Hand
Hung" rule — a different locking system from the one Integrate's own open-in
template stores.

## 8. The three templates (SQL)

`sql/step-bd3`, group **"Open In Doors"**, product **Door**, range
**open_in_doors**, dual finish (Clean White / Custom Colour TBC, both checked
in SECTION 0), `isFrontDoor` true, no stored ironmongery or surround list.
The trees are **generated from the board's own builders** by
`scripts/build-step-bd-sql.mjs` from `FRONT_DOOR_TEMPLATES`, so the template,
the tests and the board read one definition — the lesson of `sql/step-bc3`.

| Template | Integrate | Size | Leaf |
|---|---|---|---|
| Front Door | 128168 "Balham" | 1099 × 2182 | 4 R&F panels, muntin **centred** |
| Front Door With Fanlight | 22253 | 1099 × 2595 | glass over a 170 rail + 1 panel, direct glazed fanlight over a 41 transom at 431 |
| Arched Front Door | 6619 | 1099 × 2199 | shaped glass over a **120** rail + 1 panel, frame and leaf arched |

**The muntin is centred** (329 / 328 of a 777 interior), as the brief asked me
to choose and say: Integrate's 373 / 284 is its template's accident. FT1 the
BENCHMARK stays on Integrate's 373 / 284 — a fixture's job is Integrate's
figures, a template's is the door Nathan sells.

**The arched door is Integrate's, unchanged** — shaped glass over a 120 mid
rail and one panel. The brief invited an opinion: an arched FOUR-panel door
would need **shaped top panels**, and nothing prices one. The Tricoya rule
reads a visible width × height, and a cell crossing the springing line is not
a rectangle. If Nathan wants one, it is a step of its own, and it needs a
reading of Integrate pricing a shaped panel.

`sql/step-bd2` is the containment the grid needs: `doorLeafPart ->
mullionPart` (and both French leaves, so a panelled French door can take a
muntin too), and the leaf's mid-rail and panel caps lifted from 1 to NULL —
a four-panel door has four panels. **Run it before `step-bd3`**: without it
`save_drawing_parts` refuses a leaf holding a muntin.

## What the tests show

**Tests first** — 23 new, each failing before its fix:

- `src/pricing/frontDoor.test.js` (14): the front-door flag and the three
  rules it turns on; the flag coming from the drawing and not the range; no
  Thunderbolt; the leaf's four cells; each panel on its own cell; FD4 and SD1
  unchanged; the four Tricoya lines; FT1's production rule by rule; Door
  Muntin silent; the open-in −20 and the muntin length, with SD1 and FD4 still
  on −6; the default set, the open-in rule winning, and the three zero-cost
  parts named.
- `src/drawingBoard/frontDoorBoard.test.js` (9): a front door built on the
  board (open-in leaf, 50 cill, dual finish, the flag); the default four-panel
  layout; a surveyor setting the layout and one cell's kind; **every layout
  saving** (no duplicate keys, containment holds, five layouts); the fanlight
  as a direct glazed unit; the arch on frame and leaf and **not** on a square
  door; the leaf timber following the layout; the parts list; and the three
  templates at Integrate's sizes.
- `benchmarks.test.js`: an FT block — production and fitting hours against
  Integrate, every group against Integrate plus what is declared, the declared
  amounts recomputed from the lengths and the per-metre costs, and a front
  door pricing no timber VOLUME.

**Two of my own premises were wrong, and I corrected the tests, not the
code:** Integrate prices the UNROUNDED panel area (0.366659 × 188.85 = 69.24,
not 0.37 × 188.85), and the board stores whole-millimetre offsets, so a
centred muntin gives 329 / 328 and not 328.5 twice.

**Offline: 1,724 passing, 8 failing — the standing eight, unchanged**
(`npx vitest run`, 76 files: six Step W sash-weight rows, benchmarks A50 and
D). No benchmark outside the three FT rows moved. Eslint unchanged in count;
one helper my own Step BD change had made unused (`midRailThickness`) is gone.

**Live: 5 of 5 passed (24.9s)**, against the deploy of `3b5fc20` —
`/version.json` reads `mv7rvsnd`, built 2026-10-14 07:12:38Z, twelve seconds
after the commit:

```
ok 1 logs in (5.2s)
ok 2 every benchmark passes except the parked residuals (6.5s)
ok 3 the fanlight drawing shows Fanlight A1 and Casement Sash A2 (3.0s)
ok 4 the validation panel loads without an error (2.9s)
ok 5 every drawing card on the L507712 quote matrix shows a price (5.9s)
```

Test 2 reads the three FT rows as **BY DESIGN** at exactly −68.84 / −135.43 /
−119.84, so none of the declared amounts can drift unnoticed.

## Not verified against the live database

- **No SQL has been run.** Until `sql/step-bd1` runs, every front door on the
  live site is **£149.10 light**; until `sql/step-bd2` and `sql/step-bd3` run,
  there is no front-door template at all and a four-panel leaf cannot be
  saved. The three FT rows on the live benchmark page are PART-correct by
  design and say so.
- **No front door has been drawn on the live board.** The layout controls, the
  cell kinds and the elevation's panels are covered through the functions the
  buttons call and `assertSaveable` on five layouts, but nobody has clicked
  them on a real drawing.
- **No drawing was saved**, so the new containment pairs have not been
  exercised by `save_drawing_parts` itself — only by `assertSaveable`, which is
  the local copy of the same rules.
- **FT1's 2,670 production minutes are unexplained**, and the £49.32 is
  declared, not closed.
- **FT3's shaped glass (+£15.81) is parked**, not closed.
- **The panel weight (6.1 kg/m²) is a bracket, not a reading** — difference 14.
  FT1 sits 0.6 kg under the 50 kg line, which is the first figure to re-check.
- **The AV4 hand** is Integrate's error, reproduced on purpose and unresolved.

## Anything that did not behave as the brief describes

- **The 1.75 m² rule needed no change.** The brief expected to have to make it
  fire; the rule GlazePro had recorded as never firing is the **Base** rule
  (which wants a bi-fold leaf), and the 70-minute `(Small)` rule fires on its
  own. Nothing was touched, and no casement benchmark moved.
- **`sash_muntin_to_be_replaced_qty` was left at 0**, for the reason in the
  production reading: giving it the leaf's muntins moves FT1 further from
  Integrate.
- **The leaf WEIGHT model changed**, which the brief did not raise. It had to:
  "Any Door Overweight" is 45 minutes on FT2 and FT3, and a leaf that ignores
  its own muntin, its mid rails and its panels cannot tell FT1 (under 50 kg in
  Integrate) from FT2 (over). Difference 14 records the bracket and the
  provisional figure.
- **Difference 13 covers three charges, not two.** The brief named the muntin
  and the 120 mid rail; FT2's frame transom is difference 7b already, and it is
  listed with them so the three FT amounts add up on the page.
- **A product question for Nathan, not a bug**: the default front-door
  ironmongery rules give a Hardwick sleeved letterbox (£94.50) and a Hardwick
  back-to-back euro pull where Integrate's template stores a Croft pull, a
  Premium letter tidy and a Small Victorian letterplate — about £65 dearer,
  from live rules nobody has questioned. §7 has the list.
- `public/version.json` is left uncommitted on purpose, as CLAUDE.md says.
