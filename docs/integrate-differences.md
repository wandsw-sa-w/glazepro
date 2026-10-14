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


---

## 13. A front door's leaf timber is charged — the muntin and the 120 mid rail

**Decided by:** Nathan's standing rule (13 Oct 2026) — *where Integrate omits door
timber, GlazePro charges for it*. Applied in Step BD to the two pieces of a front
door's leaf that Integrate allocates nothing for.

**Integrate's allocation on the three front doors** (drawings 16-18, read
13 Oct) is three lengths and no more:

| Section | What it covers | FT1 | FT2 | FT3 |
|---|---|---|---|---|
| 67x96  | frame head + both jambs, at the OVERALL size | 5463 | 6289 | 5497 |
| 63x200 | cill + leaf bottom rail + a **170** mid rail at leaf W − 10 | 3083 | 3083 | 2096 |
| 63x120 | each leaf's two stiles + top rail, **− 20** for an OPEN IN leaf | 5113 | 4995 | 5147 |

Three things are missing from it, and GlazePro charges all three:

- **the leaf's 120 MUNTIN** — at 63x120 for the leaf's interior height between
  the rails. FT1: 1788 mm × £17.30/m = **+£30.93**.
- **a 120 MID RAIL** — the arched door's. The 170 rail is in Integrate's 63x200
  length; the 120 is in nothing at all. At 63x120 for the leaf's interior width.
  FT3: 777 mm × £17.30/m = **+£13.44**.
- **the frame TRANSOM** under a fanlight, which is difference 7b already, at
  67x96 for the internal frame width. FT2: 1005 mm × £13.60/m = **+£13.67**.

All three are **PROVISIONAL** in the same way difference 7b is: no listed
section is obviously the right stock for a 120 muntin either, and the workshop
has to confirm what is actually cut. The amounts are declared on FT1, FT2 and
FT3 so the benchmark page reads **BY DESIGN** rather than FAIL.

**The −20 is a reading, not a decision.** An open-in leaf's 63x120 length is
2 × H + W − 20 where an open-OUT leaf's is − 6, on all three drawings. It is
recorded as `OPEN_IN_LEAF_SECTION_OFFSET_MM` beside the open-out one, with the
same warning: if a fourth drawing disagrees, this is the number to doubt.

## 14. A front door leaf's PANELS count towards its weight

**Decided by:** the only reading that fits all three front doors, Step BD.

"Any Door Overweight" charges 45 install minutes for a leaf over 50 kg, and
Integrate charges it on FT2 and FT3 but **not** on FT1 — the four-panel door,
which is the largest leaf of the three. So the panels cannot be heavy and
cannot be weightless:

| | leaf timber + glass | panel area | Integrate |
|---|---|---|---|
| **FT1** | 42.93 kg | 1.063 m² | UNDER 50 — no overweight |
| **FT2** | 48.81 kg | 0.480 m² | OVER 50 |
| **FT3** | 50.47 kg | 0.452 m² | OVER 50 |

FT1 brackets a panel at **at most 6.65 kg/m²** and FT2 at **at least 2.5**.
GlazePro uses **two 6 mm Tricoya skins at 510 kg/m³ = 6.1 kg/m²**
(`PANEL_KG_PER_M2`), a standard sheet and inside the bracket, which puts all
three doors on the right side of the line. A solid 56 mm panel would be
20.9 kg/m² and would make FT1 overweight, which Integrate says it is not.

**PROVISIONAL, and the figure to re-check first:** FT1 lands at 49.4 kg, six
hundred grams under the threshold. One reading of Integrate's own item weight
on a panelled door, or the workshop's panel build-up, settles it. The same
change also counts the leaf's **muntins and mid rails** as timber, which is not
a judgement at all — they are timber in the leaf, and they were missing.


---

## 15. A new front door's ironmongery, and the AV4 hand corrected

**Decided by:** Nathan, 14 Oct 2026
(`docs/integrate-L31115-front-doors.txt`, "Nathan's decisions, 14 Oct").
Applied to the live data by `sql/step-bd4`; the figures live in
`src/pricing/benchmarks/frontDoorIronmongery.js`, which the SQL, the tests and
this entry all read.

**a. What a NEW front door gets.** The imported default rules give a Hardwick
back-to-back euro cylinder pull (HK4000PB, £25.20). Nathan wants Integrate's
**Croft** pull (CRO1774PB, £29.40) — the one Integrate's own front-door
template stores. The rest of the live set is what he wants already:

| | Part | |
|---|---|---|
| 102mm_hinges PB × 2 | HHD681 | 14.70 |
| hardwick_classic_sleeved_letterbox PB | HK4350PB | 94.50 |
| **euro_cylinder_pull PB** | CRO1774PB | **29.40** |
| av3_heritage_locking_system PC | the AV4 set | 176.40 |

and there is **no letter tidy**, which is also what he asked for.

**What the £4.20 is against** (reviewer, 14 Oct): GlazePro’s PREVIOUS
default — the Hardwick back-to-back pull at £25.20 against the Croft one at
£29.40. It is **not** the difference from Integrate. A new GlazePro front
door’s ironmongery is **£315.00** where Integrate’s stored template list is
**£263.55**: **+£51.45** cost (+£102.90 price), and the whole of it is the
Hardwick sleeved **letterbox** (£94.50) standing where Integrate has a
premium letter tidy (£27.30) and a small letterplate (£15.75). That is the
decision, not a difference to be chased. No existing drawing moves, because
a drawing holds its own stored list.

**FT1–FT3 are not affected**: a benchmark carries Integrate's own stored
template list (hinges, the AV4 system, the Croft pull, a premium letter tidy
and a small letterplate = **£263.55**), because a benchmark's job is
Integrate's figures.

**b. The AV4 HAND is corrected, not copied.** Integrate prices RIGHT-hand AV4
parts on a LEFT-hand door — on all three of the reviewer's drawings — and the
import copied it: `av3_heritage_locking_system_lh` held the RH Heritage lock
(RHZ2482) and the RH centre keep w dayswitch (RHZ3092). Nathan's standing rule
is that GlazePro corrects Integrate's errors, so:

| Variant | holds |
|---|---|
| `av3_heritage_locking_system_lh` | **RHZ2481** Heritage Lock LH, **RHZ3091** LH Centre Keep w Dayswitch |
| `av3_heritage_locking_system_rh` | RHZ2482 Heritage Lock RH, RHZ3092 RH Centre Keep w Dayswitch |

The pocket keep (RHZ2427) is handed neither way and stays in both.

**NO PRICE MOVES.** `sql/step-bd1` gave both hands the same cost, so a front
door's ironmongery is £263.55 before and after, and
`src/pricing/frontDoorIronmongery.test.js` prices FT1 both ways to prove it
rather than assume it. `sql/step-bd4` SECTION 1b refuses to run at all if the
two hands ever cost different money.

What differs from Integrate after this is the **name on the line**, not the
money: a GlazePro quote lists the left-hand lock on a left-hand door and
Integrate lists the right-hand one.

---


---

## 16. Integrate's own door-production errors are corrected, not copied

**Decided by:** Nathan, 14 Oct 2026 (decision d), from the reviewer's reading
of Integrate's **Estimated Labour Time editor** (Production > Lookup Editor >
std_labour_time_new), which shows the rules it fires per item.

FT1's 2,670 minutes had been unexplained since Step BD. The editor shows why:

| Integrate fires | on FT1 | should be |
|---|---|---|
| 1240 "Additional for Flat Panel" 60 | 4 × 60 = 240 | **right** — type 110 is FLAT (corrected 14 Oct, difference 19) |
| 1245 "Additional for R&F Panel" 120 | never | **never** — these panels are not raised and fielded |
| 1235 "Door Muntin" 60 | 2 × 60 = 120 | 1 × 60 = **60** — the leaf has one muntin; Integrate counts its **mid rail** as a second |

Two errors, and on a four-panel door they do not cancel. GlazePro charges
**R&F 120 a panel** and **60 a REAL muntin** (''sash_muntin_to_be_replaced_qty''
is now the door leaves' own ''mullionPart'' children; a mid rail is not one):

- **FT1** 2,850 against Integrate's 2,670 — **+180 min, +£73.98**;
- **FT4** 4,085 against 3,905 — the same **+180**, from five panels and two
  mid rails;
- **FT2 and FT3 do not move.** FT3 is the case where the two errors cancel:
  Integrate's flat-panel 60 plus a mid-rail "muntin" 60 happens to equal
  GlazePro's R&F 120, so its 3,290 was right for the wrong reason, and still
  reads 3,290.

A **sash window** keeps the variable at 0 — a box sash's real glazing bars are
counted as ''gb_to_be_replaced_qty'', and the two "Real Glazing Bar" rules are
gated on ''is_sw'' / ''not is_door'', so a door's muntins can never reach them.

## 17. Shaped glass is billed on the sheet it is cut from

**Decided by:** Nathan, 14 Oct 2026 (decision e) — **all** shaped glass, a
door and an arched sash window alike.

A shaped unit is priced on the **LARGEST RECTANGLE of its cut glass plus 25%**
(the supplier's charge for cutting a shape out of a sheet), at the **SQUARE**
glass rate. Integrate does two things differently, and both are wrong:

- it prices the **exact shaped area** — and on FT3 even that is wrong, 0.62 m²
  where the shape measures 0.79;
- it moves the quarter onto the **RATE** (71.88 = the square rate's panes ×
  1.25) instead of the area.

| | was | now |
|---|---|---|
| **FT3**, the arched front door | 0.83 m² (GlazePro's exact shape) at 71.88 | **1.13 m²** (801 × 1127 of cut glass + 25%) at the square rate |
| **C**, the arched-head box sash | 0.32 m² at 71.88 and the bar surcharge at 44 | **0.43 m²** (750 × 460.5 + 25%), both lines |

The **energy surcharge is untouched**: its rule is
''(rounded_area × (inner + outer thickness)) × 2.5'' at 0.17, so it reads the
same billable area and follows it — FT3's 16.6 kg becomes 22.6, C's 6.4 becomes
8.6. That is the rule working as written, not a change to it.

The exact-shape model is **kept in the code** (''shapedGlassCutAreaM2'') and no
longer prices anything: it is the measurement of the glass, and the difference
between it and the bill is the supplier's charge.

**Two halves on the page.** The AREA is GlazePro's own (the engine), so it is
BY DESIGN today; the RATE is still Integrate's 71.88 until **''sql/step-be1''**
makes the shaped rule read the square rule's own expression. Until it runs,
each row carries the second half as PENDING — FT3 £15.11, C £5.75 — because
the quarter must not be charged on the area AND the rate.

## 18. A side light is a fixed casement sash, and its timber is a door's

**Decided by:** Nathan, 14 Oct 2026 (decision g, from his drawing 20), which
**replaces** decision c's "fixed door leaf".

A front door's side light is a **fixed casement sash** in the door frame,
holding the same grid a leaf does — a mid rail, glass above it and a
raised-and-fielded panel below — with its rail **lining up with the door's**.

Integrate allocates its timber like a **door's**, and GlazePro follows:

- the stiles and top rail at **63x63**, W + 2H with **no fanlight offset**
  (FT4: 4,517 mm, Integrate's own figure — a fanlight reads +14);
- the **175 bottom rail** from the same **63x200** as a door's bottom rail
  (359 mm), not from the 63x96 an 86 fanlight rail uses.

The rail depth is what tells the two apart: a fanlight's is 62 or 86, a side
light's is the door's 170-odd (''DOOR_DEPTH_RAIL_MM'').

**What GlazePro charges on FT4 that Integrate does not** (difference 11 and
13, recomputed): the frame **mullion** 2,085 mm at 67x96 = £28.36, the leaf's
**120 muntin** 1,788 mm and its **120 mid rail** 672 mm at 63x120 = £42.56.
Everything else on FT4 is Integrate's to the penny — its five Tricoya panels,
its glass at the 0.30 m² minimum, its fitting (840 + 120 a mullion + 120 a
fixed sash, and **no** "Combination Frame"), its ironmongery and its
components.

**The rails meet by arithmetic, not by a stored figure.** A divider's offset is
the span before it, so what is stored is the glass above the rail. The door's
rail stands ''bottom clearance + bottom rail + bottom panel'' above the opening
(14 + 170 + 635 = 819 on the Balham template); the sash drops 3 and has a 175
rail, so its panel must be 641 and its offset **1031**. Integrate's own drawing
20 instead makes the two **panels** equal (834 each) and leaves the rails 6 mm
apart; the reviewer asked for the rails to meet, so that is what the template
does and what the fixture (Integrate's tree) does not.


---

## 19. Integrate's panel type 110 is FLAT, and difference 16 was half wrong

**Corrected by:** the reviewer, 14 Oct 2026, reading Integrate's own
panel-type dialog (`docs/integrate-L31115-stable-doors.txt`):

    110 = FLAT    112 = RAISED & FIELDED    114 = VTG    116 = HTG

GlazePro mapped **110 to raised_and_fielded**. The id came from the
French-door facts of Step BA, which label it that way; Steps BD and BE
repeated it, and difference 16 called Integrate's "Additional for Flat Panel"
60 an error on that basis. It was not an error: **every Integrate door read so
far has FLAT panels**, and it is GlazePro that was charging R&F 120.

**What stands of difference 16:** the other half of Nathan's decision d —
"Door Muntin" is 60 per **real** muntin, and a leaf's **mid rail** is not one.
Integrate counts it, so GlazePro is now 60 minutes CHEAPER per mid rail:

| | GlazePro | Integrate | |
|---|---|---|---|
| **FT1** | 2,610 | 2,670 | −60, one mid rail |
| **FT2** | 2,710 | 2,770 | −60 |
| **FT3** | 3,230 | 3,290 | −60 |
| **FT4** | 3,785 | 3,905 | −120, two mid rails |

**Nathan (decision k):** GlazePro's door templates have **FLAT** panels, as
Integrate's do. `sql/step-bf1` re-issues all four front-door templates;
a drawing already saved with raised-and-fielded panels keeps them, which is
correct — it is what somebody drew.

**FD4 is the one row that cannot be settled from the facts.** Its panels read
110, so they now price flat — but FD4 matched Integrate **to the penny** while
GlazePro charged R&F 120 each, which it could only have done if Integrate
charged the 240 itself. Either FD4's panels are really type **112** and the
French-door facts' "110" is the same mislabel, or Integrate charged flat and
the old agreement was a coincidence of two errors. The fixture keeps what the
facts SAY and declares the −£49.32 as **PENDING a reading of FD4's panel
ids**: changing 110 to 112 to keep a green row would be tuning a fixture to a
guess.

## 20. A stable door's two halves are charged for their timber

**Decided by:** Nathan's standing rule — where Integrate omits door timber,
GlazePro charges it — applied in Step BF to the stable door (decisions h–k,
`docs/integrate-L31115-stable-doors.txt`).

Integrate allocates **nothing** for either half of a stable door. On all three
of the reviewer's drawings its only timber is the **cill** (63x200, 1099) and
the **frame** (67x96, W + 2H). GlazePro charges the halves as it charges any
door leaf:

| Section | What it covers | mm |
|---|---|---|
| 63x120 | each half's two stiles and top rail (2H + W − 20, the open-in offset) **and the top half's 99 MEETING rail** at the leaf width | 7,157 |
| 63x200 | Integrate's cill **plus the bottom half's 170 rail** | 2,096 (+997) |

= **+£152.73** on ST1, ST2 and ST3 alike, and it is the ONLY difference on any
of them: production, fitting, glass, the Tricoya panels and the ironmongery
are Integrate's exactly.

**A new rule came out of this, and it tidies three older readings.** A rail is
cut from the **smallest stock section it fits in** (`railSectionFor`):

| rail | section | |
|---|---|---|
| 62 (Nathan's fanlight) | 63x63 | difference 7a |
| 86 (Integrate's fanlight) | 63x96 | |
| **99 (a stable meeting rail)** | **63x120** | 96 is too narrow for 99 |
| 163 / 170 (a door leaf) | 63x200 | |
| 175 (a side light) | 63x200 | difference 18 |

Before this, the rule was a pair of thresholds that happened to fit the
readings taken; now it is one sentence that reproduces all of them, and the
99 rail is the first one that needed it.

**PROVISIONAL**, as every door-timber charge is: the sections are a door
leaf's, and the workshop has to confirm what is actually cut for a stable
door.

# Open questions

**Not parked, and not decided.** The parked table below is for differences
under **£1.00** — the small-differences policy in `docs/handover-pricing.md`.
A difference OVER £1.00 that nobody has explained does not belong there, and
must not borrow the word "parked" (reviewer, 14 Oct). It is listed here with
its amount, it is declared on its benchmark so the figure cannot drift, and
the benchmark page says **OPEN QUESTION** on the row in as many words.

**None open.** FT3’s shaped glass was closed by Nathan on 14 Oct (difference
17) and FD4’s panel ids were re-read the same day (difference 19) — both are
declared decisions now. The section stays because the next open figure
belongs here rather than in the parked table.

| Benchmark | Cost gap | Price gap | What is not understood | Opened |
|---|---|---|---|---|

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

- ~~**J–P −£14.70, Q/R/S −£8.40** — the four Kenrick gearbox parts carry `unit_cost 0` in
  `pf30-snapshot.json`.~~ **CLOSED 13 Oct 2026** (Step BC follow-up). The reviewer's
  `sql/step-ap0-gearbox-part-costs.sql` had already been run live; the snapshot refreshed
  after `sql/step-bc1` carries the costed parts (kenrick_extension_gear_box PC: RJZ1710 0.72,
  RJZ1709 0.72, RJZ1708 2.02, RJZ1700 3.89), and **J, P, Q, R and S are now exact to the penny**
  offline. Nothing was tuned — the captured data caught up with the live data.
- **B_UNCORRECTED −£25.46** — deliberate difference 1, not a residual at all: the fixture
  exists to record what Integrate charges before the correction.
