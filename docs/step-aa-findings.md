# Step AA findings — sash replacement at 35 / 40 / 50 mm vs Integrate

Written against `docs/step-aa-thickness-benchmarks-brief.md` and the fact file
`docs/integrate-benchmarks-thickness.txt`. All GlazePro figures below come from the committed
snapshot (`src/pricing/benchmarks/pf30-snapshot.json`, real `is_active` flags, engine v7), via
`scripts/dump-benchmarks.mjs`. Nothing here is from the live site.

## Totals

| Variant | GlazePro cost / price | Integrate target | Delta |
|---|---|---|---|
| A35 | 724.23 / 1,403.11 | 724.24 / 1,403.10 | **−1p cost / +1p price** |
| A40 | 726.73 / 1,406.86 | 726.73 / 1,406.84 | **exact cost / +2p price** |
| A50 | 730.47 / 1,411.99 | 730.20 / 1,411.57 | **+27p cost / +42p price** |
| A (45, unchanged) | 728.26 / 1,408.66 | 728.26 / 1,408.66 | exact |

L34046 and B are unchanged and still exact. Drawn sash heights match Integrate at all three
thicknesses (asserted in the Step AA height tests: 35/40 → 850.5 / 890.5; 50 → 850.5 / 888.5),
so item 1's "report and stop" condition did not trigger. One representation note: at interior
height 1701 a plain `half_half` split draws 851 / 890, not Integrate's 850.5 / 890.5, so the
fixtures record what Integrate's drawing shows as drawing data — `sashSplit: 'set_top'` with
`fixedSashHeight: 850.5` — per the brief's "the fixtures simply use Integrate's resulting
heights".

## Changing lines, line by line (GlazePro | Integrate)

Lead Weight (qty × 2.41, cost / price):

| Variant | Top | Bottom |
|---|---|---|
| A35 | 18.8600 → 45.45 / 68.18 ✓ | 18.7450 → 45.18 / 67.76 ✓ (Integrate displays qty 18.75) |
| A40 | 19.3200 → 46.56 / 69.84 ✓ | 19.3200 → 46.56 / 69.84 ✓ |
| A50 | **20.2400 → 48.78 / 73.17** vs 20.13 → 48.50 / 72.75 (**+28p / +42p**) | 20.3550 → 49.06 / 73.58 ✓ |

Sash weights behind those (model, truncated to 0.1 | Integrate):
35: 16.431 → 16.4 / 16.372 → 16.3 ✓✓ · 40: 16.825 → 16.8 / 16.855 → 16.8 ✓✓ ·
50: **17.611 → 17.6 vs 17.5** / 17.782 → 17.7 ✓. The A50 top lead miss is exactly the one the
brief anticipated ("the model gives 17.61 kg → 17.6 where Integrate has 17.5"). Not tuned, per
the brief; the reviewer will decide.

Bead lines: staff bead (h) 2.59 × 3.80 = 9.84 / 19.68 and parting bead (h) 2.22 × 3.80 =
8.44 / 16.87 at 35 and 40 ✓; at 50 both revert to × 3.60 (9.32 / 18.65, 7.99 / 15.98), same as
benchmark A ✓. Width lines unchanged ✓.

## Lines Integrate holds IDENTICAL that move by a penny in GlazePro

The fact file says the Laminated Softwood and Glazing Bead lines are identical at all four
thicknesses. In GlazePro two bottom-sash lines drift by 1p:

| Line | A35 | A40 | A45 (A) | A50 | Integrate (all) |
|---|---|---|---|---|---|
| Laminated Bottom | 2.3583 → **11.67** / 23.35 | 2.3592 → 11.68 / **23.36** | 2.3590 → 11.68 / 23.35 ✓ | 2.3587 → 11.68 / 23.35 ✓ | 2.36 → 11.68 / 23.35 |
| Glazing Bead (bottom) | 3.1290 → 4.35 / **8.70** | 3.1290 → 4.35 / **8.70** | 3.1270 → 4.35 / 8.69 ✓ | 3.1250 → **4.34** / 8.69 | 3.13 → 4.35 / 8.69 |

Top-sash Laminated (1.9168 → 9.49 / 18.98) and top Glazing Bead (3.1270 → 4.35 / 8.69) are
exact at every thickness.

Cause, in both cases the bottom sash's thickness-dependent geometry:

1. **Chamfer allowance.** GlazePro's bottom gross sash height adds `thickness × tan(9°)` —
   5.54 / 6.34 / 7.13 / 7.92 mm at 35 / 40 / 45 / 50 (Step Y measured this only at 45 mm).
   Integrate's identical Laminated lines imply its effective bottom gross height is constant
   across thickness (consistent with the brief's note that Integrate keeps the external height
   constant). Combining Integrate's drawn heights with GlazePro's allowance gives bottom gross
   heights of 896.04 / 896.84 / 896.63 / 896.42 — fractions of a mm apart, enough to flip the
   2-decimal rounding by 1p at 35 and 40.
2. **Bottom glass height.** The drawn bottom height moves with Integrate's 1701 / 1699 interior
   (890.5 at 35/40, 888.5 at 50, vs A's 889.5), so the bottom glass sightline height moves to
   762.5 / 760.5 vs 761.5, and the bottom Glazing Bead qty becomes 3.1290 / 3.1250 vs 3.1270.
   Integrate's bead pair stays at 8.69 ×2 regardless.

These reconcile the totals exactly: A35 = −1p cost (Laminated) + 1p price (Bead);
A40 = +1p price (Laminated) + 1p price (Bead); A50 = +28p/+42p (top Lead) − 1p cost (Bead).

## Decision needed (report and stop — no engine change made)

Making A35/A40 exact would require an engine change: either holding the bottom sash's external
(gross) height constant when thickness changes, or deriving the chamfer allowance some way
other than `thickness × tan(9°)` at non-45 thicknesses. The brief says no engine change is
expected in this step, so none was made; the three honest tests fail truthfully
(`benchmarks.test.js`, "Benchmark A35/A40/A50 matches the Integrate targets") and the reviewer
decides.

## Not verified

- The live site: all figures are from the committed snapshot. Engine v7 behaviour on
  glazepro.vercel.app is not verified from here.
- Integrate's internal chamfer/allowance rule at 35/40/50 mm — only inferred from its identical
  Laminated/Bead lines; no drawing measurement exists at those thicknesses.
- Whether Integrate's displayed lead qty 18.75 (A35 bottom) is 18.745 displayed at 2 dp or a
  genuinely different quantity — the money (45.18 / 67.76) matches either way.
