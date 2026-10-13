# Step BC board, part 2 — the last three panels, and the drawing history

Done 13 Oct 2026. Brief: the reviewer's part 2 of 13 Oct, after checking part 1
live on L507712 drawing 40 (everything in that brief working).

**No pricing change, and none expected.** No rule, profile value, benchmark
target or fixture was touched; every benchmark including CD1–CD4 is where it was.

**No SQL.**

Commit: `d8389a4`, and this report.

---

## 1. Three panels still saw only the first frame

**Files:** `src/drawingBoard/casementOpenings.js`, `src/pages/DrawingBoard.jsx`.

All three resolved the opening themselves against `openingNodes(tree)` — the
**first** frame's openings — so on a coupled set they went blank for everything
outside frame A:

| | What the surveyor saw |
|---|---|
| the **"change to:"** and operation bar | selecting Fanlight B1, or any opening in any other frame, showed **no bar at all** |
| the **split-one-opening** target | the divider palette's 1 × 2 / 2 × 1 tiles split **nothing** |
| **Divider Spacing** | offered on frames with no divider of their own, and pressing it re-spaced a frame nobody was looking at |

The third was worse than blank: it counted `findAll(tree, 'mullionPart')` and
`findAll(tree, 'transomPart')` across the **whole drawing**, so one frame's
mullion enabled "Make Widths Equal" on every frame of the set.

### One answer again

```
openingOf(tree, node)          the opening a node IS or belongs to, in its own frame
dividerSpacingFor(tree, node)  what Divider Spacing can do, counting THAT frame's dividers
```

`openingOf` resolves a casement sash's **glass** and a French **leaf** to the
opening that holds them — which is what these panels mean by "the opening", and
what the three of them each re-implemented. The two whole-tree `findAll` counts
are gone with it.

**The grep the brief asked for comes back empty**: no `openingNodes`,
`columnCount`, `rowCount` or `frameCells` call without a frame is left in
`DrawingBoard.jsx`.

## 2. The drawing history

**Files:** `src/drawingBoard/diffTrees.js`, `src/pages/DrawingBoard.jsx`.

`diffTrees` flattens both trees by **structural type path**, so a coupled set's
frames were `#1` / `#2` / `#3` and were paired **by position**. Remove the left
flag and the door frame lined up against it:

> Frame — Width: 650 → 1082

A change nobody made, on a frame that had not moved — and under a name that
could have been any of the three.

Two changes, and the second is the one that matters:

- **`labelFor`**, a label callback. The board passes `partLabel(node, tree)`, so
  the frames read **"Frame A" / "Frame B" / "Frame C"**. The ancestors in a part
  path are part *types*, not nodes, so they keep coming from the map.
- **Sibling frames are paired by their KEY**, which survives an edit. So the
  frame that changed is the one reported, and a frame added or removed reads as
  **(added)** or **(removed)** instead of as a size change.

The key-pairing is scoped to a parent holding **more than one** frame, because
an existing test requires two structurally identical trees with **different
keys** to diff as no changes. A one-frame drawing keeps the structural path it
has always had.

## What the tests show

**Tests first, through the board path** — 11 new in
`src/drawingBoard/coupledBoardActions.test.js`, each failing before the fix:

- `openingOf` on a frame, an opening, an opening's glass, a door leaf, and a
  node that is in no opening at all;
- every opening of every frame having a kind — the change-to bar's own
  condition — and the door leaf's being `single_door`;
- Divider Spacing seeing frame C's new mullion and **not** offering widths on
  frame A;
- the history reporting an edit in frame C as **Frame C**, a removal as
  **(removed)** with no size change anywhere, an addition as **(added)**, and a
  one-frame drawing exactly as before.

**Three of my own test fixtures were wrong, and I corrected the tests, not the
code:** `diffTrees` reports a field only when its definition has
`role: 'input'`, and a part path carries its ancestors (`"Item > Frame"`, not
`"Frame"`). Worth saying because a test that passes for the wrong reason is
worse than no test.

**Offline: 1,685 passing, 8 failing — the standing eight, unchanged.**
`npx vitest run`, 74 files. No benchmark moved.

**Live: 5 of 5 passed (27.9s)**, against the deploy of `d8389a4` —
`/version.json` reads `mv76iqbb`, built 2026-10-13 22:14:37 BST:

```
ok 1 logs in (4.6s)
ok 2 every benchmark passes except the parked residuals (6.2s)
ok 3 the fanlight drawing shows Fanlight A1 and Casement Sash A2 (8.9s)
ok 4 the validation panel loads without an error (3.9s)
ok 5 every drawing card on the L507712 quote matrix shows a price (3.8s)
```

## Not verified against the live database

- **Nobody has clicked these three panels on the live board.** Each is covered
  by a test through the function the panel calls, and each panel is now one call
  rather than its own copy of the logic — but drawing 40 is what would prove the
  screen.
- **The history was not read live.** The pairing and the labels are tested
  offline; the reviewer saw the old behaviour on a real drawing, and the same
  drawing is what would confirm the new.
- **No drawing was saved**, as in both earlier board sessions.
- **`sql/step-bc3` is still unrun** — the right-hand template fix, unrelated to
  this step and still the one thing outstanding on a coupled set.

## Anything that did not behave as the brief describes

- **The history fix went further than "label frames A/B/C".** Labelling alone
  would have turned a wrong line into a wrongly-named line — "Frame A — Width:
  650 → 1082" — so the pairing had to be fixed for the label to mean anything.
  The brief said "if simple"; pairing by key where there is more than one frame
  is four lines and one condition, and it is in a module with its own tests.
- **`partLabel` is now imported by `diffTrees`'s caller, not by `diffTrees`.**
  The module stays label-agnostic and takes a callback, so nothing in it knows
  about doors.
- **Pre-existing eslint errors** unchanged in count (16 lines' worth in
  `DrawingBoard.jsx`); moving the three panels onto the helpers left
  `openingNodes` unused there and I removed the import.
- `public/version.json` is left uncommitted on purpose, as CLAUDE.md says.
