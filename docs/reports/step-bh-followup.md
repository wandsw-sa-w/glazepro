# Step BH follow-up — the cell mismatch, and five doorsets priced

Done 15 Oct 2026. Brief: `docs/step-bh-followup.md`.

Commits: `d58f58a` (item 0 — the reviewer's `bh1` edit and the brief) and this
one.

**SQL waiting, neither run:**

- **`sql/step-bh3`** — items 4 and 5: the front-door set moves to the MASTER
  leaf of a pair, and the second leaf is fitted (2 h).
- **`sql/step-bh4`** — item 6: template 40 re-issued with the side light's mid
  rail 16 mm up, top edges level.

**No template needed re-issuing for item 1.** Template 38's tree was right;
the bug was in the code that creates a drawing from a template, so the fix
reaches every drawing made from now on — and `sql/step-bh2` does not need to
run again.

Offline suite: **1,902 passing, 8 failing** — the standing eight (six Step W
sash-weight rows, benchmarks A50 and D). 67 new tests since Step BH.
`npm run e2e`: at the end.

---

# 1. Why template 38 priced £1,832.54 wrong

**The cause is one function, and it is not in the pricing engine or in the
template.**

A SHORT divider names the dividers it starts and ends at, by KEY
(Integrate's `startDivider` / `endDivider`, Step AV's model). Template 38 has
one: a transom that stops at the two mullions, which is what leaves the side
lights full height and puts the fanlight over the door alone.

`regenerateKeys` — which `prepareTemplateTree` runs when a drawing is created
from a template — gave every node a fresh UUID **and left those two references
pointing at keys that no longer existed.**

`dividerRefIndex` then resolved neither, so the transom was read as running
frame to frame: a **3 × 2 grid of six cells** for a frame with **four
openings**. Everything downstream read the wrong cells, in exactly the way the
reviewer saw:

| | with the references lost | right |
|---|---|---|
| the labels | "Fanlight A1" and "Fanlight C1" for the side lights, "Single Door A2" for the door | Side light A1, Fanlight B1, Side light C1, Single Door B2 |
| the drawing | the door's cell blank, one side light short | the door in its own column, the fanlight over it |
| the side lights | charged as **Fanlights in Doorsets** 300 × 2 | **Sidelights in Doorsets** 780 × 2 |
| the door leaf | squeezed into the 365 mm side-light cell, so its 120 muntin left panels of **negative** area (−0.164, −0.349, −0.349, −0.255 m² = **−£211**) | 892 × 2068, four cells of 276 mm |
| the timber | 63x200 3,228 · 63x63 2,418 · 63x120 6,261 | 4,298 · 10,922 · 6,796 |
| production / fitting | 72 h / 25.42 h | 88 h / 26.92 h |
| the price | **£7,095.53** | **£8,936.47** |

## Why the offline test missed it

It priced **the tree the builder returns**. The live site prices **the tree
`prepareTemplateTree` returns** — the same tree with every key replaced. One
function stood between the two, and no test crossed it.

So `doorsetTemplates.test.js` now builds every tree and then puts it through
`prepareTemplateTree` (`asDrawing`), which is the exact code the board and the
live pricing use. All 25 of its tests run on the tree a surveyor gets. Had
that been true a day ago, the figure would have failed offline.

## What was changed

| | |
|---|---|
| `regenerateKeys` | builds an old → new key map while it walks, then re-points `startDivider` / `endDivider` through it (`remapDividerRefs`). A reference to something NOT in the map — `'0'`, the frame — is left exactly as it is. |
| `cloneWithNewKeys` | the same, for a copied subtree: a reference inside the copy follows it, one pointing outside is left for the caller rather than quietly aimed somewhere new. |
| `templateKeys.test.js` | seven tests, including that every one of the five Step BH templates has the same cells before and after creation, and that no leaf cell comes out non-positive. |

---

# 2. Nothing may price at a negative area

The layout bug is fixed, but a drawing that takes **money off** is a failure
mode worth closing on its own.

- **The engine refuses it.** Every panel and glass unit now reports the size it
  was worked out to be (`_size`), and the loop driver skips any part whose
  width or height is ≤ 0 — with a WARNING naming the part, never a silent
  drop: *"Panel Single Door A2 has no usable size (−45.5 x 983 mm) and cannot
  be priced — check the layout."*
- **The board shows it as an ERROR**, naming the part and selectable from the
  validation panel. It is **built in**, not a row in `validation_rules`: a part
  that cannot be made is not a business rule anybody should be able to switch
  off, and it must fire on every profile whatever its rules say.
- One definition: the guard asks for the same `_size` the price lines would
  have used, so the two can never disagree about what a part measures.

**One real exception, and it is worth reading.** A VISION PANEL's size is
STORED (Integrate's 200 × 350 — a hole cut in a panel), not worked out from a
cell, so the engine's sightline for it comes out **0** and its glass prices at
the 0.30 m² minimum, £17.55 — which is Integrate's own figure on ST2. The
guard therefore measures a vision panel by its stored size and leaves the
pricing exactly as it was. That ST2's glass prices off a sightline of zero is
a separate question for whoever reads it next; nothing here changed it.

---

# 3. A French leaf is drawn with its own grid

Drawing 54's tree and price were right and the board drew each leaf as one
pane of glass. The pair branch drew a leaf as a casement sash and never asked
whether it had a grid — the same thing Step BE fixed for a side light and Step
BF for a stable half, and `gridRectsFor` is the same gate.

Each leaf now draws its cells: a mid rail with a flat panel above and below
(the pair of front doors), or glass over a panel (FD4 / "French Doors With
Panels", checked), each cell selectable and the panels with their own stroke.
MASTER is still marked.

**In proportion**, which is the one thing worth knowing: the drawn leaf of a
pair is half the opening less the gap, while the REAL leaf is wider by the
27 mm meeting-stile overlap. The cells are laid out inside the leaf **as
drawn**, so a cell can never stick out of the leaf it belongs to — a test
asserts exactly that.

---

# 4 and 5. `sql/step-bh3` — the pair's lock, and its second leaf

## Item 4: the set was on the slave leaf

The five front-door rules each carry `not is_master_leaf_in_french_pair`:

    b5c2d45a  Front Door Open In Left Hand Hung    av3_heritage_locking_system_lh
    501f9ca5  Front Door Open In Right Hand Hung   av3_heritage_locking_system_rh
    e938fc5a  Front Door Open Out Left Hand Hung   av3_heritage_locking_system_rh
    d23e8262  Front Door Open Out Right Hand Hung  av3_heritage_locking_system_lh
    cb8eb0b9  Front Door Euro Cylinder Pull        euro_cylinder_pull

On a SINGLE front door the clause does nothing — one leaf is neither master
nor slave. On a PAIR it excludes the one leaf that should carry the set, so
the lock, the cylinder, the keeps and the pull all land on the **slave** (the
left leaf, hence the LEFT-hand system the reviewer saw). `sql/step-bh3` makes
it `not is_slave_leaf_in_french_pair`.

After it, the pair's set comes **RIGHT hand** (the master is the right leaf),
and the two hands cost £167.53 each — **no price move**, which the test
asserts. A single front door is untouched: FT1–FT4 do not budge.

## Item 5: Nathan fits the second leaf in 2 hours

| | minutes | hours |
|---|---|---|
| Front Door and Frame (Base) | 840 | 14.00 |
| **Front Door Pair Additional Door** (new) | 120 | 2.00 |
| | **960** | **16.00** |

`quantity: new_french_door_pair_qty`, `value: 120` — the same shape as the
three "Front Door and Frame" rules, on the live price file. A single front
door, a French pair and a stable door are each asserted not to move.

**+£80.42 cost / +£160.84 price**, so the Pair Of Front Doors goes from
£6,642.89 to **£6,803.73**. Recorded as **difference 22** in
`docs/integrate-differences.md`: a decision, not a disagreement, because
Integrate has no pair of front doors to disagree with.

---

# 6. `sql/step-bh4` — the side light's mid rail, top edges level

Nathan, 15 Oct: the **top** of the side light's 170 mid rail lines up with the
**top** of the stable door's meeting rail (the top half's 99 bottom rail).
Step BH aligned the two bands' CENTRES — the door's join is 99 + 3 + 99 = 201
deep against the side light's 170, so they cannot align on both edges — and
said so. This is the decision, and the rail moves **16 mm up**:

| | offset (the glass above) | the panel below |
|---|---|---|
| Step BH, centres | 911 | 786 |
| **now, top edges** | **895** | **802** |

    the meeting rail's top = 4 (container clearance) + 1055 (the stored split) − 99 = 960
    the mid rail's top     = 3 (sash clearance) + 62 (sash head) + offset
                     → offset = 895, of the sash's 1867 interior

**What it is worth:** the side light's Tricoya panel goes 0.18471 m² (£34.88)
→ **0.18847 (£35.59)**, and the glass above it stays at the 0.30 m² minimum
(£17.55). Drawing 58 reads £6,785.57 today and **£6,787.00** after the file —
**+£1.43**.

A drawing already made from template 40 is not touched. Either re-make it, or
type 895 into the side light's mid-rail Offset — both give the same tree.

---

# 7. The offline figures now use the live catalogue

Three named entries in `liveRuleFixes.js`, so a refreshed snapshot turns each
into a no-op instead of a mystery:

| | |
|---|---|
| `withFrontDoorEuroPull` | `sql/step-bd4`, already live: rule `cb8eb0b9` gives `euro_cylinder_pull` (Croft **CRO1774PB**, 28.35 → £29.40) where the capture gives the Hardwick set (23.92 → £25.20). **+£4.20 cost / +£8.40 price** — which is exactly the +8.40 the reviewer measured on drawings 54 and 55. |
| `withFrontDoorPairLock` | `sql/step-bh1`, which ran on 15 Oct. The test now asserts the clause is THERE and that removing it would cost £53.55. |
| `withStepBh3` | items 4 and 5 above, for pricing what the file will do. |

The `_lh` / `_rh` part swap (RHZ2481 / RHZ3091 against RHZ2482 / RHZ3092) costs
nothing either way — both sets are £167.53 — so it needed no entry; the
reviewer's refreshed snapshot will carry it.

---

# The five templates, priced on the live rules

Every figure below is the tree **as a surveyor gets it** (through
`prepareTemplateTree`), on the live rule set.

| | live today | after `sql/step-bh3` / `bh4` | reviewer's live reading |
|---|---|---|---|
| **240** Pair Of Front Doors | 3,321.45 / **6,642.89** | 3,401.87 / **6,803.73** | 6,642.89 ✓ |
| **250** With Side Lights And Fanlight | 4,586.98 / **9,173.93** | unchanged | 9,173.93 ✓ |
| **260** … Fanlight Over Door | 4,468.25 / **8,936.47** | unchanged | 7,095.53 → fixed |
| **330** Stable Door With Fanlight | 2,955.58 / **5,911.17** | unchanged | 5,911.17 ✓ |
| **340** Stable Door With Side Light | 3,393.50 / **6,787.00** | — (6,785.57 before bh4) | 6,785.57 ✓ |

Fitting and production, in minutes: 240 **840 → 960** / 3,765 · 250 1,755 /
5,320 · 260 1,615 / 5,280 · 330 1,015 / 3,765 · 340 1,020 / 4,590. Every fired
rule with its quantity is in `docs/reports/step-bh.md`; the only ones that
change here are 240's fitting (+120) and 340's panel (+16 mm).

---

# 8. The smoke suite pins them

`e2e/smoke.spec.js` now checks the five drawings' prices on the L507712 quote
matrix by drawing id (54–58). Two of them have **two allowed figures** until
the SQL runs — 54 (6,642.89 or 6,803.73) and 58 (6,785.57 or 6,787.00) — which
is the same treatment Step BC gave a decided difference whose rule had not
been run yet.

Drawing 56 is the one worth having pinned: £8,936.47 is the figure with its
cells right, and £7,095.53 is what a lost divider reference looks like.

---

# What a reader should be wary of

- **The key-reference bug reaches every template with a short divider**, not
  just number 38. There is only one today, but the fix is in
  `regenerateKeys`, so anything made from now on is safe — including a
  template a surveyor saves from a drawing they have split by hand.
- **Drawings 54–58 already exist** and carry the trees they were created with.
  54's price moves when `sql/step-bh3` runs; 58 moves when `bh4` runs, or if it
  is re-made.
- **Drawing 56 has to be re-made from the template.** Its stored tree still
  holds the two unresolvable references, and nothing should silently guess
  where a lost divider stopped — so re-pricing it as it stands now gives a
  THIRD figure: **£7,517.43**, because the four negative panels no longer come
  off (item 2) while the cells are still wrong. The board names all four:
  *Panel Fanlight A1 > Panel has no usable size (235 x −1485 mm)*, and the same
  for Fanlight C1 and the door's two. Re-made, it reads £8,936.47. All three
  figures are allowed in the smoke suite, each with its reason.
- **The degenerate-size guard is a backstop, not a cure.** It stops a broken
  layout taking money off a quote; it does not make the layout right. The
  warning and the validation error both say "check the layout" for that
  reason.
- ~~**The AV3 / AV4 question is still open**~~ **CLOSED 15 Oct** (Step BH
  follow-up 2 item 3): there was no question. `av3_heritage_locking_system_lh`
  / `_rh` is a legacy SHORT NAME; the products are "AV4 Heritage Locking System
  LH / RH" and hold the AV4 parts (RHZ2481 / RHZ3091 left hand, RHZ2482 /
  RHZ3092 right, RHZ2427 and LJZ5074040CP in both). A front door gets the AV4
  set, whatever the id reads. The hand was the real point, and `sql/step-bh3`
  settled it.
- **A pair of front doors' fitting is now a GlazePro decision** (difference
  22), the first door-fitting figure that does not come from Integrate.
- **The side light's rail is Nathan's top-edge rule**, and the two rail bands
  are still different depths — 201 against 170 — so the bottom edges do not
  meet. That is what "level" means here, and it is written down in
  `stableSideLightMidRailOffset`.
- `public/version.json` is left uncommitted, as CLAUDE.md says.

---

# e2e after the deploy

Deploy confirmed by decoding `/version.json`: **07:55:40Z**, just after the
commit.

`npm run e2e` — **5 passed** (5.2m): logs in; every benchmark passes except the
parked residuals; the fanlight drawing; the validation panel; every drawing
card on the L507712 matrix priced, including the five doorsets at the figures
pinned for them.

**Two things the run confirms, and one it cannot.** The 61 benchmark rows are
where Step BH left them — so the key fix, the degenerate-size guard, the
French-leaf drawing and the live-catalogue entries moved no priced figure — and
the five doorset cards read what they were checked at. What it cannot confirm
is a RE-PRICE: the matrix shows each drawing's last priced figure, so drawing
56 still reads the reviewer's £7,095.53 until somebody prices it again
(£7,517.43 as it stands, £8,936.47 re-made).
