import { supabase } from '../supabase.js'

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
  return { rowsWritten: parts.length, data }
}
