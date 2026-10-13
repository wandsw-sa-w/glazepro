# Step BA — French door variants: panels, side lights, top lights, casement lights

Done 13 Oct 2026. Brief: `docs/step-ba-french-door-variants-brief.md`.
Facts: `docs/integrate-L31115-french-doors.txt`, "French door variants" section
(L31115 item 10 drawings 4, 5 and 6, read 13 Oct 2026).

**No new pricing RULE**, and no pricing rule, profile value or benchmark target
was changed. **No pricing engine version bump** — the engine is still 16. Every
FD4–FD6 figure comes out of rules GlazePro already had; what was missing was the
tree, the panel variables and the section allocation, exactly as the brief said.

**I ran no SQL.** `sql/step-ba1` and `sql/step-ba2` are for the reviewer, each
with a SECTION 0 of read-only checks and a `DO NOT RUN` rollback.

Commits: `bd047b8` the facts and targets, `b3bfd46` the engine, `67e2d4c` the
board and the SQL, and this report.

---

## 0. The facts and the three targets

**Files:** `docs/integrate-L31115-french-doors.txt`,
`src/pricing/benchmarks/integrate-targets.json`,
`docs/step-ba-french-door-variants-brief.md` — committed as recorded (`bd047b8`)
before any work on them. `benchmarkFD4`, `benchmarkFD5` and `benchmarkFD6` are
the reviewer's, unedited, and no target has been touched since.

## 1. FD4 — panelled leaves (Integrate template 79)

**Files:** `src/pricing/doorGeometry.js`, `src/pricing/computeVariables.js`,
`src/pricing/pricingEngine.js`, `src/pricing/optionVocabulary.js`,
`src/drawingBoard/doorOpenings.js`, `src/drawingBoard/containment.js`,
`src/pages/DrawingBoard.jsx`, `src/pricing/benchmarks/fixtureDoor.js`.

**FD4 is EXACT: every line, every group, both hour totals.**

| FD4 | Integrate | GlazePro |
|---|---|---|
| cost | 2,829.26 | **2,829.26** |
| price | 5,658.44 | **5,658.44** |
| production | 59.42 h | **59.42 h** |
| labour | 13.00 h | **13.00 h** |

### The mid rail, modelled as a divider — which is what it is

The brief asked how. **Integrate stores a leaf's mid rail as a `TransomPart`
inside the LEAF** with `isMidrail` true, 170 thick. That is a divider in a leaf
exactly as a frame transom is a divider in a frame, so GlazePro stores it the
same way and the existing divider convention carries it: **`offset` is the
opening above the rail** — the glass — and what is left below it is the panel.
Nothing new was invented, and `frameRows`-style layout code was not needed
because a leaf has one divider and two openings.

FD4's arithmetic, which is Integrate's own:

```
leaf 2109 - head 110 - bottom rail 163 = 1836 = glass 1241 + rail 170 + panel 425
```

Three things followed from it:

- **`doorGlassSightline` stops the glass at the rail.** Without it the glass ran
  the full 1836 and priced 107.72 against Integrate's 73.06 — a third more glass
  than the door has.
- **`doorPanelSize` is the new geometry:** the sightline width by what is left
  below the rail. 442.5 × 425, which the live "Tricoya Panel" rule prices
  **unrounded** (0.1880625 m² × 188.85 = 35.52 a panel).
- **A mid rail is NOT a frame transom.** `frame_transom_qty` counted every
  `transomPart` in the tree, so FD4's two leaf rails charged "Additional for
  Frame Mullion or Transom" 180 × 2 and "Door Frame – Single Finish (Mullions)"
  85 × 2 — **530 minutes of frame work on a frame with no dividers at all**.
  Both counts are now the frame's own children, and `leaf_mid_rail_qty` reports
  the rest.

### The panel loop had no variables

The live `panel` loop visited `panelPart` and **every rule on it read
undefined**: `panel_qty` was hard-coded 0 and no panel part variables existed.
Panels now carry their visible size (`visible_width_in_mm_old` — Integrate's own
name for it, not a stale copy), the five panel-type flags, the dual-panel
comparison and the two bolection flags.

`panel_in_frame_qty` is the **frame's own** panels, which is what "Panel to
Frame" (80 min) charges for fitting. A panel in a leaf is made with the leaf, so
FD4's two must not reach it — and the facts' production reconciles to FD1's
3,325 + 2 × 120 and nothing else, which is the proof.

### The panel options — the one thing I could not confirm

The brief asked to confirm Integrate's ids 110 / 120 against `reference_options`.
**I could not: `claude_readonly_query` admits only Nathan's login.** What I did
instead:

- the ids are confirmed as *Integrate's* from
  `docs/integrate-drawingboard-schema.txt` (`internalPanelTypeId` default **110**,
  `internalPanelBeadId` default **120**) and from FD4's own stored panels;
- `optionVocabulary.js` maps **both** Integrate's numeric ids and GlazePro's
  codes (`raised_and_fielded`, `ovolo`) to the same flags, so a tree imported
  from Integrate prices exactly as one the board drew;
- **SECTION 0 of both SQL files asks for the rows** (`category IN ('panel_type',
  'panel_bead')`). The panels price either way; without those rows the board's
  panel panel has nothing to pick from, which is a board gap, not a pricing one.

### The sections

The mid rail is cut from **Utile63x200 at leaf width − 10**, commented as the
single reading it is. FD4: cill 1399 + bottom rails 2 × 662.5 + mid rails
2 × 652.5 = **4029**, which is Integrate's figure.

## 2. FD5 / FD6 — the doorsets (templates 29 and 46)

**Files:** as above, plus `e2e/smoke.spec.js` and
`docs/integrate-differences.md`.

**Both match Integrate in every line and every group except
`manufacture_materials`, which is higher by exactly £108.42** — the frame
mullions and transom (difference 11, below).

| | Integrate | GlazePro | |
|---|---|---|---|
| FD5 | 4,597.23 | 4,705.65 | +108.42 |
| FD6 | 5,088.75 | 5,197.17 | +108.42 |
| FD5 production / labour | 99.58 / 24.25 h | **exact** | |
| FD6 production / labour | 116.33 / 24.50 h | **exact** | |

**Almost all of this fell out of the casement divider model untouched** (Step AV)
— the columns and rows, the cell labels, the pair as just another opening kind,
the direct glazed units, `is_fanlight` per sash. What this step added was the
mullion sections and the tree.

### Every rule in the facts' reconciliations, as it fires

The brief asked for each one checked. Minutes, from the snapshot:

| Rule | FD4 | FD5 | FD6 | Facts |
|---|---|---|---|---|
| Door Leaf (per leaf) | 2,070 | 2,070 | 2,070 | 2 × 1,035 |
| Machining & Joining a Door Frame | 855 | 855 | 855 | 855 |
| Door Frame – Single Finish | 180 | 180 | 180 | 180 |
| **Door Frame – Single Finish (Mullions)** | 0 | **255** | **255** | 85 × 3 |
| Door Leaf – Single Finish | 180 | 180 | 180 | 2 × 90 |
| **Additional for Frame Mullion or Transom** | 0 | **540** | **540** | 180 × 3 |
| Glazing a Sash | 40 | 140 | 140 | 20 × units |
| Casement Sash – Single Finish | 0 | 120 | 300 | 60 × sashes |
| **Sidelights in Doorsets** | 0 | **1,560** | **1,560** | 780 × 2 |
| **Fanlights in Doorsets** | 0 | 0 | **900** | 300 × 3 |
| **Frame with Doors/Casements and Direct Glazed** | 0 | **75** | 0 | 75 |
| **Additional for R&F Panel** | **240** | 0 | 0 | 120 × 2 |
| Panel to Frame | **0** | 0 | 0 | must not fire |
| French Doors (install) | 780 | 780 | 780 | 780 |
| **Door Direct Glazed Unit** | 0 | **135** | 0 | 45 × 3 |
| **1.75sqm Direct Glazed Unit in Frame (Small)** | 0 | **210** | 0 | 70 × 3 |
| **Fixed Fanlight** | 0 | **240** | **600** | 120 × 2, 120 × 5 |
| **Any Sash Overweight (Casement)** | 0 | **90** | **90** | 45 × 2 |

Every one as the facts list it. **A sash beside the door is a side light and one
above the transom is a fanlight**, decided per sash by `is_fanlight` — 780
against 300, and the whole of why FD6's production is 16.75 h more than FD5's.
`openingTypeLabel` already drew that line (top row, more than one row, not
spanning) and needed no change.

### The sections

Side lights and fanlights go through the existing fanlight rule (63x63 at
W + 2H + 14; the 86 rail at 63x96 for the sash width). FD5's 63x63 **9859** and
63x96 **1295**, FD6's **15203** and **3927** — all Integrate's own figures, to
the millimetre, with no new code.

## 3. The templates (SQL — the reviewer runs them)

`sql/step-ba2` writes three templates into group **"Open Out Doors"**, family
`door`, profile `open_out_doors`, product French Door, **no stored ironmongery
and no stored surround**, trees generated by the board's own code:

| | Integrate | Size |
|---|---|---|
| French Doors With Panels | 79 | 1399 × 2199 |
| French Doors With Side And Top Lights | 29 | 2814 × 2710, direct glazed top lights |
| French Door Set With Casement Lights | 46 | 2814 × 2710 |

**The mullions are symmetrical, and here is what I chose.** Integrate's template
29 has side columns of **648 and 651** — a 3 mm difference nobody drew on
purpose. The board splits what is left after the middle opening equally and puts
the odd millimetre in the **middle**, where it cannot be seen:

```
internal 2720 = 649 + 41 + 1340 + 41 + 649      (Integrate: 648 + 41 + 1339 + 41 + 651)
```

So each side light is **647 × 2134** against Integrate's 646 and 649, and each
leaf **680** against 679.5. **These are the only numbers in this step that do not
match Integrate**, and they differ because the template was deliberately changed,
not because anything miscalculated — the FD5/FD6 *fixtures* keep Integrate's own
648 / 1339 / 651 and match it exactly.

Also chosen, and said out loud:

- **the top-row fanlights take Nathan's 62 bottom rail** (difference 5), the two
  side lights keep Integrate's **86**, which is what its templates draw and what
  the benchmarks price. On template 46 that moves three rails from Utile63x96 to
  Utile63x63 (difference 7b);
- **one full-width cill**, as GlazePro does for casements — Integrate stores
  three (648 / 1339 / 651) but prices the full width anyway;
- the direct glazed units take 15 mm clearance and **12 mm** hidden in the
  rebate on all three. Integrate's own A1 stores hidden **0**; the FD5 fixture
  keeps that quirk because a fixture's job is Integrate's figures, and the
  template does not copy it.

**Containment was missing**, and `assertSaveable` named the four pairs itself:
`leftFrenchDoorLeafPart->transomPart`, `->panelPart` and both for the right leaf.
`sql/step-ba1` adds them, max 1 each. No new part type was needed —
`panelPart` and `transomPart` both already exist.

## 4. The board

- **`buildPanelledFrenchDoorFrame`** — template 79's drawing. The rail's position
  is computed from the **panel** being 425 deep, which is what a surveyor thinks
  in; Integrate stores the glass above it instead and lets the panel absorb a
  resize. At template 79's own size the two agree exactly, so a template built
  at any other size starts with a sensible panel rather than a sensible pane of
  glass. A later resize keeps the stored offset, as Integrate's does.
- **`setLeafMidRail`** — one action for the three things a surveyor does to a
  panelled leaf: add a rail and a panel, move the rail, take both away. The
  panel node is **kept across a move**, with its options. Wired into the leaf's
  property panel as "Mid rail and panel", editing the panel height; removal also
  works through the board's existing Remove, which already handles a
  `transomPart`.
- **`buildFrenchDoorSetFrame`** — templates 29 and 46, `topRow` choosing direct
  glazed units or fanlights.

## SQL files this step wrote, in run order

**Neither has been run.** Each leads with a SECTION 0 of read-only queries and
ends with a commented `DO NOT RUN` rollback.

1. `sql/step-ba1-door-variant-containment.sql` — the four containment pairs a
   panelled leaf needs (mid rail and panel, both leaves). **Run first**:
   `save_drawing_parts` rejects a tree whose pairs it does not know, so the
   panelled template would fail to save even though the board built it
   correctly.
2. `sql/step-ba2-door-variant-templates.sql` — Integrate's templates 79, 29 and
   46. **Refuses to run** if ba1 has not, or if the Utile sections are missing.

Both ask, in SECTION 0, whether `reference_options` holds `panel_type` and
`panel_bead`.

## What the tests show

**Offline: 1,598 passing, 8 failing — the standing eight, unchanged.**
`npx vitest run`, 72 files, **28 new tests**. No benchmark moved: FD1–FD3b still
match Integrate to the penny, and the eight are the same ones every step since
AY has carried — six `sashWeight.test.js` Step W rows and the two parked
residuals (**A50** +£0.28, **D** +£0.54). Vitest also reports `e2e/smoke.spec.js`
as a failed *file*: a Playwright spec it collects and cannot run, pre-existing
since Step AT.

The new tests, in two places:

- `benchmarks.test.js` (Step BA block, 18 tests): the groups and hours for all
  three, FD4 exact on every line, the mid-rail geometry, the glass area, the
  panel rules and their 0.1880625 m², the mid-rail and mullion sections, the
  doorset grid, side light against fanlight, and that a doorset prices no timber
  volume at all.
- `frenchDoor.test.js` (10 more): each template built from the board's own code
  through `assertSaveable` and `findRequiredEmpty`, the add / move / remove
  action, the symmetrical columns, and the board's trees priced against the
  fixtures line for line.

**Live: 5 of 5 passed (53.9s)**, against the deploy of `67e2d4c` —
`/version.json` reads `mv6yol70`, built 2026-10-13 18:35:13 BST:

```
ok 1 logs in (4.5s)
ok 2 every benchmark passes except the parked residuals (40.5s)
ok 3 the fanlight drawing shows Fanlight A1 and Casement Sash A2 (2.2s)
ok 4 the validation panel loads without an error (2.9s)
ok 5 every drawing card on the L507712 quote matrix shows a price (3.1s)
```

Test 2 now asserts **all seven** door benchmarks are on the page and pins
FD5/FD6 at +108.42 as it pins FD3 and FD3b. Since the Step AZ hotfix inverted
the page's cost map, a row passing there also means the live catalogue holds
every part it prices — so FD4–FD6 passing live is the first confirmation that
the Utile sections cover the variants too.

## Not verified against the live database

- **Neither SQL file has been run**, so the three templates and the panelled-leaf
  containment exist **only as files**. Until ba1 runs, a panelled door cannot be
  SAVED on the live site — the board builds it and `save_drawing_parts` refuses
  it. Nothing else in this step depends on the SQL: the pricing, the benchmark
  page and the geometry are all live already.
- **`reference_options` for `panel_type` and `panel_bead`** — see item 1. The
  single open question of this step.
- **No field definitions were written for a panel or a mid rail.** The brief did
  not ask for them and Integrate's own panel panel is not in the facts, so the
  board shows a panel's own properties through the generic editor. A step like
  AZ-4 would be needed to label and order them; it is not in this one.
- **All offline figures come from `pf30-snapshot.json`**, a captured file. No
  FD4–FD6 line touches the four Kenrick gearbox parts that carry `unit_cost 0`
  in it.
- **The live drawings 4, 5 and 6 have not been re-priced in GlazePro** — there
  are no GlazePro drawings for them. The benchmark page is the comparison.

## Anything that did not behave as the brief describes

- **Difference 11 is the reviewer's decision, not Nathan's, and is recorded as
  such.** The brief applies Nathan's transom decision to a doorset's frame
  MULLIONS "for consistency — flagged to Nathan". It is now difference 11 in
  `docs/integrate-differences.md`, with the £108.42 arithmetic, the PROVISIONAL
  flag it inherits from 7a (no listed section fits a 77 × 96 divider), and the
  exact one-loop change that would undo it if Nathan wants mullions left free.
  **FD5 and FD6 would then match Integrate exactly.**
- **The symmetrical mullions change the drawing**, by 1–2 mm per light. Called
  out in item 3 rather than buried: it is a deliberate departure from the
  template that was read, and it is the only number in the step that does not
  match Integrate.
- **FD5's column labels differ from Integrate's.** GlazePro labels columns A / B
  / C, so the third column's parts are C1 and C2; Integrate calls them D1 and D2,
  because its pair occupies B and C. Cosmetic, no pricing effect, and not worth
  changing GlazePro's labelling for — but a reviewer comparing screens should
  know.
- **Three pre-existing eslint `no-unused-vars` errors** in `DrawingBoard.jsx`
  and `benchmarks.test.js` were left alone; the error count is unchanged from
  `HEAD` before this work (verified).
- `public/version.json` is left uncommitted on purpose, as CLAUDE.md says.
