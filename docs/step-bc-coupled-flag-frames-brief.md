# Step BC — single doors with FLAG frames: more than one frame in a drawing (coupled frames)

Written by the reviewer, 13 Oct. CLAUDE.md applies (short chat reply; detail in docs/reports/step-bc.md).
Facts: docs/integrate-L31115-single-doors.txt — the section "Coupled multi-frame doorsets" (CD1-CD4, read and priced today,
drawings 12-15) and "Nathan's decisions (13 Oct)" a-d. integrate-targets.json: the reviewer has added benchmarkCD1-CD4.
Item 0: commit those two files, docs/step-bc-coupled-flag-frames-brief.md, AND sql/step-bb2-single-door-templates.sql —
the reviewer fixed it before running it (single doors now get product "Door", not "French Door"; it is live that way) —
as they are. Also set `product: 'door'` on the SD1-SD4 fixtures in fixtureDoor.js (cosmetic: product drives no price).

This is a STRUCTURAL step: today the board, the engine and the section allocation assume ONE frame per drawing (about 40
`findFirst(tree, 'assemblyFramePart')` calls). Integrate stores a door with flag lights as ONE item holding a
containerPart with several assemblyFrameParts side by side. GlazePro already has containerPart and the containment
drawingItemPart -> containerPart -> assemblyFramePart; nothing else understands it yet. Plan it, say in the report how
you made "the frame" questions multi-frame, and keep every existing benchmark exact.

## 1. The model (as Integrate)
- containerPart holds the frames LEFT TO RIGHT, with partSpacing -47: each frame starts one jamb (47) before the previous
  one ends, so CD1 (693 | 995 | 693) is 2287 wide overall. Frames are HEAD-aligned (all at top 0): flags are high side
  windows over a wall, not floor-standing.
- Every frame is a whole frame: its own jambs, head, cill, dividers and openings. Labels run on across the frames
  (CD1 A1 | B1 | C1 ; CD4 A1 / A2 | B1 / B2 | C1 / C2).
- A one-frame drawing stays exactly as today (no container) — do not migrate existing drawings or templates.

## 2. Pricing: what each frame sees (this is where it can go wrong)
- Frame-LOOP rules (loop_target frame) must see THAT frame's own counts — door_leaf_qty, casement_sash_qty,
  frame_mullion_qty, frame_transom_qty, its sizes. Then, as the facts reconcile: "Machining & Joining a Door Frame" 855
  fires ONCE (the door frame), "Additional for Frame Mullion or Transom" per frame's own dividers (CD4: 3 x 180),
  "LTW General Consumables" 25 per frame (CD1: 3).
- That same scoping makes "Machining & Joining a Casement Frame" (180, door_leaf_qty < 1) fire on each FLAG frame —
  which is exactly Nathan's decision d. Integrate does NOT fire it; the difference is BY DESIGN (below).
- Item-KIND variables stay item-level: is_door, is_item_a_door, is_casement_window etc. A flag frame belongs to a door
  item — so "Casement Frame Jambs & Cills" / "Casement Frame Head" (not is_door) must NOT fire on flags (Integrate has no
  such lines on CD1-CD4), and Sidelights / Fanlights in Doorsets DO fire on the flags' sashes.
- is_fanlight is per sash within ITS OWN frame: CD4's flag top-hung sashes (above their frame's transom) are fanlights
  (300), the fixed lights below are side lights (780).
- Item-level counts are the whole item: frame_qty / new_frame_qty = 3 on CD1 ("Door Frame - Single Finish" 180 x
  frame_qty = 540), door_leaf_qty = 1 ("Single Door Only" 660), fixed_casement_sash_qty / new_opening_casement_sash_qty
  over all frames, glazing per unit everywhere.
- Integrate rounds HOURS to 2 dp before the rate (3220 min = 53.67 h -> 1,323.50). Check GlazePro does (SD3 says it does).
- Install rule 140 "Winglight Frame" (is_door_mpls and door_leaf_qty == 1 and frame_qty > 1, 1 x 1 min) is live and
  active in GlazePro, but Integrate did NOT fire it on CD1-CD4 (Fitting Units test view, read). Nathan's decision c
  replaces it: sql/step-bc1 updates THAT rule (keep its id; note the old values in the file and in
  docs/integrate-differences.md) to name "Single Door (Flag Frame)", condition `not is_front_door and is_complete_new
  and is_door and door_leaf_qty == 1 and is_installation_included and new_frame_qty > 1`, quantity `new_frame_qty - 1`,
  value 240 — the single-door twin of rule 14 "French Doors (Winglight Frame)".

## 3. Sections and surrounds (code, doorGeometry / the surround allocator)
- allocatedSectionParts per FRAME (decision a): each frame W + 2H at 67x96 and its own cill at 63x200; leaves, sashes,
  rails, transoms and mullions as now, each at its own frame's internal size. Integrate charges ONE frame (sum of
  widths + 2 x the door height) and only the door frame's cill.
- Architrave (decision b): ONE set round the whole item — head = overall width (with the -47 overlaps) + 100, two jambs =
  the door frame's height + 100, the same snap-up-to-10 / nearest-0.1 m rounding as a single frame. Not per frame.
  Integrate prices NO architrave on a container item.

## 4. Expected (cost; the fixtures carry Integrate's stored ironmongery lists)
Integrate: CD1 3,024.06 ; CD2 2,421.57 ; CD3 2,421.95 ; CD4 4,209.35 (prices in the targets). GlazePro = Integrate +
decisions a-d, pinned BY DESIGN on the benchmark page, split by line as the facts table shows:
  CD1 +591.03 (= 3,615.09) ; CD2 +303.49 (= 2,725.06) ; CD3 +303.57 (= 2,725.52) ; CD4 +646.34 (= 4,855.69).
Every other line exact. If anything else moves, stop and report.
- CD4's stored list prices the Kenrick variant parts (gearbox, extensions, centre / LH / RH shootbolt strikes) — the
  first benchmark that uses them. Your Step BB report says pf30-snapshot.json has unit_cost 0 on four Kenrick gearbox
  parts; live has them costed (Step AY). Make the offline figures right (refresh the snapshot) rather than tuning.

## 5. Board
- Show and edit a multi-frame item: the frames side by side head-aligned, select a frame, edit its size and contents
  with today's tools, and ADD a flag frame to the left or right of the selected frame (Integrate: "Copy selected frame to
  left / right") — new flag frame 693 wide, 1136 high, one FIXED casement sash (54, 62 / 62 / 62, bottom 86), utile.
  Remove a frame. A one-frame drawing that gains a flag becomes a container drawing.
- Validation / required fields must work per frame (assertSaveable, findRequiredEmpty).

## 6. Templates (SQL; the reviewer runs it) — group "Open Out Doors", product door, window_type "Door"
- "Single Door With Flag Lights" (70): flag 693 x 1136 | door frame 995 x 2101 | flag 693 x 1136 — sort 100
- "Single Door With Flag Light Right" (71): door frame 998 x 2101 | flag 693 x 1136 — sort 110
- "Single Door With Flag Light Left" (72): flag 696 x 1136 | door frame 1001 x 2101 — sort 120 (use 693 / 998 if you
  prefer them symmetrical with 71 — say which)
- "Single Door With Flag And Fan Lights" (69): flags 650 x 1632 (top-hung fanlight over a fixed light, transom 348) |
  door frame 1082 x 2496 (fixed fanlight over the door, transom 348) — sort 130. Fanlights take the 62 rail (Nathan's
  default); flags' fixed lights 86.
Board-built trees, no stored lists, leaf never arched, as Step BB.

## 7. Tests
Fixtures CD1-CD4 from the facts with their stored lists; board-path tests from each template (report the default
ironmongery a GlazePro-built CD4 gets for its top-hung flags — I will check it against Integrate's casement rules);
every existing benchmark unchanged; the four new ones on the benchmark page. npm run e2e after deploy.
