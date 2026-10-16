# Step BM — board fixes from the live-quote comparison (reviewer, 16 Oct 2026)

Facts: docs/integrate-live-quotes.txt (as Step BL). This step touches the board and the board-to-tree path, not the
rules. Commit this brief as item 0.

## The work

1. **Arched glass on the live board.** Benchmark C (frame-level arched box sash) prices the arched unit right
   offline: Shaped Glass Cost 0.32 m2 at 71.88. On the live board it doesn't:
   - **Frame-level arch.** Live 121 is L34265 item 3: box sash 780 × 1769, rise 363, R 270, top sash
     isFrameLevelArch. It prices Shaped Glass Cost at 0.49 m2 × 58.50, the square-pane cost on a larger area.
     Integrate prices it at 0.30 × 71.88.
   - **Sash-level arch in a square frame.** Live 122 / 123 are L34265 items 1 and 2: a double box, each top sash
     with rise 256 and R 256. They price 0.57 and 0.50 m2 at 58.50. Integrate prices 0.30 × 71.88 for each arched
     unit.

   Do the following:
   - Add a board-path test for an arched sash, as Step BJ did for bi-glass.
   - Compare the board-built tree with fixture C.
   - Fix whichever input the engine reads differently. Expect the shaped area and the shaped pane cost to come from
     the arch.
   - Say what Integrate does for a sash-level arch in a square frame. The facts file has items 1 and 2 in full.
2. **Double Box, second bay arch radius.** On 122 / 123 the second pair's top sash shows archRadius 296.82 for the
   same width and rise as the first (256). Its glass areas then differ from bay one. Fix it so each bay works out its
   own radius from its own width.
3. **"Finish & Ironmongery" drops unsaved edits.** To reproduce:
   1. Edit a part (glazing bar, opening type).
   2. Without saving, click "Finish & Ironmongery" in the parts tree.
   3. The Unsaved marker clears and Save greys out.
   4. Reload: the edits are gone.

   Selecting a part must never clear unsaved state. Add an e2e step that edits, selects F&I, saves, reloads and
   checks the edit stuck.
4. **"Add mid rail and panel" on a door leaf makes a flat panel.** Every Integrate door panel read (L33022 items 8 and
   12; L34268 item 2) is internal / external type 110 = raised & fielded, ovolo bead. GlazePro's "French Doors With
   Panels" template already uses raised & fielded. Make the added panel the same as the template's. Live 103 lost
   1 h production to this ("Additional for Flat Panel" 60 against "R&F" 120).
5. Every benchmark unchanged. Deploy, run e2e.

## Report
Write docs/reports/step-bm.md. Include what the reviewer should do live: re-price 121-123 and redraw a door with
"Add mid rail and panel".
