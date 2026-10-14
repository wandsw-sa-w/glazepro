# Step BE — front doors: Nathan's corrections, and the side light (reviewer, 14 Oct 2026)

Facts: docs/integrate-L31115-front-doors.txt (sections dated 14 Oct, decisions d-g). Target: benchmarkFT4_front_door_side_light
(added by the reviewer to integrate-targets.json — insertion only; commit it as item 0 with this brief and the facts file).

Live state (reviewer, 14 Oct): sql/step-bd3 re-issue (sha 6706db67...) RUN; templates 29-31 carry 983 / 941 / 1103 and the
muntin at 329. New drawings on L507712 item 9 priced through Q1 (restored to 26): 44 Front Door 2,580.01 / 5,160.00 ;
45 With Fanlight 2,697.97 / 5,395.92 ; 46 Arched 2,717.65 / 5,435.29 — exactly the report's figures.

## A. Door production minutes (decision d)
Integrate's Estimated Labour Time editor (Production > Lookup Editor > std_labour_time_new — read it there, it shows the rules
fired per item) proves FT1's 2,670: rule 1240 "Additional for Flat Panel" fires 4 x 60 on type-110 R&F panels (rule 1245 R&F 120
never fires), and rule 1235 "Door Muntin" fires 2 x 60 because sash_muntin_to_be_replaced_qty counts the mid rail. FT3 has the
same two errors cancelling (flat 60 + "muntin" 60 for a leaf with no muntin = GlazePro's R&F 120 + nothing).
Nathan: R&F 120 per panel (GlazePro already does), and Door Muntin 60 per REAL muntin only. So:
- make Door Muntin fire 60 x the leaf's real muntins (mullionPart with isMuntin in a door leaf), never for a mid rail;
- FT1 becomes 2,850 min (+60, +24.66 cost); its 120-minute "pending" closes as BY DESIGN: GlazePro 2,850 vs Integrate 2,670 =
  180 min = 73.98 = Integrate's flat-panel error (-240) and its mid-rail-as-muntin (+60 net of the real muntin);
- FT2 / FT3 production must NOT move (no real muntin). Check every other benchmark with a door leaf; if one moves, explain it.

## B. Shaped glass (decision e) — ALL shaped glass
Price a shaped unit (arched / curved head, any product) on the LARGEST RECTANGLE of its cut glass x 1.25, at the SQUARE glass
rule's rate (58.50 / m2), not Integrate's shaped rate (71.88) and not its 0.62. Nathan's figure for FT3: 799 x 1125 = 0.899 m2
-> 1.12 m2 -> 65.52 (GlazePro's own cut size may differ by a millimetre or two from 799 — use GlazePro's and say what it gives).
- Keep the energy surcharge on the glass as it is today, and say what it is based on; do not change it in this step.
- Every benchmark with shaped glass (C, arched casements, FT3, any other) moves: list each one, old and new glass lines, and pin
  each as BY DESIGN with this cause. FT3's open £15.81 closes.

## C. The side light (decision g) — template + benchmark FT4
Nathan's Integrate drawing 20 (facts file): one 1400 x 2182 frame, 41 frame mullion at 900, the Balham leaf 892 x 2068 on the
left, a FIXED CASEMENT SASH 359 x 2079 on the right (rails 62 / 62 / 62, bottom 175) holding glass over a R&F panel under a
mid rail, two cills (900 and 365). Integrate 3,174.81 / 6,349.62; production 3,905 min; labour 1,080 min (Front Door and Frame
840 + 120 per frame mullion + Fixed Fanlight 120 per fixed casement sash — NO Combination Frame).
1. FT4 fixture = Integrate's tree as it is (door 834 / 834 with a 120 mid rail; side light mid rail at 888). Production by
   GlazePro's corrected rules: 3,905 + 300 (five R&F panels at 120, not flat 60) - 120 (one real muntin, not three) = 4,085.
   Expect BY DESIGN items: that +180 min; the door's muntin timber (Integrate's 63x120 5.01 m = 2H + W - 20, no muntin);
   whatever GlazePro allocates for the two mid rails and the 41 frame mullion that Integrate does not (as FT2's transom).
   Declare each, recomputed from lengths and per-metre costs, like FT1-FT3.
2. Template "Front Door With Side Light" (group Open In Doors, after the arched one): Integrate's Balham leaf as the other
   templates (170 mid rail, 983 / 635, muntin centred), frame 1400 x 2182, mullion 41 at 900, fixed casement sash on the
   right with glass over a R&F panel. The side light's mid rail is 170 and lines up with the door's (same height from the cill
   — work it out from the 62 / 175 sash rails against the door's 110 / 170). Say the offset you store.
3. The board must let a surveyor build it (add a side light to a front door, fixed casement sash, glass over panel) and save.
4. SQL: a new sql/step-be*.sql for the template (and any rule changes) — UPDATE-if-exists, guarded, with SECTION 0 reads,
   checks and rollback, like step-bd3. The reviewer runs it.

## Report
Tests first. Report docs/reports/step-be.md: every benchmark that moved, old -> new, with its cause; FT1-FT4 group by group;
what the side-light template prices offline. Do not touch FT1-FT3 fixtures' trees.
