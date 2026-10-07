# Pricing vocabulary audit — tree values read by src/pricing/* and src/validation/*

Written 7 Oct 2026 against the real saved tree
`src/pricing/benchmarks/real-trees/L507712-drawing1.raw.json` (captured from the live
drawing board by the reviewer, 7 Oct). The values the drawing board stores are the
truth: option codes are permanent, labels are editable.

## Where the real codes come from

Option codes a drawing can really hold were taken from these repo files:

| Source | What it defines |
|---|---|
| `supabase/migrations/20260923_step_a3_reference_categories.sql` | seeds `type_of_work`, `jamb_type`, `sash_split`, `staff_bead_type`, `parting_bead_type`, `midrail_type`, `gas_fill`, `glazing_bead_fix` |
| `supabase/migrations/20260924_step_b1b_fixes.sql` | adds `glazing_type` code `single_glazing` beside the pre-existing `double_glazing`; seeds `heritage_spacer_dimension` (`spacer_4`, `spacer_6`) and `heritage_spacer_colour` |
| `supabase/migrations/20260928_pricing_item_fields.sql` | seeds `floor_level` (`ground_floor` … `fifth_floor`, `half_landing`) |
| `sql/step-j1-parts.sql` | seeds `horn_type` (`no_horn`, `victorian`, `custom`) and others |
| `sql/step-b2c-applies-to.sql` | shows `sash_operation` has exactly three options (labels "Cord Hung", "…Spiral…", "Fix…"); codes not printed in the repo |
| `supabase/migrations/20260923_step_a2_field_definitions.sql` + `docs/step-a2-field-definitions.md` | which reference category each field uses (`timber_species`, `glazing_type`, `moulding_profile`, `horn_type`, `sash_operation`, `glazing_spacer_dimension`, `glazing_spacer_colour`, `product`); glass part-number fields are data_type `part` (component tag Glass) |
| `sql/step-m2-paint-finish-options.sql` | names the six live `paint_finish` options (created in August outside the repo): Clean White, White Gloss, White Satin, Colour Match Satin, Colour Match Gloss, Custom |

**Not in the repo at all:** the option rows for `timber_species`, `glazing_type`
(beyond single/double), `moulding_profile`, `sash_operation`, `product`,
`glazing_spacer_dimension`, `glazing_spacer_colour` and `paint_finish` were created in
the live database before this repo's migrations and are not seeded here. For those,
the codes below come from the real tree, from `docs/step-k-fixes-brief.md` /
`docs/step-h3-fixes-brief.md` (reviewer-written briefs describing live data), and —
for timber — from the PF30 price-file variable names
(`supabase/migrations/20260928_pricing_import_integrate.sql`: `softwood_cubic_meter`,
`utile_cubic_meter`, `accoya_cubic_meter`, `oak_cubic_meter`, `idigbo_cubic_meter`,
`douglas_fir_cubic_meter`, `meranti_cubic_meter` — Integrate's own species list).
Codes marked *(inferred)* are not verified against the live database.

## Field-by-field

Status key: **MISMATCH** = a real code is silently unhandled today;
**OK** = real codes match the comparisons; **GAP** = a real code no branch handles.

### drawingItemPart

| Field | Compared against (where) | Real codes | Status |
|---|---|---|---|
| `typeOfWork` | `complete_new`, `new_pair_of_sashes`, `draught_seal`, `bi_glass` (computeVariables GROUP 2) | `complete_new`, `new_pair_of_sashes`, `draught_seal`, `bi_glass`, `no_work` (step-a3) | OK for the four; **GAP**: `no_work` hits no branch — every flag false, item prices as if it were an unknown job; nothing warns |
| `frameMaterialId` | `=== 'solid_redwood'`, `'accoya'`, `'solid_utile_hardwood'`, `'engineered_accoya'`, `'oak'`, `'idigbo'` (computeVariables GROUP 3) | `softwood`, `utile`, `accoya`, `oak`, `idigbo`, `douglas_fir`, `meranti` *(timber_species; softwood/utile from the real tree, full set inferred from PF30 variables)* | **MISMATCH** — real `softwood` never matches `solid_redwood`, so `is_solid_redwood_frame` etc. are silently false. Evidence `softwood` ⇒ Integrate "Solid Redwood": docs/step-k-fixes-brief.md §3. `solid_redwood`, `solid_utile_hardwood`, `engineered_accoya` are fixture-only inventions |
| `sashMaterialId` | same comparisons (GROUP 3) + `TIMBER_DENSITIES` keys `solid_redwood`, `accoya`, `solid_utile_hardwood`, `idigbo` (sashWeight.js) | as above | **MISMATCH** — same; sashWeight silently falls back to 508.3 kg/m³ for every real code except `accoya`/`idigbo`. **GAP**: no density for `oak`, `douglas_fir`, `meranti` and no engine flags for `douglas_fir`/`meranti` anywhere |
| `cillMaterialId` | `=== 'solid_utile_hardwood'`, `'accoya'`, `'solid_redwood'`, `'oak'` (GROUP 3) | as above | **MISMATCH** — real `utile` never matches `solid_utile_hardwood`: `is_cill_hardwood` false ⇒ "Box Frame Utile Cill" rule never fires on a real drawing. `softwood` cill would also be missed; **GAP** `idigbo`/`douglas_fir`/`meranti` cill unhandled |
| `staffBeadTypeId` | `'small'`, `'large'` (GROUP 4b) | `small`, `large`, `custom` (step-a3) | OK for small/large; **GAP**: `custom` ⇒ both flags false ⇒ no staff bead allocated, silently |
| `partingBeadTypeId` | not compared anywhere | `standard`, `rebated`, `custom` (step-a3) | GAP (benign today: the parting-bead allocation rules don't condition on type, so `rebated`/`custom` price as standard with no warning) |
| `mouldingTypeId` | **never read** — `is_lambs_tongue_moulding` reads `mouldingPart.values.profile`, a node real drawings don't have (GROUP 10d) | `ovolo` (real tree); `lambs_tongue` *(inferred — category `moulding_profile`, live-only)* | **MISMATCH** — moulding type must be read from `drawingItemPart.mouldingTypeId` |
| `isDocL` | computeVariables reads `item.values.doc_l` (GROUP 8) | the board stores **`isDocL`** (real tree: `true`) | **MISMATCH** — `is_docl` is silently false for every real drawing; PF30's "All Glass Energy Surcharge" conditions on `is_docl` |
| `isBiGlass` | `=== true` (GROUP 2) | not stored by the board (not in the real tree; typeOfWork `bi_glass` covers it) | OK (fallback), noted |
| `product` | not compared in pricing (item type comes from tree structure) | `pair_of_sashes` (real tree); other `product` codes live-only | OK |
| `floorLevel` | `ground_floor` … `fifth_floor`, `half_landing` (GROUP 7) | same codes (20260928_pricing_item_fields.sql) | OK; `is_basement`/`is_loft` stubs have no codes to match (documented NEEDS-DATA) |
| `decoration`, `fitToPreparedOpening`, `bayFullyCoupledFrames`, `frameInKitForm`, `bayPoleRequired` | `=== true` booleans | booleans / null | OK |

### assemblyFramePart

| Field | Compared against | Real codes | Status |
|---|---|---|---|
| `jambType` | `solid_profiled`, `solid_with_plant_on_stop`, `solid_spiral_for_sash`, `hollow_box_for_sash` (GROUP 4) | identical (step-a3) | OK |
| `cillStopId`, `frameStopId` | not read by pricing | `ovolo` etc. (`moulding_profile`, live-only) | OK (not needed) |

### sashPairPart

| Field | Compared against | Real codes | Status |
|---|---|---|---|
| `topHornTypeShortName` / `bottomHornTypeShortName` | `.includes('victorian')` (computeVariables), `HORN_MM {victorian, none}` (pricingEngine), `HORN_LENGTHS_MM {victorian, none}` (sashWeight), `'custom'` (GROUP 8) | seeded: `no_horn`, `victorian`, `custom` (step-j1); the real tree holds **`none`** | **MISMATCH (two real codes for the same meaning)**: drawings hold both `none` (real tree) and the seeded option `no_horn`. Both must count as "no horn" (0 mm) — mapped as such since the label "No Horn" leaves no ambiguity; flagged here per the stop rule rather than silently chosen. `custom` horn: length comes from `topHornLength`/`bottomHornLength`, handled |
| `sashSplit` | not compared in pricing (geometry handled by computeSashGeometry) | `half_half`, `third_two_thirds`, `set_top` (step-a3) | OK |
| `midRailTypeId` | not read by pricing | `chamfered`, `square`, `stepped` (step-a3) | OK (not needed today) |

### topSashPart / bottomSashPart

| Field | Compared against | Real codes | Status |
|---|---|---|---|
| `operation` | substring `cord` / `spiral` / `fix` (computeVariables, pricingEngine, partAllocator, defaultIronmongery) | `cord_hung` (real tree); spiral + fix codes live-only, labels confirmed by step-b2c | OK — substring match covers all three labels; an unknown fourth option would be silent (warning added) |
| `btmRailShapeId`, `angledTopRailId` | not read by pricing | `chamfered` etc. | OK |

### glassPart

| Field | Compared against | Real codes | Status |
|---|---|---|---|
| `glazingId` | `=== 'double_glazed'` / `'single_glazed'` / `'triple_glazed'` / `'heritage_glazed'` (computeVariables 338-340, pricingEngine 264-272 & 334-336) | `double_glazing` (real tree), `single_glazing` (step-b1b); `triple_glazing`, heritage code *(inferred, live-only)* | **MISMATCH** — real `double_glazing` never matches `double_glazed`: `is_double_glazed` false per glass part ⇒ **no glass lines at all** on real drawings (confirmed on the live breakdown). The rebate-key selection only worked by accident (unknown falls through to the double default) |
| `internalGlassPartNo` / `externalGlassPartNo` / `singleGlassPartNo` | keys into `glassCatalogue`, which is keyed by `parts_catalogue.part_code` (loadPricingContext); also `*_pane_part_no` variables in validation | real drawings store the glass **name** ("4mm Clear Pilkington K Toughened"); fixtures store part codes (`GL100010`) | **MISMATCH** — name never hits a part-code key ⇒ "Glass code not found in catalogue" warnings and zero glass cost. See item 3: the board must store the part code (fields are data_type `part`, component tag Glass — step-a2) |
| `spacerHeight` | `glass_unit_thickness` (computeVariables GROUP 10b, pricingEngine 324, validate.js glass_unit vars) | **not stored** — real drawings store `spacerDimId: 'spacer_16'` | **MISMATCH** — spacer thickness must be derived from `spacerDimId` (`spacer_N` ⇒ N mm) |
| `spacerDimId` | `.includes('warm_edge')` for `has_white_warm_edge_spacer` (pricingEngine 329); quote-level spacer counts assume codes like `16mm_white_warm_edge` (computeQuoteVariables comment) | `spacer_16` etc. (`glazing_spacer_dimension`); colour lives in `spacerColourId` (`white_warm_edge`, category `glazing_spacer_colour`) | **MISMATCH** — the dimension code never contains `warm_edge`; the flag must read `spacerColourId` |
| `gasFillId` | `'krypton'` (validate.js) | `argon`, `krypton`, `argon_krypton_mix` (step-a3) | OK for krypton; `argon_krypton_mix` does not count as krypton-filled (flagged — pricing decision if a krypton rule ever applies) |
| `glazingBeadFixId` | not read by pricing | `black_tape`, `white_tape`, … (step-a3) | OK |
| `barsWide` / `barsHigh` | numeric fallback when no bar part children (several places) | not stored by the board — bars are child parts | OK (fallback to 0 + real bar parts preferred) |
| `isIndividualPanes` | `=== true` | boolean | OK |
| `toughened_inner` / `toughened_outer` / `toughened_single` | `=== true` (validate.js glass_unit vars) | **not stored** — toughening is a property of the chosen glass part | GAP — `is_*_pane_toughened` is always false; validation rules using it are wrong until derived from the glass part |
| `actualWidth` / `actualHeight`, `grossHeight`, `weight_in_kg` | validate.js part vars | not stored | GAP — those validation variables read 0 on real drawings |

### paintAndIronmongeryPart

| Field | Compared against | Real codes | Status |
|---|---|---|---|
| `internalFinish` / `externalFinish` / `cillFinish` | `clean_white`, `white_gloss`, `white_satin`, `colour_match_satin`, `colour_match_gloss`, `custom` (GROUP 9) | the six live `paint_finish` codes (named in sql/step-m2) | OK (codes match the August option set; real tree holds null ⇒ `clean_white` default) |
| `ironmongeryFinish` | catalogue key `short_name:finish_code`; `FIXED_FINISHES ['Wht','PN']` (defaultIronmongery) | `PB`, `PC`, `SC`, `ABs`, `Wht`, … (step-g2 variants) | OK |
| `ironmongeryLines` | product_short_name/finish_code against ironmongery catalogue | codes from step-g2 | OK (unresolved lines warn since commit 0452d98) |

### notesPart

`installationMethod`, `externalAccessId` etc. are not read by pricing. Validation
reads nothing from notesPart directly. OK.

## Shape mismatches beyond option codes (for the record)

These are key/semantic gaps the audit surfaced; they are **not** fixed by the
vocabulary work and are reported for a decision:

1. **`outerWidth` / `outerHeight` are never stored by the board** (absent from the
   real tree) but sashWeight.js and computePartVariables prefer them; fixtures set
   them explicitly. On real drawings the code falls back to `width`/`height`.
2. **`width` semantics disagree between modules.** computeDerived.js treats
   `assemblyFramePart.width` as the OVERALL frame (internal = width − leftWidth −
   rightWidth); computeVariables.js treats it as the internal opening (outer = width +
   leftWidth + rightWidth). Both cannot be right; for the real 1000-wide drawing
   computeVariables reports frame_width 1170 mm. Not changed in this session — needs
   its own decision and calibration pass.
3. **`cillPart.profiledHeight` is not stored** (real cill: `height`, `heightFinished`);
   the code falls back to `height` (70) where the L34046 fixture used 45.
4. **`sashLip` is not stored**; fixtures set it from the profile. Real drawings get 0.

## Compared nowhere but should be

- `frameMaterialId`/`sashMaterialId`/`cillMaterialId` = `douglas_fir`, `meranti`
  (and `oak` for density): no flag, no density, no rule branch — silently priced as
  redwood-density softwood. Now produce a run warning.
- `typeOfWork` = `no_work`: no branch; now warns.
- `staffBeadTypeId` = `custom`: no staff bead allocated, silently. Now warns.
- `gasFillId` = `argon_krypton_mix`: not counted as krypton. Flagged above.

All MISMATCH rows are fixed in `src/pricing/optionVocabulary.js` (one module, used by
pricing and validation alike); unrecognised codes for engine-relevant fields produce a
run warning naming the field and the code. Fields marked *(inferred)* keep their
mapping but any live code outside the mapped set will surface as a warning rather
than a silent false.
