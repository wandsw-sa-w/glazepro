/**
 * sashWeight.js
 * Sliding-sash weight, MEASURED from Integrate on 7 Oct 2026
 * (docs/step-w-sash-weight-brief.md — the measurement table is fact).
 *
 * The model, which reproduces the measurement rows:
 *   timber_kg = density × thickness ×
 *               [ 2 × stile × drawn sash height
 *                 + (own rail + meeting rail) × (sash width − 2 × stile) ] / 1e9
 *   glass_kg  = CUT size (sightline + 2 × (rebate − tolerance) per axis, the
 *               same cut the glass PRICE uses, from the profile values —
 *               missing value = error, as elsewhere)
 *               × (inner + outer pane thickness) × 2.5 kg/m²/mm,
 *               ONE unit per sash — bars do not split the glass for weight
 *   bars_kg   = 0.302 kg per metre of bar, full sightline lengths, no
 *               deduction at crossings; independent of thickness and timber
 *   The HORN is NOT in the weight (measurement rows 10 vs 11).
 *
 * Item weight for a SASH REPLACEMENT = 1.1 × (top + bottom); measured only
 * for sash replacements — not applied to other types of work.
 *
 * Known open question (measurement row 10): 6.8 mm Acoustic Laminated
 * behaves like ~6.0 mm of glass in Integrate; the model uses the
 * catalogue thickness as-is and the difference is reported, not fitted.
 */

import { timberFamily, TIMBER_FAMILY_DENSITIES, glazingType } from './optionVocabulary.js'
import { sashSizes } from './derivedGeometry.js'

// ── Timber density constants (kg/m³) — from Integrate Weight Calc page ────────
// Kept as an alias of the vocabulary module's family densities so existing
// imports keep working; the lookup itself goes code → family → density.
export const TIMBER_DENSITIES = TIMBER_FAMILY_DENSITIES

// ── Measured constants ────────────────────────────────────────────────────────
export const KG_PER_M2_PER_MM = 2.5       // glass: kg per m² per mm thickness
export const KG_PER_LB        = 1 / 2.20462

// Glazing bar rate, measured for the 22 mm bar ONLY
// (docs/step-w-sash-weight-brief.md §4 — 0.302 = 22 × 27 mm at 508.3 kg/m³).
// Other bar widths are unmeasured and use the same rate until measured.
export const GLAZING_BAR_KG_PER_M = 0.302

// Item weight factor for a sash replacement (brief §5): item weight =
// 1.1 × (top + bottom sash weight). Measured ONLY for sash replacements.
export const SASH_REPLACEMENT_ITEM_WEIGHT_FACTOR = 1.1

// ── Tree helpers (local copies, same logic as pricingEngine.js) ───────────────

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compute the weight of a single sliding sash from the DRAWN sash sizes.
 *
 * Step V (docs/step-v-geometry-brief.md): sash width and heights come from
 * computeDerived / computeSashGeometry — the same sizes the board draws and
 * Integrate labels on its drawings — via src/pricing/derivedGeometry.js.
 * The earlier outer-frame derivation (outerWidth − 2 × outer jamb, plus a
 * bottom-sash cill extension) is gone; the resulting weight changes are
 * REPORTED, not pulled back with constants.
 *
 * Timber volume model:
 *   - Stiles:       2 × sashThickness × stileWidth × grossSashHeight  (horns incl.)
 *   - Rail:         sashThickness × railHeight × sightlineWidth        (between stiles)
 *   - Meeting rail: sashThickness × midrailHeight × sightlineWidth     (between stiles)
 *   - Horiz bars:   barsHigh × BAR_WIDTH × BAR_THICKNESS × sightlineWidth
 *   - Vert bars:    barsWide × BAR_WIDTH × BAR_THICKNESS × sightlineHeight
 *
 * Glass weight:
 *   glass_area = sightlineWidth × sightlineHeight  (+ GLAZING_REBATE_MM on each side)
 *   glass_kg   = glass_area_m² × (inner_t + outer_t) × KG_PER_M2_PER_MM
 *
 * @param {Object} sashNode      - topSashPart or bottomSashPart node
 * @param {Object} tree          - Root parts tree node
 * @param {Object} glassCatalogue - { partCode: { cost_per_m2, thickness_mm } }
 * @returns {{
 *   weight_in_kg: number,
 *   weight_in_lb: number,
 *   weight_incl_panel_in_kg: number,
 *   weight_incl_panel_in_lb: number,
 *   gross_sash_height_in_mm: number,
 *   gross_sash_width_in_mm:  number,
 *   sash_thickness:          number,
 *   _debug: Object
 * }}
 */
export function computeSashWeight(sashNode, tree, glassCatalogue = {}, profileValues = {}) {
  const isTop = sashNode.part_type === 'topSashPart'
  const sv    = sashNode.values ?? {}

  // ── Structural nodes ──────────────────────────────────────────────────────
  const item  = findFirst(tree, 'drawingItemPart')
  const pair  = findFirst(tree, 'sashPairPart')
  const pv    = pair?.values ?? {}

  const midrailHeight   = pv.midrailHeight  ?? 40
  const sashThickness   = pv.sashThickness  ?? 45
  const stileWidth      = sv.leftWidth ?? 47

  // ── Drawn sash sizes (one geometry source — derivedGeometry.js) ──────────
  const sz = sashSizes(tree)

  const gross_sash_width  = sz.sashWidth ?? 0
  const sightlineWidth    = gross_sash_width - 2 * stileWidth
  const sightlineHeight   = (isTop ? sz.topGlassHeight : sz.bottomGlassHeight) ?? 0
  const drawnHeight       = (isTop ? sz.topSashHeight : sz.bottomSashHeight) ?? 0

  const railHeight = isTop ? (sv.topHeight ?? 49) : (sv.bottomHeight ?? 88)

  // The horn is NOT in the weight (measurement rows 10 vs 11).
  const gross_sash_height = drawnHeight

  // ── Glazing bars from glass child ────────────────────────────────────────
  // Real drawings store bars as child parts; legacy barsWide/barsHigh counts
  // are the fallback (same preference as the pricing engine).
  const glassNode = (sashNode.children ?? []).find(c => c.part_type === 'glassPart')
  const gv        = glassNode?.values ?? {}
  const vBarParts = (glassNode?.children ?? []).filter(c => c.part_type === 'verticalGlazingBarPart').length
  const hBarParts = (glassNode?.children ?? []).filter(c => c.part_type === 'horizontalGlazingBarPart').length
  const hasActualBars = vBarParts > 0 || hBarParts > 0
  const barsWide  = hasActualBars ? vBarParts : (gv.barsWide ?? 0)   // vertical bars
  const barsHigh  = hasActualBars ? hBarParts : (gv.barsHigh ?? 0)   // horizontal bars

  // ── Timber (measured model, brief §1) ────────────────────────────────────
  // density × thickness × [2 × stile × drawn height + (rail + meeting rail)
  // × (sash width − 2 × stile)]
  const timber_vol_mm3 =
    sashThickness * (2 * stileWidth * drawnHeight +
                     (railHeight + midrailHeight) * sightlineWidth)

  // Timber density — real timber_species code → family → density.
  // Families with no Integrate density fall back to the softwood figure;
  // collectVocabularyWarnings() reports that case rather than hiding it.
  const sashMaterialId    = item?.values?.sashMaterialId ?? 'softwood'
  const family            = timberFamily(sashMaterialId)
  const density_kg_per_m3 = TIMBER_FAMILY_DENSITIES[family] ?? 508.3
  const timber_kg = timber_vol_mm3 / 1e9 * density_kg_per_m3

  // ── Glass weight — CUT size, one unit per sash (brief §3) ────────────────
  // Cut = sightline + 2 × (rebate − tolerance) per axis, the same cut the
  // glass PRICE uses. The rebate/tolerance come from the profile values,
  // keyed by glazing type; a missing value is an error, as elsewhere.
  const gType = glazingType(gv.glazingId)
  const rebateKey = gType === 'single' ? 'defaultSingleGlazingRebateWidthForSash'
    : gType === 'triple' ? 'defaultTripleGlazingRebateWidthForSash'
    : gType === 'heritage' ? 'defaultHeritageGlazingRebateWidthForSash'
    : 'defaultDoubleGlazingRebateWidthForSash'
  const toleranceKey = gType === 'single' ? 'defaultSingleGlazingTolerance'
    : gType === 'triple' ? 'defaultTripleGlazingTolerance'
    : gType === 'heritage' ? 'defaultHeritageGlazingTolerance'
    : 'defaultDoubleGlazingTolerance'
  const rebateWidth = profileValues[rebateKey]
  const tolerance   = profileValues[toleranceKey]
  if (rebateWidth == null || tolerance == null) {
    throw new Error(`Missing profile values for sash weight glass cut size: ${rebateKey}=${rebateWidth}, ${toleranceKey}=${tolerance}. Check the drawing's profile has glassPart rebate and tolerance values.`)
  }
  const cover = rebateWidth - tolerance   // mm beyond sightline per edge

  const paneWidth  = sightlineWidth  + 2 * cover
  const paneHeight = sightlineHeight + 2 * cover
  const glass_area_m2 = paneWidth * paneHeight / 1e6

  // Pane thicknesses from catalogue; fallback to 4 + 4 mm
  const innerEntry = glassCatalogue[gv.internalGlassPartNo] ?? null
  const outerEntry = glassCatalogue[gv.externalGlassPartNo] ?? null
  const inner_t    = innerEntry?.thickness_mm ?? 4
  const outer_t    = outerEntry?.thickness_mm ?? 4

  const glass_kg = glass_area_m2 * (inner_t + outer_t) * KG_PER_M2_PER_MM

  // ── Glazing bars — fixed measured rate (brief §4) ────────────────────────
  // Full sightline lengths, no deduction at crossings; independent of sash
  // thickness and timber. Measured for the 22 mm bar only.
  const bar_length_m = (barsWide * sightlineHeight + barsHigh * sightlineWidth) / 1000
  const bars_kg = bar_length_m * GLAZING_BAR_KG_PER_M

  // ── Final weights ─────────────────────────────────────────────────────────
  const weight_in_kg = timber_kg + glass_kg + bars_kg
  const weight_in_lb = weight_in_kg * 2.20462

  // weight_incl_panel: panel volume not yet in tree — same as weight without panel
  const weight_incl_panel_in_kg = weight_in_kg
  const weight_incl_panel_in_lb = weight_in_lb

  return {
    weight_in_kg,
    weight_in_lb,
    weight_incl_panel_in_kg,
    weight_incl_panel_in_lb,
    gross_sash_height_in_mm: gross_sash_height,
    gross_sash_width_in_mm:  gross_sash_width,
    sash_thickness:          sashThickness,
    // Debug breakdown (useful in tests)
    _debug: {
      sashMaterialId,
      density_kg_per_m3,
      gross_sash_width,
      gross_sash_height,
      sightlineWidth,
      sightlineHeight,
      timber_vol_mm3,
      timber_kg,
      glass_area_m2,
      inner_t,
      outer_t,
      glass_kg,
      bar_length_m,
      bars_kg,
    },
  }
}
