# Step AV — two-column fanlight casements (a divider that stops at another divider)

Written by the reviewer. All handover rules apply. Never run SQL — write files in sql/ for Nathan with a "DO NOT RUN"
rollback section. Report to docs/reports/step-av.md in the handover format.
Facts: docs/integrate-L31115-two-column-fanlights.txt — read ALL of it (trees, every line, the reconciliations).
integrate-targets.json: the reviewer has added benchmarkTC1_wide_fanlight_over_double, benchmarkTC2_fanlight_over_each and
benchmarkTC3_fanlight_over_one_side — commit them as recorded facts. Also commit, attributed to the reviewer, the
uncommitted edit to sql/step-au1-stormproof.sql (the default_field_definitions row; Nathan ran it on 13 Oct).

Nathan (13 Oct): all three layouts are sold, more often than French casements:
- TC1 one wide fanlight over a double (Integrate template 7 "Double Casement With Fanlight");
- TC2 a fanlight over each of two casements (template 12 "Configuration 1");
- TC3 a full-height opener beside a casement with a fanlight over it (template 13 "Configuration 2", and its mirror 14
  "Configuration 3").

## The headline
Everything except the frame's divider geometry already reconciles with the existing casement rules (labour, production,
sash timber, glass, cill, surrounds — see the facts file). What is new is that a mullion or transom can STOP AT ANOTHER
DIVIDER, so an opening can span two columns (TC1's fanlight) or two rows (TC3's opener). TC2 (both dividers full) should
need no new model at all — prove that first.

## 1. Engine: spanning openings and short dividers
- Model a divider's extent the way Integrate does: each mullionPart / transomPart may name the divider it starts at and
  ends at (Integrate's startDivider / endDivider; '0' = the frame). Store a stable reference, not an array index.
- The opening grid becomes rows x columns with MERGED cells: TC1's top row is one opening A1 across both columns; TC3's
  left column is one opening A1 down both rows. Matrix labels as Integrate: a spanning opening takes its top-left slot;
  list order A1, B1, A2, B2 skipping the empty slot (TC1: A1, A2, B2; TC3: A1, B1, B2).
- Opening sizes: a spanning opening's span includes the divider it crosses (TC1 fanlight 493 + 27 + 511 = 1031 wide).
- Frame timber (casementFrameTimberVolumeDm3): a divider that runs frame to frame stays internal dimension + 20; a
  divider that stops at another divider is ITS OPENING SPAN + an allowance, which the readings fix as +2 for a short
  mullion (TC1: 983 -> 985, exact) and +3 or +4 for a short transom (TC3: 561 -> 564/565). One reading each and no single
  constant fits both, so implement them as two named constants with that comment, and list them as unverified.
- Production rule 1105 / finish rule 211 count every divider, short or full (TC1 and TC3 = 2) — check
  frame_mullion_qty / frame_transom_qty already do.
- Labour: every TC drawing carries rule 251 "Windowboard" (30 min, has_deep_window_board), fired by the template's
  "Nosing in Solid Redwood" surround. GlazePro does not compute has_deep_window_board (only the snapshot names it).
  Integrate's definition: "item has at least one component where this is true; a deep window board is a window board but
  not bullnose". Implement it from the surround components and report how L34046 (also has a nosing, TP61) reached its
  exact labour without it.

## 2. Fixtures TC1, TC2, TC3 (fixtureCasement.js)
Trees from the facts file with the STORED ironmongery lists and surround lists exactly as recorded. Every price-file line
must match (glass x 3/4, energy, ironmongery, components incl. the nosing, consumables, production, labour, the three
timber lines, LTW). Tests; live benchmark page. TC2 first and before any engine change: if it is not exact on the existing
code, stop and report.

## 3. Board
- Templates (SQL), built by buildCasementFrame like the others, copying Integrate's templates exactly (sizes, offsets,
  operations, the template surround lists incl. the nosing; no stored ironmongery): "Double Casement with Fanlight" (7),
  "Configuration 1" (12), "Configuration 2" (13), "Configuration 3" (14 — mirror of 13: fanlight column on the LEFT).
  Use names Nathan will recognise; say what you chose.
- Transom / Mullion picker: add "across the whole frame" (today's behaviour) and "in one column / one row only" — a
  transom in ONE column (TC3) or a mullion in ONE row (TC1). Removing a divider merges the openings it separated.
- Resize: height changes go to the bottom row, width changes re-space columns proportionally (Step AR), with spanning
  openings following the cells they span.
- Parts list and drawing: the spanning openings drawn across; matrix labels as above; selection highlight as now.

## 4. Small items carried from Step AU
- Benchmark page: a target with only total_price (SB, SD, SE) passes on price — no "cost diff NaN".
- Leave is_replacement_sashes_range wiring for a later step.

## 5. Tests
Board-path tests for TC1, TC2, TC3 through the real board code (template -> resize -> picker -> operation buttons), through
assertSaveable and required fields, equal to the fixtures with the stored ironmongery; then without a stored list, report
the default lines. Re-run every benchmark — none may move.

List only the SQL files this step wrote, in run order.
