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
import { applyDividers, applyBars, cloneWithNewKeys, makeKey , frameGrid } from './gridActions.js'
import { addDividerInCell, removeDivider } from './gridActions.js'
import { buildCasementFrame, resizeCasementFrame, applyFanlightBottomRails } from './casementOpenings.js'
import { frameCells, frameInterior, isShortDivider, shortDividerSpanMm } from '../pricing/casementGeometry.js'
import { BENCHMARK_TC1, BENCHMARK_TC3 } from '../pricing/benchmarks/fixtureCasement.js'
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

// Step AE item 1: a box sash mullion is hollow — applyDividers takes its
// thickness from the profile value thicknessInFrameHollow (144 on the
// snapshot's Sash profile) and lays LEFT-face offsets with equal openings.
const PV = { thicknessInFrameHollow: 144 }
const T  = 144

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

    const next = applyDividers(tree, frame.key, 2, 1, iW, iH, PV)

    expect(findAll(next, 'sashPairPart').length).toBe(2)
    expect(findAll(next, 'mullionPart').length).toBe(1)
    expect(findAll(next, 'transomPart').length).toBe(0)

    // Step AE: offset = LEFT face giving equal openings — opening =
    // (iW − t) / 2 — and the resolved hollow thickness is stored.
    const mullion = findFirst(next, 'mullionPart')
    expect(mullion.values.offset).toBeCloseTo((iW - T) / 2, 6)
    expect(mullion.values.thicknessInFrame).toBe(T)
  })

  it('a mullion needs the thicknessInFrameHollow profile value — missing = error, nothing changed', () => {
    const tree = freshBoxSash()
    const frame = findFirst(tree, 'assemblyFramePart')
    const iW = frame.values.width - frame.values.leftWidth - frame.values.rightWidth
    const iH = frame.values.height - frame.values.topHeight - 70
    expect(() => applyDividers(tree, frame.key, 2, 1, iW, iH, {})).toThrow(/thicknessInFrameHollow/)
    expect(() => applyDividers(tree, frame.key, 2, 1, iW, iH)).toThrow(/thicknessInFrameHollow/)
    // Rows-only grids need no mullion thickness
    expect(() => applyDividers(tree, frame.key, 1, 2, iW, iH)).not.toThrow()
  })

  it('3 x 1 offsets follow offset_i = i x opening + (i-1) x t', () => {
    const tree = freshBoxSash()
    const frame = findFirst(tree, 'assemblyFramePart')
    const iW = frame.values.width - frame.values.leftWidth - frame.values.rightWidth
    const iH = frame.values.height - frame.values.topHeight - 70

    const next = applyDividers(tree, frame.key, 3, 1, iW, iH, PV)
    const opening = (iW - 2 * T) / 3
    const offsets = findAll(next, 'mullionPart').map(m => m.values.offset).sort((a, b) => a - b)
    expect(offsets[0]).toBeCloseTo(opening, 6)
    expect(offsets[1]).toBeCloseTo(2 * opening + T, 6)
  })

  it('stored offsets are rounded to 0.1 mm (Step AH 3b)', () => {
    // iW 1000, t 144, 3 cols: opening = 712/3 = 237.33̅ → offsets 237.3
    // and 2 × 237.33̅ + 144 = 618.66̅ → 618.7 (Integrate stores 1 dp).
    const tree = freshBoxSash()
    const frame = findFirst(tree, 'assemblyFramePart')
    const next = applyDividers(tree, frame.key, 3, 1, 1000, 800, PV)
    const offsets = findAll(next, 'mullionPart').map(m => m.values.offset).sort((a, b) => a - b)
    expect(offsets[0]).toBe(237.3)
    expect(offsets[1]).toBe(618.7)
  })

  it('the second pair is a real copy — same values, distinct keys, bars preserved', () => {
    const tree = freshBoxSash()
    const frame = findFirst(tree, 'assemblyFramePart')
    // Give the original pair's top glass a bar before splitting, to prove it carries over.
    const withBar = applyBars(tree, findFirst(tree, 'topSashPart').children[0].key, 2, 1)
    const iW = frame.values.width - frame.values.leftWidth - frame.values.rightWidth
    const iH = frame.values.height - frame.values.topHeight - 70

    const next = applyDividers(withBar, frame.key, 2, 1, iW, iH, PV)
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

    const next = applyDividers(tree, frame.key, 2, 1, iW, iH, PV)
    const html = renderTree(next)

    expect(html).toContain('<svg')
    expect(html).not.toContain('NaN')
    expect(html).toContain('A1')
    expect(html).toContain('A2')
    expect(html).toContain('B1')
    expect(html).toContain('B2')
  })

  // ── J+K fixes round 3, item 4: label x = its own opening's glass centre ──
  // Before the fix, opening A's label x came from the whole frame's
  // geometry.sashWidth (no concept of mullions), landing it near the
  // mullion instead of inside opening A's own glass — only the left half
  // of "A1 / Cord Hung" was visible, the rest painted over by opening B.

  function extractLabelX(html, pairIdx) {
    const m = html.match(new RegExp(`<text x="([\\d.]+)"[^>]*clip-path="url\\(#glassclip-t-${pairIdx}\\)"`))
    return m ? parseFloat(m[1]) : null
  }

  // Opening bounds in absolute frame-local x (same coordinate space the
  // label x is rendered in): [gx, gx+glassW] for a given opening index.
  // Step AE: openings subtract the mullion thickness (144) and each later
  // opening starts after the mullion.
  function glassBounds(frame, openingIndex, numOpenings) {
    const iW = frame.values.width - frame.values.leftWidth - frame.values.rightWidth
    const nMullions = numOpenings - 1
    const openingW = (iW - nMullions * T) / numOpenings
    const stile = 47
    const openingX = frame.values.leftWidth + openingIndex * (openingW + T)
    const glassW = openingW - 2 * stile
    return { min: openingX + stile, max: openingX + stile + glassW }
  }

  it('2 x 1: A1 label x sits inside opening A\'s glass, not opening B\'s', () => {
    const tree = freshBoxSash()
    const frame = findFirst(tree, 'assemblyFramePart')
    const iW = frame.values.width - frame.values.leftWidth - frame.values.rightWidth
    const iH = frame.values.height - frame.values.topHeight - 70

    const next = applyDividers(tree, frame.key, 2, 1, iW, iH, PV)
    const html = renderTree(next)

    const aX = extractLabelX(html, 0)
    const bX = extractLabelX(html, 1)
    expect(aX).not.toBeNull()
    expect(bX).not.toBeNull()

    const aBounds = glassBounds(frame, 0, 2)
    const bBounds = glassBounds(frame, 1, 2)

    expect(aX).toBeGreaterThan(aBounds.min)
    expect(aX).toBeLessThan(aBounds.max)
    // The old bug landed A's label right at the mullion — well outside its
    // own opening and inside/at the edge of B's.
    expect(aX).toBeLessThan(bBounds.min)

    expect(bX).toBeGreaterThan(bBounds.min)
    expect(bX).toBeLessThan(bBounds.max)
  })

  it('3 x 1: A1, B1 and C1 each sit inside their own opening', () => {
    const tree = freshBoxSash()
    const frame = findFirst(tree, 'assemblyFramePart')
    const iW = frame.values.width - frame.values.leftWidth - frame.values.rightWidth
    const iH = frame.values.height - frame.values.topHeight - 70

    const next = applyDividers(tree, frame.key, 3, 1, iW, iH, PV)
    const html = renderTree(next)

    for (let i = 0; i < 3; i++) {
      const x = extractLabelX(html, i)
      expect(x, `opening ${i} label x`).not.toBeNull()
      const bounds = glassBounds(frame, i, 3)
      expect(x).toBeGreaterThan(bounds.min)
      expect(x).toBeLessThan(bounds.max)
    }
  })

  it('a single-opening (1 x 1) frame still labels correctly — the fix does not regress the common case', () => {
    const tree = freshBoxSash()
    const html = renderTree(tree)
    const x = extractLabelX(html, 0)
    expect(x).not.toBeNull()
    const bounds = glassBounds(findFirst(tree, 'assemblyFramePart'), 0, 1)
    expect(x).toBeGreaterThan(bounds.min)
    expect(x).toBeLessThan(bounds.max)
  })

  it('3 x 1 creates three sash pairs and two mullions', () => {
    const tree = freshBoxSash()
    const frame = findFirst(tree, 'assemblyFramePart')
    const iW = frame.values.width - frame.values.leftWidth - frame.values.rightWidth
    const iH = frame.values.height - frame.values.topHeight - 70

    const next = applyDividers(tree, frame.key, 3, 1, iW, iH, PV)
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

    const doubled  = applyDividers(tree, frame.key, 2, 1, iW, iH, PV)
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

// ── Step AQ item 7 — the picker opens on the frame's current grid ───────────
describe('frameGrid', () => {
  const frame = (children) => ({
    key: 'item', part_type: 'drawingItemPart', values: {}, children: [
      { key: 'frame1', part_type: 'assemblyFramePart', values: {}, children: [
        { key: 'cill', part_type: 'cillPart', values: {}, children: [] },
        ...children,
      ] },
    ],
  })

  it('a plain frame is 1 x 1', () => {
    expect(frameGrid(frame([]), 'frame1')).toEqual({ cols: 1, rows: 1 })
  })

  it('one mullion is 2 columns — the picker used to say "1 x 1, 0 mullions"', () => {
    const tree = frame([{ key: 'm1', part_type: 'mullionPart', values: { offset: 549 }, children: [] }])
    expect(frameGrid(tree, 'frame1')).toEqual({ cols: 2, rows: 1 })
  })

  it('two mullions and a transom is 3 x 2', () => {
    const tree = frame([
      { key: 'm1', part_type: 'mullionPart', values: {}, children: [] },
      { key: 'm2', part_type: 'mullionPart', values: {}, children: [] },
      { key: 't1', part_type: 'transomPart', values: {}, children: [] },
    ])
    expect(frameGrid(tree, 'frame1')).toEqual({ cols: 3, rows: 2 })
  })

  it('counts only the named frame, not any other', () => {
    const tree = frame([{ key: 'm1', part_type: 'mullionPart', values: {}, children: [] }])
    expect(frameGrid(tree, 'nosuchframe')).toEqual({ cols: 1, rows: 1 })
    expect(frameGrid(tree, null)).toEqual({ cols: 1, rows: 1 })
  })

  it('applying the grid it reports back is a no-op on the mullion count', () => {
    // Opening the picker and pressing Apply must not change the frame
    const tree = frame([{ key: 'm1', part_type: 'mullionPart', values: { offset: 549, thicknessInFrame: 27 }, children: [] },
      { key: 'cas1', part_type: 'casementSashPart', values: {}, children: [] },
      { key: 'cas2', part_type: 'casementSashPart', values: {}, children: [] }])
    const { cols, rows } = frameGrid(tree, 'frame1')
    const after = applyDividers(tree, 'frame1', cols, rows, 1125, 1205,
      { thicknessInFrameSolid: 27, mullionStopSize: 20 }, 'solid')
    expect(frameGrid(after, 'frame1')).toEqual({ cols, rows })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Step AV — the picker's second mode: a divider in ONE column or ONE row
// ══════════════════════════════════════════════════════════════════════════════
// TC1 and TC3 cannot be drawn by the grid picker: their second divider stops
// at the first one. These run the real board actions — the same functions the
// Transom/Mullion... dialog calls — and check the geometry that comes out is
// the benchmark geometry, cell for cell.
describe('Step AV — a divider in one column or one row', () => {
  // Profile 2 (casement) as api.js loadProfileValues returns it. buildCasementFrame
  // reads the FULL field keys; the picker takes DrawingBoard's short-keyed
  // profileValueMap, so the test passes each what the board passes it.
  const ROWS = [
    { profile_id: 2, field_key: 'assemblyFramePart.leftWidth',    default_value: '37' },
    { profile_id: 2, field_key: 'assemblyFramePart.rightWidth',   default_value: '37' },
    { profile_id: 2, field_key: 'assemblyFramePart.topHeight',    default_value: '47' },
    { profile_id: 2, field_key: 'assemblyFramePart.bottomHeight', default_value: '47' },
    { profile_id: 2, field_key: 'assemblyFramePart.frameDepth',   default_value: '96' },
    { profile_id: 2, field_key: 'assemblyFramePart.frameHeadStopSize',  default_value: '20' },
    { profile_id: 2, field_key: 'assemblyFramePart.frameStileStopSize', default_value: '20' },
    { profile_id: 2, field_key: 'assemblyFramePart.cillStopSize', default_value: '20' },
    { profile_id: 2, field_key: 'cillPart.height',                default_value: '47' },
    { profile_id: 2, field_key: 'cillPart.depth',                 default_value: '128' },
    { profile_id: 2, field_key: 'mullionPart.thicknessInFrameSolid', default_value: '27' },
    { profile_id: 2, field_key: 'mullionPart.mullionStopSize',     default_value: '20' },
    { profile_id: 2, field_key: 'casementSashPart.thickness',      default_value: '54' },
    { profile_id: 2, field_key: 'casementSashPart.topHeight',      default_value: '62' },
    { profile_id: 2, field_key: 'casementSashPart.leftWidth',      default_value: '62' },
    { profile_id: 2, field_key: 'casementSashPart.rightWidth',     default_value: '62' },
    { profile_id: 2, field_key: 'casementSashPart.defaultFanlightBottomHeight', default_value: '83' },
    { profile_id: 2, field_key: 'casementSashPart.mechanicalClearanceLeft',   default_value: '4' },
    { profile_id: 2, field_key: 'casementSashPart.mechanicalClearanceRight',  default_value: '4' },
    { profile_id: 2, field_key: 'casementSashPart.mechanicalClearanceTop',    default_value: '4' },
    { profile_id: 2, field_key: 'casementSashPart.mechanicalClearanceBottom', default_value: '4' },
    { profile_id: 2, field_key: 'glassPart.defaultDoubleGlazingRebateWidthForSash', default_value: '16' },
    { profile_id: 2, field_key: 'glassPart.defaultDoubleGlazingTolerance',          default_value: '2' },
    { profile_id: 2, field_key: 'glassPart.defaultDirGuStopSize',                   default_value: '20' },
    { profile_id: 2, field_key: 'glassPart.defaultDoubleGlazingRebateWidthForDirGU', default_value: '20' },
    { profile_id: 2, field_key: 'glassPart.defaultDoubleGlazingToleranceForDirGU',   default_value: '2' },
  ]
  const PV = (() => {
    const map = {}
    for (const r of ROWS) {
      const key = r.field_key.split('.').pop()
      const n = Number(r.default_value)
      map[key] = isNaN(n) ? r.default_value : n
    }
    return map
  })()

  const frameOf = t => findFirst(t, 'assemblyFramePart')
  const dividersOf = t => (frameOf(t).children ?? [])
    .filter(c => c.part_type === 'mullionPart' || c.part_type === 'transomPart')
  const openingsOf = t => (frameOf(t).children ?? [])
    .filter(c => c.part_type === 'casementSashPart' || c.part_type === 'glassPart')
  const shapeOf = t => frameCells(t).map(c => [c.col, c.row, c.colSpan, c.rowSpan])
  const sizesOf = t => frameCells(t).map(c => [c.width, c.height])

  /** A casement frame the way DrawingBoard.jsx builds one from a template. */
  function newFrame(width, height) {
    // buildCasementFrame reports the profile values it could not resolve
    const { tree, missing } = buildCasementFrame(ROWS, { width, height, openings: ['opening_casement'] })
    expect(missing, 'profile values the build could not resolve').toEqual([])
    return tree
  }

  it('TC1: a transom across the frame, then a mullion in the bottom row only', () => {
    // 1105 x 1405. Interior 1031 x 1284 (frame stile 37 each side).
    let tree = newFrame(1105, 1405)
    const interior = frameInterior(tree)
    expect([interior.width, interior.height]).toEqual([1031, 1311])

    // The grid picker: 1 column, 2 rows, then the transom moved to 301
    tree = applyDividers(tree, frameOf(tree).key, 1, 2, interior.width, interior.height, PV, 'solid')
    tree = setValues(tree, 'transomPart', { offset: 301 })
    expect(shapeOf(tree)).toEqual([[0, 0, 1, 1], [0, 1, 1, 1]])

    // The new mode: a mullion in row 2 (index 1), at 493 from the left jamb
    const transomKey = findFirst(tree, 'transomPart').key
    tree = addDividerInCell(tree, frameOf(tree).key,
      { axis: 'mullion', index: 1, offset: 493, profileValues: PV })

    // It stops AT the transom, and runs to the cill
    const mullion = findFirst(tree, 'mullionPart')
    expect(mullion.values.startDivider).toBe(transomKey)
    expect(mullion.values.endDivider).toBe('0')
    expect(mullion.values.thicknessInFrame).toBe(27)

    // which is TC1's geometry: the fanlight spans both columns
    expect(shapeOf(tree)).toEqual([[0, 0, 2, 1], [0, 1, 1, 1], [1, 1, 1, 1]])
    expect(sizesOf(tree)).toEqual([[1031, 301], [493, 983], [511, 983]])
    expect(sizesOf(tree)).toEqual(sizesOf(BENCHMARK_TC1.tree))

    // three openings for three cells, and the mullion is short
    expect(openingsOf(tree).length).toBe(3)
    expect(isShortDivider(tree, mullion)).toBe(true)
    expect(shortDividerSpanMm(tree, mullion)).toBe(983)
  })

  it('TC3: a mullion across the frame, then a transom in column B only', () => {
    let tree = newFrame(1205, 1295)
    const interior = frameInterior(tree)
    tree = applyDividers(tree, frameOf(tree).key, 2, 1, interior.width, interior.height, PV, 'solid')
    tree = setValues(tree, 'mullionPart', { offset: 543 })

    const mullionKey = findFirst(tree, 'mullionPart').key
    tree = addDividerInCell(tree, frameOf(tree).key,
      { axis: 'transom', index: 1, offset: 354, profileValues: PV })

    const transom = findFirst(tree, 'transomPart')
    expect(transom.values.startDivider).toBe(mullionKey)
    expect(transom.values.endDivider).toBe('0')
    expect(transom.values.transomStopSize).toBe(20)

    expect(shapeOf(tree)).toEqual([[0, 0, 1, 2], [1, 0, 1, 1], [1, 1, 1, 1]])
    expect(sizesOf(tree)).toEqual([[543, 1201], [561, 354], [561, 820]])
    expect(sizesOf(tree)).toEqual(sizesOf(BENCHMARK_TC3.tree))
    expect(openingsOf(tree).length).toBe(3)
    expect(shortDividerSpanMm(tree, transom)).toBe(561)
  })

  it('a divider in one column needs a divider to stop at, and says so', () => {
    const tree = newFrame(1200, 1300)
    expect(() => addDividerInCell(tree, frameOf(tree).key,
      { axis: 'transom', index: 1, offset: 300, profileValues: PV }))
      .toThrow(/needs a mullion to stop at/)
    expect(() => addDividerInCell(tree, frameOf(tree).key,
      { axis: 'mullion', index: 1, offset: 300, profileValues: PV }))
      .toThrow(/needs a transom to stop at/)
  })

  it('without the profile thickness nothing is added, and the message says why', () => {
    let tree = newFrame(1105, 1405)
    const interior = frameInterior(tree)
    tree = applyDividers(tree, frameOf(tree).key, 1, 2, interior.width, interior.height, PV, 'solid')
    expect(() => addDividerInCell(tree, frameOf(tree).key,
      { axis: 'mullion', index: 1, offset: 493, profileValues: {} }))
      .toThrow(/thicknessInFrameSolid/)
  })

  it('index 0 puts the divider in the FIRST column, stopping at the mullion', () => {
    // The mirror of TC3 — template 14's fanlight is on the left.
    let tree = newFrame(1205, 1295)
    const interior = frameInterior(tree)
    tree = applyDividers(tree, frameOf(tree).key, 2, 1, interior.width, interior.height, PV, 'solid')
    tree = setValues(tree, 'mullionPart', { offset: 543 })
    const mullionKey = findFirst(tree, 'mullionPart').key
    tree = addDividerInCell(tree, frameOf(tree).key,
      { axis: 'transom', index: 0, offset: 354, profileValues: PV })

    const transom = findFirst(tree, 'transomPart')
    expect(transom.values.startDivider).toBe('0')
    expect(transom.values.endDivider).toBe(mullionKey)
    // column A is split, column B spans both rows
    expect(shapeOf(tree)).toEqual([[0, 0, 1, 1], [1, 0, 1, 2], [0, 1, 1, 1]])
  })

  it('removing a divider merges the openings it separated', () => {
    let tree = newFrame(1105, 1405)
    const interior = frameInterior(tree)
    tree = applyDividers(tree, frameOf(tree).key, 1, 2, interior.width, interior.height, PV, 'solid')
    tree = setValues(tree, 'transomPart', { offset: 301 })
    tree = addDividerInCell(tree, frameOf(tree).key,
      { axis: 'mullion', index: 1, offset: 493, profileValues: PV })
    expect(openingsOf(tree).length).toBe(3)

    // take the short mullion away: back to a transom and two openings
    const mullionKey = findFirst(tree, 'mullionPart').key
    tree = removeDivider(tree, frameOf(tree).key, mullionKey)
    expect(dividersOf(tree).map(d => d.part_type)).toEqual(['transomPart'])
    expect(openingsOf(tree).length).toBe(2)
    expect(shapeOf(tree)).toEqual([[0, 0, 1, 1], [0, 1, 1, 1]])
    expect(sizesOf(tree)).toEqual([[1031, 301], [1031, 983]])
  })

  it('removing the divider a short one stops at makes that one run frame to frame', () => {
    // Otherwise the short mullion would point at a divider that has gone.
    let tree = newFrame(1105, 1405)
    const interior = frameInterior(tree)
    tree = applyDividers(tree, frameOf(tree).key, 1, 2, interior.width, interior.height, PV, 'solid')
    tree = setValues(tree, 'transomPart', { offset: 301 })
    tree = addDividerInCell(tree, frameOf(tree).key,
      { axis: 'mullion', index: 1, offset: 493, profileValues: PV })

    const transomKey = findFirst(tree, 'transomPart').key
    tree = removeDivider(tree, frameOf(tree).key, transomKey)

    const mullion = findFirst(tree, 'mullionPart')
    expect(mullion.values.startDivider).toBe('0')
    expect(mullion.values.endDivider).toBe('0')
    expect(isShortDivider(tree, mullion)).toBe(false)
    expect(shapeOf(tree)).toEqual([[0, 0, 1, 1], [1, 0, 1, 1]])
    expect(sizesOf(tree)).toEqual([[493, 1311], [511, 1311]])
  })

  it('removing a divider that is not there changes nothing', () => {
    const tree = newFrame(1200, 1300)
    expect(removeDivider(tree, frameOf(tree).key, 'nosuchkey')).toBe(tree)
  })


  // ── Step AV — which sash is the fanlight, once an opening spans ───────────
  // applyFanlightBottomRails used to call the first `cols` openings in the
  // list the top row. With a spanning opening that is wrong in both
  // directions: on TC1 it made A2 a fanlight, and on TC3 the full-height
  // opener. The rail must follow the CELL.
  //
  // A profile where the two rails differ — Integrate's own
  // casementSashPart.bottomHeight (the ordinary rail) against
  // defaultFanlightBottomHeight (the fanlight's).
  const RAIL_ROWS = [
    ...ROWS.filter(r => r.field_key !== 'casementSashPart.defaultFanlightBottomHeight'),
    { profile_id: 2, field_key: 'casementSashPart.bottomHeight',               default_value: '83' },
    { profile_id: 2, field_key: 'casementSashPart.defaultFanlightBottomHeight', default_value: '62' },
  ]
  const railsOf = t => openingsOf(t).map(n => n.values?.bottomHeight)

  function tc1Shape() {
    let tree = newFrame(1105, 1405)
    const interior = frameInterior(tree)
    tree = applyDividers(tree, frameOf(tree).key, 1, 2, interior.width, interior.height, PV, 'solid')
    tree = setValues(tree, 'transomPart', { offset: 301 })
    return addDividerInCell(tree, frameOf(tree).key,
      { axis: 'mullion', index: 1, offset: 493, profileValues: PV })
  }
  function tc3Shape() {
    let tree = newFrame(1205, 1295)
    const interior = frameInterior(tree)
    tree = applyDividers(tree, frameOf(tree).key, 2, 1, interior.width, interior.height, PV, 'solid')
    tree = setValues(tree, 'mullionPart', { offset: 543 })
    return addDividerInCell(tree, frameOf(tree).key,
      { axis: 'transom', index: 1, offset: 354, profileValues: PV })
  }

  it('TC1: only the spanning top opening takes the fanlight rail', () => {
    const before = tc1Shape()
    expect(railsOf(before)).toEqual([83, 83, 83])
    const { tree, changed } = applyFanlightBottomRails(before, RAIL_ROWS)
    // A1 spans both columns and is the fanlight; A2 and B2 are not
    expect(railsOf(tree)).toEqual([62, 83, 83])
    expect(changed.length).toBe(1)
  })

  it('TC3: the full-height opener is NOT a fanlight, the one over the fixed sash is', () => {
    const { tree, changed } = applyFanlightBottomRails(tc3Shape(), RAIL_ROWS)
    // [A1 spanning both rows, B1, B2]
    expect(railsOf(tree)).toEqual([83, 62, 83])
    expect(changed.length).toBe(1)
  })

  it('a plain 2 x 2 grid still gives both top-row sashes the fanlight rail', () => {
    let tree = newFrame(1299, 1499)
    const interior = frameInterior(tree)
    tree = applyDividers(tree, frameOf(tree).key, 2, 2, interior.width, interior.height, PV, 'solid')
    const after = applyFanlightBottomRails(tree, RAIL_ROWS).tree
    expect(railsOf(after)).toEqual([62, 62, 83, 83])
  })

  it('resizing carries the spanning openings with their cells', () => {
    // The cells are read from the offsets, so re-spacing the columns moves
    // the span with them — the fanlight stays one opening across the top.
    let tree = newFrame(1105, 1405)
    const interior = frameInterior(tree)
    tree = applyDividers(tree, frameOf(tree).key, 1, 2, interior.width, interior.height, PV, 'solid')
    tree = setValues(tree, 'transomPart', { offset: 301 })
    tree = addDividerInCell(tree, frameOf(tree).key,
      { axis: 'mullion', index: 1, offset: 493, profileValues: PV })

    const wider = resizeCasementFrame(tree, { width: 1505, height: 1605 }).tree
    expect(shapeOf(wider)).toEqual([[0, 0, 2, 1], [0, 1, 1, 1], [1, 1, 1, 1]])
    const cells = frameCells(wider)
    // the span is still the whole interior width, and the extra height went
    // to the bottom row — the fanlight keeps its 301
    expect(cells[0].width).toBe(frameInterior(wider).width)
    expect(cells[0].height).toBe(301)
    expect(cells[1].height).toBe(1183)
    expect(cells[1].width + 27 + cells[2].width).toBe(frameInterior(wider).width)
  })
})
