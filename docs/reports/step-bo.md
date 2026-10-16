# Step BO — pick ironmongery from the catalogue

Done 16 Oct 2026. Brief: `docs/step-bo-brief.md`.
Facts: `docs/integrate-live-quotes.txt` (the `ironmongerySet` on every LQ item) and
the brief's own two sets (L34265 item 9, L32520 item 9), plus the live catalogue
read through the Supabase read tools on 16 Oct.

Commits: `607b2d6` (item 0 — the BO and BP briefs, the reviewer's `strict` fix to
`sql/step-bm1-french-doors-flat-panels.sql`, `sql/reviewer-drawing105-flat-panels.sql`
and the Supabase read-only rule in CLAUDE.md), `a5c4b8e` (items 1 and 2),
`dc392e7` (item 4), and this report.

**SQL: none.** Nothing in the database had to change — every id in Integrate's
stored sets is already in the catalogue, with a cost (item 3 below).

Offline suite: **2,142 passing, 8 failing** — the standing eight (six Step W
sash-weight rows, A50 +£0.28, D +£0.54) and nothing else. 30 new tests.
`npm run e2e` against the deploy of `dc392e7`: **8 passed, 1 skipped** (the save
half — see item 4). Lint: no new problems (the same 13 pre-existing errors in
`DrawingBoard.jsx`, line for line). `npm run build` clean.

**The headline.** Entering Integrate's stored set makes the ironmongery EXACT,
on both sets the brief gives:

| set | lines | GlazePro | Integrate |
|---|---|---|---|
| L34265 item 9 (French casement) | 9 | 8.40, 8.40, 16.80, 8.40, 1.05, 1.05, 4.20, 8.40, 3.15 = **59.85** | the same nine amounts = **59.85** |
| L32520 item 9 / LQ8 (casement) | 9 | 7.35, 15.75, 3.15, 4.20, 2.10, 1.05, 1.05, 2.10, 3.15 = **39.90** | the same nine amounts = **39.90** |

So the brief's **+10.50 on L34265 item 9 was never a cost or a rounding
difference** — it was GlazePro pricing its own default set because the board had
no way to enter Integrate's. The order of the lines differs (Integrate lists the
set and then each kit) and carries no meaning; the amounts are the same to the
penny.

---

# How stored and default lines combine

Nothing about the PRICING of a stored set had to change: `resolveIronmongeryLines`
has let tree-saved lines win over the default rules since Step Z, and that is
exactly how Integrate prices `ironmongerySet`. What was missing was any way to
put a product into one. The board's "+ Add manual line" made a line with an
EMPTY product, which prices nothing at all.

The three sources, and what each step does to them:

| source | where it comes from | a stored set |
|---|---|---|
| **stored set** | `paintAndIronmongeryPart.values.ironmongeryLines` — the picker writes it | **replaces** the default lines entirely |
| **rule defaults** | the `default_ironmongery` rules (`defaultIronmonger`) | not used while a set is stored |
| **rule-allocated parts** | the part allocator, group `mpls_doors` — a door's MPLS keep and slave hardware | **unaffected**: still priced, on top of the set |

The third row is item 2's example, and it is now a test: FD1's allocated lock
lines are identical with and without a stored set
(`src/drawingBoard/ironmongerySet.test.js`, "a DOOR's rule-allocated lock parts
still come from the rules on top of the set").

**The breakdown says which is which**, in the label every breakdown already
shows (the benchmark page, the board's Price part, and the stored run, which
keeps it as `part_label`, so no new column and no SQL):

```
connoisseur_handle_lh (PB, item finish, stored set)
defender_friction_hinge_-_side_hung_310mm (PC, line finish, stored set)
trickle_vent_xr16 (Wht, rule finish, rule default)
MPLS Keep ... (rules)
```

The board says it too, twice: a banner over the lines table
(`data-testid="ironmongery-set-origin"`, `data-edited`) reading either "Stored
set — this item is priced with the lines below, exactly as they stand.
Rule-allocated parts … still come from the rules" or "Rule defaults — no set has
been chosen on this item", and a **From** column on each line reading `chosen` or
`rule default`.

---

# Item 1 — the picker

"+ Add line" (it was "+ Add manual line") opens a dialog over the ironmongery
catalogue — the same `ironmongery_products` the Ironmongery page edits:

* **search by name or code**, case-insensitive, over 630 live products;
* **grouped by category**, alphabetical, with **Uncategorised last**;
* **each product's unit cost**, per finish, in the dropdown (`PC — £7.82`) and
  again as the row's cost in the finish it will price in;
* **qty 1** on every added line, edited in the lines table as before;
* picking the **same product and finish twice bumps the qty** rather than
  storing two lines — Integrate's own sets hold one line per product with a qty
  (`kenrick_extension_950mm:PC x4`).

**What the picker will not offer**, with the reason, because both are big
numbers in the live catalogue:

* **193 of the 630 products have no `short_name`.** A stored line is keyed by
  `short_name` and nothing else, so such a product could never price. They are
  left out rather than offered and silently worthless.
* a product with **no costed, available variant** — nothing to cost.

**388 of the 630 have no category at all**, and they are the Integrate-imported
ones every stored set is made of (`connoisseur_handle_lh`, the defenders, the
Kenrick parts, the vents). They are grouped under **Uncategorised** and shown,
not hidden. If Nathan wants them filed, that is a catalogue job for the
Ironmongery page, not a code one.

## The finish, and the one case the picker ASKS about

| the product … | the line stores | why |
|---|---|---|
| exists in the **item finish** | nothing (follows the item, as a default line does) | the brief: "the finish defaults to the item finish" |
| has exactly **one** finish | **that finish, explicitly** | the Step AQ item 5 trap: the hinges, the gearbox and the extensions exist only in PC, so a line that followed a PB item would resolve to PB, find nothing and price **0.00** |
| has several, none of them the item's | **the picker asks** — "Choose a finish…", and Add stays disabled | a trickle vent is Wht or Blk on a PB item. Step Z's finding was that a guessed metal finish is a wrong price nobody sees (a guessed PB cost £26.25 where the drawing needed ABs at £36.75), so nothing is guessed |

Entering L34265 item 9 through those rules gives Integrate's own mix without
anyone choosing it: **PB handles, PC hinge / extensions / gear box, Wht vent**
(the vent being the one the picker asked about, answered with Integrate's Wht).

---

# Item 2 — an edited set is stored, priced as stored, and left alone

* The set is written as **one patch** — the lines plus a new
  `paintAndIronmongeryPart.values.ironmongerySetEdited` flag — so it is one
  entry in the drawing's history and the flag can never be saved without the
  lines it describes.
* **The panel's auto-apply is skipped once the set is edited.** This is the hole
  that mattered: auto-apply fires when the list is EMPTY, so a surveyor who
  deleted every line would have had the defaults put back the next time the
  panel opened. The flag means an empty set is still a chosen set.
* **A size change cannot touch it.** Nothing outside the panel writes
  `ironmongeryLines` — not the resize path, not the thickness path, not the
  opening-direction switch (checked across `src/drawingBoard/`) — and the test
  resizes a French casement in both axes and prices the same nine lines at the
  same money afterwards.
* **"Apply Defaults" now REPLACES the set**, after a confirm that names how many
  chosen lines will go ("This item's stored set has 3 chosen lines…"). Before
  this step it kept manual lines beside the fresh defaults, which is not "puts
  the rule defaults back". With no chosen lines there is nothing to lose and no
  confirm.

---

# Item 3 — catalogue gaps: there are none

Every id in Integrate's stored sets — all 17 distinct `id:finish` pairs across
`docs/integrate-live-quotes.txt` and the brief — exists live, active, with a
costed and available variant AND with every kit part present in
`parts_catalogue` with a cost. Read on 16 Oct with the Supabase read tools;
`unit_cost` is GlazePro's own, and the "cost" column below is the variant cost:

| id | finish | product | cost | kit parts |
|---|---|---|---|---|
| `102mm_hinges` | PB | 102mm Hinges | 7.04 | HHD681 7.04 |
| `connoisseur_handle_lh` | PB | Connoisseur Handle LH | 7.55 | RJZ6762 7.55 |
| `connoisseur_handle_rh` | PB | Connoisseur Handle RH | 7.55 | RJZ675 7.55 |
| `defender_209mm` | PC | Defender 209mm | 4.00 | RFH205 4.00 |
| `defender_412mm` | PC | Defender 412mm | 7.09 | RFH208 7.09 |
| `defender_615mm` | PC | Defender 615mm | 12.61 | RFH210 12.61 |
| `defender_friction_hinge_-_side_hung_310mm` | PC | Defender Friction Hinge - Side Hung 310mm | 7.82 | RFH203 7.82 |
| `double_euro_cylinder` | PB | Double Euro Cylinder | 19.60 | LJZ5064040PB 19.60 |
| `hardwick_lyndon_door_espag_set` | PB | Hardwick Lyndon Door Espag Set Sprung | 71.24 | HK3050PB 71.24 |
| `hardwick_lyndon_rh_locking_espag_handle` | PB | Hardwick Lyndon RH Locking Espag Handle | 14.87 | HK2051PB 14.87 |
| `kenrick_extension_490mm` | PC | Kenrick Extension 490mm | 1.10 | RJZ1703 1.10 |
| `kenrick_extension_690mm` | PC | Kenrick Extension 690mm | 1.57 | RJZ1704 1.57 |
| `kenrick_extension_950mm` | PC | Kenrick Extension 950mm | 2.07 | RJZ1705 2.07 |
| `kenrick_extension_gear_box` | PC | Kenrick Extension Gear Box | 7.35 | RJZ1700 3.89, RJZ1708 2.02, RJZ1709 0.72, RJZ1710 0.72 |
| `trickle` | Wht | Trickle Vent Grille | 1.75 | RHZ771 1.75 |
| `trickle_vent_xr16` | Wht | Trickle Vent XR16 | 3.25 | RHZ665 3.25 |
| `z-claw_fastener_kit_wpulleys` | PB | Claw Fastener Ironmongery Set with Pulleys | 25.20 | HKKS1075PB 25.20 |

The gear box is why a **six-product set shows nine lines**: it is a kit of four
parts, each of which prices its own "Ironmongery Cost" line — which is exactly
what Integrate's own nine lines are.

**The one real difference the sets show** is not a gap but a rule: on a French
casement at FR1's size, GlazePro's default rules pick the same six products at
the same quantities as L34265 item 9 **and add a seventh** — the Trickle Vent
Grille (`trickle`, Wht, £2.10). Integrate's set for that item does not hold it,
although its L32520 item 9 set does. That is £2.10 of the fixture's difference,
and entering the stored set removes it.

---

# Item 4 — the tests

New files:

* `src/drawingBoard/ironmongerySet.js` — the set's rules, pure, so they can be
  tested without the board: what the picker may offer, the finish rules, add /
  remove / qty / finish, the edited flag, `defaultsBack`, `setPatch`.
* `src/drawingBoard/ironmongerySet.test.js` — **22 tests**: the picker's rules;
  the edit rules; and the board path — a French casement built with
  `buildCasementFrame` + `changeOpening`, given L34265 item 9's set through the
  picker's own rules, pricing Integrate's nine lines; L32520 item 9 on the
  casement it belongs to; the breakdown's origin labels both ways; FD1's
  allocated lock parts undisturbed; a resize in both axes; and a save / load
  round trip through the same flatten / rebuild `drawing_parts` does.
* `src/pages/ironmongeryPanel.test.jsx` — **8 tests**: the panel renders "+ Add
  line" (and no longer "Add manual line"), says stored / rule defaults and
  marks each line, reads a hand-emptied set as edited, still renders for a
  caller that has not been given the new handler; and the picker renders the
  catalogue by category with its costs, asks for the ambiguous finish and
  leaves Add disabled until it is answered. This is the Step BJ lesson —
  Bi-Glass shipped unreachable because only the module was tested.
* `e2e/ironmongery-picker.spec.js` — the live step.

Changed: `src/pages/DrawingBoard.jsx` (the panel, the picker, the catalogue
load, `handleChangeIronmongerySet`), `src/pricing/loadPricingContext.js` and
`src/pricing/pricingEngine.js` (the origin), and one assertion in
`src/pricing/benchmarks/boardPath.test.js` — the breakdown label now also says
`rule default`, so the test asserting the label was updated to the new wording.

## The e2e step, and the one thing it does not do

The live step **adds a line through the picker and proves it is in the set**,
marked chosen, with the drawing saying Unsaved — then reloads WITHOUT saving and
proves nothing was written. It passed on the deploy of `dc392e7`.

**The save / reload half is SKIPPED unless `E2E_WRITE_DRAWING_ID` is set**, and
that is a decision, not an omission. This suite runs on every deploy against the
live site, the reviewer is about to compare installation materials on leads 11-15
line by line, and a step that failed half way through its own cleanup would
change exactly the data being compared. So the step writes only to a drawing the
reviewer nominates, and puts it back as it was found. Offline, the save / load
round trip is covered through the same `drawing_parts` flatten and rebuild the
app uses. **Set `E2E_WRITE_DRAWING_ID=<a drawing it is safe to save to>` in
`.env.e2e` and the step runs.** (Step BM made the same call on the same suite,
for the same reason.)

---

# Item 5 — benchmarks

**No benchmark moves.** The offline suite's eight failures are the standing
eight, at their standing amounts, and the live benchmark page still reads the
same: `npm run e2e`'s "every benchmark passes except the parked residuals"
passed against the new deploy. Nothing in this step changes a price — a stored
set was already priced as stored, and what is new is a way to enter one, a flag
that stops it being overwritten, and a word in a label.

---

# What the reviewer should enter live

1. **L34265 item 9** (lead 15, French casement) and **L32520 item 9** (lead 14,
   LQ8): the two sets in the brief, entered through "+ Add line". The vent will
   ask for its finish — answer **Wht**, as Integrate stores. Expect the nine
   ironmongery lines above, **exact**, and the breakdown to read "stored set" on
   each.
2. **L34242 items 1-8** (lead 11): the brief records the differences
   (−25.20, −4.26, −43.05, −16.80, −16.80, −34.65, +25.20, +42.00) but **not the
   sets** — they are not in `docs/integrate-live-quotes.txt` either. Read each
   item's `ironmongerySet` out of Integrate and enter it; if any id is not in
   the picker, it is a product the catalogue has never held and it should come
   back as a gap to fill (every id read so far is there).
3. Check the **From** column: a line entered through the picker reads `chosen`,
   and anything left from the defaults reads `rule default`. "Apply Defaults"
   should warn before replacing a set, and **changing a size should leave the
   set alone** — that is the one behaviour worth poking at by hand, because it
   is what would quietly cost money.
4. If the save half of the e2e step is wanted on every deploy, name the drawing
   (item 4 above).

Nothing waiting on Nathan except that drawing id.
