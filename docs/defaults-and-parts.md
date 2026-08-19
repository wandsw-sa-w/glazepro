# Defaults & Parts

## Why a drawing is a tree, not a flat row

A window drawing in GlazePro is not a single form with a fixed set of fields.
A window can contain multiple sashes; a sash contains a frame, glazing bars,
hardware, and so on. This nesting matches the integrateJS data model, where each
section of a specification is a named block that can contain child blocks.

The part tree captures this: a drawing is a root node, and each component of
the window is a child (or grandchild) part. The database rows that store field
values are attached to individual parts, not to the drawing as a whole. This
means the same field (e.g. `mechanicalClearanceLeft`) can exist independently
on each sash, with its own value, rather than forcing a single global value onto
the drawing.

---

## Part types (`part_types`)

A **part type** is a named category of window component. Every part that appears
on a drawing has exactly one part type. Examples:

| code                  | label                  | notes                              |
|-----------------------|------------------------|------------------------------------|
| `casementSashPart`    | Casement Sash          |                                    |
| `boxFramePart`        | Box Frame              | container — has sash children      |
| `glazingBarsPart`     | Glazing Bars           | singleton — always present         |
| `stableDoorPart`      | Stable Door            | container — children TBD via UI    |
| `frenchCasementPart`  | French Casement        | container — children TBD via UI    |

### Flags

- **`is_container`** — this part type may have child parts. The Allowed Children
  tab in the admin UI controls which child part types are permitted and in what
  quantities. Two containers currently have no children defined:
  `stableDoorPart` and `frenchCasementPart` — add them through the UI.

- **`is_singleton`** — this part type is always present on its parent (e.g.
  glazing bars are automatically part of every sash, not user-added). The
  drawing form does not let the user add or remove singletons.

### Mapping to integrateJS

integrateJS organises a window specification as a hierarchy of named sections.
Each section type maps to a part type in GlazePro. The `code` column is the
key used to match the two systems. Do not change a part type code after drawings
reference it.

---

## Allowed children (`part_type_children`)

For each container part type, `part_type_children` records which child part
types are permitted.

| column       | meaning                                                     |
|--------------|-------------------------------------------------------------|
| `parent_code`| FK to `part_types.code` — the container                    |
| `child_code` | FK to `part_types.code` — the permitted child               |
| `min_count`  | Minimum number of this child type (0 = optional)            |
| `max_count`  | Maximum count; null = unlimited                             |
| `sort_order` | Display order within the parent's child list                |

The Allowed Children tab in the admin UI manages these rows. Ticking a child
type inserts a row with default min=0, max=null; unticking deletes it. The
min/max inputs and up/down arrows are shown for each ticked child.

---

## Default field definitions (`default_field_definitions`)

A **field definition** describes one configurable property of a part type. There
are 256 active definitions across all part types.

| column          | meaning                                                          |
|-----------------|------------------------------------------------------------------|
| `field_key`     | Composite unique identifier: `{part_type}.{property_name}`, e.g. `casementSashPart.mechanicalClearanceLeft`. Never change this after values reference it. |
| `part_type`     | FK to `part_types.code`                                          |
| `property_name` | The integrateJS property name within that section                |
| `label`         | Human-readable label shown in the admin UI                       |
| `group_name`    | Optional grouping within a part type                             |
| `data_type`     | `text`, `numeric`, `boolean`, etc.                               |
| `unit`          | Optional unit string, e.g. `mm`                                  |
| `visibility`    | `visible` / `readonly` / `hidden` — see below                   |
| `sort_order`    | Display order within the part type                               |

### Why field keys are composite

`field_key` combines the part type code and the property name into a single
string used as a foreign key in `default_profile_values`. This avoids a
two-column FK and makes it easy to query "all values for this field" without
joining through `part_types`. The format mirrors integrateJS section paths.

---

## The five ranges (`default_profiles`)

Default values are not single numbers — they vary by product range. GlazePro
uses five profiles, each representing a distinct range offered to customers:

| label           | condition / scope                                      |
|-----------------|--------------------------------------------------------|
| Sash            | Standard sliding sash windows                          |
| Casement        | Standard casement windows                              |
| Sashes Only     | Replacement sash units without full frame              |
| Open Out Doors  | Outward-opening door sets                              |
| Open In Doors   | Inward-opening door sets                               |

Not every field needs a value in every range. Missing combinations are treated
as "no default" — the drawing form falls back to whatever the part requires.

### Default profile values (`default_profile_values`)

One row per (profile, field) pair where a default has been set. 676 rows
currently exist across all fields and profiles.

| column          | meaning                                                          |
|-----------------|------------------------------------------------------------------|
| `profile_id`    | FK to `default_profiles.id`                                      |
| `field_key`     | FK to `default_field_definitions.field_key`                      |
| `default_value` | The default as text (cast at runtime to the field's data_type)   |
| `min_value`     | Optional lower bound (numeric)                                   |
| `max_value`     | Optional upper bound (numeric)                                   |
| `source_ref`    | Original integrateJS reference number, e.g. `"110"`. Read-only. See Source refs below. |

---

## Visibility states

Each field definition carries a `visibility` value:

| value      | meaning                                                              |
|------------|----------------------------------------------------------------------|
| `visible`  | Shown in the drawing form and editable by the user                   |
| `readonly` | Shown in the drawing form but not editable                           |
| `hidden`   | Not shown in the drawing form                                        |

**Hidden fields are still used by the pricing engine.** A hidden field simply
means the user cannot see or change it — the engine still reads its default
value when pricing a drawing. Do not assume hidden = unused.

---

## Source refs

The `source_ref` column on `default_profile_values` holds the reference number
from the original integrateJS specification document, e.g. `"110"`, `"A4"`.
These were captured during the initial data import and are kept for a future
mapping pass that will align them with `reference_options` codes.

They are currently read-only in the admin UI. A later session will add tooling
to map each source ref to its corresponding `reference_options.code`.

---

## Admin UI

Route: `/defaults`

**Left panel** — lists all part types ordered by `sort_order`. Each row shows
the label, a field count badge, and small coloured badges for singleton (S) and
container (C) flags. Selecting a part type loads its details on the right.

**Right panel — Fields & Defaults tab** (default)

A scrollable table of the selected part type's fields. Columns:
- Field — label with property_name underneath
- Visibility — dropdown (visible / readonly / hidden), saves on change
- One column per active profile, in sort_order

Each profile cell shows the `default_value` input and, optionally, the
`source_ref` tag (read-only muted label). The **Show min/max** toggle above
the table adds two smaller inputs per cell for `min_value` and `max_value`
(hidden by default as these columns are mostly empty).

All edits autosave on blur. A brief "Saved" indicator appears inline next to the
cell; no modal is used for these edits. Inserting a new profile/field row (for
combinations with no existing value) happens automatically on the first non-empty
blur.

A search box filters fields by label or property_name within the selected part type.

**Right panel — Allowed Children tab** (container part types only)

A list of all active part types with a checkbox. Ticked = a row exists in
`part_type_children`. Ticking inserts with min=0, max=null; unticking deletes.
For each ticked child, min/max inputs and reorder arrows are shown. Edits to
min/max autosave on blur.
