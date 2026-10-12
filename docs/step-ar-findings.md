# Step AR findings — casement fanlights (transoms) and the board clean-ups

Written while doing `docs/step-ar-casement-fanlights-brief.md`. Facts:
`docs/integrate-L31115-fanlights.txt` (reviewer, 12 Oct 2026).

Nothing here is tuned. Where I could not read something, or where a reading
contradicts a change, it says so.

---

## 1. Transoms: everything in the reconciliation comes out

A transom is stored exactly as a mullion is, turned through 90°: a
`transomPart` child of the frame whose `offset` is the height of the opening
**above** it, with its own thickness. `frameColumns` / `frameRows` /
`frameGridSize` split the interior both ways, and `frameOpenings` returns the
cells in Integrate's matrix order — the top row first, so the fanlight is A1
and the casement under it A2.

Every figure in the facts file's reconciliation is reproduced exactly:

| | Q (1040 × 980) | S (1199 × 1499) |
|---|---|---|
| openings | 966 × 356 / 966 × 503 | 1125 × 356 / 1125 × 1022 |
| sashes | 958 × 348 / 958 × 495 | 1117 × 348 / 1117 × 1014 |
| production | 1030 min (17.17 h) | 1030 min |
| labour | 660 min (R: 630) | 705 min |
| frame timber | 22.73 → 28.41 | 30.45 → 38.06 |
| sash timber | 9.83 / 10.82 | 11.08 / 15.54 |
| cill | 11.15 | 12.85 |
| glass | **0.30** (the minimum) / 0.33 | 0.30 / 0.92 |

The production 1030 needed no new variable: `frame_transom_qty` already
existed and rules 1105 (180 min) and 211 (60 min) already read
`frame_mullion_qty + frame_transom_qty`. The frame timber already handled a
transom at (internal width + 20) × 96 × 67 from Step AO — 986 × 6432 = 6.342
on Q, exactly the facts' figure. S's lower sash computes 26.2 kg, so "Any
Sash Overweight" fires and gives S its 705th minute, as Integrate charges.

### Rule 121's transom length is NOT verified
`frameMuntinLengthM` uses internal **width** + 25 for a transom, by analogy
with the mullion's internal height + 25 (which the Step AP addendum did
measure). There is no Integrate reading for a transom, Q/R/S are softwood so
the utile "Casement Transoms & Mullions" rule never fires on them, and a test
records both facts.

### The transom thickness key does not exist
The casement profile has no transom thickness key (your 12 Oct reading).
Integrate's stored transom is 27 with 20/20 stops, which is exactly the solid
MULLION's section, and `mullionPart.thicknessInFrameSolid` is 27. So
`casementTransomThickness()` uses the solid mullion value and records the
agreement, rather than writing 27 in as a constant. If a transom key does
exist under a spelling I could not see, it should go first in that function.

## 2. The 28p on Q — a reading that contradicts a fix

Q is short of Integrate by 8.12 and S by 8.40. S's 8.40 is the gearbox (below).
Q's extra 28p is the surround:

Integrate's own allocation rule measures `1000 × width + 100`, so Q's
1040-wide frame gives **1140 mm**. Integrate prints **1.10 m** (£3.14);
GlazePro ceils to 1.20 m (£3.42).

I changed the rounding to half-up — and it broke two other readings:

| benchmark | part | measure | ceil | round | Integrate |
|---|---|---|---|---|---|
| L34046 | surround width | 1345 mm | 1.4 | 1.3 | **1.4** |
| S | surround head board | 1349 mm | 1.4 | 1.3 | **1.4** |
| Q | surround width | 1140 mm | 1.2 | 1.1 | **1.1** |

Two readings confirm ceiling and one contradicts it, so **the rounding is not
what differs — the measure is**. I reverted the change (L34046 is exact again)
and left the 28p as a truthful gap. The question for you: is the surround
width allowance (+100 mm) different on a casement from a box sash? Q's own
HEIGHT line confirms the +100 there — 2 × (980 + 100) = 2160 mm → 2.20 m,
which Integrate prints — so it is the width term alone that disagrees.

## 3. The gearbox part costs, again

One Kenrick gearbox set per drawing on Q/R/S, whose four parts carry
`unit_cost 0` in `pf30-snapshot.json`: **8.40 cost, 16.80 price** on each.
Your `sql/step-ap0-gearbox-part-costs.sql` is the data fix and its figures
reconcile exactly against the facts — 3.89 → 4.20, 2.02 → 2.10, 0.72 → 1.05
twice = the facts' "gearbox 4.20, centre strike 2.10, LH / RH strike 1.05
each". The snapshot is a captured file in the repo, so these tests will show
the gap until a fresh snapshot is taken, even once the live data is fixed.

## 4. Why 94 / 47 / 58 / 2 happened — my Step AQ explanation was wrong

You were right that the stormproof story did not match the data. The cause is
the **lookup**, not the values.

`DrawingBoard` builds `profileValueMap` keyed by the SHORT property name
alone (`field_key.split('.').pop()`), so every part type shares one namespace
and the last row read wins. `profileValue` then fell back to that short name
when the full key was absent. Asking for `casementSashPart.bottomHeight` on a
profile that has no such key therefore returned
`assemblyFramePart.bottomHeight` — **47**, one of the four numbers — instead
of falling through to `defaultFanlightBottomHeight` (83). A test reproduces
that 47 from rows shaped exactly as `loadProfileValues` returns them.

Fixed at both ends: the short fallback is gone, so a short-keyed map now
resolves **nothing** and every value lands in `missing` where it is visible
rather than quietly wrong; and the board passes the raw rows, matched on the
full `field_key`. Clearances are read per edge, since profile 2 has no generic
`mechanicalClearance`. Direct glazed → casement now builds **62 / 62 / 62 /
83, 54, 4** from profile 2, asserted by test.

**I could not reproduce 94 or 58.** The collision explains 47 exactly and is
the only mechanism I can demonstrate; for 94 and 58 to come from it, profile 2
must hold some row whose short name is `leftWidth` / `topHeight` / `thickness`
with those values — a door leaf's 94 mm stile and 58 mm thickness would do it.
If you want it settled, this is the query:

```sql
SELECT field_key, default_value FROM default_profile_values
WHERE profile_id = 2
  AND (field_key LIKE '%.leftWidth'  OR field_key LIKE '%.rightWidth'
    OR field_key LIKE '%.topHeight'  OR field_key LIKE '%.bottomHeight'
    OR field_key LIKE '%.thickness'  OR field_key LIKE '%mechanicalClearance%')
ORDER BY field_key;
```

It no longer affects any price — the fix removes the whole class — so this is
only to close the record.

## 5. The fanlight bottom rail warning cannot fire, and nor can any part rule

The rule is in Integrate's imported list
(`docs/integrate-validation-rules.txt` line 289): *casement sash, warning,
`is_fanlight and to_be_replaced and gross_bottom_rail_height_in_mm > 62`*,
"Fanlight bottom rail should be reduced to 62mm externally".

**It cannot fire, for two independent reasons, and the second is bigger than
this rule.**

1. Its two variables do not exist in GlazePro: nothing computes `is_fanlight`
   or `gross_bottom_rail_height_in_mm`.
2. Every place that loads validation rules filters to `level = 'item'`
   (`DrawingBoard.jsx:1036`, `QuoteMatrixPage.jsx:91`; the engine loads
   `level = 'quote'` for publishing). This is a **casement sash**-level rule,
   so it is never even fetched. Neither are the two casement-sash size
   ERRORS in the same imported list — "we cannot manufacture casement sashes
   narrower than 300mm" would not stop anyone today.

I could not check whether the row exists live. The 83 bottom rail is
unchanged, as you said: Integrate's own drawing keeps 83 and prices it, and
all three fixtures do too.

## 6. The parts-list order — not reproduced

I could not reproduce a tree in which the parts list and the drawing
disagree: both read the openings from the frame's children in the same order,
and `applyDividers` emits them in matrix order (A1, B1, then A2, B2).

What I have done instead removes the possibility of misreading rather than
relying on order: every opening now carries Integrate's own name **and its
matrix position** in both places — "Fanlight A1", "Casement Sash A2", "Direct
Glazed Unit B1" — and the selected opening is outlined in red on the drawing.
One possibility worth checking when you re-test: in the EXTERNAL view the
drawing is mirrored left-to-right, so A1 appears on the right while the list
still reads A1 first. That is correct for a mirrored view but it looks exactly
like "the opposite order".

## 7. What the tests show

Full suite: **1,294 passing, 8 failing** — the standing eight only:

- **A50** top Lead Weight 17.6 against Integrate's 17.5
- **D** double-box steel counterweights, +0.54 and +0.80
- **six Step W** counterweight-display rows

No benchmark moved. Two Step AP assertions were **replaced by the behaviour
that replaced them**, each with the reason recorded rather than left passing:
the one-row matrix labels, and "a casement frame takes no transoms".

Default ironmongery for a fanlight drawing, with no stored list:

| | lines | cost |
|---|---|---|
| Q (top-hung fanlight) | 8 | 42.00 |
| R (fixed fanlight) | 6 | 26.25 |
| S (top-hung, 1199 × 1499) | 7 | 54.60 |

A top-hung fanlight gets its own top-hung friction hinge (`defender_209mm`),
two handles and two gearbox sets; fixing it drops the hinge and halves the
rest. The Step AQ finish rule is visible in the sources: PB where the product
exists in the item's finish, PC from the rule where it does not.

## 8. Not verified

- **Nothing in the live database.** The one SQL file this step wrote has not
  been run; the anon key returns empty under RLS and empty is not missing.
- **Whether the fanlight validation rule row exists**, and whether any
  part-level rule is meant to be evaluated (§5).
- **Rule 121's transom length** (§1).
- **Whether a transom thickness key exists** under a spelling I could not see.
- **Whether a profile key holds the fanlight HEIGHT.** `fanlightHeight()`
  tries four plausible spellings and falls back to Integrate's template 356,
  reporting which it used; your 12 Oct reading lists none, and
  `defaultFanlightBottomHeight` (83) is the bottom RAIL, not the height.
- **Where 94 and 58 came from** (§4) — the mechanism is fixed either way.
- **The surround width allowance on a casement** (§2).
- `is_heritage_range` is still hard-coded `false`.
