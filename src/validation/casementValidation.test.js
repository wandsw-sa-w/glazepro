// casementValidation.test.js — Step AS
//
// The 11 casement-sash checks Integrate has ON, against the Step AO/AR
// fixtures and board-built trees. The rules are copied from the reviewer's
// sql/step-as0-validation-parity.sql (casementRules.fixture.js), because
// Nathan runs that SQL only after this step deploys.
//
// Two of these are FACTS, read live on 12 Oct
// (docs/integrate-validation-active-flags.txt):
//   Q (L31115 2/21): Integrate shows exactly ONE message, the fanlight
//     bottom rail warning — and it clears when the rail is set to 62.
//   P (L31115 2/19): Integrate shows exactly ONE message, rule 120.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import { validateDrawing } from './validate.js'
import { CASEMENT_VALIDATION_RULES } from './casementRules.fixture.js'
import { casementSashVariables, isFanlightSash } from '../pricing/casementSashVariables.js'
import { computeVariables } from '../pricing/computeVariables.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'
import {
  buildCasementFrame, openingNodes, openingLabel, setCasementOperation,
  changeOpening, applyFanlightBottomRails, columnCount, rowCount,
} from '../drawingBoard/casementOpenings.js'
import { applyDividers } from '../drawingBoard/gridActions.js'
import { resolveIronmongeryLines } from '../pricing/loadPricingContext.js'
import {
  BENCHMARK_A, BENCHMARK_J, BENCHMARK_K, BENCHMARK_L, BENCHMARK_M, BENCHMARK_N,
  BENCHMARK_P, BENCHMARK_Q, BENCHMARK_R, BENCHMARK_S,
  BENCHMARK_SA, BENCHMARK_SB, BENCHMARK_SC, BENCHMARK_SD, BENCHMARK_SE, BENCHMARK_SF,
} from '../pricing/benchmarks/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = resolve(HERE, '../pricing/benchmarks/pf30-snapshot.json')
const SNAPSHOT = existsSync(SNAPSHOT_PATH)
  ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
  : null

const GLASS = SNAPSHOT?.glassCatalogue ?? {}
const PROFILE_VALUES = SNAPSHOT?.profileValues ?? {}
const PF_VARIABLES = SNAPSHOT?.pfVariables ?? {}

/** Validate a tree with the 11 casement rules and the glass catalogue. */
function validate(tree, { glassCatalogue = GLASS, rules = CASEMENT_VALIDATION_RULES, profileCode = null } = {}) {
  const derived = computeDerived(tree, PROFILE_VALUES)
  // Step AY item 4: the DRAWING's profile code, which every caller now
  // passes (the board, Quote Matrix, Quote Overview, the Validation Rules
  // page and the publish snapshot).
  const vars = computeVariables(tree, derived, PF_VARIABLES, { profileCode }) ?? {}
  return validateDrawing(tree, vars, rules, {}, { glassCatalogue })
}
const firedOn = (tree, opts) => validate(tree, opts).filter(r => r.status === 'fired')
const unevaluableOn = (tree, opts) => validate(tree, opts).filter(r => r.status === 'unevaluable')

/** Every casement sash's variables, as the rules see them. */
function sashVars(tree) {
  const derived = computeDerived(tree, PROFILE_VALUES)
  const vars = computeVariables(tree, derived, PF_VARIABLES) ?? {}
  return openingNodes(tree)
    .filter(n => n.part_type === 'casementSashPart')
    .map(n => ({ label: openingLabel(tree, n), ...casementSashVariables(tree, n, vars, GLASS) }))
}

// The casement profile's values, as the reviewer read them
const PV = {
  'assemblyFramePart.leftWidth': 37, 'assemblyFramePart.rightWidth': 37,
  'assemblyFramePart.topHeight': 47, 'assemblyFramePart.bottomHeight': 47,
  'assemblyFramePart.frameDepth': 96, 'assemblyFramePart.frameHeadStopSize': 20,
  'assemblyFramePart.frameStileStopSize': 20, 'assemblyFramePart.cillStopSize': 20,
  'assemblyFramePart.cillAngle': 6, 'assemblyFramePart.jambType': 'solid_profiled',
  'cillPart.height': 47, 'cillPart.depth': 128,
  'mullionPart.thicknessInFrameSolid': 27, 'mullionPart.mullionStopSize': 20,
  'casementSashPart.thickness': 54, 'casementSashPart.topHeight': 62,
  'casementSashPart.leftWidth': 62, 'casementSashPart.rightWidth': 62,
  'casementSashPart.mechanicalClearanceLeft': 4, 'casementSashPart.mechanicalClearanceRight': 4,
  'casementSashPart.mechanicalClearanceTop': 4, 'casementSashPart.mechanicalClearanceBottom': 4,
  'casementSashPart.btmRailShapeId': 'square',
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 16,
  'glassPart.defaultDoubleGlazingTolerance': 2,
  'glassPart.defaultDirGuStopSize': 20,
  'glassPart.defaultDoubleGlazingRebateWidthForDirGU': 20,
  'glassPart.defaultDoubleGlazingToleranceForDirGU': 2,
}
// Before sql/step-as0: both rails resolve to the one fanlight key (83)
const PV_BEFORE_SQL = { ...PV, 'casementSashPart.defaultFanlightBottomHeight': 83 }
// After sql/step-as0: an ordinary sash 83, a fanlight 62
const PV_AFTER_SQL = {
  ...PV,
  'casementSashPart.bottomHeight': 83,
  'casementSashPart.defaultFanlightBottomHeight': 62,
}
const PICKER_PV = { thicknessInFrameSolid: 27, mullionStopSize: 20 }

function applyGrid(tree, cols, rows, profileValues = PV_AFTER_SQL) {
  const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
  const cill = frame.children.find(c => c.part_type === 'cillPart')
  const iW = frame.values.width - frame.values.leftWidth - frame.values.rightWidth
  const iH = frame.values.height - frame.values.topHeight - cill.values.height
  const next = applyDividers(tree, frame.key, cols, rows, iW, iH, PICKER_PV, 'solid')
  return applyFanlightBottomRails(next, profileValues).tree
}

// ── The two live facts ───────────────────────────────────────────────────────

describe.skipIf(!SNAPSHOT)('Step AS — casement validation against Integrate', () => {
  it('Q: exactly ONE message, the fanlight bottom rail, on the fanlight', () => {
    const fired = firedOn(BENCHMARK_Q.tree)
    expect(fired).toHaveLength(1)
    expect(fired[0].message).toBe('Fanlight bottom rail should be reduced to 62mm externally')
    expect(fired[0].severity).toBe('warning')
    expect(fired[0].part_label).toBe('Fanlight A1')
  })

  it('Q with the fanlight at 62: NO message', () => {
    // Integrate: setting the rail to 62 clears the message (and drops the
    // price £1.20). 62 must not fire — the rule is "> 62", not ">= 62".
    const tree = JSON.parse(JSON.stringify(BENCHMARK_Q.tree))
    const fanlight = openingNodes(tree)[0]
    expect(isFanlightSash(tree, fanlight)).toBe(true)
    fanlight.values.bottomHeight = 62
    expect(firedOn(tree)).toEqual([])
  })

  it('R: the same single warning — a FIXED fanlight is still to_be_replaced', () => {
    const fired = firedOn(BENCHMARK_R.tree)
    expect(fired).toHaveLength(1)
    expect(fired[0].message).toBe('Fanlight bottom rail should be reduced to 62mm externally')
    expect(fired[0].part_label).toBe('Fanlight A1')
  })

  it('P: exactly ONE message, rule 120 over 45 kg side hung', () => {
    const fired = firedOn(BENCHMARK_P.tree)
    expect(fired).toHaveLength(1)
    expect(fired[0].message).toBe('We cannot do side hung opening casement sashes over 45kg')
    expect(fired[0].severity).toBe('error')
    expect(fired[0].part_label).toBe('Casement Sash A1')
    // 1517 x 1497 with a 1.96 m² unit
    expect(sashVars(BENCHMARK_P.tree)[0].weight_in_kg).toBeGreaterThan(45)
  })

  it('J, K, L, M and N fire nothing', () => {
    for (const [label, bm] of [['J', BENCHMARK_J], ['K', BENCHMARK_K],
      ['L', BENCHMARK_L], ['M', BENCHMARK_M], ['N', BENCHMARK_N]]) {
      expect(firedOn(bm.tree), label).toEqual([])
    }
  })

  it('S fires the fanlight warning only — its 26 kg sash is under rule 120', () => {
    // No Integrate reading for S yet; reported in the Step AS report.
    const fired = firedOn(BENCHMARK_S.tree)
    expect(fired.map(r => r.message)).toEqual(
      ['Fanlight bottom rail should be reduced to 62mm externally'])
    const sashes = sashVars(BENCHMARK_S.tree)
    expect(sashes[1].weight_in_kg).toBeGreaterThan(25)
    expect(sashes[1].weight_in_kg).toBeLessThan(45)
  })

  it('no casement rule is unevaluable on any of these trees', () => {
    for (const [label, bm] of [['J', BENCHMARK_J], ['K', BENCHMARK_K],
      ['L', BENCHMARK_L], ['M', BENCHMARK_M], ['N', BENCHMARK_N],
      ['P', BENCHMARK_P], ['Q', BENCHMARK_Q], ['R', BENCHMARK_R], ['S', BENCHMARK_S]]) {
      expect(unevaluableOn(bm.tree), label).toEqual([])
    }
  })
})

// ── The variables themselves ─────────────────────────────────────────────────

describe.skipIf(!SNAPSHOT)('Step AS — casement sash variables', () => {
  it('width and height are the gross size in METRES', () => {
    // Rule 46 reads `width <= 0.31`; the gross_* variables stay in mm
    const [fanlight] = sashVars(BENCHMARK_Q.tree)
    expect(fanlight.gross_sash_width_in_mm).toBe(958)
    expect(fanlight.gross_sash_height_in_mm).toBe(348)
    expect(fanlight.width).toBeCloseTo(0.958, 6)
    expect(fanlight.height).toBeCloseTo(0.348, 6)
  })

  it('is_fanlight is the board’s own rule, so the label always agrees', () => {
    const q = sashVars(BENCHMARK_Q.tree)
    expect(q.map(s => [s.label, s.is_fanlight]))
      .toEqual([['Fanlight A1', true], ['Casement Sash A2', false]])
    // a one-row frame has no fanlight at all
    expect(sashVars(BENCHMARK_N.tree).map(s => s.is_fanlight)).toEqual([false, false])
  })

  it('the drawn sections come through', () => {
    const [fanlight] = sashVars(BENCHMARK_Q.tree)
    expect(fanlight.gross_bottom_rail_height_in_mm).toBe(83)
    expect(fanlight.gross_sash_head_height_in_mm).toBe(62)
    expect(fanlight.gross_left_sash_stile_width_in_mm).toBe(62)
    expect(fanlight.gross_right_sash_stile_width_in_mm).toBe(62)
  })

  it('what is not offered is false, not missing', () => {
    const [fanlight] = sashVars(BENCHMARK_Q.tree)
    expect(fanlight.is_storm_proof).toBe(false)
    expect(fanlight.is_heritage_range).toBe(false)
    expect(fanlight.is_bottom_and_left_hand_hung_viewed_internally).toBe(false)
    expect(fanlight.is_bottom_and_right_hand_hung_viewed_internally).toBe(false)
  })

  it('a stormproof sash flips is_storm_proof, from the sash or the item', () => {
    const tree = JSON.parse(JSON.stringify(BENCHMARK_Q.tree))
    openingNodes(tree)[0].values.isStormProof = true
    expect(sashVars(tree)[0].is_storm_proof).toBe(true)
    expect(sashVars(tree)[1].is_storm_proof).toBe(false)
  })
})

// ── Weight needs the glass catalogue ────────────────────────────────────────

describe.skipIf(!SNAPSHOT)('Step AS — weight_in_kg needs the glass catalogue', () => {
  it('with NO catalogue the weight rule is unevaluable, never a pass', () => {
    // P's sash is over 45 kg: with no catalogue the rule must not silently
    // pass on a weight of 0.
    const unev = unevaluableOn(BENCHMARK_P.tree, { glassCatalogue: null })
    expect(unev).toHaveLength(1)
    expect(unev[0].message).toBe('We cannot do side hung opening casement sashes over 45kg')
    expect(unev[0].missing).toEqual(['weight_in_kg'])
    expect(firedOn(BENCHMARK_P.tree, { glassCatalogue: null })).toEqual([])
  })

  it('the other ten rules still evaluate without a catalogue', () => {
    const results = validate(BENCHMARK_Q.tree, { glassCatalogue: null })
    const unev = results.filter(r => r.status === 'unevaluable')
    // Q has two sashes, so only the two weight-rule iterations are blocked
    expect(unev.every(r => r.missing.includes('weight_in_kg'))).toBe(true)
    expect(firedOn(BENCHMARK_Q.tree, { glassCatalogue: null }).map(r => r.message))
      .toEqual(['Fanlight bottom rail should be reduced to 62mm externally'])
  })
})

// ── The other casement rules ─────────────────────────────────────────────────

describe.skipIf(!SNAPSHOT)('Step AS — the other casement checks', () => {
  it('unticking Casement MPLS fires "Not MPLS" once per OPENING sash', () => {
    const q = JSON.parse(JSON.stringify(BENCHMARK_Q.tree))
    q.children.find(c => c.part_type === 'paintAndIronmongeryPart').values.isCasementMpls = false
    const notMpls = firedOn(q).filter(r => r.message === 'Not MPLS')
    expect(notMpls).toHaveLength(2)              // both of Q's sashes open
    expect(notMpls.map(r => r.part_label)).toEqual(['Fanlight A1', 'Casement Sash A2'])

    // R's fanlight is FIXED, so only the casement below it is an opener
    const r = JSON.parse(JSON.stringify(BENCHMARK_R.tree))
    r.children.find(c => c.part_type === 'paintAndIronmongeryPart').values.isCasementMpls = false
    const rNotMpls = firedOn(r).filter(x => x.message === 'Not MPLS')
    expect(rNotMpls).toHaveLength(1)
    expect(rNotMpls[0].part_label).toBe('Casement Sash A2')
  })

  it('rule 120 is SIDE hung only — a top-hung sash of the same weight passes', () => {
    const side = BENCHMARK_P.tree
    expect(firedOn(side).map(r => r.message))
      .toEqual(['We cannot do side hung opening casement sashes over 45kg'])

    const top = JSON.parse(JSON.stringify(BENCHMARK_P.tree))
    const sash = openingNodes(top)[0]
    sash.values.operation = 'top_hung'
    expect(sashVars(top)[0].weight_in_kg).toBeGreaterThan(45)   // same weight
    expect(firedOn(top)).toEqual([])                            // but not side hung
  })

  it('a 300 mm top-hung sash with MPLS fires "Short Casement Espag"', () => {
    // rule 124: is_top_hung and gross_sash_width_in_mm < 306 and is_casement_mpls
    const { tree } = buildCasementFrame(PV_AFTER_SQL, {
      width: 382, height: 1299, openings: ['opening_casement'], product: 'casement',
    })
    const sash = openingNodes(tree)[0]
    const next = setCasementOperation(tree, sash.key, 'top_hung').tree
    expect(sashVars(next)[0].gross_sash_width_in_mm).toBe(300)
    expect(firedOn(next).map(r => r.message)).toContain('Short casement espag')
  })

  it('a side-hung sash under 306 mm TALL fires the other Short Casement Espag', () => {
    // rule 125 reads the HEIGHT, for a side-hung sash
    const { tree } = buildCasementFrame(PV_AFTER_SQL, {
      width: 1199, height: 394, openings: ['opening_casement'], product: 'casement',
    })
    expect(sashVars(tree)[0].gross_sash_height_in_mm).toBe(292)
    expect(sashVars(tree)[0].is_side_hung).toBe(true)
    expect(firedOn(tree).map(r => r.message)).toContain('Short casement espag')
  })

  it('the stormproof rules stay silent until a sash is stormproof', () => {
    expect(firedOn(BENCHMARK_N.tree)).toEqual([])
    const tree = JSON.parse(JSON.stringify(BENCHMARK_N.tree))
    openingNodes(tree)[0].values.isStormProof = true
    const messages = firedOn(tree).map(r => r.message)
    expect(messages).toContain('Storm proof casement windows (not flush)')
  })
})

// ── Item 3: the 62 mm fanlight bottom rail ──────────────────────────────────

describe('Step AS — a fanlight starts with a 62 mm bottom rail', () => {
  it('before sql/step-as0 nothing changes: both rails are 83', () => {
    // The profile has only the one fanlight key, so an ordinary sash and a
    // fanlight resolve to the same 83 — exactly Step AR's behaviour.
    const { tree } = buildCasementFrame(PV_BEFORE_SQL, {
      width: 1200, height: 1300, openings: ['opening_casement'], product: 'casement',
    })
    const withRow = applyGrid(tree, 1, 2, PV_BEFORE_SQL)
    expect(openingNodes(withRow).map(n => n.values.bottomHeight)).toEqual([83, 83])
  })

  it('a new fanlight drawing starts the fanlight at 62 and the sash at 83', () => {
    const { tree } = buildCasementFrame(PV_AFTER_SQL, {
      width: 1200, height: 1300, openings: ['opening_casement'], product: 'casement',
    })
    expect(openingNodes(tree)[0].values.bottomHeight).toBe(83)   // one row: ordinary
    const withRow = applyGrid(tree, 1, 2)
    expect(rowCount(withRow)).toBe(2)
    expect(openingNodes(withRow).map(n => n.values.bottomHeight)).toEqual([62, 83])
    expect(openingLabel(withRow, openingNodes(withRow)[0])).toBe('Fanlight A1')
  })

  it('a fanlight at 62 fires nothing; the lower sash at 83 is not a fanlight', () => {
    const { tree } = buildCasementFrame(PV_AFTER_SQL, {
      width: 1040, height: 980, openings: ['opening_casement'], product: 'casement',
    })
    const withRow = applyGrid(tree, 1, 2)
    expect(firedOn(withRow)).toEqual([])
  })

  it('removing the transom gives the old fanlight the ordinary rail back', () => {
    const { tree } = buildCasementFrame(PV_AFTER_SQL, {
      width: 1200, height: 1300, openings: ['opening_casement'], product: 'casement',
    })
    const withRow = applyGrid(tree, 1, 2)
    expect(openingNodes(withRow)[0].values.bottomHeight).toBe(62)
    const flat = applyGrid(withRow, 1, 1)
    expect(rowCount(flat)).toBe(1)
    expect(openingNodes(flat)[0].values.bottomHeight).toBe(83)
  })

  it('a rail the surveyor typed is NEVER touched', () => {
    const { tree } = buildCasementFrame(PV_AFTER_SQL, {
      width: 1200, height: 1300, openings: ['opening_casement'], product: 'casement',
    })
    openingNodes(tree)[0].values.bottomHeight = 70        // the surveyor's own value
    const withRow = applyGrid(tree, 1, 2)
    expect(openingNodes(withRow)[0].values.bottomHeight).toBe(70)
    const flat = applyGrid(withRow, 1, 1)
    expect(openingNodes(flat)[0].values.bottomHeight).toBe(70)
  })

  it('a fanlight changed to Fixed keeps its 62 (Step AR: sections survive)', () => {
    const { tree } = buildCasementFrame(PV_AFTER_SQL, {
      width: 1200, height: 1300, openings: ['opening_casement'], product: 'casement',
    })
    const withRow = applyGrid(tree, 1, 2)
    const fanlight = openingNodes(withRow)[0]
    const fixed = changeOpening(withRow, fanlight.key, 'fixed_casement', PV_AFTER_SQL).tree
    expect(openingNodes(fixed)[0].values.operation).toBe('fix')
    expect(openingNodes(fixed)[0].values.bottomHeight).toBe(62)
  })

  it('a direct glazed unit changed INTO the fanlight row starts at 62', () => {
    const { tree } = buildCasementFrame(PV_AFTER_SQL, {
      width: 1200, height: 1300, openings: ['opening_casement'], product: 'casement',
    })
    let withRow = applyGrid(tree, 1, 2)
    const fanlightKey = openingNodes(withRow)[0].key
    // make the top row a direct glazed unit, then a casement again
    withRow = changeOpening(withRow, fanlightKey, 'direct_glazed', PV_AFTER_SQL).tree
    expect(openingNodes(withRow)[0].part_type).toBe('glassPart')
    const dguKey = openingNodes(withRow)[0].key
    const back = changeOpening(withRow, dguKey, 'opening_casement', PV_AFTER_SQL).tree
    expect(openingNodes(back)[0].part_type).toBe('casementSashPart')
    expect(openingNodes(back)[0].values.bottomHeight).toBe(62)
    // and the row BELOW, changed the same way, gets the ordinary rail
    const lowerKey = openingNodes(back)[1].key
    let lower = changeOpening(back, lowerKey, 'direct_glazed', PV_AFTER_SQL).tree
    lower = changeOpening(lower, openingNodes(lower)[1].key, 'opening_casement', PV_AFTER_SQL).tree
    expect(openingNodes(lower)[1].values.bottomHeight).toBe(83)
  })

  it('a two-column fanlight frame makes BOTH top openings fanlights', () => {
    const { tree } = buildCasementFrame(PV_AFTER_SQL, {
      width: 1800, height: 1300, openings: ['opening_casement'], product: 'casement',
    })
    const grid = applyGrid(tree, 2, 2)
    expect(columnCount(grid)).toBe(2)
    expect(rowCount(grid)).toBe(2)
    const nodes = openingNodes(grid)
    expect(nodes.map(n => openingLabel(grid, n)))
      .toEqual(['Fanlight A1', 'Fanlight B1', 'Casement Sash A2', 'Casement Sash B2'])
    expect(nodes.map(n => n.values.bottomHeight)).toEqual([62, 62, 83, 83])
  })
})

// ── The shared function is a MOVE, not a change ─────────────────────────────

describe.skipIf(!SNAPSHOT)('Step AS — default ironmongery is unchanged', () => {
  // The risk in moving the casement branch out of computePartVars is losing
  // one of the variables an ironmongery rule reads. These are the eleven the
  // Step AP branch returned, by name.
  const IRONMONGERY_VARS = [
    'to_be_replaced', 'is_opening', 'is_side_hung', 'is_top_hung', 'is_bottom_hung',
    'is_left_hand_hung_viewed_internally', 'is_right_hand_hung_viewed_internally',
    'is_french_casement_sash', 'is_casement_mpls',
    'gross_sash_width_in_mm', 'gross_sash_height_in_mm', 'weight_in_kg',
  ]

  it('every variable the ironmongery rules read is still provided', () => {
    for (const bm of [BENCHMARK_J, BENCHMARK_K, BENCHMARK_N, BENCHMARK_P,
                      BENCHMARK_Q, BENCHMARK_R, BENCHMARK_S]) {
      for (const sash of sashVars(bm.tree)) {
        for (const name of IRONMONGERY_VARS) {
          expect(sash[name], `${bm.name} / ${sash.label} / ${name}`).not.toBeUndefined()
        }
      }
    }
  })

  it('the default ironmongery lines are the same as Step AQ recorded them', () => {
    // K's list after the Step AQ finish rule: the handle in the item's PB,
    // the hinge / gearbox / extensions in the rule's PC, the vents in Wht.
    let { tree } = buildCasementFrame(PV, {
      width: 1199, height: 1299, openings: ['opening_casement'], product: 'casement',
    })
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    const cill = frame.children.find(c => c.part_type === 'cillPart')
    tree = applyDividers(tree, frame.key, 2, 1, 1125,
      1299 - 47 - cill.values.height, PICKER_PV, 'solid')
    tree = changeOpening(tree, openingNodes(tree)[1].key, 'direct_glazed', PV).tree

    const lines = resolveIronmongeryLines(tree, SNAPSHOT, SNAPSHOT.profileValues)
      .map(l => `${l.product_short_name}:${l.finish_code} x${l.qty}`).sort()
    expect(lines).toEqual([
      'connoisseur_handle_lh:PB x1',
      'defender_friction_hinge_-_side_hung_310mm:PC x1',
      'kenrick_extension_950mm:PC x2',
      'kenrick_extension_gear_box:PC x1',
      'trickle:Wht x1',
      'trickle_vent_xr16:Wht x1',
    ])
  })
})

// ── Step AU — stormproof validation ─────────────────────────────────────────
// Integrate shows "ADD QUOTE NOTE: Storm proof casement windows (not flush)"
// on EVERY stormproof sash (rule 43), and its fanlight bottom rail warning on
// a stormproof fanlight too (SB and SC keep the 76 rail, which is over 62).
describe.skipIf(!SNAPSHOT)('Step AU — stormproof validation', () => {
  const CASES = [
    ['SA', BENCHMARK_SA, 1], ['SB', BENCHMARK_SB, 2], ['SC', BENCHMARK_SC, 2],
    ['SD', BENCHMARK_SD, 2], ['SE', BENCHMARK_SE, 2], ['SF', BENCHMARK_SF, 1],
  ]

  it('rule 43 fires once per stormproof sash on every window', () => {
    for (const [label, bm, sashCount] of CASES) {
      const fired = firedOn(bm.tree)
        .filter(r => r.message === 'Storm proof casement windows (not flush)')
      expect(fired.length, label).toBe(sashCount)
    }
  })

  it('rules 42 and 44-46 evaluate and stay silent', () => {
    // 42 needs "not is_complete_new" (these are complete new), 44 a bottom-hung
    // sash, 45 a tilt and turn operation, 46 a top hung under 310 mm wide.
    for (const [label, bm] of CASES.map(c => [c[0], c[1]])) {
      const messages = firedOn(bm.tree).map(r => r.message)
      expect(messages, label).not.toContain('Storm proof sash replacement')
      expect(messages, label).not.toContain('Bottom hung stormproof casements')
      expect(messages, label).not.toContain('Tilt and turn windows')
      expect(messages, label).not.toContain('Top hung casement width')
    }
  })

  it('nothing is unevaluable on any stormproof window', () => {
    for (const [label, bm] of CASES.map(c => [c[0], c[1]])) {
      expect(unevaluableOn(bm.tree), label).toEqual([])
    }
  })

  it('the fanlight warning fires on a stormproof fanlight, as Integrate’s does', () => {
    // SB and SC keep the 76 rail (Nathan's decision), which is over 62, so
    // Integrate's own warning fires on their fanlights — correct, not a fault.
    for (const [label, bm] of [['SB', BENCHMARK_SB], ['SC', BENCHMARK_SC]]) {
      const fired = firedOn(bm.tree)
        .filter(r => r.message === 'Fanlight bottom rail should be reduced to 62mm externally')
      expect(fired.length, label).toBe(1)
      expect(fired[0].part_label, label).toBe('Fanlight A1')
    }
    // SA, SD, SE and SF have no fanlight at all
    for (const [label, bm] of [['SA', BENCHMARK_SA], ['SD', BENCHMARK_SD],
      ['SE', BENCHMARK_SE], ['SF', BENCHMARK_SF]]) {
      expect(firedOn(bm.tree).map(r => r.message), label)
        .not.toContain('Fanlight bottom rail should be reduced to 62mm externally')
    }
  })

  it('is_storm_proof comes from the sash TYPE, not a flag nothing sets', () => {
    for (const [label, bm] of CASES.map(c => [c[0], c[1]])) {
      for (const sash of sashVars(bm.tree)) {
        expect(sash.is_storm_proof, `${label} ${sash.label}`).toBe(true)
      }
    }
    // and a flush window's sashes are not stormproof
    for (const sash of sashVars(BENCHMARK_Q.tree)) {
      expect(sash.is_storm_proof).toBe(false)
    }
  })

  const RULE_12 = [{
    id: 'as-12', sort_order: 12, level: 'item', severity: 'error',
    name: 'No Curved Head Sash Replacements', loop_target: null,
    condition: 'new_sash_with_curved_head_qty > 0 and is_replacement_sashes_range',
    message: 'We do not offer sash replacements if the sashes have a curved top rail',
    is_active: true,
  }]

  it('rule 12 is evaluable on every casement benchmark, and silent', () => {
    // Folded in from Step AT: is_replacement_sashes_range is false rather
    // than missing, so the rule evaluates instead of coming out unevaluable.
    for (const [label, bm] of [['SA', BENCHMARK_SA], ['Q', BENCHMARK_Q], ['A', BENCHMARK_A]]) {
      const results = validate(bm.tree, { rules: RULE_12 })
      expect(results.filter(r => r.status === 'unevaluable'), label).toEqual([])
      expect(results.filter(r => r.status === 'fired'), label).toEqual([])
    }
  })

  // ── Step AY item 4: the range is WIRED ─────────────────────────────────────
  // is_replacement_sashes_range is profile code 'sashes_only', and every
  // caller now passes the drawing's code. Until Step AY nothing did, so this
  // ERROR rule could never fire however the drawing was drawn.
  describe('Step AY item 4 — is_replacement_sashes_range, wired', () => {
    /** A box sash tree with a CURVED head on the top sash. */
    function curvedHeadTree() {
      const tree = JSON.parse(JSON.stringify(BENCHMARK_A.tree))
      let found = 0
      ;(function walk(n) {
        if (n.part_type === 'topSashPart') {
          n.values = { ...n.values, curvedSashHead: true, toBeReplaced: true }
          found++
        }
        ;(n.children ?? []).forEach(walk)
      })(tree)
      expect(found, 'a top sash to curve').toBeGreaterThan(0)
      return tree
    }

    it('a SASHES-ONLY drawing with a curved head fires rule 12', () => {
      const fired = validate(curvedHeadTree(), { rules: RULE_12, profileCode: 'sashes_only' })
        .filter(r => r.status === 'fired')
      expect(fired).toHaveLength(1)
      expect(fired[0].severity).toBe('error')
      expect(fired[0].message).toMatch(/curved top rail/)
    })

    it('the same drawing on any other range does NOT fire it', () => {
      // The curved head is still there; only the range differs.
      for (const code of ['sash', 'casement', 'open_out_doors', null, '']) {
        const fired = validate(curvedHeadTree(), { rules: RULE_12, profileCode: code })
          .filter(r => r.status === 'fired')
        expect(fired, `profileCode ${JSON.stringify(code)}`).toEqual([])
      }
    })

    it('a CASEMENT does not fire it, whatever the range', () => {
      // A casement has no sliding sashes at all, so the curved-head count is
      // 0 and the rule stays silent even on the sashes-only range.
      for (const code of ['sashes_only', 'casement']) {
        const fired = validate(BENCHMARK_Q.tree, { rules: RULE_12, profileCode: code })
          .filter(r => r.status === 'fired')
        expect(fired, code).toEqual([])
      }
    })

    it('and the variable itself is the profile CODE, not a label', () => {
      const varsFor = code => computeVariables(
        curvedHeadTree(), computeDerived(curvedHeadTree(), PROFILE_VALUES),
        PF_VARIABLES, { profileCode: code },
      )
      expect(varsFor('sashes_only').is_replacement_sashes_range).toBe(true)
      expect(varsFor('Sashes Only').is_replacement_sashes_range).toBe(false)
      expect(varsFor('sash').is_replacement_sashes_range).toBe(false)
      expect(varsFor(undefined).is_replacement_sashes_range).toBe(false)
      // and the curved-head count is what makes the rule fire with it
      expect(varsFor('sashes_only').new_sash_with_curved_head_qty).toBeGreaterThan(0)
    })
  })
})
