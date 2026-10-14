# Step BH — doorsets with lights, and a pair of front doors (reviewer, 14 Oct 2026)

Do this AFTER Step BG (it uses the open-in / open-out switch). Facts: docs/integrate-L31115-door-direction.txt,
docs/integrate-L31115-front-doors.txt (FT2 fanlight, drawing 20 / FT4 side light, decisions a-g),
docs/integrate-L31115-stable-doors.txt, docs/integrate-L31115-french-doors.txt (FD5 side + top lights).
Commit this brief as item 0.

## Nathan (14 Oct)
1. EVERY doorset (French pair in or out, single garden door in or out, front door, stable door in or out) can have side
   lights, top lights (fanlights) and flag windows. Templates only for the products below; anything else is built on the
   board from any door and must price correctly.
2. Pair of front doors: two open-in leaves; EACH leaf has a 170 mid rail with one flat panel above and one below (no muntin).
   Default ironmongery: the MASTER leaf gets the front-door set (decision a: 102mm hinges PB, AV4 Heritage locking system
   with its thumbturn cylinder / lock / keeps for the master's hand, Hardwick classic sleeved letterbox PB HK4350PB, Croft
   euro cylinder pull PB); the SLAVE leaf gets its hinges and the French pair's slave bolts.
3. Front door with side lights both sides and a fanlight: BOTH constructions are sold — a fanlight across the full width,
   and a fanlight over the door only.
4. Stable doors with a fanlight, and with a side light.

## Not read in Integrate — why that is acceptable
Integrate has no template for any of these, and building them by hand on its board is impractical. They are compositions of
parts already matched: the open-in French pair (OI1), French doors with panels (FD4), front door + direct-glazed fanlight
(FT2), front door + fixed casement side light (FT4 / drawing 20), French doors with side AND top lights (FD5: two side lights,
three units over, per-sash / per-divider rules), stable doors (ST1-ST3, SO1). Integrate's rules for them are general
(production 1201 "Sidelights in Doorsets" 780 per fixed side sash, 1202 "Fanlights in Doorsets" 300, 1105 per frame divider
180, 501 / 506 per divider; fitting 0-2 front door 840 per frame + 120 per frame mullion + 90 per frame transom, 50 per
DGU 45, 52 per fixed casement 120, 200 stable 900, 11 French pair 780 when NOT a front door). So: price each template
OFFLINE with the live rules and give every fired rule with its quantity, so the reviewer can check each line by hand.

## The work
1. Board, any door: a frame divider (mullion / transom) beside or above any door kind — French pair, single leaf, front
   door, stable door — with the new opening made a fixed casement sash (glass, glass over panel), a direct glazed unit,
   or an opening casement; and "+ Flag left / + Flag right" (Step BC) on every door kind, not just the single door. Check
   which of these work today and fix what does not (list both in the report). Stable doors: the stable-door part must sit
   in a frame opening below a transom / beside a mullion exactly as a leaf does.
2. A pair of front doors is a front door: isFrontDoor true (fitting rule 0 "Front Door and Frame" 840 per frame, NOT rule
   11 French Doors 780), dual finish as the front doors (Clean White in, Custom Colour TBC out). Pricing must see the slave
   leaf's bolts and the master's AV4 parts and NOT the French master Thunderbolt (RJZ2382) — list the parts the allocator
   gives, with their rule ids, for the reviewer to check.
3. Templates (sql/step-bh*.sql, guarded, UPDATE-if-exists, SECTION 0 reads; the reviewer runs them):
   a. "Pair Of Front Doors" — Open In Doors, 1500 x 2182 (frame, cill 50 as the front doors); leaves from the open-in pair
      geometry ((internal width - 3 - 3 - 5 + 27) / 2 x 2068); in each leaf the 170 mid rail at Balham's height (983 above
      / 635 below on a 2068 leaf, as template 29), flat panel above and below; master = right leaf.
   b. "Front Door With Side Lights And Fanlight" — template 32's door and side light, with a side light on BOTH sides
      (mullions 41 at 365 / 900 / 365 openings), plus a transom 41 across the full width with the frame 431 + 41 taller
      (2182 -> 2654), the mullions running through so there are THREE direct glazed fanlights over (as FD5).
   c. "Front Door With Side Lights And Fanlight Over Door" — as b, but the side lights run full height and the transom is
      over the door only (one direct glazed fanlight); the side lights' own transom stays level with the door's mid rail.
   d. "Stable Door With Fanlight" — template 33 plus a transom 41 and a direct glazed fanlight 431 over (2207 -> 2679).
   e. "Stable Door With Side Light" — template 33 plus a mullion 41 and a fixed casement side light (glass over a flat
      panel, its 120 transom drawn 170 — as template 32's side light) in a 365 opening (1099 -> 1505); the side light's
      transom level with the stable door's meeting rails.
   Groups: a-c "Open In Doors", d-e "Cottage Doors". Default ironmongery: a as Nathan 2; b / c the front-door set (a);
   d / e the stable-door set (decision j). Dimensions here are the reviewer's starting sizes — say if any does not build.
4. Every existing benchmark unchanged.

## Report
Tests first. docs/reports/step-bh.md: what the board could and could not do before (point 1), what each template prices
offline (cost / price, every fired production and fitting rule with quantity, glass, timber lines, ironmongery parts), and
the drawings to make live.
