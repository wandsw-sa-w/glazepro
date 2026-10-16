# Step BL — engine fixes from the live-quote comparison (reviewer, 16 Oct 2026)

Facts: docs/integrate-live-quotes.txt (Integrate's saved drawings, pricing/geometry fields only, with the price file
groups and lines and the production / fitting rules that fired, read 16 Oct). Targets: benchmarkLQ1..LQ9 in
integrate-targets.json (reviewer insertions; each may carry a `known_gaps` object). Commit those two files and this
brief as item 0.

## Background
The reviewer redrew six real Integrate quotes on the live board, priced them in GlazePro and compared every group
and line with Integrate's Price File Editor. Where a difference came from an input the reviewer had missed (horn
type, frame-level arch, one tower access) it has been corrected and re-priced. The differences below are left, and
each one is a GlazePro rule input. Everything happened on the live board, so check each fix on the board path as well
as on the fixture.

The bigger missing inputs (surround, stored ironmongery, scope-of-works notes) and board drawing gaps are later steps.
The benchmarks list them as `known_gaps` so they can be closed now.

## The work

1. **Glazing-bar glass charge on casements and doors.** These two rules never fire on a casement sash, fanlight or
   door leaf whose glass has board-drawn bars:
   - "Square Glass Single Glazing Bar" (9.21, unit_gb_qty == 1)
   - "Square Glass Multiple Glazing Bar" (29.20/m2, unit_gb_qty > 1)

   Both also need glass_unit_thickness >= 24 and not is_sash_arched. They fire correctly on box sashes.
   Live evidence (drawing → Integrate):
   - 82: three units, 1 V + 2 H each → 3 × 16.35
   - 88: fanlight 3 V and sash 3 V + 1 H → 11.97 + 28.62
   - 100: fanlight 1 V → 9.21
   - 103: door 1 V + 1 H → 15.77
   - 105: French door leaves 1 V + 1 H → 2 × 20.44
   - 117: one unit 1 V → 9.21
   - 120: French casement, 1 H each → 2 × 9.21

   Find which input is wrong for these units (the unit's own bar count, or its thickness), fix it, and show the glass
   group exact on LQ1-LQ4 and on the board path.
2. **"Additional for Glazing Bars" (casement_sash loop) and "(Door)" (door_leaf loop) fire on every sash or leaf**
   in the drawing as soon as any glass in it has bars. Integrate counts only the sash or leaf whose own glass has
   bars. Live examples:
   - 100: fired twice; only the fanlight has a bar.
   - 117: fired six times for one barred sash (+150 min).

   In a loop the bar count must be that sash's or leaf's own. Check the other per-sash bar rules the same way.
   Targets: LQ2 and LQ4, manufacture group.
3. **Custom horn per sash.** The rules are "Non-Std Horn 75mm" (30) and "Non-Std Horn Non-75mm" (90), loop
   sliding_sash. Integrate fires them only on a sash that has a horn: top custom 75 with bottom "no horn" gives one
   per pair (labour editor, L34265 items 1 / 3 / 4: 2 / 1 / 1). GlazePro fires them on the bottom sash too (live
   121, 122, 118: 2 / 4 / 2). Targets: LQ5, LQ6, LQ9.
4. **Tall casement frames.** On live 117 (config 7, 1529 × 2600, complete new, installation included) these didn't
   fire:
   - "1500 Height Casement Frame Replacement" (60)
   - "2500 Height Casement Frame Replacement" (300)

   Both use tallest_external_frame_height (> 1.8; >= 2.0 and < 3.0). "1500 Wide Casement Frame"
   (overall_frame_width) did fire. Integrate fired both. Find the input. Target: LQ4, labour.
5. **Tower.** "Scaffold Tower" (180, is_our_mobile_tower_required) never fires, because the variable is never set.
   In Integrate it fires on external access "WSW Mobile Tower" (id 2): fitting units on L34242 items 2 and 4,
   L34268 item 9 and L32520 item 9. Set it from GlazePro's external access "Tower Required by WSW"
   (tower_by_wsw). Don't map any other access option unless the PF30 snapshot shows Integrate does. Target: LQ8.
6. **Casement sash overweight.** "Any Sash Overweight (Casement)" (45, weight_in_kg > 25) fires on live 111 but not
   in Integrate:
   - Live 111 is L32520 item 9: top-hung, frame 1060 × 1230, sash 978 × 1128, 4/16/4.
   - Integrate's fitting units for that item are Base 480 + Opening 90 + Scaffold Tower 180 only.
   - On L32520 item 16 both systems fire it once.

   Report GlazePro's weight for 111's sash and how it is built up, and compare it with the casement weight in the
   snapshot. Don't tune it; if there is no plain cause, report and stop on this item. Target: LQ8.
7. **Hardwood (Solid Utile) box sashes.** Redwood box sashes are exact.
   - "Hardwood Box Frame" (1.75, qty frame_excl_cill_volume × 1.2) gets the volume in m3: live 94 gives 0.0188 →
     £0.03 against Integrate 22.27 → £38.98 for 1000 × 1400. The volume is also lower than Integrate's even in dm3
     (15.6 against 18.6 before the × 1.2). Compare it with the volume the redwood rule uses.
   - "Hardwood Sashes" (1.75, loop sliding_sash, qty volume × 1.2, condition is_solid_utile_hardwood_sash) never
     fires. Integrate 1000 × 1400: 7.27 top, 9.22 bottom; 1200 × 1800: 9.30 / 11.66.

   Target: LQ7.
8. **Benchmarks LQ1-LQ9** from the facts. Use real values and GlazePro's keys, as in Step X; list any Integrate
   field with no GlazePro field rather than inventing one.
   - Each target is Integrate's own figure.
   - `known_gaps` lists differences that belong to later steps: surround labour, the shutters note, surround timber
     on an item with no surround, stored ironmongery.
   - A benchmark passes when every group equals target + known gap.
   - Anything else must be exact, or parked under £1 with a named cause (steel weights look like candidates).
   - LQ5 / LQ6 glass: benchmark C prices a frame-level arched unit right offline, so the LQ5 fixture should too.
     LQ6 is an arched sash in a SQUARE frame (not frame-level), which is new to GlazePro. If either fixture's glass
     is wrong, report what the engine reads and stop on that group; Step BM takes the arched board path.
   - LQ8's fixture includes Integrate's 60 mm cill horns. The reviewer's live drawing 111 left them out.
9. Every existing benchmark unchanged. Deploy, run e2e.

## Report
Write docs/reports/step-bl.md:
- Each item: the cause, the fix, and the before / after line.
- LQ1-LQ9, group by group.
- Anything parked, with its cause.
- What the reviewer should re-price live. Expected after deploy: re-pricing leads 11-15 moves only the lines above.
