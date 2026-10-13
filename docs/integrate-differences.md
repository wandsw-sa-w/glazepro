# Deliberate differences from Integrate

This file records every pricing difference where GlazePro intentionally
departs from Integrate's behaviour, with the reason, date, and effect.

---

## 1. Sash material rules gated by `to_be_replaced`

**Date:** 6 October 2026
**Decided by:** Nathan Smith
**SQL:** `sql/step-s4-sash-material-rules.sql`

**What differs:**

Three price rules in the `manufacture_materials` group charge sash timber
and glazing bead on every sliding sash, regardless of whether the sash is
being manufactured:

| Sort | Rule name                     | Integrate condition                                                    | GlazePro condition (corrected)                                                              |
|------|-------------------------------|------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| 10   | Laminated Softwood for Sashes | `is_solid_redwood_sash and is_bottom_sash`                             | `is_solid_redwood_sash and is_bottom_sash and to_be_replaced`                               |
| 15   | Laminated Softwood for Sashes | `is_solid_redwood_sash and is_top_sash`                                | `is_solid_redwood_sash and is_top_sash and to_be_replaced`                                  |
| 310  | Glazing Bead for Sashes       | `is not square_top_with_arched_sightline and is not curved_head_sash`  | `is not square_top_with_arched_sightline and is not curved_head_sash and to_be_replaced`    |

`to_be_replaced` is a sliding-sash-loop variable that is `true` when the
sash is being replaced (complete new, or sash explicitly marked for
replacement). It is `false` on a draught seal and overhaul (DSO) where
the sashes are planed and re-hung, not remade.

**Why:**

On a draught seal and overhaul, no sash timber is cut and no glazing bead
is fitted. Charging for these materials is an error in Integrate's price
file. Integrate rule conditions were not updated when the DSO work type
was added.

**Effect on price:**

| Benchmark                          | Before (Integrate) | After (GlazePro) | Change     |
|------------------------------------|-------------------:|------------------:|-----------:|
| Benchmark B (DSO, 950 x 1032)     | cost £233.79       | cost £208.33      | -£25.46    |
|                                    | price £573.55      | price £522.65     | -£50.90    |
| Benchmark A (sash replacement)     | unchanged          | unchanged         | £0.00      |
| L34046 Item 7 (complete new)       | unchanged          | unchanged         | £0.00      |

The three removed lines total £25.46 cost and £50.90 price on a DSO job.
Sash replacement and complete new jobs are unaffected because
`to_be_replaced` is `true` for their sashes.

---

## 2. Complete new sash windows are always 45 mm thick

**Date:** 9 October 2026
**Decided by:** Nathan Smith
**SQL:** `sql/step-ai1-complete-new-45mm-rule.sql` (written by the reviewer, run by Nathan)
**Code:** `src/drawingBoard/sashThickness.js` (board), Step AI

**What differs:**

A complete new sash window is always manufactured 45 mm thick. GlazePro
enforces that in two places:

| Where | Behaviour |
|---|---|
| Drawing board | On a box sash item whose type of work is Complete New, Sash Thickness is read-only at 45 mm, noted "Complete new sash windows are always 45 mm". Choosing Complete New, or creating a drawing from a complete-new template, sets 45 through the same path as a hand thickness edit (bottom rail and frame height shift so that rail + chamfer allowance and the external sash height are unchanged, and the change appears in the drawing history). A drawing already saved at another thickness is never changed on load — a "Set to 45 mm" button applies it. |
| Validation | Item-level **warning** `is_sw and frame_to_be_replaced and sash_thickness != 45` — "Complete new sash windows are always made 45mm thick." |

Integrate has no such rule: its sash thickness is a free number box on every
type of work, and its own validation ("Sashes are only manufactured to 35,
40, 45 or 50mm", rule 24) is conditioned on `not frame_to_be_replaced`, so
it never fires on a complete new item — a 57 mm complete new drawing raises
nothing in Integrate (`docs/integrate-L31115-A-top-only.txt` §5).

Sash replacements are unaffected: they may be 35 / 40 / 45 / 50 mm (and
always replace both sashes), which is what benchmarks A35 / A40 / A50 price.

**Why:**

The workshop only makes complete new sash windows at 45 mm. Offering other
thicknesses on a complete new drawing can only produce a quote that cannot
be built.

**Effect on price:**

None on any benchmark. Every complete-new benchmark is already 45 mm —
L34046 Item 7, C (arched) and D (double box) — and the rule is a board and
validation rule, not a pricing rule: no price rule, variable or engine
behaviour changed, and the full benchmark line dump is byte-identical to
Step AH (`PRICING_ENGINE_VERSION` stays 10).

---

## 3. A sash replacement keeps the sash size when the jambs change

**Date:** 9 October 2026
**Decided by:** Nathan Smith
**Code:** `src/drawingBoard/internalSize.js` (board), Step AL

**What differs:**

When the frame's jamb, head or cill sizes change on a **sash replacement** —
most visibly when switching the sashes to Spiral Hung, which stamps the
profile's 28 mm spiral jambs over 85 mm cord jambs — GlazePro keeps the
**internal (sash) size** and recomputes the overall frame around it.

Integrate does the opposite: it keeps the **overall frame** and lets the
sashes grow. That is exactly what benchmark F records
(`docs/integrate-L31115-spiral.txt`): benchmark A's frame stayed 1070 x 1849
and the sash width went 900 → 1014 as the jambs went 85 → 28.

| | Integrate | GlazePro |
|---|---|---|
| Frame | 1070 x 1849 (kept) | 956 x 1798 (recomputed) |
| Internal / sash size | 900 → 1014 (grown) | 900 x 1700 (kept) |

On a **complete new** item GlazePro keeps the overall frame, exactly as
Integrate does — no change there.

**Why:**

On a sash replacement the surveyor measures the sashes, not the frame: the
box frame is already in the wall. A size the surveyor never measured must not
change because a hardware choice changed the jamb thickness, or the new
sashes will not fit the opening.

**Effect on price:**

None on any benchmark. Benchmark F's fixture holds Integrate's own stored
geometry as explicit values (frame 1070 x 1849 with 28 mm jambs), so it still
prices 704.69 / 1,409.42 exactly; this difference changes only what the BOARD
does when a user makes that change, and the board path is tested separately
(`src/pricing/benchmarks/boardPath.test.js`). No price rule, variable or
engine behaviour changed, and the full benchmark line dump is byte-identical
(`PRICING_ENGINE_VERSION` stays 11).

---

## 4. A new casement drawing starts with no stored ironmongery list

**Date:** 9 October 2026
**Decided by:** Nathan Smith (decision 3)
**Code:** `src/drawingBoard/casementOpenings.js`, `src/pricing/defaultIronmongery.js`, Step AP

**What differs:**

Integrate stores an ironmongery list on the drawing and **never changes it
when the openings change**. A new Integrate casement drawing carries whatever
list its template had, so a surveyor who turns an opening casement into a
fixed one still has the handle, gearbox and extensions on the list and has to
delete them by hand.

GlazePro's casement templates store **no list at all** (`sql/step-ap1`). The
default ironmongery rules — Integrate's own, already in
`part_allocation_rules` — price the ironmongery from the tree, so the list
follows the openings automatically:

| | Integrate | GlazePro |
|---|---|---|
| New drawing | the template's stored list | no list; the rules price it |
| B1 opening → fixed | list unchanged (handle, gearbox and extensions stay) | handle, gearbox and extensions drop out |
| Surveyor edits the list | stored from then on | stored from then on (same) |

The last row is the important one: as soon as a surveyor edits the list it is
stored on the drawing and from then on the stored list is used, exactly as on
a sash window. The difference applies only to a drawing nobody has touched.

**Why:**

A stored list that does not follow the drawing is a silent overcharge: the
surveyor changes a sash to Fix, the price keeps the handle and the multipoint
gear for it, and nothing on screen says so. Deriving the list from the tree
means the quote always matches the window that was drawn. Nathan also wanted
"Casement MPLS" on by default (casements are multipoint by default here) with
the surveyor able to untick it — `sql/step-ap2` adds that field.

**Effect on price:**

None on any benchmark. J–P all hold Integrate's own stored list as explicit
fixture values, so they price exactly as Step AO recorded them; this
difference changes only what a NEW drawing does before anyone edits its list.
The default lists the rules produce are reported in `docs/step-ap-findings.md`
— and three of them currently price 0.00, because the default line resolves
to the item's ironmongery finish (PB) while the friction hinge, the gearbox
and the Kenrick extensions exist only in PC. That is an unresolved data
question for the reviewer, not part of this difference.

---

## 5. A new fanlight's bottom rail is 62 mm, and a template carries no nosing

**Date:** 13 October 2026
**Decided by:** Nathan Smith (12 and 13 October)
**Code:** `src/drawingBoard/casementOpenings.js` (`applyFanlightBottomRails`),
`sql/step-av1`, `sql/step-ax2`, `sql/step-ax3`, Steps AS, AV and AX

**What differs:** two things, both about what a NEW drawing starts with.

**(a) The fanlight bottom rail.** Integrate's own templates and drawings give a
fanlight the ordinary 83 mm bottom rail, and then Integrate's validation warns
"Fanlight bottom rail should be reduced to 62mm externally" every time the
drawing is opened. Nathan (12 Oct) decided a new GlazePro fanlight defaults to
**62**, which is what the warning asks for, so the warning never fires on a
GlazePro drawing. A rail the surveyor types is never touched.

The cost shows on FR2, whose fanlight Integrate priced on 83:

| | fanlight timber | sash cost | FR2 total cost |
|---|---|---|---|
| Integrate (83) | 8.38 dm³ | 4.61 | 1,306.98 |
| GlazePro (62) | 7.45 dm³ | 4.10 | 0.51 less |

Put Integrate's 83 back on the same tree and every line agrees, which is what
`src/drawingBoard/frenchCasement.test.js` asserts — so this is a decision, not
a modelling gap.

**(b) The template nosing.** Integrate's templates 1, 2, 7, 10, 11, 12 and 13
all carry a "Nosing in Solid Redwood" surround, but Integrate **recalculates
the surround the first time a drawing is saved** —
`autoCalcSurroundComponents 'architrave_and_bullnose'` — and that calculation
produces no nosing. Every SAVED Integrate drawing the reviewer has read has
architrave only (J 1/12, Q 2/21, SA 5/1, and FR3 9/3, which lost its nosing
and 30 minutes of install labour on the save). So the nosing on a template is
something Integrate never actually quotes.

Nathan (13 Oct): GlazePro leaves it off. `sql/step-ax3` takes the stored
surround list off the four Step AV combination templates, and the French
templates never carried one, so a new drawing prices its surround through the
allocator — architrave only, which is how J, Q, R and S are exact.

What a nosing is worth, on each drawing that has one recorded:

| | cost with the nosing | without | difference | install labour |
|---|---|---|---|---|
| TC1 | 1,397.22 | 1,373.53 | 23.69 | 780 → 750 min |
| TC2 | 1,546.29 | 1,522.04 | 24.25 | 810 → 780 min |
| TC3 | 1,360.34 | 1,336.37 | 23.97 | 750 → 720 min |
| FR1 | 1,007.76 | 983.79 | 23.97 | 690 → 660 min |
| FR2 | 1,283.88 | 1,260.74 | 23.14 | 780 → 750 min |

(Costs are GlazePro's, so each is short by the known gearbox snapshot gap; the
differences are what matter here. Each drop is the nosing's own component line
plus rule 251's 30 minutes of install labour.)

**Why:**

Both are the same principle: a new drawing should start as the window Nathan
sells and quote what the job actually costs. A fanlight that needs its rail
reduced is a warning the surveyor would have to act on every time, and a
nosing nobody is charged for is an overcharge that nothing on screen explains.

**What is NOT changed:** the stored-surround model stays exactly as Step AV
built it. `storedSurroundParts` still reads `values.surroundLines` and replaces
the allocator's surrounds when a list is present, and `has_deep_window_board`
still fires rule 251's 30 minutes — so a surveyor who adds a nosing gets it
priced. The TC and FR **fixtures** keep their recorded nosing and stay exact,
because the Integrate drawings they were read from were never saved.

---

## 6. A casement gets BOTH trickle vents

**Date:** 13 October 2026
**Decided by:** Nathan Smith
**Code:** none — this is a decision ABOUT the data, recorded so nobody
"fixes" it. Asserted as intended in `src/drawingBoard/combinationCasement.test.js`
and `src/drawingBoard/frenchCasement.test.js`.

**What looks wrong and is not:**

Two live `default_ironmongery` rules both carry the label "Trickle Vent", and
on a casement **both fire**, so the default list shows a vent twice under two
names:

| sort | label | product | condition |
|---|---|---|---|
| **50** | Trickle Vent | `trickle_vent_xr16` Wht | `frame_to_be_replaced and not is_front_door and not is_heritage_range` |
| **52** | Trickle Vent | `trickle` Wht | `frame_to_be_replaced and not is_front_door and not is_heritage_range and not is_sw` |

`is_sw` is `is_box_sash`, so on a casement `not is_sw` is true and rule 52
fires alongside rule 50; on a box sash only rule 50 does.

Step AV reported this as a probable defect and Step AX repeated it, reading
rule 52's `not is_sw` as the half of an exclusive pair whose other half (an
`and is_sw` on rule 50) had been forgotten.

**It is not a defect.** Nathan (13 Oct): the two are **different products** —
rule 50 is the slot vent (XR16) and rule 52 the vent **grille** — and a
casement is sold with both. Rule 52's `not is_sw` is doing exactly what it
should: keeping the grille off a box sash, which does not get one.

**Why this is recorded here:** the shared label makes the two lines look like
one line twice, and the obvious "fix" — adding `and is_sw` to rule 50 — would
silently stop charging for the grille on every casement GlazePro quotes. No
rule data was changed in Step AY and none should be.

---

## 7. A door's transom and its 62 mm fanlight rail are charged

**Date:** 13 October 2026
**Decided by:** Nathan Smith
**Code:** `src/pricing/doorGeometry.js` (`allocatedSectionParts`), Step AZ
**Asserted in:** `src/pricing/benchmarks/benchmarks.test.js` (Step AZ block)

**What differs:**

A door's timber is not a volume. Integrate allocates LENGTHS of utile stock
section and prices them per metre. On FD3 it allocates nothing at all for two
parts of the window, and Nathan charges for both.

**(a) The transom.** A doorset with a fanlight has a transom, 41 mm thick and
77 mm finished, 96 deep. Integrate allocates no section for it. GlazePro
charges **Utile67x96 for the internal frame width**:

| | |
|---|---|
| FD3 / FD3b | 1.256 m × £13.60 = **£17.08** |

**This is PROVISIONAL.** No listed stock section is big enough for a 77 × 96
finished transom — Utile67x96 is the largest of the five and is 67 × 96 — so
the section charged is the nearest thing on the list and not the real stock.
**The workshop has to confirm what a transom is actually cut from**, and the
price will change when they do.

**(b) A 62 mm fanlight bottom rail.** Integrate charges an **86 mm** fanlight
rail at Utile63x96 for the sash width (FD3: 1.254 m × £12.20 = £15.30). When
the same drawing's rail was changed to **62**, Integrate's 63×96 line
disappeared and **nothing replaced it** — the rail became free. GlazePro
charges it at **Utile63x63** for the sash width, as the 86 is charged at
63×96:

| | |
|---|---|
| FD3b | 1.254 m × £8.60 = **£10.78** |

Both land in `manufacture_materials` and nowhere else, which is why FD3 and
FD3b match Integrate on every other group:

| | Integrate | GlazePro | difference |
|---|---|---|---|
| FD1 | 2,819.53 | 2,819.53 | — exact |
| FD2 | 2,680.62 | 2,680.62 | — exact |
| FD3 | 3,058.66 | 3,075.74 | **+17.08** the transom |
| FD3b | 3,045.22 | 3,073.08 | **+27.86** the transom + the 62 rail |

**Why:**

A rail that is cut, machined and finished costs money whatever Integrate's
allocator says, and so does a transom. Charging nothing for them is a
straightforward undercharge on every doorset GlazePro quotes. The 62 mm rail
is also Nathan's own default for a new fanlight (difference 5), so it is the
rail GlazePro will cut most often — exactly the one Integrate charges nothing
for.

## 8. An Accoya door is priced on the utile sections

**Date:** 13 October 2026
**Decided by:** Nathan Smith
**Code:** `src/pricing/doorGeometry.js` (`DOOR_MATERIALS`), Step AZ

**What differs:**

Doors are sold in utile and Accoya only. Integrate has **no Accoya sections at
all**, so an Integrate Accoya door carries **no timber cost whatever** — a gap
in Integrate, not a target to match.

Until Nathan supplies Accoya section prices, GlazePro prices an Accoya door on
the **utile** per-metre costs. The section table is keyed by material, so an
Accoya column can be added as DATA later without changing any code:

```
DOOR_MATERIALS = {
  utile:  SECTION_PART_CODES,
  accoya: SECTION_PART_CODES,   // utile prices until Accoya ones exist
}
```

**Why:**

An Accoya door quoted with no timber at all is the worst of the three
options. Utile prices are the closest real figures available and are knowingly
wrong in a known direction — Accoya costs more — so a quote is short rather
than absurd, and the fix is a data change when the prices arrive.

---

## 9. A new French door starts with the espag set, not Integrate's Windsor handle

**Date:** 13 October 2026
**Decided by:** Nathan Smith
**Code:** none — a decision ABOUT the data. No `default_ironmongery` rule was
changed. Asserted in `src/drawingBoard/frenchDoor.test.js` and, with the
money, in `src/pricing/benchmarks/benchmarks.test.js` (Step AZ block).

**What differs:**

A French door built from the live "French Doors" template has **no stored
ironmongery list** (difference 4), so the default rules make it. They pick
`hardwick_lyndon_door_espag_set`. Integrate's own template stores
`windsor_inline_handle`:

| | GlazePro's default rule | Integrate's stored template |
|---|---|---|
| handle | `hardwick_lyndon_door_espag_set` **74.55** | Windsor Inline PB **16.80** |

**Why:**

Nathan (13 Oct): **the espag set is what a new French door should start
with.** The Windsor inline handle on Integrate's L31115 drawing is a
surveyor's choice on that job, not the default GlazePro should ship — a
template choice against a rule default, and the rule is the one to follow.

Benchmarks FD1–FD3b keep Integrate's **stored** list, because their job is to
reproduce Integrate's figures line for line. A door created on the live board
uses the rules, and is therefore dearer — see difference 10 for the total.

---

## 10. A door gets BOTH trickle vents, as a casement does

**Date:** 13 October 2026
**Decided by:** Nathan Smith
**Code:** none. No rule was changed. Asserted in
`src/drawingBoard/frenchDoor.test.js`.

**What differs:**

The same two rules as difference 6 — rule 50 the slot vent (`trickle_vent_xr16`)
and rule 52 the vent **grille** (`trickle`) — both fire on a door, because
rule 52's gate is `not is_sw` and a door is not a box sash. Integrate's
stored list has the slot vent only.

**Why:**

Nathan (13 Oct): **a door gets both, exactly as a casement does.** They are
two different products, and difference 6's reasoning applies unchanged. It is
recorded separately because Step AY decided it for a *casement* and Step AZ
only **reported** it for a door; this is the decision.

**The two decisions together, in money.** FD1 built from the live template
costs **£59.85 more** in `installation_materials` than Integrate's stored
list — and nothing else moves:

| | |
|---|---|
| the espag set | **+74.55** |
| less Integrate's Windsor inline handle | **−16.80** |
| the vent grille (difference 10) | **+2.10** |
| | **+59.85** |

| FD1 | `installation_materials` | total cost | price |
|---|---|---|---|
| Integrate's stored list (benchmark FD1) | 309.21 | 2,819.53 | 5,639.01 |
| GlazePro's default list (a live door) | **369.06** | **2,879.38** | **5,758.71** |

`manufacture_materials` stays 395.95 either way: the ironmongery list does not
touch the timber. These are the figures a live French door is re-priced
against after the Step AZ hotfix.

---

## 11. A doorset's frame mullions are charged, as its transom is

**Date:** 13 October 2026
**Decided by:** the reviewer, extending Nathan's decision of 13 October — **flagged
to Nathan for confirmation**
**Code:** `src/pricing/doorGeometry.js` (`allocatedSectionParts`), Step BA
**Asserted in:** `src/pricing/benchmarks/benchmarks.test.js` (Step BA block) and
pinned in `e2e/smoke.spec.js`

**What differs:**

A doorset's frame is divided by two full-height **mullions** and a full-width
**transom**. Integrate allocates **no stock section for any of them** — the same
gap as difference 7a, where it allocates nothing for a fanlight's transom.

Nathan decided on 13 Oct that GlazePro charges the transom at **Utile67x96 for
the internal frame width**. The reviewer applied the same decision to the
**mullions**, at Utile67x96 for the internal frame **height** each:

| FD5 / FD6 | |
|---|---|
| transom | 2,720 mm |
| mullions | 2 × 2,626 mm |
| | **7,972 mm × £13.60 = £108.42** |

So FD5 and FD6 match Integrate in every line and every group except
`manufacture_materials`, which is higher by exactly £108.42:

| | Integrate | GlazePro | difference |
|---|---|---|---|
| FD4 | 2,829.26 | 2,829.26 | — exact |
| FD5 | 4,597.23 | 4,705.65 | **+108.42** |
| FD6 | 5,088.75 | 5,197.17 | **+108.42** |

**Why:**

A mullion is cut, machined and finished exactly as a transom is, and charging
nothing for three of them on every doorset is the same undercharge in the same
place. Treating the transom as chargeable and the mullions as free would be the
harder thing to defend.

**This carries difference 7a's PROVISIONAL flag with it.** No listed stock
section is big enough for the 77 × 96 finished divider — Utile67x96 is the
largest of the five and is 67 × 96 — so the section charged is the nearest thing
on the list and not the real stock. **The workshop has to confirm what a mullion
and a transom are actually cut from**, and the price changes when they do.

**For Nathan:** this one is the reviewer's reading of a decision you made about
a transom, not a decision you made about mullions. If you want a doorset's
mullions left free, the change is to delete one loop in
`allocatedSectionParts` — and FD5 and FD6 then match Integrate exactly.

---

## 12. A flag frame is charged in full — timber, cill, architrave, workshop and fitting

**Date:** 13 October 2026
**Decided by:** Nathan Smith (decisions a, b, c and d)
**Code:** `src/pricing/doorGeometry.js` (`allocatedSectionParts`, per frame),
`src/pricing/partAllocator.js` (`wholeSetFrame`),
`src/pricing/pricingEngine.js` (a frame loop sees its own frame's counts), and
`sql/step-bc1-single-door-flag-frame-fitting.sql` for the fitting
**Asserted in:** `src/pricing/benchmarks/benchmarks.test.js` (Step BC block),
pinned in `e2e/smoke.spec.js`

**What differs:**

A single garden door can be sold with **flag frames** — half-height side
windows in frames of their own, coupled to the door frame. Integrate stores
them as one item holding several frames, and then charges for **almost none of
the extra work**:

| | Integrate | GlazePro |
|---|---|---|
| **a. flag frame timber** | one frame — the widths plus twice the door frame's height | **every frame's own** head, jambs and dividers |
| **a. flag frame cill** | the door frame's only | **every frame's own** |
| **b. architrave** | none at all on a container item | **one set round the whole set** |
| **d. workshop** | nothing per flag frame | **+180 min** a flag frame ("Machining & Joining a Casement Frame") |
| **c. fitting** | nothing — its own rule 140 is a 1-minute placeholder | **+240 min** per extra frame |

In money, on the four drawings the reviewer read (cost):

| | timber | cill | architrave | workshop | fitting | total | GlazePro |
|---|---|---|---|---|---|---|---|
| CD1 | +61.82 | +40.19 | +19.38 | +147.96 | +321.68 | **+591.03** | 3,615.09 |
| CD2 | +30.90 | +20.10 | +17.67 | +73.98 | +160.84 | **+303.49** | 2,725.06 |
| CD3 | +30.90 | +20.18 | +17.67 | +73.98 | +160.84 | **+303.57** | 2,725.52 |
| CD4 | +117.34 | +37.70 | +21.66 | +147.96 | +321.68 | **+646.34** | 4,855.69 |

**Why:**

A flag frame is a frame. It is machined, joined, finished, glazed, delivered
and fitted exactly as any other frame is, and its jambs, head and cill are cut
from the same stock. Integrate charging one frame's timber for three is not a
pricing decision anybody made — it is what its allocator happens to do — and
on CD1 it leaves **£591** of real work unpaid for.

**The architrave is the one that goes the other way.** Per frame it would be
three sets on CD1 (£34.49); round the whole set it is one (£19.38), which is
what a fitter actually puts up: head across the top of the set, two jambs down
its sides. The set's width carries the `-47` coupling overlaps, and the jambs
are the DOOR frame's height, because a flag light sits over a wall and its
jambs are not architraved to the floor.

**How each one is computed, so a figure can be checked:**

- **a** — each frame's `W + 2H` at Utile67x96 and its own width at Utile63x200,
  plus its own transoms and mullions (differences 7b and 11). CD1's 67x96 is
  `(693 + 2×1137) + (995 + 2×2101) + (693 + 2×1136) = 11,129 mm` against
  Integrate's 6,583.
- **b** — head `= the set's overall width + 100`, two jambs `= the door frame's
  height + 100`, through the same snap-up-to-10 / nearest-0.1 m rounding as a
  single frame. CD1: 2,387 → 2.4 m and 2,201 → 2.2 m ×2, at £2.85/m.
- **c** — live rule **140**, rewritten by `sql/step-bc1` from a 1-minute
  placeholder to `new_frame_qty - 1` × 240 min. It is the single-door twin of
  rule 14, which already charges a French door's winglight frames the same way.
- **d** — falls out of the frame loop seeing **its own** frame: a flag frame has
  no door leaf, so "Machining & Joining a Casement Frame" (`door_leaf_qty < 1`)
  fires on it, and the door frame still takes its own 855.

**Until `sql/step-bc1` is run**, decision **c** charges nothing: the four CD
benchmarks declare it as a PENDING decision, the benchmark page shows
"STILL TO COME: £321.68 …" on the row, and both figures are accepted so the
row is neither red today nor silent afterwards.

---

# Parked residuals

Added by Step AT (12 Oct 2026), under the small-differences policy in
`docs/handover-pricing.md`: a benchmark under **£1.00 cost** from Integrate with a
**plausible named cause** is logged here and the step carries on. The reviewer clears these
in batches.

These are **logged disagreements, not accepted ones**. Integrate's figures remain facts, and
nothing has been tuned to close any of them. A residual leaves this table only by being
explained — never by editing a target.

| Benchmark | Cost gap | Price gap | Suspected cause | Parked |
|---|---|---|---|---|
| **A50** | +£0.28 | +£0.42 | Top sash LEAD counterweight: GlazePro 17.6 kg against Integrate's 17.5 (before the Lead Weight rule's 15% wastage). `sashWeight.js` was calibrated to L34046 and the reviewer is obtaining Integrate's own weight calculation. Everything else on A50 matches. | 12 Oct 2026 |
| **D** | +£0.54 | +£0.80 | Double-box STEEL counterweights, two lines +0.54 between them. Same weight model as A50; a double box divides its weight per pair, so the two are expected to share one cause. | 12 Oct 2026 |
| **FD7** | +£0.62 | +£1.24 | A1’s GLASS AREA. FD7’s left panel is a direct glazed unit carrying Integrate’s hidden-0 template quirk: 588 x 2085 = 1.22598 m². GlazePro prices 1.23 (round half up, as every other glass line in every benchmark); Integrate prices 1.22 — and rounds its OWN D1 up, 1.29704 to 1.30, in the same drawing. 0.01 m² x 58.50 + 0.2 kg x 0.17 = 0.62. The reviewer to read Integrate’s glass panel for a hidden-0 unit; the FD5 A1 case was hidden by the 0.30 m² minimum. This is the ONLY unexplained figure in Step BB, and nothing has been tuned to close it. | 13 Oct 2026 |

Not parked, and still reported every step because each is over £1.00 or has a known fix
pending rather than an open question:

- **J–P −£14.70, Q/R/S −£8.40** — the four Kenrick gearbox parts carry `unit_cost 0` in
  `pf30-snapshot.json`. The reviewer's `sql/step-ap0-gearbox-part-costs.sql` is the data fix;
  the snapshot is a captured file, so the gap shows until a fresh one is taken.
- **B_UNCORRECTED −£25.46** — deliberate difference 1, not a residual at all: the fixture
  exists to record what Integrate charges before the correction.
