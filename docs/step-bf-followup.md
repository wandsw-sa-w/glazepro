# Step BF follow-up (reviewer, 14 Oct 2026)

## Run live 14 Oct by the reviewer (editor SHA = file SHA each time)
- sql/step-bf1 (6a4b6192…): templates 29-32 now flat. sql/step-bf2 (0551decf…): stableDoorPart, frame -> stableDoorPart,
  stableDoorPart -> doorLeafPart 0..2, panelPart -> glassPart 0..1. sql/step-bf3 (7b21e7cd…): five stable-door rules active,
  the three imported ones (espag set, Winkhaus stable multipoint, double euro cylinder) inactive. sql/step-bf4 (8ac58d2d…):
  templates 33 Stable Door / 34 Stable Door Glazed Top / 35 Stable Door With Vision Panel, group Cottage Doors, profile 5.
- REVIEWER EDITS to commit (item 0): bf1 and bf4 declared `_profile_id uuid` — default_profiles.id is BIGINT (be1 had the
  opposite slip); bf4's "exactly two halves" check counted with a LAX `$.**` path, which returns every match TWICE in
  Postgres (checked live: lax 2, strict 1 for one muntin) — changed to `strict $.**`. Use `strict` for every jsonpath COUNT
  in SQL from now on (exists() is unaffected).
- Benchmarks live: 57 = 34 PASS, 20 BY DESIGN, A50 / D parked, FD4 open (see 1).

## 1. FD4 — resolved, close the open question
Re-read 14 Oct on Integrate drawing 10/4 (310627): both PanelParts are internalPanelTypeId 110 / externalPanelTypeId 110 =
FLAT. Its old penny-exact match was the FT3 pattern: Integrate charges flat 2 x 60 + "Door Muntin" 2 x 60 (each leaf's mid
rail counted) = 240 = GlazePro's old R&F 2 x 120. GlazePro now: flat 2 x 60, no muntin -> -120 min = -49.32, BY DESIGN
(decision d: a mid rail is not a muntin). Make FD4 a declared row; the open-questions table goes back to empty. Add the
re-reading line to the French-door facts.

## 2. New stable doors price £34.65 too much LIVE (offline was right)
Drawings 50 / 51 / 52 on L507712 item 9 (from templates 33 / 34 / 35), priced through Q1 (restored to 26):
live 2,709.72 / 2,612.38 / 2,736.42 against the report's offline 2,675.07 / 2,577.73 / 2,701.77 — +34.65 on each:
- 102mm_hinges PB: live 58.80 (4 x 14.70, part HHD681) — offline 29.40. Nathan wants TWO PAIRS = 29.40. Find why the live
  allocator and the offline one disagree on qty 4 (pairs vs hinges) and make both give 29.40.
- Two extra trickle-vent lines fire live: trickle_vent_xr16 Wht (RHZ665) 3.15 and "trickle" Wht (RHZ771) 2.10 — imported
  default rules that the offline path did not see. A stable door gets Nathan's list only (XR16 BLACK once). Stop the others
  for a stable door (bf3's SECTION 0d read them) — in a re-issued bf3 if it is data.
- The offline template-price test missed both: make it run on the live rule set (refresh the captured snapshot, or a
  liveRuleFixes entry) so it cannot pass while live is wrong.
Expect after: 50 / 51 / 52 = 2,675.07 / 2,577.73 / 2,701.77.

## 3. The board draws a stable door as ONE pane of glass
Drawing 50: the elevation shows a single glass-blue opening "A1" 997 x 2103; the parts list is right (Stable Door A1 >
Top A1 > Panel, Bottom A1 > Panel) and the tree saved right. Draw the two halves (their rails, the 3 / 4 clearances, panel /
glass / vision panel per cell, labels Top A1 / Bottom A1), each selectable — through a pure function with a test, as
gridRectsFor was.

## Report
docs/reports/step-bf-followup.md. Any SQL as a new or re-issued file; the reviewer runs it.
