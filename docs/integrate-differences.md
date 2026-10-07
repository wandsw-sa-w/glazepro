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
