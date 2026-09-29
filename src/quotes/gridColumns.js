/**
 * gridColumns.js — Quote Overview items grid column config (Step K3).
 *
 * Pure, tested. Column values come from a drawing's parts tree (as returned
 * by drawingBoard/api.js#loadDrawingParts): find the first part of `partType`
 * in the tree and read/write `property` on its `values` object.
 *
 * Columns whose backing field doesn't exist in the schema yet are included
 * with `partType`/`property` left null — readColumnValue returns null for
 * these and the grid renders "—", per the K3 brief ("skip any property that
 * doesn't exist yet"). Columns sourced from the `drawings` row itself
 * (source: 'drawing') or from quote/profile context (source: 'context') are
 * read/written outside the tree — see QuoteOverview.jsx.
 */

// ── Tree helpers (pure — duplicated from DrawingBoard.jsx's own findFirst/
// updateNodeValues so this module has no dependency on the editor) ──────────

function findFirstPart(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const c of (node.children ?? [])) {
    const f = findFirstPart(c, partType)
    if (f) return f
  }
  return null
}

function updateFirstPartValues(node, partType, patch) {
  if (!node) return node
  if (node.part_type === partType) return { ...node, values: { ...node.values, ...patch } }
  return { ...node, children: (node.children ?? []).map(c => updateFirstPartValues(c, partType, patch)) }
}

/**
 * Read a column's value out of a drawing's parts tree.
 * @param {object|null} tree
 * @param {{partType?: string|null, property?: string|null}} column
 * @returns {*} the raw value, or null if the part/property/tree is absent
 */
export function readColumnValue(tree, column) {
  if (!tree || !column?.partType || !column?.property) return null
  const part = findFirstPart(tree, column.partType)
  if (!part) return null
  const raw = part.values?.[column.property]
  return raw === undefined ? null : raw
}

/**
 * Write a new value for a column into a drawing's parts tree.
 * Returns a new tree (immutable update); the caller is responsible for
 * persisting it (saveDrawingParts) and re-pricing.
 * @param {object|null} tree
 * @param {{partType?: string|null, property?: string|null}} column
 * @param {*} newValue
 * @returns {object|null} the updated tree, or the original tree unchanged
 *   if the column has no partType/property or the tree is absent.
 */
export function writeColumnValue(tree, column, newValue) {
  if (!tree || !column?.partType || !column?.property) return tree
  return updateFirstPartValues(tree, column.partType, { [column.property]: newValue })
}

// ── Column config ────────────────────────────────────────────────────────────
// type: 'reference' | 'number' | 'text' | 'boolean' | 'display'
// source: 'tree' (default) | 'drawing' | 'context'

export const GRID_COLUMNS = [
  { key: 'price_file',      label: 'Price File',              source: 'context', editable: false, type: 'display' },
  { key: 'item_type',       label: 'Item Type',                partType: null,                    property: null,                editable: false, type: 'display' },
  { key: 'type_of_work',    label: 'Type of Work',             partType: 'drawingItemPart',        property: 'typeOfWork',        editable: true,  type: 'reference', referenceCategory: 'type_of_work' },
  { key: 'supply_option',   label: 'Supply Option',            partType: 'drawingItemPart',        property: 'supplyOption',      editable: false, type: 'display' },
  { key: 'product_range',   label: 'Product Range',            source: 'context', editable: false, type: 'display' },
  { key: 'sash_material',   label: 'Sash Material',            partType: 'drawingItemPart',        property: 'sashMaterialId',    editable: true,  type: 'reference' },
  { key: 'frame_material',  label: 'Frame Material',           partType: 'drawingItemPart',        property: 'frameMaterialId',   editable: true,  type: 'reference' },
  { key: 'cill_material',   label: 'Cill Material',             partType: 'cillPart',               property: 'cillMaterialId',    editable: true,  type: 'reference' },
  { key: 'staff_bead',      label: 'Staff Bead',                partType: 'drawingItemPart',        property: 'staffBeadTypeId',   editable: true,  type: 'reference', referenceCategory: 'staff_bead_type' },
  { key: 'sash_travel',     label: 'Sash Travel (%)',           partType: null,                    property: null,                editable: false, type: 'display' },
  { key: 'sash_weight',     label: 'Sash Weight',               partType: null,                    property: null,                editable: false, type: 'display' },
  { key: 'item_weight',     label: 'Item Weight',               partType: null,                    property: null,                editable: false, type: 'display' },
  { key: 'sash_width',      label: 'Sash Width',                partType: 'sashPairPart',           property: 'sashWidth',         editable: false, type: 'number', unit: 'mm' },
  { key: 'sash_height',     label: 'Sash Height',               partType: 'topSashPart',            property: 'sashHeight',        editable: false, type: 'number', unit: 'mm' },
  { key: 'sash_thickness',  label: 'Sash Thickness',            partType: null,                    property: null,                editable: false, type: 'display' },
  { key: 'top_horn',        label: 'Top Sash Horn',             partType: 'topSashPart',            property: 'horn',              editable: true,  type: 'text' },
  { key: 'bottom_horn',     label: 'Bottom Sash Horn',          partType: 'bottomSashPart',         property: 'horn',              editable: true,  type: 'text' },
  { key: 'glazing_bar',     label: 'Glazing Bar',               partType: null,                    property: null,                editable: false, type: 'display' },
  { key: 'single_glass',    label: 'Single Glass',              partType: 'glassPart',              property: 'singleGlassPartNo', editable: true,  type: 'text' },
  { key: 'inner_glass',     label: 'Inner Glass',               partType: 'glassPart',              property: 'internalGlassPartNo', editable: true, type: 'text' },
  { key: 'outer_glass',     label: 'Outer Glass',               partType: 'glassPart',              property: 'externalGlassPartNo', editable: true, type: 'text' },
  { key: 'spacer_colour',   label: 'Spacer Colour',              partType: 'glassPart',              property: 'spacerColourId',    editable: true,  type: 'reference' },
  { key: 'gas_fill',        label: 'Gas Fill',                  partType: 'glassPart',              property: 'gasFillId',         editable: true,  type: 'reference', referenceCategory: 'gas_fill' },
  { key: 'ironmongery',     label: 'Ironmongery',               partType: 'paintAndIronmongeryPart', property: 'ironmongeryFinishId', editable: false, type: 'display' },
  { key: 'surround',        label: 'Surround',                  partType: null,                    property: null,                editable: false, type: 'display' },
  { key: 'internal_finish', label: 'Internal Finish',           partType: null,                    property: null,                editable: false, type: 'display' },
  { key: 'external_finish', label: 'External Finish',           partType: null,                    property: null,                editable: false, type: 'display' },
  { key: 'cill_finish',     label: 'Cill Finish',               partType: null,                    property: null,                editable: false, type: 'display' },
  { key: 'poa',             label: 'POA',                       partType: 'pricePart',              property: 'poa',               editable: true,  type: 'boolean' },
  { key: 'install_method',  label: 'Installation Method',       partType: 'notesPart',              property: 'installationMethod', editable: true, type: 'reference', referenceCategory: 'installation_method' },
  { key: 'fire_egress',     label: 'Fire Egress',               partType: 'notesPart',              property: 'fireEgress',        editable: true,  type: 'reference', referenceCategory: 'fire_egress' },
  { key: 'internal_hazard', label: 'Internal Hazard',            partType: 'notesPart',              property: 'internalHazard',    editable: true,  type: 'reference', referenceCategory: 'internal_hazard' },
  { key: 'internal_access', label: 'Internal Access',           partType: null,                    property: null,                editable: false, type: 'display' },
  { key: 'landing_access',  label: 'Landing Access',            partType: 'notesPart',              property: 'landingAccess',     editable: true,  type: 'reference', referenceCategory: 'landing_access' },
  { key: 'external_access', label: 'External Access',           partType: 'notesPart',              property: 'externalAccessId',  editable: true,  type: 'reference' },
  { key: 'hazard_below',    label: 'Hazard Below',              partType: null,                    property: null,                editable: false, type: 'display' },
  { key: 'cable_alarm',     label: 'Cable/Alarm',               partType: null,                    property: null,                editable: false, type: 'display' },
  { key: 'dormer_issue',    label: 'Dormer Issue',              partType: null,                    property: null,                editable: false, type: 'display' },
  { key: 'cut_back_plaster',label: 'Cut Back Plaster',           partType: 'notesPart',              property: 'cutBackPlaster',    editable: true,  type: 'boolean' },
  { key: 'cut_back_reveal', label: 'Cut Back Reveal',           partType: 'notesPart',              property: 'cutBackReveal',     editable: true,  type: 'boolean' },
  { key: 'quote_notes',     label: 'Quote Notes',               source: 'drawing', field: 'notes_quote',       editable: true, type: 'text' },
  { key: 'installation_notes', label: 'Installation Notes',     source: 'drawing', field: 'notes_installation', editable: true, type: 'text' },
  { key: 'notes_production', label: 'Notes for Production',     partType: null,                    property: null,                editable: false, type: 'display' },
]
