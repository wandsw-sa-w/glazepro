# Step BF follow-up — FD4 declared, the stable door's ironmongery, the board

Done 14 Oct 2026. Brief: `docs/step-bf-followup.md`.
Facts: the 14 Oct FD4 re-reading, appended by the reviewer to
`docs/integrate-L31115-stable-doors.txt` and quoted into
`docs/integrate-L31115-front-doors.txt`.

Commits: `0c4bff7` (item 0 — the reviewer's `bf1` / `bf4` edits and the new
`strict $.**` rule), `be2411d` (items 1–3, the re-issued `sql/step-bf3` and
this report), `ecb9ab5` (the deploy and the e2e run) and `ac93e29` (the
reviewer's edit to bf3, unchanged, with this note).

**SQL: none waiting.** **`sql/step-bf3`, RE-ISSUED — RAN LIVE 14 Oct 2026**
(reviewer, SHA `c9b7483d…`), with one edit of their own: the duplicate hinge
rule `bf030001` is **deactivated, not DELETEd** — a delete needs Nathan’s yes
each time, and with the row kept the effect on every price is the same.
Committed unchanged as `ac93e29`.

It did what it was written to do: **drawings 50 / 51 / 52 on L507712 now read
2,675.07 / 2,577.73 / 2,701.77**, each £34.65 less than before and each equal
to the figure `src/pricing/stableDoorTemplates.test.js` had already pinned
offline. The offline test and the site agree, which is the whole point of
running it on the live rule set.

Offline suite: **1,801 passing, 8 failing** — the standing eight (six Step W
sash-weight rows, benchmarks A50 and D). `npm run e2e`: recorded at the end.

---

# 1. FD4 — closed

The re-reading says both of FD4's panels are **110 = FLAT**, so the
penny-exact agreement that Step BF could not explain was two errors cancelling,
exactly as FT3's was:

| | Integrate | GlazePro, before | GlazePro, now |
|---|---|---|---|
| 2 flat panels | 2 × 60 | 2 × 120 (R&F) | 2 × 60 |
| each leaf's mid rail as "Door Muntin" | 2 × 60 | — | — |
| | **240** | **240** | **120** |

So FD4 is **120 production minutes less than Integrate = −£49.32 cost,
−£98.64 price**, and every minute of it is Nathan's decision d: a mid rail is
not a muntin. It is now a `deliberateDifference` on `BENCHMARK_FD4` with that
arithmetic in its reason, the page reads **BY DESIGN**, and
`benchmarks.test.js` takes the figure from the declaration rather than
repeating it, so the two cannot drift apart.

`docs/integrate-differences.md`: difference 19 is a declared decision, and the
**Open questions** table is back to **"None open."** The section itself stays,
because the next open figure belongs there.

---

# 2. The stable door's ironmongery — £34.65

Both causes were things the **live data already does**, which is why the
offline test agreed with itself and disagreed with the site.

| | | |
|---|---|---|
| **−£29.40** | the hinges | Live rule `c11aeeb4` **"4 Hinges per Door"** is a `door_leaf` rule at qty 2 — one pair per leaf. A stable door has **two** leaves, so the live set already gives it **two pairs**: the resolver merges the two lines into one of qty 4, 7.04 × 4 = 28.16 → 28 → **£29.40**. That *is* Nathan's "each half on its own pair" (decision j), so bf3's own hinge rule was a second helping. |
| **−£3.15** | XR16 **white** vent | Rule `e4c01f82`: `not is_front_door`, so it fires on a stable door. |
| **−£2.10** | "trickle" **white** vent | Rule `943e246d`, the same. |

29.40 + 3.15 + 2.10 = **£34.65**, on each of the three doors.

**The answer to the brief's question** ("why do the live and offline allocators
disagree on qty 4, pairs vs hinges") is that they never disagreed: 14.70 is a
**pair** and the per-leaf rule gives one per leaf, so live was already right at
two pairs and bf3 doubled it. Nothing in the allocator or the resolver needed
changing — the fix is entirely in the rule rows.

## `sql/step-bf3`, re-issued

- **Stands down** its own hinge rule `bf030001-…` (the row its first issue
  inserted) — as written a DELETE, as run an `is_active = FALSE`, which is
  the reviewer’s edit and the better of the two: an inactive rule is still
  readable, and the allocator ignores it either way. Either form is guarded
  by a check that refuses to run at all if the per-leaf `102mm_hinges` rule
  has gone — otherwise standing this one down would leave a stable door with
  no hinges. **One thing to know:** the DO-NOT-RUN rollback was written
  against the DELETE, so it re-inserts Nathan’s four rules but does not
  re-activate `bf030001`; undoing this step by hand means flipping that row
  back to TRUE as well.
- **Appends** ` and new_stable_door_pair_qty < 1` to the two Trickle Vent
  rules, by id and only where it is not already there. Appending rather than
  rewriting: both rules stay **active** and keep everything else they band on,
  so a casement window and a garden door still get their vents.
- **Keeps** Nathan's four lines (sashlock, deadlock, XR16 **Blk**, Victorian
  handle) at their fixed ids, and the three imported rules inactive.
- SECTION 0 reads the rules that fire on a stable door, the per-leaf hinge rule
  and the two vent rules **before** anything changes; the checks expect
  **£102.90**; the DO-NOT-RUN rollback puts the duplicates back.

What a new stable door gets after it:

    102mm_hinges         PB  ×4 (two pairs, rule c11aeeb4)   29.40
    era_5_lever_sashlock PB  ×1                              29.40
    era_deadlock         PB  ×1                              15.75
    trickle_vent_xr16    Blk ×1                               3.15
    victorian            PB  ×1                              25.20
                                                       = £102.90

## The test that could not fail before

`src/pricing/stableDoorTemplates.test.js` **replaced** `ironmongeryRules` with
bf3's four rules. That is why it passed while live was £34.65 wrong: the live
set is *where the hinges and the vents come from*, so a test that cannot see
them cannot catch a double.

It now runs on the **live rule set** with bf3 applied on top, through a named
`liveRuleFixes` entry — the same device Step BD used for the AV4 costs and
Step BE for the shaped-glass rate, and it becomes a no-op when the snapshot is
refreshed:

```js
withStableDoorIronmongery(snapshot)   // src/pricing/benchmarks/liveRuleFixes.js
```

It deactivates the three imported ids, appends the vent gate, and **adds**
(never replaces) the four Nathan rules. Eight tests, all passing:

- the three templates cost **2,675.07 / 2,577.73 / 2,701.77**;
- the hinges are **one merged line of qty 4** = £29.40, and the list is
  Nathan's five products;
- **one** trickle vent, and it is the black XR16;
- bf3 **as first issued** — the hinge rule present, the vents ungated — is
  **£34.65 dearer** and prices drawing 50 at **£2,709.72**, which is
  the reviewer's own live reading. This is the test that now stands between a
  wrong rule set and a green suite.
- both live vent rules are still **active** and still carry
  `not is_front_door` beside the new gate.

A failing test came first in each case: the hinge assertion was written to the
reviewer's live figure and failed at 58.80 before the rule rows changed.

---

# 3. The board draws the two halves

The geometry is a pure function, as `gridRectsFor` was, so it is testable
without rendering:

```js
stableHalfRects(tree, container, x, y)   // src/pricing/doorGeometry.js
visionPanelRect(panelNode, cellRect)
```

`stableHalfRects` takes the **opening's** rect, insets by the container's own
mechanical clearances (4 / 4 / 4 / 3 on Integrate's), and walks the halves top
then bottom, each at its **own stored height** — so the join lands on
Integrate's stored split, 1055 of a 2103 container, not half each. Every half
comes back with its rect, its interior (inside its own stiles and rails), its
`cells` from the same `gridRectsFor`, and its node, so a click can select the
half or any cell in it. `visionPanelRect` centres the small light in its panel
at **its own** 200 × 350, not the cell's.

`renderElevation.jsx` maps over that: a timber rect per half, each cell filled
as glass or panel with its own selection stroke, the vision panel inside it,
and labels **"Top A1" / "Bottom A1"**. The whole container is still selectable,
and selecting any half or cell highlights it.

Four new tests in `src/drawingBoard/stableDoor.test.js` (11 passing): the two
rects and their cells, glass on the glazed top and a panel on the other, the
vision panel centred at its own size, and nothing at all for a part that is not
a stable door.

`npm run build` succeeds. `renderElevation.jsx` carries the same four eslint
errors it carried before (`ss`, `botRail`, `glW`, `i` — all pre-existing and
all outside the new branch); no touched file gained one.

---

# What a reader should be wary of

- **The stable door's hinges are not in bf3 at all.** They come from a rule
  written for ordinary doors, which happens to give the right answer because a
  stable door is two leaves. If anyone ever makes that rule fire once per
  *door* instead of once per leaf, a stable door silently loses a pair — which
  is why the file guards on it and the test pins qty 4.
- **The vent gate is an append.** It assumes the two rules' existing conditions
  are worth keeping, which is the conservative reading; if the reviewer would
  rather the rules were rewritten, that is a one-line change to the same file.
- **Nothing on `/dev/pricing-benchmark` should move for item 2.** ST1 and ST3
  carry Integrate's own stored list and ST2 none, which is what a benchmark
  does — the live default set is a different question from what Integrate did.
- **The three FD4 figures are Integrate's own minutes**, read off its drawing;
  the −£49.32 is arithmetic on them, not a tuned number.
- **The 3 mm clearance between the halves is still only recorded.** The
  drawing stacks the halves 1055 + 1048 = 2103 with no gap, so the board draws
  them touching; the facts' own "1055 + 3 + 1048" still does not add up, and
  this step did not resolve it either.
- `public/version.json` is left uncommitted, as CLAUDE.md says.

---

# e2e after the deploy

Deploy confirmed by decoding `/version.json`: **12:08:37Z**, after the push
(the local build stamp was 12:06:28Z).

`npm run e2e` — **5 passed** (50.7s):

| | |
|---|---|
| logs in | ok |
| every benchmark passes except the parked residuals | ok |
| the fanlight drawing shows Fanlight A1 and Casement Sash A2 | ok |
| the validation panel loads without an error | ok |
| every drawing card on the L507712 quote matrix shows a price | ok |

The second one is the one that matters here: it carries the DELIBERATE pins,
and **FD4's −49.32 is now one of them** — so the live benchmark page reads
BY DESIGN on that row, and the figure cannot drift without the smoke suite
saying so.

**What the smoke suite does not yet see**: the three stable-door prices. The
re-issued file has since run, and drawings 50–52 read 2,675.07 / 2,577.73 /
2,701.77 — but that was read by hand, and only the offline test holds the
figures. The next step should pin those three live, the way the benchmark
rows are pinned, so a rule change cannot move them quietly.
