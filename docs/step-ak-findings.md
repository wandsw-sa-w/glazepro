# Step AK findings — spiral balance benchmarks E and F

Against `docs/step-ak-spiral-brief.md`; facts from `docs/integrate-L31115-spiral.txt`. All
figures from the committed snapshot (`pf30-snapshot.json`) via `scripts/dump-benchmarks.mjs`;
nothing read from the live site.

## Totals

| | GlazePro | Integrate | |
|---|---|---|---|
| **E — complete new spiral** | 1,010.40 / 2,020.74 | 1,010.40 / 2,020.74 | **EXACT, first run, no change needed** |
| **F — spiral replacement** | 704.69 / 1,409.42 | 704.69 / 1,409.42 | **EXACT after one engine fix (below)** |

Group totals match too: E glass 68.10/136.18, install 59.06/118.11, manufacture
411.08/822.16, labour 301.58/603.15, materials 170.58/341.14; F glass 116.27/232.56, install
40.81/81.61, manufacture 269.53/539.07, labour 191.00/382.00, materials 87.08/174.18.

## E — every line (GlazePro | Integrate)

| Line | GlazePro | Integrate |
|---|---|---|
| Square Glass Cost ×2 | 0.5500 → 32.18 / 64.35 | ✓ |
| All Glass Energy ×2 | 11.0000 → 1.87 / 3.74 | ✓ |
| Claw Fastener Kit **without** pulleys PB | 13.65 → 27.30 (HKKNP1075PB) | ✓ |
| Trickle Vent XR16 White | 3.15 → 6.30 | ✓ |
| Ogee Architrave MDF, height / width | 2.85 × 3.20 = 9.12 / 18.24 · 2.85 × 1.10 = 3.14 / 6.27 | ✓ ✓ |
| Installation Consumables | 30.00 → 60.00 | ✓ |
| Production Time | **16.67 h** → 411.08 / 822.16 | ✓ |
| Labour | **7.50 h** → 301.58 / 603.15 | ✓ |
| Laminated Softwood bottom / top | 2.2638 → 11.21 / 22.41 · 1.8013 → 8.92 / 17.83 | ✓ (2.26 / 1.80) |
| **Softwood Spiral Frame** | 4.4000 × 2.60 = 11.44 / 22.88 | ✓ |
| **Softwood Spiral Frame Linings** | 4.4000 × 9.00 = 39.60 / 79.20 | ✓ |
| Box Frame Utile Cill | 0.0098 × 1,600 = 15.68 / 31.36 | ✓ |
| Box Frame Staff Bead | 5.0000 × 3.28 = 16.40 / 32.80 | ✓ |
| Box Frame Parting Bead | 5.0000 × 1.85 = 9.25 / 18.50 | ✓ |
| Glazing Bead for Sashes ×2 | 2.9070 → 4.04 / 8.08 | ✓ |
| **Spiral Balances ×2** | 1.0000 × 25.00 = 25.00 / 50.00 | ✓ |
| Lead Weight / Steel Weight | **do not fire** (`is_cord_hung` false) | ✓ none |
| Box Frame Linings / Pulley Stiles | **do not fire** (`is_solid_spiral_jamb` true) | ✓ none |
| Glazing bar lines | none (no bars) | ✓ none |

## F — every line (GlazePro | Integrate)

| Line | GlazePro | Integrate |
|---|---|---|
| Square Glass Cost ×2 | 0.7600 → 44.46 / 88.92 | ✓ |
| Square Glass Multiple Glazing Bar (top) | 0.7600 → 22.19 / 44.38 | ✓ |
| All Glass Energy ×2 | 15.2000 → 2.58 / 5.17 | ✓ |
| Claw Fastener Kit without pulleys PB | 13.65 → 27.30 | ✓ |
| Small staff bead width / height | 2.59 × 2.40 = 6.22 / 12.43 · 2.59 × 3.80 = 9.84 / 19.68 | ✓ ✓ |
| Standard parting bead height / width | 2.22 × 3.80 = 8.44 / 16.87 · 2.22 × 1.20 = 2.66 / 5.33 | ✓ ✓ |
| Production Time | **10.93 h** → 269.53 / 539.07 (= A's) | ✓ |
| Labour | **4.75 h** → 191.00 / 382.00 (= A's) | ✓ |
| Laminated Softwood bottom / top | 2.5652 → 12.70 / 25.39 · 2.0633 → 10.21 / 20.43 | ✓ (2.57 / 2.06) |
| Glazing Bead for Sashes ×2 | 3.4060 → 4.73 / 9.47 | ✓ |
| **Glazing Bar** | **2.5600** × 1.84 = 4.71 / 9.42 | ✓ — was 2.5000 → 4.60 / 9.20 before the fix |
| **Spiral Balances ×2** | 1.0000 × 25.00 = 25.00 / 50.00 | ✓ |
| Lead Weight | **does not fire** | ✓ none |

Every F line matched on the first run except the Glazing Bar, which was 11p cost / 22p price
short — exactly F's whole delta.

## The one engine change: the glazing bar run (engine version 11)

`internal_spacer_length` (used by one rule, Glazing Bar) was the bar run at the **sightline**,
ceiled to 0.1 m. Three Integrate readings now exist, and only one rule fits all three — the run
at the glass **CUT** size (sightline + 2 × (rebate − tolerance) per axis, the same cut the glass
price uses), rounded **half-up to 2 dp**:

| Reading | sightline run | ceil 0.1 (old) | cut run | **cut, 2 dp (new)** | Integrate |
|---|---|---|---|---|---|
| A | 2 × 761.5 + 802 = 2325 | 2.40 | 2397 | **2.40** | 2.40 |
| L34046 | 2 × 726.5 + 972 = 2425 | 2.50 | 2497 | **2.50** | 2.50 |
| F | 2 × 787.0 + 916 = 2490 | 2.50 ✗ | 2562 | **2.56** | 2.56 |

The old rule matched A and L34046 by coincidence (both round up to the same 0.1). Cut size with
ceil-to-0.1 gives F 2.60 and sightline with 2 dp gives A 2.33, so neither of those fits. No
constant was introduced: the cut size is the `glassWidth`/`glassHeight` the glass price already
computes, and the rounding is the engine's own decimal-safe half-up from Step AD. A full line
diff across all twelve priced trees shows this moved **exactly one line** — F's bar.
`PRICING_ENGINE_VERSION` → 11.

## What needed no change

Everything else. PF30's spiral rules keyed correctly off GlazePro's existing variables the
first time: `is_solid_spiral_jamb` (frame loop) swapped Box Frame Linings / Pulley Stiles for
Spiral Frame / Spiral Frame Linings, `is_spiral_hung` (sliding-sash loop) fired Spiral Balances
twice and kept Lead and Steel Weight away, the `is_complete_new and is_spiral_hung` default
ironmongery rule produced E's single claw kit from 0.5 per sash, and F's component staff and
parting beads followed the grown opening automatically (interior 1014 × 1751 → 2.40 / 3.80 /
3.80 / 1.20, all Integrate's figures).

`is_spiral_sash` is **false** on both trees: it keys on a `spiralSashPairPart` part type that
GlazePro never builds. No PF30 rule uses it, so nothing is wrong today — but it is dead as
written, and a future rule that used it would silently not fire. Reported, not changed.

## Not verified

- Anything live: all figures are from the committed snapshot; engine v11 is not deployed.
- **The sash_operation CODE for spiral.** The repo holds only the labels
  (`sql/step-b2c-applies-to.sql`; `docs/pricing-vocabulary-audit.md` records the spiral and fix
  codes as live-only), so the fixtures use `'spiral_hung'`. Pricing matches the substring
  "spiral", so no figure depends on the spelling — but `applyOperationDefaults` matches the
  option **label**, so the board path test supplies labelled options explicitly.
- E's spacer and gas fill (not in the Integrate read for that drawing; no E line depends on
  them), and E's staffBeadTypeId / installationMethod, which remain assumptions as on C.
