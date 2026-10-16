// archAndPanel.test.js — Step BM items 1, 2 and 4
//
// The board side of the live-quote comparison: an arched sash, a double box's
// second bay, and the panel the board adds to a door leaf.
//
// Item 1 turned out NOT to be a board fault — see the arch describe below and
// docs/reports/step-bm.md. Item 2 was, and it was costing bay two of every
// double box its true width.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import { computeDerived } from './computeDerived.js'
import { computeVariables } from '../pricing/computeVariables.js'
import { mullionThicknessMm } from './sashGeometry.js'
import { setLeafMidRail, DEFAULT_PANEL_VALUES } from './doorOpenings.js'
import { runPricingOnTree } from '../pricing/pricingEngine.js'
import { BENCHMARK_C } from '../pricing/benchmarks/fixtureC.js'
import {
  BENCHMARK_LQ3, BENCHMARK_LQ5, BENCHMARK_LQ6,
} from '../pricing/benchmarks/fixtureLiveQuotes.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = resolve(HERE, '../pricing/benchmarks/pf30-snapshot.json')
const SNAPSHOT = existsSync(SNAPSHOT_PATH)
  ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
  : null

/** The Sash profile's hollow mullion section — 144, which is NOT LQ6's 220. */
const BOX_PV = { thicknessInFrameHollow: 144 }

const derivedFor = (tree, pv) => computeDerived(tree, pv)

const findAllOf = (tree, type) => {
  const out = []
  ;(function walk(n) {
    if (!n) return
    if (n.part_type === type) out.push(n)
    for (const c of (n.children ?? [])) walk(c)
  })(tree)
  return out
}

// ── Item 2: the double box's second bay ─────────────────────────────────────

describe('Step BM item 2 — a double box measures its own mullion', () => {
  it('the mullion’s OWN thickness wins over the profile’s', () => {
    const mull = { part_type: 'mullionPart', values: { thicknessInFrame: 220 } }
    // This returned 144 whenever a profile was given, whatever the drawing said
    expect(mullionThicknessMm(mull, BOX_PV, { hollow: true })).toBe(220)
    // and the profile is still the fallback for a mullion that stores none
    const bare = { part_type: 'mullionPart', values: {} }
    expect(mullionThicknessMm(bare, BOX_PV, { hollow: true })).toBe(144)
  })

  it('a mullion with no thickness and no profile still throws', () => {
    const bare = { part_type: 'mullionPart', values: {} }
    expect(() => mullionThicknessMm(bare, {}, { hollow: true }))
      .toThrow(/thicknessInFrameHollow/)
  })

  it('BOTH bays of LQ6 get the same width, radius and shoulder', () => {
    // 1620 wide, 85 jambs, a 220 mullion at 615: two bays of 615, each sash
    // 610 after the 2.5 clearances. Measured at 144, bay two came out 691 of
    // opening and 686 of sash — 76 mm too wide — and its arch radius derived
    // as 296.82 against bay one's 256, which is what the reviewer read on
    // live drawings 122 and 123.
    const d = derivedFor(BENCHMARK_LQ6.tree, BOX_PV)
    const pairs = findAllOf(BENCHMARK_LQ6.tree, 'sashPairPart')
    expect(pairs.length).toBe(2)
    const widths = pairs.map(p => d[p.key]?.sashWidth)
    expect(widths).toEqual([610, 610])

    const tops = pairs.map(p => findAllOf(p, 'topSashPart')[0])
    expect(tops.map(t => d[t.key]?.archRadius)).toEqual([256, 256])
    expect(tops.map(t => d[t.key]?.shoulderHeight)).toEqual([470.5, 470.5])
    // Integrate's own figures for both bays
    expect(d[tops[0].key].archRadius).toBe(256)
  })

  it('and so both bays price the same glass', () => {
    if (!SNAPSHOT) return
    const r = runPricingOnTree(BENCHMARK_LQ6.tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: BENCHMARK_LQ6.partCostMap,
      ironmongeryLines: BENCHMARK_LQ6.ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: BENCHMARK_LQ6.profileValues,
    })
    const q = name => r.price.lines
      .filter(l => l.fires && !l.error && l.name === name)
      .map(l => Number(l.quantity.toFixed(2)))
    expect(q('Square Glass Cost')).toEqual([0.40, 0.40])
    expect(q('Shaped Glass Cost')).toEqual([0.50, 0.50])
    // the symmetric drawing prices symmetrically, which is the point
  })
})

// ── Item 1: the arched sash, board path, against fixture C ──────────────────

describe('Step BM item 1 — an arched sash reads its arch the same way as C', () => {
  it('a FRAME-level arch derives Integrate’s own radius and shoulder', () => {
    // LQ5: box sash 780 x 1769, rise 363, Integrate R 270 and shoulder 358.5.
    const d = derivedFor(BENCHMARK_LQ5.tree, BOX_PV)
    const top = findAllOf(BENCHMARK_LQ5.tree, 'topSashPart')[0]
    expect(d[top.key].archRadius).toBeCloseTo(270, 1)      // Integrate 270
    expect(d[top.key].shoulderHeight).toBeCloseTo(358.5, 1) // Integrate 358.5
  })

  it('a SASH-level arch in a SQUARE frame derives its own too', () => {
    // LQ6: rise 256, Integrate R 256 and shoulder 470.5, and the frame head
    // stays square — there is no isFrameLevelArch on these sashes.
    const d = derivedFor(BENCHMARK_LQ6.tree, BOX_PV)
    const top = findAllOf(BENCHMARK_LQ6.tree, 'topSashPart')[0]
    expect(top.values.isFrameLevelArch).toBeUndefined()
    expect(top.values.archHead).toBe(true)
    expect(d[top.key].archRadius).toBe(256)
    expect(d[top.key].shoulderHeight).toBe(470.5)
    // and the FRAME is not arched
    const frame = findAllOf(BENCHMARK_LQ6.tree, 'assemblyFramePart')[0]
    expect(frame.values.archHead).toBe(false)
  })

  it('the arch inputs are read the same on LQ5 as on benchmark C', () => {
    // C is a frame-level arch too, and the same three fields drive it: the
    // top sash's archHead, its archHeight (the GLASS rise) and
    // isFrameLevelArch. Both derive a radius and a shoulder from the sash's
    // own chord, so the board path is not reading anything C does not.
    const cTop = findAllOf(BENCHMARK_C.tree, 'topSashPart')[0]
    const lqTop = findAllOf(BENCHMARK_LQ5.tree, 'topSashPart')[0]
    for (const f of ['archHead', 'isFrameLevelArch']) {
      expect(cTop.values[f], `C ${f}`).toBe(true)
      expect(lqTop.values[f], `LQ5 ${f}`).toBe(true)
    }
    expect(typeof cTop.values.archHeight).toBe('number')
    expect(typeof lqTop.values.archHeight).toBe('number')
    const dc = derivedFor(BENCHMARK_C.tree, BOX_PV)
    const dl = derivedFor(BENCHMARK_LQ5.tree, BOX_PV)
    for (const [label, d, top] of [['C', dc, cTop], ['LQ5', dl, lqTop]]) {
      expect(d[top.key]?.archRadius, `${label} radius`).toBeGreaterThan(0)
      expect(d[top.key]?.shoulderHeight, `${label} shoulder`).toBeGreaterThan(0)
    }
  })

  it('and they price by the SAME rule — C’s declared decision e, not a bug', () => {
    if (!SNAPSHOT) return
    // Both bill the largest rectangle of the cut glass plus the supplier's
    // quarter, at the SQUARE rate, where Integrate bills the exact shaped
    // area at its shaped rate. That is Nathan's decision e, declared on C as
    // £7.37; LQ5 is the same mechanism on a bigger arch.
    const run = bm => runPricingOnTree(bm.tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: bm.partCostMap,
      ironmongeryLines: bm.ironmongeryLines ?? [],
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: bm.profileValues,
    })
    const rate = bm => {
      const l = run(bm).price.lines
        .find(x => x.fires && !x.error && x.name === 'Shaped Glass Cost')
      return Math.round((l.line_cost / l.quantity) * 100) / 100
    }
    // the SQUARE rate, 58.50 — not Integrate's shaped 71.88
    expect(rate(BENCHMARK_C)).toBeCloseTo(58.50, 1)
    expect(rate(BENCHMARK_LQ5)).toBeCloseTo(58.50, 1)
    expect(rate(BENCHMARK_LQ6)).toBeCloseTo(58.50, 1)
    // and C declares the difference it causes
    expect(BENCHMARK_C.deliberateDifference?.cost).toBeCloseTo(7.37, 2)
  })
})

// ── Item 4: the panel the board adds ────────────────────────────────────────

describe('Step BM item 4 — the added panel stays FLAT', () => {
  /** A French pair whose left leaf already carries a RAISED AND FIELDED panel. */
  const pairWithPanels = (leftPanel = true) => ({
    key: 'item1', part_type: 'drawingItemPart', values: { typeOfWork: 'complete_new' },
    children: [{
      key: 'frame1', part_type: 'assemblyFramePart',
      values: { width: 1600, height: 2150 },
      children: [{
        key: 'fr1', part_type: 'frenchDoorPart', values: {},
        children: [
          {
            key: 'fr_left', part_type: 'leftFrenchDoorLeafPart', values: { toBeReplaced: true },
            children: leftPanel ? [
              { key: 'fr_left_midrail', part_type: 'transomPart',
                values: { isMidrail: true, offset: 1217 }, children: [] },
              { key: 'fr_left_glass', part_type: 'glassPart', values: {}, children: [] },
              { key: 'fr_left_panel', part_type: 'panelPart',
                values: {
                  internalPanelTypeId: 'raised_and_fielded',
                  externalPanelTypeId: 'raised_and_fielded',
                  internalPanelBeadId: 'ovolo',
                  externalPanelBeadId: 'ovolo',
                  insulationThickness: 15,
                }, children: [] },
            ] : [{ key: 'fr_left_glass', part_type: 'glassPart', values: {}, children: [] }],
          },
          {
            key: 'fr_right', part_type: 'rightFrenchDoorLeafPart', values: { toBeReplaced: true },
            children: [{ key: 'fr_right_glass', part_type: 'glassPart', values: {}, children: [] }],
          },
        ],
      }],
    }],
  })

  const panelOf = (tree, leafKey) => {
    const leaf = findAllOf(tree, 'leftFrenchDoorLeafPart')
      .concat(findAllOf(tree, 'rightFrenchDoorLeafPart'))
      .find(l => l.key === leafKey)
    return (leaf?.children ?? []).find(c => c.part_type === 'panelPart')
  }

  it('"Add mid rail and panel" makes a FLAT panel, ovolo both faces', () => {
    // The correction (16 Oct): Integrate's panel types are 110 Flat, 112
    // Raised & fielded, 114 VTG, 116 HTG, and its beads 120 Ovolo, 126
    // Bolection, 320 Bespoke. Every panel the reviewer has read on a live
    // drawing is a 110 over a 120 bead, so flat with ovolo beads on both
    // faces is RIGHT and the board must not reach for anything dearer.
    const out = setLeafMidRail(pairWithPanels(false), 'fr_right', { offset: 1217 })
    const p = panelOf(out, 'fr_right')
    expect(p).toBeTruthy()
    expect(p.values.internalPanelTypeId).toBe('flat')
    expect(p.values.externalPanelTypeId).toBe('flat')
    expect(p.values.internalPanelBeadId).toBe('ovolo')
    expect(p.values.externalPanelBeadId).toBe('ovolo')
    expect(p.values.insulationThickness).toBe(DEFAULT_PANEL_VALUES.insulationThickness)
    expect(p.values.toBeReplaced).toBe(true)
  })

  it('and it stays flat even beside a raised-and-fielded neighbour', () => {
    // An interim fix had it copy the other leaf's panel, which would have
    // made this one raised and fielded and charged 120 minutes instead of 60.
    // The correction reverts that: the neighbour is not evidence.
    const out = setLeafMidRail(pairWithPanels(), 'fr_right', { offset: 1217 })
    const p = panelOf(out, 'fr_right')
    expect(p.values.internalPanelTypeId).toBe('flat')
    expect(p.values.externalPanelTypeId).toBe('flat')
    expect(DEFAULT_PANEL_VALUES.internalPanelTypeId).toBe('flat')
    expect(DEFAULT_PANEL_VALUES.externalPanelTypeId).toBe('flat')
  })

  it('an existing panel on the SAME leaf is kept, not replaced', () => {
    // Moving the mid rail must not re-make the panel the surveyor has set —
    // a surveyor who HAS chosen raised and fielded keeps it.
    const out = setLeafMidRail(pairWithPanels(), 'fr_left', { offset: 1300 })
    const p = panelOf(out, 'fr_left')
    expect(p.key).toBe('fr_left_panel')
    expect(p.values.internalPanelTypeId).toBe('raised_and_fielded')
  })

  it('removing the mid rail takes its panel with it', () => {
    const out = setLeafMidRail(pairWithPanels(), 'fr_left', { offset: null })
    expect(panelOf(out, 'fr_left')).toBeUndefined()
  })
})

// ── Item 4, the other half: a mid rail DOES count ───────────────────────────
//
// Step BM measured this change, found it moved six benchmarks, and reverted it
// rather than tune them — FD4, FT1-FT4 became exactly Integrate, but live LQ3
// went two hours over, and there was no discriminator between LQ3 and FD4.
//
// The BM follow-up settles it, and LQ3 was never a counter-example. Integrate's
// labour editor on L33022 Q5 item 12 (LQ3), read 16 Oct 17:00:
//
//   Door Leaf 2 x 1035, Additional for Glazing Bars (door) 2 x 30,
//   DOOR MUNTIN 2 x 60, ADDITIONAL FOR FLAT PANEL 2 x 60, Door Frame 855,
//   Glazing 2 x 20, Glazing with Bar 2 x 12 + 2 x 12,
//   Door Frame Single Finish 180, Door Leaf Single Finish 2 x 90
//   = 3,673 min = 61.22 h, which is Integrate's own price line.
//
// So the mid rails count AND the panels are flat. The LQ3 fixture carried
// RAISED AND FIELDED panels, because the facts file wrongly called Integrate's
// type 110 raised and fielded. R&F 2 x 120 is exactly flat 2 x 60 plus muntin
// 2 x 60, so a wrong fixture with an uncounted mid rail landed on the right
// total — which is precisely what made it read as a contradiction.
//
// The reviewer also confirmed L34242 Q2 item 8's leaves carry no MullionPart,
// only a TransomPart 170 isMidrail each, so its Door Muntin 4 x 60 is four mid
// rails and not the real muntins I had guessed at.

describe('Step BM follow-up — a mid rail counts as a muntin', () => {
  /** One French leaf: a 170 mid rail, a type-110 FLAT panel, no real muntin. */
  const leafWithMidRail = () => ({
    key: 'item1', part_type: 'drawingItemPart',
    values: { typeOfWork: 'complete_new' },
    children: [{
      key: 'frame1', part_type: 'assemblyFramePart',
      values: { width: 1600, height: 2150 },
      children: [{
        key: 'fr1', part_type: 'frenchDoorPart', values: {},
        children: [{
          key: 'fr_left', part_type: 'leftFrenchDoorLeafPart',
          values: { toBeReplaced: true },
          children: [
            { key: 'mr', part_type: 'transomPart',
              values: { isMidrail: true, offset: 1217, thickness: 170 }, children: [] },
            { key: 'gl', part_type: 'glassPart', values: {}, children: [] },
            { key: 'pn', part_type: 'panelPart',
              values: { internalPanelTypeId: 'flat', externalPanelTypeId: 'flat' },
              children: [] },
          ],
        }],
      }],
    }],
  })

  it('a leaf with a mid rail and NO muntin counts ONE', () => {
    const t = leafWithMidRail()
    const v = computeVariables(t, derivedFor(t, {}), {})
    expect(v.sash_muntin_to_be_replaced_qty).toBe(1)
  })

  it('a real muntin AND a mid rail count two', () => {
    // mullionPart inside a leaf is Integrate's real muntin. L34268 item 2 is
    // this shape — a leaf transom plus a leaf mullion — and reads 2 x 60.
    const t = leafWithMidRail()
    t.children[0].children[0].children[0].children.push(
      { key: 'mu', part_type: 'mullionPart', values: { offset: 300 }, children: [] })
    const v = computeVariables(t, derivedFor(t, {}), {})
    expect(v.sash_muntin_to_be_replaced_qty).toBe(2)
  })

  it('a casement sash mid rail counts when the item HAS a door leaf', () => {
    // L34355 Q4 item 7: two side-casement mid rails plus a leaf transom and a
    // leaf mullion, 4 x 60. The side casement's rail is the one dividing glass
    // from panel.
    const t = leafWithMidRail()
    t.children[0].children.push({
      key: 'cas1', part_type: 'casementSashPart', values: { operation: 'fix' },
      children: [
        { key: 'cas1_mr', part_type: 'transomPart',
          values: { isMidrail: true, offset: 900, thickness: 170 }, children: [] },
        { key: 'cas1_gl', part_type: 'glassPart', values: {}, children: [] },
        { key: 'cas1_pn', part_type: 'panelPart',
          values: { internalPanelTypeId: 'flat', externalPanelTypeId: 'flat' }, children: [] },
      ],
    })
    const v = computeVariables(t, derivedFor(t, {}), {})
    expect(v.sash_muntin_to_be_replaced_qty).toBe(2)
  })

  it('but a casement sash mid rail counts NOTHING with no door leaf', () => {
    // A plain casement window. "Door Muntin" is gated on new_door_leaf_qty >= 1
    // anyway, but this variable is also read by the two sash-window "Real
    // Glazing Bar" rules, so it must not pick up a window's transom.
    const t = {
      key: 'item1', part_type: 'drawingItemPart',
      values: { typeOfWork: 'complete_new' },
      children: [{
        key: 'frame1', part_type: 'assemblyFramePart',
        values: { width: 1200, height: 1300 },
        children: [{
          key: 'cas1', part_type: 'casementSashPart', values: { operation: 'fix' },
          children: [
            { key: 'cas1_mr', part_type: 'transomPart',
              values: { isMidrail: true, offset: 650, thickness: 170 }, children: [] },
            { key: 'cas1_gl', part_type: 'glassPart', values: {}, children: [] },
          ],
        }],
      }],
    }
    const v = computeVariables(t, derivedFor(t, {}), {})
    expect(v.sash_muntin_to_be_replaced_qty).toBe(0)
  })

  it('LQ3 still prices at Integrate’s 61.22 h — now as flat plus muntin', () => {
    if (!SNAPSHOT) return
    const r = runPricingOnTree(BENCHMARK_LQ3.tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
      glassCatalogue: SNAPSHOT.glassCatalogue,
      partAllocationRules: SNAPSHOT.partAllocationRules,
      partCostMap: BENCHMARK_LQ3.partCostMap,
      ironmongeryLines: BENCHMARK_LQ3.ironmongeryLines,
      ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
      profileValues: BENCHMARK_LQ3.profileValues,
      profileCode: BENCHMARK_LQ3.profileCode ?? null,
    })
    // The SAME total as before the follow-up, reached the RIGHT way round:
    // flat 2 x 60 + Door Muntin 2 x 60, where it used to be R&F 2 x 120.
    expect(r.manufacture_labour.total_minutes / 60).toBeCloseTo(61.22, 2)
  })

  it('and LQ3’s panels are FLAT, which is what makes that total honest', () => {
    const panels = findAllOf(BENCHMARK_LQ3.tree, 'panelPart')
    expect(panels.length).toBe(2)
    for (const p of panels) {
      expect(p.values.internalPanelTypeId).toBe('flat')
      expect(p.values.externalPanelTypeId).toBe('flat')
      expect(p.values.internalPanelBeadId).toBe('ovolo')
      expect(p.values.externalPanelBeadId).toBe('ovolo')
    }
  })
})
