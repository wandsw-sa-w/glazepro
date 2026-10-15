// dividerRefs.js — a SHORT divider's references, across a save (Step BH
// follow-up 2).
//
// Integrate's model, which Step AV copied: a divider names the dividers it
// starts and ends at — `startDivider` / `endDivider`, by KEY, with '0' for the
// frame itself. It is what lets a transom stop at two mullions, so the side
// lights beside it run full height and the fanlight sits over the door alone.
//
// THE BUG THIS MODULE EXISTS FOR, found twice:
//
//   1. creating a drawing from a template replaced every node key and left
//      the references behind (fixed in templates.js, Step BH follow-up 1);
//   2. SAVING replaces them again, and nothing rewrote them. `drawing_parts`
//      has no key column: the client sends `key` / `parent_key`, the rows get
//      DATABASE ids, and `loadDrawingParts` keys the tree by `String(row.id)`.
//      So a reference saved as 'a75a59df-…' (or a template's 'mull_wike8s5')
//      resolves to nothing the moment the drawing is re-opened.
//
// Read as frame-to-frame, a lost reference turns a 4-opening frame into a
// 3 x 2 grid of six cells: £7,095.53 against £8,936.47, with four panels of
// NEGATIVE area (live drawing 56, and 60 after it).
//
// THE FIX IS POSITIONAL, on purpose. Nothing identifies a divider across a
// save except WHERE IT IS: the nth mullion or transom of its frame, in offset
// order. So after every save the references are re-pointed by position —
// whatever ids the database handed out, and however many times they change.
//
// Pure: no supabase, no React. `api.js` uses it on the save path and the
// round-trip test uses it on a faithful fake.

import { itemFrames } from '../pricing/casementGeometry.js'

/** The values that hold ANOTHER NODE'S KEY. '0' means the frame itself. */
export const KEY_REF_FIELDS = ['startDivider', 'endDivider']
export const FRAME_REF = '0'

/** The two divider types a reference can name. */
const DIVIDER_TYPES = ['mullionPart', 'transomPart']

function walk(node, fn) {
  if (!node) return
  fn(node)
  for (const child of (node.children ?? [])) walk(child, fn)
}

/** Every reference in the tree that names a node rather than the frame. */
export function dividerRefsOf(tree) {
  const out = []
  walk(tree, node => {
    for (const field of KEY_REF_FIELDS) {
      const ref = node.values?.[field]
      if (ref != null && ref !== FRAME_REF) out.push({ node, field, ref })
    }
  })
  return out
}

/** Has this tree a SHORT divider at all? Most have none, and skip the work. */
export function hasDividerRefs(tree) {
  return dividerRefsOf(tree).length > 0
}

/** Every key in the tree, to tell a live reference from a dead one. */
export function keysOf(tree) {
  const keys = new Set()
  walk(tree, node => keys.add(node.key))
  return keys
}

/**
 * References that resolve to NOTHING.
 *
 * A dead reference must fail loudly — the board shows it as an error — never
 * be read as frame-to-frame, which is how £1,832.54 went missing twice.
 */
export function deadDividerRefs(tree) {
  const keys = keysOf(tree)
  return dividerRefsOf(tree)
    .filter(({ ref }) => !keys.has(ref))
    .map(({ node, field, ref }) => ({
      key: node.key, part_type: node.part_type, field, ref,
    }))
}

/**
 * WHERE each divider is: its frame, its type and its index among the dividers
 * of that type in that frame, in offset order.
 *
 * That is the only identity a divider keeps across a save, so it is what the
 * re-pointing is built on.
 */
function dividerPositions(tree) {
  const byKey = new Map()
  for (const frame of itemFrames(tree)) {
    for (const type of DIVIDER_TYPES) {
      const sorted = (frame.children ?? [])
        .filter(c => c.part_type === type)
        .map((node, i) => ({ node, i, offset: Number(node.values?.offset) }))
        .sort((a, b) => (a.offset - b.offset) || (a.i - b.i))
      sorted.forEach(({ node }, index) => {
        byKey.set(node.key, { frame: frame.key, type, index })
      })
    }
  }
  return byKey
}

/**
 * A map from the keys in `before` to the keys in `after`, for dividers, by
 * POSITION — the nth mullion or transom of the nth frame.
 *
 * The two trees must be the same drawing: the same frames in the same order
 * with the same dividers. A divider that has no counterpart is simply absent
 * from the map, and a caller that cannot find one leaves the reference alone
 * for `deadDividerRefs` to report.
 */
export function dividerRefMap(before, after) {
  const beforePos = dividerPositions(before)
  const afterPos  = dividerPositions(after)
  // the position -> key side of `after`
  const afterByPos = new Map()
  const frameIndex = tree => new Map(itemFrames(tree).map((f, i) => [f.key, i]))
  const afterFrames = frameIndex(after)
  for (const [key, pos] of afterPos) {
    afterByPos.set(`${afterFrames.get(pos.frame)}|${pos.type}|${pos.index}`, key)
  }
  const beforeFrames = frameIndex(before)
  const map = new Map()
  for (const [key, pos] of beforePos) {
    const at = `${beforeFrames.get(pos.frame)}|${pos.type}|${pos.index}`
    const to = afterByPos.get(at)
    if (to != null && to !== key) map.set(key, to)
  }
  return map
}

/**
 * Re-point every reference through `map` (old key -> new key).
 *
 * A reference to something NOT in the map is left exactly as it is: it is
 * either '0' or a node that has no counterpart, and quietly pointing it
 * somewhere new would be worse than leaving it to be reported.
 */
export function repointDividerRefs(node, map) {
  if (!node) return node
  const v = node.values ?? {}
  let values = v
  for (const field of KEY_REF_FIELDS) {
    const ref = v[field]
    if (ref == null || ref === FRAME_REF || !map.has(ref)) continue
    if (values === v) values = { ...v }
    values[field] = map.get(ref)
  }
  const children = (node.children ?? []).map(c => repointDividerRefs(c, map))
  const same = values === v &&
    children.every((c, i) => c === (node.children ?? [])[i])
  return same ? node : { ...node, values, children }
}

/**
 * What a SAVE has to put right: the tree as the database now holds it, with
 * its references pointing at the row keys instead of the client ones.
 *
 * `before` is the tree that was saved (client keys, valid references) and
 * `after` is the tree the database gives back (row-id keys, stale
 * references). Returns the corrected tree and ONLY the nodes whose values
 * changed, so the caller writes two rows rather than the whole drawing.
 *
 * It is positional, so it is right whatever ids the database hands out — and
 * it is run on every save, so a database that renumbers its rows every time
 * cannot break it.
 */
export function fixDividerRefsAfterSave(before, after) {
  if (!before || !after || !hasDividerRefs(before)) {
    return { tree: after, changed: [] }
  }
  const map = dividerRefMap(before, after)
  // `after` carries the references as they were SAVED, which are `before`'s
  // keys, so the same map re-points them.
  const tree = repointDividerRefs(after, map)
  const changed = []
  const pair = (a, b) => {
    if (!a || !b) return
    if (a.values !== b.values) changed.push({ key: b.key, values: b.values })
    const as = a.children ?? [], bs = b.children ?? []
    for (let i = 0; i < bs.length; i++) pair(as[i], bs[i])
  }
  pair(after, tree)
  return { tree, changed }
}
