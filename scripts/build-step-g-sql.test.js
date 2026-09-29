import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  parseGlass,
  parseWeightsAndTimber,
  parseIronmongeryParts,
  parseProducts,
  parseRules,
} from './build-step-g-sql.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('build-step-g-sql — source file counts', () => {
  it('glass parts = 75 (active only)', () => {
    const parts = parseGlass(ROOT)
    expect(parts).toHaveLength(75)
  })

  it('sash weights = 29 (2 LW lead + 21 RLZ steel + 6 SW cast)', () => {
    const parts = parseWeightsAndTimber(ROOT)
    const weights = parts.filter(p => p.category === 'Sash Weight')
    expect(weights).toHaveLength(29)
  })

  it('timber parts = 12 (3 AA each + 9 TP/TT per-metre)', () => {
    const parts = parseWeightsAndTimber(ROOT)
    const timber = parts.filter(p => p.category === 'Timber')
    expect(timber).toHaveLength(12)
  })

  it('TP/TT timber parts have unit m', () => {
    const parts = parseWeightsAndTimber(ROOT)
    const perMetre = parts.filter(p => /^(TP|TT)/.test(p.part_code))
    expect(perMetre.length).toBeGreaterThan(0)
    perMetre.forEach(p => expect(p.unit).toBe('m'))
  })

  it('AA timber parts have unit each', () => {
    const parts = parseWeightsAndTimber(ROOT)
    const aa = parts.filter(p => /^AA/.test(p.part_code))
    expect(aa.length).toBe(3)
    aa.forEach(p => expect(p.unit).toBe('each'))
  })

  it('ironmongery parts = 1058', () => {
    const parts = parseIronmongeryParts(ROOT)
    expect(parts).toHaveLength(1058)
  })

  it('products = 437', () => {
    const { products } = parseProducts(ROOT)
    expect(products).toHaveLength(437)
  })

  it('finish kits (variants) — exact count from file', () => {
    const { variants } = parseProducts(ROOT)
    // Expect > 1000; update if source changes
    expect(variants.length).toBeGreaterThan(1000)
    expect(variants.length).toBeLessThan(1200)
  })

  it('kit lines (variant_parts) = 1116', () => {
    const { variantParts } = parseProducts(ROOT)
    expect(variantParts).toHaveLength(1116)
  })

  it('default ironmongery rules = 91', () => {
    const rules = parseRules(ROOT)
    expect(rules).toHaveLength(91)
  })

  it('all glass parts have a valid unit_cost', () => {
    const parts = parseGlass(ROOT)
    const missing = parts.filter(p => !p.unit_cost && p.unit_cost !== 0)
    expect(missing).toHaveLength(0)
  })

  it('all parts have a part_code and part_name', () => {
    const glass = parseGlass(ROOT)
    const wt    = parseWeightsAndTimber(ROOT)
    const iron  = parseIronmongeryParts(ROOT)
    const all   = [...glass, ...wt, ...iron]
    const bad   = all.filter(p => !p.part_code || !p.part_name)
    expect(bad).toHaveLength(0)
  })

  it('no duplicate part_codes across all three groups', () => {
    const glass = parseGlass(ROOT)
    const wt    = parseWeightsAndTimber(ROOT)
    const iron  = parseIronmongeryParts(ROOT)
    const codes = [...glass, ...wt, ...iron].map(p => p.part_code)
    const uniq  = new Set(codes)
    expect(codes.length).toBe(uniq.size)
  })

  it('every variant references a known product short_name', () => {
    const { products, variants } = parseProducts(ROOT)
    const shortNames = new Set(products.map(p => p.short_name))
    const orphans = variants.filter(v => !shortNames.has(v.short_name))
    expect(orphans).toHaveLength(0)
  })

  it('yorkshire_sash_kit rule is inactive', () => {
    const rules = parseRules(ROOT)
    const york = rules.find(r => r.product_short_name === 'yorkshire_sash_kit')
    expect(york).toBeDefined()
    expect(york.is_active).toBe(false)
  })

  it('all bifolding_doors rules are inactive', () => {
    const rules = parseRules(ROOT)
    const bifold = rules.filter(r => r.group_name === 'bifolding_doors')
    expect(bifold.length).toBeGreaterThan(0)
    bifold.forEach(r => expect(r.is_active).toBe(false))
  })
})
