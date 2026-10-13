# Step BC follow-up — the refreshed snapshot, the set's size, and the door's hand

Done 13 Oct 2026. Brief: the reviewer's three items of 13 Oct, after running
`sql/step-bc1` and `sql/step-bc2` live and checking CD1–CD4 on L507712 drawings
35–38.

**No new pricing rule, no rule edited here** (bc1 did that, and it is live), no
profile value and no benchmark target changed. **No engine version bump** (16).

**I ran no SQL.** `sql/step-bc3` is a file for the reviewer.

Commits: `7c805dc` item 1, `80a8874` items 2 and 3, and this report.

---

## 1. The snapshot taken after bc1 — three closures

**Files:** `src/pricing/benchmarks/pf30-snapshot.json` (replaced),
`src/pricing/benchmarks/fixtureDoor.js`,
`src/pricing/benchmarks/benchmarks.test.js`,
`src/pricing/benchmarks/livePartCosts.test.js`, `e2e/smoke.spec.js`,
`docs/integrate-differences.md`.

The reviewer's capture is in place. **Nine tests failed first**, which is how
each of the three consequences below was found rather than assumed: the four
`CD*: production … and labour …` tests, the four `CD*: every group matches
Integrate …` tests, and `livePartCosts`'s "every fixture cost either matches the
captured catalogue or is absent from it".

### Decision c is no longer pending

Rule 140 reads `Single Door (Flag Frame)`, `new_frame_qty - 1` × **240 min**. So
the four benchmarks land on **the brief's own expected figures, exactly**:

| | Integrate | GlazePro | decided |
|---|---|---|---|
| CD1 | 3,024.06 | **3,615.09** | +591.03 |
| CD2 | 2,421.57 | **2,725.06** | +303.49 |
| CD3 | 2,421.95 | **2,725.52** | +303.57 |
| CD4 | 4,209.35 | **4,855.69** | +646.34 |

Labour is Integrate's **+ 4 h a flag frame**: 23.75 / 17.75 / 17.75 / 28.75 h
against 15.75 / 13.75 / 13.75 / 20.75. The fixtures carry **one** decided amount
again, the `pendingDecision` declarations are gone, and the smoke test pins one
figure per row.

The test that used to say "decision c is PENDING" now says it has **landed** —
and still **reads the rule** rather than assuming it (name, value, quantity and
condition), so reverting the data fails there and says so instead of moving a
benchmark quietly. It also asserts the rule fires **once** per drawing at
`flags × 240` minutes, and that no fixture declares a pending decision any more.

The `pendingDecision` mechanism in the fixtures and on the benchmark page is
**kept** — it is how the next decided-but-not-yet-run figure will be carried, and
it cost one `??` each — but nothing declares one today, so it is currently
unexercised. Worth deleting if the next step does not want it.

### The nineteen door parts are in the captured catalogue

The refresh brought in the parts `sql/step-az1` inserted live: the **five Utile
sections** (8.60 / 12.20 / 17.30 / 29.00 / 13.60) and the **fourteen mpls_doors
locks** (RJZ2382 50.83, RHZ1648 89.47, RHZ1653 34.92, RHZ1667 5.61, and the ten
others) — **at exactly the costs the fixtures carry**.

So `livePartCosts.test.js` now asserts that **no gap is filled**: every code a
fixture names is in the catalogue at the same cost. That is the Step AZ
follow-up's open point closed *in the captured file* — the fixture cost maps are
no longer propping the door benchmarks up, and if a part ever vanishes from the
catalogue the door rows will say so rather than quietly pricing from the fixture.

### The Kenrick gearbox gap is closed

J–P **−£14.70** and Q/R/S **−£8.40** have been reported every step since AT as a
*captured-data* gap: `sql/step-ap0-gearbox-part-costs.sql` was run live long ago,
but the snapshot predated it. The refreshed file has the parts costed
(`kenrick_extension_gear_box:PC` → RJZ1710 0.72, RJZ1709 0.72, RJZ1708 2.02,
RJZ1700 3.89), and **J, P, Q, R and S are now exact to the penny**.

The note in `docs/integrate-differences.md` is struck through and dated, with the
costs that closed it. **Nothing was tuned** — the captured data caught up with
the live data.

## 2. The board summary on a coupled set

**Files:** `src/pricing/casementGeometry.js`, `src/pricing/partAllocator.js`,
`src/pages/DrawingBoard.jsx`, `src/drawingBoard/coupledSetSize.test.js` (new).

The summary's "Frame:" line came from `findFirst(tree, 'assemblyFramePart')`, so
a coupled set read **693 × 1136** — a flag light — on a drawing that is a
**2287 × 2101** door set.

`coupledSetSize(tree)` is now the one definition of a set's size:

- **width** = the frames' widths less one jamb per joint, from the container's
  own `partSpacing` (-47). CD1's 693 + 995 + 693 is **2,287**, not 2,381;
- **height** = the **door** frame's — the frame with a leaf in it. A flag light
  is a high side window over a wall, so the set is as tall as the door and not
  as tall as its tallest frame happens to be. With no door at all it falls back
  to the tallest frame;
- a **one-frame** drawing is simply its frame, so a caller never has to ask
  whether the drawing is coupled first.

`frameSizeLabel(tree)` is what the summary shows:
`2287 × 2101 mm (3 frames, coupled)`, or `1099 × 2199 mm` on a single frame.

**The allocator now shares it.** `wholeSetFrame` (the architrave's pseudo-frame,
decision b) had its own copy of the width arithmetic; two definitions of a set's
width would have drifted, and the architrave depends on it. The CD benchmarks
prove the architrave is unchanged by the swap.

**Tests:** five, all failing first — CD1's 2287 × 2101, two frames losing *one*
jamb and not two, the height coming from the door frame and not the first or the
tallest, a one-frame drawing, and the label itself.

## 3. The flag-and-fan template's door is right hand

**Files:** `src/drawingBoard/doorOpenings.js`,
`src/drawingBoard/coupledSetSize.test.js`,
`sql/step-bc3-flag-fan-template-right-hand.sql` (new),
`sql/step-bc2-flag-frame-templates.sql`.

Template **69** "Single Door With Flag And Fan Lights" was built **left** hand.
Integrate's CD4 is **right** (operation 18). The board's default for a single
door is left hand, which is correct for templates 70, 71 and 72 — Integrate has
those left hand too — and wrong for this one alone.

**It is not cosmetic.** The mpls allocator rules band on
`is_left_hand_hung_viewed_internally` / `…right…`, so a template handed the wrong
way round starts every new drawing with the wrong strike and keep.

### What made it possible to get wrong, and what changed

`sql/step-bc2`'s trees were generated by a **scratch script**, so the only
statement of a template's options lived somewhere nothing could test.
**`FLAG_FRAME_TEMPLATES`** in `doorOpenings.js` now holds all four as code —
name, sort order, Integrate's number, build options — and the trees, the tests
and the SQL read one definition. The tests assert template 69 is right hand,
that the other three are left, and that every spec builds the frames it
promises.

### The SQL

`sql/step-bc3-flag-fan-template-right-hand.sql` corrects the live row. It

- **refuses to run** if the template does not exist (that would mean bc2 had not
  been run, and this is the wrong file to fix that);
- **refuses to write a tree that is not right hand**, so it cannot claim to have
  done something it has not;
- reads the hand before and after in SECTION 0 and the checks, with everything
  else about the template (three frames, one container, five sashes, three
  transoms, three cills, the 62 and 86 rails, `partSpacing`) listed both sides so
  it can be compared rather than trusted;
- **touches no drawing.** A drawing already made from the template keeps its own
  hand, which is a surveyor's choice once the drawing exists.

**`sql/step-bc2` is corrected too.** It says it is safe to re-run, and it was —
but re-running it would have **reverted bc3**. Its embedded tree for template 69
is now right hand, with a note at the top recording what was actually run and
what changed. The other three templates' trees are untouched.

## SQL files this step wrote, in run order

**It has not been run.**

1. `sql/step-bc3-flag-fan-template-right-hand.sql` — template 69's door leaf,
   left hand → right hand. Safe to re-run; `DO NOT RUN` rollback included (and
   the simpler undo named: re-run bc2, which now writes the same right-hand
   tree).

`sql/step-bc2-flag-frame-templates.sql` was **edited, not written** — it is
already live, and the edit only makes a re-run agree with bc3.

## What the tests show

**Offline: 1,663 passing, 8 failing — the standing eight, unchanged.**
`npx vitest run`, 73 files, **9 new tests** (and nine existing ones retuned to
the landed figures). The eight are the familiar six `sashWeight.test.js` Step W
rows and the two parked residuals (**A50** +£0.28, **D** +£0.54) — the **only**
parked residuals left on the page now that the Kenrick gap has closed.
`e2e/smoke.spec.js` is still reported as a failed *file* by vitest, which
collects it and cannot run it (pre-existing since Step AT).

**Live: 5 of 5 passed (26.5s)**, against the deploy of `80a8874` —
`/version.json` reads `mv756ydw`, built 2026-10-13 21:37:28 BST:

```
ok 1 logs in (5.0s)
ok 2 every benchmark passes except the parked residuals (8.2s)
ok 3 the fanlight drawing shows Fanlight A1 and Casement Sash A2 (3.2s)
ok 4 the validation panel loads without an error (3.5s)
ok 5 every drawing card on the L507712 quote matrix shows a price (5.3s)
```

Test 2 now reads the **CD rows at their single decided figures** off the live
page — which is the live confirmation that rule 140 is doing what bc1 wrote.

## Not verified against the live database

- **`sql/step-bc3` has not been run**, so the live template 69 still starts a new
  drawing **left** hand. Everything else in this step is live already.
- **The refreshed snapshot was taken by the reviewer, not read by me.** I
  compared it with the one it replaces and report what changed (one rule,
  nineteen new part costs, nothing else — no rule gone, no cost changed, every
  count identical), but the capture itself is theirs.
- **The summary change has not been seen on the live board.** It is a pure
  function with five tests behind it; nobody has looked at the screen.
- **CD1–CD4 were checked live by the reviewer** on L507712 drawings 35–38, not by
  me. My figures are the benchmark page's.

## Anything that did not behave as the brief describes

- **`sql/step-bc2` needed editing as well**, which the brief did not ask for: it
  is marked safe to re-run, and a re-run would have undone bc3. Flagged here
  because it means the file in git no longer matches byte-for-byte what was run —
  the note at its top says so.
- **The `pendingDecision` mechanism is now unexercised.** Nothing declares one,
  so it is carried but untested. It is two `??`s on the page and a field on a
  fixture; keep it for the next decided-but-unrun figure, or say and I will take
  it out.
- **Pre-existing eslint errors** unchanged in count (`DrawingBoard.jsx` 17 lines'
  worth, and the others reported in Step BC).
- `public/version.json` is left uncommitted on purpose, as CLAUDE.md says.
