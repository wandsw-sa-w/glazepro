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
 * loadPricingContext path feeding priceDrawing.
 */

export const PRICING_ENGINE_VERSION = 2
