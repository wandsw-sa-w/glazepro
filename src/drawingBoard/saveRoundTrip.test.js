// saveRoundTrip.test.js — Step BH follow-up 2 item 1
//
// A ROUND TRIP: build the tree, create the drawing from it the way the app
// does, SAVE it the way the app does, LOAD it back the way the app does, and
// only then read the cells and the price.
//
// This is the test that was missing. Step BH's template test priced the
// BUILDER's tree; the follow-up moved it to `prepareTemplateTree`'s tree. Both
// stop short of the database, and the database is where the keys change for
// the second time: `drawing_parts` has no key column, so the rows get ids and
// `loadDrawingParts` keys the tree by `String(row.id)`. A short divider's
// `startDivider` / `endDivider` kept pointing at the client keys, resolved to
// nothing, and the frame was read as a 3 x 2 grid of six cells — £7,095.53
// against £8,936.47, with four panels of NEGATIVE area.
//
// THE FAKE below is `drawing_parts`: it flattens exactly as
// `api.js saveDrawingParts` does, hands out its own ids, and rebuilds exactly
// as `loadDrawingParts` does — including that it keys by the row id and keeps
// nothing of the client key. It also renumbers on every save, which the real
// table is free to do, and the fix has to survive.

import { describe, it, expect } from 'vitest'
import SNAPSHOT from '../pricing/benchmarks/pf30-snapshot.json'

import {
  buildFrontDoorSetFrame, buildFrontDoorPairFrame, buildStableDoorSetFrame,
  DOORSET_TEMPLATES, buildDoorsetTemplate,
} from './doorOpenings.js'
import { prepareTemplateTree } from './templates.js'
import {
  fixDividerRefsAfterSave, deadDividerRefs, hasDividerRefs, dividerRefMap,
} from './dividerRefs.js'
import { splitOpening } from './gridActions.js'
import { frameCells, itemFrames } from '../pricing/casementGeometry.js'
import { doorLeaves, doorLeafSize, leafCells } from '../pricing/doorGeometry.js'
import { runPricingOnTree } from '../pricing/pricingEngine.js'
import { resolveIronmongeryLines } from '../pricing/loadPricingContext.js'
import {
  OPEN_IN_PROFILE_VALUES as PV, DOOR_PART_COST_MAP,
} from '../pricing/benchmarks/fixtureDoor.js'
import { validateDrawing } from '../validation/validate.js'

// ── The fake drawing_parts ───────────────────────────────────────────────────

/**
 * `saveDrawingParts` + `loadDrawingParts`, faithfully: the client keys go in,
 * row ids come out, and nothing of the client key is kept.
 *
 * `nextId` starts wherever the caller says, so a second save renumbers
 * everything — which is the case the positional fix exists for.
 */
function makeDb(nextId = 1000) {
  let id = nextId
  return {
    /** What the app sends: the tree flattened to key / parent_key rows. */
    save(tree) {
      const rows = []
      const flatten = (node, parentKey, sortOrder) => {
        rows.push({
          key: node.key,
          parent_key: parentKey ?? null,
          part_type: node.part_type,
          sort_order: sortOrder,
          values: node.values ?? {},
        })
        ;(node.children ?? []).forEach((c, i) => flatten(c, node.key, i))
      }
      flatten(tree, null, 0)

      // the database assigns ids, in insertion order, and forgets the keys
      const idOf = new Map()
      const stored = rows.map(r => {
        const rowId = id++
        idOf.set(r.key, rowId)
        return { ...r, id: rowId }
      })
      this.rows = stored.map(r => ({
        id: r.id,
        parent_part_id: r.parent_key == null ? null : idOf.get(r.parent_key),
        part_type: r.part_type,
        sort_order: r.sort_order,
        // a COPY, as jsonb is: the saved values do not share objects with the
        // tree that was saved
        values: JSON.parse(JSON.stringify(r.values)),
      }))
      return this.rows.length
    },

    /** What the app reads back: keys are `String(row.id)`. */
    load() {
      const byId = {}
      for (const row of this.rows) {
        byId[row.id] = { ...row, key: String(row.id), children: [] }
      }
      let root = null
      for (const row of this.rows) {
        const node = byId[row.id]
        if (row.parent_part_id === null) root = node
        else byId[row.parent_part_id]?.children.push(node)
      }
      const sortChildren = n => {
        n.children.sort((a, b) => a.sort_order - b.sort_order)
        n.children.forEach(sortChildren)
      }
      if (root) sortChildren(root)
      return root
    },

    /** The one write the fix makes: a row's values, by key. */
    update(changed) {
      for (const { key, values } of changed) {
        const row = this.rows.find(r => String(r.id) === String(key))
        if (row) row.values = JSON.parse(JSON.stringify(values))
      }
      return changed.length
    },
  }
}

/** Create from a template, save, fix, load — the whole live path. */
function throughTheDatabase(templateTree, { nextId = 1000, times = 1 } = {}) {
  const { tree: created } = prepareTemplateTree(templateTree)
  const db = makeDb(nextId)
  let saved = created
  let loaded = null
  for (let i = 0; i < times; i++) {
    db.save(saved)
    loaded = db.load()
    // THE FIX, as api.js runs it after every save
    const { changed } = fixDividerRefsAfterSave(saved, loaded)
    db.update(changed)
    loaded = db.load()
    saved = loaded          // the next save sends what the board loaded
  }
  return { created, loaded, db }
}

const frameOf = tree => itemFrames(tree)[0]
const cellsOf = tree => frameCells(tree, frameOf(tree))
  .map(c => `${c.col},${c.row} ${Math.round(c.width)}x${Math.round(c.height)}`)

function price(tree) {
  const lines = resolveIronmongeryLines(tree, SNAPSHOT, SNAPSHOT.profileValues,
    { profileCode: 'open_in_doors' })
  return runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
    glassCatalogue: SNAPSHOT.glassCatalogue,
    partAllocationRules: SNAPSHOT.partAllocationRules,
    partCostMap: DOOR_PART_COST_MAP,
    ironmongeryLines: lines,
    ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
    profileValues: SNAPSHOT.profileValues,
    profileCode: 'open_in_doors',
  })
}

// ── The round trip ──────────────────────────────────────────────────────────

describe('Step BH follow-up 2 — a short divider survives the database', () => {
  const template = buildFrontDoorSetFrame(PV, { fanlight: 'over_door' }).tree

  it('the fake really is the database: keys become row ids', () => {
    const { created, loaded } = throughTheDatabase(template)
    expect(created.key).not.toBe(loaded.key)
    expect(Number(loaded.key)).toBeGreaterThan(0)
    // and every node's key is a row id
    const keys = []
    ;(function walk(n) { keys.push(n.key); (n.children ?? []).forEach(walk) })(loaded)
    expect(keys.every(k => /^\d+$/.test(k))).toBe(true)
  })

  it('every reference resolves after the save', () => {
    const { loaded } = throughTheDatabase(template)
    expect(hasDividerRefs(loaded)).toBe(true)
    expect(deadDividerRefs(loaded)).toEqual([])
  })

  it('the cells are the SAME four, not six', () => {
    const { created, loaded } = throughTheDatabase(template)
    expect(cellsOf(loaded)).toEqual(cellsOf(created))
    expect(cellsOf(loaded).length).toBe(4)
  })

  it('the door is 892 x 2068, and no cell is negative', () => {
    const { loaded } = throughTheDatabase(template)
    const [leaf] = doorLeaves(loaded)
    expect(doorLeafSize(loaded, leaf)).toEqual({ width: 892, height: 2068 })
    for (const cell of leafCells(loaded, leaf)) {
      expect(cell.width).toBeGreaterThan(0)
      expect(cell.height).toBeGreaterThan(0)
    }
  })

  it('and it prices what the report says: £8,936.47', () => {
    const { created, loaded } = throughTheDatabase(template)
    expect(price(loaded).price.total).toBeCloseTo(8936.47, 1)
    // the same as before the database, which is the whole point
    expect(price(loaded).price.total).toBeCloseTo(price(created).price.total, 2)
  })

  it('WITHOUT the fix it is the live bug, to the penny', () => {
    // The same round trip with the re-pointing left out: the references die,
    // the frame reads as six cells, the panels go negative — and the guard of
    // item 2 refuses them, which is the £7,517.43 the reviewer saw on
    // drawing 60 rather than the original £7,095.53.
    const { tree: created } = prepareTemplateTree(template)
    const db = makeDb(2000)
    db.save(created)
    const loaded = db.load()
    expect(deadDividerRefs(loaded).length).toBe(2)
    expect(cellsOf(loaded).length).toBe(6)
    expect(price(loaded).price.total).toBeCloseTo(7517.43, 1)
    // and the panels that cannot be made are named rather than priced
    expect((price(loaded).warnings ?? []).filter(w => /usable size/.test(w)).length)
      .toBe(4)
  })

  it('survives SAVE after SAVE, even when every id changes', () => {
    // The real table may renumber its rows on any save; the fix is positional
    // so it does not care. Three round trips, ids moving every time.
    const { loaded } = throughTheDatabase(template, { times: 3 })
    expect(deadDividerRefs(loaded)).toEqual([])
    expect(cellsOf(loaded).length).toBe(4)
    expect(price(loaded).price.total).toBeCloseTo(8936.47, 1)
  })

  it('the map is by POSITION: the nth mullion of the nth frame', () => {
    const { tree: created } = prepareTemplateTree(template)
    const db = makeDb(3000)
    db.save(created)
    const loaded = db.load()
    const map = dividerRefMap(created, loaded)
    // two mullions and one transom in this frame
    expect(map.size).toBe(3)
    for (const [from, to] of map) {
      expect(from).not.toBe(to)
      expect(/^\d+$/.test(to)).toBe(true)
    }
  })
})

describe('Step BH follow-up 2 — every doorset, and a divider a surveyor adds', () => {
  it('all five templates round-trip with their cells and their price', () => {
    for (const t of DOORSET_TEMPLATES) {
      const built = buildDoorsetTemplate(t, PV)
      const { created, loaded } = throughTheDatabase(built.tree)
      expect(deadDividerRefs(loaded), t.name).toEqual([])
      expect(cellsOf(loaded), t.name).toEqual(cellsOf(created))
      expect(price(loaded).price.total, t.name)
        .toBeCloseTo(price(created).price.total, 2)
    }
  })

  it('a drawing with NO short divider is untouched by the fix', () => {
    const pair = buildFrontDoorPairFrame(PV, {}).tree
    expect(hasDividerRefs(prepareTemplateTree(pair).tree)).toBe(false)
    const { created, loaded } = throughTheDatabase(pair)
    expect(cellsOf(loaded)).toEqual(cellsOf(created))
    // nothing to write: the save path skips the whole thing
    const { changed } = fixDividerRefsAfterSave(created, loaded)
    expect(changed).toEqual([])
  })

  it('a divider a SURVEYOR adds on the board survives too', () => {
    // Step AV's "one column / one row only" split, which is the other way a
    // short divider gets into a drawing — and the reviewer's point that this
    // was never about template 38.
    const stable = buildStableDoorSetFrame(PV, { sideLight: { side: 'right' } }).tree
    const { tree: drawing } = prepareTemplateTree(stable)
    const frame = frameOf(drawing)
    const sash = (frame.children ?? []).find(c => c.part_type === 'casementSashPart')
    const shortPv = Object.fromEntries(
      Object.entries(PV).map(([k, v]) => [k.split('.').pop(), v]))
    const split = splitOpening(drawing, frame.key, sash.key, 'transom', shortPv)
    // it IS a short divider: the mullion bounds it
    const refs = deadDividerRefs(split)
    expect(refs).toEqual([])
    expect(hasDividerRefs(split)).toBe(true)

    const db = makeDb(4000)
    db.save(split)
    let loaded = db.load()
    const { changed } = fixDividerRefsAfterSave(split, loaded)
    db.update(changed)
    loaded = db.load()
    expect(deadDividerRefs(loaded)).toEqual([])
    expect(cellsOf(loaded)).toEqual(cellsOf(split))
  })
})

describe('Step BH follow-up 2 — a dead reference fails loudly', () => {
  it('the board shows it as an ERROR naming the divider', () => {
    // The two live drawings that already hold dead references (56 and 60) are
    // what this is for: they cannot be repaired by code, so the board has to
    // say what is wrong with them rather than re-cutting the frame.
    const template = buildFrontDoorSetFrame(PV, { fanlight: 'over_door' }).tree
    const { tree: created } = prepareTemplateTree(template)
    const db = makeDb(5000)
    db.save(created)                     // ... and no fix
    const broken = db.load()

    const fired = validateDrawing(broken, {}, [], {}, {})
      .filter(r => r.status === 'fired' && r.rule_id === 'built_in.dead_divider_reference')
    expect(fired.length).toBe(2)         // startDivider and endDivider
    for (const r of fired) {
      expect(r.severity).toBe('error')
      expect(r.part_key).toBeTruthy()
      expect(r.message).toMatch(/stops at a divider that is not in the frame/)
      expect(r.message).toMatch(/re-make the drawing/)
    }

    // and a sound drawing says nothing
    const { loaded } = throughTheDatabase(template, { nextId: 6000 })
    expect(validateDrawing(loaded, {}, [], {}, {})
      .filter(r => r.status === 'fired' && r.rule_id === 'built_in.dead_divider_reference'))
      .toEqual([])
  })
})
