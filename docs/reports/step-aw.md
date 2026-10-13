# Step AW — the Transom / Mullion picker, the way Integrate does it

Done 13 Oct 2026. Brief: `docs/step-aw-divider-picker-brief.md`.
**UI only.** The Step AV model — `startDivider` / `endDivider`, spanning
openings, short dividers — is untouched, the engine is still version 16, and
**no price moved**.

---

## 0. The reviewer's SQL edit, committed as written

`sql/step-av1-combination-casement-templates.sql` — the reviewer's edit,
committed unchanged and attributed (`a36e6f5`). **Nathan ran the edited file on
13 Oct.**

Fanlight bottom rails are **62** in the templates, not Integrate's 83: the five
top-row sashes that do not run the full height (template 7's A1, 12's A1 and
B1, 13's B1, 14's A1). That is Nathan's decision of 12 Oct that a new fanlight
defaults to 62, and the existing "Single Flush Casement with Fanlight" template
already used it. The benchmark fixtures keep Integrate's 83 as recorded. Sort
order 40 → 45, because 40 is the stormproof template.

**Correction to `docs/reports/step-av.md`.** That report said
`applyFanlightBottomRails` is "still a no-op until `sql/step-as0` gives the
profile its own `casementSashPart.bottomHeight`". **`sql/step-as0` has run** —
the live casement profile holds `casementSashPart.bottomHeight` 83 and
`defaultFanlightBottomHeight` 62, so the rule is live and a new fanlight gets
62. I cannot read live rows and should have said only that, not that the key
was absent.

## 1 & 2. The dialog

**File:** `src/pages/DrawingBoard.jsx`

Gone: the radio buttons ("Across the whole frame" / "In one column / one row
only"), the two drop-downs, the 15 × 15 hover grid and "Apply to frame".
`GridPickerDialog` is deleted — nothing else used it.

In its place, `DividerPaletteDialog`, which is Integrate's dialog as the
reviewer described it. Since there is no screenshot, here it is in words:

- A small white panel, centred, with a heading row: **"Transom / Mullion"** on
  the left and a **×** close button on the right. Clicking the backdrop or the
  × closes it. **There is no Apply button and no Cancel button.**
- Under a one-line grey note, a tight grid of **tiles**, 2 px apart. Each tile
  is a 30 × 30 **drawing** of the layout — a white square with a grey border,
  with `cols − 1` vertical and `rows − 1` indigo divider lines inside it — and
  the label **"2x1"** in 9 px grey underneath. Hovering a tile gives it an
  indigo border and a pale indigo fill.
- **One click on a tile applies it and the dialog closes.** Nothing is chosen
  and then confirmed, so there is no way for the selection and the preview to
  disagree, which is the bug Step AQ item 7 had to fix in the hover grid.

What the palette offers depends on the selection:

| selected | palette | what a click does |
|---|---|---|
| the frame, or nothing | **7 × 7**, 1x1 … 7x7 | divides the **whole frame** (`applyDividers`, as the hover grid did) |
| an **opening** | **two tiles**, 1x2 and 2x1 | splits **that opening** (`splitOpening`) |

The 7 × 7 palette runs down the screen in columns 1–7 and across in rows 1–7,
so "1x2" is one column and two rows — a transom — matching Integrate's reading
of the label. **The tile the frame is already on is marked** with a pale indigo
border and fill, so the palette still says what the frame is on and not only
what it could be; that is what Step AQ item 7 was for, and a palette with no
Apply button has nowhere else to put it.

A **box sash** always gets the whole-frame palette. Only a casement frame's
dividers can stop at each other, and a box sash's openings are its sash pairs
rather than frame cells.

**Which opening is "selected".** Integrate splits when the opening's *glazing*
is selected. On this board a casement sash's glass is a child of the sash, so
the selection is taken **up** to the opening it belongs to: clicking the glass
and clicking the sash both split the same opening. Selecting anything else —
the cill, the frame, a divider — gives the whole-frame palette.

## 3. Splitting one opening

**File:** `src/drawingBoard/gridActions.js`

`splitOpening(tree, frameKey, openingKey, axis, profileValues)` puts **one**
divider through that opening, stopping at whatever bounds it. The bounds come
from the opening's **cell**, on the axis the new divider crosses: a mullion is
bounded above and below by transoms, a transom left and right by mullions, and
`'0'` wherever that bound is the frame. Those are exactly the
`startDivider` / `endDivider` Step AV already wrote, so the two layouts come
out as Integrate has them:

| built as the brief describes | the divider written |
|---|---|
| the fanlight template → select the **lower** opening → **2x1** | mullion, `startDivider` = the transom, `endDivider` `'0'` → **TC1** |
| **2x1** on the frame → select **column B** → **1x2** | transom, `startDivider` = the mullion, `endDivider` `'0'` → **TC3** |

The divider goes in the **middle of the opening**, measured on its own axis.
Worth stating because it surprised me while writing the tests: splitting TC3's
column B with a transom puts it at **587**, not at half of 354 — at that moment
column B is the full 1201 high, because the transom that makes it 354 is the
one being added. The surveyor then types 354.

A **spanning** opening can be split: a mullion through TC1's fanlight gets
`endDivider` = the transom and `startDivider` `'0'`, so it exists in the top row
only, and the window has four openings. Both mullions go in at the middle of
what they split, so they are stacked at 502 until the surveyor moves one —
they are two separate dividers, which is Integrate's model, not one full-height
mullion. (For a plain 2 × 2 the whole-frame tile is the right tool.)

**The openings had to be kept on their cells.** `openingNodes` and `frameCells`
are matched by **position** everywhere — labels, sash sizes, the drawing — so
putting the copy in the wrong place would silently mislabel and mis-size a
window. The copy does **not** simply go on the end: splitting B1 of a 2 × 2
puts the new cell **third**, because the cells are read in row-major order and
column A then spans the two top rows. Rather than reason about where it
belongs, `insertBoundedDivider` now computes the cells **after** the divider
goes in and gives each cell the opening of the old cell its top-left corner
sits in; the split cell is hit twice and the second takes the copy.
`addDividerInCell` writes through the same function, so there is **one path**
for a bounded divider.

## 4. Divider Spacing

GlazePro had **no equivalent**. What existed: the picker spaces dividers
equally when it lays a grid out (`applyDividers`), and a resize re-spaces the
columns proportionally (`resizeCasementFrame`, Step AP). Neither can even up
dividers a surveyor has since moved, and nothing could be undone that way.

`makeDividersEqual(tree, frameKey, 'widths' | 'heights')` re-spaces the
mullions, or the transoms, so every column or row slot is the same size:
interior less the dividers' thickness, divided by the number of slots, offsets
stored to 1 dp as Integrate stores them. **Only offsets move** — no divider is
added or removed, none stops anywhere different, and the openings keep their
cells. A **short** divider is re-spaced with the rest, because a column slot is
a column slot whether the mullion that makes it reaches the cill or not; on TC1
that moves the short mullion from 493 to 502 and it still starts at the transom.

The two buttons sit at the **top of a selected opening's property panel**,
where Integrate has them, each disabled with a reason ("Needs a mullion" /
"Needs a transom") when there is nothing to even up.

## 5. What Step AV made, kept — and one thing that was never reached

Labels, the merge on Remove, the re-pointing, resize and the templates all
still work, and the tests cover each.

One of them was **written but unreachable from the board**. "Remove" called
`removeNode`, which dropped the divider node and nothing else — leaving one
opening per old column or row slot, and any divider that stopped at the removed
one pointing at a part that had gone. Step AV's `removeDivider` does the merge
and the re-pointing, but the button never called it. A casement mullion or
transom now goes through `removeDivider`; a glazing bar, and a box sash divider
whose openings are sash pairs rather than frame cells, still go through
`removeNode`.

## SQL files this step wrote

**None of my own.** The only SQL is the reviewer's edit to
`sql/step-av1-combination-casement-templates.sql`, committed as written in
`a36e6f5`. Nathan has run it.

## What the tests show

**1,466 passing, 8 failing** — the standing eight only (A50's top lead weight
+0.28, D's two double-box steel weights +0.54, six Step W counterweight-display
rows). Up from 1,455. **Every benchmark total is unchanged**, as a UI step
requires.

`src/drawingBoard/dividerPalette.test.js` — new, 11 tests:

- **TC1** built the brief's way: the fanlight template (a 1 × 2 casement frame
  — the tree `sql/step-ar1` stores was generated by this same code), resized to
  1105 × 1405 with the transom at 301, then **2x1** on the lower opening. The
  mullion stops at the transom, goes in at 502, and once the surveyor types 493
  the cells and sizes **equal `BENCHMARK_TC1`'s**: 1031 × 301, 493 × 983,
  511 × 983, labelled A1, A2, B2.
- **TC3**: **2x1** on the frame, mullion to 543, then **1x2** on column B. The
  transom stops at the mullion, goes in at 587, and at 354 the tree equals
  `BENCHMARK_TC3`'s: 543 × 1201, 561 × 354, 561 × 820, labelled A1, B1, B2,
  with A1 a Casement Sash (not a fanlight) on the 83 rail and B1 a Fanlight on
  62.
- Splitting a **spanning** opening: four openings, the new mullion ending at
  the transom, and the cells correct once it has its own offset.
- Splitting **B1 of a 2 × 2**: five cells in the right order, every surveyor
  opening still on its own cell and the copy third — the case that would
  mislabel a window if the realignment were wrong.
- A selection that is not an opening of the frame (a bad key, the cill) changes
  nothing; a profile with no `thicknessInFrameSolid` adds nothing and says why.
- Remove merges, resize keeps the span.
- **Make Widths / Heights Equal**: 543/561 → 552/552, rows → 642/642, the short
  mullion re-spaced and still starting at the transom, and a frame with nothing
  to even up returned untouched.

`src/drawingBoard/gridActions.test.js` (31) and
`src/drawingBoard/combinationCasement.test.js` (20) pass unchanged, which is
what says the refactor of `insertBoundedDivider` did not move the Step AV
behaviour.

## Not verified

- **The dialog and the panel on screen.** The build passes and the board code
  is tested, but nothing in this step was clicked in a browser. The description
  in items 1 and 2 is what the code renders, not what I have seen rendered —
  the reviewer will check it on the live site.
- **That the palette matches Integrate's layout pixel for pixel.** The
  reviewer's reading gives the tiles, the labels, the one-click behaviour, the
  title and the close cross; the sizes, spacing and colours are this board's
  own and were chosen to sit with its other dialogs.
- **Nothing in the live database.** `sql/step-av1` is the reviewer's and Nathan
  has run it; I cannot read live rows to confirm what the four templates now
  hold.
- **"Divider Spacing" within one opening's run.** Integrate puts the buttons on
  an opening's panel, which may mean it evens up only the dividers bounding
  that opening. This evens up the **whole frame's** mullions or transoms, which
  is what "Make Widths Equal" plainly says and is what a single column slot
  needs anyway. If Integrate scopes it to the opening, that is a difference to
  settle on a drawing with three or more columns.
- **The 7 × 7 limit.** Integrate stops at 7 × 7; `applyDividers` has no such
  limit and the old dialog offered 15 × 15. Nothing prevents a wider frame from
  being built by other means, and no drawing in the benchmarks has more than
  two columns or two rows.
