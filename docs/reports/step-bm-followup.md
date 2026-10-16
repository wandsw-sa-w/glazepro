# Step BM follow-up — the mid rail DOES count

Done 16 Oct 2026. Brief: `docs/step-bm-followup.md`.
Facts: `docs/integrate-live-quotes.txt`, corrected by the reviewer at 17:40 —
**panel type 110 is FLAT** (112 raised & fielded, 114 VTG, 116 HTG).

Commits: `12bf130` (item 0 — the reading and the corrected facts), `62958d5`
(item 1), `fabc1a8` (item 2), `777506f` (item 3), `671b268` (item 4).

**SQL waiting, not run:** `sql/step-bm1-french-doors-flat-panels.sql`.

Offline suite: **2,091 passing, 11 failing** — the standing eight (six Step W
sash-weight rows, benchmarks A50 +£0.28 and D +£0.54) **plus LQ1, LQ3 and LQ4**,
which fail only on surround labour and belong to Step BN, as the brief says.
Nothing else moved. Lint: the 7 problems in the touched files are all
pre-existing in `computeVariables.js`; nothing new.

This step reverses the surviving half of **Nathan's decision d** ("a mid rail
is not a muntin"), on the reviewer's reading of Integrate's own labour editor.

---

# What Step BM got wrong, and why

Step BM implemented this change, measured it, and reverted it, because six
benchmarks moved and one of them — LQ3, a live quote — appeared to contradict
the other five. The report asked for two readings. Both came back, and **LQ3
was never a counter-example.**

Integrate's labour editor on **L33022 Q5 item 12** (LQ3), read 16 Oct 17:00:

| | min |
|---|---|
| Door Leaf 2 × 1035 | 2070 |
| Additional for Glazing Bars (door) 2 × 30 | 60 |
| **Door Muntin 2 × 60** | **120** |
| **Additional for Flat Panel 2 × 60** | **120** |
| Machining & Joining a Door Frame | 855 |
| Glazing 2 × 20 | 40 |
| Glazing with Bar 2 × 12 + 2 × 12 | 48 |
| Door Frame Single Finish | 180 |
| Door Leaf Single Finish 2 × 90 | 180 |
| | **3,673 = 61.22 h** |

61.22 h is Integrate's own price line for that item. So the mid rails **do**
count, **and** the panels are flat.

## The coincidence that hid it

LQ3's fixture carried **raised and fielded** panels, because the facts file
called type 110 that. And:

```
R&F 2 × 120                        = 240
flat 2 × 60  +  Door Muntin 2 × 60 = 240
```

**The two readings give the same total.** A wrong fixture with an uncounted mid
rail landed on Integrate's right figure. So LQ3 "passed", and adding the mid
rail on top of R&F panels read as 2 h over — which is what Step BM measured and
reported.

That is the whole explanation, and it is worth keeping, because the same
coincidence had already hidden the same thing once before: FD4's "penny-exact"
match in Step BA was these two errors cancelling, and Step BF unpicked only
half of it.

## And Step BM's own hypothesis was wrong

Step BM's report guessed that L34242 Q2 item 8's "Door Muntin 4 × 60" might be
four **real** muntins, and said that was the first thing to check. The reviewer
checked: **item 8's leaves carry no `MullionPart` at all.** Each has only a
`TransomPart 170 isMidrail`, and the side casements have a `TransomPart 170`
between glass and panel. So its four are four mid rails.

Three further readings agree, all 16 Oct:

| item | shape | Door Muntin |
|---|---|---|
| L34268 item 2 | leaf transom + leaf mullion | 2 × 60 |
| L34355 Q4 item 7 | two side-casement mid rails + leaf transom + leaf mullion | 4 × 60 |
| L33022 Q5 item 7 | two leaf mid rails + two side-casement mid rails | 4 × 60 |

Six readings, no contradiction.

---

# 1. The count

`sash_muntin_to_be_replaced_qty` in `src/pricing/computeVariables.js` now adds,
to the leaf's real muntins:

```js
const isMidRail = c => c.part_type === 'transomPart' && c.values?.isMidrail === true
const doorLeafMidRails = allDoorLeaves.flatMap(
  l => (l.children ?? []).filter(isMidRail))
const doorsetSashMidRails = hasDoorLeaf
  ? allCasementSashes.flatMap(s => (s.children ?? []).filter(isMidRail))
  : []
```

So rule 1235 "Door Muntin" — 60 minutes × this quantity, gated on
`new_door_leaf_qty >= 1` — fires once per mid rail.

**The casement-sash half is gated on the item having a door leaf.** That gate
matters for more than tidiness: this same variable is read by the two
sash-window "Real Glazing Bar" rules, so without it a plain casement window's
transom would reach them. A test covers exactly that — same tree, no door leaf,
count 0.

`allDoorLeaves` is `doorLeaves(tree)`, which is `doorLeafPart` **plus**
`leftFrenchDoorLeafPart` and `rightFrenchDoorLeafPart`, so French pairs are
included. That is how FD4 (two French leaves, no `doorLeafPart` at all) gets
its two.

## Before / after

Every movement is **+1 h and +£24.66 per mid rail**, one firing of rule 1235 at
the £24.66 production rate:

| Benchmark | mid rails | production before | after | Integrate | now |
|---|---|---|---|---|---|
| FD4 French doors with panels | 2 | 57.42 | **59.42** | 59.42 | **exact** |
| FT1 front door, Balham | 1+1 muntin | 43.50 | **44.50** | 44.50 | **exact** |
| FT2 front door, fanlight | 1 | 45.17 | **46.17** | 46.17 | **exact** |
| FT3 front door, arched | 1 | 53.83 | **54.83** | 54.83 | **exact** |
| FT4 front door, side light | 2 | 63.08 | **65.08** | 65.08 | **exact** |
| LQ3 utile French doors | 2 | 61.22 | **61.22** | 61.22 | **exact, honestly** |

**FT3 is the row that proves the rule**: it has no real muntin at all, and
Integrate fires "Door Muntin" 1 × 60 on it regardless.

**LQ3 does not move.** Its two changes — panels R&F → flat (−120 min) and two
mid rails counted (+120 min) — cancel exactly. Its cost and every group are
unchanged; what changed is that the total is now reached the way Integrate
reaches it.

---

# 2. The declared differences that are now stale

Each of the five carried a **negative** term that was exactly 24.66 per mid
rail. Only that term is deleted; the rest of each is kept untouched, as the
brief asks.

| | was | arithmetic | now |
|---|---|---|---|
| **FD4** | −49.32 | the whole of it was two mid rails | **nothing declared** |
| **FT1** | 6.28 | 30.94 − 24.66 | **30.94** — the leaf's 120 muntin timber |
| **FT2** | −10.99 | 13.67 − 24.66 | **13.67** — the frame transom timber |
| **FT3** | 12.07 | 13.45 + 23.28 − 24.66 | **36.73** — mid-rail timber + shaped glass |
| **FT4** | 21.60 | 70.92 − 49.32 | **70.92** — timber only, two mid rails |

What remains in all four FT rows is the **PROVISIONAL timber** Integrate
allocates nothing for, plus FT3's shaped glass under decision e. Those are
separate open questions and this step does not touch them.

## Two assertions turned round rather than deleted

Deleting an assertion loses the protection. Both of these now assert the new
truth, so a regression on **either** half — the flat panel, or the mid rail
counting — still shows up:

- the FT loop asserted `target.hours.production - production` was 60 minutes a
  mid rail; it now asserts **zero**;
- the declared-difference test asserted each cost as `timber - MID_RAIL`; it now
  asserts the timber alone **and** that no row's `reason` string still contains
  `LESS n production minutes`.

FD4's `it('FD4 matches Integrate on every line but its panel minutes')` becomes
`it('FD4 matches Integrate on EVERY line, with nothing declared')`, and asserts
`deliberateDifference` is `undefined`.

---

# 3. LQ3's fixture

Both faces of both panels go from `raised_and_fielded` to `flat`. The beads
were already `ovolo` (Integrate's 120) and are untouched. The fixture comment
now records why it was wrong, so the coincidence cannot be re-introduced
quietly.

Two tests in `archAndPanel.test.js` hold it: LQ3 prices at 61.22 h, and its
panels read flat with ovolo beads on both faces.

---

# 4. `sql/step-bm1` — the template

**Not run.** The reviewer reviews and runs it.

`"French Doors With Panels"` (`sql/step-ba2`) stores `raised_and_fielded` on all
four panel faces. It is the one template `sql/step-bf1` did not reach, because
bf1 selects on `group_name = 'Open In Doors'` and this one is
`'Open Out Doors'`. It is **FD4's own source template**, and FD4's drawing 10/4
(310627) was re-read on 14 Oct as 110/110 — flat.

A recursive `pg_temp` function does the rewrite, rather than `jsonb_set` on
fixed paths, so nothing depends on the panels staying at
`frame > frenchDoor > leaf > panelPart`. It changes only the two panel-type keys
and only where they read `raised_and_fielded`. The `DO` block raises rather than
commits if the template is missing, if it has anything other than exactly two
`panelPart`s, if anything raised-and-fielded survives the rewrite, or if the
ovolo bead goes missing.

SECTION 0 reads: the template and its panel types; **every** template anywhere
that still carries an R&F panel (expect this one row before, none after); and
which **saved drawings** keep R&F panels — this file touches no drawing, and a
saved drawing with R&F panels goes on pricing R&F, which is correct, because it
is what somebody drew.

## The thing most likely to be misread

**This −49.32 is not FD4's old −49.32.** They are different changes that happen
to be the same size:

| | |
|---|---|
| FD4's old benchmark gap | the two leaves' **mid rails**, fixed by item 1 |
| `step-bm1`'s −49.32 | the template's two **R&F panels**, 120 min instead of 60 |

And on this layout they cancel: R&F 240 with uncounted rails, against flat 120
plus muntin 120. **That is exactly why FD4 looked penny-exact while both halves
were wrong.** So `step-bm1` moves no benchmark — the fixture already reads flat.
What it changes is what a surveyor's **new** drawing starts with.

The rollback section is marked DO NOT RUN and notes that it is blunter than the
change: it would flip every `"flat"` in the tree, which on today's template is
exactly the four panel faces, but 0a should be re-read first in case anything
else has gained a `"flat"` value since.

---

# Other tests this moved, and one record left alone

Seven test files encoded decision d. All are updated with the change rather
than left for someone to find:

| file | what moved |
|---|---|
| `frontDoorBe.test.js` | FT1 is 2 × 60 and 2,670; FT2/FT3 gain their rails; the describe's header records that decision d is superseded |
| `frontDoor.test.js` | the fired-rule list (`Door Muntin 120`) and FT1's 2,670 |
| `panelTypes.test.js` | all four FT rows are Integrate's exactly, where they asserted a shortfall |
| `frontDoorTemplates.test.js` | each front-door template +24.66; the side-light one +49.32 (two mid rails) |
| `saveRoundTrip.test.js` | the doorset round trip, +£147.96 on the price (three mid rails × £24.66 × 2) |
| `archAndPanel.test.js` | the mid-rail describe inverted, with the six readings quoted |
| `benchmarks.test.js` | items 2's hours and declared differences |

**In `saveRoundTrip.test.js` I have not rewritten the reviewer's own figures.**
The £7,517.43 seen on drawing 60, and the original £7,095.53, are the record of
what was on screen that day. The asserted figure moves to £7,665.39 and the
comment says why; what that test pins is the **shape** of the bug — two dead
references, six cells, four panels refused — which is unchanged.

---

# What a reader should be wary of

- **Decision d is reversed, not refined.** Anything still saying "a mid rail is
  not a muntin" is out of date. `computeVariables.js` carries the six readings
  at the variable itself.
- **Two −49.32s, one layout.** See item 4 above. If a later step sees FD4 move
  by £49.32 it should establish *which* of the two it is before touching
  anything.
- **The same coincidence has now hidden the same fault twice** — in Step BA
  (FD4's "penny-exact" match) and in Step BM (LQ3's apparent contradiction).
  R&F 2 × 120 equals flat 2 × 60 plus muntin 2 × 60. A door benchmark that
  matches on the total is not evidence that either half is right, and the way
  to check is Integrate's labour editor, not the price line.
- **LQ1, LQ3 and LQ4 are red, and that is Step BN's work**, not a regression
  here: LQ1 and LQ4 are £20.10 of linings/window-board labour, LQ3 is the
  £17.96 architrave GlazePro allocates where Integrate has no surround at all.
  The reviewer has already removed those `known_gaps` from the targets.
- **`sql/step-bm1` has not run**, so until it does, a new "French Doors With
  Panels" drawing still starts with R&F panels and prices £49.32 over.

---

# What the reviewer should do live

1. **Run `sql/step-bm1`.** SECTION 0 first; check 0b shows exactly one row
   before and none after.
2. **Re-price drawing 103** — expect **+60 min** of production, its one mid
   rail's "Door Muntin".
3. **Set drawing 105's panels to flat** — expect production **unchanged** at
   1,509.69 (−120 of flat panel, +120 of muntin), which is the same cancellation
   LQ3's fixture showed.
4. **Make a new drawing from "French Doors With Panels"** after `step-bm1` and
   confirm its panels read Flat / Ovolo and its production is £49.32 less than
   the same drawing made before the run, while its two mid rails still fire
   "Door Muntin" 2 × 60.

---

# e2e after the deploy

Deploy confirmed by decoding `/version.json`: **`mvb6dtvq` = 16:21:53Z**, after
the last commit at `17:51:09+01:00` = 16:51:09Z — the Vercel build for this
push. `public/version.json` is left uncommitted, as CLAUDE.md says.

`npm run e2e`: **7 passed** (24.9s).

```
ok 1 logs in
ok 2 every benchmark passes except the parked residuals
ok 3 the fanlight drawing shows Fanlight A1 and Casement Sash A2
ok 4 a casement drawing offers Bi-Glass in Type of Work
ok 5 selecting Finish & Ironmongery keeps unsaved edits unsaved
ok 6 the validation panel loads without an error
ok 7 every drawing card on the L507712 quote matrix shows a price
```

## It took two goes, and the first failure was the real check working

The first run failed test 2 — the live benchmark page — with exactly the five
rows this step moved:

```
FD4 should read BY DESIGN on the page, reads PASS
FD4 now PASSES but GlazePro should be £-49.32 dearer on purpose
FT1 is deliberately dearer by cost £6.28, now cost £30.94
FT2 is deliberately dearer by cost £-10.99, now cost £13.67
FT3 is deliberately dearer by cost £12.07, now cost £36.73
FT4 is deliberately dearer by cost £21.60, now cost £70.92
```

**The live engine was right and the spec's own table was stale.** That table in
`e2e/smoke.spec.js` holds each benchmark's declared difference, so the live page
is checked against what the step intends rather than against itself. Updating
it is the mirror of item 2: FT1 30.94, FT2 13.67, FT3 36.73, FT4 70.92, and
**FD4 removed from the table altogether**, because it is exact now and the page
should read PASS on it. That is the assertion that confirms it: the row is
checked for `PASS` precisely because it is no longer declared.

The deployed figures matching item 2's offline figures to the penny is the
useful part — it says the change reached the live engine and not only the
fixtures.

## Why LQ1, LQ3 and LQ4 pass here but fail offline

Worth saying, because it looks inconsistent. The live page reads the
`integrate-targets.json` in the **deploy**, and that file is still the version
with the surround and shutters `known_gaps` in it — the reviewer's edit
removing them is uncommitted here on purpose, because it is **Step BN's item
0**. So live still declares those gaps and the rows pass; offline the three
tests read the edited file and fail. Step BN closes that, and the next deploy
carries the edited targets.
