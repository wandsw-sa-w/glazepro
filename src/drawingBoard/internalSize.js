// internalSize.js — entering the SASH size (Integrate's "Internal Frame
// Width / Height") instead of the overall frame size.
//
// Nathan's rule (9 Oct 2026, docs/integrate-internal-size-entry.txt): on a
// sash replacement surveyors only ever enter the sash size; on a complete new
// they enter either. Integrate's arithmetic, confirmed by the reviewer on
// L31115 Item 1 Drawing 2:
//     overall frame width  = internal width  + left jamb + right jamb
//     overall frame height = internal height + head      + cill height
// (Integrate 930 → 940 internal made the frame 1100 → 1110 with the jambs
// unchanged; internal height 1451 → 1461 made the frame 1600 → 1610.)
//
// The FRAME values stay the stored source of truth — the internal fields are
// an alternative way to set them, and every other dimension (clearances, sash
// sizes, glass) stays derived exactly as it is today. Pricing is untouched:
// the engine prices the finished geometry, however it was entered.
//
// Frames with more than one opening (a mullion, so more than one pair) are
// NOT handled here: Integrate asks "set for all sliding frames / this one
// only" there, which is out of scope (step-al brief §1). Those frames keep
// frame-only entry.

export const INTERNAL_ENTRY_NOTE = 'Sash replacement: enter the sash size'

/** The frame fields whose size moves the internal size (step-al §2). */
export const JAMB_SIZE_FIELDS = new Set([
  'assemblyFramePart.leftWidth',
  'assemblyFramePart.rightWidth',
  'assemblyFramePart.topHeight',
  'cillPart.height',
])

// ── Tree helpers (local copies — this module stays pure) ────────────────────

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

function findAll(node, partType, acc = []) {
  if (!node) return acc
  if (node.part_type === partType) acc.push(node)
  for (const child of (node.children ?? [])) findAll(child, partType, acc)
  return acc
}

function updateNodeValues(tree, key, patch) {
  if (!tree) return tree
  if (tree.key === key) return { ...tree, values: { ...tree.values, ...patch } }
  return { ...tree, children: (tree.children ?? []).map(c => updateNodeValues(c, key, patch)) }
}

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return isFinite(n) ? n : null
}

// ── Where internal-size entry applies ───────────────────────────────────────

/**
 * A single-opening sash window: exactly one sash pair and no mullion on the
 * frame. Multi-opening frames keep frame-only entry (see the header).
 */
export function isSingleOpeningSashWindow(tree) {
  const frame = findFirst(tree, 'assemblyFramePart')
  if (!frame) return false
  const mullions = (frame.children ?? []).filter(c => c.part_type === 'mullionPart')
  return findAll(tree, 'sashPairPart').length === 1 &&
         mullions.length === 0 &&
         findAll(tree, 'casementSashPart').length === 0 &&
         findAll(tree, 'doorLeafPart').length === 0
}

/**
 * How sizes are entered on this drawing:
 *   'internal'    sash replacement — internal is typed, frame is derived
 *   'both'        complete new — either may be typed, each updates the other
 *   'frame_only'  multi-opening frames, casements, doors: as today
 */
export function sizeEntryMode(tree) {
  if (!isSingleOpeningSashWindow(tree)) return 'frame_only'
  const typeOfWork = findFirst(tree, 'drawingItemPart')?.values?.typeOfWork ?? null
  if (typeOfWork == null) return 'frame_only'
  return typeOfWork === 'complete_new' ? 'both' : 'internal'
}

// ── The arithmetic (both directions) ────────────────────────────────────────

/** The jamb/head/cill sizes the two sizes differ by. */
function frameMargins(tree) {
  const frame = findFirst(tree, 'assemblyFramePart')
  const cill  = findFirst(tree, 'cillPart')
  const fv = frame?.values ?? {}
  return {
    frameKey: frame?.key ?? null,
    left:  num(fv.leftWidth)  ?? 0,
    right: num(fv.rightWidth) ?? 0,
    head:  num(fv.topHeight)  ?? 0,
    cill:  num(cill?.values?.height) ?? 0,
  }
}

/**
 * The internal (sash) size this tree's frame gives — the same arithmetic
 * computeDerived uses for the pair's internalWidth / internalHeight, so the
 * displayed derived values and this helper can never disagree.
 *
 * @returns {{width: number|null, height: number|null}}
 */
export function internalSizeOf(tree) {
  const frame = findFirst(tree, 'assemblyFramePart')
  const fv = frame?.values ?? {}
  const m = frameMargins(tree)
  const w = num(fv.width)
  const h = num(fv.height)
  return {
    width:  w != null ? w - m.left - m.right : null,
    height: h != null ? h - m.head - m.cill  : null,
  }
}

/**
 * Set the frame from an internal (sash) size — Integrate's arithmetic.
 * Only the axes given are changed; a null/blank value is ignored (so a
 * half-typed box never writes NaN into the frame).
 *
 * @param {{width?: number|null, height?: number|null}} internal
 */
export function frameFromInternalSize(tree, internal = {}) {
  const m = frameMargins(tree)
  if (!m.frameKey) return tree
  const patch = {}
  const w = num(internal.width)
  const h = num(internal.height)
  if (w != null) patch.width  = w + m.left + m.right
  if (h != null) patch.height = h + m.head + m.cill
  if (Object.keys(patch).length === 0) return tree
  return updateNodeValues(tree, m.frameKey, patch)
}

/**
 * Step AL §2 — keep the sash size when the jambs, head or cill change.
 *
 * On a SASH REPLACEMENT the surveyor measured the sashes, so when the frame's
 * jamb/head/cill sizes change (switching to Spiral Hung applies the 28 mm
 * spiral jambs, for instance) the internal size is kept and the frame is
 * recomputed around it.
 *
 * This is a DELIBERATE DIFFERENCE from Integrate, which keeps the overall
 * frame and lets the sashes grow (docs/integrate-differences.md difference 3;
 * benchmark F is Integrate doing exactly that). On a COMPLETE NEW item the
 * overall frame is kept, as Integrate does — no change from today.
 *
 * @param {Object} tree     the tree AFTER the jamb/head/cill change
 * @param {{width: number|null, height: number|null}} internalBefore
 *        the internal size read BEFORE it (internalSizeOf)
 */
export function keepInternalSize(tree, internalBefore) {
  if (!internalBefore) return tree
  if (sizeEntryMode(tree) !== 'internal') return tree
  return frameFromInternalSize(tree, internalBefore)
}
