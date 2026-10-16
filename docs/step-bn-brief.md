# Step BN — surround tick boxes and existing SDG / shutters (reviewer, 16 Oct 2026)

Facts: docs/integrate-live-quotes.txt (LQ1-LQ9, surround and SDG fields per item) and the facts below.
Targets: the reviewer has removed the surround and shutters `known_gaps` from LQ1, LQ2, LQ3, LQ5 and LQ7, and the
window board part of LQ4's, in integrate-targets.json. Commit that, this brief and docs/step-bm-brief.md (if
BM's item 0 hasn't already) as item 0.

## Nathan (16 Oct)
- Surround: **tick boxes**, not Integrate's preset list.
- Existing secondary glazing / shutters: copy Integrate. It has a "SDG type" dropdown and a "what to do with it"
  dropdown on Finish & Ironmongery.

## What Integrate does (read 16 Oct)

### Surround
Integrate keeps a preset on the Paint & Ironmongery part, plus the component list made from it:

| preset (autoCalcSurroundComponents) | components |
|---|---|
| `architrave_and_bullnose` | architrave |
| `architrave_and_w_board` | architrave + window board |
| `architrave_lining_and_w_board` | linings + architrave + window board |
| `architrave_bullnose_and_packer` | architrave (+ bullnose, packer) |
| `0` | none |

Only three rules read the surround, besides the component cost of the architrave that GlazePro already allocates:
- **Linings** 180 min, condition `has_lining`. Integrate: the item has a component that is a lining.
- **Windowboard** 30 min, condition `has_deep_window_board`. Integrate: a window board that is not a bullnose.
- **External Lining** 180 min, loop `component`, condition `part_no == external_lining`.

In the price file, the linings and window-board components cost nothing (placeholder length 1, width 0); only their
labour moves. With no surround at all (LQ3, preset 0) Integrate has no Component Cost line, while GlazePro allocates
the architrave anyway (+17.96).

### Existing SDG / obstruction
Two dropdowns on the Paint & Ironmongery part:
- **existingSurroundTypeId**: 0 N/A, 1 Fixed SDG, 2 Hinged SDG, 3 Vertical Sliding SDG, 4 Horizontal Sliding SDG,
  5 Plantation Shutters, 6 Shutter Boxes, 7 Panelling, 8 Security Grills.
- **existingSurroundActionId**: 0 Leave in Situ, 1 Remove and Re-fit, 2 Remove and Dispose, 3 Customer to Remove.

The variables, from Integrate's dictionary ("what is below or in front of the existing item"):

| variable | true when |
|---|---|
| `has_fixed_secondary_glazing` | type 1 |
| `has_hinged_secondary_glazing` | type 2 |
| `has_vertical_sliding_secondary_glazing` | type 3 |
| `has_horizontal_sliding_secondary_glazing` | type 4 |
| `has_secondary_glazing` | types 1-4 |
| `has_plantation_shutters` | type 5 |
| `has_shutter_boxes` | type 6 |
| `has_panelling` | type 7 |
| `has_security_grills` | type 8 |
| `has_sdg_or_panel` | any type other than 0 |
| `remove_and_refit_existing_sdg_or_panel` | action 1 |
| `remove_and_dispose_existing_sdg_or_panel` | action 2 |

The PF30 rules that read them, all `frame_qty` × minutes:
- Remove and Refit: Fixed / Vertical / Horizontal SDG 75, Shutters 75, Panelling (panelling or shutter boxes) 900.
- Remove and Dispose: Fixed / Vertical / Horizontal SDG 35.

Hinged SDG, security grills, "Leave in Situ" and "Customer to Remove" fire nothing.

Live evidence:
- L34265 item 3 (LQ5) and item 9 are type 5, action 1, so Remove and Refit Shutters 75 fires.
- L32520 item 9 is type 5 with action 0, so nothing fires.

## The work

1. **Surround tick boxes** on Finish & Ironmongery: Architrave, Linings, Window board, External lining.
   - **Defaults:** Architrave ticked, the rest unticked. That is what GlazePro prices today, so no existing drawing
     or benchmark moves.
   - **Architrave unticked:** no architrave allocated, so no Component Cost line (LQ3).
   - **Linings, Window board, External lining:** each sets what its rule reads, i.e. `has_lining`,
     `has_deep_window_board`, and a component with `part_no` `external_lining`. Each adds no material cost, as in
     Integrate.

   Where the answer is stored, and whether as components or flags, is your call. Keep Step AV's stored surround
   list working: today a stored "Nosing" sets `has_deep_window_board`. Say in the report how the two meet.
2. **SDG dropdowns** on Finish & Ironmongery: "Existing SDG / obstruction" and "What to do with it", with
   Integrate's lists and wording, both defaulting to N/A / Leave in Situ. Set the variables in the table above from
   them. A board-path test covers every type × the two actions that fire something.
3. **Benchmarks.** Set the ticks and the SDG on the LQ fixtures from the facts:
   - LQ1 and LQ4: architrave + window board.
   - LQ2 and LQ7: architrave + linings + window board.
   - LQ3: nothing ticked.
   - LQ5, LQ6, LQ8, LQ9: architrave only.
   - LQ5: shutters, remove and re-fit.

   All their surround and shutters known gaps are gone from the targets. LQ4 keeps only its 3 h, which is now known to be a POA labour line (Step BS).
   Benchmarks TC1-TC3 (Step AV's nosing) must not move.
4. Every other benchmark unchanged. Deploy, run e2e.

## Report
docs/reports/step-bn.md: where the answers live, LQ1-LQ9 group by group, and what the reviewer should tick live to
close the labour gaps on leads 11-15.
