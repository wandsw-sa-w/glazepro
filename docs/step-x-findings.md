# Step X findings — L34046 on Integrate's real drawing

Written 7 Oct 2026 for the reviewer, from docs/step-x-real-fixture-brief.md.
Benchmarks run with the hand-typed PF30 fixture rules (`npx vite-node
scripts/dump-benchmarks.mjs`); live results are NOT verified here.

## Item 2 — every rule line vs Integrate's stage-4 lines, real fixture

GlazePro totals with the real drawing: cost 1,074.85 / price 2,122.78
(Integrate: 1,241.56 / 2,456.24; the glass_done group is absent from this
hand-typed run because the fixture ships no glass catalogue — the glass CUT
quantity itself is verified at Integrate's 0.75 by test).

Lines that EQUAL Integrate (stage-4) with the real drawing:
Installation Consumables 30.00; Steel Weight (bottom) 20.40 → £27.54/£41.31;
Labour 7.50; Softwood Box Frame Linings → £14.26; Softwood Pulley Stiles and
Head → £8.93; **Box Frame Utile Cill 0.0122 → £19.52/£39.04 — newly exact**
(the old invented cill 1345×45×200 gave 0.0121); Glazing Bead for Sashes
3.3970 → £4.72 (Integrate displays 3.40 = the same qty at 2 dp — **newly
exact at cost level**; the old fixture gave 3.4000 → £4.73); Glazing Bar
2.50; Cill Replacement Profit 0.

Lines that NO LONGER (or still do not) equal Integrate — reported, engine
unchanged, reviewer to decide:

| Rule | Integrate qty | GlazePro qty | Input the engine reads |
|---|---|---|---|
| Steel Weight (top) | 19.40 | 19.50 | `weight_in_kg` rounded to 1 dp: model 19.489 vs Integrate's displayed 19.4 — the 0.089 kg residual crosses the 0.05 display boundary. Cost £26.33 vs £26.19 (+14p), price +20p |
| Production Time | 22.28 h | 23.28 h | `std_labour_time` from the manufacture pass. The +1.00 h is exactly the "Additional for Cruciform" rule: qty 4 × 15 min = 60 min, from `gb_cruciform_joint_to_be_replaced_qty` (vBars × hBars per unit = 2×1 × 2 units). Integrate's 1,337 min total implies that rule contributes 0 on this drawing, although the drawing really has 4 crossings. Pre-existing (unchanged by the fixture); −£49.32 cost would close it |
| Laminated Softwood (Top) | 2.0586 (£10.19) | 2.0533 (£10.16) | `(gross_sash_height_in_mm + gross_sash_width_in_mm) × 1.05 / 1000`. Engine: drawn 815.5 + Victorian constant 70 + lip 0 = 885.5, width 1070 → 1,955.5. Integrate implies 1,960.5 — i.e. EITHER drawn + stored horn 75 with width 1070, OR drawn + 70 with width 1075 (pre-clearance). Benchmark A's same rule is only matched by drawn + 70 + lip 8, which contradicts the stored-horn reading. Not a plain misreading — Integrate's hidden "gross" semantics; stopped |
| Laminated Softwood (Bottom) | 2.5904 (£12.82) | 2.5825 (£12.78) | Same formula with ×1.5 width. Engine: 854.5 + 1.5 × 1070 = 2,459.5. Integrate implies 2,467 = 854.5 + 1.5 × **1075** — the pre-clearance width. Same knot as above; stopped |
| Box Frame Staff Bead | 6.0600 (£19.88) | 6.0480 (£19.84) | `(width + height) × 2` on the frame, metres: (1.245 + 1.779) × 2 = 6.048. Integrate's 6.06 implies width + height = 3.030 — e.g. 1.255 + 1.775 — which is NOT what Integrate's own saved drawing stores (1245 × 1779). Integrate's rule variables ≠ its stored drawing; stopped |
| Box Frame Parting Bead | 6.0600 (£22.42*) | 6.0480 (£22.38) | Same input as Staff Bead |

(*stage-4 prints parting bead £11.21/£22.42.)

Net effect of the open items: cost −20p + Steel top +14p ≈ the −21p/−24p gap
the live site showed at Step W (1,241.78 vs 1,241.56) once Production Time's
£49.32 is set aside as the separately-reported cruciform question — note the
live run DID match within 22p while this fixture-rule run differs by the same
family of lines.

Weights with the real drawing: 19.489 / 20.444 kg — the brief's own
cross-check figures; the weight gap was the fixture, as the brief predicted.

