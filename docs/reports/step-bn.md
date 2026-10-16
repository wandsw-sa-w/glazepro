# Step BN — surround tick boxes, and the existing SDG / shutters

Done 16 Oct 2026. Brief: `docs/step-bn-brief.md`.
Facts: `docs/integrate-live-quotes.txt` (LQ1–LQ9, surround and SDG per item),
plus the brief's own reading of Integrate's presets, dropdowns and rules.
Targets: the reviewer removed the surround and shutters `known_gaps` from LQ1,
LQ2, LQ3, LQ5 and LQ7, and the window-board part of LQ4's.

Commits: `66cd50b` (item 0), `81b30a3` (items 1 and 2), `e47e7af` and `19b8906`
(item 3).

**SQL: none.** All of it is engine and board code.

Offline suite: **2,112 passing, 8 failing** — the standing eight (six Step W
sash-weight rows, A50 +£0.28, D +£0.54) and nothing else. 16 new tests plus
three strengthened LQ assertions. `npm run e2e`: **7 passed**, first time.
Lint: no new problems. `npm run build` clean.

**Every benchmark the reviewer removed a gap from is closed.** LQ1, LQ2, LQ3,
LQ4, LQ5 and LQ7 all hit Integrate's **fitting hours exactly**, where five of
them were short by labour nobody could enter. **Benchmarks TC1–TC3 do not
move.**

---

# Where the answers live

Both on the **Finish & Ironmongery** part, which is where Integrate keeps them
(`autoCalcSurroundComponents`, `existingSurroundTypeId`,
`existingSurroundActionId`), in `node.values`:

| field | type | default |
|---|---|---|
| `surroundArchitrave` | bool | **true** |
| `surroundLinings` | bool | false |
| `surroundWindowBoard` | bool | false |
| `surroundExternalLining` | bool | false |
| `existingSurroundTypeId` | 0–8 | 0 (N/A) |
| `existingSurroundActionId` | 0–3 | 0 (Leave in Situ) |

**Flags, not components.** The alternative was to store Integrate's component
list, but Nathan asked for independent tick boxes and Integrate's four presets
are fixed combinations — "window board without architrave" has no preset at
all. Flags ask the four questions separately and still reach the same rules.

**No SQL, and no new field definitions.** The ticks and dropdowns are rendered
by `SurroundAndSdgPanel` in `DrawingBoard.jsx` as its own block, the way the
Divider Spacing and leaf-cell blocks already are, rather than through the
database-driven `field_definitions` list. So nothing waits on the reviewer to
run anything before a surveyor can use it.

## Why no existing drawing or benchmark moved

**An absent value falls back to the tick's DEFAULT, not to false.** A drawing
saved before today has none of these keys, so it reads as "architrave on, the
rest off" — exactly what GlazePro priced before this step. That one decision is
what makes the step safe on every saved drawing, and it is asserted directly:

```js
expect(surroundTick({}, 'surroundArchitrave')).toBe(true)
expect(surroundTick(undefined, 'surroundArchitrave')).toBe(true)
expect(surroundTick({}, 'surroundLinings')).toBe(false)
```

LQ5, LQ6, LQ8 and LQ9 are left saying **nothing at all** in their fixtures
rather than ticking the architrave explicitly, which is deliberate: those four
also prove the legacy path.

---

# 1. The surround ticks

Only three rules read the surround besides the architrave's own component cost,
and all three are `install_labour`:

| tick | what it sets | rule | min |
|---|---|---|---|
| **Architrave** | `has_architrave` | the two "Surround timber" allocation rules | — |
| **Linings** | `has_lining` | Linings | 180 |
| **Window board** | `has_deep_window_board` | Windowboard | 30 |
| **External lining** | an **AA03** component | External Lining | 180 |

## None of the three costs materials

AA01, AA02 and AA03 are Integrate's own placeholder components
(`docs/integrate-part-allocator.txt` 141–143) and carry real prices in the
price file — 50, 30 and 75. They are allocated at **measure 1 mm**, and a
`surrounds` component rounds that to **zero metres**:

```
floor((ceil(1/10) × 10 + 50) / 100) / 10  =  floor(0.6) / 10  =  0
```

That is the brief's "placeholder length 1, width 0: only their labour moves",
and it falls out of the rounding rule Step AR already established rather than
needing a special case. The tests assert the AA03 lines price at exactly 0.

AA01 and AA02 are not strictly needed — `has_lining` and
`has_deep_window_board` are item-level variables set straight from the ticks —
but Integrate has those components, they cost nothing, and allocating them
means the board and the benchmark page show the component list Integrate shows.
**AA03 is needed**, because rule 252 loops on `component`.

## The architrave gate, and where it is

The architrave comes from two live rules, "Surround timber – height" and
"– width", whose condition is only `to_be_replaced and not
is_installation_level_test_1`. So GlazePro allocated one on **every** item with
a new frame, including items with no surround at all. That is LQ3's +£17.96.

The gate is in `allocateParts`, **on the group**, not in a rule condition:

```js
const wantsArchitrave = baseVars.has_architrave !== false
...
if (!wantsArchitrave && rule.group_name === 'surrounds' && rule.loop_target === 'frame') continue
```

Those rules are **live data this code does not edit**, and the Step BC special
case immediately above already re-points the very same group at a pseudo-frame
for a coupled set — so this is the same ground, in the same place, for the same
reason. A test asserts that unticking it removes the TP68 architrave **and
nothing else**: every other allocated part comes back identical.

## How the ticks meet Step AV's stored surround list

The brief asked for this explicitly. Step AV reads `has_deep_window_board` off
the drawing's **stored** surround list, where TP61 "Nosing in Solid Redwood" is
the deep window board. The two meet as an **OR**, not a replacement:

```js
const has_deep_window_board = storedDeepWindowBoard ||
  surroundTick(paintValues, 'surroundWindowBoard')
```

So a drawing carrying a nosing still has a deep window board whether or not
anyone ticks the box, and **TC1–TC3 are untouched** — which the suite confirms.

**But the AA02 placeholder is gated on the TICK, not on
`has_deep_window_board`.** That distinction matters: a nosing is a real
component the drawing already has, and allocating a placeholder beside it would
put a *second* window board on those three benchmarks. The tick is the thing
that asks for Integrate's placeholder; the nosing is a window board in its own
right.

---

# 2. The existing SDG / obstruction

Copied from Integrate, as Nathan asked — its ids, its lists and its wording.
Two dropdowns, defaulting to **N/A** and **Leave in Situ**, and the twelve
variables from Integrate's dictionary.

## What fires, and what does not

| type | Remove and Re-fit | Remove and Dispose |
|---|---|---|
| 1 Fixed SDG | 75 | 35 |
| 2 Hinged SDG | **0** | **0** |
| 3 Vertical Sliding SDG | 75 | 35 |
| 4 Horizontal Sliding SDG | 75 | 35 |
| 5 Plantation Shutters | 75 | **0** |
| 6 Shutter Boxes | 900 | **0** |
| 7 Panelling | 900 | **0** |
| 8 Security Grills | **0** | **0** |

"Leave in Situ" and "Customer to Remove" fire nothing for any type.

**A test covers every type × all four actions, including the zeroes**, which are
the point of it: hinged SDG and security grills have no rule at all, and nor
does any "Remove and Dispose" but the three SDGs. **That is Integrate's own
gap, not a GlazePro one** — there is no rule to copy. If Nathan wants a hinged
SDG to charge something, that is a new rule and a decision, not a parity fix.

Note that **shutter boxes and panelling share one rule** (`has_panelling or
has_shutter_boxes`), which is why both read 900.

## Why the action has to be stored separately

L34265 item 3 is type 5 **action 1** and fires 75. L32520 item 9 is type 5
**action 0** and fires nothing. So the action cannot be inferred from the type,
and a test pins LQ5's pair for that reason.

---

# Two bugs found on the way

Both made rule 252 "External Lining" **unfireable however a drawing was
answered**. Neither was visible from any benchmark, because no LQ item has an
external lining — they were found by writing the test for the tick and watching
it stay at zero.

## 1. `external_lining` was read as an undefined variable

Rule 252's condition is `[part_no] == [external_lining]`. GlazePro's evaluator
reads an unquoted word as a **variable**, and nothing defined that one:

```
{"part_no":"external_lining"} -> ERROR undefined variable: external_lining
{"part_no":"AA01", external_lining: 0} -> false
```

In the real path the engine pre-fills unknowns with 0, so it compared a part
code against `0` and was quietly false forever.

It **is** a variable in Integrate.
`docs/integrate-rules-export.txt` line 126 reads:

```
# variables: external_lining=AA03
```

So the rule means "this component's part number is AA03". Defining
`external_lining = 'AA03'` reproduces Integrate's own semantics with the live
rule untouched, and it keeps working if that rule is ever rewritten with a
quoted literal.

## 2. The install-labour pass had no component loop

`getLoopParts(tree, 'component')` returns `[]` — a component is not a tree
part — so pass 2 never ran the rule at all. Pass 3 (price) already had a
component loop; pass 2 now has one too, giving such a rule `part_no`,
`part_name`, `qty` and `length`.

**Rule 252 is the only live install rule that loops on `component`**, so
nothing else changes behaviour, and the suite confirms it: no benchmark moved
from this.

---

# LQ1–LQ9, group by group

Every figure below is GlazePro against Integrate, after this step. "ok" means
equal to the penny.

| | glass | inst. materials | manufacture | labour | mfg materials | fitting h |
|---|---|---|---|---|---|---|
| **LQ1** | ok | ok | ok | **ok** | ok | **13.00 = 13.00** |
| **LQ2** | ok | ok | ok | **ok** | +0.01 | **13.00 = 13.00** |
| **LQ3** | ok | **ok** | ok | ok | ok | 13.00 = 13.00 |
| **LQ4** | ok | ok | ok | −120.63 | ok | 22.25 vs 25.25 |
| **LQ5** | +7.76 | +0.28 | ok | **ok** | ok | **8.75 = 8.75** |
| **LQ6** | +16.74 | +0.28 | ok | ok | ok | 15.00 = 15.00 |
| **LQ7** | ok | +0.27 | ok | **ok** | −8.16 | **10.00 = 10.00** |
| **LQ8** | ok | ok | ok | +30.15 | ok | 13.25 vs 12.50 |
| **LQ9** | ok | +0.13 | ok | ok | ok | 7.50 = 7.50 |

**Bold is what this step changed.** Everything else was already so after Step
BL, or is a Step BL difference this step does not touch:

| still different | why |
|---|---|
| LQ4 labour −120.63 | Integrate's PricePart **POA** line "Frame buried extra rip out time" 180 min — no GlazePro input until **Step BS**. The reviewer renamed this gap in item 0; it is 3 h exactly, and the test asserts that. |
| LQ5 / LQ6 glass | the shaped-glass **decision e** — largest rectangle +25% at the square rate |
| LQ7 mfg materials −8.16 | the hardwood box-sash lines, reported not tuned in Step BL |
| LQ8 labour +30.15 | the mobile tower, Step BL item 5 |
| LQ2 mfg materials +0.01 | the Step AR mullion-length assumption (internal height + 25) |
| LQ5 / LQ7 / LQ9 inst. | parked steel weight, 28p / 27p / 13p — Step W's six rows |

## What the assertions now cover that they could not before

LQ1's, LQ2's and LQ7's **fitting** used to be short by the surround labour, so
only their production was asserted and the fitting was left alone. All three
are now exact, so `install_labour` is asserted on LQ1, LQ2, LQ3, LQ7 and LQ9,
and LQ4's 22.25 h is asserted against Integrate's 25.25 **with the 3 h shown to
be the 180-minute POA line**.

LQ5 has a test of its own: "Remove and Refit Shutters" fires **once** at 75
minutes and its fitting is Integrate's 8.75 h. That rule was simply unreachable
before this step.

**I briefly put LQ2 and LQ7 into the strict every-group loop and that was
wrong** — neither is exact overall. They now have a labour-exact test instead,
which asserts their own Step BL residual by name rather than hiding it.

---

# What the reviewer should tick live, to close leads 11–15

The engine is right; these drawings were drawn before there was anywhere to
record the answer, so they will stay short until someone ticks the boxes.

1. **The surround, on each item.** `docs/integrate-live-quotes.txt` has the
   preset per item. Translating Integrate's presets to the ticks:

   | Integrate preset | tick |
   |---|---|
   | `architrave_and_bullnose` | Architrave |
   | `architrave_and_w_board` | Architrave + Window board |
   | `architrave_lining_and_w_board` | Architrave + Linings + Window board |
   | `architrave_bullnose_and_packer` | Architrave |
   | `0` | **nothing** — untick Architrave too |

   Worth £20.10 a window board, £140.73 where linings come with it, and −£17.96
   where there is no surround at all.
2. **The two SDG dropdowns**, wherever a scope-of-works note mentions secondary
   glazing or shutters. L34265 items 3 and 9 are plantation shutters, Remove and
   Re-fit (£50.26 each). L32520 item 9 is shutters **Leave in Situ** and should
   be left firing nothing — it is the case that proves the action matters.
3. **Re-price drawings 11–15** afterwards and confirm the fitting hours move by
   those amounts and nothing else does.
4. **`0` means untick the architrave as well.** That is the one that is easy to
   miss, because the architrave is ticked by default and an item with no
   surround at all looks like an item nobody has answered.

---

# What a reader should be wary of

- **The default is "architrave on".** So a drawing nobody has answered looks
  identical to a drawing somebody answered as "architrave only". There is no
  third state, which is what keeps old drawings priced as they were — but it
  means the board cannot tell you whether the question has been asked. If that
  matters later, it needs a stored "answered" flag, not a change to these
  defaults.
- **External lining has no live benchmark.** No LQ item has one, so the 180
  minutes is asserted only against Integrate's rule text and its
  `external_lining=AA03` variable, not against a priced quote. It is the one
  part of this step with no parity reading behind it.
- **The architrave gate is in code, not in the rules.** Anyone reading
  `part_allocation_rules` alone will conclude GlazePro always allocates an
  architrave. The gate is in `allocateParts`, beside Step BC's.
- **Hinged SDG and security grills fire nothing**, and that is faithful. A
  surveyor who picks them and expects a charge will not get one, because
  Integrate has no rule. Worth a decision rather than a bug report.
- **AA01/AA02/AA03 price at zero because of a rounding**, not because they are
  marked free. If the `surrounds` rounding in `componentLengthMetres` ever
  changes, these three start charging 50 / 30 / 75 — and the tests that assert
  `line_cost` is 0 are what would catch it.

---

# e2e after the deploy

Deploy confirmed by decoding `/version.json`: **`mvb7y8h4` = 17:05:45Z**, after
the last commit at `18:08:57+01:00` = 17:08:57Z — the Vercel build for this
push. `public/version.json` is left uncommitted, as CLAUDE.md says.

`npm run e2e`: **7 passed** (31.0s), first time.

```
ok 1 logs in
ok 2 every benchmark passes except the parked residuals
ok 3 the fanlight drawing shows Fanlight A1 and Casement Sash A2
ok 4 a casement drawing offers Bi-Glass in Type of Work
ok 5 selecting Finish & Ironmongery keeps unsaved edits unsaved
ok 6 the validation panel loads without an error
ok 7 every drawing card on the L507712 quote matrix shows a price
```

Test 2 is the live benchmark page, and it passing is the useful part of this
run: the deploy now carries both the reviewer's edited `integrate-targets.json`
(the surround gaps removed) **and** the tick boxes that close them, so the live
page agrees with the offline suite again. It disagreed during the Step BM
follow-up precisely because the targets were committed a step later than the
code — see that report's e2e section.

Test 5 also exercises the Finish & Ironmongery panel, which is where this
step's new block lives, so it confirms the panel still opens and still holds
unsaved state with the ticks and dropdowns on it.
