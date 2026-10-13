# Step BC board — make the drawing board work on a coupled set (reviewer's brief, 13 Oct 2026)

Found by the reviewer on the LIVE board (deploy mv756ydw), L507712 drawing 39 ("Single Door With
Flag And Fan Lights", three frames 650 | 1082 | 650). Nothing was saved; the edits were discarded.

## What is wrong (live)

1. **Frame size edits go to the FIRST frame, whatever frame is selected.**
   - Selected frame C (right flag, panel showed 650 x 1632) and typed width 720: frame A (left flag)
     became 720 wide; C stayed 650. The summary moved to 2358 x 2496.
   - Selected frame B (door frame, panel 1082 x 2496) and typed height 2450: frame A became 2450 high;
     B stayed 2496.
   - The panel itself still showed the selected frame's own (unchanged) values afterwards.
   - "‹ Frame" / "Frame ›" stepping between frames DOES work (A 700, B 1082, C 650 read correctly).
2. **Adding / removing a flag frame is not on the board at all.** `addFlagFrame` and `removeFrame`
   (src/drawingBoard/doorOpenings.js) exist and are tested, but nothing calls them. The toolbar's
   "Copy frame" is still the disabled stub ("multi-frame items — coming soon"); "Remove" only removes
   a mullion, transom or bar. Brief docs/step-bc-coupled-flag-frames-brief.md section 5 asked for both.
   The Step BC report said the add / remove paths were covered by tests — they are, but only as
   functions.
3. **The parts list shows the door leaf as "doorLeafPart"** on a coupled drawing (should read like
   "Door Leaf B2" / as on a one-frame single door).

## Where the code still assumes one frame (read, not exhaustive — find them all)

`findFirst(tree, 'assemblyFramePart')` in: DrawingBoard.jsx 989, 1046, 2331-2332 (selection index),
2403 (currentFrameGrid), 2407 / 2422 (handleApplyDividers / applyDividersNow — the Transom / Mullion
picker; also counts mullions / transoms across the WHOLE tree and takes the first cillPart),
2461, 2507, 2542; casementOpenings.js 303, 697-713, 790, 873 (isCasementFrameTree), 891 (changeOpening —
returns "unchanged" for an opening in any frame but the first), 1191; computeDerived.js 101;
internalSize.js 71 / 97 / 117; sashThickness.js 114 / 169; stormproof.js 83. Whatever handles the
frame's Width / Height fields is among them.

## What to do

- Every board action resolves the frame that OWNS the selected node (`frameOwning` / `theFrame` from
  Step BC), never the first frame: frame size, internal size entry, the divider picker (its grid, its
  counts, its cill), change opening, glazing bars, stormproof, sash thickness, the selection index.
  A one-frame drawing must behave exactly as today (every existing board-path test unchanged).
- Wire **add a flag frame left / right of the selected frame** (Integrate: "Copy selected frame to
  left / right") and **remove the selected frame** into the toolbar, using `addFlagFrame` /
  `removeFrame` as they are (refuse the door frame and the last frame; unwrap the container back to one
  frame). Replace the "Copy frame" stub.
- The door leaf's label in the parts list on a coupled set.
- Tests FIRST, through the board path (the same functions the buttons call), each failing before the
  fix: resize frame C changes C only; resize the door frame changes it only; the divider picker on a
  flag frame adds the divider to that frame only; change opening in frame C; add flag left / right
  then remove it back to one frame; the set's size label follows each.
- No pricing change is expected: CD1-CD4 and every benchmark must stay where they are.

## Report
docs/reports/step-bc-board.md. No SQL is expected; if any is needed, sql/step-bc4-*.sql with SECTION 0
and a DO NOT RUN rollback, for the reviewer. `npm run e2e` after deploy.

Also fix while here: sql/step-bc3's rollback comment says re-running bc2 restores a LEFT-hand door —
since the follow-up bc2 writes right hand, so that line is wrong.
