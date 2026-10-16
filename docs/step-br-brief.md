# Step BR — several frames coupled in one item, for any product (reviewer)

Facts: docs/integrate-drawing-gaps.txt, section 4 (C1). Commit this brief as item 0.

## Today
Step BC built containers of coupled frames for a door with flag frames. Integrate allows any frames in one item.
L34268 item 13 couples three in one container:
- A glazed frame with two DG units over a panel set straight in the frame.
- A panelled door frame.
- A small DG frame, 900 high beside 2200-high frames.

The frames have different heights, and the panel sits under a transom that spans both columns.

## The work
1. On the board, add a frame of any type to an item beside an existing one: door, casement, DG or fixed. Each
   frame has its own width, height and grid, as the flag frames do now. Frames of different heights sit on a common
   cill line, as in C1.
2. A **panel straight in a frame** (no sash), as C1's A2:
   - Priced with "Panel to Frame" 80 and the panel-type rule (VTG 180 in C1; flat 60 by default).
   - Also Tricoya on the panel area.
3. Pricing as Integrate for C1 (production listed in the facts):
   - "Frame with Doors/Casements and Direct Glazed" 75.
   - "Machining & Joining a Casement Frame" and "Extra over for direct glazed" once per DG frame.
   - The door frame and leaf rules for the door frame.
   - Fitting: Single Door Only 660, Direct Glazed Unit 3 x 45, "1.75sqm Direct Glazed Unit in Frame" 70.
4. A benchmark CF1 = C1 (Integrate 3,545.21 / 7,090.37), with a board-path test. The C1 panels are vertical
   tongue & groove (114), going by the VTG lines. If BP's panel-type choice has landed, use it; if not, declare the
   panel difference.
5. Every benchmark unchanged, the CD flag-frame ones in particular. Deploy, run e2e.

## Report
docs/reports/step-br.md: how mixed frames are added and stored; CF1 group by group; what the reviewer should draw.

## Not in this step
Bays (box sashes or casements coupled at an angle; Integrate bayType 170-176) have their own rules (`is_*_bay`).
Nathan to decide when.
