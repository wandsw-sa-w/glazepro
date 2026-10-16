# Step BO — pick ironmongery from the catalogue (reviewer, 16 Oct 2026)

Facts: docs/integrate-live-quotes.txt, plus the stored sets below. Commit this brief as item 0.

## Nathan (16 Oct)
Yes to a product picker, so a drawing can carry the exact ironmongery set the surveyor chose, the way Integrate
stores it (`ironmongerySet`: id, finish, qty per line).

## Today
Finish & Ironmongery shows "Ironmongery Lines" (Product / Finish / Qty), "Apply Defaults" and "+ Add manual line".
The manual line has no way to choose a product, so a stored Integrate set can't be entered and GlazePro prices its
defaults instead.

The differences this causes (cost):
- L34242 items 1-8: −25.20, −4.26, −43.05, −16.80, −16.80, −34.65, +25.20, +42.00.
- L34265 item 9 (French casement): +10.50.

Integrate stores these sets:
- **L34265 item 9:** connoisseur_handle_lh PB 1, connoisseur_handle_rh PB 1,
  defender_friction_hinge_-_side_hung_310mm PC 2, kenrick_extension_950mm PC 4, kenrick_extension_gear_box PC 2,
  trickle_vent_xr16 Wht 1. Price file ironmongery lines: 8.40, 8.40, 16.80, 4.20, 8.40, 8.40, 1.05, 1.05, 3.15.
- **L32520 item 9:** defender_412mm PC 1, hardwick_lyndon_rh_locking_espag_handle PB 1, kenrick_extension_690mm PC 2,
  kenrick_extension_gear_box PC 1, trickle Wht 1, trickle_vent_xr16 Wht 1. Lines: 7.35, 15.75, 2.10, 3.15, 4.20,
  1.05, 1.05, 2.10, 3.15.

## The work

1. **"+ Add line" opens a product picker** over the ironmongery catalogue (the Ironmongery page's products):
   - Search by name or code, grouped by category.
   - Show each product's unit cost.
   - The finish defaults to the item finish and can be changed per line, as today; the qty defaults to 1.

   Lines can be removed and their qty edited.
2. **An edited set is stored and priced as stored**, the way Integrate prices `ironmongerySet`:
   - Rule-allocated parts that are not part of the chosen set keep coming from the rules, as now. For example,
     Integrate prices a door's MPLS keep and slave hardware from the rules on top of the stored set.
   - Say exactly which lines come from the stored set and which from the rules.
   - "Apply Defaults" puts the rule defaults back, after a confirm.
   - Changing a size must never silently overwrite an edited set.
3. **Catalogue gaps.** Check every id in Integrate's stored sets in docs/integrate-live-quotes.txt and in this brief
   against GlazePro's catalogue. List any that are missing (with their Integrate cost, where the facts give it)
   rather than inventing them.
4. **Tests:**
   - A board-path test enters L34265 item 9's set and gets Integrate's nine ironmongery lines.
   - An e2e step adds a line through the picker, saves, reloads and finds it.
5. Every benchmark unchanged. Deploy, run e2e.

## Report
docs/reports/step-bo.md: how stored and default lines combine; the catalogue gaps; what the reviewer should enter
live. The reviewer will then re-enter Integrate's sets on leads 11-15 and expect installation materials exact.
