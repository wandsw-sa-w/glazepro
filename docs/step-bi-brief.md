# Step BI — casement combinations, Configurations 4-7 (reviewer, 15 Oct 2026)

Facts: docs/integrate-L31115-configurations-4-7.txt (all of it). Targets: benchmarkTC4 / TC5 / TC6 / TC7 in
integrate-targets.json (added by the reviewer — insertions only). Commit those two files and this brief as item 0.

## Nathan (15 Oct)
All four are sold:
- C4 opener | fixed | opener (1299 x 1307)
- C5 opener | fixed | fixed | opener (1699 x 1307)
- C6 a full-height opener each side, a top-hung fanlight over a fixed sash in the middle (1499 x 1199)
- C7 three columns with a light over each: top-hung | fixed | top-hung over LH | fixed | RH (1499 x 1199)

## The work
1. Benchmarks TC4-TC7 from Integrate's trees as read (stored ironmongery, stored surround incl. the nosing, 83 rails on the
   fanlights, all as Integrate's templates). Expect each to match Integrate exactly, group by group, except what is
   already declared for combination casements (if anything applies, name it). Production and fitting are in the facts
   rule by rule — reconcile against them.
2. **"1500 Wide Casement Frame" (fitting rule 110, overall_frame_width >= 1.5) fires in Integrate on C6 and C7 at 1,499 mm**
   (not on C4 at 1,299). Integrate must round overall_frame_width before the test; GlazePro's is the unrounded metre
   figure, so it would miss 60 min (£40.21 cost) on both. Find the rounding that fits every reading we hold (P 1,599 fires;
   C4 1,299 does not; C6 / C7 1,499 fire; check every casement benchmark, and any other rule that reads
   overall_frame_width or a sibling *_in_m variable), make it match, and list every benchmark that moves (none should
   move except to agree with Integrate).
3. C6's transom is SHORT (startDivider / endDivider = the two mullions). It must survive create → save → reload (the Step
   BH follow-up 2 round trip): put the C6 template through that path in its test.
4. Templates, group "Combination Flush Casements", after the Configuration 1-3 ones (sql/step-bi*.sql, guarded,
   UPDATE-if-exists, SECTION 0 reads; the reviewer runs them). Names in the Step AV style, e.g.
   "Opener, Fixed, Opener (Configuration 4)", "Opener, Two Fixed, Opener (Configuration 5)",
   "Openers Either Side Of A Fanlight Over Fixed (Configuration 6)", "Three Casements With A Light Over Each
   (Configuration 7)" — say if better ones fit the existing list. Integrate's sizes and layouts; as for Configurations
   1-3 (Nathan's decisions): fanlight bottom rails 62 (casements 83), NO stored surround (no nosing), no stored
   ironmongery (the default rules give it), Casement MPLS on, Solid Redwood / utile cill.
5. Every existing benchmark unchanged (except any the rounding in item 2 puts right — list them).

## Report
Tests first. docs/reports/step-bi.md: TC4-TC7 group by group against Integrate; the rounding found and everything it
moves; what each template prices offline with its default ironmongery and 62 fanlight rails; the drawings to make live.
