/**
 * engineVersion.js
 * The pricing engine version, stored on every pricing_runs row
 * (sql/step-t2-engine-version.sql).
 *
 * Bump this BY HAND whenever pricing logic changes — rule evaluation,
 * variable computation, catalogue loading, allocation, weights — so that
 * drawings priced under the old logic show "Priced with an older version"
 * and are picked up by re-pricing even when their tree and price file are
 * unchanged.
 *
 * Version 1 is the implicit version of every run recorded before this
 * column existed (engine_version NULL), including runs from the old
 * incomplete path that priced real quotes with no glass catalogue, part
 * costs or ironmongery. Version 2 is the first version with the shared
 * loadPricingContext path feeding priceDrawing. Version 3 maps the real
 * stored option codes to engine flags (src/pricing/optionVocabulary.js):
 * runs priced under version 2 silently missed glass lines and the
 * softwood/utile material rules on real drawings. Version 4 is the Step V
 * geometry fix: assemblyFramePart.width/height are the OVERALL frame and
 * sash/glass/weight sizes come from the drawn geometry (derivedGeometry.js)
 * — version-3 runs over-priced every frame-size rule on real drawings.
 * Version 5 is the Step W measured sash-weight model (timber from drawn
 * sizes without the horn, glass at CUT size, bars at 0.302 kg/m, item
 * weight 1.1 × sashes for sash replacements): version-4 runs under-
 * weighted every cord-hung sash and mis-sized its counterweights.
 * Version 6 closes the Step X open lines (step-y brief): gross sash
 * height uses the drawing's horn length plus the chamfered-bottom-rail
 * allowance (no 70 mm constant, no sashLip), frame metre width/height
 * round half-up to 2 dp, pricing weight is cut to 1 dp, and null outer
 * jambs mean no extension — version-5 runs were pennies off on every
 * Laminated/bead/steel line.
 */

export const PRICING_ENGINE_VERSION = 6
