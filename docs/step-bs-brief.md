# Step BS — special glass, and price-on-application lines (reviewer)

Facts: docs/integrate-drawing-gaps.txt, section 5 (P1, P2). Commit it (if not already) and this brief as item 0.
The reviewer will also update benchmark LQ4: its 3 h "unexplained" known gap is P2's POA line.

## What Integrate does
- **Special glass.** A glass part can be marked `specialGlassDetails`, with its glass codes set to a placeholder.
  The price file then charges no glass for that unit (L34355 item 7: the Glass group is empty) and prices
  everything else as normal. The special glass is priced outside the price file.
- **POA lines** on the item's Price part: a list of manual lines, each with type (labour / ...), category
  (installation / ...), a description and an amount.
  - A labour / installation line's amount is MINUTES, added to the installation hours.
  - P1: "Skirting to be cut temporarily ..." 120 → labour 31.5 h = 29.5 h fitting units + 2 h.
  - P2 (LQ4): "Frame buried extra rip out time" 180 → 25.25 h = 22.25 h + 3 h.
  - The PF30 "Drawing POA" extra-services rule (poa_cost × 1 × 2) covers cost lines.

## The work
1. **Special glass** on any glazing: a tick "Special glass (priced separately)". When ticked, no glass lines are
   charged for that unit, and the glazing shows it clearly. Every other line (glazing labour, beads, bars) stays.
   Read the snapshot for any rule that keys on special glass and say what you find.
2. **POA lines** on the Price part: add / edit / remove lines with type, category, description and amount.
   - Labour / installation adds minutes to the labour hours, as P1 / P2.
   - Cost lines go through "Drawing POA".
   - Read the snapshot for the other types and categories Integrate allows, and support the ones its rules read.
3. **Benchmarks.**
   - LQ4 with its POA line: the known gap goes; the reviewer edits the target in item 0.
   - FT5 = P1, the L34355 front door set, once Steps BP (mid rails, muntin) and BO (stored ironmongery) have
     landed. Until then, add P1 as a board-path test of the special glass and POA parts only.
4. Every benchmark unchanged. Deploy, run e2e.

## Report
docs/reports/step-bs.md and what the reviewer should enter live.

## Reviewer notes, 16 Oct evening (from the PF30 snapshot and the live quotes)
- The snapshot's "Special Glass" rule (manufacture_labour, 10 min per glass unit, condition
  `is_single_pane_special or is_inner_pane_special or is_outer_pane_special`, pfVariable special_glass = GL100045) is
  about a SPECIAL GLASS CODE, not about the placeholder. P1's production list has no "Special Glass" line, so the
  placeholder (specialGlassDetails + glassPlaceholder) must NOT fire it. The tick removes the glass lines and nothing
  else.
- "Drawing POA" (price rule, item level, quantity poa_cost x 1, markup 2, loop_target drawing_poa) is already in
  the snapshot. Say in the report what loop_target drawing_poa needs to iterate and what poa_cost should sum.
- integrate-targets.json: the reviewer has REMOVED LQ4's known_gaps block (labour -120.63). LQ4 now has to pass at
  2,464.13 / labour 25.25 h with the 180-minute POA line on its fixture. Commit that edit in item 0.
- Step BO has landed (stored ironmongery sets); BP (mid rails / muntins / panel dropdowns) has not. So FT5 = P1 stays
  a board-path test of the special-glass and POA parts only, as the brief says; it becomes a full benchmark after BP.
