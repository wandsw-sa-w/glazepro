# Step BC — single doors with FLAG frames: more than one frame in a drawing

Done 13 Oct 2026. Brief: `docs/step-bc-coupled-flag-frames-brief.md`.
Facts: `docs/integrate-L31115-single-doors.txt` — "Coupled multi-frame doorsets"
(CD1–CD4, drawings 12–15) and "Nathan's decisions (13 Oct)" a–d.

**No new pricing RULE was added.** One live rule is **rewritten** —
`sql/step-bc1`, Nathan's decision c — and no other rule, profile value or
benchmark target was changed. **No pricing engine version bump** (still 16).

**I ran no SQL.** `sql/step-bc1` and `sql/step-bc2` are files for the reviewer,
each with a SECTION 0 of read-only checks and a `DO NOT RUN` rollback.

**No existing benchmark moved** — the thing that mattered most in a structural
step.

Commits: `08593d3` item 0, `09e02a5` the work, and this report.

---

## 0. The facts, the targets and the bb2 fix

**Files:** `docs/integrate-L31115-single-doors.txt`,
`src/pricing/benchmarks/integrate-targets.json`,
`docs/step-bc-coupled-flag-frames-brief.md`,
`sql/step-bb2-single-door-templates.sql` — all committed **as they are**
(`08593d3`) before any work on them. The reviewer's bb2 fix (a single door's
Product is "Door", not "French Door", and both `window_type` and `product` now
follow the tree) is live that way.

With it, the one change item 0 asked of me: `doorTree` takes a product instead
of hard-coding `french_door`, and the SD1–SD4 fixtures carry `product: 'door'`.
Cosmetic — no rule reads product — and the Step BB benchmarks are unmoved.

## 1. The model, and how "the frame" questions became multi-frame

**Files:** `src/pricing/casementGeometry.js`, `src/pricing/doorGeometry.js`,
`src/drawingBoard/casementOpenings.js`, `src/drawingBoard/containment.js`.

Integrate stores a door with flag lights as **one item holding a
`containerPart`** ("Frames", bayTypeId 176, `partSpacing -47`) with separate
`assemblyFrameParts` side by side, left to right. `partSpacing -47` is the
coupling: each frame starts one jamb (47 mm) **before** the previous one ends,
so CD1's 693 + 995 + 693 set is **2,287 mm** wide, not 2,381. The frames are
**head-aligned** — a flag light is a high side window over a wall, not
floor-standing — and every frame is a whole frame, with its own jambs, head,
cill, dividers and openings.

### The seam

About forty places asked `findFirst(tree, 'assemblyFramePart')` — *"the"* frame
— which on a container answers for the **first** frame whatever is being asked
about. Rather than hunt forty call sites, the pure geometry helpers took an
**optional frame**:

```
itemFrames(tree)            every frame, in order
isMultiFrame(tree)          is this a container drawing?
frameOwning(tree, node)     the frame that OWNS a node
theFrame(tree, frameOrNode) what a helper should answer for — or, asked
                            nothing, the FIRST frame
```

- `frameInterior`, `frameColumns`, `frameRows`, `frameCells`, `frameOpenings`,
  `openingNodes`, `columnCount`, `rowCount`, `isShortDivider`,
  `shortDividerSpanMm` all take it.
- The **node-based** helpers resolve the frame that owns the node they are asked
  about: `openingFor`, `casementSashSize`, `casementGlassSightline`,
  `directGlazedVisibleSize`, `doorLeafSize` (through `doorGeometry`'s own
  `openingFor`), `openingTypeLabel`, `openingMatrixIndex`, `openingLabel`.

**A one-frame drawing resolves to the only frame**, so every existing caller and
every existing benchmark is unchanged *by construction* — which is why the suite
could prove it rather than hope.

Two bugs fell out of the same read:

- **`frameInterior` used the first `cillPart` in the tree**, so every frame of a
  container took the **door frame's** cill and a flag frame's interior height
  came from the wrong part. It now reads the frame's own cill.
- **`isDirectGlazedUnit`** only looked in the first frame's children, so a
  direct glazed unit in any other frame was not one.

Left single-frame deliberately: `casementFrameTimberVolumeDm3`,
`casementCillVolumeDm3` and `frameMuntinLengthM`. They price **casement window**
timber, a door has none (every such rule is gated on `not is_door`), and no
casement window is multi-frame — so threading them would have been change
without a caller.

### Containment

`drawingItemPart -> containerPart` and `containerPart -> assemblyFramePart` were
missing from the **local** map (the brief says both are live; `sql/step-bc2`
SECTION 0c reads them back and section 1 adds them belt-and-braces).

## 2. Pricing: what each frame sees

**Files:** `src/pricing/pricingEngine.js`, `src/pricing/partAllocator.js`.

**This was the step's real risk.** A frame-**loop** rule asks about the frame it
is visiting; the counts came from the **item**, so on a container every frame
answered with the whole item's figures. A frame loop now gets that frame's own
`door_leaf_qty`, `new_door_leaf_qty`, `casement_sash_qty`,
`new_casement_sash_qty`, `fixed_casement_sash_qty`, `frame_mullion_qty`,
`frame_transom_qty`, `full_length_frame_mullion_qty` and `panel_in_frame_qty`.

What that fixes, and what it makes possible:

| Rule | Before | Now |
|---|---|---|
| Machining & Joining a **Door** Frame 855 | all three of CD1's frames | the **door** frame, once |
| Machining & Joining a **Casement** Frame 180 | never (door_leaf_qty was the item's 1) | each **flag** frame — **decision d** |
| Additional for Frame Mullion or Transom 180 | CD4: three transoms × three frames | each frame's own — 3 × 180 |
| LTW General Consumables 25 | once | **once per frame** (CD1: 75) |

**LTW is the proof the scoping is right**: its condition is per frame (*a sash or
a leaf in this frame*) and Integrate charges it once per frame — 25 × 3 on CD1,
which is in the facts.

**Item-KIND variables stay item-level**, so a flag frame of a DOOR item is not
charged as a casement window: `Casement Frame Jambs & Cills` and
`Casement Frame Head` (gated on `not is_door`) stay silent, exactly as they do
in Integrate, and `Sidelights` / `Fanlights in Doorsets` still fire on the
flags' sashes. Item-level counts are the whole item: `frame_qty` = 3 on CD1, so
`Door Frame - Single Finish` is 180 × 3 = 540, and `door_leaf_qty` = 1, so
`Single Door Only` is 660.

**`is_fanlight` is per sash within its own frame.** CD4's flag top lights are
fanlights **of their flag frame** (300 each) and the fixed lights below them side
lights (780 each): 900 + 1,560, exactly as the facts reconcile. That is what the
frame-scoped `openingTypeLabel` buys.

**Hours round to 2 dp before the rate**, as the brief asked me to check:
CD2's 3,220 min reads 53.67 h and prices 1,323.50, not 1,323.42.

## 3. Sections and the architrave

**Sections per frame (decision a).** `allocatedSectionParts` loops every frame:
each frame's `W + 2H` at Utile67x96, each frame's own width at Utile63x200, and
each frame's own transoms and mullions (differences 7b and 11). CD1's 67x96 is
`(693 + 2×1137) + (995 + 2×2101) + (693 + 2×1136) = 11,129 mm` against
Integrate's 6,583, and three cills against one. CD4's comes to **16,002 mm** —
the facts' own figure, transoms included.

**Architrave once round the whole set (decision b)** — and this one goes the
*other* way: per frame it would be three sets on CD1 (£34.49), round the set it
is one (£19.38), which is what a fitter actually puts up. The two live
architrave rules are on the **frame loop**, so rather than touch live rules the
allocator gives them **one pseudo-frame standing for the set**: its width is the
set's own (the frames' widths less one jamb per joint, from the container's
`partSpacing`), its height the **door** frame's — a flag light's jambs are not
architraved to the floor. CD1: head 2,387 → 2.4 m, jambs 2,201 → 2.2 m × 2, at
£2.85/m.

## 4. The money

Integrate's figures, and GlazePro's:

| | Integrate | timber+cill (a) | architrave (b) | workshop (d) | GlazePro today | fitting (c), pending | after bc1 |
|---|---|---|---|---|---|---|---|
| CD1 | 3,024.06 | +102.01 | +19.38 | +147.96 | **3,293.41** | +321.68 | 3,615.09 |
| CD2 | 2,421.57 | +51.00 | +17.67 | +73.98 | **2,564.22** | +160.84 | 2,725.06 |
| CD3 | 2,421.95 | +51.08 | +17.67 | +73.98 | **2,564.68** | +160.84 | 2,725.52 |
| CD4 | 4,209.35 | +155.04 | +21.66 | +147.96 | **4,534.01** | +321.68 | 4,855.69 |

**Every line of that split is the facts' own table**, and **glass and labour are
Integrate's exactly** on all four. Production is Integrate's + decision d
(77.00 / 56.67 / 56.67 / 109.25 h against 71.00 / 53.67 / 53.67 / 103.25).
Nothing else moved — the brief's "if anything else moves, stop and report" did
not trigger.

### Decision c is PENDING, and declared as such

`sql/step-bc1` rewrites live rule **140** from a 1-minute placeholder to
`new_frame_qty - 1` × 240 min. Until the reviewer runs it **and a fresh snapshot
is captured**, the engine charges nothing for it. Rather than pick one figure:

- the fixtures declare `deliberateDifference` (a + b + d, charged today) **and**
  `pendingDecision` (c, with the SQL that brings it);
- the benchmark page accepts **either** and says which — the row reads
  *"BY DESIGN — £269.35 dearer: … STILL TO COME: £321.68 — decision c, +4 h
  fitting on two flag frames (240 min a frame) — sql/step-bc1 rewrites rule
  140"*, and once the rule lands it reads *"(includes £321.68: …)"*;
- the live smoke test pins **both** acceptable amounts per row.

Pinning one alone would mean a red row today or a silent one after the SQL.

### CD4's Kenrick parts: no snapshot refresh needed after all

The brief asked me to refresh `pf30-snapshot.json` rather than tune, because my
Step BB report said four Kenrick gearbox parts carry `unit_cost 0` in it. CD4 is
the first benchmark to use the Kenrick **variant** parts, and its ironmongery
comes out at Integrate's own **152.25** from the captured snapshot — so those
four zero-cost parts are not the ones CD4 needs, and nothing had to be
refreshed. Asserted in a test so it stays true.

## 5. The board

- **A coupled set draws frame by frame**, side by side and head-aligned, each by
  the code that already draws one (`CasementElevation` on a tree with the
  container replaced by that frame), widths sharing the row in proportion to the
  real frames. The **column letters run on across the set**, through a new
  `columnOffset`, so CD1 reads A1 | B1 | C1 and CD4 A1 / A2 | B1 / B2 | C1 / C2 —
  Integrate's own labelling.
- **`addFlagFrame(tree, frameKey, side)`** adds a flag to the left or right of a
  frame. A **one-frame drawing becomes a container drawing** only when it gains
  a flag; nothing is migrated.
- **`removeFrame`** refuses the door's frame and the last frame, and
  **unwraps the container** on the way back down to one, so a drawing never ends
  up carrying a container with a single frame in it.
- **`buildFlagFrame`** — 693 × 1136, one FIXED light (54, 62/62/62, bottom 86),
  utile, its own cill.
- Validation and required fields work per frame: every board-path test runs
  through `assertSaveable` and `findRequiredEmpty`.

## 6. The templates (SQL — the reviewer runs them)

| | Integrate | Frames | sort |
|---|---|---|---|
| Single Door With Flag Lights | 70 | 693×1136 \| 995×2101 \| 693×1136 | 100 |
| Single Door With Flag Light Right | 71 | 998×2101 \| 693×1136 | 110 |
| Single Door With Flag Light Left | 72 | 693×1136 \| 998×2101 | 120 |
| Single Door With Flag And Fan Lights | 69 | 650×1632 \| 1082×2496 \| 650×1632 | 130 |

**Which I chose, as the brief asked:** template 72's door frame is **998** wide,
the same as 71's, so the left-flag and right-flag templates are **mirror
images**. Integrate's own 72 is 1001 / 696 against 71's 998 / 693 — three
millimetres nobody drew on purpose.

Also chosen: a flag's own light keeps Integrate's **86** bottom rail, template
69's **fanlights** take Nathan's **62** (difference 5, so their rails move to
Utile63x63 — difference 7b); 69's flag fanlights are **top hung** (Integrate
operation 15) over a fixed light and the door frame's fanlight is **fixed** over
the leaf, which is what makes the flags' top lights 90 install minutes each and
the door's 120; and a door leaf is never arched (Step BB).

## 7. The default ironmongery on a GlazePro-built CD4

Reported for the reviewer to check against Integrate's casement rules. The live
default rules give it:

```
102mm_hinges PB x2                      double_euro_cylinder PB x1
hardwick_lyndon_door_espag_set PB x1    trickle_vent_xr16 Wht x1
connoisseur_handle_lh PB x2             trickle Wht x1
defender_209mm PC x2
kenrick_extension_490mm PC x4
kenrick_extension_gear_box PC x2
```

**The flags' gear is exactly Integrate's stored list** — the handle, the stays,
four extensions and two gearboxes, for the two top-hung fanlights. The only
differences from Integrate's stored list are the two already recorded: the espag
set where its template stored the Windsor handle (difference 9) and the vent
grille (difference 10).

## SQL files this step wrote, in run order

**Neither has been run.** Each leads with a SECTION 0 of read-only queries and
ends with a commented `DO NOT RUN` rollback.

1. `sql/step-bc1-single-door-flag-frame-fitting.sql` — rewrites live rule 140
   (Nathan's decision c). **Run first.** It keeps the rule's **id**, so every
   stored run that referenced it still resolves; the file records the BEFORE
   values in full, refuses to run if the rule is not the one it was written for,
   and the rollback restores it exactly. **After running it, please take a fresh
   PF30 snapshot from the benchmark page and send it over** — the CD benchmarks
   carry decision c as pending until a captured snapshot has the new rule.
2. `sql/step-bc2-flag-frame-templates.sql` — the four templates, plus the two
   container containment pairs belt-and-braces. **Refuses to run** if a container
   cannot hold a frame, if a frame cannot hold a door leaf (step-bb1), or if the
   Utile sections are missing.

## What the tests show

**Offline: 1,654 passing, 8 failing — the standing eight, unchanged.**
`npx vitest run`, 72 files, **27 new tests**. No benchmark moved: every FD, SD
and earlier benchmark is exactly where it was, which for a change that touched
the frame lookups is the whole point. The eight are the familiar six
`sashWeight.test.js` Step W rows and the two parked residuals (**A50** +£0.28,
**D** +£0.54). `e2e/smoke.spec.js` is still reported as a failed *file* by
vitest, which collects it and cannot run it (pre-existing since Step AT).

The new tests: **18** in `benchmarks.test.js` (the groups and hours for all four,
the decided split line by line against the facts' table, the pending decision,
what each frame sees, CD4's per-frame transoms and fanlights, a flag frame not
being a casement window, item-level counts, every frame's own geometry, the
labels running on, the sections and the one architrave, and CD4's Kenrick
parts) and **9** in `frenchDoor.test.js` (each template from the board through
`assertSaveable` and `findRequiredEmpty`, the mirror-image pair, add left /
right, remove with the container unwrapping, the new flag frame's own values,
the board's trees priced against the fixtures, and the default-ironmongery
report).

**Live: 5 of 5 passed (32.5s)**, against the deploy of `09e02a5` —
`/version.json` reads `mv73ehro`, built 2026-10-13 20:47:20 BST:

```
ok 1 logs in (5.4s)
ok 2 every benchmark passes except the parked residuals (11.3s)
ok 3 the fanlight drawing shows Fanlight A1 and Casement Sash A2 (3.4s)
ok 4 the validation panel loads without an error (3.0s)
ok 5 every drawing card on the L507712 quote matrix shows a price (8.5s)
```

Test 2 asserts all **sixteen** door benchmarks are on the page and pins CD1–CD4
at both acceptable figures.

## Not verified against the live database

- **Neither SQL file has been run.** The four templates exist only as files, and
  **decision c charges nothing live until step-bc1 runs**. A multi-frame drawing
  can be built and priced on the live site now (the containment it needs is
  already there, per the brief) — but a *template* for one is not there yet.
- **The live `part_type_children` rows for the container were not read.** The
  brief says both pairs are live; SECTION 0c of bc2 asks for them, and the
  insert is `ON CONFLICT DO NOTHING` so it is safe either way.
- **Rule 140's live values were not read.** SECTION 0a of bc1 reads them and the
  DO block refuses unless the row is the install_labour rule at sort 140, so a
  rule somebody has edited since cannot be overwritten silently.
- **All offline figures come from `pf30-snapshot.json`**, a captured file —
  including the finding that CD4's Kenrick parts are costed in it.
- **No live coupled drawing has been priced**, because there is no GlazePro
  drawing for one yet. The benchmark page is the comparison; the reviewer's
  CD1–CD4 are Integrate's.
- **The multi-frame board has not been used on the live site.** The elevation,
  add, remove and save paths are covered by the board-path tests, not by a
  surveyor's click.

## Anything that did not behave as the brief describes

- **The snapshot did not need refreshing** (item 4). CD4's Kenrick variant parts
  price to Integrate's own 152.25 from the captured file; the four zero-cost
  gearbox parts my Step BB report flagged are not the ones CD4 uses.
- **Template 72's width is a choice** (item 6). I used 998 / 693, mirroring 71,
  rather than Integrate's 1001 / 696.
- **The architrave rules are on the frame loop**, so decision b could not be done
  by scoping alone — it needed a pseudo-frame for the set. That is the one place
  in this step where the engine is told something the tree does not say directly,
  and it is commented as such.
- **Pre-existing eslint errors** were left alone and verified unchanged in count
  (`casementOpenings.js` `num`, `defaultIronmongery.js` `weightKnown`,
  `renderElevation.jsx` four, `e2e/smoke.spec.js` two `process`,
  `DrawingBoard.jsx` sixteen lines' worth, `benchmarks.test.js` two `target`).
- `public/version.json` is left uncommitted on purpose, as CLAUDE.md says.
