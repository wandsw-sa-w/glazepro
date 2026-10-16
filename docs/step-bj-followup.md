# Step BJ follow-up — Bi-glass cannot be chosen on the live board (reviewer, 16 Oct 2026)

sql/step-bj1 RAN live 16 Oct (rule 15 now ends "and (frame_to_be_replaced or is_bi_glass)", the only rule
mentioning is_bi_glass in group Casements). BG3's AWAITING_SQL entry can go.

## The blocker
On L507712 item 8 the reviewer made drawing 69 from "Opener, Fixed, Opener (Configuration 4)". Its **Type of Work**
select offers only **Complete New / No Work**. The Step AP filter in src/pages/DrawingBoard.jsx (PropertyField,
`field.field_key === 'drawingItemPart.typeOfWork' && casementDrawing`) still strips every other type of work from a
casement drawing, so nobody can reach `applyBiGlassCasement` from the board. The offline tests drove the rule directly
and never went through the select.

## The work
1. Offer **Bi-glass** on a casement WINDOW drawing, in addition to Complete New and No Work. Use exactly the scope the
   step already uses (`isCasementTree` in biGlassCasement.js and the engine's `is_casement_window`), so it shows up
   wherever a switch would actually apply and price, and nowhere else. Never on a door, French door, stable door or
   flag-frame set. Say in the report whether a French casement and a direct-glazed-only frame are in or out, and why.
   New Pair of Sashes, Draught Seal and Cill Only stay hidden on casements.
2. A test at the level the reviewer hit: the options the Type of Work field renders for (a) a casement window,
   (b) a door, (c) a box sash. Plus an e2e step that opens a casement drawing on L507712 and finds "Bi-glass" in the
   Type of Work select. It only needs to read the option, not save anything.
3. Selecting it must run `applyBiGlassCasement` on the same path as the offline tests: sash = opening, glass Single and
   to be replaced, MPLS off, surround cleared. Switching back to Complete New must restore it. Check that selecting it
   from the select really triggers the rule and doesn't only change the value.
4. Every benchmark unchanged. Deploy, and run e2e.

## Report
docs/reports/step-bj-followup.md: the filter change, the scope chosen, the tests. The reviewer will then switch drawing
69 live (expect £639.05 cost / £1,278.08 price with no stored ironmongery: BG3 less its stored ironmongery,
13.00 h fitting, 2.00 h production) and make a single casement too.
