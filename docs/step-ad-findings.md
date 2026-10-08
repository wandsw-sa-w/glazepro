# Step AD findings — arched sashes and per-pair geometry

Against `docs/step-ad-arch-and-pairs-brief.md`. All figures from the committed snapshot
(`pf30-snapshot.json`) via `scripts/dump-benchmarks.mjs`; nothing read from the live site.

## Headline

| Benchmark | Before (Step AC) | After Step AD | Integrate | State |
|---|---|---|---|---|
| **C arched** | 1,012.31 / 2,011.03 | **1,329.08 / 2,644.52** | 1,329.08 / 2,644.52 | **EXACT** |
| **D double box** | 1,951.12 / 3,845.70 | 1,746.00 / 3,465.86 | 1,785.67 / 3,545.48 | −39.67 / −79.62, two known causes below |
| L34046, A, A35/40/50/h1700, B | — | unchanged, byte-identical line dumps | — | A50 keeps its known top-Lead miss |

## C — line table after Step AD (GlazePro | Integrate)

Every line equals Integrate:

| Line | GlazePro | Integrate |
|---|---|---|
| Square Glass Cost (bottom) | 0.3500 → 20.48 / 40.95 | 20.48 / 40.95 ✓ (decision 4: 20.475 now rounds half-up) |
| Shaped Glass Cost (top) | 0.3200 → 23.00 / 46.00 | 23.00 / 46.00 ✓ (decision 2: exact cut-shape area 0.3199 → 0.32) |
| Shaped Glass Multiple GB | 0.3200 → 14.08 / 28.16 | 14.08 / 28.16 ✓ |
| Energy (top / bottom) | 6.40 → 1.09 / 2.18 · 7.00 → 1.19 / 2.38 | ✓ ✓ |
| Claw kit PB / Trickle Vent | 26.25 → 52.50 · 3.15 → 6.30 | ✓ ✓ |
| Ogee Architrave ×2 | 7.41 / 14.82 · 3.14 / 6.27 | ✓ ✓ |
| Consumables | 30.00 → 60.00 | ✓ |
| Steel Weight top / bottom | 10.00 → 13.50 / 20.25 · 10.20 → 13.77 / 20.66 | ✓ ✓ — **unchanged by the arch work** (weight keeps the rectangular envelope, per the brief) |
| Production Time | **32.27 h** → 795.78 / 1,591.56 | ✓ — the 770 missing minutes were exactly Sash Swept Head (600) + Swept Head Joinery (120) + Box Frame Joining with Swept Head Outer (50 × 1) |
| Labour | 7.50 h → 301.58 / 603.15 | ✓ |
| Laminated top / bottom, Linings, Pulley Stiles, Utile Cill, Staff / Parting Bead | all | ✓ |
| Glazing Bead | ONE line, bottom only, 2.3250 → 3.23 / 6.46 | ✓ (suppressed on the arched sash) |
| Glazing Bar | suppressed on the arched unit | ✓ (only the 0.00-qty line on the barless bottom unit remains) |

A semantic note the reviewer should see: Integrate's own charging for this drawing is the
**swept-head** family, not "Curved Head" — so `is_square_top_with_arched_sightline` is derived
as "arched sightline and not a fully curved head" (`archHead && !curvedSashHead`), and the
`is_curved_head_sash` rules (860/1680/3360 min) still key on the separate `curvedSashHead`
field. `isFrameLevelArch` turned out to drive **nothing in pricing** (none of the
curved-inner-head frame rules fire on C in Integrate); it is stored and used for drawing only.

## D — line table after Step AD (GlazePro | Integrate)

| Line | GlazePro | Integrate |
|---|---|---|
| Square Glass Cost ×4 | 0.3400 → 19.89 / 39.78 | ✓ (was 0.79 at the old 1625 width) |
| Energy ×4 | 6.80 → 1.16 / 2.31 | ✓ |
| Claw kit ×2 / Trickle | 52.50 → 105.00 · 3.15 → 6.30 | ✓ ✓ |
| Ogee Architrave ×2 | 7.98 / 15.96 · 5.42 / 10.83 | ✓ ✓ |
| Consumables | 30.00 → 60.00 | ✓ |
| **Steel Weight** tops ×2 | **9.30 → 12.56 / 18.83** | 9.20 → 12.42 / 18.63 — model weight 9.372 vs Integrate's < 9.3 |
| **Steel Weight** bottoms ×2 | **10.00 → 13.50 / 20.25** | 9.90 → 13.37 / 20.05 — model 10.031 vs < 10.0 |
| Production Time | 31.33 h → 772.60 / 1,545.20 | ✓ (still exact with the corrected widths) |
| **Labour** | **15.00 h** → 603.15 / 1,206.30 | 16.00 h → 643.36 / 1,286.72 |
| Laminated bottom ×2 / top ×2 | 1.8149 → 8.98 / 17.97 · 1.4579 → 7.22 / 14.43 | ✓ ✓ |
| Linings / Pulley Stiles / Utile Cill / Staff / Parting | 16.92, 13.01, 28.22, 20.34, 11.47 | ✓ all |
| Glazing Bead ×4 | 2.2530 → 3.13 / 6.26 | ✓ |

Reconciliation: −40.21/−80.42 (labour) + 0.54/+0.80 (steel, four lines) = −39.67/−79.62 ✓.

### D steel weights — report, not tuned

With each pair at its true 738 width the Step W weight model gives 9.372 / 10.031 kg
(truncated 9.3 / 10.0) where Integrate shows 9.2 / 9.9 — about 0.12 kg heavy per sash, both
sashes, both pairs. The model was measured on 900–1200 mm sash-replacement drawings; this is
its first complete-new double-box reading. Not tuned (same policy as A50's top Lead); the four
steel lines carry +0.54 cost / +0.80 price.

### D labour +1 h — "not in the snapshot" (decision 5)

Every active install_labour rule was evaluated on D. Firing: only "Sash Windows (New
Complete)" qty 2 × 450 min = 900 min = 15.00 h (plus seven qty-0 lines). No non-firing rule is
nearly true: the only rules worth naming are Venetian DSO (360 min — needs 3 pairs and not
nj_involved), Hardwood Cill Replacement (150 min — `new_cill_qty >= 1` is only set for
non-complete-new cill replacements), and Sash Window with Fanlight (needs casement sashes).
The 60-minute-value rules are all casement / bi-glass / third-floor rules. **Integrate's extra
1.00 h on the double box does not correspond to any active install_labour rule in the
snapshot.** No rule was added, per the brief.

## Template correction for the reviewer / Nathan (decision 3)

The GlazePro double-box TEMPLATE stores `mullionPart { thicknessInFrame: 40, offset: 815 }`
(centre-based offset). Under the decided semantics (offset = LEFT face, thickness from the
profile value `thicknessInFrameHollow` = 144) it should store `offset: 743`. Saved templates
were not edited by this step.

## Not verified

- Anything live: all figures are from the committed snapshot; engine v9 is not deployed.
- **Board UI in particular**: the arch input fields move to the top sash only when Nathan runs
  `sql/step-ad-arch-fields.sql`; the frame-head rendering (concentric from the glass arc,
  approximate — Integrate's outer-jamb R 741.8 follows no derivable offset rule) and the
  double-box drawing with real mullion thickness have not been exercised in a browser.
- Legacy arched drawings (e.g. real tree L507712 drawing 9, frame-level archHead 150): they now
  price as a top-sash arch with the stored rise taken as the glass rise, with a vocabulary
  warning naming the reinterpretation. No Integrate target exists for that drawing.
- Integrate's charging at other arch geometries (full curved head, shoulder 0, casements).
