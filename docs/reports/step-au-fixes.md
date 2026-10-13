# Step AU fixes — the stormproof sections come from Integrate's own keys

Done 13 Oct 2026. Brief: `docs/step-au-fixes-brief.md`.
No pricing change, no engine version bump.

---

## 0. The reviewer's SQL, committed as written

`sql/step-au1-stormproof.sql` section 2 (and its 4b check and rollback) is the
reviewer's rewrite, committed unchanged and attributed. **My version would have
created eleven duplicate keys**: Integrate's import already holds the stormproof
frame and cill sections, and not one of the spellings I guessed. Section 2 now
adds only the single value Integrate has no key for — Nathan's 76 mm stormproof
sash bottom rail, as `casementSashPart.defaultStormProofBottomHeight`, which
was already first in my `sashBottom` candidate list.

Section 1 is a no-op, as the brief says: `sash_type` 'stormproof' already
exists, `applies_to {}` meaning any part.

## 1. `STORMPROOF_CANDIDATES` — the live keys

**Files:** `src/drawingBoard/casementOpenings.js`, `stormproof.js`,
`applyOperationDefaults.js`, `src/pages/DrawingBoard.jsx`

Every section now resolves from the live key, all on the `casementSashPart`
prefix:

| value | live key |
|---|---|
| both jambs | `casementSashPart.defaultStormProofFrameJamb` (41) |
| head | `…defaultStormProofFrameHead` (41) |
| depth | `…defaultStormProofFrameDepth` (69) |
| head / stile / cill stops | `…defaultStormProofFrameHeadStopSize` / `FrameStileStopSize` / `CillStopSize` (15) |
| cill height / depth | `…defaultStormProofCillHeight` (56) / `CillDepth` (69) |
| sash bottom rail | `…defaultStormProofBottomHeight` (76, the reviewer's SQL) |
| overlap | `…stormProofOverlap` (7) |
| jamb type | `…defaultStormProofFrameJambType` ('Solid Profiled') |

**Worth noting:** this is Integrate's own `default<Variant><Thing>` convention,
the same shape as the box sash profile's `sashPairPart.defaultCordFrameJamb` /
`defaultSpiralFrameHead` that `applyOperationDefaults` has always read. Having
seen that, the casement spellings were predictable and I should have looked
there rather than inventing a parallel set.

### I dropped my old spellings rather than keeping them as fallbacks

The brief offered either. **Dropped**, because nothing in the live database uses
them and a leftover candidate can only do harm: it would let a stray key supply
a section the live profile does not actually hold, which is exactly the failure
this fix removes. A test feeds the guessed keys in on their own and asserts all
twelve sections come out `missing`, `stormproofSectionsFor` returns null, and a
stormproof build refuses.

### The frame's bottomHeight — which way I took it

Integrate has **no** stormproof frame-bottom key. The flush build reads its own
`assemblyFramePart.bottomHeight` (47 on the casement profile, which happens to
equal `cillPart.height`). For stormproof I take it from
**`defaultStormProofCillHeight`** (56), because Integrate's drawings store frame
bottomHeight 56 = the cill height on every stormproof window. A
`defaultStormProofFrameBottomHeight` key is tried first, so if one ever appears
it wins without a code change. A test asserts both which key was used and that
`frameBottom === cillHeight`.

### The jamb type

`resolveJambTypeCode` is now **exported** from `applyOperationDefaults.js` and
used by the stormproof path, rather than copied — "the same way" done so the two
cannot drift. `'Solid Profiled'` resolves to `solid_profiled`; a test changes
the label to 'Cased' and asserts the frame comes out `cased`, which proves the
label is really read rather than the answer being hard-coded. `'solid_profiled'`
survives only as the fallback, for a caller with no reference options or a
profile with no jamb-type key — and the jamb type is excluded from `missing`, so
its absence cannot block a conversion the way a missing size does.

`buildCasementFrame` and `setStormproof` take `refOptions`; the board passes
its own.

## 2. `is_replacement_sashes_range` — the drawing's profile

**The reviewer is right and my Step AU answer was wrong.** `default_profiles`
holds Integrate's ranges — 'sash', 'casement', 'sashes_only',
'open_out_doors', 'open_in_doors' — so the range IS the drawing's profile, and
"Product range is set to Sashes Only" is profile code `'sashes_only'`. The
`typeOfWork` guess is gone.

`computeVariables(tree, derived, pfVariables, opts)` now takes
`opts.profileCode` and computes the variable from it. Tests cover all five
range codes and that `typeOfWork = 'sash_replacement'` does **not** set it.

**It is still false in practice, because no caller passes it — deliberately,
not by oversight.** Rule 12 is an ERROR that blocks publishing, and switching it
on starts it firing on real drawings whose data I cannot inspect. Wiring only
*some* callers would be worse than leaving it off: the board would refuse what a
publish allowed. What each caller needs, all eleven call sites of
`computeVariables`:

| caller | what it already has | what to add |
|---|---|---|
| `DrawingBoard.jsx:1071` (validation panel) | `profile` state, with `code` | `{ profileCode: profile?.code }` |
| `DrawingBoard.jsx:514` | same | same |
| `QuoteMatrixPage.jsx:108` | drawing's `default_profile_id` **and** the `default_profiles` list | map id → code, pass it |
| `QuoteOverview.jsx:410` | same (`profiles` state, id/code/label) | same |
| `ValidationRules.jsx:305` | drawing ids only | load the drawing's `default_profile_id` and the codes |
| `publishQuote.js` (via `buildSnapshot.js:483`) | snapshot items | the snapshot must carry each item's profile code |
| `loadPricingContext.js:313`, `pricingEngine.js:762` / `:1183` | — | no rule reads the variable, so pricing needs nothing |
| `PricingBenchmark.jsx:89` | fixtures have no profile row | nothing |

The one that matters is `publishQuote`, since rule 12 gates publishing. If the
snapshot is to carry the profile code, that is the change to make first, and
then all five validation callers can be switched on together.

## 3. Checks — every benchmark unchanged

All thirty totals are identical to before this step. The six stormproof ones:

| | GlazePro cost | Integrate | GlazePro price | Integrate | gap |
|---|---|---|---|---|---|
| **SA** | 729.66 | 738.06 | 1,459.30 | 1,476.10 | −8.40 / −16.80 |
| **SB** | 1,016.37 | *price only* | 2,032.73 | 2,049.53 | −16.80 |
| **SC** | 996.27 | 1,004.67 | 1,992.52 | 2,009.32 | −8.40 / −16.80 |
| **SD** | 1,077.89 | *price only* | 2,155.78 | 2,185.18 | −29.40 |
| **SE** | 1,057.79 | *price only* | 2,115.57 | 2,144.97 | −29.40 |
| **SF** | 1,000.74 | 1,015.44 | 2,001.46 | 2,030.86 | −14.70 / −29.40 |

Every gap is the Kenrick gearbox set, whose four parts carry `unit_cost 0` in
the captured `pf30-snapshot.json` — one set on SA/SB/SC, two on SD/SE/SF. The
live data already has those costs, so these are exact on the live benchmark
page.

The other twenty-four are unchanged too: 15 exact, A50 +0.28 and D +0.54 (the
parked residuals), B_UNCORRECTED −25.46 (deliberate difference 1), J–P −14.70
and Q/R/S −8.40 (the same gearbox gap).

## SQL files this step wrote

**None of my own.** The only SQL is the reviewer's edit to
`sql/step-au1-stormproof.sql`, committed as written in `017a64d`. Nathan runs
that file; it has not been run.

## What the tests show

**1,406 passing, 8 failing** — the standing eight only (A50's lead weight, D's
two steel weights, six Step W counterweight rows).

`src/drawingBoard/stormproof.test.js` goes from 18 to 28 tests. The ten new ones
cover: every section resolving from a `casementSashPart.*` key, nothing
resolving from the guessed spellings, the frame bottom coming from the cill
height, the jamb type resolving from the label both ways, a missing jamb-type
key not blocking a conversion, the conversion resolving it too, and the four
`is_replacement_sashes_range` cases.

## Not verified

- **Nothing in the live database.** `sql/step-au1-stormproof.sql` has not been
  run, and I still cannot read live rows — `claude_readonly_query` admits only
  Nathan's login, so everything about the live keys in this report is the
  reviewer's reading, not mine.
- **`casementSashPart.stormProofLipThickness` (15)** is in the profile and in
  the test fixture, but nothing reads it. If the lip belongs in the drawing or
  in a volume, it is unimplemented — the facts file says only that the sash laps
  7 mm, which is the overlap.
- **The French casement stormproof keys**
  (`left/rightFrenchCasementSashPart.stormProofOverlap` / `LipThickness`) are
  untouched: GlazePro has no French casement part yet.
- **The board control and the 7 mm lap on screen.**
- **`is_replacement_sashes_range` in practice** — the capability is tested, no
  caller supplies it (see item 2).
