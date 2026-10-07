/**
 * runStaleness.js
 * Single definition of when a drawing needs re-pricing:
 * its tree hash, its price file, OR the engine version differs from its
 * latest successful pricing run (or it has no successful run at all).
 *
 * Used by QuoteMatrixPage and QuoteOverview so the two cannot disagree.
 * Published quotes are never re-priced — callers only apply this to open
 * quotes; published ones keep their snapshot.
 */

import { PRICING_ENGINE_VERSION } from './engineVersion.js'

/**
 * @param {object|null} run - latest completed pricing_runs row
 *        ({ price_file_id, tree_hash, engine_version, status })
 * @param {object} [opts]
 * @param {string|null} [opts.currentTreeHash]     - treeHash(tree) of the current
 *        tree; pass null when the tree is not loaded (check is then skipped)
 * @param {string|null} [opts.expectedPriceFileId] - the price file the drawing
 *        should be priced with; pass null to skip the check
 * @returns {boolean}
 */
export function isRunStale(run, { currentTreeHash = null, expectedPriceFileId = null } = {}) {
  if (!run) return true
  if (expectedPriceFileId && run.price_file_id !== expectedPriceFileId) return true
  if (currentTreeHash && run.tree_hash && run.tree_hash !== currentTreeHash) return true
  if (pricedWithOlderEngine(run)) return true
  return false
}

/**
 * True when the run exists but was produced by an older engine version.
 * Runs from before sql/step-t2-engine-version.sql have engine_version NULL
 * and count as older — they predate the complete pricing path.
 */
export function pricedWithOlderEngine(run) {
  if (!run) return false
  return (run.engine_version ?? null) !== PRICING_ENGINE_VERSION
}
