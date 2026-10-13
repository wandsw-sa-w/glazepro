# Step BC board, part 3 — the frame a split measures, and a door's operations

Done 13 Oct 2026. Brief: `docs/step-bc-board-3.md` (committed first as item 0,
`7506641`), written after part 2 was checked live on L507712 drawing 40.

**No pricing change, and none expected.** No rule, profile value, benchmark
target or fixture was touched; every benchmark including CD1–CD4 is where it was.

**No SQL written this step.** `sql/step-bc3` — the right-hand template fix from
the Step BC follow-up — **was run by the reviewer at 21:40**, so the "Single Door
With Flag And Fan Lights" template is right hand live and nothing is outstanding.

Commits: `7506641` (the brief), `dcc7125`, and this report.

---

## 1. Splitting one opening in frame B measured frame A

**File:** `src/drawingBoard/gridActions.js`.

`splitOpening` and `insertBoundedDivider` both read `frameCells(tree)` — the
**first** frame's cells — while acting on the frame the surveyor had selected.
On drawing 40 the reviewer picked 1 × 2 on **Casement Sash B1** and got a
**150.5-high** top light: that is frame A's fanlight row, measured on a frame
nobody had touched. Frame B's own interior is 1052 high, so its half is 505.5.

Both now take that frame's cells, before and after the divider goes in
(`frameCells(withDivider, frame.key)`).

### The duplicate key, which was the worse half

The placement loop gives each new cell the opening of the old cell its top-left
corner sits in, and **copies** a source that has already been placed. The
`used` set held the **old cell index**. With the cells coming from the wrong
frame, two different new cells could resolve to two different indices that
`openings[...]` answered with the **same node** — so the second placement was
not detected as a reuse, and one frame ended up holding **two children of one
key**:

- the parts list read **"Fanlight B1" twice**;
- clicking either row selected the same node;
- React kept a **stale list after Undo** (two siblings, one key);
- and a save would have stored the duplicate.

`used` now keys on **`source.key`**, the node itself. A node cannot be placed
twice however the cells line up — the bug is closed at its shape, not at its
cause.

## 2. The same first-frame read, everywhere else it was

Grepped across **all of `src/`**, not just the board:

| | was | now |
|---|---|---|
| `makeDividersEqual` | `frameInterior(tree)` | that frame's interior — evening up B or C spread its dividers across frame A's total |
| `applyFanlightBottomRails` | the first frame's openings | **every** frame, each judged against **its own** rows |
| `changeOpening`'s fanlight test | `rowCount(tree)` / `frameCells(tree)` | the opening's own frame, so an opening built into B's top row starts at the fanlight rail |
| `computeDerived` sash internal sizes | `frameOpenings(tree)` | every frame against its own openings — a B or C sash's panel showed frame A's width |
| `shortDividerSpanMm` | `frameRows(tree)` / `frameColumns(tree)` | the divider's own frame, which the function already resolved for its crossing dividers |
| `frenchPairFor` | `openingNodes(tree)` | the sash's own frame — a French pair outside frame A had no pair at all |

**What the grep leaves, deliberately:**

- **`renderElevation.jsx`** (`casementOpeningNodes(tree)`, `columnCount(tree)`,
  `frameOpenings(tree)`). Correct by construction: a coupled set is drawn by
  rendering **each frame on a one-frame tree** with the container replaced by
  that frame, so inside `CasementElevation` the first frame **is** that frame.
- **`casementFrameTimberVolumeDm3` and `frameMuntinLengthM`** in
  `casementGeometry.js`, which still take `frameInterior(tree)`. These are
  **pricing** reads (rules 160 and 121, casement windows only) computed once per
  item. Every coupled set so far is a **door**, where `isCasementFrame` is false
  and neither variable applies, so nothing live is wrong — but a coupled
  **casement** set would price frame A's timber only. Changing them moves money
  and needs Integrate's figures for a coupled casement, so it is **left for the
  reviewer**, not guessed at here.

## 3. A save refuses duplicate keys

**File:** `src/drawingBoard/containment.js`.

`duplicateKeys(tree)` returns every repeated key in tree order and
`assertSaveable` throws `duplicate key(s) in the tree: <keys>`. The fix above
stops the one path that produced them; this stops **any** path from writing that
shape to `drawing_parts`, where it would be a row-level conflict rather than a
screen glitch.

## 4. A single door leaf is not a casement

**Files:** `src/drawingBoard/casementOpenings.js`, `src/pages/DrawingBoard.jsx`.

The operation bar drew `CASEMENT_OPERATIONS` on everything — so a garden door
was offered **top hung** and **bottom hung**. And `setCasementOperation` knew a
casement sash and a *pair* leaf, but **not** a single `doorLeafPart`: on a
single door **every one of the five buttons did nothing at all**.

One list answers both now:

```
operationsFor(node)   a DOOR leaf  → ['fix', 'left_hand_hung', 'right_hand_hung']
                      a casement   → Integrate's five
```

Integrate's three on a leaf are Fix (11), Left Hand Hung (17) and Right Hand
Hung (18) — **Fix stays**, because a fixed leaf is how FD5's and FD6's doorsets
are made. A **French casement** leaf keeps the five: it is a casement sash, and
this step is about doors. The bar renders `operationsFor(selectedNode)` and
`setCasementOperation` validates against the same list, so the screen and the
tree cannot disagree about what a part can be.

## What the tests show

**Tests first, through the board path** — 8 new in
`src/drawingBoard/coupledBoardActions.test.js` (30 in the file), each failing
before its fix:

- splitting frame B's own opening from **B's own cell** (505.5, not 150.5), with
  frame A untouched;
- the split tree having **no duplicate key**, and the labels reading
  `Fanlight B1` / `Casement Sash B2`;
- `duplicateKeys` naming the repeat on a hand-broken tree, and `assertSaveable`
  throwing with the key in the message, while the real split is saveable;
- make-dividers-equal on B's own 1052 interior;
- a fanlight made in frame B taking Nathan's 62 rail while the one below keeps 86;
- a B sash's internal size being **599 × 1052**, B's own interior;
- `operationsFor` on a single door leaf, a French door leaf and a casement sash;
- the operation buttons actually **setting a door leaf's hand**, and refusing
  `top_hung` on it.

**Four of my own premises were wrong, and I corrected the tests, not the code:**

- the flag frame is **693 × 1136**, so its interior is **599** wide — I had
  written 556;
- a repeated subtree duplicates its **glass child's** key too, so
  `duplicateKeys` correctly returns two keys, not one;
- on the **door** profile `applyFanlightBottomRails` is a **deliberate no-op** —
  `casementSashPart.bottomHeight` is absent, so ordinary and fanlight both
  resolve to 58 and the function returns unchanged (Step AS). The test now uses a
  two-rail profile (86 / 62), which is what proves the per-frame fix;
- the single-door template leaf is **already left hand**, so setting it left hand
  was a no-op — the test sets it **right** hand.

Worth saying each time: a test that passes for the wrong reason is worse than no
test.

**Offline: 1,693 passing, 8 failing — the standing eight, unchanged**
(`npx vitest run`, 74 files: six Step W sash-weight rows, benchmarks A50 and D).
No benchmark moved. Eslint: 26 errors across these files, the same 26 as before
the step.

**Live: 5 of 5 passed (21.8s)**, against the deploy of `dcc7125` —
`/version.json` reads `mv77fh6t`, built 2026-10-13 21:40:05Z, 40 seconds after
the commit:

```
ok 1 logs in (4.8s)
ok 2 every benchmark passes except the parked residuals (5.1s)
ok 3 the fanlight drawing shows Fanlight A1 and Casement Sash A2 (2.8s)
ok 4 the validation panel loads without an error (2.8s)
ok 5 every drawing card on the L507712 quote matrix shows a price (5.5s)
```

## Not verified against the live database

- **Nobody has split an opening in frame B on the live board.** Drawing 40 is
  what would prove it; the offset, the cell, the labels and the absence of a
  duplicate key are covered offline through the functions the picker calls.
- **No drawing was saved**, so `assertSaveable`'s new refusal has not run
  against the real save path — only against a tree broken by hand.
- **The operation bar was not clicked on a live single door.** The three
  operations and the refusal are tested through `setCasementOperation`, which is
  the function the button calls.
- **`sql/step-bc3` was run by the reviewer at 21:40**, after this step's code was
  written; the template's hand is live but was not re-read here.

## Anything that did not behave as the brief describes

- **The duplicate key was not caused by the wrong cells alone.** The brief reads
  "the same opening placed twice with the SAME KEY" as a consequence of the
  offset bug; it is a second bug in the same loop (`used` keyed on an index that
  does not identify a node), and it would have survived the offset fix on any
  tree where two cells resolve to one source. Both are fixed.
- **`operationsFor` keeps Fix on a door leaf**, which the brief did not mention.
  Dropping it would have broken the fixed leaf of a doorset — FD5 and FD6 — and
  Integrate offers it. What went is top hung and bottom hung.
- **`setCasementOperation` no longer validates against `CASEMENT_OPERATIONS`**
  but against `operationsFor(node)`. That is what lets a door leaf through at
  all, and it also makes a casement operation on a door impossible from any
  caller, not just from the bar.
- **`DOOR_LEAF_LIKE` is exported from `casementGeometry.js`** rather than
  imported from `doorGeometry.js`, which imports that module — the same cycle
  the constant's original comment describes.
- **Two first-frame pricing reads are left in place on purpose**, as §2 records.
- `public/version.json` is left uncommitted on purpose, as CLAUDE.md says.
