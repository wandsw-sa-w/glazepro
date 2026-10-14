# Step BF — Integrate's panel types, and stable doors

Done 14 Oct 2026. Brief: `docs/step-bf-brief.md`.
Facts: `docs/integrate-L31115-stable-doors.txt` (drawings 21–23 and the panel
type ids) and the 14 Oct correction at the end of
`docs/integrate-L31115-front-doors.txt`.

Commits: `a5f91c7` (item 0 — the reviewer's brief, facts and the ST targets,
unchanged), `860137f` (part A), `8550c75` (part B), `bee0491` (two things the
live run found), and this report.

**SQL waiting, none of it run:** `sql/step-bf1` (the front-door templates with
flat panels) and, in order, **`sql/step-bf2`** → **`sql/step-bf4`** (the
stable-door containment, then its templates), with **`sql/step-bf3`** (the
default ironmongery) any time.

---

# Part A — panel type 110 is FLAT

Read in Integrate's own panel-type dialog:

    110 = FLAT    112 = RAISED & FIELDED    114 = VTG    116 = HTG

GlazePro mapped **110 → raised_and_fielded**. The id came from the French-door
facts of Step BA, which label it that way; Steps BD and BE repeated it. So
**Integrate's "Additional for Flat Panel" 60 was right all along**, and
GlazePro's R&F 120 was the error — the opposite conclusion from the same
figures that Step BE drew.

The vocabulary now carries all four ids. The **fixtures** store Integrate's own
`110` (so the mapping is part of what a benchmark proves) and the **board**
stores the code `'flat'` (Nathan, decision k).

**What survives of decision d:** "Door Muntin" 60 per **real** muntin, and a
leaf's **mid rail** is not one. Integrate counts it, so GlazePro is now 60
minutes **cheaper** per mid rail.

## Every benchmark that moved

| | production | old row | new row | cause |
|---|---|---|---|---|
| **FT1** | 2,850 → **2,610** (Integrate 2,670) | +104.92 | **+6.28** | 4 panels flat (−98.64) and one mid rail (−24.66) against +30.94 of muntin timber |
| **FT2** | 2,770 → **2,710** | +13.67 | **−10.99** | 1 panel (−24.66), one mid rail; +13.67 transom |
| **FT3** | 3,290 → **3,230** | +36.73 | **+12.07** | 1 panel, one mid rail; +13.45 mid-rail timber +23.28 shaped glass |
| **FT4** | 4,085 → **3,785** (Integrate 3,905) | +144.90 | **+21.60** | 5 panels (−123.30), TWO mid rails (−49.32); +70.92 timber |
| **FD4** | 3,565 → **3,445** | 0.00 (exact) | **−49.32** | its two panels flat — see below |
| **C** | — | +7.37 | **+7.37** | unchanged: a sash window has no panels |

Everything else is unchanged. A50, D and B_UNCORRECTED are the standing ones,
and **no other benchmark in the set has a panel at all** — I checked every
row, not only the doors.

## FD4, which is the one the brief asked about

FD4's panels read 110, so they now price flat 60 each and FD4 is **£49.32
cheaper** than Integrate. But FD4 matched Integrate **to the penny** before
this step while GlazePro charged R&F 120 each — which it could only have done
if Integrate itself charged the 240. So either

- FD4's panels are really type **112** and the French-door facts' "110" is the
  same mislabel that started all of this (far likelier: a penny-exact match is
  not a coincidence), or
- Integrate charged flat 60 on FD4 too and the old agreement was two errors
  cancelling.

**Nothing has been tuned.** The fixture keeps what the facts SAY, declares the
−49.32 as pending, and FD4 is now the one row in the **open-questions** table:
changing 110 to 112 to keep a green row would be tuning a fixture to a guess.
One reading of FD4's panel-type ids settles it.

## The templates, and the wording

`sql/step-bf1` re-issues **all four** front-door templates with flat panels
(UPDATE-if-exists; it replaces the template half of `bd3` and `be2`). Each
loses 60 minutes a panel, so offline they now price:

| Template | was | now |
|---|---|---|
| Front Door (4 panels) | 2,604.67 | **2,506.03** |
| Front Door With Fanlight (1) | 2,697.97 | **2,673.31** |
| Arched Front Door (1) | 2,725.12 | **2,700.46** |
| Front Door With Side Light (5) | 3,371.35 | **3,248.05** |

A drawing already saved with raised-and-fielded panels keeps them, which is
right — it is what somebody drew.

The "110 = R&F" wording is corrected where it was asserted (difference 16's
table, now difference 19), and the **French-door facts** and the **Step BA
brief** carry a **dated correction line** above the wrong line rather than a
rewrite, so where the mistake came from stays readable.

---

# Part B — stable doors

## The model

Integrate stores a `StableDoorPart` in the frame holding a Top and a Bottom
`StableDoorLeafPart`. GlazePro stores the container with **two ordinary
`doorLeafPart`s** in it, each marked `stableHalf` — so `door_leaf_qty` is 2,
the `door_leaf` loop visits both, and every rule, count and label that knows a
door leaf needs no change. That is exactly what Integrate's own editor shows
it does: **"Door Leaf" 1035 fires per half**.

**The halves are not half the container each.** Integrate's drawing 21 splits a
2103 container **1055 / 1048** — the top is 7 mm taller and nothing says why —
so the split is **stored**, as a divider offset is. With the halves' own rails
(110 / 99 and 99 / 170) the cells come to **777 × 846** and **777 × 779**,
which are Integrate's own panels (0.66 and 0.61 m²).

## ST1–ST3, group by group

| | ST1 | ST2 | ST3 |
|---|---|---|---|
| production | **3,405** ✓ | **3,425** ✓ | **3,365** ✓ |
| fitting | **900** ✓ | **900** ✓ | **900** ✓ |
| glass_done | — | **18.57** ✓ | **43.33** ✓ |
| installation_materials | **134.73** ✓ | **46.53** ✓ | **134.73** ✓ |
| manufacture | **1,399.46** ✓ | **1,407.59** ✓ | **1,382.93** ✓ |
| manufacture_materials | 523.03 | 523.03 | 398.89 |
| | **+152.73** | **+152.73** | **+152.73** |

Everything is Integrate's to the penny except the halves' **timber**, and the
fitting is Integrate's one rule: **200 "Stable Door" 900**, with no other door
fitting rule — "Single Door Only" wants `door_leaf_qty == 1` and a stable door
has two. A test asserts that the fired list is exactly `['Stable Door']`.

## The timber (difference 20)

Integrate allocates **nothing** for either half: its only timber is the cill
(63x200, 1099) and the frame (67x96, W + 2H = 5,513). GlazePro charges the
halves as it charges any door leaf:

| Section | What it covers | mm | |
|---|---|---|---|
| 63x120 | each half's stiles and top rail (2H + W − 20) **and the top half's 99 MEETING rail** | 7,157 | 123.82 |
| 63x200 | Integrate's cill **plus the bottom half's 170 rail** | 2,096 (+997) | +28.91 |
| | | | **152.73** |

**A rule came out of this that tidies three older readings.** A rail is cut
from the **smallest stock section it fits in** (`railSectionFor`): 62 → 63x63,
86 → 63x96, **99 → 63x120** (96 is too narrow for 99), 163 / 170 / 175 →
63x200. Before, it was a pair of thresholds that happened to fit the readings
taken; the 99 meeting rail is the first one that needed the rule, and every
earlier figure is unchanged.

## Three things that had to change for them to match

- **`new_stable_door_pair_qty`** was hard 0 (NEEDS-DATA) and is now the count
  of `stableDoorPart`s, which is what Integrate's fitting rule reads.
- **`isDoorMpls` is the DRAWING's, not every door's.** A stable door has no
  multipoint lock (Integrate stores false on all three) and with the flag true
  the allocator gave **each half** a Winkhaus Thunderbolt — £107.10 on a door
  whose whole stored set is £88.20.
- **A vision panel is a glass unit inside a panel.** The panel is charged in
  **full** (Integrate does not deduct the hole) and the glass prices at the
  **0.30 m² minimum** — ST2's 17.55, to the penny.

## On the board

`buildStableDoorFrame` and three templates in a **"Cottage Doors"** group
(300–320), all at Integrate's 1099 × 2207: panelled both halves, **glazed top**
(Nathan sells one; Integrate has no such template) and the **200 × 350 vision
panel**. The parts list names the halves **"Stable Door Top A1"** and
**"Stable Door Bottom A1"** — both are door leaves in the same opening, so the
opening label alone would name them the same thing twice.

**What each template prices offline**, with the default set `sql/step-bf3`
gives a new one (**£102.90** — Nathan's list with the second hinge pair):

| Template | cost | price |
|---|---|---|
| Stable Door | **2,675.07** | 5,350.12 |
| Stable Door Glazed Top | **2,577.73** | 5,155.46 |
| Stable Door With Vision Panel | **2,701.77** | 5,403.54 |

(£14.70 more than the same door with Integrate's stored list, which is the
second pair of hinges and nothing else.)

## The default ironmongery (decision j)

Nathan's list is Integrate's plus a **second pair of hinges** — each half
hangs on its own pair:

```
102mm_hinges PB x 4 (two pairs)   14.70 x 2
era_5_lever_sashlock PB               29.40
era_deadlock PB                       15.75
trickle_vent_xr16 Blk                  3.15
victorian PB (scroll lever handle)    25.20
                                 = 102.90
```

**And there is something there now that nobody has read.** Three live
default-ironmongery rules fire on `new_stable_door_pair_qty == 1` and give a
stable door a Hardwick espag set, a **Winkhaus interlocking stable-door
multipoint lock** and two euro cylinders — which is not Nathan's list, and
Integrate's own stable doors carry no multipoint lock at all. `sql/step-bf3`
**deactivates** those three (not deletes, so the reviewer can see what was
there) and adds Nathan's five.

---

## What the live run found

Two things, both fixed in `bee0491`:

- **ST2's row read £175.35 dearer than its declaration.** Its fixture is
  Integrate's drawing 22, which has **no ironmongery at all** — and
  `resolveIronmongeryLines` cannot tell "the surveyor stored none" from
  "nothing has been chosen yet", so the page gave it a **new** stable door's
  default set. The page now prices the ironmongery the **fixture** states, even
  when that list is empty; the resolver is untouched, so nothing about a real
  drawing changes.
- **Drawing 49 on L507712 shows "— — needs pricing".** It is a front door
  widened to 1399 and saved without being re-priced (the reviewer trying the
  Step BE resize) — the app telling the truth, not a pricing failure. The
  quote-matrix test now allows an explicit "needs pricing" and still fails on
  a bare dash, which is what it is for: a drawing that HAS been priced and came
  out as nothing.

## What the tests show

**Tests first** — 22 new:

- `src/pricing/panelTypes.test.js` (4): the four ids; the FT fixtures firing
  flat 60 and never R&F; each row's new production against Integrate's; and
  FD4's own case.
- `src/drawingBoard/stableDoor.test.js` (7): the container and its two halves
  at Integrate's sizes and cells; the single finish, no front door, no
  multipoint lock; all three templates saving; the three templates' contents;
  their size; the halves' labels; and the timber.
- the benchmarks' **ST block** (11): production and fitting exactly, every
  group plus the declared timber, each half's size and cell, one pair and two
  leaves to every rule, ST2's vision panel, the stored ironmongery (and ST2's
  none), and the timber recomputed from its lengths.
- plus the Step BA / BD / BE tests updated to the corrected reading.

**Offline: 1,790 passing, 8 failing — the standing eight, unchanged**
(`npx vitest run`, 81 files). Eslint unchanged.

**Live: 5 of 5 passed (22.1s)**, against the deploy of `bee0491` —
`/version.json` reads `mv813l2c`, built 2026-10-14 11:30:38Z:

```
ok 1 logs in (1.8s)
ok 2 every benchmark passes except the parked residuals (5.8s)
ok 3 the fanlight drawing shows Fanlight A1 and Casement Sash A2 (5.3s)
ok 4 the validation panel loads without an error (3.3s)
ok 5 every drawing card on the L507712 quote matrix shows a price (5.2s)
```

Test 2 reads the nine declared rows at exactly +6.28 (FT1), −10.99 (FT2),
+12.07 (FT3), +21.60 (FT4), −49.32 (FD4), +7.37 (C) and +152.73 (ST1, ST2,
ST3).

## Not verified against the live database

- **No SQL has been run.** Until `sql/step-bf1` runs, every new front door is
  built with raised-and-fielded panels and charged 120 a panel where Integrate
  charges 60. Until `bf2` and `bf4` run there is no stable-door template and a
  stable door **cannot be saved** at all. Until `bf3` runs, a new stable door
  gets an espag set and a multipoint lock it should not have.
- **No stable door has been drawn or saved on the live board**, and no drawing
  has been made from any of the three templates.
- **FD4's panel-type ids have not been re-read**, which is the one open
  question in the set.
- **The stable-door timber is PROVISIONAL**, as every door-timber charge is:
  the sections are a door leaf's, and the workshop has to confirm what is cut
  for a stable door — particularly the 99 meeting rails.
- **The 3 mm clearance between the halves** is recorded and reaches no priced
  figure: 1055 + 1048 is the whole 2103 container, and the facts' own
  arithmetic ("2103 = 1055 + 3 + 1048") does not add up. Said here rather than
  resolved.

## Anything that did not behave as the brief describes

- **The brief's FT production figures are exactly what came out** (2,610 /
  2,710 / 3,230 / 3,785), which is worth saying because they were predicted
  before the code changed.
- **FD4 could not be left alone.** The brief asked how it can have matched
  before; the answer is that it cannot have, on the facts as written, so it is
  declared and opened rather than quietly fixed.
- **Two things changed that part B did not list**: `isDoorMpls` per drawing,
  and the rail-section rule. Without the first, every stable door carried
  £107.10 of lock it does not have; without the second, its 99 meeting rails
  came from a 96 mm section.
- **ST2's empty ironmongery list needed a page change**, not a fixture change
  — a fixture's reading of Integrate should not be overridden by a default
  meant for a new drawing.
- `public/version.json` is left uncommitted on purpose, as CLAUDE.md says.
