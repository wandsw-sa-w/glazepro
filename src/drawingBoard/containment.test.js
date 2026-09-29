// containment.test.js — Step J fixes #1
//
// Mirrors sql/step-j2-containment.sql (plus the box-sash pairs that must
// already exist for Step G/H saves to have worked at all). Builds each of
// the J-era test trees (arched with bars, double box, triple/"Venetian",
// partial bar) and checks every parent->child edge against this list, so a
// missing part_type_children row fails a CI test instead of the Save button
// in production.
//
// If you add a new part_type_children row to sql/step-j2-containment.sql
// (or a later step-j*-containment.sql), add the matching pair here too.

import { describe, it, expect } from 'vitest'

// ── The allowed set — keep in sync with the SQL ──────────────────────────────

const ALLOWED_PAIRS = new Set([
  // Base box-sash tree (buildNewBoxSash / Step A+G) — already in the live DB,
  // proven by every successful save before Step J.
  'drawingItemPart->paintAndIronmongeryPart',
  'drawingItemPart->notesPart',
  'drawingItemPart->pricePart',
  'drawingItemPart->assemblyFramePart',
  'assemblyFramePart->cillPart',
  'assemblyFramePart->sashPairPart',
  'sashPairPart->topSashPart',
  'sashPairPart->bottomSashPart',
  'topSashPart->glassPart',
  'bottomSashPart->glassPart',

  // sql/step-j2-containment.sql
  'assemblyFramePart->mullionPart',
  'assemblyFramePart->transomPart',
  'glassPart->verticalGlazingBarPart',
  'glassPart->horizontalGlazingBarPart',
])

// ── Tree walker ───────────────────────────────────────────────────────────────

function collectEdges(node, acc = []) {
  if (!node) return acc
  for (const child of (node.children ?? [])) {
    acc.push(`${node.part_type}->${child.part_type}`)
    collectEdges(child, acc)
  }
  return acc
}

function assertAllEdgesAllowed(tree) {
  const edges = collectEdges(tree)
  expect(edges.length).toBeGreaterThan(0)
  for (const edge of edges) {
    expect(ALLOWED_PAIRS.has(edge), `forbidden parent->child pair: ${edge}`).toBe(true)
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function sashPair(key, { topBars = [], midrailHeight = 40 } = {}) {
  return {
    key, part_type: 'sashPairPart', values: { midrailHeight }, children: [
      {
        key: `${key}-top`, part_type: 'topSashPart', values: { topHeight: 49, stileWidth: 47 }, children: [
          { key: `${key}-tglass`, part_type: 'glassPart', values: {}, children: topBars },
        ],
      },
      {
        key: `${key}-bot`, part_type: 'bottomSashPart', values: { bottomHeight: 88 }, children: [
          { key: `${key}-bglass`, part_type: 'glassPart', values: {}, children: [] },
        ],
      },
    ],
  }
}

function baseDrawing(frameValues, frameChildren) {
  return {
    key: 'item', part_type: 'drawingItemPart', values: {}, children: [
      { key: 'iron',  part_type: 'paintAndIronmongeryPart', values: {}, children: [] },
      { key: 'notes', part_type: 'notesPart',                values: {}, children: [] },
      { key: 'price', part_type: 'pricePart',                 values: {}, children: [] },
      {
        key: 'frame', part_type: 'assemblyFramePart', values: frameValues, children: [
          { key: 'cill', part_type: 'cillPart', values: { height: 70 }, children: [] },
          ...frameChildren,
        ],
      },
    ],
  }
}

describe('part_type_children coverage — Step J trees', () => {

  it('arched box sash with vertical bars', () => {
    const tree = baseDrawing(
      { width: 1100, height: 1600, leftWidth: 79, rightWidth: 79, topHeight: 79, archHead: true, archHeight: 150 },
      [sashPair('pair1', { topBars: [
        { key: 'v1', part_type: 'verticalGlazingBarPart', values: {}, children: [] },
        { key: 'v2', part_type: 'verticalGlazingBarPart', values: {}, children: [] },
      ] })],
    )
    assertAllEdgesAllowed(tree)
  })

  it('double box sash (2 openings, 1 mullion)', () => {
    const tree = baseDrawing(
      { width: 2000, height: 1700, leftWidth: 79, rightWidth: 79, topHeight: 79 },
      [
        { key: 'mull1', part_type: 'mullionPart', values: { offset: 921, thicknessInFrame: 40 }, children: [] },
        sashPair('pair1'),
        sashPair('pair2'),
      ],
    )
    assertAllEdgesAllowed(tree)
  })

  it('triple box sash / "Venetian" (3 openings, 2 mullions)', () => {
    const tree = baseDrawing(
      { width: 3000, height: 1700, leftWidth: 79, rightWidth: 79, topHeight: 79 },
      [
        { key: 'mull1', part_type: 'mullionPart', values: { offset: 947, thicknessInFrame: 40 }, children: [] },
        { key: 'mull2', part_type: 'mullionPart', values: { offset: 1894, thicknessInFrame: 40 }, children: [] },
        sashPair('pair1'),
        sashPair('pair2'),
        sashPair('pair3'),
      ],
    )
    assertAllEdgesAllowed(tree)
  })

  it('box sash with a partial bar (offset/offset2 set)', () => {
    const tree = baseDrawing(
      { width: 1100, height: 1600, leftWidth: 79, rightWidth: 79, topHeight: 79 },
      [sashPair('pair1', { topBars: [
        { key: 'partial', part_type: 'verticalGlazingBarPart', values: { offset: 200, offset2: 400 }, children: [] },
      ] })],
    )
    assertAllEdgesAllowed(tree)
  })

  it('box sash with horizontal bars and a transom-divided frame', () => {
    const tree = baseDrawing(
      { width: 1100, height: 2400, leftWidth: 79, rightWidth: 79, topHeight: 79 },
      [
        { key: 'trans1', part_type: 'transomPart', values: { offset: 1200, thicknessInFrame: 40 }, children: [] },
        sashPair('pair1', { topBars: [
          { key: 'h1', part_type: 'horizontalGlazingBarPart', values: {}, children: [] },
        ] }),
      ],
    )
    assertAllEdgesAllowed(tree)
  })

  it('a forbidden pair is actually caught by the assertion helper (meta-test)', () => {
    const tree = { key: 'x', part_type: 'glassPart', values: {}, children: [
      { key: 'y', part_type: 'mullionPart', values: {}, children: [] }, // glassPart -> mullionPart is not allowed
    ] }
    expect(() => assertAllEdgesAllowed(tree)).toThrow(/forbidden parent->child pair/)
  })

})
