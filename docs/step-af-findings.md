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
