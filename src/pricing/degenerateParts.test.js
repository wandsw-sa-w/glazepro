// degenerateParts.test.js — Step BH follow-up item 2
//
// NOTHING MAY PRICE AT A NEGATIVE OR ZERO AREA.
//
// Live drawing 56 priced four Tricoya panels at −0.164, −0.349, −0.349 and
// −0.255 m² — £211 OFF the cost of the door — because a broken layout had
// squeezed the leaf into a 365 mm cell and its grid went inside out. The
// layout bug is fixed (item 1), but a drawing that takes money off is a
// failure mode worth closing on its own: a size that cannot be real must
// show on the board as an ERROR and must not reach a price line.

import { describe, it, expect } from 'vitest'
import SNAPSHOT from './benchmarks/pf30-snapshot.json'
import { runPricingOnTree, degenerateParts } from './pricingEngine.js'
import { validateDrawing } from '../validation/validate.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'
import { buildFrontDoorFrame } from '../drawingBoard/doorOpenings.js'
import { OPEN_IN_PROFILE_VALUES as PV, DOOR_PART_COST_MAP } from './benchmarks/fixtureDoor.js'

/** A front door whose leaf has been narrowed under its own grid. */
function brokenDoor() {
  const { tree } = buildFrontDoorFrame(PV, {})
  // the leaf keeps its 120 muntin at the offset it had, and the frame is
  // squeezed to 365 — exactly what the live cell mismatch did
  const squeeze = node => {
    if (node.part_type === 'assemblyFramePart') {
      return { ...node, values: { ...node.values, width: 365 }, children: (node.children ?? []).map(squeeze) }
    }
    return { ...node, children: (node.children ?? []).map(squeeze) }
  }
  return squeeze(tree)
}

const price = tree => runPricingOnTree(tree, SNAPSHOT.rules, SNAPSHOT.pfVariables, {
  glassCatalogue: SNAPSHOT.glassCatalogue,
  partAllocationRules: SNAPSHOT.partAllocationRules,
  partCostMap: DOOR_PART_COST_MAP,
  ironmongeryLines: [],
  ironmongeryCatalogue: SNAPSHOT.ironmongeryCatalogue,
  profileValues: SNAPSHOT.profileValues,
  profileCode: 'open_in_doors',
})

describe('Step BH follow-up — a size that cannot be real', () => {
  it('a sound door has no degenerate part', () => {
    const { tree } = buildFrontDoorFrame(PV, {})
    expect(degenerateParts(tree, computeDerived(tree))).toEqual([])
  })

  it('names every part whose computed size is <= 0', () => {
    const tree = brokenDoor()
    const bad = degenerateParts(tree, computeDerived(tree))
    expect(bad.length).toBeGreaterThan(0)
    for (const part of bad) {
      expect(part.key).toBeTruthy()
      expect(part.part_type).toMatch(/panelPart|glassPart/)
      expect(part.label, 'a label a surveyor can click').toBeTruthy()
      expect(Math.min(part.width, part.height)).toBeLessThanOrEqual(0)
    }
  })

  it('and NOTHING of theirs reaches a price line', () => {
    const tree = brokenDoor()
    const r = price(tree)
    const panelLines = r.price.lines.filter(l => l.fires && /Tricoya|Panel/i.test(l.name ?? ''))
    // no negative money, and no line for a part that cannot be made
    for (const l of r.price.lines) {
      expect(l.line_cost ?? 0, `${l.name} cost`).toBeGreaterThanOrEqual(0)
      expect(l.quantity ?? 0, `${l.name} quantity`).toBeGreaterThanOrEqual(0)
    }
    const bad = degenerateParts(tree, computeDerived(tree)).map(p => p.key)
    for (const l of panelLines) {
      expect(bad).not.toContain(l.loop_part_key ?? l.part_key)
    }
    // and the engine SAYS so rather than quietly dropping them
    expect((r.warnings ?? []).join(' ')).toMatch(/cannot be priced|no usable size/i)
  })

  it('the board shows it as an ERROR, naming the part', () => {
    const tree = brokenDoor()
    // no DB rules at all: the check is built in, so a broken layout shows
    // even on a profile whose validation rules have not been set up
    const results = validateDrawing(tree, {}, [], {}, {})
    const fired = results.filter(r => r.status === 'fired')
    expect(fired.length).toBeGreaterThan(0)
    for (const r of fired) {
      expect(r.severity).toBe('error')
      expect(r.part_key).toBeTruthy()
      expect(r.message).toMatch(/size|wide|high/i)
    }
    // a sound door says nothing
    const { tree: good } = buildFrontDoorFrame(PV, {})
    expect(validateDrawing(good, {}, [], {}, {}).filter(r => r.status === 'fired')).toEqual([])
  })
})
