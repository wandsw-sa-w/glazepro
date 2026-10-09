# Step AO findings — casement and direct glazed frames (J, K, L, M, N, P)

Against `docs/step-ao-casement-engine-brief.md` and its addendum
`docs/step-ao-addendum-frame-timber.md`; facts from
`docs/integrate-L31115-direct-glazed.txt`. All figures from the committed snapshot
(`pf30-snapshot.json`) via `scripts/dump-benchmarks.mjs`; nothing read from the live site.

## Totals

| | GlazePro | Integrate | Gap |
|---|---|---|---|
| J — two opening casements, utile | 1,218.53 / 2,437.05 | 1,233.57 / 2,467.13 | −15.04 / −30.08 |
| K — casement + direct glazed | 1,013.20 / 2,026.36 | 1,027.90 / 2,055.76 | −14.70 / −29.40 |
| L — two direct glazed + mullion | 1,049.94 / 2,099.85 | 1,064.64 / 2,129.25 | −14.70 / −29.40 |
| M — single direct glazed | 658.11 / 1,316.19 | 672.81 / 1,345.59 | −14.70 / −29.40 |
| N — casement + fixed casement | 1,070.39 / 2,140.75 | 1,085.09 / 2,170.15 | −14.70 / −29.40 |
| P — single casement 1599 × 1599 | 961.46 / 1,922.93 | 976.16 / 1,952.33 | −14.70 / −29.40 |

**Every one of the six is short by the same £14.70, and that is the only gap on five of
them.** J has one further gap of £0.34. Both are explained below, and neither is tuned away.

**Production and labour hours are exact on all six** — J 18.83 / 12.00, K 14.42 / 10.67,
L 12.17 / 14.33, M 7.83 / 7.17, N 17.17 / 10.50, P 8.83 / 11.25. Since the facts file
reconciles every minute rule by rule, that is the strongest evidence the new quantities are
right. Every group total except installation materials matches to the penny.

## The £14.70: a snapshot data gap, not a pricing difference

Integrate prices the surveyor's ironmongery list as 9 lines totalling 66.15. GlazePro produces
51.45 from 5 lines plus **four zero lines**: every part of
`kenrick_extension_gear_box:PC` carries `unit_cost: 0` in the committed snapshot, while the SET
carries `cost: 7.35`. Two sets × 7.35 = 14.70, exactly the gap on all six benchmarks.

The engine priced those four parts at 0.00 **silently** — the existing warning only covered
`unit_cost == null`. It now covers a cost of exactly 0 as well, and names the set's own cost:

> Ironmongery part cost not found: RJZ1710 (kenrick_extension_gear_box) — the line prices at 0,
> though the set itself costs 7.35

No price was invented. Two things for the reviewer:

1. **The data.** The live `parts_catalogue` presumably has costs for those four strikes; the
   snapshot's are 0. A fresh snapshot would close the gap.
2. **A second, separate difference once it does.** Integrate's 66.15 is
   `round(7.55 + 7.55 + 23.84 + 6.28 + 14.70 + 3.25) × 1.05` = `round(63.17) × 1.05` — it
   rounds the ironmongery SUM once. GlazePro rounds each line: with the gear box costed it
   would give 8.40 + 8.40 + 25.20 + 6.30 + 15.75 + 3.15 = **67.20**, which is £1.05 over.
   Single-line items (A, C, E) cannot tell the two conventions apart — this is the first
   multi-line ironmongery reading — so the per-line convention was never wrong before, and
   changing it on one reading that cannot yet be tested end to end would be a guess. Reported
   for decision.

## J's £0.34: the mullion length (as the brief predicted)

`Casement Transoms & Mullions` is `frame_muntin_to_be_replaced_length × 1.1 × 12.40`.
GlazePro uses the interior height, **1205 mm** → 1.3255 → 16.44. Integrate's printed 1.35 →
16.78 implies a length of about **1230 mm** (1.3532 / 1.1 = 1.2302), i.e. 25 mm more. No 25 mm
allowance was invented. Interestingly, the §5 frame-timber readings show the mullion priced at
**internal height + 20** (1225), which is close to but not the same as the ~1230 this line
implies — so the two Integrate rules appear to use slightly different mullion lengths. Worth
one more reading.

## What the §5 addendum closed

The reviewer's frame formula — head + both jambs + each divider at their OVERALL sections, in
dm³ **rounded to 2 dp**, then × 1.25 in rule 160 — reproduces all four readings exactly
(20.90 → 26.125, 23.47 → 29.3375, 26.76 → 33.45, 28.78 → 35.975). That 2 dp rounding turns
out to be Integrate's convention for these timber quantities generally, so it is applied to the
casement sash volume (12.25 / 16.76 / 21.90 all reproduced) and the cill as well — **which also
closed a 1p the cill was over** on J, K and N: 10.2826 → 10.28 → × 1.25 = 12.85 → × 1.085 =
13.94, Integrate's figure, where the unrounded volume gave 13.95.

Casement sashes now carry a real weight by Step W's measured method (timber volume × family
density + glass at its cut size, no new constant): **P's 1517 × 1497 sash is 50.35 kg** so
install rule 95 "Any Sash Overweight (Casement)" fires, and **K and N's 541 × 1197 sashes are
15.84 kg** so it does not — matching what Integrate charges on each.

## Reported, not changed

- **`is_casement_range` is inferred.** Rule 121 (J's mullion line) needs it; Integrate's item
  "range" field has no GlazePro counterpart (Step AG listed it as not storable), so it is
  derived from the item being a casement window. If GlazePro ever sells a casement outside the
  casement range, this would be wrong.
- **`is_spiral_sash`-style dead variables.** `is_flush_casement` and `is_stormproof_casement`
  are still hard-coded false (sub-type not captured). No PF30 rule on these benchmarks reads
  them, but a flush/stormproof distinction will need board data.
- **P's surround line count.** Integrate recalculated the surround on resize and charges ONE
  line (2.85 × 5.10 = 14.54); GlazePro's allocator gives TWO (3.40 + 1.70 m → 9.69 + 4.85 =
  **14.54**). Same money, different presentation. K–N carry 2.80 + 1.30 in both systems.
- **Unit convention.** Casement timber rules work in dm³ while the box sash volume variables
  are m³. Each of the three casement variables is read by exactly one casement-only rule, so
  the two live side by side; the comments say so at both ends.
- **Nathan's decisions honoured:** a direct-glazed-only frame prices no frame timber, cill or
  LTW consumables (L and M, matching Integrate — a known gap in both systems' rules, not a
  GlazePro difference), and "Base Direct Glazed Unit in Frame" (sort 10) is left never firing.

## Not verified

- Anything live: engine v13 is not deployed, and these windows cannot be drawn on the board at
  all until Step AP.
- **The casement operation and type codes.** The repo holds only the three sliding-sash labels
  (`sql/step-b2c-applies-to.sql`, and the vocabulary audit records the rest as live-only), so
  the fixtures use Integrate's names in GlazePro's style (`left_hand_hung`, `right_hand_hung`,
  `fix`, `open_out_flush`). Only `fix` is read by a priced rule, through the same substring test
  `operationKind` uses, so no figure depends on the spelling.
- The mullion length question above, and whether the casement sash weight model is right in
  general — it is only tested against the two outcomes (over / under 25 kg) that Integrate's
  charges reveal, not against a measured casement weight.
- Benchmark P's tree is the reviewer's described resize of drawing 19, not a separate
  GetDrawing read of it.
