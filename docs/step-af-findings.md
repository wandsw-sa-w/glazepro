# Step AF findings — benchmark D is on the third floor

Against `docs/step-af-third-floor-brief.md`. All figures from the committed snapshot
(`pf30-snapshot.json`); nothing read from the live site.

## Item 2 — re-run

With `floorLevel: 'third_floor'` the "Third Floor 30 minutes" install rule
(`is_floor_set_as_third_floor`, 60 min) fires and D's Labour is **16.00 h → 643.36 /
1,286.72 — Integrate's figures exactly.** A full line diff against the Step AD dumps shows
that Labour line is the ONLY line that changed on any benchmark.

| | GlazePro | Integrate | Delta |
|---|---|---|---|
| D total | 1,786.21 / 3,546.28 | 1,785.67 / 3,545.48 | **+0.54 / +0.80 — the four steel lines only** |

The remaining difference is exactly the steel weights (tops 9.30 → 12.56/18.83 ×2 vs
Integrate 9.20 → 12.42/18.63; bottoms 10.00 → 13.50/20.25 ×2 vs 9.90 → 13.37/20.05): the
Step W weight model runs ~0.12 kg/sash heavy on the 738-wide double-box sashes. Still
reported, not tuned (docs/step-ad-findings.md).

All other benchmarks unchanged: L34046, A, A35/40/h1700, B, C exact; A50 keeps its known
top-Lead miss.

## Item 3 — audit: engine-read fixture fields that are ASSUMPTIONS, not Integrate reads

No values were changed (none can be cited). Engine-read means `computeVariables` /
`pricingEngine` consume the field; every benchmark below currently matches Integrate (or
misses for already-reported reasons), so these assumptions are not visibly moving any fired
line today — but they are inputs the reviewer may want to read from Integrate.

**Fixture A** (and A35/A40/A50/A35_h1700, which derive from it):
- `frameDepth: 165` — "profile defaults" assumption. Engine reads it (frame_depth,
  frame_depth_in_mm). Every actual Integrate read we hold (L34046, C, D) says **140**.
- `leftOuterJamb / rightOuterJamb: 101` — assumption. Engine reads the jamb extension;
  L34046's Integrate read showed extensions 0 (outer = inner 85).
- `leftCillHorn / rightCillHorn: 50` — assumption. Engine adds them to the cill length;
  L34046's read showed 0 / 0.
- `cillPart.depth: 200` — assumption. Engine reads cill_depth; L34046/C/D reads say **140**.
- `cillPart.profiledHeight: 45` — assumption; Step X established profiledHeight is NOT a
  stored Integrate field (it was removed from the L34046 fixture but remains in A and B).
  Engine reads cill_profiled_height_in_mm.
- CITED, for completeness: floorLevel third_floor and installationMethod internally are in
  the stage-4 fact file ("Installed Internally | Third floor", line 20), as are the
  finishes, spacer and ironmongery.

**Fixture B** (both corrected and uncorrected targets share the tree):
- The same frame assumption block as A: `frameDepth 165`, outer jambs 101, cill horns 50,
  `cill depth 200`, `profiledHeight 45` — all engine-read, all "profile defaults".
- Stile width 50.75 ("47 + 3.75 lip") — assumption, engine-read via sash geometry.
- Horn types none/none — "not specified in DSO" assumption; engine-read for gross sash
  height (B prices no manufacture lines, so currently inert).
- CITED: floorLevel first_floor and installationMethod internally (stage-4 line 61).

**Fixture L34046:**
- `floorLevel: 'ground_floor'` — from the original L34046 QUOTE SPEC, not the Integrate
  drawing read (the GetDrawing read holds no floor field). Engine-read: ground floor adds no
  minutes, and L34046's labour matches at 7.50 h, consistent — but unverified against
  Integrate's own location field.
- Finishes (clean_white ×3), ironmongery finish ABs, spacer 16 mm White Warm Edge — original
  spec, not in the geometry read (engine-read: finish flags, warm-edge flag, spacer size).
- installationMethod internally — spec-sourced; the engine does NOT read it (assigned,
  unused).

**Fixtures C and D:**
- `mouldingTypeId: 'ovolo'` — board template value, not in the Integrate read. Engine-read
  (the lambs-tongue moulding flag; ovolo → false). C/D match Integrate with it.
- `installationMethod: 'internally'` — assumption; engine does NOT read it.
- `externalAccessId: 'easily_accessible'` — board template value; engine does NOT read it.

Fields the engine reads that default when absent (decoration, fitToPreparedOpening,
cutOutBrickReveal, bay flags, kit form) are explicit `false`/absent on every fixture and
match the complete-new/DSO shapes; not listed individually.

## Item 4

No engine change; `PRICING_ENGINE_VERSION` stays 9.
