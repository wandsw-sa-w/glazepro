# Step BB — single garden doors (open out): plain, with fanlight, with side lights

Done 13 Oct 2026. Brief: `docs/step-bb-single-doors-brief.md`.
Facts: `docs/integrate-L31115-single-doors.txt` (SD1–SD4, FD7, read 13 Oct 2026).

**No new pricing RULE**, and no pricing rule, profile value or benchmark target
was changed. **No pricing engine version bump** — the engine is still 16.

**I ran no SQL.** `sql/step-bb1` and `sql/step-bb2` are files for the reviewer,
each with a SECTION 0 of read-only checks and a `DO NOT RUN` rollback.

Commits: `1a260a0` the facts and targets (first, as recorded), `594ec5b` the
work, `182a2ac` the smoke-test fix, and this report.

---

## 0. The facts and the five targets

**Files:** `docs/integrate-L31115-single-doors.txt`,
`src/pricing/benchmarks/integrate-targets.json`,
`docs/step-bb-single-doors-brief.md` — committed as recorded before any work on
them. `benchmarkSD1`–`SD4` and `benchmarkFD7` are the reviewer's, unedited, and
no target has been touched since. The coupled-frame facts at the end of the file
are left for the next step, as the brief says.

## 1. The single door leaf

**Files:** `src/pricing/casementGeometry.js`, `src/pricing/partAllocator.js`,
`src/pricing/defaultIronmongery.js`, `src/drawingBoard/containment.js`,
`src/drawingBoard/casementOpenings.js`,
`src/pricing/benchmarks/fixtureDoor.js`, `sql/step-bb1-single-door-containment.sql`.

**SD1 is EXACT: every line, every group, both hour totals** — 1,867.12 cost and
3,734.23 price.

### A single door leaf was not an OPENING

Integrate stores a single door as a plain `doorLeafPart` **directly in a frame
opening**, with no pair part — the whole difference from a French door — and
`OPENING_TYPES` did not list it. The leaf therefore had **no cell**, and
everything downstream read null:

| | before | Integrate |
|---|---|---|
| SD1 total | 1,590.59 | **1,867.12** |
| leaf size | null | 999 × 2110 |
| glass | 18.57 | 92.24 |
| `Utile63x120` | **missing entirely** | 5,213 mm |
| `Any Door Overweight` | silent | 45 min |

With the leaf in the list, **`doorLeafSize` did the rest unchanged** — its own
clearances, 2 / 3 / 3 / 3 against a French pair's 3 / 1 / 1 / 3, and no
meeting-stile overlap — exactly as the brief predicted. 1005 − 3 − 3 = 999 by
2115 − 2 − 3 = 2110, and the glass sightline 779 × 1837.

### A single door got no lock

The allocator defaulted `is_door_mpls` to *"is this a French leaf"*, so SD1 lost
its **Thunderbolt (£53.55)** while every French drawing kept one. That branch
only ever runs for a door leaf and every door Nathan sells is multipoint-locked,
so the default is now **true**; a drawing turns it off by storing
`isDoorMpls false`, which is what Integrate stores too (SD1's paint part:
`isDoorMpls true, isFrontDoor false`, and the fixtures now carry both).

### The dead branch, deleted

`defaultIronmongery.js` had a **second** `doorLeafPart` branch below the Step AZ
one. It could never run (the `DOOR_LEAF_TYPES` branch above it includes
`doorLeafPart` and returns first) and it read keys no drawing has ever stored —
`handedness`, `openingDirection`, `isFrenchDoor`, `isSlaveFrenchLeaf`,
`isMasterFrenchLeaf`. Had it ever been reached, a single door would have had no
hand, no opening direction and no lock. Deleted, with a comment saying what was
there and why it went.

### Containment

`assertSaveable` on the board's own SD1 tree named the missing pairs itself:
**`assemblyFramePart->doorLeafPart`** and `doorLeafPart->glassPart`. The local
map now has four (the frame pair, glass, the mid rail and a panel), and
`sql/step-bb1` adds them live — `0, NULL` on the frame pair, copying
`assemblyFramePart->casementSashPart`, because a doorset frame holds a door
**and** its side lights.

## 2. Pricing — every rule, as the facts list it

| | Integrate | GlazePro | difference |
|---|---|---|---|
| SD1 | 1,867.12 | 1,867.12 | **— exact** |
| SD2 | 2,268.91 | 2,282.58 | +13.67 the transom |
| SD3 | 2,571.71 | 2,600.47 | +28.76 the mullion |
| SD4 | 4,211.29 | 4,309.01 | +97.72 the transom and both mullions |
| FD7 | 3,311.75 | 3,369.90 | +57.53 the mullions, **+0.62 parked** |

Production (36.33 / 47.08 / 55.08 / 97.25 / 66.17 h) and labour (11.75 / 13.75 /
14.50 / 23.25 / 16.83 h) are **exact on all five**. Every group except
`manufacture_materials` is exact on SD2–SD4; on FD7 the 0.62 is in `glass_done`.

Checked rule by rule, as asked:

- **Labour.** `Single Door Only` **660** fires (`door_leaf_qty == 1` and not a
  front door) and **`French Doors` never does** — and the other way round on
  FD7's pair. `Any Door Overweight` 45 on all four single doors.
  **`Fixed Fanlight` 120 counts every FIXED casement sash in a door frame,
  side lights included** — that is the whole of SD3's 870 (660 + 120 + 45 + 45)
  and SD4's 1,395 (660 + 5 × 120 + 2 × 45 + 45). `Any Sash Overweight` 45 on
  each side light over 25 kg.
- **Production.** `Door Leaf` 1035, `Machining & Joining a Door Frame` 855,
  `Door Frame – Single Finish` 180, `Door Leaf – Single Finish` 90,
  `Glazing a Sash` 20 a unit; per divider `Door Frame – Single Finish
  (Mullions)` 85 **+** `Additional for Frame Mullion or Transom` 180; per fixed
  sash `Casement Sash – Single Finish` 60 **+** `Sidelights in Doorsets` 780
  beside the door or `Fanlights in Doorsets` 300 above the transom, decided per
  sash by `is_fanlight` as in Step BA.
- **Allocator.** `RJZ2382` **only** on a single door (rule 2020, "MPLS non-front
  non-french"); the French-pair parts — flush bolt, shootbolt, keeps — stay
  away, and FD7 takes all four. Asserted by code, not by count.
- **Sections.** SD1–SD4 and FD7 match the facts **to the millimetre** on every
  stock section, with the transom and mullions added on top (below).

## 3. The one unexplained figure: FD7's £0.62

FD7's A1 is a direct glazed unit carrying **Integrate's hidden-0 template
quirk**, so its glass is its visible size: **588 × 2085 = 1.22598 m²**.

- GlazePro prices **1.23** — round half up, as every other glass line in every
  benchmark does.
- Integrate prices **1.22** (71.37 = 1.22 × 58.50, and 24.40 kg of energy
  = 1.22 × 20).
- And Integrate rounds its **own D1 up** in the same drawing: 1.29704 → **1.30**.

0.01 m² × 58.50 + 0.2 kg × 0.17 = **£0.62**. Under £1.00 with a named cause, so
the small-differences policy **parks** it: it is in the parked table in
`docs/integrate-differences.md` dated 13 Oct, and **nothing has been tuned to
close it**. FD5's A1 has the same quirk and never showed, because its 0.258 m²
took the 0.30 m² minimum — FD7 is the first drawing where a hidden-0 unit is
big enough to price on its own area.

**The benchmark page now keeps a DECIDED difference and a PARKED residual apart
on one row** (FD7 is the first that has both): it reads *"BY DESIGN — £58.15
dearer: £57.53 on purpose (the mullions), plus £0.62 PARKED and unexplained"*.
Collapsing the two into one "expected" figure is how an unexplained gap quietly
becomes a decision nobody made.

**For the reviewer:** Integrate's own glass panel for a hidden-0 direct glazed
unit is what settles it.

## 4. The board

**Files:** `src/drawingBoard/doorOpenings.js`, `src/pages/DrawingBoard.jsx`,
`src/drawingBoard/casementOpenings.js`, `src/drawingBoard/frenchDoor.test.js`.

- **`buildSingleDoorFrame`** builds all four single-door layouts: plain, with a
  fanlight over, with one side light, with two side lights and fanlights. The
  door keeps its own 1005 column (template 15's internal width) and the side
  lights share what is left **equally** — which gives Integrate's own 559 on SD3
  and 534 each on SD4.
- **`buildFrenchDoorSidePanelFrame`** builds template 28 (FD7): a pair between
  two direct glazed panels, with **equal** side columns (619 / 1406 / 619 against
  Integrate's 618 / 1405 / 621) and **12 mm hidden** in both panels, not the
  hidden-0 quirk.
- **An opening of a door frame can be CHANGED to a single door.** The kinds are
  filtered per tree (`openingKindsFor`) because nothing else in GlazePro builds
  a door, and the change carries the glass codes over as every other opening
  change does. The dispatch is in the board rather than `changeOpening` so
  `casementOpenings.js` keeps knowing nothing about doors.
- **A new leaf is Left Hand Hung, open out, 54 thick, 110 / 110 / 110 with a 163
  bottom rail (170 external) — and NEVER arched.** Integrate's own board hands a
  dropped-in leaf **Arch Head and Half Circle switched on** (archHeight 389.5),
  which priced SD2 as 1.14 m² of shaped glass plus 240 minutes of swept-head
  work until the reviewer unticked it and re-read. GlazePro does not copy that,
  and the test says so.

### The Step BA label fix

**A pair takes two column letters.** Integrate labels a pair B2 / C2 and the
column after it **D2** — in *every* row, so FD5's top row reads **A1, B1, D1**.
Step BA gave that column C, which collided with the right leaf's own label. The
shift is counted per column (a pair's two letters belong to the whole column)
where the label is made, and the Step BA expectations were corrected to
Integrate's. SD4, which has no pair, still reads A1 B1 C1 / A2 B2 C2 with the
door at **B2**.

## 5. The templates (SQL — the reviewer runs them)

`sql/step-bb2` writes five templates, group **"Open Out Doors"**, family `door`,
profile `open_out_doors`, trees generated by the board's own code, no stored
lists:

| | Integrate | Size | sort |
|---|---|---|---|
| French Doors With Glazed Side Panels | 28 | 2820 × 2199 | 45 |
| Single Door | 15 | 1099 × 2199 | 60 |
| Single Door With Fanlight | board | 1099 × 2599, transom 399 | 70 |
| Single Door With Side Light | board | 1699 × 2199 | 80 |
| Single Door With Side Lights And Fanlights | board | 2249 × 2599 | 90 |

A **fanlight** takes Nathan's 62 rail (difference 5) and a **side light** keeps
Integrate's 86, which is what its drawings have and what SD2 / SD4 price — so on
these templates the fanlight rails move from `Utile63x96` to `Utile63x63`
(difference 7b). `window_type` is set from the tree: "French Door" where there
is a pair, "Door" where there is a single leaf.

**The tidy, in the same file:** the two Step AZ templates were created with
`window_type` "Door" and the three Step BA ones with "French Door". All five hold
a French pair, so the two AZ rows are corrected to "French Door". Templates
only — drawings already made keep whatever they were created with.

## SQL files this step wrote, in run order

**Neither has been run.** Each leads with a SECTION 0 of read-only queries and
ends with a commented `DO NOT RUN` rollback.

1. `sql/step-bb1-single-door-containment.sql` — `assemblyFramePart ->
   doorLeafPart` (the missing pair) and the leaf's own glass, mid rail and
   panel. **Run first**: `save_drawing_parts` rejects a tree whose pairs it does
   not know, so a single-door template would fail to save even though the board
   built it correctly.
2. `sql/step-bb2-single-door-templates.sql` — the five templates and the
   `window_type` tidy. **Refuses to run** if bb1 has not, or if the Utile
   sections are missing.

The rollback in bb1 deliberately deletes **only** the rows it could have added:
`doorLeafPart -> glassPart` and `-> panelPart` pre-date this step, and SECTION 0b
proves which.

## What the tests show

**Offline: 1,627 passing, 8 failing — the standing eight, unchanged.**
`npx vitest run`, 72 files, **29 new tests**. No benchmark moved: FD1–FD6 still
match as they did, and the eight are the same ones every step since AY has
carried — six `sashWeight.test.js` Step W rows and the two parked residuals
(**A50** +£0.28, **D** +£0.54). Vitest also reports `e2e/smoke.spec.js` as a
failed *file*: a Playwright spec it collects and cannot run, pre-existing since
Step AT.

The new tests: 19 in `benchmarks.test.js` (groups and hours for all five, SD1
exact on every line, the leaf's own clearances, Single Door Only against French
Doors, Fixed Fanlight counting side lights, the lock by code, every section
length, the labels, and the parked 0.62 declared apart) and 10 in
`frenchDoor.test.js` (each template from the board through `assertSaveable` and
`findRequiredEmpty`, the never-arched leaf, the change-to-single-door action, and
the board's trees priced against the fixtures line for line — including that a
GlazePro-built single door takes the **default** ironmongery, +£59.85, with two
hinge pairs rather than a French pair's four).

**Live: 5 of 5 passed (26.1s)**, against the deploy of `594ec5b` —
`/version.json` reads `mv71e2zp`, built 2026-10-13 19:51:02 BST. Test 2 asserts
all **twelve** door benchmarks are on the page and pins the four new figures.

### The smoke test was timing out, and that is now fixed

The first live run **failed on a timeout, not an assertion**: the page prices
forty-odd benchmarks now, and the row loop read four attributes a row one call
at a time — 160 round trips against a page still working. It hit the 120 s
budget with nothing actually wrong, which is the worst kind of failing test. It
reads the rows in **one `$$eval`** instead, and the page's own budget is raised
rather than the reading's. **Test 2 went from 40.5 s to 10.4 s** (`182a2ac`).

## Not verified against the live database

- **Neither SQL file has been run**, so the five templates and the single-door
  containment exist **only as files**. Until bb1 runs, a single door cannot be
  SAVED on the live site — the board builds it and `save_drawing_parts` refuses
  it. The pricing, the benchmark page and the geometry are all live already.
- **The live `part_type_children` rows were not read.** SECTION 0 of bb1 asks
  for them, including the one claim I took from the brief rather than from the
  database: that `doorLeafPart -> glassPart` and `-> panelPart` already exist.
  The insert is `ON CONFLICT DO NOTHING`, so it is safe either way, and the
  rollback does not touch them.
- **All offline figures come from `pf30-snapshot.json`**, a captured file. No
  SD or FD7 line touches the four Kenrick gearbox parts that carry `unit_cost 0`
  in it.
- **No field definitions** were written for a single door leaf's property panel
  (an AZ-4 style step), and none were asked for.
- **Integrate's drawings 7–11 have not been re-priced in GlazePro** — there are
  no GlazePro drawings for them. The benchmark page is the comparison.

## Anything that did not behave as the brief describes

- **FD7's £0.62.** The brief says "any other difference: stop and report". It is
  £0.62 with a named cause, which the small-differences policy parks, so I did
  **both**: parked it in the table **and** reported it here in full, with the
  arithmetic, as the one unexplained figure in the step. Nothing was tuned.
  Section 3 says what would settle it.
- **A commit needed correcting before it was pushed.** `git add -A src/ sql/`
  swept in sixteen files left untracked by earlier steps (SQL from steps A–AT,
  two real-tree fixtures). They are not this step's to commit, so the commit was
  remade with only the sixteen Step BB files. Those files are still untracked and
  still waiting for whoever owns them.
- **Four pre-existing eslint errors** (two `process` in `e2e/smoke.spec.js`,
  `num` in `casementOpenings.js`, `weightKnown` in `defaultIronmongery.js`) were
  left alone; each was verified present at `HEAD` before this work.
- `public/version.json` is left uncommitted on purpose, as CLAUDE.md says.
