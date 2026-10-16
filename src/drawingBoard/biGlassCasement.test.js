// biGlassCasement.test.js — Step BJ item 2
//
// A casement drawing switched to Bi-glass and back, the way a surveyor does
// it: pick the type of work, and the board brings the drawing into line.
//
// The point of reference is the BENCHMARK: a complete-new casement switched
// to bi-glass must come out as the tree Integrate stores, and so must price
// what Integrate prices. BG1 is a copy of P, and BG3 of Configuration 4, so
// the board is asked to make exactly that journey and the result is compared
// with the fixture the facts were read into.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import {
  applyBiGlassCasement, biGlassDisagreeing, isCasementTree, isBiGlassItem,
  BI_GLASS_SINGLE_PART, BI_GLASS_GLAZING_ID, DOUBLE_GLAZING_ID,
} from './biGlassCasement.js'
import { buildCasementFrame, openingNodes, setCasementOperation } from './casementOpenings.js'
import { applyDividers } from './gridActions.js'
import { assertSaveable } from './containment.js'
import { frameCells, casementSashSize, casementGlassSightline } from '../pricing/casementGeometry.js'
import { runPricingOnTree } from '../pricing/pricingEngine.js'
import { computeVariables } from '../pricing/computeVariables.js'
import { computeDerived } from './computeDerived.js'
import { resolveIronmongeryLines } from '../pricing/loadPricingContext.js'
import {
  BENCHMARK_BG1, BENCHMARK_BG3,
} from '../pricing/benchmarks/fixtureBiGlass.js'
import { withFixedCasementSashBiGlass } from '../pricing/benchmarks/liveRuleFixes.js'
import { itemHeading } from '../quotes/pdf/quoteDocModel.js'
import { LEAD_TIMES } from '../quotes/pdf/quoteContent.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = resolve(HERE, '../pricing/benchmarks/pf30-snapshot.json')
const SNAPSHOT = existsSync(SNAPSHOT_PATH)
  ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
  : null

// Profile 2 (casement), as the board loads it.
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
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 16,
  'glassPart.defaultDoubleGlazingTolerance': 2,
  'glassPart.defaultDirGuStopSize': 20,
  'glassPart.defaultDoubleGlazingRebateWidthForDirGU': 20,
  'glassPart.defaultDoubleGlazingToleranceForDirGU': 2,
}
const PICKER_PV = { thicknessInFrameSolid: 27, mullionStopSize: 20 }

const itemOf  = t => t
const paintOf = t => t.children.find(c => c.part_type === 'paintAndIronmongeryPart')
const frameOf = t => t.children.find(c => c.part_type === 'assemblyFramePart')
const glassOf = sash => sash.children.find(c => c.part_type === 'glassPart')

/** Set the item's type of work, as the board's field edit does. */
function setTypeOfWork(tree, tow) {
  return { ...tree, values: { ...tree.values, typeOfWork: tow } }
}

/** A complete-new casement from the board, at P's size. */
function singleCasement() {
  const { tree, missing } = buildCasementFrame(PV, {
    width: 1599, height: 1599, openings: ['opening_casement'], product: 'casement',
  })
  expect(missing).toEqual([])
  return tree
}

/** A complete-new three-column casement, at Configuration 4's size. */
function threeColumnCasement() {
  const { tree, missing } = buildCasementFrame(PV, {
    width: 1299, height: 1307, openings: ['opening_casement'], product: 'casement',
  })
  expect(missing).toEqual([])
  const f = frameOf(tree)
  let t = applyDividers(tree, f.key, 3, 1, 1225, 1213, PICKER_PV, 'solid')
  // Integrate's own offsets, as the Step BI templates do
  const mulls = frameOf(t).children.filter(c => c.part_type === 'mullionPart')
    .sort((a, b) => a.values.offset - b.values.offset)
  for (const [i, off] of [393, 805].entries()) {
    t = {
      ...t,
      children: t.children.map(c => c.part_type !== 'assemblyFramePart' ? c : ({
        ...c,
        children: c.children.map(g => g.key !== mulls[i].key ? g
          : ({ ...g, values: { ...g.values, offset: off } })),
      })),
    }
  }
  // Configuration 4 is opener | FIXED | opener, and the fixed sash is the
  // whole point of BG3: it is what rule 15 charges 60 fitting minutes for.
  const ops = ['left_hand_hung', 'fix', 'right_hand_hung']
  for (let i = 0; i < ops.length; i++) {
    t = setCasementOperation(t, openingNodes(t)[i].key, ops[i]).tree
  }
  return t
}

/** Switch to bi-glass the way the board does: set the field, then apply. */
function toBiGlass(tree) {
  const { tree: out, changed, applied } = applyBiGlassCasement(setTypeOfWork(tree, 'bi_glass'))
  expect(applied).toBe('bi_glass')
  expect(changed.length).toBeGreaterThan(0)
  return out
}

function backToCompleteNew(tree) {
  const { tree: out, applied } = applyBiGlassCasement(setTypeOfWork(tree, 'complete_new'))
  expect(applied).toBe('casement')
  return out
}

describe('Step BJ item 2 — switching a casement to bi-glass', () => {
  it('the sashes are KEPT and the glass is what gets replaced', () => {
    const bg = toBiGlass(singleCasement())
    for (const sash of openingNodes(bg)) {
      expect(sash.values.toBeReplaced).toBe(false)
      expect(glassOf(sash).values.toBeReplaced).toBe(true)
    }
  })

  it('every sash EQUALS its opening — no clearance', () => {
    const bg = toBiGlass(singleCasement())
    const cells = frameCells(bg)
    const sashes = openingNodes(bg)
    for (let i = 0; i < sashes.length; i++) {
      for (const f of ['mechanicalClearanceLeft', 'mechanicalClearanceRight',
        'mechanicalClearanceTop', 'mechanicalClearanceBottom']) {
        expect(sashes[i].values[f], f).toBe(0)
      }
      const size = casementSashSize(bg, sashes[i])
      expect([size.width, size.height]).toEqual([cells[i].width, cells[i].height])
    }
    // Integrate's own figure: P's 1517 x 1497 sash becomes 1525 x 1505
    expect(casementSashSize(bg, sashes[0])).toEqual({ width: 1525, height: 1505 })
    // and the glass follows it: sightline 1401 x 1360
    expect(casementGlassSightline(bg, sashes[0])).toEqual({ width: 1401, height: 1360 })
  })

  it('every glass is Single 4 mm Clear Toughened, the double codes kept', () => {
    const before = singleCasement()
    const beforeGlass = glassOf(openingNodes(before)[0]).values
    const bg = toBiGlass(before)
    const gv = glassOf(openingNodes(bg)[0]).values
    expect(gv.glazingId).toBe(BI_GLASS_GLAZING_ID)
    expect(gv.singleGlassPartNo).toBe(BI_GLASS_SINGLE_PART)
    // the double-glazing codes are still there, so switching back finds them
    expect(gv.internalGlassPartNo).toBe(beforeGlass.internalGlassPartNo)
    expect(gv.externalGlassPartNo).toBe(beforeGlass.externalGlassPartNo)
  })

  it('the stored surround is cleared and Casement MPLS goes off', () => {
    // a template-style tree WITH a surround list, as Integrate's C4 had
    const withSurround = (() => {
      const t = threeColumnCasement()
      return {
        ...t,
        values: {
          ...t.values,
          surroundLines: [{ part_code: 'TP61', qty: 1, length_mm: 1450, label: 'Nosing in Solid Redwood' }],
        },
      }
    })()
    expect(paintOf(withSurround).values.isCasementMpls).toBe(true)
    const bg = toBiGlass(withSurround)
    expect(itemOf(bg).values.surroundLines).toBeUndefined()
    expect(paintOf(bg).values.isCasementMpls).toBe(false)
  })

  it('the glazing bars are LEFT ALONE — they are charged to take off', () => {
    const t = singleCasement()
    const sash = openingNodes(t)[0]
    const glass = glassOf(sash)
    const withBars = {
      ...t,
      children: t.children.map(c => c.part_type !== 'assemblyFramePart' ? c : ({
        ...c,
        children: c.children.map(o => o.key !== sash.key ? o : ({
          ...o,
          children: o.children.map(g => g.key !== glass.key ? g : ({
            ...g,
            children: [
              { key: 'vb1', part_type: 'verticalGlazingBarPart', values: {}, children: [] },
              { key: 'hb1', part_type: 'horizontalGlazingBarPart', values: {}, children: [] },
              { key: 'hb2', part_type: 'horizontalGlazingBarPart', values: {}, children: [] },
            ],
          })),
        })),
      })),
    }
    const bg = toBiGlass(withBars)
    const bars = glassOf(openingNodes(bg)[0]).children
    expect(bars.map(b => b.part_type)).toEqual([
      'verticalGlazingBarPart', 'horizontalGlazingBarPart', 'horizontalGlazingBarPart',
    ])
    // and they are what gb_qty counts, so the removal is charged
    expect(computeVariables(bg, computeDerived(bg), SNAPSHOT?.pfVariables ?? {}).gb_qty).toBe(3)
  })

  it('no default ironmongery is added — the sashes keep theirs', () => {
    // There is no stored list on a board-built casement, so the DEFAULT rules
    // would normally run. Nathan: none on bi-glass, because the sashes are
    // kept. What the rules give is what the item asks for; this records that
    // the tick adds nothing of its own.
    const bg = toBiGlass(singleCasement())
    expect(paintOf(bg).values.ironmongeryLines).toBeUndefined()
  })

  it('it saves, and it is still a casement', () => {
    const bg = toBiGlass(threeColumnCasement())
    expect(() => assertSaveable(bg)).not.toThrow()
    expect(isCasementTree(bg)).toBe(true)
    expect(isBiGlassItem(bg)).toBe(true)
  })

  it('draught sealing is DERIVED, not stored — nothing to write', () => {
    const bg = toBiGlass(singleCasement())
    const item = itemOf(bg).values
    // GlazePro's typeOfWork is single-valued, so there is no draughtSeal flag
    expect(item.draughtSeal).toBeUndefined()
    expect(item.typeOfWork).toBe('bi_glass')
    // and the engine works it out
    expect(computeVariables(bg, computeDerived(bg), SNAPSHOT?.pfVariables ?? {}).needs_draughtsealing)
      .toBe(true)
  })
})

describe('Step BJ item 2 — switching back', () => {
  it('a complete-new casement gets its clearance, glazing and MPLS back', () => {
    const original = singleCasement()
    const back = backToCompleteNew(toBiGlass(original))
    const sash = openingNodes(back)[0]
    for (const f of ['mechanicalClearanceLeft', 'mechanicalClearanceRight',
      'mechanicalClearanceTop', 'mechanicalClearanceBottom']) {
      expect(sash.values[f], f).toBe(4)
    }
    expect(sash.values.toBeReplaced).toBe(true)
    expect(glassOf(sash).values.glazingId).toBe(DOUBLE_GLAZING_ID)
    expect(glassOf(sash).values.toBeReplaced).toBeUndefined()
    expect(paintOf(back).values.isCasementMpls).toBe(true)
    // the sash is back to P's own size
    expect(casementSashSize(back, sash)).toEqual({ width: 1517, height: 1497 })
  })

  it('the round trip restores every value but the stored single-glass code', () => {
    const original = singleCasement()
    const back = backToCompleteNew(toBiGlass(original))
    // The sashes come back exactly
    expect(openingNodes(back).map(s => s.values))
      .toEqual(openingNodes(original).map(s => s.values))
    // and so does the glass, EXCEPT that the 4 mm Clear Toughened code stays
    // stored. That is deliberate and it is what Integrate does with the
    // double codes in the other direction: a code left on the part costs
    // nothing (no double-glazing rule reads singleGlassPartNo) and it means a
    // second switch to bi-glass finds the right pane already chosen.
    const strip = (g) => {
      const rest = { ...g }
      delete rest.singleGlassPartNo
      return rest
    }
    expect(openingNodes(back).map(s => strip(glassOf(s).values)))
      .toEqual(openingNodes(original).map(s => strip(glassOf(s).values)))
    expect(glassOf(openingNodes(back)[0]).values.singleGlassPartNo)
      .toBe(BI_GLASS_SINGLE_PART)
    expect(glassOf(openingNodes(original)[0]).values.singleGlassPartNo)
      .toBeUndefined()
  })

  it('applying it twice changes nothing the second time', () => {
    const bg = toBiGlass(singleCasement())
    expect(biGlassDisagreeing(bg)).toEqual([])
    const again = applyBiGlassCasement(bg)
    expect(again.changed).toEqual([])
    expect(again.tree).toBe(bg)
  })
})

describe('Step BJ item 3 — a sliding sash is untouched', () => {
  it('a box sash item is left exactly as it is, bi-glass or not', () => {
    // A minimal box sash: a sash pair, no casement sash. That is the whole
    // test the module makes (is_box_sash), so a literal tree is clearer than
    // a full build and cannot drift with the builder.
    const tree = {
      key: 'item1', part_type: 'drawingItemPart',
      values: { typeOfWork: 'complete_new' },
      children: [{
        key: 'frame1', part_type: 'assemblyFramePart',
        values: { width: 1120, height: 1800 },
        children: [{
          key: 'pair1', part_type: 'sashPairPart', values: { sashThickness: 45 },
          children: [
            { key: 'top1', part_type: 'topSashPart', values: { toBeReplaced: true },
              children: [{ key: 'tg1', part_type: 'glassPart', values: { glazingId: 'double_glazing' }, children: [] }] },
            { key: 'bot1', part_type: 'bottomSashPart', values: { toBeReplaced: true },
              children: [{ key: 'bg1', part_type: 'glassPart', values: { glazingId: 'double_glazing' }, children: [] }] },
          ],
        }],
      }],
    }
    for (const tow of ['bi_glass', 'complete_new', 'draught_seal']) {
      const t = setTypeOfWork(tree, tow)
      const out = applyBiGlassCasement(t)
      expect(out.applied, tow).toBe(null)
      expect(out.changed, tow).toEqual([])
      expect(out.tree, tow).toBe(t)
    }
  })

  it('and a casement on any OTHER type of work is left alone too', () => {
    const t = setTypeOfWork(singleCasement(), 'no_work')
    const out = applyBiGlassCasement(t)
    expect(out.applied).toBe(null)
    expect(out.changed).toEqual([])
  })
})

// ── And it must price what Integrate prices ─────────────────────────────────

const d = SNAPSHOT ? describe : describe.skip

d('Step BJ item 2 — the board’s bi-glass casement prices as the fixture does', () => {
  const RULES = SNAPSHOT ? withFixedCasementSashBiGlass(SNAPSHOT.rules) : []

  function price(tree, ironmongeryLines) {
    return runPricingOnTree(tree, RULES, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: { TP68: 2.85, TP61: 2.76 },
      ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
    })
  }

  /** The fixture's stored ironmongery, so the two compare like for like. */
  const withIronmongery = (tree, bm) => ({
    ...tree,
    children: tree.children.map(c => c.part_type !== 'paintAndIronmongeryPart' ? c : ({
      ...c,
      values: { ...c.values, ironmongeryLines: bm.ironmongeryLines.map(l => ({ ...l })) },
    })),
  })

  it('BG1: the board’s tree is the fixture’s money, to the penny', () => {
    const board = withIronmongery(toBiGlass(singleCasement()), BENCHMARK_BG1)
    const mine   = price(board, BENCHMARK_BG1.ironmongeryLines)
    const theirs = price(BENCHMARK_BG1.tree, BENCHMARK_BG1.ironmongeryLines)
    expect(mine.price.total_cost).toBeCloseTo(theirs.price.total_cost, 2)
    expect(mine.price.total).toBeCloseTo(theirs.price.total, 2)
    expect(mine.install_labour.total_minutes).toBe(theirs.install_labour.total_minutes)
    expect(mine.manufacture_labour.total_minutes).toBe(theirs.manufacture_labour.total_minutes)
    // and so it is Integrate's own figure
    expect(mine.price.total_cost).toBeCloseTo(358.24, 2)
  })

  it('BG3: three columns, the fixed sash charged, to the penny', () => {
    const board = withIronmongery(toBiGlass(threeColumnCasement()), BENCHMARK_BG3)
    const mine   = price(board, BENCHMARK_BG3.ironmongeryLines)
    const theirs = price(BENCHMARK_BG3.tree, BENCHMARK_BG3.ironmongeryLines)
    expect(mine.price.total_cost).toBeCloseTo(theirs.price.total_cost, 2)
    expect(mine.install_labour.total_minutes).toBe(theirs.install_labour.total_minutes)
    expect(mine.price.total_cost).toBeCloseTo(698.90, 2)
  })

  it('switching back prices the complete-new casement again', () => {
    // P's own figure is not asserted here (the board tree carries no stored
    // ironmongery or surround), but the DIRECTION is: a complete-new casement
    // charges joinery and a bi-glass one does not.
    const complete = price(singleCasement(), [])
    const bg = price(toBiGlass(singleCasement()), [])
    const mm = r => r.price.lines
      .filter(l => l.fires && !l.error && l.line_cost > 0 && l.group_name === 'manufacture_materials')
      .map(l => l.name)
    expect(mm(complete)).toContain('Softwood Casement Frame & Sashes')
    expect(mm(bg)).toEqual(['LTW General Consumables'])
    expect(complete.manufacture_labour.total_minutes).toBeGreaterThan(0)
    expect(bg.manufacture_labour.total_minutes).toBe(0)
  })

  it('the default ironmongery rules add nothing to a bi-glass casement', () => {
    // Nathan: none by default, because the sashes are kept. This is what the
    // live rules actually give, reported rather than assumed.
    const bg = toBiGlass(singleCasement())
    const lines = resolveIronmongeryLines(bg, SNAPSHOT, SNAPSHOT.profileValues) ?? []
    const named = lines.map(l => `${l.product_short_name} x${l.qty}`)
    // Printed so the report can quote the run rather than a guess.
    if (named.length > 0) console.log('bi-glass default ironmongery:', named.join(' | '))
    expect(Array.isArray(lines)).toBe(true)
  })
})

// ── What the QUOTE says for a bi-glass casement ─────────────────────────────
//
// Step BJ item 2's last question. The Bi-Glass wording already exists — it
// was written for sashes — and it is reused unchanged: the item type comes
// from the drawing's window_type, so the same sentence reads "casement
// window" instead of "sash window". Nothing was added for this step.
describe('Step BJ item 2 — the quote wording', () => {
  const itemFor = (typeOfWork, windowType) => ({
    parts_tree: { key: 'i', part_type: 'drawingItemPart', values: { typeOfWork }, children: [] },
    drawing: { window_type: windowType },
  })

  it('reads "Bi-Glass secondary glazing for casement window"', () => {
    const { heading, descriptionOfWork } = itemHeading(itemFor('bi_glass', 'Casement'), null, {})
    expect(heading).toBe('Supply & Install Bi-Glass secondary glazing for casement window')
    expect(descriptionOfWork).toBe('Supply & Install Bi-Glass secondary glazing for casement window')
  })

  it('the same sentence a sash window gets, with its own item type', () => {
    const sash = itemHeading(itemFor('bi_glass', 'Box Sash'), null, {}).heading
    expect(sash).toBe('Supply & Install Bi-Glass secondary glazing for sash window')
  })

  it('and the range comes through as it does on any item', () => {
    const { heading } = itemHeading(itemFor('bi_glass', 'Casement'), 'Casement', {})
    expect(heading).toBe('Supply & Install Bi-Glass secondary glazing for casement window (Casement range)')
  })

  it('the lead time placeholder for bi-glass is [bg_lead_time], 10-12 weeks', () => {
    // A LETTER token the surveyor places, not something chosen per item —
    // recorded here because the brief asks what the quote shows.
    expect(LEAD_TIMES.bg_lead_time).toBe('10-12')
  })
})

// ── No DEFAULT ironmongery on a bi-glass casement ───────────────────────────
//
// Nathan (15 Oct): "Ironmongery: none by default (the sashes keep theirs).
// The surveyor may add any that is replaced; stored ironmongery is priced as
// stored."
//
// Two things made that false. The hinge rules fire on any big side-hung
// casement, so a bi-glass one was given EIGHT 76 mm hinges — £40.95 to
// re-hinge sashes nobody is taking off, and two more than the same window
// complete new, because the bi-glass sash is bigger and heavier. And the
// Brighton fastener kit — a SASH WINDOW part — is gated on
// needs_draughtsealing, which a bi-glass casement now sets.
const dIron = SNAPSHOT ? describe : describe.skip

dIron('Step BJ item 2 — a bi-glass casement gets no default ironmongery', () => {
  it('the default rules give it nothing at all', () => {
    const bg = toBiGlass(singleCasement())
    expect(resolveIronmongeryLines(bg, SNAPSHOT, SNAPSHOT.profileValues)).toEqual([])
  })

  it('and so nothing is priced for it', () => {
    const bg = toBiGlass(singleCasement())
    const lines = resolveIronmongeryLines(bg, SNAPSHOT, SNAPSHOT.profileValues) ?? []
    const r = runPricingOnTree(bg, withFixedCasementSashBiGlass(SNAPSHOT.rules), SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: { TP68: 2.85, TP61: 2.76 },
      ironmongeryLines: lines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
    })
    expect(r.price.lines.filter(l => l.fires && l.alloc_iron_part_code)).toEqual([])
  })

  it('a STORED list is still priced as stored', () => {
    // The surveyor adds what is actually replaced, and that is charged.
    const bg = toBiGlass(singleCasement())
    const stored = {
      ...bg,
      children: bg.children.map(c => c.part_type !== 'paintAndIronmongeryPart' ? c : ({
        ...c,
        values: {
          ...c.values,
          ironmongeryLines: [{
            product_short_name: 'connoisseur_handle_lh', finish_code: 'PB',
            qty: 1, source: 'survey',
          }],
        },
      })),
    }
    const lines = resolveIronmongeryLines(stored, SNAPSHOT, SNAPSHOT.profileValues)
    expect(lines.map(l => l.product_short_name)).toEqual(['connoisseur_handle_lh'])
  })

  it('a COMPLETE NEW casement still gets its defaults', () => {
    // The rule is about bi-glass alone: nothing else loses its ironmongery.
    const lines = resolveIronmongeryLines(singleCasement(), SNAPSHOT, SNAPSHOT.profileValues) ?? []
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.map(l => l.product_short_name)).toContain('connoisseur_handle_lh')
  })

  it('and a bi-glass SLIDING sash is untouched (item 3)', () => {
    // Bi-glass on a box sash is a separate step. Its defaults are whatever
    // they are today, and this step must not empty them.
    const boxSash = {
      key: 'item1', part_type: 'drawingItemPart',
      values: { typeOfWork: 'bi_glass', frameMaterialId: 'softwood', sashMaterialId: 'softwood' },
      children: [
        { key: 'paint1', part_type: 'paintAndIronmongeryPart',
          values: { ironmongeryFinish: 'PB' }, children: [] },
        { key: 'frame1', part_type: 'assemblyFramePart',
          values: { width: 1120, height: 1800, leftWidth: 50, rightWidth: 50, topHeight: 50, bottomHeight: 50 },
          children: [{
            key: 'pair1', part_type: 'sashPairPart', values: { sashThickness: 45 },
            children: [
              { key: 'top1', part_type: 'topSashPart', values: { toBeReplaced: false },
                children: [{ key: 'tg1', part_type: 'glassPart', values: { glazingId: 'single_glazing' }, children: [] }] },
              { key: 'bot1', part_type: 'bottomSashPart', values: { toBeReplaced: false },
                children: [{ key: 'bg1', part_type: 'glassPart', values: { glazingId: 'single_glazing' }, children: [] }] },
            ],
          }],
        },
      ],
    }
    // The guard is scoped by is_casement_window, and this tree is a box
    // sash, so it cannot apply. Checked on the VARIABLES rather than by
    // running the default rules, because a single-glazed box sash cannot
    // compute its sash weight on this profile at all: sashWeight wants
    // `glassPart.defaultSingleGlazingRebateWidthForSash` and the casement
    // profile has only the double-glazing key, so the default-ironmongery
    // path throws. That is a real gap, it is NOT caused by this step, and it
    // is one the sliding-sash bi-glass step will have to deal with — it is
    // reported in docs/reports/step-bj.md rather than patched here.
    const vars = computeVariables(boxSash, computeDerived(boxSash), SNAPSHOT.pfVariables)
    expect(vars.is_bi_glass).toBe(true)
    expect(vars.is_casement_window).toBe(false)
    expect(vars.is_box_sash).toBe(true)
    // and the flag this step derives is NOT set on a sliding sash
    expect(vars.needs_draughtsealing).toBe(false)
  })
})
