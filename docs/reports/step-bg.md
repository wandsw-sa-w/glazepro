# Step BG — opening direction: open in / open out

Done 14 Oct 2026. Brief: `docs/step-bg-brief.md`.
Facts: `docs/integrate-L31115-door-direction.txt` (drawings 24–27, read and
priced by the reviewer).

Commits: `2e2d44d` (item 0 — the reviewer's facts, the four targets and the
brief, unchanged) and this one.

**SQL: none.** Nothing in this step needed a rule, a part or a template
change; the one thing it found that lives in data is a cosmetic field on the
front-door templates, logged in `docs/integrate-differences.md` rather than
given a file (see the end).

Offline suite: **1,835 passing, 8 failing** — the standing eight (six Step W
sash-weight rows, benchmarks A50 and D). 34 new tests. `npm run e2e`: at the
end.

---

# The headline

**Nothing in the pricing engine reads a direction flag, and nothing needed
to.** Opening direction is Integrate's *range*, and a range writes values into
the drawing: the cill, the clearances, the bottom rail and typeId 7 / 8. Every
rule that cares then reads the tree — the per-leaf `is_opening_in` the
multipoint-lock rules band on, the −20 / −6 section offset, rule 245, the
geometry. So the work divided cleanly:

- **the board** needed a switch that writes those values (part 1);
- **the engine** needed nothing, and four benchmarks to prove it (part 2).

The only live rule that reads the two ranges at all is **"Utile Section
Part"**, and it fires on *either* (`is_single_and_french_doors_range or
is_open_in_doors_range`). So a drawing's `default_profile_id` does not change
a single figure — it is what the drawing *is*, and what the board builds its
next part from. That is worth saying because it bounds the risk of the switch:
it cannot misprice a drawing by picking the wrong range.

---

# Part 2 — the four benchmarks, group by group

Each is a drawing already here, the other way round. `FT_SNAPSHOT`-style
live-rule fixes apply (the AV4 costs, the shaped-glass rate), as everywhere.

## OI1 — FD1 opening in (drawing 24), 1899 × 2199

| group | GlazePro | Integrate |
|---|---|---|
| glass_done | 162.18 | 162.18 |
| installation_materials | 309.21 | 309.21 |
| manufacture (production) | 1,366.66 | 1,366.66 |
| labour (fitting) | 583.05 | 583.05 |
| manufacture_materials | 393.61 | 393.61 |
| **total cost** | **2,814.71** | **2,814.71** |

Production 3,325 min and fitting 870 min, to the minute — FD1's own, so
Integrate charges nothing for the direction. The cill is 50 and the stop 0, so
the frame is 1805 × **2102** inside; the pair's 3 / 14 / 3 / 3 makes each leaf
910.5 × 2085 and the square 170 rail leaves 690.5 × 1805 of glass. **Exact.**

## OI2 — SD1 opening in (drawing 25), 1099 × 2199

| group | GlazePro | Integrate |
|---|---|---|
| glass_done | 91.00 | 91.00 |
| installation_materials | 155.73 | 155.73 |
| manufacture | 895.90 | 895.90 |
| labour | 472.47 | 472.47 |
| manufacture_materials | 249.58 | 249.58 |
| **total cost** | **1,864.68** | **1,864.68** |

2,180 and 705 minutes, SD1's. A single leaf's clearances are its **own** —
3 / 14 / 4 / 4 against the garden door's 2 / 3 / 3 / 3 — so the leaf is
997 × 2085. **Exact.**

## SO1 — ST1 opening out (drawing 26), 1099 × 2207

| group | GlazePro | Integrate | |
|---|---|---|---|
| installation_materials | 134.73 | 134.73 | |
| manufacture | 1,399.46 | 1,399.46 | 3,405 min, ST1's |
| labour | 603.15 | 603.15 | 900 min, rule 200 alone |
| manufacture_materials | 526.89 | 373.23 | **+153.66**, the halves' timber |
| **total cost** | **2,664.23** | **2,510.57** | |

The one difference is **difference 20** — the two halves' timber, which
Integrate allocates nothing for — recomputed for this door:

    Utile63x120  (2 x 1055 + 997 - 6) + (2 x 1061 + 997 - 6) + 997 = 7,211 mm = 124.75
    Utile63x200  the cill 1099 + the bottom half's rail 997 = 2,096   (+28.91)
                                                                     = £153.66

ST1's is £152.73; the 93p between them is the taller bottom half and the
**open-out −6** section offset in place of the open-in −20. Declared BY DESIGN
on the benchmark with that arithmetic in its reason.

**Item 3, which is the interesting part:** opening out, the frame bottom and
the cill are 37 rather than 50, so the container gains 13 mm — and **all 13 go
to the bottom half**, because the stored split (1,055) is the *top* half's
height. The bottom half is 1,061 against 1,048, its rail is the stepped 163
internal / 170 external, and its panel is 777 × **799** against 777 × 779. The
top half, its cell and the 3 mm between the halves are untouched, exactly as
the facts say. GlazePro gets that for nothing: `doorLeafSize` already takes
the bottom half as "the container less the split".

## OI3 — FD3 opening in, as Integrate stored it (drawing 27), 1350 × 2591

| group | GlazePro | Integrate | |
|---|---|---|---|
| glass_done | 117.01 | 117.01 | |
| installation_materials | 337.37 | 337.37 | |
| manufacture | 1,755.05 | 1,755.05 | **4,270 min** |
| labour | 583.05 | 583.05 | 870 min |
| manufacture_materials | 402.53 | 385.59 | +17.08 BY DESIGN, −0.14 parked |
| **total cost** | **3,195.01** | **3,178.07** | +16.94 |

- **+£17.08** the transom at Utile67x96 for the internal width, which is
  difference 7 and the same charge FD3 carries.
- **−£0.14 PARKED**: Integrate allocates **2,050** mm of 63x63 for a fanlight
  whose sash it left **385** high (1250 + 2 × 393 + 14). The 16 mm are the 8 mm
  its own range switch took off the fanlight rail, counted on both stiles —
  its allocated length did not follow its own change. GlazePro charges the
  sash it draws, 2,034, and is 14p cheaper. Under £1 with a named cause, so
  parked (`docs/integrate-differences.md`).

**Rule 245 fires here and nowhere else.** The fanlight still opens OUT while
the doors open in (Nathan), which is one inward and one outward opening in the
same frame: Integrate's "Frame with inward opening and outward opening", 300
minutes. 4,270 − 3,970 = 300 exactly, and the test asserts it fires on OI3 and
on **none** of OI1 / OI2 / SO1 / FD1 / FD3 / SD1 / ST1 / FT1.

---

# Part 1 — the switch on the board

`src/drawingBoard/openingDirection.js`, with 17 tests of its own, placed and
styled like the Flush / Stormproof pair:

    opens:  [ Opens in ] [ Opens out ]

shown on every door drawing (`isDoorDrawing`), which covers a French pair, a
single leaf, a front door, a stable door and the door frame of a coupled flag
set — the whole tree is walked, so every frame in a set is turned together.

## What it changes, by part

| part | what the switch writes | |
|---|---|---|
| `assemblyFramePart` | `bottomHeight` 37 ↔ 50, `cillStopSize` 26 ↔ 0 | **not** width or height |
| `cillPart` | `height` 37 ↔ 50 | not its depth |
| `frenchDoorPart` | typeId, clearances 3/3/1/1 ↔ 3/14/3/3 | |
| French leaves | typeId, bottom rail | their stiles and head stay |
| `doorLeafPart` (single / front) | typeId, its own clearances 2/3/3/3 ↔ 3/14/4/4, bottom rail | its grid stays |
| `stableDoorPart` | typeId **only** — 4 / 4 / 4 / 3 both ways | the split stays |
| stable halves | typeId; the **bottom** half's rail | the top half's rails stay |
| `casementSashPart` | its **clearances**, and only if the profile holds them | never its direction or its rails |
| panels, glass, finish, ironmongery | nothing | |

Every value comes from the **target range's profile**, loaded by code when the
switch is used and cached; the module hard-codes nothing but Integrate's
template bottom rails (163 / 170 and 170 / 170), which is the one value the
two profiles do not hold — `doorOpenings.js` already names them for the same
reason.

## The four things it refuses to do

1. **Change the frame size.** Integrate's own switch shrank a fanlight door
   2599 → 2591 and took the same 8 mm off the fanlight rail. A surveyor's
   measured opening does not move because the door turned round, so neither is
   copied (difference 21).
2. **Turn a fanlight round.** It keeps its direction and its rails; that is
   what makes rule 245 fire, and it is Nathan's decision.
3. **Move a rail a surveyor typed.** A bottom rail that is not on one of the
   range values is left alone, the same rule `stormproofSashValues` uses.
4. **Write a null.** If the target profile is missing any required key the
   switch changes *nothing* and the board says which key — a drawing turned
   into a frame of nulls would silently reprice.

There is a fifth, softer one: the two door profiles are not known to hold
`casementSashPart.mechanicalClearance*`. When they do not, every sash is left
exactly as it is and the board says so in as many words rather than guessing
at a number. When they do, the clearances follow the range, which is what
Integrate's "Sectional Details" does.

## Save, reload and undo

- **Save** writes the tree, then `drawings.default_profile_id` from the
  **tree's** own direction — so an undone switch saves the range the drawing is
  actually in. The tree is already saved by then, so a failed range update
  warns instead of throwing: it must not lose a surveyor's work.
- **The history** names it with no new code: `diffTrees` already lists the
  changed fields, so a switch reads as the cill, the clearances, the type and
  the rails moving.
- **Undo** puts the range back with the tree (`syncDirectionProfile`), from the
  cache only — nothing is fetched on an undo. Without it, the next part the
  board built would take the other range's defaults.
- **Grids** are re-centred by `commit`, which already passes every tree through
  `recentreGridsAfterResize` — so a front door turned round keeps its muntin
  centred in its leaf, and a muntin the surveyor moved stays where it is. Both
  are tested.

---

# Which drawings to try it on live

On L507712, item 9 (or wherever is convenient) — each of these is one click
and a save, and the figure to expect is in brackets:

| drawing | try | expect |
|---|---|---|
| a **French pair** from template 26 "Fully Glazed" at 1899 × 2199 | Opens in | the cill reads 50, the leaves 910.5 × 2085, and the price lands on **£5,629.41** (OI1's) |
| a **single garden door**, template 15 at 1099 × 2199 | Opens in | leaf 997 × 2085, **£3,729.37** (OI2) |
| a **stable door**, drawing 50 (template 33) | Opens out | the bottom half 1,061 and its panel 799; the price rises by the 93p of timber |
| the same stable door | Opens in, again | back to 1,048 / 779 and the figure it had |
| a **front door**, drawing 47 or template 30 | Opens out, then in | the muntin stays centred in the leaf both times; a muntin dragged off-centre first stays put |
| a **coupled flag set** (built with the + Flag buttons) | Opens in | the door frame turns and every flag frame keeps its light |

Two things worth watching for live, because they are the two the offline tests
cannot see:

1. **the banner**, if either door profile is missing a key the switch needs —
   it should name the key and change nothing;
2. **the fanlight note**, if the profiles hold no sash clearances — it should
   say the fanlight kept its own.

---

# What a reader should be wary of

- **The two profiles are the source of every value**, and the reviewer read
  them on 14 Oct. The only ones the switch names itself are the template
  bottom rails. If a profile value is edited, the switch follows it — which is
  right, and worth knowing before anyone edits one.
- **A drawing saved before this step** carries its direction on its own nodes,
  and `drawingDirection` asks the parts, not the profile. So a drawing whose
  `default_profile_id` disagrees with its tree reads as its tree says and is
  put right by the next save.
- **SO1's timber is PROVISIONAL**, as every door-timber charge is (difference
  20): the sections are a door leaf's and the workshop has to confirm what is
  cut for a stable door — now including a 1,061 bottom half.
- **OI3 is Integrate's stored drawing, quirks and all** (2,591 frame, 78 rail).
  A GlazePro drawing of the same doors would be 2,599 with an 86 rail, and the
  difference is a *different drawing*, not a different price for the same one.
  Its parked 14p is a consequence of Integrate's quirk, not of ours.
- **`btmRailShapeId`**: 99 is square, 101 is stepped — this step settles what
  Step BD recorded as "NOT VERIFIED". The fixtures and the board now write the
  right one. The three front-door TEMPLATES (`sql/step-bd3`) still store
  "stepped" on their open-in leaves; **no rule reads the field**, so it is
  logged in difference 21 instead of being given a file, and the next template
  SQL should carry it. Say the word and it can have one.
- **No templates were added**, as the brief says: the switch makes them. A
  surveyor builds an open-in French door by taking the open-out template and
  clicking "Opens in".
- `public/version.json` is left uncommitted, as CLAUDE.md says.

---

# e2e after the deploy

Recorded below once the Vercel deploy was confirmed by decoding
`/version.json`.
