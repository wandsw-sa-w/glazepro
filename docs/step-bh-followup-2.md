# Step BH follow-up 2 — short dividers are lost on SAVE (reviewer, 15 Oct 2026)

## Item 0 — commit
- The reviewer's edit to sql/step-bh3: the price_rules INSERT had no `output_unit`, which is NOT NULL with no default
  (it would have failed); added 'minutes' (as every other Doors fitting rule) to the column list, the VALUES and the
  ON CONFLICT update. It RAN LIVE 15 Oct in that form (SHA e2881fef…). sql/step-bh4 ran unchanged (6ac311a9…).
- A fresh PF30 snapshot: the reviewer clicked "Download snapshot" on /dev/pricing-benchmark at about 09:55 on 15 Oct,
  after bh3 / bh4 ran — the newest pf30 snapshot file in Downloads. Commit it as the offline snapshot and say what changed
  (expected: the five front-door rules' slave clause, rule cebdd8b5's front-door clause, the new "Front Door Pair
  Additional Door", the Croft pull in place of the Hardwick set); the liveRuleFixes entries it makes no-ops can go.
- Commit this brief.

## What the reviewer checked live (L507712 item 9; Q1 item 9 back on drawing 26)
- bh3 verified: the five rules read "not is_slave_leaf_in_french_pair"; the new rule bb030001 is on the current price file.
- bh4 verified: template 40's mid rail 895.
- New drawing 61 (Pair Of Front Doors): **£6,803.73** = the report. Board draws each leaf's mid rail and two panels.
  Lines: Front Door and Frame (Base) 840 + Front Door Pair Additional Door 120; av3_heritage_locking_system_RH; slave
  bolt / keep / flush bolt; NO Thunderbolt. Item 3, 4, 5 DONE.
- New drawing 62 (Stable Door With Side Light): **£6,787.00** = the report. Item 6 DONE.
- Benchmarks: 61 = 36 PASS, 23 BY DESIGN, A50 / D parked.
- **New drawing 60 (… Fanlight Over Door), made AFTER the deploy: still £7,517.43** — the broken-cell figure with the
  negative panels now refused (the guard works: the board lists "Fanlight A1 > Panel … no usable size (235 x -1485)").

## 1. Why: the divider references die when the drawing's parts are SAVED
regenerateKeys now remaps the references — but the drawing is then written to drawing_parts, where every part gets a
DATABASE id, and the tree the board loads back is keyed by those ids. The references are not rewritten on insert.
Drawing 60, read with /dev/sql:
    mullions  drawing_parts.id 1218 (offset 365) and 1219 (offset 1306)
    transom   id 1220  startDivider 'a75a59df-…'  endDivider '07122378-…'   <- the fresh UUIDs, which exist nowhere
(drawing 56 still holds the template's own 'mull_wike8s5' / 'mull_m8sj862'). No other saved drawing has a short divider —
so this is not template 38's problem: ANY drawing with a short divider (the two-column casement templates TC1 / TC3,
"Fanlight Over Fixed With Full-Height Opener" etc., or one a surveyor splits "in one column / one row only" on the board)
loses it the moment it is saved and re-opened. Step AV was only ever checked live UNSAVED.

The fix, wherever the tree is written (create from template, board save, copy, coupled frames): map client key -> new
row id as the parts are inserted, then rewrite startDivider / endDivider through that map (a second pass / update) — and
on load make sure the references resolve against what the loader uses as keys. A reference that resolves to nothing must
fail loudly (a validation error naming the divider), never be read as frame-to-frame.

Tests: a ROUND TRIP — build the tree, put it through the real create path AND the real save → load path (or a faithful
fake of drawing_parts that assigns its own ids), then assert the cells and the price. The template test passing on the
pre-save tree is how this got through twice.

## 2. Repair the two drawings that exist
Drawings 56 and 60 (both L507712 item 9, test drawings) hold dead references. Either a guarded SQL that re-points each
dead reference to the right mullion of the same frame (by offset: 365 -> the left one, 1306 -> the right one) or say they
should simply be re-made — the reviewer will re-make one from the template after the fix and expect **£8,936.47**.
Check whether any OTHER drawing in the database has a startDivider / endDivider that resolves to nothing (the reviewer's
query found only these two) and report it.

## 3. Close two loose ends in the report
- The "AV3 / AV4 question" is not open: the live product short names are av3_heritage_locking_system_lh / _rh, but the
  products ARE named "AV4 Heritage Locking System LH / RH" and hold the AV4 parts (RHZ2481 / RHZ3091 LH, RHZ2482 /
  RHZ3092 RH, RHZ2427, LJZ5074040CP). The id is a legacy name; nothing to decide. Say so where the reports raise it.
- Stray drawing 53 (L507712 ITEM 1) is the reviewer's mistake; ignore it.

## Report
docs/reports/step-bh-followup-2.md: the cause (in code terms), every path that writes drawing_parts and whether each
carried the bug, the round-trip test, the repair (or re-make), and the snapshot diff.
