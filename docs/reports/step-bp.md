# Step BP — mid rails, panels and muntins inside casement sashes and door leaves

Done 16 Oct 2026. Brief: `docs/step-bp-brief.md` (with the reviewer notes).
Facts: `docs/integrate-drawing-gaps.txt` sections 1 and 2 (G1–G4, M1–M2) and
section 5 (P1); `docs/step-bm-correction.md` (110 = FLAT; "Door Muntin" counts
mid rails).

Commits: `428f7cb` (item 0, the brief), `af1d7a4` (items 0-extra, 1, 2, 3),
`213a3e2` (item 4, the four benchmarks), and the commit carrying this report
with an e2e fix and `sql/step-bp1`.

**SQL: no template change.** No template needed a new part — the controls
act on parts every drawing already has. One housekeeping file for the
reviewer, `sql/step-bp1-drawing117-picker-residue.sql` (see "The e2e").

Offline suite: **2,287 passing, 8 failing** — the standing eight and nothing
else. 36 new tests (`sashGrids.test.js` 12, `panelOptionField.test.jsx` 5,
`gridBenchmarks.test.js` 11, and the four fixtures in the every-fixture
persistence check). `npm run e2e` against the deploy of `213a3e2`: **9
passed, 1 failed** — the benchmark page reads every row as expected with the
four new ones BY DESIGN; the failure was the Step BO save step's own cleanup
selector (fixed in this commit; the final run is recorded at the end). Lint:
nothing new. `npm run build` clean.

**Every existing Integrate benchmark is unchanged** — FD4 included. Two of
the board's OWN template prices moved by a reading this step took (below).

---

# The board controls

All on the part's panel, through the functions `src/drawingBoard/doorOpenings.js`
exports, which is where the tests drive them.

| control | where | what it does |
|---|---|---|
| **Add mid rail and panel** · Panel *n* · **Rail** *n* · Remove | any **casement sash** or door leaf | A transom inside the sash (`isMidrail`), glass above, a flat / ovolo panel below. The panel height and the rail's own thickness are typed — 170 on G1 / G3, 200 on G4. Remove puts the glass back over the whole opening, codes intact. |
| **This cell: Tricoya panel / Glass** | a glass unit or a panel in any grid holder | On a casement sash's single cell it makes the sash ALL panel (G2's A2 / B2) and back. |
| **Muntin: None / Full height / Below the mid rail / Above the mid rail** · Thick *n* | a door leaf (or a sash) with one mid rail or none | Full height is M2 (two glass over two panels); Below is M1 (one glass over two panels). 120 thick by default, centred. Each cell the muntin makes takes the kind of the cell it split; a surviving cell keeps its node. |
| **Panel layout** Across / Down | any grid holder | As Step BD, now on casement sashes too. |
| **Internal / External panel type** · **bead** | every **panelPart** | Dropdowns of Integrate's lists: Flat (110), Raised & fielded (112), Vertical T&G (114), Horizontal T&G (116); Ovolo (120), Bolection (126), Bespoke (320). A stored id or a code selects the same entry. **Null reads "— select —"** with a note. |

**How it is stored** — Integrate's own shapes, so a tree read from an
Integrate dump means the same thing:

* a mid rail is a `transomPart` child of the sash or leaf with `isMidrail`,
  `offset` (the glass above) and `thicknessInFrame` / `midrailThickness`;
* a muntin is a `mullionPart` child with `isMuntin`; a CONFINED one names the
  mid rail it starts at (`startDivider`, below) or ends at (`endDivider`,
  above) — exactly how Integrate stores M1's;
* `leafCells` takes each row's columns from the muntins that span it, so a
  full-height muntin makes the grid it always did and **no existing cell is
  changed** (FT1–FT4, FD4, the stable doors and the templates all read the
  same cells).

**Null panel options price as flat / ovolo** (the reviewer asked to be told
if not): the engine maps an unset or unknown type to `flat` and an unset bead
to `ovolo` before the rules see them, so "Additional for Flat Panel" fires and
no bolection moulding does. Drawing 105's blanked panel therefore prices
correctly even before anyone sets it. And bead **126 had no mapping at all**
until this step — a bolection bead stored by its Integrate id priced no
moulding; it does now (G4 / FT5).

---

# The benchmarks, group by group

Integrate's cost per group, GlazePro's, and what any difference is. "exact"
means to the penny. The declared amounts are on each fixture and pinned by
the live smoke test, so none can drift.

## DG1 = G1 — L34242 item 8, French doors with side casements over panels

| group | Integrate | GlazePro | |
|---|---|---|---|
| glass | 188.18 | 188.18 | exact — 0.78 / 0.74 / 0.74 / 0.78 m², the glass stops at each rail |
| installation | 331.53 | 331.53 | exact — the stored set, and the allocated lock parts incl. the taller leaves' **Winkhaus FAB Shootbolt 541** (RHZ1654, 36.45 → 37.80) |
| manufacture | 2,488.69 | 2,488.69 | exact — **100.92 h**: Door Muntin 4 × 60 (two leaf rails, two side casement rails), Flat Panel 4 × 60, Sidelights 2 × 780 … every line |
| labour | 743.89 | 743.89 | exact — 18.50 h |
| materials | 844.76 | 897.56 | +58.37 BY DESIGN (the two frame mullions, difference 11); **−5.57 OPEN** (below) |
| **total** | **4,597.05** | 4,649.85 | +52.80 declared |

The four Tricoya panels are 47.93 / 47.76 / 47.76 / 47.93 — Integrate's own
pennies. The Utile sections: 63x120 10.11 m exact; 63x63 9.98 m exact once an
open-out fixed casement's stiles take the fanlight's +14 (difference 23);
63x200 is where the question is: Integrate's 9.13 m is 190 mm more than the
cill, the four bottom rails, the two leaf mid rails and the two side casement
mid rails cut at the sash width less 10 give. Whether Integrate cuts a
casement's mid rail at the door leaf's own 772 or at the opening plus its two
mullions (both 772) cannot be told from one reading.

## DG2 = G2 — L34242 item 7, a single door beside two casements over two all-panel casements

| group | Integrate | GlazePro | |
|---|---|---|---|
| glass | 149.19 | 149.19 | exact — 0.61 / 0.61 / 1.19 m² |
| installation | 255.56 | 255.56 | exact — the ten-product stored set and the lock |
| manufacture | 2,274.89 | 2,274.89 | exact — **92.25 h**: Fanlights 2 × 300, Sidelights 2 × 780, Flat Panel 2 × 60 and **no Door Muntin** (the panel sashes have no rail) |
| labour | 723.78 | 723.78 | exact — 18.00 h |
| materials | 668.31 | 757.91 | +89.60 BY DESIGN: the two mullions and the transom (differences 7 and 11) |
| **total** | **4,071.73** | 4,161.33 | +89.60 declared |

Its 63x63 is Integrate's **11.07 m to the millimetre** with the all-panel
casements' stiles at +14; 63x96 1.67, 63x120 4.81, 63x200 5.31 all exact. The
two Tricoya panels are 0.52 m² each.

**The short transom.** The fixture carries Integrate's own transom — 41 at
962.5 with `endDivider` = the second mullion — and the frame geometry honours
it (Step BH's divider references): five cells, the door full height. **The
board cannot draw one** until Step BQ, so this layout is exact offline but
cannot yet be redrawn live; that is the declared difference the brief asked
for, and it is a drawing gap, not a price one.

## DM1 = M1 — L34268 item 2, a single door with a muntin below the mid rail

| group | Integrate | GlazePro | |
|---|---|---|---|
| glass | 33.43 | 33.43 | exact — 0.54 m² |
| installation | 214.44 | 154.59 | **−59.85 PENDING DATA**: the facts give no stored set for this item |
| manufacture | 994.54 | 994.54 | exact — **40.33 h**: Door Muntin 2 × 60 (the rail AND the confined muntin), Flat Panel 2 × 60 |
| labour | 442.31 | 472.47 | **+30.16 OPEN**: "Any Door Overweight" 45 min on a leaf GlazePro weighs at 51.9 kg |
| materials | 321.25 | 333.93 | +12.68 BY DESIGN: the confined muntin's 733 mm (difference 13) |
| **total** | **2,005.97** | 1,988.96 | −17.01 declared |

The two panels are 0.18 m², 33.91 each — Integrate's. The overweight: timber
and glass alone come to 49.7 kg, so the PROVISIONAL panel weight (difference
14) cannot settle it — any panel over 0.8 kg/m² tips the leaf, and FT2 needs
at least 2.5. The 1.5 kg is somewhere in an open-out single door's timber or
glass that no reading has measured directly; left as a question rather than
moving a figure three front doors agree on.

## FT5 = P1 — L34355 item 7, the front door set with everything

| group | Integrate | GlazePro | |
|---|---|---|---|
| glass | 0 | 0 | exact — every unit special, no glass line at all |
| installation | 370.38 | 315.78 | **−54.60 PENDING DATA**: no stored set in the facts (the Balham list stands in) |
| manufacture | 2,677.58 | 2,677.58 | exact — **108.58 h, every line the facts list**: Mullion/Transom 3 × 180, Door Leaf 1035, Sidelights 2 × 780, Fanlights 3 × 300, Door Muntin 4 × 60, Flat Panel 4 × 60, Door Frame 855, Glazing 7 × 20, Casement Dual Finish 5 × 90, Door Frame Dual Finish 240 + 3 × 45, Door Leaf Dual Finish 180; no "Special Glass" |
| labour | 1,266.62 | 1,296.77 | 29.5 h of units + the **120-minute POA line** = 31.50 h exact, **+45 min OPEN** (the same overweight) |
| materials | 746.52 | 870.10 | +142.26 BY DESIGN (mullions and transom 97.40, the leaf's full-height muntin 32.34, the three 62 fanlight rails 12.52); **−18.68 OPEN** |
| **total** | **5,061.10** | 5,160.23 | +99.13 declared |

The bolection mouldings price Integrate's own metres — external 1.19 / 1.25 /
1.25 / 1.19, internal 4 × 1.00 — which is how the fixture's layout was fixed:
P1's facts give the frame size and the leaf's and sashes' own dividers but
not the mullion / transom offsets or the leaf width, so those were derived
from the moulding lines (a side casement panel is W + H = 1,040, a leaf panel
1,100) and are the fixture's stated assumption. The −18.68 is section timber
Integrate allocates that P1's facts do not itemise; it needs P1's Utile lines
from the Price File Editor.

---

# The readings this step took (difference 23)

1. **An open-out fixed casement's stiles take the fanlight's +14.** G1's and
   G2's side and panel casements, 163 door-depth rails, are W + 2H + 14 in
   Integrate's 63x63 (9.98 m and 11.07 m exact). Difference 18's drawing-20
   side light (W + 2H, no offset) is open IN — so the offset is dropped only
   for an open-in sash with a door-depth rail. FT4 is unchanged.
2. **A casement sash's 170 mid rail is allocated at 63x200**, cut at the sash
   width less 10 as a leaf's is. A 120 rail allocates nothing (FT4). This
   moves the board's OWN side-light templates — 349 mm each at 29.00/m,
   **+10.12 per side light** — so two pinned GlazePro-only figures moved:
   "Front Door With Side Light" 3,297.37 → 3,307.49, the Step BH doorset
   round trip 9,084.43 → 9,124.92. No Integrate benchmark moves.

Both, and the three open questions, are in `docs/integrate-differences.md`
§23.

---

# The e2e

On the deploy of `213a3e2`, 9 passed, 1 failed. **The page passed** with
DG1, DG2, DM1 and FT5 reading BY DESIGN at exactly the declared figures. The
failure was Step BO's save step at its own cleanup: `/^apply defaults$/i`
matched the panel's "Apply Defaults" AND the confirm dialog's "Apply
defaults" (Playwright strict mode), so the cleanup stopped after the save had
gone through — leaving `kenrick_extension_490mm x1 (picked)` and the edited
flag on drawing 117. The selector is now the dialog's exact label.
`sql/step-bp1-drawing117-picker-residue.sql` removes that line and clears the
flag (SECTION 0 shows the row; it supersedes `sql/step-bs2`). The test cannot
tell its own residue from a surveyor's line, which is why it is a file.

**Final run**, against the deploy of `1b89621` (the selector fix): **10
passed, 0 skipped** — item 5's "expect 10 passed".

---

# What the reviewer should draw live

The brief names L34242 items 7 and 8, L33022 item 7 and L34268 item 2.

1. **L34242 item 8 (DG1)** on lead 11: French doors template, frame 3100 ×
   2230, two 41 mullions at 690 and 2275; on each side casement **Add mid
   rail and panel** with Panel 450 and Rail 170; on each leaf the same (Panel
   450, Rail 170); the stored set through the picker (102mm hinges Blk ×4,
   euro cylinder Blk, monkeytail door handle RH Blk, both vents). Expect
   glass 188.18, production 100.92 h, fitting 18.50 h, and materials
   Integrate + 58.37 − 5.57.
2. **L34268 item 2 (DM1)** on lead 12: single door 930 × 2100, RH; **Add mid
   rail and panel** (Panel 733, Rail 170); **Muntin: Below the mid rail**,
   Thick 120. Expect production 40.33 h with Door Muntin 2 × 60; the
   overweight 45 min and the ironmongery are the two declared questions — the
   item's stored set, read from Integrate, is what closes the second.
3. **L34242 item 7 (DG2)** cannot be drawn until Step BQ (its transom is
   short). Everything but the transom is drawable: on A2 / B2 select the glass
   and press **Tricoya panel**.
4. **L33022 item 7 (G3)** has no benchmark here (its full figures are in the
   live comparison, not the facts file): side casements A2 / D2 glass over a
   170 rail at 1226 over a panel, leaves glass 1V+1H over a 170 rail over a
   panel. Expect Door Muntin 4 × 60 and Flat Panel 4 × 60 in production.
5. On any door panel, open the panel's fields: the type and bead are lists,
   and drawing 105's blanked panel reads "— select —" and still prices flat.

Nothing is waiting on Nathan. Two items wait on the reviewer's reading:
the stored ironmongery sets for L34268 item 2 and L34355 item 7, and P1's
Utile section lines.
