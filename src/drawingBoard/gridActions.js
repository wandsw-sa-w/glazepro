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
export function applyDividers(tree, frameKey, cols, rows, iW, iH, profileValues = null) {
  // Step AE item 1: a new MULLION on a box sash frame is HOLLOW (it houses
  // the weights). Its thickness is the profile value thicknessInFrameHollow
  // (missing = error, shown by the caller), and offsets are LEFT faces
  // giving equal openings — Integrate's model (step-ad brief §3):
  //   opening  = (iW − n × t) / (n + 1)        n mullions of thickness t
  //   offset_i = i × opening + (i − 1) × t     i = 1..n
  // TRANSOMS are NOT changed in this step: still centre-line offset
  // round(iH × row / rows) with thicknessInFrame 40 (step-ae brief §1 —
  // report only). GlazePro has no casement mullions (the board builds box
  // sash windows only).
  const nMullions = Math.max(0, cols - 1)
  let mullionT = 0
  if (nMullions > 0) {
    mullionT = Number(profileValues?.thicknessInFrameHollow)
    if (!isFinite(mullionT) || mullionT <= 0) {
      throw new Error(
        'Missing profile value thicknessInFrameHollow — a box sash mullion is hollow and takes its thickness from the profile. No mullions were added; check the drawing’s profile values.')
    }
  }
  const openingW = (iW - nMullions * mullionT) / (nMullions + 1)

  function process(node) {
    if (node.key !== frameKey) {
      return { ...node, children: (node.children ?? []).map(process) }
    }

    const existingPairs = (node.children ?? []).filter(c => c.part_type === 'sashPairPart')
    const templatePair   = existingPairs[0] ?? null
    const others = (node.children ?? []).filter(
      c => c.part_type !== 'mullionPart' && c.part_type !== 'transomPart' && c.part_type !== 'sashPairPart'
    )

    const mullions = Array.from({ length: nMullions }, (_, idx) => ({
      key:       makeKey('mull'),
      part_type: 'mullionPart',
      // offset = LEFT face; the resolved hollow thickness is stored, as
      // Integrate stores it (144 on the snapshot's Sash profile).
      // Step AH 3b: stored offsets are rounded to 0.1 mm — Integrate
      // stores to 1 dp (e.g. 252.7); unrounded thirds stored
      // 180.66666666666666.
      values:    { offset: Math.round(((idx + 1) * openingW + idx * mullionT) * 10) / 10, thicknessInFrame: mullionT },
      children:  [],
    }))
    const transoms = Array.from({ length: rows - 1 }, (_, i) => ({
      key:       makeKey('trans'),
      part_type: 'transomPart',
      values:    { offset: Math.round(iH * (i + 1) / rows), thicknessInFrame: 40 },
      children:  [],
    }))
    const pairs = templatePair
      ? Array.from({ length: cols }, (_, i) => (i === 0 ? templatePair : cloneWithNewKeys(templatePair)))
      : []

    return { ...node, children: [...mullions, ...transoms, ...pairs, ...others] }
  }
  return process(tree)
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
