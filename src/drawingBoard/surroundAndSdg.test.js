// surroundAndSdg.test.js — Step BN
//
// The two answers on Finish & Ironmongery, from the tick boxes and dropdowns
// down to the minutes that fire.

import { describe, it, expect } from 'vitest'
import SNAPSHOT from '../pricing/benchmarks/pf30-snapshot.json'
import { runPricingOnTree } from '../pricing/pricingEngine.js'
import { computeVariables } from '../pricing/computeVariables.js'
import { computeDerived } from './computeDerived.js'
import { allocateParts } from '../pricing/partAllocator.js'
import {
  SURROUND_TICKS, SDG_TYPES, SDG_ACTIONS, EXTERNAL_LINING_PART_CODE,
  defaultSurroundValues, surroundTick, sdgVariables,
} from './surroundAndSdg.js'
import {
  BENCHMARK_LQ1, BENCHMARK_LQ2, BENCHMARK_LQ3, BENCHMARK_LQ4, BENCHMARK_LQ5,
  BENCHMARK_LQ6, BENCHMARK_LQ7, BENCHMARK_LQ8, BENCHMARK_LQ9,
} from '../pricing/benchmarks/fixtureLiveQuotes.js'

/** A plain casement window, so nothing else competes for the labour rules. */
const treeWith = (paintValues = {}) => ({
  key: 'item1', part_type: 'drawingItemPart',
  values: {
    typeOfWork: 'complete_new',
    frameMaterialId: 'utile', sashMaterialId: 'utile', cillMaterialId: 'utile',
    quantity: 1,
  },
  children: [
    { key: 'paint1', part_type: 'paintAndIronmongeryPart', values: paintValues, children: [] },
    { key: 'notes1', part_type: 'notesPart', values: {}, children: [] },
    {
      key: 'frame1', part_type: 'assemblyFramePart',
      values: {
        width: 1200, height: 1300, leftWidth: 37, rightWidth: 37,
        topHeight: 47, bottomHeight: 47, frameDepth: 96,
        jambType: 'solid_profiled', toBeReplaced: true,
      },
      children: [{
        key: 'cas1', part_type: 'casementSashPart',
        values: { operation: 'fix', thickness: 54, toBeReplaced: true },
        children: [{ key: 'gl1', part_type: 'glassPart', values: {}, children: [] }],
      }],
    },
  ],
})

const varsOf = tree => computeVariables(tree, computeDerived(tree), SNAPSHOT.pfVariables)

const run = tree => runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
  glassCatalogue: SNAPSHOT.glassCatalogue,
  partAllocationRules: SNAPSHOT.partAllocationRules,
  partCostMap: { TP68: 2.85, AA01: 50, AA02: 30, AA03: 75 },
  ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
  profileValues: SNAPSHOT.profileValues,
})

/** The install_labour minutes one named rule contributes. */
const minutes = (r, name) => (r.install_labour?.lines ?? [])
  .filter(l => (l.rule_name ?? l.name) === name)
  .reduce((t, l) => t + (l.minutes ?? 0), 0)

const allocFor = tree => allocateParts(
  tree, varsOf(tree), SNAPSHOT.partAllocationRules, SNAPSHOT.glassCatalogue,
  false, SNAPSHOT.profileValues)

// ── The ticks ───────────────────────────────────────────────────────────────

describe('Step BN — the surround tick boxes', () => {
  it('the defaults are architrave only', () => {
    expect(defaultSurroundValues()).toEqual({
      surroundArchitrave: true,
      surroundLinings: false,
      surroundWindowBoard: false,
      surroundExternalLining: false,
    })
  })

  it('an OLDER drawing, with none of these keys, behaves as it always did', () => {
    // This is the whole reason no existing drawing or benchmark moves: an
    // absent value falls back to the tick's DEFAULT, not to false. So an
    // untouched drawing still gets its architrave and still gets no linings.
    expect(surroundTick({}, 'surroundArchitrave')).toBe(true)
    expect(surroundTick(undefined, 'surroundArchitrave')).toBe(true)
    expect(surroundTick({}, 'surroundLinings')).toBe(false)
    expect(surroundTick({}, 'surroundWindowBoard')).toBe(false)
    expect(surroundTick({}, 'surroundExternalLining')).toBe(false)
    // and an explicit false really does turn the architrave off
    expect(surroundTick({ surroundArchitrave: false }, 'surroundArchitrave')).toBe(false)
  })

  it('Linings fires "Linings" 180 and no material cost', () => {
    const plain = run(treeWith({}))
    const ticked = run(treeWith({ surroundLinings: true }))
    expect(minutes(plain, 'Linings')).toBe(0)
    expect(minutes(ticked, 'Linings')).toBe(180)
    expect(varsOf(treeWith({ surroundLinings: true })).has_lining).toBe(true)
    // the lining component is Integrate's placeholder: it prices at zero, so
    // only the labour moves
    const extra = ticked.price.total_cost - plain.price.total_cost
    expect(extra).toBeCloseTo(180 / 60 * 40.21, 2)
  })

  it('Window board fires "Windowboard" 30 and no material cost', () => {
    const plain = run(treeWith({}))
    const ticked = run(treeWith({ surroundWindowBoard: true }))
    expect(minutes(plain, 'Windowboard')).toBe(0)
    expect(minutes(ticked, 'Windowboard')).toBe(30)
    expect(varsOf(treeWith({ surroundWindowBoard: true })).has_deep_window_board).toBe(true)
    // 0.5 h at 40.21 = 20.105, and the engine rounds the hours to 2dp before
    // the rate, so the line is 20.10 and not 20.11.
    expect(ticked.price.total_cost - plain.price.total_cost).toBeCloseTo(20.10, 2)
  })

  it('External lining fires "External Lining" 180, through Integrate’s AA03', () => {
    // Integrate's rule 252 is `part_no == external_lining` on the component
    // loop, and external_lining is a VARIABLE whose value is AA03
    // (docs/integrate-rules-export.txt line 126). So the tick has to put an
    // AA03 component on the item AND the variable has to be defined, or the
    // rule compares a part code against 0 and never fires.
    const tree = treeWith({ surroundExternalLining: true })
    expect(varsOf(tree).external_lining).toBe(EXTERNAL_LINING_PART_CODE)
    expect(allocFor(tree).map(p => p.part_code)).toContain('AA03')
    const ticked = run(tree)
    expect(minutes(ticked, 'External Lining')).toBe(180)
    // and still no material cost: AA03 is allocated at 1 mm, and a surrounds
    // component rounds that to 0 m
    const aa03 = ticked.price.lines.filter(l => l.alloc_part_code === 'AA03')
    expect(aa03.length).toBeGreaterThan(0)
    for (const l of aa03) expect(l.line_cost).toBe(0)
  })

  it('unticking Architrave drops the architrave, and nothing else', () => {
    // LQ3's case: Integrate has no surround at all, and GlazePro allocated an
    // architrave anyway (+17.96 of installation_materials).
    const withIt = allocFor(treeWith({}))
    const without = allocFor(treeWith({ surroundArchitrave: false }))
    expect(withIt.filter(p => p.part_code === 'TP68').length).toBeGreaterThan(0)
    expect(without.filter(p => p.part_code === 'TP68')).toEqual([])
    // and it is the ONLY thing that goes: every other allocated part stays
    const codes = a => a.filter(p => p.part_code !== 'TP68')
      .map(p => `${p.part_code}:${p.measure}`).sort()
    expect(codes(without)).toEqual(codes(withIt))
    // which is a real saving, not a rounding
    expect(run(treeWith({})).price.total_cost -
      run(treeWith({ surroundArchitrave: false })).price.total_cost).toBeGreaterThan(1)
  })

  it('Step AV still works: a stored Nosing is a deep window board', () => {
    // Step AV reads has_deep_window_board off the drawing's STORED surround
    // list, where TP61 "Nosing in Solid Redwood" is the deep window board.
    // The tick is an OR with that, not a replacement, so TC1-TC3 do not move.
    const tree = treeWith({})
    tree.values.surroundLines = [{ part_code: 'TP61', label: 'Nosing in Solid Redwood' }]
    expect(varsOf(tree).has_deep_window_board).toBe(true)
    // and the tick alone does it too, with no stored list at all
    expect(varsOf(treeWith({ surroundWindowBoard: true })).has_deep_window_board).toBe(true)
    // while neither one means the other
    expect(varsOf(treeWith({})).has_deep_window_board).toBe(false)
  })

  it('all four ticks together fire all three rules', () => {
    const r = run(treeWith({
      surroundArchitrave: true, surroundLinings: true,
      surroundWindowBoard: true, surroundExternalLining: true,
    }))
    expect(minutes(r, 'Linings')).toBe(180)
    expect(minutes(r, 'Windowboard')).toBe(30)
    expect(minutes(r, 'External Lining')).toBe(180)
  })
})

// ── The SDG dropdowns ───────────────────────────────────────────────────────

describe('Step BN — existing SDG and obstruction', () => {
  it('Integrate’s own lists, ids and wording', () => {
    expect(SDG_TYPES.map(t => t.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(SDG_TYPES.map(t => t.label)).toEqual([
      'N/A', 'Fixed SDG', 'Hinged SDG', 'Vertical Sliding SDG',
      'Horizontal Sliding SDG', 'Plantation Shutters', 'Shutter Boxes',
      'Panelling', 'Security Grills',
    ])
    expect(SDG_ACTIONS.map(a => a.label)).toEqual([
      'Leave in Situ', 'Remove and Re-fit', 'Remove and Dispose',
      'Customer to Remove',
    ])
  })

  it('every type sets exactly the variables Integrate’s dictionary says', () => {
    const flagsFor = type => {
      const v = sdgVariables({ existingSurroundTypeId: type })
      return Object.entries(v).filter(([k, on]) => on && k.startsWith('has_'))
        .map(([k]) => k).sort()
    }
    expect(flagsFor(0)).toEqual([])
    expect(flagsFor(1)).toEqual(['has_fixed_secondary_glazing', 'has_sdg_or_panel', 'has_secondary_glazing'])
    expect(flagsFor(2)).toEqual(['has_hinged_secondary_glazing', 'has_sdg_or_panel', 'has_secondary_glazing'])
    expect(flagsFor(3)).toEqual(['has_sdg_or_panel', 'has_secondary_glazing', 'has_vertical_sliding_secondary_glazing'])
    expect(flagsFor(4)).toEqual(['has_horizontal_sliding_secondary_glazing', 'has_sdg_or_panel', 'has_secondary_glazing'])
    expect(flagsFor(5)).toEqual(['has_plantation_shutters', 'has_sdg_or_panel'])
    expect(flagsFor(6)).toEqual(['has_sdg_or_panel', 'has_shutter_boxes'])
    expect(flagsFor(7)).toEqual(['has_panelling', 'has_sdg_or_panel'])
    expect(flagsFor(8)).toEqual(['has_sdg_or_panel', 'has_security_grills'])
  })

  it('only actions 1 and 2 set anything', () => {
    for (const action of [0, 3]) {
      const v = sdgVariables({ existingSurroundTypeId: 1, existingSurroundActionId: action })
      expect(v.remove_and_refit_existing_sdg_or_panel, `action ${action}`).toBe(false)
      expect(v.remove_and_dispose_existing_sdg_or_panel, `action ${action}`).toBe(false)
    }
    expect(sdgVariables({ existingSurroundActionId: 1 }).remove_and_refit_existing_sdg_or_panel).toBe(true)
    expect(sdgVariables({ existingSurroundActionId: 2 }).remove_and_dispose_existing_sdg_or_panel).toBe(true)
  })

  it('every type x the two actions that fire something', () => {
    // The brief's own table. 0 means Integrate has no rule for that pair, and
    // those zeroes are the point of the test: hinged SDG and security grills
    // fire nothing at all, and nor does any "Remove and Dispose" but the
    // three SDGs.
    const EXPECTED = [
      //  type                       refit  dispose
      [1, 'Fixed SDG',                 75,   35],
      [2, 'Hinged SDG',                 0,    0],
      [3, 'Vertical Sliding SDG',      75,   35],
      [4, 'Horizontal Sliding SDG',    75,   35],
      [5, 'Plantation Shutters',       75,    0],
      [6, 'Shutter Boxes',            900,    0],
      [7, 'Panelling',                900,    0],
      [8, 'Security Grills',            0,    0],
    ]
    for (const [type, label, refit, dispose] of EXPECTED) {
      const of = action => {
        const r = run(treeWith({
          existingSurroundTypeId: type, existingSurroundActionId: action,
        }))
        const base = run(treeWith({})).install_labour.total_minutes
        return r.install_labour.total_minutes - base
      }
      expect(of(1), `${label} / Remove and Re-fit`).toBe(refit)
      expect(of(2), `${label} / Remove and Dispose`).toBe(dispose)
      // and nothing at all for the two actions with no rules
      expect(of(0), `${label} / Leave in Situ`).toBe(0)
      expect(of(3), `${label} / Customer to Remove`).toBe(0)
    }
  })

  it('the defaults fire nothing — N/A and Leave in Situ', () => {
    const base = run(treeWith({})).install_labour.total_minutes
    expect(run(treeWith({ existingSurroundTypeId: 0, existingSurroundActionId: 0 }))
      .install_labour.total_minutes).toBe(base)
  })
})

// ── The LQ fixtures ─────────────────────────────────────────────────────────

describe('Step BN — the LQ fixtures carry the facts’ own surround', () => {
  const paintOf = tree => (tree.children ?? [])
    .find(c => c.part_type === 'paintAndIronmongeryPart')?.values ?? {}

  const ticksOf = tree => {
    const v = paintOf(tree)
    return SURROUND_TICKS.filter(t => surroundTick(v, t.key)).map(t => t.label)
  }

  it('each LQ item has the surround Integrate shows for it', () => {
    // docs/integrate-live-quotes.txt, per item, as the brief tabulates it.
    expect(ticksOf(BENCHMARK_LQ1.tree)).toEqual(['Architrave', 'Window board'])
    expect(ticksOf(BENCHMARK_LQ4.tree)).toEqual(['Architrave', 'Window board'])
    expect(ticksOf(BENCHMARK_LQ2.tree)).toEqual(['Architrave', 'Linings', 'Window board'])
    expect(ticksOf(BENCHMARK_LQ7.tree)).toEqual(['Architrave', 'Linings', 'Window board'])
    // LQ3 has no surround at all — autoCalcSurroundComponents 0
    expect(ticksOf(BENCHMARK_LQ3.tree)).toEqual([])
    // and the rest are architrave only, which is also the default, so they
    // are left saying nothing and read as the default
    for (const [label, bm] of [['LQ5', BENCHMARK_LQ5], ['LQ6', BENCHMARK_LQ6],
      ['LQ8', BENCHMARK_LQ8], ['LQ9', BENCHMARK_LQ9]]) {
      expect(ticksOf(bm.tree), label).toEqual(['Architrave'])
    }
  })

  it('LQ5 is plantation shutters, remove and re-fit', () => {
    // L34265 item 3: type 5, action 1, so "Remove and Refit Shutters" 75
    // fires. L32520 item 9 is type 5 with action 0 and fires nothing, which
    // is why the action has to be stored and not inferred from the type.
    const v = paintOf(BENCHMARK_LQ5.tree)
    expect(v.existingSurroundTypeId).toBe(5)
    expect(v.existingSurroundActionId).toBe(1)
    const flags = sdgVariables(v)
    expect(flags.has_plantation_shutters).toBe(true)
    expect(flags.remove_and_refit_existing_sdg_or_panel).toBe(true)
    expect(flags.has_secondary_glazing).toBe(false)
  })

  it('no other LQ has an existing SDG', () => {
    for (const [label, bm] of [['LQ1', BENCHMARK_LQ1], ['LQ2', BENCHMARK_LQ2],
      ['LQ3', BENCHMARK_LQ3], ['LQ4', BENCHMARK_LQ4], ['LQ6', BENCHMARK_LQ6],
      ['LQ7', BENCHMARK_LQ7], ['LQ8', BENCHMARK_LQ8], ['LQ9', BENCHMARK_LQ9]]) {
      expect(sdgVariables(paintOf(bm.tree)).has_sdg_or_panel, label).toBe(false)
    }
  })
})
