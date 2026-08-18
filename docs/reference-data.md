# Reference Data Layer

## Purpose

The reference data layer provides a single, admin-managed source of truth for
the option lists used throughout GlazePro: timber species, glazing types, panel
types, frame mouldings, section dimensions, finishes, and any future per-drawing
categorised selections.

Rather than keeping these lists as hardcoded arrays in component files, the
reference data layer stores them in Supabase so they can be extended without a
code deployment.

---

## Tables

### `reference_categories`

One row per option list.

| Column        | Type    | Meaning |
|---------------|---------|---------|
| `category`    | text PK | Machine identifier, e.g. `timber_species`. Used as the FK value in `reference_options`. Never change this after data exists. |
| `label`       | text    | Human-readable name shown in the UI, e.g. `Material - Timber`. Safe to edit. |
| `group_name`  | text    | Groups categories together in the left-panel sidebar, e.g. `Materials`. |
| `is_multi`    | boolean | When true, a drawing can select multiple options from this category (stored as an array in `drawing_reference_selections`). |
| `has_quantity` | boolean | When true, each selection on a drawing also carries a numeric quantity. |
| `description` | text    | Optional explanatory text shown under the category heading in the admin UI. |
| `sort_order`  | integer | Display order within a group. |

### `reference_options`

One row per selectable value within a category.

| Column       | Type        | Meaning |
|--------------|-------------|---------|
| `id`         | bigserial PK | Stable numeric ID. |
| `category`   | text        | FK by value to `reference_categories.category`. |
| `code`       | text        | **Permanent identifier.** Pricing variable names are derived from this. Must not change after rules reference it. See Code vs Label below. |
| `label`      | text        | Display text shown to users. Safe to edit at any time. |
| `attributes` | jsonb       | Per-category extra data, e.g. `{"mm": 44}` for a section dimension. Keys are fixed per category; the admin UI seeds them automatically from keys already present in the category. |
| `applies_to` | text[]      | Restricts which window components this option applies to, e.g. `{frame, sash, cill}`. Only used for categories where this distinction is relevant. |
| `sort_order` | integer     | Display order within the category. Managed via the up/down arrows in the admin UI. |
| `is_active`  | boolean     | Controls visibility in dropdowns. Inactive options are hidden from future selections but preserved for historic drawings. |
| `created_at` | timestamptz | Set on insert. |
| `updated_at` | timestamptz | Updated on every save, including is_active toggles and reorders. |

Unique constraints: `(category, code)` and `(category, label)`.

### `drawing_reference_selections` *(not yet in use)*

Will store which reference options a drawing has selected, replacing the current
hardcoded field values on the `drawings` table. Planned structure:

- `drawing_id` — FK to `drawings.id`
- `category` — FK by value to `reference_categories.category`
- `option_id` — FK to `reference_options.id`
- `quantity` — nullable numeric, used when `reference_categories.has_quantity` is true

This table is not populated by any current code. It is the foundation for chunk 2.

---

## Code vs Label

The `code` is the stable machine identifier. The `label` is the human-readable
display string.

**Why codes are permanent:** The pricing engine uses variable names of the form
`{component}_material_is_{code}` (e.g. `frame_material_is_solid_redwood`).
These variable names appear in `price_rules.condition` expressions. If a code
changes, every rule that references it silently breaks — the condition evaluates
to false, and the rule stops matching.

**Safe to change:** Labels can be edited freely. They are display text only and
have no impact on pricing logic.

**Code generation:** When creating a new option in the admin UI, the code is
auto-generated from the label (lowercase, spaces and punctuation to underscores).
The user can override it before saving. Once saved, the code field is read-only
in the UI unless the user explicitly unlocks it via "change code", which shows a
warning.

---

## Pricing variable naming convention

When the pricing engine evaluates a drawing, it computes boolean variables for
each reference selection:

```
{component}_material_is_{code}
```

Examples:
- `frame_material_is_solid_redwood` — true when the frame material is Solid Redwood
- `sash_material_is_accoya`
- `cill_material_is_utile_hardwood`

The `applies_to` array on an option controls which components generate a variable.
An option with `applies_to: [frame, sash]` produces variables for `frame` and
`sash` but not `cill`.

For categories without `applies_to` (e.g. glazing types), a simpler convention
applies — to be defined when those categories are wired into the drawing form.

---

## is_multi and has_quantity

These flags on `reference_categories` are not yet enforced by the drawing form
(which still uses hardcoded dropdowns in `QuoteDrawer.jsx`). They are stored now
so the schema is ready for chunk 2:

- `is_multi = true`: the drawing selection will be stored as multiple rows in
  `drawing_reference_selections` (one per chosen option) rather than a single value.
- `has_quantity = true`: each row in `drawing_reference_selections` will include
  a numeric quantity (e.g. number of glazing bars of a given type).

---

## Admin UI

Route: `/reference-data`

Left panel: categories grouped by `group_name`, ordered by `sort_order`, with
a count of active options per category.

Right panel: options for the selected category in a table. Each row shows label,
code (monospaced), active toggle, and up/down reorder arrows. Clicking Edit opens
a modal.

The modal shows: Label, Code (read-only on edit unless unlocked), Active toggle,
Applies to checkboxes (only for categories where existing options use this field),
and Attributes key/value pairs (only for categories where existing options carry
attributes). Inline error messages are shown for duplicate label or code
violations rather than raw Postgres errors.

Deactivating an option hides it from future dropdowns but does not delete the
row — historic drawings continue to reference it.
