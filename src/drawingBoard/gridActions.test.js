// gridActions.test.js — Step J fixes #4
//
// The bug: choosing 2x1 on the frame added a mullionPart to the tree, but
// the drawing didn't change — no second sash pair was created, so there was
// still one pair of sashes and no openings. Render tests on hand-built
// fixtures already passed, because the fixtures were hand-built to the
// *correct* shape; the UI action itself never produced that shape. These
// tests run the actual grid handler (applyDividers, as wired to the
// Transom/Mullion... button in DrawingBoard.jsx) on a tree built the same
// way DrawingBoard.jsx builds a fresh box sash, then render the result.

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { applyDividers, applyBars, cloneWithNewKeys, makeKey } from './gridActions.js'
import { buildNewBoxSash } from './buildTree.js'
import { computeDerived } from './computeDerived.js'
import { computeSashGeometry } from './sashGeometry.js'
import { SashElevation } from './renderElevation.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const c of (node.children ?? [])) { const f = findFirst(c, partType); if (f) return f }
  return null
}

function findAll(node, partType, acc = []) {
  if (!node) return acc
  if (node.part_type === partType) acc.push(node)
  for (const c of (node.children ?? [])) findAll(c, partType, acc)
  return acc
}

function setValues(node, partType, values) {
  if (node.part_type === partType) return { ...node, values: { ...node.values, ...values } }
  return { ...node, children: (node.children ?? []).map(c => setValues(c, partType, values)) }
}

// The min_count=1 containment rows Step A set for a real box sash tree
// (sql/step-a-parts-schema.md #1/#3/#4/#5/#6) — needed so buildNewBoxSash's
// required-children logic adds topSashPart/bottomSashPart/glassPart.
const CONTAINMENT = [
  { parent_code: 'sashPairPart',   child_code: 'topSashPart',    min_count: 1, sort_order: 10 },
  { parent_code: 'sashPairPart',   child_code: 'bottomSashPart', min_count: 1, sort_order: 20 },
  { parent_code: 'topSashPart',    child_code: 'glassPart',      min_count: 1, sort_order: 10 },
  { parent_code: 'bottomSashPart', child_code: 'glassPart',      min_count: 1, sort_order: 10 },
]

// Build a fresh box sash the same way DrawingBoard.jsx does when a drawing
// has no saved drawing_parts yet, then give it realistic dimensions (empty
// fieldDefs means buildNewBoxSash can't populate values from profile
// defaults, so set them directly, same numbers as the arch render fixtures).
function freshBoxSash() {
  const { tree } = buildNewBoxSash({ profile: null, fieldDefs: {}, profileValues: [], containment: CONTAINMENT, refOptions: {} })
  let t = tree
  t = setValues(t, 'assemblyFramePart', { width: 2000, height: 1700, leftWidth: 79, rightWidth: 79, topHeight: 79 })
  t = setValues(t, 'cillPart', { height: 70 })
  t = setValues(t, 'sashPairPart', { midrailHeight: 40 })
  t = setValues(t, 'topSashPart', { topHeight: 49, stileWidth: 47 })
  t = setValues(t, 'bottomSashPart', { bottomHeight: 88 })
  return t
}

function renderTree(tree) {
  const derived  = computeDerived(tree)
  const geometry = computeSashGeometry(tree, derived)
  return renderToStaticMarkup(createElement(SashElevation, { tree, derived, geometry, refOptions: {} }))
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('applyDividers — runs the actual Transom/Mullion... handler', () => {

  it('a fresh box sash starts with exactly one sash pair and no dividers', () => {
    const tree = freshBoxSash()
    expect(findAll(tree, 'sashPairPart').length).toBe(1)
    expect(findAll(tree, 'mullionPart').length).toBe(0)
  })

  it('2 x 1 creates a second sash pair (copying the first) and one mullion', () => {
    const tree = freshBoxSash()
    const frame = findFirst(tree, 'assemblyFramePart')
    const iW = frame.values.width - frame.values.leftWidth - frame.values.rightWidth
    const iH = frame.values.height - frame.values.topHeight - 70

    const next = applyDividers(tree, frame.key, 2, 1, iW, iH)

    expect(findAll(next, 'sashPairPart').length).toBe(2)
    expect(findAll(next, 'mullionPart').length).toBe(1)
    expect(findAll(next, 'transomPart').length).toBe(0)

    // The mullion sits at the midpoint (equal-width openings)
    const mullion = findFirst(next, 'mullionPart')
    expect(mullion.values.offset).toBeCloseTo(iW / 2, 0)
  })

  it('the second pair is a real copy — same values, distinct keys, bars preserved', () => {
    const tree = freshBoxSash()
    const frame = findFirst(tree, 'assemblyFramePart')
    // Give the original pair's top glass a bar before splitting, to prove it carries over.
    const withBar = applyBars(tree, findFirst(tree, 'topSashPart').children[0].key, 2, 1)
    const iW = frame.values.width - frame.values.leftWidth - frame.values.rightWidth
    const iH = frame.values.height - frame.values.topHeight - 70

    const next = applyDividers(withBar, frame.key, 2, 1, iW, iH)
    const pairs = findAll(next, 'sashPairPart')
    expect(pairs).toHaveLength(2)
    expect(pairs[0].key).not.toBe(pairs[1].key)
    expect(pairs[0].values.midrailHeight).toBe(pairs[1].values.midrailHeight)

    const bars = [findAll(pairs[0], 'verticalGlazingBarPart'), findAll(pairs[1], 'verticalGlazingBarPart')]
    expect(bars[0]).toHaveLength(1)
    expect(bars[1]).toHaveLength(1)
    expect(bars[0][0].key).not.toBe(bars[1][0].key) // distinct key, not the same node reused
  })

  it('2 x 1 renders: a mullion element and labels A1/A2/B1/B2', () => {
    const tree = freshBoxSash()
    const frame = findFirst(tree, 'assemblyFramePart')
    const iW = frame.values.width - frame.values.leftWidth - frame.values.rightWidth
    const iH = frame.values.height - frame.values.topHeight - 70

    const next = applyDividers(tree, frame.key, 2, 1, iW, iH)
    const html = renderTree(next)

    expect(html).toContain('<svg')
    expect(html).not.toContain('NaN')
    expect(html).toContain('A1')
    expect(html).toContain('A2')
    expect(html).toContain('B1')
    expect(html).toContain('B2')
  })

  it('3 x 1 creates three sash pairs and two mullions', () => {
    const tree = freshBoxSash()
    const frame = findFirst(tree, 'assemblyFramePart')
    const iW = frame.values.width - frame.values.leftWidth - frame.values.rightWidth
    const iH = frame.values.height - frame.values.topHeight - 70

    const next = applyDividers(tree, frame.key, 3, 1, iW, iH)
    expect(findAll(next, 'sashPairPart').length).toBe(3)
    expect(findAll(next, 'mullionPart').length).toBe(2)

    const html = renderTree(next)
    expect(html).not.toContain('NaN')
    expect(html).toContain('C1')
  })

  it('going back to 1 x 1 removes the dividers and the extra openings', () => {
    const tree = freshBoxSash()
    const frame = findFirst(tree, 'assemblyFramePart')
    const iW = frame.values.width - frame.values.leftWidth - frame.values.rightWidth
    const iH = frame.values.height - frame.values.topHeight - 70

    const doubled  = applyDividers(tree, frame.key, 2, 1, iW, iH)
    const shrunk    = applyDividers(doubled, frame.key, 1, 1, iW, iH)

    expect(findAll(shrunk, 'sashPairPart').length).toBe(1)
    expect(findAll(shrunk, 'mullionPart').length).toBe(0)
  })

  it('cloneWithNewKeys never reuses a key from the source subtree', () => {
    const tree  = freshBoxSash()
    const pair  = findFirst(tree, 'sashPairPart')
    const clone = cloneWithNewKeys(pair)
    const originalKeys = new Set(findAll(pair, pair.part_type).concat(
      findAll(pair, 'topSashPart'), findAll(pair, 'bottomSashPart'), findAll(pair, 'glassPart'),
    ).map(n => n.key))
    const cloneKeys = findAll(clone, clone.part_type).concat(
      findAll(clone, 'topSashPart'), findAll(clone, 'bottomSashPart'), findAll(clone, 'glassPart'),
    ).map(n => n.key)
    for (const k of cloneKeys) expect(originalKeys.has(k)).toBe(false)
  })

  it('makeKey produces distinct keys on successive calls', () => {
    const keys = new Set(Array.from({ length: 20 }, () => makeKey('x')))
    expect(keys.size).toBe(20)
  })

})
