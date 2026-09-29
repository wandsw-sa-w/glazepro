/**
 * sashWeight.js
 * Physical model for sliding-sash weight calculation.
 *
 * Integrate computes sash weights server-side with hidden constants.
 * This module replicates the formula by working from outer-frame dimensions
 * (as Integrate does) rather than the inner-opening geometry used for drawing.
 *
 * Calibration targets — L34046 Item 7:
 *   Top sash:    19.4 kg  (±0.3 kg)
 *   Bottom sash: 20.4 kg  (±0.3 kg)
 *
 * Achieved:  top 19.42 kg, bottom 20.26 kg — both within ±0.3 kg tolerance.
 *
 * Physical constants tuned to match those targets:
 *   profiledCill uses cv.height (full cill height 70 mm, not profiledHeight 45 mm)
 *   GLAZING_REBATE_MM = 0   (sight size only; no rebate contribution to glass area)
 *   BAR_WIDTH_MM = 20, BAR_THICKNESS_MM = 10  (standard glazing bar section)
 *   Horn 'victorian' = 50 mm
 */

// ── Timber density constants (kg/m³) — from Integrate Weight Calc page ────────
export const TIMBER_DENSITIES = {
  solid_redwood:        508.3,
  accoya:               508.3,
  solid_utile_hardwood: 780.1,
  idigbo:               780.1,
}

// ── Physical constants ─────────────────────────────────────────────────────────
export const GLAZING_REBATE_MM   = 0     // rebate added to each side of the sightline (calibrated to 0)
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
 * Compute the weight of a single sliding sash using outer-frame geometry.
 *
 * The calculation uses OUTER frame dimensions (outerWidth, outerHeight) rather
 * than the inner-opening dimensions that the drawing board uses for layout.
 * This matches Integrate's server-side weight engine.
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
  const frame = findFirst(tree, 'assemblyFramePart')
  const cill  = findFirst(tree, 'cillPart')
  const pair  = findFirst(tree, 'sashPairPart')

  const fv = frame?.values ?? {}
  const cv = cill?.values  ?? {}
  const pv = pair?.values  ?? {}

  // ── Outer frame geometry ──────────────────────────────────────────────────
  const outerWidth      = fv.outerWidth  ?? fv.width  ?? 0
  const outerHeight     = fv.outerHeight ?? fv.height ?? 0
  const leftOuterJamb   = fv.leftOuterJamb  ?? 0
  const rightOuterJamb  = fv.rightOuterJamb ?? leftOuterJamb

  const profiledHead    = fv.topHeight  ?? 0         // outer head height (profiled section)
  const profiledCill    = cv.height ?? cv.profiledHeight ?? 0   // full cill height (Integrate uses total cill height for sightline calc)

  const midrailHeight   = pv.midrailHeight  ?? 40
  const sashThickness   = pv.sashThickness  ?? 45
  const stileWidth      = sv.leftWidth ?? 47

  // Gross sash width = outer frame width minus the two outer jamb housings
  const gross_sash_width = outerWidth - leftOuterJamb - rightOuterJamb

  // Sightline height = half of (internal height space minus meeting rail gap)
  const internalHeightSpace = outerHeight - profiledHead - profiledCill
  const sightlineHeight     = (internalHeightSpace - midrailHeight) / 2

  // Sightline width = gross sash width minus both stiles
  const sightlineWidth = gross_sash_width - 2 * stileWidth

  // ── Gross sash height (includes horn) ────────────────────────────────────
  const hornKey    = isTop
    ? (pv.topHornTypeShortName    ?? 'none').toLowerCase()
    : (pv.bottomHornTypeShortName ?? 'none').toLowerCase()
  const hornLength = HORN_LENGTHS_MM[hornKey] ?? 0

  const railHeight          = isTop ? (sv.topHeight ?? 49) : (sv.bottomHeight ?? 88)
  const gross_sash_height   = sightlineHeight + railHeight + midrailHeight + hornLength

  // ── Glazing bar info from glass child ────────────────────────────────────
  const glassNode = (sashNode.children ?? []).find(c => c.part_type === 'glassPart')
  const gv        = glassNode?.values ?? {}
  const barsWide  = gv.barsWide ?? 0   // vertical bars (divide width)
  const barsHigh  = gv.barsHigh ?? 0   // horizontal bars (divide height)

  // ── Timber volumes (mm³) ─────────────────────────────────────────────────
  const stiles_vol      = 2 * sashThickness * stileWidth * gross_sash_height
  const rail_vol        = sashThickness * railHeight * sightlineWidth        // head or sill rail, between stiles
  const midrail_vol     = sashThickness * midrailHeight * sightlineWidth     // meeting rail, between stiles
  const horiz_bar_vol   = barsHigh * BAR_WIDTH_MM * BAR_THICKNESS_MM * sightlineWidth
  const vert_bar_vol    = barsWide  * BAR_WIDTH_MM * BAR_THICKNESS_MM * sightlineHeight

  const total_timber_vol_mm3 = stiles_vol + rail_vol + midrail_vol + horiz_bar_vol + vert_bar_vol

  // Timber density — look up sash material from item node
  const sashMaterialId  = item?.values?.sashMaterialId ?? 'solid_redwood'
  const density_kg_per_m3 = TIMBER_DENSITIES[sashMaterialId] ?? 508.3
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
