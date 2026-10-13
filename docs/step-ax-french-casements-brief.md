# Step AX — French casements (and the template nosing comes off)

Written by the reviewer. All handover rules apply. Never run SQL — write files in sql/ for Nathan with a "DO NOT RUN"
rollback section. Report to docs/reports/step-ax.md in the handover format.
Facts: docs/integrate-L31115-french-casements.txt — read ALL of it. integrate-targets.json: the reviewer has added
benchmarkFR1_french_casement and benchmarkFR2_french_casement_with_fanlight — commit them and the facts file as recorded.

Nathan (13 Oct): French casements are sold plain, with a fanlight over, and stormproof.

## 1. Engine: the French pair
- Model it as Integrate does: ONE opening holding a frenchCasementPart (the pair) with a leftFrenchCasementSashPart and
  a rightFrenchCasementSashPart — no mullion. Live part types and profile keys already exist (frenchCasementPart.thickness
  57, midRail 130, gapBetweenMeetingStiles 4, clearances 4; left/right sash topHeight 62, outer stile 62). Read them; do
  not hard-code. Meeting stile each = (midRail - gap) / 2 = 63 — say whether you read it or derive it.
- Sizes: each sash = ((opening width - 2 x clearance - gap) / 2) x (opening height - 2 x clearance). FR1 556.5 x 1211.
- Sash timber per French sash = (H x (outer stile + meeting stile) + W x (top + bottom)) x 57 — the pair's thickness,
  not 54. Glass uses the sash's own two stiles. Production / labour: each French sash is a casement sash (opener 90,
  machining 180, glazing 20, finish 60); the pair adds nothing. Master leaf: right by default (isMasterLeaf), as Integrate.
- Every FR1 / FR2 line must match: glass, energy, ironmongery (stored lists), components (nosing incl. — the fixtures were
  never saved in Integrate), production, labour, frame / sash / cill timber, LTW.

## 2. Board
- Opening change: offer "French casement" for an opening (the toolbar's change choices, beside opening / fixed / direct
  glazed). The pair fills that opening; left = LH, right = RH, master right; a "Master leaf" choice on the pair.
- Templates (SQL): "French Casement" (Integrate 10, 1199 x 1313) and "French Casement With Fanlight" (11, 899 x 1499,
  transom at 304, top-hung fanlight over the pair), group Combination Flush Casements, built by the board's own code,
  fanlight rail 62 (Nathan's default), no stored ironmongery, NO stored surround list (item 4).
- Labels as Integrate: FR1 A1 / B1; FR2 A1 fanlight, A2 / B2 the pair. Drawing: the two sashes meeting in the middle, MASTER
  marked on the master leaf as Integrate draws it.

## 3. Stormproof French (Nathan: FULLY stormproof)
Integrate's conversion only relabels a French pair (FR3 in the facts — frame stays flush, rails 83). GlazePro's whole-window
Flush / Stormproof switch must convert a French window completely: stormproof frame and cill (Step AU sections), every
casement and French sash to the stormproof type with 76 mm rails and overlap 7, French sash THICKNESS STAYS 57. Rule 43's
quote note fires per stormproof sash. Report the stormproof FR1 price (no Integrate figure to compare — FR3 is not a
benchmark).

## 4. The template nosing comes off (Nathan, 13 Oct)
Integrate's templates carry a "Nosing in Solid Redwood", but Integrate recalculates the surround when a drawing is first
saved and the nosing disappears (every saved Integrate drawing read has architrave only). Nathan: GlazePro leaves it off.
- Write SQL that removes the stored surround list (values.surroundLines) from the four Step AV combination templates, so
  new drawings price their surround through the allocator like every other GlazePro drawing (architrave only — Q/R/S/J
  are exact that way). The French templates in item 2 carry none either.
- Keep storedSurroundParts and has_deep_window_board: a surveyor who adds a nosing gets rule 251's 30 minutes, and the
  TC and FR fixtures (never saved in Integrate) keep their recorded nosing and stay exact.
- Report the price of each combination template with and without the list.

## 5. Small fixes
- Default ironmongery: the bare "trickle" line (Trickle Vent Grille, rule 52, sort 52) appears beside trickle_vent_xr16 on
  casements. Report which rule produces each, and whether Integrate's own default rules would add both — read the rules'
  conditions; do not change any rule data. The reviewer will decide.
- Report the default ironmongery lines for FR1 and FR2 without a stored list, against Integrate's stored lists.

## 6. Tests
Fixtures FR1, FR2; board-path tests (template -> resize -> change opening to French -> master leaf) equal to the fixtures;
stormproof French through the switch; the four combination templates priced without the nosing. Every benchmark unchanged.

List only the SQL files this step wrote, in run order.
