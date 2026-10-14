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
export { BENCHMARK_J, BENCHMARK_K, BENCHMARK_L, BENCHMARK_M, BENCHMARK_N, BENCHMARK_P, BENCHMARK_Q, BENCHMARK_R, BENCHMARK_S,
  BENCHMARK_SA, BENCHMARK_SB, BENCHMARK_SC, BENCHMARK_SD, BENCHMARK_SE, BENCHMARK_SF,
  BENCHMARK_TC1, BENCHMARK_TC2, BENCHMARK_TC3,
  BENCHMARK_FR1, BENCHMARK_FR2 } from './fixtureCasement.js'
export { BENCHMARK_FD1, BENCHMARK_FD2, BENCHMARK_FD3, BENCHMARK_FD3b, BENCHMARK_FD4, BENCHMARK_FD5, BENCHMARK_FD6, BENCHMARK_FD7,
  BENCHMARK_SD1, BENCHMARK_SD2, BENCHMARK_SD3, BENCHMARK_SD4,
  BENCHMARK_CD1, BENCHMARK_CD2, BENCHMARK_CD3, BENCHMARK_CD4,
  BENCHMARK_FT1, BENCHMARK_FT2, BENCHMARK_FT3, BENCHMARK_FT4,
  BENCHMARK_ST1, BENCHMARK_ST2, BENCHMARK_ST3,
  BENCHMARK_OI1, BENCHMARK_OI2, BENCHMARK_OI3, BENCHMARK_SO1 } from './fixtureDoor.js'
