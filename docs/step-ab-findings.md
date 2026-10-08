# Step AB findings — whole-mm chamfer allowance, stored bottom rails

Against `docs/step-ab-bottom-rail-brief.md`. All figures from the committed snapshot
(`src/pricing/benchmarks/pf30-snapshot.json`) via `scripts/dump-benchmarks.mjs`; nothing here
is read from the live site.

## Every benchmark, before / after

"Before" is the Step AA state (allowance = unrounded thickness × tan 9°, variants on the
`set_top` workaround); "after" is Step AB (allowance = round(T × tan angle) whole mm, variants
carry Integrate's stored bottom rail 89/89/87 with plain half/half).

| Benchmark | Before (cost / price) | After (cost / price) | Integrate | After state |
|---|---|---|---|---|
| L34046 Item 7 | 1,241.56 / 2,456.24 | 1,241.56 / 2,456.24 | 1,241.56 / 2,456.24 | exact (unchanged) |
| A (45 mm) | 728.26 / 1,408.66 | 728.26 / 1,408.66 | 728.26 / 1,408.66 | exact (unchanged) |
| A35 | 724.23 / 1,403.11 | 724.24 / 1,403.10 | 724.24 / 1,403.10 | **exact** |
| A40 | 726.73 / 1,406.86 | 726.73 / 1,406.84 | 726.73 / 1,406.84 | **exact** |
| A50 | 730.47 / 1,411.99 | 730.48 / 1,411.99 | 730.20 / 1,411.57 | +28p / +42p, top Lead only |
| A35/h1700 | — (new) | 723.26 / 1,401.17 | 723.26 / 1,401.17 | **exact** |
| B | 208.33 / 522.65 | 208.33 / 522.65 | 208.33 / 522.65 | exact (unchanged) |

L34046 and A are byte-identical line for line before and after: at 45 mm the allowance goes
7.13 → 7, which moves the bottom Laminated qty from 2.3590 to 2.3588 — same money on every
line.

## A50 — the one remaining miss (expected; not tuned)

With the stored rail 87, every A50 line that was off at Step AA now matches Integrate
(bottom Glazing Bead 3.1270 → 4.35 / 8.69 ✓, bottom Laminated 2.3588 → 11.68 / 23.35 ✓,
bottom Lead 20.355 → 49.06 / 73.58 ✓). The single remaining difference is the top Lead
Weight: model weight 17.611 kg → 17.6, Integrate 17.5, so qty 20.2400 → 48.78 / 73.17 vs
20.13 → 48.50 / 72.75 — exactly the brief's anticipated +28p cost / +42p price, now the
entire total delta. The weight model was not tuned; the reviewer decides.

## A35/h1700 — line for line against the reviewer's reading

Laminated bottom 2.3583 → 11.67 / 23.35 ✓ (gross 890 + 6 + 1350 = 2246), laminated top
1.9163 → 9.49 / 18.97 ✓ (850 + 75 + 900 = 1825), Glazing Bead 3.1260 → 4.35 / 8.69 ×2 ✓
(glass 802 × 761), staff/parting bead heights × 3.60 ✓, Lead 18.86 / 18.745 → 45.45/68.18,
45.18/67.76 ✓ (weights 16.422 → 16.4 / 16.360 → 16.3), installation materials 128.99 /
212.67 ✓, manufacture materials 34.28 / 68.53 ✓.

## Height checks

With Integrate's stored rails a plain half/half split (equal glass sightlines) draws
Integrate's heights exactly — asserted in `benchmarks.test.js`:
35/40 @ 1701 rail 89 → 850.5 / 890.5; 50 @ 1699 rail 87 → 850.5 / 888.5;
35 @ 1700 rail 89 → 850 / 890. The Step AA `set_top`/`fixedSashHeight` workaround is removed
from the fixtures (the board capability itself remains).

## Not verified

- The live site: all figures are from the committed snapshot; the engine version here
  (v8 after item 5) is not deployed or verified on glazepro.vercel.app.
- The drawing-board behaviour in item 3 (rail + height re-stored when thickness or chamfer
  angle changes) is implemented in `DrawingBoard.jsx`'s field-change handler but has no
  automated test and has not been exercised in a browser from this session. The shared
  allowance formula it uses is unit-tested (`sashGeometry.test.js`).
- Integrate's allowance at angles other than 9° — the whole-mm rounding reproduces all four
  measured thicknesses at 9°, nothing else is measured.
