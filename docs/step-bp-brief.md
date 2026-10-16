# Step BP — mid rails, panels and muntins inside casement sashes and door leaves (reviewer)

Facts: docs/integrate-drawing-gaps.txt, sections 1 and 2 (G1-G4, M1-M2). Commit it and this brief as item 0.
Before you start, read docs/step-bm-correction.md: Integrate's panel 110 is FLAT, and "Door Muntin" counts mid rails.

## What the board can't do today
1. A **casement sash** (window or doorset side / top light) can't hold a mid rail with glass over a panel. G1, G3 and
   G4 all have them. "Tricoya panel" doesn't work on a casement sash.
2. A casement sash can't be **all panel**: G2 A2 / B2, fixed panelled sashes under a transom.
3. A **door leaf** can't hold a **muntin**. M1 has a 120 muntin below the mid rail with two panels under one glass;
   M2 has one full height, giving two glass over two panels.

## The work
1. **Casement sash: mid rail and panel.** The same "Add mid rail and panel" a door leaf has, on any casement sash.
   - The mid rail is a transom inside the sash, with its own thickness: 170 in G1 / G3, 200 in G4.
   - Glass above, a panel below.
   - The panel defaults to flat (110), ovolo (120), both faces.
   - The panel's type and bead are editable, including Bolection (126).

   It must price as Integrate: Tricoya Panel on the visible panel area, Flat Panel 60, Door Muntin 60 per mid rail
   when the item has a new door leaf, Bolection mouldings when bolection, and the doorset rules (Sidelights /
   Fanlights in Doorsets) as now.
2. **Casement sash: all panel.** A cell button ("Panel") that turns a casement sash's glass into a panel, and back.
   G2 A2 / B2: Flat Panel 60 each, Tricoya on the panel area, no glass lines.
3. **Door leaf muntin.** A vertical divider inside a door leaf:
   - Full height, as M2.
   - Or confined to the part below or above the mid rail, as M1.

   Its thickness defaults to 120, as both readings. Each cell it makes takes glass or a panel. Door Muntin counts it.
4. **Board-path tests**, as Step BJ did, plus benchmarks:
   - **DG1 = G1, DG2 = G2, DM1 = M1.** Integrate's figures are in the facts. Include their stored ironmongery sets
     if Step BO has landed; otherwise declare the ironmongery difference as a known gap.
   - G2 needs a short transom (Step BQ). If BQ hasn't landed, build G2's fixture with the transom as the board can
     do today and declare the difference.
   - Every existing benchmark unchanged; FD4 is the one to watch.
5. Deploy, run e2e.

## Report
docs/reports/step-bp.md: the board controls; DG1 / DG2 / DM1 group by group; what the reviewer should draw live.
The reviewer will redraw L34242 items 7 and 8, L33022 item 7 and L34268 item 2 on the test leads and compare.
