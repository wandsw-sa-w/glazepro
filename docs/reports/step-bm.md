# Step BM — the board fixes the live-quote comparison exposed

Done 16 Oct 2026. Brief: `docs/step-bm-brief.md`.
Correction to item 4: `docs/step-bm-correction.md` (reviewer, 16 Oct) —
followed instead of the brief's item 4.

Commits: `22b4959` (item 0 — the brief) and the ones after it.

**SQL: none.** Both fixes are engine/board code.

Offline suite: **2,091 passing, 8 failing** — the standing eight only (the six
Step W sash-weight measurement rows, benchmarks A50 +£0.28 and D +£0.54),
exactly as before this step. Vitest also reports `e2e/smoke.spec.js` as a
failing *file* because it collects the Playwright spec it cannot run; that is
the standing artefact, not a test failure. 20 new tests across two new files.
Lint: the 24 problems in the touched files are all pre-existing — the new test
files add none.

**Of the brief's four items, two were real faults and are fixed (items 2 and
3), one was not a fault at all (item 1), and the corrected item 4 is half done
and half REPORTED, because the change the correction asks for moves six
benchmarks.** Nothing is tuned to make a number go green.

| Item | Verdict |
|---|---|
| 1. Arched glass on the live board | **Not a bug.** Benchmark C's declared decision e, reaching LQ5 by the same route |
| 2. Double box second-bay arch radius | **FIXED.** The mullion's own thickness was being overwritten by the profile's |
| 3. "Finish & Ironmongery" drops unsaved edits | **FIXED.** The default-ironmongery handler adopted the unsaved tree as its baseline |
| 4a. The added panel must not be raised and fielded | **Reverted to flat**, as the correction asks |
| 4b. Make the mid rail count | **NOT made — reported.** Six benchmarks move; live LQ3 contradicts the reading |

---

# 1. Arched glass on the live board — NOT A FAULT

The brief's premise was that benchmark C prices arched glass at `0.32 × 71.88`
— Integrate's shaped area at Integrate's shaped rate — and that the live board
fails to do the same.

C does not do that. It prices `0.43 × 58.50 = 25.16`: the **largest rectangle**
of the cut glass plus the supplier's quarter, at the **square** rate. That is
Nathan's decision e (14 Oct), and C carries it as a declared difference:

```js
deliberateDifference: { cost: 7.37, ... }
```

So the live board is not behind C — it is doing what C does. LQ5's +£7.76
against Integrate decomposes the same way and is the same decision, not a
second fault:

| LQ5 line | GlazePro | Integrate | Why |
|---|---|---|---|
| Shaped glass | 28.66 | 21.56 | largest rectangle +25% at the square rate (decision e) |
| Energy surcharge | 1.67 | 1.02 | follows the area above |
| | **+7.76** | | |

`src/drawingBoard/archAndPanel.test.js` now pins this down rather than leaving
it as prose: a frame-level arch and a sash-level arch in a square frame both
derive Integrate's own radius and shoulder, LQ5 reads its arch inputs exactly
as C does, and both price **at the square rate**, with C's £7.37 asserted
alongside so that if anyone ever "fixes" this the test says why not to.

**Nothing changed in the engine for item 1.** If Nathan wants Integrate's
shaped rate copied rather than corrected, that reverses decision e and is a
step of its own.

---

# 2. The double box's second bay — FIXED

## What the reviewer saw

On LQ6 the second bay's arch came out with radius **296.82** where the first
bay's was **470.5**, on a drawing whose two bays are the same size.

## The cause

`mullionThicknessMm` in `src/drawingBoard/sashGeometry.js` asked the **profile**
for the box mullion's section whenever a profile was present, and only fell
back to the mullion's own stored value when there was none:

```js
// before
if (hollow && profileValues != null) {
  const t = safe(profileValues.thicknessInFrameHollow)   // Sash profile: 144
  ...
}
return safe(mullion?.values?.thicknessInFrame) ?? 0      // never reached
```

LQ6 stores **220** on its mullion; the Sash profile's hollow section is **144**.
So every bay of every double box was measured with 144 regardless of what the
surveyor had entered. On LQ6 that made bay two 691 of opening and 686 of sash
instead of 610 and 610, and the derived radius

```
(588² / 4 + 256²) / 512  =  296.82
```

— exactly the figure in the brief, which is how the substitution was traced:
back-computing the chord from 296.82 gives the 144 width, not the 220 one.

## The fix

**The mullion's own thickness wins; the profile is the fallback.** That is the
convention the rest of the codebase already states as "stored value wins,
profile is the fallback" — this one function was the exception.

```js
const stored = safe(mullion?.values?.thicknessInFrame)
if (stored != null) return stored
if (hollow && profileValues != null) { ... }
```

The `throw` for a missing `thicknessInFrameHollow` is kept, so a drawing with
neither a stored value nor a profile section still fails loudly instead of
silently measuring 0.

## What it is worth

| | before | after |
|---|---|---|
| LQ6 bay 2 opening / sash | 691 / 686 | **610 / 610** — bay 1's figures |
| LQ6 bay 2 radius / shoulder | 296.82 / — | **256 / 470.5** |
| LQ6 shaped glass, both bays | 0.40 / 0.50 m² | **0.50 / 0.50** |
| LQ6 materials | — | **138.12, exact** |
| LQ6 | | **+£8.05** |

Benchmark D is untouched: it stores 144, so the stored value and the profile's
agree and the fix is a no-op on it. `benchmarks.test.js` now asserts LQ6's two
bays shape equally (`[0.50, 0.50]`), that `g6` is 16.74 with the two bays
halving it, that LQ6's materials are exact at 138.12, and that its
`installation_materials` is the parked £0.28.

---

# 3. "Finish & Ironmongery" dropped unsaved edits — FIXED

## What the reviewer lost

Edit a drawing, click **Finish & Ironmongery**, and the Unsaved marker clears
and Save greys out. Reload and the edits are gone — the reviewer lost a glazing
bar and an opening type this way.

## The cause

Opening the F&I panel auto-applies the default ironmongery through
`handleAutoApplyDefaults` in `src/pages/DrawingBoard.jsx`, which did:

```js
savedTreeRef.current = newTree    // the WHOLE current tree
setTree(newTree)
setDirty(false)
```

`newTree` is the current tree — including everything the surveyor has changed
and not yet saved. So the handler **adopted the unsaved edits as the saved
baseline** and then declared the drawing clean. A reload read back what was
actually in the database, which never had them.

The intent was only ever "the default itself is not a change".

## The fix

Apply the same one-field patch to the baseline as to the tree, and recompute
dirty instead of forcing it:

```js
const patch = { [propertyName]: newValue }
const newTree = updateNodeValues(tree, nodeKey, patch)
savedTreeRef.current = savedTreeRef.current
  ? updateNodeValues(savedTreeRef.current, nodeKey, patch)
  : newTree
setTree(newTree)
setDirty(isDirtyVsSaved(newTree))
```

The default still marks nothing dirty on a clean drawing — which is the whole
point of the handler — because it lands on both sides of the comparison.

## How it is tested

There is no DOM or React test setup in this repo (no jsdom, no
`@testing-library`), so `src/drawingBoard/unsavedState.test.js` models the
handler's three lines exactly and asserts the behaviour **both ways round**: an
edit survives selecting F&I, and the old behaviour is shown losing it. It also
covers the clean-drawing case and the brief's save → reload round trip.

Because a model of a handler can drift from the handler, the file ends with a
**source-level guard** on `DrawingBoard.jsx` itself — the pattern
`profileCodeCallers.test.js` uses, and for the same reason: this fault is
invisible without a browser. It asserts the component still patches the
baseline, still calls `isDirtyVsSaved`, and **no longer contains
`setDirty(false)`** in that handler.

`e2e/smoke.spec.js` also gains a **read-only** step on `/drawing-board/69`: edit
`drawingItemPart.location`, click Finish & Ironmongery, assert
`[data-testid="unsaved-marker"]` is still there, then reload **without saving**
and assert the value came back unchanged. It deliberately never saves — the
suite is read-only and runs on every deploy — so the save half of the round
trip is the offline test's job. A `data-testid="unsaved-marker"` was added to
the Unsaved span to make this assertable.

---

# 4. The panel the board adds, and the mid rail

The correction supersedes the brief's item 4. It rests on Integrate's own panel
and bead options, re-read in the board's dialog:

| Panel type | | Bead | |
|---|---|---|---|
| **110** | **Flat** | **120** | **Ovolo** |
| 112 | Raised & fielded | 126 | Bolection |
| 114 | VTG | 320 | Bespoke |
| 116 | HTG | | |

Every panel the reviewer has read on a live drawing is a **110 over a 120** —
so every one of them is flat with ovolo beads.

## 4a. The added panel stays FLAT — reverted, as asked

The brief had asked for "Add mid rail and panel" to make a **raised and
fielded** panel, on the reading that 110 meant that. An interim change made the
new panel copy whatever the *other* leaf already had, which on a drawing with
one R&F leaf would have made this one R&F too and charged 120 production minutes
instead of 60.

**That is reverted.** `withLeafMidRail` and `setLeafMidRail` in
`src/drawingBoard/doorOpenings.js` are back to their original form, and
`DEFAULT_PANEL_VALUES` still reads:

```js
internalPanelTypeId: 'flat',  externalPanelTypeId: 'flat',
internalPanelBeadId: 'ovolo', externalPanelBeadId: 'ovolo',
```

Flat, ovolo, both faces — which is right, and which difference 19 and Nathan's
decision k already said. Two tests in `archAndPanel.test.js` now hold it there,
including one that it **stays** flat beside a raised-and-fielded neighbour, so
the interim reading cannot come back by accident. A panel the surveyor has
*deliberately* set to R&F is still kept when the mid rail moves.

## 4b. The mid rail — NOT made, REPORTED

The correction also asks that a door leaf's **mid rail** go into
`sash_muntin_to_be_replaced_qty`, so that PF30 rule 1235 "Door Muntin"
(60 minutes × that quantity, gated on `new_door_leaf_qty >= 1`) fires once per
mid rail. Its evidence:

> **L34242 Q2 item 8** — French doors with side casements, every leaf and side
> casement carrying a 170 mid rail over a type-110 panel: "Additional for Flat
> Panel" 4 × 60 **and "Door Muntin" 4 × 60**.
> Item 7 of the same quote — two all-panel casement sashes, **no** mid rails:
> Flat Panel 2 × 60 and **no** Door Muntin.

The correction's own instruction was: *"Every existing benchmark unchanged. If
one moves, stop and report it. FD4 is the one to watch."*

**It was implemented, measured, and reverted, because six benchmarks move.**
The change counted a `transomPart` with `isMidrail: true` under a door leaf, and
under a casement sash on an item that has a door leaf (item 8's four are leaves
and side casements together).

### What moved

Every movement is exactly **+1 h and +£24.66 per mid rail** — one firing of rule
1235 at the £24.66 production rate:

| Benchmark | mid rails | production, before → after | Integrate | cost |
|---|---|---|---|---|
| FD4 French doors with panels | 2 | 57.42 → **59.42** | 59.42 | +£49.32 |
| FT1 front door, Balham | 1 | 43.50 → **44.50** | 44.50 | +£24.66 |
| FT2 front door, fanlight | 1 | 45.17 → **46.17** | 46.17 | +£24.66 |
| FT3 front door, arched | 1 | 53.83 → **54.83** | 54.83 | +£24.66 |
| FT4 front door, side light | 2 | 63.08 → **65.08** | 65.08 | +£49.32 |
| **LQ3 utile French doors** | **2** | **61.22 → 63.22** | **61.22** | **+£49.32** |

### Five of the six say COUNT IT

FD4 and FT1–FT4 each already carry a **declared negative difference that is
exactly this amount**, written in Step BE as Nathan's decision d. The change
makes all five **exactly Integrate** and makes those declared gaps obsolete.
From the fixtures, unedited:

- **FD4** — `deliberateDifference: { cost: -49.32 }`: *"Integrate fires 'Door
  Muntin' 60 for each leaf's MID RAIL where GlazePro charges 60 per REAL muntin
  only (Nathan, decision d)."* Two leaves, two mid rails.
- **FT1** — `cost: 6.28`, which is `+30.94` of muntin timber **less £24.66**:
  *"Integrate counts the leaf's mid rail as a second muntin."*
- **FT2** — `cost: -10.99` = `+13.67` transom timber **less £24.66**.
- **FT3** — `cost: 12.07` = `13.45 + 23.28` **less £24.66**.
- **FT4** — `cost: 21.60` = `+28.36 + 42.56` **less £49.32**, for **two** mid
  rails.

And FT1's firing was not inferred from a total — it was **read out of
Integrate's labour editor** on drawing 16 (recorded in
`docs/integrate-L31115-front-doors.txt`):

> `1235 Door Muntin 2 x 60 = 120 (sash_muntin_to_be_replaced_qty = 2: the
> muntin AND the mid rail)`

So on FT1, Integrate demonstrably counts the mid rail. The reviewer's reading is
consistent with five benchmarks and one direct editor reading.

### But LQ3 says DO NOT, and LQ3 is a live quote

**LQ3 (L33022 item 12, live drawing 105) is the same shape as the reviewer's
item 8 and gives the opposite answer.** From
`docs/integrate-live-quotes.txt`, unedited:

```
LeftFrenchDoorLeafPart / RightFrenchDoorLeafPart ...
  PanelPart internalPanelTypeId=110 internalPanelBeadId=120
            externalPanelTypeId=110 externalPanelBeadId=120
  TransomPart thickness=170 offset=1217 offset2=400 isMidrail=true
...
Production Time: 61.22x24.66=1,509.69
```

Two French leaves, each a **170 mid rail over a type-110 flat panel** — the
correction's configuration exactly — and Integrate's own price-file line reads
**61.22 h**, which GlazePro hits **to the penny with the mid rails uncounted**.
Counting them reads 63.22 h and puts LQ3 **2 h and £49.32 over Integrate**.

LQ3 is also the better class of evidence: a real customer quote read off
Integrate's price file, not a test-quote drawing, and one of the four
benchmarks Step BL got exact on every group.

### Why this is not a discriminator I can resolve

I looked for something that separates LQ3 from FD4, since both are French door
pairs with two leaves, two 170 mid rails and two flat panels:

- **Panel type** — ruled out. FD4's drawing 10/4 (310627) was **re-read on 14
  Oct** and both panels are `110/110`, same as LQ3's.
- **Real muntins** — ruled out. Neither FD4 nor LQ3 has a `mullionPart` inside a
  leaf, so `allLeafMuntins` is 0 on both.
- **Glazing bars** — LQ3's leaves carry vertical and horizontal bars above the
  mid rail and FD4's do not, but bars are counted by `gb_to_be_replaced_qty` and
  priced by their own rules; nothing connects them to rule 1235.
- **Door type** — FT1–FT4 are open-in front doors (`doorLeafPart`); FD4 and LQ3
  are French pairs. That splits FT1–FT4 from LQ3 cleanly, **but FD4 is a French
  pair on the counting side**, so it does not hold either.

The honest position: **Integrate fires "Door Muntin" for a mid rail on some
drawings and not on others, and the rule text (`60 ×
sash_muntin_to_be_replaced_qty`) does not say which.** Either LQ3's drawing 105
differs from item 8 in a field nobody has read yet, or one of the two readings
is of a drawing that was edited between the reading and the price.

### What the reviewer needs to settle it

One reading decides it, and it is the same reading that settled FT1:

1. **Open live drawing 105 (LQ3, L33022 item 12) in Integrate's labour editor**
   and read whether `1235 Door Muntin` appears and at what quantity.
   - If it is **absent** or 0, the correction's generalisation is wrong and
     decision d stands as it is — and FD4/FT1–FT4's declared gaps stay.
   - If it is **2 × 60**, then Integrate's own 61.22 h price line disagrees with
     its own editor, and the mid rail should count: make the change, and
     **delete** the five declared differences above, because all five become
     exact.
2. **Re-read L34242 Q2 item 8's leaves** for a `mullionPart` (a real vertical
   muntin). If each of the four carries one, item 8's "Door Muntin" 4 × 60 is
   four **real** muntins — which GlazePro already counts — and the mid rail has
   nothing to do with it. That would reconcile everything in one stroke, and it
   is the hypothesis I would test first.

Until then nothing is tuned. `sash_muntin_to_be_replaced_qty` still counts real
muntins only, and it now carries a comment naming LQ3 and pointing here, so the
next step does not re-tread this.

### Tests that hold the line

A third `describe` in `archAndPanel.test.js`:

- a leaf with a mid rail and no muntin counts **0**;
- a **real** muntin (`mullionPart` in a leaf) still counts **1** — decision d's
  surviving half;
- **LQ3 still prices at 61.22 h**, with Integrate's own price line quoted in the
  test, so the day someone makes the mid rail count, this test names the quote
  that has to be beaten first.

### Drawing 103 and the layouts, for the record

For what the correction predicted, had the change been kept:

| | the correction predicts | what I actually measured |
|---|---|---|
| Drawing 103 | +60 | **not measured** — a live drawing, and the change is reverted |
| L34242 item 8's layout | 4 × 60 | **not measured directly.** FT4 — one leaf mid rail plus one side-casement mid rail, item 8's layout halved — measured **2 × 60**, so the rule as written would give item 8 its 4. That is arithmetic on FT4, not a run of item 8 |

The L34268 item 2 leaf-mullion count the correction asks about is a later
step's; with the change in place a leaf `mullionPart` counts 1 and a leaf
`transomPart isMidrail` counted 1, so a leaf mullion would have given **1**, the
same as today. The reverted change does not affect it.

## 4c. Templates still storing raised and fielded — REPORTED, NOT CHANGED

The correction asks which templates use R&F where Integrate's drawings are flat,
and says **not** to change template data. One does:

| Template | Source | Panels |
|---|---|---|
| **French Doors With Panels** | `sql/step-ba2-door-variant-templates.sql` | 4 faces `raised_and_fielded`, ovolo beads |

That is template 79, which is **FD4's own source drawing** — and FD4's drawing
was re-read on 14 Oct as `110/110`, **flat**. So the template disagrees with the
drawing it was built from, and every new "French Doors With Panels" starts 60
production minutes per panel dearer than Integrate.

The other two templates in that file — "French Doors With Side And Top Lights"
and "French Door Set With Casement Lights" — carry no panel parts at all, so
there is nothing to flip.

The four **front-door** templates are already flat: `sql/step-bf1` was run live
on 14 Oct (`6a4b6192…`, templates 29–32), and it supersedes the R&F panels that
`sql/step-bd3` and `sql/step-be2` originally shipped. `sql/step-bh2` (doorsets)
and `sql/step-bf4` (stable doors) both *guard* against R&F with a
`RAISE EXCEPTION`, so they are flat by construction.

**No SQL is written for this**, because flipping that template is only right if
4b is settled the other way — if the mid rail does **not** count, the template's
R&F panels are the only thing keeping new French doors near Integrate's figure
on that layout, and changing both at once would hide which one mattered. It
belongs in whichever step resolves 4b.

---

# What the reviewer should do live

1. **The two readings in 4b above** — drawing 105's labour editor, and item 8's
   leaves for a real muntin. Everything else in item 4 waits on these.
2. **Re-price drawings 121, 122 and 123** (the double boxes). Item 2's fix
   changes every bay that stores a mullion thickness other than the profile's
   144, so these should move — LQ6's shape is worth +£8.05. Any drawing whose
   mullion *is* 144 will not move at all, which is the expected result, not a
   failed deploy.
3. **Redraw a door with "Add mid rail and panel"** and confirm the new panel
   reads **Flat / Ovolo** on both faces in the panel dialog — item 4a.
4. **The item 3 round trip with a save**, which the e2e step deliberately does
   not do: edit a drawing, select Finish & Ironmongery, confirm Unsaved is still
   showing and Save is still enabled, **save**, reload, and confirm the edit is
   there.

---

# What a reader should be wary of

- **Item 1 is a non-finding, and the brief's premise for it was wrong.** If a
  later brief repeats "C prices arched glass at Integrate's shaped rate", it is
  reading something other than `fixtureC.js`. C prices the largest rectangle
  +25% at the **square** rate and declares £7.37 for it.
- **The six benchmarks in 4b have not been touched.** They still pass, still
  carry their declared gaps, and those gaps still say "a mid rail is not a
  muntin". If 4b is decided the other way, **five of those declared gaps must be
  deleted, not adjusted** — the benchmarks become exact, and leaving the gaps in
  would make them fail in the opposite direction by the same £24.66.
- **A50 +£0.28 and D +£0.54 are the standing residuals**, not something this
  step moved. They are the counterweight weight model, parked since Step AT, and
  they fail identically at `22b4959` with none of this step's code — I verified
  that by running the suite at HEAD and at the end of Steps BK and BL.
- **Item 2's fix reaches every double box, not just LQ6.** Any saved drawing
  whose mullion stores something other than 144 will re-price. That is the
  point, but it means the fix is not confined to the benchmark that found it.
- **The e2e item 3 step never saves.** It proves the marker survives and an
  unsaved edit does not persist; it does **not** prove a save after the default
  writes the edit. That half is `unsavedState.test.js` and reviewer step 4
  above.

---

# e2e after the deploy

Deploy confirmed by decoding `/version.json`: **`mvb5zmrn` = 16:10:51Z**, nine
seconds after the last commit (`17:10:42+01:00` = 16:10:42Z).
`public/version.json` is left uncommitted, as CLAUDE.md says.

`npm run e2e`: **7 passed** (28.6s) — the six standing tests and the new item 3
step.

```
ok 1 logs in
ok 2 every benchmark passes except the parked residuals
ok 3 the fanlight drawing shows Fanlight A1 and Casement Sash A2
ok 4 a casement drawing offers Bi-Glass in Type of Work
ok 5 selecting Finish & Ironmongery keeps unsaved edits unsaved
ok 6 the validation panel loads without an error
ok 7 every drawing card on the L507712 quote matrix shows a price
```

Test 2 is the live benchmark page, so **every live benchmark is unmoved except
where item 2 intends it** — nothing in item 4 reached the live engine, which is
the point of reverting it rather than shipping it behind a flag.

## The new step took two goes, and the first failure was the test's, not the app's

Worth recording because the failure looked like item 3 regressing and was not.
The first live run failed with the Unsaved marker **present** — the fix works —
but the step had never confirmed the Finish & Ironmongery panel had opened, so
it was asserting against the Item panel. Two causes, both in the test:

1. The tree row's click handler is on the containing `div`, not the label
   `span`, so clicking the label's own box did not select.
2. The field it waited for, `paintAndIronmongeryPart.ironmongeryFinish`, is not
   rendered on drawing 69 at all — 69 is a **bi-glass casement**, so that wait
   could never have succeeded even once the click landed.

Fixing (1) by clicking the parent row then hung for the full test timeout.
Probing the live DOM found why, and it is worth knowing for any future tree
assertion:

```
rect:               { x: 1033, y: 169, w: 247, h: 34 }
elementFromPoint:   <div ...>Price (net): ...
```

**At this viewport the tree row's centre point is covered by the Summary
panel.** `click()` waits for the element to receive the event at its centre,
which it never will, so it hangs rather than failing. The step now uses
`dispatchEvent('click')`, which sends a real bubbling click to the row and
skips the hit test, and it passes in 4.5s.

The panel-open assertion no longer guesses at a field. `DrawingBoard.jsx`
carries a hidden `data-testid="selected-part-type"` with the selected part's
type as an **attribute** (an attribute, not text, because the element is
hidden), and the step waits for it to become `paintAndIronmongeryPart` before
it asserts anything about the marker. It is the same kind of hook as
`unsaved-marker` and carries no UI of its own.

Still read-only: it edits `drawingItemPart.location`, never saves, and reloads
to confirm nothing was written.
