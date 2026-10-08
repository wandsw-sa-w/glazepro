# Step AC findings — arched head (C) and double box (D) vs Integrate

Against `docs/step-ac-arched-doublebox-brief.md`; facts from
`docs/integrate-benchmarks-arched-doublebox.txt`. All GlazePro figures from the committed
snapshot (`pf30-snapshot.json`) via `scripts/dump-benchmarks.mjs`; nothing read from the live
site. **No engine change was made** — everything below except the fixture-comment correction
is report-and-stop for the reviewer.

## Totals and groups

| | GlazePro | Integrate | Delta |
|---|---|---|---|
| **C total** | 1,012.31 / 2,011.03 | 1,329.08 / 2,644.52 | −316.77 / −633.49 |
| C glass_done | 53.54 / 107.10 | 59.84 / 119.67 | −6.30 / −12.57 |
| C installation_materials | 97.22 / 180.80 | 97.22 / 180.80 | **exact** |
| C manufacture | 479.14 / 958.29 | 795.78 / 1,591.56 | −316.64 / −633.27 |
| C labour | 301.58 / 603.15 | 301.58 / 603.15 | **exact** |
| C manufacture_materials | 80.83 / 161.69 | 74.66 / 149.34 | +6.17 / +12.35 |
| **D total** | 1,951.12 / 3,845.70 | 1,785.67 / 3,545.48 | +165.45 / +300.22 |
| D glass_done | 195.64 / 391.20 | 84.20 / 168.36 | +111.44 / +222.84 |
| D installation_materials | 211.91 / 367.39 | 150.63 / 275.45 | +61.28 / +91.94 |
| D manufacture | 772.60 / 1,545.20 | 772.60 / 1,545.20 | **exact** |
| D labour | 603.15 / 1,206.30 | 643.36 / 1,286.72 | −40.21 / −80.42 |
| D manufacture_materials | 167.82 / 335.61 | 134.88 / 269.75 | +32.94 / +65.86 |

Every penny of both deltas is accounted for by the lines below.

## C — line table (Integrate | GlazePro | verdict)

| Integrate line | GlazePro | Verdict |
|---|---|---|
| Square Glass Cost (bottom) 0.35 × 58.50 = **20.48** → 40.95 | 0.3500 → **20.47** → 40.95 | wrong cost by 1p: raw 0.35 × 58.5 = 20.475 lands at 20.474999… in floats and `round(…, 2)` gives 20.47; a decimal-safe half-up (as Step Y's metre rounding) gives Integrate's 20.48. Engine change — reported, not made |
| Shaped Glass Cost (top) 0.32 × 71.88 = 23.00 → 46.00 | **missing** — the top unit prices as a second Square Glass Cost 0.35 × 58.50 = 20.47 → 40.95 | the arch never reaches the glass (below) |
| Shaped Glass Multiple Glazing Bar 0.32 × 44.00 = 14.08 → 28.16 | **missing** — Square Glass Multiple Glazing Bar 0.35 × 29.20 = 10.22 → 20.44 fires instead | same cause |
| All Glass Energy (top) **6.40** × 0.17 = 1.09 → 2.18 | **7.00** × 0.17 = 1.19 → 2.38 | wrong quantity — Integrate reduces the arched unit's energy qty 7.0 → 6.4; GlazePro's unit is square |
| All Glass Energy (bottom) 7.00 × 0.17 = 1.19 → 2.38 | same | matched |
| Claw Fastener Kit Square Pulley PB 26.25 → 52.50 | HKKS1075PB, same | matched |
| Trickle Vent XR16 White 3.15 → 6.30 | RHZ665, same | matched |
| Ogee Architrave 2.85 × 2.60 = 7.41 → 14.82 and 2.85 × 1.10 = 3.14 → 6.27 | Surround timber – height / width (TP68), same | matched |
| Installation Consumables 30.00 → 60.00 | same | matched |
| Steel Weight 10.00 × 1.35 = 13.50 → 20.25 (top) | 10.0000, same (model weight 10.046 → 10.0) | matched |
| Steel Weight 10.20 × 1.35 = 13.77 → 20.66 (bottom) | 10.2000, same (10.298 → 10.2) | matched — the weight model is right on the arched drawing |
| Production Time **32.27 h** → 795.78 / 1,591.56 | **19.43 h** → 479.14 / 958.29 | wrong quantity: 12.84 h of arch-related manufacture time never fires (`is_sash_arched` is false — six snapshot rules use it) |
| Labour 7.50 h → 301.58 / 603.15 | same | matched |
| Laminated Softwood 1.90 → 9.39 / 18.79 and 1.50 → 7.40 / 14.81 | 1.8979 / 1.4957, same | matched |
| Softwood Box Frame Linings 7.47 × 1.35 = 10.09 → 20.18 | 7.4734, same | matched |
| Softwood Pulley Stiles and Head 3.74 × 1.69 = 6.32 → 12.63 | 3.7367, same | matched |
| Box Frame Utile Cill 0.0098 × 1,600 = 15.66 → 31.33 | 0.0098, same | matched |
| Box Frame Staff Bead 4.40 × 3.28 = 14.43 → 28.86 | same | matched |
| Box Frame Parting Bead 4.40 × 1.85 = 8.14 → 16.28 | same | matched |
| Glazing Bead 2.33 × 1.39 = 3.23 → 6.46 — **one line, bottom sash only** | **two** lines, 2.3250 each (3.23 → 6.46) | extra top-sash line (+3.23 / +6.46): Integrate prices no glazing bead on the arched sash |
| *(no Glazing Bar line, although the top sash has 2V + 1H bars)* | Glazing Bar 1.6000 × 1.84 = 2.94 → 5.89, plus a 0.00-qty bar line on the barless unit | extra (+2.94 / +5.89): Integrate folds the bars into Shaped Glass Multiple GB instead |
| *(not listed)* | Cill Replacement Profit 0.00 | zero-value line, fires at qty 0 on every complete-new benchmark; cosmetic |

Reconciliation (cost): 316.64 (production) + 6.29 (shaped-vs-square top unit) + 0.01 (20.48
rounding) − 3.23 (extra bead) − 2.94 (extra bar) = 316.77 ✓.

## D — line table (Integrate | GlazePro | verdict)

| Integrate line | GlazePro | Verdict |
|---|---|---|
| Square Glass Cost 0.34 × 58.50 = 19.89 → 39.78, ×4 | 0.7900 → 46.22 → 92.43, ×4 | wrong quantity: cut glass 1551 × 510.5 from the 1625-wide sash vs Integrate's 664 × 510.5 at 738 (per-pair width, below) |
| All Glass Energy 6.80 × 0.17 = 1.16 → 2.31, ×4 | 15.80 → 2.69 → 5.37, ×4 | wrong quantity, same cause |
| Claw Fastener Kit Square Pulley PB qty 2 = 52.50 → 105.00 | same (default ironmongery loops both pairs) | matched |
| Trickle Vent XR16 White 3.15 → 6.30 | same | matched |
| Ogee Architrave 2.85 × 2.80 = 7.98 → 15.96 and 2.85 × 1.90 = 5.42 → 10.83 | Surround timber – height / width, same | matched |
| Installation Consumables 30.00 → 60.00 | same | matched |
| Steel Weight 9.20 × 1.35 = 12.42 → 18.63, ×2 (tops) | 20.2000 → 27.27 → 40.91, ×2 | wrong quantity: weight 20.234 kg from a 1625-wide sash vs Integrate's 9.2 at 738 |
| Steel Weight 9.90 × 1.35 = 13.37 → 20.05, ×2 (bottoms) | 21.6000 → 29.16 → 43.74, ×2 | wrong quantity, same cause |
| Production Time 31.33 h → 772.60 / 1,545.20 | same | **matched exactly** |
| Labour **16.00 h** → 643.36 / 1,286.72 | **15.00 h** → 603.15 / 1,206.30 | wrong quantity: GlazePro gives 2 × the single-pair 7.5 h; Integrate adds 1.00 h for the double box. Which Integrate rule adds it is not visible from here |
| Laminated Softwood (bottom) 1.81 → 8.98 / 17.97, ×2 | 3.2120 → 15.90 / 31.80, ×2 | wrong quantity (gross width 1625 vs 738) |
| Laminated Softwood (top) 1.46 → 7.22 / 14.43, ×2 | 2.3893 → 11.83 / 23.65, ×2 | wrong quantity, same cause |
| Softwood Box Frame Linings 12.53 × 1.35 = 16.92 → 33.84 | 12.5334, same | matched |
| Softwood Pulley Stiles and Head 7.70 × 1.69 = 13.01 → 26.01 | 7.6956, same | matched |
| Box Frame Utile Cill 0.0176 × 1,600 = 28.22 → 56.45 | 0.0176, same | matched — GlazePro's one full-width cill prices the same as Integrate's two 743 cills |
| Box Frame Staff Bead 6.20 × 3.28 = 20.34 → 40.67 | same | matched |
| Box Frame Parting Bead 6.20 × 1.85 = 11.47 → 22.94 | same | matched |
| Glazing Bead 2.25 × 1.39 = 3.13 → 6.26, ×4 | 4.0270 → 5.60 → 11.20, ×4 | wrong quantity (glass 1527 wide vs 640) |
| *(none)* | 4 × Glazing Bar 0.00 | zero-value lines; cosmetic |
| *(none)* | Cill Replacement Profit 0.00 | zero-value line; cosmetic |

Reconciliation (cost): −111.44 (glass) − 61.28 (steel) − 23.06 (laminated) − 9.88 (bead)
+ 40.21 (labour) = −165.45 ✓.

## Causes — all report-and-stop, per the brief

1. **Per-pair geometry (D).** `computeDerived` has one `sashPairPart` whose internalWidth is
   the whole interior; `computeOpeningLayout` exists but ignores the mullion's thickness, and
   the pricing engine's part variables always read the FIRST pair's geometry. Every
   width-driven D line (glass, energy, steel, laminated, bead) is wrong the same way; the
   second pair has no derived geometry at all. Heights are right (575.5 / glass 486.5).
2. **Arch semantics (C).** GlazePro's board saves `archHead`/`archHeight` on the FRAME; the
   engine's `is_sash_arched` reads `archHead` on the sash and the glass unit is square. So:
   shaped-glass rules don't fire (top unit prices square), the arched unit's energy qty stays
   7.0 (Integrate 6.4), 12.84 h of arch manufacture time is missing, and the bead/bar lines
   Integrate suppresses on an arched sash still fire. Integrate's sash-level fields
   (shoulderHeight 336.5, archRadius 708.9, isFrameLevelArch, archedOuterJamb) have no
   board-saved GlazePro counterpart.
3. **Float rounding (C, 1p).** `line_cost = round(qty × value, 2)` on 0.35 × 58.5 = 20.475
   gives 20.47 (float 20.474999…); Integrate has 20.48. Needs the same decimal-safe half-up
   treatment Step Y gave the frame metres — an engine change, so not made.
4. **D labour +1 h.** Integrate's 16.00 vs our 15.00 (2 × 7.5): some double-box/mullion install
   adder we cannot see from here.
5. **Hollow mullion / two cills.** No GlazePro fields for `isHollowMullion`, mullion stop 16,
   or a second cill. Carried as comments in the fixtures; money-wise the single cill already
   matches Integrate's two.

What proved RIGHT on these shapes: C's installation materials and labour groups are exact
(including both steel weights on the arched drawing — the weight model needs no arch term),
D's production time is exact, and the architrave ("Surround timber"), ironmongery defaults
(claw kit ×2 from two pairs), linings, pulley stiles, cill and both box-frame beads match on
both items.

## Not verified

- Anything live: all figures are from the committed snapshot; engine v8 is not verified on
  glazepro.vercel.app.
- Which Integrate rule carries D's extra 1.00 h labour, and how Integrate derives the arched
  unit's 6.40 energy qty and 0.32 shaped area — only the printed quantities are facts.
- Integrate's treatment of the 20.475 rounding elsewhere — one occurrence measured.
