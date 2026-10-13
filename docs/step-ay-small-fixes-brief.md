# Step AY — small fixes after the casement work

Written by the reviewer. All handover rules apply. Never run SQL — write files in sql/ for Nathan with a "DO NOT RUN"
rollback section. Report to docs/reports/step-ay.md in the handover format.
Also commit, attributed to the reviewer, the uncommitted edit to sql/step-ax2-french-templates.sql (Product = French
Casement; the two check queries' IN lists un-commented — the file failed to run without that). Nathan ran ax1, ax2 (edited)
and ax3 on 13 Oct; the reviewer checked live: both French templates exist (product french_casement, no surround list) and
none of the six combination templates carries a surround list.

## 1. Trickle vents — Nathan's decision (13 Oct): a casement gets BOTH
The slot vent (rule 50, trickle_vent_xr16) and the grille (rule 52, "trickle") are both right on a casement. No rule
changes. Record it in docs/integrate-differences.md (or wherever decisions live) so nobody "fixes" it later, and make the
Step AV / AX tests that call the second line a defect say it is intended.

## 2. A fresh PF30 snapshot (offline tests stop showing the gearbox gap)
Nathan will download it from the live benchmark page ("Download snapshot") and put it in the repo as
src/pricing/benchmarks/pf30-snapshot.json, replacing the old one. If the new file is there when you start: commit it
(attributed to Nathan), re-run every test, and update every expectation that was written around the gearbox gap
(J-S, SA-SF, TC1-3, FR1-2 should now be exact offline) — list each test you changed and why. If the file has not been
replaced, say so and skip this item.

## 3. The French casement panels, as Integrate shows them
On the live board a French pair's panel shows "Mid rail", plus blank "Meeting stile overlap" and "Has floating mullion"
fields although the profile holds 0 and "No". Integrate's French Casement panel shows only: Internal Frame Width, Internal
Frame Height, Sash Type, Overall Meeting Stile (130), Thickness (57). Its leaf panel shows: To Be Replaced, Special Joinery
Details, Special Glass Details, Divider Spacing buttons, Operation, Sash Head, Left Stile, Right Stile, Bottom Rail (int),
Bottom Rail (ext), Master Leaf. Make GlazePro's two panels show the same fields with Integrate's labels (SQL for
default_field_definitions labels / visibility as Step AQ did for casement parts — read the live rows with the queries
you need written into the SQL's section 0). Fields Integrate does not show stay stored but hidden.

## 4. is_replacement_sashes_range, wired
computeVariables already takes opts.profileCode (Step AU fixes). Pass the drawing's profile code from every caller you
listed in that report, starting with the publish snapshot (buildSnapshot / publishQuote must carry each item's profile
code), then the validation panel, Quote Matrix, Quote Overview and the Validation Rules page. Rule 12 then evaluates for
real on a 'sashes_only' drawing. Test: a sashes-only drawing with a curved-head sash fires rule 12; a casement does not.

## 5. TEST2
A stray April test rule ("TEST2") sits in a non-PF30 price file and is never used (docs/integrate-config-sweep-2026-10-12.md).
Write SQL that deletes it by id after printing it, with a rollback that re-inserts the printed row. Nothing else.

## Tests
Every benchmark unchanged (or, with item 2, exact where it was short only by the gearbox).
