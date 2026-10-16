# Step BJ follow-up — Bi-glass can be chosen on a casement drawing

Done 16 Oct 2026. Brief: `docs/step-bj-followup.md`.
No new facts and no new targets: every figure here is one Step BJ already
matched.

Commits: `1c187fd` (item 0 — the brief) and the ones after it.

**SQL: none.** `sql/step-bj1` ran live on 16 Oct, so BG3's `AWAITING_SQL`
entry is gone and it is held to the penny like every other row. This step
wrote no SQL.

Offline suite: **2,027 passing, 8 failing** — the standing eight (six Step W
sash-weight rows, benchmarks A50 and D), exactly as before. 15 new tests.
`npm run e2e`: **6 passed**, and the new sixth read Bi-Glass out of the real
select on live drawing 69 — see the end.

**What happened, in one line:** Step BJ built the bi-glass rule, tested it
thoroughly, and shipped it **unreachable**. The Type of Work select on a
casement drawing offered Complete New and No Work only.

---

# 1. Why the tests did not catch it

Worth being plain about, because it is the lesson rather than the bug.

Step BJ's tests called `applyBiGlassCasement` directly — 26 of them, including
one that priced the board's own tree to the penny against BG1 and BG3. Every
one of them **set the type of work on the tree itself** and then applied the
rule. Not one went through the thing a surveyor actually touches: the select.

The filter that blocked it was three lines inside `PropertyField`, a React
component in a 3,500-line file, in a repo with no DOM test setup. Nothing
could reach it, so nothing tested it, so it was the one part of the step with
no test at all — and it was the part that decided whether any of the rest
could run.

---

# 2. The filter change

`src/drawingBoard/typeOfWorkOptions.js` — new, and the three lines are gone
from the component.

```js
if (field.field_key === 'drawingItemPart.typeOfWork') {
  opts = typeOfWorkOptionsFor(tree, opts)
}
```

`PropertyField` now takes the `tree` instead of a `casementDrawing` boolean
(that prop had one use, this filter) and renders exactly what the module
returns, so the test and the select cannot disagree.

| drawing | offers |
|---|---|
| **casement window** | Complete New, **Bi-Glass**, No Work |
| **door** (front, French, stable, flag frame) | Complete New, No Work |
| **box sash** | everything, exactly as before |

New Pair of Sashes, Draught Seal and Cill Only stay hidden on a casement, as
Step AP had them: they are sash-window services, and the board rules behind
them are gated on `isSashWindow` so they never run on a casement anyway.

---

# 3. The scope, and the two the brief asked about

`canBeBiGlass(tree)` in `biGlassCasement.js`: **a plain `casementSashPart`, no
door leaf, no French pair.** The board offers Bi-Glass exactly where this is
true, and **`applyBiGlassCasement` now refuses everything else** — so a tree
the control is hidden for cannot be half-switched by the rule either, which it
could have been before.

For every tree this admits, the engine's `is_casement_window` is true. That is
the test the brief asked for: what the board offers is what prices.

## A French casement is OUT — and this is a judgement, not an oversight

Its leaves **are** in `CASEMENT_SASH_TYPES`, so `is_casement_window` is true
and the scope the brief named would have taken it. I excluded it anyway, for
three reasons:

1. **A French pair stores its mechanical clearances on the PAIR, not on the
   leaves.** `casementSashSize` reads `frenchPairFor(...)` first and the leaf
   only as a fallback. So `applyBiGlassCasement` setting the leaves to 0 would
   **not** make them fill the opening: the sashes would keep their 4 mm inset,
   the glass would be sized as though clearance still applied, and the price
   would be wrong in a way nobody would see. Half-applying is worse than not
   offering.
2. **Integrate has no reading for one.** The facts file lists "a bi-glass
   French casement pair" under *Not read*.
3. A control that produces a wrong number is worse than a missing control.

It is a small change to admit later — handle the pair's clearances in
`applyBiGlassCasement` and drop the `frenchCasementPart` clause — but it needs
a reading first. **FR2 is the case that makes this matter**: a casement
fanlight *over* a French pair would otherwise half-qualify, switching the
fanlight properly and the pair not. Asserted.

## A direct-glazed-only frame is OUT

There is no sash to keep, so "the sashes are kept and the glass is replaced"
has no meaning. `is_casement_window` is false (no casement sash), and the
240-minute BiGlass labour per glass unit has never been read against one.

**But a casement with a direct glazed unit BESIDE a sash is IN** — there is
still a sash to keep and `is_casement_window` is true, so the switch applies
and prices. Both asserted.

---

# 4. The tests

| test | what it would have caught |
|---|---|
| the options a **casement window** offers | the blocker itself |
| the options a **door** offers (front doorset and stable door) | Bi-Glass leaking onto a door — a doorset HAS casement sashes in its side lights, which is the trap |
| the options a **box sash** offers | a casement rule narrowing a sash window |
| every casement layout (1, 2, 3 openings) offers it | a scope that only worked on a single opener |
| a **French casement** and **FR2** are out | the half-switch above |
| a **direct-glazed-only** frame is out, one **beside a sash** is in | the scope being drawn on the frame rather than the sash |
| choosing Bi-Glass runs **the whole switch** | a select that stores the string and changes nothing else |
| choosing Complete New **puts it all back** | a one-way switch |
| choosing No Work **leaves it alone** | the rule firing on the wrong type of work |
| **the board is wired to both halves** (source-level) | the select filtering inline again, or the handler dropping the call |
| **e2e: the real select on drawing 69** | all of the above, on the live site |

The source-level guard follows `profileCodeCallers.test.js`, which exists for
the same stated reason: a missing call site is invisible at runtime, so what
is worth testing is that nobody forgot. It asserts the select's options come
from `typeOfWorkOptionsFor`, that the old inline filter string is **gone**, and
that the `drawingItemPart.typeOfWork` branch calls `applyBiGlassCasement`.

The e2e step goes to `/drawing-board/69`, selects the item, finds the field by
its `title` (the field key, so the wording on screen can change) and reads the
options. **It changes nothing and saves nothing.** It pins drawing 69, so if
that drawing is deleted the step fails and wants a new id — deliberate, since
the point is a real casement drawing on the live site.

---

# 5. What the reviewer should see on drawing 69

Switch it to Bi-Glass and expect, **to the penny**:

| | |
|---|---|
| cost / price | **£639.05 / £1,278.08** |
| fitting | **13.00 h** (780 min) |
| production | **2.00 h** (120 min) |

That is the brief's own prediction, and it is now pinned as a test. It is BG3
less exactly its **£59.85** of stored ironmongery — £698.90 − £59.85 =
£639.05 — because a GlazePro template stores no ironmongery and a bi-glass
casement gets no defaults.

The fitting breaks down as **3 × 240** (BiGlass labour, one per glass unit)
**+ 60** (the fixed sash, which is `sql/step-bj1`), and the production is rule
211's 60 minutes for each of the two mullions. On screen you should see:

- the three sashes grow to fill their columns — **393 / 385 / 393 × 1213**,
  no 4 mm gap;
- the glass go Single, **Casement MPLS** untick;
- **no** Softwood Casement Frame & Sashes, **no** Hardwood Casement Cill,
  **no** Installation Consumables, **no** Windowboard;
- `manufacture_materials` a flat **£25.00**.

If fitting reads 12.00 h, `sql/step-bj1` has not taken effect.

A **single casement** switched the same way prices **£292.09 / £584.18** at
1599 × 1599 with nothing stored (Step BJ's report, section 3).

---

# 6. Every benchmark unchanged

Nothing in this step touches the engine. The only behavioural change outside
the board's option list is that `applyBiGlassCasement` now refuses a French
pair and a direct-glazed-only frame, and neither was reachable before: the
control did not exist, and no benchmark fixture goes through that function.

The full suite shows **the same eight standing failures** and 2,027 passing
against 2,012 — the difference being this step's own 15 tests.

---

# What a reader should be wary of

- **The French casement exclusion is mine, not Nathan's.** The brief told me
  to use the step's own scope, which would have included it; I narrowed it
  because the pair's clearances make the switch half-apply. If Nathan wants
  bi-glass on French casements, it needs a reading and the pair's clearances
  handled — not just the clause dropped.
- **`canBeBiGlass` is now load-bearing in two places.** The board offers the
  option on it and the rule refuses without it. That is the point — they
  cannot drift — but it means widening the scope widens both at once, which is
  what you want and worth knowing.
- **The e2e step pins drawing 69 by id.** If the reviewer deletes or renumbers
  it, that step fails. It is read-only, so it can be pointed at any casement
  drawing by changing one number.
- **There is still no DOM test setup**, so "the options a drawing offers" is
  tested through the module the select calls, not by rendering the select. The
  source-level guard is what closes the remaining gap, and it is a text match
  — it would survive a rename of the module function if someone also changed
  the guard. A renderer-based test would be stronger; adding `jsdom` and
  `@testing-library/react` is a decision for Nathan, not something to slip
  into a follow-up.
- **Nothing was run against the live database.** `sql/step-bj1` running is the
  reviewer's word, taken as given; the offline benchmarks still price through
  `liveRuleFixes` because the captured snapshot has not been refreshed, and
  that entry should go when it is.
- `public/version.json` is left uncommitted, as CLAUDE.md says.

---

# e2e after the deploy

Deploy confirmed by decoding `/version.json`: **`mvaok5dc` = 08:02:55Z**,
eleven seconds after the last commit.

`npm run e2e` — **6 passed** (41.1s), one more than before:

| | |
|---|---|
| logs in | ok |
| every benchmark passes except the parked residuals | ok |
| the fanlight drawing shows Fanlight A1 and Casement Sash A2 | ok |
| **a casement drawing offers Bi-Glass in Type of Work** | **ok** |
| the validation panel loads without an error | ok |
| every drawing card on the L507712 quote matrix shows a price | ok |

**The fourth row is the step.** It read the real Type of Work select on live
drawing 69, found Bi-Glass in it, and confirmed New Pair of Sashes, Draught
Seal and Cill Only are still absent. The blocker is gone on the live site, not
just in a module.

**And the second row confirms `sql/step-bj1` twice over.** `AWAITING_SQL` is
now empty, so a short BG3 would have been reported as a plain failure — the
row passing means BG3 is **exact on the live rules**, which is the file having
run. The benchmark page prices from the live data, so all four bi-glass rows
are now exact against it.

**Not verified:** nothing was saved on the live site. The e2e step only reads
the select; drawing 69 is still Complete New, and switching it — and the
£639.05 / £1,278.08 that should follow — is the reviewer's to do.
