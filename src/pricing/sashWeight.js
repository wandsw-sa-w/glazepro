/**
 * sashWeight.js
 * Physical model for sliding-sash weight calculation.
 *
 * Integrate computes sash weights server-side with hidden constants.
 * This module replicates the formula by working from outer-frame dimensions
 * (as Integrate does) rather than the inner-opening geometry used for drawing.
 *
 * Integrate's weight figures (facts): L34046 Item 7 top 19.4 / bottom
 * 20.4 kg; Benchmark A top 17.2 / bottom 17.3 kg (before the 15% Lead
 * Weight wastage).
 *
 * Step V replaced the outer-frame derivation (and its tuned cill
 * extension) with the DRAWN sash sizes from computeDerived. Where the
 * computed weights now differ from Integrate's figures, the gap is
 * reported — never pulled back with a constant.
 *
 * Remaining physical constants:
 *   GLAZING_REBATE_MM = 0   (sight size only; no rebate contribution to glass area)
 *   BAR_WIDTH_MM = 20, BAR_THICKNESS_MM = 10  (standard glazing bar section)
 *   Horn 'victorian' = 50 mm (weight model; the pricing engine's gross
 *   height uses 70 mm — a known, reported inconsistency)
 */

import { timberFamily, TIMBER_FAMILY_DENSITIES, hornKind } from './optionVocabulary.js'
import { sashSizes } from './derivedGeometry.js'

// ── Timber density constants (kg/m³) — from Integrate Weight Calc page ────────
// Kept as an alias of the vocabulary module's family densities so existing
// imports keep working; the lookup itself goes code → family → density.
export const TIMBER_DENSITIES = TIMBER_FAMILY_DENSITIES

// ── Physical constants ─────────────────────────────────────────────────────────
// Glass pane dimensions for weight use the SIGHTLINE, not the cut size.
// Evidence: using cut size (sightline + 24mm per axis) gave weights ~0.9 kg
// too heavy (L34046 20.28/21.21 vs Integrate 19.4/20.4). Pricing uses the
// cut size for glass cost/area; weight uses sightline — the two differ and
// this is evidence-based, not a preference.
export const GLAZING_REBATE_MM   = 0     // rebate added to each side of the sightline for weight calc
export const BAR_WIDTH_MM        = 20    // glazing bar width (face dimension, mm)
export const BAR_THICKNESS_MM    = 10    // glazing bar depth (thickness, mm)
export const KG_PER_M2_PER_MM    = 2.5  // glass density factor: kg per m² per mm thickness
export const KG_PER_LB           = 1 / 2.20462

// Horn lengths in mm by shortName (lower-cased)
export const HORN_LENGTHS_MM = {
  victorian: 50,
  none:       0,
}

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
export function computeSashWeight(sashNode, tree, glassCatalogue = {}) {
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

  // ── Gross sash height (drawn height + horn) ──────────────────────────────
  // 'none' and 'no_horn' both mean no horn (optionVocabulary.js)
  const hornCode   = isTop ? pv.topHornTypeShortName : pv.bottomHornTypeShortName
  const hornLength = HORN_LENGTHS_MM[hornKind(hornCode) ?? 'none'] ?? 0

  const railHeight = isTop ? (sv.topHeight ?? 49) : (sv.bottomHeight ?? 88)

  const drawnHeight = (isTop ? sz.topSashHeight : sz.bottomSashHeight) ?? 0
  const gross_sash_height = drawnHeight + hornLength

  // ── Glazing bar info from glass child ────────────────────────────────────
  // Real drawings store bars as child parts; legacy barsWide/barsHigh counts
  // are the fallback (same preference as the pricing engine).
  const glassNode = (sashNode.children ?? []).find(c => c.part_type === 'glassPart')
  const gv        = glassNode?.values ?? {}
  const vBarParts = (glassNode?.children ?? []).filter(c => c.part_type === 'verticalGlazingBarPart').length
  const hBarParts = (glassNode?.children ?? []).filter(c => c.part_type === 'horizontalGlazingBarPart').length
  const hasActualBars = vBarParts > 0 || hBarParts > 0
  const barsWide  = hasActualBars ? vBarParts : (gv.barsWide ?? 0)   // vertical bars (divide width)
  const barsHigh  = hasActualBars ? hBarParts : (gv.barsHigh ?? 0)   // horizontal bars (divide height)

  // ── Timber volumes (mm³) ─────────────────────────────────────────────────
  const stiles_vol      = 2 * sashThickness * stileWidth * gross_sash_height
  const rail_vol        = sashThickness * railHeight * sightlineWidth        // head or sill rail, between stiles
  const midrail_vol     = sashThickness * midrailHeight * sightlineWidth     // meeting rail, between stiles
  const horiz_bar_vol   = barsHigh * BAR_WIDTH_MM * BAR_THICKNESS_MM * sightlineWidth
  const vert_bar_vol    = barsWide  * BAR_WIDTH_MM * BAR_THICKNESS_MM * sightlineHeight

  const total_timber_vol_mm3 = stiles_vol + rail_vol + midrail_vol + horiz_bar_vol + vert_bar_vol

  // Timber density — real timber_species code → family → density.
  // Families with no Integrate density fall back to the softwood figure;
  // collectVocabularyWarnings() reports that case rather than hiding it.
  const sashMaterialId    = item?.values?.sashMaterialId ?? 'softwood'
  const family            = timberFamily(sashMaterialId)
  const density_kg_per_m3 = TIMBER_FAMILY_DENSITIES[family] ?? 508.3
  const timber_kg = total_timber_vol_mm3 / 1e9 * density_kg_per_m3

  // ── Glass weight ─────────────────────────────────────────────────────────
  const paneWidth  = sightlineWidth + 2 * GLAZING_REBATE_MM
  const paneHeight = sightlineHeight + 2 * GLAZING_REBATE_MM
  const glass_area_m2 = paneWidth * paneHeight / 1e6

  // Pane thicknesses from catalogue; fallback to 4 + 4 mm
  const innerEntry = glassCatalogue[gv.internalGlassPartNo] ?? null
  const outerEntry = glassCatalogue[gv.externalGlassPartNo] ?? null
  const inner_t    = innerEntry?.thickness_mm ?? 4
  const outer_t    = outerEntry?.thickness_mm ?? 4

  const glass_kg = glass_area_m2 * (inner_t + outer_t) * KG_PER_M2_PER_MM

  // ── Final weights ─────────────────────────────────────────────────────────
  const weight_in_kg = timber_kg + glass_kg
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
      hornLength,
      total_timber_vol_mm3,
      timber_kg,
      glass_area_m2,
      inner_t,
      outer_t,
      glass_kg,
    },
  }
}
