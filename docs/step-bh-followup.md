# Step BH follow-up (reviewer, 15 Oct 2026)

## Item 0 — commit
- The reviewer's edit to sql/step-bh1: SECTION 0 selected `part_code_expr`, which does not exist (the column is
  `part_code`); fixed in 0a / 0b. It RAN LIVE 15 Oct in that form (SHA 539aed6a…): rule cebdd8b5 now ends
  "and not is_front_door" (verified).
- sql/step-bh2 RAN LIVE 15 Oct unchanged (SHA 1ab13241…): templates 36-40 created (Pair Of Front Doors 36,
  ... Over Door 38, Stable Door With Fanlight 39, Stable Door With Side Light 40), profile open_in_doors.
- Commit this brief with them.

## What the reviewer checked live (L507712 item 9, priced through Q1, Q1 item 9 back on drawing 26)
| drawing | template | live price | report | |
|---|---|---|---|---|
| 54 | Pair Of Front Doors | 6,642.89 | 6,634.49 | +8.40 = the Croft pull (see 6) |
| 55 | Front Door With Side Lights And Fanlight | 9,173.93 | 9,165.53 | +8.40, the same; board right |
| 56 | ... Fanlight Over Door | **7,095.53** | 8,928.07 | **WRONG — item 1** |
| 57 | Stable Door With Fanlight | 5,911.17 | 5,911.17 | exact; board right |
| 58 | Stable Door With Side Light | 6,785.57 | 6,785.57 | exact; board right |
| 59 | French Doors (template) switched to Opens in, saved | 5,749.11 | — | = 5,758.71 - 9.60 (FD1 - OI1): Step BG exact live |
Benchmark page: 61 = 36 PASS, 23 BY DESIGN, A50 / D parked. (Drawing 53 on L507712 ITEM 1 is a stray pair the reviewer made
by mistake — leave it.)

## 1. Template 38 / drawing 56 — the openings land in the wrong cells (fix first)
The tree is as sql/step-bh2 wrote it, but the board labels the two side lights "Fanlight A1" / "Fanlight C1" and the door
"Single Door A2", draws the door cell blank, the left side light short with panels below, the right one long glass. Priced:
- Fanlights in Doorsets 300 x 2 instead of Sidelights in Doorsets 780 x 2 (the side lights are taken as fanlights);
- Tricoya Panel with NEGATIVE areas: -0.164465, -0.348975, -0.348975, -0.254597 m2 (= -211 cost);
- Utile63x200 3,228 (offline 4,298), 63x63 2,418 (offline 10,922), 63x120 6,261 (offline 6,796);
- production 72 h (offline 88), labour 25.42 h (offline 26.92).
So the live path places the children of a frame with a SHORT transom (startDivider / endDivider = the two mullions' keys)
differently from the offline test. Find where the two paths differ (cell enumeration / matching openings to cells by order
rather than by geometry is the obvious suspect), fix the live path, and make the template test go through the SAME code the
board and the live pricing use, so this cannot pass offline again. Re-issue template 38 only if its tree has to change
(UPDATE-if-exists, as bh2). Expected live after the fix: the report's 8,928.07 + 8.40 = 8,936.47.

## 2. A guard: nothing may price at a negative (or zero) area
A panel or glass whose computed size is <= 0 must not reach a price line. Make it a validation ERROR naming the part (and
leave it out of pricing), so a broken layout shows on the board instead of silently taking money off.

## 3. Pair of front doors — the board draws plain glass
Drawing 54's tree is right (each leaf: mid rail 983 + a panel above and below; priced right) but the board draws each
French leaf as one glass pane with no rail or panels. Draw a French leaf's own grid (mid rail, muntins, panel / glass per cell)
the way a single door leaf's is drawn (gridRectsFor). Check "French Doors With Panels" (glass over a mid rail, panel below)
is drawn right too.

## 4. The front-door lock goes on the SLAVE leaf of a pair
The live front-door rules carry "not is_master_leaf_in_french_pair":
  b5c2d45a Front Door Open In Left Hand Hung (av3_heritage_locking_system_lh) ; 501f9ca5 Open In Right Hand Hung (_rh) ;
  e938fc5a Open Out Left Hand Hung ; d23e8262 Open Out Right Hand Hung ; cb8eb0b9 Front Door Euro Cylinder Pull.
On a pair the master is EXCLUDED, so the lock set and pull go on the slave (the left leaf -> the LH system), where Nathan's
default is the front-door set on the MASTER. Change all five to "not is_slave_leaf_in_french_pair" (a single door is neither,
so single front doors are unchanged). The pair's lock set then comes RIGHT hand (RHZ2482 / RHZ3092) — same cost, no price
move. A guarded sql/step-bh3 (read first, append/replace only where the old text is present, rollback comment); the
reviewer runs it.

## 5. Nathan (15 Oct): a pair of front doors is fitted at 14 h + 2 h for the second leaf
Integrate's rules give a pair only "Front Door and Frame (Base)" 840 ("French Doors Additional Door" carries
not is_front_door). Add 120 min for the second leaf of a front-door pair (a live install-labour rule, e.g. is_front_door and
is_complete_new and is_installation_included, qty = new_french_door_pair_qty, value 120 — or however fits the rule family
best; a single front door, a French pair and a stable door must not move). In sql/step-bh3 with item 4. Record it as a
deliberate difference. Expected: the pair +2 h x 40.21 = +80.42 cost / +160.84 price -> 6,803.73 live.

## 6. Nathan (15 Oct): stable door with side light — TOP edges level
The side light's 170 mid rail: its TOP edge level with the top of the stable door's meeting rail (the top half's bottom
rail, 99), not centre to centre. Change stableSideLightMidRailOffset and re-issue template 40 (UPDATE-if-exists).
Give the new offset, the new panel / glass sizes and the price.

## 7. The offline figures used a stale catalogue
The report lists the front-door pull as hardwick_classic_euro_pull_set_back_to_back (HK4000PB, 25.20) and the _lh heritage
set as RHZ3092 / RHZ2482. LIVE (since sql/step-bd4): rule cb8eb0b9 gives euro_cylinder_pull (Croft CRO1774PB, cost 28.35 ->
29.40), and av3_heritage_locking_system_lh holds RHZ2481 / RHZ3091 (the _rh RHZ2482 / RHZ3092). Hence the +8.40 on 54 and
55. Use the live catalogue for these expectations; the reviewer will download a fresh snapshot once sql/step-bh3 has run.

## 8. Smoke pins
After the SQL, pin the five template drawings' live prices in the e2e suite (the report's suggestion), including the pair's
6,803.73 (bh3 run) and 38's corrected figure.

## Report
docs/reports/step-bh-followup.md: the cause of item 1 and why the offline test missed it; each item's before / after; the
five templates' prices; sql/step-bh3 (and any template re-issue) for the reviewer to run.
