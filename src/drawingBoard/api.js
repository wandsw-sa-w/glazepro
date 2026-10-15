import { supabase } from '../supabase.js'
import { hasDividerRefs, fixDividerRefsAfterSave } from './dividerRefs.js'

// ---------------------------------------------------------------------------
// Field definitions — grouped by part_type, active rows only, sorted
// ---------------------------------------------------------------------------
export async function loadFieldDefinitions() {
  const { data, error } = await supabase
    .from('default_field_definitions')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error

  const grouped = {}
  for (const field of data) {
    const key = field.part_type ?? '__unknown'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(field)
  }
  return grouped
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
export async function loadProfile(code) {
  const { data, error } = await supabase
    .from('default_profiles')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data  // null if not found
}

/**
 * A profile by id — the drawing's OWN default_profile_id.
 *
 * Step AP: the drawing board loaded the fallback 'sash' profile for every
 * drawing, so a casement drawing got sash frame, sash and glass defaults
 * and could not be built at all. It now loads the drawing's own profile and
 * falls back to 'sash' only when it has none.
 */
export async function loadProfileById(id) {
  if (!id) return null
  const { data, error } = await supabase
    .from('default_profiles')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data  // null if not found
}

/**
 * A DRAWING's profile CODE, or null.
 *
 * Step AY item 4: computeVariables needs it for is_replacement_sashes_range
 * ('sashes_only'), and every page that validates a drawing has to pass the
 * same thing. One helper rather than the same two-table lookup written out
 * in five places — a page that got it wrong would evaluate rule 12 against
 * the wrong range and nothing on screen would say so.
 *
 * It destructures the error as every Supabase call here does, and returns null
 * rather than throwing: a page that cannot read the profile should validate
 * with the variable unset, not fail to render.
 */
export async function loadDrawingProfileCode(drawingId) {
  if (!drawingId) return null
  const { data: dwg, error: dErr } = await supabase
    .from('drawings')
    .select('default_profile_id')
    .eq('id', drawingId)
    .maybeSingle()
  if (dErr || !dwg?.default_profile_id) return null
  const { data, error } = await supabase
    .from('default_profiles')
    .select('code')
    .eq('id', dwg.default_profile_id)
    .maybeSingle()
  if (error) return null
  return data?.code ?? null
}

export async function loadProfileValues(profileId) {
  const { data, error } = await supabase
    .from('default_profile_values')
    .select('*')
    .eq('profile_id', profileId)
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Reference options — grouped by category, active rows only
// ---------------------------------------------------------------------------
export async function loadReferenceOptions(categoryCodes) {
  if (!categoryCodes || categoryCodes.length === 0) return {}

  const { data, error } = await supabase
    .from('reference_options')
    .select('*')
    .in('category', categoryCodes)
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error

  const grouped = {}
  for (const opt of data) {
    if (!grouped[opt.category]) grouped[opt.category] = []
    grouped[opt.category].push(opt)
  }
  return grouped
}

// ---------------------------------------------------------------------------
// Containment rules (part_type_children — all rows)
// ---------------------------------------------------------------------------
export async function loadContainment() {
  const { data, error } = await supabase
    .from('part_type_children')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Drawing parts — load flat rows and build nested tree
// ---------------------------------------------------------------------------
export async function loadDrawingParts(drawingId) {
  const { data, error } = await supabase
    .from('drawing_parts')
    .select('*')
    .eq('drawing_id', drawingId)
    .order('sort_order')
  if (error) throw error
  if (!data || data.length === 0) return null

  // Index by id, attach a stable string key and empty children array
  const byId = {}
  for (const row of data) {
    byId[row.id] = { ...row, key: String(row.id), children: [] }
  }

  // Wire up the tree
  let root = null
  for (const row of data) {
    const node = byId[row.id]
    if (row.parent_part_id === null) {
      root = node
    } else {
      const parent = byId[row.parent_part_id]
      if (parent) parent.children.push(node)
    }
  }

  // Sort children by sort_order at every level
  function sortChildren(node) {
    node.children.sort((a, b) => a.sort_order - b.sort_order)
    node.children.forEach(sortChildren)
  }
  if (root) sortChildren(root)

  return root
}

// ---------------------------------------------------------------------------
// Save drawing parts — flatten tree to p_parts shape and call the RPC
// ---------------------------------------------------------------------------
export async function saveDrawingParts(drawingId, tree) {
  const parts = []

  function flatten(node, parentKey) {
    const key = node.key ?? String(node.id ?? crypto.randomUUID())
    parts.push({
      key,
      parent_key: parentKey ?? null,
      part_type:  node.part_type,
      sort_order: node.sort_order ?? 0,
      values:     node.values ?? {},
    })
    for (const child of (node.children ?? [])) {
      flatten(child, key)
    }
  }

  flatten(tree, null)

  const { data, error } = await supabase.rpc('save_drawing_parts', {
    p_drawing_id: drawingId,
    p_parts:      parts,
  })
  if (error) throw error

  // ── Step BH follow-up 2 item 1: a SHORT divider’s references ───────────
  //
  // `drawing_parts` has no key column. The client sends `key` /
  // `parent_key`, the rows get DATABASE ids, and `loadDrawingParts` keys the
  // tree by `String(row.id)` — so a divider that names the dividers it stops
  // at (Integrate’s startDivider / endDivider, by key) points at keys that
  // do not exist the moment the drawing is re-opened. Read as frame to
  // frame, that turned a four-opening frame into a six-cell grid: live
  // drawing 56 priced £7,095.53 against £8,936.47, with four panels of
  // negative area.
  //
  // Every path that writes a drawing goes through here — the board’s save,
  // creating from a template, and copying a drawing (which is worse: the
  // references would point at the SOURCE drawing’s rows) — so this is the
  // one place it can be put right.
  //
  // The re-pointing is POSITIONAL (the nth mullion or transom of the nth
  // frame), so it is right whatever ids the database hands out, and it runs
  // after every save, so a table that renumbers its rows cannot break it.
  // Only the one or two rows that hold a reference are written.
  let refsFixed = 0
  if (hasDividerRefs(tree)) {
    const saved = await loadDrawingParts(drawingId)
    const { changed } = fixDividerRefsAfterSave(tree, saved)
    for (const row of changed) {
      const { error: refErr } = await supabase
        .from('drawing_parts')
        .update({ values: row.values })
        .eq('id', Number(row.key))
      // A failed re-point must not look like a failed save — the parts ARE
      // saved — but it must not pass silently either: the board shows a dead
      // reference as a validation error on the next load, and this says why.
      if (refErr) {
        console.error('save_drawing_parts: could not re-point a divider ' +
          `reference on part ${row.key}: ${refErr.message}`)
      } else {
        refsFixed += 1
      }
    }
  }

  return { rowsWritten: parts.length, data, refsFixed }
}
