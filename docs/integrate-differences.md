# Deliberate differences from Integrate

This file records every pricing difference where GlazePro intentionally
departs from Integrate's behaviour, with the reason, date, and effect.

---

## 1. Sash material rules gated by `to_be_replaced`

**Date:** 6 October 2026
**Decided by:** Nathan Smith
**SQL:** `sql/step-s4-sash-material-rules.sql`

**What differs:**

Three price rules in the `manufacture_materials` group charge sash timber
and glazing bead on every sliding sash, regardless of whether the sash is
being manufactured:

| Sort | Rule name                     | Integrate condition                                                    | GlazePro condition (corrected)                                                              |
|------|-------------------------------|------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| 10   | Laminated Softwood for Sashes | `is_solid_redwood_sash and is_bottom_sash`                             | `is_solid_redwood_sash and is_bottom_sash and to_be_replaced`                               |
| 15   | Laminated Softwood for Sashes | `is_solid_redwood_sash and is_top_sash`                                | `is_solid_redwood_sash and is_top_sash and to_be_replaced`                                  |
| 310  | Glazing Bead for Sashes       | `is not square_top_with_arched_sightline and is not curved_head_sash`  | `is not square_top_with_arched_sightline and is not curved_head_sash and to_be_replaced`    |

`to_be_replaced` is a sliding-sash-loop variable that is `true` when the
sash is being replaced (complete new, or sash explicitly marked for
replacement). It is `false` on a draught seal and overhaul (DSO) where
the sashes are planed and re-hung, not remade.

**Why:**

On a draught seal and overhaul, no sash timber is cut and no glazing bead
is fitted. Charging for these materials is an error in Integrate's price
file. Integrate rule conditions were not updated when the DSO work type
was added.

**Effect on price:**

| Benchmark                          | Before (Integrate) | After (GlazePro) | Change     |
|------------------------------------|-------------------:|------------------:|-----------:|
| Benchmark B (DSO, 950 x 1032)     | cost £233.79       | cost £208.33      | -£25.46    |
|                                    | price £573.55      | price £522.65     | -£50.90    |
| Benchmark A (sash replacement)     | unchanged          | unchanged         | £0.00      |
| L34046 Item 7 (complete new)       | unchanged          | unchanged         | £0.00      |

The three removed lines total £25.46 cost and £50.90 price on a DSO job.
Sash replacement and complete new jobs are unaffected because
`to_be_replaced` is `true` for their sashes.

---

## 2. Complete new sash windows are always 45 mm thick

**Date:** 9 October 2026
**Decided by:** Nathan Smith
**SQL:** `sql/step-ai1-complete-new-45mm-rule.sql` (written by the reviewer, run by Nathan)
**Code:** `src/drawingBoard/sashThickness.js` (board), Step AI

**What differs:**

A complete new sash window is always manufactured 45 mm thick. GlazePro
enforces that in two places:

| Where | Behaviour |
|---|---|
| Drawing board | On a box sash item whose type of work is Complete New, Sash Thickness is read-only at 45 mm, noted "Complete new sash windows are always 45 mm". Choosing Complete New, or creating a drawing from a complete-new template, sets 45 through the same path as a hand thickness edit (bottom rail and frame height shift so that rail + chamfer allowance and the external sash height are unchanged, and the change appears in the drawing history). A drawing already saved at another thickness is never changed on load — a "Set to 45 mm" button applies it. |
| Validation | Item-level **warning** `is_sw and frame_to_be_replaced and sash_thickness != 45` — "Complete new sash windows are always made 45mm thick." |

Integrate has no such rule: its sash thickness is a free number box on every
type of work, and its own validation ("Sashes are only manufactured to 35,
40, 45 or 50mm", rule 24) is conditioned on `not frame_to_be_replaced`, so
it never fires on a complete new item — a 57 mm complete new drawing raises
nothing in Integrate (`docs/integrate-L31115-A-top-only.txt` §5).

Sash replacements are unaffected: they may be 35 / 40 / 45 / 50 mm (and
always replace both sashes), which is what benchmarks A35 / A40 / A50 price.

**Why:**

The workshop only makes complete new sash windows at 45 mm. Offering other
thicknesses on a complete new drawing can only produce a quote that cannot
be built.

**Effect on price:**

None on any benchmark. Every complete-new benchmark is already 45 mm —
L34046 Item 7, C (arched) and D (double box) — and the rule is a board and
validation rule, not a pricing rule: no price rule, variable or engine
behaviour changed, and the full benchmark line dump is byte-identical to
Step AH (`PRICING_ENGINE_VERSION` stays 10).
