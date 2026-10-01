/**
 * gridColumns.js — Quote Overview items grid column config (Step K3).
 *
 * Pure, tested. Column values come from a drawing's parts tree (as returned
 * by drawingBoard/api.js#loadDrawingParts): find the first part of `partType`
 * in the tree and read/write `property` on its `values` object.
 *
 * Columns with a `compute(tree)` function are read-only derived columns;
 * readColumnValue calls compute() when no partType/property is set.
 *
 * Columns that require data beyond the tree (source: 'context') are
 * read outside the tree — see QuoteOverview.jsx.
 *
 * Columns for features not yet implemented (product_range, surround,
 * sash_travel) are left with partType/property null so the grid renders "—".
 */

import { computeSashGeometry } from '../drawingBoard/sashGeometry.js'
import { computeDerived }       from '../drawingBoard/computeDerived.js'
import { computeSashWeight }    from '../pricing/sashWeight.js'

// ── Tree helpers (pure — duplicated from DrawingBoard.jsx so this module
// has no dependency on the editor) ──────────────────────────────────────────

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
 * Falls back to profileDefaults (if provided) when the tree value is
 * absent, then to column.compute(tree) for derived columns.
 *
 * profileDefaults is keyed by `${partType}.${property}` → converted value
 * (i.e. the same value that buildNewBoxSash would have stamped in).
 *
 * @param {object|null} tree
 * @param {{partType?: string|null, property?: string|null, compute?: function}} column
 * @param {Object<string, *>} [profileDefaults]  partType.property → default value
 * @returns {*} the raw value, or null if absent
 */
export function readColumnValue(tree, column, profileDefaults) {
  if (!tree) return null
  if (column?.partType && column?.property) {
    const part = findFirstPart(tree, column.partType)
    const raw = part?.values?.[column.property]
    if (raw !== undefined && raw !== null) return raw
    // Fall back to profile default when the tree value is null/missing
    if (profileDefaults) {
      const fieldKey = `${column.partType}.${column.property}`
      const def = profileDefaults[fieldKey]
      if (def !== undefined && def !== null) return def
    }
    return null
  }
  if (typeof column?.compute === 'function') {
    try { return column.compute(tree) ?? null } catch { return null }
  }
  return null
}

/**
 * Write a new value for a column into a drawing's parts tree.
 * Returns a new tree (immutable update); caller persists via saveDrawingParts.
 * @param {object|null} tree
 * @param {{partType?: string|null, property?: string|null}} column
 * @param {*} newValue
 * @returns {object|null}
 */
export function writeColumnValue(tree, column, newValue) {
  if (!tree || !column?.partType || !column?.property) return tree
  return updateFirstPartValues(tree, column.partType, { [column.property]: newValue })
}

// ── Derived-value helpers ────────────────────────────────────────────────────

function computeSashWidth(tree) {
  const derived = computeDerived(tree)
  const geo     = computeSashGeometry(tree, derived)
  return geo?.sashWidth ?? null
}

function computeTopSashHeight(tree) {
  const derived = computeDerived(tree)
  const geo     = computeSashGeometry(tree, derived)
  return geo?.topSashHeight ?? null
}

// Sash Weight: the top sash's own physical weight (timber + glass), using the
// same formula pricingEngine.js evaluates sash_weights price rules against.
// No glass catalogue is passed (grid context has no price file loaded), so
// this is timber + a default glass estimate — close to, but not necessarily
// identical to, the figure a priced run evaluated its rules against.
function computeSashWeightKg(tree) {
  const topSash = findFirstPart(tree, 'topSashPart')
  if (!topSash) return null
  const wt = computeSashWeight(topSash, tree, {})
  return wt?.weight_in_kg != null ? Math.round(wt.weight_in_kg * 10) / 10 : null
}

// Item Weight: both sashes' weights added together.
function computeItemWeightKg(tree) {
  const topSash = findFirstPart(tree, 'topSashPart')
  const botSash = findFirstPart(tree, 'bottomSashPart')
  let total = null
  for (const sash of [topSash, botSash]) {
    if (!sash) continue
    const wt = computeSashWeight(sash, tree, {})
    if (wt?.weight_in_kg != null) total = (total ?? 0) + wt.weight_in_kg
  }
  return total != null ? Math.round(total * 10) / 10 : null
}

function computeGlazingBar(tree) {
  const topSash = findFirstPart(tree, 'topSashPart')
  const glass = findFirstPart(topSash, 'glassPart')
  if (!glass) return 'None'
  const vBars = (glass.children ?? []).filter(c => c.part_type === 'verticalGlazingBarPart')
  const hBars = (glass.children ?? []).filter(c => c.part_type === 'horizontalGlazingBarPart')
  if (vBars.length === 0 && hBars.length === 0) return 'None'
  const parts = []
  if (vBars.length > 0) parts.push(`${vBars.length} vertical`)
  if (hBars.length > 0) parts.push(`${hBars.length} horizontal`)
  const barWidth = vBars[0]?.values?.barWidth ?? hBars[0]?.values?.barWidth ?? null
  const widthStr = barWidth ? `, ${barWidth} mm` : ''
  return parts.join(', ') + widthStr
}

// ── Column config ────────────────────────────────────────────────────────────
// type: 'reference' | 'number' | 'text' | 'boolean' | 'display'
// source: 'tree' (default) | 'context'
// referenceCategory: matches reference_categories.code in the DB

export const GRID_COLUMNS = [
  { key: 'price_file',      label: 'Price File',           source: 'context', editable: false, type: 'display' },
  { key: 'item_type',       label: 'Item Type',            source: 'drawing', field: 'window_type', editable: false, type: 'display' },
  { key: 'type_of_work',    label: 'Type of Work',         partType: 'drawingItemPart',         property: 'typeOfWork',          editable: true,  type: 'reference', referenceCategory: 'type_of_work' },
  { key: 'supply_option',   label: 'Supply Option',        partType: 'drawingItemPart',         property: 'supplyOption',        editable: true,  type: 'reference', referenceCategory: 'supply_option' },
  { key: 'product_range',   label: 'Product Range',        source: 'context', editable: false, type: 'display' },
  // Sash/Frame/Cill Material all live on drawingItemPart, all under the
  // reference_category 'timber_species' — not per-field categories, and not
  // cillPart for Cill Material (cillPart.cillMaterialId exists too, but it's
  // role='derived', a read-only mirror of drawingItemPart's value — editing
  // that one wouldn't be the real input field).
  { key: 'sash_material',   label: 'Sash Material',        partType: 'drawingItemPart',         property: 'sashMaterialId',      editable: true,  type: 'reference', referenceCategory: 'timber_species' },
  { key: 'frame_material',  label: 'Frame Material',       partType: 'drawingItemPart',         property: 'frameMaterialId',     editable: true,  type: 'reference', referenceCategory: 'timber_species' },
  { key: 'cill_material',   label: 'Cill Material',        partType: 'drawingItemPart',         property: 'cillMaterialId',      editable: true,  type: 'reference', referenceCategory: 'timber_species' },
  { key: 'staff_bead',      label: 'Staff Bead',           partType: 'drawingItemPart',         property: 'staffBeadTypeId',     editable: true,  type: 'reference', referenceCategory: 'staff_bead_type' },
  { key: 'sash_travel',     label: 'Sash Travel (%)',      partType: null,                     property: null,                  editable: false, type: 'display' },
  { key: 'sash_weight',     label: 'Sash Weight',          editable: false, type: 'number', unit: 'kg', compute: computeSashWeightKg },
  { key: 'item_weight',     label: 'Item Weight',          editable: false, type: 'number', unit: 'kg', compute: computeItemWeightKg },
  { key: 'sash_width',      label: 'Sash Width',           editable: false, type: 'number', unit: 'mm', compute: computeSashWidth },
  { key: 'sash_height',     label: 'Sash Height',          editable: false, type: 'number', unit: 'mm', compute: computeTopSashHeight },
  { key: 'sash_thickness',  label: 'Sash Thickness',       partType: 'sashPairPart',            property: 'sashThickness',       editable: false, type: 'number', unit: 'mm' },
  { key: 'top_horn',        label: 'Top Sash Horn',        partType: 'sashPairPart',            property: 'topHornTypeShortName', editable: true, type: 'reference', referenceCategory: 'horn_type' },
  { key: 'bottom_horn',     label: 'Bottom Sash Horn',     partType: 'sashPairPart',            property: 'bottomHornTypeShortName', editable: true, type: 'reference', referenceCategory: 'horn_type' },
  { key: 'glazing_bar',     label: 'Glazing Bar',          editable: false, type: 'display', compute: computeGlazingBar },
  { key: 'single_glass',    label: 'Single Glass',         partType: 'glassPart',               property: 'singleGlassPartNo',   editable: true,  type: 'text' },
  { key: 'inner_glass',     label: 'Inner Glass',          partType: 'glassPart',               property: 'internalGlassPartNo', editable: true,  type: 'text' },
  { key: 'outer_glass',     label: 'Outer Glass',          partType: 'glassPart',               property: 'externalGlassPartNo', editable: true,  type: 'text' },
  { key: 'spacer_colour',   label: 'Spacer Colour',        partType: 'glassPart',               property: 'spacerColourId',      editable: true,  type: 'reference', referenceCategory: 'glazing_spacer_colour' },
  { key: 'gas_fill',        label: 'Gas Fill',             partType: 'glassPart',               property: 'gasFillId',           editable: true,  type: 'reference', referenceCategory: 'gas_fill' },
  { key: 'ironmongery',     label: 'Ironmongery',          partType: 'paintAndIronmongeryPart', property: 'ironmongeryFinish',   editable: true,  type: 'reference', referenceCategory: 'ironmongery_finish' },
  { key: 'surround',        label: 'Surround',             partType: null,                     property: null,                  editable: false, type: 'display' },
  { key: 'internal_finish', label: 'Internal Finish',      partType: 'paintAndIronmongeryPart', property: 'internalFinish',      editable: true,  type: 'reference', referenceCategory: 'paint_finish' },
  { key: 'external_finish', label: 'External Finish',      partType: 'paintAndIronmongeryPart', property: 'externalFinish',      editable: true,  type: 'reference', referenceCategory: 'paint_finish' },
  { key: 'cill_finish',     label: 'Cill Finish',          partType: 'paintAndIronmongeryPart', property: 'cillFinish',          editable: true,  type: 'reference', referenceCategory: 'paint_finish' },
  { key: 'poa',             label: 'POA',                  partType: 'pricePart',               property: 'poa',                 editable: true,  type: 'boolean' },
  { key: 'install_method',  label: 'Installation Method',  partType: 'notesPart',               property: 'installationMethod',  editable: true,  type: 'reference', referenceCategory: 'installation_method' },
  { key: 'fire_egress',     label: 'Fire Egress',          partType: 'notesPart',               property: 'fireEgress',          editable: true,  type: 'reference', referenceCategory: 'fire_egress' },
  { key: 'internal_hazard', label: 'Internal Hazard',      partType: 'notesPart',               property: 'internalHazard',      editable: true,  type: 'reference', referenceCategory: 'internal_hazard' },
  { key: 'internal_access', label: 'Internal Access',      partType: 'notesPart',               property: 'internalAccess',      editable: true,  type: 'reference', referenceCategory: 'access_internal' },
  { key: 'landing_access',  label: 'Landing Access',       partType: 'notesPart',               property: 'landingAccess',       editable: true,  type: 'reference', referenceCategory: 'landing_access' },
  { key: 'external_access', label: 'External Access',      partType: 'notesPart',               property: 'externalAccessId',    editable: true,  type: 'reference', referenceCategory: 'access_external' },
  { key: 'hazard_below',    label: 'Hazard Below',         partType: 'notesPart',               property: 'hazardBelow',         editable: true,  type: 'reference', referenceCategory: 'access_hazard_below' },
  { key: 'cable_alarm',     label: 'Cable/Alarm',          partType: 'notesPart',               property: 'cableAlarm',          editable: true,  type: 'reference', referenceCategory: 'access_cable_alarm' },
  { key: 'dormer_issue',    label: 'Dormer Issue',         partType: 'notesPart',               property: 'dormerIssue',         editable: true,  type: 'reference', referenceCategory: 'access_dormer' },
  { key: 'cut_back_plaster',label: 'Cut Back Plaster',     partType: 'notesPart',               property: 'cutBackPlaster',      editable: true,  type: 'boolean' },
  { key: 'cut_back_reveal', label: 'Cut Back Reveal',      partType: 'notesPart',               property: 'cutBackReveal',       editable: true,  type: 'boolean' },
  { key: 'quote_notes',     label: 'Quote Notes',          partType: 'notesPart',               property: 'quoteNotes',          editable: true,  type: 'text' },
  { key: 'installation_notes', label: 'Installation Notes', partType: 'notesPart',              property: 'installationNotes',   editable: true,  type: 'text' },
  { key: 'notes_production', label: 'Notes for Production', partType: 'notesPart',              property: 'productionNotes',     editable: true,  type: 'text' },
]
