/**
 * runStaleness.test.js
 * A drawing is re-priced when its tree hash, its price file, or the engine
 * version differs from its latest successful run. These tests pin that rule
 * and (source-level) that both pages use the shared definition and that
 * priceDrawing stores the engine version.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { isRunStale, pricedWithOlderEngine } from './runStaleness.js'
import { PRICING_ENGINE_VERSION } from './engineVersion.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CURRENT_RUN = {
  price_file_id: 'pf30',
  tree_hash: 'hash-a',
  engine_version: PRICING_ENGINE_VERSION,
  status: 'complete',
}

describe('isRunStale', () => {
  it('no run at all → stale', () => {
    expect(isRunStale(null)).toBe(true)
    expect(isRunStale(undefined, { currentTreeHash: 'hash-a', expectedPriceFileId: 'pf30' })).toBe(true)
  })

  it('tree hash differs → stale', () => {
    expect(isRunStale(CURRENT_RUN, { currentTreeHash: 'hash-b', expectedPriceFileId: 'pf30' })).toBe(true)
  })

  it('price file differs → stale', () => {
    expect(isRunStale(CURRENT_RUN, { currentTreeHash: 'hash-a', expectedPriceFileId: 'pf31' })).toBe(true)
  })

  it('engine version differs → stale, even with same tree and price file', () => {
    const oldRun = { ...CURRENT_RUN, engine_version: PRICING_ENGINE_VERSION - 1 }
    expect(isRunStale(oldRun, { currentTreeHash: 'hash-a', expectedPriceFileId: 'pf30' })).toBe(true)
  })

  it('pre-step-T2 run (engine_version NULL) → stale', () => {
    const nullRun = { ...CURRENT_RUN, engine_version: null }
    expect(isRunStale(nullRun, { currentTreeHash: 'hash-a', expectedPriceFileId: 'pf30' })).toBe(true)
    const missingRun = { price_file_id: 'pf30', tree_hash: 'hash-a', status: 'complete' }
    expect(isRunStale(missingRun, { currentTreeHash: 'hash-a', expectedPriceFileId: 'pf30' })).toBe(true)
  })

  it('everything matches → not stale', () => {
    expect(isRunStale(CURRENT_RUN, { currentTreeHash: 'hash-a', expectedPriceFileId: 'pf30' })).toBe(false)
  })

  it('tree not loaded (null hash) skips only the hash check', () => {
    expect(isRunStale(CURRENT_RUN, { currentTreeHash: null, expectedPriceFileId: 'pf30' })).toBe(false)
    const oldRun = { ...CURRENT_RUN, engine_version: null }
    expect(isRunStale(oldRun, { currentTreeHash: null, expectedPriceFileId: 'pf30' })).toBe(true)
  })
})

describe('pricedWithOlderEngine', () => {
  it('current version → false; older or missing version → true; no run → false', () => {
    expect(pricedWithOlderEngine(CURRENT_RUN)).toBe(false)
    expect(pricedWithOlderEngine({ ...CURRENT_RUN, engine_version: 1 })).toBe(true)
    expect(pricedWithOlderEngine({ ...CURRENT_RUN, engine_version: null })).toBe(true)
    expect(pricedWithOlderEngine(null)).toBe(false)
  })
})

describe('Engine version — stored and used from one module', () => {
  it('PRICING_ENGINE_VERSION is an integer starting at 2', () => {
    expect(Number.isInteger(PRICING_ENGINE_VERSION)).toBe(true)
    expect(PRICING_ENGINE_VERSION).toBeGreaterThanOrEqual(2)
  })

  const engineSource  = readFileSync(resolve(__dirname, 'pricingEngine.js'), 'utf8')
  const matrixSource  = readFileSync(resolve(__dirname, '..', 'pages', 'QuoteMatrixPage.jsx'), 'utf8')
  const overviewSource = readFileSync(resolve(__dirname, '..', 'pages', 'QuoteOverview.jsx'), 'utf8')

  it('priceDrawing stores engine_version on pricing_runs', () => {
    expect(engineSource).toContain('engine_version: PRICING_ENGINE_VERSION')
  })

  it('QuoteMatrixPage and QuoteOverview use the shared staleness module', () => {
    expect(matrixSource).toContain("from '../pricing/runStaleness.js'")
    expect(overviewSource).toContain("from '../pricing/runStaleness.js'")
  })

  it('both pages select engine_version with the latest runs', () => {
    expect(matrixSource).toContain('engine_version')
    expect(overviewSource).toContain('engine_version')
  })

  it('Re-price all exists and published quotes are never re-priced', () => {
    expect(matrixSource).toContain('Re-price all')
    expect(matrixSource).toContain("if (q.status !== 'Open') return")
  })
})
