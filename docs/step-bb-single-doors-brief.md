# Step BB — single garden doors (open out): plain, with fanlight, with side lights

Written by the reviewer, 13 Oct. CLAUDE.md applies (short chat reply; detail in docs/reports/step-bb.md).
Facts: docs/integrate-L31115-single-doors.txt (SD1-SD4, FD7). integrate-targets.json: the reviewer has added
benchmarkSD1-SD4 and benchmarkFD7 — commit them and the facts as recorded (item 0).
Nathan (13 Oct): single garden doors are sold as plain, with a fanlight over, with full-height side lights, and with
half-height flag lights made as separate coupled frames. THIS step is the one-frame layouts only; coupled frames are the
next step (facts already at the end of the file). Default handle: Hardwick Lyndon espag set — Integrate's own default
ironmongery rules already give exactly that for a single door (rules 3, 5, 10, 50, 52), so nothing new there.
Every figure reconciles with rules GlazePro already has. The work is containment, the board and the templates. If a
benchmark needs a new pricing RULE, stop and report.

## 1. The single door leaf (containment SQL; the reviewer runs it)
- Integrate stores a single door as a plain DoorLeafPart DIRECTLY in a frame opening (no pair part). Live today
  part_type_children has doorLeafPart -> glassPart / panelPart but NOTHING lets a frame hold a doorLeafPart.
  sql/step-bb1: assemblyFramePart -> doorLeafPart (0, n — a frame opening, like casementSashPart; check how
  casementSashPart is set up and copy it), and doorLeafPart -> transomPart (0, 1) for a panelled single door's mid rail
  (as the French leaves, Step BA). ON CONFLICT DO NOTHING, read-before / read-after queries as ba1.
- Leaf size = its opening less its OWN clearances: top 2, left 3, right 3, bottom 3 (French pairs are 3/1/1/3).
  doorLeafSize already does this for a leaf with no pair — prove it with SD1 (999 x 2110 in 1005 x 2115).
- computePartVars in defaultIronmongery.js has a second `pt === 'doorLeafPart'` branch below the Step AZ
  DOOR_LEAF_TYPES branch; it can never run and reads keys no drawing stores. Delete it.

## 2. Pricing — prove every rule fires as the facts list (no new rules expected)
- Labour: "Single Door Only" 660 (door_leaf_qty == 1, not is_front_door) and NOT "French Doors"; Any Door Overweight 45;
  Fixed Fanlight 120 for EVERY fixed casement sash in a door frame — side lights included (SD3, SD4); Any Sash
  Overweight 45 for side lights over 25 kg.
- Production: Door Leaf 1035, Door Frame 855, Door Frame Single Finish 180, Door Leaf Single Finish 90, Glazing 20 per
  unit; per divider Door Frame Single Finish (Mullions) 85 + Additional for Frame Mullion or Transom 180; per fixed
  casement sash Casement Sash Single Finish 60 + Sidelights in Doorsets 780 (beside the door) or Fanlights in Doorsets
  300 (above a transom) — is_fanlight as Step BA.
- Allocator: RJZ2382 only (rule 2020 "MPLS non-front non-french"); no French-pair parts.
- Sections (doorGeometry.allocatedSectionParts already loops all door leaves): SD1-SD4 lengths in the facts.
- Expected: SD1 EXACT in every line. SD2, SD3, SD4 and FD7 differ ONLY in manufacture_materials, by the transom /
  mullion decision (doc differences 7b and 11), pinned BY DESIGN on the benchmark page as FD3/FD5:
  SD2 +13.67, SD3 +28.76, SD4 +97.72, FD7 +57.53 (cost). Any other difference: stop and report.
- The SD2 / SD4 fixtures keep Integrate's 86 fanlight rail (63x96); GlazePro's own fanlights default to 62 (63x63).

## 3. Board
- A door frame opening can hold a single DOOR (leaf) as well as the French pair, a casement sash or a direct glazed
  unit: add it to the change-opening choices for door frames. New leaf from the profile: 54 thick, top 110, stiles 110,
  bottom 163 (ext 170), clearances 2/3/3/3, Left Hand Hung (operation choices LH / RH), open out, To Be Replaced, glass
  DGU. Never give it an arched head by default (Integrate does — see the SD2 quirk in the facts; GlazePro must not).
- Labels as Integrate (SD4: A1 B1 C1 / A2 B2 C2, door B2).
- Fix from Step BA: in a doorset the right-hand side light is labelled C2, the same as the right French leaf. Integrate
  labels the pair B2 / C2 and the next column D2 (FD5). Make the column letters skip past the pair's two letters.

## 4. Templates (SQL; the reviewer runs it) — group "Open Out Doors", product door, window_type "Door", profile
##    open_out_doors, built by the board's code, no stored lists, side lights rail 86, fanlights rail 62
- "Single Door" 1099 x 2199 (Integrate template 15) — sort 60
- "Single Door With Fanlight" 1099 x 2599, transom at 399 (fixed fanlight) — sort 70
- "Single Door With Side Light" 1699 x 2199, door 1005 opening on the left, fixed side light on the right — sort 80
- "Single Door With Side Lights And Fanlights" 2249 x 2599, columns 534 / 1005 / 534, transom at 399 — sort 90
- "French Doors With Glazed Side Panels" (Integrate 28, FD7) 2820 x 2199 — direct glazed side panels (clearance 15,
  hidden 12 both sides, not Integrate's A1 quirk), equal side columns — sort 45
- Tidy: the two Step AZ templates ("French Doors", "French Doors With Fanlight") have window_type "Door"; the three
  Step BA ones "French Door". Set the two AZ rows to "French Door" in the same SQL (drawings already made keep theirs).

## 5. Tests
Fixtures SD1-SD4 and FD7 from the facts with their stored lists; board-path tests from each new template (a GlazePro-
built single door gets the default ironmongery: +59.85 cost vs the stored list, as the French doors); every existing
benchmark unchanged; the five new ones on the benchmark page. Run npm run e2e after deploy.
