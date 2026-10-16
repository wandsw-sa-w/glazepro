// ironmongerySet.test.js — Step BO
//
// A drawing can now carry the exact ironmongery set the surveyor chose, the
// way Integrate stores `ironmongerySet` (id, finish, qty per line). Three
// things are tested here, in the order the brief asks for them:
//
//   1. the PICKER's rules — which catalogue rows it may offer, how it
//      searches, and what finish a picked line starts in;
//   2. the EDIT rules — add / remove / qty / finish, the flag that stops a
//      stored set being re-defaulted, and what "Apply Defaults" throws away;
//   3. the BOARD PATH — a French casement drawn on the board, given
//      L34265 item 9's stored set, prices Integrate's nine ironmongery
//      lines; a size change leaves the set alone; and a save / load round
//      trip brings it back.
//
// The money: the nine lines are Integrate's own, amount for amount —
// 8.40, 8.40, 16.80, 8.40, 1.05, 1.05, 4.20, 8.40, 3.15 = 59.85, which is
// Integrate's nine figures in a different order. So the +10.50 the brief
// records on L34265 item 9 is NOT a catalogue or a rounding difference: it
// is GlazePro pricing its own default set because the board had no way to
// enter Integrate's. Enter it and the ironmongery is exact.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import {
  pickerGroups, pickerCount, pickerFinishFor, finishCost, UNCATEGORISED,
  addPickedLine, removeLineAt, setLineQty, setLineFinish,
  defaultsBack, chosenLines, isEditedSet, isChosenLine, lineSourceLabel,
  setPatch,
} from './ironmongerySet.js'
import {
  buildCasementFrame, changeOpening, openingNodes, resizeCasementFrame,
} from './casementOpenings.js'
import { resolveIronmongeryLines } from '../pricing/loadPricingContext.js'
import { runPricingOnTree } from '../pricing/pricingEngine.js'
import { BENCHMARK_FD1 } from '../pricing/benchmarks/fixtureDoor.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = resolve(HERE, '../pricing/benchmarks/pf30-snapshot.json')
const SNAPSHOT = existsSync(SNAPSHOT_PATH)
  ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
  : null

// Profile 2 (casement) live values, as frenchCasement.test.js has them.
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
  'casementSashPart.bottomHeight': 83,
  'casementSashPart.defaultFanlightBottomHeight': 62,
  'casementSashPart.mechanicalClearanceLeft': 4, 'casementSashPart.mechanicalClearanceRight': 4,
  'casementSashPart.mechanicalClearanceTop': 4, 'casementSashPart.mechanicalClearanceBottom': 4,
  'casementSashPart.btmRailShapeId': 'square',
  'frenchCasementPart.thickness': 57,
  'frenchCasementPart.midRail': 130,
  'frenchCasementPart.gapBetweenMeetingStiles': 4,
  'frenchCasementPart.mechanicalClearanceLeft': 4,
  'frenchCasementPart.mechanicalClearanceRight': 4,
  'frenchCasementPart.mechanicalClearanceTop': 4,
  'frenchCasementPart.mechanicalClearanceBottom': 4,
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 16,
  'glassPart.defaultDoubleGlazingTolerance': 2,
  'glassPart.defaultDirGuStopSize': 20,
  'glassPart.defaultDoubleGlazingRebateWidthForDirGU': 20,
  'glassPart.defaultDoubleGlazingToleranceForDirGU': 2,
}

// ── 1. The picker ────────────────────────────────────────────────────────────

// Four live shapes, read from the catalogue on 16 Oct:
//   a product in every finish, a product in ONE finish, a product whose
//   finishes are neither the item's nor single, a product with NO short_name
//   (193 of the 630 live rows) and a product with no costed variant.
const CATALOGUE = [
  { short_name: 'connoisseur_handle_lh', name: 'Connoisseur Handle LH', category: 'Casement Handle',
    finishes: [{ code: 'PB', cost: 7.55 }, { code: 'PC', cost: 7.55 }, { code: 'SC', cost: 8.08 }] },
  { short_name: 'defender_friction_hinge_-_side_hung_310mm', name: 'Defender Friction Hinge - Side Hung 310mm',
    category: null, finishes: [{ code: 'PC', cost: 7.82 }] },
  { short_name: 'trickle_vent_xr16', name: 'Trickle Vent XR16', category: null,
    finishes: [{ code: 'Blk', cost: 3.25 }, { code: 'Wht', cost: 3.25 }] },
  { short_name: null, name: 'Chrome Numeral 7', category: 'Numerals',
    finishes: [{ code: 'PC', cost: 1.20 }] },
  { short_name: 'nothing_costed', name: 'Not Costed Yet', category: 'Other',
    finishes: [{ code: 'PB', cost: null }] },
  { short_name: 'unavailable_only', name: 'Discontinued Stay', category: 'Casement Stay',
    finishes: [{ code: 'PB', cost: 4.00, available: false }] },
]

describe('Step BO — what the picker may offer', () => {
  const groups = () => pickerGroups(CATALOGUE, { itemFinish: 'PB' })

  it('offers only products a stored line could price', () => {
    const offered = groups().flatMap(g => g.products.map(p => p.short_name))
    expect(offered).toContain('connoisseur_handle_lh')
    expect(offered).toContain('defender_friction_hinge_-_side_hung_310mm')
    expect(offered).toContain('trickle_vent_xr16')
    // A stored line is keyed by short_name and nothing else, so a product
    // without one could never price — it must not be offered.
    expect(offered).not.toContain(null)
    expect(offered.length).toBe(3)
    // and nothing uncosted or unavailable
    expect(offered).not.toContain('nothing_costed')
    expect(offered).not.toContain('unavailable_only')
  })

  it('groups by category, with the uncategorised Integrate products last', () => {
    expect(groups().map(g => g.category)).toEqual(['Casement Handle', UNCATEGORISED])
    expect(pickerCount(groups())).toBe(3)
    // 388 of the 630 live products have no category and they are the
    // Integrate-imported ones every stored set is made of, so they are
    // shown, not hidden.
    const uncat = groups().find(g => g.category === UNCATEGORISED)
    expect(uncat.products.map(p => p.short_name)).toEqual([
      'defender_friction_hinge_-_side_hung_310mm', 'trickle_vent_xr16',
    ])
  })

  it('searches the name and the code', () => {
    const codes = q => pickerGroups(CATALOGUE, { query: q, itemFinish: 'PB' })
      .flatMap(g => g.products.map(p => p.short_name))
    expect(codes('connoisseur')).toEqual(['connoisseur_handle_lh'])   // the code
    expect(codes('Handle LH')).toEqual(['connoisseur_handle_lh'])     // the name
    expect(codes('TRICKLE')).toEqual(['trickle_vent_xr16'])           // case-insensitive
    expect(codes('310mm')).toEqual(['defender_friction_hinge_-_side_hung_310mm'])
    expect(codes('no such product')).toEqual([])
  })

  it('shows each product its unit cost in the finish it would price in', () => {
    const all = groups().flatMap(g => g.products)
    const byName = Object.fromEntries(all.map(p => [p.short_name, p]))
    expect(byName.connoisseur_handle_lh.cost).toBe(7.55)
    expect(byName['defender_friction_hinge_-_side_hung_310mm'].cost).toBe(7.82)
    expect(finishCost(CATALOGUE[0], 'SC')).toBe(8.08)
  })

  it('defaults the finish to the ITEM finish where the product exists in it', () => {
    const pick = pickerFinishFor(CATALOGUE[0], 'PB')
    expect(pick).toEqual({ finish: 'PB', stored: null, reason: 'item' })
  })

  it('stores a PC-only product AS PC, not as "follow the item"', () => {
    // The Step AQ item 5 trap: the item finish is PB, the hinge exists only
    // in PC, and a line that followed the item would resolve to PB, find
    // nothing and price 0.00.
    const pick = pickerFinishFor(CATALOGUE[1], 'PB')
    expect(pick).toEqual({ finish: 'PC', stored: 'PC', reason: 'only' })
  })

  it('ASKS when the product is in neither the item finish nor one finish only', () => {
    // A trickle vent is Wht or Blk and the item is PB. Step Z's finding is
    // that a guessed finish is a wrong price nobody sees, so nothing is
    // guessed: reason 'ask', and the panel will not add the line until a
    // finish is chosen.
    expect(pickerFinishFor(CATALOGUE[2], 'PB'))
      .toEqual({ finish: null, stored: null, reason: 'ask' })
  })
})

// ── 2. Editing a set ────────────────────────────────────────────────────────

describe('Step BO — editing a stored set', () => {
  const DEFAULTS = [
    { product_short_name: 'z-claw_fastener_kit_wpulleys', finish_code: '', qty: 1, source: 'default' },
    { product_short_name: 'trickle_vent_xr16', finish_code: '', rule_finish_code: 'Wht', qty: 1, source: 'default' },
  ]

  it('a picked line is added with qty 1 and marked as chosen', () => {
    const lines = addPickedLine(DEFAULTS, { product_short_name: 'connoisseur_handle_lh' })
    expect(lines).toHaveLength(3)
    expect(lines[2]).toMatchObject({
      product_short_name: 'connoisseur_handle_lh', finish_code: null, qty: 1, source: 'picked',
    })
    expect(lineSourceLabel(lines[2])).toBe('chosen')
    expect(lineSourceLabel(lines[0])).toBe('rule default')
  })

  it('picking the same product and finish again bumps the qty', () => {
    let lines = addPickedLine([], { product_short_name: 'kenrick_extension_950mm', finish_code: 'PC' })
    lines = addPickedLine(lines, { product_short_name: 'kenrick_extension_950mm', finish_code: 'PC', qty: 3 })
    expect(lines).toHaveLength(1)
    expect(lines[0].qty).toBe(4)
    // a DIFFERENT finish is its own line (Step AQ: two finishes must not merge)
    lines = addPickedLine(lines, { product_short_name: 'kenrick_extension_950mm', finish_code: 'PB' })
    expect(lines).toHaveLength(2)
  })

  it('lines can be removed, their qty and their finish edited', () => {
    let lines = addPickedLine(DEFAULTS, { product_short_name: 'connoisseur_handle_lh' })
    lines = setLineQty(lines, 2, 2)
    expect(lines[2].qty).toBe(2)
    lines = setLineFinish(lines, 2, 'SC')
    expect(lines[2].finish_code).toBe('SC')
    lines = setLineFinish(lines, 2, '')          // back to "item finish"
    expect(lines[2].finish_code).toBe(null)
    expect(setLineQty(lines, 2, 0)[2].qty, 'a qty of 0 is refused').toBe(2)
    expect(setLineQty(lines, 2, 'abc')[2].qty).toBe(2)
    lines = removeLineAt(lines, 0)
    expect(lines.map(l => l.product_short_name))
      .toEqual(['trickle_vent_xr16', 'connoisseur_handle_lh'])
  })

  it('an edited set is marked edited, so nothing re-defaults it', () => {
    expect(isEditedSet({ ironmongeryLines: DEFAULTS })).toBe(false)
    const lines = addPickedLine(DEFAULTS, { product_short_name: 'connoisseur_handle_lh' })
    expect(isEditedSet(setPatch(lines))).toBe(true)
    // The flag alone is enough — a surveyor who DELETED every line has an
    // edited (empty) set, and the panel's auto-apply must not fill it in
    // again the next time the panel opens.
    expect(isEditedSet(setPatch([]))).toBe(true)
    expect(isEditedSet({ ironmongeryLines: [] })).toBe(false)
    // and a drawing saved before this step, which has no flag, is read from
    // its lines
    expect(isEditedSet({ ironmongeryLines: [{ product_short_name: 'x', source: 'manual' }] })).toBe(true)
    expect(isChosenLine({ product_short_name: 'x' }), 'no source = chosen').toBe(true)
  })

  it('"Apply Defaults" puts back the rule defaults and nothing else', () => {
    const edited = addPickedLine(DEFAULTS, { product_short_name: 'connoisseur_handle_lh' })
    expect(chosenLines(edited)).toHaveLength(1)        // what the confirm names
    const back = defaultsBack(DEFAULTS)
    expect(back.map(l => l.product_short_name))
      .toEqual(['z-claw_fastener_kit_wpulleys', 'trickle_vent_xr16'])
    expect(back.every(l => l.source === 'default')).toBe(true)
    expect(isEditedSet(setPatch(back, { edited: false }))).toBe(false)
  })
})

// ── 3. The board path ───────────────────────────────────────────────────────

const d = describe.skipIf(SNAPSHOT === null)

/** L34265 item 9's stored set, exactly as Integrate holds it. */
const L34265_ITEM9 = [
  ['connoisseur_handle_lh', 1],
  ['connoisseur_handle_rh', 1],
  ['defender_friction_hinge_-_side_hung_310mm', 2],
  ['kenrick_extension_950mm', 4],
  ['kenrick_extension_gear_box', 2],
  ['trickle_vent_xr16', 1],
]

/** Integrate's own nine "Ironmongery Cost" lines for that set. */
const INTEGRATE_LINES = [8.40, 8.40, 16.80, 4.20, 8.40, 8.40, 1.05, 1.05, 3.15]

/** L32520 item 9 (LQ8) — the other set the brief records, on a plain casement. */
const L32520_ITEM9 = [
  ['defender_412mm', 1],
  ['hardwick_lyndon_rh_locking_espag_handle', 1],
  ['kenrick_extension_690mm', 2],
  ['kenrick_extension_gear_box', 1],
  ['trickle', 1],
  ['trickle_vent_xr16', 1],
]
const L32520_INTEGRATE_LINES = [7.35, 15.75, 2.10, 3.15, 4.20, 1.05, 1.05, 2.10, 3.15]

d('Step BO — a French casement with L34265 item 9’s set', () => {
  /** The picker's products, built from the live snapshot's catalogue. */
  function catalogueProducts() {
    const byProduct = new Map()
    for (const key of Object.keys(SNAPSHOT.ironmongeryCatalogue)) {
      const idx = key.lastIndexOf(':')
      const short = key.slice(0, idx)
      const code  = key.slice(idx + 1)
      if (!byProduct.has(short)) byProduct.set(short, { short_name: short, name: short, category: null, finishes: [] })
      byProduct.get(short).finishes.push({ code, cost: SNAPSHOT.ironmongeryCatalogue[key].cost })
    }
    return [...byProduct.values()]
  }

  /** A French casement at FR1's size, built the way the board builds one. */
  function frenchCasement() {
    const { tree, missing } = buildCasementFrame(PV, {
      width: 1199, height: 1313, openings: ['opening_casement'], product: 'casement',
    })
    expect(missing).toEqual([])
    const res = changeOpening(tree, openingNodes(tree)[0].key, 'french_casement', PV)
    expect(res.changed).toBe(true)
    return res.tree
  }

  const paintOf = t => t.children.find(c => c.part_type === 'paintAndIronmongeryPart')

  /**
   * Enter the set the way the PICKER does: look each product up in the
   * catalogue, take the finish the picker would offer, and add the line.
   * The one product the picker ASKS about (the vent is Wht or Blk, the item
   * is PB) is answered with Integrate's own Wht.
   */
  function enterSet(tree, set) {
    const products = catalogueProducts()
    const itemFinish = paintOf(tree).values.ironmongeryFinish
    let lines = []
    for (const [short, qty] of set) {
      const product = products.find(p => p.short_name === short)
      expect(product, `${short} is in the catalogue`).toBeTruthy()
      const pick = pickerFinishFor(product, itemFinish)
      const finish = pick.reason === 'ask' ? 'Wht' : pick.stored
      lines = addPickedLine(lines, { product_short_name: short, finish_code: finish, qty })
    }
    const patch = setPatch(lines)
    return {
      ...tree,
      children: tree.children.map(c => c.part_type !== 'paintAndIronmongeryPart' ? c
        : ({ ...c, values: { ...c.values, ...patch } })),
    }
  }

  function price(tree) {
    const ironmongeryLines = resolveIronmongeryLines(tree, SNAPSHOT, SNAPSHOT.profileValues)
    return {
      ironmongeryLines,
      results: runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
        glassCatalogue:       SNAPSHOT.glassCatalogue,
        partAllocationRules:  SNAPSHOT.partAllocationRules,
        partCostMap:          SNAPSHOT.partCostMap,
        ironmongeryLines,
        ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
        profileValues:        SNAPSHOT.profileValues,
      }),
    }
  }

  // Each ironmongery line, by the part it costs. Sorted by part code, because
  // the ORDER is Integrate's set order crossed with each kit's part order and
  // carries no meaning — the nine amounts do.
  const ironLines = results => results.price.lines
    .filter(l => l.fires && !l.error && l.alloc_iron_short_name)
    .map(l => [l.alloc_iron_part_code ?? '', Number(l.line_cost.toFixed(2))])
    .sort((a, b) => a[0].localeCompare(b[0]))

  it('stores the set with Integrate’s own finishes: PB handles, PC gear, Wht vent', () => {
    const tree = enterSet(frenchCasement(), L34265_ITEM9)
    const stored = paintOf(tree).values.ironmongeryLines
    expect(stored.map(l => [l.product_short_name, l.finish_code, l.qty])).toEqual([
      ['connoisseur_handle_lh', null, 1],       // null = follow the item's PB
      ['connoisseur_handle_rh', null, 1],
      ['defender_friction_hinge_-_side_hung_310mm', 'PC', 2],
      ['kenrick_extension_950mm', 'PC', 4],
      ['kenrick_extension_gear_box', 'PC', 2],
      ['trickle_vent_xr16', 'Wht', 1],
    ])
    expect(stored.every(l => l.source === 'picked')).toBe(true)
  })

  it('prices the set AS STORED — the six lines resolve, none to 0.00', () => {
    const { ironmongeryLines, results } = price(enterSet(frenchCasement(), L34265_ITEM9))
    expect(ironmongeryLines.map(l => [l.product_short_name, l.finish_code])).toEqual([
      ['connoisseur_handle_lh', 'PB'],
      ['connoisseur_handle_rh', 'PB'],
      ['defender_friction_hinge_-_side_hung_310mm', 'PC'],
      ['kenrick_extension_950mm', 'PC'],
      ['kenrick_extension_gear_box', 'PC'],
      ['trickle_vent_xr16', 'Wht'],
    ])
    expect(ironmongeryLines.every(l => l.origin === 'stored')).toBe(true)
    expect(results.warnings.filter(w => /ironmongery/i.test(w))).toEqual([])
  })

  it('gets Integrate’s NINE ironmongery lines, to the penny', () => {
    const { results } = price(enterSet(frenchCasement(), L34265_ITEM9))
    // Nine, because the Kenrick gear box is a KIT of four parts — which is
    // exactly why Integrate's six-product set shows nine lines too.
    expect(ironLines(results)).toEqual([
      ['RFH203',  16.80],   // the two friction hinges  (7.82 x 2 -> 16 -> x1.05)
      ['RHZ665',   3.15],   // the trickle vent         (3.25    ->  3 -> x1.05)
      ['RJZ1700',  8.40],   // gear box: Excalibur gearbox 25mm
      ['RJZ1705',  8.40],   // four 950 extensions      (2.07 x 4 ->  8 -> x1.05)
      ['RJZ1708',  4.20],   // gear box: centre strike
      ['RJZ1709',  1.05],   // gear box: LH shootbolt strike
      ['RJZ1710',  1.05],   // gear box: RH shootbolt strike
      ['RJZ675',   8.40],   // the RH handle            (7.55    ->  8 -> x1.05)
      ['RJZ6762',  8.40],   // the LH handle
    ])

    // And they are INTEGRATE'S nine, amount for amount. The order differs
    // (Integrate lists the set, then each kit) and carries no meaning, so
    // both are compared sorted.
    const mine = ironLines(results).map(l => l[1]).sort((a, b) => a - b)
    expect(mine).toEqual([...INTEGRATE_LINES].sort((a, b) => a - b))
    const sum = a => Number(a.reduce((x, y) => x + y, 0).toFixed(2))
    expect(sum(mine)).toBe(59.85)
    expect(sum(INTEGRATE_LINES)).toBe(59.85)
  })

  it('says what the defaults would have charged instead', () => {
    // What the surveyor is choosing BETWEEN, on this fixture: GlazePro's own
    // default rules pick the same six products at the same quantities and
    // add a seventh — the Trickle Vent Grille (`trickle`, Wht, 1.75 -> 2 ->
    // 2.10), which Integrate's stored set for this item does not hold,
    // although its L32520 item 9 set does. So the defaults are 61.95 and the
    // stored set is 59.85.
    const def = price(frenchCasement())
    const set = price(enterSet(frenchCasement(), L34265_ITEM9))
    const tot = r => Number(ironLines(r.results).reduce((a, l) => a + l[1], 0).toFixed(2))
    expect(tot(def)).toBe(61.95)
    expect(tot(set)).toBe(59.85)

    const products = r => r.ironmongeryLines
      .map(l => `${l.product_short_name}:${l.finish_code}x${l.qty}`).sort()
    const onlyInDefaults = products(def).filter(p => !products(set).includes(p))
    expect(onlyInDefaults).toEqual(['trickle:Whtx1'])
    expect(products(set).filter(p => !products(def).includes(p))).toEqual([])
  })

  it('the breakdown says each line came from the STORED SET', () => {
    const { results } = price(enterSet(frenchCasement(), L34265_ITEM9))
    const labels = results.price.lines
      .filter(l => l.fires && l.alloc_iron_short_name).map(l => l.alloc_label)
    expect(labels).toContain('connoisseur_handle_lh (PB, item finish, stored set)')
    expect(labels).toContain('defender_friction_hinge_-_side_hung_310mm (PC, line finish, stored set)')
    expect(labels.every(l => / stored set\)$/.test(l))).toBe(true)
  })

  it('and a drawing with NO stored set still says "rule default"', () => {
    const { ironmongeryLines, results } = price(frenchCasement())
    expect(ironmongeryLines.every(l => l.origin === 'default')).toBe(true)
    const labels = results.price.lines
      .filter(l => l.fires && l.alloc_iron_short_name).map(l => l.alloc_label)
    expect(labels.length).toBeGreaterThan(0)
    expect(labels.every(l => / rule default\)$/.test(l))).toBe(true)
  })

  it('changing a SIZE never touches the stored set', () => {
    const entered = enterSet(frenchCasement(), L34265_ITEM9)
    const before  = paintOf(entered).values.ironmongeryLines
    const wider   = resizeCasementFrame(entered, { width: 1599 }, null).tree
    const taller  = resizeCasementFrame(wider, { height: 1699 }, null).tree
    expect(paintOf(taller).values.ironmongeryLines).toEqual(before)
    expect(isEditedSet(paintOf(taller).values)).toBe(true)
    // and it prices the same nine lines at the same money on the new size
    expect(ironLines(price(taller).results)).toEqual(ironLines(price(entered).results))
  })

  it('and L32520 item 9’s set, on the casement it belongs to, is exact too', () => {
    // LQ8: a single top-hung casement at 1060 x 1230. Its stored set is the
    // other one the brief records, and it is a different shape — a 412
    // defender, a Hardwick Lyndon handle, ONE gear box and both trickle
    // products. Nine lines again, and Integrate's nine amounts again.
    const { tree, missing } = buildCasementFrame(PV, {
      width: 1060, height: 1230, openings: ['top_hung'], product: 'casement',
    })
    expect(missing).toEqual([])
    const entered = enterSet(tree, L32520_ITEM9)
    const mine = ironLines(price(entered).results).map(l => l[1]).sort((a, b) => a - b)
    expect(mine).toEqual([...L32520_INTEGRATE_LINES].sort((a, b) => a - b))
    expect(Number(mine.reduce((a, b) => a + b, 0).toFixed(2))).toBe(39.90)
  })

  it('a DOOR’s rule-allocated lock parts still come from the rules on top of the set', () => {
    // Step BO item 2, stated as Integrate states it: a stored set replaces
    // the default LINES, and nothing else. A door's MPLS keep and slave
    // hardware are allocated parts (group `mpls_doors`), priced as
    // ironmongery, and they must still be there — and must say they came
    // from the rules, not the set.
    const withSet = {
      ...BENCHMARK_FD1.tree,
      children: BENCHMARK_FD1.tree.children.map(c =>
        c.part_type !== 'paintAndIronmongeryPart' ? c : ({
          ...c,
          values: { ...c.values, ...setPatch([
            { product_short_name: 'trickle_vent_xr16', finish_code: 'Wht', qty: 1, source: 'picked' },
          ]) },
        })),
    }
    const run = tree => runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue:       {},
      partAllocationRules:  SNAPSHOT.partAllocationRules,
      partCostMap:          BENCHMARK_FD1.partCostMap,
      ironmongeryLines:     resolveIronmongeryLines(tree, SNAPSHOT, BENCHMARK_FD1.profileValues,
        { profileCode: BENCHMARK_FD1.profileCode }),
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues:        BENCHMARK_FD1.profileValues,
    })

    const allocated = results => results.price.lines
      .filter(l => l.fires && !l.error && l.alloc_iron_short_name && / \(rules\)$/.test(l.alloc_label))
      .map(l => [l.alloc_iron_part_code, Number(l.line_cost.toFixed(2))])

    const asIs    = run(BENCHMARK_FD1.tree)
    const withOne = run(withSet)
    expect(allocated(asIs).length, 'FD1 has allocated lock parts').toBeGreaterThan(0)
    expect(allocated(withOne), 'the stored set does not disturb them')
      .toEqual(allocated(asIs))

    // and the stored line is the only ironmongery LINE left
    const setLines = withOne.price.lines
      .filter(l => l.fires && l.alloc_iron_short_name && / stored set\)$/.test(l.alloc_label))
    expect(setLines.map(l => l.alloc_iron_part_code)).toEqual(['RHZ665'])
  })

  it('survives the save / load round trip the app does', () => {
    // `drawing_parts` has no key column: the client keys go in and row ids
    // come out (saveRoundTrip.test.js). The set lives in `values`, so it
    // must come back line for line, flag and all.
    const entered = enterSet(frenchCasement(), L34265_ITEM9)
    const reloaded = roundTrip(entered)
    const paint = paintOf(reloaded)
    expect(paint.values.ironmongeryLines)
      .toEqual(paintOf(entered).values.ironmongeryLines)
    expect(paint.values.ironmongerySetEdited).toBe(true)
    expect(isEditedSet(paint.values)).toBe(true)
    expect(ironLines(price(reloaded).results)).toEqual(ironLines(price(entered).results))
  })
})

/**
 * `saveDrawingParts` + `loadDrawingParts`, as saveRoundTrip.test.js models
 * them: flatten to key / parent_key rows, hand out database ids, and rebuild
 * keyed by the row id.
 */
function roundTrip(tree, nextId = 7000) {
  let id = nextId
  const rows = []
  ;(function flatten(node, parentKey) {
    const key = String(id++)
    rows.push({ id: key, parent_key: parentKey, part_type: node.part_type,
      sort_order: node.sort_order ?? 0, values: JSON.parse(JSON.stringify(node.values ?? {})) })
    for (const child of (node.children ?? [])) flatten(child, key)
  })(tree, null)

  const byKey = new Map()
  for (const row of rows) {
    byKey.set(row.id, { key: row.id, part_type: row.part_type,
      sort_order: row.sort_order, values: row.values, children: [] })
  }
  let root = null
  for (const row of rows) {
    const node = byKey.get(row.id)
    if (row.parent_key == null) root = node
    else byKey.get(row.parent_key).children.push(node)
  }
  return root
}
