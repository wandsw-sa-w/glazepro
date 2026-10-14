# Step BF — Integrate's panel types, and stable doors (reviewer, 14 Oct 2026)

Facts: docs/integrate-L31115-stable-doors.txt (all of it, incl. the PANEL TYPE IDS section and decisions h-k) and the
14 Oct CORRECTION at the end of docs/integrate-L31115-front-doors.txt. Targets: benchmarkST1 / ST2 / ST3 in
integrate-targets.json (added by the reviewer — insertions only). Commit those three files and this brief as item 0.

## A. Panel type ids — a mapping error, the reviewer's (fix first)
Read in Integrate's own panel-type dialog: **110 = Flat, 112 = Raised & fielded, 114 = Vertical T&G, 116 = Horizontal T&G.**
`src/pricing/optionVocabulary.js` maps 110 -> raised_and_fielded. It came from the French-door facts (Step BA), which
mislabelled 110, and the reviewer repeated it in Steps BD / BE. Integrate's "Flat Panel" 60 on FT1-FT4 was therefore right.
Nathan (14 Oct): door templates have FLAT panels, as Integrate's.
1. Fix the vocabulary (110 flat, 112 raised_and_fielded, 114 / 116 the two T&G). Every fixture that reads 110 becomes flat.
2. Front-door templates 29-32: panels flat (an SQL re-issue — UPDATE-if-exists, like step-bd3 / be2).
3. Keep decision d's OTHER half: Door Muntin 60 per REAL muntin, never a mid rail.
4. Expect production to move (GlazePro vs Integrate, minutes): FT1 2,610 vs 2,670 (-60: Integrate counts the mid rail as a
   muntin); FT2 2,710 vs 2,770 (-60, same cause); FT3 3,230 vs 3,290 (-60); FT4 3,785 vs 3,905 (-120: two mid rails).
   So each FT row's production difference flips to a small UNDER-charge, BY DESIGN (decision d). Recompute and declare.
5. Check FD1-FD7, SD1-SD4, CD1-CD4 and every other row with a panel: list every one that moves, with its cause. If a
   French-door fixture reads 110 and matched Integrate exactly before, say how it can have done (it should have been
   charging R&F 120 where Integrate charged flat 60) — do not tune anything to keep a match.
6. Correct the "110 = R&F" wording wherever it appears (docs/integrate-differences.md, the BD / BE reports' tests'
   comments, step-ba brief and the French-door facts get a dated correction line, not a rewrite).

## B. Stable doors (decisions h-k)
Integrate's model (facts): a StableDoorPart container in the door frame holding a TOP and a BOTTOM stable leaf, each a door
leaf with its own grid (rails top 110 / stiles 110 / bottom 99 on the top half; top 99 / stiles 110 / bottom 170 on the
bottom half), clearances 4 / 4 / 4 / 3 and 3 BETWEEN the halves. Range open_in_doors. Single Clean White finish.
1. Model it the same way (a stable-door container with two leaves, each holding the leaf grid Step BD built, panel / glass /
   vision panel per cell). The board builds and saves one; labels and Fitting / pricing see two door leaves and one
   stable-door pair.
2. Pricing, from Integrate's own rules (facts): Door Leaf 1035 PER HALF; Flat Panel 60 per panel; Door Frame 855; single
   finish 180 frame + 90 per half; glazing 20 per glazed unit; fitting rule 200 "Stable Door" 900 (and no other door fitting
   rule). Tricoya on each panel's full cell (a vision panel is NOT deducted). Glass at the square rule (0.30 minimum).
3. Timber: Integrate allocates NOTHING for the two leaves (only the cill's 63x200 and the frame's W + 2H). Standing rule:
   GlazePro charges the leaves' timber, the same way it does for a door leaf (stiles, rails, the meeting rails at 99) —
   declare each line BY DESIGN, recomputed from lengths and per-metre costs.
4. Benchmarks ST1 / ST2 / ST3 from Integrate's trees (ST2's vision panel 200 x 350 in the top panel; ST3 glass 777 x 846 in
   the top leaf). Fixtures carry Integrate's stored ironmongery (ST2 none).
5. Default ironmongery for a NEW stable door (decision j): Integrate's list (102mm hinges PB pair, ERA 5-lever sashlock PB,
   ERA deadlock PB, XR16 trickle vent black, Victorian scroll lever handle PB) PLUS a second pair of 102mm hinges.
6. Templates, group "Cottage Doors": "Stable Door" (panelled both halves), "Stable Door Glazed Top" (glass over the top half,
   panel below), "Stable Door With Vision Panel" (200 x 350 in the top panel) — 1099 x 2207, as Integrate's.
7. SQL as new sql/step-bf*.sql files (containment, rules, templates), guarded, UPDATE-if-exists, SECTION 0 reads and checks.
   The reviewer runs them.

## Report
Tests first. docs/reports/step-bf.md: every benchmark that moved (old -> new, cause), ST1-ST3 group by group, what each
stable-door template prices offline with the new default ironmongery.
