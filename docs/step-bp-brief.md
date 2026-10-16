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

## Reviewer notes, 16 Oct evening (what has landed since this was written)
- Step BO HAS landed: stored ironmongery sets exist (paintAndIronmongeryPart.values.ironmongeryLines, picked
  through the catalogue). So DG1 / DG2 / DM1 fixtures carry their Integrate sets from the facts, not a known gap.
- Step BS HAS landed: special glass tick (glassPart.values.specialGlassDetails) and POA lines
  (pricePart.values.poaLines). So add **FT5 = P1** (L34355 item 7, facts section 5 + G4 + M2) as a full benchmark
  in item 4: side casements A2 / C2 glass over a 200 mid rail and panel, front-door leaf with a full-height 120
  muntin, every glazed opening special glass, the 120-minute labour POA line, stored ironmongery.
  Expect 5,061.10 / 10,122.24, glass 0, labour 31.50 h, production per the facts.
- Step BQ has NOT landed: G2's short transom is still not drawable. Build DG2 with the transom as the board can do
  today and declare the difference, as item 4 already says.
- Item 0 (extra): the board shows a door panel's type and bead as a NUMBER box (that is how drawing 105's panel
  5379 got blanked to null, and why sql/reviewer-drawing105-flat-panels.sql was needed). On EVERY panelPart — door
  leaves included, not only the new casement ones — internalPanelTypeId / externalPanelTypeId must be a dropdown of
  flat / raised_and_fielded / vtg / htg and the beads a dropdown of ovolo / bolection / bespoke (Integrate 110 /
  112 / 114 / 116 and 120 / 126 / 320). An existing null must show as "— select —" and price as flat until set;
  say in the report if you price null differently.
- SQL: expect none unless a template needs a new part; any template change goes in sql/step-bp*.sql for the
  reviewer (templates are drawing_templates.tree, id bigint).
