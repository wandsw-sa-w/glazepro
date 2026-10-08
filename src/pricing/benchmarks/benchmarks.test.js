/**
 * benchmarks.test.js — Step S pricing benchmark tests.
 *
 * Runs the pricing engine against all three fixture trees and compares
 * cost and price totals to the Integrate targets.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { runPricingOnTree, shapedGlassCutAreaM2 } from '../pricingEngine.js'
import { computeDerived } from '../../drawingBoard/computeDerived.js'
import { computeVariables } from '../computeVariables.js'
import { BENCHMARK_L34046, BENCHMARK_A, BENCHMARK_A35, BENCHMARK_A40, BENCHMARK_A50, BENCHMARK_A35_H1700, BENCHMARK_B, BENCHMARK_B_UNCORRECTED, BENCHMARK_C, BENCHMARK_D } from './index.js'
import { resolveIronmongeryLines } from '../loadPricingContext.js'
// The LIVE price-file snapshot (reviewer-checked, 8 Oct 2026) — the honest
// benchmarks and the real-tree case price from this, never from the
// hand-typed pf30Rules.js (whose rules are all is_active: false).
import SNAPSHOT from './pf30-snapshot.json'
// The ONLY source of cost/price targets: figures read from Integrate.
// Never edited to match GlazePro output — a failing test that tells the
// truth is the right outcome when GlazePro disagrees with Integrate.
import INTEGRATE from './integrate-targets.json'

// ── Minimal price-file variables (PF30 scalars) ────────────────────────────
// Sash profile rebate/tolerance (14 / 2) — the measured sash-weight model
// needs them for the glass cut, like the glass price does
const SASH_PV = { defaultDoubleGlazingRebateWidthForSash: 14, defaultDoubleGlazingTolerance: 2 }

const PF_VARIABLES = {
  accoya_cubic_meter: 4.65,
  decoration_labour_hourly: 42.50,
  douglas_fir_cubic_meter: 2.05,
  idigbo_cubic_meter: 3.50,
  installation_labour_hourly: 40.21,
  meranti_cubic_meter: 3.54,
  oak_cubic_meter: 7.00,
  softwood_cubic_meter: 1.25,
  special_glass: 'GL100045',
  utile: 'utile',
  utile_cubic_meter: 3.54,
  workshop_hourly_additional: 24.66,
}

// These tests verify the fixture module can be imported and the engine
// can run against each tree without errors. Exact cost/price matching
// is expected to fail until S2-S4 are implemented — the tests are
// structured to show the gap for each benchmark.

describe('Benchmark fixtures load and engine runs without errors', () => {
  it('L34046 fixture tree is valid', () => {
    const { tree } = BENCHMARK_L34046
    expect(tree).toBeTruthy()
    expect(tree.part_type).toBe('drawingItemPart')
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived, PF_VARIABLES)
    expect(vars).toBeTruthy()
    expect(vars.is_complete_new).toBe(true)
  })

  it('Benchmark A fixture tree is valid', () => {
    const { tree } = BENCHMARK_A
    expect(tree).toBeTruthy()
    expect(tree.part_type).toBe('drawingItemPart')
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived, PF_VARIABLES)
    expect(vars).toBeTruthy()
    expect(vars.is_sash_replacement).toBe(true)
    expect(vars.is_complete_new).toBe(false)
    expect(vars.frame_to_be_replaced).toBe(false)
  })

  it('Benchmark B fixture tree is valid', () => {
    const { tree } = BENCHMARK_B
    expect(tree).toBeTruthy()
    expect(tree.part_type).toBe('drawingItemPart')
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived, PF_VARIABLES)
    expect(vars).toBeTruthy()
    expect(vars.needs_draughtsealing).toBe(true)
    expect(vars.is_complete_new).toBe(false)
    expect(vars.nj_involved).toBe(false)
  })

  it('engine runs on each fixture without throwing', () => {
    // Empty rules — just verifying the engine doesn't throw
    for (const benchmark of [BENCHMARK_L34046, BENCHMARK_A, BENCHMARK_B]) {
      const results = runPricingOnTree(benchmark.tree, [], PF_VARIABLES, { profileValues: benchmark.profileValues })
      expect(results.error).toBeUndefined()
    }
  })
})

describe('Benchmark B — DSO variables are correct', () => {
  it('frame_area = 1.32 m2 for the DSO SqM Rate rule', () => {
    const { tree } = BENCHMARK_B
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived, PF_VARIABLES)
    // frame_area is the outer frame area: 1100 * 1200 / 1e6 = 1.32
    expect(vars.frame_area).toBeCloseTo(1.32, 2)
  })

  it('sliding_sash_qty=2, fixed_sliding_sash_qty=0 for DSO Extra Profits', () => {
    const { tree } = BENCHMARK_B
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived, PF_VARIABLES)
    expect(vars.sliding_sash_qty).toBe(2)
    expect(vars.fixed_sliding_sash_qty).toBe(0)
  })

  it('frame_to_be_replaced=false, needs_draughtsealing=true', () => {
    const { tree } = BENCHMARK_B
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived, PF_VARIABLES)
    expect(vars.frame_to_be_replaced).toBe(false)
    expect(vars.needs_draughtsealing).toBe(true)
    expect(vars.nj_involved).toBe(false)
  })
})

describe('Step V — glass sightline from the drawn sash sizes, cut rule unchanged', () => {
  // Cut size = sightline + 2 × (rebate 14 − tolerance 2) per axis;
  // rounded_area = max(round(area, 2), 0.30) — unchanged.
  const PROBE = [{
    id: 'probe', rule_family: 'price', level: 'item', is_active: true,
    group_name: 'glass_done', loop_target: 'glass_unit',
    name: 'probe_rounded_area', condition: 'true',
    quantity: 'rounded_area', value: '1', markup: 1, sort_order: 1,
  }]
  const PV = { defaultDoubleGlazingRebateWidthForSash: 14, defaultDoubleGlazingTolerance: 2 }

  function roundedAreas(tree) {
    const res = runPricingOnTree(tree, PROBE, PF_VARIABLES, { profileValues: PV })
    return res.price.lines.filter(l => l.fires && !l.error).map(l => l.quantity)
  }

  it('L34046: every unit prices at 0.75 m² — Integrate’s Square Glass Cost qty (stage-4)', () => {
    // sash 1075, stile 50.75 → sightline 973.5 × 726.5; cut 997.5 × 750.5
    // → 0.75 (the SAME under the alternative 1255 × 1775 frame reading)
    expect(roundedAreas(BENCHMARK_L34046.tree)).toEqual([0.75, 0.75])
  })

  it('Benchmark A: every unit prices at 0.65 m² — Integrate’s qty', () => {
    // sash 900, stile 49 (Integrate drawing label, step-w brief)
    // → sightline 802 × 761.5; cut 826 × 785.5 → 0.65 — same as with the
    // old 50.75 stile, as the brief requires
    expect(roundedAreas(BENCHMARK_A.tree)).toEqual([0.65, 0.65])
  })
})

describe('Step Y — frame metre width/height round HALF UP to 2 dp, decimal-safe', () => {
  // Inferred from one benchmark (step-y brief §2): Integrate's Box Frame
  // Staff Bead 19.88 = 6.06 × 3.28 needs 1245 → 1.25 and 1779 → 1.78.
  // 1.245 is not representable in binary floating point — the rounding is
  // done from the mm integer, so it must still come out 1.25.
  const PROBE = [{
    id: 'probe_wh', rule_family: 'price', level: 'item', is_active: true,
    group_name: 'probe', loop_target: 'frame', name: 'probe_width_height',
    condition: 'true', quantity: '(width + height) * 2', value: '1', markup: 1, sort_order: 1,
  }]

  it('L34046 frame (1245 × 1779) gives (1.25 + 1.78) × 2 = 6.06', () => {
    const res = runPricingOnTree(BENCHMARK_L34046.tree, PROBE, PF_VARIABLES,
      { profileValues: SASH_PV })
    const line = res.price.lines.find(l => l.name === 'probe_width_height' && l.fires)
    // The VARIABLES are exactly 1.25 / 1.78; the probe's addition itself
    // reintroduces float dust, so compare to 10 dp rather than identity
    expect(line.quantity).toBeCloseTo(6.06, 10)
  })
})

describe('Step V — fixture sash sizes equal Integrate’s drawn labels', () => {
  // Evidence table in docs/step-v-geometry-brief.md (read from Integrate's
  // drawing board, 7 Oct 2026)
  it('Benchmark B: 1120 × 1181 → sash 950, top 516.5, bottom 555.5', () => {
    const d = computeDerived(BENCHMARK_B.tree)
    const pair = BENCHMARK_B.tree.children.find(c => c.part_type === 'assemblyFramePart')
      .children.find(c => c.part_type === 'sashPairPart')
    expect(d[pair.key].sashWidth).toBe(950)
    expect(d[pair.key].topSashHeight).toBe(516.5)
    expect(d[pair.key].bottomSashHeight).toBe(555.5)
  })

  it('Benchmark A: 1070 × 1849 → sash 900, top 850.5, bottom 889.5', () => {
    const d = computeDerived(BENCHMARK_A.tree)
    const pair = BENCHMARK_A.tree.children.find(c => c.part_type === 'assemblyFramePart')
      .children.find(c => c.part_type === 'sashPairPart')
    expect(d[pair.key].sashWidth).toBe(900)
    expect(d[pair.key].topSashHeight).toBe(850.5)
    expect(d[pair.key].bottomSashHeight).toBe(889.5)
  })
})

describe('Steps AA/AB — thickness variants draw Integrate’s sash heights', () => {
  // docs/integrate-benchmarks-thickness.txt: 35/40 → top 850.5, bottom
  // 890.5; 50 → top 850.5, bottom 888.5; 35 mm set back to 1700 → 850/890.
  // Step AB: with Integrate's STORED bottom rail (89 at 35/40, 87 at 50 —
  // (rail + whole-mm allowance) held at 95) a plain half_half split draws
  // these heights exactly; the Step AA set_top workaround is gone.
  const CASES = [
    [BENCHMARK_A35, 35, 1701, 850.5, 890.5],
    [BENCHMARK_A40, 40, 1701, 850.5, 890.5],
    [BENCHMARK_A50, 50, 1699, 850.5, 888.5],
    [BENCHMARK_A35_H1700, 35, 1700, 850, 890],
  ]
  for (const [bm, t, H, top, bottom] of CASES) {
    it(`${t} mm (int ${H}): top ${top} / bottom ${bottom}`, () => {
      const d = computeDerived(bm.tree)
      const pair = bm.tree.children.find(c => c.part_type === 'assemblyFramePart')
        .children.find(c => c.part_type === 'sashPairPart')
      expect(pair.values.sashThickness).toBe(t)
      expect(d[pair.key].sashWidth).toBe(900)
      expect(d[pair.key].topSashHeight).toBe(top)
      expect(d[pair.key].bottomSashHeight).toBe(bottom)
    })
  }
})

describe('Step AC — fixtures C and D drawn sizes vs Integrate', () => {
  // Facts: docs/integrate-benchmarks-arched-doublebox.txt.
  it('C: sash width 824, top sash 525.5, bottom 564.5 (glass 436.5)', () => {
    const d = computeDerived(BENCHMARK_C.tree)
    const pair = BENCHMARK_C.tree.children.find(c => c.part_type === 'assemblyFramePart')
      .children.find(c => c.part_type === 'sashPairPart')
    expect(d[pair.key].sashWidth).toBe(824)
    expect(d[pair.key].topSashHeight).toBe(525.5)
    expect(d[pair.key].bottomSashHeight).toBe(564.5)   // bottom glass 564.5 − 88 − 40 = 436.5
  })

  // Integrate's top-sash glass SHOULDER is 336.5 (glass 436.5 minus the
  // 100 arch rise). GlazePro's geometry has no shoulder: topGlassHeight is
  // the full 436.5 and the arch (stored on the FRAME) never reaches the
  // sash or glass. No assertion possible — reported in step-ac-findings.

  it('D: top sash 575.5 (glass 486.5) — heights match Integrate', () => {
    const d = computeDerived(BENCHMARK_D.tree)
    const frame = BENCHMARK_D.tree.children.find(c => c.part_type === 'assemblyFramePart')
    const pairs = frame.children.filter(c => c.part_type === 'sashPairPart')
    expect(pairs).toHaveLength(2)
    expect(d[pairs[0].key].topSashHeight).toBe(575.5)  // glass 575.5 − 49 − 40 = 486.5
  })

  it('D: each pair draws 738 wide, as Integrate (TRUTHFUL FAILURE)', () => {
    // GlazePro's derived geometry has no per-pair openings: the single
    // sashPairPart geometry spans the whole interior (1630 − 5 = 1625) and
    // the second pair has no derived geometry at all. Integrate draws each
    // pair 738 wide (opening 743 − 5, mullion 144 between openings). This
    // test states Integrate's fact and fails until per-pair geometry
    // exists (step-ac brief: report and stop — the reviewer decides).
    const d = computeDerived(BENCHMARK_D.tree)
    const frame = BENCHMARK_D.tree.children.find(c => c.part_type === 'assemblyFramePart')
    const pairs = frame.children.filter(c => c.part_type === 'sashPairPart')
    for (const p of pairs) expect(d[p.key]?.sashWidth).toBe(738)
  })
})

describe('Step AD — shaped glass cut area (exact shape, not the rectangle)', () => {
  // Reviewer's arithmetic (step-ad brief §2) for C's arched top unit:
  // sightline chord 726, glass height 436.5, rise 100, cover 12 →
  // R 720.845, W 750, rectangle 0.2665 + segment 0.0533 = 0.3199 m² →
  // rounded 0.32 (Integrate), energy qty 0.32 × 20 = 6.40 (Integrate).
  it('C top unit area rounds to Integrate’s 0.32 m²', () => {
    const a = shapedGlassCutAreaM2(726, 436.5, 100, 12)
    expect(a).toBeCloseTo(0.3199, 3)
    expect(Math.round(a * 100) / 100).toBe(0.32)
  })

  it('degenerate shapes return null (no silent rectangle)', () => {
    expect(shapedGlassCutAreaM2(726, 436.5, 0, 12)).toBeNull()    // no rise
    expect(shapedGlassCutAreaM2(0, 436.5, 100, 12)).toBeNull()    // no chord
    expect(shapedGlassCutAreaM2(726, 90, 100, 12)).toBeNull()     // rise taller than glass
  })
})

describe('Benchmark A — sash replacement variables are correct', () => {
  it('to_be_replaced=true for sashes, frame_to_be_replaced=false', () => {
    const { tree } = BENCHMARK_A
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived, PF_VARIABLES)
    expect(vars.is_sash_replacement).toBe(true)
    expect(vars.frame_to_be_replaced).toBe(false)
    expect(vars.nj_involved).toBe(true)
    expect(vars.new_sliding_sash_qty).toBe(2)
  })
})

describe('S4 — sash material rule correction', () => {
  // Fixture rules simulating the three sash material lines.
  // UNCORRECTED: no to_be_replaced condition (Integrate's original)
  // CORRECTED: with to_be_replaced condition (GlazePro's fix)

  const UNCORRECTED_RULES = [
    {
      id: 'lam_bottom', rule_family: 'price', level: 'item', is_active: true,
      group_name: 'manufacture_materials', loop_target: 'sliding_sash',
      name: 'Laminated Softwood (bottom)',
      condition: 'is_solid_redwood_sash and is_bottom_sash',
      quantity: '((gross_sash_height_in_mm + (gross_sash_width_in_mm * 1.5)) / 1000) * 1.05',
      value: '4.95', markup: 2, sort_order: 10,
    },
    {
      id: 'lam_top', rule_family: 'price', level: 'item', is_active: true,
      group_name: 'manufacture_materials', loop_target: 'sliding_sash',
      name: 'Laminated Softwood (top)',
      condition: 'is_solid_redwood_sash and is_top_sash',
      quantity: '((gross_sash_height_in_mm + (gross_sash_width_in_mm * 1)) / 1000) * 1.05',
      value: '4.95', markup: 2, sort_order: 15,
    },
    {
      id: 'glaze_bead', rule_family: 'price', level: 'item', is_active: true,
      group_name: 'manufacture_materials', loop_target: 'sliding_sash',
      name: 'Glazing Bead for Sashes',
      condition: 'not is_square_top_with_arched_sightline and not is_curved_head_sash',
      quantity: '((sash_sightline_width_in_mm + sash_sightline_height_in_mm) / 1000) * 2',
      value: '1.39', markup: 2, sort_order: 310,
    },
  ]

  const CORRECTED_RULES = UNCORRECTED_RULES.map(r => ({
    ...r,
    condition: r.condition + ' and to_be_replaced',
  }))

  it('uncorrected rules fire on DSO (Benchmark B) — all three produce cost > 0', () => {
    const { tree } = BENCHMARK_B_UNCORRECTED
    const results = runPricingOnTree(tree, UNCORRECTED_RULES, PF_VARIABLES, { profileValues: SASH_PV })
    const firedLines = results.price.lines.filter(l => l.fires && !l.error)
    // All three rules should fire on both sashes (but lam_bottom only fires
    // for bottomSashPart and lam_top only for topSashPart; glaze_bead fires
    // for both). So: lam_bottom x1, lam_top x1, glaze_bead x2 = 4 fired lines.
    expect(firedLines.length).toBe(4)
    expect(results.price.total_cost).toBeGreaterThan(0)
  })

  it('corrected rules do NOT fire on DSO (Benchmark B) — cost = 0', () => {
    const { tree } = BENCHMARK_B
    const results = runPricingOnTree(tree, CORRECTED_RULES, PF_VARIABLES, { profileValues: SASH_PV })
    const firedLines = results.price.lines.filter(l => l.fires && !l.error)
    // to_be_replaced=false on DSO sashes, so none of the corrected rules fire
    expect(firedLines.length).toBe(0)
    expect(results.price.total_cost).toBe(0)
  })

  it('corrected rules still fire on sash replacement (Benchmark A) — unchanged', () => {
    const { tree } = BENCHMARK_A
    const resultsUncorrected = runPricingOnTree(tree, UNCORRECTED_RULES, PF_VARIABLES, { profileValues: SASH_PV })
    const resultsCorrected   = runPricingOnTree(tree, CORRECTED_RULES, PF_VARIABLES, { profileValues: SASH_PV })

    // Both sashes have toBeReplaced=true, so corrected rules fire identically
    const firedUncorrected = resultsUncorrected.price.lines.filter(l => l.fires && !l.error).length
    const firedCorrected   = resultsCorrected.price.lines.filter(l => l.fires && !l.error).length
    expect(firedCorrected).toBe(firedUncorrected)
    expect(resultsCorrected.price.total_cost).toBeCloseTo(resultsUncorrected.price.total_cost, 2)
  })

  it('corrected rules still fire on complete new (L34046) — unchanged', () => {
    const { tree } = BENCHMARK_L34046
    const resultsUncorrected = runPricingOnTree(tree, UNCORRECTED_RULES, PF_VARIABLES, { profileValues: SASH_PV })
    const resultsCorrected   = runPricingOnTree(tree, CORRECTED_RULES, PF_VARIABLES, { profileValues: SASH_PV })

    const firedUncorrected = resultsUncorrected.price.lines.filter(l => l.fires && !l.error).length
    const firedCorrected   = resultsCorrected.price.lines.filter(l => l.fires && !l.error).length
    expect(firedCorrected).toBe(firedUncorrected)
    expect(resultsCorrected.price.total_cost).toBeCloseTo(resultsUncorrected.price.total_cost, 2)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Glass rounded_area — correct formula per integrate-variable-dictionary.txt:
//   actual_area = round(raw, 2dp)
//   rounded_area = max(actual_area, 0.30)   (no 0.05 step rounding)
// ══════════════════════════════════════════════════════════════════════════════

describe('Glass rounded_area formula', () => {
  // Helper: build a minimal tree with a glass part whose dimensions yield a
  // known raw area (width_mm * height_mm / 1e6).  We set frame.width and
  // stileWidth so that glassWidth = frame.width - 2*stileWidth = width_mm,
  // and frame.height, topRail, bottomRail, midrail so that
  // glassHeight = (frame.height - topRail - botRail - midrail) / 2 = height_mm.
  //
  // A dummy price rule with quantity="rounded_area" captures the value.
  function makeGlassTree(widthMm, heightMm) {
    // Solve backwards from engine formulas:
    //   glassWidth = frame.width - 2 * stileWidth   =>  frame.width = widthMm + 2*50
    //   glassHeight = (frame.height - 49 - 88 - 40) / 2 = heightMm
    //                 frame.height = heightMm * 2 + 49 + 88 + 40
    const frameW = widthMm + 100   // stileWidth = 50
    const frameH = heightMm * 2 + 49 + 88 + 40
    return {
      key: 'item', part_type: 'drawingItemPart',
      values: { typeOfWork: 'complete_new' },
      children: [{
        key: 'f', part_type: 'assemblyFramePart',
        values: { width: frameW, height: frameH },
        children: [{
          key: 'pair', part_type: 'sashPairPart',
          values: { sashThickness: 45, midrailHeight: 40 },
          children: [{
            key: 'top', part_type: 'topSashPart',
            values: { topHeight: 49, leftWidth: 50, rightWidth: 50 },
            children: [{
              key: 'g', part_type: 'glassPart',
              values: {
                glazingId: 'double_glazed',
                internalGlassPartNo: 'GL100010',
                externalGlassPartNo: 'GL100080',
                spacerHeight: 16,
              },
              children: [],
            }],
          }, {
            key: 'bot', part_type: 'bottomSashPart',
            values: { bottomHeight: 88, leftWidth: 50, rightWidth: 50 },
            children: [],
          }],
        }],
      }],
    }
  }

  // A price rule that captures rounded_area as its quantity.
  const PROBE_RULE = [{
    id: 'probe', rule_family: 'price', level: 'item', is_active: true,
    group_name: 'glass_done', loop_target: 'glass_unit',
    name: 'probe_rounded_area',
    condition: 'true', quantity: 'rounded_area', value: '1', markup: 1,
    sort_order: 1,
  }]

  const GLASS_CAT = {
    GL100010: { cost_per_m2: 32.00, thickness_mm: 4 },
    GL100080: { cost_per_m2: 25.50, thickness_mm: 4 },
  }

  function getRoundedArea(widthMm, heightMm) {
    const tree = makeGlassTree(widthMm, heightMm)
    const res = runPricingOnTree(tree, PROBE_RULE, PF_VARIABLES, {
      glassCatalogue: GLASS_CAT,
      profileValues: { defaultDoubleGlazingRebateWidthForSash: 14, defaultDoubleGlazingTolerance: 2 },
    })
    const fired = res.price.lines.find(l => l.name === 'probe_rounded_area' && l.fires)
    return fired?.quantity ?? null
  }

  // Glass cut size: actual dimensions = sightline + 2*cover per axis.
  // Default cover = rebateWidth(14) - tolerance(2) = 12 mm per edge = +24 mm per axis.

  it('small glass area still gets 0.30 minimum', () => {
    // Sightline 440 x 500, cut size = 464 x 524 = 0.243136 m2 -> min 0.30
    expect(getRoundedArea(440, 500)).toBe(0.30)
  })

  it('cut size area rounds to 2dp (case 1: sightline 705x1000)', () => {
    // Sightline 705 x 1000, cut size = 729 x 1024 = 746496 / 1e6 = 0.746496 -> round 2dp = 0.75
    expect(getRoundedArea(705, 1000)).toBe(0.75)
  })

  it('cut size area rounds to 2dp (case 2: sightline 646x1000)', () => {
    // Sightline 646 x 1000, cut size = 670 x 1024 = 686080 / 1e6 = 0.68608 -> round 2dp = 0.69
    expect(getRoundedArea(646, 1000)).toBe(0.69)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Item 1 — Honest tests: run each benchmark from the LIVE SNAPSHOT
// (pf30-snapshot.json, taken 8 Oct 2026, reviewer-checked: 264 rules of which
// 263 active — the inactive one is "Additional for Cruciform") with its REAL
// is_active flags, no testMode, exactly like the live site. The hand-typed
// pf30Rules.js is NOT a benchmark: all 266 of its rules carry
// is_active: false, so running it in testMode fires rules the live file
// disables (that was the whole "Additional for Cruciform" +1 h finding).
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Price a benchmark from the snapshot ALONE: rules (real is_active flags),
 * pf variables, glass catalogue, allocation rules, part costs, ironmongery
 * rules + catalogue and profile values all come from the snapshot.
 * Ironmongery lines resolve through the shared resolveIronmongeryLines:
 * tree-saved lines win, defaults apply when the tree has none (L34046).
 */
function runFromSnapshot(tree) {
  const ironmongeryLines = resolveIronmongeryLines(tree, SNAPSHOT, SNAPSHOT.profileValues)
  return runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
    glassCatalogue:       SNAPSHOT.glassCatalogue,
    partAllocationRules:  SNAPSHOT.partAllocationRules,
    partCostMap:          SNAPSHOT.partCostMap,
    ironmongeryLines,
    ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
    profileValues:        SNAPSHOT.profileValues,
  })
}

/**
 * Helper: sum cost/price by group from engine results.
 */
function groupTotals(results) {
  const groups = {}
  for (const line of results.price.lines) {
    if (!line.fires || line.error) continue
    const g = line.group_name ?? '(ungrouped)'
    if (!groups[g]) groups[g] = { cost: 0, price: 0 }
    groups[g].cost  += line.line_cost
    groups[g].price += line.line_total
  }
  // Round totals to avoid float accumulation noise
  for (const g of Object.values(groups)) {
    g.cost  = Math.round(g.cost  * 100) / 100
    g.price = Math.round(g.price * 100) / 100
  }
  return groups
}

/**
 * Helper: assert results against an integrate-targets.json entry
 * ({ total_cost, total_price, groups: { name: { cost, price } } }).
 */
function expectMatchesIntegrate(results, target) {
  expect(results.price.total_cost).toBeCloseTo(target.total_cost, 2)
  expect(results.price.total).toBeCloseTo(target.total_price, 2)
  const groups = groupTotals(results)
  for (const [group, t] of Object.entries(target.groups ?? {})) {
    expect(groups[group]?.cost  ?? 0, `${group} cost`).toBeCloseTo(t.cost,  1)
    expect(groups[group]?.price ?? 0, `${group} price`).toBeCloseTo(t.price, 1)
  }
}

describe('Honest benchmarks — live snapshot, real is_active flags', () => {
  it('snapshot holds everything loadPricingContext returns plus profile values', () => {
    for (const key of ['rules', 'pfVariables', 'glassCatalogue', 'partAllocationRules',
                       'partCostMap', 'ironmongeryRules', 'ironmongeryCatalogue', 'profileValues']) {
      expect(SNAPSHOT[key], `snapshot.${key}`).toBeDefined()
    }
  })

  it('L34046 matches the Integrate targets', () => {
    expectMatchesIntegrate(runFromSnapshot(BENCHMARK_L34046.tree), INTEGRATE.L34046)
  })

  it('Benchmark A matches the Integrate targets', () => {
    expectMatchesIntegrate(runFromSnapshot(BENCHMARK_A.tree), INTEGRATE.benchmarkA)
  })

  it('Benchmark B matches the Integrate targets (corrected)', () => {
    expectMatchesIntegrate(runFromSnapshot(BENCHMARK_B.tree), INTEGRATE.benchmarkB_corrected)
  })

  // Thickness variants (Steps AA/AB). After Step AB (whole-mm chamfer
  // allowance; fixtures carry Integrate's stored bottom rail), A35, A40
  // and A35/h1700 are expected exact. A50 remains a truthful failure:
  // the top Lead Weight misses by ~28p cost / 42p price because the
  // weight model gives 17.61 kg → 17.6 where Integrate shows 17.5
  // (docs/step-ab-findings.md). Report, don't tune — the reviewer decides.
  it('Benchmark A35 matches the Integrate targets', () => {
    expectMatchesIntegrate(runFromSnapshot(BENCHMARK_A35.tree), INTEGRATE.benchmarkA35)
  })

  it('Benchmark A40 matches the Integrate targets', () => {
    expectMatchesIntegrate(runFromSnapshot(BENCHMARK_A40.tree), INTEGRATE.benchmarkA40)
  })

  it('Benchmark A50 matches the Integrate targets', () => {
    expectMatchesIntegrate(runFromSnapshot(BENCHMARK_A50.tree), INTEGRATE.benchmarkA50)
  })

  it('Benchmark A35/h1700 matches the Integrate targets', () => {
    expectMatchesIntegrate(runFromSnapshot(BENCHMARK_A35_H1700.tree), INTEGRATE.benchmarkA35_h1700)
  })

  // Step AC: C and D are TRUTHFUL FAILURES by design — a gap report, not
  // a regression. docs/step-ac-findings.md reconciles every penny:
  //  - C (−316.77/−633.49): the board stores the arch on the FRAME, so
  //    is_sash_arched never fires (12.84 h manufacture time missing), the
  //    arched unit prices as square glass, and the bead/bar lines
  //    Integrate suppresses on an arched sash still fire (+1p float
  //    rounding on 0.35 × 58.5 = 20.475).
  //  - D (+165.45/+300.22): no per-pair openings — both pairs price 1625
  //    wide where Integrate draws 738 each (glass, energy, steel,
  //    laminated, bead all off the same way); labour 15 h vs 16 h.
  // Report and stop, per the step-ac brief; the reviewer decides.
  it('Benchmark C (arched) matches the Integrate targets', () => {
    expectMatchesIntegrate(runFromSnapshot(BENCHMARK_C.tree), INTEGRATE.benchmarkC_arched)
  })

  it('Benchmark D (double box) matches the Integrate targets', () => {
    expectMatchesIntegrate(runFromSnapshot(BENCHMARK_D.tree), INTEGRATE.benchmarkD_doublebox)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Fourth case — the REAL saved tree (L507712 drawing 1, captured from the live
// drawing board). No Integrate total exists for it; instead we assert that the
// engine, fed the real vocabulary, fires the rules the live site missed and
// produces no warnings.
// ══════════════════════════════════════════════════════════════════════════════

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('Real tree — L507712 drawing 1 prices with real vocabulary', () => {
  const RAW_REAL_TREE = JSON.parse(readFileSync(
    resolve(__dirname, 'real-trees', 'L507712-drawing1.raw.json'), 'utf8'))

  // The capture predates sql/step-u1-glass-part-codes.sql, so its glass
  // references are still NAMES. Apply the same name → part-code conversion
  // that step-u1 performs, using the catalogue identities from
  // sql/step-g1-parts-catalogue.sql (GL100010 / GL100080).
  const GLASS_NAME_TO_CODE = {
    '4mm Clear Pilkington K Toughened': 'GL100010',
    '4mm Clear Toughened':              'GL100080',
  }
  function convertGlassNames(node) {
    const copy = { ...node, values: { ...(node.values ?? {}) } }
    if (copy.part_type === 'glassPart') {
      for (const k of ['internalGlassPartNo', 'externalGlassPartNo', 'singleGlassPartNo']) {
        const v = copy.values[k]
        if (v != null && GLASS_NAME_TO_CODE[v]) copy.values[k] = GLASS_NAME_TO_CODE[v]
      }
    }
    copy.children = (node.children ?? []).map(convertGlassNames)
    return copy
  }
  const REAL_TREE = convertGlassNames(RAW_REAL_TREE)

  // Glass costs/thicknesses from the step-g1 import SQL (repo facts, not
  // tuned): GL100010 £32/m² 4mm, GL100080 £25.50/m² 4mm.
  const REAL_GLASS_CAT = {
    GL100010: { cost_per_m2: 32.0,  thickness_mm: 4 },
    GL100080: { cost_per_m2: 25.5, thickness_mm: 4 },
  }

  // Priced from the live snapshot like the honest benchmarks (real
  // is_active flags, snapshot catalogues and profile values)
  const results = runFromSnapshot(REAL_TREE)

  function firedLines(name) {
    return results.price.lines.filter(l => l.name === name && l.fires && !l.error)
  }

  it('prices two Square Glass Cost lines', () => {
    expect(firedLines('Square Glass Cost')).toHaveLength(2)
  })

  it('prices two All Glass Energy Surcharge lines', () => {
    expect(firedLines('All Glass Energy Surcharge')).toHaveLength(2)
  })

  it('prices Laminated Softwood for Sashes, top and bottom', () => {
    expect(firedLines('Laminated Softwood for Sashes (Top)')).toHaveLength(1)
    expect(firedLines('Laminated Softwood for Sashes (Bottom)')).toHaveLength(1)
  })

  it('prices Softwood Box Frame Linings, Softwood Pulley Stiles and Head, Box Frame Utile Cill', () => {
    expect(firedLines('Softwood Box Frame Linings').length).toBeGreaterThanOrEqual(1)
    expect(firedLines('Softwood Pulley Stiles and Head').length).toBeGreaterThanOrEqual(1)
    expect(firedLines('Box Frame Utile Cill').length).toBeGreaterThanOrEqual(1)
  })

  it('warns, by name, about the one line with no resolvable finish — and nothing else', () => {
    // Step Z: this real drawing stores NO item ironmongery finish, and the
    // live profile has no default, so the default claw-fastener line cannot
    // resolve a finish. Before Step Z it silently priced Polished Brass
    // (the reviewer's live finding — £26.25 where Integrate had £36.75 ABs);
    // now it is a visible warning and the line is not priced.
    expect(results.warnings).toEqual([
      'Ironmongery line has no finish: z-claw_fastener_kit_wpulleys — set the item’s Ironmongery Finish (or a finish on the line); the line is NOT priced'
        .replace('’', "'"),
    ])
  })

  it('fixed-finish defaults (trickle vent, Wht) still price with no item finish', () => {
    const trickle = results.price.lines.find(l => l.alloc_iron_part_code === 'RHZ665' && l.fires)
    expect(trickle).toBeTruthy()
    expect(trickle.line_cost).toBeCloseTo(3.15, 2)
  })

  it('never emits a £0 line for the unresolvable-finish product', () => {
    const clawLines = results.price.lines.filter(l => l.alloc_iron_short_name === 'z-claw_fastener_kit_wpulleys')
    expect(clawLines).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Step Z — ironmongery lines follow the item's ironmongery finish
// ══════════════════════════════════════════════════════════════════════════════

describe('Step Z — empty line finish follows the item finish', () => {
  // A minimal L34046-shaped tree with ONE tree-saved line whose finish is
  // empty ("Item finish" on the board)
  function treeWithItemFinish(itemFinish) {
    const tree = JSON.parse(JSON.stringify(BENCHMARK_L34046.tree))
    const paint = tree.children.find(c => c.part_type === 'paintAndIronmongeryPart')
    paint.values.ironmongeryFinish = itemFinish
    paint.values.ironmongeryLines = [
      { product_short_name: 'z-claw_fastener_kit_wpulleys', finish_code: '', qty: 1, source: 'default' },
    ]
    return tree
  }

  it('item finish ABs + empty line finish → HKKS1075AB at £36.75 (snapshot: unit cost 35.30, Ironmongery Cost rule ×1.05 → 36.75 / ×2 → 73.50)', () => {
    const results = runFromSnapshot(treeWithItemFinish('ABs'))
    const line = results.price.lines.find(l => l.alloc_iron_part_code === 'HKKS1075AB' && l.fires)
    expect(line).toBeTruthy()
    expect(line.line_cost).toBeCloseTo(36.75, 2)
    expect(line.line_total).toBeCloseTo(73.50, 2)
    expect(results.warnings).toEqual([])
  })

  it('changing the item finish re-resolves an empty-finish line (PB → ABs)', () => {
    const pb = resolveIronmongeryLines(treeWithItemFinish('PB'), SNAPSHOT, SNAPSHOT.profileValues)
    const abs = resolveIronmongeryLines(treeWithItemFinish('ABs'), SNAPSHOT, SNAPSHOT.profileValues)
    expect(pb.find(l => l.product_short_name === 'z-claw_fastener_kit_wpulleys').finish_code).toBe('PB')
    expect(abs.find(l => l.product_short_name === 'z-claw_fastener_kit_wpulleys').finish_code).toBe('ABs')
  })

  it('no item finish and no profile default → named warning, no £0 line', () => {
    const tree = treeWithItemFinish(null)
    const ironmongeryLines = resolveIronmongeryLines(tree, SNAPSHOT, {})  // no profile default
    const results = runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue:       SNAPSHOT.glassCatalogue,
      partAllocationRules:  SNAPSHOT.partAllocationRules,
      partCostMap:          SNAPSHOT.partCostMap,
      ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues:        SNAPSHOT.profileValues,
    })
    expect(results.warnings.some(w =>
      w.includes('Ironmongery line has no finish: z-claw_fastener_kit_wpulleys'))).toBe(true)
    expect(results.price.lines.filter(l => l.alloc_iron_short_name === 'z-claw_fastener_kit_wpulleys')).toHaveLength(0)
  })
})

