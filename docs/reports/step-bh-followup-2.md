# Step BH follow-up 2 — short dividers die on SAVE

Done 15 Oct 2026. Brief: `docs/step-bh-followup-2.md`.

Commits: `ec72d9d` (item 0 — the reviewer's `bh3` edit, the refreshed snapshot
and the scaffolding it makes pointless) and this one.

**SQL waiting, not run:** **`sql/step-bh5`** — re-points the divider
references that died on the two drawings that already hold them (56 and 60),
and carries the query that answers "has this happened anywhere else".

Offline suite: **1,908 passing, 8 failing** — the standing eight (six Step W
sash-weight rows, benchmarks A50 and D). 12 new tests, and 6 deleted with the
scaffolding. `npm run e2e`: at the end.

---

# 1. The cause, in code terms

A SHORT divider names the dividers it starts and ends at: Integrate's
`startDivider` / `endDivider`, by **key**, with `'0'` for the frame itself
(Step AV's model). It is what lets a transom stop at two mullions, so the side
lights beside it run full height and the fanlight sits over the door alone.

**`drawing_parts` has no key column.** Three lines, in two functions:

    api.js saveDrawingParts   parts.push({ key, parent_key, part_type, … })
    (the RPC assigns ids)
    api.js loadDrawingParts   byId[row.id] = { …row, key: String(row.id), … }

So the client's keys go in, **database ids come out**, and the tree the board
loads is keyed by those ids. Nothing rewrote the two references, so they kept
naming keys that exist nowhere — which `dividerRefIndex` resolves to `null`,
and a null bound means "the frame", i.e. frame to frame.

Read frame to frame, the transom re-cuts the whole frame: a **four-opening**
doorset becomes a **3 × 2 grid of six cells**. Drawing 60, exactly as the
reviewer read it:

    mullions  drawing_parts.id 1218 (offset 365) and 1219 (offset 1306)
    transom   id 1220  startDivider 'a75a59df-…'  endDivider '07122378-…'

Those are the fresh UUIDs `regenerateKeys` wrote — valid in the tree that was
saved, meaningless in the tree that came back. (Drawing 56, made before the
first follow-up, still holds the template's own `'mull_wike8s5'` /
`'mull_m8sj862'`: the same failure one step earlier.)

**It was never template 38's problem.** Any drawing with a short divider loses
it on save: the two-column casement templates, "Fanlight Over Fixed With
Full-Height Opener", or one a surveyor splits "in one column / one row only"
on the board. Step AV was only ever checked live UNSAVED, and the round trip
below is what should have been there then.

## Every path that writes `drawing_parts`

| path | carried the bug? | |
|---|---|---|
| the board's **Save** (`DrawingBoard.handleSave`) | **yes** | every save re-wrote the keys and left the references |
| **create from template** (`templates.createDrawingFromTemplate`) | **yes**, twice over | `regenerateKeys` lost them (fixed in follow-up 1), and then the save lost them again |
| **copy a drawing** (`QuoteMatrixPage.copyDrawing`) | **yes**, and worst of the three: it loads a tree whose keys are the SOURCE drawing's row ids and saves it under a new drawing, so the references would have pointed into another drawing's rows |
| `DrawingBoardTest.jsx` (the dev page) | yes, through the same function | |

All four go through **`saveDrawingParts`**, which is why that is the one place
the fix belongs.

## The fix: positional, and on every save

`src/drawingBoard/dividerRefs.js` — pure, no supabase, no React:

| | |
|---|---|
| `hasDividerRefs(tree)` | is there a short divider at all? Most drawings have none and skip the work. |
| `dividerRefMap(before, after)` | old key → new key, **by position**: the nth mullion or transom of the nth frame, in offset order. |
| `repointDividerRefs(tree, map)` | rewrites the two fields; a reference not in the map is left alone rather than aimed somewhere new. |
| `fixDividerRefsAfterSave(before, after)` | the corrected tree, and **only** the nodes whose values changed. |
| `deadDividerRefs(tree)` | references that resolve to nothing — the loud failure. |

`saveDrawingParts` now: flatten → RPC → (if the tree has any references) load
the rows back, build the map, and `update` the one or two rows whose `values`
changed. Two writes, not a re-save, so **the ids cannot change under it**.

**Why positional.** Nothing identifies a divider across a save except where it
is. The reviewer's brief suggested mapping client key → new row id as the rows
are inserted, which needs the RPC to hand back the mapping; the position does
the same job from outside it, and it keeps working if the table ever
renumbers its rows — which the round trip tests by renumbering on every save.

**And when one is missed:** `validateDrawing` has a second built-in error
(after item 2's degenerate-size one):

> This transom says it stops at a divider that is not in the frame
> (startDivider = a75a59df-…). The frame cannot be read correctly until that
> is put right — re-make the drawing from its template, or set the divider to
> run frame to frame.

Built in, not a row in `validation_rules`: a tree that cannot be read is not a
business rule anybody should be able to switch off.

## The round trip — the test that was missing

`src/drawingBoard/saveRoundTrip.test.js`, 12 tests. The fake `drawing_parts`
flattens exactly as `saveDrawingParts` does, hands out its own ids, rebuilds
exactly as `loadDrawingParts` does (keying by `String(row.id)`, keeping
nothing of the client key) — and **renumbers on every save**.

| | |
|---|---|
| the fake really is the database | every loaded key is a row id |
| every reference resolves after the save | `deadDividerRefs` is empty |
| the cells are the same **four**, not six | and the door is 892 × 2068 with no negative cell |
| it prices **£8,936.47** | the same as before the database |
| **without** the fix | 2 dead references, 6 cells, **£7,517.43** and four "no usable size" warnings — the live figure of drawing 60 to the penny |
| save after save | three round trips, ids moving every time |
| all five templates | cells and price unchanged through the database |
| a drawing with no short divider | untouched, and nothing written |
| a divider a **surveyor** adds | `splitOpening` on a stable door's side light, saved and loaded |
| a dead reference | two validation ERRORS naming the divider |

**Why the two earlier tests let it through.** Step BH's priced the BUILDER's
tree; the first follow-up moved it to `prepareTemplateTree`'s tree. Both stop
short of the database, and the database is where the keys change the second
time. The round trip goes all the way.

---

# 2. The two drawings that exist

`sql/step-bh5` re-points every reference that resolves to nothing, by the same
positional rule the code uses: of the frame's two crossing dividers, in offset
order, the first starts the divider and the second ends it. On drawings 56 and
60 that is the mullion at 365 and the one at 1306.

- It is **guarded**: it touches only a reference that is dead, so a second run
  finds none; and it skips (with a NOTICE) any divider that does not have
  exactly two crossing dividers, because that is a shape this file does not
  claim to know.
- **SECTION 0b is the query the brief asks for** — every dead reference in
  every drawing, which the reviewer should read before and after. It found
  only these two; the file repairs whatever it finds and says how many.
- **After it:** both drawings read Side light A1, Fanlight B1, Side light C1,
  Single Door B2 and price **£8,936.47**. They read £7,095.53 (56) and
  £7,517.43 (60) now — the difference between them being that 60 was priced
  after the degenerate-size guard, so its negative panels are refused rather
  than deducted.
- **Re-making them works too**, and gives the same tree by the same rule. The
  file exists so that a drawing a surveyor has since edited does not have to
  be rebuilt.

Stray **drawing 53** (L507712 item 1) is the reviewer's own mistake and is
left alone, as the brief says. It is a pair of front doors with no short
divider, so it is not affected either way.

---

# 3. Item 0 — the snapshot, and what came out with it

The reviewer downloaded a fresh PF30 snapshot at 09:45 on 15 Oct, after
`sql/step-bh3` and `sql/step-bh4`. Everything the brief expected is in it, and
a little more:

| | |
|---|---|
| the five front-door rules | `not is_slave_leaf_in_french_pair` ✓ |
| allocator `cebdd8b5` | `and not is_front_door` ✓ (bh1) |
| **Front Door Pair Additional Door** | new, on the current price file: `new_french_door_pair_qty` × 120 ✓ |
| rule `cb8eb0b9` | the Croft `euro_cylinder_pull` ✓ |
| bf3 | the four stable-door rules, the duplicate hinge rule **inactive**, the three imported rules off, both white vents gated |
| be1 | the shaped rate equal to the square one |
| bd1 | the AV4 part costs (lock 107, centre keep 30, pocket keep 5) **and** the hand fix — the `_lh` set holds RHZ2481 / RHZ3091 |

**So every "capture lags live" helper is now a no-op, and they are gone**:
`withAv4Costs`, `withFrontDoorIronmongery` (the whole module and its test),
`withShapedGlassRate`, `withStableDoorIronmongery`, `withFrontDoorPairLock`,
`withFrontDoorEuroPull`, `withFrontDoorSetOnMaster`,
`withFrontDoorPairFitting`. `liveRuleFixes.js` keeps the **vocabulary** those
files wrote — the rule ids and the sets the tests name — and records what each
file did.

Six tests existed only to document the lag. Two of them kept their teeth by
reconstructing the old state **from the live rows**:

- bf3's duplicate hinge rule is still in the data, INACTIVE (the reviewer kept
  the row rather than deleting it). Switch it back on and ungate the two vents
  and a stable door is **£34.65 dearer** — still the figure, still guarded.
- Move the front-door set back to the slave leaf and it costs **the same**,
  which is why item 4 of the last step moved no money.

---

# 4. Item 3 — two loose ends closed

- **There is no AV3 / AV4 question.** The product short names are
  `av3_heritage_locking_system_lh` / `_rh` — a legacy id — and the products
  are named "AV4 Heritage Locking System LH / RH" and hold the AV4 parts
  (RHZ2481 / RHZ3091 left hand, RHZ2482 / RHZ3092 right, with RHZ2427 and
  LJZ5074040CP in both). Both earlier reports said it was open; both now say
  it is closed, and why.
- **Stray drawing 53** is noted as the reviewer's mistake in both places it
  could matter (here, and the smoke suite never pinned it).
- And one the reviewer did not raise: **Step BH's report priced the front
  door's euro pull from the stale capture** (£25.20, the Hardwick set), so its
  five figures were £8.40 of price low for the three front doors. A dated
  correction now sits at the head of that section, pointing at the live
  figures.

---

# What a reader should be wary of

- **The re-pointing runs on every save, not once.** That is deliberate: if the
  RPC ever renumbers a drawing's rows, the references have to follow, and a
  one-off migration would not. The cost is one extra read and one or two
  writes, and only on a drawing that has a short divider at all.
- **A failed re-point does not fail the save.** The parts ARE saved by then;
  the console says which row could not be written, and the board shows the
  dead reference as an error on the next load. Losing a surveyor's work to
  make a point about a divider would be the wrong trade.
- **The positional rule assumes the two trees are the same drawing** — the
  same frames in the same order with the same dividers. They are: one is the
  tree just saved and the other is what came back from saving it. It is not a
  general-purpose tree differ and should not be used as one.
- **`sql/step-bh5` knows one shape**, a divider bounded by two crossing
  dividers. Anything else it leaves alone and says so. If 0b ever lists a
  divider with three mullions in the frame, that is a case for a human.
- **The fake `drawing_parts` is a fake.** It is faithful to the two functions
  it stands in for — flatten, assign ids, rebuild by id, sort by sort_order —
  but the real RPC also enforces containment and may order rows differently
  under concurrent writes. The live check is the five drawings on L507712.
- **`validateDrawing` now does two things no DB rule can switch off** (a dead
  divider reference, a part with no usable size). Both are structural: a tree
  that cannot be read, and a part that cannot be made.
- `public/version.json` is left uncommitted, as CLAUDE.md says.

---

# e2e after the deploy

Deploy confirmed by decoding `/version.json`: **09:13:08Z**, 14 seconds after
the commit.

`npm run e2e` — **5 passed** (33.2s): logs in; every benchmark passes except
the parked residuals; the fanlight drawing; the validation panel; every
drawing card on the L507712 matrix priced, the five doorsets at their pinned
figures.

**What this run is worth, given that the snapshot was replaced.** The
benchmark page prices from the LIVE data, not from the capture — so "61 rows,
A50 and D parked" passing means the refreshed snapshot agrees with the site it
was taken from, which is the whole point of refreshing it. And the validation
panel still loads clean on drawing 24, with two built-in checks now running on
every drawing.

**What it cannot show** is the save fix: the suite is read-only, and the five
cards show each drawing's last priced figure. The live check is
`sql/step-bh5`, then re-pricing drawings 56 and 60 — both should read
**£8,936.47** — or making one more drawing from template 38, which needs no
SQL at all and should price the same.
