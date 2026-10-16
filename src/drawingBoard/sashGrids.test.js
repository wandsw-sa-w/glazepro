// sashGrids.test.js — Step BP
//
// Mid rails, panels and muntins INSIDE casement sashes and door leaves —
// the three things the board could not build (docs/step-bp-brief.md):
//
//   1. a casement sash with a mid rail (its own thickness), glass over a
//      panel — G1 / G3 / G4;
//   2. a casement sash that is ALL panel — G2's A2 / B2;
//   3. a door leaf MUNTIN, full height (M2) or confined to the row below or
//      above the mid rail (M1: one glass over two panels).
//
// Plus the reviewer's extra item 0: a panel's type and bead are chosen from
// Integrate's lists, and a panel nobody has set prices as FLAT.
//
// Everything goes through the functions the board's own buttons call; the
// fixtures are Integrate's saved drawings.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import {
  leafCells, leafCellParts, leafMuntins, leafMidRails, allocatedSectionParts,
  canHoldGrid, muntinRows,
} from '../pricing/doorGeometry.js'
import {
  setLeafMidRail, setLeafGrid, setLeafCellKind, setLeafMuntin, leafMidRailOf,
  LEAF_MUNTIN_SPANS,
} from './doorOpenings.js'
import { buildCasementFrame, openingNodes } from './casementOpenings.js'
import { runPricingOnTree } from '../pricing/pricingEngine.js'
import {
  BENCHMARK_FT1, BENCHMARK_FT4, BENCHMARK_FD4, DOOR_PART_COST_MAP,
} from '../pricing/benchmarks/fixtureDoor.js'
import { PANEL_TYPE_OPTIONS, PANEL_BEAD_OPTIONS, panelOptionCode } from '../pricing/optionVocabulary.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = resolve(HERE, '../pricing/benchmarks/pf30-snapshot.json')
const SNAPSHOT = existsSync(SNAPSHOT_PATH) ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) : null

// ── helpers ──────────────────────────────────────────────────────────────────

const findAll = (node, type, acc = []) => {
  if (node?.part_type === type) acc.push(node)
  for (const c of (node?.children ?? [])) findAll(c, type, acc)
  return acc
}
const findKey = (node, key) => {
  if (node?.key === key) return node
  for (const c of (node?.children ?? [])) { const f = findKey(c, key); if (f) return f }
  return null
}
const mapNodes = (node, fn) => {
  const next = fn(node) ?? node
  return { ...next, children: (next.children ?? []).map(c => mapNodes(c, fn)) }
}
const kinds = (tree, holder) => leafCellParts(findKey(tree, holder.key))
  .map(c => (c.part_type === 'panelPart' ? 'panel' : 'glass'))

// Profile 2 (casement) values, as the other board tests hold them.
const CASEMENT_PV = {
  'assemblyFramePart.leftWidth': 37, 'assemblyFramePart.rightWidth': 37,
  'assemblyFramePart.topHeight': 47, 'assemblyFramePart.bottomHeight': 47,
  'assemblyFramePart.frameDepth': 96, 'assemblyFramePart.frameHeadStopSize': 20,
  'assemblyFramePart.frameStileStopSize': 20, 'assemblyFramePart.cillStopSize': 20,
  'assemblyFramePart.cillAngle': 6,
  'cillPart.height': 47, 'cillPart.depth': 128,
  'mullionPart.thicknessInFrameSolid': 27, 'mullionPart.mullionStopSize': 20,
  'casementSashPart.thickness': 54, 'casementSashPart.topHeight': 62,
  'casementSashPart.leftWidth': 62, 'casementSashPart.rightWidth': 62,
  'casementSashPart.bottomHeight': 83,
  'casementSashPart.defaultFanlightBottomHeight': 62,
  'casementSashPart.mechanicalClearanceLeft': 4, 'casementSashPart.mechanicalClearanceRight': 4,
  'casementSashPart.mechanicalClearanceTop': 4, 'casementSashPart.mechanicalClearanceBottom': 4,
  'casementSashPart.btmRailShapeId': 'square',
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 16,
  'glassPart.defaultDoubleGlazingTolerance': 2,
  'glassPart.defaultDirGuStopSize': 20,
  'glassPart.defaultDoubleGlazingRebateWidthForDirGU': 20,
  'glassPart.defaultDoubleGlazingToleranceForDirGU': 2,
}

// ── 3. A muntin confined to one row (M1) ─────────────────────────────────────

describe('Step BP item 3 — a muntin confined below (or above) the mid rail', () => {
  // FT1's leaf: a 120 muntin at 373 and a 170 mid rail at 983 in a
  // 777 x 1788 interior — four cells today.
  const leaf = () => findAll(BENCHMARK_FT1.tree, 'doorLeafPart')[0]

  it('a full-height muntin makes the four cells it always did', () => {
    const cells = leafCells(BENCHMARK_FT1.tree, leaf())
    expect(cells.map(c => [c.col, c.row, c.width, c.height])).toEqual([
      [0, 0, 373, 983], [1, 0, 284, 983],
      [0, 1, 373, 635], [1, 1, 284, 635],
    ])
    expect(muntinRows(leafMuntins(leaf())[0], leafMidRails(leaf()))).toEqual([0, 1])
  })

  it('M1: a muntin that STARTS at the mid rail divides the bottom row only', () => {
    // Integrate's own keys: startDivider names the divider the muntin starts
    // at (0 = the leaf's edge), endDivider the one it ends at.
    const rail = leafMidRails(leaf())[0]
    const tree = mapNodes(BENCHMARK_FT1.tree, n => n.values?.isMuntin
      ? { ...n, values: { ...n.values, startDivider: rail.key } } : n)
    const l = findAll(tree, 'doorLeafPart')[0]
    expect(muntinRows(leafMuntins(l)[0], leafMidRails(l))).toEqual([1])
    const cells = leafCells(tree, l)
    expect(cells.map(c => [c.col, c.row, c.width, c.height])).toEqual([
      [0, 0, 777, 983],                      // one glass-sized cell on top
      [0, 1, 373, 635], [1, 1, 284, 635],    // two below
    ])
  })

  it('and one that ENDS at the mid rail divides the top row only', () => {
    const rail = leafMidRails(leaf())[0]
    const tree = mapNodes(BENCHMARK_FT1.tree, n => n.values?.isMuntin
      ? { ...n, values: { ...n.values, endDivider: rail.key } } : n)
    const l = findAll(tree, 'doorLeafPart')[0]
    expect(leafCells(tree, l).map(c => [c.col, c.row, c.width, c.height])).toEqual([
      [0, 0, 373, 983], [1, 0, 284, 983],
      [0, 1, 777, 635],
    ])
  })

  it('setLeafMuntin: full height (M2), below, above, none — the cells follow', () => {
    // FD4's left leaf: a 170 mid rail with glass above and a panel below.
    const fd4 = BENCHMARK_FD4.tree
    const left = findAll(fd4, 'leftFrenchDoorLeafPart')[0]
    expect(kinds(fd4, left)).toEqual(['glass', 'panel'])
    expect(LEAF_MUNTIN_SPANS).toEqual(['none', 'full', 'below', 'above'])

    // M2: full height — two glass over two panels, the new cells take the
    // kind of the cell they split
    const full = setLeafMuntin(fd4, left.key, { span: 'full' })
    expect(kinds(full, left)).toEqual(['glass', 'glass', 'panel', 'panel'])
    const m = leafMuntins(findKey(full, left.key))[0]
    expect(m.values).toMatchObject({ isMuntin: true, thicknessInFrame: 120, muntinThickness: 120,
      startDivider: '0', endDivider: '0' })
    // centred in the leaf's interior by default
    const cells = leafCells(full, findKey(full, left.key))
    expect(Math.abs(cells[0].width - cells[1].width)).toBeLessThanOrEqual(1)

    // M1: below the mid rail — one glass over two panels
    const below = setLeafMuntin(fd4, left.key, { span: 'below' })
    expect(kinds(below, left)).toEqual(['glass', 'panel', 'panel'])
    expect(leafMuntins(findKey(below, left.key))[0].values.startDivider)
      .toBe(leafMidRailOf(left).key)

    // above: two glass over one panel
    const above = setLeafMuntin(fd4, left.key, { span: 'above' })
    expect(kinds(above, left)).toEqual(['glass', 'glass', 'panel'])

    // and back to none: the two cells it had, codes intact
    const none = setLeafMuntin(full, left.key, { span: 'none' })
    expect(kinds(none, left)).toEqual(['glass', 'panel'])
    expect(leafMuntins(findKey(none, left.key))).toEqual([])
  })

  it('a confined muntin is cut to its own row, not the whole leaf', () => {
    const rail = leafMidRails(leaf())[0]
    const confined = mapNodes(BENCHMARK_FT1.tree, n => n.values?.isMuntin
      ? { ...n, values: { ...n.values, startDivider: rail.key } } : n)
    // The muntin shares the 63x120 section with the stiles and top rail,
    // so the allocator's one row for that section moves by the difference:
    // the full interior (1788) less the bottom row alone (635).
    const utile120 = tree => allocatedSectionParts(tree)
      .find(s => s.part_code === 'Utile63x120').length_mm
    expect(utile120(BENCHMARK_FT1.tree) - utile120(confined)).toBe(1788 - 635)
  })
})

// ── 1 and 2. A casement sash with a grid ─────────────────────────────────────

describe('Step BP items 1 and 2 — a casement sash holds a grid', () => {
  function casement() {
    const { tree, missing } = buildCasementFrame(CASEMENT_PV, {
      width: 1199, height: 1299, openings: ['opening_casement'], product: 'casement',
    })
    expect(missing).toEqual([])
    const sash = openingNodes(tree)[0]
    expect(sash.part_type).toBe('casementSashPart')
    expect(canHoldGrid(sash)).toBe(true)
    return { tree, sash }
  }

  it('"Add mid rail and panel" on a casement sash, with its own thickness', () => {
    const { tree, sash } = casement()
    const next = setLeafMidRail(tree, sash.key, { offset: 700, thickness: 200 })
    const s = findKey(next, sash.key)
    const rail = leafMidRailOf(s)
    expect(rail, 'the sash has a mid rail').toBeTruthy()
    expect(rail.values).toMatchObject({ isMidrail: true, offset: 700, thicknessInFrame: 200, midrailThickness: 200 })
    expect(kinds(next, s)).toEqual(['glass', 'panel'])
    // the panel defaults to FLAT, ovolo, both faces
    const panel = leafCellParts(s).find(c => c.part_type === 'panelPart')
    expect(panel.values).toMatchObject({
      internalPanelTypeId: 'flat', externalPanelTypeId: 'flat',
      internalPanelBeadId: 'ovolo', externalPanelBeadId: 'ovolo',
    })
    // glass above (700 high), the panel below the 200 rail
    const cells = leafCells(next, s)
    expect(cells.map(c => c.height)).toEqual([700, cells[0].height + 0 === 700 ? cells[1].height : null])
    expect(cells[0].height + 200 + cells[1].height).toBe(leafCells(tree, sash)[0].height)
    // and the glass keeps its codes
    expect(leafCellParts(s)[0].values.internalGlassPartNo).toBe(sash.children[0].values.internalGlassPartNo)
    // removing puts the glass back over the whole sash
    const back = setLeafMidRail(next, sash.key, { offset: null })
    expect(kinds(back, s)).toEqual(['glass'])
    expect(leafMidRailOf(findKey(back, sash.key))).toBe(null)
  })

  it('"Panel": a casement sash’s glass becomes a panel, and back', () => {
    const { tree, sash } = casement()
    const glass = sash.children.find(c => c.part_type === 'glassPart')
    const panelled = setLeafCellKind(tree, glass.key, 'panel')
    expect(kinds(panelled, sash)).toEqual(['panel'])
    expect(findAll(findKey(panelled, sash.key), 'glassPart')).toEqual([])
    const panel = leafCellParts(findKey(panelled, sash.key))[0]
    const glazed = setLeafCellKind(panelled, panel.key, 'glass')
    expect(kinds(glazed, sash)).toEqual(['glass'])
  })

  it('a panelled casement sash has NO glass lines, Flat Panel 60 and Tricoya on its area', () => {
    if (!SNAPSHOT) return
    const { tree, sash } = casement()
    const glass = sash.children.find(c => c.part_type === 'glassPart')
    const panelled = setLeafCellKind(tree, glass.key, 'panel')
    const run = t => runPricingOnTree(t, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue, partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: SNAPSHOT.partCostMap, ironmongeryLines: [],
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue, profileValues: SNAPSHOT.profileValues,
    })
    const r = run(panelled)
    expect(r.price.lines.filter(l => l.fires && l.group_name === 'glass_done')).toEqual([])
    const tricoya = r.price.lines.find(l => l.fires && l.name === 'Tricoya Panel')
    expect(tricoya, 'Tricoya on the panel').toBeTruthy()
    const cell = leafCells(panelled, findKey(panelled, sash.key))[0]
    expect(tricoya.quantity).toBeCloseTo(cell.width * cell.height / 1e6, 4)
    expect(r.manufacture_labour.lines.filter(l => l.fires && l.name === 'Additional for Flat Panel')
      .reduce((n, l) => n + l.minutes, 0)).toBe(60)
    // no door leaf on a window: Door Muntin does not fire for a window's rail
    expect(r.manufacture_labour.lines.filter(l => l.fires && l.name === 'Door Muntin')).toEqual([])
  })

  it('FT4’s side light is the same thing, and its cells are unchanged', () => {
    const side = findAll(BENCHMARK_FT4.tree, 'casementSashPart')[0]
    expect(leafCells(BENCHMARK_FT4.tree, side).map(c => c.height)).toEqual([888, 834])
    expect(kinds(BENCHMARK_FT4.tree, side)).toEqual(['glass', 'panel'])
  })
})

// ── Item 0 (extra): panel type and bead as lists; null prices as flat ────────

describe('Step BP item 0 — panel type and bead are chosen from Integrate’s lists', () => {
  it('the lists are Integrate’s 110 / 112 / 114 / 116 and 120 / 126 / 320', () => {
    expect(PANEL_TYPE_OPTIONS.map(o => o.code)).toEqual(
      ['flat', 'raised_and_fielded', 'vertical_tongue_and_groove', 'horizontal_tongue_and_groove'])
    expect(PANEL_TYPE_OPTIONS.map(o => o.integrate)).toEqual([110, 112, 114, 116])
    expect(PANEL_BEAD_OPTIONS.map(o => o.code)).toEqual(['ovolo', 'bolection', 'bespoke'])
    expect(PANEL_BEAD_OPTIONS.map(o => o.integrate)).toEqual([120, 126, 320])
  })

  it('a stored Integrate id or a code both select the right entry; null selects nothing', () => {
    expect(panelOptionCode('type', 110)).toBe('flat')
    expect(panelOptionCode('type', 'flat')).toBe('flat')
    expect(panelOptionCode('type', '112')).toBe('raised_and_fielded')
    expect(panelOptionCode('bead', 126)).toBe('bolection')
    expect(panelOptionCode('bead', null)).toBe(null)
    expect(panelOptionCode('type', 'nonsense')).toBe(null)
  })

  it('a panel whose type was never set prices as FLAT, and its bead as ovolo', () => {
    if (!SNAPSHOT) return
    const nulled = mapNodes(BENCHMARK_FD4.tree, n => n.part_type === 'panelPart'
      ? { ...n, values: { ...n.values, internalPanelTypeId: null, externalPanelTypeId: null,
        internalPanelBeadId: null, externalPanelBeadId: null } } : n)
    const run = t => runPricingOnTree(t, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue, partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: DOOR_PART_COST_MAP, ironmongeryLines: BENCHMARK_FD4.ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue, profileValues: BENCHMARK_FD4.profileValues,
      profileCode: BENCHMARK_FD4.profileCode,
    })
    const flat = r => r.manufacture_labour.lines
      .filter(l => l.fires && l.name === 'Additional for Flat Panel').length
    expect(flat(run(BENCHMARK_FD4.tree))).toBe(2)
    expect(flat(run(nulled))).toBe(2)
    expect(run(nulled).price.lines.filter(l => l.fires && /Bolection/.test(l.name))).toEqual([])
    expect(run(nulled).price.total_cost).toBeCloseTo(run(BENCHMARK_FD4.tree).price.total_cost, 2)
  })
})
