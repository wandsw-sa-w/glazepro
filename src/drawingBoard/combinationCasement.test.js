// combinationCasement.test.js — Step AV item 5
//
// The three two-column fanlight layouts built the way a surveyor builds them:
// the template, then the transom/mullion picker, then the picker's second
// mode (a divider in one column or one row), then the operation buttons. The
// trees that come out go through the save gate and the required-field check,
// and then through the pricing engine, where they have to come to the same
// money as the hand-written benchmark fixtures.
//
// Nothing here asserts a figure of its own: TC1/TC2/TC3's targets live in
// integrate-targets.json and the fixtures are checked against them in
// benchmarks.test.js. These tests check the BOARD reaches the same trees.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import {
  buildCasementFrame, openingNodes, openingMatrixIndex, openingTypeLabel,
  setCasementOperation, applyFanlightBottomRails, resizeCasementFrame,
} from './casementOpenings.js'
import { applyDividers, addDividerInCell, removeDivider } from './gridActions.js'
import {
  COMBINATION_CASEMENT_TEMPLATES, buildCombinationCasementTemplate,
} from './combinationCasement.js'
import { assertSaveable } from './containment.js'
import { findRequiredEmpty } from './requiredFields.js'
import {
  frameCells, frameInterior, isShortDivider, shortDividerSpanMm,
} from '../pricing/casementGeometry.js'
import { runPricingOnTree } from '../pricing/pricingEngine.js'
import { defaultIronmonger } from '../pricing/defaultIronmongery.js'
import { computeVariables } from '../pricing/computeVariables.js'
import { computeDerived } from './computeDerived.js'
import {
  BENCHMARK_TC1, BENCHMARK_TC2, BENCHMARK_TC3,
  BENCHMARK_TC4, BENCHMARK_TC5, BENCHMARK_TC6, BENCHMARK_TC7,
} from '../pricing/benchmarks/fixtureCasement.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = resolve(HERE, '../pricing/benchmarks/pf30-snapshot.json')
const SNAPSHOT = existsSync(SNAPSHOT_PATH)
  ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
  : null

// Profile 2 (casement) as api.js loadProfileValues returns it. The build
// reads the FULL field keys; the picker takes DrawingBoard's short-keyed
// profileValueMap, so each is given what the board gives it.
const PV = {
  'assemblyFramePart.leftWidth': 37, 'assemblyFramePart.rightWidth': 37,
  'assemblyFramePart.topHeight': 47, 'assemblyFramePart.bottomHeight': 47,
  'assemblyFramePart.frameDepth': 96, 'assemblyFramePart.frameHeadStopSize': 20,
  'assemblyFramePart.frameStileStopSize': 20, 'assemblyFramePart.cillStopSize': 20,
  'assemblyFramePart.cillAngle': 6,
  'cillPart.height': 47, 'cillPart.depth': 128,
  'mullionPart.thicknessInFrameSolid': 27, 'mullionPart.mullionStopSize': 20,
  'casementSashPart.thickness': 54, 'casementSashPart.topHeight': 62,
  'casementSashPart.leftWidth': 62, 'casementSashPart.rightWidth': 62,
  'casementSashPart.defaultFanlightBottomHeight': 83,
  'casementSashPart.mechanicalClearanceLeft': 4, 'casementSashPart.mechanicalClearanceRight': 4,
  'casementSashPart.mechanicalClearanceTop': 4, 'casementSashPart.mechanicalClearanceBottom': 4,
  'casementSashPart.btmRailShapeId': 'square',
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 16,
  'glassPart.defaultDoubleGlazingTolerance': 2,
  'glassPart.defaultDirGuStopSize': 20,
  'glassPart.defaultDoubleGlazingRebateWidthForDirGU': 20,
  'glassPart.defaultDoubleGlazingToleranceForDirGU': 2,
}
const PICKER_PV = { thicknessInFrameSolid: 27, mullionStopSize: 20 }

// The SAME profile with sql/step-as0 run, which is what the live casement
// profile holds today: an ordinary casement rail of 83 and a FANLIGHT rail of
// 62 (Nathan, 12 Oct). PV above keeps 83 in both positions on purpose,
// because that is what Integrate's own templates store and what TC1-TC3 were
// read with. The Step BI templates are built with THIS one.
const PV_AS0 = {
  ...PV,
  'casementSashPart.bottomHeight': 83,
  'casementSashPart.defaultFanlightBottomHeight': 62,
}

const REQUIRED_DEFS = {
  drawingItemPart: [
    { field_key: 'drawingItemPart.product',  property_name: 'product',
      label: 'Product',  data_type: 'reference', role: 'input', is_required: true },
    { field_key: 'drawingItemPart.quantity', property_name: 'quantity',
      label: 'Quantity', data_type: 'number',    role: 'input', is_required: true },
  ],
}

// ── Building the three layouts through the board ─────────────────────────────

const frameOf = t => t.children.find(c => c.part_type === 'assemblyFramePart')
const cillOf  = t => frameOf(t).children.find(c => c.part_type === 'cillPart')

function setOffset(tree, partType, offset) {
  return {
    ...tree,
    children: tree.children.map(c => c.part_type !== 'assemblyFramePart' ? c : ({
      ...c,
      children: c.children.map(g => g.part_type !== partType ? g
        : ({ ...g, values: { ...g.values, offset } })),
    })),
  }
}

function grid(tree, cols, rows) {
  const frame = frameOf(tree)
  const i = frameInterior(tree)
  return applyDividers(tree, frame.key, cols, rows, i.width, i.height, PICKER_PV, 'solid')
}

/** The template, the picker, the second mode, then the operation buttons. */
function boardTree({ width, height, cols, rows, offsets, short, ops }) {
  const { tree, missing } = buildCasementFrame(PV, {
    width, height, openings: ['opening_casement'], product: 'casement',
  })
  expect(missing, 'profile values the build could not resolve').toEqual([])
  let t = grid(tree, cols, rows)
  for (const [partType, offset] of Object.entries(offsets)) t = setOffset(t, partType, offset)
  if (short) t = addDividerInCell(t, frameOf(t).key, { ...short, profileValues: PICKER_PV })
  for (let i = 0; i < ops.length; i++) {
    t = setCasementOperation(t, openingNodes(t)[i].key, ops[i]).tree
  }
  return t
}

/** Integrate's templates keep 83 on every rail, the fanlight included. */
const TC1 = () => boardTree({
  width: 1105, height: 1405, cols: 1, rows: 2, offsets: { transomPart: 301 },
  short: { axis: 'mullion', index: 1, offset: 493 },
  ops: ['top_hung', 'left_hand_hung', 'right_hand_hung'],
})
const TC2 = () => boardTree({
  width: 1299, height: 1499, cols: 2, rows: 2,
  offsets: { mullionPart: 590, transomPart: 356 },
  ops: ['top_hung', 'fix', 'fix', 'right_hand_hung'],
})
const TC3 = () => boardTree({
  width: 1205, height: 1295, cols: 2, rows: 1, offsets: { mullionPart: 543 },
  short: { axis: 'transom', index: 1, offset: 354 },
  ops: ['left_hand_hung', 'top_hung', 'fix'],
})

const CASES = [
  ['TC1', TC1, BENCHMARK_TC1],
  ['TC2', TC2, BENCHMARK_TC2],
  ['TC3', TC3, BENCHMARK_TC3],
]

// ── The trees ────────────────────────────────────────────────────────────────

describe('Step AV — the board builds TC1, TC2 and TC3', () => {
  for (const [label, build, bm] of CASES) {
    it(`${label}: the board's cells are the fixture's, cell for cell`, () => {
      const mine = frameCells(build())
      const theirs = frameCells(bm.tree)
      expect(mine.map(c => [c.col, c.row, c.colSpan, c.rowSpan, c.width, c.height]))
        .toEqual(theirs.map(c => [c.col, c.row, c.colSpan, c.rowSpan, c.width, c.height]))
    })

    it(`${label}: the sashes carry the fixture's values`, () => {
      const mine = openingNodes(build())
      const theirs = openingNodes(bm.tree)
      expect(mine.length).toBe(theirs.length)
      for (let i = 0; i < mine.length; i++) {
        const keys = ['operation', 'thickness', 'topHeight', 'leftWidth', 'rightWidth',
          'bottomHeight', 'mechanicalClearanceLeft', 'mechanicalClearanceTop']
        for (const k of keys) {
          expect(mine[i].values[k], `${label} opening ${i} ${k}`).toBe(theirs[i].values[k])
        }
      }
    })

    it(`${label}: saves, and no required field is empty`, () => {
      const tree = build()
      expect(() => assertSaveable(tree)).not.toThrow()
      expect(findRequiredEmpty(tree, REQUIRED_DEFS)).toEqual([])
    })
  }

  it('the labels are Integrate’s: A1 A2 B2, a 2 x 2 grid, A1 B1 B2', () => {
    const labelled = tree => openingNodes(tree).map(n =>
      `${openingTypeLabel(tree, n)} ${openingMatrixIndex(tree, n)}`)
    expect(labelled(TC1())).toEqual(['Fanlight A1', 'Casement Sash A2', 'Casement Sash B2'])
    expect(labelled(TC2())).toEqual(['Fanlight A1', 'Fanlight B1', 'Casement Sash A2', 'Casement Sash B2'])
    // TC3's A1 runs the full height, so it is NOT a fanlight
    expect(labelled(TC3())).toEqual(['Casement Sash A1', 'Fanlight B1', 'Casement Sash B2'])
  })

  it('resizing keeps the spanning layout and the save gate', () => {
    const wider = resizeCasementFrame(TC1(), { width: 1305, height: 1505 }).tree
    expect(frameCells(wider).map(c => [c.col, c.row, c.colSpan, c.rowSpan]))
      .toEqual([[0, 0, 2, 1], [0, 1, 1, 1], [1, 1, 1, 1]])
    expect(frameCells(wider)[0].width).toBe(frameInterior(wider).width)
    expect(() => assertSaveable(wider)).not.toThrow()
  })

  it('taking the short divider away merges the openings it separated', () => {
    const tree = TC1()
    const mullion = frameOf(tree).children.find(c => c.part_type === 'mullionPart')
    const merged = removeDivider(tree, frameOf(tree).key, mullion.key)
    expect(openingNodes(merged).length).toBe(2)
    expect(frameCells(merged).map(c => [c.colSpan, c.rowSpan])).toEqual([[1, 1], [1, 1]])
    expect(() => assertSaveable(merged)).not.toThrow()
    // and the fanlight rail rule still finds the right sash afterwards
    expect(applyFanlightBottomRails(merged, PV).changed).toEqual([])
  })
})

// ── The money ────────────────────────────────────────────────────────────────

const d = SNAPSHOT ? describe : describe.skip

d('Step AV — the board’s trees price as the fixtures do', () => {
  function price(tree, bm, ironmongeryLines) {
    return runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: bm.partCostMap,
      ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
    })
  }

  /** The template's surround list — the nosing and the architrave. */
  function withSurrounds(tree, bm) {
    return { ...tree, values: { ...tree.values, surroundLines: bm.tree.values.surroundLines } }
  }

  for (const [label, build, bm] of CASES) {
    it(`${label}: same labour and same total as the fixture`, () => {
      const mine   = price(withSurrounds(build(), bm), bm, bm.ironmongeryLines)
      const theirs = price(bm.tree, bm, bm.ironmongeryLines)
      expect(mine.manufacture_labour.total_minutes, `${label} production`)
        .toBe(theirs.manufacture_labour.total_minutes)
      expect(mine.install_labour.total_minutes, `${label} install`)
        .toBe(theirs.install_labour.total_minutes)
      expect(mine.price.total_cost, `${label} cost`).toBeCloseTo(theirs.price.total_cost, 2)
      expect(mine.price.total, `${label} price`).toBeCloseTo(theirs.price.total, 2)
    })

    it(`${label}: every priced line matches the fixture's, line for line`, () => {
      const lines = r => r.price.lines.filter(l => l.fires && !l.error)
        .map(l => [l.name, l.alloc_part_code ?? l.alloc_iron_part_code ?? '',
          Number(l.quantity.toFixed(4)), Number(l.line_cost.toFixed(2))])
      expect(lines(price(withSurrounds(build(), bm), bm, bm.ironmongeryLines)))
        .toEqual(lines(price(bm.tree, bm, bm.ironmongeryLines)))
    })
  }

  // Difference 4 in docs/integrate-differences.md: a NEW casement drawing
  // carries no stored ironmongery list, so the default rules price it. This
  // reports what they give on each layout — not a target, a record of where
  // GlazePro starts before a surveyor edits the list.
  it('without a stored list, the default rules follow the openings', () => {
    const report = {}
    for (const [label, build] of CASES) {
      const tree = build()
      const derived = computeDerived(tree)
      const vars = computeVariables(tree, derived, SNAPSHOT.pfVariables)
      const lines = defaultIronmonger(tree, vars, SNAPSHOT.ironmongeryRules ?? [], {},
        SNAPSHOT.profileValues ?? {})
      report[label] = (lines ?? []).map(l => `${l.product_short_name} ${l.finish_code ?? ''} x${l.qty}`.replace(/  +/g, ' '))
    }
    // Printed so the step's report can quote it.
    console.log('default ironmongery lines:', JSON.stringify(report, null, 2))

    // The handles, hinges, extensions and gear boxes come out EXACTLY as
    // Integrate's stored lists have them on all three layouts — TC1 three
    // gear boxes and six 950 mm extensions, TC2 and TC3 two and two.
    for (const [label] of CASES) {
      expect(report[label], `${label} default lines`).toEqual(expect.arrayContaining([
        'kenrick_extension_gear_box x' + (label === 'TC1' ? '3' : '2'),
      ]))
    }
    expect(report.TC1).toEqual(expect.arrayContaining([
      'connoisseur_handle_lh x2', 'connoisseur_handle_rh x1',
      'defender_friction_hinge_-_side_hung_310mm x2', 'kenrick_extension_950mm x6',
    ]))
    expect(report.TC3).toEqual(expect.arrayContaining([
      'connoisseur_handle_lh x2', 'kenrick_extension_490mm x2', 'kenrick_extension_950mm x2',
    ]))

    // ONE difference from Integrate's stored lists, recorded as it stands
    // so a later change to the rules is noticed. NOT a target: Integrate's
    // figures are the facts, and this is what GlazePro gives today.
    //
    // The centre strike. Integrate charges defender_209mm on TC1 and
    // defender_310mm on TC2 and TC3; the rules here charge 209 on all three.
    for (const [label] of CASES) {
      expect(report[label].some(l => l.startsWith('defender_209mm')), label).toBe(true)
      expect(report[label].some(l => l.startsWith('defender_310mm')), label).toBe(false)
    }

    // Step AY item 1 — Nathan (13 Oct): a casement gets BOTH vents, and
    // that is INTENDED, not a defect. The slot vent (rule 50,
    // trickle_vent_xr16) and the grille (rule 52, "trickle") are two
    // different products and a casement is sold with both. Rule 52 is gated
    // on "not is_sw", which is why a box sash gets only the slot vent.
    // Recorded in docs/integrate-differences.md so nobody "fixes" it.
    for (const [label] of CASES) {
      expect(report[label], `${label} both vents`).toEqual(expect.arrayContaining([
        'trickle_vent_xr16 x1', 'trickle x1',
      ]))
    }
  })

  it('the benchmarks match only because the STORED list is priced', () => {
    // Worth stating plainly, since it is the one thing a reader could take
    // on trust: TC1's ironmongery is Integrate's own stored list, not
    // something the rules reproduce.
    const bm = BENCHMARK_TC1
    const stored = price(withSurrounds(TC1(), bm), bm, bm.ironmongeryLines)
    const none   = price(withSurrounds(TC1(), bm), bm, [])
    expect(stored.price.total_cost).toBeGreaterThan(none.price.total_cost)
    const ironmongery = r => r.price.lines
      .filter(l => l.fires && l.alloc_iron_part_code).length
    expect(ironmongery(stored)).toBeGreaterThan(0)
    expect(ironmongery(none)).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Step BI item 4 — the four Configuration 4-7 templates
// ══════════════════════════════════════════════════════════════════════════════
// The templates sql/step-bi1 writes, built by the board's own code
// (src/drawingBoard/combinationCasement.js) and checked against the TC4-TC7
// fixtures, which are Integrate's drawings as read.
//
// A template is NOT the fixture: it carries no stored surround list and no
// stored ironmongery list, and its FANLIGHT bottom rails are 62 where
// Integrate's templates hold 83. So the geometry must match cell for cell and
// the sash values must match everywhere EXCEPT that rail — which is asserted
// rather than waved at.

describe('Step BI — the board builds Configurations 4-7', () => {
  const SPEC = Object.fromEntries(
    COMBINATION_CASEMENT_TEMPLATES.map(t => [t.integrate.match(/Configuration (\d)/)[1], t]))

  const build = n => {
    const { tree, missing } = buildCombinationCasementTemplate(SPEC[n], PV_AS0)
    expect(missing, `Configuration ${n}: unresolved profile values`).toEqual([])
    expect(tree, `Configuration ${n}: tree`).toBeTruthy()
    return tree
  }

  const CASES = [
    ['4', BENCHMARK_TC4], ['5', BENCHMARK_TC5],
    ['6', BENCHMARK_TC6], ['7', BENCHMARK_TC7],
  ]

  for (const [n, bm] of CASES) {
    it(`Configuration ${n}: the cells are the fixture's, cell for cell`, () => {
      const mine = frameCells(build(n))
      const theirs = frameCells(bm.tree)
      expect(mine.map(c => [c.col, c.row, c.colSpan, c.rowSpan, c.width, c.height]))
        .toEqual(theirs.map(c => [c.col, c.row, c.colSpan, c.rowSpan, c.width, c.height]))
    })

    it(`Configuration ${n}: the sashes carry the fixture's values, bar the 62 rail`, () => {
      const tree = build(n)
      const mine = openingNodes(tree)
      const theirs = openingNodes(bm.tree)
      expect(mine.length).toBe(theirs.length)
      const cells = frameCells(tree)
      const rows = Math.max(...cells.map(c => c.row + c.rowSpan))
      for (let i = 0; i < mine.length; i++) {
        for (const k of ['operation', 'thickness', 'topHeight', 'leftWidth',
          'rightWidth', 'mechanicalClearanceLeft', 'mechanicalClearanceTop',
          'casementTypeId']) {
          expect(mine[i].values[k], `Configuration ${n} opening ${i} ${k}`)
            .toBe(theirs[i].values[k])
        }
        // The bottom rail is the ONE declared difference: a fanlight — a
        // top-row sash that does not run the full height — is 62 here and 83
        // in Integrate's template.
        const c = cells[i]
        const isFanlight = rows > 1 && c.row === 0 && c.rowSpan < rows
        expect(mine[i].values.bottomHeight, `Configuration ${n} opening ${i} rail`)
          .toBe(isFanlight ? 62 : 83)
        expect(theirs[i].values.bottomHeight, `fixture ${n} opening ${i} rail`).toBe(83)
      }
    })

    it(`Configuration ${n}: saves, and no required field is empty`, () => {
      const tree = { ...build(n), values: { ...build(n).values, product: 'casement' } }
      expect(() => assertSaveable(tree)).not.toThrow()
      expect(findRequiredEmpty(tree, REQUIRED_DEFS)).toEqual([])
    })

    it(`Configuration ${n}: carries NO stored surround and NO stored ironmongery`, () => {
      const tree = build(n)
      expect(tree.values.surroundLines).toBeUndefined()
      const paint = tree.children.find(c => c.part_type === 'paintAndIronmongeryPart')
      expect(paint.values.ironmongeryLines).toBeUndefined()
      // and MPLS is on, which is what gives a casement its multipoint gear
      expect(paint.values.isCasementMpls).toBe(true)
    })
  }

  it('Configuration 6 is the only one with a fanlight rail of 62, and it has ONE', () => {
    const rails = n => openingNodes(build(n)).map(o => o.values.bottomHeight)
    // C4 and C5 are single rows: nothing is a fanlight
    expect(rails('4')).toEqual([83, 83, 83])
    expect(rails('5')).toEqual([83, 83, 83, 83])
    // C6: A1 spans both rows, B1 is the light, C1 spans, B2 is below
    expect(rails('6')).toEqual([83, 62, 83, 83])
    // C7: a light over each, so all three top-row sashes are 62
    expect(rails('7')).toEqual([62, 62, 62, 83, 83, 83])
  })

  it('Configuration 6 stores a SHORT transom bounded by both mullions', () => {
    const tree = build('6')
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    const mullions = frame.children.filter(c => c.part_type === 'mullionPart')
      .sort((a, b) => a.values.offset - b.values.offset)
    const transom = frame.children.find(c => c.part_type === 'transomPart')
    expect(mullions.map(m => m.values.offset)).toEqual([459, 937])
    expect(transom.values.offset).toBe(356)
    expect(transom.values.startDivider).toBe(mullions[0].key)
    expect(transom.values.endDivider).toBe(mullions[1].key)
    expect(isShortDivider(tree, transom)).toBe(true)
    // and its span is the middle column, not the frame
    expect(shortDividerSpanMm(tree, transom)).toBe(451)
  })

  it('Configuration 7 stores three dividers that all run frame to frame', () => {
    const tree = build('7')
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    const dividers = frame.children.filter(
      c => c.part_type === 'mullionPart' || c.part_type === 'transomPart')
    expect(dividers.length).toBe(3)
    for (const d of dividers) {
      expect(d.values.startDivider, d.key).toBe('0')
      expect(d.values.endDivider, d.key).toBe('0')
      expect(isShortDivider(tree, d), d.key).toBe(false)
    }
  })

  it('the names and sort orders are the ones sql/step-bi1 writes', () => {
    expect(COMBINATION_CASEMENT_TEMPLATES.map(t => [t.name, t.sort_order, t.group_name]))
      .toEqual([
        ['Opener, Fixed, Opener (Configuration 4)', 72, 'Combination Flush Casements'],
        ['Opener, Two Fixed, Opener (Configuration 5)', 74, 'Combination Flush Casements'],
        ['Openers Either Side Of A Fanlight Over Fixed (Configuration 6)', 76, 'Combination Flush Casements'],
        ['Three Casements With A Light Over Each (Configuration 7)', 78, 'Combination Flush Casements'],
      ])
  })
})

// ── What each template prices OFFLINE, with its own defaults ────────────────
//
// Not a target. A template carries no stored ironmongery and no nosing, so it
// does NOT price what Integrate's unsaved drawing priced — the report quotes
// these figures so the difference is on the record rather than a surprise.
const dBI = SNAPSHOT ? describe : describe.skip

dBI('Step BI — what Configurations 4-7 price offline', () => {
  const PRICED = {}

  function priceTemplate(template) {
    const { tree, missing } = buildCombinationCasementTemplate(template, PV_AS0)
    expect(missing).toEqual([])
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived, SNAPSHOT.pfVariables)
    const lines = defaultIronmonger(tree, vars, SNAPSHOT.ironmongeryRules ?? [], {},
      SNAPSHOT.profileValues ?? {})
    const r = runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: BENCHMARK_TC4.partCostMap,
      ironmongeryLines: lines ?? [],
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
    })
    return { tree, r, lines: lines ?? [] }
  }

  it('prices each one, and the default rules follow the openings', () => {
    for (const t of COMBINATION_CASEMENT_TEMPLATES) {
      const { r, lines } = priceTemplate(t)
      PRICED[t.name] = {
        cost: Number(r.price.total_cost.toFixed(2)),
        price: Number(r.price.total.toFixed(2)),
        production: r.manufacture_labour.total_minutes,
        install: r.install_labour.total_minutes,
        ironmongery: lines.map(l =>
          `${l.product_short_name} ${l.finish_code ?? ''} x${l.qty}`.replace(/ {2,}/g, ' ')),
      }
      // Every one prices: no errored line, and a total over zero.
      expect(r.price.lines.filter(l => l.error), t.name).toEqual([])
      expect(r.price.total_cost, t.name).toBeGreaterThan(0)
    }
    // Printed so the step's report quotes the run rather than a guess.
    console.log('Step BI offline prices:', JSON.stringify(PRICED, null, 2))
  })

  it('the 1500 rule fires on Configurations 6 and 7, not on 4', () => {
    const mins = name => {
      const t = COMBINATION_CASEMENT_TEMPLATES.find(x => x.name.includes(name))
      return priceTemplate(t).r.install_labour.lines
        .filter(l => l.fires && !l.error && l.name === '1500 Wide Casement Frame')
        .reduce((n, l) => n + l.minutes, 0)
    }
    expect(mins('Configuration 4')).toBe(0)
    expect(mins('Configuration 5')).toBe(60)
    expect(mins('Configuration 6')).toBe(60)
    expect(mins('Configuration 7')).toBe(60)
  })

  it('no template fires the Windowboard rule — there is no stored nosing', () => {
    // sql/step-ax3's decision, carried to these four: the nosing is what
    // makes has_deep_window_board true, and Integrate drops it on the first
    // save, so a GlazePro template must not charge rule 251's 30 minutes.
    for (const t of COMBINATION_CASEMENT_TEMPLATES) {
      const fired = priceTemplate(t).r.install_labour.lines
        .filter(l => l.fires && !l.error && l.name === 'Windowboard')
      expect(fired, t.name).toEqual([])
    }
  })
})
