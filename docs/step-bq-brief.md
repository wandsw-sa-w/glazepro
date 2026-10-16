# Step BQ — a frame divider that spans only some cells (reviewer)

Facts: docs/integrate-drawing-gaps.txt, section 3 (S1) and G2. Commit this brief as item 0.

## What Integrate does
Every MullionPart and TransomPart carries `startDivider` / `endDivider`: 0 means it runs to the frame, otherwise
it is the divider it stops at. L34242 item 7 has a frame transom at 962.5 that runs from the left jamb to the second
mullion only, so the two left columns are split and the door column on the right is full height.

GlazePro's frame tiles split one cell at a time. A transom across two cells today needs two separate transoms. That
is a different part count for the "Additional for Frame Mullion or Transom" (180 each) and different timber.

## The work
1. On the board, let a frame mullion or transom be extended across neighbouring cells, or drawn from one divider to
   another: one part with a start and an end, stored like Integrate's. Show it as one part in the tree.
2. Pricing: one divider counts once for "Additional for Frame Mullion or Transom", and its timber length is its
   real span. G2's production has 3 x 180 for two mullions and one short transom.
3. A board-path test drawing G2's frame grid. When Step BP has landed, the full G2 benchmark (DG2) passes with no
   divider gap.
4. Every benchmark unchanged. Deploy, run e2e.

## Report
docs/reports/step-bq.md: how a spanning divider is stored and drawn, and what the reviewer should draw live.
