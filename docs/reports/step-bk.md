# Step BK — bi-glass on French casements

Done 16 Oct 2026. Brief: `docs/step-bk-brief.md`.
Facts: the **addendum of 16 Oct** to `docs/integrate-L31115-casement-biglass.txt`
(L31115 item 10, drawings 39 and 40). Targets: `benchmarkBGF1` / `BGF2` in
`integrate-targets.json`, the reviewer's insertions.

Commits: `2d346f6` (item 0 — the addendum, targets and brief) and the ones
after it.

**SQL: none.** Nothing needed a rule change.

Offline suite: **2,050 passing, 8 failing** — the standing eight (six Step W
sash-weight rows, benchmarks A50 and D), exactly as before. 23 new tests.
`npm run e2e`: **6 passed**, after one failure that was this step's own test
clicking where a sticky header sits — see the end, which also records what its
failure snapshot proved about the live site.

**Both benchmarks were exact the first time they were priced, before a line of
this step's code was written.** Every one of Step BJ's six fixes already
covered a French pair. What was missing was the fixtures, the board switch and
the proof — not a fix.

---

# 1. BGF1 and BGF2, group by group

| group | BGF1 1199×1313 | BGF2 899×1499 |
|---|---|---|
| extra_services | 15.70 | 13.50 |
| glass_done | 26.02 | 22.95 |
| installation_materials | 59.85 | 82.95 |
| manufacture | — | 24.66 |
| labour | 321.68 | 482.52 |
| manufacture_materials | 25.00 | 25.00 |
| **total cost** | **448.25** | **651.58** |
| **total price** | **896.48** | **1,303.16** |
| difference | 0.00 | 0.00 |

## The geometry the zeroed pair produces

Integrate's tick zeroes the mechanical clearances on **the frame, the PAIR and
both LEAVES**, and leaves `gapBetweenMeetingStiles` at 4. So:

| | BGF1 | complete-new FR1 |
|---|---|---|
| pair | 1125 × 1219 (= the opening) | 1117 × 1211 |
| each leaf | **560.5 × 1219** | 556.5 × 1211 |
| glass sightline | 435.5 × 1074 | — |
| glass cut | 463.5 × 1102 = **0.51 m²** | — |

435.5 is 560.5 − 62 − **63**: the outer stile and the **meeting** stile, which
is `(midRail 130 − gap 4) / 2`. 1074 is 1219 − 62 − 83.

BGF2 is the mixed layout — an ordinary casement fanlight over a pair:

| | size | sightline | cut | m² |
|---|---|---|---|---|
| fanlight (a plain 54 sash) | 825 × 304 | 701 × 159 | 729 × 187 | 0.14 → **0.30 min** |
| each leaf | 410.5 × 1074 | 285.5 × 929 | 313.5 × 957 | **0.30** |

All three price at £7.65 — the fanlight's 0.14 is lifted to the 0.30 m²
minimum and the leaves' 0.30012 rounds to it.

## Fitting and production

Fitting is **240 a glass unit and nothing else** on both: no fixed sash, and
neither pair is over 25 kg. So 2 × 240 = 480 on BGF1 and 3 × 240 = 720 on
BGF2.

**A French pair has NO divider**, so rule 211 cannot fire and **BGF1 has no
production at all**. BGF2's 60 minutes are its transom alone. Both asserted,
because "no production" is easy to get right by accident.

---

# 2. What changed in the switch

`applyBiGlassCasement` now handles the pair:

```js
for (const pair of findAllOf(out, [FRENCH_PAIR_PART])) {
  // every mechanical clearance to 0 going in, 4 coming back
}
```

**This is the one that matters.** `casementSashSize` reads
`frenchPairFor(...)` FIRST and the leaf's own value only as a fallback, so the
pair decides whether the leaves fill the opening. Zeroing the leaves alone —
which is all Step BJ's loop did — would have left them 4 mm inside and sized
the glass as though clearance still applied. **That is exactly why the BJ
follow-up refused to offer the switch on a pair**, and it is now settled by a
reading rather than guessed at.

`gapBetweenMeetingStiles` is **not** touched. The tick removes the clearance,
not the 4 mm between the two meeting stiles — the addendum is explicit, and a
test pins it.

## Coming back: the leaf's keys are REMOVED, not set to 4

A French leaf **never carries its own clearance** — the pair owns it, and the
pair is read first. A board-built pair stores the four keys on the
`frenchCasementPart` and nothing on the leaves
(`buildFrenchPair`, `casementOpenings.js`). So on the way back the keys the
tick added are deleted rather than set to 4, which would invent a value the
board never stores.

That is what makes the round trip exact: **the pair's values, the leaves'
values and the leaves' glass all come back identical**, bar the stored
single-pane code, which stays on purpose exactly as it does for a plain
casement (Step BJ). Asserted value for value.

---

# 3. The board

`canBeBiGlass` drops the `frenchCasementPart` exclusion, which makes it the
engine's `is_casement_window` **exactly**: any sash in `CASEMENT_SASH_TYPES`
(a plain casement sash or a French leaf) and no door leaf. `allCasementSashes`
in `computeVariables` is built on the same list, so what the board offers is
precisely what prices.

| | offered? | why |
|---|---|---|
| casement window | **yes** | unchanged from Step BJ |
| **French casement** | **yes — new** | the pair is now zeroed, so the switch applies in full |
| **FR2's layout** (fanlight over a pair) | **yes — new** | both kinds of opening switch properly; it is BGF2 |
| casement + direct glazed unit beside a sash | yes | there is still a sash to keep |
| door, French door, stable door, flag frame | no | any leaf makes `is_casement_window` false |
| direct-glazed-only frame | no | no sash to keep at all |
| box sash | no | **bi-glass is not offered on sash windows** (Nathan, 16 Oct) |

**The board's own French tree, switched, prices BGF1 to the penny — £448.25 —**
with the same stored list, and **£388.40 / £776.78 with nothing stored**, which
is the brief's own prediction. Both pinned.

**The e2e needed no change.** Its step reads the Type of Work select on drawing
69, which is a casement, and still finds Bi-Glass. There is no French casement
drawing on L507712 to point a step at; if the reviewer makes one, the same step
copied with a new id would cover it.

---

# 4. Decoration — the Step BJ warning closed, and nothing was wrong

Step BJ left this open: "Draught Seal Only Painting Profits" is gated on
`needs_draughtsealing and not nj_involved and is_decoration_included` and does
**not** carry the `not is_bi_glass` its two siblings do, so a bi-glass casement
with decoration ticked looked as though it would pick up a sash-window
painting profit.

**It cannot be read in Integrate at all**: its Decoration box does not appear
for this user in Survey Mode, which the administrator has locked on. So it is
settled from the rules, which are the same in both systems — and the answer is
that **there was never a problem**:

| rule | quantity | on a casement |
|---|---|---|
| Draught Seal Only Painting Profits | `sliding_sash_qty` | **fires, charges £0.00** |
| Draught Seal Decoration | `sliding_sash_qty` × 200 | fires, 0 minutes |
| **Casement DSO Decoration** | `casement_sash_qty` × 150 | **this is the one that charges** |

The profit line's condition **is** true, so it fires — but its quantity is the
number of sliding sashes, which is 0 on any casement, so it adds nothing. My
Step BJ note said it "would fire", which was right; what it missed is that
firing costs nothing here.

Pinned against **GlazePro live drawing 70** (L507712 item 8, a bi-glass
casement 1200 × 1300 with 3 bars), read by the reviewer on 16 Oct:

| | cost / price | fitting |
|---|---|---|
| decoration off | **£350.63 / £701.26** | 7.00 h (240 + 3 × 60) |
| decoration on | **£451.16 / £902.31** | 9.50 h (+ 150) |

The difference is exactly 150 minutes at £40.21/h = **£100.53**, and the
`extra_profits` group comes to £0.00 either way. The warning in
`docs/reports/step-bj.md` is struck through and closed with these figures.

---

# 5. Every existing benchmark unchanged; sliding sashes untouched

No engine file was touched in this step at all — the changes are a fixture, a
board module, a predicate and tests.

The only behavioural change is that `applyBiGlassCasement` now accepts a
French pair where it previously refused one, and `canBeBiGlass` returns true
for one. Neither was reachable before this step: the board did not offer the
option, and no benchmark fixture goes through that function.

**Bi-glass is still not offered on a sash window**, which is Nathan's 16 Oct
instruction and was already the case — asserted again here, and the derived
draught-seal flag is still scoped to casements, so a bi-glass box sash prices
exactly as it did.

The full suite shows **the same eight standing failures** and 2,050 passing
against 2,027.

---

# What the reviewer should make live

A **French casement** drawing switched to Bi-Glass, with nothing stored:

| | |
|---|---|
| cost / price | **£388.40 / £776.78** |
| fitting | **8.00 h** (480 min — 2 × 240) |
| production | **none** |

which is BGF1 (£448.25) less exactly its **£59.85** of stored ironmongery, and
is the brief's own figure. On screen:

- each leaf grows to **560.5 × 1219** — the pair fills the opening and the
  4 mm clearance is gone, but the **4 mm meeting-stile gap stays**;
- both leaves go Single, **Casement MPLS** unticks;
- **no** production at all, `manufacture_materials` a flat **£25.00**.

And **FR2's layout** (a fanlight over a pair) is worth one look too, because it
is the mixed case: the fanlight should become 825 × 304 and the leaves
410.5 × 1074, and all three glass units price at the 0.30 m² minimum.

---

# What a reader should be wary of

- **The leaf clearance decision is mine.** Integrate stores 0 on the leaves
  after the tick, and this step stores 0 going in — but on the way BACK it
  deletes the keys rather than writing 4, because that is what a board-built
  pair looks like and it makes the round trip exact. The alternative (writing
  4) would price identically, since the pair is read first; it would only
  differ in what the saved tree holds.
- **The pair keeps `mechanicalClearance*Default`** in Integrate (4 on the
  pair, 3 on the leaves, per the addendum) and GlazePro stores no such
  defaults. Nothing reads them, so nothing was added for them.
- **BGF2's three glass units all land on the 0.30 m² minimum**, two of them
  only just (0.30012 rounds to 0.30). A small change in the frame size would
  move them off it, so that row is not as stable as it looks — it is right,
  but it is not evidence that the glass model is right to three figures.
- **A bi-glass French casement has never been drawn in GlazePro live.** The
  board switch is proved offline against the fixtures; the figure above is a
  prediction to check, not an observation.
- **"Include Clearance" ticked is still unread** (Step BJ said the same). This
  step implements the default, OFF, for a pair as for a sash.
- **Decoration is settled from the rules, not from Integrate.** The box could
  not be shown in Survey Mode. The rules are the same import in both systems
  and the live GlazePro figures are the reviewer's own, but no Integrate
  reading backs it.
- **`liveRuleFixes.withFixedCasementSashBiGlass` is still in use** by the
  benchmark tests, including BGF1 and BGF2, because the captured snapshot has
  not been refreshed since `sql/step-bj1` ran live. It should be deleted when
  it is — it is a no-op on a refreshed capture by construction.
- `public/version.json` is left uncommitted, as CLAUDE.md says.

---

# e2e after the deploy

Deploy confirmed by decoding `/version.json`: **`mvarqpjl` = 09:32:00Z**, ten
seconds after the last commit.

`npm run e2e` — **6 passed** (35.9s), all six rows green.

## The first run failed, and it was my own test's fault

The Bi-Glass step timed out. Not a regression and not the site: the step began
by clicking the parts tree's first label to select the item, and the sticky
**"Parts"** panel header sits over that label —

> `<div>Parts</div> from <div>…</div> subtree intercepts pointer events`

— so Playwright retried the click until the 120-second budget ran out, on a
page where the field it wanted was **already on screen**. The board selects
the item on load, so the click was defensiveness that could only ever get in
the way. It is gone from the normal path, with a `force` fallback kept for the
case where the field really is absent.

It passed on the earlier Step BJ follow-up run because the panel had scrolled
differently; the drawing has since gained a long history, which pushed the
label under the header. Worth knowing as a pattern: **a click to "make sure"
is a liability in a read-only smoke test.**

## And the failure snapshot proved the step twice over

Playwright's page snapshot caught the live select verbatim:

```
- combobox:
  - option "— select —"
  - option "Complete New"
  - option "Bi-glass" [selected]
  - option "No Work"
```

Three things at once: **Bi-glass is in the select on the live site**; it reads
exactly the three options this step intends, with the sash-window services
absent; and **the reviewer has already switched drawing 69 to Bi-glass** — the
history panel shows `Item — Type of Work: Complete New → Bi-glass`, and the
item's own `isBiGlass` field reads `true`. The content the test asserts was
right all along; only the click was wrong.

**Not verified:** no bi-glass FRENCH casement exists live, so the £388.40 /
£776.78 above is still a prediction. Drawing 69's live PRICE was not read from
here either — the benchmark page is the only priced thing the e2e sees, and it
does not include drawing 69.
