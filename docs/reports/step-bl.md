# Step BL — engine fixes from the live-quote comparison

Done 16 Oct 2026. Brief: `docs/step-bl-brief.md`.
Facts: `docs/integrate-live-quotes.txt` (six real Integrate quotes, redrawn on
the live board and compared group by group, read 16 Oct by the reviewer).
Targets: `benchmarkLQ1`..`LQ9` in `integrate-targets.json`, the reviewer's
insertions, several carrying a `known_gaps` object.

Commits: `cb78a1b` (item 0 — the facts, targets and brief) and the ones after it.

**SQL: none.** Every one of these was a GlazePro rule INPUT, not a rule.

Offline suite: **2,065 passing, 8 failing** — the standing eight (six Step W
sash-weight rows, benchmarks A50 and D), exactly as before this step. 20 new
tests. `npm run e2e`: **6 passed**, and every existing live benchmark row is
unmoved — see the end, which is item 9 checked against live data.

**Four of the nine benchmarks are exact on every group** — LQ1, LQ3, LQ4 and
LQ9 (the last bar 13p of parked steel). The five differences that remain are
each named, measured and NOT tuned; two of them have a later step already.

---

# 1. Glazing-bar glass on a casement or a door

**The cause was the SPACER, not the bar count.** All three bar-glass rules are
gated on `glass_unit_thickness >= 24`:

| | |
|---|---|
| Square Glass Single Glazing Bar | `unit_gb_qty == 1` |
| Square Glass Multiple Glazing Bar | `unit_gb_qty > 1` |
| Shaped Glass Multiple Glazing Bar | `unit_gb_qty >= 1 and is_sash_arched` |

A sliding sash's glass carries `spacerDimId: 'spacer_16'`, because
`buildNewBoxSash` resolves every reference field from the profile — so its
unit is 4 + 16 + 4 = **24** and the gate passes. A CASEMENT sash's, fanlight's
or door leaf's glass is built from a fixed `DEFAULT_GLASS` in
`casementOpenings.js` that has never carried a spacer at all, so its unit came
out 4 + **0** + 4 = **8** and none of the three could ever fire on any of
them.

**The fix** (`pricingEngine.js`): the spacer falls back to the DRAWING'S
PROFILE (`spacerDimId`, which the live profile holds as `"16mm"`), exactly as
the glass rebate and tolerance already do four lines above. A stored value
still wins. Profile values arrive as labels rather than codes, so
`spacerMmFromAnyForm` reads `spacer_16`, `16mm` and a bare number.

**Single glazing is deliberately untouched**: one pane, no spacer, nothing to
fall back to — and giving it 16 would make a bi-glass casement's bars charge
glass it has not got, breaking BG2.

| drawing | before | after | Integrate |
|---|---|---|---|
| LQ1 three sashes, 3 bars each | — | 3 × **16.35** | 3 × 16.35 |
| LQ2 fanlight, 1 bar | — | **9.21** | 9.21 |
| LQ3 two door leaves, 2 bars each | — | 2 × **20.44** | 2 × 20.44 |
| LQ4 one barred sash of six | — | **9.21** | 9.21 |

£49.05 on LQ1 alone. A test removes the profile spacer and shows the lines
vanish, so the mechanism is pinned and not just the figure.

**Not changed, and worth knowing:** the "LandVac" rule reads
`is_single_glazed and glass_unit_thickness == 8.3`. For a single-glazed unit
the engine still sums inner + outer, so an 8.3 mm laminated pane reports 16.6
and that rule cannot fire. No benchmark covers it; it is a pre-existing
question this step did not widen into.

---

# 2. The per-sash bar count

"Additional for Glazing Bars" (30 min, loop `casement_sash`) and "(Door)"
(loop `door_leaf`) are written on **`gb_to_be_replaced_qty`, an ITEM-level
total** — every bar in the drawing. So one barred sash charged every sash in
the item.

**The fix**: both loops now report their own opening's bars (`ownBarCount`,
the same count `computeVariables` makes, restricted to one opening and
preferring the real bar parts over the legacy `barsWide`/`barsHigh`). The
item-level variable is untouched for the item-level rules that legitimately
read the drawing's total.

| drawing | before | after | Integrate |
|---|---|---|---|
| LQ4 one barred sash of six | 6 × 30 = **180** | **30** | 30 |
| LQ2 one barred fanlight of two | 2 × 30 = **60** | **30** | 30 |
| LQ1 bars on all three | 90 | **90** | 90 |
| LQ3 both door leaves barred | 60 | **60** | 60 |

The last two matter as much as the first: the fix must not under-charge a
drawing where every sash really is barred.

---

# 3. The custom horn, once per pair

"Non-Std Horn 75mm" (30) and "Non-Std Horn Non-75mm" (90) loop
`sliding_sash` but read `has_custom_horn_horn` and `horn_length_in_mm`, which
are **item-level** — "either end has a custom horn" and "the longer of the two
lengths". A pair with a custom 75 top horn and a plain bottom was therefore
charged twice.

Integrate charges the sash that HAS the horn. Its labour editor on L34265
items 1, 3 and 4 shows the rule 2 / 1 / 1 times — two for the DOUBLE box,
which is two pairs.

**The fix**: the loop already works out each sash's own horn for the gross
height, so it now reports it as well.

| drawing | before | after | Integrate |
|---|---|---|---|
| LQ5 one pair | 2 × 30 | **30** | 30 |
| LQ9 one pair | 2 × 30 | **30** | 30 |
| LQ6 double box, two pairs | 4 × 30 | **60** | 2 × 30 |
| LQ7 VICTORIAN horn | 0 | **0** | 0 |

That alone makes the `manufacture` group **exact on all four** box sashes:
719.33 / 1,389.10 / 496.90 / 454.98.

---

# 4. The tall casement frame

`tallest_external_frame_height` **had never been computed**. It appeared in
six rule conditions and nowhere else in the repository, so it was `undefined`
and every comparison was false.

**The fix** (`computeVariables.js`): the tallest frame of the item, in metres
— TALLEST because a coupled set or a bay holds more than one and the rules are
written on the worst.

| LQ4, 1529 × 2600 | before | after | Integrate |
|---|---|---|---|
| 1500 Height Casement Frame Replacement | — | **60** | 60 |
| 2500 Height Casement Frame Replacement | — | **300** | 300 |
| 3000 Height (> 3 m) | — | — | — |
| 1500 **Wide** (the sibling that did fire) | 60 | 60 | 60 |

**Rounded to the nearest 10 mm**, as Step BI established for
`overall_frame_width` — the same kind of threshold on the same kind of figure
from the same import. **That is a consistency choice, not a reading**: no
drawing read so far lands near a boundary (117 is 2,600), so nothing in this
step depends on it. If a 1,795-wide-and-tall frame is ever read, it settles
the question.

---

# 5. The mobile tower

`is_our_mobile_tower_required` was **never set** either, so "Scaffold Tower"
(180 min) could not fire.

**The fix**: it is read from GlazePro's external access `tower_by_wsw`, which
is Integrate's id 2 "WSW Mobile Tower" — the access on L34242 items 2 and 4,
L34268 item 9 and L32520 item 9, all of which carry the 180 minutes.

**No other access option is mapped**, as the brief directs, and the snapshot
confirms there is nothing to map: no rule mentions scaffold at all, so
`scaffold_by_customer` and `scaffold_by_wsw` charge nothing here exactly as in
Integrate. A board-path test asserts all four options.

---

# 6. The casement sash overweight — REPORTED, NOT FIXED

As the brief directs: *"Don't tune it; if there is no plain cause, report and
stop on this item."* **There is no plain cause.**

GlazePro's weight for live drawing 111's sash — frame 1060 × 1230, top-hung,
sash 978 × 1128, 4/16/4 glass:

| | |
|---|---|
| timber | 0.01521 m³ × 508.3 kg/m³ (redwood) = **7.73 kg** |
| glass | cut 882 × 1011 = 0.8917 m² × 8 mm × 2.5 = **17.83 kg** |
| **total** | **25.57 kg** |

The rule is `weight_in_kg > 25`, so GlazePro charges 45 minutes. Integrate's
fitting units for that item are Base 480 + Opening 90 + Scaffold Tower 180
and nothing else, so **Integrate's figure must be ≤ 25.00** — a margin of
**0.57 kg, 2.2%**.

What was checked:

- **The snapshot holds no casement weight at all** — no weight variables, and
  the only weight READINGS in the repository are Step W's nine sliding-sash
  measurements (six of which already fail). So there is nothing to compare
  the model against, which is what the brief asked me to look for.
- **On L32520 item 16 (LQ4) both systems fire it**, so Integrate's model is
  not systematically lighter — that sash is far over on any reading.
- **The one lever that would close it** is measuring the glass at the
  SIGHTLINE (854 × 983) instead of the cut: 16.79 kg, total 24.52 kg, rule
  silent. But **there is no precedent for it** — `sashWeight.js` measures a
  sliding sash's pane at the cut size too (`sightline + 2 × cover`) — and it
  would cut benchmark S's margin to 0.16 kg, putting an exact benchmark one
  rounding away from flipping. That is a tune, not a fix.

So LQ8's `labour` is **+£30.15** and declared. Everything else on LQ8 is
exact, including the materials once the cill horns were measured (below).
**What would settle it:** one Integrate reading of a casement sash weight, or
a second casement in the 24–26 kg band.

---

# 7. The hardwood box sash — FIXED, WITH A RESIDUAL

Two separate faults, both now fixed, and a residual that is reported.

## 7a The volumes were in m³ where the rules want dm³

`frame_excl_cill_volume` and `cill_volume` were in m³ — **a thousand times too
small** for the rules that read them. "Hardwood Box Frame"
(`frame_excl_cill_volume * 1.2` at £1.75) priced a 1000 × 1400 utile box frame
at **three pence** against Integrate's £38.98.

The £1.75 rate is per dm³: Integrate feeds the identically-rated "Hardwood
Sashes" a quantity of 7.27 for one sash, which is only a volume in litres. The
casement family has always been in dm³ and is exact on four benchmarks, so dm³
is the verified convention — the box-sash aliases were simply never exercised,
because the only two rules reading them are for UTILE and ACCOYA frames and no
benchmark had either.

## 7b "Hardwood Sashes" charged a quantity of nothing

Its condition (`is_solid_utile_hardwood_sash`) was true, but it reads
`volume`, and the item-level `volume` has branches for accoya and redwood
**only** — it is **0** for utile. Integrate charges each sash its own (7.27
and 9.22 on the same drawing, two different figures, so it cannot be an
item-level anything).

**The fix**: the `sliding_sash` loop reports its own timber volume in dm³ —
the volume the weight is already built on.

| LQ7 line | before | after | Integrate |
|---|---|---|---|
| Hardwood Box Frame | **£0.03** | **£32.82** | £38.98 |
| Hardwood Sashes (top) | — | **£11.91** | £12.73 |
| Hardwood Sashes (bottom) | — | **£14.95** | £16.13 |

## The residual: £8.16, reported not tuned

GlazePro's volumes are **6–16% below Integrate's** across all three lines:

| | GlazePro | Integrate |
|---|---|---|
| box frame, 1000 × 1400 | 15.63 dm³ | 18.56 dm³ |
| box frame, 1200 × 1800 | 19.65 dm³ | 23.87 dm³ |
| top sash | 5.67 dm³ | 6.06 dm³ |
| bottom sash | 7.12 dm³ | 7.68 dm³ |

The two frame readings do **not** determine a model. The shortfall is 2.93 dm³
at one size and 4.22 dm³ at the other, and it is proportional to neither the
perimeter (2H+W: 3,800 → 4,200, a ratio of 1.11 against the shortfall's 1.44),
the area (1.54), nor the height or width alone; no single added section or
extended length fits both. The redwood path is no help, because **a redwood
box frame is priced by LENGTH** (linings, pulley stiles, beads) and reads no
volume at all — which is exactly why this variable had never been checked.

So LQ7's `manufacture_materials` is **−£8.16** and declared. Over £1, so
reported rather than parked, per the small-differences policy. **What would
settle it:** Integrate's own box-frame volume breakdown, or a third and fourth
size.

---

# The casement cill horns

Not on the brief's list, but it is the rest of LQ8. `casementCillVolumeDm3`
measured the **bare frame width** and ignored the cill horns, where
`computeVariables`' own `cill_length_in_mm` has always added them. So live
drawing 111's 60 mm horns each side were unpaid:

| | volume | line |
|---|---|---|
| before | 9.09 dm³ (1060 wide) | £12.33 |
| after | 10.12 dm³ (1180 long) | **£13.73** |
| Integrate | 10.12 dm³ | £13.73 |

That makes LQ8's `manufacture_materials` exact at £60.33. Every casement
benchmark to date has no horns, so none of them moves.

---

# LQ1–LQ9, group by group

Integrate's figure first; GlazePro's in bold only where it differs. A group is
`ok` when it equals the target plus its declared `known_gaps`.

| | glass | inst | manufacture | labour | materials |
|---|---|---|---|---|---|
| **LQ1** 2000×1300 | 153.03 ok | 81.77 ok | 710.21 ok | 522.73 ok¹ | 109.93 ok |
| **LQ2** utile fanlight | 58.12 ok | 69.95 ok | 481.61 ok | 522.73 ok¹ | 108.22 **+0.01** |
| **LQ3** French doors | 127.54 ok | 350.25 ok¹ | 1,509.69 ok | 522.73 ok | 497.01 ok |
| **LQ4** config 7 tall | 172.63 ok | 55.20 ok | 1,065.31 ok | 1,015.30 ok¹ | 155.69 ok |
| **LQ5** frame arch | 47.34 **+7.76** | 102.23 **+0.28** | 719.33 ok | 351.84 ok¹ | 79.59 ok |
| **LQ6** sash arch ×2 | 94.68 **+24.79** | 161.27 **+3.92** | 1,389.10 ok | 603.15 ok | 138.12 **+1.20** |
| **LQ7** utile box | 64.26 ok | 107.41 **+0.27** | 496.90 ok | 402.10 ok¹ | 117.57 **−8.16** |
| **LQ8** tower | 55.10 ok | 80.73 ok | 217.75 ok | 502.63 **+30.15** | 60.33 ok |
| **LQ9** barred box | 89.69 ok | 119.69 **+0.13** | 454.98 ok | 301.58 ok | 101.39 ok |

¹ equals the target plus its declared known gap — surround labour on LQ1 / LQ2
/ LQ4 / LQ7, the shutters note on LQ5, the surround timber GlazePro adds on
LQ3 where Integrate has no surround, and the 3 hours LQ4's Integrate labour
holds beyond its own fitting-units page.

## LQ5 and LQ6 — the arched glass, for Step BM

The brief: *"If either fixture's glass is wrong, report what the engine reads
and stop on that group; Step BM takes the arched board path."* Both are wrong,
and here is what the engine reads:

| | engine | Integrate |
|---|---|---|
| LQ5 top sash, FRAME-level arch (rise 363, R 270) | **0.49 m²** shaped | 0.30 m² |
| LQ6 top sashes, SASH-level arch in a square frame (rise 256, R 256) | **0.57** and **0.50 m²** | 0.30 m² each |

Both are billed at the shaped rate of £58.50 on the largest rectangle of the
cut glass plus 25% (Step BE decision e), and both come out well over
Integrate's 0.30 — which is the **0.30 m² minimum**, so Integrate is billing
these as minimum-charge units and GlazePro is billing real area. LQ6's
`installation_materials` (+£3.92, the steel weights) and `manufacture_materials`
(+£1.20, the laminated softwood) follow the same arched geometry, so all three
belong together.

Benchmark C prices a frame-level arched unit correctly, so LQ5 says the
difference is not the arch model in general. **Stopped on, as directed.**

## Parked residuals, each under £1 with a named cause

| | amount | cause |
|---|---|---|
| LQ5 / LQ7 / LQ9 inst | +0.28 / +0.27 / +0.13 | the **steel weight**: the sash weight model is 0.1 kg heavier than Integrate's on these drawings (Step W's six failing measurement rows) |
| LQ2 materials | +0.01 | "Casement Transoms & Mullions": the mullion length is internal height + 25, a Step AR assumption with no reading. 1.0461 m against Integrate's 1.0452 |

---

# Two fixture findings worth keeping

Both cost real money to find and will bite the next person:

- **A stored surround list DOUBLES the architrave.** My first LQ fixtures
  carried Integrate's `surround` array, and every casement came out £3–6 over
  on `installation_materials`. The allocator already computes the architrave
  from the frame (height + 100 twice, width + 100 once), and Integrate's
  `surround` array **is that same output recorded** — not an extra input. Step
  AV's fixtures store one only because those templates carry a NOSING, which
  no GlazePro rule allocates.
- **A door needs the utile section rates in its part cost map**, or £383 of
  sections price at nothing. LQ3 looked like four missing ironmongery lines
  and a broken section allocator; it was one absent cost map.

---

# What the reviewer should re-price live

Re-price **leads 11–15** (drawings 72–123). Only these lines should move:

| expect to move | by | on |
|---|---|---|
| Square Glass Single / Multiple Glazing Bar | now charged | every casement, fanlight and door leaf with board-drawn bars — drawings 82, 88, 100, 103, 105, 117, 120 |
| Additional for Glazing Bars / (Door) | **down** to the barred sash only | 100 (−30), 117 (−150) |
| Non-Std Horn 75mm | **down** to once a pair | 118, 121, 122 |
| 1500 / 2500 Height Casement Frame Replacement | now charged, +360 | 117 |
| Scaffold Tower | now charged, +180 | 111, and L34242 items 2 / 4, L34268 item 9 |
| Hardwood Box Frame, Hardwood Sashes | now charged | 94 and the other utile box sashes |
| Hardwood Casement Cill | **up**, where the drawing has cill horns | any casement with horns (the reviewer's 111 was drawn without them) |

**Nothing else should change.** The engine's other inputs were not touched,
and the full suite shows the same eight standing failures before and after.

Two things that will NOT move, and should not: drawing 111 keeps its 45
minutes of overweight (item 6), and 94's hardwood lines land £8.16 short of
Integrate (item 7's residual).

---

# What a reader should be wary of

- **The tall-frame rounding is a consistency choice, not a reading** (item 4).
  Nothing in this step depends on it; the first frame read near 1,795 or 2,495
  settles it.
- **Item 6 and item 7's residual are unresolved, not parked.** Both are over
  £1 and both are declared in the benchmark tests, so they cannot drift
  silently — but neither has a cause good enough to act on.
- **The LQ fixtures are NOT exported from `benchmarks/index.js`**, so they do
  not appear on the live benchmark page and the e2e suite is unchanged. Four of
  them carry differences this step reports rather than fixes, and putting them
  on that page would turn the smoke suite red for findings that already have
  owners. They are pinned in `benchmarks.test.js` instead. If the reviewer
  wants them on the page, the four need entries in the e2e tables first.
- **"Accoya Pricing" is unverified either way.** It reads both volume
  variables and no benchmark covers it, so the dm³ change moves it from about
  14p to about £136 on a 1000 × 1400 frame. The pennies were plainly wrong and
  £136 is plausible for a premium timber, but **it is not a reading** — worth
  one when an Accoya box sash next comes through.
- **The six Step W sash-weight rows still fail**, and item 6 sits next to
  them: the sash weight model is the one part of the engine with known
  measurement disagreements, and two of this step's residuals (the steel
  weights, item 6) come from it.
- `public/version.json` is left uncommitted, as CLAUDE.md says.

---

# e2e after the deploy

Deploy confirmed by decoding `/version.json`: **`mvb3968g` = 14:54:17Z**, ten
seconds after the last commit.

`npm run e2e` — **6 passed** (59.6s): logs in; every benchmark passes except
the parked residuals; the fanlight drawing; a casement offers Bi-Glass; the
validation panel; every drawing card on the L507712 matrix priced.

**The benchmark row is the one that matters, and it matters as a negative.**
That page prices from the LIVE rules and catalogues, and this step changed
seven engine inputs that between them touch every product — the glass unit
thickness, two per-opening loop counts, the horn, two variables that had never
existed, the box-sash volume units and the casement cill length. **Every
existing live benchmark row is exactly where Step BK left it**, which is item
9 checked against live data rather than only against the capture.

**Not verified:** the six live quotes themselves. Leads 11–15 (drawings
72–123) were not re-priced from here — that is the reviewer's to do, and
"What the reviewer should re-price live" above lists every line that should
move and the two that should not. The LQ benchmarks are deliberately absent
from the live page (see the wary-of list), so the e2e cannot see them; they
are pinned offline in `benchmarks.test.js`.
