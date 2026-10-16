# Step BJ — bi-glass on casement windows

Done 15–16 Oct 2026. Brief: `docs/step-bj-brief.md`.
Facts: `docs/integrate-L31115-casement-biglass.txt` (L31115 item 10, drawings
33–36, read 15 Oct by the reviewer). Targets: `benchmarkBG1` / `BG2` / `BG3` /
`BG4` in `integrate-targets.json`, the reviewer's insertions.

Commits: `f1a65cd` (item 0 — the facts, targets and brief) and the ones after it.

**SQL waiting, not run:**

- **`sql/step-bj1-fixed-casement-sash-biglass.sql`** — one rule, one
  condition: install rule 15 "Fixed Casement Sash with Frame" widened to reach
  a bi-glass casement. It is worth £40.21 on BG3 and nothing on the other
  three. Nothing else needed SQL.

Offline suite: **2,012 passing, 8 failing** — the standing eight (six Step W
sash-weight rows, benchmarks A50 and D), exactly as before this step. 49 new
tests. `npm run e2e`: **5 passed**, and BG1, BG2 and BG4 pass against the LIVE
rules — see the end, which is the best evidence in this report.

**All four benchmarks are exact — every group, to the penny.** Bi-glass had
never been priced on any product, and six separate things were wrong; each is
set out below with the reading that caught it.

---

# 1. BG1–BG4, group by group

`src/pricing/benchmarks/fixtureBiGlass.js`, on the captured snapshot with
`sql/step-bj1` applied through `liveRuleFixes` (`benchmarks.test.js` → "Step
BJ"). Integrate's figures are in the second column of each pair; they are
never not equal.

| group | BG1 1599×1599 | BG2 + 3 bars | BG3 1299×1307 | BG4 1199×1499 |
|---|---|---|---|---|
| extra_services | 25.60 | 25.60 | 17.00 | 18.00 |
| glass_done | 50.49 | 50.49 | 25.00 | 31.37 |
| installation_materials | 66.15 | 66.15 | 59.85 | 27.30 |
| manufacture | — | — | 49.32 | 24.66 |
| labour | 191.00 | 311.63 | 522.73 | 321.68 |
| manufacture_materials | 25.00 | 25.00 | 25.00 | 25.00 |
| **total cost** | **358.24** | **478.87** | **698.90** | **448.01** |
| **total price** | **716.48** | **957.74** | **1,397.78** | **896.01** |
| difference | 0.00 | 0.00 | 0.00 | 0.00 |

## Fitting, rule by rule

| | BG1 | BG2 | BG3 | BG4 |
|---|---|---|---|---|
| 0 BiGlass Labour Base Price | 240 | 240 | **3 × 240** | **2 × 240** |
| 1 BiGlass GBs to Take Off | — | **3 × 60** | — | — |
| 95 Any Sash Overweight (Casement) | 45 | 45 | — | — |
| 15 Fixed Casement Sash with Frame | — | — | **60** | — |
| **total** | **285 = 4.75 h** | **465 = 7.75 h** | **780 = 13.00 h** | **480 = 8.00 h** |

## Production

Nil on BG1 and BG2. On BG3 and BG4 it is **rule 211 "Casement Frame - Single
Finish (Mullions)" alone** — 60 minutes a divider, so 120 for BG3's two
mullions and 60 for BG4's one transom. That rule carries no replace test
(`is_same_finish_internally_and_externally and not is_sw and not is_door`), it
fires on bi-glass in Integrate, and the brief said keep it. Nothing else in
the machine shop fires at all.

---

# 2. The six things that were wrong

## 1a — the glass unit was not "to be replaced"

`to_be_replaced` on a glass unit was `is_complete_new || parent sash
toBeReplaced`. **On bi-glass both are false**, because the frame and the
sashes are kept — so "BiGlass Labour Base Price" (240 minutes a unit, and the
whole of BG1's fitting) could not fire on any drawing, ever.

Integrate stores the flag **on the GlassPart**, which is the honest answer:
the glass is the only thing being replaced. The engine now reads the glass
part's own flag first and keeps the sash's as a fallback, which is what leaves
every existing benchmark standing still — a complete-new or sash-replacement
drawing stores the flag on the sash and nothing on the glass.

## 1b — single glazing and the pane rate: already right

Nothing to fix, and worth saying so. `is_single_glazed` was already derived
per unit, `single_pane_cost` already came from the catalogue
(**GL100080 4 mm Clear Toughened at £25.50/m²**, which is Integrate's own
figure, already in the data), and `rounded_area` already used the CUT size
with the 0.30 m² minimum. All four glass groups were exact before any change:

| | sightline | cut | m² | charged |
|---|---|---|---|---|
| BG1 / BG2 | 1401 × 1360 | 1429 × 1388 | 1.98 | 50.49 |
| BG3 A1 / C1 | 269 × 1068 | 297 × 1096 | 0.33 | 8.42 each |
| BG3 B1 | 261 × 1068 | 289 × 1096 | 0.32 | 8.16 |
| BG4 fanlight | 1001 × 211 | 1029 × 239 | 0.25 → **0.30 min** | 7.65 |
| BG4 lower | 1001 × 877 | 1029 × 905 | 0.93 | 23.72 |

No Energy surcharge (rule 50 needs `is_double_glazed`), no glazing-bar glass
line (rules 21/22 need `glass_unit_thickness >= 24` and a single 4 mm pane is
4), and no Single Glazed error price (that rule excludes bi-glass itself).
All three asserted.

## 1c — `gb_qty` could not see a casement's bars

`total_glazing_bar_count` only ever counted `topSashPart` and
`bottomSashPart`. A **casement** sash's bars were invisible, so BG2's three
bars read as 0 and it lost the **180 minutes** of "BiGlass GBs to Take Off".

It now counts the bars on every glass unit in the tree. That cannot move a
sliding sash: every glass unit in a box-sash tree is inside a top or bottom
sash, so the sum is the same two numbers added together. The per-sash counts
are untouched, because other rules read them.

## 1d — a bi-glass casement is always draught sealed

`needs_draughtsealing` was `typeOfWork === 'draught_seal'` and nothing else,
so **"DSO SqM Rate" did not fire** — 25.60 / 25.60 / 17.00 / 18.00, the whole
`extra_services` group on all four.

Integrate keeps `draughtseal` as its own item flag and ticks it automatically
when Bi-Glass is ticked. GlazePro's `typeOfWork` is **single-valued** and
cannot hold both — fixture A recorded that same limitation for the same reason
— so the flag is derived rather than stored. `frame_area` was already right
(2.56 / 2.56 / 1.70 / 1.80, the overall frame at 2 dp).

The three sliding-sash draught-seal rules carry `not is_bi_glass` already, so
they stay out of it; that is asserted, along with "Sashes Only Painting
Profits" not firing. **But see the warning below about decoration.**

## 1e — a single pane was weighed as two

`casementSashWeightKg` added the inner and outer thickness whatever the
glazing, so a single 4 mm pane weighed 8 mm of glass. **BG4's lower sash came
out 26.6 kg and fired "Any Sash Overweight" for 45 minutes Integrate does not
charge.** At its real 17.3 kg it does not fire, which is what Integrate shows.

This is the reading that proves the fix rather than a guess at it:

| sash | glazing | weight | over 25 kg? | Integrate |
|---|---|---|---|---|
| BG1 1525 × 1505 | single 4 mm | 30.8 kg | yes | **charges 45 min** |
| BG4 lower 1125 × 1022 | single 4 mm | 17.3 kg | no | **charges nothing** |
| **S** lower, same sash | double 4+4 | 26.6 kg | yes | charges 45 min |

S is the control, and it is unchanged: the same sash double glazed weighs
twice the glass and stays overweight.

## 1f — nothing is made, but GlazePro charged joinery

`manufacture_materials` came to **£74.10 / £81.92 / £84.33 / £74.63** against
Integrate's flat **£25.00**. GlazePro charged the frame timber, the sash
timber, the cill and the glazing-bar material on a job where the frame, the
sashes and the cill are all kept.

Integrate reaches the right answer from the other end: its rules carry no
replace test at all (rule 165's condition is literally `true`), but its
VOLUMES count timber being made, so a kept frame contributes none. So the
three casement volume variables and the bar run are zero on bi-glass — the
same principle as **difference 1** (the sash material rules gated by
`to_be_replaced`), applied to a casement. `LTW General Consumables` still
fires, which is Integrate's £25.

One more came out of fixing 1a: with the glass now "to be replaced",
production rule **"Glazing with Bar"** (`to_be_replaced`, `unit_gb_qty` × 12)
started charging BG2 **36 minutes** against Integrate's nil. The reading
settles it — BG2's production is 0 and only its FITTING differs from BG1 — and
so does the sense of it: the bars are being **taken off**, so the new pane has
none. The item-level `gb_qty` still counts all three for the removal charge;
the per-unit count on the new glazing is 0. ("Glazing a Sash" needed no care:
Integrate wrote `not is_bi_glass` into that one itself.)

## 1g — rule 15 on a kept frame

Install rule 15 "Fixed Casement Sash with Frame" fires in Integrate on BG3,
where the frame is kept. Integrate stores the condition **unbracketed** —
`[is_casement_window] || [is_casement_window_bay] && [...] && [frame_to_be_replaced]`
— and evaluates it as `is_casement_window OR (the rest)`, so on any casement
the first term alone carries it. GlazePro's import bracketed it the way a
reader would, which is why every casement benchmark to date matched and BG3
was 60 minutes short.

Nathan: copy Integrate for bi-glass, **not** the loose precedence. So the
clause gains exactly one case — `(frame_to_be_replaced or is_bi_glass)` —
which reaches bi-glass and leaves draught-seal-only and supply-only casements
alone, neither of which has been read. `sql/step-bj1`, and
`liveRuleFixes.withFixedCasementSashBiGlass` until the snapshot is refreshed.

**BG3 is the only benchmark it moves**: £658.69 / 12.00 h without it, £698.90
/ 13.00 h with it. BG1, BG2 and BG4 have no fixed sash and are identical
either way — measured, not assumed.

---

# 3. The board

`src/drawingBoard/biGlassCasement.js`. Integrate does it with one tick, and
that tick changes six things; `applyBiGlassCasement` does the same, on the
same single path the other type-of-work rules take (thickness, sashes
replaced, cill), so **nothing is changed on load** and every value reaches the
drawing's history on save.

| | to bi-glass | back to complete new |
|---|---|---|
| casement sash `toBeReplaced` | false — kept | true |
| mechanical clearance | **0 all round** — "Include Clearance" off, so the sash fills its opening | 4 |
| glass `glazingId` | `single_glazing` | `double_glazing` |
| glass `singleGlassPartNo` | GL100080 | left stored |
| glass `toBeReplaced` | **true** | removed |
| stored surround list | cleared | not restored |
| `isCasementMpls` | false | true |
| ironmongery | untouched | untouched |
| glazing bars | **untouched** | untouched |

The sash growing is the visible part: **P's 1517 × 1497 sash becomes 1525 ×
1505**, and its glass sightline 1401 × 1360 — Integrate's own figures,
asserted.

**The glazing bars are left alone on purpose.** They are taken off and charged
as such, 60 minutes each, so the surveyor has to be able to say how many there
were; deleting them would lose the charge.

**Draught sealing is not stored**, because `typeOfWork` cannot hold both — it
is derived (1d). There is nothing for the board to write, and the test asserts
the item carries no flag and the engine works it out anyway.

**Switching back is a true round trip**: the sashes come back value for value
and so does the glass, bar the single-pane code, which stays stored on purpose
— it costs nothing (no double-glazing rule reads it) and a second switch finds
the right pane already chosen. That is the same thing Integrate does with the
double codes in the other direction.

**Proved where it counts**: the board's own tree, switched to bi-glass, prices
what the fixtures price **to the penny** — £358.24 on BG1's layout and
£698.90 on BG3's. That is the test that would catch a board that builds
something subtly different from the drawings the facts were read from.

A **"Set glass and sashes to match type of work"** button sits beside the
casement sash's To Be Replaced on a bi-glass item, exactly as Step AJ's does
for a box sash — for a drawing saved before this step, or one edited by hand.

## No default ironmongery — and the £40.95 this step nearly introduced

Nathan: "none by default — the sashes keep theirs." Two sets of rules made
that false, and **the second was this step's own doing**:

- the **hinge rules** fire on any big side-hung casement (`is_side_hung and
  gross_sash_width_in_mm > 700`, and three more), so a bi-glass casement was
  given **eight 76 mm hinges, £40.95** — to re-hinge sashes nobody is taking
  off, and **two more than the same window complete new**, because a bi-glass
  sash fills its opening and so is bigger and heavier;
- the **Brighton fastener kit** — a SASH WINDOW part — is gated on
  `needs_draughtsealing and not nj_involved`, which a bi-glass casement now
  satisfies through 1d. It came out at qty 0, so it cost nothing, but it was a
  sash-window line on a casement quote.

Said once in `resolveIronmongeryLines` rather than in thirteen rule
conditions: it is one business rule about one type of work, and spreading it
over the allocator rules would need SQL for every hinge band and still miss
the next one. Integrate's own rules are left alone. A **stored** list is still
priced as stored, which is what Nathan asked for, and a complete-new casement
still gets its defaults — both asserted.

## What a bi-glass casement prices with nothing stored

A board-built 1599 × 1599 bi-glass casement, no stored ironmongery and no
surround: **£292.09 cost / £584.18 price**, 4.75 h fitting, no production. The
same window complete new is **£970.91 / £1,941.83**, 11.25 h fitting and 8.83 h
production. Not a target — a record of where a new drawing starts.

## The quote wording

Already there and reused unchanged, which is what the brief asked. The heading
reads:

> **Supply & Install Bi-Glass secondary glazing for casement window**

because the item type comes from the drawing's `window_type` through
`WINDOW_TYPE_MAP` — the same sentence a sash window gets, with its own noun.
`description_of_work` is the same without the range. The bi-glass lead time is
the letter placeholder **`[bg_lead_time]`, 10–12 weeks** by default; it is a
token the surveyor places in a letter, not something chosen per item. All four
asserted rather than claimed.

---

# 4. Sliding sashes are untouched

Item 3, and the thing most at risk in this step, because bi-glass is a sash
service too. **Every fix is scoped to a casement:**

| fix | scope |
|---|---|
| 1a glass `to_be_replaced` | reads a flag no sliding-sash tree sets |
| 1c `gb_qty` | all glass units — identical arithmetic on a box sash |
| 1d `needs_draughtsealing` | `is_bi_glass && is_casement_window` |
| 1e the single pane's weight | `casementSashWeightKg` only |
| 1f the three volumes | already casement-only variables |
| 1f the bar run and `unit_gb_qty` | `is_bi_glass && is_casement_window` |
| no default ironmongery | `is_bi_glass && is_casement_window` |
| rule 15 | the rule is `is_casement_window or is_casement_window_bay` |

Asserted three ways: `applyBiGlassCasement` returns a box-sash tree
**unchanged and identical by reference** on every type of work; the derived
draught-seal flag is false on a bi-glass box sash; and the full suite shows
the same eight standing failures with every sliding-sash benchmark — A, A35,
A40, A50, A35/h1700, B, B uncorrected, C, D, E, F, G, H, I, L34046 — exactly
where Step BI left them.

**No existing benchmark moved.** The brief's "list any that moves and why" is
an empty list.

---

# Drawings to try live

Once `sql/step-bj1` has run. On **L507712**, the casement drawings are the
ones to use — switch a copy, never the original:

| do this | expect |
|---|---|
| copy a **single casement** drawing, set Type of Work to **Bi-Glass** | the sash grows to fill the frame (no 4 mm gap), the glass goes Single, MPLS unticks, any stored surround disappears |
| price it | **no production at all**, `manufacture_materials` £25.00 flat, a DSO SqM Rate line, and 240 minutes a glass unit |
| copy an **opener \| fixed \| opener** (Configuration 4, Step BI's template 72) and switch it | fitting **13.00 h**. 12.00 h means `sql/step-bj1` has not run |
| add **glazing bars** to a bi-glass sash | 60 minutes each appear as "BiGlass GBs to Take Off", and NO bar timber and NO extra production |
| switch it **back** to Complete New | clearance 4 returns, glass goes Double, MPLS reticks, and it prices as a complete-new casement again |

The quickest check that the whole step is live: a bi-glass casement should
show **no Softwood Casement Frame & Sashes line and no Installation
Consumables**. Either one appearing means the volumes are still being charged.

---

# What a reader should be wary of

- **`needs_draughtsealing` is DERIVED, and it is the one inference in this
  step.** Integrate has a separate `draughtseal` flag it ticks; GlazePro's
  single-valued `typeOfWork` cannot, so bi-glass on a casement implies it.
  Nathan's rule ("always part of the job") is what makes that safe, and it is
  scoped to casements. **If a bi-glass casement should ever NOT be draught
  sealed, this is where to look** — it would need a stored flag, which is a
  schema change this step did not make.
- **A bi-glass casement with DECORATION included would fire "Sashes Only
  Painting Profits"** (`needs_draughtsealing and not nj_involved and
  is_decoration_included`), because that rule does not carry `not
  is_bi_glass` the way its two siblings do. None of the four drawings has
  decoration on, so there is no reading either way, and nothing was changed on
  a guess. Worth one reading next time the reviewer is in Integrate: tick
  decoration on a bi-glass casement and see whether the painting profit
  appears.
- **The facts' own note that "Integrate only finalises bi-glass on save"** is
  taken at face value: all four drawings were read SAVED. An unsaved bi-glass
  drawing has not been read and may differ, as the unsaved-template nosing did
  in Step AV.
- **"Include Clearance" ticked has not been read** (the facts say so). This
  step implements the default — OFF — and a surveyor who wants clearance back
  has no control for it; the field is stored per sash, so it is editable, but
  nothing in the UI offers the Integrate tick.
- **A single-glazed BOX SASH cannot compute its sash weight on the casement
  profile today**: `sashWeight` wants
  `glassPart.defaultSingleGlazingRebateWidthForSash` and only the
  double-glazing key exists, so the default-ironmongery path throws. Found
  while writing the sliding-sash guard test, **not caused by this step**, and
  left alone because touching it would change sliding-sash behaviour. The
  future bi-glass-on-sashes step will meet it immediately.
- **`manufacture` on BG3 and BG4 is rule 211 alone**, and that rule's
  condition (`is_same_finish_internally_and_externally and not is_sw and not
  is_door`) says nothing about bi-glass. It fires because Integrate fires it
  and the brief said keep it; if it ever looks wrong, it is a rule condition
  and not a GlazePro inference.
- **The four benchmarks keep their source drawings' stored ironmongery**, as
  the facts do, which is why `installation_materials` matches. That is NOT
  what a new drawing gets — a new one gets nothing (above).
- **Nothing here was run against the live database.** The figures are the
  captured snapshot; the live rules are the same import but `sql/step-bj1` has
  not run, so BG3's live equivalent is £40.21 light until it does.
- `public/version.json` is left uncommitted, as CLAUDE.md says.

---

# e2e after the deploy

Deploy confirmed by decoding `/version.json`: **`mvamh9o1` = 07:04:41Z**, ten
seconds after the last commit.

`npm run e2e` — **5 passed** (30.3s): logs in; every benchmark passes except
the parked residuals; the fanlight drawing; the validation panel; every
drawing card on the L507712 matrix priced.

## The first run FAILED, and it was telling the truth

Worth setting out, because it is the best evidence in this report.

The benchmark page prices from the LIVE rules and catalogues, and it now
prices BG1–BG4. The first run came back:

> `BG3 FAILED: cost diff £-40.21, price diff £-80.42`

**That is exactly right.** `sql/step-bj1` has not been run, so install rule 15
still carries the bracketed condition and BG3's fixed sash is not charged —
the £40.21 this step identified, to the penny, on the live site.

And the three rows either side of it are the result that matters:

**BG1, BG2 and BG4 PASS against the live data.** Everything in section 2
except 1g — the glass part's replace flag, the casement `gb_qty`, the derived
draught sealing, the single pane's weight, the three zeroed volumes, the bar
run and the per-unit bar count — is right against the live rules and the live
catalogue, not only against the captured snapshot. Nothing in this step rests
on the capture except the one rule the reviewer has still to run.

## The bucket that was missing

The suite had no way to say "short by a known amount until a named file runs":
`PARKED` requires the amount for ever, `DELIBERATE` requires the row never to
pass. So `AWAITING_SQL` was added, holding BG3 at exactly −40.21 / −80.42 with
`sql/step-bj1` named. Both readings are accepted and **nothing else is** — if
the shortfall changes while the file waits, that is a change nobody decided;
if the row passes, the file has run. The four BG rows are also asserted onto
the page, so they cannot quietly vanish from it.

**After `sql/step-bj1` runs, BG3 will read PASS and the suite stays green**
with no further edit. The `AWAITING_SQL` entry can then be deleted, the way
the `liveRuleFixes` entries were when the snapshot caught up.

**Not verified against the live database:** the live `price_rules` condition
was never read from here (the anon key returns nothing under RLS) — section 0a
of `sql/step-bj1` is there for the reviewer to read it, and the file raises
rather than guessing if it is not what this step expects. No bi-glass drawing
was created live; the board behaviour in section 3 is offline tests only.
