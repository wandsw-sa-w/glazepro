# Step BD — FRONT DOORS (open in, panelled): reviewer's brief, 13 Oct 2026

Facts: docs/integrate-L31115-front-doors.txt (L31115 item 10, drawings 16-18, read and priced 13 Oct).
Targets: src/pricing/benchmarks/integrate-targets.json — benchmarkFT1_front_door_balham, benchmarkFT2_front_door_fanlight,
benchmarkFT3_front_door_arched (each total = the sum of its groups; checked).

## Nathan's decisions (13 Oct)
- Front doors are sold on their own, with a fanlight over, with side lights, and with an arched head.
- ONE plain panelled design to start: Integrate's "Balham" — a four-panel door, raised and fielded both sides, no glass.
- Default ironmongery = whatever Integrate's rules give (see item 6).
- Default finish as Integrate's templates: Clean White inside, Custom Colour TBC outside — a DUAL finish.
- Side lights are glass over a panel matching the door's mid rail. HOW to build them is an open question for Nathan
  (facts file, last section) — NOT in this step. Do the other three layouts.
- Standing rule (Nathan): where Integrate omits door timber, GlazePro charges for it.

## 0. Commit first, as they are
docs/integrate-L31115-front-doors.txt, the three FT targets in integrate-targets.json, this brief.

## 1. A front door is a front door
`is_front_door` is hard-coded false (computeVariables.js, NEEDS-DATA). Integrate stores isFrontDoor on the
PaintAndIronmongeryPart and the item's range is open_in_doors. Derive it from the drawing (the paint part flag, set by the
open-in templates / profile), so "Front Door and Frame" 840 (+120 per frame mullion, +90 per frame transom) fires and
Single Door Only 660 does not. Check every rule that reads is_front_door (install, production, allocator, ironmongery).

## 2. The open-in leaf
DoorLeafPart open in: clearances 3 / 4 / 4 / 14, rails 110 / 110 / 110 / 170, thickness 54, cill height 50 (the frame's
bottomHeight — open-out doors are 37). The leaf holds its OWN grid: a muntin (MullionPart 120, full height) and a mid rail
(TransomPart isMidrail, 170 — or 120 on the arched door), and each cell holds a PanelPart or a GlassPart. Step BA built
one mid rail with one panel below; generalise to a leaf grid (muntins and mid rails) with a panel or glass per cell, on the
board as well (a surveyor sets the panel layout of a leaf). Panels 110 / 110 = raised and fielded both sides (beads 120).

## 3. Pricing the leaf
- Tricoya Panel per panel at its cell size (live rule; FT1's four lines 0.37 / 0.28 / 0.24 / 0.18).
- Additional for R&F Panel 120 per panel (loop panel), as FD4.
- Production must come to FT2 2770 and FT3 3290 exactly (the facts show the reconciliation). FT1: Integrate 2670 where the
  same reading gives 2790 — run the engine on FT1 FIRST and report exactly which production rules fire and their minutes
  before changing anything. Do not tune to 2670; the reviewer settles it with Integrate.
- `sash_muntin_to_be_replaced_qty` is hard-coded 0 (NEEDS-DATA): give it a meaning for a door leaf's muntins if the FT1
  reading needs it, and say so.

## 4. Timber (allocated sections) — open-in, as read
- 67x96 = W + 2H (arch and frame transom not counted).
- 63x120 = 2 x leaf H + leaf W - 20 for an OPEN-IN leaf (open-out is - 6).
- 63x200 = cill W + leaf W (bottom rail) + a 170 mid rail at leaf W - 10.
- NOT allocated by Integrate, so GlazePro CHARGES them (Nathan's standing rule), PROVISIONAL, workshop to confirm:
  the 120 muntin at 63x120 (length = leaf interior height between rails, FT1 1788) and a 120 mid rail at 63x120 (length =
  leaf interior width, FT3 777). The frame transom as difference 7b (67x96 x internal width; FT2 1005 = +13.67).
Declare these as deliberate differences on FT1 / FT2 / FT3 with their amounts; nothing else should differ.

## 5. Fanlight over a front door (FT2)
The fanlight is a DIRECT GLAZED UNIT in the frame above a 41 transom (not a casement sash). Labour: Front Door transom 90 +
Direct Glazed Unit 45 + "1.75sqm Direct Glazed Unit in Frame" 70 (direct glazed group — GlazePro has recorded "Base Direct
Glazed Unit in Frame never fires" for casements; here Integrate fires the 1.75 m2 rule on a door: make it fire the same way
and check no casement benchmark moves) + Any Door Overweight 45. Production: Frame Dual Finish (mullions) 45 + Additional
for Frame Mullion or Transom 180 + Frame with Doors and Direct Glazed 75 + Glazing 20 per glass unit.

## 6. Arched front door (FT3)
Frame-level segmental arch (rise 508.891, radius 551.121, shoulders 1690) and an arched leaf (rise 345.92, radius 391.12).
Shaped glass at 71.88 / m2 on the cut area (existing shaped-glass rule). Production + leaf "Additional for Swept Head"
(curved head sash) 360 + "Additional Frame Curved Head" 240 + "Additional Frame Swept Head" 240. Architrave and 67x96 at
STRAIGHT lengths (W + 2H), as Integrate. The board already draws arches for sash windows — reuse it for a door frame and leaf.

## 7. Default ironmongery for a front door
Integrate's stored set: 102mm hinges PB x2, AV3/AV4 Heritage locking system LH PC, euro cylinder pull PB, premium letter
tidy PB, small letterplate PB; its allocator adds a Thumbturn Euro Cylinder 40/40 PC, the Winkhaus AV4 Heritage Lock, an AV4
Pocket Keep and an AV4 Centre Keep w Dayswitch. Total 263.55 cost on all three. Read the LIVE GlazePro default-ironmongery
and allocator rules for a front door and REPORT what a new front door gets, part by part, against this list (part codes,
costs). Integrate prices RIGHT-hand AV4 parts on a LEFT-hand door — report what GlazePro does; do not copy the hand error
without the reviewer's say. If a part is missing from the catalogue, name it; SQL for the reviewer.

## 8. Templates (SQL — the reviewer runs it), group "Open In Doors", product "Door", range open_in_doors
- "Front Door" — Balham, 1099 x 2182 (muntin CENTRED in GlazePro's template: Integrate's 373 / 284 split is its template's
  accident; say what you chose).
- "Front Door With Fanlight" — the Balham leaf under a direct glazed fanlight: frame 1099 x 2595, transom 41 at Integrate's
  offset 431.
- "Arched Front Door" — Integrate's Arched Door as it is (shaped glass over a 120 mid rail and one panel): an arched four-
  panel door needs shaped top panels; say if you think otherwise.
Dual finish (Clean White / Custom Colour TBC — check the reference option exists), isFrontDoor true, no stored ironmongery or
surround lists (the rules allocate), leaf never arched unless the template is the arched one.

## 9. Tests and report
Tests first. FT1-FT3 on the benchmark page: exact to Integrate + the declared differences (FT1 waits on the production
reading — report it, mark it pending). Nothing else moves. npm run e2e after deploy. Report docs/reports/step-bd.md; SQL in
sql/step-bd*.sql with SECTION 0 and a DO NOT RUN rollback.
