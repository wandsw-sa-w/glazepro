# Step BG — door opening direction: open in / open out (reviewer, 14 Oct 2026)

Facts: docs/integrate-L31115-door-direction.txt (all of it). Targets: benchmarkOI1 / OI2 / OI3 / SO1 in
integrate-targets.json (added by the reviewer — insertions only). Commit those two files and this brief as item 0.

## Nathan (14 Oct)
- French doors and single garden doors are sold opening IN as well as OUT. Stable doors open in OR out. Front doors open in.
- Any doorset can have side lights, top lights (fanlights) and flag windows — templates only for the named products (next
  step); everything else is built on the board from any door and must price correctly.
- When doors open IN, an opening fanlight / casement light in the same frame STILL OPENS OUT by default, as Integrate; its
  production rule 245 "Frame with inward opening and outward opening" (300 min) then applies.
- Bifold and sliding doors are not sold.

## How Integrate does it (facts)
Direction is the drawing's RANGE: single_and_french_doors (GlazePro profile open_out_doors) or open_in_doors. Switching
re-applies the range's values: cill 37 / stop 26 (out) <-> 50 / 0 (in); typeId 7 <-> 8 on the door leaf, the French pair
part and the stable door part; leaf / pair clearances; door bottom rail stepped 163 int / 170 ext (out) <-> square 170 / 170
(in). Layout, sizes, panels, glass, finish and the ironmongery list stay. GlazePro's two profiles ALREADY hold exactly
these values (reviewer checked 14 Oct) — use them, do not hard-code.

## The work
1. Board: a whole-drawing "Opens in / Opens out" switch on every door drawing (French pair, single leaf, stable door, the
   door frame of a coupled flag set), placed and styled like the Flush / Stormproof switch. It sets the drawing's
   default_profile_id to open_in_doors / open_out_doors and re-applies that profile's values to the door parts and the cill
   (and to any casement sash's clearances, as Integrate's "Sectional Details"), then re-centres grids as a resize does.
   It must NOT change: the overall frame size (Integrate's range switch shrank a fanlight door's frame by 8 mm and its fanlight
   rail 86 -> 78 — a quirk, not copied), any fanlight / casement light's direction or its own rail sizes, panels, glass,
   finish, the ironmongery list. Save, reload, Undo all work; the history names it.
2. Pricing: the engine reads direction from the profile already (is_opening_in / out, the -20 / -6 leaf 63x120 offset, the
   mpls_doors allocator's opening-in rules RHZ1649 / RHZ1648, rule 245). Prove it with fixtures from Integrate's trees:
   OI1 (French pair, 1899 x 2199), OI2 (single, 1099 x 2199), SO1 (stable door open out, 1099 x 2207), OI3 (French with
   fanlight, AS STORED: 1350 x 2591, fanlight rail 78, transom at 391 / 2062). Each with its stored ironmongery.
   Expected: OI1 / OI2 exact (as FD1 / SD1 are); SO1 = Integrate + the stable-door BY DESIGN lines (second hinge pair is a
   default-list matter, not in the fixture; the leaf timber recomputed for the 1061 bottom half — say the figure); OI3: the
   only expected residual is Integrate's 63x63 fanlight length (2050, i.e. 8 mm more than the 385 sash) — park if under £1
   with that cause. Rule 245's 300 min must fire on OI3 and must NOT fire on OI1 / OI2 / SO1 / any open-out door.
3. Stable door opening out: the bottom half takes the open-out bottom rail (163 int / 170 ext, stepped) and the 13 mm the
   lower cill gives (bottom half 1061 at 2207 high); the top half and the 3 mm between the halves are unchanged.
4. Every existing benchmark unchanged (list any that moves, with its cause — none should).
5. No new templates in this step (the switch makes them). No SQL expected; if one is needed, a guarded sql/step-bg*.sql
   (UPDATE-if-exists, SECTION 0 reads) and the reviewer runs it.

## Report
Tests first. docs/reports/step-bg.md: OI1 / OI2 / OI3 / SO1 group by group against Integrate; what the switch changes on
each kind of door (a table); which drawings to try it on live.
