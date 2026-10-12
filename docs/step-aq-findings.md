# Step AQ findings — casement board fixes from the reviewer's live test

Written while doing `docs/step-aq-casement-board-fixes-brief.md`. The live
test was L507712 item 8, drawing 22, quote Q5 (reviewer, 12 Oct). Item 8 and
Q5 are untouched, as the brief asked.

Nothing here is tuned. Where I could not read something I say so.

---

## 1. Why Step AP's board-path tests missed a drawing that could not be saved

The client's only mirror of `part_type_children` was a hard-coded
`ALLOWED_PAIRS` set **inside `containment.test.js`**, a file that builds its
own hand-written trees and prices nothing. The Step AP board-path tests built
real board trees and priced them, but never consulted that list. So a direct
glazed unit could be built, drawn and priced while `save_drawing_parts`
refused it, and both test files passed.

The list is now `src/drawingBoard/containment.js`, imported by both, and
`expectSameAsFixture` runs `assertSaveable` on every board-path tree. Checked
by deleting `assemblyFramePart->glassPart` from the mirror again: K, L and M
then fail with the live error message.

**The same shape of gap existed for required fields** (item 8):
`findRequiredEmpty` was a local function in `DrawingBoard.jsx`, so no test
could call it. That is why "Product and Quantity empty" was invisible too.
It is now `src/drawingBoard/requiredFields.js`.

The general lesson: a check that only the page or only a test file can run is
a check the board-path tests cannot run, and the board-path tests are the
only place a surveyor's whole journey is exercised.

## 2. Why "Change to: Fixed casement" rebuilt the sash — and why no test caught it

`changeOpening` called `buildOpening` for **every** kind change, so making an
opening casement fixed built a brand new sash from the profile and discarded
the sections the sash had. B1 went from 62/62/62/83, 54 thick, clearance 4 to
94/94/94/47, 58 thick, clearance 2.

Fixed: a sash that is already a sash only changes its `operation`. It is the
same node, so a surveyor's own edits survive too. A direct glazed unit
becoming a casement still builds a new sash from the profile — there is no
sash to keep, the one case the brief sanctions.

**Why the Step AP tests passed:** they pass the profile values as a literal
map holding the right numbers (62/62/62/83, 54, 4), so the rebuild produced
sections identical to the original and was invisible. Only the LIVE profile
exposed it. The new tests therefore assert node **identity** and preserve
sections changed by hand — reverting the fix fails three of them.

### Where 94 / 47 / 58 / 2 come from — NOT RESOLVED, needs a reading

They come from the live casement profile, through the candidate key list in
`casementProfileDefaults`. That list resolves:

| value | first candidate key | live result |
|---|---|---|
| sash head | `casementSashPart.topHeight` | 94 |
| stiles | `casementSashPart.leftWidth` / `.rightWidth` | 94 |
| bottom rail | `casementSashPart.bottomHeight` | 47 |
| thickness | `casementSashPart.thickness` | 58 |
| clearance | `casementSashPart.mechanicalClearance` | 2 |

The Step AP brief recorded the casement profile as holding "thickness 54,
62/62/62, clearance 4, `defaultFanlightBottomHeight` 83 (Integrate's bottom
rail 83), **the flush and stormproof frame defaults**". Both readings cannot
be right about the same keys, so the generic `casementSashPart.*` keys hold
something else — most likely the stormproof set, given 94mm stiles and a 58mm
sash — and the flush values live under keys whose spelling is not in the
repository.

I did not guess at new candidate keys: guessing is what produced this. **The
question for the reviewer:** which profile field keys hold the FLUSH casement
sections? `sql/step-aq3` query 3a lists every `casementSashPart` definition,
which should answer it.

This only matters now for one path — a direct glazed unit changed into a
casement, which builds from the profile. Every other path keeps the sash it
has, and the templates carry the correct sections as stored values.

## 3. One key for the sash thickness

`thickness` everywhere, which is what the field definition, the property
panel, validation and Integrate use. `casementSashThicknessMm()` in
`casementGeometry.js` is the one reader and falls back to the old
`sashThickness`, so **L507712 item 8 keeps pricing correctly** — a saved
drawing is the surveyor's data and is not rewritten underneath them.
`sql/step-aq1` migrates the three templates only, scoped to
`family = 'casement'` so the box sash `sashPairPart.sashThickness` is
untouched.

**Two builder assertions were passing vacuously.** They compared the key on
the built sash with the key on the fixture; once both lost it, `undefined`
matched `undefined` and the test stayed green while the panel showed
Thickness blank. They now assert the value is 54 and that the old key is
gone.

## 4. The property panels

The board already excludes `role = 'config'` — the profile-setting role — so
the fix for "Default flush frame depth" and friends appearing as editable
inputs on a drawing is to **reclassify** them, not to filter in code. They
stay editable on Defaults & Parts, which loads every active definition for a
part type regardless of role. `sql/step-aq3` section 1 does it by pattern
(`field_key LIKE '%.default%'`, or a label starting "Update frame details"),
because the live field keys are not in the repository.

The mullion's blank thickness has the same cause from the other side: the
panel was offering the PROFILE's `thicknessInFrameHollow` /
`thicknessInFrameSolid` keys, which the part does not store. The part stores
`thicknessInFrame`, and `sql/step-aq3` adds a definition for exactly that.

Internal Frame Width / Height are read-only (`role = 'derived'`) and come
from `casementGeometry.js`, the module that prices them, so the panel cannot
disagree with the quote. K reads opening 549 × 1205, sash 541 × 1197, direct
glazed unit visible 509 × 1165 — Integrate's own figures.

Labels: `PART_LABELS` had no `casementSashPart`, so it showed raw. A direct
glazed unit showed "Glazing"; it now shows Integrate's "Direct Glazed Unit",
which needs the tree, because only a `glassPart` that is a **direct child of
the frame** is a unit.

## 5. The ironmongery finish rule, and the one case left alone

A default line now uses the item's ironmongery finish **where the product
exists in it** and the rule's own `finish_code` otherwise. That is Integrate's
mix — PB handles, PC hinges / gearbox / extensions — and it subsumes the old
`FIXED_FINISHES` list: a trickle vent exists only in Wht and Blk, so an item
finish of PB still falls back to the rule's Wht.

The default lists after the fix, all built through the real board code:

| | before | after |
|---|---|---|
| **K** (casement + direct glazed) | 13.65 | **26.25** |
| **N** (both opening) | 21.00 | **46.20** |
| **N** (B1 fixed) | 13.65 | **26.25** |
| **P** (1599 × 1599) | 48.30 | **52.50** |
| **L** (two direct glazed) | 5.25 | 5.25 |

K's lines in full: handle `connoisseur_handle_lh` PB 8.40, friction hinge
`defender_friction_hinge_-_side_hung_310mm` **PC** 8.40, gearbox
`kenrick_extension_gear_box` **PC** (see below), extensions
`kenrick_extension_950mm` **PC** ×2 4.20, vents `trickle_vent_xr16` Wht 3.15
and `trickle` Wht 2.10. N halves those quantities when B1 is fixed; L sells
no casement hardware at all. P takes six 76mm butt hinges instead of friction
hinges, which is Integrate's own size/weight branch.

**No "Ironmongery product not found" warnings remain.** The 0.00 lines that
are left are the four gear-box parts with `unit_cost 0` and
`properties.cost_unknown` — the known £14.70, which the reviewer's
`sql/step-ap0-gearbox-part-costs.sql` fixes. The warning text now correctly
names the part-cost problem rather than a missing product.

### The case I deliberately did not change

With **no item finish at all** there is nothing to follow, and the rule's own
finish must not be guessed. The claw fastener rule says **PB**; the real
drawing needed **ABs**; Step Z exists because the silent PB cost £26.25
against Integrate's £36.75. My first attempt used the rule's finish there and
broke two Step Z tests, which was the right thing for them to do. That path
still warns and prices nothing, with Step Z's two fixed non-metal finishes
kept so a white vent still prices. **The brief's rule does not define this
case** — flagging it rather than extending the rule by guesswork.

### A catalogue oddity, reported not fixed

`kenrick_excalibur_straight_extension_300mm:PB` **exists** with cost 3.82 but
an **empty parts list**, so on P it prices 4.20 correctly while allocating no
part at all. The PC variant has the part (RJZ2344). Treating "exists but has
no parts" as "does not exist" would have sent it to PC — but **30 of the
1,113 catalogue variants have no parts**, including ordinary products like
`claw_fastener:Blk` at 13.90, so that rule would divert real products on the
strength of a data gap. Left alone; it is a parts-mapping question.

## 6. Validation, summary, required fields

- Rules 59 / 60 are off by the reviewer's SQL. **No code change**, as the
  brief says.
- The Summary's Range row was the literal string `Box Sash` on every drawing.
  It now reads the drawing's own profile.
- Product and Quantity were set by nothing. Both are `is_required`, so a new
  casement drawing opened with two errors. `sql/step-aq2` sets them on the
  three templates and `buildCasementFrame` now sets Quantity 1 and takes a
  product code — otherwise the generator and the templates would disagree.
  The product CODES are not in the repository (the `product` list came from
  Integrate), so the script looks them up **by label** and raises with the
  query to run if a label does not match, rather than writing a code that
  would look set on screen and still fail the check.
- **The sash templates are not verified.** I cannot read the database, so
  `sql/step-aq2` query 3a reports Product and Quantity for every active
  template; a null in either column is the same error waiting to happen.
- The sash-only item fields are hidden on the casement profile. **The brief
  said to use the profile's `hidden_fields`, and that column is deprecated**:
  `sql/step-r1-field-visibility.sql` marked it "DEPRECATED ... Do not use" and
  the board reads `field_visibility`. Writing to `hidden_fields` alone would
  have changed nothing on screen, so the rows go to `field_visibility` as
  `hidden_always`, with `hidden_fields` filled too so the two cannot disagree.

## 7. The mullion picker

The dialog already took `initialCols` / `initialRows`; the caller never
passed them, so it always opened at "1 × 1 — 0 mullions".
`frameGrid(tree, frameKey)` now reports the grid the frame is on.

The reset was one `hover` state doing two jobs: the preview highlight and the
value Apply used. The choice is now `selected`, changed only by a click — and
a clicked cell applies its **own** coordinates, not the hover — while `hover`
is the preview and clears on mouse-leave, falling back to the selection.

Resizing is left as it is, as the brief directs, until the reviewer has read
what Integrate does.

## 8. What the tests show

Full suite: **1,266 passing, 8 failing** — exactly the standing eight,
unchanged by this step:

- **A50** top Lead Weight 17.6 against Integrate's 17.5
- **D** double-box steel counterweights, +0.54 and +0.80
- **six Step W** counterweight-display rows

No benchmark moved. The only figures that changed are K–P's default
ironmongery lists, reported in §5, which is the one exception the brief
allows. J–P still match their Step AO targets; the fixtures hold Integrate's
own stored ironmongery list, so the finish rule does not touch them.

New or changed tests: 5 in `containment.test.js`, 12 in `boardPath.test.js`,
5 in `gridActions.test.js`, 4 in `computeDerived.test.js`, 3 in
`defaultIronmongery.test.js` (and its trickle-vent test rewritten for the new
representation), and two vacuous assertions repaired in
`casementOpenings.test.js`.

`PRICING_ENGINE_VERSION` is **15** (item 5 changes real prices). It went to
14 at the end of Step AP for the mullion-length addendum.

## 9. Not verified

- **Nothing in the live database.** The three SQL files this step wrote have
  not been run; the anon key returns empty under RLS and empty is not
  missing. No claim here about the live site.
- **Whether the panels now show the right fields.** That depends on live
  field definitions I cannot read — `sql/step-aq3` queries 3a–3d are there to
  answer it.
- **Whether the product labels "Casement" and "Direct Glazed Unit" exist** in
  `reference_options`. The script raises with the query to run if not.
- **Whether `btm_rail_shape` is the right reference category** for Bottom
  Rail Shape (query 3d counts it; the stored value is `square`).
- **Which profile keys hold the flush casement sections** (§2).
- **The sash templates' Product and Quantity** (§6).
- **Integrate's resize behaviour** for mullions, still open from Step AP.
- `is_heritage_range` is still hard-coded `false`, so the heritage stay and
  fastener rules never fire.
