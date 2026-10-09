# Step AM findings — cill replacement benchmarks G, H and I

Against `docs/step-am-cill-replacement-brief.md`; facts from
`docs/integrate-L31115-cill.txt`. All figures from the committed snapshot
(`pf30-snapshot.json`) via `scripts/dump-benchmarks.mjs`; nothing read from the live site.

## Totals

| | GlazePro | Integrate target | |
|---|---|---|---|
| **G — sash replacement + new cill** | 829.78 / 1,809.71 | 829.78 / 1,809.71 | **EXACT, first run** |
| **H — draught seal + new cill (corrected)** | 309.86 / 923.70 | 309.86 / 923.70 | **EXACT, first run** |
| **I — stand-alone cill (corrected)** | 101.53 / 401.05 | 101.53 / 401.05 | **EXACT after one engine fix (below)** |

The cill block Integrate charges is identical on all three: a Cill Replacement line
1.00 × markup 200 = **200.00** (extra_profits) and **2.50 h** of install labour
("Hardwood Cill Replacement", 150 min), with **no cill timber** — the Box Frame Utile Cill
rule only fires when the frame is replaced, and it does not fire on any of the three.

One honest detail about that "block": the total it adds is a penny apart between G and H
(101.52 vs 101.53) because the Labour line is rounded once, as a whole — A 4.75 h → 191.00 and
G 7.25 h → 291.52 differ by 100.52, while B 4.00 h → 160.84 and H 6.50 h → 261.37 differ by
100.53. Integrate's own totals carry the same penny, so the tested invariant is the hours and
the cill line, not a constant block.

## G — every line (GlazePro | Integrate)

Identical to benchmark A except the two lines the cill adds:

| Line | GlazePro | Integrate |
|---|---|---|
| **Labour** | **7.2500 h** × 40.21 = 291.52 / 583.05 | ✓ (A: 4.75 h) |
| **Cill Replacement** | 1.0000 × markup 200 = 1.00 / **200.00** | ✓ |
| Square Glass ×2, Multiple GB, Energy ×2 | 0.65 → 38.03/76.05 ×2 · 18.98/37.96 · 13.00 → 2.21/4.42 ×2 | ✓ (glass 99.46 / 198.90) |
| Claw kit without pulleys PB | 13.65 → 27.30 | ✓ |
| Staff bead width / height, parting height / width | 5.18/10.36 · 9.32/18.65 · 7.99/15.98 · 2.22/4.44 | ✓ |
| Lead Weight top / bottom | 19.78 → 47.67/71.50 · 19.895 → 47.95/71.92 | ✓ (installation materials 133.98 / 220.15) |
| Production Time | 10.93 h → 269.53 / 539.07 | ✓ |
| Laminated bottom / top, Glazing Bead ×2, Glazing Bar | 11.68/23.35 · 9.49/18.98 · 4.35/8.69 ×2 · 4.42/8.83 | ✓ (34.29 / 68.54) |
| Box Frame Utile Cill | does not fire | ✓ none |

## H — every line (GlazePro | Integrate)

Identical to benchmark B except the same two lines:

| Line | GlazePro | Integrate |
|---|---|---|
| **Labour** | **6.5000 h** × 40.21 = 261.37 / 522.73 | ✓ (B: 4.00 h) |
| **Cill Replacement** | 1.00 / **200.00** | ✓ |
| DSO SqM Rate | 1.32 × 10.00 = 13.20 / 26.40 | ✓ |
| Brighton Fastener Kit without pulleys PB | 12.60 / 25.20 | ✓ |
| Staff bead width / height, parting height / width | 5.70/11.40 · 6.22/12.43 · 5.33/10.66 · 2.44/4.88 | ✓ |
| DSO Extra Profits | 2.00 × markup 55 = 2.00 / 110.00 | ✓ |
| Laminated ×2, Glazing Bead ×2 | **do not fire** | Integrate charges them (25.46 / 50.90) — deliberate difference 1 (S4) |

Integrate's own figure is **335.32 / 974.60**; the corrected target 309.86 / 923.70 removes
exactly those three S4 lines, which is how benchmark B's pair has always been handled. Checked
in the tests: 335.32 − 309.86 = 25.46 and 974.60 − 923.70 = 50.90 ✓.

## I — every line, and the engine fix it needed

| Line | GlazePro | Integrate |
|---|---|---|
| **Labour** | **2.5000 h** × 40.21 = 100.53 / 201.05 | ✓ |
| **Cill Replacement** | 1.00 / **200.00** | ✓ |
| Laminated ×2, Glazing Bead ×2 | do not fire | Integrate charges them (25.46 / 50.90) — difference 1 again |
| DSO rate, DSO extra profits, ironmongery, installation consumables | none | ✓ none |
| Staff bead width / height, parting bead height / width | **none — after the fix** | ✓ none |

Before the fix I priced **121.22 / 440.42**, over by 19.69 / 39.37: four component bead lines
fired (staff bead width 5.70/11.40 and height 6.22/12.43, parting bead height 5.33/10.66 and
width 2.44/4.88). Integrate charges none of them on a stand-alone cill, and its own rule
conditions are only `is_small_staff_bead and not frame_to_be_replaced` / `not
frame_to_be_replaced` — which are true here.

**Why `interior_qty` is not the explanation.** Only three of those rules use it as their
quantity (staff bead width, large staff bead width, parting bead height); staff bead height
uses a fixed `1` and parting bead width a fixed `0.5`. Setting `interior_qty` to 0 would
therefore silence two of the four lines and leave the other two — so the mechanism cannot be
the quantity.

**The fix, in the loop — the Step AH pattern.** As with the glass_unit loop in Step AH,
Integrate's conditions carry no gate because its **loop** never visits what nothing is being
done to. A new item variable `item_has_sash_work` (`nj_involved or needs_draughtsealing or
is_bi_glass`) is false on a stand-alone cill and on "no work", and both sliding_sash loops —
the pricing engine's and the part allocator's own copy — skip the sashes when it is false.
Integrate's rule text is untouched. A full line diff across all fifteen priced trees shows
this removed **exactly those four lines on I and nothing else**. `PRICING_ENGINE_VERSION` → 12
(with the `new_cill_qty` change from item 1).

Note what this does **not** gate: every other sliding_sash rule already gates itself — the
laminated and glazing bead rules on `to_be_replaced` (S4), Lead Weight on `is_cord_hung and
to_be_replaced`, Spiral Balances on `is_spiral_hung and to_be_replaced` — so on a draught seal
(B, H) the beads still fire, exactly as Integrate charges them.

## Not verified

- Anything live: all figures are from the committed snapshot; engine v12 is not deployed, and
  the reviewer's `sql/step-am1-cill-replacement-fields.sql` has to be run before the two cill
  fields and the "Cill Replacement Only" type of work appear on the board at all.
- The board behaviour in a browser: the Repair field appearing only where it applies, Full
  Cill Replacement appearing only once Repair = New Cill, and the type-of-work rules.
- `item_has_sash_work` rests on one Integrate reading (benchmark I). It is the only mechanism
  that fits that reading, and it changes nothing on any other benchmark, but no second
  stand-alone-cill drawing exists to confirm it.
- Full Cill Replacement changes no price in Integrate (GBP 1,809.71 both ways) and none here
  either, because GlazePro already derives `cill_length_in_mm` from the frame width; the tick
  is stored for the workshop. Not verified beyond that one Integrate reading.
