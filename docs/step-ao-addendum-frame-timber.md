# Step AO addendum — casement frame timber (brief §5) and benchmark P

Written by the reviewer after three more Integrate readings (9 Oct 2026, L31115 item 2 drawing 19 — a copy of N with the
mullion removed, then resized; read through a temporary Quote 2 test quote; Quote 2 emptied and the test quote set back to
L34046 / 8 afterwards). These are facts: append this file's "Readings" section to docs/integrate-L31115-direct-glazed.txt
in the same commit.

## Formula (solid_redwood_frame_excl_cill_volume, casement frames; rule 160 multiplies by 1.25)
Volume in dm3, ROUNDED TO 2 DP, THEN x 1.25 (that rounding is what makes the 1599 x 1599 reading come out at 33.45):
  head    = frame width                         x frameDepth x head overall      (47 profiled + 20 stop = 67)
  jambs   = 2 x internal height (H - 47 - 47)   x frameDepth x jamb overall      (37 profiled + 20 stop = 57)
  mullion = 1225 on the 1299-high frame         x frameDepth x mullion overall   (27 profiled + 2 x 20 stop = 67)
  Board shows these overall sizes: "Head 67", "Left/Right Jamb 57", "Mullion 67". Frame depth 96. No cill.
- The mullion length (1225 = internal height 1205 + 20) comes from ONE reading (K/N). Use internal height + 20 and say in
  code and report that it is measured on one frame only.
- Check the same rounding (2 dp before the x 1.25, or before the rule) on the casement sash volume (12.25, 16.76, 21.90)
  and the cill volume (10.28 -> 12.85, 13.71 -> 17.14): all consistent.

## Readings (frame 37/47/47 profile, depth 96, redwood, PF30)
| Drawing 2/19 state                 | Rule 160 qty | cost  | model dm3 -> 2dp -> x1.25        |
| 1199 x 1299, one opening casement   | 26.13        | 14.37 | 20.8995 -> 20.90 -> 26.125       |
| 1599 x 1299, one opening casement   | 29.34        | 16.14 | 23.4723 -> 23.47 -> 29.3375      |
| 1599 x 1599, one opening casement   | 33.45        | 18.40 | 26.7555 -> 26.76 -> 33.45        |
| K / N 1199 x 1299 with mullion       | 35.98        | 19.79 | 28.7787 -> 28.78 -> 35.975       |
Casement sash timber (rule 165): 1117 x 1197 sash 16.76; 1517 x 1497 sash 21.90 (formula of brief §3).
Hardwood casement cill (rule 166): 1599 wide -> 1599 x 128 x 67 = 13.71 -> 17.14.

## Benchmark P (new) — single opening casement 1599 x 1599 (2/19, drawingId 310302, first floor)
Tree: as N but no mullion, frame 1599 x 1599, ONE casementSashPart (left_hand_hung, sash 1517 x 1497), same stored
ironmongery list. Add to integrate-targets.json as a recorded fact, exactly:
  "benchmarkP_single_casement_1599": { "source": "L31115 Item 2 Drawing 19 (first floor): flush casement 1599 x 1599 redwood,
  one opening casement (LH hung), complete new. Read 9 Oct 2026 via a temporary Quote 2 test quote. Facts:
  docs/step-ao-addendum-frame-timber.md", "total_cost": 976.16, "total_price": 1952.33, "groups": {
  "glass_done": {"cost": 121.32, "price": 242.65}, "installation_materials": {"cost": 110.69, "price": 221.37},
  "manufacture": {"cost": 217.75, "price": 435.50}, "labour": {"cost": 452.36, "price": 904.73},
  "manufacture_materials": {"cost": 74.04, "price": 148.08} }, "hours": {"production": 8.83, "labour": 11.25} }
Lines: Square Glass 1.96 x 58.50 = 114.66 (glass 1421 x 1380 = 1.961); Energy 39.20 x 0.17 = 6.66; ironmongery 66.15 (same
9 lines); Component Ogee Architrave MDF 2.85 x 5.10 = 14.54 (ONE line here — Integrate recalculated the surround on resize;
K-N carry 2.80 + 1.30 — report what GlazePro's surround allocator gives on both); Installation Consumables 30.00;
Production 8.83 h; Labour 11.25 h; Softwood Casement Frame & Sashes 33.45 x 0.55 = 18.40; Softwood Casement Sashes
21.90 x 0.55 = 12.05; Hardwood Casement Cill 17.14 x 1.09 = 18.59; LTW 25.00.
Minutes — labour 675 = Base Casement Frame 480 + Opening Casement 90 + "1500 Wide Casement Frame" 60 (overall width
>= 1.5) + "Any Sash Overweight" 45 (casement_sash loop, weight_in_kg > 25 — a 1517 x 1497 sash with a 1.96 m2 4/4 unit
is well over). Production 530 = frame 180 + sash 180 + glazing 20 + sash finish 60 + frame finish 90.
So P needs a real casement sash weight (> 25 kg here; K-N sashes are under). Use the existing sash weight method
(timber volume x density + glass) — say what it gives for P's sash and for the 541 x 1197 sash; no tuned constants.
