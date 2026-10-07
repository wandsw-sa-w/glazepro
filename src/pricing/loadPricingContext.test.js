/**
 * loadPricingContext.test.js
 * Source-level test: verifies that both priceDrawing and the benchmark page
 * use loadPricingContext and resolveIronmongeryLines from the shared module,
 * ensuring a single pricing path.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('Single pricing path — source-level verification', () => {
  const engineSource = readFileSync(resolve(__dirname, 'pricingEngine.js'), 'utf8')
  const benchmarkSource = readFileSync(resolve(__dirname, '..', 'pages', 'dev', 'PricingBenchmark.jsx'), 'utf8')

  it('pricingEngine.js imports loadPricingContext', () => {
    expect(engineSource).toContain("import { loadPricingContext, resolveIronmongeryLines } from './loadPricingContext.js'")
  })

  it('pricingEngine.js calls loadPricingContext in priceDrawing', () => {
    expect(engineSource).toContain('await loadPricingContext(supabase,')
  })

  it('pricingEngine.js calls resolveIronmongeryLines in priceDrawing', () => {
    expect(engineSource).toContain('resolveIronmongeryLines(tree, ctx)')
  })

  it('PricingBenchmark.jsx imports loadPricingContext', () => {
    expect(benchmarkSource).toContain("import { loadPricingContext, resolveIronmongeryLines } from '../../pricing/loadPricingContext.js'")
  })

  it('PricingBenchmark.jsx calls loadPricingContext', () => {
    expect(benchmarkSource).toContain('await loadPricingContext(supabase,')
  })

  it('PricingBenchmark.jsx calls resolveIronmongeryLines', () => {
    expect(benchmarkSource).toContain('resolveIronmongeryLines(benchmark.tree, ctx)')
  })

  it('PricingBenchmark.jsx does NOT import defaultIronmonger directly', () => {
    expect(benchmarkSource).not.toContain("from '../../pricing/defaultIronmongery.js'")
  })

  it('PricingBenchmark.jsx does NOT import computeVariables directly', () => {
    // computeVariables is only used dynamically by VariablesPanel, not for pricing logic
    expect(benchmarkSource).not.toContain("import { computeVariables }")
    expect(benchmarkSource).not.toContain("import { computeVariables,")
  })
})
