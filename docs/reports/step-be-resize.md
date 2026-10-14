# Step BE resize — a resized leaf keeps its grid centred

Done 14 Oct 2026. Nathan's instruction of 14 Oct, closing the gap the Step BE
follow-up report named itself: `recentreGridsAfterResize` was wired into
`addSideLight` only, so a front door resized **on the board** kept its old
muntin offset.

Commit: `734b72d`, and this report. **No SQL, and none needed** — this is
board behaviour; `sql/step-be2` is still the one file waiting.

---

## What was wrong

Widening a 1099 front door to 1399 left the muntin where it was:

| | interior | muntin | panels |
|---|---|---|---|
| before the resize | 777 | 329 | 329 / 328 |
| after, **as it was** | 1077 | 329 | **329 / 628** |
| after, **now** | 1077 | **479** | **479 / 478** |

The first of the new tests pins the defect itself — `resizeCasementFrame` on
its own still leaves 329 / 628 — so the wiring cannot be quietly removed.

## Where it is wired, and why there

In **`commit()`**, not in the resize handler:

```js
const next = recentreGridsAfterResize(tree, newTree, profileValues)
```

The list of things that change a leaf's or a sash's interior is longer than
the frame's width and height: typing an **internal size**
(`frameFromInternalSize`), the **divider picker** (`applyDividers`),
**splitting an opening**, **removing a divider**, **evening dividers up**, a
**cill height**, a **bottom rail**. Wiring each one would have covered the two
the instruction names and left the rest to be found live, which is how the
first defect arrived.

One hook is safe there because the function is conservative by construction:
it acts only when an interior **actually moved** *and* the dividers in it were
**EVEN**. Every other commit passes through it unchanged — a test asserts that
a casement window's tree comes back **identical**.

**`undo()` and `redo()` set the tree directly**, so they restore exactly what
was there rather than re-centring on the way back.

## What moves, and what does not

| | behaviour |
|---|---|
| an **even muntin** on a width change | re-centred (329 → 479) |
| a muntin the surveyor **moved** (600 of a 777 interior) | **stays at 600**, through any resize |
| an **even mid rail** on a height change (the board's 2 × 2 default, 809) | follows (→ 909) |
| a **chosen** mid rail — Integrate's Balham 983, the side light's 1031 | **stays** |
| the **side light's** own grid | the same rule; on a taller frame its 1031 rail stays and the glass takes the change (1031 / 841) |
| a drawing with **no grid** | untouched, tree-identical |

The rule in one line: **an even run of dividers is a proportion and is
re-evened; anything else is a decision and is kept.** A lock rail does not
move because the door got wider — which is the same reason Integrate's 983
survived the follow-up's fix and the muntin did not.

## What the tests show

**Tests first** — 6 new in `src/drawingBoard/frontDoorBoard.test.js`, through
the exact pair the board now calls (`resizeCasementFrame`, then
`recentreGridsAfterResize`):

- a wider front door keeps its muntin centred (479 / 478) and its lock rail at
  983;
- **the defect**: `resizeCasementFrame` alone leaves 329 / 628;
- **a muntin the surveyor has moved stays put** through a resize;
- a taller door re-evens an even rail (809 → 909) and leaves the Balham's 983;
- the side light's own grid follows the same rule;
- a casement window is untouched, tree-identical.

**Offline: 1,768 passing, 8 failing — the standing eight, unchanged**
(`npx vitest run`). Eslint unchanged (14 pre-existing errors in
`DrawingBoard.jsx`, the same 14 as HEAD).

**Live: 5 of 5 passed (28.8s)**, against the deploy of `734b72d` —
`/version.json` reads `mv7ymo82`, built 2026-10-14 10:21:30Z, eleven seconds
after the commit:

```
ok 1 logs in (4.8s)
ok 2 every benchmark passes except the parked residuals (9.3s)
ok 3 the fanlight drawing shows Fanlight A1 and Casement Sash A2 (4.4s)
ok 4 the validation panel loads without an error (3.3s)
ok 5 every drawing card on the L507712 quote matrix shows a price (6.3s)
```

No benchmark moved, which is the point: no fixture has a grid that is resized,
so the hook is invisible to all 51 rows.

## Not verified against the live database

- **Nobody has resized a front door on the live board.** The six tests go
  through the functions `commit` calls, and `commit` itself is one line — but
  the screen is what the reviewer would confirm, on a drawing made from the
  re-issued template.
- **No drawing was saved.**
- **`sql/step-be2` is still unrun**, so template 32 still carries the 479
  muntin and a drawing made from it starts wrong however well the board
  behaves afterwards.
- **A resize of a drawing SAVED with a 479 muntin will re-centre it** the
  first time anything is committed on that drawing (the interior does not
  change, so only an actual resize triggers it) — worth knowing when drawing
  47 is looked at rather than re-made.

## Anything that did not behave as the instruction describes

- **The hook went into `commit`, not into the resize path.** The instruction
  said "the board's frame-resize path (frame width and height, and any other
  action that changes a leaf's or sash's interior)" — the parenthesis is what
  argued for one central hook rather than two call sites and a list to
  maintain.
- **Nothing else changed.** No pricing, no fixture, no rule: a re-centred grid
  on an existing benchmark would have moved money, and none of them has one.
