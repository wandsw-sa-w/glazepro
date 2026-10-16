// gridBenchmarks.test.js — Step BP item 4
//
// DG1 = G1 (French doors with side casements over panels), DG2 = G2 (a single
// door beside two casements over two all-panel casements), DM1 = M1 (a single
// door with a muntin below its mid rail) and FT5 = P1 (the front door set:
// special glass, bolection panels, a full-height muntin, a POA line), each
// against Integrate's own figures from docs/integrate-drawing-gaps.txt.
//
// Every group that is exact is asserted exact; what is not is DECLARED on the
// fixture — a decided difference, an open question or pending data — and the
// total is asserted to be Integrate's plus exactly those declarations, so
// nothing can drift unseen. The e2e smoke test pins the same figures on the
// live page.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import { runPricingOnTree } from '../pricingEngine.js'
import { allocatedSectionParts, leafCells, doorLeaves } from '../doorGeometry.js'
import { frameCells } from '../casementGeometry.js'
import { isSpecialGlassUnit } from '../poaLines.js'
import { BENCHMARK_DG1, BENCHMARK_DG2, BENCHMARK_DM1, BENCHMARK_FT5 } from './fixtureDoor.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = resolve(HERE, 'pf30-snapshot.json')
const SNAPSHOT = existsSync(SNAPSHOT_PATH) ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) : null
const d = describe.skipIf(SNAPSHOT === null)

const r2 = x => Math.round(x * 100) / 100

function run(bm) {
  return runPricingOnTree(bm.tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
    glassCatalogue: SNAPSHOT.glassCatalogue,
    partAllocationRules: SNAPSHOT.partAllocationRules,
    partCostMap: bm.partCostMap,
    ironmongeryLines: bm.ironmongeryLines,
    ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
    profileValues: bm.profileValues,
    profileCode: bm.profileCode,
  })
}

const groups = r => {
  const g = {}
  for (const l of r.price.lines) {
    if (!l.fires || l.error) continue
    const k = l.group_name ?? '(ungrouped)'
    g[k] = r2((g[k] ?? 0) + l.line_cost)
  }
  return g
}
const minutes = (r, name) => r.manufacture_labour.lines.concat(r.install_labour.lines)
  .filter(l => l.fires && !l.error && l.name === name)
  .reduce((n, l) => n + l.minutes, 0)
const declared = bm => r2((bm.deliberateDifference?.cost ?? 0) + (bm.openQuestion?.cost ?? 0) +
  (bm.parkedResidual?.cost ?? 0) + (bm.pendingDecision?.cost ?? 0))
const sectionsOf = bm => Object.fromEntries(allocatedSectionParts(bm.tree).map(s => [s.part_code, s.length_mm]))
const findAll = (node, type, acc = []) => {
  if (node?.part_type === type) acc.push(node)
  for (const c of (node?.children ?? [])) findAll(c, type, acc)
  return acc
}

/** The total is Integrate's plus exactly what the fixture declares; the named groups are exact. */
function expectDeclared(bm, { exactGroups }) {
  const r = run(bm)
  const t = bm.targets
  expect(r.price.total_cost, 'total cost').toBeCloseTo(t.total_cost + declared(bm), 2)
  const g = groups(r)
  for (const k of exactGroups) expect(g[k] ?? 0, k).toBeCloseTo(t.groups[k].cost, 2)
  return r
}

// ── The geometry Integrate stores, cell for cell ─────────────────────────────

d('Step BP — the cells are Integrate’s', () => {
  it('DG1: 690 / 1544 / 690 columns; every leaf and side casement glass 1247 or 1298 over a 450 panel', () => {
    const t = BENCHMARK_DG1.tree
    expect(frameCells(t).map(c => [c.width, c.height])).toEqual([[690, 2146], [1544, 2146], [690, 2146]])
    for (const l of doorLeaves(t)) {
      expect(leafCells(t, l).map(c => [c.width, c.height])).toEqual([[562, 1247], [562, 450]])
    }
    for (const s of findAll(t, 'casementSashPart')) {
      expect(leafCells(t, s).map(c => [c.width, c.height])).toEqual([[564, 1298], [564, 450]])
    }
  })

  it('DG2: the SHORT transom leaves the door column full height', () => {
    const t = BENCHMARK_DG2.tree
    expect(frameCells(t).map(c => [c.width, c.height]))
      .toEqual([[837, 962.5], [837, 962.5], [900, 1966], [837, 962.5], [837, 962.5]])
    // A2 / B2 hold one cell each, and it is a panel
    const panelled = findAll(t, 'casementSashPart').filter(s => s.key.endsWith('2'))
    expect(panelled).toHaveLength(2)
    for (const s of panelled) {
      expect(leafCells(t, s)).toHaveLength(1)
      expect(findAll(s, 'glassPart')).toEqual([])
      expect(findAll(s, 'panelPart')).toHaveLength(1)
    }
  })

  it('DM1: one glass over two panels — the muntin starts at the rail', () => {
    const t = BENCHMARK_DM1.tree
    const leaf = doorLeaves(t)[0]
    expect(leafCells(t, leaf).map(c => [c.col, c.row, c.width, c.height]))
      .toEqual([[0, 0, 610, 835], [0, 1, 245, 733], [1, 1, 245, 733]])
  })

  it('FT5: two glass over two panels in the leaf, every glass unit special', () => {
    const t = BENCHMARK_FT5.tree
    expect(frameCells(t).map(c => [c.width, c.height]))
      .toEqual([[300, 595.5], [874, 595.5], [300, 595.5], [300, 2166.5], [874, 2166.5], [300, 2166.5]])
    const leaf = doorLeaves(t)[0]
    expect(leafCells(t, leaf).map(c => [c.width, c.height]))
      .toEqual([[263, 832.5], [263, 832.5], [263, 837], [263, 837]])
    const units = findAll(t, 'glassPart')
    expect(units).toHaveLength(7)
    expect(units.every(isSpecialGlassUnit)).toBe(true)
  })
})

// ── The Utile sections ───────────────────────────────────────────────────────

d('Step BP — the Utile sections Integrate allocates on these items', () => {
  // Integrate's lengths, in metres to 2 dp (docs/integrate-drawing-gaps.txt):
  //   G1: 63x120 10.11, 63x200 9.13, 63x63 9.98, 67x96 7.56
  //   G2: 63x120 4.81,  63x200 5.31, 63x63 11.07, 63x96 1.67, 67x96 6.85
  //   M1: 63x120 4.85,  63x200 2.58, 67x96 5.13
  it('G1: an open-out fixed casement’s stiles take the fanlight’s +14, and its 170 mid rail is 63x200', () => {
    const s = sectionsOf(BENCHMARK_DG1)
    expect(s.Utile63x120).toBe(10112)                         // 10.11 — exact
    expect(s.Utile63x63).toBe(2 * (688 + 2 * 2143 + 14))       // 9.98: W + 2H + 14 a sash
    // 9.13: cill 3100 + leaf bottom rails 2 x 782 + leaf mid rails 2 x 772
    // + side casement bottom rails 2 x 688 + side casement MID RAILS. The
    // facts give 9,125-9,135, so the two side rails are 1,541-1,551 between
    // them; GlazePro cuts each like a leaf's, at the sash width less 10
    // (678), and declares what is left — see the fixture.
    expect(s.Utile63x200).toBe(3100 + 2 * 782 + 2 * 772 + 2 * 688 + 2 * 678)
    // 7.56 plus the two frame mullions GlazePro charges (difference 11)
    expect(s.Utile67x96).toBe(7560 + 2 * 2146)
  })
  it('G2: the all-panel casements’ stiles take the +14 too, and the rest is exact', () => {
    const s = sectionsOf(BENCHMARK_DG2)
    expect(s.Utile63x63).toBe(11072)
    expect(s.Utile63x96).toBe(1670)
    expect(s.Utile63x120).toBe(4810)
    expect(s.Utile63x200).toBe(5314)
    expect(s.Utile67x96).toBe(6850 + 2 * 1966 + 2656)        // plus the dividers (7, 11)
  })
  it('M1: the confined muntin is the only timber beyond Integrate’s', () => {
    const s = sectionsOf(BENCHMARK_DM1)
    expect(s.Utile67x96).toBe(5130)
    expect(s.Utile63x200).toBe(2580)
    expect(s.Utile63x120).toBe(4850 + 733 - 4)               // its 4.85 m plus the muntin's row
  })
})

// ── The money ────────────────────────────────────────────────────────────────

d('Step BP — DG1, DG2, DM1 and FT5 against Integrate', () => {
  it('DG1: exact on glass, installation, production, fitting and labour; the mullions and the side rails declared', () => {
    const r = expectDeclared(BENCHMARK_DG1, {
      exactGroups: ['glass_done', 'installation_materials', 'manufacture', 'labour'] })
    expect(r.manufacture_labour.total_minutes / 60).toBeCloseTo(100.92, 2)
    expect(r.install_labour.total_minutes / 60).toBeCloseTo(18.50, 2)
    expect(minutes(r, 'Door Muntin')).toBe(240)              // two leaf rails + two side casement rails
    expect(minutes(r, 'Additional for Flat Panel')).toBe(240)
    expect(minutes(r, 'Sidelights in Doorsets')).toBe(1560)
    // the four 0.25 m2 Tricoya panels, to the penny
    expect(r.price.lines.filter(l => l.fires && l.name === 'Tricoya Panel').map(l => r2(l.line_cost)))
      .toEqual([47.93, 47.76, 47.76, 47.93])
    // and the taller leaf's shootbolt, 36.45 -> 36 -> 37.80
    expect(r.price.lines.find(l => l.fires && l.alloc_iron_part_code === 'RHZ1654')?.line_cost).toBeCloseTo(37.80, 2)
    expect(BENCHMARK_DG1.deliberateDifference.cost).toBeCloseTo(58.37, 2)
    expect(BENCHMARK_DG1.openQuestion.cost).toBeCloseTo(-5.57, 2)
  })

  it('DG2: exact on every group but the divider timber', () => {
    const r = expectDeclared(BENCHMARK_DG2, {
      exactGroups: ['glass_done', 'installation_materials', 'manufacture', 'labour'] })
    expect(r.manufacture_labour.total_minutes / 60).toBeCloseTo(92.25, 2)
    expect(r.install_labour.total_minutes / 60).toBeCloseTo(18.00, 2)
    expect(minutes(r, 'Door Muntin')).toBe(0)                // the panel sashes have no mid rail
    expect(minutes(r, 'Additional for Flat Panel')).toBe(120)
    expect(minutes(r, 'Fanlights in Doorsets')).toBe(600)
    expect(minutes(r, 'Sidelights in Doorsets')).toBe(1560)
    expect(r.price.lines.filter(l => l.fires && l.name === 'Tricoya Panel').map(l => r2(l.quantity)))
      .toEqual([0.52, 0.52])
    expect(BENCHMARK_DG2.deliberateDifference.cost).toBeCloseTo(89.60, 2)
  })

  it('DM1: exact on glass and production; the muntin timber, the overweight and the unknown set declared', () => {
    const r = expectDeclared(BENCHMARK_DM1, { exactGroups: ['glass_done', 'manufacture'] })
    expect(r.manufacture_labour.total_minutes / 60).toBeCloseTo(40.33, 2)
    expect(minutes(r, 'Door Muntin')).toBe(120)              // the rail and the confined muntin
    expect(minutes(r, 'Additional for Flat Panel')).toBe(120)
    expect(r.price.lines.filter(l => l.fires && l.name === 'Tricoya Panel').map(l => r2(l.line_cost)))
      .toEqual([33.91, 33.91])
    // the fitting is Integrate's 11.00 h plus the 45 minutes in question
    expect(r.install_labour.total_minutes / 60).toBeCloseTo(11.75, 2)
    expect(minutes(r, 'Any Door Overweight')).toBe(45)
    expect(BENCHMARK_DM1.pendingDecision.cost).toBeCloseTo(-59.85, 2)
  })

  it('FT5: glass 0, production exact to the minute, the POA line in the fitting', () => {
    const r = expectDeclared(BENCHMARK_FT5, { exactGroups: ['glass_done', 'manufacture'] })
    expect(r.manufacture_labour.total_minutes / 60).toBeCloseTo(108.58, 2)
    for (const [name, mins] of [
      ['Additional for Frame Mullion or Transom', 540], ['Door Leaf', 1035],
      ['Sidelights in Doorsets', 1560], ['Fanlights in Doorsets', 900],
      ['Door Muntin', 240], ['Additional for Flat Panel', 240],
      ['Machining & Joining a Door Frame', 855], ['Glazing a Sash', 140],
      ['Casement Sash - Dual Finish', 450], ['Door Frame - Dual Finish', 240],
      ['Door Frame - Dual Finish (Mullions)', 135], ['Door Leaf - Dual Finish', 180],
    ]) expect(minutes(r, name), name).toBe(mins)
    expect(minutes(r, 'Special Glass')).toBe(0)
    expect(r.price.lines.filter(l => l.fires && l.group_name === 'glass_done')).toEqual([])
    // fitting: 29.5 h of units + the 120-minute line (+ the 45 in question)
    expect(minutes(r, 'POA — Skirting to be cut temporarily')).toBe(120)
    expect(r.install_labour.total_minutes).toBe(1770 + 120 + 45)
    // the bolection mouldings price Integrate's own metres
    expect(r.price.lines.filter(l => l.fires && l.name === 'External Bolection Moulding').map(l => r2(l.quantity)))
      .toEqual([1.19, 1.25, 1.25, 1.19])
    expect(r.price.lines.filter(l => l.fires && l.name === 'Internal Bolection Moulding')).toHaveLength(4)
    expect(BENCHMARK_FT5.deliberateDifference.cost).toBeCloseTo(142.26, 2)
  })
})
