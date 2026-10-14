# Step BH — doorsets with lights, and a pair of front doors

Done 14 Oct 2026. Brief: `docs/step-bh-brief.md`.
Facts: none of its own. Every part here is one already matched penny for penny
— the open-in pair (OI1), the panelled leaves (FD4), the front door and its
fanlight (FT1 / FT2), the side light (FT4, Nathan's drawing 20), the doorset's
three units over (FD5), the stable doors (ST1–ST3, SO1).

Commits: `7142394` (item 0 — the brief) and this one.

**SQL waiting, neither run:**

- **`sql/step-bh1`** — one allocator rule: the French master's multipoint lock
  must stand down on a front door. This is the finding of item 2 and it is
  worth £53.55 a pair.
- **`sql/step-bh2`** — the five templates (240–260 "Open In Doors", 330–340
  "Cottage Doors"). Needs `sql/step-bf2` (the stable-door containment), which
  has run.

Offline suite: **1,882 passing, 8 failing** — the standing eight (six Step W
sash-weight rows, benchmarks A50 and D). 47 new tests. Every existing
benchmark is unchanged (item 4). `npm run e2e`: at the end.

---

# 1. What the board could and could not do

Measured, not assumed: a probe built each of the four door kinds and tried
every action on it.

| action | French pair | single garden door | front door | stable door |
|---|---|---|---|---|
| **+ Flag left / + Flag right** | worked | worked | worked | worked |
| **Transom / Mullion… (whole frame)** | **threw** | **threw** | **threw** | **threw** |
| **Transom / Mullion… (split this opening)** | **threw** | **threw** | **threw** | **threw** |
| the new opening | — | — | — | — |

**The flags already worked everywhere**, and for a good reason:
`addFlagFrame` acts on FRAMES and never knew what was in them, and the
buttons are offered on `isDoorDrawing`, which is every door.

**No divider could be added to a door drawing at all.** Every path threw

    Missing profile value thicknessInFrameSolid — a casement divider is
    solid and takes its thickness from the profile.

because a DOOR profile keys its divider section as
`transomPart.thicknessInFrame` — **41**, which is Integrate's own doorset
mullion and transom — and holds no `mullionPart.thicknessInFrameSolid`. So a
surveyor could not put a side light or a top light on any door by hand; only
the two templates that came with one (FT2's fanlight, template 32's side
light) had them.

And had the thickness resolved, the next thing would have been worse: the new
cell would have been **a copy of the door**. That is what a split does to
every other opening, on purpose (a surveyor's own sections survive it), but it
gives a doorset two doors — or, through the whole-frame grid, nothing at all,
because that function's idea of an "opening" was `[casementSashPart,
glassPart]` and a door was not in it, so the dividers went in and the new
cells came out empty.

## What was changed

| | |
|---|---|
| `solidDividerThickness` | one place that resolves a solid divider's section: `thicknessInFrameSolid` first (so **nothing about a casement window changes**), then `thicknessInFrame` — the door profile's 41. With neither, it still refuses to guess, and the message names both keys. |
| `applyDividers` | uses the SHARED `OPENING_TYPES` (which knows a pair, a leaf and a stable-door container) in place of its own two-type list, so a door is an opening and lands in its own cell. |
| `newOpeningFor` | an injected policy: given the opening being split, it may return the node the new cell should get. `newDoorsetOpeningFor` returns a **direct glazed unit** for a door and `null` (copy, as before) for anything else. Injected rather than imported, because the door vocabulary lives in `doorOpenings.js`, which imports `gridActions.js`. |
| placement | a door split by a **transom keeps the BOTTOM cell**: a door meets the cill and a light goes above it, never under it. On a mullion the door keeps its own column and the light sits beside it. |
| `doorsetDirectGlazedUnit` | pulled out of the two doorset builders that had it inline, so the light the board adds is the same light a template carries: Integrate's 15 mm clearance, 12 hidden, the profile's rebate. The door's glass CODES carry over. |
| the board | passes the policy to both divider handlers when the drawing is a door. |

So all four door kinds now take a mullion or a transom, the new opening
arrives as a light, and **"Change to: Fixed casement / Opening casement /
Direct glazed"** turns it into whichever it is — with the door profile's own
sash sections (62 / 62 / 62), not a casement window's. A stable-door container
sits in a frame cell below a transom or beside a mullion exactly as a leaf
does: its size follows the cell, and its halves follow the stored split.

25 tests in `src/drawingBoard/doorsetLights.test.js` hold all of it, including
that a casement window's own divider is still the solid 27.

---

# 2. A pair of front doors — and the lock that should not be there

It is built as **the open-in French pair with front-door leaves**, by turning
an ordinary pair round with Step BG's own switch, so there is one definition
of what "open in" means. 1500 × 2182, interior 1406 × 2085, two leaves of
**711 × 2068**, each with a 170 mid rail at Integrate's Balham height (983
above, 635 below of the 1788 interior) and **one flat panel above and below**.
No muntin. Master = right.

It is a FRONT door and not a French door, which is the whole point:

| | fires | why |
|---|---|---|
| **Front Door and Frame (Base)** 840 | ✓ | `is_front_door and is_complete_new and is_installation_included` |
| French Doors 780 | ✗ | `not is_front_door` |
| Single Door Only 660 | ✗ | `door_leaf_qty == 1` |
| French Doors Additional Door 120 | ✗ | `not is_front_door` — so **nothing charges for fitting the second leaf**; worth a look, since the brief asked only that 840 fire and 780 not. |
| the three **Dual Finish** rules | ✓ | Door Frame 240, Door Leaf 180 × 2 = 360 |

## The default ironmongery it gets, rule by rule

| product | finish | qty | rule |
|---|---|---|---|
| `102mm_hinges` | PB | **4** | `c11aeeb4` — a door_leaf rule at qty 2, fired once per leaf and merged: two pairs, £29.40 |
| `hardwick_classic_sleeved_letterbox` | PB | 1 | `e054f95c` — HK4350PB, £94.50 |
| `hardwick_classic_euro_pull_set_back_to_back` | PB | 1 | `cb8eb0b9` — HK4000PB, £25.20 |
| `av3_heritage_locking_system_lh` | PC | 1 | `b5c2d45a` — LJZ5074040CP 27.30 + RHZ3092 31.50 + RHZ2482 112.35 + RHZ2427 5.25 |

**Two things in that list are for the reviewer to confirm**, and neither is
something this step should decide:

1. it is the **AV3** Heritage locking system, where the brief (and the FT
   drawings' own STORED lists) say **AV4**. The live default rule gives AV3;
   Step BD costed the three AV4 parts because Integrate's drawings carry them.
   A new front door — single or pair — gets AV3 today.
2. it comes **LEFT HAND** although the master leaf is the RIGHT one. The rule
   does not read the master's hand, and a pair's master is the right leaf by
   default.

## The finding: RJZ2382

The allocator also gives the master leaf a **Winkhaus Thunderbolt Master
Multipoint Lock (RJZ2382, £53.55)**, on top of the heritage lock above. The
brief predicted it ("pricing must … NOT [see] the French master Thunderbolt"),
and here is why it happens:

    cebdd8b5  "MPLS master or tall – shootbolt"   RJZ2382
    is_door_mpls and gross_sash_height_in_mm > 1853
      and is_master_leaf_in_french_pair

Every other rule in that family carries `not is_front_door` (`1b55d5a5`,
`36d8eb57`, `c2ed4405`). **This one never did**, because Integrate has no pair
of front doors to catch it, and a single front door is not a master leaf in a
pair. `sql/step-bh1` appends the same clause, and nothing else: the SLAVE's
bolts and keeps (RHZ1649, RHZ1653, RHZ1667) stay — Nathan asks for them by
name — and a French pair keeps its Thunderbolt.

The test asserts **both** figures, today's and after the file, so it cannot
pass while the site is wrong (the Step BF follow-up lesson).

---

# 3. What each template prices, offline, on the live rules

`sql/step-bh1` applied for 240 (without it, add £53.55 / £107.10). Priced with
the live default ironmongery, the live rules and the live catalogue, through
`src/drawingBoard/doorsetTemplates.test.js`.

## 240 Pair Of Front Doors — 1500 × 2182

**cost £3,317.25 / price £6,634.49.** Production 3,765 min (62.75 h), fitting
840 min (14 h).

| production rule | × | minutes |
|---|---|---|
| Door Leaf | 2 | 2,070 |
| Machining & Joining a Door Frame | 1 | 855 |
| Additional for Flat Panel | 4 | 240 |
| Door Frame - Dual Finish | 1 | 240 |
| Door Leaf - Dual Finish | 1 | 360 |
| **fitting** | | |
| Front Door and Frame (Base) | 1 | 840 |

- **panels** 4 Tricoya: 0.4827 m² ×2 = £91.15 each, 0.3118 m² ×2 = £58.88 each
- **glass** none (both leaves are panelled throughout)
- **timber** Utile67x96 5,864 = £79.75 · Utile63x200 4,324 = £125.40 ·
  Utile63x120 9,654 = £167.01
- **ironmongery** £466.05: hinges 29.40, letterbox 94.50, euro pull 25.20,
  AV3 set 176.40 (27.30 + 31.50 + 112.35 + 5.25), slave bolts 136.50
  (93.45 + 36.75 + 6.30)
- also: architrave 13.11 + 4.56, consumables 30, LTW 25

## 250 Front Door With Side Lights And Fanlight — 1806 × 2654

Three direct glazed fanlights over a side light, the door and a side light.
**cost £4,582.78 / price £9,165.53.** Production 5,320 min (88.67 h), fitting
1,755 min (29.25 h).

| production rule | × | minutes |
|---|---|---|
| Door Leaf | 1 | 1,035 |
| **Sidelights in Doorsets** | 2 | 1,560 |
| Machining & Joining a Door Frame | 1 | 855 |
| Additional for Frame Mullion or Transom | 1 | 540 (180 × 3 dividers, in the rule's own value) |
| Additional for Flat Panel | 6 | 360 |
| Door Frame - Dual Finish | 1 | 240 |
| Door Frame - Dual Finish (Mullions) | 1 | 135 (45 × 3) |
| Door Leaf - Dual Finish | 1 | 180 |
| Casement Sash - Dual Finish | 1 | 180 |
| Glazing a Sash | 5 | 100 |
| Door Muntin | 1 | 60 |
| Frame with Doors/Casements and Direct Glazed | 1 | 75 |
| **fitting** | | |
| Front Door and Frame (Base) | 1 | 840 |
| Front Door and Frame (Mullion) | 1 | 240 (120 × 2) |
| Front Door and Frame (Transom) | 1 | 90 |
| Fixed Fanlight | 1 | 240 (120 × 2 fixed casements) |
| Door Direct Glazed Unit | 1 | 135 (45 × 3) |
| 1.75sqm Direct Glazed Unit in Frame (Small) | 3 | 210 |

- **glass** 5 units, £97.80 in all: the three fanlights 0.30 / 0.38 / 0.30 m²
  and the two side lights 0.30 each — **four of the five price at the 0.30 m²
  minimum**, which is what makes a small light cost what it does
- **panels** 6 Tricoya: the door's four (0.1506 / 0.2713 ×2 / 0.1506) and the
  two side lights' (0.1753 each)
- **timber** Utile67x96 13,940 = £189.58 · Utile63x200 4,298 = £124.64 ·
  Utile63x120 6,796 = £117.57 · Utile63x63 9,034 = £77.69
- **ironmongery** £310.80: hinges 14.70 (one leaf), letterbox 94.50, euro pull
  25.20, AV3 set 176.40 — no slave bolts (there is no pair)

## 260 Front Door With Side Lights And Fanlight Over Door — 1806 × 2654

One fanlight over the door; the side lights run full height. **cost £4,464.05
/ price £8,928.07.** Production 5,280 min (88 h), fitting 1,615 min (26.92 h).

Production is 250's less the two fanlights' glazing (40 min). Fitting differs:

| fitting rule | × | minutes |
|---|---|---|
| Front Door and Frame (Base) | 1 | 840 |
| Front Door and Frame (Mullion) | 1 | 240 |
| Front Door and Frame (Transom) | 1 | 90 |
| Fixed Fanlight | 1 | 240 |
| Door Direct Glazed Unit | 1 | 45 |
| 1.75sqm Direct Glazed Unit in Frame (Small) | 1 | 70 |
| **Any Sash Overweight (Casement)** | 2 | 90 |

The last one is the difference worth knowing: the full-height side lights are
**over 25 kg each**, so each costs 45 minutes of fitting that the short ones in
250 do not.

- **glass** 3 units, £73.04: the fanlight 0.38 m² and the two full-height side
  lights 0.40 each
- **panels** the same six as 250
- **timber** as 250 but Utile63x63 **10,922** = £93.93 (the taller sashes)
- **ironmongery** as 250, £310.80

## 330 Stable Door With Fanlight — 1099 × 2679

**cost £2,955.58 / price £5,911.17.** Production 3,765 min (62.75 h), fitting
1,015 min (16.92 h).

| production rule | × | minutes |
|---|---|---|
| Door Leaf | 2 | 2,070 |
| Machining & Joining a Door Frame | 1 | 855 |
| Additional for Frame Mullion or Transom | 1 | 180 |
| Door Frame - Single Finish | 1 | 180 |
| Door Frame - Single Finish (Mullions) | 1 | **85** |
| Door Leaf - Single Finish | 1 | 180 |
| Additional for Flat Panel | 2 | 120 |
| Glazing a Sash | 1 | 20 |
| Frame with Doors/Casements and Direct Glazed | 1 | 75 |
| **fitting** | | |
| Stable Door | 1 | 900 |
| Door Direct Glazed Unit | 1 | 45 |
| 1.75sqm Direct Glazed Unit in Frame (Small) | 1 | 70 |

- the door itself is **ST1 exactly**: container 997 × 2103, halves 1055 /
  1048, panels 0.6573 (£124.14) and 0.6053 (£114.31)
- **glass** the fanlight 0.42 m² = £24.57 + surcharge £1.43
- **timber** Utile67x96 7,462 = £101.48 · Utile63x200 2,096 = £60.78 ·
  Utile63x120 7,157 = £123.82 (the halves' timber, difference 20)
- **ironmongery** £102.90 — the stable-door set of `sql/step-bf3`: hinges
  29.40, sashlock 29.40, deadlock 15.75, XR16 Blk 3.15, Victorian 25.20
- no "Fixed Fanlight" fitting: a direct glazed fanlight is not a casement sash

## 340 Stable Door With Side Light — 1505 × 2207

**cost £3,392.79 / price £6,785.57.** Production 4,590 min (76.5 h), fitting
1,020 min (17 h).

Production is 330's pattern plus **Sidelights in Doorsets 780**, one more flat
panel (the side light's) and the single-finish casement sash 60, and without
the direct-glazed 75. Fitting is **Stable Door 900 + Fixed Fanlight 120** —
Integrate's rule counts any fixed casement sash in a door, and there is no
direct glazed unit at all.

- the door is **ST1 exactly** again (997 × 2103, 1055 / 1048)
- the side light's **170 mid rail is level with the meeting rails**: centre to
  centre, offset **911** (the join's centre is 4 + 1055 + 1.5 below the
  interior top; the rail's is 3 + 62 + offset + 85). The two rails are 201 and
  170 deep, so they cannot align on both edges — the centres are what the eye
  reads as level, and the choice is stated here rather than buried.
- **glass** the side light 0.30 m² (the minimum) = £17.55
- **panels** three: the door's two and the side light's 0.1847 (£34.88)
- **timber** Utile67x96 8,029 = £109.19 · Utile63x200 2,861 = £82.97 ·
  Utile63x120 7,157 = £123.82 · Utile63x63 4,567 = £39.28

---

# Drawings to make live

On L507712 (or wherever suits), once `sql/step-bh2` has run — each from its
template, then priced through a quote:

| from template | expect |
|---|---|
| **Pair Of Front Doors** (240) | £6,634.49, or **£6,741.59 if `sql/step-bh1` has not run** — the £107.10 of Thunderbolt is the fastest way to see whether it has |
| **Front Door With Side Lights And Fanlight** (250) | £9,165.53, three fanlights over |
| **… Fanlight Over Door** (260) | £8,928.07, the side lights full height |
| **Stable Door With Fanlight** (330) | £5,911.17 |
| **Stable Door With Side Light** (340) | £6,785.57 |

And to try item 1 by hand, on any door drawing:

1. select the door, open **Transom / Mullion…**, pick the **1 × 2** tile — a
   transom goes in and a **direct glazed fanlight** appears above the door
   (before this step the dialog showed an error and did nothing);
2. with the new light selected, **Change to: Fixed casement** — it becomes a
   side-light-style sash with 62 mm sections;
3. the **2 × 1** tile on the door instead — the light appears beside it;
4. **+ Flag right** on a stable door or a front door — a flag frame is added
   and the door frame keeps its door;
5. on a coupled set, the same actions on the DOOR frame only.

---

# What a reader should be wary of

- **None of the five is a reading.** Integrate has no template for any of
  them, so the sizes are the reviewer's starting figures and the layouts are
  compositions of matched parts. Every rule each one fires is listed above
  precisely so the reviewer can check them by hand; nothing here has been
  tuned to a target, because there is no target.
- **The AV3 / AV4 question and the hand of the lock** (above) are live-data
  questions this step did not decide. They apply to every front door, not just
  the pair.
- **Nothing charges for fitting the second leaf** of a pair of front doors:
  "French Doors Additional Door" 120 carries `not is_front_door`. The brief
  asked only that 840 fire and 780 not, so this is reported rather than
  changed.
- **"Door Frame - Single Finish (Mullions)" is a flat 85** however many
  dividers there are, where the DUAL rule scales at 45 each. Both are
  Integrate's own imported values.
- **Four of 250's five glass units price at the 0.30 m² minimum.** A doorset of
  small lights is mostly minimum-charge glass, and that is Integrate's rule.
- **The side light's mid rail on a stable door is a CHOICE** (centre to centre,
  offset 911) because the two rail bands are different depths. If Nathan wants
  the top edges flush instead, it is one number in
  `stableSideLightMidRailOffset`.
- **A board-built open-in door now carries the range's cill stop of 0**, where
  the templates `sql/step-bd3` and `sql/step-be2` wrote 26. The open-in range
  holds 0 (Step BG's facts), nothing on a door prices it, and `sql/step-bh2`
  writes 0 — so the four older front-door templates are the odd ones out until
  a file tidies them.
- **The two-pass side light** is not an elegance: where its mid rail goes
  depends on the door's bottom panel, and the door's bottom panel is not known
  until the frame has been divided. Reading it too early put both rails 472 mm
  out, which is the fanlight and its transom. The builder now measures the
  door in the frame it is actually in.
- `public/version.json` is left uncommitted, as CLAUDE.md says.

---

# e2e after the deploy

Deploy confirmed by decoding `/version.json`: **14:10:55Z**, just after the
commit.

`npm run e2e` — **5 passed** (27.5s): logs in; every benchmark passes except
the parked residuals; the fanlight drawing; the validation panel; every
drawing card on the L507712 matrix priced.

The benchmark test matters here as a NEGATIVE: this step changed the divider
actions, the doorset builders and one fixture profile value, and all 61
benchmark rows are where Step BG left them. Nothing in the pricing engine
moved.

**What the smoke suite cannot see yet**: the five templates, because neither
`sql/step-bh1` nor `sql/step-bh2` has run. Once they have, the five drawings
listed above are worth pinning in the suite the way the benchmark rows are —
and the fastest check of bh1 is the pair of front doors at £6,634.49 rather
than £6,741.59.
