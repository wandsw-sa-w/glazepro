// gridActions.js — tree mutations for the drawing board's "Transom /
// Mullion..." and "Glazing bar..." grid pickers.
//
// Pulled out of DrawingBoard.jsx (a page component) so these pure functions
// can be unit-tested directly, and so DrawingBoard.jsx.gridActions.test.js
// exercises the exact same code path the UI buttons call — the Step J bug
// this fixes was a grid handler that never actually produced the tree shape
// its own render tests were hand-built against.

import {
  frameCells, frameInterior, sortedDividers,
} from '../pricing/casementGeometry.js'

export function makeKey(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9)
}

// Deep-clone a subtree with fresh keys at every node (used to duplicate a
// sash pair — including its bars — into a new opening).
export function cloneWithNewKeys(node) {
  const prefix = (node.part_type || 'part').replace(/Part$/, '')
  return {
    ...node,
    key: makeKey(prefix),
    // Step AU: `values` is COPIED, not shared. The spread above is shallow,
    // so a cloned opening used to point at the ORIGINAL's values object —
    // editing A1's bottom rail in place silently edited B1's too. The board's
    // own field handler replaces values immutably, so the app never hit it,
    // but it is a trap for anything that does mutate (a test did).
    values: { ...(node.values ?? {}) },
    children: (node.children ?? []).map(cloneWithNewKeys),
  }
}

// Apply an N-column x M-row grid to the frame — Integrate's "Transom /
// Mullion..." picker. Replaces the frame's mullions/transoms/sash pairs
// with: (cols-1) mullions + (rows-1) transoms at equal spacing, and one
// sashPairPart per column, each a copy of the tree's current first sash
// pair (so its values and glazing bars carry over into the new openings).
// Tree order == left-to-right opening order, so SashElevation's existing
// A/B/C labelling picks the new pairs up automatically.
// cols=1, rows=1 collapses back to a single pair and removes the dividers.
//
// Note: rows > 1 adds the transom dividers but does not yet stack sash
// pairs vertically — SashElevation lays sash pairs out in a single
// horizontal row (via computeOpeningLayout on the frame's mullions only),
// so a true N x M grid needs per-row vertical geometry the renderer
// doesn't have yet. Columns (mullions) are fully supported.
// Step AP: `mullionKind` says which mullion the drawing's PROFILE uses —
// 'hollow' for a box sash frame (it houses the weights; thickness from the
// profile's thicknessInFrameHollow) or 'solid' for a casement frame
// (thickness from thicknessInFrameSolid). The caller decides from the
// drawing's profile, not by guessing from the tree. On a casement frame the
// new openings copy the FIRST OPENING (a casement sash or direct glazed
// unit) rather than a sash pair, and transoms are out of scope for this
// step — the picker offers columns only.
export function applyDividers(tree, frameKey, cols, rows, iW, iH, profileValues = null, mullionKind = 'hollow') {
  // Step AE item 1: a new MULLION on a BOX SASH frame is HOLLOW (it houses
  // the weights); on a CASEMENT frame it is SOLID (Step AP). Either way its
  // thickness comes from the drawing's profile — thicknessInFrameHollow or
  // thicknessInFrameSolid — and a missing value is an error the caller
  // shows, never a guessed section. Offsets are LEFT faces giving equal
  // openings, Integrate's model (step-ad brief §3):
  //   opening  = (iW − n × t) / (n + 1)        n mullions of thickness t
  //   offset_i = i × opening + (i − 1) × t     i = 1..n
  //
  // Step AR: a CASEMENT frame now takes TRANSOMS too, and its transom is the
  // mullion turned through 90° — solid, its own stored thickness, and an
  // `offset` that is the height of the opening ABOVE it. The TOP row is the
  // fanlight and takes the fanlight height (Integrate's template value 356,
  // or a profile key if one exists — see FANLIGHT_HEIGHT_KEYS); any further
  // rows split what is left equally. A BOX SASH frame's transom is unchanged:
  // the centre-line offset round(iH × row / rows) with thicknessInFrame 40
  // (step-ae brief §1).
  const solid = mullionKind === 'solid'
  const nMullions = Math.max(0, cols - 1)
  const nTransoms = Math.max(0, rows - 1)
  let mullionT = 0
  if (nMullions > 0) {
    const key = solid ? 'thicknessInFrameSolid' : 'thicknessInFrameHollow'
    mullionT = Number(profileValues?.[key])
    if (!isFinite(mullionT) || mullionT <= 0) {
      throw new Error(
        `Missing profile value ${key} — a ${solid ? 'casement mullion is solid' : 'box sash mullion is hollow'} and takes its thickness from the profile. No mullions were added; check the drawing's profile values.`)
    }
  }
  const openingW = (iW - nMullions * mullionT) / (nMullions + 1)
  const mullionStop = solid
    ? (Number(profileValues?.mullionStopSize) || Number(profileValues?.frameStileStopSize) || 0)
    : null

  // A casement transom: the same solid section as the mullion (Integrate's
  // own 27 with 20/20 stops on the flush casement profile — there is no
  // separate transom thickness key, which casementTransomThickness reports).
  const transomT    = (solid && nTransoms > 0) ? casementTransomThickness(profileValues) : 40
  const transomStop = solid ? mullionStop : null
  const fanlight    = solid ? fanlightHeight(profileValues) : null
  // Row extents, TOP first: the fanlight, then the rest split equally.
  const rowHeights = []
  if (solid && nTransoms > 0) {
    const remaining = iH - nTransoms * transomT - fanlight.height
    for (let i = 0; i < rows; i++) {
      rowHeights.push(i === 0 ? fanlight.height : remaining / nTransoms)
    }
  }

  function process(node) {
    if (node.key !== frameKey) {
      return { ...node, children: (node.children ?? []).map(process) }
    }

    // What an opening is depends on the frame: a sash pair on a box sash
    // frame, or a casement sash / direct glazed unit on a casement frame.
    const OPENING_TYPES = solid
      ? ['casementSashPart', 'glassPart']
      : ['sashPairPart']
    const existingOpenings = (node.children ?? []).filter(c => OPENING_TYPES.includes(c.part_type))
    const others = (node.children ?? []).filter(
      c => c.part_type !== 'mullionPart' && c.part_type !== 'transomPart' &&
           !OPENING_TYPES.includes(c.part_type)
    )
    // The columns the frame is on NOW, so a new ROW copies the opening in
    // its own column rather than always copying the first one.
    const prevCols = Math.max(1,
      (node.children ?? []).filter(c => c.part_type === 'mullionPart').length + 1)

    const mullions = Array.from({ length: nMullions }, (_, idx) => ({
      key:       makeKey('mull'),
      part_type: 'mullionPart',
      // offset = LEFT face; the resolved thickness is stored, as Integrate
      // stores it (144 hollow on the Sash profile, 27 solid on Casement).
      // Step AH 3b: stored offsets are rounded to 0.1 mm — Integrate
      // stores to 1 dp (e.g. 252.7); unrounded thirds stored
      // 180.66666666666666.
      values: {
        offset: Math.round(((idx + 1) * openingW + idx * mullionT) * 10) / 10,
        thicknessInFrame: mullionT,
        ...(solid ? { mullionStopSize: mullionStop } : {}),
        // Step AV: a grid divider runs frame to frame, which Integrate
        // stores as startDivider / endDivider '0'. Stored on every one so
        // the two picker modes write the same shape of data.
        startDivider: '0',
        endDivider: '0',
      },
      children:  [],
    }))

    const transoms = Array.from({ length: nTransoms }, (_, i) => {
      if (!solid) {
        return {
          key: makeKey('trans'), part_type: 'transomPart',
          values: { offset: Math.round(iH * (i + 1) / rows), thicknessInFrame: 40 },
          children: [],
        }
      }
      // Casement: offset = the total height ABOVE this transom
      let above = 0
      for (let r = 0; r <= i; r++) above += rowHeights[r] + (r < i ? transomT : 0)
      return {
        key: makeKey('trans'), part_type: 'transomPart',
        values: {
          offset: Math.round(above * 10) / 10,
          thicknessInFrame: transomT,
          transomStopSize:  transomStop,
          startDivider: '0',
          endDivider: '0',
        },
        children: [],
      }
    })

    // New openings COPY the opening they split, with fresh keys, and come out
    // in Integrate's matrix order — A1, B1, … across the top row, then down.
    const openings = []
    if (existingOpenings.length > 0) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // The opening this cell comes from: the one in the same column of
          // the frame's existing top row, falling back to the first.
          const source = existingOpenings[Math.min(c, prevCols - 1)] ?? existingOpenings[0]
          openings.push(r === 0 && c === 0 ? existingOpenings[0] : cloneWithNewKeys(source))
        }
      }
    }

    return { ...node, children: [...mullions, ...transoms, ...openings, ...others] }
  }
  return process(tree)
}

// Profile keys that could hold the fanlight (top row) height. NOT VERIFIED:
// the reviewer's 12 Oct reading of the casement profile lists no fanlight
// HEIGHT key — `defaultFanlightBottomHeight` (83) is the fanlight's bottom
// RAIL, not its height. Integrate's own template puts the transom at 356, so
// that is the fallback, and `source` says which was used so the board and the
// report can state it.
const FANLIGHT_HEIGHT_KEYS = [
  'defaultFanlightHeight',
  'fanlightHeight',
  'defaultFanlightOpeningHeight',
  'defaultTransomOffset',
]

/** Integrate's own flush casement template value (docs/integrate-L31115-fanlights.txt). */
export const INTEGRATE_FANLIGHT_HEIGHT_MM = 356

export function fanlightHeight(profileValues) {
  for (const key of FANLIGHT_HEIGHT_KEYS) {
    const v = Number(profileValues?.[key])
    if (isFinite(v) && v > 0) return { height: v, source: key }
  }
  return { height: INTEGRATE_FANLIGHT_HEIGHT_MM, source: 'integrate_template' }
}

/**
 * A casement transom's thickness in the frame.
 *
 * The casement profile has NO transom thickness key (reviewer, 12 Oct), and
 * Integrate's stored transom is 27 with 20/20 stops — the same section as its
 * solid mullion, whose profile key `thicknessInFrameSolid` is also 27. So the
 * solid mullion value is used and the agreement is recorded, rather than 27
 * being written in as a constant.
 */
export function casementTransomThickness(profileValues) {
  const own = Number(profileValues?.thicknessInFrameTransom)
  if (isFinite(own) && own > 0) return own
  const solid = Number(profileValues?.thicknessInFrameSolid)
  if (isFinite(solid) && solid > 0) return solid
  throw new Error(
    'Missing profile value thicknessInFrameSolid — a casement transom is solid and takes the same section as the mullion. No transoms were added; check the drawing’s profile values.')
}

// Replace all bar children of a glassPart with new evenly-spaced bars.
// cols × rows → (cols-1) vertical bars + (rows-1) horizontal bars.
export function applyBars(tree, glassKey, cols, rows) {
  function process(node) {
    if (node.key !== glassKey) {
      return { ...node, children: (node.children ?? []).map(process) }
    }
    const others = (node.children ?? []).filter(
      c => c.part_type !== 'verticalGlazingBarPart' && c.part_type !== 'horizontalGlazingBarPart'
    )
    const vBars = Array.from({ length: cols - 1 }, () => ({
      key: makeKey('vbar'), part_type: 'verticalGlazingBarPart',
      values: { offset: 0, thickness: 20, nib: 4, tail: 4, tailLinkType: 1 }, children: [],
    }))
    const hBars = Array.from({ length: rows - 1 }, () => ({
      key: makeKey('hbar'), part_type: 'horizontalGlazingBarPart',
      values: { offset: 0, thickness: 20, nib: 4, tail: 4, tailLinkType: 1 }, children: [],
    }))
    return { ...node, children: [...vBars, ...hBars, ...others] }
  }
  return process(tree)
}

// The grid a frame is ALREADY on: (mullions + 1) columns by (transoms + 1)
// rows. Step AQ item 7: the picker used to open at 1 × 1 — "0 mullions" — on
// a frame that already had a mullion, so a surveyor who opened it to check
// and pressed Apply was told it would "Remove dividers".
export function frameGrid(tree, frameKey) {
  function find(node) {
    if (!node) return null
    if (node.key === frameKey) return node
    for (const child of (node.children ?? [])) {
      const found = find(child)
      if (found) return found
    }
    return null
  }
  const frame = frameKey ? find(tree) : null
  const children = frame?.children ?? []
  return {
    cols: children.filter(c => c.part_type === 'mullionPart').length + 1,
    rows: children.filter(c => c.part_type === 'transomPart').length + 1,
  }
}

// ── Step AV: a divider in ONE column or ONE row ──────────────────────────────

/**
 * Add a divider that STOPS AT ANOTHER DIVIDER — a transom in one column, or
 * a mullion in one row — which is how Integrate's combination templates are
 * built (its startDivider / endDivider).
 *
 * `applyDividers` above lays out a whole grid of full-width dividers. This is
 * the other picker mode: it ADDS one divider bounded by the crossing dividers
 * that already bound the chosen column or row, leaving everything else alone.
 *
 *   axis 'transom'  + colIndex  → a transom in that column only (TC3)
 *   axis 'mullion'  + rowIndex  → a mullion in that row only    (TC1)
 *
 * The new divider's offset is measured on its own axis exactly as a full one
 * is: the extent of the opening ABOVE a transom, or to the LEFT of a mullion.
 * The openings it separates are rebuilt by copying the one being split, so
 * the new pair keeps its sections — the same rule the grid picker follows.
 *
 * Returns the new tree, as applyDividers does.
 */
export function addDividerInCell(tree, frameKey, {
  axis,
  index = 0,
  offset = null,
  profileValues = null,
} = {}) {
  const frame = findFrame(tree, frameKey)
  if (!frame) return tree

  const isTransom = axis === 'transom'
  const crossingType = isTransom ? 'mullionPart' : 'transomPart'
  const crossing = (frame.children ?? [])
    .filter(c => c.part_type === crossingType)
    .sort((a, b) => (Number(a.values?.offset) || 0) - (Number(b.values?.offset) || 0))

  // A divider "in one column" needs a column to be in: that means at least
  // one crossing divider. With none, the caller wants the whole-frame
  // picker instead, and saying so beats quietly adding a full divider.
  if (crossing.length === 0) {
    throw new Error(
      `A ${axis} in one ${isTransom ? 'column' : 'row'} needs a ${isTransom ? 'mullion' : 'transom'} to stop at. ` +
      'Add one across the whole frame first, or choose "across the whole frame".')
  }

  const thickness = Number(profileValues?.thicknessInFrameSolid)
  if (!isFinite(thickness) || thickness <= 0) {
    throw new Error(
      'Missing profile value thicknessInFrameSolid — a casement divider is solid and takes its ' +
      'thickness from the profile. Nothing was added; check the drawing’s profile values.')
  }
  const stop = Number(profileValues?.mullionStopSize) ||
    Number(profileValues?.frameStileStopSize) || 0

  // The slot the new divider sits in is bounded by crossing[index - 1] and
  // crossing[index]: startDivider is the one BEFORE it, endDivider the one
  // after, and '0' wherever that is the frame.
  const slot = Math.max(0, Math.min(index, crossing.length))
  return insertBoundedDivider(tree, frame, {
    axis,
    offset,
    thickness,
    stop,
    startDivider: slot > 0 ? crossing[slot - 1].key : '0',
    endDivider:   slot < crossing.length ? crossing[slot].key : '0',
  })
}

/**
 * Split ONE opening with a transom or a mullion — Integrate's "1x2" and "2x1"
 * tiles when an opening's glazing is selected (Step AW).
 *
 * The new divider stops at whatever bounds that opening, which may be the
 * frame or another divider, so splitting the lower opening of a fanlight
 * window with a mullion gives TC1 and splitting column B of a two-column
 * frame with a transom gives TC3. It goes in the MIDDLE of the opening; the
 * surveyor types the exact offset afterwards.
 *
 * A SPANNING opening can be split too: TC1's fanlight runs across both
 * columns, and a mullion through it stops at the transom below.
 *
 * @returns {Object} the new tree, or the tree unchanged if the opening is not
 *   an opening of that frame
 */
export function splitOpening(tree, frameKey, openingKey, axis, profileValues = null) {
  const frame = findFrame(tree, frameKey)
  if (!frame) return tree

  const openings = (frame.children ?? []).filter(c => OPENING_TYPES.includes(c.part_type))
  const idx = openings.findIndex(c => c.key === openingKey)
  if (idx < 0) return tree

  const cells = frameCells(tree)
  const cell = cells[idx]
  if (!cell) return tree

  const isTransom = axis === 'transom'
  const thickness = Number(profileValues?.thicknessInFrameSolid)
  if (!isFinite(thickness) || thickness <= 0) {
    throw new Error(
      'Missing profile value thicknessInFrameSolid — a casement divider is solid and takes its ' +
      'thickness from the profile. Nothing was added; check the drawing’s profile values.')
  }
  const stop = Number(profileValues?.mullionStopSize) ||
    Number(profileValues?.frameStileStopSize) || 0

  // What bounds the opening on the axis the new divider CROSSES. A mullion is
  // bounded above and below by transoms; a transom left and right by
  // mullions. '0' wherever that bound is the frame itself.
  const crossing = sortedDividers(frame, isTransom ? 'mullionPart' : 'transomPart')
  const first = isTransom ? cell.col : cell.row
  const span  = isTransom ? cell.colSpan : cell.rowSpan
  const last  = first + span - 1
  const startDivider = first > 0 ? (crossing[first - 1]?.key ?? '0') : '0'
  const endDivider   = last < crossing.length ? (crossing[last]?.key ?? '0') : '0'

  // The middle of the opening, so the two halves are equal
  const from = isTransom ? cell.y : cell.x
  const size = isTransom ? cell.height : cell.width
  const offset = from + (size - thickness) / 2

  return insertBoundedDivider(tree, frame, {
    axis, offset, thickness, stop, startDivider, endDivider,
    sourceIndex: idx,
  })
}

const OPENING_TYPES = ['casementSashPart', 'glassPart']

/**
 * Write one divider into the frame and give the cell it splits a second
 * opening, keeping the openings in the row-major order frameCells uses.
 *
 * The order matters: openingNodes and frameCells are matched by POSITION
 * everywhere (labels, sash sizes, the drawing), so an opening list that no
 * longer lines up with the cells would silently mislabel and mis-size the
 * window. Rather than reason about where the copy belongs, this computes the
 * cells AFTER the divider goes in and places each opening in the cell that
 * contains it.
 */
function insertBoundedDivider(tree, frame, {
  axis, offset, thickness, stop, startDivider, endDivider, sourceIndex = null,
}) {
  const isTransom = axis === 'transom'
  const divider = {
    key: makeKey(isTransom ? 'trans' : 'mull'),
    part_type: isTransom ? 'transomPart' : 'mullionPart',
    values: {
      // Stored to 1 dp, as Integrate stores offsets (Step AH 3b)
      offset: Math.round((Number(offset) || 0) * 10) / 10,
      thicknessInFrame: thickness,
      ...(isTransom ? { transomStopSize: stop } : { mullionStopSize: stop }),
      startDivider,
      endDivider,
    },
    children: [],
  }

  const openings = (frame.children ?? []).filter(c => OPENING_TYPES.includes(c.part_type))
  const oldCells = frameCells(tree)

  // The divider alone, openings untouched, so the new cells can be read
  const withDivider = replaceFrameChildren(tree, frame.key, node => {
    const others = (node.children ?? []).filter(c => !OPENING_TYPES.includes(c.part_type))
    return [...others.filter(c => c.part_type !== 'cillPart'), divider,
      ...openings,
      ...others.filter(c => c.part_type === 'cillPart')]
  })
  const newCells = frameCells(withDivider)

  // Each new cell takes the opening of the old cell its top-left corner sits
  // in. The split cell is hit twice: the second time takes a copy, so both
  // halves keep the sections the surveyor had set.
  const used = new Set()
  const placed = newCells.map(c => {
    let oldIdx = oldCells.findIndex(o =>
      c.x >= o.x && c.x < o.x + o.width && c.y >= o.y && c.y < o.y + o.height)
    if (oldIdx < 0) oldIdx = sourceIndex ?? 0
    const source = openings[oldIdx] ?? openings[sourceIndex ?? 0] ?? openings[0]
    if (!source) return null
    if (used.has(oldIdx)) return cloneWithNewKeys(source)
    used.add(oldIdx)
    return source
  }).filter(Boolean)

  return replaceFrameChildren(tree, frame.key, node => {
    const others = (node.children ?? []).filter(c => !OPENING_TYPES.includes(c.part_type))
    return [...others.filter(c => c.part_type !== 'cillPart'), divider,
      ...placed,
      ...others.filter(c => c.part_type === 'cillPart')]
  })
}

/** Rebuild one frame's children, leaving the rest of the tree alone. */
function replaceFrameChildren(tree, frameKey, childrenOf) {
  function process(node) {
    if (node.key !== frameKey) {
      return { ...node, children: (node.children ?? []).map(process) }
    }
    return { ...node, children: childrenOf(node) }
  }
  return process(tree)
}

/**
 * Re-space the frame's mullions (or transoms) so every column (or row) slot
 * is the same size — Integrate's "Divider Spacing: Make Widths Equal" and
 * "Make Heights Equal" (Step AW).
 *
 * Only the OFFSETS move: no divider is added or removed, no divider stops
 * anywhere different, and the openings keep their cells. A short divider is
 * re-spaced with the rest, because a column slot is a column slot whether the
 * mullion that makes it reaches the cill or not.
 */
export function makeDividersEqual(tree, frameKey, axis) {
  const frame = findFrame(tree, frameKey)
  if (!frame) return tree
  const isWidths = axis === 'widths'
  const dividers = sortedDividers(frame, isWidths ? 'mullionPart' : 'transomPart')
  if (dividers.length === 0) return tree

  const interior = frameInterior(tree)
  const total = (isWidths ? interior.width : interior.height) ?? 0
  const thick = dividers.reduce((s, d) => s + (Number(d.values?.thicknessInFrame) || 0), 0)
  const slots = dividers.length + 1
  const each = (total - thick) / slots
  if (!(each > 0)) return tree

  // The near face of divider i sits after i+1 slots and i dividers
  const offsets = new Map()
  let at = 0
  for (const d of dividers) {
    at += each
    offsets.set(d.key, Math.round(at * 10) / 10)
    at += Number(d.values?.thicknessInFrame) || 0
  }

  return replaceFrameChildren(tree, frame.key, node =>
    (node.children ?? []).map(c => offsets.has(c.key)
      ? { ...c, values: { ...c.values, offset: offsets.get(c.key) } }
      : c))
}

/**
 * Remove a divider, MERGING the openings it separated.
 *
 * The openings it separated become one, so the extra parts go: the opening
 * that keeps its place is the first of them, which keeps the surveyor's
 * sections rather than a copy's.
 */
export function removeDivider(tree, frameKey, dividerKey) {
  const frame = findFrame(tree, frameKey)
  if (!frame) return tree
  if (!(frame.children ?? []).some(c => c.key === dividerKey)) return tree

  const openings = (frame.children ?? []).filter(c => OPENING_TYPES.includes(c.part_type))
  // One divider fewer means one opening fewer along its axis. Dropping the
  // LAST opening keeps A1 and the lower-numbered slots, which is what a
  // surveyor sees stay put.
  const keep = Math.max(1, openings.length - 1)
  const kept = openings.slice(0, keep)

  // Any divider that stopped AT this one now runs to the frame instead,
  // otherwise it would point at a divider that no longer exists.
  function relink(values) {
    const next = { ...values }
    if (next.startDivider === dividerKey) next.startDivider = '0'
    if (next.endDivider === dividerKey) next.endDivider = '0'
    return next
  }

  function process(node) {
    if (node.key !== frame.key) {
      return { ...node, children: (node.children ?? []).map(process) }
    }
    const children = (node.children ?? [])
      .filter(c => c.key !== dividerKey)
      .filter(c => !OPENING_TYPES.includes(c.part_type) || kept.includes(c))
      .map(c => (c.part_type === 'mullionPart' || c.part_type === 'transomPart')
        ? { ...c, values: relink(c.values) }
        : c)
    return { ...node, children }
  }
  return process(tree)
}

function findFrame(node, frameKey) {
  if (!node) return null
  if (node.key === frameKey && node.part_type === 'assemblyFramePart') return node
  if (!frameKey && node.part_type === 'assemblyFramePart') return node
  for (const child of (node.children ?? [])) {
    const found = findFrame(child, frameKey)
    if (found) return found
  }
  return null
}
