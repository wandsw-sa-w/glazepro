# Step AX — French casements, and the template nosing comes off

Done 13 Oct 2026. Brief: `docs/step-ax-french-casements-brief.md`.
Facts: `docs/integrate-L31115-french-casements.txt`.
**No pricing engine version bump** — the engine is still 16. No existing
benchmark total moved.

---

## 0. The reviewer's work, committed as recorded

`601d242`: the facts file, and `benchmarkFR1_french_casement` /
`benchmarkFR2_french_casement_with_fanlight` in
`src/pricing/benchmarks/integrate-targets.json`.

## 1. The French pair prices — FR1 and FR2 are exact

**Files:** `src/pricing/casementGeometry.js`, `pricingEngine.js`,
`computeVariables.js`, `benchmarks/fixtureCasement.js`

Modelled as Integrate stores it: **one** opening holding a
`frenchCasementPart` with a `leftFrenchCasementSashPart` and a
`rightFrenchCasementSashPart`, and **no mullion**. The pair carries the
thickness, the clearances and the meeting-stile gap; each leaf carries its own
two stiles.

The finding is how little was needed. **The pair adds nothing of its own**, and
each of its leaves is a casement sash for production, timber, glass and weight
— so `CASEMENT_SASH_TYPES` names the three sash part types in one place and
every loop that counts sashes reads it. Three things genuinely changed:

1. **`casementSashSize`** gives a French leaf half the opening less the gap:
   `(opening width − 2 × clearance − gap) / 2` by `(height − 2 × clearance)`,
   reading the clearances and the gap from the **pair**, where Integrate
   stores them. FR1's 1125 × 1219 opening gives **556.5 × 1211**, which is
   what Integrate draws.
2. **The sash timber and weight formulas read the two stiles separately** —
   `height × (left + right)` rather than `2 × height × stile`. A French leaf
   has an outer stile of 62 and a **meeting** stile of 63. For an ordinary
   casement sash the two are the same width, so nothing moved, and a sash with
   no `rightWidth` stored falls back to the left.
3. **`openingFor`** walks up from a leaf to the pair whose cell it shares.

**The meeting stile: derived, not read.** The profile holds the "Overall
Meeting Stile" (`midRail` 130) and the gap (4); 63 is `(130 − 4) / 2`.
`frenchMeetingStileMm` does that arithmetic and the result is stored on each
leaf's inner edge, which is exactly what Integrate's stored tree holds (left
`rightWidth` 63, right `leftWidth` 63). So the profile is the source and the
63 is arithmetic — which is why it is a function and not a candidate key.

**`OPENING_TYPES` had two copies**, one in `casementGeometry.js` and one in
`casementOpenings.js`, and they drifted the moment a pair became an opening:
the board's copy still named two types while the geometry's named three, so
the board could not see a pair at all. There is one list now, exported from
the geometry, and `gridActions.js` reads it too.

### The two prices

| | production | install | cost | Integrate | price | Integrate |
|---|---|---|---|---|---|---|
| FR1 | **13.17 h** | **11.50 h** | 1,007.76 | 1,022.46 | 2,015.49 | 2,044.89 |
| FR2 | **21.50 h** | **13.00 h** | 1,283.88 | 1,306.98 | 2,567.76 | 2,613.96 |

Production and install labour are **exact**. Every line is exact: glass
(0.50 / 0.50 and 0.30 × 3), the energy surcharge, the ironmongery, the
components **including the nosing** (1.40 → 3.86, 2.80 → 7.98, 1.30 → 3.71;
1.10 → 3.04, 3.20 → 9.12, 1.00 → 2.85), frame timber 26.31 → 14.47 and
33.24 → 18.28, sash timber 13.23 / 13.23 and 8.38 / 10.95 / 10.95, the cill
12.85 → 13.94 and 9.64 → 10.46, and LTW. Every **group** matches too, bar
installation materials.

The whole gap is the **Kenrick gearbox SET** — gear box, centre strike, LH
strike and RH strike, the four parts carrying `unit_cost 0` in the captured
snapshot, already fixed live by `sql/step-ap0`. Two sets on FR1 (−14.70 cost,
−29.40 price) and three on FR2 (−23.10 / −46.20). Subtract it and every figure
is Integrate's.

### A correction to Step AV

The fixtures' surround lengths were wrong, and FR1 is what settled it. Step AV
read the length as **ceiled** to 10 mm; it is **rounded to the nearest 10,
half up**. 1313 + 100 = 1413 and Integrate stores **1410**, which a ceiling
would make 1420. The three TC values only looked like a ceiling because they
all ended in 5 or 9. All five recorded lists now come out figure for figure,
and no TC total moved.

## 2. The board

**Files:** `src/drawingBoard/casementOpenings.js`, `renderElevation.jsx`,
`containment.js`, `src/pages/DrawingBoard.jsx`

**"French casement"** joins the toolbar's change choices beside opening, fixed
and direct glazed. The pair fills that opening: left hung LH, right RH, the
**right the master** as Integrate has it, with a **Master leaf** choice on the
pair's own panel. Everything comes from the profile, and a profile missing any
French key **builds nothing and names the keys** rather than guessing a
thickness or a meeting stile.

**Labels as Integrate has them.** FR1's leaves are **A1** and **B1** although
there is no mullion — the pair takes its cell and the right leaf takes the
column after it — and FR2's are **A2** and **B2** under the fanlight at **A1**.
The parts list calls the pair "French Casement" and a leaf "French Casement
Sash".

**The drawing** shows the two leaves meeting in the middle, each drawn like a
casement sash half the opening wide less the gap, with its own opening lines,
and **MASTER** marked under the label on the master leaf. `sashLabel` now
takes the matrix label rather than a list index, so a leaf can pass its own.

**Two loops could not see a French leaf at all**, and both are fixed at the
source rather than worked around:

- **The default ironmongery rules.** A French drawing came out with **no
  handles, no hinges and no gear boxes** — FR1's whole default list was two
  trickle vents. See item 5 for what it gives now.
- **Validation.** `casement_sash` mapped to a single part type, so no casement
  rule saw a leaf: rule 43's stormproof quote note could not fire on a
  stormproof French window, and nor could the weight and bottom-rail rules.

`changeOpening`'s "into a fanlight" test also still read the list index; it now
reads the cell, like everything else since Step AV.

### The templates

| Integrate | name kept | size | geometry |
|---|---|---|---|
| 10 "French Casement" | the same | 1199 × 1313 | interior 1125 × 1219, each leaf 556.5 × 1211, A1 / B1 |
| 11 "French Casement With Fanlight" | the same | 899 × 1499 | interior 825 × 1405 = 304 + 27 + 1074; fanlight 817 × 296 at A1, leaves 406.5 × 1066 at A2 / B2 |

Both names are Integrate's own, which already describe the window. Each tree
was **generated by the board's own code** — `buildCasementFrame`, the transom
picker for 11, then "Change to: French casement" — so each template is exactly
what the board would build, and `assertSaveable` passes on it. The fanlight's
bottom rail is **62** (Nathan's default); the leaves keep the ordinary 83. No
stored ironmongery and **no stored surround list** (item 4).

## 3. A stormproof French casement is fully stormproof

**File:** `src/drawingBoard/stormproof.js`

**What Integrate does is a relabel only.** FR3 is template 10 with Sash Type >
Storm Proof > "Set for all casement sashes", saved. The reviewer's reading
shows it kept a **flush frame** (37/47, depth 96, cill 47 × 128, stops 20) and
leaves still 57 thick with **83** rails; only `typeId` and
`stormProofOverlap` changed. Its price equals FR1's less the nosing it lost on
the save.

**Nathan (13 Oct): GlazePro converts completely.** `setStormproof` now takes
the pair and both leaves along with the frame and the cill — the stormproof
sash type, the **76 mm** bottom rail, the **7 mm** overlap, and Step AU's
stormproof frame (41/41/56 at 69 deep, stops 15) and cill (56 × 69). The
leaves **keep their thickness of 57**: the stormproof sections are the rails
and the lap, not the pair's thickness. Each leaf keeps its own two stiles, so
the meeting stile stays the meeting stile. Converting back removes the lap
rather than zeroing it, because a flush sash has none.

So **FR3 is a fact, not a benchmark** — there is no Integrate figure for the
window GlazePro builds.

### The stormproof FR1 price (reported, nothing to compare)

| FR1 | production | install | cost | price |
|---|---|---|---|---|
| flush | 13.17 h | 11.50 h | 1,007.76 | 2,015.49 |
| **stormproof** | 13.17 h | 11.50 h | **996.64** | **1,993.28** |

A stormproof French casement comes out **£11.12 cheaper**, which is worth
saying plainly because it is the opposite of what anyone would guess: the
stormproof frame and cill are **smaller sections** (41/41/56 at 69 deep
against 37/47/47 at 96), so there is less timber. Labour and production do not
move — the same frame, the same two openers. Rule 43's quote note fires, per
leaf.

## 4. The template nosing comes off

**File:** `sql/step-ax3-template-nosing-off.sql`

Integrate's templates 1, 2, 7, 10, 11, 12 and 13 all carry a "Nosing in Solid
Redwood". But Integrate **recalculates the surround the first time a drawing
is saved** — `autoCalcSurroundComponents 'architrave_and_bullnose'` — and that
calculation produces no nosing. Every **saved** Integrate drawing the reviewer
has read has architrave only: J 1/12, Q 2/21, SA 5/1, and FR3 9/3, which lost
its nosing **and rule 251's 30 minutes of install labour** on the save.

So a template nosing is something Integrate never actually quotes, and
carrying it would make every GlazePro drawing dearer than the same drawing in
Integrate. Nathan (13 Oct): leave it off.

### Each combination drawing, with and without the list

| | cost with the nosing | without | difference | install labour |
|---|---|---|---|---|
| TC1 | 1,397.22 | 1,373.53 | **23.69** | 780 → 750 min |
| TC2 | 1,546.29 | 1,522.04 | **24.25** | 810 → 780 min |
| TC3 | 1,360.34 | 1,336.37 | **23.97** | 750 → 720 min |
| FR1 | 1,007.76 | 983.79 | **23.97** | 690 → 660 min |
| FR2 | 1,283.88 | 1,260.74 | **23.14** | 780 → 750 min |

(GlazePro costs, so each is short by the gearbox gap; the differences are the
point.) Each drop is the nosing's own component line plus rule 251's 30
minutes. Without the list the component lines are **architrave only** — two
TP68 and no TP61 — which is how J, Q, R and S are exact.

**Nothing about the model changed.** `storedSurroundParts` still reads
`values.surroundLines` and replaces the allocator's surrounds when a list is
present, and `has_deep_window_board` still fires rule 251 — a surveyor who
adds a nosing gets it priced. The TC and FR **fixtures** keep their recorded
nosing and stay exact, because the drawings they were read from were never
saved.

Recorded as **deliberate difference 5** in `docs/integrate-differences.md`,
together with Nathan's 62 mm fanlight rail (item 5 below) and the figures for
both.

## 5. The small fixes

### The bare "trickle" line — a data condition, as suspected

Both rules are live and in the same group, with the same label:

| sort | label | product | condition |
|---|---|---|---|
| **50** | Trickle Vent | `trickle_vent_xr16` Wht | `frame_to_be_replaced and not is_front_door and not is_heritage_range` |
| **52** | Trickle Vent | `trickle` Wht | `frame_to_be_replaced and not is_front_door and not is_heritage_range and not is_sw` |

`is_sw` is `is_box_sash`. So **on a casement, `not is_sw` is true and both
rules fire**; on a box sash only rule 50 does. Rule 52 is plainly the
non-sash-window variant of rule 50, and rule 50 is missing the matching
`and is_sw` gate that would make the pair exclusive.

**Would Integrate's own rules add both?** On these conditions, yes — nothing
in them stops it, and nothing de-duplicates by label, because the two name
different products. So either Integrate never quotes a casement through these
rules, or it shows the vent twice as well. I have not changed any rule data;
the reviewer decides. If the pair is meant to be exclusive, `and is_sw` on
rule 50 is the one-word fix.

### The default ironmongery for FR1 and FR2

With the leaves in the loop (item 2), the default rules now give **exactly
Integrate's stored lists**, part for part and quantity for quantity:

| | Integrate's stored list | GlazePro's default |
|---|---|---|
| FR1 | handle LH 1, handle RH 1, defender side hung 310 ×2, kenrick 950 ×4, gear box ×2, vent 1 | **the same**, plus `trickle` ×1 |
| FR2 | handle LH 2, handle RH 1, defender 209 ×1, defender 310 ×2, kenrick 690 ×2, kenrick 950 ×4, gear box ×3, vent 1 | **the same**, plus `trickle` ×1 |

The only difference is the duplicate trickle line above. Note that FR2 gets
`defender_209mm` **and** `defender_310mm` exactly as Integrate has them — the
centre-strike difference reported on the TC drawings in Step AV does not
appear here.

## SQL files this step wrote, in run order

1. `sql/step-ax1-french-containment.sql` — the part types and the five
   parent → child pairs for a French casement. **Run this first**;
   `save_drawing_parts` rejects a tree whose pairs it does not know. Its
   check 3 prints the French profile values, which is the query to send the
   reviewer if the board refuses to build a pair.
2. `sql/step-ax2-french-templates.sql` — Integrate's templates 10 and 11. It
   refuses to run if `step-ax1` has not.
3. `sql/step-ax3-template-nosing-off.sql` — takes the stored surround list off
   the four Step AV combination templates.

**None has been run.** Each has a DO NOT RUN rollback section;
`step-ax3`'s rollback is to re-run `sql/step-av1`, which restores those four
templates exactly, nosing included.

## What the tests show

**1,494 passing, 8 failing** — the standing eight only (A50's top lead weight
+0.28, D's two double-box steel weights +0.54, six Step W
counterweight-display rows). Up from 1,466.

- `src/pricing/benchmarks/benchmarks.test.js` — 12 new Step AX tests: both
  prices, both labour figures, every group, the pair as one opening with
  half-opening leaves, the derived meeting stile, the 57 thickness and the
  two-stile timber, the glass sightlines, the production count (two sashes on
  FR1, three on FR2 — the pair is not machined) and the master leaf.
- `src/drawingBoard/frenchCasement.test.js` — **new, 16 tests.** FR1 and FR2
  built the brief's way and equal to the fixtures; FR1 priced line for line;
  FR2's 0.51 proved to be Nathan's 62 mm rail and nothing else (put
  Integrate's 83 back on the same tree and every line agrees); the labels; the
  master leaf moving; the profile keys; a pair changed back to a casement; the
  full stormproof conversion and its round trip; rule 43 firing on a
  stormproof pair and not a flush one; and the save gate and required fields
  on every tree.
- `src/drawingBoard/casementOpenings.test.js` — its "every kind round-trips"
  test caught that its own profile had no French keys, which is the test doing
  its job; the keys the facts record were added.

## Not verified

- **Nothing in the live database.** None of this step's three SQL files has
  been run, and I cannot read live rows — the anon key returns empty under
  RLS, and empty is not the same as missing. That the live profile holds
  `frenchCasementPart.thickness` 57, `midRail` 130, `gapBetweenMeetingStiles`
  4 and the four clearances, and that the three French part types are already
  in `part_types`, is the reviewer's reading. `sql/step-ax1` check 3 is the
  query that proves it, and the board refuses to build a pair without them
  rather than guessing.
- **The board on screen.** The build passes and the board code is tested, but
  nothing in this step was clicked in a browser: not the "French casement"
  change choice, not the Master leaf buttons, not the two leaves drawn meeting
  in the middle, and not the MASTER mark.
- **The French parts' PROPERTY PANEL.** `default_field_definitions` is live
  data and not in the repository, so I do not know which fields a
  `frenchCasementPart` or a leaf will offer a surveyor. If the panel is wrong
  — blank inputs, or the profile's `default*` fields showing as editable — it
  is the same problem Step AQ item 3 fixed for the casement parts, and the
  same remedy applies. No SQL is written for it because I would be guessing at
  the keys.
- **`frenchCasementPart.meetingStileSplitId` / `sashSplitId` (both 12).**
  Recorded in the facts; GlazePro has no such field and FR1/FR2 are exact
  without one, so nothing was invented for them.
- **The stormproof French price.** 996.64 is GlazePro's own figure for a
  window Integrate does not build; there is nothing to check it against.
- **Whether Integrate would list the trickle vent twice.** Read from the rule
  conditions, not from an Integrate quote for a casement.
- **The French stormproof profile keys**
  (`left`/`rightFrenchCasementSashPart.stormProofOverlap` / `LipThickness`,
  noted as untouched in Step AU) are still unread. The conversion applies the
  casement `stormProofOverlap` of 7 to a leaf, which is the value Integrate's
  own FR3 conversion wrote on both leaves.
