// poaAndSpecialGlass.test.js — Step BS
//
// Two inputs Integrate has and GlazePro had not: a glass unit marked
// SPECIAL (priced outside the price file — no glass lines, everything else
// as normal) and the Price part's POA LINES (labour / installation minutes
// added to the fitting hours; cost lines through "Drawing POA").
//
// The money: LQ4's "unexplained" 3 h was its 180-minute POA line "Frame
// buried extra rip out time" (docs/integrate-drawing-gaps.txt P2). With the
// line on the fixture LQ4 is EXACT — 2,464.13 cost, labour 25.25 h — and the
// reviewer removed its known_gaps block to hold it there.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import {
  poaLinesOf, poaInstallMinutes, poaInstallLines, poaCostLines, normalisePoaLine,
  addPoaLine, removePoaLineAt, setPoaLineField, newPoaLine,
  isSpecialGlassUnit, SPECIAL_GLASS_KEY, POA_TYPES, POA_CATEGORIES,
} from './poaLines.js'
import { runPricingOnTree } from './pricingEngine.js'
import { resolveIronmongeryLines } from './loadPricingContext.js'
import { BENCHMARK_LQ1, BENCHMARK_LQ4 } from './benchmarks/fixtureLiveQuotes.js'
import { BENCHMARK_FT1, OPEN_IN_PROFILE_VALUES } from './benchmarks/fixtureDoor.js'
import { buildFrontDoorSetFrame } from '../drawingBoard/doorOpenings.js'
import INTEGRATE from './benchmarks/integrate-targets.json'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = resolve(HERE, 'benchmarks/pf30-snapshot.json')
const SNAPSHOT = existsSync(SNAPSHOT_PATH) ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) : null

// ── Tree helpers ─────────────────────────────────────────────────────────────

function mapNodes(node, fn) {
  const next = fn(node) ?? node
  return { ...next, children: (next.children ?? []).map(c => mapNodes(c, fn)) }
}
const findAll = (node, type, acc = []) => {
  if (node.part_type === type) acc.push(node)
  for (const c of (node.children ?? [])) findAll(c, type, acc)
  return acc
}
const findFirst = (node, type) => findAll(node, type)[0] ?? null

/** Give a tree a Price part (if it has none) holding these POA lines. */
function withPoa(tree, poaLines) {
  if (findFirst(tree, 'pricePart')) {
    return mapNodes(tree, n => n.part_type === 'pricePart'
      ? { ...n, values: { ...n.values, poaLines } } : n)
  }
  return { ...tree, children: [...tree.children,
    { key: 'price_t', part_type: 'pricePart', values: { poaLines }, children: [] }] }
}

/** Mark glass units special — all of them, or those whose key passes `which`. */
function withSpecialGlass(tree, which = () => true) {
  return mapNodes(tree, n => (n.part_type === 'glassPart' && which(n))
    ? { ...n, values: { ...n.values, [SPECIAL_GLASS_KEY]: true } } : n)
}

// ── 1. The module ────────────────────────────────────────────────────────────

describe('Step BS — POA lines, the rules', () => {
  const TREE = {
    part_type: 'drawingItemPart', values: {}, children: [
      { part_type: 'pricePart', values: { poaLines: [
        { type: 'labour', category: 'installation', description: 'Frame buried extra rip out time', amount: 180 },
        { type: 'labour', category: 'installation', description: 'not entered yet', amount: '' },
        { type: 'cost',   category: 'extra_services', description: 'Crane hire', amount: '250.5' },
        { type: 'Labour', category: 'Installation', description: 'typed in caps', amount: '30' },
      ] }, children: [] },
    ],
  }

  it('reads the Price part’s lines, with the amount as a number', () => {
    expect(poaLinesOf(TREE)).toHaveLength(4)
    expect(poaLinesOf(TREE)[2]).toEqual({
      type: 'cost', category: 'extra_services', description: 'Crane hire', amount: 250.5 })
    expect(poaLinesOf(TREE)[1].amount).toBe(null)
    expect(poaLinesOf({ part_type: 'drawingItemPart', children: [] })).toEqual([])
  })

  it('labour / installation lines are MINUTES into the fitting hours', () => {
    expect(poaInstallLines(TREE).map(l => l.amount)).toEqual([180, 30])
    expect(poaInstallMinutes(TREE)).toBe(210)
  })

  it('cost lines are what drawing_poa iterates — one per line, poa_cost its amount', () => {
    expect(poaCostLines(TREE)).toEqual([
      { type: 'cost', category: 'extra_services', description: 'Crane hire', amount: 250.5 }])
  })

  it('offers only the types and categories a snapshot rule reads', () => {
    expect(POA_TYPES.map(t => t.code)).toEqual(['labour', 'cost'])
    expect(POA_CATEGORIES.labour.map(c => c.code)).toEqual(['installation'])
    expect(POA_CATEGORIES.cost.map(c => c.code)).toEqual(['extra_services'])
    expect(newPoaLine()).toEqual({ type: 'labour', category: 'installation', description: '', amount: null })
  })

  it('add / edit / remove, and a type change re-homes the category', () => {
    let lines = addPoaLine([])
    lines = setPoaLineField(lines, 0, 'description', 'Skirting to be cut temporarily')
    lines = setPoaLineField(lines, 0, 'amount', 120)
    expect(lines[0]).toMatchObject({ type: 'labour', category: 'installation', amount: 120 })
    lines = setPoaLineField(lines, 0, 'type', 'cost')
    expect(lines[0].category).toBe('extra_services')
    lines = addPoaLine(lines, 'cost')
    expect(removePoaLineAt(lines, 0)).toHaveLength(1)
    expect(normalisePoaLine({ type: 'cost', amount: 'abc' }).amount).toBe(null)
  })

  it('a special glass unit is one flagged with Integrate’s own key', () => {
    expect(isSpecialGlassUnit({ part_type: 'glassPart', values: { specialGlassDetails: true } })).toBe(true)
    expect(isSpecialGlassUnit({ part_type: 'glassPart', values: {} })).toBe(false)
    expect(isSpecialGlassUnit({ part_type: 'panelPart', values: { specialGlassDetails: true } })).toBe(false)
  })
})

// ── 2. The engine ────────────────────────────────────────────────────────────

const d = describe.skipIf(SNAPSHOT === null)

function runLQ(bm, tree = bm.tree) {
  return runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
    glassCatalogue: SNAPSHOT.glassCatalogue,
    partAllocationRules: SNAPSHOT.partAllocationRules,
    partCostMap: bm.partCostMap,
    ironmongeryLines: bm.ironmongeryLines,
    ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
    profileValues: bm.profileValues,
    profileCode: bm.profileCode ?? null,
  })
}

const groupCost = (r, group) => Math.round(r.price.lines
  .filter(l => l.fires && !l.error && l.group_name === group)
  .reduce((n, l) => n + l.line_cost, 0) * 100) / 100

const fired = (r, name) => r.install_labour.lines.concat(r.manufacture_labour.lines)
  .filter(l => l.fires && !l.error && l.name === name)

d('Step BS — LQ4 with its POA line (P2)', () => {
  const target = INTEGRATE.benchmarkLQ4_config7_tall_one_bar

  it('the fixture carries the 180-minute line, as Integrate stores it', () => {
    expect(poaLinesOf(BENCHMARK_LQ4.tree)).toEqual([{
      type: 'labour', category: 'installation',
      description: 'Frame buried extra rip out time', amount: 180 }])
  })

  it('fitting is 25.25 h — 22.25 h of units plus the line — and shows the line', () => {
    const r = runLQ(BENCHMARK_LQ4)
    expect(r.install_labour.total_minutes / 60).toBeCloseTo(25.25, 2)
    const poa = r.install_labour.lines.filter(l => l.fires && l.loop_target === 'drawing_poa')
    expect(poa.map(l => [l.name, l.minutes])).toEqual([['POA — Frame buried extra rip out time', 180]])
  })

  it('is EXACT: 2,464.13 cost, labour 1,015.30, and no known gap left', () => {
    const r = runLQ(BENCHMARK_LQ4)
    expect(target.known_gaps, 'the reviewer removed the block').toBeUndefined()
    expect(groupCost(r, 'labour')).toBe(1015.30)
    expect(r.price.total_cost).toBeCloseTo(target.total_cost, 2)
    expect(r.price.total).toBeCloseTo(target.total_price, 2)
    expect(r.manufacture_labour.total_minutes / 60).toBeCloseTo(43.20, 2)
  })

  it('a COST line prices through "Drawing POA": amount x 1, markup 2, group extra_services', () => {
    const tree = withPoa(BENCHMARK_LQ4.tree, [
      ...poaLinesOf(BENCHMARK_LQ4.tree),
      { type: 'cost', category: 'extra_services', description: 'Crane hire', amount: 250 },
      { type: 'cost', category: 'extra_services', description: 'Skip', amount: 80 },
    ])
    const r = runLQ(BENCHMARK_LQ4, tree)
    const poa = r.price.lines.filter(l => l.fires && !l.error && l.name === 'Drawing POA')
    expect(poa.map(l => [l.alloc_label, l.quantity, l.line_cost, l.line_total]))
      .toEqual([['Crane hire', 250, 250, 500], ['Skip', 80, 80, 160]])
    expect(groupCost(r, 'extra_services')).toBe(330)
    // and the labour line is unchanged by the cost lines
    expect(r.install_labour.total_minutes / 60).toBeCloseTo(25.25, 2)
    expect(r.price.total_cost).toBeCloseTo(target.total_cost + 330, 2)
  })

  it('a labour line is NOT a Drawing POA line, and an empty amount is nothing', () => {
    const r = runLQ(BENCHMARK_LQ4, withPoa(BENCHMARK_LQ4.tree, [
      { type: 'labour', category: 'installation', description: 'x', amount: 180 },
      { type: 'labour', category: 'installation', description: 'blank', amount: null },
      { type: 'cost', category: 'extra_services', description: 'blank', amount: '' },
    ]))
    expect(r.price.lines.filter(l => l.fires && l.name === 'Drawing POA')).toEqual([])
    expect(r.install_labour.total_minutes / 60).toBeCloseTo(25.25, 2)
  })
})

d('Step BS — special glass', () => {
  // LQ1: three sashes, each with glass. Mark B1's unit special.
  const unitKeys = findAll(BENCHMARK_LQ1.tree, 'glassPart').map(g => g.key)
  const special = withSpecialGlass(BENCHMARK_LQ1.tree, g => g.key === unitKeys[1])

  it('that unit contributes NO glass line; the other two are untouched', () => {
    const before = runLQ(BENCHMARK_LQ1)
    const after  = runLQ(BENCHMARK_LQ1, special)
    const glassLines = r => r.price.lines
      .filter(l => l.fires && !l.error && l.group_name === 'glass_done')
      .map(l => [l.part_key, l.name, l.line_cost])
    expect(glassLines(after).some(l => l[0] === unitKeys[1])).toBe(false)
    expect(glassLines(after)).toEqual(glassLines(before).filter(l => l[0] !== unitKeys[1]))
    expect(glassLines(after).length).toBe(glassLines(before).length * 2 / 3)
  })

  it('every other line stays: glazing labour, the bars’ glazing bar, the beads', () => {
    const before = runLQ(BENCHMARK_LQ1)
    const after  = runLQ(BENCHMARK_LQ1, special)
    expect(after.manufacture_labour.total_minutes).toBe(before.manufacture_labour.total_minutes)
    expect(after.install_labour.total_minutes).toBe(before.install_labour.total_minutes)
    for (const g of ['manufacture_materials', 'installation_materials', 'labour', 'production_time']) {
      expect(groupCost(after, g), g).toBe(groupCost(before, g))
    }
    // the Glazing Bar line (manufacture materials) on the special unit is still there
    expect(after.price.lines.some(l => l.fires && l.name === 'Glazing Bar' && l.part_key === unitKeys[1]))
      .toBe(true)
    expect(fired(after, 'Glazing a Sash')).toHaveLength(fired(before, 'Glazing a Sash').length)
  })

  it('the placeholder does NOT fire the snapshot’s "Special Glass" 10-minute rule', () => {
    // That rule is about a special glass CODE (pfVariable special_glass =
    // GL100045, read through is_single/inner/outer_pane_special), not the
    // placeholder: P1's production list has no "Special Glass" line.
    const after = runLQ(BENCHMARK_LQ1, special)
    expect(fired(after, 'Special Glass')).toEqual([])
    expect(SNAPSHOT.rules.find(r => r.name === 'Special Glass')?.rule_family).toBe('manufacture_labour')
  })

  it('the whole glass group goes when every unit is special', () => {
    const all = runLQ(BENCHMARK_LQ1, withSpecialGlass(BENCHMARK_LQ1.tree))
    expect(groupCost(all, 'glass_done')).toBe(0)
    expect(all.price.total_cost).toBeCloseTo(
      runLQ(BENCHMARK_LQ1).price.total_cost - groupCost(runLQ(BENCHMARK_LQ1), 'glass_done'), 2)
  })
})

// ── 3. P1, the special-glass and POA parts only ──────────────────────────────

d('Step BS — P1 (L34355 item 7) board path: the special glass and the POA line', () => {
  // The front door set the board builds at P1's size. Its mid rails,
  // muntins and panel dropdowns are Step BP's, so this is NOT the full
  // benchmark FT5 yet — only what this step owns is asserted: every glazed
  // opening special (Glass group 0) and the 120-minute POA line.
  function p1() {
    const { tree, missing } = buildFrontDoorSetFrame(OPEN_IN_PROFILE_VALUES, {
      width: 1650, height: 2900, fanlight: 'full_width',
    })
    expect(missing).toEqual([])
    const special = withSpecialGlass(tree)
    return withPoa(special, [{
      type: 'labour', category: 'installation',
      description: 'Skirting to be cut temporarily', amount: 120 }])
  }
  function price(tree) {
    const lines = resolveIronmongeryLines(tree, SNAPSHOT, SNAPSHOT.profileValues,
      { profileCode: 'open_in_doors' })
    return runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: BENCHMARK_FT1.partCostMap,
      ironmongeryLines: lines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
      profileCode: 'open_in_doors',
    })
  }

  it('every glazed opening is special and the Glass group is empty', () => {
    const tree = p1()
    const units = findAll(tree, 'glassPart')
    expect(units.length).toBeGreaterThan(0)
    expect(units.every(isSpecialGlassUnit)).toBe(true)
    const r = price(tree)
    expect(groupCost(r, 'glass_done')).toBe(0)
    expect(r.price.lines.filter(l => l.fires && l.group_name === 'glass_done')).toEqual([])
  })

  it('the glazing is still MADE: Glazing fires per unit, Special Glass never', () => {
    const r = price(p1())
    const units = findAll(p1(), 'glassPart').length
    expect(fired(r, 'Glazing a Sash').length + fired(r, 'Glazing').length)
      .toBeGreaterThanOrEqual(units)
    expect(fired(r, 'Special Glass')).toEqual([])
  })

  it('fitting is the units plus 2 h, and the line is named in the breakdown', () => {
    const withLine = price(p1())
    const without  = price(withPoa(p1(), []))
    expect(withLine.install_labour.total_minutes - without.install_labour.total_minutes).toBe(120)
    expect(withLine.install_labour.lines.filter(l => l.fires && l.loop_target === 'drawing_poa')
      .map(l => l.name)).toEqual(['POA — Skirting to be cut temporarily'])
    // Integrate: 31.50 h = 29.5 h of units + 2 h. The units are Step BP's to
    // reach (the sidelights and fanlights count differently once the leaf
    // holds its muntins); the 2 h is this step's and is exact.
    expect(withLine.install_labour.total_minutes / 60 - without.install_labour.total_minutes / 60)
      .toBeCloseTo(2, 2)
  })
})
