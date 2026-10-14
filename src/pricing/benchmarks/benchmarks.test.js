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
import { applySashesReplaced } from '../../drawingBoard/sashesReplaced.js'
import { computeDerived } from '../../drawingBoard/computeDerived.js'
import { computeVariables } from '../computeVariables.js'
import { withAv4Costs } from './frontDoorIronmongery.js'
import { withShapedGlassRate } from './liveRuleFixes.js'

/**
 * Step BE: what C’s shaped glass is dearer by, from the fixture’s own
 * declaration — the decided part plus the part waiting on sql/step-be1, so
 * this figure cannot drift away from the one the page shows.
 */
const C_SHAPED_GLASS = (BENCHMARK_C.deliberateDifference?.cost ?? 0) +
  (BENCHMARK_C.pendingDecision?.cost ?? 0)

/**
 * Step BE follow-up: sql/step-be1 is RUN LIVE, so every benchmark here is
 * priced with a shaped unit at the SQUARE rate. The captured snapshot still
 * holds Integrate’s shaped rate, and withShapedGlassRate is a no-op once it
 * is refreshed.
 */
const SNAPSHOT_LIVE = withShapedGlassRate(SNAPSHOT)

/** The same, with the AV4 costs: what the stable-door block prices from. */
const FT_SNAPSHOT_ST = withShapedGlassRate(withAv4Costs(SNAPSHOT))
import { shortDividerSpanMm, isShortDivider, frameCells, frameGridSize, frameOpenings, casementSashSize, casementSashWeightKg, casementFrameTimberVolumeDm3, casementSashTimberVolumeDm3, casementGlassSightline, frameMuntinLengthM, frameColumns, frameRows, itemFrames, CASEMENT_SASH_TYPES, FRENCH_SASH_TYPES } from '../casementGeometry.js'
import { BENCHMARK_L34046, BENCHMARK_A, BENCHMARK_A35, BENCHMARK_A40, BENCHMARK_A50, BENCHMARK_A35_H1700, BENCHMARK_B, BENCHMARK_B_UNCORRECTED, BENCHMARK_C, BENCHMARK_D, BENCHMARK_E, BENCHMARK_F, BENCHMARK_G, BENCHMARK_H, BENCHMARK_I, BENCHMARK_J, BENCHMARK_K, BENCHMARK_L, BENCHMARK_M, BENCHMARK_N, BENCHMARK_P, BENCHMARK_Q, BENCHMARK_R, BENCHMARK_S, BENCHMARK_SA, BENCHMARK_SB, BENCHMARK_SC, BENCHMARK_SD, BENCHMARK_SE, BENCHMARK_SF, BENCHMARK_TC1, BENCHMARK_TC2, BENCHMARK_TC3, BENCHMARK_FR1, BENCHMARK_FR2, BENCHMARK_FD1, BENCHMARK_FD2, BENCHMARK_FD3, BENCHMARK_FD3b, BENCHMARK_FD4, BENCHMARK_FD5, BENCHMARK_FD6, BENCHMARK_FD7, BENCHMARK_SD1, BENCHMARK_SD2, BENCHMARK_SD3, BENCHMARK_SD4, BENCHMARK_CD1, BENCHMARK_CD2, BENCHMARK_CD3, BENCHMARK_CD4, BENCHMARK_FT1, BENCHMARK_FT2, BENCHMARK_FT3, BENCHMARK_FT4, BENCHMARK_ST1, BENCHMARK_ST2, BENCHMARK_ST3 } from './index.js'
import { resolveIronmongeryLines } from '../loadPricingContext.js'
import { allocatedSectionParts, doorLeaves, doorLeafSize, doorLeafWeightKg, doorGlassSightline, doorPanelSize, leafCells } from '../doorGeometry.js'
// The LIVE price-file snapshot (reviewer-checked, 8 Oct 2026) — the honest
// benchmarks and the real-tree case price from this, never from the
// hand-typed pf30Rules.js (whose rules are all is_active: false).
import SNAPSHOT from './pf30-snapshot.json'
// The ONLY source of cost/price targets: figures read from Integrate.
// Never edited to match GlazePro output — a failing test that tells the
// truth is the right outcome when GlazePro disagrees with Integrate.
import INTEGRATE from './integrate-targets.json'
import { matrixIndexOf, isStormproofSash, isStormproofWindow, openingNodes, openingLabel } from '../../drawingBoard/casementOpenings.js'

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

  it('D: each pair draws 738 wide, as Integrate', () => {
    // Step AD decision 3: openings subtract the mullion thickness (profile
    // value thicknessInFrameHollow, 144) with offset = the mullion's LEFT
    // face — interior 1630 → openings 743 / 743 → each pair 743 − 5 = 738.
    const d = computeDerived(BENCHMARK_D.tree, BENCHMARK_D.profileValues)
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
  const S = SNAPSHOT_LIVE
  const ironmongeryLines = resolveIronmongeryLines(tree, S, S.profileValues)
  return runPricingOnTree(tree, S.rules, S.pfVariables, {
    glassCatalogue:       S.glassCatalogue,
    partAllocationRules:  S.partAllocationRules,
    partCostMap:          S.partCostMap,
    ironmongeryLines,
    ironmongeryCatalogue: S.ironmongeryCatalogue,
    profileValues:        S.profileValues,
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
/**
 * Step BE: `declared` is what GlazePro charges ON PURPOSE over Integrate,
 * in the group it lands in — taken from the fixture’s own declaration rather
 * than written again here. A benchmark with no declaration still has to
 * match Integrate to the penny, which is most of them.
 */
function expectMatchesIntegrate(results, target, declared = {}) {
  const extra = Object.values(declared).reduce((t, v) => t + v, 0)
  expect(results.price.total_cost).toBeCloseTo(target.total_cost + extra, 2)
  expect(results.price.total).toBeCloseTo(target.total_price + extra * 2, 1)
  const groups = groupTotals(results)
  for (const [group, t] of Object.entries(target.groups ?? {})) {
    const d = declared[group] ?? 0
    expect(groups[group]?.cost  ?? 0, `${group} cost`).toBeCloseTo(t.cost + d,  1)
    expect(groups[group]?.price ?? 0, `${group} price`).toBeCloseTo(t.price + d * 2, 1)
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

  // Step AD: C is EXACT (top-sash arch model + exact shaped cut area +
  // decimal-safe line rounding). D remains a truthful failure
  // (−39.67/−79.62, docs/step-ad-findings.md): Integrate's extra 1.00 h
  // labour is not in the snapshot's install_labour rules, and the weight
  // model runs 0.1 kg/sash heavy on the 738-wide double-box sashes
  // (steel 9.3/10.0 vs Integrate 9.2/9.9) — reported, not tuned.
  it('Benchmark C (arched) matches Integrate, plus the shaped glass', () => {
    // Step BE: C’s two arched units are billed on the largest rectangle of
    // their cut glass + 25% at the square rate (Nathan, decision e) — +13.12
    // in glass_done while the shaped RATE waits on sql/step-be1. The fixture
    // declares both halves and the page reads BY DESIGN.
    expectMatchesIntegrate(runFromSnapshot(BENCHMARK_C.tree), INTEGRATE.benchmarkC_arched,
      { glass_done: C_SHAPED_GLASS })
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

  it('the claw fastener now resolves a finish from the PROFILE, and warns about nothing', () => {
    // Step Z: this real drawing stores NO item ironmongery finish. The live
    // profile had no default either, so the default claw-fastener line could
    // resolve no finish and Step Z made that a visible warning rather than a
    // silent guess at Polished Brass.
    //
    // Step AY item 2: the fresh snapshot's profile DOES carry a default —
    // ironmongeryFinish 'PB', which the old one did not — so the line
    // resolves and prices, and the warning cannot fire. The engine's rule is
    // unchanged; the data it reads changed.
    //
    // READ THE NEXT TEST: the figure that comes out is the one Step Z
    // identified as WRONG for this drawing.
    expect(results.warnings).toEqual([])
  })

  it('fixed-finish defaults (trickle vent, Wht) still price with no item finish', () => {
    const trickle = results.price.lines.find(l => l.alloc_iron_part_code === 'RHZ665' && l.fires)
    expect(trickle).toBeTruthy()
    expect(trickle.line_cost).toBeCloseTo(3.15, 2)
  })

  it('and it prices Polished Brass £26.25, where Integrate charged ABs £36.75', () => {
    // A QUESTION FOR THE REVIEWER, recorded as it stands and not worked
    // around. £26.25 is exactly the figure the reviewer found live and Step Z
    // was written to stop GlazePro producing: Integrate charged this drawing
    // Antique Brass at £36.75. The profile's new default ironmongeryFinish
    // 'PB' reinstates it, for this drawing and any other that stores no item
    // finish of its own.
    //
    // It is NOT the silent guess Step Z removed — the finish now comes from a
    // real profile default — but for this drawing the right answer is still
    // ABs. Whether 'PB' is the right default is a data decision, so no rule
    // and no profile value was touched. See docs/reports/step-ay.md.
    const clawLines = results.price.lines.filter(l =>
      l.alloc_iron_short_name === 'z-claw_fastener_kit_wpulleys' && l.fires)
    expect(clawLines).toHaveLength(1)
    expect(clawLines[0].alloc_iron_part_code).toBe('HKKS1075PB')
    expect(clawLines[0].line_cost).toBeCloseTo(26.25, 2)
    // Integrate's own figure for the same line, for the record
    const INTEGRATE_CHARGED_ABS = 36.75
    expect(clawLines[0].line_cost).toBeLessThan(INTEGRATE_CHARGED_ABS)
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


// ── Step AJ — a board-drawn sash replacement prices like Integrate ──────────
// The gap (reviewer's live test, 9 Oct 2026): nothing on the board set the
// sashes' toBeReplaced, so a saved "New Pair of Sashes" drawing stored null
// on both sashes and priced with no sashes at all. Benchmark A only passed
// because its FIXTURE sets toBeReplaced by hand. These tests take that hand
// setting away — the tree a board drawing really holds — apply the Step AJ
// path, and price from the snapshot: the result must be Integrate's figure to
// the penny. This is the end-to-end proof of the fix.
describe('Step AJ — board-shaped trees price like Integrate', () => {
  /** The tree as the board saved it before Step AJ: no toBeReplaced at all. */
  function withoutHandSetReplaced(tree) {
    const stripped = JSON.parse(JSON.stringify(tree))
    ;(function walk(n) {
      if (n.part_type === 'topSashPart' || n.part_type === 'bottomSashPart') {
        delete n.values.toBeReplaced
      }
      ;(n.children ?? []).forEach(walk)
    })(stripped)
    return stripped
  }

  const sashValues = tree => {
    const out = []
    ;(function walk(n) {
      if (n.part_type === 'topSashPart' || n.part_type === 'bottomSashPart') out.push(n.values?.toBeReplaced)
      ;(n.children ?? []).forEach(walk)
    })(tree)
    return out
  }

  it('A (new_pair_of_sashes): board tree + the Step AJ path = 728.26 / 1,408.66', () => {
    const boardTree = withoutHandSetReplaced(BENCHMARK_A.tree)
    expect(sashValues(boardTree)).toEqual([undefined, undefined])

    // Priced as the board saved it, the sashes are not priced at all.
    const before = runFromSnapshot(boardTree)
    expect(before.price.total_cost).toBeLessThan(INTEGRATE.benchmarkA.total_cost)

    const { tree, sashesChanged } = applySashesReplaced(boardTree)
    expect(sashesChanged).toHaveLength(2)
    expect(sashValues(tree)).toEqual([true, true])
    expectMatchesIntegrate(runFromSnapshot(tree), INTEGRATE.benchmarkA)
  })

  it('B (draught_seal): board tree + the Step AJ path = 208.33 / 522.65', () => {
    const boardTree = withoutHandSetReplaced(BENCHMARK_B.tree)
    expect(sashValues(boardTree)).toEqual([undefined, undefined])

    const { tree, sashesChanged } = applySashesReplaced(boardTree)
    expect(sashesChanged).toHaveLength(2)
    expect(sashValues(tree)).toEqual([false, false])
    expectMatchesIntegrate(runFromSnapshot(tree), INTEGRATE.benchmarkB_corrected)
  })

  // The brief's "confirm complete_new → true moves no benchmark": the path
  // stores true where the complete-new fixtures leave it unset (C, D) or
  // already set it (L34046), and every total stays exact.
  it('complete_new: storing true moves no benchmark', () => {
    const CASES = [
      [BENCHMARK_L34046, INTEGRATE.L34046],
      [BENCHMARK_C,      INTEGRATE.benchmarkC_arched, { glass_done: C_SHAPED_GLASS }],
    ]
    for (const [bm, target, declared] of CASES) {
      const { tree } = applySashesReplaced(bm.tree)
      expect(sashValues(tree).every(v => v === true), bm.name).toBe(true)
      expectMatchesIntegrate(runFromSnapshot(tree), target, declared)
    }
    // D is a truthful failure on its steel weights (step-ad findings), so
    // assert it is unchanged by the path rather than exact.
    const dBefore = runFromSnapshot(BENCHMARK_D.tree)
    const dAfter  = runFromSnapshot(applySashesReplaced(BENCHMARK_D.tree).tree)
    expect(dAfter.price.total_cost).toBeCloseTo(dBefore.price.total_cost, 10)
    expect(dAfter.price.total).toBeCloseTo(dBefore.price.total, 10)
  })
})

// ── Step AK — spiral balance benchmarks E and F ─────────────────────────────
// Facts: docs/integrate-L31115-spiral.txt. E is a complete new spiral sash
// window from Integrate's own spiral template; F is benchmark A with both
// sashes set to Spiral Hung, which made Integrate switch the frame to solid
// spiral 28/28/28 and grow the sashes.
describe('Step AK — spiral benchmarks', () => {
  it('E (complete new spiral) matches the Integrate targets', () => {
    expectMatchesIntegrate(runFromSnapshot(BENCHMARK_E.tree), INTEGRATE.benchmarkE_spiral_complete_new)
  })

  it('F (spiral sash replacement) matches the Integrate targets', () => {
    expectMatchesIntegrate(runFromSnapshot(BENCHMARK_F.tree), INTEGRATE.benchmarkF_spiral_replacement)
  })

  // Integrate drew F's sashes 1014 wide with the top sash 876.0 and both
  // shoulders 787 once it switched the frame to solid spiral; E's template
  // drew 939 wide, top sash 701.5, shoulders 612.5. Both must come out of
  // GlazePro's one geometry source (step-ak brief §1).
  const GEOMETRY = [
    [BENCHMARK_F, 1014, 876.0, 787],
    [BENCHMARK_E,  939, 701.5, 612.5],
  ]
  for (const [bm, sashWidth, topSashHeight, shoulder] of GEOMETRY) {
    it(`${bm === BENCHMARK_E ? 'E' : 'F'}: sash ${sashWidth} wide, top ${topSashHeight}, shoulders ${shoulder}`, () => {
      const d = computeDerived(bm.tree)
      const pair = bm.tree.children.find(c => c.part_type === 'assemblyFramePart')
        .children.find(c => c.part_type === 'sashPairPart')
      expect(d[pair.key].sashWidth).toBe(sashWidth)
      expect(d[pair.key].topSashHeight).toBe(topSashHeight)
      // Integrate's "shoulder" is the glass sightline height
      expect(d[pair.key].topSashHeight - 49 - 40).toBe(shoulder)
      expect(d[pair.key].bottomSashHeight - 88 - 40).toBe(shoulder)
    })
  }

  // Spiral is recognised from the sash operation and the jamb type, not from
  // an item type: Integrate's itemTypeId 2 has no GlazePro field.
  it('the spiral variables are what the trees produce', () => {
    for (const bm of [BENCHMARK_E, BENCHMARK_F]) {
      const vars = computeVariables(bm.tree, computeDerived(bm.tree), PF_VARIABLES)
      expect(vars.is_sw, bm.name).toBe(true)
      expect(vars.is_box_sash, bm.name).toBe(true)
      expect(vars.is_spiral_hung, bm.name).toBe(true)
      expect(vars.is_cord_hung, bm.name).toBe(false)
      expect(vars.is_solid_spiral_jamb, bm.name).toBe(true)
      // is_spiral_sash keys on a spiralSashPairPart that GlazePro never
      // builds, so it is false — and no PF30 rule uses it.
      expect(vars.is_spiral_sash, bm.name).toBe(false)
    }
  })

  // Spiral means no counterweights at all, and E swaps the box frame
  // linings for the spiral frame lines.
  it('no Lead or Steel Weight; E prices Spiral Frame, not Box Frame Linings', () => {
    const names = r => r.price.lines.filter(l => l.fires && !l.error).map(l => l.name)
    for (const bm of [BENCHMARK_E, BENCHMARK_F]) {
      const fired = names(runFromSnapshot(bm.tree))
      expect(fired, bm.name).not.toContain('Lead Weight')
      expect(fired, bm.name).not.toContain('Steel Weight')
      expect(fired.filter(n => n === 'Spiral Balances'), bm.name).toHaveLength(2)
    }
    const e = names(runFromSnapshot(BENCHMARK_E.tree))
    expect(e).toContain('Softwood Spiral Frame')
    expect(e).toContain('Softwood Spiral Frame Linings')
    expect(e).not.toContain('Softwood Box Frame Linings')
    expect(e).not.toContain('Softwood Pulley Stiles and Head')
  })

  // The one engine change this step needed: the glazing bar run is measured
  // at the glass CUT size, rounded half-up to 2 dp. Only that rule fits all
  // three Integrate readings — A 2.40, L34046 2.50, F 2.56.
  it('the glazing bar quantity matches Integrate on all three readings', () => {
    const barQty = tree => runFromSnapshot(tree).price.lines
      .filter(l => l.fires && !l.error && l.name === 'Glazing Bar' && l.quantity > 0)
      .map(l => Number(l.quantity.toFixed(4)))
    expect(barQty(BENCHMARK_A.tree)).toEqual([2.4])
    expect(barQty(BENCHMARK_L34046.tree)).toEqual([2.5, 2.5])
    expect(barQty(BENCHMARK_F.tree)).toEqual([2.56])
  })
})

// ── Step AM — cill replacement benchmarks G, H and I ────────────────────────
// Facts: docs/integrate-L31115-cill.txt. Integrate charges the same cill
// block on all three — a Cill Replacement line 1.00 → 200.00 and 2.50 h of
// install labour — and no cill timber.
describe('Step AM — cill replacement benchmarks', () => {
  it('G (sash replacement + new cill) matches the Integrate targets', () => {
    expectMatchesIntegrate(runFromSnapshot(BENCHMARK_G.tree), INTEGRATE.benchmarkG_sash_replacement_new_cill)
  })

  it('H (draught seal + new cill) matches the corrected target', () => {
    expectMatchesIntegrate(runFromSnapshot(BENCHMARK_H.tree), INTEGRATE.benchmarkH_draught_seal_new_cill_corrected)
  })

  it('I (stand-alone cill) matches the corrected target', () => {
    expectMatchesIntegrate(runFromSnapshot(BENCHMARK_I.tree), INTEGRATE.benchmarkI_cill_only_corrected)
  })

  // The cill block is 2.50 h of install labour plus the Cill Replacement
  // line, so each benchmark is its source plus 2.50 h and +1.00/+200.00.
  // The TOTAL difference is a penny apart between G and H (101.52 vs
  // 101.53) because the labour line is rounded once, as a whole: A 4.75 h
  // -> 191.00 and G 7.25 h -> 291.52 differ by 100.52, while B 4.00 h ->
  // 160.84 and H 6.50 h -> 261.37 differ by 100.53. Integrate's own totals
  // show the same penny, so the invariant to assert is the hours and the
  // cill line, not a constant block.
  it('each one is its source benchmark plus 2.50 h and the cill line', () => {
    const HOURS = [
      [BENCHMARK_G, 7.25, 829.78 - 728.26],      // A's 4.75 + 2.50
      [BENCHMARK_H, 6.50, 309.86 - 208.33],      // B's 4.00 + 2.50
      [BENCHMARK_I, 2.50, 101.53],               // the block on its own
    ]
    for (const [bm, hours, costDelta] of HOURS) {
      const r = runFromSnapshot(bm.tree)
      expect(r.install_labour.total_minutes / 60, bm.name).toBeCloseTo(hours, 2)
      const labour = r.price.lines.find(l => l.fires && l.name === 'Labour')
      expect(labour.quantity, bm.name).toBeCloseTo(hours, 2)
      // and the cill block is the whole difference from the source total
      expect(costDelta, bm.name).toBeCloseTo(r.price.total_cost - (bm === BENCHMARK_I ? 0 : (bm === BENCHMARK_G ? 728.26 : 208.33)), 2)
    }
    // Price side: +401.05 on both copies, and I is the block itself
    expect(1809.71 - 1408.66).toBeCloseTo(401.05, 2)
    expect(923.70 - 522.65).toBeCloseTo(401.05, 2)
  })

  // The uncorrected figures are no longer checked by arithmetic here: the
  // "Step AN — uncorrected S4 lines" block below PRICES H's, I's and a
  // no_work tree with Integrate's own ungated rules and shows the four
  // lines totalling 25.46 / 50.90, so Integrate's 126.99 / 451.95 and
  // 335.32 / 974.60 are reproduced by pricing, not by subtraction.

  it('G, H and I all price the cill block and no cill timber', () => {
    for (const bm of [BENCHMARK_G, BENCHMARK_H, BENCHMARK_I]) {
      const fired = runFromSnapshot(bm.tree).price.lines.filter(l => l.fires && !l.error && l.line_cost > 0)
      const cill = fired.filter(l => l.name === 'Cill Replacement Profit')
      expect(cill, bm.name).toHaveLength(1)
      expect(cill[0].line_cost, bm.name).toBe(1)
      expect(cill[0].line_total, bm.name).toBe(200)
      // Integrate prices no cill timber for a repair: Box Frame Utile Cill
      // only fires when the frame is replaced.
      expect(fired.map(l => l.name), bm.name).not.toContain('Box Frame Utile Cill')
    }
  })

  // I is a stand-alone cill: nothing is being done to the sashes, so
  // Integrate charges no staff or parting bead, no DSO rate, no DSO extra
  // profits, no ironmongery and no installation consumables.
  it('I prices the labour and the cill only', () => {
    const fired = runFromSnapshot(BENCHMARK_I.tree).price.lines
      .filter(l => l.fires && !l.error && l.line_cost > 0)
      .map(l => l.alloc_label ?? l.name)
    expect(fired.sort()).toEqual(['Cill Replacement Profit', 'Labour'])
  })
})

// ── Step AN: the three S4 rules, uncorrected and corrected ─────────────────
// Integrate's own conditions, and GlazePro's deliberate S4 difference
// (docs/integrate-differences.md difference 1). Module-level so both Step AN
// blocks below can price real runs with them.
const UNCORRECTED_S4_RULES = [
  {
    id: 'an_lam_bottom', rule_family: 'price', level: 'item', is_active: true,
    group_name: 'manufacture_materials', loop_target: 'sliding_sash',
    name: 'Laminated Softwood for Sashes (Bottom)',
    condition: 'is_solid_redwood_sash and is_bottom_sash',
    quantity: '((gross_sash_height_in_mm + (gross_sash_width_in_mm * 1.5)) / 1000) * 1.05',
    value: '4.95', markup: 2, sort_order: 10,
  },
  {
    id: 'an_lam_top', rule_family: 'price', level: 'item', is_active: true,
    group_name: 'manufacture_materials', loop_target: 'sliding_sash',
    name: 'Laminated Softwood for Sashes (Top)',
    condition: 'is_solid_redwood_sash and is_top_sash',
    quantity: '((gross_sash_height_in_mm + (gross_sash_width_in_mm * 1)) / 1000) * 1.05',
    value: '4.95', markup: 2, sort_order: 15,
  },
  {
    id: 'an_glaze_bead', rule_family: 'price', level: 'item', is_active: true,
    group_name: 'manufacture_materials', loop_target: 'sliding_sash',
    name: 'Glazing Bead for Sashes',
    condition: 'not is_square_top_with_arched_sightline and not is_curved_head_sash',
    quantity: '((sash_sightline_width_in_mm + sash_sightline_height_in_mm) / 1000) * 2',
    value: '1.39', markup: 2, sort_order: 310,
  },
]

const CORRECTED_S4_RULES = UNCORRECTED_S4_RULES.map(r => ({
  ...r, condition: r.condition + ' and to_be_replaced',
}))

// ── Step AN — where the "no sash work" gate belongs ─────────────────────────
// Facts (docs/integrate-L31115-cill.txt, last section): on the stand-alone
// cill, and on the same drawing with "No Work", Integrate STILL priced the
// sliding-sash PRICE rules Laminated Softwood ×2 and Glazing Bead ×2 —
// £50.90 was No Work's entire price. What it skipped was the COMPONENT
// staff/parting bead lines. So the gate belongs to the component allocator's
// loop only, and these tests pin both halves of that.
describe('Step AN — the gate is the component allocator’s, not the price loop’s', () => {
  it('the price-rule sliding_sash loop still visits sashes nothing is done to', () => {
    // An ungated sliding-sash price rule (Integrate has real ones, e.g.
    // "Hardwood Sashes": is_solid_utile_hardwood_sash, no gate) must still
    // fire on a stand-alone cill — that is what Integrate does.
    const ungated = [{
      id: 'ungated_sash_rule', rule_family: 'price', level: 'item', is_active: true,
      group_name: 'manufacture_materials', loop_target: 'sliding_sash',
      name: 'Ungated sliding sash rule',
      condition: 'true', quantity: '1', value: '10', markup: 2, sort_order: 1,
    }]
    const results = runPricingOnTree(BENCHMARK_I.tree, ungated, SNAPSHOT.pfVariables, {
      profileValues: SNAPSHOT.profileValues,
    })
    const fired = results.price.lines.filter(l => l.fires && !l.error)
    expect(fired).toHaveLength(2)          // both sashes visited
    expect(results.price.total_cost).toBe(20)
  })

  it('the component allocator still skips them (no staff or parting bead on I)', () => {
    const fired = runFromSnapshot(BENCHMARK_I.tree).price.lines
      .filter(l => l.fires && !l.error)
      .map(l => l.alloc_label ?? l.name)
    for (const label of ['Small staff bead – width', 'Small staff bead – height',
                         'Parting bead – height', 'Parting bead – width']) {
      expect(fired, label).not.toContain(label)
    }
  })

  it('no ironmongery default fires on a stand-alone cill — so that loop needs no gate', () => {
    // Integrate charged no ironmongery on I. Every default rule that could
    // apply is excluded by its OWN condition: the Brighton kit needs
    // needs_draughtsealing, the claw kits need nj_involved or
    // is_complete_new, the trickle vent needs frame_to_be_replaced — all
    // false on a cill-only item. defaultIronmongery.js therefore keeps its
    // ungated loop copy.
    const tree = JSON.parse(JSON.stringify(BENCHMARK_I.tree))
    const paint = tree.children.find(c => c.part_type === 'paintAndIronmongeryPart')
    paint.values.ironmongeryLines = []     // fall through to the defaults
    expect(resolveIronmongeryLines(tree, SNAPSHOT, SNAPSHOT.profileValues)).toEqual([])
  })
})

// ── Step AN item 2 — the uncorrected S4 lines, priced rather than subtracted ─
// Integrate charges Laminated Softwood ×2 and Glazing Bead ×2 on a draught
// seal, a stand-alone cill and a "No Work" item; GlazePro's S4 difference
// gates them on to_be_replaced. These runs reproduce Integrate's uncorrected
// figures from the rules instead of deriving them by subtraction.
describe('Step AN — uncorrected S4 lines on H, I and a no_work tree', () => {
  const S4_COST = 25.46, S4_PRICE = 50.90

  function s4Only(tree, rules) {
    const results = runPricingOnTree(tree, rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      profileValues:  SNAPSHOT.profileValues,
    })
    return {
      fired: results.price.lines.filter(l => l.fires && !l.error),
      cost:  results.price.total_cost,
      price: results.price.total,
    }
  }

  const CASES = [
    ['H (draught seal + new cill)', BENCHMARK_H.tree],
    ['I (stand-alone cill)',        BENCHMARK_I.tree],
    ['a no_work item',              (() => {
      const t = JSON.parse(JSON.stringify(BENCHMARK_I.tree))
      t.values.typeOfWork = 'no_work'
      return t
    })()],
  ]

  for (const [label, tree] of CASES) {
    it(`${label}: the uncorrected rules fire four lines totalling 25.46 / 50.90`, () => {
      const { fired, cost, price } = s4Only(tree, UNCORRECTED_S4_RULES)
      expect(fired).toHaveLength(4)        // laminated bottom + top, bead ×2
      expect(cost).toBeCloseTo(S4_COST, 2)
      expect(price).toBeCloseTo(S4_PRICE, 2)
    })

    it(`${label}: the corrected rules fire nothing`, () => {
      const { fired, cost } = s4Only(tree, CORRECTED_S4_RULES)
      expect(fired).toHaveLength(0)
      expect(cost).toBe(0)
    })
  }

  it('so I’s uncorrected total is its corrected total plus those four lines', () => {
    const corrected = runFromSnapshot(BENCHMARK_I.tree)
    const { cost, price } = s4Only(BENCHMARK_I.tree, UNCORRECTED_S4_RULES)
    expect(corrected.price.total_cost + cost).toBeCloseTo(INTEGRATE.benchmarkI_cill_only_uncorrected.total_cost, 2)
    expect(corrected.price.total + price).toBeCloseTo(INTEGRATE.benchmarkI_cill_only_uncorrected.total_price, 2)
  })

  it('and H’s uncorrected total likewise', () => {
    const corrected = runFromSnapshot(BENCHMARK_H.tree)
    const { cost, price } = s4Only(BENCHMARK_H.tree, UNCORRECTED_S4_RULES)
    expect(corrected.price.total_cost + cost).toBeCloseTo(INTEGRATE.benchmarkH_draught_seal_new_cill_uncorrected.total_cost, 2)
    expect(corrected.price.total + price).toBeCloseTo(INTEGRATE.benchmarkH_draught_seal_new_cill_uncorrected.total_price, 2)
  })
})

// ── Step AO — casement and direct glazed benchmarks J, K, L, M, N, P ────────
// Facts: docs/integrate-L31115-direct-glazed.txt (trees, sizes, every price
// line, and the labour and production minutes reconciled rule by rule).
//
// All six are short by exactly 14.70 cost / 29.40 price, and only that: every
// part of the snapshot's kenrick_extension_gear_box:PC carries unit_cost 0
// while the set itself costs 7.35, so its two sets price at nothing. The
// engine now warns by name instead of pricing a silent zero; the figure is
// NOT invented (docs/step-ao-findings.md). J's extra 0.34 is now closed: the
// step-ap addendum measured the mullion length for rule 121 as internal
// height + 25, which gives 1.3530 → 16.78, Integrate's own figure.
describe('Step AO — casement and direct glazed benchmarks', () => {

  const CASES = [
    ['J', BENCHMARK_J, INTEGRATE.benchmarkJ_casement_two_opening_utile,   18.83, 12.00, 0],
    ['K', BENCHMARK_K, INTEGRATE.benchmarkK_casement_plus_direct_glazed,  14.42, 10.67, 0],
    ['L', BENCHMARK_L, INTEGRATE.benchmarkL_two_direct_glazed_mullion,    12.17, 14.33, 0],
    ['M', BENCHMARK_M, INTEGRATE.benchmarkM_single_direct_glazed,          7.83,  7.17, 0],
    ['N', BENCHMARK_N, INTEGRATE.benchmarkN_casement_plus_fixed_casement, 17.17, 10.50, 0],
    ['P', BENCHMARK_P, INTEGRATE.benchmarkP_single_casement_1599,          8.83, 11.25, 0],
  ]

  // The hours are the strongest check in this step: the facts file
  // reconciles every minute rule by rule, so an hours match means every
  // casement and direct-glazed quantity is right.
  for (const [label, bm, target, production, labour] of CASES) {
    it(`${label}: production ${production} h and labour ${labour} h, exactly`, () => {
      const r = runFromSnapshot(bm.tree)
      expect(r.manufacture_labour.total_minutes / 60, label).toBeCloseTo(production, 2)
      expect(r.install_labour.total_minutes / 60, label).toBeCloseTo(labour, 2)
      expect(r.price.lines.find(l => l.fires && l.name === 'Production Time').quantity, label)
        .toBeCloseTo(production, 2)
      expect(r.price.lines.find(l => l.fires && l.name === 'Labour').quantity, label)
        .toBeCloseTo(labour, 2)
    })
  }

  // Step AY item 2: the fresh PF30 snapshot (Nathan, 13 Oct) prices the
  // Kenrick gearbox set, so these are EXACT offline now. They used to assert
  // the target less the gap, because every part of the old snapshot's
  // kenrick_extension_gear_box:PC carried unit_cost 0.
  for (const [label, bm, target] of CASES) {
    it(`${label}: every line matches Integrate, exactly`, () => {
      const r = runFromSnapshot(bm.tree)
      expect(r.price.total_cost, label).toBeCloseTo(target.total_cost, 2)
      expect(r.price.total, label).toBeCloseTo(target.total_price, 2)
    })
  }

  it('the gear box prices its four parts, and warns about none of them', () => {
    // Step AY item 2: this test used to assert the OPPOSITE — four £0 lines
    // and four warnings — because every part of the old snapshot's
    // kenrick_extension_gear_box:PC carried unit_cost 0 while the set itself
    // cost 7.35. The fresh snapshot has the part costs, so the set prices and
    // the warning it was written for cannot fire. The engine's behaviour has
    // not changed: it still refuses to price a silent zero, and there is now
    // nothing silent to refuse.
    const r = runFromSnapshot(BENCHMARK_K.tree)
    // The SET's own four parts, by code: RJZ1700 Excalibur Gearbox 25mm
    // 3.89, RJZ1708 Centre Strike 2.02, RJZ1709 LH Strike 0.72, RJZ1710 RH
    // Strike 0.72 — 7.35 the set. Not every RJZ17xx: RJZ1705 is the 950 mm
    // extension and is a different product on the same drawing.
    const GEAR_BOX_PARTS = ['RJZ1700', 'RJZ1708', 'RJZ1709', 'RJZ1710']
    const gearLines = r.price.lines.filter(l =>
      l.fires && !l.error && GEAR_BOX_PARTS.includes(l.alloc_iron_part_code ?? ''))
    expect(gearLines.length, 'the four gear box parts').toBe(4)
    for (const l of gearLines) expect(l.line_cost, l.alloc_iron_part_code).toBeGreaterThan(0)
    // two sets at 7.35 each, as Integrate charges
    const sum = gearLines.reduce((t, l) => t + l.line_cost, 0)
    expect(sum).toBeCloseTo(14.70, 2)
    expect(r.warnings.filter(w => w.includes('kenrick_extension_gear_box'))).toHaveLength(0)
  })

  // L and M have no casement sash, so they are NOT casement windows: no
  // frame timber, no cill and no LTW consumables, matching Integrate
  // (Nathan's decision 1 — a known gap in both systems' rules, not a
  // GlazePro difference).
  it('a direct-glazed-only frame prices no frame timber, cill or LTW', () => {
    for (const bm of [BENCHMARK_L, BENCHMARK_M]) {
      const fired = runFromSnapshot(bm.tree).price.lines
        .filter(l => l.fires && !l.error && l.line_cost > 0).map(l => l.name)
      for (const name of ['Softwood Casement Frame & Sashes', 'Hardwood Casement Cill',
                          'LTW General Consumables', 'Softwood Casement Sashes']) {
        expect(fired, `${bm.name} / ${name}`).not.toContain(name)
      }
    }
  })

  it('the variables the minutes prove', () => {
    const vars = bm => computeVariables(bm.tree, computeDerived(bm.tree), PF_VARIABLES)
    // A FIXED casement sash is still a sash (N), and direct glazed units
    // are not sashes (K, L, M).
    const n = vars(BENCHMARK_N)
    expect([n.casement_sash_qty, n.new_casement_sash_qty]).toEqual([2, 2])
    expect([n.fixed_casement_sash_qty, n.new_opening_casement_sash_qty]).toEqual([1, 1])
    expect(n.direct_glazed_unit_qty).toBe(0)

    const k = vars(BENCHMARK_K)
    expect([k.casement_sash_qty, k.new_opening_casement_sash_qty, k.direct_glazed_unit_qty]).toEqual([1, 1, 1])

    const l = vars(BENCHMARK_L)
    expect([l.casement_sash_qty, l.direct_glazed_unit_qty, l.is_casement_window]).toEqual([0, 2, false])
    expect(vars(BENCHMARK_M).direct_glazed_unit_qty).toBe(1)

    // new_sash_qty counts casements — J's two utile sashes take 2 × 20 min
    expect(vars(BENCHMARK_J).new_sash_qty).toBe(2)
    // and none of these are sash windows
    for (const bm of [BENCHMARK_J, BENCHMARK_K, BENCHMARK_L, BENCHMARK_M, BENCHMARK_N, BENCHMARK_P]) {
      const v = vars(bm)
      expect([v.is_sw, v.is_box_sash], bm.name).toEqual([false, false])
    }
  })

  it('the glass areas Integrate shows', () => {
    const areas = bm => runFromSnapshot(bm.tree).price.lines
      .filter(l => l.fires && l.name === 'Square Glass Cost')
      .map(l => Number(l.quantity.toFixed(4)))
    expect(areas(BENCHMARK_K)).toEqual([0.48, 0.65])   // casement sash, direct glazed
    expect(areas(BENCHMARK_L)).toEqual([0.65, 0.65])
    expect(areas(BENCHMARK_M)).toEqual([1.35])         // no mullion
    expect(areas(BENCHMARK_N)).toEqual([0.48, 0.48])
    expect(areas(BENCHMARK_P)).toEqual([1.96])
  })

  it('the timber quantities Integrate shows', () => {
    const qty = (bm, name) => runFromSnapshot(bm.tree).price.lines
      .filter(l => l.fires && l.name === name)
      .map(l => Number(l.quantity.toFixed(4)))
    // Frame timber: the reviewer's §5 formula, 2 dp before the × 1.25
    expect(qty(BENCHMARK_K, 'Softwood Casement Frame & Sashes')).toEqual([35.975])
    expect(qty(BENCHMARK_N, 'Softwood Casement Frame & Sashes')).toEqual([35.975])
    expect(qty(BENCHMARK_P, 'Softwood Casement Frame & Sashes')).toEqual([33.45])
    // Sash timber: one line per casement sash, the fixed one included
    expect(qty(BENCHMARK_K, 'Softwood Casement Sashes')).toEqual([12.25])
    expect(qty(BENCHMARK_N, 'Softwood Casement Sashes')).toEqual([12.25, 12.25])
    expect(qty(BENCHMARK_P, 'Softwood Casement Sashes')).toEqual([21.9])
    // J is utile: the length rules instead, and NO sash timber charged.
    // Rule 165's condition is literally "true", so it still fires once per
    // casement sash — at quantity 0, because only a redwood sash has a
    // redwood volume. Integrate shows no sash timber line on J for the same
    // reason (it has no hardwood casement sash rule), and a 0.00 line is
    // hidden by the Step AE zero-line toggle.
    expect(qty(BENCHMARK_J, 'Softwood Casement Sashes')).toEqual([0, 0])
    expect(runFromSnapshot(BENCHMARK_J.tree).price.lines
      .filter(l => l.fires && l.name === 'Softwood Casement Sashes' && l.line_cost > 0)).toHaveLength(0)
    expect(qty(BENCHMARK_J, 'Casement Frame Jambs & Cills')).toEqual([2.7478])
    expect(qty(BENCHMARK_J, 'Casement Frame Head')).toEqual([1.3189])
    // Mullion length = internal height + 25 (step-ap addendum), where the
    // FRAME timber volume uses + 20 for the same mullion — two Integrate
    // rules, two measured lengths.
    expect(qty(BENCHMARK_J, 'Casement Transoms & Mullions')).toEqual([1.353])
    // Cill: full frame width, 2 dp before the rule → 13.94 and 18.59
    expect(qty(BENCHMARK_K, 'Hardwood Casement Cill')).toEqual([12.85])
    expect(qty(BENCHMARK_P, 'Hardwood Casement Cill')).toEqual([17.1375])
  })

  it('P’s sash is over 25 kg and K’s is not, so the overweight rule fires once', () => {
    const overweight = bm => runFromSnapshot(bm.tree).install_labour.lines
      .filter(l => l.fires && l.name === 'Any Sash Overweight (Casement)').length
    expect(overweight(BENCHMARK_P)).toBe(1)
    expect(overweight(BENCHMARK_K)).toBe(0)
    expect(overweight(BENCHMARK_N)).toBe(0)
  })

  it('a stored ironmongery list is not topped up by the complete-new defaults', () => {
    // Integrate never changes the surveyor's list when openings change, and
    // GlazePro prices whatever is stored: resolveIronmongeryLines returns
    // the tree's own lines, so no default is added on top.
    for (const bm of [BENCHMARK_K, BENCHMARK_P]) {
      const lines = resolveIronmongeryLines(bm.tree, SNAPSHOT, SNAPSHOT.profileValues)
      expect(lines, bm.name).toHaveLength(6)
      expect(lines.map(l => l.product_short_name).sort(), bm.name)
        .toEqual(bm.ironmongeryLines.map(l => l.product_short_name).sort())
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Step AR — fanlights (transoms): benchmarks Q, R and S
// ══════════════════════════════════════════════════════════════════════════════
// docs/integrate-L31115-fanlights.txt, read 12 Oct 2026. The facts file
// reconciles every minute, every timber volume and the glass minimum, so an
// hours-and-quantities match means the transom model is right.
//
// Two gaps are subtracted, both named and neither tuned:
//  - ONE Kenrick gearbox set per drawing, whose four parts carry unit_cost 0
//    in the snapshot (the £14.70 of J–P at two sets; 8.40 at one). The
//    reviewer's sql/step-ap0-gearbox-part-costs.sql is the data fix.
//  - Q and R only: the surround WIDTH component. Integrate's own rule
//    measures 1000 × width + 100 = 1140 mm and Integrate prints 1.10 m,
//    while GlazePro ceils to 1.20 m — 28p. Ceiling is confirmed by L34046
//    (1345 mm → 1.4 m) and by S's own head board (1349 mm → 1.4 m), so the
//    rounding is NOT what differs and was left alone (docs/step-ar-findings.md).
describe('Step AR — casement fanlight benchmarks', () => {

  /** The frame's casement sashes, in matrix order. */
  const sashesOf = bm => bm.tree.children
    .find(c => c.part_type === 'assemblyFramePart').children
    .filter(c => c.part_type === 'casementSashPart')

  const CASES = [
    ['Q', BENCHMARK_Q, INTEGRATE.benchmarkQ_fanlight_tophung_over_side, 17.17, 11.00],
    ['R', BENCHMARK_R, INTEGRATE.benchmarkR_fixed_fanlight_over_side,   17.17, 10.50],
    ['S', BENCHMARK_S, INTEGRATE.benchmarkS_fanlight_1199x1499,         17.17, 11.75],
  ]

  for (const [label, bm, target, production, labour] of CASES) {
    it(`${label}: production ${production} h and labour ${labour} h, exactly`, () => {
      const r = runFromSnapshot(bm.tree)
      expect(r.manufacture_labour.total_minutes / 60, label).toBeCloseTo(production, 2)
      expect(r.install_labour.total_minutes / 60, label).toBeCloseTo(labour, 2)
    })
  }

  // Step AY item 2: the fresh PF30 snapshot (Nathan, 13 Oct) prices the
  // Kenrick gearbox set, so these are EXACT offline now. They used to assert
  // the target less the gap, because every part of the old snapshot's
  // kenrick_extension_gear_box:PC carried unit_cost 0.
  for (const [label, bm, target] of CASES) {
    it(`${label}: every line matches Integrate, exactly`, () => {
      const r = runFromSnapshot(bm.tree)
      expect(r.price.total_cost, label).toBeCloseTo(target.total_cost, 2)
      expect(r.price.total, label).toBeCloseTo(target.total_price, 2)
    })
  }

  it('the surround lengths are Integrate’s own printed figures', () => {
    // Step AR addendum: Q's width surround measures 1140 mm and prints
    // 1.10 m (it used to ceil to 1.20); its height surrounds are 2 x 1080
    // = 2.20. S's are 1299 -> 1.30 and 2 x 1599 -> 3.20.
    const surrounds = bm => runFromSnapshot(bm.tree).price.lines
      .filter(l => l.fires && l.name === 'Component Cost')
      .map(l => l.value)   // a Component Cost line is cost x LENGTH
    expect(surrounds(BENCHMARK_Q)).toEqual([2.2, 1.1])
    expect(surrounds(BENCHMARK_S)).toEqual([3.2, 1.3])
  })

  it('the transom splits the internal height into Integrate’s own rows', () => {
    // Q: internal 886 = 356 + 27 + 503, so the fanlight row is 356 and the
    // row below it 503. Row 1 is the TOP row, as Integrate tags A1 / A2.
    expect(frameGridSize(BENCHMARK_Q.tree)).toEqual({ cols: 1, rows: 2 })
    expect(frameOpenings(BENCHMARK_Q.tree).map(o => [o.width, o.height]))
      .toEqual([[966, 356], [966, 503]])
    // S: internal 1405 = 356 + 27 + 1022 — the fanlight keeps its 356
    expect(frameOpenings(BENCHMARK_S.tree).map(o => [o.width, o.height]))
      .toEqual([[1125, 356], [1125, 1022]])
  })

  it('the sashes are the opening less 4 mm clearance all round', () => {
    const sizes = bm => sashesOf(bm)
      .map(s => { const z = casementSashSize(bm.tree, s); return [z.width, z.height] })
    expect(sizes(BENCHMARK_Q)).toEqual([[958, 348], [958, 495]])
    expect(sizes(BENCHMARK_S)).toEqual([[1117, 348], [1117, 1014]])
  })

  it('production is 1030 minutes: the transom adds 180 + 60', () => {
    // frame 180 + transom 180 (rule 1105, frame_transom_qty) + 2 sashes x 180
    // + glazing 2 x 20 + sash finish 2 x 60 + frame finish 90 + transom
    // finish 60 (rule 211) = 1030 on all three
    for (const [label, bm] of CASES.map(c => [c[0], c[1]])) {
      expect(runFromSnapshot(bm.tree).manufacture_labour.total_minutes, label).toBe(1030)
    }
    const v = computeVariables(BENCHMARK_Q.tree, computeDerived(BENCHMARK_Q.tree), PF_VARIABLES)
    expect(v.frame_transom_qty).toBe(1)
    expect(v.frame_mullion_qty).toBe(0)
  })

  it('a fixed fanlight costs 60 install minutes, an opener 90', () => {
    // R is Q with the fanlight fixed and nothing else changed
    const q = runFromSnapshot(BENCHMARK_Q.tree).install_labour.total_minutes
    const r = runFromSnapshot(BENCHMARK_R.tree).install_labour.total_minutes
    expect(q).toBe(660)
    expect(r).toBe(630)
    expect(q - r).toBe(30)
  })

  it('S’s lower sash is over 25 kg, so Any Sash Overweight fires', () => {
    const sashes = sashesOf(BENCHMARK_S)
    const weights = sashes.map(s => casementSashWeightKg(BENCHMARK_S.tree, s, {}))
    expect(weights[0]).toBeLessThan(25)        // the fanlight
    expect(weights[1]).toBeGreaterThan(25)     // 1117 x 1014 with a 0.92 m2 unit
    // and that is the whole 45-minute difference from Q
    expect(runFromSnapshot(BENCHMARK_S.tree).install_labour.total_minutes).toBe(705)
    expect(705 - 660).toBe(45)
  })

  it('the fanlight glass takes the 0.30 m2 minimum', () => {
    // 958 - 124 + 28 = 862 by 348 - 145 + 28 = 231 -> 0.199 m2 -> 0.30
    const areas = bm => runFromSnapshot(bm.tree).price.lines
      .filter(l => l.fires && l.name === 'Square Glass Cost').map(l => l.quantity)
    expect(areas(BENCHMARK_Q)).toEqual([0.30, 0.33])
    expect(areas(BENCHMARK_S)).toEqual([0.30, 0.92])
  })

  it('the frame timber includes the transom at internal width + 20', () => {
    // head W x 96 x 67 + jambs 2 x internal height x 96 x 57
    //   + transom (internal width + 20) x 96 x 67
    // Q: 6.689 + 9.696 + 986 x 6432 = 6.342 -> 22.73
    // S: 7.712 + 15.376 + 1145 x 6432 = 7.365 -> 30.45
    expect(casementFrameTimberVolumeDm3(BENCHMARK_Q.tree)).toBeCloseTo(22.73, 2)
    expect(casementFrameTimberVolumeDm3(BENCHMARK_S.tree)).toBeCloseTo(30.45, 2)
    const qty = (bm, name) => runFromSnapshot(bm.tree).price.lines
      .filter(l => l.fires && l.name === name).map(l => l.quantity)
    // x 1.25 is the rule's own multiplier
    expect(qty(BENCHMARK_Q, 'Softwood Casement Frame & Sashes')).toEqual([28.4125])
    expect(qty(BENCHMARK_S, 'Softwood Casement Frame & Sashes')).toEqual([38.0625])
  })

  it('sash timber and the cill are per Integrate', () => {
    const qty = (bm, name) => runFromSnapshot(bm.tree).price.lines
      .filter(l => l.fires && l.name === name).map(l => l.quantity)
    // (2 x H x 62 + W x (62 + 83)) x 54, 2 dp
    expect(qty(BENCHMARK_Q, 'Softwood Casement Sashes')).toEqual([9.83, 10.82])
    expect(qty(BENCHMARK_S, 'Softwood Casement Sashes')).toEqual([11.08, 15.54])
    // cill = FULL frame width x 128 x 67 x 1.25
    expect(qty(BENCHMARK_Q, 'Hardwood Casement Cill')).toEqual([11.15])
    expect(qty(BENCHMARK_S, 'Hardwood Casement Cill')).toEqual([12.85])
  })

  it('rule 121 is not fired by these three, and its transom length is unverified', () => {
    // Q/R/S are softwood, so the utile "Casement Transoms & Mullions" rule
    // does not fire. frameMuntinLengthM still has to answer for the board,
    // and its TRANSOM length — internal width + 25 — is by analogy with the
    // mullion's internal height + 25. There is no Integrate reading for it.
    for (const [label, bm] of CASES.map(c => [c[0], c[1]])) {
      const fired = runFromSnapshot(bm.tree).price.lines
        .filter(l => l.fires && l.name === 'Casement Transoms & Mullions')
      expect(fired, label).toEqual([])
    }
    // internal width 966 + 25 = 991 mm
    expect(frameMuntinLengthM(BENCHMARK_Q.tree)).toBeCloseTo(0.991, 3)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Step AU — stormproof casements: SA … SF
// ══════════════════════════════════════════════════════════════════════════════
// docs/integrate-L31115-stormproof.txt, read 13 Oct 2026.
//
// THE POINT OF THESE: Integrate has no stormproof pricing, labour, production
// or allocator rule. Every figure below comes out of the ORDINARY casement
// formulas fed the stormproof sections — so if one of these ever needs a new
// formula, something is wrong with the tree, not with the rules.
//
// The only gap is the Kenrick gearbox set, whose four parts carry unit_cost 0
// in the captured pf30-snapshot.json: 8.40 per set (SA, SB, SC one set;
// SD, SE, SF two). The reviewer's sql/step-ap0-gearbox-part-costs.sql is the
// data fix and the live site already has it.
describe('Step AU — stormproof benchmarks', () => {
  /** Every part of a type in a tree. */
  const findAllParts = (node, partType, acc = []) => {
    if (!node) return acc
    if (node.part_type === partType) acc.push(node)
    for (const child of (node.children ?? [])) findAllParts(child, partType, acc)
    return acc
  }

  // label, benchmark, target, production h, labour h
  const FULL = [
    ['SA', BENCHMARK_SA, INTEGRATE.benchmarkSA_stormproof_single_599x1199,              8.83,  9.50],
    ['SC', BENCHMARK_SC, INTEGRATE.benchmarkSC_stormproof_fixed_fanlight_over_side,     17.17, 10.50],
    ['SF', BENCHMARK_SF, INTEGRATE.benchmarkSF_stormproof_casement_plus_direct_glazed,  14.42, 10.67],
  ]
  // Integrate gave these three as a drawing-card PRICE only
  const PRICE_ONLY = [
    ['SB', BENCHMARK_SB, INTEGRATE.benchmarkSB_stormproof_tophung_fanlight_over_side, 17.17, 11.00],
    ['SD', BENCHMARK_SD, INTEGRATE.benchmarkSD_stormproof_double,                     17.17, 11.00],
    ['SE', BENCHMARK_SE, INTEGRATE.benchmarkSE_stormproof_opener_plus_fixed,           17.17, 10.50],
  ]
  const ALL = [...FULL.map(c => [c[0], c[1], c[3], c[4]]),
    ...PRICE_ONLY.map(c => [c[0], c[1], c[3], c[4]])]

  for (const [label, bm, target, production, labour] of FULL) {
    it(`${label}: production ${production} h and labour ${labour} h, exactly`, () => {
      const r = runFromSnapshot(bm.tree)
      expect(r.manufacture_labour.total_minutes / 60, label).toBeCloseTo(production, 2)
      expect(r.install_labour.total_minutes / 60, label).toBeCloseTo(labour, 2)
    })

    // Step AY item 2: exact offline now the snapshot prices the gear box.
    it(`${label}: every line matches Integrate, exactly`, () => {
      const r = runFromSnapshot(bm.tree)
      expect(r.price.total_cost, label).toBeCloseTo(target.total_cost, 2)
      expect(r.price.total, label).toBeCloseTo(target.total_price, 2)
    })
  }

  for (const [label, bm, target, production, labour] of PRICE_ONLY) {
    it(`${label}: Integrate's price only — ${production} h / ${labour} h`, () => {
      const r = runFromSnapshot(bm.tree)
      expect(r.manufacture_labour.total_minutes / 60, label).toBeCloseTo(production, 2)
      expect(r.install_labour.total_minutes / 60, label).toBeCloseTo(labour, 2)
      expect(r.price.total, label).toBeCloseTo(target.total_price, 2)
    })
  }

  it('the price is twice the cost, to within the per-line rounding', () => {
    // The brief asked for "price = 2 x cost to the penny". It is not exactly
    // that, for either system: every LINE's price is computed and rounded on
    // its own and then summed, so a few pence of rounding survive. Integrate
    // shows the same thing — SA's own figures are 738.06 and 1,476.10, where
    // twice the cost is 1,476.12. So the assertion is "within 3p", and the
    // real check is the line-by-line match above.
    for (const [label, bm] of ALL.map(c => [c[0], c[1]])) {
      const r = runFromSnapshot(bm.tree)
      expect(Math.abs(r.price.total - 2 * r.price.total_cost), `${label} price vs 2 x cost`)
        .toBeLessThanOrEqual(0.03)
    }
    // and Integrate's own recorded figures are no closer
    expect(Math.abs(1476.10 - 2 * 738.06)).toBeCloseTo(0.02, 2)
  })

  it('a stormproof window is stormproof throughout', () => {
    for (const [label, bm] of ALL.map(c => [c[0], c[1]])) {
      const sashes = findAllParts(bm.tree, 'casementSashPart')
      expect(sashes.length, label).toBeGreaterThan(0)
      for (const sash of sashes) {
        expect(isStormproofSash(sash), `${label} ${sash.key}`).toBe(true)
        expect(sash.values.stormProofOverlap, `${label} ${sash.key} overlap`).toBe(7)
      }
      expect(isStormproofWindow(bm.tree), label).toBe(true)
      const vars = computeVariables(bm.tree, computeDerived(bm.tree), PF_VARIABLES)
      expect(vars.is_stormproof_casement, label).toBe(true)
      expect(vars.is_flush_casement, label).toBe(false)
    }
  })

  it('the stormproof sections are on the frame and the cill', () => {
    for (const [label, bm] of ALL.map(c => [c[0], c[1]])) {
      const frame = bm.tree.children.find(c => c.part_type === 'assemblyFramePart')
      expect(frame.values, label).toMatchObject({
        leftWidth: 41, rightWidth: 41, topHeight: 41, bottomHeight: 56,
        frameDepth: 69, frameHeadStopSize: 15, frameStileStopSize: 15,
        cillStopSize: 15, jambType: 'solid_profiled',
      })
      const cill = frame.children.find(c => c.part_type === 'cillPart')
      expect(cill.values, label).toMatchObject({ height: 56, depth: 69 })
    }
  })

  it('the transom and the mullion are UNCHANGED by stormproof', () => {
    // 27 solid with 20 / 20 stops, exactly as the flush fixtures
    const transom = BENCHMARK_SC.tree.children.find(c => c.part_type === 'assemblyFramePart')
      .children.find(c => c.part_type === 'transomPart')
    expect(transom.values).toMatchObject({ offset: 349, thicknessInFrame: 27, transomStopSize: 20 })
    const mullion = BENCHMARK_SF.tree.children.find(c => c.part_type === 'assemblyFramePart')
      .children.find(c => c.part_type === 'mullionPart')
    expect(mullion.values).toMatchObject({ offset: 545, thicknessInFrame: 27, mullionStopSize: 20 })
  })

  it('a direct glazed unit is UNCHANGED by stormproof', () => {
    // SF's unit stores the flush values: clearance 20, rebate 20, hidden 18
    const dgu = BENCHMARK_SF.tree.children.find(c => c.part_type === 'assemblyFramePart')
      .children.find(c => c.part_type === 'glassPart')
    expect(dgu.values).toMatchObject({
      mechanicalClearanceLeft: 20, mechanicalClearanceTop: 20,
      hiddenInRebateLeft: 18, hiddenInRebateBottom: 18,
      glazingRebateWidth: 20, glazingTolerance: 2,
    })
  })

  it('the openings and sashes are Integrate’s own figures', () => {
    // SA: interior 517 x 1102, sash 509 x 1094 (the 7 mm lap is NOT in it)
    expect(frameOpenings(BENCHMARK_SA.tree).map(o => [o.width, o.height]))
      .toEqual([[517, 1102]])
    const sa = casementSashSize(BENCHMARK_SA.tree, openingNodes(BENCHMARK_SA.tree)[0])
    expect([sa.width, sa.height]).toEqual([509, 1094])

    // SC: internal 883 = 349 + 27 + 507, sashes 950 x 341 and 950 x 499
    expect(frameOpenings(BENCHMARK_SC.tree).map(o => [o.width, o.height]))
      .toEqual([[958, 349], [958, 507]])
    expect(openingNodes(BENCHMARK_SC.tree)
      .map(n => { const z = casementSashSize(BENCHMARK_SC.tree, n); return [z.width, z.height] }))
      .toEqual([[950, 341], [950, 499]])

    // SF: internal width 1117 = 545 + 27 + 545, sash 537 x 1194
    expect(frameOpenings(BENCHMARK_SF.tree).map(o => [o.width, o.height]))
      .toEqual([[545, 1202], [545, 1202]])
    const sf = casementSashSize(BENCHMARK_SF.tree, openingNodes(BENCHMARK_SF.tree)[0])
    expect([sf.width, sf.height]).toEqual([537, 1194])
  })

  it('the 7 mm overlap changes NO priced quantity', () => {
    // The strongest statement of the headline finding: strip the overlap and
    // nothing moves. It is drawn, not priced.
    for (const [label, bm] of FULL.map(c => [c[0], c[1]])) {
      const stripped = JSON.parse(JSON.stringify(bm.tree))
      for (const sash of findAllParts(stripped, 'casementSashPart')) {
        delete sash.values.stormProofOverlap
      }
      const withLap = runFromSnapshot(bm.tree)
      const without = runFromSnapshot(stripped)
      expect(without.price.total_cost, label).toBeCloseTo(withLap.price.total_cost, 2)
      expect(without.manufacture_labour.total_minutes, label)
        .toBe(withLap.manufacture_labour.total_minutes)
      expect(without.install_labour.total_minutes, label)
        .toBe(withLap.install_labour.total_minutes)
    }
  })

  it('the timber, cill and glass quantities are Integrate’s', () => {
    const qty = (bm, name) => runFromSnapshot(bm.tree).price.lines
      .filter(l => l.fires && l.name === name).map(l => l.quantity)

    // Frame timber: head W x 69 x 56 + jambs 2 x internal H x 69 x 56
    //               + divider (internal dim + 20) x 69 x 67, then x 1.25
    expect(casementFrameTimberVolumeDm3(BENCHMARK_SA.tree)).toBeCloseTo(10.83, 2)
    expect(casementFrameTimberVolumeDm3(BENCHMARK_SC.tree)).toBeCloseTo(15.36, 2)
    expect(casementFrameTimberVolumeDm3(BENCHMARK_SF.tree)).toBeCloseTo(19.57, 2)
    expect(qty(BENCHMARK_SA, 'Softwood Casement Frame & Sashes')).toEqual([13.5375])
    expect(qty(BENCHMARK_SC, 'Softwood Casement Frame & Sashes')).toEqual([19.2])
    expect(qty(BENCHMARK_SF, 'Softwood Casement Frame & Sashes')).toEqual([24.4625])

    // Sash timber (2 x H x 62 + W x (62 + bottom)) x 54 — SA at Integrate's
    // template rail of 83, SC and SF at the 76 it writes on a conversion
    expect(qty(BENCHMARK_SA, 'Softwood Casement Sashes')).toEqual([11.31])
    expect(qty(BENCHMARK_SC, 'Softwood Casement Sashes')).toEqual([9.36, 10.42])
    expect(qty(BENCHMARK_SF, 'Softwood Casement Sashes')).toEqual([12])

    // Cill: full frame width x 69 x (56 + 15), x 1.25
    expect(qty(BENCHMARK_SA, 'Hardwood Casement Cill')).toEqual([3.6625])
    expect(qty(BENCHMARK_SC, 'Hardwood Casement Cill')).toEqual([6.3625])
    expect(qty(BENCHMARK_SF, 'Hardwood Casement Cill')).toEqual([7.3375])

    // Glass at the cut size; SC's fanlight takes the 0.30 minimum
    expect(qty(BENCHMARK_SA, 'Square Glass Cost')).toEqual([0.4])
    expect(qty(BENCHMARK_SC, 'Square Glass Cost')).toEqual([0.3, 0.33])
    expect(qty(BENCHMARK_SF, 'Square Glass Cost')).toEqual([0.48, 0.65])
  })

  it('SB - SC and SD - SE are both 30 install minutes', () => {
    // An opener against a fixed sash: 90 against 60. x 40.21/h x 2 = 40.21
    const mins = bm => runFromSnapshot(bm.tree).install_labour.total_minutes
    expect(mins(BENCHMARK_SB) - mins(BENCHMARK_SC)).toBe(30)
    expect(mins(BENCHMARK_SD) - mins(BENCHMARK_SE)).toBe(30)
    // and Integrate's own prices differ by the same 40.21
    expect(INTEGRATE.benchmarkSB_stormproof_tophung_fanlight_over_side.total_price
      - INTEGRATE.benchmarkSC_stormproof_fixed_fanlight_over_side.total_price).toBeCloseTo(40.21, 2)
    expect(INTEGRATE.benchmarkSD_stormproof_double.total_price
      - INTEGRATE.benchmarkSE_stormproof_opener_plus_fixed.total_price).toBeCloseTo(40.21, 2)
  })

  it('SC and SF differ from flush R and K only in manufacture materials', () => {
    // The facts: "SC equals flush R and SF equals flush K in every group
    // except manufacture materials (the smaller stormproof sections)."
    const groups = bm => {
      const out = {}
      for (const l of runFromSnapshot(bm.tree).price.lines) {
        if (!l.fires || l.error) continue
        out[l.group_name ?? '?'] = (out[l.group_name ?? '?'] ?? 0) + l.line_cost
      }
      return out
    }
    for (const [storm, flush] of [[BENCHMARK_SC, BENCHMARK_R], [BENCHMARK_SF, BENCHMARK_K]]) {
      const a = groups(storm), b = groups(flush)
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (/manufacture[ _]materials/i.test(key)) {
          expect(a[key], `${storm.name} ${key}`).toBeLessThan(b[key])
        } else {
          expect(a[key] ?? 0, `${storm.name} ${key}`).toBeCloseTo(b[key] ?? 0, 2)
        }
      }
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Step AV — two-column fanlight casements: TC1, TC2, TC3
// ══════════════════════════════════════════════════════════════════════════════
// docs/integrate-L31115-two-column-fanlights.txt, read 13 Oct 2026.
//
// What is new is the frame's divider geometry: a mullion or transom can STOP
// AT ANOTHER DIVIDER, so an opening spans two columns (TC1) or two rows
// (TC3). Everything else comes out of the existing casement rules — TC2
// proved that before any change was made
// (docs/reports/step-av-tc2-proof.md).
//
// The only gap is the Kenrick gearbox set, whose four parts carry unit_cost 0
// in the captured snapshot: three sets on TC1, two on TC2 and TC3. Already
// fixed in the live data.
describe('Step AV — two-column fanlight benchmarks', () => {

  const CASES = [
    ['TC1', BENCHMARK_TC1, INTEGRATE.benchmarkTC1_wide_fanlight_over_double,  25.50, 13.00],
    ['TC2', BENCHMARK_TC2, INTEGRATE.benchmarkTC2_fanlight_over_each,         29.83, 13.50],
    ['TC3', BENCHMARK_TC3, INTEGRATE.benchmarkTC3_fanlight_over_one_side,     25.50, 12.50],
  ]

  /** These carry their own part costs (the nosing, TP61). */
  function runTC(bm) {
    return runPricingOnTree(bm.tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: bm.partCostMap,
      ironmongeryLines: bm.ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
    })
  }

  for (const [label, bm, target, production, labour] of CASES) {
    it(`${label}: production ${production} h and labour ${labour} h, exactly`, () => {
      const r = runTC(bm)
      expect(r.manufacture_labour.total_minutes / 60, label).toBeCloseTo(production, 2)
      expect(r.install_labour.total_minutes / 60, label).toBeCloseTo(labour, 2)
    })

    // Step AY item 2: exact offline now the snapshot prices the gear box.
    it(`${label}: every line matches Integrate, exactly`, () => {
      const r = runTC(bm)
      expect(r.price.total_cost, label).toBeCloseTo(target.total_cost, 2)
      expect(r.price.total, label).toBeCloseTo(target.total_price, 2)
    })
  }

  it('TC1’s fanlight is ONE opening spanning both columns', () => {
    // The mullion starts at the transom, so it exists in the bottom row only
    // and the top row is a single cell: 493 + 27 + 511 = 1031, the divider
    // INCLUDED.
    const cells = frameCells(BENCHMARK_TC1.tree)
    expect(cells.map(c => [c.col, c.row, c.colSpan, c.rowSpan]))
      .toEqual([[0, 0, 2, 1], [0, 1, 1, 1], [1, 1, 1, 1]])
    expect(cells.map(c => [c.width, c.height]))
      .toEqual([[1031, 301], [493, 983], [511, 983]])
    // and the matrix labels skip the empty slot: A1, A2, B2
    expect(cells.map(c => matrixIndexOf(c.col + c.row * 2, 2))).toEqual(['A1', 'A2', 'B2'])
  })

  it('TC3’s opener is ONE opening spanning both rows', () => {
    // The transom starts at the mullion, so it exists in column B only.
    const cells = frameCells(BENCHMARK_TC3.tree)
    expect(cells.map(c => [c.col, c.row, c.colSpan, c.rowSpan]))
      .toEqual([[0, 0, 1, 2], [1, 0, 1, 1], [1, 1, 1, 1]])
    expect(cells.map(c => [c.width, c.height]))
      .toEqual([[543, 1201], [561, 354], [561, 820]])
    // A1, B1, B2 — the empty slot is A2
    expect(cells.map(c => matrixIndexOf(c.col + c.row * 2, 2))).toEqual(['A1', 'B1', 'B2'])
  })

  it('TC2 is a plain 2 x 2 grid — both dividers run frame to frame', () => {
    const cells = frameCells(BENCHMARK_TC2.tree)
    expect(cells.every(c => c.colSpan === 1 && c.rowSpan === 1)).toBe(true)
    expect(cells.map(c => [c.width, c.height]))
      .toEqual([[590, 356], [608, 356], [590, 1022], [608, 1022]])
  })

  it('the sashes are the openings less 4 mm clearance all round', () => {
    const sizes = bm => openingNodes(bm.tree)
      .map(n => { const z = casementSashSize(bm.tree, n); return [z.width, z.height] })
    expect(sizes(BENCHMARK_TC1)).toEqual([[1023, 293], [485, 975], [503, 975]])
    expect(sizes(BENCHMARK_TC2)).toEqual([[582, 348], [600, 348], [582, 1014], [600, 1014]])
    expect(sizes(BENCHMARK_TC3)).toEqual([[535, 1193], [553, 346], [553, 812]])
  })

  it('a short divider is measured by its own span, a full one by the frame', () => {
    // TC1's short mullion lies in the bottom row: 983 + 2. TC3's short
    // transom lies in column B: 561 + 3. The full ones stay internal + 20.
    expect(casementFrameTimberVolumeDm3(BENCHMARK_TC1.tree)).toBeCloseTo(34.55, 2)
    expect(casementFrameTimberVolumeDm3(BENCHMARK_TC2.tree)).toBeCloseTo(40.90, 2)
    expect(casementFrameTimberVolumeDm3(BENCHMARK_TC3.tree)).toBeCloseTo(32.38, 2)

    const frameOf = bm => bm.tree.children.find(c => c.part_type === 'assemblyFramePart')
    const byKey = (bm, key) => frameOf(bm).children.find(c => c.key === key)
    expect(isShortDivider(BENCHMARK_TC1.tree, byKey(BENCHMARK_TC1, 'mull1'))).toBe(true)
    expect(isShortDivider(BENCHMARK_TC1.tree, byKey(BENCHMARK_TC1, 'trans1'))).toBe(false)
    expect(shortDividerSpanMm(BENCHMARK_TC1.tree, byKey(BENCHMARK_TC1, 'mull1'))).toBe(983)
    expect(isShortDivider(BENCHMARK_TC3.tree, byKey(BENCHMARK_TC3, 'trans1'))).toBe(true)
    expect(shortDividerSpanMm(BENCHMARK_TC3.tree, byKey(BENCHMARK_TC3, 'trans1'))).toBe(561)
    // TC2's are both full
    for (const key of ['mull1', 'trans1']) {
      expect(isShortDivider(BENCHMARK_TC2.tree, byKey(BENCHMARK_TC2, key)), key).toBe(false)
    }
  })

  it('a short divider still counts once for production', () => {
    // Rules 1105 and 211 count every divider, short or full: TC1 and TC3
    // both have two dividers and three sashes, so both are 1530 minutes.
    for (const [label, bm] of CASES.map(c => [c[0], c[1]])) {
      const v = computeVariables(bm.tree, computeDerived(bm.tree), PF_VARIABLES)
      expect(v.frame_mullion_qty + v.frame_transom_qty, label).toBe(2)
    }
    expect(runTC(BENCHMARK_TC1).manufacture_labour.total_minutes).toBe(1530)
    expect(runTC(BENCHMARK_TC3).manufacture_labour.total_minutes).toBe(1530)
    expect(runTC(BENCHMARK_TC2).manufacture_labour.total_minutes).toBe(1790)
  })

  it('the nosing prices, and fires the 30-minute Windowboard rule', () => {
    // Integrate charges rule 251 on all three, from the template's "Nosing in
    // Solid Redwood" surround. The nosing is frame width + 150, ceil to
    // 10 mm, then the nearest 0.1 m: 1260 -> 1.3, 1450 -> 1.5, 1360 -> 1.4.
    const nosing = bm => runTC(bm).price.lines
      .filter(l => l.fires && l.name === 'Component Cost' && l.alloc_part_code === 'TP61')
      .map(l => [l.value, Number(l.line_cost.toFixed(2))])
    expect(nosing(BENCHMARK_TC1)).toEqual([[1.3, 3.59]])
    expect(nosing(BENCHMARK_TC2)).toEqual([[1.5, 4.14]])
    expect(nosing(BENCHMARK_TC3)).toEqual([[1.4, 3.86]])

    for (const [label, bm] of CASES.map(c => [c[0], c[1]])) {
      const v = computeVariables(bm.tree, computeDerived(bm.tree), PF_VARIABLES)
      expect(v.has_deep_window_board, label).toBe(true)
    }
    // Take the nosing away and the 30 minutes go with it
    const noNosing = JSON.parse(JSON.stringify(BENCHMARK_TC1.tree))
    noNosing.values.surroundLines = noNosing.values.surroundLines
      .filter(l => l.part_code !== 'TP61')
    expect(computeVariables(noNosing, computeDerived(noNosing), PF_VARIABLES)
      .has_deep_window_board).toBe(false)
    expect(runTC({ ...BENCHMARK_TC1, tree: noNosing }).install_labour.total_minutes)
      .toBe(runTC(BENCHMARK_TC1).install_labour.total_minutes - 30)
  })

  it('a drawing with NO stored surround list is priced by the rules, as before', () => {
    // Which is why no existing benchmark moved: only a stored list replaces
    // the allocator's surrounds.
    const stripped = JSON.parse(JSON.stringify(BENCHMARK_TC2.tree))
    delete stripped.values.surroundLines
    const r = runTC({ ...BENCHMARK_TC2, tree: stripped })
    const comps = r.price.lines.filter(l => l.fires && l.name === 'Component Cost')
    // the architrave the rules allocate, and no nosing (rule 4010 is inactive)
    expect(comps.map(l => l.alloc_part_code)).toEqual(['TP68', 'TP68'])
    expect(computeVariables(stripped, computeDerived(stripped), PF_VARIABLES)
      .has_deep_window_board).toBe(false)
  })

  it('the architrave lengths are the ones the rules would have given', () => {
    // The stored list carries the architrave too, and at the same lengths
    // rules 4000 / 4001 produce — so storing it changes nothing about it.
    const arch = bm => runTC(bm).price.lines
      .filter(l => l.fires && l.name === 'Component Cost' && l.alloc_part_code === 'TP68')
      .map(l => l.value)
    expect(arch(BENCHMARK_TC1)).toEqual([3, 1.2])     // 2 x 1510 -> 1.5, 1210 -> 1.2
    expect(arch(BENCHMARK_TC2)).toEqual([3.2, 1.4])
    expect(arch(BENCHMARK_TC3)).toEqual([2.8, 1.3])
  })
})

/** Every node of a part type, for the Step AX French assertions. */
function findAllOfType(node, partType, acc = []) {
  if (!node) return acc
  if (node.part_type === partType) acc.push(node)
  for (const c of (node.children ?? [])) findAllOfType(c, partType, acc)
  return acc
}

// ══════════════════════════════════════════════════════════════════════════════
// Step AX — French casements: FR1, FR2
// ══════════════════════════════════════════════════════════════════════════════
// docs/integrate-L31115-french-casements.txt, read 13 Oct 2026.
//
// A French casement is ONE opening holding a PAIR — no mullion. The pair adds
// nothing of its own to the price: each of its two sashes is a casement sash
// for production, timber, glass and weight, and the only things that are new
// are the sash SIZE (half the opening, less the meeting-stile gap), the two
// DIFFERENT stiles (an outer 62 and a meeting 63) and the thickness (57, not
// a casement's 54).
//
// Both drawings are Integrate's templates unchanged and never saved, so the
// template nosing is priced and rule 251's 30 minutes with it.
//
// The only gap is the Kenrick gearbox SET — gear box, centre strike, LH
// strike and RH strike, the four parts carrying unit_cost 0 in the captured
// snapshot: two sets on FR1 (-14.70) and three on FR2 (-23.10). Already fixed
// in the live data by sql/step-ap0.
describe('Step AX — French casement benchmarks', () => {

  const CASES = [
    ['FR1', BENCHMARK_FR1, INTEGRATE.benchmarkFR1_french_casement,               13.17, 11.50],
    ['FR2', BENCHMARK_FR2, INTEGRATE.benchmarkFR2_french_casement_with_fanlight,  21.50, 13.00],
  ]

  /** These carry their own part costs (the nosing, TP61). */
  function runFR(bm) {
    return runPricingOnTree(bm.tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: bm.partCostMap,
      ironmongeryLines: bm.ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
    })
  }

  for (const [label, bm, target, production, labour] of CASES) {
    it(`${label}: production ${production} h and labour ${labour} h, exactly`, () => {
      const r = runFR(bm)
      expect(r.manufacture_labour.total_minutes / 60, label).toBeCloseTo(production, 2)
      expect(r.install_labour.total_minutes / 60, label).toBeCloseTo(labour, 2)
    })

    // Step AY item 2: exact offline now the snapshot prices the gear box.
    it(`${label}: every line matches Integrate, exactly`, () => {
      const r = runFR(bm)
      expect(r.price.total_cost, label).toBeCloseTo(target.total_cost, 2)
      expect(r.price.total, label).toBeCloseTo(target.total_price, 2)
    })

    it(`${label}: every GROUP matches Integrate's own five`, () => {
      const r = runFR(bm)
      const got = {}
      for (const l of r.price.lines) {
        if (!l.fires || l.error) continue
        got[l.group_name] = (got[l.group_name] ?? 0) + l.line_cost
      }
      for (const [group, t] of Object.entries(target.groups)) {
        expect(got[group] ?? 0, `${label} ${group}`).toBeCloseTo(t.cost, 2)
      }
    })
  }

  it('the pair is ONE opening, and its sashes are half of it', () => {
    // FR1: internal 1125 x 1219, so each sash is (1125 - 8 - 4) / 2 = 556.5
    // by 1219 - 8 = 1211 — which is what Integrate draws.
    const cells = frameCells(BENCHMARK_FR1.tree)
    expect(cells.length).toBe(1)
    expect([cells[0].width, cells[0].height]).toEqual([1125, 1219])
    expect(openingNodes(BENCHMARK_FR1.tree).map(n => n.part_type))
      .toEqual(['frenchCasementPart'])

    const sashes = CASEMENT_SASH_TYPES.flatMap(t => findAllOfType(BENCHMARK_FR1.tree, t))
    expect(sashes.map(s => {
      const z = casementSashSize(BENCHMARK_FR1.tree, s)
      return [z.width, z.height]
    })).toEqual([[556.5, 1211], [556.5, 1211]])

    // FR2's pair sits under the transom: 825 x 1074 -> 406.5 x 1066 each
    const fr2 = frameCells(BENCHMARK_FR2.tree)
    expect(fr2.map(c => [c.width, c.height])).toEqual([[825, 304], [825, 1074]])
  })

  it('the meeting stile is (midRail - gap) / 2, stored on each sash', () => {
    const pair = openingNodes(BENCHMARK_FR1.tree)[0]
    expect(pair.values.midRail).toBe(130)
    expect(pair.values.gapBetweenMeetingStiles).toBe(4)
    const [left, right] = pair.children
    // the outer stile is 62 and the meeting stile 63, on the inner edge of
    // each leaf — so left and right are NOT the same width
    expect([left.values.leftWidth, left.values.rightWidth]).toEqual([62, 63])
    expect([right.values.leftWidth, right.values.rightWidth]).toEqual([63, 62])
    expect((pair.values.midRail - pair.values.gapBetweenMeetingStiles) / 2).toBe(63)
  })

  it('a French sash is 57 thick and its timber uses both stiles', () => {
    // (H x (outer + meeting) + W x (top + bottom)) x 57:
    // FR1 (1211 x 125 + 556.5 x 145) x 57 = 13.23
    // FR2 (1066 x 125 + 406.5 x 145) x 57 = 10.95, and the FANLIGHT, an
    // ordinary casement sash at 54 thick, (2 x 296 x 62 + 817 x 145) x 54 = 8.38
    const timber = (bm, partTypes) => partTypes
      .flatMap(t => findAllOfType(bm.tree, t))
      .map(s => casementSashTimberVolumeDm3(bm.tree, s))
    expect(timber(BENCHMARK_FR1, CASEMENT_SASH_TYPES)).toEqual([13.23, 13.23])
    expect(timber(BENCHMARK_FR2, ['casementSashPart'])).toEqual([8.38])
    expect(timber(BENCHMARK_FR2, FRENCH_SASH_TYPES)).toEqual([10.95, 10.95])

    for (const s of FRENCH_SASH_TYPES.flatMap(t => findAllOfType(BENCHMARK_FR1.tree, t))) {
      expect(s.values.thickness, 'French sashes are 57 thick').toBe(57)
    }
  })

  it('the glass is the sash less its own two stiles, at the cut size', () => {
    // (W - outer - meeting + 28) x (H - 145 + 28): FR1 459.5 x 1094 = 0.50;
    // FR2 309.5 x 949 = 0.29, which the 0.30 minimum lifts.
    const glass = bm => FRENCH_SASH_TYPES
      .flatMap(t => findAllOfType(bm.tree, t))
      .map(s => {
        const sl = casementGlassSightline(bm.tree, s)
        return [sl.width, sl.height]
      })
    expect(glass(BENCHMARK_FR1)).toEqual([[431.5, 1066], [431.5, 1066]])
    expect(glass(BENCHMARK_FR2)).toEqual([[281.5, 921], [281.5, 921]])
  })

  it('the pair itself adds no production time — only its sashes do', () => {
    // FR1 790 = frame 180 + 2 x (180 machining + 20 glazing + 60 finish)
    //   + 90 frame finish. FR2 1290 adds the transom's 180 + 60 and a third
    //   sash. Two sashes, not three parts: the pair is not machined.
    const v = bm => computeVariables(bm.tree, computeDerived(bm.tree), PF_VARIABLES)
    expect(v(BENCHMARK_FR1).casement_sash_qty).toBe(2)
    expect(v(BENCHMARK_FR2).casement_sash_qty).toBe(3)
    expect(runFR(BENCHMARK_FR1).manufacture_labour.total_minutes).toBe(790)
    expect(runFR(BENCHMARK_FR2).manufacture_labour.total_minutes).toBe(1290)
    // Labour: 480 + 90 per opener + 30 windowboard (the template nosing)
    expect(runFR(BENCHMARK_FR1).install_labour.total_minutes).toBe(690)
    expect(runFR(BENCHMARK_FR2).install_labour.total_minutes).toBe(780)
  })

  it('the right leaf is the master, as Integrate has it', () => {
    for (const bm of [BENCHMARK_FR1, BENCHMARK_FR2]) {
      const pair = openingNodes(bm.tree).find(n => n.part_type === 'frenchCasementPart')
      const [left, right] = pair.children
      expect(left.values.isMasterLeaf, 'left').toBe(false)
      expect(right.values.isMasterLeaf, 'right').toBe(true)
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Step AZ — French doors: FD1, FD2, FD3, FD3b
// ══════════════════════════════════════════════════════════════════════════════
// docs/integrate-L31115-french-doors.txt, read 13 Oct 2026.
//
// A door is priced differently from a window in one big way: there are NO
// timber volume lines. Integrate allocates lengths of five utile stock
// sections and prices them per metre through the live rule "Utile Section
// Part". Everything else — glass, ironmongery, components, production,
// labour, LTW — comes out of rules GlazePro already had, once the door
// variables exist.
//
// All four are SAVED drawings, which matters: a door recomputes its allocated
// parts on save, and that is what adds the four multipoint-lock parts. An
// unsaved FD1 priced 5,258.91; saved, 5,639.01.
describe('Step AZ — French door benchmarks', () => {
  const CASES = [
    ['FD1',  BENCHMARK_FD1,  INTEGRATE.benchmarkFD1_french_doors,                55.42, 14.50],
    ['FD2',  BENCHMARK_FD2,  INTEGRATE.benchmarkFD2_french_doors_resized,        55.42, 13.00],
    ['FD3',  BENCHMARK_FD3,  INTEGRATE.benchmarkFD3_french_doors_with_fanlight,  66.17, 14.50],
    ['FD3b', BENCHMARK_FD3b, INTEGRATE.benchmarkFD3b_french_doors_fanlight_rail_62, 66.17, 14.50],
  ]

  // The two charges GlazePro makes and Integrate does not (Nathan, 13 Oct —
  // deliberate difference 7). Both land in manufacture_materials and nowhere
  // else, which is what these tests pin down.
  const TRANSOM_SECTION = 1.256 * 13.60      // 17.08 — the transom, FD3 and FD3b
  const RAIL_62_SECTION = 1.254 * 8.60       // 10.78 — the 62 mm fanlight rail, FD3b
  const EXTRA = {
    FD1: 0,
    FD2: 0,
    FD3:  Math.round(TRANSOM_SECTION * 100) / 100,
    FD3b: Math.round(TRANSOM_SECTION * 100) / 100 + Math.round(RAIL_62_SECTION * 100) / 100,
  }

  function runFD(bm) {
    return runPricingOnTree(bm.tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: bm.partCostMap,
      ironmongeryLines: bm.ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
      profileCode: bm.profileCode,
    })
  }

  for (const [label, bm, target, production, labour] of CASES) {
    it(`${label}: production ${production} h and labour ${labour} h, exactly`, () => {
      const r = runFD(bm)
      expect(r.manufacture_labour.total_minutes / 60, label).toBeCloseTo(production, 2)
      expect(r.install_labour.total_minutes / 60, label).toBeCloseTo(labour, 2)
    })

    it(`${label}: every group matches Integrate${EXTRA[label] ? ', bar the charges Integrate does not make' : ', exactly'}`, () => {
      const r = runFD(bm)
      const got = {}
      for (const l of r.price.lines) {
        if (!l.fires || l.error) continue
        got[l.group_name] = (got[l.group_name] ?? 0) + l.line_cost
      }
      for (const [group, t] of Object.entries(target.groups)) {
        const expected = group === 'manufacture_materials' ? t.cost + EXTRA[label] : t.cost
        expect(got[group] ?? 0, `${label} ${group}`).toBeCloseTo(expected, 2)
      }
      expect(r.price.total_cost, `${label} total`).toBeCloseTo(target.total_cost + EXTRA[label], 2)
    })
  }

  it('FD1 and FD2 match Integrate on EVERY line, with nothing added', () => {
    // These two have no fanlight and no transom, so there is nothing for
    // GlazePro to charge that Integrate does not. They are exact.
    for (const [label, bm, target] of CASES.slice(0, 2)) {
      const r = runFD(bm)
      expect(r.price.total_cost, label).toBeCloseTo(target.total_cost, 2)
      expect(r.price.total, label).toBeCloseTo(target.total_price, 2)
    }
  })

  it('the two extra charges are exactly the transom and the 62 rail', () => {
    // FD3 is over by the transom alone; FD3b by the transom AND the rail.
    // Stated as the arithmetic, not as a number: 1.256 m of Utile67x96 at
    // 13.60, and 1.254 m of Utile63x63 at 8.60.
    expect(EXTRA.FD3).toBeCloseTo(17.08, 2)
    expect(EXTRA.FD3b - EXTRA.FD3).toBeCloseTo(10.78, 2)

    const sections = bm => allocatedSectionParts(bm.tree, { material: 'utile' })
    const byCode = bm => Object.fromEntries(sections(bm).map(s => [s.part_code, s.length_mm]))

    // FD3's 67x96 is Integrate's 6548 PLUS the 1256 transom
    expect(byCode(BENCHMARK_FD3).Utile67x96).toBe(6548 + 1256)
    // FD3b's 63x63 is Integrate's 2060 PLUS the 1254 rail, and its 63x96
    // has gone entirely, exactly as Integrate's did
    expect(byCode(BENCHMARK_FD3b).Utile63x63).toBe(2060 + 1254)
    expect(byCode(BENCHMARK_FD3b).Utile63x96).toBeUndefined()
    // FD3 keeps the 86 rail on 63x96, as Integrate charges it
    expect(byCode(BENCHMARK_FD3).Utile63x96).toBe(1254)
  })

  it('FD1 and FD2 allocate Integrate’s own section lengths, to the mm', () => {
    const byCode = bm => Object.fromEntries(
      allocatedSectionParts(bm.tree, { material: 'utile' }).map(s => [s.part_code, s.length_mm]))
    expect(byCode(BENCHMARK_FD1)).toEqual({
      Utile67x96: 6297, Utile63x200: 3724, Utile63x120: 10249,
    })
    expect(byCode(BENCHMARK_FD2)).toEqual({
      Utile67x96: 5797, Utile63x200: 3124, Utile63x120: 9549,
    })
  })

  it('a section is priced on its UNROUNDED metres', () => {
    // 6.297 m of Utile67x96 at 13.60 is 85.64, which is what Integrate
    // charges. Rounding the metres first (6.30) would give 85.68.
    const line = runFD(BENCHMARK_FD1).price.lines.find(
      l => l.fires && l.alloc_part_code === 'Utile67x96')
    expect(line).toBeTruthy()
    expect(line.quantity).toBeCloseTo(6.297, 4)
    expect(line.line_cost).toBeCloseTo(85.64, 2)
  })

  it('a door prices NO timber volume at all', () => {
    // Integrate shows no "Softwood Casement Frame & Sashes", no sash volume
    // and no cill volume on a utile door — even FD3, which HAS a casement
    // sash in it. The fanlight is why is_casement_window has to exclude a
    // door: without that, FD3 charged a frame and a cill it has not got.
    for (const [label, bm] of CASES) {
      const fired = runFD(bm).price.lines
        .filter(l => l.fires && !l.error && l.line_cost > 0).map(l => l.name)
      for (const name of ['Softwood Casement Frame & Sashes', 'Hardwood Casement Cill',
        'Softwood Casement Sashes', 'Door Stiles & Top Rail', 'Door Bottom Rail']) {
        expect(fired, `${label} / ${name}`).not.toContain(name)
      }
      // and the only manufacture_materials lines that PRICE are the
      // sections and LTW. Three more fire at 0.00 (Frame Plant On head and
      // jambs, Glazing Bar), which Integrate does not display either — it
      // hides every 0.00 line (Step AE item 3).
      const mm = runFD(bm).price.lines
        .filter(l => l.fires && !l.error && l.line_cost > 0 &&
          l.group_name === 'manufacture_materials')
        .map(l => l.name)
      expect([...new Set(mm)].sort(), label)
        .toEqual(['LTW General Consumables', 'Utile Section Part'])
    }
  })

  it('the leaves are the opening plus half the meeting-stile overlap', () => {
    // The thing that makes a door not a French casement: the leaves LAP, so
    // each is wider than half the opening. FD1 (1805 - 1 - 1 - 5 + 27) / 2.
    const sizes = bm => doorLeaves(bm.tree).map(l => {
      const z = doorLeafSize(bm.tree, l)
      return [z.width, z.height]
    })
    expect(sizes(BENCHMARK_FD1)).toEqual([[912.5, 2109], [912.5, 2109]])
    expect(sizes(BENCHMARK_FD2)).toEqual([[762.5, 2009], [762.5, 2009]])
    expect(sizes(BENCHMARK_FD3)).toEqual([[638, 2069], [638, 2069]])
  })

  it('the leaf weights put FD1 over 50 kg and the others under', () => {
    // "Any Door Overweight" is 45 install minutes a leaf over 50 kg, and is
    // the whole difference between FD1's 14.50 h and FD2's 13.00 h.
    const kg = bm => doorLeaves(bm.tree)
      .map(l => Math.round(doorLeafWeightKg(bm.tree, l, {}) * 10) / 10)
    expect(kg(BENCHMARK_FD1)).toEqual([54.2, 54.2])   // facts: 54
    expect(kg(BENCHMARK_FD2)).toEqual([44.8, 44.8])   // facts: 45
    expect(kg(BENCHMARK_FD3)).toEqual([40.1, 40.1])   // facts: 40
    expect(kg(BENCHMARK_FD1).every(w => w > 50)).toBe(true)
    expect(kg(BENCHMARK_FD2).every(w => w < 50)).toBe(true)
    expect(kg(BENCHMARK_FD3).every(w => w < 50)).toBe(true)
  })

  it('the door variables the minutes prove', () => {
    const v = bm => computeVariables(bm.tree, computeDerived(bm.tree), PF_VARIABLES,
      { profileCode: bm.profileCode })
    for (const [label, bm] of CASES) {
      const x = v(bm)
      expect(x.is_door, label).toBe(true)
      expect(x.is_french_door, label).toBe(true)
      expect(x.is_front_door, label).toBe(false)
      expect(x.door_leaf_qty, label).toBe(2)
      expect(x.new_door_leaf_qty, label).toBe(2)
      expect(x.new_french_door_pair_qty, label).toBe(1)
      expect(x.opening_out_door_leaf_qty, label).toBe(2)
      expect(x.opening_in_door_leaf_qty, label).toBe(0)
      expect(x.fixed_door_leaf_qty, label).toBe(0)
      expect(x.is_single_and_french_doors_range, label).toBe(true)
      expect(x.is_open_in_doors_range, label).toBe(false)
      // a door is NOT a casement window, even with a fanlight in it
      expect(x.is_casement_window, label).toBe(false)
    }
    // the fanlight drawings have one casement sash and one transom
    expect(v(BENCHMARK_FD3).casement_sash_qty).toBe(1)
    expect(v(BENCHMARK_FD3).frame_transom_qty).toBe(1)
    expect(v(BENCHMARK_FD1).casement_sash_qty).toBe(0)
  })

  it('the live template’s default ironmongery costs 59.85 more than Integrate’s stored list', () => {
    // Step AZ hotfix item 3, Nathan's decisions of 13 Oct, recorded as
    // deliberate differences 9 and 10 in docs/integrate-differences.md:
    //   * a new French door starts with the Hardwick Lyndon espag set
    //     (GlazePro's default RULE), not Integrate's template choice of the
    //     Windsor inline handle: +74.55 - 16.80;
    //   * a door gets BOTH trickle vents, as a casement does:       +2.10.
    // No rule was changed. This test exists so the figure cannot drift
    // unnoticed, the way differences 7 and 8 are pinned.
    const bare = JSON.parse(JSON.stringify(BENCHMARK_FD1.tree))
    for (const child of bare.children ?? []) {
      if (child.part_type === 'paintAndIronmongeryPart') delete child.values.ironmongeryLines
    }
    const ctx = {
      pfVariables: SNAPSHOT.pfVariables, ironmongeryRules: SNAPSHOT.ironmongeryRules,
      glassCatalogue: SNAPSHOT.glassCatalogue, ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
    }
    const defaults = resolveIronmongeryLines(bare, ctx, SNAPSHOT.profileValues,
      { profileCode: 'open_out_doors' })
    expect(defaults.map(l => l.product_short_name).sort()).toEqual([
      '102mm_hinges', 'double_euro_cylinder', 'hardwick_lyndon_door_espag_set',
      'trickle', 'trickle_vent_xr16',
    ])

    const priceWith = (tree, lines) => runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: BENCHMARK_FD1.partCostMap,
      ironmongeryLines: lines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
      profileCode: BENCHMARK_FD1.profileCode,
    })
    const installMaterials = r => r.price.lines
      .filter(l => l.fires && !l.error && l.group_name === 'installation_materials')
      .reduce((t, l) => t + l.line_cost, 0)

    const stored = priceWith(BENCHMARK_FD1.tree, BENCHMARK_FD1.ironmongeryLines)
    const live   = priceWith(bare, defaults)

    expect(installMaterials(stored)).toBeCloseTo(309.21, 2)   // Integrate's own
    expect(installMaterials(live)).toBeCloseTo(369.06, 2)
    expect(installMaterials(live) - installMaterials(stored)).toBeCloseTo(59.85, 2)

    // The whole of the difference is in that group, and these are the
    // figures the reviewer re-prices live drawing 25 against.
    expect(live.price.total_cost).toBeCloseTo(2879.38, 2)
    expect(live.price.total).toBeCloseTo(5758.71, 2)
    const mm = live.price.lines
      .filter(l => l.fires && !l.error && l.group_name === 'manufacture_materials')
      .reduce((t, l) => t + l.line_cost, 0)
    expect(mm, 'the timber is unaffected by the ironmongery list').toBeCloseTo(395.95, 2)
  })

  it('the four multipoint-lock parts are allocated, and priced as ironmongery', () => {
    // Integrate adds them on SAVE and prices each as whole pounds x 1.05,
    // which is the Ironmongery Cost rule — not a component line.
    //
    // EACH CODE IS CHECKED AGAINST ITS OWN LINE, by name and to the penny
    // (docs/integrate-L31115-french-doors.txt). The first reading of this
    // fixture had the right four amounts on the wrong three codes — derived
    // backwards from the lines, because the codes were not in the snapshot —
    // and the TOTAL was right either way, so the total alone cannot hold it.
    const INTEGRATE_LOCK_LINES = {
      RJZ2382: [53.55, 'Winkhaus Thunderbolt Master Multipoint Lock'],
      RHZ1648: [93.45, 'Winkhaus Flushbolt LH'],
      RHZ1653: [36.75, 'Winkhaus FAB Shootbolt 399'],
      RHZ1667: [6.30,  'Adj Single Shootbolt Keep'],
    }
    const CODES = Object.keys(INTEGRATE_LOCK_LINES)
    for (const [label, bm] of CASES) {
      const lines = runFD(bm).price.lines.filter(
        l => l.fires && CODES.includes(l.alloc_iron_part_code))
      expect(lines.map(l => l.alloc_iron_part_code).sort(), label)
        .toEqual([...CODES].sort())
      for (const line of lines) {
        const [cost, name] = INTEGRATE_LOCK_LINES[line.alloc_iron_part_code]
        expect(line.line_cost, `${label} ${line.alloc_iron_part_code} (${name})`)
          .toBeCloseTo(cost, 2)
      }
      // 51 + 89 + 35 + 6 = 181, x 1.05 = 190.05
      expect(lines.reduce((t, l) => t + l.line_cost, 0), label).toBeCloseTo(190.05, 2)
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Step BA — French door variants: FD4 panels, FD5 / FD6 doorsets
// ══════════════════════════════════════════════════════════════════════════════
// docs/integrate-L31115-french-doors.txt, "French door variants", read 13 Oct.
//
// FD4 puts a MID RAIL in each leaf, with glass above and a raised-and-fielded
// Tricoya panel below. FD5 and FD6 are doorsets: two full-height mullions and
// a full-width transom, the pair in the middle bottom opening, a fixed
// casement sash each side, and a top row of either three direct glazed units
// (FD5) or three fixed casement sashes (FD6).
//
// No new pricing rule: every figure comes out of rules GlazePro already had.
describe('Step BA — French door variant benchmarks', () => {
  const CASES = [
    // Step BF: FD4’s two panels are FLAT (type 110), so they cost 60 each
    // and not 120 — its production is 120 minutes under Integrate’s 59.42 h.
    ['FD4', BENCHMARK_FD4, INTEGRATE.benchmarkFD4_french_doors_with_panels,                 57.42, 13.00],
    ['FD5', BENCHMARK_FD5, INTEGRATE.benchmarkFD5_french_doorset_sidelights_toplights,      99.58, 24.25],
    ['FD6', BENCHMARK_FD6, INTEGRATE.benchmarkFD6_french_doorset_casement_lights,          116.33, 24.50],
  ]

  // The mullions and transom GlazePro charges and Integrate does not
  // (difference 11): 2 x 2626 + 2720 = 7972 mm of Utile67x96 at 13.60.
  const DOORSET_SECTIONS = Math.round((7972 / 1000) * 13.60 * 100) / 100   // 108.42
  // Step BF: FD4 is 120 production minutes (49.32) CHEAPER than Integrate,
  // declared on the fixture while the reviewer reads its panel-type ids.
  const EXTRA = {
    FD4: BENCHMARK_FD4.pendingDecision?.cost ?? 0,
    FD5: DOORSET_SECTIONS,
    FD6: DOORSET_SECTIONS,
  }

  function runFD(bm) {
    return runPricingOnTree(bm.tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: bm.partCostMap,
      ironmongeryLines: bm.ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
      profileCode: bm.profileCode,
    })
  }

  for (const [label, bm, target, production, labour] of CASES) {
    it(`${label}: production ${production} h and labour ${labour} h, exactly`, () => {
      const r = runFD(bm)
      expect(r.manufacture_labour.total_minutes / 60, label).toBeCloseTo(production, 2)
      expect(r.install_labour.total_minutes / 60, label).toBeCloseTo(labour, 2)
    })

    it(`${label}: every group matches Integrate${EXTRA[label] ? ', bar what is declared' : ', exactly'}`, () => {
      const r = runFD(bm)
      const got = {}
      for (const l of r.price.lines) {
        if (!l.fires || l.error) continue
        got[l.group_name] = (got[l.group_name] ?? 0) + l.line_cost
      }
      for (const [group, t] of Object.entries(target.groups)) {
        // Step BF: FD4's difference is in MANUFACTURE (production minutes,
        // its two FLAT panels at 60 where GlazePro charged R&F 120); the two
        // doorsets' is in manufacture_materials (the mullions and transom).
        const declaredIn = label === 'FD4' ? 'manufacture' : 'manufacture_materials'
        const expected = group === declaredIn ? t.cost + EXTRA[label] : t.cost
        expect(got[group] ?? 0, `${label} ${group}`).toBeCloseTo(expected, 2)
      }
      expect(r.price.total_cost, `${label} total`).toBeCloseTo(target.total_cost + EXTRA[label], 2)
    })
  }

  // Step BF: FD4 no longer matches, and nothing has been tuned to keep it.
  // Its panels read Integrate’s type 110, which is FLAT, so they price 60
  // each where they priced R&F 120 — and FD4 was penny-exact BEFORE, which
  // it could only have been if Integrate charged the 240 itself. The fixture
  // declares the -49.32 and the reviewer is to read FD4’s panel ids; see the
  // comment on BENCHMARK_FD4.
  it('FD4 matches Integrate on every line but its panel minutes', () => {
    const r = runFD(BENCHMARK_FD4)
    const t = INTEGRATE.benchmarkFD4_french_doors_with_panels
    const declared = BENCHMARK_FD4.pendingDecision.cost
    expect(r.price.total_cost).toBeCloseTo(t.total_cost + declared, 2)
    expect(r.price.total).toBeCloseTo(t.total_price + declared * 2, 2)
  })

  // ── FD4: the leaf mid rail, the glass above it and the panel below ────────

  it('FD4: each leaf is split by its mid rail, glass above and panel below', () => {
    const leaves = doorLeaves(BENCHMARK_FD4.tree)
    expect(leaves.length).toBe(2)
    for (const leaf of leaves) {
      expect(doorLeafSize(BENCHMARK_FD4.tree, leaf)).toEqual({ width: 662.5, height: 2109 })
      // The GLASS stops at the mid rail: 2109 - 110 head - 170 rail - 425
      // panel - 163 bottom rail = 1241, which is Integrate's own offset.
      expect(doorGlassSightline(BENCHMARK_FD4.tree, leaf)).toEqual({ width: 442.5, height: 1241 })
      // and the panel is the rest of the leaf below the rail
      expect(doorPanelSize(BENCHMARK_FD4.tree, leaf)).toEqual({ width: 442.5, height: 425 })
    }
  })

  it('FD4: the glass is 0.59 m2 a leaf, not the full-height 0.87', () => {
    // Without the mid rail the glass ran the whole leaf and priced 107.72
    // instead of 73.06 — a third more glass than the door has.
    const r = runFD(BENCHMARK_FD4)
    const glass = r.price.lines
      .filter(l => l.fires && !l.error && l.group_name === 'glass_done')
      .reduce((t, l) => t + l.line_cost, 0)
    expect(glass).toBeCloseTo(73.06, 2)
  })

  it('FD4: a leaf mid rail is NOT a frame transom', () => {
    // It is a transomPart, but inside the LEAF. Counted as a frame divider it
    // charged "Additional for Frame Mullion or Transom" 180 x 2 and
    // "Door Frame - Single Finish (Mullions)" 85 x 2 — 530 minutes of frame
    // work on a frame with no dividers at all.
    const v = computeVariables(BENCHMARK_FD4.tree, computeDerived(BENCHMARK_FD4.tree),
      PF_VARIABLES, { profileCode: 'open_out_doors' })
    expect(v.frame_transom_qty).toBe(0)
    expect(v.frame_mullion_qty).toBe(0)
    expect(v.leaf_mid_rail_qty).toBe(2)
    // and the panels ARE counted, which is what the panel rules loop on
    expect(v.panel_qty).toBe(2)
    // in the LEAF, not in the frame — "Panel to Frame" (80 min) must not fire
    expect(v.panel_in_frame_qty).toBe(0)
  })

  it('FD4: the two panel rules fire, and only those two', () => {
    const r = runFD(BENCHMARK_FD4)
    const panelLines = [...r.price.lines, ...r.manufacture_labour.lines]
      .filter(l => l.fires && !l.error && l.loop_target === 'panel')
      .map(l => l.name)
    expect([...new Set(panelLines)].sort()).toEqual(['Additional for Flat Panel', 'Tricoya Panel'])
    // Tricoya Panel is the panel's VISIBLE area, unrounded: 442.5 x 425 =
    // 0.1880625 m2 x 188.85 = 35.52 a panel.
    const tricoya = r.price.lines.filter(l => l.fires && l.name === 'Tricoya Panel')
    expect(tricoya.length).toBe(2)
    expect(tricoya[0].quantity).toBeCloseTo(0.1880625, 6)
    expect(tricoya[0].line_cost).toBeCloseTo(35.52, 2)
    // and 120 minutes a panel of R&F work, which is all FD4 adds to FD1's
    // production
    // Step BF: 60 a panel, not 120 — type 110 is FLAT.
    const rf = r.manufacture_labour.lines.filter(l => l.fires && l.name === 'Additional for Flat Panel')
    expect(rf.length).toBe(2)
    expect(rf.reduce((t, l) => t + l.minutes, 0)).toBe(120)
  })

  it('FD4: the mid rails are cut from Utile63x200 at leaf width − 10', () => {
    const byCode = Object.fromEntries(
      allocatedSectionParts(BENCHMARK_FD4.tree, { material: 'utile' })
        .map(s => [s.part_code, s.length_mm]))
    // cill 1399 + bottom rails 2 x 662.5 + MID RAILS 2 x 652.5 = 4029
    expect(byCode.Utile63x200).toBe(4029)
    expect(byCode.Utile63x120).toBe(9749)
    expect(byCode.Utile67x96).toBe(5797)
  })

  // ── FD5 / FD6: the doorset frame ──────────────────────────────────────────

  it('FD5 / FD6: three columns and two rows, the pair in the middle bottom cell', () => {
    for (const bm of [BENCHMARK_FD5, BENCHMARK_FD6]) {
      expect(frameColumns(bm.tree).map(c => c.width)).toEqual([648, 1339, 651])
      expect(frameRows(bm.tree).map(r => r.width)).toEqual([448, 2137])
      const pair = openingNodes(bm.tree).find(n => n.part_type === 'frenchDoorPart')
      expect(pair, 'the pair is an opening').toBeTruthy()
      // the pair's leaves lap in the 1339 opening: (1339 - 1 - 1 - 5 + 27) / 2
      expect(doorLeaves(bm.tree).map(l => doorLeafSize(bm.tree, l)))
        .toEqual([{ width: 679.5, height: 2131 }, { width: 679.5, height: 2131 }])
    }
  })

  it('FD5: a sash beside the door is a SIDE LIGHT, one above the transom a FANLIGHT', () => {
    // 780 minutes against 300, decided per sash by is_fanlight — and the
    // whole of why FD6's production is 16.75 h more than FD5's.
    const sidelights = l => l.fires && !l.error && l.name === 'Sidelights in Doorsets'
    const fanlights  = l => l.fires && !l.error && l.name === 'Fanlights in Doorsets'
    const fd5 = runFD(BENCHMARK_FD5).manufacture_labour.lines
    expect(fd5.filter(sidelights).length, 'FD5 side lights').toBe(2)
    expect(fd5.filter(fanlights).length, 'FD5 has no casement fanlight').toBe(0)

    const fd6 = runFD(BENCHMARK_FD6).manufacture_labour.lines
    expect(fd6.filter(sidelights).length, 'FD6 side lights').toBe(2)
    expect(fd6.filter(fanlights).length, 'FD6 top row').toBe(3)
    expect(fd6.filter(fanlights).reduce((t, l) => t + l.minutes, 0)).toBe(900)
  })

  it('FD5: the three direct glazed units price, the smallest at the minimum', () => {
    const v = computeVariables(BENCHMARK_FD5.tree, computeDerived(BENCHMARK_FD5.tree),
      PF_VARIABLES, { profileCode: 'open_out_doors' })
    expect(v.direct_glazed_unit_qty).toBe(3)
    expect(v.is_door).toBe(true)
    expect(v.is_casement_window, 'a doorset is not a casement window').toBe(false)
  })

  it('FD5 / FD6 allocate Integrate’s own section lengths, plus the mullions', () => {
    const byCode = bm => Object.fromEntries(
      allocatedSectionParts(bm.tree, { material: 'utile' }).map(s => [s.part_code, s.length_mm]))
    const fd5 = byCode(BENCHMARK_FD5)
    // Integrate's 8234 (W + 2H) PLUS the transom 2720 and both mullions
    // 2 x 2626 — the deliberate difference
    expect(fd5.Utile67x96).toBe(8234 + 2720 + 2 * 2626)
    expect(fd5.Utile63x200).toBe(4173)
    expect(fd5.Utile63x120).toBe(9871)
    expect(fd5.Utile63x63).toBe(9859)     // the two side lights
    expect(fd5.Utile63x96).toBe(1295)     // their 86 bottom rails

    const fd6 = byCode(BENCHMARK_FD6)
    expect(fd6.Utile67x96).toBe(8234 + 2720 + 2 * 2626)
    expect(fd6.Utile63x63).toBe(15203)    // + the three fanlights
    expect(fd6.Utile63x96).toBe(3927)     // + their 86 rails
  })

  it('the mullion and transom charge is exactly 108.42, and only in manufacture_materials', () => {
    for (const [label, bm] of [['FD5', BENCHMARK_FD5], ['FD6', BENCHMARK_FD6]]) {
      const r = runFD(bm)
      const target = label === 'FD5'
        ? INTEGRATE.benchmarkFD5_french_doorset_sidelights_toplights
        : INTEGRATE.benchmarkFD6_french_doorset_casement_lights
      const mm = r.price.lines
        .filter(l => l.fires && !l.error && l.group_name === 'manufacture_materials')
        .reduce((t, l) => t + l.line_cost, 0)
      expect(mm - target.groups.manufacture_materials.cost, label).toBeCloseTo(108.42, 2)
      expect(bm.deliberateDifference.cost, `${label} declares it`).toBeCloseTo(108.42, 2)
    }
  })

  it('a doorset prices NO timber volume, as every door does', () => {
    for (const [label, bm] of [['FD4', BENCHMARK_FD4], ['FD5', BENCHMARK_FD5], ['FD6', BENCHMARK_FD6]]) {
      const names = runFD(bm).price.lines
        .filter(l => l.fires && !l.error && l.line_cost > 0 &&
          l.group_name === 'manufacture_materials')
        .map(l => l.name)
      expect([...new Set(names)].sort(), label)
        .toEqual(label === 'FD4'
          ? ['LTW General Consumables', 'Tricoya Panel', 'Utile Section Part']
          : ['LTW General Consumables', 'Utile Section Part'])
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Step BB — single garden doors: SD1-SD4, and FD7's glazed side panels
// ══════════════════════════════════════════════════════════════════════════════
// docs/integrate-L31115-single-doors.txt, read 13 Oct 2026.
//
// Integrate stores a single door as a plain `doorLeafPart` DIRECTLY in a frame
// opening — no pair part, which is the whole difference from a French door —
// with its OWN clearances (2 / 3 / 3 / 3 against the pair's 3 / 1 / 1 / 3).
//
// No new pricing rule: every figure comes out of rules GlazePro already had.
describe('Step BB — single garden door benchmarks', () => {
  const CASES = [
    ['SD1', BENCHMARK_SD1, INTEGRATE.benchmarkSD1_single_door,                      36.33, 11.75,  0],
    ['SD2', BENCHMARK_SD2, INTEGRATE.benchmarkSD2_single_door_with_fanlight,         47.08, 13.75, 13.67],
    ['SD3', BENCHMARK_SD3, INTEGRATE.benchmarkSD3_single_door_with_sidelight,        55.08, 14.50, 28.76],
    ['SD4', BENCHMARK_SD4, INTEGRATE.benchmarkSD4_single_doorset_sidelights_fanlights, 97.25, 23.25, 97.72],
    // FD7 carries a PARKED residual as well as its decided difference
    ['FD7', BENCHMARK_FD7, INTEGRATE.benchmarkFD7_french_doorset_dgu_sidelights,     66.17, 16.83, 57.53 + 0.62],
  ]

  function runSD(bm) {
    return runPricingOnTree(bm.tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: bm.partCostMap,
      ironmongeryLines: bm.ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
      profileCode: bm.profileCode,
    })
  }

  for (const [label, bm, target, production, labour, extra] of CASES) {
    it(`${label}: production ${production} h and labour ${labour} h, exactly`, () => {
      const r = runSD(bm)
      expect(r.manufacture_labour.total_minutes / 60, label).toBeCloseTo(production, 2)
      expect(r.install_labour.total_minutes / 60, label).toBeCloseTo(labour, 2)
    })

    it(`${label}: every group matches Integrate${extra ? ', bar the transom and mullions' : ', exactly'}`, () => {
      const r = runSD(bm)
      const got = {}
      for (const l of r.price.lines) {
        if (!l.fires || l.error) continue
        got[l.group_name] = (got[l.group_name] ?? 0) + l.line_cost
      }
      for (const [group, t] of Object.entries(target.groups)) {
        // FD7's 0.62 is in the GLASS group, not manufacture_materials
        const allowance = label === 'FD7'
          ? (group === 'manufacture_materials' ? 57.53 : group === 'glass_done' ? 0.62 : 0)
          : (group === 'manufacture_materials' ? extra : 0)
        expect(got[group] ?? 0, `${label} ${group}`).toBeCloseTo(t.cost + allowance, 2)
      }
      expect(r.price.total_cost, `${label} total`).toBeCloseTo(target.total_cost + extra, 2)
    })
  }

  it('SD1 matches Integrate on EVERY line — a single door needs nothing new', () => {
    const r = runSD(BENCHMARK_SD1)
    const t = INTEGRATE.benchmarkSD1_single_door
    expect(r.price.total_cost).toBeCloseTo(t.total_cost, 2)
    expect(r.price.total).toBeCloseTo(t.total_price, 2)
  })

  it('a single door leaf is its opening less its OWN clearances', () => {
    // 2 / 3 / 3 / 3, not the French pair's 3 / 1 / 1 / 3, and no overlap:
    // 1005 - 3 - 3 = 999 by 2115 - 2 - 3 = 2110. doorLeafSize already did
    // this for a leaf with no pair; what was missing was the leaf being an
    // OPENING at all, so it had no cell and therefore no size.
    const leaves = doorLeaves(BENCHMARK_SD1.tree)
    expect(leaves.length).toBe(1)
    expect(leaves[0].part_type).toBe('doorLeafPart')
    expect(doorLeafSize(BENCHMARK_SD1.tree, leaves[0])).toEqual({ width: 999, height: 2110 })
    expect(doorGlassSightline(BENCHMARK_SD1.tree, leaves[0])).toEqual({ width: 779, height: 1837 })
  })

  it('a single door takes "Single Door Only" and never "French Doors"', () => {
    for (const [label, bm] of [['SD1', BENCHMARK_SD1], ['SD4', BENCHMARK_SD4]]) {
      const fired = runSD(bm).install_labour.lines.filter(l => l.fires && !l.error)
      const names = fired.map(l => l.name)
      expect(names, label).toContain('Single Door Only')
      expect(names, label).not.toContain('French Doors')
      expect(fired.find(l => l.name === 'Single Door Only').minutes, label).toBe(660)
    }
    // and the other way round on a French pair
    const fd = runSD(BENCHMARK_FD7).install_labour.lines.filter(l => l.fires && !l.error).map(l => l.name)
    expect(fd).toContain('French Doors')
    expect(fd).not.toContain('Single Door Only')
  })

  it('every fixed casement sash in a door frame takes Fixed Fanlight 120', () => {
    // Integrate's rule counts them all — a SIDE light as much as a fanlight
    // (SD3's 870 minutes and SD4's 1395 only add up that way).
    const inst = bm => {
      const o = {}
      for (const l of runSD(bm).install_labour.lines) {
        if (!l.fires || l.error) continue
        o[l.name] = (o[l.name] ?? 0) + l.minutes
      }
      return o
    }
    expect(inst(BENCHMARK_SD2)['Fixed Fanlight']).toBe(120)       // one fanlight
    expect(inst(BENCHMARK_SD3)['Fixed Fanlight']).toBe(120)       // one SIDE light
    expect(inst(BENCHMARK_SD4)['Fixed Fanlight']).toBe(600)       // three + two
    // and the side lights over 25 kg take Any Sash Overweight as well
    expect(inst(BENCHMARK_SD3)['Any Sash Overweight (Casement)']).toBe(45)
    expect(inst(BENCHMARK_SD4)['Any Sash Overweight (Casement)']).toBe(90)
    // the door leaf itself is over 50 kg on all four
    for (const [label, bm] of [['SD1', BENCHMARK_SD1], ['SD2', BENCHMARK_SD2],
      ['SD3', BENCHMARK_SD3], ['SD4', BENCHMARK_SD4]]) {
      expect(inst(bm)['Any Door Overweight'], label).toBe(45)
    }
  })

  it('a single door allocates the Thunderbolt and NOTHING else', () => {
    // Allocator 2020 "MPLS non-front non-french". The French-pair parts
    // (flush bolt, shootbolt, keeps) must not appear: they are rules 2010 /
    // 2030 / 2060 / 2090, all gated on a French leaf.
    // The four lock parts BY CODE, not every allocated part: RHZ665 is the
    // XR16 vent's own kit part and belongs to the stored ironmongery list.
    const LOCK_CODES = ['RJZ2382', 'RHZ1648', 'RHZ1653', 'RHZ1667']
    const codes = bm => runSD(bm).price.lines
      .filter(l => l.fires && !l.error && l.alloc_iron_part_code)
      .map(l => l.alloc_iron_part_code)
    for (const [label, bm] of [['SD1', BENCHMARK_SD1], ['SD4', BENCHMARK_SD4]]) {
      expect(codes(bm).filter(c => LOCK_CODES.includes(c)), label).toEqual(['RJZ2382'])
    }
    // FD7 is a French pair and takes all four
    expect(codes(BENCHMARK_FD7).filter(c => LOCK_CODES.includes(c)).sort())
      .toEqual(['RHZ1648', 'RHZ1653', 'RHZ1667', 'RJZ2382'])
  })

  it('SD1-SD4 allocate Integrate’s own section lengths, to the mm', () => {
    const byCode = bm => Object.fromEntries(
      allocatedSectionParts(bm.tree, { material: 'utile' }).map(s => [s.part_code, s.length_mm]))

    expect(byCode(BENCHMARK_SD1)).toEqual({
      Utile67x96: 5497, Utile63x200: 2098, Utile63x120: 5213,
    })
    const sd2 = byCode(BENCHMARK_SD2)
    expect(sd2.Utile63x120).toBe(5133)
    expect(sd2.Utile63x200).toBe(2098)
    expect(sd2.Utile63x63).toBe(1809)
    expect(sd2.Utile63x96).toBe(1003)
    expect(sd2.Utile67x96).toBe(6297 + 1005)      // Integrate's + the transom
    const sd3 = byCode(BENCHMARK_SD3)
    expect(sd3.Utile63x120).toBe(5213)
    expect(sd3.Utile63x200).toBe(2698)
    expect(sd3.Utile63x63).toBe(4795)
    expect(sd3.Utile67x96).toBe(6097 + 2115)      // + the mullion
    const sd4 = byCode(BENCHMARK_SD4)
    expect(sd4.Utile63x120).toBe(5133)
    expect(sd4.Utile63x200).toBe(3248)
    expect(sd4.Utile63x63).toBe(13865)
    expect(sd4.Utile63x96).toBe(3131)
    expect(sd4.Utile67x96).toBe(7447 + 2155 + 2 * 2515)   // + transom + mullions
    expect(byCode(BENCHMARK_FD7).Utile63x120).toBe(9849)
    expect(byCode(BENCHMARK_FD7).Utile63x200).toBe(4245)
    expect(byCode(BENCHMARK_FD7).Utile67x96).toBe(7218 + 2 * 2115)
  })

  it('the labels are Integrate’s, and a pair pushes the next column to D', () => {
    const labels = bm => openingNodes(bm.tree).map(n => openingLabel(bm.tree, n))
    expect(labels(BENCHMARK_SD1)).toEqual(['Single Door A1'])
    expect(labels(BENCHMARK_SD2)).toEqual(['Fanlight A1', 'Single Door A2'])
    expect(labels(BENCHMARK_SD3)).toEqual(['Single Door A1', 'Casement Sash B1'])
    expect(labels(BENCHMARK_SD4)).toEqual([
      'Fanlight A1', 'Fanlight B1', 'Fanlight C1',
      'Casement Sash A2', 'Single Door B2', 'Casement Sash C2',
    ])
    // FD7's pair holds B and C, so its right-hand panel is D1 — not C1,
    // which Step BA gave it and which collided with the right leaf.
    expect(labels(BENCHMARK_FD7)).toEqual([
      'Direct Glazed Unit A1', 'French Door B1', 'Direct Glazed Unit D1',
    ])
  })

  it('FD7’s 0.62 is PARKED, not decided, and the two are declared apart', () => {
    // The one figure in this step nobody has explained: Integrate prices
    // A1's hidden-0 direct glazed unit on 1.22 m2 where 588 x 2085 is
    // 1.22598 — and rounds its own D1 UP, 1.29704 to 1.30, in the same
    // drawing. Under GBP 1.00 with a named cause, so parked.
    expect(BENCHMARK_FD7.deliberateDifference.cost).toBeCloseTo(57.53, 2)
    expect(BENCHMARK_FD7.parkedResidual.cost).toBeCloseTo(0.62, 2)
    const r = runSD(BENCHMARK_FD7)
    const glass = r.price.lines
      .filter(l => l.fires && !l.error && l.group_name === 'glass_done')
      .reduce((t, l) => t + l.line_cost, 0)
    expect(glass - INTEGRATE.benchmarkFD7_french_doorset_dgu_sidelights.groups.glass_done.cost)
      .toBeCloseTo(0.62, 2)
  })

  it('a single door prices NO timber volume, as every door does', () => {
    for (const [label, bm] of [['SD1', BENCHMARK_SD1], ['SD4', BENCHMARK_SD4]]) {
      const names = runSD(bm).price.lines
        .filter(l => l.fires && !l.error && l.line_cost > 0 &&
          l.group_name === 'manufacture_materials')
        .map(l => l.name)
      expect([...new Set(names)].sort(), label)
        .toEqual(['LTW General Consumables', 'Utile Section Part'])
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Step BC — single doors with FLAG frames: CD1-CD4, several frames in one item
// ══════════════════════════════════════════════════════════════════════════════
// docs/integrate-L31115-single-doors.txt, "Coupled multi-frame doorsets".
//
// Integrate stores these as ONE item holding a containerPart with separate
// assemblyFrameParts side by side, coupled at partSpacing -47 and
// head-aligned. Everything that used to ask "the frame" a question had to
// learn to ask THAT frame.
//
// No new pricing rule: GlazePro's own rule 140 is REWRITTEN by
// sql/step-bc1 (Nathan's decision c), which the reviewer runs.
describe('Step BC — coupled flag-frame benchmarks', () => {
  // production = Integrate + decision d (180 min a flag frame)
  // labour     = Integrate + decision c (240 min a flag frame), LIVE since
  //              sql/step-bc1 and in the captured snapshot since the
  //              reviewer refreshed it
  //        fitting is the decision-c amount, for the splits below
  const CASES = [
    ['CD1', BENCHMARK_CD1, INTEGRATE.benchmarkCD1_single_door_two_flag_frames,     77.00, 23.75, 321.68],
    ['CD2', BENCHMARK_CD2, INTEGRATE.benchmarkCD2_single_door_flag_right,          56.67, 17.75, 160.84],
    ['CD3', BENCHMARK_CD3, INTEGRATE.benchmarkCD3_single_door_flag_left,           56.67, 17.75, 160.84],
    ['CD4', BENCHMARK_CD4, INTEGRATE.benchmarkCD4_single_door_flag_and_fan_lights, 109.25, 28.75, 321.68],
  ]

  function runCD(bm) {
    return runPricingOnTree(bm.tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: bm.partCostMap,
      ironmongeryLines: bm.ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: SNAPSHOT.profileValues,
      profileCode: bm.profileCode,
    })
  }
  const groupCost = (r, group) => r.price.lines
    .filter(l => l.fires && !l.error && l.group_name === group)
    .reduce((t, l) => t + l.line_cost, 0)

  for (const [label, bm, target, production, labour, fitting] of CASES) {
    it(`${label}: production ${production} h and labour ${labour} h`, () => {
      const r = runCD(bm)
      // Production is Integrate's PLUS decision d (+180 min a flag frame).
      expect(r.manufacture_labour.total_minutes / 60, label).toBeCloseTo(production, 2)
      // Labour is Integrate's PLUS decision c (+240 min a flag frame), which
      // is live rule 140 since sql/step-bc1 and is in the snapshot since the
      // reviewer refreshed it. The four hours a flag frame are the whole
      // difference from Integrate's own labour.
      expect(r.install_labour.total_minutes / 60, label).toBeCloseTo(labour, 2)
      const flags = label === 'CD2' || label === 'CD3' ? 1 : 2
      expect(labour - target.hours.labour, `${label} is Integrate + 4 h a flag`)
        .toBeCloseTo(flags * 4, 2)
    })

    it(`${label}: every group matches Integrate plus the decided differences`, () => {
      const r = runCD(bm)
      const got = {}
      for (const l of r.price.lines) {
        if (!l.fires || l.error) continue
        got[l.group_name] = (got[l.group_name] ?? 0) + l.line_cost
      }
      // GLASS is Integrate's exactly; the four decisions land in
      // manufacture_materials (a), installation_materials (b), labour (c)
      // and manufacture (d) — one group each, which is what makes them
      // checkable line by line.
      expect(got.glass_done ?? 0, `${label} glass`).toBeCloseTo(target.groups.glass_done.cost, 2)
      expect(got.labour ?? 0, `${label} labour`)
        .toBeCloseTo(target.groups.labour.cost + fitting, 2)
      expect(r.price.total_cost, `${label} total`)
        .toBeCloseTo(target.total_cost + bm.deliberateDifference.cost, 2)
    })
  }

  it('the decided differences are exactly Nathan’s four decisions, line by line', () => {
    // The facts' own table (docs/integrate-L31115-single-doors.txt):
    //        timber 67x96 | cill 63x200 | architrave | production
    //   CD1     +61.82    |   +40.19    |   +19.38   |  +147.96
    //   CD2     +30.90    |   +20.10    |   +17.67   |   +73.98
    //   CD3     +30.90    |   +20.18    |   +17.67   |   +73.98
    //   CD4    +117.34    |   +37.70    |   +21.66   |  +147.96
    const SPLIT = {
      CD1: { materials: 102.01, architrave: 19.38, production: 147.96 },
      CD2: { materials: 51.00,  architrave: 17.67, production: 73.98 },
      CD3: { materials: 51.08,  architrave: 17.67, production: 73.98 },
      CD4: { materials: 155.04, architrave: 21.66, production: 147.96 },
    }
    for (const [label, bm, target, , , fitting] of CASES) {
      const r = runCD(bm)
      const s = SPLIT[label]
      // (a) every frame's own timber and cill
      expect(groupCost(r, 'manufacture_materials') - target.groups.manufacture_materials.cost,
        `${label} timber + cill`).toBeCloseTo(s.materials, 2)
      // (b) ONE architrave round the whole set
      expect(groupCost(r, 'installation_materials') - target.groups.installation_materials.cost,
        `${label} architrave`).toBeCloseTo(s.architrave, 2)
      // (d) +180 min of workshop a flag frame
      expect(groupCost(r, 'manufacture') - target.groups.manufacture.cost,
        `${label} workshop`).toBeCloseTo(s.production, 2)
      // (c) +4 h of fitting a flag frame, in the labour group
      expect(groupCost(r, 'labour') - target.groups.labour.cost,
        `${label} fitting`).toBeCloseTo(fitting, 2)
      // and the four add up to what the fixture declares
      expect(s.materials + s.architrave + s.production + fitting, `${label} declared`)
        .toBeCloseTo(bm.deliberateDifference.cost, 2)
    }
  })

  it('decision c has LANDED: rule 140 is the flag-frame fitting charge', () => {
    // sql/step-bc1 rewrote rule 140 from a 1-minute placeholder to 240
    // minutes per EXTRA frame, and the reviewer ran it and refreshed the
    // snapshot. The test still reads the rule rather than assuming it, so
    // that reverting the data fails here and says so rather than moving a
    // benchmark quietly.
    const rule = SNAPSHOT.rules.find(r => r.sort_order === 140 &&
      r.rule_family === 'install_labour')
    expect(rule, 'rule 140 is in the snapshot').toBeTruthy()
    expect(rule.name, 'rewritten by sql/step-bc1').toBe('Single Door (Flag Frame)')
    expect(rule.value).toBe('240')
    expect(rule.quantity).toBe('new_frame_qty - 1')
    expect(rule.condition).toContain('door_leaf_qty == 1')
    // and it is the ONLY source of the labour difference
    for (const [label, bm, target, , , fitting] of CASES) {
      const fired = runCD(bm).install_labour.lines
        .filter(l => l.fires && !l.error && l.name === 'Single Door (Flag Frame)')
      expect(fired.length, `${label} fires once`).toBe(1)
      const flags = label === 'CD2' || label === 'CD3' ? 1 : 2
      expect(fired[0].minutes, `${label} 240 a flag frame`).toBe(flags * 240)
      expect(runCD(bm).price.total_cost, `${label} total`)
        .toBeCloseTo(target.total_cost + bm.deliberateDifference.cost, 2)
      expect(bm.pendingDecision, `${label} no longer pending`).toBeUndefined()
      expect(fitting, `${label} fitting amount`).toBeGreaterThan(0)
    }
  })

  // ── what each frame sees ──────────────────────────────────────────────────

  it('a frame-loop rule sees THAT frame’s own counts', () => {
    // The whole of this step's pricing risk. CD1 has three frames and one
    // door: the door frame is machined as a door frame (855, ONCE), the two
    // flags as casement frames (180 each — decision d), and LTW is charged
    // once per frame because its condition is per frame.
    const mfg = {}
    for (const l of runCD(BENCHMARK_CD1).manufacture_labour.lines) {
      if (!l.fires || l.error) continue
      mfg[l.name] = (mfg[l.name] ?? 0) + l.minutes
    }
    expect(mfg['Machining & Joining a Door Frame'], 'the DOOR frame, once').toBe(855)
    expect(mfg['Machining & Joining a Casement Frame'], 'each FLAG frame').toBe(360)
    expect(mfg['Door Frame - Single Finish'], 'item-level, qty frame_qty').toBe(540)
    expect(mfg['Sidelights in Doorsets'], 'the two flag lights').toBe(1560)

    const ltw = runCD(BENCHMARK_CD1).price.lines
      .filter(l => l.fires && !l.error && l.name === 'LTW General Consumables')
    expect(ltw.length, 'one LTW line per frame').toBe(3)
    expect(ltw.reduce((t, l) => t + l.line_cost, 0)).toBeCloseTo(75, 2)
  })

  it('CD4: each frame’s own transom, and is_fanlight within its own frame', () => {
    const mfg = {}
    for (const l of runCD(BENCHMARK_CD4).manufacture_labour.lines) {
      if (!l.fires || l.error) continue
      mfg[l.name] = (mfg[l.name] ?? 0) + l.minutes
    }
    // three frames, one transom each — not three transoms on each frame
    expect(mfg['Additional for Frame Mullion or Transom']).toBe(540)
    expect(mfg['Door Frame - Single Finish (Mullions)']).toBe(255)
    // the three top lights are FANLIGHTS of their own frames, the two lights
    // below them SIDE lights
    expect(mfg['Fanlights in Doorsets'], '300 x 3').toBe(900)
    expect(mfg['Sidelights in Doorsets'], '780 x 2').toBe(1560)
  })

  it('a flag frame is NOT charged as a casement window', () => {
    // A flag frame belongs to a DOOR item, so the two casement frame timber
    // rules (gated on `not is_door`, which is item-level) must stay silent —
    // Integrate has no such line on CD1-CD4 either.
    for (const [label, bm] of CASES) {
      const names = runCD(bm).price.lines
        .filter(l => l.fires && !l.error && l.line_cost > 0).map(l => l.name)
      for (const n of ['Casement Frame Jambs & Cills', 'Casement Frame Head',
        'Softwood Casement Frame & Sashes']) {
        expect(names, `${label} / ${n}`).not.toContain(n)
      }
      // and a door still prices no timber VOLUME at all
      const mm = runCD(bm).price.lines
        .filter(l => l.fires && !l.error && l.line_cost > 0 &&
          l.group_name === 'manufacture_materials').map(l => l.name)
      expect([...new Set(mm)].sort(), label)
        .toEqual(['LTW General Consumables', 'Utile Section Part'])
    }
  })

  it('the item-level counts are the WHOLE item', () => {
    const v = bm => computeVariables(bm.tree, computeDerived(bm.tree), PF_VARIABLES,
      { profileCode: bm.profileCode })
    expect(v(BENCHMARK_CD1).frame_qty).toBe(3)
    expect(v(BENCHMARK_CD1).new_frame_qty).toBe(3)
    expect(v(BENCHMARK_CD1).door_leaf_qty).toBe(1)
    expect(v(BENCHMARK_CD1).casement_sash_qty).toBe(2)
    expect(v(BENCHMARK_CD2).frame_qty).toBe(2)
    expect(v(BENCHMARK_CD4).frame_qty).toBe(3)
    expect(v(BENCHMARK_CD4).casement_sash_qty).toBe(5)
    expect(v(BENCHMARK_CD4).frame_transom_qty, 'three frames, one transom each').toBe(3)
    // and a door item is still a door item, not a casement window
    for (const bm of [BENCHMARK_CD1, BENCHMARK_CD4]) {
      expect(v(bm).is_door).toBe(true)
      expect(v(bm).is_casement_window).toBe(false)
    }
  })

  it('every frame’s geometry is its OWN', () => {
    // CD1's three frames are 693 x 1137 | 995 x 2101 | 693 x 1136, and each
    // light is its own frame's opening less its clearances. Before this step
    // the first frame answered for all three.
    expect(itemFrames(BENCHMARK_CD1.tree).map(f => `${f.values.width}x${f.values.height}`))
      .toEqual(['693x1137', '995x2101', '693x1136'])
    const sashes = []
    const walk = n => {
      if (n.part_type === 'casementSashPart') sashes.push(n)
      for (const c of (n.children ?? [])) walk(c)
    }
    walk(BENCHMARK_CD1.tree)
    expect(sashes.map(s => casementSashSize(BENCHMARK_CD1.tree, s)))
      .toEqual([{ width: 597, height: 1050 }, { width: 597, height: 1049 }])
    // the door leaf is in the middle frame and sized from it
    expect(doorLeafSize(BENCHMARK_CD1.tree, doorLeaves(BENCHMARK_CD1.tree)[0]))
      .toEqual({ width: 895, height: 2012 })
  })

  it('the labels run ON across the frames, as Integrate’s do', () => {
    const labels = bm => {
      const out = []
      const walk = n => {
        const l = openingLabel(bm.tree, n)
        if (l) out.push(l)
        for (const c of (n.children ?? [])) walk(c)
      }
      walk(bm.tree)
      return out
    }
    expect(labels(BENCHMARK_CD1)).toEqual(['Casement Sash A1', 'Single Door B1', 'Casement Sash C1'])
    expect(labels(BENCHMARK_CD2)).toEqual(['Single Door A1', 'Casement Sash B1'])
    expect(labels(BENCHMARK_CD3)).toEqual(['Casement Sash A1', 'Single Door B1'])
    expect(labels(BENCHMARK_CD4)).toEqual([
      'Fanlight A1', 'Casement Sash A2',
      'Fanlight B1', 'Single Door B2',
      'Fanlight C1', 'Casement Sash C2',
    ])
  })

  it('the sections are every frame’s, and the architrave is one set', () => {
    const byCode = bm => Object.fromEntries(
      allocatedSectionParts(bm.tree, { material: 'utile' }).map(s => [s.part_code, s.length_mm]))

    // Integrate charges ONE frame (the widths plus twice the door frame's
    // height) and only the door frame's cill; GlazePro charges each frame.
    const cd1 = byCode(BENCHMARK_CD1)
    expect(cd1.Utile67x96, 'every frame W + 2H')
      .toBe((693 + 2 * 1137) + (995 + 2 * 2101) + (693 + 2 * 1136))
    expect(cd1.Utile63x200, 'three cills + the leaf').toBe(693 + 995 + 693 + 895)
    expect(cd1.Utile63x120).toBe(4913)      // Integrate's own
    expect(cd1.Utile63x63).toBe(5420)
    expect(cd1.Utile63x96).toBe(1194)

    // CD4's 67x96 is the facts' own figure, transoms included
    expect(byCode(BENCHMARK_CD4).Utile67x96).toBe(16002)
    expect(byCode(BENCHMARK_CD4).Utile63x120).toBe(5012)
    expect(byCode(BENCHMARK_CD4).Utile63x63).toBe(9966)
    expect(byCode(BENCHMARK_CD4).Utile63x96).toBe(3202)

    // ONE architrave round the whole set: head = the SET's width (2287 with
    // the -47 overlaps) + 100, two jambs = the DOOR frame's height + 100.
    const comps = runCD(BENCHMARK_CD1).price.lines
      .filter(l => l.fires && !l.error && l.alloc_part_code === 'TP68')
    expect(comps.length, 'one head line and one pair of jambs').toBe(2)
    expect(comps.reduce((t, l) => t + l.line_cost, 0)).toBeCloseTo(19.38, 2)
  })

  it('CD4 prices the Kenrick variant parts — the first benchmark that uses them', () => {
    // The Step BB report warned that pf30-snapshot.json carries unit_cost 0
    // on four Kenrick gearbox parts. CD4's stored list is the first to need
    // them, and its ironmongery comes out at Integrate's own 152.25 — so the
    // captured snapshot has them costed and nothing had to be refreshed.
    const iron = runCD(BENCHMARK_CD4).price.lines
      .filter(l => l.fires && !l.error && l.name === 'Ironmongery Cost')
      .reduce((t, l) => t + l.line_cost, 0)
    expect(iron).toBeCloseTo(152.25, 2)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Step BD — FRONT DOORS (open in, panelled): FT1-FT3
// docs/integrate-L31115-front-doors.txt, drawings 16-18 read 13 Oct 2026.
//
// Each row is Integrate's own figure plus exactly what is declared on the
// fixture, and the three declarations are different KINDS of thing:
//   BY DESIGN  the door timber Integrate allocates nothing for (Nathan's
//              standing rule) — FT1's muntin, FT2's transom, FT3's mid rail;
//   PENDING    the three AV4 parts the live catalogue holds at cost 0
//              (-149.10 on all three, sql/step-bd1), and FT1's 120
//              unexplained production minutes (+49.32);
//   PARKED     FT3's shaped glass (+15.81), a near-semicircular head the
//              shallow-arch model does not describe.
// ══════════════════════════════════════════════════════════════════════════════
describe('Step BD — front door benchmarks', () => {
  const FT_CASES = [
    // Step BF: the panels are FLAT, so Integrate’s flat 60 was right. What is
    // left of decision d makes GlazePro 60 minutes CHEAPER per mid rail —
    // Integrate counts one as a muntin and GlazePro does not:
    //   FT1 2,610 against 2,670   FT2 2,710 against 2,770
    //   FT3 3,230 against 3,290   FT4 3,785 against 3,905 (two mid rails)
    ['FT1', BENCHMARK_FT1, INTEGRATE.benchmarkFT1_front_door_balham,   43.50, 14.00],
    ['FT2', BENCHMARK_FT2, INTEGRATE.benchmarkFT2_front_door_fanlight, 45.17, 18.17],
    ['FT3', BENCHMARK_FT3, INTEGRATE.benchmarkFT3_front_door_arched,   53.83, 14.75],
    // Step BE: the side light. 4,085 production minutes against Integrate’s
    // 3,905 — the same 180 of its own two errors — and its fitting to the
    // minute: Front Door and Frame 840 + 120 a frame mullion + 120 a fixed
    // casement sash, and NO "Combination Frame" (the side light is a sash,
    // not a leaf).
    ['FT4', BENCHMARK_FT4, INTEGRATE.benchmarkFT4_front_door_side_light, 63.08, 18.00],
  ]

  // sql/step-bd1 was RUN LIVE on 14 Oct: the AV4 Heritage lock, the pocket
  // keep and the centre keep have their costs. The captured snapshot
  // pre-dates the run and still holds them at 0, so the FT rows are priced
  // with the costs filled in — the same treatment the Kenrick gearbox parts
  // had in Step BB while the capture lagged the live data. withAv4Costs
  // never overwrites a cost the snapshot HAS, so a refreshed snapshot makes
  // it a no-op.
  const FT_SNAPSHOT = withShapedGlassRate(withAv4Costs(SNAPSHOT))

  function runFT(bm) {
    return runPricingOnTree(bm.tree, FT_SNAPSHOT.rules, FT_SNAPSHOT.pfVariables, {
      glassCatalogue: FT_SNAPSHOT.glassCatalogue,
      partAllocationRules: FT_SNAPSHOT.partAllocationRules,
      partCostMap: bm.partCostMap,
      ironmongeryLines: bm.ironmongeryLines,
      ironmongeryCatalogue: FT_SNAPSHOT.ironmongeryCatalogue,
      profileValues: FT_SNAPSHOT.profileValues,
      profileCode: bm.profileCode,
    })
  }

  for (const [label, bm, target, production, labour] of FT_CASES) {
    it(`${label}: production ${production} h and labour ${labour} h`, () => {
      const r = runFT(bm)
      expect(r.manufacture_labour.total_minutes / 60, `${label} production`)
        .toBeCloseTo(production, 2)
      // FT2 and FT3 are Integrate's production EXACTLY; FT1 is 2 h over, and
      // that is the figure the reviewer settles with Integrate.
      // Step BF: every FT row is UNDER Integrate now, by 60 minutes per MID
      // RAIL — Integrate fires "Door Muntin" for one and GlazePro charges 60
      // per real muntin only (Nathan’s decision d, the half that survived the
      // panel-type correction). FT4 has two mid rails.
      const midRails = label === 'FT4' ? 2 : 1
      expect(target.hours.production - production,
        `${label} is ${midRails} mid rail(s) under Integrate`)
        .toBeCloseTo(midRails * 60 / 60, 2)
      // Fitting is Integrate's on all three, to the minute.
      expect(r.install_labour.total_minutes / 60, `${label} labour`)
        .toBeCloseTo(target.hours.labour, 2)
    })

    it(`${label}: every group is Integrate plus what is declared`, () => {
      const r = runFT(bm)
      const got = {}
      for (const l of r.price.lines) {
        if (!l.fires || l.error) continue
        got[l.group_name] = (got[l.group_name] ?? 0) + l.line_cost
      }
      const declared = (bm.deliberateDifference?.cost ?? 0) +
        (bm.parkedResidual?.cost ?? 0) + (bm.openQuestion?.cost ?? 0) +
        (bm.pendingDecision?.cost ?? 0)
      expect(r.price.total_cost, `${label} total`)
        .toBeCloseTo(target.total_cost + declared, 2)
      // labour (fitting) is Integrate's exactly on all three
      expect(got.labour ?? 0, `${label} labour group`)
        .toBeCloseTo(target.groups.labour.cost, 2)
      // and so is the glass, except FT3's parked shaped head
      // Step BE: FT3’s glass is Integrate’s plus the shaped-glass decision
      // (23.28) and the rate still pending (15.11); FT2’s is Integrate’s
      // exactly. Spelled out per benchmark rather than derived, because the
      // split is the thing a reader checks.
      // FT4’s one glass unit is 0.236 m2 of cut glass and prices at the
      // 0.30 m2 MINIMUM — Integrate’s own 17.55, to the penny.
      // Step BE follow-up: sql/step-be1 is live, so FT3’s glass is the
      // decided 23.28 alone — the 15.11 of rate is not pending any more.
      const GLASS = { FT1: 0, FT2: 0, FT3: 23.28, FT4: 0 }
      if (target.groups.glass_done) {
        expect(got.glass_done ?? 0, `${label} glass`)
          .toBeCloseTo(target.groups.glass_done.cost + GLASS[label], 2)
      }
    })
  }

  it('the ironmongery is Integrate’s own 263.55, since sql/step-bd1 ran', () => {
    // The three AV4 parts at cost 0 were the whole 149.10 gap. With the
    // costs the file wrote, every front door matches Integrate’s stored set
    // to the penny: hinges 14.70, thumbturn 27.30, lock 112.35, pocket keep
    // 5.25, centre keep 31.50, euro pull 29.40, letter tidy 27.30,
    // letterplate 15.75.
    for (const [label, bm] of FT_CASES) {
      const iron = runFT(bm).price.lines
        .filter(l => l.fires && l.name === 'Ironmongery Cost')
      expect(iron.reduce((t, l) => t + l.line_cost, 0), label).toBeCloseTo(263.55, 2)
    }
  })

  it('the declared differences are the timber Integrate does not allocate', () => {
    // 1.788 m of 120 muntin, 1.005 m of 67x96 transom, 0.777 m of 120 mid
    // rail — at the same per-metre costs every other door line uses.
    expect(Math.round(1.788 * 17.30 * 100) / 100).toBe(30.93)
    expect(Math.round(1.005 * 13.60 * 100) / 100).toBe(13.67)
    expect(Math.round(0.777 * 17.30 * 100) / 100).toBe(13.44)
    // Step BF: each row is its timber (and FT3’s glass) LESS the mid-rail
    // minutes Integrate charges and GlazePro does not — 24.66 an hour.
    const MID_RAIL = Math.round(60 / 60 * 24.66 * 100) / 100   // 24.66
    expect(MID_RAIL).toBe(24.66)
    expect(BENCHMARK_FT1.deliberateDifference.cost).toBeCloseTo(30.94 - MID_RAIL, 2)
    expect(BENCHMARK_FT2.deliberateDifference.cost).toBeCloseTo(13.67 - MID_RAIL, 2)
    expect(BENCHMARK_FT3.deliberateDifference.cost).toBeCloseTo(13.45 + 23.28 - MID_RAIL, 2)
    expect(BENCHMARK_FT4.deliberateDifference.cost).toBeCloseTo(70.92 - 2 * MID_RAIL, 2)
  })

  it('FT4’s side light is a SASH with a grid, and its lines are Integrate’s', () => {
    const r = runFT(BENCHMARK_FT4)
    // five Tricoya panels: the door’s four 276 x 834 and the side light’s
    // 235 x 834, which are Integrate’s 43.47 x 4 and 37.01
    const tricoya = r.price.lines.filter(l => l.fires && l.name === 'Tricoya Panel')
    expect(tricoya.map(l => l.line_cost)).toEqual([43.47, 43.47, 43.47, 43.47, 37.01])
    // its glass stops at its own mid rail (235 x 888 of sightline, 0.236 m2
    // of cut glass) and prices at the 0.30 m2 minimum, as Integrate does
    const glass = r.price.lines.filter(l => l.fires && /Glass Cost/.test(l.name ?? ''))
    expect(glass.length).toBe(1)
    expect(glass[0].quantity).toBeCloseTo(0.30, 2)
    expect(glass[0].line_cost).toBeCloseTo(17.55, 2)
    // the sash is a SIDE LIGHT, not a fanlight: its stiles and top rail come
    // to W + 2H with no fanlight offset, and its 175 rail from the same
    // 63x200 as a door’s bottom rail — both Integrate’s own allocations
    const sections = Object.fromEntries(
      allocatedSectionParts(BENCHMARK_FT4.tree).map(x => [x.part_code, x.length_mm]))
    expect(sections.Utile63x63).toBe(4517)
    expect(sections.Utile63x200).toBe(1400 + 892 + 359)
    expect(sections.Utile63x96).toBeUndefined()
  })

  it('a front door prices no timber VOLUME, as the other doors do not', () => {
    for (const [label, bm] of FT_CASES) {
      const mm = runFT(bm).price.lines
        .filter(l => l.fires && !l.error && l.line_cost > 0 &&
          l.group_name === 'manufacture_materials').map(l => l.name)
      expect([...new Set(mm)].sort(), label)
        .toEqual(['LTW General Consumables', 'Tricoya Panel', 'Utile Section Part'])
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Step BF — STABLE DOORS: ST1, ST2, ST3
// docs/integrate-L31115-stable-doors.txt, drawings 21-23 read 14 Oct 2026.
//
// Integrate stores a StableDoorPart holding a TOP and a BOTTOM stable leaf;
// GlazePro stores two ordinary doorLeafParts in a stableDoorPart, so
// door_leaf_qty is 2 and every door rule fires per half — which is what
// Integrate's own Estimated Labour Time editor shows it does.
//
// Production, fitting, glass, the Tricoya panels and the ironmongery are
// Integrate's exactly on all three. The ONE difference is the halves' timber,
// which Integrate allocates nothing for.
// ══════════════════════════════════════════════════════════════════════════════
describe('Step BF — stable door benchmarks', () => {
  const ST_CASES = [
    ['ST1', BENCHMARK_ST1, INTEGRATE.benchmarkST1_stable_door,               3405, 900],
    ['ST2', BENCHMARK_ST2, INTEGRATE.benchmarkST2_stable_door_vision_panel,  3425, 900],
    ['ST3', BENCHMARK_ST3, INTEGRATE.benchmarkST3_stable_door_glazed_top,    3365, 900],
  ]
  const runST = bm => runPricingOnTree(bm.tree, FT_SNAPSHOT_ST.rules, FT_SNAPSHOT_ST.pfVariables, {
    glassCatalogue: FT_SNAPSHOT_ST.glassCatalogue,
    partAllocationRules: FT_SNAPSHOT_ST.partAllocationRules,
    partCostMap: bm.partCostMap,
    ironmongeryLines: bm.ironmongeryLines,
    ironmongeryCatalogue: FT_SNAPSHOT_ST.ironmongeryCatalogue,
    profileValues: FT_SNAPSHOT_ST.profileValues,
    profileCode: bm.profileCode,
  })

  for (const [label, bm, target, production, fitting] of ST_CASES) {
    it(`${label}: production ${production} min and fitting ${fitting}, exactly`, () => {
      const r = runST(bm)
      // Door Leaf 1035 PER HALF, the panels, the frame and the single finish
      expect(r.manufacture_labour.total_minutes, `${label} production`).toBe(production)
      // rule 200 "Stable Door" 900, and NO other door fitting rule: "Single
      // Door Only" wants door_leaf_qty == 1 and a stable door has two.
      expect(r.install_labour.total_minutes, `${label} fitting`).toBe(fitting)
      const fired = (r.install_labour.lines ?? []).filter(l => (l.minutes ?? 0) > 0)
      expect(fired.map(l => l.rule_name ?? l.name)).toEqual(['Stable Door'])
    })

    it(`${label}: every group is Integrate plus the halves' timber`, () => {
      const r = runST(bm)
      const got = {}
      for (const l of r.price.lines) {
        if (!l.fires || l.error) continue
        got[l.group_name] = (got[l.group_name] ?? 0) + l.line_cost
      }
      const timber = bm.deliberateDifference.cost
      for (const [group, t] of Object.entries(target.groups)) {
        const expected = group === 'manufacture_materials' ? t.cost + timber : t.cost
        expect(got[group] ?? 0, `${label} ${group}`).toBeCloseTo(expected, 2)
      }
      expect(r.price.total_cost, `${label} total`).toBeCloseTo(target.total_cost + timber, 2)
    })
  }

  it('each half is a door leaf of its own size, with its own cell', () => {
    const halves = doorLeaves(BENCHMARK_ST1.tree)
    expect(halves.length).toBe(2)
    expect(halves.map(h => h.values.stableHalf)).toEqual(['top', 'bottom'])
    // Integrate's own 1055 / 1048 of a 2103 container, and its cells
    expect(halves.map(h => doorLeafSize(BENCHMARK_ST1.tree, h)))
      .toEqual([{ width: 997, height: 1055 }, { width: 997, height: 1048 }])
    expect(halves.flatMap(h => leafCells(BENCHMARK_ST1.tree, h).map(c => `${c.width}x${c.height}`)))
      .toEqual(['777x846', '777x779'])
  })

  it('a stable door is ONE pair and TWO leaves to every rule', () => {
    const v = computeVariables(BENCHMARK_ST1.tree, computeDerived(BENCHMARK_ST1.tree),
      PF_VARIABLES, { profileCode: BENCHMARK_ST1.profileCode })
    expect(v.new_stable_door_pair_qty).toBe(1)
    expect(v.door_leaf_qty).toBe(2)
    expect(v.is_door).toBe(true)
    expect(v.is_front_door).toBe(false)
    // and a front door is not a stable door
    const ft = computeVariables(BENCHMARK_FT1.tree, computeDerived(BENCHMARK_FT1.tree),
      PF_VARIABLES, { profileCode: BENCHMARK_FT1.profileCode })
    expect(ft.new_stable_door_pair_qty).toBe(0)
  })

  it('ST2’s vision panel is glass in a panel, and the panel is charged in full', () => {
    const r = runST(BENCHMARK_ST2)
    const tricoya = r.price.lines.filter(l => l.fires && l.name === 'Tricoya Panel')
    // the FULL cells, 0.66 and 0.61 — Integrate does not deduct the hole
    expect(tricoya.map(l => l.line_cost)).toEqual([124.14, 114.31])
    const glass = r.price.lines.filter(l => l.fires && /Glass Cost/.test(l.name ?? ''))
    expect(glass.length).toBe(1)
    expect(glass[0].quantity).toBeCloseTo(0.30, 2)   // the 0.30 m2 minimum
    expect(glass[0].line_cost).toBeCloseTo(17.55, 2)
  })

  it('ST1 and ST3 price Integrate’s stored ironmongery, ST2 none', () => {
    // 14.70 hinges + 29.40 sashlock + 15.75 deadlock + 3.15 vent + 25.20 handle
    for (const label of ['ST1', 'ST3']) {
      const bm = label === 'ST1' ? BENCHMARK_ST1 : BENCHMARK_ST3
      const iron = runST(bm).price.lines.filter(l => l.fires && l.name === 'Ironmongery Cost')
      expect(iron.reduce((t, l) => t + l.line_cost, 0), label).toBeCloseTo(88.20, 2)
      // and NO multipoint lock: a stable door has none (isDoorMpls false)
      expect(iron.map(l => l.alloc_iron_part_code), label).not.toContain('RJZ2382')
    }
    const st2 = runST(BENCHMARK_ST2).price.lines
      .filter(l => l.fires && l.name === 'Ironmongery Cost')
    expect(st2.length).toBe(0)
  })

  it('the halves’ timber is the declared 152.73, from its lengths', () => {
    const sections = Object.fromEntries(
      allocatedSectionParts(BENCHMARK_ST1.tree).map(x => [x.part_code, x.length_mm]))
    // Integrate's two, exactly: the cill and the frame
    expect(sections.Utile67x96).toBe(1099 + 2 * 2207)
    // and GlazePro's: the halves' stiles and top rails (-20 each, open in),
    // the top half's 99 meeting rail, the bottom half's 170 rail
    expect(sections.Utile63x120).toBe((2 * 1055 + 997 - 20) + (2 * 1048 + 997 - 20) + 997)
    expect(sections.Utile63x200).toBe(1099 + 997)
    const extra = Math.round((7157 / 1000 * 17.30 + 997 / 1000 * 29) * 100) / 100
    expect(extra).toBeCloseTo(152.73, 2)
    expect(BENCHMARK_ST1.deliberateDifference.cost).toBeCloseTo(152.73, 2)
  })
})
