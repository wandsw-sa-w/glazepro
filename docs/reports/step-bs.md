# Step BS — special glass, and price-on-application lines

Done 16 Oct 2026. Brief: `docs/step-bs-brief.md` (with the reviewer notes).
Facts: `docs/integrate-drawing-gaps.txt` section 5 (P1 L34355 item 7, P2 L32520
item 16 = LQ4), and the PF30 snapshot's two rules — "Drawing POA" and "Special
Glass".

Commits: `9d16521` (item 0 — the BS, BQ and BR briefs, the drawing-gaps facts and
the reviewer's edit to `integrate-targets.json` removing LQ4's `known_gaps`),
`7104166` (items 1–3), and this report.

**SQL: none.** Both inputs live in `values` on parts every drawing already has
(`glassPart`, `pricePart`), rendered by dedicated panels, so no field
definition and no migration.

Offline suite: **2,166 passing, 8 failing** — the standing eight (six Step W
sash-weight rows, A50 +£0.28, D +£0.54) and nothing else. 24 new tests, two
LQ4 assertions brought up to the new target. `npm run e2e` against the deploy
of `7104166`: **8 passed, 1 skipped** (Step BO's opt-in save half); "every
benchmark passes except the parked residuals" passed with LQ4 now held exact.
Lint: no new problems (the same 13 pre-existing errors in `DrawingBoard.jsx`).
`npm run build` clean.

**LQ4 is exact.** With P2's 180-minute line on its Price part: cost
**2,464.13**, price 4,928.27, production 43.20 h, **labour 25.25 h = 1,015.30**.
The 3 h its labour held "beyond its own fitting-units page" was never
unexplained — it was Integrate's `PricePart.poa`.

---

# Item 1 — special glass

**The tick.** "Special glass (priced separately)" on any glazing, stored as
`glassPart.values.specialGlassDetails = true` — Integrate's own key, so a tree
read from an Integrate dump means the same thing. The parts list shows the
unit as "Glazing — special glass" (or "Direct Glazed Unit — special glass");
the panel says, when ticked, that no glass is charged and that glazing labour,
beads and bars still price.

**What it does in the engine** (`pricingEngine.js`, pass 3): a rule in group
`glass_done` skips a special unit. That is the whole of it, and it is the
reading of P1 — "the price file then has NO glass line at all (Glass group
empty)… Everything else prices as normal":

| line | on a special unit |
|---|---|
| Square / Shaped Glass Cost, Energy Surcharge, the three glazing-bar glass lines, LandVac, Single Glazed, BiGlass Cost (all `glass_done`) | **not priced** |
| Glazing Bar (`manufacture_materials`, loops glass_unit) | priced |
| Glazing a Sash 20, Glazing with Bar 12, the Direct Glazed fitting bands | priced |
| beads, bars, everything on the sash and frame | priced |

Tested on LQ1 with one of its three units special: that unit contributes no
`glass_done` line, the other two are byte-for-byte what they were, production
and fitting minutes are unchanged, and every other group is unchanged to the
penny. With all three special the Glass group is 0 and the total drops by
exactly the old glass group.

**The glass codes are left alone.** Integrate also overwrites the unit's part
numbers with "glassPlaceholder"; GlazePro does not need to, because the gate
is the flag, and keeping the codes means unticking puts the unit back exactly
(and no "glass code not found" warning is manufactured).

**The snapshot's "Special Glass" rule — what I found.** It is
`manufacture_labour`, 10 minutes per glass unit, condition
`(not (single_pane_thickness == 7.7) and is_single_pane_special) or
is_inner_pane_special or is_outer_pane_special`, with pfVariable
`special_glass = GL100045`. It is about a special glass CODE — a unit whose
pane IS GL100045 — not about the placeholder, exactly as the reviewer notes
say, and P1's production list has no such line. It does not fire on the tick,
and it is asserted not to. Also worth knowing: **nothing in GlazePro computes
`is_single_pane_special` / `is_inner_pane_special` / `is_outer_pane_special`
at all** — the engine defaults a missing variable to 0, so the rule has never
fired on any drawing and cannot until someone decides those variables should
read "this pane's code equals `special_glass`". No fixture or live benchmark
uses GL100045, so wiring it would move no benchmark, but it would add 10
minutes to any live drawing glazed with it. Not done here: the brief asked
what I found, and that is a decision, not a gap in this step.

---

# Item 2 — POA lines on the Price part

**The panel** ("Price-on-application lines", on the Price part above its
fields): add / edit / remove lines with type, category, description and
amount, and a running total of what they add ("+180 min fitting",
"£250.00 POA cost"). Stored as `pricePart.values.poaLines`:
`[{ type, category, description, amount }]`. (The Price part's existing
`poa` boolean — the quote-level "POA item" flag the matrix reads — is a
different thing and untouched.)

**Types and categories.** The brief asked for the ones Integrate's rules read.
The snapshot reads exactly two things: `installation_labour_time` (the
"Labour" price rule) and `poa_cost` (the "Drawing POA" rule). So the panel
offers:

| type | category | the amount is | goes to |
|---|---|---|---|
| `labour` | `installation` | minutes | the fitting hours |
| `cost` | `extra_services` | pounds | "Drawing POA" (group extra_services) |

Nothing else, because no rule would read it. P1 and P2 are both
labour / installation.

**Labour lines** (`pricingEngine.js`, end of pass 2): each labour /
installation line's amount is added to the install minutes and pushed as its
own breakdown line, `POA — <description>`, `loop_target: 'drawing_poa'`,
group POA, so the hours are traceable. Integrate's own arithmetic, both
readings: P1 29.5 h + 120 min = 31.50 h; P2 22.25 h + 180 min = 25.25 h.

**Cost lines — what `drawing_poa` iterates and what `poa_cost` sums.** The
"Drawing POA" rule is `quantity: poa_cost`, `value: 1`, markup 2, item level,
`loop_target: drawing_poa`. No tree part is a POA line, so the loop is its own
branch in pass 3: **it iterates the item's cost-type POA lines, one iteration
per line, with `poa_cost` = that line's amount** (and `poa_description` for
the label). Each line therefore prices as amount × 1 (cost) and × 2 (price),
labelled with its description, and the loop's sum over the item is the item's
POA cost. Tested: two cost lines of 250 and 80 give two "Drawing POA" lines
250 / 500 and 80 / 160, group extra_services 330, and the labour line beside
them is untouched. A labour line never reaches "Drawing POA"; an empty amount
is nothing.

---

# Item 3 — benchmarks

**LQ4** (`fixtureLiveQuotes.js`): `casementItem` takes a `poaLines` option
and, only when given one, adds a `pricePart` child — so every other LQ tree is
exactly as it was. LQ4's holds P2's line. The target's `known_gaps` block is
gone (item 0) and the suite holds LQ4 exact on every group; the two assertions
that pinned 22.25 h now assert 25.25 h and the named 180-minute line.

**P1** (`poaAndSpecialGlass.test.js`, "P1 … board path"): the front door set
the board builds at 1650 × 2900 (`buildFrontDoorSetFrame`, full-width
fanlight), every glass unit ticked special and the 120-minute line on its
Price part. Asserted: the Glass group is 0 with no `glass_done` line at all,
the glazing is still made (Glazing fires per unit, "Special Glass" never), and
fitting is the units + 2 h with the line named in the breakdown. **Not a
benchmark yet**: P1's leaf muntins, mid rails and panel dropdowns are Step
BP's, and its 29.5 h of fitting units depend on them (the sidelights and
fanlights count differently once the leaf holds its muntins). FT5 becomes a
full benchmark after BP, as the brief says.

---

# Item 4 — everything else unchanged; deploy; e2e

No benchmark other than LQ4 moves: the offline eight are the standing eight
at their standing amounts, and the live benchmark page passes with LQ4 no
longer declared anywhere. The special-glass gate only runs on a unit that is
flagged, and the POA passes only read a Price part that has lines — no
existing drawing has either, so no existing price changes.

Deployed `7104166`; `npm run e2e` 8 passed, 1 skipped.

---

# What the reviewer should enter live

1. **Drawing 117 = LQ4, lead 14.** Select **Price**, "+ Labour line
   (minutes)", description `Frame buried extra rip out time`, amount **180**,
   save, re-price. Expect labour **894.67 → 1,015.30** (22.25 h → 25.25 h) and
   the breakdown's install lines to show `POA — Frame buried extra rip out
   time` at 180 minutes. Every other group should not move.
2. **A special-glass check on any casement**: select a glazing, tick
   "Special glass (priced separately)", re-price. The Glass group should lose
   that unit's lines (Square Glass Cost, Energy Surcharge, any glazing-bar
   glass line) and nothing else should change — in particular production
   minutes (Glazing 20) and the Glazing Bar line stay. The parts list reads
   "… — special glass". Untick and it is back exactly.
3. **P1 (L34355 item 7) is not yet drawable** — its leaf muntins and the
   fanlight-over-sidelight layout are Step BP's. When BP lands, the special
   glass tick on each of its glazed openings and the 120-minute line are the
   two inputs from this step; expect glass 0 and labour 31.50 h.

Nothing is waiting on Nathan.
