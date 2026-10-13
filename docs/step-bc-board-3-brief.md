# Step BC board, part 3 — the helpers below the board still read the first frame (reviewer, 13 Oct 2026)

Checked LIVE on L507712 drawing 40 (door frame A 1082 x 2450 with fanlight | flag B 693 x 1136), deploy mv76kxoo.

## Part 2 works live
- The change-to / operation bar appears for Casement Sash B1; top hung and Opening casement apply to B1 only.
- Divider Spacing: absent on B1 (frame B has no dividers); on frame A, Make Widths Equal disabled, Make Heights Equal enabled.
- History: "Item > Frames > Frame B — Width: 693 → 700" and back. Correct.

## Still wrong — SPLIT ONE OPENING in a frame other than the first (live)
Selected Casement Sash B1, Transom / Mullion…, the dialog said "Split B1 …", picked 1x2:
- the elevation drew B1 / B2 with the top light 150.5 high — the offset came from FRAME A's cell
  (A's fanlight row), not B's own 1052 interior;
- the parts list showed "Fanlight B1 | Fanlight B1"; clicking either selects B1;
- after Undo (x3, back to the saved tree) the parts list still listed two openings in frame B until a reload.
On one-frame drawing 24 the same split labels A1 / A2 / A3 and Undo refreshes correctly — so it is the coupled set.

Cause (read): src/drawingBoard/gridActions.js — `splitOpening` (line ~370 `frameCells(tree)`) and
`insertBoundedDivider` (~436 `oldCells = frameCells(tree)`, ~445 `newCells = frameCells(withDivider)`) take the
FIRST frame's cells. With frame A's two cells and frame B's one opening, the second "placed" opening resolves to
`openings[sourceIndex]` again and is returned as the SAME object (`used` holds oldIdx 1, not 0) — so frame B gets two
children with the SAME KEY. That explains the duplicate label and React's stale list after Undo. If saved, the
duplicate key would be stored.

## The same fault elsewhere (read, not yet seen live) — every call that names no frame
- gridActions.js ~498 `makeDividersEqual`: takes the right frame but `frameInterior(tree)` — the FIRST frame's
  interior — so Make Widths / Heights Equal on frame B or C spaces with the wrong total.
- casementOpenings.js ~972-975 (`changeOpening`'s intoFanlight test: `openingNodes(tree)`, `frameCells(tree)`,
  `rowCount(tree)`) and ~1327-1335 `applyFanlightBottomRails` (runs after every split and picker pick) — first frame
  only, so a fanlight made in frame B / C does not get the 62 fanlight rail.
- computeDerived.js ~173 `frameOpenings(tree)`: the read-only Internal Frame Width / Height on a casement sash
  panel in frames B / C comes from frame A.
- casementGeometry.js ~442 `shortDividerSpanMm` (`frameRows(tree)` / `frameColumns(tree)` — it already has `frame`)
  and ~484 `frenchPairFor` (`openingNodes(tree)`). Pricing-side; no door priced today has a short divider or a French
  pair outside frame A, but they are the same bug.
- Leave `casementFrameTimberVolumeDm3` / `frameMuntinLengthM` single-frame (casement windows only — Step BC said so).

## What to do
- Pass the frame through every one of these (and grep the whole of src/ — drawingBoard, pages, pricing,
  renderElevation — for frameCells / openingNodes / rowCount / columnCount / frameRows / frameColumns /
  frameInterior / frameOpenings / findFirst(…'assemblyFramePart'…) called without a frame, and decide each).
- Make it impossible to put two nodes with one key in a tree: `insertBoundedDivider` must clone (cloneWithNewKeys)
  whenever a source has already been placed, whatever index; and a save-time check (assertSaveable) should refuse a
  tree with duplicate keys, saying which.
- Tests first through the board path: split B1 on a two-frame set (offset from B's own cell, two distinct keys,
  labels B1 / B2, Fanlight + Casement Sash), make heights equal on frame B, a fanlight made in frame B gets the
  62 rail, a sash panel's internal size in frame B, duplicate keys refused on save.
- Small, while here: a SINGLE DOOR leaf shows the casement operation buttons (fix / top hung / bottom hung …) in the
  change-to bar. A door leaf's hand is left / right only — show just those two (or none) for a door leaf.
- No pricing change expected for any benchmark or for drawings 35-40.

Report: docs/reports/step-bc-board-3.md. `npm run e2e` after deploy. (Note for the report: sql/step-bc3 WAS run by
the reviewer on 13 Oct, 21:40 — the template is right hand live.)
