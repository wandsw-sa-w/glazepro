/**
 * benchmarks/index.js
 * Three pricing benchmark fixtures with targets, used by both the
 * PricingBenchmark page and the vitest test suite.
 *
 * Fixture A — Sash replacement (L31115 Item 1, Drawing 4)
 * Fixture B — Draught seal and overhaul (L31115 Item 2, Drawing 12)
 * Fixture L34046 — Complete new box sash (L34046 Item 7)
 *
 * Each export: { tree, targets, glassCatalogue, partCostMap,
 *                partAllocationRules, ironmongeryRules,
 *                ironmongeryCatalogue, assumptions }
 */

export { BENCHMARK_L34046 } from './fixtureL34046.js'
export { BENCHMARK_A, BENCHMARK_A35, BENCHMARK_A40, BENCHMARK_A50, BENCHMARK_A35_H1700, BENCHMARK_F, BENCHMARK_G } from './fixtureA.js'
export { BENCHMARK_B, BENCHMARK_B_UNCORRECTED, BENCHMARK_H, BENCHMARK_I } from './fixtureB.js'
export { BENCHMARK_C } from './fixtureC.js'
export { BENCHMARK_D } from './fixtureD.js'
export { BENCHMARK_E } from './fixtureE.js'
