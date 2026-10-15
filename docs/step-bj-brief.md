# Step BJ — bi-glass on casement windows (reviewer, 15 Oct 2026)

Facts: docs/integrate-L31115-casement-biglass.txt (all of it). Targets: benchmarkBG1 / BG2 / BG3 / BG4 in
integrate-targets.json (added by the reviewer — insertions only). Commit those two files and this brief as item 0.

Bi-glass = the customer's casement sashes and frame are KEPT; the existing single glass comes out and a new single pane
goes in (Integrate's "BiGlass" system), the window is draught sealed, and any glazing bars are taken off. GlazePro has
typeOfWork 'bi_glass' and the bi-glass price rules already (all imported from PF30), but no benchmark has ever exercised
them, on any product. This step makes a bi-glass CASEMENT price exactly as Integrate.

## Nathan (15 Oct)
- Surveyors tick Bi-Glass, set the glazing to Single, glass to be replaced. All four layouts are sold: single casement,
  casement with glazing bars, multi-sash (opener | fixed | opener), casement with a fanlight.
- Draught sealing is always part of a bi-glass casement job.
- **Ironmongery: none by default** (the sashes keep theirs). The surveyor may add any that is replaced; stored ironmongery
  is priced as stored. The benchmarks carry the ironmongery their Integrate drawings stored, so they compare like for like.
- **Fixed sash: copy Integrate.** Fitting rule "Fixed Casement Sash with Frame" (60 min per fixed casement sash) must also
  fire on a bi-glass casement, where the frame is kept. Make it targeted:
  `(is_casement_window or is_casement_window_bay) and is_installation_included and (frame_to_be_replaced or is_bi_glass)`
  — not Integrate's unbracketed precedence, which would also reach draught-seal-only and supply-only casements nobody has
  asked about.

## The work
1. **Benchmarks BG1-BG4** from the facts' trees. Expect every group exact. Find what GlazePro gets wrong today — at least
   these need checking, each against the facts:
   a. `to_be_replaced` on a glass unit is `is_complete_new || parent sash toBeReplaced` — false on bi-glass, so
      "BiGlass Labour Base Price" (240 per glass unit) cannot fire. Integrate stores toBeReplaced on the GlassPart; give
      the glass its own flag (or treat a bi-glass glass unit as replaced) without moving any existing benchmark.
   b. `is_single_glazed`, `single_pane_cost` 25.50 for 4mm Clear Toughened (GL100080), rounded_area from the CUT size.
   c. `gb_qty` 3 on BG2 (1 vertical + 2 horizontal bars); no glazing-bar glass lines on single glazing.
   d. `needs_draughtsealing` true and `frame_area` (2.56 / 2.56 / 1.70 / 1.80) for DSO SqM Rate.
   e. `weight_in_kg` > 25 on the BG1 / BG2 sash (Any Sash Overweight, casement loop, fires) and NOT on BG3 / BG4.
   f. No Installation Consumables, no surround components, no Windowboard, no default ironmongery, no production except
      rule 211 (per mullion / transom finish, 60 each — fires on bi-glass in Integrate; keep it).
   g. Rule 15 as above (BG3 +60 min).
2. **Board.** A casement drawing must be switchable to Bi-glass (type of work) and back, as Integrate's item tick:
   sashes kept (not replaced), every sash = its OPENING (no clearance — Integrate's "Include Clearance" off) with the glass
   following, every glass Single 4mm Clear Toughened and to be replaced, draught seal on, stored surround cleared,
   Casement MPLS off, no default ironmongery. Switching back restores a complete-new casement's defaults (clearance 4,
   double glazing, MPLS). Glazing bars stay editable (they are taken off and priced as such). Say what the quote text
   shows for a bi-glass casement (there is Bi-Glass wording / lead time already for sashes — reuse it).
3. **Sliding sashes untouched.** Bi-glass on sliding sashes is a separate future step: nothing in this step may change
   how a sliding sash item prices or draws. Every existing benchmark unchanged — list any that moves and why.
4. No SQL is expected beyond rule 15's condition (sql/step-bj1-*.sql, guarded, SECTION 0 reads, UPDATE by name + current
   condition; the reviewer runs it). If you find another rule must change, put it in the same file and say why.

## Report
Tests first. docs/reports/step-bj.md: BG1-BG4 group by group against Integrate; each fix in 1a-1g; the board behaviour and
how to try it live (which drawing on L507712 to switch); anything Integrate does that we chose not to copy.
