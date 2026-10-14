# Step BD — templates fix (reviewer, 14 Oct 2026)

## What was run and checked live
- sql/step-bd2 RUN 14 Oct: every leaf type (doorLeafPart, left/rightFrenchDoorLeafPart) takes mullionPart 0..null; glass, panel, transom all 0..null.
- sql/step-bd3 RUN 14 Oct: templates 29 "Front Door", 30 "Front Door With Fanlight", 31 "Arched Front Door" (group Open In Doors, profile 5).
- sql/step-bd4 RUN 14 Oct (with the reviewer's edit: part_allocation_rules has NO updated_at column — removed from the UPDATE and the rollback; the
  working-tree change in sql/step-bd4 is the reviewer's, commit it). Rule cb8eb0b9 -> euro_cylinder_pull; AV4 _lh = RHZ2481 / RHZ3091, _rh = RHZ2482 / RHZ3092.
- Benchmark page: 36 PASS, 15 BY DESIGN (FT1-FT3 included), A50 and D parked. Nothing else moved.
- L507712 item 9: drawing 41 (Front Door), 42 (With Fanlight), 43 (Arched) made from the templates, saved, priced through Q1 (then Q1 item 9 back on 26):
  - 41: cost 2,580.00 / price 5,159.99
  - 42: cost 2,683.39 / price 5,366.76
  - 43: cost 2,740.74 / price 5,481.48
- Ironmongery on a NEW front door: 315.00 (hinges 14.70, Hardwick sleeved letterbox 94.50, Croft pull 29.40, AV4 set 176.40) against
  Integrate's stored 263.55 = +51.45 cost (+102.90 price). That is Nathan's decision a (letterbox instead of letter tidy + small letterplate),
  as intended. NOTE: "+4.20" in step-bd4 / the follow-up report is against GlazePro's PREVIOUS default, not against Integrate — say so in the report.
- Drawing 41 minus FT1's GlazePro figure = 51.44 = the ironmongery above (to the penny, give or take a rounding). Board looks right
  (four panels, centred muntin, mid rail, label Open In A1).

## The defect: the leaf MID RAILS are centred in all three templates
The brief asked for the MUNTIN centred (Balham's 373 / 284 split was Integrate's accident). It did not ask for the mid rails to move, and
section 8 says the arched door is "Integrate's Arched Door as it is". The report says the same. But the generated trees put every mid rail
in the middle of the leaf interior:

| Template | Integrate's leaf cells (top / bottom, mm) | Template as run | 
|---|---|---|
| Front Door (Balham) | 983 / 635 (rail 170) | 809 / 809 (offset 809) |
| Front Door With Fanlight (Bedford) | glass 941 / panel 618 (rail 170) | 780 / 779 (offset 780) |
| Arched Front Door | shaped glass 1103 / panel 582 (rail 120) | 843 / 842 (offset 843) |

A front door's lock rail sits LOW (top panels / glass long, bottom panel short) — that is the door Nathan sells and the one Integrate draws.

What it costs today (drawing minus the FT benchmark's GlazePro cost minus the 51.45 ironmongery):
- Front Door: 0.00 (four panels, same total area — price-neutral, but the drawing is wrong).
- With Fanlight: -8.05 glass, -30.16 labour (Integrate's "Any Door Overweight" 45 min no longer fires — less glass), +23.63 panel.
- Arched: -15.06 glass, +38.15 panel.

## Please
1. Put Integrate's mid-rail positions into FRONT_DOOR_TEMPLATES (muntin stays centred 329 / 328): Balham 983 / 635, Bedford 941 / 618,
   Arched 1103 / 582. Work out the board's offset convention for a leaf mid rail and say in the report which number you stored.
2. A test per template: the leaf's cells (top / bottom heights) equal Integrate's, and the muntin's left / right widths are 329 / 328.
3. Re-issue sql/step-bd3 from the script (it is UPDATE-if-exists, so a corrected re-run is safe). New SHA in the report.
4. Expected costs once a drawing is made from each corrected template (benchmark GlazePro cost + 51.45 ironmongery):
   Front Door 2,580.01 (+/- 0.01) ; With Fanlight 2,697.97 ; Arched 2,717.65. If a figure differs, explain it in the report.
5. Commit the reviewer's sql/step-bd4 edit (updated_at removed) and fix the "+4.20" wording as above.
6. Do NOT touch FT1-FT3 fixtures (they stay on Integrate's own trees).
