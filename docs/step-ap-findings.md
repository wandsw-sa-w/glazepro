# Step AP findings — casement and direct glazed frames on the drawing board

Written while doing `docs/step-ap-casement-board-brief.md` and
`docs/step-ap-addendum-mullion-length.md`. Facts in
`docs/integrate-L31115-direct-glazed.txt`.

Nothing here is tuned. Where GlazePro and Integrate differ the gap is stated
with its cause; where something is unverified it says so.

---

## 1. The board could not build a casement drawing at all (fixed)

The blocker found at the start of the step, before any of the brief's items
could be tested: `DrawingBoard.jsx` loaded the profile by the hard-coded
fallback code `'sash'` for **every** drawing, so a casement drawing got the
box-sash profile's values and the casement profile (id 2) was never read.

Fixed by adding `loadProfileById(id)` to `src/drawingBoard/api.js` and
loading the drawing's **own** profile (`dwg.default_profile_id`), falling
back to `'sash'` only when a drawing has none. This also affects box sash
drawings on any non-default profile — they were silently priced with the
`sash` profile's sections. Not verified against the live database.

## 2. Resizing a frame does not re-space its mullions

Open the "Double Flush Casement" template (1200 wide, mullion centred at
offset 549.5) and type 1199 into the frame width: the mullion **stays** at
549.5, giving openings of 548.5 and 549.5 instead of two 549s. Benchmark N
then prices **2140.76 against Integrate's 2140.75** — 1p, from the glass
area and the frame timber of the half-millimetre.

This is reported, not fixed, because the right behaviour is a decision, not
a reading: a surveyor may have placed a mullion deliberately (to line up
with a brick pier or an existing jamb), and silently moving it on every
resize would throw that away. Integrate's own behaviour on a resize was not
read, so nothing was invented.

The board path that **does** reproduce N exactly is the one a surveyor would
use anyway: set the frame size first, then apply the mullion picker. That is
how `boardPath.test.js` builds N, with the 549.5 behaviour pinned by its own
test so it cannot change unnoticed.

**If the reviewer wants mullions re-spaced on resize**, say so and it is a
one-line change in the resize handler (re-run `applyDividers` with the new
interior width); it needs a decision about mullions the surveyor has moved
by hand.

## 3. Three default casement ironmongery lines price 0.00 (PB vs PC)

Brief §5 asked for the default list the rules give for K, N and P. The
structure is right — the list follows the openings exactly as the brief
requires — but three products price **0.00** with a warning.

**Cause, from the catalogue itself.** Step Z gives a default line an empty
finish, meaning "follow the item's ironmongery finish", unless the product
is in `FIXED_FINISHES = ['Wht', 'PN']`. The casement templates' item finish
is **PB**, and these three products exist in the catalogue **only in PC**:

| Product | PB | PC |
|---|---|---|
| `defender_friction_hinge_-_side_hung_310mm` | — | 7.82 (RFH203) |
| `kenrick_extension_gear_box` | — | 7.35 |
| `kenrick_extension_950mm` | — | 2.07 (RJZ1705) |

So the line resolves to PB, finds nothing, warns and prices nothing. The
handle (`connoisseur_handle_lh:PB`, 7.55) and the trickle vents (Wht, fixed)
price normally, which is why the fault is easy to miss.

A fourth, milder case: `kenrick_excalibur_straight_extension_300mm:PB`
**does** exist with cost 3.82 but an **empty parts list**, so on P it prices
4.20 correctly while allocating no part at all (its line shows no part code).

These are hidden functional parts — shootbolts, friction hinges, a gearbox —
not a decorative finish the customer chooses, so they look like they should
keep the rule's own finish the way `Wht` and `PN` do. **Not changed on my
own initiative**: adding `'PC'` to `FIXED_FINISHES` is a one-word change that
moves real prices, and whether Integrate's casement rules mean "always PC"
or "PC because these templates are PC" is a reading of Integrate, which I
cannot do. Flagged for the reviewer.

### The default lists, as asked

All built through the real board code, priced from `pf30-snapshot.json`.
"Ironmongery Cost" lines only; lines merge by product and finish.

**K** — one opening casement + one direct glazed unit — **13.65**

| Product | Finish | Qty | Priced |
|---|---|---|---|
| `connoisseur_handle_lh` | PB | 1 | 8.40 |
| `defender_friction_hinge_-_side_hung_310mm` | PB | 1 | **0.00** |
| `kenrick_extension_gear_box` | PB | 1 | **0.00** |
| `kenrick_extension_950mm` | PB | 2 | **0.00** |
| `trickle_vent_xr16` | Wht | 1 | 3.15 |
| `trickle` | Wht | 1 | 2.10 |

**N** — two openings — **21.00 with both opening, 13.65 with B1 fixed**

| Product | Finish | Both opening | B1 fixed |
|---|---|---|---|
| `connoisseur_handle_lh` | PB | 2 | 1 |
| `defender_friction_hinge_-_side_hung_310mm` | PB | 2 | 1 |
| `kenrick_extension_gear_box` | PB | 2 | 1 |
| `kenrick_extension_950mm` | PB | 4 | 2 |
| `trickle_vent_xr16` / `trickle` | Wht | 1 / 1 | 1 / 1 |

This is the proof brief §5 asked for: **change B1 from opening to fixed and
its handle, gearbox and extensions drop out.** The quantities halve; the
line *count* stays 6, because lines merge by product and finish — the first
version of this test asserted the count shrinks, which was my mistake, and
it now asserts the quantities.

**P** — one 1599 × 1599 opening casement — **48.30**

| Product | Finish | Qty | Priced |
|---|---|---|---|
| `connoisseur_handle_lh` | PB | 1 | 8.40 |
| `kenrick_extension_gear_box` | PB | 1 | **0.00** |
| `76mm_hinges` | PB | 6 | 30.45 |
| `trickle_vent_xr16` | Wht | 1 | 3.15 |
| `trickle` | Wht | 1 | 2.10 |
| `kenrick_excalibur_straight_extension_300mm` | PB | 1 | 4.20 (no part allocated) |
| `kenrick_extension_950mm` | PB | 2 | **0.00** |

P is big enough that the rules choose **six 76mm butt hinges** instead of
friction hinges, which is Integrate's own size/weight branch working.

**L** — two direct glazed units — **5.25**: the two trickle vents and
nothing else. A frame with no sashes sells no casement hardware, which is
the other half of §5's requirement.

## 4. Correction to Step AO: the ironmongery rounding was right all along

Step AO's findings said Integrate appears to round the ironmongery **sum**
once. Brief §6 shows that is **wrong**: Integrate prints one line **per
part**, each rounded to whole pounds and then × 1.05 (7.55 → 8 → 8.40),
exactly like every other line. GlazePro already does this. **The rounding
was not touched.**

The £14.70 gap on J–P is therefore purely the four part costs that carry
`unit_cost 0` with `properties.cost_unknown = true` in the live
`parts_catalogue` (RJZ1700, RJZ1708, RJZ1709, RJZ1710). The reviewer's
`sql/step-ap0-gearbox-part-costs.sql` is the data fix; it was not changed
and it has not been run.

## 5. The mullion length addendum, and the engine version

Rule 121 takes a casement mullion's length as the frame's internal height
**+ 25**; the frame **timber volume** keeps **+ 20**. Both numbers are
Integrate's and they genuinely differ — the addendum proves it by moving the
head on a copy of J (head 47 → 1.35 → 16.78; head 57 → 1.3419 → 1220), so
the length follows the head, not the overall frame.

Because that changed a priced quantity **after** version 13 had been pushed,
`PRICING_ENGINE_VERSION` is now **14**. No stored quote can be affected (the
board could not build a casement drawing until this step); the bump is only
so one version number never maps to two different prices.

## 6. What the tests show

Full suite: **1,237 passing, 8 failing** — exactly the standing eight
truthful failures, unchanged by this step:

- **A50** top Lead Weight 17.6 against Integrate's 17.5
- **D** double-box steel counterweights, +0.54 and +0.80
- **six Step W** counterweight-display rows

No benchmark moved. J–P still match the Step AO targets, and they are now
also built through the real board code (`boardPath.test.js`), not only
hand-built fixtures.

New tests in this step: 25 in `casementOpenings.test.js`, 11 in
`boardPath.test.js`, 10 in `renderElevation.test.jsx`.

## 7. Not verified

- **Nothing in the live database.** The two SQL files this step wrote have
  not been run; the anon key returns empty under RLS, and empty is not
  missing. No claim here about the live site.
- **The casement templates as Nathan will see them** — whether they appear
  in the add-drawing chooser under a "Casement" group, and whether the
  trees load and price on the live benchmark page.
- **Integrate's resize behaviour** for mullions (finding 2).
- **Whether Integrate's casement ironmongery rules mean "always PC"**
  (finding 3).
- **`is_casement_range` and `is_heritage_range`** are still inferred, as
  Step AO reported: there is no stored field for either. `is_heritage_range`
  is hard-coded `false`, so the heritage stay/fastener rules never fire.
- **The casement operation and sash-type codes** (`fix`, `left_hand_hung`,
  `open_out`) match `reference_options` as the reviewer read them on 9 Oct,
  but I did not read them myself.
