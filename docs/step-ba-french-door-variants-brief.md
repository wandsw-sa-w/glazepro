# Step BA — French door variants: panels, side lights, top lights, casement lights

Written by the reviewer, 13 Oct. CLAUDE.md applies (short chat reply; detail in docs/reports/step-ba.md).
Facts: docs/integrate-L31115-french-doors.txt — the "French door variants" section (FD4, FD5, FD6). integrate-targets.json:
the reviewer has added benchmarkFD4, FD5, FD6 — commit them and the facts as recorded.
Nathan (13 Oct): "push on with French doors". Every FD4–FD6 figure reconciles with rules GlazePro already has — the work is
the TREE (board + templates) and the section allocation, not new pricing rules. If a benchmark needs a new pricing RULE,
stop and report.

## 1. FD4 — panelled leaves (Integrate template 79)
- A door leaf can hold a MID RAIL (Integrate: a TransomPart inside the leaf, isMidrail, 170 thick) splitting the leaf
  into glass above and a PANEL below. Model it the way GlazePro models a divider today (say how), with the board able to
  add/remove a leaf mid rail and set its height. Containment SQL only if a pair is missing (check live first).
- CORRECTION 14 Oct 2026 (Step BF): id 110 is **FLAT**, not raised & fielded (112 is R&F) — read in Integrate’s own
  panel-type dialog, docs/integrate-L31115-stable-doors.txt. The line below is wrong and is left as written.
- Panel: raised & fielded both sides, ovolo bead (Integrate ids 110 / 120 -> GlazePro panel_type raised_and_fielded,
  panel_bead ovolo — confirm against reference_options), Tricoya. The live rules "Tricoya Panel" (visible W x H, unrounded)
  and "Additional for R&F Panel" (120 min, loop panel) must fire per panel.
- Sections: the mid rail is cut from Utile63x200 at leaf width - 10 (single reading, comment it).
- Expect FD4 EXACT in every line.

## 2. FD5 / FD6 — doorsets (Integrate templates 29 and 46)
- A door frame with two full-height mullions and a full-width transom: the French pair in the middle bottom opening, a
  FIXED casement sash each side (side lights), and in the top row either three direct glazed units (FD5) or three fixed
  casement sashes (FD6). Reuse the casement divider model (Step AV) — the pair is just another opening kind.
- Per casement sash in a door frame: is_item_a_door true; is_fanlight true above a transom (Fanlights in Doorsets 300),
  false beside the door (Sidelights in Doorsets 780). Check every rule in the facts' reconciliations fires as listed —
  incl. Door Frame Single Finish (Mullions) 85 x 3, Additional for Frame Mullion or Transom 180 x 3, Frame with
  Doors/Casements and Direct Glazed 75, Direct Glazed Unit 45, Fixed Fanlight 120, 1.75sqm DGU (Small) 70,
  Any Sash Overweight (Casement) 45.
- Direct glazed units in a door frame: clearance 15, hidden 12 (FD5's A1 has hidden 0 — an Integrate template quirk;
  the fixture keeps it, GlazePro's template uses 12).
- Sections: side lights and fanlights as the fanlight rule (63x63 W + 2H + 14; 86 rail at 63x96 W, 62 rail at 63x63 W).
- Deliberate difference (Nathan's transom decision, applied by the reviewer to doorset mullions too — flagged to Nathan):
  frame mullions and transom are charged at Utile67x96 for their full internal length (FD5/FD6: transom 2720 + mullions
  2 x 2626 = 7972 mm = 108.42 cost). FD5 and FD6 then match Integrate in every line except manufacture_materials,
  +108.42 exactly — show them as BY DESIGN on the benchmark page with the amount pinned, as FD3/FD3b.

## 3. Templates (SQL; the reviewer runs it)
"French Doors With Panels" (79, 1399 x 2199), "French Doors With Side And Top Lights" (29, 2814 x 2710, DGU top lights),
"French Door Set With Casement Lights" (46, 2814 x 2710), group "Open Out Doors", built by the board's code, no stored
lists, top-row fanlights at 62 (Nathan's default), side lights 86 as Integrate. Make the mullions symmetrical
(Integrate's template has 648 / 651 — use equal side columns) and say what you chose.

## 4. Tests
Fixtures FD4–FD6 from the facts trees with their stored lists; board-path tests from each template; every benchmark
unchanged; FD4–FD6 on the benchmark page. Run npm run e2e after deploy.
