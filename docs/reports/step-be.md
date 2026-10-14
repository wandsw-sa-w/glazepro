# Step BE — front doors: Nathan's corrections, and the side light

Done 14 Oct 2026. Brief: `docs/step-be-brief.md`.
Facts: `docs/integrate-L31115-front-doors.txt` (the 14 Oct sections, decisions
d–g), read by the reviewer in Integrate's own **Estimated Labour Time editor**
and on his drawing 20.

Commits: `a63e947` (item 0 — the brief, the facts and the FT4 target, all the
reviewer's, unchanged), `8c50c3b`, and this report.

**SQL waiting, neither run: `sql/step-be1`** (the shaped glass rate) and
**`sql/step-be2`** (the side light's containment, then the fourth template —
SECTION 1 before SECTION 2).

---

## A. Door production minutes (decision d)

FT1's 2,670 had been unexplained since Step BD. The editor shows that
Integrate reaches it through **two of its own errors**:

| Integrate fires on FT1 | | should be |
|---|---|---|
| 1240 Additional for **Flat** Panel | 4 × 60 = 240 | the panels are type 110, **raised and fielded** |
| 1245 Additional for **R&F** Panel | never fires | 4 × 120 = **480** |
| 1235 **Door Muntin** | 2 × 60 = 120 | **60** — one muntin; Integrate counts the **mid rail** as a second |

GlazePro charges R&F 120 a panel (as it already did) and 60 per **real**
muntin: `sash_muntin_to_be_replaced_qty` is now the door leaves' own
`mullionPart` children. **A mid rail is not a muntin.**

| | GlazePro | Integrate | |
|---|---|---|---|
| **FT1** | 2,790 → **2,850** | 2,670 | +180 min = **+£73.98**, BY DESIGN |
| **FT2** | 2,770 | 2,770 | **unchanged** — a mid rail only, no muntin |
| **FT3** | 3,290 | 3,290 | **unchanged** — the case where Integrate's two errors cancel (its flat 60 + a mid-rail "muntin" 60 = GlazePro's R&F 120), so its old agreement was for the wrong reason |
| **FT4** | **4,085** | 3,905 | the same +180, from five panels and two mid rails |

**Every other benchmark with a door leaf was checked and none moved**: FD1–FD7,
SD1–SD4 and CD1–CD4 have no leaf muntin at all (FD4's two leaves have a mid
rail each), so Door Muntin fires nothing on them — a test asserts that for
FT2, FT3 and FD4 and the full suite covers the rest.

A **sash window** keeps the variable at 0: a box sash's real glazing bars are
counted as `gb_to_be_replaced_qty`, and the two "Real Glazing Bar" rules are
gated on `is_sw` / `not is_door`, so a door's muntins can never reach them.
Benchmark C is tested for exactly that.

**FT1's £49.32 "pending" is closed** and replaced by a declared difference.

## B. Shaped glass (decision e) — every product

A shaped unit is billed on the **largest rectangle of its cut glass + 25%** —
the sheet the supplier cuts the shape out of — at the **square** glass rate.
Integrate does two things differently, and both are wrong: it prices the
**exact shape** (and on FT3 even that is wrong, 0.62 m² where the shape
measures 0.79), and it puts the quarter on the **rate** (71.88 = the square
rate's panes × 1.25).

**Nathan's figure vs GlazePro's cut size.** Nathan worked FT3 at 799 × 1125 =
0.899 m² → 1.12 → £65.52. GlazePro's own cut size is **801 × 1127** (the
777 × 1103 sightline grown by the 12 mm cover on every edge), which gives
**0.902727 → 1.128409 → 1.13 m² → £66.11** at the square rate. Two
millimetres, 59p.

**Every benchmark with shaped glass — there are exactly two in the whole set:**

| | old glass lines | new | cause |
|---|---|---|---|
| **FT3** arched front door | Shaped 0.83 @ 71.875 = 59.66; energy 16.6 kg = 2.82 | Shaped **1.13** @ 71.875 = 81.22; energy **22.6 kg** = 3.84 | 801 × 1127 + 25% |
| **C** arched-head box sash | Shaped 0.32 @ 71.875 = 23.00; Shaped bar 0.32 @ 44 = 14.08; energy 6.4 kg = 1.09 | **0.43** @ 71.875 = 30.91; bar **0.43** @ 44 = 18.92; energy **8.6 kg** = 1.46 | 750 × 460.5 + 25% |

**C is a sash window, and it is the first difference on it since Step AD** —
which is decision e being every product rather than doors only. Everything
else about C still matches Integrate to the penny.

**The energy surcharge is untouched**, as the brief asked. Its rule is
`(rounded_area × (inner + outer pane thickness)) × 2.5` at £0.17 — i.e. it is
based on the **same `rounded_area`** the glass line uses, taken as 2.5 kg per
m² per mm of glass. So it follows the billable area without being changed, and
that is why the kilos above move.

**Each row is declared in two halves**, because the AREA is GlazePro's own
(the engine) and the RATE is still Integrate's until `sql/step-be1` runs:

| | BY DESIGN | PENDING on sql/step-be1 | row |
|---|---|---|---|
| **FT3** | 13.45 timber + **23.28** glass | **15.11** (1.13 × 13.375) | +51.84 |
| **C** | **7.37** glass | **5.75** (0.43 × 13.375) | +13.12 |

**FT3's open £15.81 is closed.** The question had been which of two models
described the glass; the answer is neither — a shaped unit is billed on the
sheet. The open-questions table in `docs/integrate-differences.md` is empty
again, and the exact-shape model stays in the code (`shapedGlassCutAreaM2`)
pricing nothing: it measures the glass, and the difference between it and the
bill is the supplier's charge.

## C. The side light (decision g) — FT4 and the template

A side light is a **fixed casement sash** in the door frame — not the fixed
door leaf decision c had guessed — holding the same grid a leaf does.

**The grid is no longer a leaf's alone.** `leafCells`, the cells' parts and a
panel's visible size now ask the **holder** for its outer size, so a sash's
panel has a size at all (it had none, and so no Tricoya line) and its glass
stops at its own mid rail (it ran the full 1,842 interior instead of the 888
above the rail).

**FT4, group by group:**

| | GlazePro | Integrate | |
|---|---|---|---|
| production | 4,085 min (68.08 h) | 3,905 (65.08) | +180 = **+£73.98** (part A) |
| fitting | **1,080 min** | 1,080 | **exact** — 840 + 120 a frame mullion + 120 a fixed casement sash, and **no** "Combination Frame" |
| glass_done | **18.57** | 18.57 | **exact** — 0.236 m² of cut glass prices at the 0.30 m² minimum, Integrate's own 17.55 |
| installation_materials | **310.94** | 310.94 | **exact** |
| manufacture_materials | 587.57 | 516.65 | **+70.92**, below |
| **total** | **3,319.71** | 3,174.81 | **+144.90**, all declared |

**The +70.92, recomputed from lengths and per-metre costs:**

| | length | section | |
|---|---|---|---|
| the frame **mullion** | 2,085 mm | Utile67x96 @ 13.60 | **28.36** (difference 11) |
| the leaf's 120 **muntin** | 1,788 mm | Utile63x120 @ 17.30 | **30.93** (difference 13) |
| the leaf's 120 **mid rail** | 672 mm | Utile63x120 @ 17.30 | **11.63** (difference 13) |

and Integrate's own three lengths are reproduced exactly: 67x96 **5,764**
(W + 2H), 63x200 **2,651** against its 2,650 (the cill 1,400 + the door's
bottom rail 892 + the side light's 359 — one millimetre from its 2 dp), 63x63
**4,517**.

**Two allocation rules came out of drawing 20**, both Integrate's own:

- a side light's **stiles and top rail** are W + 2H with **no** fanlight
  offset (a fanlight reads +14) — 4,517 exactly;
- its **175 bottom rail** comes from the same **63x200** as a door's bottom
  rail, not from the 63x96 an 86 fanlight rail uses.

The rail depth tells them apart (`DOOR_DEPTH_RAIL_MM` = 150): a fanlight's is
62 or 86, a side light's is the door's 170-odd. Before this, GlazePro put the
175 rail in 63x96 and charged £6.03 less than Integrate — an under-charge, now
gone.

**The board** builds one: `addSideLight(tree, frameKey, side, profileValues)`
puts a 41 mullion in the frame and a fixed sash in the new column, with glass
over a raised-and-fielded panel, and five tests take it through the board path
(including that every layout saves and the containment holds).

**The template, "Front Door With Side Light"** (sort_order 230, after the
arched one): one 1400 × 2182 frame, a 41 mullion at 900, Integrate's Balham
leaf in the 900 column (983 / 635, muntin centred — decision f) and the fixed
sash in the 365 one.

**The offset I stored is 1031**, and here is the working. A divider's offset is
the span **before** it, so what is stored is the **glass above the rail**. The
door's rail stands `14 + 170 + 635 = 819` above the bottom of the opening (its
leaf drops 14 into the frame, its bottom rail is 170, its bottom panel 635).
The sash drops 3 and has a 175 rail, so for its rail to reach the same 819 its
panel must be **641** — and its 1,842 interior less the 170 rail less that 641
leaves **1,031** of glass. A test asserts the two rails meet rather than the
two numbers, so the invariant survives a change of size.

**Integrate's own drawing 20 does something else**: it makes the two **panels**
equal (834 each) and leaves the rails **6 mm apart**. The brief asked for the
rails to meet, so the template does that and the FT4 fixture keeps Integrate's
tree. Both are recorded in difference 18.

## What each template prices offline

Through the live rules as `sql/step-bd1` and `sql/step-bd4` left them, with no
stored ironmongery (a new drawing has none, so the default rules allocate
£315.00):

| Template | cost | price | production | fitting |
|---|---|---|---|---|
| Front Door | **2,604.67** | 5,209.32 | 2,850 | 840 |
| Front Door With Fanlight | **2,697.97** | 5,395.92 | 2,770 | 1,090 |
| Arched Front Door | **2,740.23** | 5,480.46 | 3,290 | 885 |
| Front Door With Side Light | **3,371.33** | 6,742.63 | 4,085 | 1,080 |

Against the reviewer's live drawings 44–46 (2,580.01 / 2,697.97 / 2,717.65),
which were priced before this step: the Front Door is **+24.66** (the one real
muntin's 60 minutes) and the arched one **+22.58** (its shaped glass, with the
rate still Integrate's — `sql/step-be1` takes another 15.11 off it, to
**2,725.12**). The fanlight one does not move: no muntin, no shaped glass.

## What the tests show

**Tests first** — 13 new, each failing before its fix:

- `src/pricing/frontDoorBe.test.js` (7): FT1's one muntin and its 2,850; a mid
  rail is not a muntin (FT2, FT3, FD4); a sash window's bars are not muntins
  (C); the billable area on Nathan's figures and on GlazePro's cut size; FT3's
  1.13 m² and its rate; the energy surcharge following the area; and C's two
  arched units moving.
- `src/drawingBoard/frontDoorBoard.test.js` (+5): adding a side light through
  the board and it being a fixed sash with its own grid; the mullion leaving
  Integrate's 365 column; **the two mid rails meeting**; the sash coming first
  on the left; and the template.
- `benchmarks.test.js`: FT4 in the FT block (production, fitting, every group
  against Integrate plus what is declared), its five Tricoya lines and its
  glass at the minimum, and its side-light sections; C's two call sites now
  declare the shaped glass, through a harness that takes the fixture's own
  declaration rather than repeating the figure.

**Three of my own premises were wrong, and I corrected the tests, not the
code:** my multiplication of Nathan's 799 × 1125 (1.1235938, not 1.123875);
the side light's mid rail needs the **rail's own thickness** taken out of the
offset as well as the panel; and a default-grid door has an 809 bottom row, so
the board's side light reads 857 / 815 where the Balham template reads
1031 / 641 — which is why the test now pins the invariant.

**Offline: 1,756 passing, 8 failing — the standing eight, unchanged**
(`npx vitest run`, 79 files). Eslint unchanged in count.

**Live: 5 of 5 passed (41.8s)**, against the deploy of `8c50c3b` —
`/version.json` reads `mv7wx8o2`, built 2026-10-14 09:33:44Z, twelve seconds
after the commit:

```
ok 1 logs in (5.8s)
ok 2 every benchmark passes except the parked residuals (14.0s)
ok 3 the fanlight drawing shows Fanlight A1 and Casement Sash A2 (3.6s)
ok 4 the validation panel loads without an error (3.5s)
ok 5 every drawing card on the L507712 quote matrix shows a price (12.5s)
```

Test 2 reads the five declared rows at exactly +104.92 (FT1), +13.67 (FT2),
+51.84 (FT3), +144.90 (FT4) and +13.12 (C), so none of them can drift.

## Not verified against the live database

- **`sql/step-be1` and `sql/step-be2` have not been run.** Until be1 is in,
  every shaped unit is charged the supplier's quarter twice — FT3 is £15.11
  and C £5.75 dearer than they should be, and a real arched door on the live
  site is too. Until be2 is in there is no side-light template and a sash
  holding a mid rail cannot be saved.
- **No side light has been drawn or saved on the live board**, and no drawing
  has been made from the new template.
- **FT4's side-light clearances (3 / 3 / 3 / 3) are not verified**: the facts
  give the drawn 359 × 2079 in a 365 × 2085 opening, and 3 each way is what
  reproduces both. A doorset fanlight's 1 / 1 / 1 / 2 would give 363 × 2082.
- **The 63x200 reading is 2,651 against Integrate's 2,650** — one millimetre,
  from its 2 dp display of metres.
- **The panel weight (6.1 kg/m²) is still the bracket of difference 14**, and
  FT4 did not test it: its leaf is over 50 kg either way.

## Anything that did not behave as the brief describes

- **The brief expected FT1 at +60 minutes; it is +180.** 2,790 → 2,850 is the
  +60 the muntin adds, and the difference from Integrate is 180 (its −240 of
  flat panels against GlazePro's R&F, plus its +60 of mid-rail "muntin"). The
  brief's own arithmetic says the same thing; the +24.66 it quotes is the step's
  own change, and the declared difference is +73.98.
- **Two allocation rules changed that the brief did not name** — a side
  light's missing fanlight offset and its 175 rail's section. Both are
  Integrate's own figures on drawing 20, and without them FT4 could not match
  its 63x63 or its 63x200. The second was an under-charge of £6.03.
- **The shaped-glass work needed a rule change**, which is why `sql/step-be1`
  exists: the 25% is now on the area, so leaving it on the rate as well would
  charge it twice. The brief said "at the square glass rule's rate", and
  taking the expression from that rule rather than typing 58.50 keeps one
  source for the pane costs.
- **`casementSashPart -> transomPart / panelPart / mullionPart`** had to be
  allowed for a sash to hold a grid at all (`sql/step-be2` SECTION 1).
- `public/version.json` is left uncommitted on purpose, as CLAUDE.md says.
