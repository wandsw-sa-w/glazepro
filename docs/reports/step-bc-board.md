# Step BC board — the drawing board on a coupled set

Done 13 Oct 2026. Brief: `docs/step-bc-board-brief.md` (committed first,
`1d41204`).

**No pricing change, and none expected.** No rule, profile value, benchmark
target or fixture was touched; every benchmark including CD1–CD4 is exactly
where it was.

**No SQL was needed.** One existing SQL file's *comment* was corrected (see the
end).

Commits: `1d41204` the brief, `c684e60` the work, and this report.

---

## The bug, as the reviewer found it

On the live board (deploy `mv756ydw`, L507712 drawing 39, three frames
650 | 1082 | 650):

- selected frame **C** (panel showing 650 × 1632), typed width **720** → frame
  **A** became 720 wide, C stayed 650;
- selected frame **B** (the door frame), typed height **2450** → frame **A**
  became 2450 high;
- and the panel went on showing the selected frame's own, unchanged values.

**The drawing disagreed with the screen**, which is the worst way for this to
fail: nothing looked wrong until the next person opened it.

## One answer to "which frame"

**Files:** `src/drawingBoard/casementOpenings.js`,
`src/drawingBoard/internalSize.js`, `src/pages/DrawingBoard.jsx`.

```
actionFrameKey(tree, selectedKey)
```

resolves **the frame that owns the selection** — the frame itself, or any node
inside it, however deep — and falls back to the **first** frame when nothing is
selected, which is what a one-frame drawing has always meant by "the frame". It
is built on `resolveFrameArg`, which also accepts a frame, a key or a node, so
the pure functions take the same argument the board does.

Every handler now takes its frame from there instead of calling `findFirst`
itself:

| Action | Was | Now |
|---|---|---|
| frame Width / Height | `resizeCasementFrame(tree, …)` — the first frame | `…, nodeKey` — the frame being edited |
| the divider picker | the first frame; **every** frame's divider counts; the drawing's first cill | the selected frame, its **own** counts, its **own** cill |
| the picker's opening grid | the first frame's grid | the selected frame's |
| split an opening | the first frame | the frame holding that opening |
| make dividers equal | the first frame | the selected frame |
| remove a divider | the first frame's `removeDivider` | the divider's own frame |
| change an opening | — | the opening's own frame (below) |
| the selection after a change | the first frame's children | that frame's children |

### Three were wrong in their own right, not only on a set

- **`changeOpening`** looked the opening up in the **first frame's children**,
  so the "Change to:" buttons did nothing at all — returned `changed: false` —
  for an opening in any other frame.
- **`isCasementFrameTree`** read the first frame alone. A set whose first frame
  held only the door would have been treated as a **box sash**, and the parts
  list, the elevation and the divider picker all key off it. It now asks every
  frame.
- **`internalSizeOf` / `frameMargins`** took the first frame **and the drawing's
  first cill**, so a flag frame's internal size came out of the door frame's
  cill. Both now take the frame asked about, with its own cill.

## Add and remove are on the board now

**In place of the "Copy frame" stub** that said *"multi-frame items — coming
soon"*: **+ Flag left**, **+ Flag right** and **Remove frame**, shown on a
**door** drawing only (nothing else in GlazePro is sold with flag lights), and
labelled with the frame they act on — *"Frame B: + Flag left"*.

They call `addFlagFrame` and `removeFrame` as they already were:

- a **one-frame** drawing becomes a coupled set the first time a flag is added,
  and comes back out of the container when the last flag is removed — nothing
  migrates on its own;
- the **door's frame** and the **last** frame are refused, and the button is
  disabled with the reason in its tooltip rather than failing when pressed;
- a profile missing a door key reports it by name in the existing error line
  instead of adding a frame with guessed sections.

Integrate calls these "Copy selected frame to left / right". What Nathan sells
beside a door is a **flag light**, so the board adds one of those rather than a
copy of the selected frame — said here because it is a deliberate difference
from Integrate's wording.

**My Step BC report was wrong about these**, and the brief is right to correct
it: the add / remove paths *were* covered by tests, but only as functions —
nothing on the board called them. A test that exercises a function the UI never
reaches proves the function, not the feature.

## The parts list

**Files:** `src/drawingBoard/partLabels.js` (new), `src/pages/DrawingBoard.jsx`.

`partLabel` and `PART_LABELS` **moved out of `DrawingBoard.jsx`** so they could
be tested — the whole reason a coupled set showed its door leaf as the raw
**`doorLeafPart`** is that the map had no entry for it and the opening-label
branch covered only a casement sash and a direct glazed unit.

Two rules, both Integrate's:

- an **opening** is named for what it is and where it sits — "Single Door B2",
  "Fanlight A1", "Casement Sash C2" — so the parts list cannot be read in a
  different order from the drawing;
- on a **coupled set** the frames are "Frame A", "Frame B", "Frame C" rather
  than "Frame" three times over. A one-frame drawing's frame is still "Frame".

The map also gained the entries it was missing for door parts: the French pair
and its leaves, the single door leaf and a panel.

## What the tests show

**Tests first, through the same functions the buttons call** — 15 in
`src/drawingBoard/coupledBoardActions.test.js`, every one failing before the
fix:

- `actionFrameKey` resolving a frame, a node in it, a node two deep, nothing
  selected, and a key that is not in the tree;
- **resizing frame C changes C and nothing else** — the reviewer's 720;
- **resizing the door frame changes it only** — their 2450 — and the set's
  label follows (`2288 × 2450 mm (3 frames, coupled)`);
- a resize re-spacing only that frame's own mullions;
- a one-frame drawing resizing exactly as before (no frame argument at all);
- the divider picker, make-dividers-equal and remove-divider on the selected
  frame, with the others untouched;
- change-opening in frame C;
- the internal size per frame;
- add a flag left, add a flag right, remove back to one frame — with the
  container unwrapping, and the door's frame and the last frame refused;
- the labels, including "Single Door B2" and "Frame A".

Two of those tests started out asserting the wrong thing and I corrected the
**tests**, not the code: the divider picker *sets* the selected frame's grid, so
a 2 × 1 pick on a frame with a transom takes the transom with it. That is the
picker's own behaviour since Step AQ, and what matters here is that the other
frames keep theirs.

**Offline: 1,678 passing, 8 failing — the standing eight, unchanged.**
`npx vitest run`, 74 files, **15 new tests**. No benchmark moved.

**Live: 5 of 5 passed (20.7s)**, against the deploy of `c684e60` —
`/version.json` reads `mv7632z1`, built 2026-10-13 22:02:27 BST:

```
ok 1 logs in (5.6s)
ok 2 every benchmark passes except the parked residuals (4.2s)
ok 3 the fanlight drawing shows Fanlight A1 and Casement Sash A2 (2.3s)
ok 4 the validation panel loads without an error (3.6s)
ok 5 every drawing card on the L507712 quote matrix shows a price (4.3s)
```

## Not verified against the live database

- **Nobody has used the new buttons on the live board.** Every action is
  covered by a test through the function the button calls, and the buttons are
  three lines of wiring each — but the reviewer's own check is what would prove
  the screen. Drawing 39 is the one to try it on.
- **No drawing was saved.** As with the reviewer's own session, nothing in this
  step wrote to the database.
- **`sql/step-bc3` is still unrun** (the right-hand template fix from the
  follow-up). Unrelated to this step, but it is the one thing outstanding on a
  coupled set.
- The **elevation** on a coupled set is unchanged from Step BC and still
  untested by eye; only its labels were touched here, through `partLabel`.

## Anything that did not behave as the brief describes

- **`sql/step-bc3`'s rollback comment was wrong, and is corrected** (the brief
  asked). It said re-running `bc2` restores a left-hand door; the follow-up had
  already corrected `bc2` to write the **right**-hand tree, so re-running it now
  writes exactly what `bc3` writes. The `UPDATE` in the rollback is the only
  undo.
- **A commit needed remaking before it was pushed.** `git add -A src/pricing`
  swept in the two long-untracked `real-trees/*.raw.json` fixtures — the same
  slip as Step BB, and the same fix: the commit was remade with only this step's
  seven files. Those two files are still untracked and still waiting for whoever
  owns them. I will stop using `-A` on a directory.
- **`isDoorTree` is new** (`doorOpenings.js`): the flag-frame buttons needed
  "is this a door drawing at all", and `isFrenchDoorTree` only answered for a
  pair. Two tests.
- **Pre-existing eslint errors** unchanged in count: 16 lines' worth in
  `DrawingBoard.jsx`, where moving `partLabel` out briefly added two unused
  imports that I removed.
- `public/version.json` is left uncommitted on purpose, as CLAUDE.md says.
