# Step AH findings — the glass gate (engine v10) and board tidy-ups

Against `docs/step-ah-glass-gate-brief.md`; facts from `docs/integrate-L31115-A-top-only.txt`.
All figures from the committed snapshot; nothing read from the live site.

## Item 1 — glass_unit loop gate

`getLoopParts` now filters the `glass_unit` loop: a glassPart under a sliding sash is visited
only when the item is complete new, THAT sash's `toBeReplaced` is true, or the item is
bi-glass. Rule condition text untouched (the snapshot keeps Integrate's own conditions — the
gate is in the loop, where Integrate's is). Applied to all three passes: the labour-loop
check moved NO benchmark line (the glass labour rules gate themselves on `to_be_replaced`),
so it stays uniform per the brief's condition. `PRICING_ENGINE_VERSION` = 10.

### Full line diff — B (corrected)

The only benchmark that changed; it lost exactly the six lines Step AG's faithful glass
added, and nothing else:

| Removed line | Was |
|---|---|
| Square Glass Cost ×2 | 0.4000 × 58.50 = 23.40 → 46.80 each |
| All Glass Energy Surcharge ×2 | 8.0000 × 0.17 = 1.36 → 2.72 each |
| Glazing Bar ×2 | 0.00 (zero lines) |

**B (corrected): 208.33 / 522.65 — exact again.** Every other benchmark byte-identical
(L34046, A, A35/40/50/h1700, C, D, the real L507712 tree). Standing truthful failures back
to 8: A50's top Lead, D's steel, the 6 Step W rows.

### B (uncorrected)

The uncorrected figures (233.79 / 573.55) live in the dedicated uncorrected-rules test (the
snapshot itself holds the S4-corrected rules, so no snapshot run can produce the uncorrected
totals). Its three lines are sliding_sash material rules, untouched by the glass gate — the
test passes unchanged, zero line diff.

### Allocator / ironmongery loops

`partAllocator.js` and `defaultIronmongery.js` keep their own UNGATED `glass_unit` loop
copies, deliberately: the snapshot contains **zero** part-allocation or default-ironmongery
rules with a `glass_unit` loop, so there is nothing to gate; and the A-top-only evidence puts
the bead/bar money in the PRICE pass (Glazing Bead is the sliding-sash material rule with its
own S4 gate; the single Glazing Bar 2.40 line is the replaced top sash's, which the gated
price loop reproduces). If a glass-loop allocator rule ever appears, it should get the same
gate — noted here for the reviewer.

## Item 2 — dropped, per Nathan

A sash replacement always replaces both sashes, so no top-only benchmark was built and no
test added. The two `benchmarkA_topOnly_*` targets stay in integrate-targets.json as recorded
facts. Per-sash gating in item 1 matches Integrate and is identical to item-level gating
whenever both sashes are replaced.

## Item 3 — board fixes

(a) summary Weight sums every sash in every pair; (b) Transom/Mullion stored offsets round
to 0.1 mm (unit-tested: thirds now store 237.3 / 618.7, not 180.666…); (c) template-picker
cards disable with "Creating…" while the drawing is created (double-click duplicated
drawing numbers); (d) the required-fields chips' literal "→" renders as → . The three
behaviours the facts file confirmed in Integrate (§5) were left alone.

## Item 4 — 57 mm

`sql/step-ah1-templates-45mm.sql` is the reviewer's file for Nathan. Nothing in code assumes
57 mm: every code fallback for sash thickness is 45 (`?? 45`), and no module hard-codes 57 —
the 57s live only in the saved template/drawing data that file corrects.

## Not verified

- Anything live; engine v10 is not deployed or verified on glazepro.vercel.app.
- Bi-glass items (gate keeps their glass priced, per the Lead Weight "or is_bi_glass"
  evidence — no benchmark exists), and glass NOT under a sliding sash (direct glazed,
  casements, doors — loop behaviour unchanged, unverified).
- The board fixes (3a–3d) in a browser.
