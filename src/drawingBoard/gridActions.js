// gridActions.js — tree mutations for the drawing board's "Transom /
// Mullion..." and "Glazing bar..." grid pickers.
//
// Pulled out of DrawingBoard.jsx (a page component) so these pure functions
// can be unit-tested directly, and so DrawingBoard.jsx.gridActions.test.js
// exercises the exact same code path the UI buttons call — the Step J bug
// this fixes was a grid handler that never actually produced the tree shape
// its own render tests were hand-built against.

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
