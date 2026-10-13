# Step AZ hotfix — a live door prices no timber

Written by the reviewer, 13 Oct, after pricing a French door on the LIVE board. All handover rules apply. Never run SQL.
Report to docs/reports/step-az-hotfix.md. After deploy run `npm run e2e` (the script is e2e, not test:e2e) and report it.

## What the live check found
Test drawing 25 (lead L507712, item 9, from the live "French Doors" template, 1899 x 2199, utile) priced through the
quote matrix at 5,016.82 (cost 2,508.43). Every group matches FD1 except:
- manufacture_materials 25.00 instead of 395.95 — NO Utile Section Part lines at all;
- installation_materials 369.06 instead of 309.21 — the default ironmongery (see 3).
The stored variables show `is_single_and_french_doors_range: false` on a drawing whose default_profile_id is 4
(open_out_doors). The rule "Utile Section Part" needs that range, so it never fires.

## 1. The bug: priceDrawing never passes the drawing's profile code
`priceDrawing` (src/pricing/pricingEngine.js) loads `drawings.default_profile_id` for the profile VALUES but never
resolves the profile CODE, and calls `runPricingOnTree(...)` without `profileCode`. computeVariables derives
is_single_and_french_doors_range, is_open_in_doors_range and is_replacement_sashes_range (Step AY item 4) from
`opts.profileCode` — so on every drawing priced through priceDrawing all three are false. The fixtures and the benchmark
page pass the code, which is why every test passed.
- Resolve `default_profiles.code` for the drawing and pass `profileCode` into runPricingOnTree.
- Find EVERY caller of runPricingOnTree / computeVariables that prices or validates a real drawing and make sure each
  passes the drawing's profile code (QuoteMatrixPage's breakdown already uses loadDrawingProfileCode; check the board's
  live price, validation, quote snapshot / publish, QuoteOverview). Report each, fixed or already right.
- A test that fails today: price a door tree through the priceDrawing path (mocked supabase is fine) with
  default_profile_id -> open_out_doors and assert the Utile Section Part lines appear. Same for sashes_only ->
  is_replacement_sashes_range true.

## 2. New drawings from a template keep the template's materials in the drawing row
Drawing 25's row has material_frame / material_sash 'Solid Redwood' (cill 'Solid Utile Hardwood') while its tree, the
board and pricing all say utile — so the quote matrix card reads "Door · Solid Redwood". createDrawingFromTemplate
(src/drawingBoard/templates.js) must set the drawing's material columns (and window_type) from the template tree, as the
board does when the material is changed. Check casement and sash templates the same way.

## 3. Default ironmongery on a door — Nathan's decisions (13 Oct)
- A new French door starts with the Hardwick Lyndon espag set (GlazePro's default rule), NOT Integrate's template choice
  of the Windsor inline handle.
- A door gets BOTH trickle vents (slot vent XR16 and the grille), as a casement does.
No rule changes. Record both as deliberate differences in docs/integrate-differences.md (FD1 from the live template
therefore costs 59.85 more in installation_materials than Integrate's stored list: 74.55 + 2.10 - 16.80).

## 4. The benchmark page must not hide a missing live part (your Step AZ report's open point)
PricingBenchmark.jsx builds `{ ...partCostMap, ...(benchmark.partCostMap ?? {}) }`, so a fixture's cost overrides the
live catalogue. Invert it: the LIVE catalogue wins; a fixture cost is used only for a code the live catalogue lacks, and
the page then labels the row "part missing live: <codes>" so the smoke test fails on it. Check no current benchmark
depends on an override that differs from the live cost (report any).

## 5. Expected after deploy (the reviewer will re-price drawing 25 live)
Drawing 25 = FD1's tree with GlazePro's default ironmongery: cost 2,879.38 (manufacture 1,366.66; labour 583.05;
installation_materials 369.06; glass 164.66; manufacture_materials 395.95), price 5,758.71.
