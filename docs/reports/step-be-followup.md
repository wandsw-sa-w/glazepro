# Step BE follow-up — the muntin's own leaf, and drawing a sash's grid

Done 14 Oct 2026. Brief: the reviewer's follow-up of 14 Oct, after running
`sql/step-be1` live and reading the side-light template (id 32) on drawing 47
of L507712.

Commits: `b4650cc` (the reviewer's `sql/step-be1` edit, unchanged), `2b68521`
(the two defects), `0c44363` (the live rate), and this report.

**SQL waiting: `sql/step-be2`, re-issued** — SECTION 2 only; SECTION 1 is
unchanged and may already be live, and it is safe to re-run.

---

## 0. The reviewer's `sql/step-be1` edit

`_price_file` was declared **`bigint`**; `price_files.id` is a **uuid**, so the
block failed on the live schema. Committed unchanged as `b4650cc`, and the
file **ran live with it**.

That changes the figures in §3 below, which the live smoke run caught before I
did.

## 1. The muntin was centred in the wrong leaf

**The defect.** The template stored the door's muntin at **479** — centred for
the **1298**-wide leaf the door had *before* the side light took 465 mm of the
frame. The leaf is 892 wide and its interior 672, so the panels came out
**479 / 73**. The grid was built first, the leaf narrowed afterwards, and
nothing re-read it.

**The fix.** `recentreGridsAfterResize(before, after)` re-evens the grid of
every leaf and sash whose interior has changed, and `addSideLight` calls it on
the leaf it has just narrowed — which fixes the board action and the generator
in one place, since the generator builds through the same function.

**Only an EVEN run of dividers is re-evened**, and that is the whole judgement
in it:

- a grid a surveyor has **moved on purpose** is a decision and stays (a test
  moves a muntin to 700 and watches it survive);
- a **MID RAIL** stays too, because a lock rail's height is a decision and not
  a proportion — a lock rail does not move because the door got narrower.
  That is why Integrate's 983 on the Balham survives this and the muntin does
  not.

The template's muntin is now **276** (276 / 276 of the 672 interior).

**A drawing already made from the template keeps its own tree**, so drawing 47
has to be re-made from the re-issued template to pick it up.

## 2. The board drew the side light as full-height glass

**The defect.** Its mid rail, glass and panel were in the tree and all three
priced — the Tricoya line, the glass at the 0.30 m² minimum — and the
elevation drew one pane. `leafCellRects` was asked only about a **door leaf**.

**The fix.** The gate is now **`gridRectsFor(tree, node, gx, gy)`**, in
`doorGeometry.js` with the geometry rather than inside the SVG: anything that
*can* hold a grid answers with its cells, anything else with nothing. The side
light draws as **235 × 1031 of glass over a 235 × 641 panel**, each one
selectable, and a plain sash still falls through to the drawing the board has
always done — which is what keeps every casement window where it was.

Putting the gate in a pure function is also what let it be tested: the SVG
itself has no test in this repo, and a condition inside it would have had none
either.

## 3. `sql/step-be1` is live, so the shaped RATE stopped being pending

The live smoke run failed on two rows, and it was right to: the page read
**C at +7.37** and **FT3 at +36.73** where the pins expected +13.12 and
+51.84. That is `sql/step-be1` having run — a shaped unit is priced at the
**square** rate, so the supplier's quarter is on the area alone, exactly as
each row's declared pending half said it would be.

| | glass line | row |
|---|---|---|
| **C** | 0.43 m² at **58.50** = 25.16 (was 30.91) | **+7.37** |
| **FT3** | 1.13 m² at **58.50** = 66.11 (was 81.22) | **+36.73** |

Both fixtures' `pendingDecision` is gone and the smoke pins are the live
figures. **Nathan's own figure for FT3 was £65.52** from a 799 × 1125 cut;
GlazePro's cut is **801 × 1127**, which gives **£66.11** — 59p more, and the
difference the brief asked to be reported.

Offline the captured `pf30-snapshot.json` still holds Integrate's shaped rate,
so the tests apply **`withShapedGlassRate`** (new,
`src/pricing/benchmarks/liveRuleFixes.js`) — the same treatment the Kenrick
gearbox parts had in Step BB and the AV4 costs in Step BD, and a no-op once
the snapshot is refreshed.

**What each template prices now**, through the live rules
(`sql/step-bd1`, `bd4` and `be1` all run), with no stored ironmongery:

| Template | cost | price |
|---|---|---|
| Front Door | 2,604.67 | 5,209.32 |
| Front Door With Fanlight | 2,697.97 | 5,395.92 |
| Arched Front Door | **2,725.12** | 5,450.23 |
| Front Door With Side Light | **3,371.35** | 6,742.64 |

The arched one read 2,740.23 while the rate still carried the quarter; the side
light is 2p off the figure in the Step BE report (3,371.33) because its
re-centred muntin changes the four panel areas, each rounded on its own.

## `sql/step-be2`, re-issued

SECTION 2 only, from `scripts/build-step-bd-sql.mjs` with the re-centred tree.
Added: a header note saying what changed and that drawing 47 keeps its own
tree, and a **check 3b** that reads the muntin offset back out of the live
template — **expect 276, not 479**.

## What the tests show

**Tests first** — 5 new in `src/drawingBoard/frontDoorBoard.test.js`, each
failing before its fix with the live figures (479, and `gridRectsFor is not a
function`):

- the template's muntin centred **in its own leaf**, 276 / 276;
- `addSideLight` re-centring the muntin and **not** the mid rail (983 stays);
- a deliberately moved grid (700) left alone;
- the side light's **two rects to draw**, with their kinds, sizes, offsets and
  nodes;
- a plain sash having **nothing extra** to draw, so no casement window moves.

**One of my own premises was wrong, and I corrected the test, not the code:**
the centred-rail arched door comes to 2,747.18, not the 2,743.69 I predicted —
a centred rail makes a taller glass cell, so its billable rectangle grows more
than the arched template's does.

**Offline: 1,762 passing, 8 failing — the standing eight, unchanged.**
Eslint unchanged in count.

**Live: 5 of 5 passed (16.4s)**, against the deploy of `0c44363` —
`/version.json` reads `mv7y370e`, built 2026-10-14 10:06:21Z:

```
ok 1 logs in (1.8s)
ok 2 every benchmark passes except the parked residuals (4.8s)
ok 3 the fanlight drawing shows Fanlight A1 and Casement Sash A2 (2.2s)
ok 4 the validation panel loads without an error (2.2s)
ok 5 every drawing card on the L507712 quote matrix shows a price (4.7s)
```

Test 2 now reads C at +7.37 and FT3 at +36.73, which is the live confirmation
that `sql/step-be1` did what it said.

## Not verified against the live database

- **`sql/step-be2` has not been re-run.** Until it is, template 32 still has
  the 479 muntin, and a new front door with a side light is drawn with 479 / 73
  panels.
- **Drawing 47 keeps its own tree** and would have to be re-made from the
  corrected template.
- **Nobody has looked at the re-drawn side light on the live board.** The two
  rects are tested through the function the renderer calls, but the SVG itself
  has no test here — the drawing is what the reviewer would confirm.
- **The re-centring has only been exercised through `addSideLight`.** It is
  written for any resize, and a frame resize does not call it yet: a leaf whose
  frame is widened on the board still keeps its old muntin offsets. That is the
  next place to wire it, and it is not wired in this step.

## Anything that did not behave as the brief describes

- **The brief says "whenever the leaf is resized"; this wires it to
  `addSideLight` only.** The function is general and takes the before and after
  trees, but the board's frame-resize path does not call it yet. Said plainly
  because it is the obvious next step, not something this step did.
- **A third change came out of the live smoke run** — the shaped rate (§3).
  It is not in the brief because the brief was written before `sql/step-be1`
  ran; the pins and the two fixtures had to follow it either way.
- `public/version.json` is left uncommitted on purpose, as CLAUDE.md says.
