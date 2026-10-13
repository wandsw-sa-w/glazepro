# Step AZ — French doors (open out): fully glazed, and with a fanlight over

Written by the reviewer. All handover rules apply. Never run SQL — write files in sql/ for Nathan with a "DO NOT RUN"
rollback section, and read the live rows first with /dev/sql (column and key names, existing rows) — do not guess names.
Report to docs/reports/step-az.md in the handover format, and list only the SQL files this step wrote, in run order.
Facts: docs/integrate-L31115-french-doors.txt — read ALL of it. integrate-targets.json: the reviewer has added
benchmarkFD1, FD2, FD3, FD3b — commit them and the facts file as recorded.

**After deploy, run the live smoke tests (npm run test:e2e) and report the result. The step is not done until they pass.**

Nathan (13 Oct): doors sold are front doors (open in), French doors (open out), single garden doors / doorsets and stable
doors. French doors first. Doors are sold in utile and Accoya only.

## 0. What is new
Doors price their timber differently from windows: no volume lines. Integrate allocates lengths of five utile stock
sections to the drawing and prices them per metre (price rule "Utile Section Part", loop allocated_section_part — already
live in GlazePro, nothing feeds it yet). Everything else (glass, ironmongery incl. the multipoint-lock allocator parts,
components, production, labour, LTW) reconciles with GlazePro's live rules once the door variables exist — the facts file
shows each sum. If a benchmark needs a new pricing RULE to match, stop and report rather than adding one.

## 1. Data (SQL)
- Parts: the five Utile section parts (Utile63x63 8.60, Utile63x96 12.20, Utile63x120 17.30, Utile63x200 29.00,
  Utile67x96 13.60 per m; names as Integrate "Utile 63mm x 120mm" etc.) into the parts catalogue and PF30's part prices,
  however GlazePro holds part costs (read the live tables; follow how earlier steps added parts).
- Containment: check assemblyFramePart -> frenchDoorPart -> left/rightFrenchDoorLeafPart -> glassPart, and a casement
  sash (fanlight) + transom beside a frenchDoorPart in a frame. Add only what is missing.
- Templates (group "Open Out Doors", family door, profile open_out_doors, product French Door, built by the board's own
  code, no stored ironmongery, no stored surround):
  "French Doors" (Integrate 26) 1899 x 2199; "French Doors With Fanlight" (Integrate 16) 1350 x 2599, transom 41 at 399,
  top-hung fanlight over the pair. Door leaves 110 / 110 / 110, bottom 163 (ext 170), stepped. Fanlight rail 62
  (Nathan's default for new fanlights — the profile's 58 is Integrate's; say how you apply 62).
- Field definitions / visibility for the pair and leaf panels as Integrate shows them (facts file, last section), in the
  same way Step AY did the French casement panels. Hide anything Integrate does not show.

## 2. Engine
- Leaf geometry: height = opening height - top - bottom clearance (3 / 3); width = (opening width - left - right
  clearance (1 / 1) - gap 5 + meeting stile overlap 27) / 2. Read the values from the profile, do not hard-code.
  Glass per leaf: sightline (leaf - stiles, leaf - top - bottom rail) + 2 x (rebate 15 - tolerance 3).
- Door variables (computeVariables; several are NEEDS-DATA today): is_door, door_leaf_qty, new_door_leaf_qty,
  new_french_door_pair_qty, fixed_door_leaf_qty, opening_out_door_leaf_qty / opening_in_door_leaf_qty,
  is_single_and_french_doors_range (profile open_out_doors), is_french_door, is_front_door (false for this step — open-in
  front doors come later; say how you derive it), and on the door_leaf loop: weight_in_kg, gross_sash_height_in_mm
  (= leaf height), is_french_door_leaf, is_master_leaf_in_french_pair, is_slave_leaf_in_french_pair, hand, is_opening_out.
  On the casement_sash loop: is_item_a_door and is_fanlight for a fanlight in a doorset. Report every rule (price,
  labour, production, allocator, default ironmongery, validation) that reads a door variable and whether it now fires.
- Leaf weight: as GlazePro's sash weight (timber at drawn sizes x density + cut glass) — FD1 leaves must be over 50 kg
  (Any Door Overweight, 45 min each), FD2 / FD3 under. Report the weights.
- Allocated sections (new; loop allocated_section_part; length in mm, priced at length / 1000 UNROUNDED x cost, line to
  2 dp — see the facts):
    frame head + jambs: Utile67x96 = overall W + 2 x overall H
    cill + door bottom rails: Utile63x200 = overall W + each leaf width
    door stiles + top rail: Utile63x120 = per leaf 2 x leaf H + leaf W - 6
    fanlight (62 sections): Utile63x63 = sash W + 2 x sash H + 14 ; fanlight bottom rail 86: Utile63x96 = sash W
  Deliberate differences (Nathan, 13 Oct — record them in docs/integrate-differences.md):
    a 62 mm fanlight bottom rail is charged at Utile63x63 for the sash width (Integrate charges nothing);
    the transom is charged at Utile67x96 for the internal frame width — PROVISIONAL (no listed section fits 77 x 96;
    the workshop to confirm);
    an Accoya door uses the same utile sections and prices until Nathan supplies Accoya prices (Integrate prices no
    timber at all on an Accoya door). Make the section table per material so Accoya prices can be added as data later.
  The -6 and +14 are fixed offsets read once (size changes moved every length exactly with the sizes) — say so in a
  comment. Doors get NO frame / sash / cill volume lines (FD lines show none) — check every timber rule excludes them.
- Multipoint-lock allocator parts (rules 2010 / 2030 / 2060 / 2090 for these doors) priced as ironmongery lines, as
  Integrate does (each line whole pounds x 1.05): check the part codes map to the four names in the facts.

## 3. Board
- A "Doors" family in the template picker; the two templates; resizing; operation per leaf; master leaf on the pair;
  labels as Integrate (FD1 A1 / B1; FD3 A1 fanlight, A2 / B2 the pair); drawing: the two leaves meeting, MASTER on the
  master leaf, as the French casement does. Opening change to "French doors" can wait — say if it falls out for free.
- Material: utile by default; Accoya selectable (the drawing's material choice); no softwood for doors.

## 4. Fixtures and tests
- Fixtures FD1, FD2, FD3, FD3b with the STORED ironmongery lists from the facts (FD3 / FD3b keep the template's fanlight
  ironmongery) and the allocated lock parts. FD1 and FD2 must match Integrate in every line. FD3 and FD3b match in every
  line EXCEPT manufacture_materials, which is higher by exactly the transom (1.256 m x 13.60 = 17.08) and, for FD3b,
  the 62 rail (1.254 m x 8.60 = 10.78): assert those exact differences and show the benchmark page's target as
  Integrate's figure with the difference labelled.
- Board-path tests: template -> resize -> master leaf / operation -> the fixture trees, through assertSaveable and
  required fields. Then without a stored list, report the default ironmongery lines against Integrate's stored lists
  (do not change any default-ironmongery rule; report whether both trickle-vent rules fire on a door).
- Re-run every benchmark — none may move. Add FD1, FD2, FD3, FD3b to the live benchmark page.
