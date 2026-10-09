# Step AO — casement and direct glazed frames: the pricing engine (benchmarks J, K, L, M, N)

Written by the reviewer. All handover rules apply (docs/handover-pricing.md). Never run SQL — this step needs none.
integrate-targets.json: the reviewer has added benchmarkJ_casement_two_opening_utile, benchmarkK_casement_plus_direct_glazed,
benchmarkL_two_direct_glazed_mullion, benchmarkM_single_direct_glazed and benchmarkN_casement_plus_fixed_casement — commit
them as recorded facts, don't change them.
Facts: docs/integrate-L31115-direct-glazed.txt — read ALL of it first (trees, sizes, every price line, and the labour and
production minutes reconciled rule by rule against docs/integrate-rules-export.txt). Commit the facts file with item 1.

This step is ENGINE ONLY: fixtures + computeVariables / derived geometry / allocator. No board UI (that is Step AP), no SQL.
GlazePro's board cannot build these windows yet, so the fixture trees below also fix the tree shape Step AP will build —
keep them simple and in GlazePro's existing conventions.

Nathan's decisions (9 Oct), in the facts file: (1) a frame with only direct glazed units gets NO frame timber, cill or LTW
consumables lines — match Integrate (is_casement_window is false without a casement sash; GlazePro already does this).
(2) Installation labour "Base Direct Glazed Unit in Frame" (Direct Glazed group, sort 10) never fires — match Integrate,
do not "fix" its condition. (3) Ironmongery defaults per opening are a BOARD job for Step AP — not this step.

## 1. Fixture trees (fixtureCasement.js — one file, five exports, like fixtureB's H and I)
Frame 1199 x 1299, complete new, PF30, Teknos clean white int/ext/cill as the other fixtures.
- drawingItemPart: typeOfWork complete_new; materials softwood / softwood / utile for K-N (Integrate "Softwood with
  Hardwood Cill": 38/38/44); utile / utile / utile for J (44/44/44). floorLevel: K-N first_floor (L31115 item 2, as
  fixture B); J third_floor (item 1, as fixture A — J's labour includes the 60-min third-floor rule).
- assemblyFramePart: width 1199, height 1299, leftWidth 37, rightWidth 37, topHeight 47, bottomHeight 47, frameDepth 96,
  frameHeadStopSize 20, frameStileStopSize 20, cillStopSize 20, jambType: Integrate 'solid_profiled' — use GlazePro's
  existing code for it if the reference list has one; if not, report and use 'solid_profiled' (no pricing rule reads it).
- cillPart: ONE per frame, height 47, depth 128 (Integrate stores one CillPart per bottom opening, but its cill volume is
  the full frame width — see §3; one GlazePro cill is the faithful model for pricing).
- mullionPart (child of the frame, as GlazePro's box sash mullions): thickness 27, mullionStopSize 20, offset 549 = LEFT
  face (internal width 1125: (1125 - 27) / 2 = 549 — the same left-face convention as Step AE). SOLID casement mullion:
  it must NOT go through the hollow box-sash profile (thicknessInFrameHollow).
- Openings, left to right in tree order (Integrate matrixIndex A1, B1):
  - casementSashPart: thickness 54, topHeight 62, leftWidth 62, rightWidth 62, bottomHeight 83, mechanicalClearance
    4 all round, toBeReplaced true, operation (Integrate 11 Fix, 15 Top Hung, 16 Bottom Hung, 17 Left Hand Hung,
    18 Right Hand Hung — pick codes fix / top_hung / bottom_hung / left_hand_hung / right_hand_hung unless the live
    sash_operation list already has codes for them; say which and mark NOT VERIFIED as fixture E did), casement type
    open-out flush (Integrate typeId 7 "Open Out / Flush with Stops Internally"). Child glassPart: rebate 16,
    tolerance 2, double glazing GL100010 / GL100080 (as the other fixtures).
  - direct glazed unit = a glassPart that is a DIRECT CHILD OF THE FRAME: toBeReplaced true, mechanicalClearance 20 all
    round, hiddenInRebate 18 all round, glazingRebateWidth 20, glazingTolerance 2, same glass codes.
- J: two casements, A1 left_hand_hung, B1 right_hand_hung. K: A1 casement left_hand_hung + B1 direct glazed.
  L: two direct glazed + mullion. M: one direct glazed, no mullion. N: A1 left_hand_hung + B1 casement FIX.
- Ironmongery: store Integrate's list on all five as ironmongeryLines (fixture A's mechanism): Connoisseur Handle LH PB 1,
  Connoisseur Handle RH PB 1, Defender Friction Hinge Side Hung 412mm PC 2, Kenrick Extension 690mm PC 4, Kenrick
  Extension Gear Box PC 2, Trickle Vent XR16 White 1. Integrate prices these as 9 lines totalling 66.15 cost (the strikes
  are its allocated parts — facts file "Price lines"). If a product does not resolve in the snapshot, the line must show
  "Product not found" — report which; do not invent a price. The complete-new default ironmongery rules must not ADD
  lines on top of a stored list (check; report if they do).

## 2. Variables (computeVariables.js — replace the stubs at "new_casement_sash_qty = 0" etc.)
Facts (all proven by the minute reconciliations in the facts file):
- casement_sash_qty = every casementSashPart, fixed ones included. new_casement_sash_qty = those being made (complete
  new, or toBeReplaced). fixed_casement_sash_qty = operation fix. new_opening_casement_sash_qty = new and NOT fix (N = 1,
  K = 1, J = 2 — the variable dictionary's wording "all casement sashes" is wrong; the minutes prove it).
  opening_out_casement_sash_qty = non-fix casements of an open-out type; opening_in_ = open-in types (0 here).
- direct_glazed_unit_qty = glassParts whose parent is the frame. Per glass part in the glass_unit loop:
  is_direct_glazed_unit (true for those), and its actual_area from §3.
- new_sash_qty = new sliding sashes + new casement sashes (dictionary: "all sashes inc. door leaves"; J's 2 x 20-min
  utile sash finishing proves casements count). Check no sash-window benchmark moves.
- is_casement_window stays "has a casement sash" — L and M must NOT be casement windows (no Base Casement Frame labour,
  no timber, no cill, no LTW). is_sw / is_box_sash false for all five.
- Everything else (new_frame_qty, frame_mullion_qty, frame_to_be_replaced, finishes) should already work — confirm with
  the minute tables.
Bump PRICING_ENGINE_VERSION with a one-line note.

## 3. Geometry and timber (derived geometry — single helpers, no tuned constants)
- Openings: internal width 1125 = 1199 - 37 - 37, internal height 1205 = 1299 - 47 - 47; a mullion splits the width
  (549 / 549). Casement sash = opening - clearance each side: 541 x 1197.
- Casement sash glass (existing glass rule): sightline (541 - 62 - 62) x (1197 - 62 - 83) = 417 x 1052, each edge plus
  (rebate 16 - tolerance 2) = 445 x 1080 = 0.4806 -> 0.48.
- Direct glazed glass: opening - 2 x clearance 20 = visible 509 x 1165 (what Integrate's board shows), plus 2 x hidden in
  rebate 18 = 545 x 1201 = 0.6545 -> 0.65. M (no mullion): 1121 x 1201 = 1.3463 -> 1.35. These areas also drive the
  Direct Glazed labour bands (< 1.75 m2 -> 70 min each).
- Casement sash timber (rule 165, casement_sash loop, solid_redwood_volume per sash, dm3): (2 x 1197 x 62 + 541 x 62
  + 541 x 83) x 54 / 1e6 = 12.25 exactly. One line per redwood sash: K one, N two (fixed sashes count), J none (utile —
  Integrate has no hardwood casement sash rule).
- Cill timber (rule 166, solid_utile_hardwood_cill_volume x 1.25): FULL FRAME WIDTH x cill depth x (cill height + cill
  stop) = 1199 x 128 x (47 + 20) / 1e6 = 10.2826 dm3 -> 12.85. Not the two per-opening widths. Make sure this does not
  change the box sash cill volumes (L34046, C, D, E) — if the existing helper differs, keep it for sash windows and say
  why the two differ.
- Frame timber (rule 160, solid_redwood_frame_excl_cill_volume x 1.25 = 35.98 on K and N, i.e. 28.784 dm3):
  THE REVIEWER IS STILL MEASURING THIS ONE (see §5). Do not guess a section. Implement the variable for casement frames
  only from the reviewer's formula; until then leave K and N failing by the Softwood Casement Frame & Sashes line
  (19.79 / 39.57) and say so.
- J (utile) uses length rules: Casement Frame Jambs & Cills (1299 + 1199) / 1000 x 1.1 = 2.75; Casement Frame Head
  1.199 x 1.1 = 1.32; Casement Transoms & Mullions frame_muntin_to_be_replaced_length x 1.1 — Integrate's line is 16.78
  = 1.3532 x 12.40, so its mullion length is about 1230 mm (1229.8-1230.6). The internal height is 1205. Report the
  length GlazePro uses and the resulting gap; do not invent a 25 mm allowance to close it.
- Casement sash weight (labour rule 95 "Any Sash Overweight" > 25 kg, casement_sash loop) must evaluate without errors;
  these sashes are well under 25 kg.

## 4. Tests and the benchmark page
- Add J, K, L, M, N to benchmarks.test.js and the /dev/pricing-benchmark page, with full line diffs against the facts
  file and the hours (production / labour) checked separately — the minute tables in the facts file say which rules
  must fire; list any rule that fires or misses against them.
- Expected: L and M pass outright. K and N pass except the frame timber line until §5 lands. J: report the mullion-length
  gap only. Anything else is new information — report it.
- Re-run every existing benchmark: none may move.

## 5. Frame timber — reviewer's measurement (to follow)
The reviewer will add Integrate's frame-volume formula here (more readings on L31115). If it is not here when you reach
§3, finish everything else and report the frame line as open.

Report in the handover format: per item, files changed, what the tests show, what is not verified.
