// doorsetTemplates.test.js — Step BH items 2 and 3
//
// The five templates Nathan sells that Integrate has no template for. NONE of
// these is a reading: each is a composition of parts already matched penny for
// penny, so what is tested here is the COMPOSITION — the sizes, the openings,
// the leaves and the grids — and then the price on the LIVE rule set, with
// every fired rule named so the reviewer can check each line by hand.
//
// Pricing on the live rules (not on a rule set this test writes) is the Step BF
// follow-up lesson: an offline test that invents its own rules cannot fail
// while the live site is wrong.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import { prepareTemplateTree } from './templates.js'
import {
  DOORSET_TEMPLATES, buildDoorsetTemplate, buildFrenchDoorFrame, buildFrontDoorFrame,
  buildFrontDoorPairFrame, buildFrontDoorSetFrame, buildStableDoorSetFrame,
  stableSideLightMidRailOffset, isFrontDoorTree, isStableDoorTree,
  FRONT_DOOR_SET_DEFAULTS, SIDE_LIGHT_DEFAULTS,
} from './doorOpenings.js'
import { assertSaveable } from './containment.js'
import { frameInterior, frameCells, itemFrames } from '../pricing/casementGeometry.js'
import {
  doorLeaves, doorLeafSize, leafCells, leafInterior,
  stableDoorSize, allocatedSectionParts,
} from '../pricing/doorGeometry.js'
import {
  OPEN_IN_PROFILE_VALUES, DOOR_PROFILE_VALUES as OUT_PV,
} from '../pricing/benchmarks/fixtureDoor.js'
import { runPricingOnTree } from '../pricing/pricingEngine.js'
import { computeVariables } from '../pricing/computeVariables.js'
import { computeDerived } from './computeDerived.js'
import { resolveIronmongeryLines } from '../pricing/loadPricingContext.js'
import {
  FRENCH_MASTER_LOCK_RULE, FRONT_DOOR_NOT, SLAVE_CLAUSE, MASTER_CLAUSE,
  FRONT_DOOR_SET_RULES, FRONT_DOOR_PAIR_FITTING_RULE,
} from '../pricing/benchmarks/liveRuleFixes.js'
import { DOOR_PART_COST_MAP } from '../pricing/benchmarks/fixtureDoor.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = resolve(HERE, '../pricing/benchmarks/pf30-snapshot.json')
const SNAPSHOT = existsSync(SNAPSHOT_PATH)
  ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
  : null

const PV = OPEN_IN_PROFILE_VALUES

/**
 * BUILD IT THE WAY A SURVEYOR GETS IT (Step BH follow-up item 1).
 *
 * The builders return a TEMPLATE tree; a DRAWING is that tree through
 * prepareTemplateTree — fresh keys, item values cleared. Template 38 priced
 * 1,832.54 wrong live while this file passed, because the live path replaced
 * every key and left the short transom pointing at mullions that no longer
 * existed. One function stood between the two and no test crossed it. Every
 * tree here now does.
 */
const asDrawing = built => {
  expect(built.missing ?? [], 'missing profile values').toEqual([])
  const { tree } = prepareTemplateTree(built.tree)
  return { tree, missing: [] }
}
const frameOf = tree => itemFrames(tree)[0]
const openingsOf = tree => (frameOf(tree).children ?? []).filter(
  c => !['mullionPart', 'transomPart', 'cillPart'].includes(c.part_type))

/**
 * THE LIVE RULE SET. The reviewer refreshed the snapshot on 15 Oct, after
 * `sql/step-bh3` and `sql/step-bh4` ran, so the capture now holds every file
 * — the AV4 costs (bd1), the Croft pull (bd4), the shaped-glass rate (be1),
 * the stable-door set (bf3), the front-door-pair lock (bh1), the set on the
 * master leaf and the pair’s second leaf (bh3). The helpers that used to
 * stand in for them are gone.
 */
const LIVE = SNAPSHOT

/** Price a tree the way the live site does, with the live default ironmongery. */
function priceTree(tree, context = LIVE) {
  const derived = computeDerived(tree)
  const vars = computeVariables(tree, derived, context.pfVariables, { profileCode: 'open_in_doors' })
  const lines = resolveIronmongeryLines(tree, context, context.profileValues,
    { profileCode: 'open_in_doors' })
  const results = runPricingOnTree(tree, context.rules, context.pfVariables, {
    glassCatalogue: context.glassCatalogue,
    partAllocationRules: context.partAllocationRules,
    partCostMap: { ...DOOR_PART_COST_MAP, ...context.partCostMap },
    ironmongeryLines: lines,
    ironmongeryCatalogue: context.ironmongeryCatalogue,
    profileValues: context.profileValues,
    profileCode: 'open_in_doors',
  })
  return { results, lines, vars }
}

const fired = (group) => (group?.lines ?? [])
  .filter(l => (l.minutes ?? 0) > 0)
  .map(l => `${l.rule_name ?? l.name} ${l.minutes}`)

/** How many times a rule fired, and for how many minutes in all. */
const tally = (group) => {
  const out = {}
  for (const l of (group?.lines ?? [])) {
    if (!((l.minutes ?? 0) > 0)) continue
    const name = l.rule_name ?? l.name
    out[name] = out[name] ?? { fires: 0, minutes: 0 }
    out[name].fires += 1
    out[name].minutes += l.minutes
  }
  return out
}

describe('Step BH — a pair of front doors (item 2)', () => {
  const { tree, missing } = asDrawing(buildFrontDoorPairFrame(PV, {}))

  it('builds: 1500 x 2182, two leaves of 711 x 2068', () => {
    expect(missing).toEqual([])
    const f = frameOf(tree)
    expect([f.values.width, f.values.height]).toEqual([1500, 2182])
    // the open-in range: a 50 bottom and a 50 cill, stop 0
    expect(f.values.bottomHeight).toBe(50)
    expect(f.values.cillStopSize).toBe(0)
    expect(frameInterior(tree)).toMatchObject({ width: 1406, height: 2085 })
    // (1406 - 3 - 3 - 5 + 27) / 2 by 2085 - 3 - 14, the brief's own figures
    const leaves = doorLeaves(tree)
    expect(leaves.length).toBe(2)
    expect(leaves.map(l => doorLeafSize(tree, l)))
      .toEqual([{ width: 711, height: 2068 }, { width: 711, height: 2068 }])
    expect(leaves.every(l => l.values.casementTypeId === 'open_in')).toBe(true)
    expect(leaves.every(l => l.values.bottomHeight === 170)).toBe(true)
    expect(() => assertSaveable(tree)).not.toThrow()
  })

  it('each leaf is a 170 mid rail with ONE FLAT PANEL above and below', () => {
    for (const leaf of doorLeaves(tree)) {
      const cells = leafCells(tree, leaf)
      expect(cells.length).toBe(2)
      // 983 above the rail and 635 below it, of the 1788 interior
      expect(leafInterior(tree, leaf).height).toBe(1788)
      expect(cells.map(c => c.height)).toEqual([983, 635])
      // both cells are PANELS, and no muntin
      const panels = (leaf.children ?? []).filter(c => c.part_type === 'panelPart')
      expect(panels.length).toBe(2)
      expect(panels.every(p => p.values.internalPanelTypeId === 'flat')).toBe(true)
      expect((leaf.children ?? []).some(c => c.values?.isMuntin)).toBe(false)
    }
  })

  it('it is a FRONT door, and the right leaf is the master', () => {
    expect(isFrontDoorTree(tree)).toBe(true)
    const paint = (tree.children ?? []).find(c => c.part_type === 'paintAndIronmongeryPart')
    expect(paint.values.internalFinish).toBe('clean_white')
    expect(paint.values.externalFinish).toBe('custom')
    const pair = openingsOf(tree)[0]
    expect(pair.part_type).toBe('frenchDoorPart')
    expect(pair.values.masterLeaf).toBe('right')
    const master = doorLeaves(tree).find(l => l.values.isMasterLeaf)
    expect(master.part_type).toBe('rightFrenchDoorLeafPart')
  })

  it.skipIf(!SNAPSHOT)('prices as a FRONT door: rule 0 fires, French Doors does not', () => {
    const { results, vars } = priceTree(tree)
    expect(vars.is_front_door).toBe(true)
    expect(vars.door_leaf_qty).toBe(2)
    const fit = fired(results.install_labour)
    expect(fit.join(' | ')).toContain('Front Door and Frame (Base) 840')
    expect(fit.join(' | ')).not.toContain('French Doors')
    expect(fit.join(' | ')).not.toContain('Single Door Only')
    // production: a leaf each, four flat panels, the frame, and the DUAL
    // finish rules a front door fires
    const prod = tally(results.manufacture_labour)
    expect(prod['Door Leaf']).toEqual({ fires: 2, minutes: 2070 })
    expect(prod['Additional for Flat Panel']).toEqual({ fires: 4, minutes: 240 })
    expect(prod['Machining & Joining a Door Frame']).toEqual({ fires: 1, minutes: 855 })
    // the DUAL finish rules a front door fires, where a garden door fires
    // the single-finish ones
    expect(prod['Door Frame - Dual Finish']).toEqual({ fires: 1, minutes: 240 })
    // 180 A LEAF, in the rule's own value: one line of 360
    expect(prod['Door Leaf - Dual Finish']).toEqual({ fires: 1, minutes: 360 })
    expect(prod['Door Frame - Single Finish']).toBeUndefined()
    expect(results.price.total_cost).toBeGreaterThan(0)
  })

  it.skipIf(!SNAPSHOT)('the front-door set is on the MASTER leaf — sql/step-bh3 RAN', () => {
    // Item 4, and the file ran live on 15 Oct. The five front-door rules
    // carried `not is_master_leaf_in_french_pair`, so on a PAIR the master
    // was the one leaf excluded and the whole set went on the SLAVE — the
    // LEFT leaf, hence the left-hand locking system. They now carry
    // `not is_slave_leaf_in_french_pair`, so the set is on the master (the
    // RIGHT leaf) and comes RIGHT hand.
    const { lines } = priceTree(tree)
    expect(lines.map(l => [l.product_short_name, l.finish_code, l.qty])).toEqual([
      ['102mm_hinges', 'PB', 4],
      ['hardwick_classic_sleeved_letterbox', 'PB', 1],
      ['euro_cylinder_pull', 'PB', 1],
      ['av3_heritage_locking_system_rh', 'PC', 1],
    ])
    // two pairs of hinges, one per leaf, from the per-leaf rule
    expect(lines.find(l => l.product_short_name === '102mm_hinges').qty).toBe(4)
    // the clause itself, so the test names what it depends on
    for (const id of FRONT_DOOR_SET_RULES) {
      const rule = LIVE.ironmongeryRules.find(r => String(r.id ?? '').startsWith(id))
      expect(rule?.condition, id).toContain(SLAVE_CLAUSE)
    }
  })

  it.skipIf(!SNAPSHOT)('and on the SLAVE it would cost the same — the hands are level', () => {
    // Which is why item 4 moved no money: both hands of the heritage set
    // are £167.53. Undone, the set comes back left hand at the same cost.
    const undone = {
      ...LIVE,
      ironmongeryRules: LIVE.ironmongeryRules.map(r => (
        FRONT_DOOR_SET_RULES.some(id => String(r.id ?? '').startsWith(id))
          ? { ...r, condition: String(r.condition).replace(SLAVE_CLAUSE, MASTER_CLAUSE) }
          : r)),
    }
    const now = priceTree(tree)
    const was = priceTree(tree, undone)
    expect(was.lines.map(l => l.product_short_name)).toContain('av3_heritage_locking_system_lh')
    expect(now.lines.map(l => l.product_short_name)).toContain('av3_heritage_locking_system_rh')
    const ironOf = r => r.results.price.lines
      .filter(l => l.fires && l.name === 'Ironmongery Cost')
      .reduce((t, l) => t + l.line_cost, 0)
    expect(ironOf(now)).toBeCloseTo(ironOf(was), 2)
  })

  it.skipIf(!SNAPSHOT)('the second leaf is fitted: 840 + 120 = 16 h', () => {
    // Item 5, Nathan 15 Oct, live since sql/step-bh3. Integrate gives a pair
    // only the 840, because "French Doors Additional Door" carries
    // `not is_front_door` — so this 120 is GlazePro’s own (difference 22).
    const now = priceTree(tree)
    expect(now.results.install_labour.total_minutes).toBe(960)
    expect(fired(now.results.install_labour).join(' | '))
      .toContain('Front Door Pair Additional Door 120')

    // and what it is worth: 2 h at 40.21 = 80.42 of cost, 160.84 of price
    const without = {
      ...LIVE,
      rules: LIVE.rules.filter(r => r.name !== FRONT_DOOR_PAIR_FITTING_RULE),
    }
    const was = priceTree(tree, without)
    expect(was.results.install_labour.total_minutes).toBe(840)
    expect(now.results.price.total_cost - was.results.price.total_cost)
      .toBeCloseTo(80.42, 2)
    expect(now.results.price.total - was.results.price.total)
      .toBeCloseTo(160.84, 2)
  })

  it.skipIf(!SNAPSHOT)('and a single front door, a French pair and a stable door do NOT move', () => {
    // The fitting rule must touch nothing else: a single front door has no
    // pair, and a French pair and a stable door are not front doors.
    const without = {
      ...LIVE,
      rules: LIVE.rules.filter(r => r.name !== FRONT_DOOR_PAIR_FITTING_RULE),
    }
    const others = [
      ['a single front door', buildFrontDoorFrame(PV, {})],
      ['a French pair', buildFrenchDoorFrame(OUT_PV, {})],
      ['a stable door', buildStableDoorSetFrame(PV, {})],
    ]
    for (const [label, built] of others) {
      const { tree: other } = asDrawing(built)
      const now = priceTree(other)
      const was = priceTree(other, without)
      expect(now.results.install_labour.total_minutes, label)
        .toBe(was.results.install_labour.total_minutes)
      expect(now.results.price.total_cost, label)
        .toBeCloseTo(was.results.price.total_cost, 2)
    }
  })

  it.skipIf(!SNAPSHOT)('the FRENCH master lock does not fire — sql/step-bh1 RAN', () => {
    // Step BH’s finding, and the file ran live on 15 Oct: allocator rule
    // cebdd8b5 "MPLS master or tall – shootbolt" now carries
    // `not is_front_door`, so a pair of front doors no longer gets a
    // Winkhaus Thunderbolt (RJZ2382, £53.55) on top of its heritage lock.
    const codes = results => results.price.lines
      .filter(l => l.fires && l.name === 'Ironmongery Cost')
      .map(l => l.alloc_iron_part_code)

    // the live data as it stands
    const now = priceTree(tree)
    expect(codes(now.results)).not.toContain('RJZ2382')
    // and what it was before the file: the same £53.55 it was worth
    const RULE = 'cebdd8b5'
    const undone = {
      ...LIVE,
      partAllocationRules: LIVE.partAllocationRules.map(r => (
        String(r.id ?? '').startsWith(RULE)
          ? { ...r, condition: String(r.condition).replace(' and not is_front_door', '') }
          : r)),
    }
    const was = priceTree(tree, undone)
    expect(codes(was.results)).toContain('RJZ2382')
    expect(was.results.price.total_cost - now.results.price.total_cost)
      .toBeCloseTo(53.55, 2)

    // the SLAVE's bolts and keeps stay — Nathan 2 asks for them by name
    for (const part of ['RHZ1649', 'RHZ1653', 'RHZ1667']) {
      expect(codes(now.results), part).toContain(part)
    }
    // and a FRENCH pair keeps its Thunderbolt
    const french = asDrawing(buildFrenchDoorFrame(OUT_PV, {})).tree
    expect(codes(priceTree(french).results)).toContain('RJZ2382')
  })
})

describe('Step BH — front door with side lights and a fanlight (item 3b / 3c)', () => {
  const full = asDrawing(buildFrontDoorSetFrame(PV, { fanlight: 'full_width' }))
  const over = asDrawing(buildFrontDoorSetFrame(PV, { fanlight: 'over_door' }))

  it('full width: THREE fanlights over a side light, the door and a side light', () => {
    expect(full.missing).toEqual([])
    const tree = full.tree
    const f = frameOf(tree)
    expect([f.values.width, f.values.height]).toEqual([1806, 2654])
    // 94 + 365 + 41 + 900 + 41 + 365
    expect(frameInterior(tree).width).toBe(1712)
    const cells = frameCells(tree, frameOf(tree))
    expect(cells.length).toBe(6)
    expect(cells.slice(0, 3).map(c => Math.round(c.width))).toEqual([365, 900, 365])
    expect(openingsOf(tree).map(o => o.part_type)).toEqual([
      'glassPart', 'glassPart', 'glassPart',
      'casementSashPart', 'doorLeafPart', 'casementSashPart',
    ])
    expect(() => assertSaveable(tree)).not.toThrow()
  })

  it('over the door: ONE fanlight, and the side lights run full height', () => {
    expect(over.missing).toEqual([])
    const tree = over.tree
    const cells = frameCells(tree, frameOf(tree))
    expect(cells.length).toBe(4)
    // the two side lights are the full interior height, the door's column is split
    const tall = cells.filter(c => c.height > 2400)
    expect(tall.length).toBe(2)
    expect(openingsOf(tree).map(o => o.part_type)).toEqual([
      'casementSashPart', 'glassPart', 'casementSashPart', 'doorLeafPart',
    ])
    expect(() => assertSaveable(tree)).not.toThrow()
  })

  for (const [label, built] of [['full width', full], ['over the door', over]]) {
    it(`${label}: the door is 892 x 2068 with its muntin centred`, () => {
      const tree = built.tree
      const [leaf] = doorLeaves(tree)
      expect(doorLeafSize(tree, leaf)).toEqual({ width: 892, height: 2068 })
      // four cells: the Balham 983 / 635 and the muntin centred in the leaf
      const cells = leafCells(tree, leaf)
      expect(cells.length).toBe(4)
      expect(cells.map(c => c.height)).toEqual([983, 983, 635, 635])
      const muntin = (leaf.children ?? []).find(c => c.values?.isMuntin)
      const interior = leafInterior(tree, leaf)
      expect(muntin.values.offset)
        .toBe(Math.round((interior.width - muntin.values.muntinThickness) / 2))
    })

    it(`${label}: both side lights' mid rails meet the door's`, () => {
      const tree = built.tree
      const sashes = openingsOf(tree).filter(o => o.part_type === 'casementSashPart')
      expect(sashes.length).toBe(2)
      // both sashes are the same, and both carry a 170 mid rail
      const rails = sashes.map(s => (s.children ?? [])
        .find(c => c.part_type === 'transomPart').values)
      expect(rails[0].offset).toBe(rails[1].offset)
      expect(rails.every(r => r.thicknessInFrame === SIDE_LIGHT_DEFAULTS.midRailThickness)).toBe(true)

      // THE CLAIM: both rails are the same height above the bottom of the
      // opening they sit in. The door drops 14 into the frame and its rail
      // is 170; the sash drops 3 and its rail is 175 — so the two panels
      // differ by 6 mm and the rails meet.
      const [leaf] = doorLeaves(tree)
      const doorCells = leafCells(tree, leaf)
      const doorRailUp = 14 + 170 + doorCells[doorCells.length - 1].height
      const sashInterior = leafInterior(tree, sashes[0]).height
      const sashPanel = sashInterior - rails[0].offset - rails[0].thicknessInFrame
      const sashRailUp = 3 + SIDE_LIGHT_DEFAULTS.rails.bottom + sashPanel
      expect(sashRailUp).toBe(doorRailUp)
      // the panel below the rail is a FLAT panel, as the door's are
      const panel = (sashes[0].children ?? []).find(c => c.part_type === 'panelPart')
      expect(panel.values.internalPanelTypeId).toBe('flat')
    })

    it.skipIf(!SNAPSHOT)(`${label}: prices with the doorset rules`, () => {
      const { results } = priceTree(built.tree)
      const prod = tally(results.manufacture_labour)
      const fit  = fired(results.install_labour).join(' | ')
      // 1201 "Sidelights in Doorsets" 780 per fixed side sash, twice
      expect(prod['Sidelights in Doorsets']).toEqual({ fires: 2, minutes: 1560 })
      // the frame's three dividers at 180 each (1105). The rule loops the
      // FRAME, not the divider, and its value is already the total — so it
      // is one line of 540, not three of 180.
      expect(prod['Additional for Frame Mullion or Transom']).toEqual({ fires: 1, minutes: 540 })
      // six flat panels: four in the door, one in each side light
      expect(prod['Additional for Flat Panel']).toEqual({ fires: 6, minutes: 360 })
      // and it is still a FRONT door: 840 + 120 mullion + 90 transom
      expect(fit).toContain('Front Door and Frame (Base) 840')
      // 120 A MULLION (two of them) and 90 for the one transom
      expect(fit).toContain('Front Door and Frame (Mullion) 240')
      expect(fit).toContain('Front Door and Frame (Transom) 90')
      // and the lights' own fitting: 120 a fixed casement sash in a door
      expect(fit).toContain('Fixed Fanlight 240')
      expect(fit).not.toContain('French Doors')
      expect(results.price.total_cost).toBeGreaterThan(0)
    })
  }
})

describe('Step BH — a stable door with a fanlight or a side light (item 3d / 3e)', () => {
  const fan = asDrawing(buildStableDoorSetFrame(PV, { fanlight: true }))
  const side = asDrawing(buildStableDoorSetFrame(PV, { sideLight: { side: 'right' } }))

  it('the fanlight makes the frame taller and leaves the DOOR alone', () => {
    expect(fan.missing).toEqual([])
    const tree = fan.tree
    const f = frameOf(tree)
    expect([f.values.width, f.values.height]).toEqual([1099, 2679])
    expect(isStableDoorTree(tree)).toBe(true)
    expect(openingsOf(tree).map(o => o.part_type)).toEqual(['glassPart', 'stableDoorPart'])
    // the door's own cell is the 2110 it always was, so the container is 2103
    // and the halves are ST1's 1055 / 1048
    const container = openingsOf(tree).find(o => o.part_type === 'stableDoorPart')
    expect(stableDoorSize(tree, container)).toEqual({ width: 997, height: 2103 })
    expect(doorLeaves(tree).map(h => doorLeafSize(tree, h).height)).toEqual([1055, 1048])
    expect(() => assertSaveable(tree)).not.toThrow()
  })

  it('the side light takes its own column and the door keeps its 1005', () => {
    expect(side.missing).toEqual([])
    const tree = side.tree
    const f = frameOf(tree)
    expect([f.values.width, f.values.height]).toEqual([1505, 2207])
    expect(openingsOf(tree).map(o => o.part_type)).toEqual(['stableDoorPart', 'casementSashPart'])
    const cells = frameCells(tree, frameOf(tree))
    expect(cells.map(c => Math.round(c.width))).toEqual([1005, 365])
    const container = openingsOf(tree).find(o => o.part_type === 'stableDoorPart')
    expect(stableDoorSize(tree, container)).toEqual({ width: 997, height: 2103 })
    expect(() => assertSaveable(tree)).not.toThrow()
  })

  it('the side light’s mid rail TOP is level with the meeting rail’s', () => {
    // Nathan, 15 Oct: the TOP EDGES line up. The meeting rail’s top is
    // 4 + 1055 - 99 = 960 below the interior top; the mid rail’s is
    // 3 + 62 + offset. So the offset is 895, 16 mm up from the 911 that
    // aligned the two bands’ centres.
    expect(stableSideLightMidRailOffset({})).toBe(895)
    const sash = openingsOf(side.tree).find(o => o.part_type === 'casementSashPart')
    const rail = (sash.children ?? []).find(c => c.part_type === 'transomPart')
    expect(rail.values.offset).toBe(895)
    // its glass is 895 high and its panel 802, of the 1867 interior
    expect(leafInterior(side.tree, sash).height).toBe(1867)
    expect(leafCells(side.tree, sash).map(c => c.height)).toEqual([895, 802])
    // and it is glass over a FLAT panel, as template 32's side light is
    expect((sash.children ?? []).map(c => c.part_type))
      .toEqual(['transomPart', 'glassPart', 'panelPart'])
    expect((sash.children ?? []).find(c => c.part_type === 'panelPart')
      .values.internalPanelTypeId).toBe('flat')
  })

  it.skipIf(!SNAPSHOT)('both price as a STABLE door: rule 200 and no front-door rule', () => {
    for (const [label, built] of [['fanlight', fan], ['side light', side]]) {
      const { results, vars } = priceTree(built.tree)
      expect(vars.new_stable_door_pair_qty, label).toBe(1)
      expect(vars.is_front_door, label).toBe(false)
      const fit = fired(results.install_labour).join(' | ')
      expect(fit, label).toContain('Stable Door 900')
      expect(fit, label).not.toContain('Front Door')
      expect(fit, label).not.toContain('Single Door Only')
      const prod = tally(results.manufacture_labour)
      expect(prod['Door Leaf'], label).toEqual({ fires: 2, minutes: 2070 })
      // one divider: the transom over the door, or the mullion beside it
      expect(prod['Additional for Frame Mullion or Transom'], label)
        .toEqual({ fires: 1, minutes: 180 })
      expect(results.price.total_cost, label).toBeGreaterThan(0)
    }
  })

  it.skipIf(!SNAPSHOT)('the side light is charged as a door’s timber, and the fanlight as glass', () => {
    const sections = tree => Object.fromEntries(
      allocatedSectionParts(tree).map(x => [x.part_code, x.length_mm]))
    // the side light's own sash timber, as Step BE's (difference 18)
    expect(sections(side.tree).Utile63x200).toBeGreaterThan(sections(fan.tree).Utile63x200 ?? 0)
  })
})

describe('Step BH — the five templates are one definition', () => {
  it('every template builds, is saveable and has no empty required field', () => {
    expect(DOORSET_TEMPLATES.length).toBe(5)
    for (const t of DOORSET_TEMPLATES) {
      const { tree, missing } = asDrawing(buildDoorsetTemplate(t, PV))
      expect(missing, t.name).toEqual([])
      expect(tree, t.name).toBeTruthy()
      expect(() => assertSaveable(tree), t.name).not.toThrow()
    }
  })

  it('the groups are the two Nathan named', () => {
    expect(DOORSET_TEMPLATES.filter(t => t.group_name === 'Open In Doors').length).toBe(3)
    expect(DOORSET_TEMPLATES.filter(t => t.group_name === 'Cottage Doors').length).toBe(2)
    // and the sort orders follow the front-door (200s) and stable (300s) runs
    expect(DOORSET_TEMPLATES.map(t => t.sort_order)).toEqual([240, 250, 260, 330, 340])
  })

  it('the brief’s starting sizes are what they build at', () => {
    const sizes = {}
    for (const t of DOORSET_TEMPLATES) {
      const f = frameOf(asDrawing(buildDoorsetTemplate(t, PV)).tree)
      sizes[t.name] = [f.values.width, f.values.height]
    }
    expect(sizes).toEqual({
      'Pair Of Front Doors': [1500, 2182],
      'Front Door With Side Lights And Fanlight': [FRONT_DOOR_SET_DEFAULTS.width, 2654],
      'Front Door With Side Lights And Fanlight Over Door': [FRONT_DOOR_SET_DEFAULTS.width, 2654],
      'Stable Door With Fanlight': [1099, 2679],
      'Stable Door With Side Light': [1505, 2207],
    })
  })
})
